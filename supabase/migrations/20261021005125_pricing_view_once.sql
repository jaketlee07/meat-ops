-- ============================================================
-- Pricing view, each rounding once (menu-pricing-review T1).
--
-- v_product_pricing works out the suggested list price and the margin at the
-- list price once, in a middle subquery m, and the price action, the
-- needs-new-price flag, and the below-target flag read those two columns.
-- Every column keeps its name, type, order, and values, and the view keeps its
-- grants. The subquery s is the menu-pricing one, unchanged.
--
-- CREATE OR REPLACE VIEW clears security_invoker, so the statement sets it
-- again.
-- ============================================================

create or replace view public.v_product_pricing
with (security_invoker = true) as
select
    m.product_id, m.code, m.description, m.species, m.shrink_pct,
    m.raw_cost_per_lb, m.post_shrink_cost_per_lb, m.processing_fees_per_lb,
    m.margin_per_lb, m.cost_per_lb, m.final_price_per_lb,
    m.target_margin_pct,
    m.list_price_per_lb,
    m.has_cost,
    m.suggested_list_price,
    m.margin_at_list_pct,
    case when m.has_cost then
        case when m.list_price_per_lb is null then 'set'
             when m.list_price_per_lb < m.suggested_list_price then 'raise'
             when m.list_price_per_lb > m.suggested_list_price then 'lower'
        end
    end as price_action,
    coalesce(m.has_cost and (
        m.list_price_per_lb is null
        or m.list_price_per_lb <> m.suggested_list_price
    ), false) as needs_new_price,
    -- The margin is null with no cost or no list price, and a null target
    -- makes the comparison null, so each of those cases is false.
    coalesce(m.margin_at_list_pct < m.target_margin_pct, false) as below_target
from (
    select
        s.*,
        case when s.has_cost then round(s.final_price_per_lb, 2) end as suggested_list_price,
        case when s.has_cost and s.list_price_per_lb is not null
             then round((s.list_price_per_lb - s.cost_per_lb) / s.list_price_per_lb, 4)
        end as margin_at_list_pct
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
    ) s
) m;
