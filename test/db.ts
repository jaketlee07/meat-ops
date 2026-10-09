import type { SupabaseClient } from "@supabase/supabase-js";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { TypedClient } from "../src/lib/supabase.js";
import { resolveStackEnv } from "./env.js";
import { OPERATOR_EMAIL } from "./users.js";

// Direct Postgres access for TEST SETUP and RAW-TABLE READ ASSERTIONS only.
//
// It resets state between tests and reads back raw tables to check invariants
// (conservation, lot immutability). It NEVER writes to the protected
// transactional tables (lots, inventory_balances, production_batches,
// production_batch_lots, finished_goods, sale_items, sales, lot_adjustments). Those are
// populated exclusively through the costing RPCs under test. resetTestData only
// truncates and re-seeds MASTER data (fee_types, vendors, products, fees),
// which mirrors the top of supabase/seed.sql.
//
// Sessions that call the operations (callAsOperator, raceCalls) take
// `set local role authenticated` and operator JWT claims, so they pass the same
// caller check as the app. The only other ledger writes a test may attempt are
// ones a criterion requires to be refused.

const env = resolveStackEnv();
const pool = new Pool({ connectionString: env.dbUrl });

// Vitest throws when it is imported outside its own runner, and the browser
// suite imports this file. So the helpers that assert load `expect` when they
// run, which only happens inside Vitest.
async function loadExpect(): Promise<typeof import("vitest").expect> {
  return (await import("vitest")).expect;
}

// Fixed UUIDs, matching supabase/seed.sql so numbers tie out to docs/costing.md.
export const VENDOR_ID = "11111111-1111-1111-1111-111111111111";
export const RAW_TOM_ID = "22222222-2222-2222-2222-222222222222";
export const PROD_502_ID = "33333333-3333-3333-3333-333333333333";
export const CUSTOMER_ID = "44444444-4444-4444-4444-444444444444";

const MASTER_DATA_SQL = `
truncate
  sale_items, sales, customers,
  finished_goods, production_batch_lots, production_batches,
  lot_adjustments, lots, inventory_balances,
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

// Plain pg access for master-data inserts and read-back assertions.
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<R[]> {
  const { rows } = await pool.query<R>(text, values);
  return rows;
}

// ---- Operation calls ----
//
// One definition of each operation call. The same call goes to the signed-in
// supabase-js client (JSON-safe cases) or to a pg operator session (NaN,
// overlapping sessions, one transaction), which sends it by parameter name.

export type Arg = number | string | null;

export type OperationName =
  | "receive_lot"
  | "produce_batch"
  | "record_sale"
  | "void_receipt"
  | "void_sale"
  | "adjust_lot"
  | "set_target_margin"
  | "set_list_price"
  | "price_what_if";

export interface OpCall {
  fn: OperationName;
  args: Record<string, Arg>;
}

const PARAM_TYPES: Record<string, string> = {
  p_product_id: "uuid",
  p_vendor_id: "uuid",
  p_weight_lbs: "numeric",
  p_unit_cost: "numeric",
  p_received: "date",
  p_finished_product_id: "uuid",
  p_raw_lbs_in: "numeric",
  p_finished_lbs_out: "numeric",
  p_production_date: "date",
  p_lbs: "numeric",
  p_price_per_lb: "numeric",
  p_sale_date: "date",
  p_lot_id: "uuid",
  p_sale_id: "uuid",
  p_reason: "text",
  p_new_remaining_lbs: "numeric",
  p_target_percent: "numeric",
  p_raw_product_id: "uuid",
  p_raw_cost_per_lb: "numeric",
};

export const receiveCall = (
  product: string,
  vendor: string | null,
  weight: Arg,
  cost: Arg,
  received = "2026-05-12",
): OpCall => ({
  fn: "receive_lot",
  args: {
    p_product_id: product,
    p_vendor_id: vendor,
    p_weight_lbs: weight,
    p_unit_cost: cost,
    p_received: received,
  },
});

export const produceCall = (
  product: string,
  rawLbs: Arg,
  finishedLbs: Arg = null,
  date = "2026-05-20",
): OpCall => ({
  fn: "produce_batch",
  args: {
    p_finished_product_id: product,
    p_raw_lbs_in: rawLbs,
    p_finished_lbs_out: finishedLbs,
    p_production_date: date,
  },
});

export const saleCall = (product: string, lbs: Arg, price: Arg, date = "2026-05-21"): OpCall => ({
  fn: "record_sale",
  args: {
    p_finished_product_id: product,
    p_lbs: lbs,
    p_price_per_lb: price,
    p_sale_date: date,
  },
});

export const voidReceiptCall = (lotId: string, reason: string | null = "entered twice"): OpCall => ({
  fn: "void_receipt",
  args: { p_lot_id: lotId, p_reason: reason },
});

export const voidSaleCall = (saleId: string, reason: string | null = "wrong customer"): OpCall => ({
  fn: "void_sale",
  args: { p_sale_id: saleId, p_reason: reason },
});

export const adjustCall = (lotId: string, newLbs: Arg, reason: string | null = "count"): OpCall => ({
  fn: "adjust_lot",
  args: { p_lot_id: lotId, p_new_remaining_lbs: newLbs, p_reason: reason },
});

export interface SqlCall {
  text: string;
  values: unknown[];
}

// Named-argument SQL, so defaults apply and a signature change fails loudly.
export function sqlOf(call: OpCall): SqlCall {
  const names = Object.keys(call.args);
  const list = names.map((n, i) => `${n} => $${i + 1}::${PARAM_TYPES[n]}`).join(", ");
  return { text: `select * from public.${call.fn}(${list})`, values: names.map((n) => call.args[n]) };
}

export interface CallOutcome {
  ok: boolean;
  error?: string;
  rows?: Record<string, unknown>[];
  // Race harness only, on the second call: the locks it was waiting on, as
  // "locktype:relation" (for example "tuple:products").
  waitedOn?: string[];
}

export const idOf = (outcome: CallOutcome): string => String(outcome.rows?.[0]?.id);

// ---- Calls through the signed-in supabase-js client ----

export async function callAsClient(client: TypedClient, call: OpCall): Promise<CallOutcome> {
  const { data, error } = await (client as unknown as SupabaseClient).rpc(call.fn, call.args);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: data == null ? [] : [data as Record<string, unknown>] };
}

// A refusal carries the keyword and leaves every table unchanged.
async function expectRefusedVia(
  send: () => Promise<CallOutcome>,
  call: OpCall,
  keyword: RegExp,
): Promise<void> {
  const expect = await loadExpect();
  const before = await tableFingerprints();
  const outcome = await send();
  expect(outcome.ok, `expected a refusal for ${call.fn} ${JSON.stringify(call.args)}`).toBe(false);
  expect(outcome.error).toMatch(keyword);
  expect(await tableFingerprints()).toEqual(before);
}

// Goes through the signed-in client. JSON cannot carry NaN, so a call with a
// "NaN" argument goes through a pg operator session instead.
export function expectRefused(client: TypedClient, call: OpCall, keyword: RegExp): Promise<void> {
  const hasNaN = Object.values(call.args).includes("NaN");
  return expectRefusedVia(
    () => (hasNaN ? callAsOperator(call) : callAsClient(client, call)),
    call,
    keyword,
  );
}

// AC-0017: the batch drew exactly the lbs it was asked for, and the sale lines
// add up to exactly the lbs sold. `requested` is the amount at the call site.
export async function assertBatchConsumed(batchId: string, requested: number): Promise<void> {
  const expect = await loadExpect();
  const [row] = await query(
    `select b.raw_lbs_in::float8 as raw_lbs_in,
            coalesce(sum(pbl.lbs_consumed), 0)::float8 as consumed
     from production_batches b
     left join production_batch_lots pbl on pbl.batch_id = b.id
     where b.id = $1 group by b.id`,
    [batchId],
  );
  expect(row, `AC-0017 batch ${batchId}`).toEqual({ raw_lbs_in: requested, consumed: requested });
}

export async function assertSaleLines(saleId: string, requested: number): Promise<void> {
  const expect = await loadExpect();
  const [row] = await query(
    "select coalesce(sum(lbs_sold), 0)::float8 as sold from sale_items where sale_id = $1",
    [saleId],
  );
  expect(row, `AC-0017 sale ${saleId}`).toEqual({ sold: requested });
}

// AC-0017 for one finished call, whatever channel it used. A refusal passes.
export async function assertRequestedTotals(call: OpCall, outcome: CallOutcome): Promise<void> {
  if (!outcome.ok) return;
  if (call.fn === "produce_batch") {
    await assertBatchConsumed(idOf(outcome), Number(call.args.p_raw_lbs_in));
  } else if (call.fn === "record_sale") {
    await assertSaleLines(idOf(outcome), Number(call.args.p_lbs));
  }
}

// ---- Operator sessions (pg) ----

let operatorIdCache: string | undefined;

export async function getOperatorId(): Promise<string> {
  if (operatorIdCache) return operatorIdCache;
  const { rows } = await pool.query("select id from auth.users where email = $1", [OPERATOR_EMAIL]);
  if (!rows[0]) throw new Error("operator user missing; global setup should have created it");
  operatorIdCache = String(rows[0].id);
  return operatorIdCache;
}

const quietClients = new WeakSet<PoolClient>();

interface Session {
  client: PoolClient;
  pid: number;
}

async function openOperatorSession(): Promise<Session> {
  const claims = JSON.stringify({ role: "authenticated", sub: await getOperatorId() });
  const client = await pool.connect();
  // A backend ended on purpose (see closeSession) must not crash the run.
  if (!quietClients.has(client)) {
    quietClients.add(client);
    client.on("error", () => undefined);
  }
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    const pid = Number((await client.query("select pg_backend_pid() as pid")).rows[0].pid);
    return { client, pid };
  } catch (err) {
    client.release(true);
    throw err;
  }
}

async function run(session: Session, call: OpCall): Promise<CallOutcome> {
  const sql = sqlOf(call);
  try {
    const { rows } = await session.client.query(sql.text, sql.values);
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// One call in its own transaction as the operator. NaN goes through here
// because JSON cannot carry it.
export async function callAsOperator(call: OpCall): Promise<CallOutcome> {
  return inOperatorTransaction(async (run1) => run1(call));
}

// Several calls in one transaction as the operator (same-transaction ordering
// cases). Commits when the callback returns, rolls back if it throws.
export async function inOperatorTransaction<T>(
  fn: (call: (c: OpCall) => Promise<CallOutcome>) => Promise<T>,
): Promise<T> {
  const session = await openOperatorSession();
  try {
    const result = await fn((c) => run(session, c));
    await session.client.query("commit");
    return result;
  } catch (err) {
    await session.client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    session.client.release();
  }
}

// Race harness. Session A opens a transaction and makes its call. Session B
// makes its call. Poll until B's backend waits on a lock or B's call has
// already settled (pairs that do not contend never wait), then commit A and
// await B. Returns both outcomes so a test can count successes; B's outcome
// also says which locks it waited on.
//
// Every wait shares one budget that stays under vitest's 5 s test timeout, so a
// stuck call fails here with an error that names it instead of as a generic
// timeout. Whatever happens, both sessions are ended (which rolls back anything
// still open) before the function returns, so no lock outlives the test.
const RACE_BUDGET_MS = 3_000;

function bounded<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`race harness: ${what}`)), Math.max(ms, 0));
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function lockWaits(pid: number): Promise<string[] | undefined> {
  const { rows } = await pool.query(
    `select l.locktype, coalesce(c.relname, '') as relation
     from pg_stat_activity a
     join pg_locks l on l.pid = a.pid
     left join pg_class c on c.oid = l.relation
     where a.pid = $1 and a.wait_event_type = 'Lock' and (l.locktype = 'tuple' or not l.granted)`,
    [pid],
  );
  return rows.length > 0 ? rows.map((r) => `${r.locktype}:${r.relation}`) : undefined;
}

async function closeSession(session: Session, clean: boolean): Promise<void> {
  if (clean) {
    session.client.release();
    return;
  }
  await pool.query("select pg_terminate_backend($1)", [session.pid]).catch(() => undefined);
  for (let i = 0; i < 100; i++) {
    const { rows } = await pool.query("select 1 from pg_stat_activity where pid = $1", [session.pid]);
    if (rows.length === 0) break;
    await sleep(10);
  }
  session.client.release(true);
}

export async function raceCalls(a: OpCall, b: OpCall): Promise<[CallOutcome, CallOutcome]> {
  const deadline = Date.now() + RACE_BUDGET_MS;
  const left = () => deadline - Date.now();
  const sessions: Session[] = [];
  let clean = false;
  try {
    const sessionA = await openOperatorSession();
    sessions.push(sessionA);
    const sessionB = await openOperatorSession();
    sessions.push(sessionB);

    const outcomeA = await bounded(
      run(sessionA, a),
      left(),
      `first call ${a.fn} did not return within ${RACE_BUDGET_MS} ms`,
    );

    let settled = false;
    const pendingB = run(sessionB, b).then((o) => {
      settled = true;
      return o;
    });

    let waitedOn: string[] | undefined;
    while (!settled && !waitedOn) {
      if (left() <= 0) {
        throw new Error(
          `race harness: second call ${b.fn} neither waited on a lock nor finished within ${RACE_BUDGET_MS} ms`,
        );
      }
      waitedOn = await lockWaits(sessionB.pid);
      if (!waitedOn && !settled) await sleep(15);
    }

    await bounded(
      sessionA.client.query(outcomeA.ok ? "commit" : "rollback"),
      left(),
      `ending the first call ${a.fn} did not finish`,
    );
    const outcomeB = await bounded(
      pendingB,
      left(),
      `second call ${b.fn} still blocked ${RACE_BUDGET_MS} ms in, after the first call ${a.fn} ended` +
        (waitedOn ? ` (waiting on ${waitedOn.join(", ")})` : ""),
    );
    await bounded(
      sessionB.client.query(outcomeB.ok ? "commit" : "rollback"),
      left(),
      `ending the second call ${b.fn} did not finish`,
    );

    clean = true;
    return [outcomeA, waitedOn ? { ...outcomeB, waitedOn } : outcomeB];
  } finally {
    await Promise.all(sessions.map((s) => closeSession(s, clean)));
  }
}

// ---- Ledger invariants (read-only, catalog-wide) ----

// One fingerprint (row count and content hash) for every table in public,
// found through the catalog so a new table is covered without editing a suite.
// "A refusal changes nothing" compares two of these.
export async function tableFingerprints(): Promise<Record<string, string>> {
  const tables = await query<{ name: string }>(`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
    order by 1`);
  const out: Record<string, string> = {};
  for (const t of tables) {
    const [row] = await query<{ n: number; h: string }>(
      `select count(*)::int as n, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h
       from public."${t.name}" t`,
    );
    out[t.name] = `${row?.n}:${row?.h}`;
  }
  return out;
}

// AC-0030, AC-0031, AC-0054, AC-0032, AC-0033 for every raw product, lot, and
// finished lot. Void lots and void sales are excluded from the remaining-lbs
// equalities and checked for AC-0033 instead.
export async function assertLedgerInvariants(): Promise<void> {
  const expect = await loadExpect();
  const { rows } = await pool.query(`
    select 'AC-0030 qty_on_hand <> sum(remaining)' as violation, p.id::text as subject
    from products p
    left join inventory_balances b on b.product_id = p.id
    left join (select product_id, sum(remaining_lbs) s from lots group by product_id) l
           on l.product_id = p.id
    where p.kind = 'raw' and coalesce(b.qty_on_hand, 0) <> coalesce(l.s, 0)
    union all
    select 'AC-0031 remaining <> weight - consumed - adjusted', l.id::text
    from lots l
    left join (select lot_id, sum(lbs_consumed) c from production_batch_lots group by lot_id) c
           on c.lot_id = l.id
    left join (select lot_id, sum(old_remaining_lbs - new_remaining_lbs) a
               from lot_adjustments group by lot_id) a
           on a.lot_id = l.id
    where l.voided_at is null
      and l.remaining_lbs <> l.weight_lbs - coalesce(c.c, 0) - coalesce(a.a, 0)
    union all
    select 'AC-0054 remaining > weight - consumed', l.id::text
    from lots l
    left join (select lot_id, sum(lbs_consumed) c from production_batch_lots group by lot_id) c
           on c.lot_id = l.id
    where l.voided_at is null and l.remaining_lbs > l.weight_lbs - coalesce(c.c, 0)
    union all
    select 'AC-0032 remaining <> produced - sold', f.id::text
    from finished_goods f
    left join (select si.finished_goods_id, sum(si.lbs_sold) s
               from sale_items si join sales s on s.id = si.sale_id
               where s.voided_at is null
               group by si.finished_goods_id) s
           on s.finished_goods_id = f.id
    where f.lbs_remaining <> f.lbs_produced - coalesce(s.s, 0)
    union all
    select 'AC-0033 void lot has a consumption row', l.id::text
    from lots l
    where l.voided_at is not null
      and exists (select 1 from production_batch_lots pbl where pbl.lot_id = l.id)
    union all
    select 'AC-0033 void lot has an adjustment row', l.id::text
    from lots l
    where l.voided_at is not null
      and exists (select 1 from lot_adjustments a where a.lot_id = l.id)
  `);
  expect(rows).toEqual([]);
}

// AC-0028: every raw product with lbs on hand carries its stock-on-hand
// average. The average is computed in SQL, never in TypeScript.
export async function assertAverageIsStockOnHand(): Promise<void> {
  const expect = await loadExpect();
  const { rows } = await pool.query(`
    select b.product_id, b.moving_avg_cost::float8 as stored, round(l.v / l.q, 4)::float8 as expected
    from inventory_balances b
    join (select product_id, sum(remaining_lbs) q, sum(remaining_lbs * unit_cost) v
          from lots group by product_id having sum(remaining_lbs) > 0) l
      on l.product_id = b.product_id
    where b.moving_avg_cost <> round(l.v / l.q, 4)
  `);
  expect(rows).toEqual([]);
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
    "select id, unit_cost, weight_lbs, remaining_lbs, received_date from lots where product_id = $1 order by received_date, receipt_seq",
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
