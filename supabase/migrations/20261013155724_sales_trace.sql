-- Sales feature: the trace view gains the keys the pages need (appended, so the
-- first 16 columns keep their name, type, and order), and a summary view gives
-- each sale one row with its total.

create or replace view public.v_sale_traceability with (security_invoker = true) as
select
    s.sale_number, s.sale_date,
    fp.code as finished_code, fp.description as finished_product, si.lbs_sold, si.price_per_lb,
    b.batch_number, b.production_date,
    l.lot_number as raw_lot, rp.description as raw_product, v.name as vendor,
    l.received_date, pbl.lbs_consumed as raw_lbs_from_lot, l.unit_cost as raw_lot_cost_per_lb,
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

-- One row per sale, void or not. A sale sells one product, so grouping by the
-- product keeps one row.
create view public.v_sale_summary with (security_invoker = true) as
select
    s.id as sale_id, s.sale_number, s.sale_date, s.created_at,
    s.customer_id, c.name as customer,
    fp.id as finished_product_id, fp.code as finished_code, fp.description as finished_product,
    sum(si.lbs_sold) as lbs_sold, min(si.price_per_lb) as price_per_lb,
    s.voided_at, s.void_reason
from public.sales s
join public.sale_items si     on si.sale_id = s.id
join public.finished_goods fg on fg.id = si.finished_goods_id
join public.products fp       on fp.id = fg.finished_product_id
left join public.customers c  on c.id = s.customer_id
group by s.id, c.name, fp.id;

revoke all on public.v_sale_summary from public, anon, authenticated, service_role;
grant select on public.v_sale_summary to authenticated, service_role;
