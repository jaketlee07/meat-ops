-- ============================================================
-- Seed + demo. Ties to the pricing sheet: Turkey Drums TOM -> $2.68/lb.
-- ============================================================

-- Fee types (mirrors the "Processing Fees/lb" columns)
insert into fee_types(code, name, kind, sort_order) values
    ('cutting',        'Cutting',                 'processing', 1),
    ('defrosting',     'Defrosting',              'processing', 2),
    ('process',        'Process',                 'processing', 3),
    ('direct_material','Direct cost of material', 'processing', 4),
    ('labor',          'TP cost of labor',        'processing', 5),
    ('freezing',       'Cost of freezing',        'processing', 6),
    ('seasoning',      'Seasoning',               'processing', 7),
    ('overhead',       'Belmont overhead',        'processing', 8),
    ('profit',         'Profit',                  'margin',     9),
    ('broker',         'Broker commission',       'margin',    10);

-- Vendor
insert into vendors(id, name) values
    ('11111111-1111-1111-1111-111111111111', 'Reyes Meats');

-- Raw + finished products (Turkey Drums TOM, code 502)
insert into products(id, code, description, species, kind) values
    ('22222222-2222-2222-2222-222222222222', 'RAW-TOM', 'Turkey Drums TOM (raw)', 'Turkey', 'raw');

insert into products(id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct) values
    ('33333333-3333-3333-3333-333333333333', '502', 'Smoked Turkey Drums Tom', 'Prospect Meats',
     'Turkey', 'finished', '56cs/pl', 32.5, '22222222-2222-2222-2222-222222222222', 0.2300);

-- Fees for code 502: direct material .05, freezing .03, overhead .37 (cost) + profit .05 (margin)
insert into product_fees(product_id, fee_type_id, amount_per_lb)
select '33333333-3333-3333-3333-333333333333', ft.id, x.amt
from (values ('direct_material',0.05),('freezing',0.03),('overhead',0.37),('profit',0.05)) x(code,amt)
join fee_types ft on ft.code = x.code;

-- Receive raw at $1.68/lb -> pricing view should read $2.68 final (ties to the sheet)
select receive_lot('22222222-2222-2222-2222-222222222222',
                   '11111111-1111-1111-1111-111111111111', 5000, 1.68, date '2026-05-12');

\echo '--- Pricing after first receipt (expect final_price_per_lb = 2.68) ---'
select code, description, raw_cost_per_lb, post_shrink_cost_per_lb, cost_per_lb, final_price_per_lb
from v_product_pricing;

-- Second receipt at $1.80/lb -> watch the moving average shift
select receive_lot('22222222-2222-2222-2222-222222222222',
                   '11111111-1111-1111-1111-111111111111', 3000, 1.80, date '2026-05-19');

\echo '--- Moving average after second receipt (expect avg ~1.725) ---'
select qty_on_hand, moving_avg_cost from inventory_balances;

\echo '--- Pricing now reflects the blended cost ---'
select code, raw_cost_per_lb, post_shrink_cost_per_lb, final_price_per_lb from v_product_pricing;

-- Produce a batch: 2000 lbs raw -> 23% shrink -> 1540 lbs finished
select produce_batch('33333333-3333-3333-3333-333333333333', 2000, null, date '2026-05-20');

\echo '--- Batch cost (raw consumed FIFO from the $1.68 lot) ---'
select batch_number, raw_lbs_in, finished_lbs_out, raw_cost_total, cost_per_finished_lb
from production_batches;

-- Sell 500 lbs to a customer
insert into customers(id, name) values ('44444444-4444-4444-4444-444444444444','Fulton Market Deli');
select record_sale('33333333-3333-3333-3333-333333333333', 500, 2.68,
                   '44444444-4444-4444-4444-444444444444', date '2026-05-21');

\echo '--- Current menu (sellable, priced from live cost) ---'
select code, description, final_price_per_lb, finished_lbs_available, raw_lbs_available, sellable
from v_current_menu;

\echo '--- TRACE-BACK: where did the sold meat come from? ---'
select sale_number, finished_product, lbs_sold, batch_number, production_date,
       raw_lot, vendor, received_date, raw_lbs_from_lot, raw_lot_cost_per_lb
from v_sale_traceability;
