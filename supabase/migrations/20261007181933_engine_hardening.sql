-- ============================================================
-- Engine hardening (foundation-hardening T2).
--
-- The three costing operations become SECURITY DEFINER functions that check
-- the caller, lock before they read stock, validate every argument, honour
-- insertion order, and keep moving_avg_cost equal to the stock-on-hand
-- average. Lots get a freeze trigger. RLS, table grants, views and auth
-- config are NOT here; they belong to the access-lockdown migration.
--
-- Every function sets search_path = '' and schema-qualifies every name, and
-- every new table, function, and identity sequence revokes the local default
-- privileges before it grants.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Private schema: operator allowlist and helpers
-- ------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;

create table private.operators (
    user_id  uuid primary key references auth.users(id) on delete cascade,
    added_at timestamptz not null default now()
);
revoke all on table private.operators from public, anon, authenticated, service_role;

-- True when the signed-in user is on the allowlist. SECURITY DEFINER so RLS
-- policies can call it without reading private.operators themselves.
create function private.is_operator() returns boolean
language sql stable security definer
set search_path = ''
as $$
    select exists (
        select 1 from private.operators where user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_operator() from public, anon, authenticated, service_role;
grant execute on function private.is_operator() to authenticated;

-- Runs first in every operation. Missing claims pass only for the two named
-- database logins (seed and test setup); a signed-in caller must carry role
-- 'authenticated' and be on the allowlist, decided by private.is_operator() so
-- the table policies and the operations read the caller from one source.
-- session_user is used because current_user is the function owner inside a
-- SECURITY DEFINER body.
create function private.assert_caller(p_operation text default 'operation') returns void
language plpgsql security definer
set search_path = ''
as $$
declare
    v_text text := nullif(current_setting('request.jwt.claims', true), '');
    v_role text;
    v_op   boolean;
begin
    if v_text is null then
        if session_user in ('postgres', 'supabase_admin') then
            return;
        end if;
        raise exception '%: not allowed (no caller claims)', p_operation
            using errcode = '42501';
    end if;

    begin
        v_role := v_text::jsonb ->> 'role';
        v_op := private.is_operator();
    exception when others then
        raise exception '%: not allowed (unreadable caller claims)', p_operation
            using errcode = '42501';
    end;

    if v_role is distinct from 'authenticated' or v_op is not true then
        raise exception '%: not allowed (caller is not an operator)', p_operation
            using errcode = '42501';
    end if;
end $$;
revoke all on function private.assert_caller(text) from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 2. Lot columns: insertion order, prior average, vendor required
-- ------------------------------------------------------------

-- Insertion order. Rows that predate this migration are numbered by the old
-- FIFO keys first (0001_init.sql ordered lots by received_date, created_at and
-- finished goods by produced_date, id), so existing stock keeps its draw order.
-- The column then becomes an always-identity column whose sequence continues
-- above the highest number assigned. Nothing but the sequence writes it after that.
alter table public.lots add column receipt_seq bigint;
update public.lots l
set receipt_seq = n.seq
from (select id, row_number() over (order by received_date, created_at, id) as seq
      from public.lots) n
where n.id = l.id;
alter table public.lots alter column receipt_seq set not null;
alter table public.lots alter column receipt_seq add generated always as identity;
select setval(pg_get_serial_sequence('public.lots', 'receipt_seq'),
              coalesce(max(receipt_seq), 1), max(receipt_seq) is not null)
from public.lots;

alter table public.finished_goods add column produced_seq bigint;
update public.finished_goods f
set produced_seq = n.seq
from (select id, row_number() over (order by produced_date, id) as seq
      from public.finished_goods) n
where n.id = f.id;
alter table public.finished_goods alter column produced_seq set not null;
alter table public.finished_goods alter column produced_seq add generated always as identity;
select setval(pg_get_serial_sequence('public.finished_goods', 'produced_seq'),
              coalesce(max(produced_seq), 1), max(produced_seq) is not null)
from public.finished_goods;

-- Identity sequences keep the default privileges unless revoked here.
revoke all on sequence public.lots_receipt_seq_seq
    from public, anon, authenticated, service_role;
revoke all on sequence public.finished_goods_produced_seq_seq
    from public, anon, authenticated, service_role;

alter table public.lots add column prior_avg_cost numeric(12,4);

-- Lots that predate this migration get their product's current average, the
-- best value available. This runs before the freeze trigger exists.
update public.lots l
set prior_avg_cost = coalesce(
    (select ib.moving_avg_cost from public.inventory_balances ib where ib.product_id = l.product_id),
    0);

alter table public.lots alter column vendor_id set not null;

create function private.lots_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.unit_cost     is distinct from old.unit_cost
    or new.weight_lbs    is distinct from old.weight_lbs
    or new.product_id    is distinct from old.product_id
    or new.vendor_id     is distinct from old.vendor_id
    or new.received_date is distinct from old.received_date
    or new.lot_number    is distinct from old.lot_number
    or new.prior_avg_cost is distinct from old.prior_avg_cost then
        raise exception 'lots: frozen column change not allowed (lot %)', old.id;
    end if;
    return new;
end $$;
revoke all on function private.lots_guard() from public, anon, authenticated, service_role;

create trigger lots_guard
    before update on public.lots
    for each row execute function private.lots_guard();

-- ------------------------------------------------------------
-- 3. Balance refresh: qty and stock-on-hand average from lots
-- ------------------------------------------------------------

-- Callers hold the product's inventory_balances row lock. When no lbs remain
-- the stored average is kept, unless the caller passes p_zero_stock_avg.
create function private.refresh_balance(
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
    select coalesce(sum(remaining_lbs), 0), coalesce(sum(remaining_lbs * unit_cost), 0)
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
revoke all on function private.refresh_balance(uuid, numeric) from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. The three operations
-- ------------------------------------------------------------

-- Receive raw: insert a lot, then refresh the average from stock on hand.
create or replace function public.receive_lot(
    p_product_id uuid,
    p_vendor_id  uuid,
    p_weight_lbs numeric,
    p_unit_cost  numeric,
    p_received   date default current_date,
    p_lot_number text default null,
    p_notes      text default null
) returns public.lots
language plpgsql security definer
set search_path = ''
as $$
declare
    v_lot    public.lots;
    v_kind   text;
    v_active boolean;
    v_prior  numeric;
    v_lot_no text;
begin
    perform private.assert_caller('receive_lot');

    if p_weight_lbs is null or p_weight_lbs = 'NaN'::numeric or p_weight_lbs <= 0 then
        raise exception 'receive_lot: invalid weight, must be above 0';
    end if;
    if p_unit_cost is null or p_unit_cost = 'NaN'::numeric or p_unit_cost < 0 then
        raise exception 'receive_lot: invalid unit cost, must be 0 or above';
    end if;
    if p_received is null then
        raise exception 'receive_lot: invalid received date';
    end if;

    select kind, active into v_kind, v_active from public.products where id = p_product_id;
    if v_kind is distinct from 'raw' then
        raise exception 'receive_lot: invalid product %, not a raw product', p_product_id;
    end if;
    if not v_active then
        raise exception 'receive_lot: product % is inactive', p_product_id;
    end if;

    if p_vendor_id is null
       or not exists (select 1 from public.vendors where id = p_vendor_id) then
        raise exception 'receive_lot: invalid vendor %', p_vendor_id;
    end if;

    -- Lock the balance row before reading it, so writers on this raw product queue up.
    insert into public.inventory_balances(product_id) values (p_product_id)
    on conflict (product_id) do nothing;

    select moving_avg_cost into v_prior
    from public.inventory_balances where product_id = p_product_id for update;

    v_lot_no := coalesce(p_lot_number,
        'L-' || to_char(p_received, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6));

    insert into public.lots(lot_number, product_id, vendor_id, received_date,
                            weight_lbs, unit_cost, remaining_lbs, prior_avg_cost, notes)
    values (v_lot_no, p_product_id, p_vendor_id, p_received,
            p_weight_lbs, p_unit_cost, p_weight_lbs, v_prior, p_notes)
    returning * into v_lot;

    perform private.refresh_balance(p_product_id);

    return v_lot;
end $$;
revoke all on function public.receive_lot(uuid, uuid, numeric, numeric, date, text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.receive_lot(uuid, uuid, numeric, numeric, date, text, text)
    to authenticated;

-- Produce: consume raw lots FIFO (insertion order within a date), apply
-- shrink, roll up cost, create finished goods.
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
        values (v_batch.id, v_lot.id, v_take, v_lot.unit_cost);

        update public.lots set remaining_lbs = remaining_lbs - v_take where id = v_lot.id;
        v_raw_cost_total := v_raw_cost_total + v_take * v_lot.unit_cost;
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
revoke all on function public.produce_batch(uuid, numeric, numeric, date, text, text)
    from public, anon, authenticated, service_role;
grant execute on function public.produce_batch(uuid, numeric, numeric, date, text, text)
    to authenticated;

-- Sell: deplete finished lots FIFO (insertion order within a date), one
-- sale_item per lot (keeps trace exact).
create or replace function public.record_sale(
    p_finished_product_id uuid,
    p_lbs                 numeric,
    p_price_per_lb        numeric,
    p_customer_id         uuid default null,
    p_sale_date           date default current_date,
    p_sale_number         text default null
) returns public.sales
language plpgsql security definer
set search_path = ''
as $$
declare
    v_sale    public.sales;
    v_kind    text;
    v_active  boolean;
    v_need    numeric;
    v_fg      record;
    v_take    numeric;
    v_sale_no text;
    v_avail   numeric;
begin
    perform private.assert_caller('record_sale');

    if p_lbs is null or p_lbs = 'NaN'::numeric or p_lbs <= 0 then
        raise exception 'record_sale: invalid lbs, must be above 0';
    end if;
    if p_price_per_lb is null or p_price_per_lb = 'NaN'::numeric or p_price_per_lb < 0 then
        raise exception 'record_sale: invalid price per lb, must be 0 or above';
    end if;
    if p_sale_date is null then
        raise exception 'record_sale: invalid sale date';
    end if;

    select kind, active into v_kind, v_active from public.products where id = p_finished_product_id;
    if v_kind is distinct from 'finished' then
        raise exception 'record_sale: invalid product %, not a finished product', p_finished_product_id;
    end if;
    if not v_active then
        raise exception 'record_sale: product % is inactive', p_finished_product_id;
    end if;

    -- NO KEY UPDATE does not block the foreign-key checks produce_batch makes.
    perform 1 from public.products where id = p_finished_product_id for no key update;

    select coalesce(sum(lbs_remaining), 0) into v_avail
    from public.finished_goods
    where finished_product_id = p_finished_product_id
      and produced_date <= p_sale_date
      and lbs_remaining > 0;
    if v_avail < p_lbs then
        raise exception 'record_sale: shortfall, only % lbs finished available on or before %, need %',
            v_avail, p_sale_date, p_lbs;
    end if;

    v_sale_no := coalesce(p_sale_number,
        'S-' || to_char(p_sale_date, 'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6));

    insert into public.sales(sale_number, customer_id, sale_date)
    values (v_sale_no, p_customer_id, p_sale_date) returning * into v_sale;

    v_need := p_lbs;
    for v_fg in
        select * from public.finished_goods
        where finished_product_id = p_finished_product_id
          and produced_date <= p_sale_date
          and lbs_remaining > 0
        order by produced_date, produced_seq
        for update
    loop
        exit when v_need <= 0;
        v_take := least(v_fg.lbs_remaining, v_need);

        insert into public.sale_items(sale_id, finished_goods_id, lbs_sold, price_per_lb, cost_per_lb)
        values (v_sale.id, v_fg.id, v_take, p_price_per_lb, v_fg.cost_per_lb);

        update public.finished_goods set lbs_remaining = lbs_remaining - v_take where id = v_fg.id;
        v_need := v_need - v_take;
    end loop;

    -- Second net behind the availability check.
    if v_need > 0 then
        raise exception 'record_sale: shortfall, eligible finished lots ran out with % lbs still needed', v_need;
    end if;

    return v_sale;
end $$;
revoke all on function public.record_sale(uuid, numeric, numeric, uuid, date, text)
    from public, anon, authenticated, service_role;
grant execute on function public.record_sale(uuid, numeric, numeric, uuid, date, text)
    to authenticated;
