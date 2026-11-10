-- The "Today" page's figures, computed here so the app only reads them. Each view
-- runs as the caller, so row-level security decides each role's rows, and none
-- rounds: the app rounds for display.

-- One row per sale date, over the sales that are not voided. A date whose sales
-- are all voided has no row.
create view public.v_daily_sales with (security_invoker = true) as
select
    s.sale_date,
    sum(si.lbs_sold * si.price_per_lb) as sales_total
from public.sales s
join public.sale_items si on si.sale_id = s.id
where s.voided_at is null
group by s.sale_date;

revoke all on public.v_daily_sales from public, anon, authenticated, service_role;
grant select on public.v_daily_sales to authenticated, service_role;

-- One row of what the stock is worth at cost: every lot's remaining lbs at its
-- current cost, and every finished good's remaining lbs at its cost per lb. A void
-- or a reversal already zeroes what it takes off the shelf. An aggregate with no
-- GROUP BY returns a row even when row-level security hides every row under it,
-- so the HAVING gives a caller who sees nothing no row.
create view public.v_stock_value with (security_invoker = true) as
select
    coalesce(sum(value) filter (where raw), 0) as raw_value,
    coalesce(sum(value) filter (where not raw), 0) as finished_value,
    coalesce(sum(value), 0) as total_value
from (
    select true as raw, l.remaining_lbs * l.current_unit_cost as value
    from public.lots l
    union all
    select false as raw, fg.lbs_remaining * fg.cost_per_lb as value
    from public.finished_goods fg
) stock
having count(*) > 0;

revoke all on public.v_stock_value from public, anon, authenticated, service_role;
grant select on public.v_stock_value to authenticated, service_role;

-- One row per product with the lbs on hand: a raw product's balance (0 with no
-- balance row) or a finished product's remaining lbs summed over its finished
-- goods (0 with none).
create view public.v_stock_on_hand with (security_invoker = true) as
select
    p.id as product_id, p.code, p.description, p.kind, p.active,
    case p.kind
        when 'raw' then coalesce(
            (select ib.qty_on_hand from public.inventory_balances ib where ib.product_id = p.id), 0)
        else coalesce(
            (select sum(fg.lbs_remaining) from public.finished_goods fg where fg.finished_product_id = p.id), 0)
    end as lbs_on_hand
from public.products p;

revoke all on public.v_stock_on_hand from public, anon, authenticated, service_role;
grant select on public.v_stock_on_hand to authenticated, service_role;
