-- ============================================================
-- Alerts, part 1: the private list-price history.
--
-- private.list_price_changes holds one row for each change of a product's
-- list price, with the product's cost per lb at that moment. A trigger on
-- products sees every writer, so set_list_price stays unchanged. The table
-- sits beside private.operators, out of the Data API, with no grant to any
-- API role. Every new object revokes the local default privileges before
-- anything is granted; nothing is granted back here.
-- ============================================================

create table private.list_price_changes (
    seq         bigint generated always as identity primary key,
    product_id  uuid not null references public.products(id),
    old_price   numeric(10,2),
    new_price   numeric(10,2),
    cost_per_lb numeric(12,4),
    changed_at  timestamptz not null default now(),
    baseline    boolean not null default false
);
revoke all on table private.list_price_changes from public, anon, authenticated, service_role;
-- Identity sequences keep the default privileges unless revoked here.
revoke all on sequence private.list_price_changes_seq_seq
    from public, anon, authenticated, service_role;

-- The cost comes from v_product_pricing so the price rule is not written a
-- third time; it is null while the product has no cost.
create function private.record_list_price_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
    v_cost numeric(12,4);
begin
    select vp.cost_per_lb into v_cost
    from public.v_product_pricing vp
    where vp.product_id = new.id and vp.has_cost;

    insert into private.list_price_changes(product_id, old_price, new_price, cost_per_lb)
    values (new.id, case when tg_op = 'UPDATE' then old.list_price_per_lb end,
            new.list_price_per_lb, v_cost);
    return null;
end;
$$;
revoke all on function private.record_list_price_change()
    from public, anon, authenticated, service_role;

create trigger products_record_list_price_insert
    after insert on public.products
    for each row
    when (new.list_price_per_lb is not null)
    execute function private.record_list_price_change();

create trigger products_record_list_price_update
    after update of list_price_per_lb on public.products
    for each row
    when (new.list_price_per_lb is distinct from old.list_price_per_lb)
    execute function private.record_list_price_change();

-- One baseline row for each product with a list price and no history row.
-- Safe to rerun.
create function private.baseline_list_prices() returns void
language sql security definer
set search_path = ''
as $$
    insert into private.list_price_changes(product_id, old_price, new_price, cost_per_lb, baseline)
    select p.id, null, p.list_price_per_lb,
           (select vp.cost_per_lb from public.v_product_pricing vp
            where vp.product_id = p.id and vp.has_cost),
           true
    from public.products p
    where p.list_price_per_lb is not null
      and not exists (select 1 from private.list_price_changes h where h.product_id = p.id);
$$;
revoke all on function private.baseline_list_prices()
    from public, anon, authenticated, service_role;

select private.baseline_list_prices();

-- ============================================================
-- Alerts, part 2: the alerts table and the watch.
--
-- public.refresh_alerts(p_today) runs the five rules, given a today, and
-- opens, updates, and ends alerts to match. Every comparison uses exact
-- numeric values; a figure is rounded only when it is stored. A median is the
-- mean of the middle one or two values picked by row_number(), because
-- percentile_cont returns float8. A usual swing or usual shrink band is
-- compared as |x - usual| >= band * usual (or the median of |x - usual|
-- itself), so no division by a possibly zero usual cost is ever evaluated.
-- ============================================================

create table public.alerts (
    id         uuid primary key default gen_random_uuid(),
    type       text not null check (type in
               ('margin_below_target', 'cost_anomaly', 'yield_anomaly', 'low_stock', 'price_stale')),
    severity   text not null check (severity in ('high', 'medium', 'low')),
    product_id uuid not null references public.products(id),
    lot_id     uuid references public.lots(id),
    batch_id   uuid references public.production_batches(id),
    facts      jsonb not null,
    status     text not null default 'open'
               check (status in ('open', 'dismissed', 'actioned', 'cleared')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    -- When the alert left the open status (dismissed, actioned, or cleared).
    closed_at  timestamptz,
    -- When its episode ended: a watch found the condition gone, or it was actioned.
    ended_at   timestamptz,
    constraint alerts_open_not_ended check (status <> 'open' or ended_at is null),
    constraint alerts_closed_ended check (status not in ('actioned', 'cleared') or ended_at is not null)
);

comment on column public.alerts.facts is
    'Stored figures, rounded half away from zero when stored. margin_below_target: list_price, margin_at_list, target_margin, cost_per_lb, suggested_list_price, price_action. price_stale: list_price, changed_at (UTC ISO text of the last change), cost_then, cost_per_lb, drift, price_action, suggested_list_price. cost_anomaly: received_date, unit_cost, usual_cost, change, band, reference_count. yield_anomaly: production_date, raw_lbs_in, finished_lbs_out, shrink, usual_shrink, band, shrink_used. low_stock: on_hand, daily_use, days_left, order_lbs.';
comment on column public.alerts.product_id is
    'The subject product: the finished product of a margin, price, or yield alert; the raw product of a cost or low-stock alert.';

-- One live alert per type and subject.
create unique index alerts_one_live on public.alerts (type, product_id, lot_id, batch_id)
    nulls not distinct where ended_at is null;

revoke all on table public.alerts from public, anon, authenticated, service_role;
alter table public.alerts enable row level security;
create policy operators_select on public.alerts
    for select to authenticated using ((select private.is_operator()));
grant select on table public.alerts to authenticated, service_role;

create function public.refresh_alerts(p_today date)
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
        select l.id as lot_id, l.product_id, l.received_date, l.receipt_seq, l.unit_cost
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
            select e.unit_cost
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
    select (select count(*) from updated) + (select count(*) from inserted) + (select count(*) from ended)
    into v_changes;

    return query
    select (count(*) filter (where a.status = 'open'))::integer,
           (count(*) filter (where a.status = 'open' and a.severity = 'high'))::integer
    from public.alerts a;
end $$;
revoke all on function public.refresh_alerts(date)
    from public, anon, authenticated, service_role;
grant execute on function public.refresh_alerts(date) to authenticated;
