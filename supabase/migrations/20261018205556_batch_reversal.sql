-- ============================================================
-- Batch reversal (corrections T2).
--
-- A reversal is a void of the batch: reverse_batch voids each sale drawn from
-- the batch's finished lot as void_sale does, zeroes that lot, returns the raw
-- lbs to the lots they came from, and marks the batch. The consumption rows
-- stay as the record of what was drawn and returned, so a lot's used lbs count
-- only batches that are not reversed, and void_receipt and adjust_lot read
-- through that filter.
--
-- The new function revokes the local default privileges before it grants.
-- ============================================================

-- ------------------------------------------------------------
-- 1. The reversal marks
-- ------------------------------------------------------------

alter table public.production_batches
    add column reversed_at     timestamptz,
    add column reversal_reason text,
    add constraint production_batches_reversal_pair
        check ((reversed_at is null) = (reversal_reason is null));

-- ------------------------------------------------------------
-- 2. Counters skip reversed batches
-- ------------------------------------------------------------

-- Void a receipt nothing has used. Batches that were reversed do not count as use.
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

    -- First void lot, in FIFO order, with no lot after it that a batch that is
    -- not reversed has consumed.
    if v_zero_avg is null then
        select l.prior_avg_cost into v_zero_avg
        from public.lots l
        where l.product_id = v_product
          and l.voided_at is not null
          and not exists (
              select 1 from public.lots c
              join public.production_batch_lots pbl on pbl.lot_id = c.id
              join public.production_batches b on b.id = pbl.batch_id
              where c.product_id = v_product
                and b.reversed_at is null
                and (c.received_date, c.receipt_seq) > (l.received_date, l.receipt_seq))
        order by l.received_date, l.receipt_seq
        limit 1;
    end if;

    perform private.refresh_balance(v_product, coalesce(v_zero_avg, v_lot.prior_avg_cost));

    return v_lot;
end $$;

-- Set a lot's remaining lbs to a counted value between 0 and what production
-- has not used, counted from the current weight. Reversed batches used nothing.
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

    select coalesce(sum(pbl.lbs_consumed), 0) into v_consumed
    from public.production_batch_lots pbl
    join public.production_batches b on b.id = pbl.batch_id
    where pbl.lot_id = p_lot_id and b.reversed_at is null;
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
-- 3. reverse_batch
-- ------------------------------------------------------------

-- Reverse a batch that should not exist. Each non-void sale with a line on the
-- batch's finished lot is voided as void_sale voids it, with the batch's
-- number and the reason, at the transaction's time (the batch's reversal time).
-- Then the finished lot goes to 0 lbs and each consumption row's lbs go back to
-- its lot. Locks: the raw product's balance row, the finished product's
-- products row, then the batch, so no operation takes them in the other order.
create function public.reverse_batch(p_batch_id uuid, p_reason text)
returns public.production_batches
language plpgsql security definer
set search_path = ''
as $$
declare
    v_finished uuid;
    v_raw      uuid;
    v_batch    public.production_batches;
    v_sale     uuid;
begin
    perform private.assert_caller('reverse_batch');

    if p_reason is null or btrim(p_reason, E' \t\r\n') = '' then
        raise exception 'reverse_batch: invalid reason, give at least one non-space character';
    end if;

    select finished_product_id into v_finished from public.production_batches where id = p_batch_id;
    if not found then
        raise exception 'reverse_batch: invalid batch %, not found', p_batch_id;
    end if;

    select l.product_id into v_raw
    from public.production_batch_lots pbl
    join public.lots l on l.id = pbl.lot_id
    where pbl.batch_id = p_batch_id
    limit 1;

    perform 1 from public.inventory_balances where product_id = v_raw for update;
    -- NO KEY UPDATE queues behind record_sale and void_sale without blocking
    -- produce_batch's foreign-key checks.
    perform 1 from public.products where id = v_finished for no key update;

    select * into v_batch from public.production_batches where id = p_batch_id for update;
    if v_batch.reversed_at is not null then
        raise exception 'reverse_batch: batch % is already reversed', p_batch_id;
    end if;

    for v_sale in
        select s.id
        from public.sales s
        where s.voided_at is null
          and exists (
              select 1
              from public.sale_items si
              join public.finished_goods fg on fg.id = si.finished_goods_id
              where si.sale_id = s.id and fg.batch_id = p_batch_id)
        order by s.id
        for update of s
    loop
        update public.finished_goods fg
        set lbs_remaining = fg.lbs_remaining + x.lbs
        from (
            select finished_goods_id, sum(lbs_sold) as lbs
            from public.sale_items where sale_id = v_sale
            group by finished_goods_id
        ) x
        where fg.id = x.finished_goods_id;

        update public.sales
        set voided_at = now(),
            void_reason = 'Reversed with batch ' || v_batch.batch_number || ': ' || p_reason
        where id = v_sale;
    end loop;

    update public.finished_goods set lbs_remaining = 0 where batch_id = p_batch_id;

    update public.lots l
    set remaining_lbs = l.remaining_lbs + x.lbs
    from (
        select lot_id, sum(lbs_consumed) as lbs
        from public.production_batch_lots where batch_id = p_batch_id
        group by lot_id
    ) x
    where l.id = x.lot_id;

    update public.production_batches
    set reversed_at = now(), reversal_reason = p_reason
    where id = p_batch_id
    returning * into v_batch;

    perform private.refresh_balance(v_raw);

    return v_batch;
end $$;
revoke all on function public.reverse_batch(uuid, text)
    from public, anon, authenticated, service_role;
grant execute on function public.reverse_batch(uuid, text)
    to authenticated;
