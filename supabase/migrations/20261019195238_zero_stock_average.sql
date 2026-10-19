-- ============================================================
-- Zero-stock average (zero-stock-average T2).
--
-- At 0 lbs on hand, a raw product's average is the average current cost of
-- the lbs its last stock-lowering change took: a batch that is not reversed,
-- or an adjustment that lowered a lot. A void receipt is never a change, so
-- the order receipts are voided in never moves the average. One sequence
-- orders batches and adjustments; each operation draws it on insert, after it
-- holds the raw product's inventory_balances row.
--
-- The new sequence and the new function revoke the local default privileges
-- before anything is granted.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The order number
-- ------------------------------------------------------------

-- One number spans two tables, so it is a plain default rather than an
-- identity column, which owns its own sequence. Only the operations write these
-- tables (SYSTEM-SPEC section 11), and they take the default, so nothing else
-- sets it.
create sequence private.stock_change_seq as bigint;
revoke all on sequence private.stock_change_seq from public, anon, authenticated, service_role;

alter table public.production_batches add column stock_seq bigint;
alter table public.lot_adjustments add column stock_seq bigint;

-- Existing rows are numbered by the time they were made. At equal times, which
-- only one transaction gives, a batch comes before an adjustment, then batches
-- follow their finished lot's produced_seq and adjustments their id.
with changes as (
    select b.id, 0 as kind, b.created_at as made_at, f.produced_seq
    from public.production_batches b
    left join public.finished_goods f on f.batch_id = b.id
    union all
    select a.id, 1, a.adjusted_at, null
    from public.lot_adjustments a
), numbered as (
    select id, kind, row_number() over (order by made_at, kind, produced_seq, id) as n
    from changes
), batches as (
    update public.production_batches b
    set stock_seq = numbered.n
    from numbered
    where numbered.kind = 0 and numbered.id = b.id
    returning b.stock_seq
), adjustments as (
    update public.lot_adjustments a
    set stock_seq = numbered.n
    from numbered
    where numbered.kind = 1 and numbered.id = a.id
    returning a.stock_seq
)
select setval('private.stock_change_seq', coalesce(max(stock_seq), 1), max(stock_seq) is not null)
from (select stock_seq from batches union all select stock_seq from adjustments) given;

alter table public.production_batches
    alter column stock_seq set not null,
    alter column stock_seq set default nextval('private.stock_change_seq');
alter table public.lot_adjustments
    alter column stock_seq set not null,
    alter column stock_seq set default nextval('private.stock_change_seq');

-- ------------------------------------------------------------
-- 2. One refresh sets every average
-- ------------------------------------------------------------

drop function private.refresh_balance(uuid, numeric);

-- Callers hold the product's inventory_balances row lock. With lbs on hand the
-- average is the stock-on-hand average at current cost; with none it is the
-- zero-stock average, 0 when nothing has lowered the product's stock.
create function private.refresh_balance(p_raw_product_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_qty   numeric;
    v_value numeric;
    v_avg   numeric;
begin
    select coalesce(sum(remaining_lbs), 0), coalesce(sum(remaining_lbs * current_unit_cost), 0)
    into v_qty, v_value
    from public.lots
    where product_id = p_raw_product_id;

    if v_qty = 0 then
        with changes as (
            select b.stock_seq, b.id as batch_id, null::uuid as adjustment_id
            from public.production_batches b
            where b.reversed_at is null
              and exists (select 1
                          from public.production_batch_lots pbl
                          join public.lots l on l.id = pbl.lot_id
                          where pbl.batch_id = b.id and l.product_id = p_raw_product_id)
            union all
            select a.stock_seq, null, a.id
            from public.lot_adjustments a
            join public.lots l on l.id = a.lot_id
            where l.product_id = p_raw_product_id
              and a.new_remaining_lbs < a.old_remaining_lbs
        ), last_change as (
            select * from changes order by stock_seq desc limit 1
        ), taken as (
            select pbl.lbs_consumed as lbs, l.current_unit_cost as cost
            from last_change c
            join public.production_batch_lots pbl on pbl.batch_id = c.batch_id
            join public.lots l on l.id = pbl.lot_id
            union all
            select a.old_remaining_lbs - a.new_remaining_lbs, l.current_unit_cost
            from last_change c
            join public.lot_adjustments a on a.id = c.adjustment_id
            join public.lots l on l.id = a.lot_id
        )
        select coalesce(sum(lbs * cost) / sum(lbs), 0) into v_avg from taken;
    else
        v_avg := v_value / v_qty;
    end if;

    update public.inventory_balances
    set qty_on_hand     = v_qty,
        moving_avg_cost = v_avg,
        updated_at      = now()
    where product_id = p_raw_product_id;
end $$;
revoke all on function private.refresh_balance(uuid) from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 3. void_receipt leaves the average to the refresh
-- ------------------------------------------------------------

-- Void a receipt nothing has used. Batches that were reversed do not count as use.
create or replace function public.void_receipt(p_lot_id uuid, p_reason text) returns public.lots
language plpgsql security definer
set search_path = ''
as $$
declare
    v_product uuid;
    v_lot     public.lots;
begin
    perform private.assert_caller('void_receipt');

    if p_reason is null or btrim(p_reason, E' \t\r\n') = '' then
        raise exception 'void_receipt: invalid void reason, give at least one non-space character';
    end if;

    select product_id into v_product from public.lots where id = p_lot_id;
    if not found then
        raise exception 'void_receipt: invalid lot %, not found', p_lot_id;
    end if;

    -- Lock the raw product's balance row, then read the lot and its history.
    perform 1 from public.inventory_balances where product_id = v_product for update;

    select * into v_lot from public.lots where id = p_lot_id for update;
    if v_lot.voided_at is not null then
        raise exception 'void_receipt: lot % is already void', p_lot_id;
    end if;
    if v_lot.remaining_lbs <> v_lot.current_weight_lbs
       or exists (select 1
                  from public.production_batch_lots pbl
                  join public.production_batches b on b.id = pbl.batch_id
                  where pbl.lot_id = p_lot_id and b.reversed_at is null) then
        raise exception 'void_receipt: invalid, lot % has been consumed', p_lot_id;
    end if;
    if exists (select 1 from public.lot_adjustments where lot_id = p_lot_id) then
        raise exception 'void_receipt: invalid, lot % has been adjusted', p_lot_id;
    end if;

    update public.lots
    set remaining_lbs = 0, voided_at = now(), void_reason = p_reason
    where id = p_lot_id
    returning * into v_lot;

    perform private.refresh_balance(v_product);

    return v_lot;
end $$;

revoke all on function public.void_receipt(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.void_receipt(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 4. Balances already at 0 lbs take the rule now
-- ------------------------------------------------------------

-- Each refresh holds the product's balance row before it reads the lots, as the
-- operations do, so a receipt saved while this runs is not overwritten.
do $$
declare
    v_product uuid;
begin
    for v_product in
        select b.product_id
        from public.inventory_balances b
        join public.products p on p.id = b.product_id
        where p.kind = 'raw'
    loop
        perform 1 from public.inventory_balances where product_id = v_product for update;
        perform private.refresh_balance(v_product);
    end loop;
end $$;
