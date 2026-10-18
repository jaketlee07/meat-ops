-- ============================================================
-- Alerts after corrections (corrections T3).
--
-- The watch's cost rule reads a lot's current cost, so a corrected receipt is
-- judged and compared at its corrected cost, and its yield and stock rules
-- leave reversed batches out: a reversed batch is neither a candidate, a
-- reference, nor a draw. refresh_alerts is the only Alerts function that reads
-- lot costs or the batch tables (v_alerts only joins a batch for display).
--
-- Copied from 20261016204845_alerts.sql with only those reads changed;
-- create or replace keeps the signature, the grants, security definer, and
-- the empty search_path.
-- ============================================================

create or replace function public.refresh_alerts(p_today date)
returns table (open_count integer, urgent_count integer)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_changes bigint;
begin
    perform private.assert_caller('refresh_alerts');

    if p_today is null then
        raise exception 'refresh_alerts: today is required';
    end if;

    -- One watch at a time; a second waits here and then sees the first's rows.
    perform pg_advisory_xact_lock(hashtextextended('meat-ops:refresh_alerts', 0));

    with
    -- Margin rule: an active finished product below target.
    margin as (
        select 'margin_below_target'::text as type, 'high'::text as severity,
               vp.product_id, null::uuid as lot_id, null::uuid as batch_id,
               jsonb_build_object(
                   'list_price', round(vp.list_price_per_lb, 2),
                   'margin_at_list', round(vp.margin_at_list_pct, 4),
                   'target_margin', round(vp.target_margin_pct, 4),
                   'cost_per_lb', round(vp.cost_per_lb, 4),
                   'suggested_list_price', round(vp.suggested_list_price, 2),
                   'price_action', vp.price_action) as facts
        from public.v_product_pricing vp
        where vp.below_target
    ),
    -- Price rule: the cost moved 5% or more since the last list-price change.
    price as (
        select 'price_stale'::text, 'low'::text, vp.product_id, null::uuid, null::uuid,
               jsonb_build_object(
                   'list_price', round(vp.list_price_per_lb, 2),
                   'changed_at', to_char(h.changed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                   'cost_then', round(h.cost_per_lb, 4),
                   'cost_per_lb', round(vp.cost_per_lb, 4),
                   'drift', round((vp.cost_per_lb - h.cost_per_lb) / nullif(h.cost_per_lb, 0), 4),
                   'price_action', vp.price_action,
                   'suggested_list_price', round(vp.suggested_list_price, 2))
        from public.v_product_pricing vp
        cross join lateral (
            select c.changed_at, c.cost_per_lb
            from private.list_price_changes c
            where c.product_id = vp.product_id
            order by c.seq desc
            limit 1) h
        where vp.has_cost
          and vp.list_price_per_lb is not null
          and vp.needs_new_price
          and not vp.below_target
          and h.cost_per_lb > 0
          and abs(vp.cost_per_lb - h.cost_per_lb) >= 0.05 * h.cost_per_lb
    ),
    -- Cost rule. A candidate is a recent non-void lot of an active raw product;
    -- its reference receipts are the latest 10 earlier non-void lots.
    cost_cand as (
        select l.id as lot_id, l.product_id, l.received_date, l.receipt_seq, l.current_unit_cost as unit_cost
        from public.lots l
        join public.products p on p.id = l.product_id and p.kind = 'raw' and p.active
        where l.voided_at is null
          and l.received_date between p_today - 13 and p_today
    ),
    cost_ref as (
        select c.lot_id, r.unit_cost,
               row_number() over (partition by c.lot_id order by r.unit_cost) as rn,
               count(*) over (partition by c.lot_id) as n
        from cost_cand c
        cross join lateral (
            select e.current_unit_cost as unit_cost
            from public.lots e
            where e.product_id = c.product_id
              and e.voided_at is null
              and (e.received_date, e.receipt_seq) < (c.received_date, c.receipt_seq)
            order by e.received_date desc, e.receipt_seq desc
            limit 10) r
    ),
    cost_usual as (
        select lot_id, max(n) as n, avg(unit_cost) as usual_cost
        from cost_ref
        where rn in ((n + 1) / 2, (n + 2) / 2)
        group by lot_id
    ),
    cost_dev as (
        select r.lot_id, abs(r.unit_cost - u.usual_cost) as dev,
               row_number() over (partition by r.lot_id order by abs(r.unit_cost - u.usual_cost)) as rn,
               count(*) over (partition by r.lot_id) as n
        from cost_ref r
        join cost_usual u on u.lot_id = r.lot_id
        where u.n >= 3 and u.usual_cost > 0
    ),
    -- Median of |cost - usual cost|; the usual swing is this over the usual cost.
    cost_mad as (
        select lot_id, avg(dev) as mad
        from cost_dev
        where rn in ((n + 1) / 2, (n + 2) / 2)
        group by lot_id
    ),
    cost as (
        select 'cost_anomaly'::text, 'high'::text, c.product_id, c.lot_id, null::uuid,
               jsonb_build_object(
                   'received_date', c.received_date,
                   'unit_cost', round(c.unit_cost, 4),
                   'usual_cost', round(u.usual_cost, 4),
                   'change', round((c.unit_cost - u.usual_cost) / nullif(u.usual_cost, 0), 4),
                   'band', round(greatest(0.10, 3 * m.mad / nullif(u.usual_cost, 0)), 4),
                   'reference_count', u.n)
        from cost_cand c
        join cost_usual u on u.lot_id = c.lot_id
        join cost_mad m on m.lot_id = c.lot_id
        where u.n >= 3
          and u.usual_cost > 0
          and abs(c.unit_cost - u.usual_cost) >= greatest(0.10 * u.usual_cost, 3 * m.mad)
    ),
    -- Yield rule. A batch is measured unless its finished lbs equal what its
    -- shrink used gives; only measured batches are candidates or references.
    yield_cand as (
        select b.id as batch_id, b.finished_product_id as product_id, b.production_date,
               fg.produced_seq, b.raw_lbs_in, b.finished_lbs_out, b.shrink_pct_used,
               1 - b.finished_lbs_out / b.raw_lbs_in as shrink
        from public.production_batches b
        join public.finished_goods fg on fg.batch_id = b.id
        join public.products p on p.id = b.finished_product_id and p.kind = 'finished' and p.active
        where b.production_date between p_today - 13 and p_today
          and b.reversed_at is null
          and b.finished_lbs_out <> round(b.raw_lbs_in * (1 - b.shrink_pct_used), 3)
    ),
    yield_ref as (
        select c.batch_id, r.shrink,
               row_number() over (partition by c.batch_id order by r.shrink) as rn,
               count(*) over (partition by c.batch_id) as n
        from yield_cand c
        cross join lateral (
            select 1 - e.finished_lbs_out / e.raw_lbs_in as shrink
            from public.production_batches e
            join public.finished_goods efg on efg.batch_id = e.id
            where e.finished_product_id = c.product_id
              and e.reversed_at is null
              and e.finished_lbs_out <> round(e.raw_lbs_in * (1 - e.shrink_pct_used), 3)
              and (e.production_date, efg.produced_seq) < (c.production_date, c.produced_seq)
            order by e.production_date desc, efg.produced_seq desc
            limit 10) r
    ),
    yield_usual as (
        select batch_id, max(n) as n, avg(shrink) as usual_shrink
        from yield_ref
        where rn in ((n + 1) / 2, (n + 2) / 2)
        group by batch_id
    ),
    yield_dev as (
        select r.batch_id, abs(r.shrink - u.usual_shrink) as dev,
               row_number() over (partition by r.batch_id order by abs(r.shrink - u.usual_shrink)) as rn,
               count(*) over (partition by r.batch_id) as n
        from yield_ref r
        join yield_usual u on u.batch_id = r.batch_id
        where u.n >= 3
    ),
    yield_mad as (
        select batch_id, avg(dev) as mad
        from yield_dev
        where rn in ((n + 1) / 2, (n + 2) / 2)
        group by batch_id
    ),
    yield_stat as (
        select c.*,
               case when u.n >= 3 then u.usual_shrink else c.shrink_pct_used end as usual_shrink,
               case when u.n >= 3 then greatest(0.03, 3 * m.mad) else 0.03 end as band
        from yield_cand c
        left join yield_usual u on u.batch_id = c.batch_id
        left join yield_mad m on m.batch_id = c.batch_id
    ),
    yield as (
        select 'yield_anomaly'::text, 'medium'::text, s.product_id, null::uuid, s.batch_id,
               jsonb_build_object(
                   'production_date', s.production_date,
                   'raw_lbs_in', round(s.raw_lbs_in, 3),
                   'finished_lbs_out', round(s.finished_lbs_out, 3),
                   'shrink', round(s.shrink, 4),
                   'usual_shrink', round(s.usual_shrink, 4),
                   'band', round(s.band, 4),
                   'shrink_used', round(s.shrink_pct_used, 4))
        from yield_stat s
        where abs(s.shrink - s.usual_shrink) >= s.band
    ),
    -- Stock rule: days left = on hand / (lbs drawn in 28 days / 28) is below 7
    -- exactly when on hand * 28 < 7 * lbs drawn.
    stock_use as (
        select l.product_id, sum(pbl.lbs_consumed) as lbs
        from public.production_batch_lots pbl
        join public.production_batches b on b.id = pbl.batch_id
        join public.lots l on l.id = pbl.lot_id
        where b.production_date between p_today - 27 and p_today
          and b.reversed_at is null
        group by l.product_id
    ),
    stock as (
        select 'low_stock'::text, 'medium'::text, p.id, null::uuid, null::uuid,
               jsonb_build_object(
                   'on_hand', round(coalesce(ib.qty_on_hand, 0), 3),
                   'daily_use', round(u.lbs / 28, 3),
                   'days_left', round(coalesce(ib.qty_on_hand, 0) * 28 / u.lbs, 4),
                   'order_lbs', ceil(14 * u.lbs / 28 - coalesce(ib.qty_on_hand, 0)))
        from stock_use u
        join public.products p on p.id = u.product_id and p.kind = 'raw' and p.active
        left join public.inventory_balances ib on ib.product_id = p.id
        where u.lbs > 0
          and coalesce(ib.qty_on_hand, 0) * 28 < 7 * u.lbs
    ),
    cond as materialized (
        select * from margin
        union all select * from price
        union all select * from cost
        union all select * from yield
        union all select * from stock
    ),
    updated as (
        update public.alerts a
        set facts = c.facts, updated_at = now()
        from cond c
        where a.ended_at is null
          and a.status = 'open'
          and a.type = c.type
          and a.product_id = c.product_id
          and a.lot_id is not distinct from c.lot_id
          and a.batch_id is not distinct from c.batch_id
          and a.facts is distinct from c.facts
        returning a.id
    ),
    inserted as (
        insert into public.alerts(type, severity, product_id, lot_id, batch_id, facts)
        select c.type, c.severity, c.product_id, c.lot_id, c.batch_id, c.facts
        from cond c
        where not exists (
            select 1 from public.alerts a
            where a.ended_at is null
              and a.type = c.type
              and a.product_id = c.product_id
              and a.lot_id is not distinct from c.lot_id
              and a.batch_id is not distinct from c.batch_id)
        returning id
    ),
    -- An open alert whose condition is gone is cleared; a dismissed one keeps
    -- its status and gets its end time.
    ended as (
        update public.alerts a
        set ended_at = now(),
            updated_at = now(),
            status = case when a.status = 'open' then 'cleared' else a.status end,
            closed_at = case when a.status = 'open' then now() else a.closed_at end
        where a.ended_at is null
          and not exists (
              select 1 from cond c
              where c.type = a.type
                and c.product_id = a.product_id
                and c.lot_id is not distinct from a.lot_id
                and c.batch_id is not distinct from a.batch_id)
        returning a.id
    )
    -- The select into is only here because the row-changing with needs a final statement.
    select (select count(*) from updated) + (select count(*) from inserted) + (select count(*) from ended)
    into v_changes;

    return query
    select (count(*) filter (where a.status = 'open'))::integer,
           (count(*) filter (where a.status = 'open' and a.severity = 'high'))::integer
    from public.alerts a;
end $$;
