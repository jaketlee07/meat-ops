-- AC-0144 fixture: 50 active raw products, 100 active finished products with list
-- prices and targets, 2,000 lots, and 1,000 batches (half of them measured), built
-- through the operations.
-- Run against the local stack as postgres, from psql, after one `npm test` has made
-- the test operator (the allowlist is empty after a reset):
--   docker exec -i supabase_db_meat-ops-b psql -U postgres -v ON_ERROR_STOP=1 < ac0144-fixture.sql
-- Then time it with ac0144-time.sql. The operator is taken from private.operators.
-- This script empties the data tables first, and leaves its fixture in place.
\set ON_ERROR_STOP on
select user_id::text as op_sub from private.operators order by user_id limit 1 \gset
\if :{?op_sub}
\else
  \echo 'private.operators is empty: run npm test once so the test operator exists'
  \quit 1
\endif
truncate import_draft_lines, import_drafts, sale_items, sales, customers, finished_goods, production_batch_lots,
  production_batches, lot_adjustments, lots, inventory_balances, product_fees, products, fee_types, vendors,
  private.list_price_changes, alerts restart identity cascade;
insert into fee_types(code, name, kind, sort_order) values
  ('cutting','Cutting','processing',1),('overhead','Belmont overhead','processing',8),('profit','Profit','margin',9);
insert into vendors(id, name) values ('11111111-1111-1111-1111-111111111111','Reyes Meats');
insert into products(code, description, species, kind)
  select 'RAW-'||g, 'Raw '||g, 'Turkey', 'raw' from generate_series(1,50) g;
insert into products(code, description, species, kind, raw_product_id, shrink_pct)
  select 'F-'||g, 'Finished '||g, 'Turkey', 'finished', r.id, 0.2300
  from generate_series(1,100) g join products r on r.code = 'RAW-'||(((g-1)/2)+1);
insert into product_fees(product_id, fee_type_id, amount_per_lb)
  select p.id, ft.id, case ft.code when 'cutting' then 0.10 when 'overhead' then 0.35 else 0.05 end
  from products p cross join fee_types ft where p.kind = 'finished';
set role authenticated;
select set_config('request.jwt.claims', json_build_object('role', 'authenticated', 'sub', :'op_sub')::text, false);
do $$
declare r record; k int; f record; j int;
begin
  for r in select id, substr(code,5)::int as n from public.products where kind = 'raw' loop
    for k in 1..40 loop
      perform public.receive_lot(r.id, '11111111-1111-1111-1111-111111111111', 1000,
        1.50 + ((r.n*7 + k*13) % 40) / 100.0, date '2026-09-04' + k);
    end loop;
  end loop;
  for f in select id, substr(code,3)::int as n from public.products where kind = 'finished' loop
    perform public.set_target_margin(f.id, 20);
    perform public.set_list_price(f.id, 2.50 + (f.n % 10) / 10.0);
    for j in 1..10 loop
      -- Even batches are measured (a finished weight the 23% shrink does not give), so
      -- the yield rule has candidates inside the watch's 14 days and measured
      -- references before them. Odd batches are not (finished lbs from the shrink).
      perform public.produce_batch(f.id, 100,
        case when j % 2 = 0 then 76.5 - ((f.n + j) % 5) end, date '2026-09-20' + j * 2);
    end loop;
  end loop;
end $$;
reset role;
analyze;
select (select count(*) from products where kind='raw' and active) raws,
       (select count(*) from products where kind='finished' and active and list_price_per_lb is not null and target_margin_pct is not null) finished,
       (select count(*) from lots) lots, (select count(*) from production_batches) batches;
