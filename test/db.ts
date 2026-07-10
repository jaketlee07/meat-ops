import { Pool } from "pg";
import { resolveStackEnv } from "./env.js";

// Direct Postgres access for TEST SETUP and RAW-TABLE READ ASSERTIONS only.
//
// It resets state between tests and reads back raw tables to check invariants
// (conservation, lot immutability). It NEVER writes to the protected
// transactional tables (lots, inventory_balances, production_batches,
// production_batch_lots, finished_goods, sale_items, sales). Those are
// populated exclusively through the costing RPCs under test. resetTestData only
// truncates and re-seeds MASTER data (fee_types, vendors, products, fees),
// which mirrors the top of supabase/seed.sql.

const env = resolveStackEnv();
const pool = new Pool({ connectionString: env.dbUrl });

// Fixed UUIDs, matching supabase/seed.sql so numbers tie out to docs/costing.md.
export const VENDOR_ID = "11111111-1111-1111-1111-111111111111";
export const RAW_TOM_ID = "22222222-2222-2222-2222-222222222222";
export const PROD_502_ID = "33333333-3333-3333-3333-333333333333";
export const CUSTOMER_ID = "44444444-4444-4444-4444-444444444444";

const MASTER_DATA_SQL = `
truncate
  sale_items, sales, customers,
  finished_goods, production_batch_lots, production_batches,
  lots, inventory_balances,
  product_fees, products, fee_types, vendors
  restart identity cascade;

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

insert into vendors(id, name) values
  ('${VENDOR_ID}', 'Reyes Meats');

insert into customers(id, name) values
  ('${CUSTOMER_ID}', 'Fulton Market Deli');

insert into products(id, code, description, species, kind) values
  ('${RAW_TOM_ID}', 'RAW-TOM', 'Turkey Drums TOM (raw)', 'Turkey', 'raw');

insert into products(id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct) values
  ('${PROD_502_ID}', '502', 'Smoked Turkey Drums Tom', 'Prospect Meats',
   'Turkey', 'finished', '56cs/pl', 32.5, '${RAW_TOM_ID}', 0.2300);

insert into product_fees(product_id, fee_type_id, amount_per_lb)
select '${PROD_502_ID}', ft.id, x.amt
from (values ('direct_material',0.05),('freezing',0.03),('overhead',0.37),('profit',0.05)) x(code,amt)
join fee_types ft on ft.code = x.code;
`;

export async function resetTestData(): Promise<void> {
  await pool.query(MASTER_DATA_SQL);
}

export async function closePool(): Promise<void> {
  await pool.end();
}

// ---- Raw read helpers (assertions only, never cost math) ----

export interface InventoryBalance {
  qty_on_hand: number;
  moving_avg_cost: number;
}

export async function getInventoryBalance(productId: string): Promise<InventoryBalance | null> {
  const { rows } = await pool.query(
    "select qty_on_hand, moving_avg_cost from inventory_balances where product_id = $1",
    [productId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    qty_on_hand: Number(row.qty_on_hand),
    moving_avg_cost: Number(row.moving_avg_cost),
  };
}

export async function sumRemainingLots(productId: string): Promise<number> {
  const { rows } = await pool.query(
    "select coalesce(sum(remaining_lbs), 0) as total from lots where product_id = $1",
    [productId],
  );
  return Number(rows[0].total);
}

export interface LotRow {
  id: string;
  unit_cost: number;
  weight_lbs: number;
  remaining_lbs: number;
  received_date: string;
}

export async function getLots(productId: string): Promise<LotRow[]> {
  const { rows } = await pool.query(
    "select id, unit_cost, weight_lbs, remaining_lbs, received_date from lots where product_id = $1 order by received_date, created_at",
    [productId],
  );
  return rows.map((r) => ({
    id: r.id,
    unit_cost: Number(r.unit_cost),
    weight_lbs: Number(r.weight_lbs),
    remaining_lbs: Number(r.remaining_lbs),
    received_date: r.received_date instanceof Date ? r.received_date.toISOString().slice(0, 10) : String(r.received_date),
  }));
}

export interface FinishedGoodsRow {
  lbs_produced: number;
  lbs_remaining: number;
}

export async function getFinishedGoods(finishedProductId: string): Promise<FinishedGoodsRow[]> {
  const { rows } = await pool.query(
    "select lbs_produced, lbs_remaining from finished_goods where finished_product_id = $1",
    [finishedProductId],
  );
  return rows.map((r) => ({
    lbs_produced: Number(r.lbs_produced),
    lbs_remaining: Number(r.lbs_remaining),
  }));
}
