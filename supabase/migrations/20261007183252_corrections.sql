-- ============================================================
-- Corrections (foundation-hardening T4).
--
-- The owner can void a receipt nothing has touched, void a wrong sale, and set
-- a lot's remaining pounds to a counted value. Voids mark rows and never
-- delete them. Each operation is SECURITY DEFINER, checks the caller first,
-- takes the same row lock as the operations it can race with, and reads every
-- precondition only after that lock. The trace view gains the sale line and the
-- customer and drops void sales.
--
-- Every new object revokes the local default privileges before it grants.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columns and the adjustment table
-- ------------------------------------------------------------

alter table public.lots
    add column voided_at timestamptz,
    add column void_reason text,
    add constraint lots_void_pair check ((voided_at is null) = (void_reason is null));

alter table public.sales
    add column voided_at timestamptz,
    add column void_reason text,
    add constraint sales_void_pair check ((voided_at is null) = (void_reason is null));

create table public.lot_adjustments (
    id                uuid primary key default gen_random_uuid(),
    lot_id            uuid not null references public.lots(id),
    old_remaining_lbs numeric(14,3) not null,
    new_remaining_lbs numeric(14,3) not null,
    reason            text not null check (reason in ('count', 'waste', 'spoilage', 'other')),
    note              text,
    adjusted_at       timestamptz not null default now()
);
create index on public.lot_adjustments (lot_id);

revoke all on table public.lot_adjustments from public, anon, authenticated, service_role;
alter table public.lot_adjustments enable row level security;
create policy operators_select on public.lot_adjustments
    for select to authenticated using ((select private.is_operator()));
grant select on table public.lot_adjustments to authenticated, service_role;

-- ------------------------------------------------------------
-- 2. The three operations
-- ------------------------------------------------------------

-- Void a receipt nothing has consumed or adjusted. The lot stays as a marked
-- row with 0 lbs. When no lbs are left on hand, the average becomes the prior
-- average of the first void lot, in FIFO order, after the last non-void lot
-- (AC-0053). When a later non-void lot, already adjusted to 0, leaves no such
-- void lot, it becomes the prior average of the first void lot after the last
-- lot production drew from. If neither search finds a lot, the voided lot's own
-- prior average is used. docs/costing.md describes the known limit.
create function public.void_receipt(p_lot_id uuid, p_reason text) returns public.lots
language plpgsql security definer
set search_path = ''
as $$
declare
    v_product  uuid;
    v_lot      public.lots;
    v_zero_avg numeric;
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
    if v_lot.remaining_lbs <> v_lot.weight_lbs
       or exists (select 1 from public.production_batch_lots where lot_id = p_lot_id) then
        raise exception 'void_receipt: invalid, lot % has been consumed', p_lot_id;
    end if;
    if exists (select 1 from public.lot_adjustments where lot_id = p_lot_id) then
        raise exception 'void_receipt: invalid, lot % has been adjusted', p_lot_id;
    end if;

    update public.lots
    set remaining_lbs = 0, voided_at = now(), void_reason = p_reason
    where id = p_lot_id
    returning * into v_lot;

    -- First void lot, in FIFO order, with no non-void lot after it.
    select l.prior_avg_cost into v_zero_avg
    from public.lots l
    where l.product_id = v_product
      and l.voided_at is not null
      and not exists (
          select 1 from public.lots n
          where n.product_id = v_product
            and n.voided_at is null
            and (n.received_date, n.receipt_seq) > (l.received_date, l.receipt_seq))
    order by l.received_date, l.receipt_seq
    limit 1;

    -- First void lot, in FIFO order, with no consumed lot after it.
    if v_zero_avg is null then
        select l.prior_avg_cost into v_zero_avg
        from public.lots l
        where l.product_id = v_product
          and l.voided_at is not null
          and not exists (
              select 1 from public.lots c
              join public.production_batch_lots pbl on pbl.lot_id = c.id
              where c.product_id = v_product
                and (c.received_date, c.receipt_seq) > (l.received_date, l.receipt_seq))
        order by l.received_date, l.receipt_seq
        limit 1;
    end if;

    perform private.refresh_balance(v_product, coalesce(v_zero_avg, v_lot.prior_avg_cost));

    return v_lot;
end $$;

-- Void a sale and return each line's lbs to the finished lot it came from.
create function public.void_sale(p_sale_id uuid, p_reason text) returns public.sales
language plpgsql security definer
set search_path = ''
as $$
declare
    v_product uuid;
    v_sale    public.sales;
begin
    perform private.assert_caller('void_sale');

    if p_reason is null or btrim(p_reason, E' \t\r\n') = '' then
        raise exception 'void_sale: invalid void reason, give at least one non-space character';
    end if;

    if not exists (select 1 from public.sales where id = p_sale_id) then
        raise exception 'void_sale: invalid sale %, not found', p_sale_id;
    end if;

    -- A sale draws from one finished product. NO KEY UPDATE queues behind
    -- record_sale and void_sale without blocking produce_batch's foreign-key checks.
    select fg.finished_product_id into v_product
    from public.sale_items si
    join public.finished_goods fg on fg.id = si.finished_goods_id
    where si.sale_id = p_sale_id
    limit 1;
    if v_product is not null then
        perform 1 from public.products where id = v_product for no key update;
    end if;

    select * into v_sale from public.sales where id = p_sale_id for update;
    if v_sale.voided_at is not null then
        raise exception 'void_sale: sale % is already void', p_sale_id;
    end if;

    update public.finished_goods fg
    set lbs_remaining = fg.lbs_remaining + x.lbs
    from (
        select finished_goods_id, sum(lbs_sold) as lbs
        from public.sale_items where sale_id = p_sale_id
        group by finished_goods_id
    ) x
    where fg.id = x.finished_goods_id;

    update public.sales
    set voided_at = now(), void_reason = p_reason
    where id = p_sale_id
    returning * into v_sale;

    return v_sale;
end $$;

-- Set a lot's remaining lbs to a counted value between 0 and what production
-- has not consumed. Records the old and new lbs. The unit cost never changes.
create function public.adjust_lot(
    p_lot_id            uuid,
    p_new_remaining_lbs numeric,
    p_reason            text,
    p_note              text default null
) returns public.lots
language plpgsql security definer
set search_path = ''
as $$
declare
    v_product  uuid;
    v_lot      public.lots;
    v_consumed numeric;
    v_new      numeric;
begin
    perform private.assert_caller('adjust_lot');

    if p_new_remaining_lbs is null or p_new_remaining_lbs = 'NaN'::numeric then
        raise exception 'adjust_lot: invalid new remaining lbs, must be a number';
    end if;
    if p_reason is null or p_reason not in ('count', 'waste', 'spoilage', 'other') then
        raise exception 'adjust_lot: invalid reason, use count, waste, spoilage, or other';
    end if;

    select product_id into v_product from public.lots where id = p_lot_id;
    if not found then
        raise exception 'adjust_lot: invalid lot %, not found', p_lot_id;
    end if;

    perform 1 from public.inventory_balances where product_id = v_product for update;

    select * into v_lot from public.lots where id = p_lot_id for update;
    if v_lot.voided_at is not null then
        raise exception 'adjust_lot: lot % is already void', p_lot_id;
    end if;

    select coalesce(sum(lbs_consumed), 0) into v_consumed
    from public.production_batch_lots where lot_id = p_lot_id;
    if p_new_remaining_lbs < 0 or p_new_remaining_lbs > v_lot.weight_lbs - v_consumed then
        raise exception 'adjust_lot: invalid new remaining lbs %, must be from 0 to %',
            p_new_remaining_lbs, v_lot.weight_lbs - v_consumed;
    end if;

    v_new := round(p_new_remaining_lbs, 3);

    insert into public.lot_adjustments(lot_id, old_remaining_lbs, new_remaining_lbs, reason, note)
    values (p_lot_id, v_lot.remaining_lbs, v_new, p_reason, p_note);

    update public.lots set remaining_lbs = v_new where id = p_lot_id returning * into v_lot;

    perform private.refresh_balance(v_product);

    return v_lot;
end $$;

revoke all on function public.void_receipt(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.void_sale(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.adjust_lot(uuid, numeric, text, text) from public, anon, authenticated, service_role;
grant execute on function public.void_receipt(uuid, text) to authenticated;
grant execute on function public.void_sale(uuid, text) to authenticated;
grant execute on function public.adjust_lot(uuid, numeric, text, text) to authenticated;

-- ------------------------------------------------------------
-- 3. Trace view: sale line and customer, no void sales
-- ------------------------------------------------------------

drop view public.v_sale_traceability;

-- Trace-back: sale -> finished lot -> batch -> raw lot(s) -> vendor. A sale with
-- no customer stays in the trace (left join). Void sales are left out.
create view public.v_sale_traceability with (security_invoker = true) as
select
    s.sale_number, s.sale_date,
    fp.code as finished_code, fp.description as finished_product, si.lbs_sold, si.price_per_lb,
    b.batch_number, b.production_date,
    l.lot_number as raw_lot, rp.description as raw_product, v.name as vendor,
    l.received_date, pbl.lbs_consumed as raw_lbs_from_lot, l.unit_cost as raw_lot_cost_per_lb,
    si.id as sale_item_id, c.name as customer
from public.sale_items si
join public.sales s                   on s.id = si.sale_id
join public.finished_goods fg         on fg.id = si.finished_goods_id
join public.products fp               on fp.id = fg.finished_product_id
join public.production_batches b      on b.id = fg.batch_id
join public.production_batch_lots pbl on pbl.batch_id = b.id
join public.lots l                    on l.id = pbl.lot_id
join public.products rp               on rp.id = l.product_id
left join public.vendors v            on v.id = l.vendor_id
left join public.customers c          on c.id = s.customer_id
where s.voided_at is null
order by s.sale_date desc, s.sale_number;

revoke all on table public.v_sale_traceability from public, anon, authenticated, service_role;
grant select on table public.v_sale_traceability to authenticated, service_role;
