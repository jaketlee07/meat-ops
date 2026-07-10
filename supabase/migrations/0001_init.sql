-- ============================================================
-- Meat Processing POC: Inventory, Costing & Traceability
-- PostgreSQL 14+ / Supabase compatible
--
-- Two accountings, kept separate on purpose:
--   * lots           -> true cost + origin (specific ID)  => traceability
--   * inventory_balances -> rolling moving average         => forward pricing
-- ============================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ------------------------------------------------------------
-- 1. Master data
-- ------------------------------------------------------------

create table vendors (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    contact_name text,
    phone        text,
    email        text,
    notes        text,
    created_at   timestamptz not null default now()
);

-- One products table for BOTH raw inputs and finished goods.
-- Typing a code prefills description/species (the "1234 = chicken" preset).
create table products (
    id             uuid primary key default gen_random_uuid(),
    code           text not null unique,        -- '501', '1234'
    description    text not null,               -- 'Smoked Turkey Necks' / 'Turkey Necks'
    brand          text,
    species        text,                        -- 'Turkey','Pork','Chicken','Beef'
    kind           text not null check (kind in ('raw','finished')),
    pack_style     text,                        -- '56cs/pl'
    lbs_per_pack   numeric(10,2),               -- nominal, e.g. 32.5 for "30-35#"
    -- finished-product recipe (null for raw). One raw input per finished item
    -- for the POC; a bom_components table is the extension path for blends.
    raw_product_id uuid references products(id),
    shrink_pct     numeric(5,4) check (shrink_pct >= 0 and shrink_pct < 1),  -- 0.23 = 23%
    active         boolean not null default true,
    created_at     timestamptz not null default now(),
    constraint finished_needs_recipe check (
        kind = 'raw'
        or (raw_product_id is not null and shrink_pct is not null)
    )
);
create index on products (kind);
create index on products (species);

-- Processing fees vs margin adds, per finished lb (mirrors the pricing sheet columns).
create table fee_types (
    id         uuid primary key default gen_random_uuid(),
    code       text not null unique,
    name       text not null,
    kind       text not null check (kind in ('processing','margin')),  -- processing = cost; margin -> price
    sort_order int not null default 0
);

create table product_fees (
    product_id    uuid not null references products(id) on delete cascade,
    fee_type_id   uuid not null references fee_types(id),
    amount_per_lb numeric(10,4) not null default 0,
    primary key (product_id, fee_type_id)
);

-- ------------------------------------------------------------
-- 2. Inventory state
-- ------------------------------------------------------------

-- Rolling moving-average per RAW product. Authoritative for forward pricing.
create table inventory_balances (
    product_id      uuid primary key references products(id) on delete cascade,
    qty_on_hand     numeric(14,3) not null default 0,   -- lbs
    moving_avg_cost numeric(12,4) not null default 0,   -- $/lb
    updated_at      timestamptz not null default now()
);

-- Every incoming purchase is a lot: cost history AND traceability anchor.
create table lots (
    id            uuid primary key default gen_random_uuid(),
    lot_number    text not null unique,          -- 'L-20260512-a1b2c3'
    product_id    uuid not null references products(id),
    vendor_id     uuid references vendors(id),
    received_date date not null default current_date,
    weight_lbs    numeric(14,3) not null check (weight_lbs > 0),   -- received qty
    unit_cost     numeric(12,4) not null check (unit_cost >= 0),   -- $/lb paid (true cost, never overwritten)
    remaining_lbs numeric(14,3) not null,        -- depletes as production consumes it
    notes         text,
    created_at    timestamptz not null default now(),
    check (remaining_lbs >= 0 and remaining_lbs <= weight_lbs)
);
create index on lots (product_id, received_date);
create index on lots (product_id) where remaining_lbs > 0;

-- ------------------------------------------------------------
-- 3. Production
-- ------------------------------------------------------------

create table production_batches (
    id                   uuid primary key default gen_random_uuid(),
    batch_number         text not null unique,
    finished_product_id  uuid not null references products(id),
    production_date      date not null default current_date,
    raw_lbs_in           numeric(14,3) not null check (raw_lbs_in > 0),
    shrink_pct_used      numeric(5,4) not null,
    finished_lbs_out     numeric(14,3) not null,   -- raw_lbs_in * (1 - shrink), or measured
    raw_cost_total       numeric(14,4) not null,   -- sum(lbs_consumed * lot_unit_cost)
    cost_per_finished_lb numeric(12,4) not null,   -- raw + processing, per finished lb
    notes                text,
    created_at           timestamptz not null default now()
);

-- Which raw lots fed the batch: trace link + specific-ID cost snapshot.
create table production_batch_lots (
    id            uuid primary key default gen_random_uuid(),
    batch_id      uuid not null references production_batches(id) on delete cascade,
    lot_id        uuid not null references lots(id),
    lbs_consumed  numeric(14,3) not null check (lbs_consumed > 0),
    lot_unit_cost numeric(12,4) not null
);
create index on production_batch_lots (batch_id);
create index on production_batch_lots (lot_id);

-- Finished-goods inventory. Each batch yields one finished lot, carrying trace back to the batch.
create table finished_goods (
    id                  uuid primary key default gen_random_uuid(),
    batch_id            uuid not null references production_batches(id),
    finished_product_id uuid not null references products(id),
    lbs_produced        numeric(14,3) not null,
    lbs_remaining       numeric(14,3) not null,
    cost_per_lb         numeric(12,4) not null,   -- production cost (raw + processing)
    produced_date       date not null default current_date,
    check (lbs_remaining >= 0 and lbs_remaining <= lbs_produced)
);
create index on finished_goods (finished_product_id) where lbs_remaining > 0;

-- ------------------------------------------------------------
-- 4. Sales
-- ------------------------------------------------------------

create table customers (
    id         uuid primary key default gen_random_uuid(),
    name       text not null,
    notes      text,
    created_at timestamptz not null default now()
);

create table sales (
    id          uuid primary key default gen_random_uuid(),
    sale_number text not null unique,
    customer_id uuid references customers(id),
    sale_date   date not null default current_date,
    created_at  timestamptz not null default now()
);

-- Each line points at the finished lot it came from -> fully traceable.
create table sale_items (
    id                uuid primary key default gen_random_uuid(),
    sale_id           uuid not null references sales(id) on delete cascade,
    finished_goods_id uuid not null references finished_goods(id),
    lbs_sold          numeric(14,3) not null check (lbs_sold > 0),
    price_per_lb      numeric(12,4) not null,
    cost_per_lb       numeric(12,4) not null    -- snapshot for margin reporting
);
create index on sale_items (sale_id);
create index on sale_items (finished_goods_id);

-- ============================================================
-- 5. Functions (the logic that keeps costing honest)
-- ============================================================

-- Receive raw: insert a lot, roll the moving average forward.
create or replace function receive_lot(
    p_product_id uuid,
    p_vendor_id  uuid,
    p_weight_lbs numeric,
    p_unit_cost  numeric,
    p_received   date default current_date,
    p_lot_number text default null,
    p_notes      text default null
) returns lots
language plpgsql as $$
declare
    v_lot     lots;
    v_old_qty numeric;
    v_old_avg numeric;
    v_lot_no  text;
begin
    if (select kind from products where id = p_product_id) is distinct from 'raw' then
        raise exception 'receive_lot: product % is not a raw product', p_product_id;
    end if;

    v_lot_no := coalesce(p_lot_number,
        'L-' || to_char(p_received,'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6));

    insert into lots(lot_number, product_id, vendor_id, received_date,
                     weight_lbs, unit_cost, remaining_lbs, notes)
    values (v_lot_no, p_product_id, p_vendor_id, p_received,
            p_weight_lbs, p_unit_cost, p_weight_lbs, p_notes)
    returning * into v_lot;

    insert into inventory_balances(product_id) values (p_product_id)
    on conflict (product_id) do nothing;

    select qty_on_hand, moving_avg_cost into v_old_qty, v_old_avg
    from inventory_balances where product_id = p_product_id for update;

    update inventory_balances
    set qty_on_hand     = v_old_qty + p_weight_lbs,
        moving_avg_cost = case when v_old_qty + p_weight_lbs = 0 then 0
                               else (v_old_qty * v_old_avg + p_weight_lbs * p_unit_cost)
                                    / (v_old_qty + p_weight_lbs) end,
        updated_at      = now()
    where product_id = p_product_id;

    return v_lot;
end $$;

-- Produce: consume raw lots FIFO, apply shrink, roll up cost, create finished goods.
create or replace function produce_batch(
    p_finished_product_id uuid,
    p_raw_lbs_in          numeric,
    p_finished_lbs_out    numeric default null,   -- measured yield; null => computed from shrink
    p_production_date     date default current_date,
    p_batch_number        text default null,
    p_notes               text default null
) returns production_batches
language plpgsql as $$
declare
    v_raw_product_id  uuid;
    v_shrink          numeric;
    v_finished_out    numeric;
    v_need            numeric := p_raw_lbs_in;
    v_raw_cost_total  numeric := 0;
    v_lot             record;
    v_take            numeric;
    v_proc_fee        numeric;
    v_batch           production_batches;
    v_batch_no        text;
    v_cost_per_lb     numeric;
    v_avail           numeric;
begin
    select raw_product_id, shrink_pct into v_raw_product_id, v_shrink
    from products where id = p_finished_product_id and kind = 'finished';

    if v_raw_product_id is null then
        raise exception 'produce_batch: % is not a finished product with a recipe', p_finished_product_id;
    end if;

    select coalesce(sum(remaining_lbs),0) into v_avail
    from lots where product_id = v_raw_product_id and remaining_lbs > 0;
    if v_avail < p_raw_lbs_in then
        raise exception 'produce_batch: only % lbs raw available, need %', v_avail, p_raw_lbs_in;
    end if;

    v_finished_out := coalesce(p_finished_lbs_out, round(p_raw_lbs_in * (1 - v_shrink), 3));
    v_batch_no := coalesce(p_batch_number,
        'B-' || to_char(p_production_date,'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6));

    insert into production_batches(batch_number, finished_product_id, production_date,
        raw_lbs_in, shrink_pct_used, finished_lbs_out, raw_cost_total, cost_per_finished_lb, notes)
    values (v_batch_no, p_finished_product_id, p_production_date,
        p_raw_lbs_in, v_shrink, v_finished_out, 0, 0, p_notes)
    returning * into v_batch;

    -- FIFO consumption (oldest received first)
    for v_lot in
        select * from lots
        where product_id = v_raw_product_id and remaining_lbs > 0
        order by received_date, created_at for update
    loop
        exit when v_need <= 0;
        v_take := least(v_lot.remaining_lbs, v_need);

        insert into production_batch_lots(batch_id, lot_id, lbs_consumed, lot_unit_cost)
        values (v_batch.id, v_lot.id, v_take, v_lot.unit_cost);

        update lots set remaining_lbs = remaining_lbs - v_take where id = v_lot.id;
        v_raw_cost_total := v_raw_cost_total + v_take * v_lot.unit_cost;
        v_need := v_need - v_take;
    end loop;

    update inventory_balances
    set qty_on_hand = qty_on_hand - p_raw_lbs_in, updated_at = now()
    where product_id = v_raw_product_id;

    select coalesce(sum(pf.amount_per_lb),0) into v_proc_fee
    from product_fees pf join fee_types ft on ft.id = pf.fee_type_id
    where pf.product_id = p_finished_product_id and ft.kind = 'processing';

    -- Dividing true raw cost by the smaller finished weight bakes shrinkage into cost/lb.
    v_cost_per_lb := round(v_raw_cost_total / v_finished_out + v_proc_fee, 4);

    update production_batches
    set raw_cost_total = v_raw_cost_total, cost_per_finished_lb = v_cost_per_lb
    where id = v_batch.id returning * into v_batch;

    insert into finished_goods(batch_id, finished_product_id, lbs_produced, lbs_remaining, cost_per_lb, produced_date)
    values (v_batch.id, p_finished_product_id, v_finished_out, v_finished_out, v_cost_per_lb, p_production_date);

    return v_batch;
end $$;

-- Sell: deplete finished lots FIFO, one sale_item per lot (keeps trace exact).
create or replace function record_sale(
    p_finished_product_id uuid,
    p_lbs                 numeric,
    p_price_per_lb        numeric,
    p_customer_id         uuid default null,
    p_sale_date           date default current_date,
    p_sale_number         text default null
) returns sales
language plpgsql as $$
declare
    v_sale    sales;
    v_need    numeric := p_lbs;
    v_fg      record;
    v_take    numeric;
    v_sale_no text;
    v_avail   numeric;
begin
    select coalesce(sum(lbs_remaining),0) into v_avail
    from finished_goods where finished_product_id = p_finished_product_id and lbs_remaining > 0;
    if v_avail < p_lbs then
        raise exception 'record_sale: only % lbs finished available, need %', v_avail, p_lbs;
    end if;

    v_sale_no := coalesce(p_sale_number,
        'S-' || to_char(p_sale_date,'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6));

    insert into sales(sale_number, customer_id, sale_date)
    values (v_sale_no, p_customer_id, p_sale_date) returning * into v_sale;

    for v_fg in
        select * from finished_goods
        where finished_product_id = p_finished_product_id and lbs_remaining > 0
        order by produced_date, id for update
    loop
        exit when v_need <= 0;
        v_take := least(v_fg.lbs_remaining, v_need);

        insert into sale_items(sale_id, finished_goods_id, lbs_sold, price_per_lb, cost_per_lb)
        values (v_sale.id, v_fg.id, v_take, p_price_per_lb, v_fg.cost_per_lb);

        update finished_goods set lbs_remaining = lbs_remaining - v_take where id = v_fg.id;
        v_need := v_need - v_take;
    end loop;

    return v_sale;
end $$;

-- ============================================================
-- 6. Views (pricing, menu, traceability)
-- ============================================================

-- Sheet logic: raw avg cost -> post-shrink -> + processing (cost) -> + margin (price).
create or replace view v_product_pricing as
select
    p.id   as product_id, p.code, p.description, p.species, p.shrink_pct,
    ib.moving_avg_cost as raw_cost_per_lb,
    round(ib.moving_avg_cost / (1 - p.shrink_pct), 4) as post_shrink_cost_per_lb,
    coalesce(proc.total,0) as processing_fees_per_lb,
    coalesce(marg.total,0) as margin_per_lb,
    round(ib.moving_avg_cost / (1 - p.shrink_pct) + coalesce(proc.total,0), 4) as cost_per_lb,
    round(ib.moving_avg_cost / (1 - p.shrink_pct) + coalesce(proc.total,0) + coalesce(marg.total,0), 4) as final_price_per_lb
from products p
left join inventory_balances ib on ib.product_id = p.raw_product_id
left join (select pf.product_id, sum(pf.amount_per_lb) total
           from product_fees pf join fee_types ft on ft.id = pf.fee_type_id
           where ft.kind = 'processing' group by pf.product_id) proc on proc.product_id = p.id
left join (select pf.product_id, sum(pf.amount_per_lb) total
           from product_fees pf join fee_types ft on ft.id = pf.fee_type_id
           where ft.kind = 'margin' group by pf.product_id) marg on marg.product_id = p.id
where p.kind = 'finished' and p.active;

-- Menu = finished products sellable right now (finished stock OR raw available to make it).
create or replace view v_current_menu as
select
    pr.product_id, pr.code, pr.description, pr.species, pr.final_price_per_lb,
    coalesce(fg.lbs_available,0)  as finished_lbs_available,
    coalesce(raw.lbs_available,0) as raw_lbs_available,
    (coalesce(fg.lbs_available,0) > 0 or coalesce(raw.lbs_available,0) > 0) as sellable
from v_product_pricing pr
left join (select finished_product_id, sum(lbs_remaining) lbs_available
           from finished_goods where lbs_remaining > 0 group by finished_product_id) fg
       on fg.finished_product_id = pr.product_id
left join (select p.id finished_product_id, sum(l.remaining_lbs) lbs_available
           from products p join lots l on l.product_id = p.raw_product_id
           where l.remaining_lbs > 0 group by p.id) raw
       on raw.finished_product_id = pr.product_id;

-- Trace-back: sale -> finished lot -> batch -> raw lot(s) -> vendor.
create or replace view v_sale_traceability as
select
    s.sale_number, s.sale_date,
    fp.code as finished_code, fp.description as finished_product, si.lbs_sold, si.price_per_lb,
    b.batch_number, b.production_date,
    l.lot_number as raw_lot, rp.description as raw_product, v.name as vendor,
    l.received_date, pbl.lbs_consumed as raw_lbs_from_lot, l.unit_cost as raw_lot_cost_per_lb
from sale_items si
join sales s                   on s.id = si.sale_id
join finished_goods fg         on fg.id = si.finished_goods_id
join products fp               on fp.id = fg.finished_product_id
join production_batches b      on b.id = fg.batch_id
join production_batch_lots pbl on pbl.batch_id = b.id
join lots l                    on l.id = pbl.lot_id
join products rp               on rp.id = l.product_id
left join vendors v            on v.id = l.vendor_id
order by s.sale_date desc, s.sale_number;
