-- ============================================================
-- Menu pricing (menu-pricing T1).
--
-- A finished product gains an optional target margin (a share of the selling
-- price) and an optional list price (what the owner charges, set only by the
-- owner). The pricing view gains the suggested price under a target, the
-- margin at the list price, and the flags the pricing page orders by. The
-- menu view gains the list price. Three functions are added:
--   set_target_margin, set_list_price  write one products column each.
--   price_what_if                      shows prices for a typed raw cost and
--                                      writes nothing.
--
-- The price rule is written twice, once in v_product_pricing and once in
-- price_what_if, side by side. A shared helper would need EXECUTE and schema
-- USAGE for service_role, which reads every view. test/pricing.test.ts holds
-- the two equal.
--
-- CREATE OR REPLACE VIEW clears security_invoker, so both views set it again.
-- Every function sets search_path = '' and schema-qualifies every name, and
-- revokes the local default privileges before it grants.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columns and checks
-- ------------------------------------------------------------

alter table public.products
    add column target_margin_pct  numeric(5,4),
    add column list_price_per_lb  numeric(10,2),
    add constraint products_target_margin_range
        check (target_margin_pct >= 0 and target_margin_pct < 1),
    add constraint products_list_price_range
        check (list_price_per_lb > 0 and list_price_per_lb <> 'NaN'::numeric),
    add constraint products_pricing_finished_only
        check (kind = 'finished'
               or (target_margin_pct is null and list_price_per_lb is null));

-- ------------------------------------------------------------
-- 2. Views
-- ------------------------------------------------------------

-- Existing columns keep their names, types, and order. The sheet price (cost
-- plus processing fees plus margin fees) still applies to a product with no
-- target. With a target the price is cost / (1 - target), rounded up to the
-- cent; margin fees do not count.
create or replace view public.v_product_pricing
with (security_invoker = true) as
select
    s.product_id, s.code, s.description, s.species, s.shrink_pct,
    s.raw_cost_per_lb, s.post_shrink_cost_per_lb, s.processing_fees_per_lb,
    s.margin_per_lb, s.cost_per_lb, s.final_price_per_lb,
    s.target_margin_pct,
    s.list_price_per_lb,
    s.has_cost,
    case when s.has_cost then round(s.final_price_per_lb, 2) end as suggested_list_price,
    case when s.has_cost and s.list_price_per_lb is not null
         then round((s.list_price_per_lb - s.cost_per_lb) / s.list_price_per_lb, 4)
    end as margin_at_list_pct,
    case when s.has_cost then
        case when s.list_price_per_lb is null then 'set'
             when s.list_price_per_lb < round(s.final_price_per_lb, 2) then 'raise'
             when s.list_price_per_lb > round(s.final_price_per_lb, 2) then 'lower'
        end
    end as price_action,
    coalesce(s.has_cost and (
        s.list_price_per_lb is null
        or s.list_price_per_lb <> round(s.final_price_per_lb, 2)
    ), false) as needs_new_price,
    coalesce(
        s.has_cost
        and s.target_margin_pct is not null
        and s.list_price_per_lb is not null
        and round((s.list_price_per_lb - s.cost_per_lb) / s.list_price_per_lb, 4) < s.target_margin_pct,
        false) as below_target
from (
    select
        c.product_id, c.code, c.description, c.species, c.shrink_pct,
        c.raw_cost_per_lb, c.post_shrink_cost_per_lb, c.processing_fees_per_lb,
        c.margin_per_lb, c.cost_per_lb,
        case when c.target_margin_pct is not null
             then round(ceil(c.cost_per_lb / (1 - c.target_margin_pct) * 100) / 100, 2)
             else round(c.raw_cost_per_lb / (1 - c.shrink_pct)
                        + c.processing_fees_per_lb + c.margin_per_lb, 4)
        end as final_price_per_lb,
        c.target_margin_pct, c.list_price_per_lb, c.has_cost
    from (
        select
            p.id   as product_id, p.code, p.description, p.species, p.shrink_pct,
            ib.moving_avg_cost as raw_cost_per_lb,
            round(ib.moving_avg_cost / (1 - p.shrink_pct), 4) as post_shrink_cost_per_lb,
            coalesce(proc.total, 0) as processing_fees_per_lb,
            coalesce(marg.total, 0) as margin_per_lb,
            round(ib.moving_avg_cost / (1 - p.shrink_pct) + coalesce(proc.total, 0), 4) as cost_per_lb,
            p.target_margin_pct,
            p.list_price_per_lb,
            exists (select 1 from public.lots l
                    where l.product_id = p.raw_product_id and l.voided_at is null) as has_cost
        from public.products p
        left join public.inventory_balances ib on ib.product_id = p.raw_product_id
        left join (select pf.product_id, sum(pf.amount_per_lb) total
                   from public.product_fees pf join public.fee_types ft on ft.id = pf.fee_type_id
                   where ft.kind = 'processing' group by pf.product_id) proc on proc.product_id = p.id
        left join (select pf.product_id, sum(pf.amount_per_lb) total
                   from public.product_fees pf join public.fee_types ft on ft.id = pf.fee_type_id
                   where ft.kind = 'margin' group by pf.product_id) marg on marg.product_id = p.id
        where p.kind = 'finished' and p.active
    ) c
) s;

create or replace view public.v_current_menu
with (security_invoker = true) as
select
    pr.product_id, pr.code, pr.description, pr.species, pr.final_price_per_lb,
    coalesce(fg.lbs_available,0)  as finished_lbs_available,
    coalesce(raw.lbs_available,0) as raw_lbs_available,
    (coalesce(fg.lbs_available,0) > 0 or coalesce(raw.lbs_available,0) > 0) as sellable,
    pr.list_price_per_lb
from public.v_product_pricing pr
left join (select finished_product_id, sum(lbs_remaining) lbs_available
           from public.finished_goods where lbs_remaining > 0 group by finished_product_id) fg
       on fg.finished_product_id = pr.product_id
left join (select p.id finished_product_id, sum(l.remaining_lbs) lbs_available
           from public.products p join public.lots l on l.product_id = p.raw_product_id
           where l.remaining_lbs > 0 group by p.id) raw
       on raw.finished_product_id = pr.product_id;

-- ------------------------------------------------------------
-- 3. set_target_margin and set_list_price
-- ------------------------------------------------------------

-- p_target_percent is the percent the owner typed (22.5 for 0.225); null
-- removes the target. The value is checked before any lock.
create function public.set_target_margin(
    p_product_id     uuid,
    p_target_percent numeric
) returns public.products
language plpgsql security definer
set search_path = ''
as $$
declare
    v_product public.products;
begin
    perform private.assert_caller('set_target_margin');

    if p_target_percent is not null then
        if p_target_percent = 'NaN'::numeric
           or p_target_percent = 'Infinity'::numeric
           or p_target_percent = '-Infinity'::numeric then
            raise exception 'set_target_margin: target must be a finite number';
        end if;
        if p_target_percent < 0 or p_target_percent >= 100 then
            raise exception 'set_target_margin: target must be from 0 up to but not including 100';
        end if;
        if p_target_percent <> round(p_target_percent, 2) then
            raise exception 'set_target_margin: target has more than 2 decimal places';
        end if;
    end if;

    select * into v_product from public.products
    where id = p_product_id for no key update;
    if not found then
        raise exception 'set_target_margin: product % not found', p_product_id;
    end if;
    if v_product.kind is distinct from 'finished' then
        raise exception 'set_target_margin: product % is not a finished product', p_product_id;
    end if;
    if not v_product.active then
        raise exception 'set_target_margin: product % is inactive', p_product_id;
    end if;

    update public.products
    set target_margin_pct = p_target_percent / 100
    where id = p_product_id
    returning * into v_product;

    return v_product;
end $$;
revoke all on function public.set_target_margin(uuid, numeric)
    from public, anon, authenticated, service_role;
grant execute on function public.set_target_margin(uuid, numeric) to authenticated;

create function public.set_list_price(
    p_product_id   uuid,
    p_price_per_lb numeric
) returns public.products
language plpgsql security definer
set search_path = ''
as $$
declare
    v_product public.products;
begin
    perform private.assert_caller('set_list_price');

    if p_price_per_lb is null
       or p_price_per_lb = 'NaN'::numeric
       or p_price_per_lb = 'Infinity'::numeric
       or p_price_per_lb = '-Infinity'::numeric then
        raise exception 'set_list_price: price must be a finite number';
    end if;
    if p_price_per_lb <= 0 then
        raise exception 'set_list_price: price must be above 0';
    end if;
    if p_price_per_lb >= 100000000 then
        raise exception 'set_list_price: price must be below 100000000';
    end if;
    if p_price_per_lb <> round(p_price_per_lb, 2) then
        raise exception 'set_list_price: price has more than 2 decimal places';
    end if;

    select * into v_product from public.products
    where id = p_product_id for no key update;
    if not found then
        raise exception 'set_list_price: product % not found', p_product_id;
    end if;
    if v_product.kind is distinct from 'finished' then
        raise exception 'set_list_price: product % is not a finished product', p_product_id;
    end if;
    if not v_product.active then
        raise exception 'set_list_price: product % is inactive', p_product_id;
    end if;

    update public.products
    set list_price_per_lb = p_price_per_lb
    where id = p_product_id
    returning * into v_product;

    return v_product;
end $$;
revoke all on function public.set_list_price(uuid, numeric)
    from public, anon, authenticated, service_role;
grant execute on function public.set_list_price(uuid, numeric) to authenticated;

-- ------------------------------------------------------------
-- 4. price_what_if
-- ------------------------------------------------------------

-- Prices for every active finished product made from one raw product, with a
-- typed raw cost in place of the raw average and always counting as a cost.
-- SECURITY INVOKER: it runs as the caller, so the tables' RLS applies behind
-- the operator check. The expressions below match v_product_pricing's.
create function public.price_what_if(
    p_raw_product_id  uuid,
    p_raw_cost_per_lb numeric
) returns table (
    product_id            uuid,
    code                  text,
    description           text,
    cost_per_lb           numeric,
    final_price_per_lb    numeric,
    suggested_list_price  numeric,
    margin_at_list_pct    numeric,
    list_price_per_lb     numeric,
    target_margin_pct     numeric
)
language plpgsql stable security invoker
set search_path = ''
as $$
#variable_conflict use_column
begin
    if private.is_operator() is not true then
        raise exception 'price_what_if: not allowed (caller is not an operator)'
            using errcode = '42501';
    end if;

    if p_raw_cost_per_lb is null
       or p_raw_cost_per_lb = 'NaN'::numeric
       or p_raw_cost_per_lb = 'Infinity'::numeric
       or p_raw_cost_per_lb = '-Infinity'::numeric then
        raise exception 'price_what_if: cost must be a finite number';
    end if;
    if p_raw_cost_per_lb < 0 then
        raise exception 'price_what_if: cost must be 0 or above';
    end if;

    return query
    select
        w.product_id, w.code, w.description,
        w.cost_per_lb,
        w.final_price_per_lb,
        round(w.final_price_per_lb, 2),
        case when w.list_price_per_lb is not null
             then round((w.list_price_per_lb - w.cost_per_lb) / w.list_price_per_lb, 4)
        end,
        w.list_price_per_lb::numeric,
        w.target_margin_pct::numeric
    from (
        select
            c.product_id, c.code, c.description, c.cost_per_lb,
            case when c.target_margin_pct is not null
                 then round(ceil(c.cost_per_lb / (1 - c.target_margin_pct) * 100) / 100, 2)
                 else round(p_raw_cost_per_lb / (1 - c.shrink_pct)
                            + c.processing_fees_per_lb + c.margin_per_lb, 4)
            end as final_price_per_lb,
            c.list_price_per_lb, c.target_margin_pct
        from (
            select
                p.id as product_id, p.code, p.description, p.shrink_pct,
                coalesce(proc.total, 0) as processing_fees_per_lb,
                coalesce(marg.total, 0) as margin_per_lb,
                round(p_raw_cost_per_lb / (1 - p.shrink_pct) + coalesce(proc.total, 0), 4) as cost_per_lb,
                p.target_margin_pct,
                p.list_price_per_lb
            from public.products p
            left join (select pf.product_id, sum(pf.amount_per_lb) total
                       from public.product_fees pf join public.fee_types ft on ft.id = pf.fee_type_id
                       where ft.kind = 'processing' group by pf.product_id) proc on proc.product_id = p.id
            left join (select pf.product_id, sum(pf.amount_per_lb) total
                       from public.product_fees pf join public.fee_types ft on ft.id = pf.fee_type_id
                       where ft.kind = 'margin' group by pf.product_id) marg on marg.product_id = p.id
            where p.kind = 'finished' and p.active and p.raw_product_id = p_raw_product_id
        ) c
    ) w
    order by w.code;
end $$;
revoke all on function public.price_what_if(uuid, numeric)
    from public, anon, authenticated, service_role;
grant execute on function public.price_what_if(uuid, numeric) to authenticated;
