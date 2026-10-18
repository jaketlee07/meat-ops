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
-- percentile_cont returns float8. Only the cost floor is scaled by the usual
-- cost (|x - usual| >= band * usual), so no division by a possibly zero usual
-- cost is ever evaluated; the yield band is compared unscaled, as shrink
-- points.
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
    -- The select into is only here because the row-changing with needs a final statement.
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

-- ============================================================
-- Alerts, part 3: the alerts view, reprice, dismiss, and the digest.
--
-- v_alerts joins each alert to its product, lot, vendor, and batch for the
-- page's reads. dismiss_alert and apply_alert_price take the watch's advisory
-- lock after their caller check, then the alert row, so a watch never ends an
-- alert the owner is acting on. apply_alert_price changes a price only through
-- set_list_price. alert_digests holds one row for each day with a claim; the
-- claim is the row, and start_digest and finish_digest are its only writers.
-- ============================================================

create view public.v_alerts with (security_invoker = true) as
select a.id, a.type, a.severity, a.status, a.facts,
       a.product_id, p.code, p.description,
       a.lot_id, l.lot_number, l.received_date, l.receipt_seq, v.name as vendor_name,
       a.batch_id, b.batch_number, b.production_date, fg.produced_seq,
       a.created_at, a.updated_at, a.closed_at, a.ended_at
from public.alerts a
join public.products p on p.id = a.product_id
left join public.lots l on l.id = a.lot_id
left join public.vendors v on v.id = l.vendor_id
left join public.production_batches b on b.id = a.batch_id
left join public.finished_goods fg on fg.batch_id = b.id;
revoke all on table public.v_alerts from public, anon, authenticated, service_role;
grant select on table public.v_alerts to authenticated, service_role;

-- Each paragraph holds 1 to 800 characters. A check cannot hold a subquery,
-- so the rule sits in a function that only the table's check calls.
create function private.digest_paragraphs_ok(p_paragraphs text[]) returns boolean
language sql immutable
set search_path = ''
as $$
    select coalesce(bool_and(char_length(x) between 1 and 800), false)
    from unnest(p_paragraphs) as x;
$$;
revoke all on function private.digest_paragraphs_ok(text[])
    from public, anon, authenticated, service_role;

create table public.alert_digests (
    digest_date  date primary key,
    status       text not null check (status in ('writing', 'written', 'failed')),
    paragraphs   text[],
    failure_kind text,
    model        text,
    claimed_at   timestamptz not null,
    finished_at  timestamptz,
    constraint alert_digests_state check (
        case status
            when 'written' then cardinality(paragraphs) between 1 and 6
                                and private.digest_paragraphs_ok(paragraphs)
                                and failure_kind is null
            when 'failed'  then failure_kind is not null and paragraphs is null
            else paragraphs is null and failure_kind is null
        end)
);
comment on table public.alert_digests is
    'One row for each day with a digest claim. writing: claimed_at holds the claim time. written: 1 to 6 paragraphs of 1 to 800 characters. failed: failure_kind holds why.';

revoke all on table public.alert_digests from public, anon, authenticated, service_role;
alter table public.alert_digests enable row level security;
create policy operators_select on public.alert_digests
    for select to authenticated using ((select private.is_operator()));
grant select on table public.alert_digests to authenticated, service_role;

create function public.dismiss_alert(p_alert_id uuid)
returns public.alerts
language plpgsql security definer
set search_path = ''
as $$
declare
    v_alert public.alerts;
begin
    perform private.assert_caller('dismiss_alert');
    perform pg_advisory_xact_lock(hashtextextended('meat-ops:refresh_alerts', 0));

    select * into v_alert from public.alerts where id = p_alert_id for update;
    if not found then
        raise exception 'dismiss_alert: alert % not found', p_alert_id;
    end if;
    if v_alert.status <> 'open' then
        raise exception 'dismiss_alert: It is no longer open.';
    end if;

    update public.alerts
    set status = 'dismissed', closed_at = now(), updated_at = now()
    where id = p_alert_id
    returning * into v_alert;
    return v_alert;
end $$;
revoke all on function public.dismiss_alert(uuid)
    from public, anon, authenticated, service_role;
grant execute on function public.dismiss_alert(uuid) to authenticated;

-- A refusal from set_list_price passes through with its own prefix and rolls
-- the whole call back, so the alert stays open.
create function public.apply_alert_price(p_alert_id uuid, p_price_per_lb numeric)
returns public.products
language plpgsql security definer
set search_path = ''
as $$
declare
    v_alert   public.alerts;
    v_product public.products;
begin
    perform private.assert_caller('apply_alert_price');
    perform pg_advisory_xact_lock(hashtextextended('meat-ops:refresh_alerts', 0));

    select * into v_alert from public.alerts where id = p_alert_id for update;
    if not found then
        raise exception 'apply_alert_price: alert % not found', p_alert_id;
    end if;
    if v_alert.status <> 'open' then
        raise exception 'apply_alert_price: This alert is no longer open.';
    end if;
    if v_alert.type not in ('margin_below_target', 'price_stale') then
        raise exception 'apply_alert_price: alert % is not a margin or price alert', p_alert_id;
    end if;

    select * into v_product from public.set_list_price(v_alert.product_id, p_price_per_lb);

    update public.alerts
    set status = 'actioned', closed_at = now(), ended_at = now(), updated_at = now()
    where id = p_alert_id;
    return v_product;
end $$;
revoke all on function public.apply_alert_price(uuid, numeric)
    from public, anon, authenticated, service_role;
grant execute on function public.apply_alert_price(uuid, numeric) to authenticated;

-- The result is the first row of the spec's table that matches. A claim older
-- than 180 seconds is stale. Only claimed changes the date's row.
create function public.start_digest(p_date date, p_automatic boolean)
returns table (result text, paragraphs text[], failure_kind text)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
    v_row public.alert_digests;
    v_stale boolean;
begin
    perform private.assert_caller('start_digest');

    if p_date is null then
        raise exception 'start_digest: date is required';
    end if;
    if p_automatic is null then
        raise exception 'start_digest: the kind of send is required';
    end if;

    if not exists (select 1 from public.alerts a where a.status = 'open') then
        return query select 'none'::text, null::text[], null::text;
        return;
    end if;

    -- A second caller for the same date waits here for the first to commit.
    insert into public.alert_digests as d (digest_date, status, claimed_at)
    values (p_date, 'writing', now())
    on conflict (digest_date) do nothing;
    if found then
        return query select 'claimed'::text, null::text[], null::text;
        return;
    end if;

    select * into v_row from public.alert_digests d where d.digest_date = p_date for update;
    v_stale := v_row.status = 'writing' and now() - v_row.claimed_at > interval '180 seconds';

    if v_row.status = 'written' then
        return query select 'written'::text, v_row.paragraphs, null::text;
    elsif v_row.status = 'writing' and not v_stale then
        return query select 'busy'::text, null::text[], null::text;
    elsif not p_automatic then
        update public.alert_digests d
        set status = 'writing', paragraphs = null, failure_kind = null, model = null,
            claimed_at = now(), finished_at = null
        where d.digest_date = p_date;
        return query select 'claimed'::text, null::text[], null::text;
    elsif v_row.status = 'failed' then
        return query select 'failed'::text, null::text[], v_row.failure_kind;
    else
        return query select 'stale'::text, null::text[], null::text;
    end if;
end $$;
revoke all on function public.start_digest(date, boolean)
    from public, anon, authenticated, service_role;
grant execute on function public.start_digest(date, boolean) to authenticated;

create function public.finish_digest(p_date date, p_paragraphs text[], p_failure_kind text)
returns public.alert_digests
language plpgsql security definer
set search_path = ''
as $$
declare
    v_row public.alert_digests;
begin
    perform private.assert_caller('finish_digest');

    if (p_paragraphs is null) = (nullif(p_failure_kind, '') is null) then
        raise exception 'finish_digest: give the paragraphs or a failure kind, not both and not neither';
    end if;

    select * into v_row from public.alert_digests d where d.digest_date = p_date for update;
    if not found or v_row.status <> 'writing' then
        raise exception 'finish_digest: the digest for % is not being written', p_date;
    end if;

    if p_paragraphs is not null then
        update public.alert_digests d
        set status = 'written', paragraphs = p_paragraphs, model = 'claude-opus-5-5',
            finished_at = now()
        where d.digest_date = p_date
        returning * into v_row;
    else
        update public.alert_digests d
        set status = 'failed', failure_kind = p_failure_kind, finished_at = now()
        where d.digest_date = p_date
        returning * into v_row;
    end if;
    return v_row;
end $$;
revoke all on function public.finish_digest(date, text[], text)
    from public, anon, authenticated, service_role;
grant execute on function public.finish_digest(date, text[], text) to authenticated;
