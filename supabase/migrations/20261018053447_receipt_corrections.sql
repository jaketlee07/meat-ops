-- ============================================================
-- Receipt corrections (corrections T1).
--
-- A lot keeps what was received (unit_cost and weight_lbs, frozen by
-- lots_guard) and gains what is current: two nullable columns hold the latest
-- correction, and two stored generated columns give coalesce(corrected,
-- recorded). Only correct_receipt writes the corrected columns. It restates
-- every batch made from the lot, keeping the processing fees the batch was
-- costed with, and every figure made from those batches.
--
-- The new table, its identity sequence, and the new function revoke the local
-- default privileges before they grant.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Lot columns and the remaining-lbs check
-- ------------------------------------------------------------

alter table public.lots
    add column corrected_unit_cost  numeric(12,4) check (corrected_unit_cost >= 0),
    add column corrected_weight_lbs numeric(14,3) check (corrected_weight_lbs > 0),
    add column current_unit_cost    numeric(12,4)
        generated always as (coalesce(corrected_unit_cost, unit_cost)) stored,
    add column current_weight_lbs   numeric(14,3)
        generated always as (coalesce(corrected_weight_lbs, weight_lbs)) stored;

alter table public.lots drop constraint lots_check;
alter table public.lots add constraint lots_remaining_range
    check (remaining_lbs >= 0 and remaining_lbs <= current_weight_lbs);

-- ------------------------------------------------------------
-- 2. The correction record
-- ------------------------------------------------------------

-- correction_seq orders corrections: two in one transaction share a time.
create table public.receipt_corrections (
    id             uuid primary key default gen_random_uuid(),
    lot_id         uuid not null references public.lots(id),
    old_unit_cost  numeric(12,4) not null,
    new_unit_cost  numeric(12,4) not null,
    old_weight_lbs numeric(14,3) not null,
    new_weight_lbs numeric(14,3) not null,
    reason         text not null,
    corrected_at   timestamptz not null default now(),
    correction_seq bigint generated always as identity
);
create index on public.receipt_corrections (lot_id);

revoke all on table public.receipt_corrections from public, anon, authenticated, service_role;
revoke all on sequence public.receipt_corrections_correction_seq_seq
    from public, anon, authenticated, service_role;
alter table public.receipt_corrections enable row level security;
create policy operators_select on public.receipt_corrections
    for select to authenticated using ((select private.is_operator()));
grant select on table public.receipt_corrections to authenticated, service_role;

-- ------------------------------------------------------------
-- 3. Readers move to current cost and weight
-- ------------------------------------------------------------

-- Callers hold the product's inventory_balances row lock. When no lbs remain
-- the stored average is kept, unless the caller passes p_zero_stock_avg.
create or replace function private.refresh_balance(
    p_raw_product_id uuid,
    p_zero_stock_avg numeric default null
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_qty   numeric;
    v_value numeric;
begin
    select coalesce(sum(remaining_lbs), 0), coalesce(sum(remaining_lbs * current_unit_cost), 0)
    into v_qty, v_value
    from public.lots
    where product_id = p_raw_product_id;

    update public.inventory_balances
    set qty_on_hand     = v_qty,
        moving_avg_cost = case when v_qty = 0
                               then coalesce(p_zero_stock_avg, moving_avg_cost)
                               else v_value / v_qty end,
        updated_at      = now()
    where product_id = p_raw_product_id;
end $$;

-- Produce: the consumption row and the batch total take the lot's current cost.
create or replace function public.produce_batch(
    p_finished_product_id uuid,
    p_raw_lbs_in          numeric,
    p_finished_lbs_out    numeric default null,   -- measured yield; null => computed from shrink
    p_production_date     date default current_date,
    p_batch_number        text default null,
    p_notes               text default null
) returns public.production_batches
language plpgsql security definer
set search_path = ''
as $$
declare
    v_raw_product_id uuid;
    v_shrink         numeric;
    v_active         boolean;
    v_raw_active     boolean;
    v_finished_out   numeric;
    v_need           numeric;
    v_raw_cost_total numeric := 0;
    v_lot            record;
    v_take           numeric;
    v_proc_fee       numeric;
    v_batch          public.production_batches;
    v_batch_no       text;
    v_cost_per_lb    numeric;
    v_avail          numeric;
begin
    perform private.assert_caller('produce_batch');

    if p_raw_lbs_in is null or p_raw_lbs_in = 'NaN'::numeric or p_raw_lbs_in <= 0 then
        raise exception 'produce_batch: invalid raw lbs in, must be above 0';
    end if;
    if p_finished_lbs_out is not null
       and (p_finished_lbs_out = 'NaN'::numeric
            or p_finished_lbs_out <= 0
            or p_finished_lbs_out > p_raw_lbs_in) then
        raise exception 'produce_batch: invalid measured yield, must be above 0 and at most raw lbs in';
    end if;
    if p_production_date is null then
        raise exception 'produce_batch: invalid production date';
    end if;

    select raw_product_id, shrink_pct, active
    into v_raw_product_id, v_shrink, v_active
    from public.products where id = p_finished_product_id and kind = 'finished';
    if not found or v_raw_product_id is null then
        raise exception 'produce_batch: invalid product %, not a finished product with a recipe', p_finished_product_id;
    end if;
    if not v_active then
        raise exception 'produce_batch: product % is inactive', p_finished_product_id;
    end if;

    select active into v_raw_active
    from public.products where id = v_raw_product_id and kind = 'raw';
    if v_raw_active is null then
        raise exception 'produce_batch: invalid raw input %, not a raw product', v_raw_product_id;
    end if;
    if not v_raw_active then
        raise exception 'produce_batch: raw input % is inactive', v_raw_product_id;
    end if;

    -- Lock first, read stock after: a second writer on this raw product waits here.
    perform 1 from public.inventory_balances where product_id = v_raw_product_id for update;

    select coalesce(sum(remaining_lbs), 0) into v_avail
    from public.lots
    where product_id = v_raw_product_id
      and received_date <= p_production_date
      and remaining_lbs > 0;
    if v_avail < p_raw_lbs_in then
        raise exception 'produce_batch: shortfall, only % lbs raw available on or before %, need %',
            v_avail, p_production_date, p_raw_lbs_in;
    end if;

    v_finished_out := coalesce(p_finished_lbs_out, round(p_raw_lbs_in * (1 - v_shrink), 3));
    if v_finished_out <= 0 then
        raise exception 'produce_batch: invalid yield, finished lbs out would be 0';
    end if;

    v_batch_no := coalesce(p_batch_number,
        'B-' || to_char(p_production_date, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6));

    insert into public.production_batches(batch_number, finished_product_id, production_date,
        raw_lbs_in, shrink_pct_used, finished_lbs_out, raw_cost_total, cost_per_finished_lb, notes)
    values (v_batch_no, p_finished_product_id, p_production_date,
        p_raw_lbs_in, v_shrink, v_finished_out, 0, 0, p_notes)
    returning * into v_batch;

    -- FIFO consumption: oldest received first, insertion order within a date.
    v_need := p_raw_lbs_in;
    for v_lot in
        select * from public.lots
        where product_id = v_raw_product_id
          and received_date <= p_production_date
          and remaining_lbs > 0
        order by received_date, receipt_seq
        for update
    loop
        exit when v_need <= 0;
        v_take := least(v_lot.remaining_lbs, v_need);

        insert into public.production_batch_lots(batch_id, lot_id, lbs_consumed, lot_unit_cost)
        values (v_batch.id, v_lot.id, v_take, v_lot.current_unit_cost);

        update public.lots set remaining_lbs = remaining_lbs - v_take where id = v_lot.id;
        v_raw_cost_total := v_raw_cost_total + v_take * v_lot.current_unit_cost;
        v_need := v_need - v_take;
    end loop;

    -- Second net behind the availability check.
    if v_need > 0 then
        raise exception 'produce_batch: shortfall, eligible lots ran out with % lbs still needed', v_need;
    end if;

    perform private.refresh_balance(v_raw_product_id);

    select coalesce(sum(pf.amount_per_lb), 0) into v_proc_fee
    from public.product_fees pf join public.fee_types ft on ft.id = pf.fee_type_id
    where pf.product_id = p_finished_product_id and ft.kind = 'processing';

    -- Dividing true raw cost by the smaller finished weight bakes shrinkage into cost/lb.
    v_cost_per_lb := round(v_raw_cost_total / v_finished_out + v_proc_fee, 4);

    update public.production_batches
    set raw_cost_total = v_raw_cost_total, cost_per_finished_lb = v_cost_per_lb
    where id = v_batch.id returning * into v_batch;

    insert into public.finished_goods(batch_id, finished_product_id, lbs_produced, lbs_remaining, cost_per_lb, produced_date)
    values (v_batch.id, p_finished_product_id, v_finished_out, v_finished_out, v_cost_per_lb, p_production_date);

    return v_batch;
end $$;

-- Void a receipt nothing has used. Remaining lbs are compared with the current weight.
create or replace function public.void_receipt(p_lot_id uuid, p_reason text) returns public.lots
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
    if v_lot.remaining_lbs <> v_lot.current_weight_lbs
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

-- Set a lot's remaining lbs to a counted value between 0 and what production
-- has not used, counted from the current weight.
create or replace function public.adjust_lot(
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
    if p_new_remaining_lbs < 0 or p_new_remaining_lbs > v_lot.current_weight_lbs - v_consumed then
        raise exception 'adjust_lot: invalid new remaining lbs %, must be from 0 to %',
            p_new_remaining_lbs, v_lot.current_weight_lbs - v_consumed;
    end if;

    v_new := round(p_new_remaining_lbs, 3);

    insert into public.lot_adjustments(lot_id, old_remaining_lbs, new_remaining_lbs, reason, note)
    values (p_lot_id, v_lot.remaining_lbs, v_new, p_reason, p_note);

    update public.lots set remaining_lbs = v_new where id = p_lot_id returning * into v_lot;

    perform private.refresh_balance(v_product);

    return v_lot;
end $$;

-- ------------------------------------------------------------
-- 4. correct_receipt
-- ------------------------------------------------------------

-- Correct a receipt's cost per lb, weight, or both. A weight change moves
-- remaining lbs by the same amount and cannot go below what production used and
-- adjustments removed. A cost change restates each batch made from the lot: the
-- processing fee the batch was costed with is recovered from its stored cost
-- before its rows change (fees are numeric(10,4), so the recovery is exact),
-- and the batch, its finished lot, and that lot's sale lines take the restated
-- cost. At 0 lbs on hand the stored average stays, as the zero-stock rule says.
create function public.correct_receipt(
    p_lot_id     uuid,
    p_unit_cost  numeric,
    p_weight_lbs numeric,
    p_reason     text
) returns public.lots
language plpgsql security definer
set search_path = ''
as $$
declare
    v_product  uuid;
    v_lot      public.lots;
    v_old_cost numeric;
    v_cost     numeric(12,4);
    v_weight   numeric(14,3);
    v_min      numeric;
    v_batch    uuid;
    v_fee      numeric;
    v_raw      numeric;
    v_new      numeric;
begin
    perform private.assert_caller('correct_receipt');

    if p_reason is null or btrim(p_reason, E' \t\r\n') = '' then
        raise exception 'correct_receipt: invalid reason, give at least one non-space character';
    end if;
    if p_unit_cost is null or p_unit_cost = 'NaN'::numeric or p_unit_cost < 0 then
        raise exception 'correct_receipt: invalid unit cost, must be 0 or above';
    end if;
    if p_weight_lbs is null or p_weight_lbs = 'NaN'::numeric or p_weight_lbs <= 0 then
        raise exception 'correct_receipt: invalid weight, must be above 0';
    end if;
    v_weight := round(p_weight_lbs, 3);
    if v_weight <= 0 then
        raise exception 'correct_receipt: invalid weight, must be above 0';
    end if;

    select product_id into v_product from public.lots where id = p_lot_id;
    if not found then
        raise exception 'correct_receipt: invalid lot %, not found', p_lot_id;
    end if;

    -- The raw product's balance row first, then the lot.
    perform 1 from public.inventory_balances where product_id = v_product for update;

    select * into v_lot from public.lots where id = p_lot_id for update;
    if v_lot.voided_at is not null then
        raise exception 'correct_receipt: lot % is already void', p_lot_id;
    end if;

    v_cost := round(p_unit_cost, 4);
    if v_cost = v_lot.current_unit_cost and v_weight = v_lot.current_weight_lbs then
        raise exception 'correct_receipt: invalid, nothing to correct';
    end if;

    v_min := v_lot.current_weight_lbs - v_lot.remaining_lbs;
    if v_weight < v_min then
        raise exception 'correct_receipt: invalid weight %, must be at least % lbs', v_weight, v_min;
    end if;

    -- The finished products made from this lot, in id order, queue behind
    -- record_sale and void_sale. Only the subquery reads the batches.
    perform 1
    from public.products p
    where p.id in (
        select b.finished_product_id
        from public.production_batch_lots pbl
        join public.production_batches b on b.id = pbl.batch_id
        where pbl.lot_id = p_lot_id)
    order by p.id
    for no key update of p;

    insert into public.receipt_corrections(lot_id, old_unit_cost, new_unit_cost,
                                           old_weight_lbs, new_weight_lbs, reason)
    values (p_lot_id, v_lot.current_unit_cost, v_cost, v_lot.current_weight_lbs, v_weight, p_reason);

    v_old_cost := v_lot.current_unit_cost;

    update public.lots
    set corrected_unit_cost  = v_cost,
        corrected_weight_lbs = v_weight,
        remaining_lbs        = remaining_lbs + (v_weight - v_lot.current_weight_lbs)
    where id = p_lot_id
    returning * into v_lot;

    if v_cost <> v_old_cost then
        for v_batch in
            select distinct pbl.batch_id
            from public.production_batch_lots pbl
            where pbl.lot_id = p_lot_id
            order by 1
        loop
            -- The fee as used, before the batch's rows are restated.
            select b.cost_per_finished_lb
                   - round(sum(pbl.lbs_consumed * pbl.lot_unit_cost) / b.finished_lbs_out, 4)
            into v_fee
            from public.production_batches b
            join public.production_batch_lots pbl on pbl.batch_id = b.id
            where b.id = v_batch
            group by b.id;

            update public.production_batch_lots
            set lot_unit_cost = v_cost
            where batch_id = v_batch and lot_id = p_lot_id;

            select sum(lbs_consumed * lot_unit_cost) into v_raw
            from public.production_batch_lots where batch_id = v_batch;

            update public.production_batches b
            set raw_cost_total       = round(v_raw, 4),
                cost_per_finished_lb = round(v_raw / b.finished_lbs_out, 4) + v_fee
            where b.id = v_batch
            returning b.cost_per_finished_lb into v_new;

            update public.finished_goods set cost_per_lb = v_new where batch_id = v_batch;

            update public.sale_items si
            set cost_per_lb = v_new
            from public.finished_goods fg
            where fg.id = si.finished_goods_id and fg.batch_id = v_batch;
        end loop;
    end if;

    perform private.refresh_balance(v_product);

    return v_lot;
end $$;
revoke all on function public.correct_receipt(uuid, numeric, numeric, text)
    from public, anon, authenticated, service_role;
grant execute on function public.correct_receipt(uuid, numeric, numeric, text)
    to authenticated;

-- ------------------------------------------------------------
-- 5. The trace view shows the current cost
-- ------------------------------------------------------------

create or replace view public.v_sale_traceability with (security_invoker = true) as
select
    s.sale_number, s.sale_date,
    fp.code as finished_code, fp.description as finished_product, si.lbs_sold, si.price_per_lb,
    b.batch_number, b.production_date,
    l.lot_number as raw_lot, rp.description as raw_product, v.name as vendor,
    l.received_date, pbl.lbs_consumed as raw_lbs_from_lot, l.current_unit_cost as raw_lot_cost_per_lb,
    si.id as sale_item_id, c.name as customer,
    s.id as sale_id, s.created_at as sale_created_at, s.customer_id,
    rp.code as raw_code, fg.produced_seq, l.receipt_seq
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
