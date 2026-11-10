import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import { createTypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  correctCall,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  reverseCall,
  saleCall,
  VENDOR_ID,
  voidReceiptCall,
  voidSaleCall,
  type OpCall,
} from "./db.js";
import { resolveStackEnv } from "./env.js";
import { signInNonOperator, signInOperator } from "./users.js";

// Every name, price, and figure in this file is made up. Setup goes through the
// operations only; the daily sales and stock value values are read back as text and compared with their
// exact unrounded text at the views' scale of 7 (lbs at scale 3 times a cost or price at scale 4), so a
// view that rounds fails. The stock on hand check compares lbs as numbers. No figure goes through
// JavaScript arithmetic.

const VIEWS = ["v_daily_sales", "v_stock_value", "v_stock_on_hand"] as const;
const SALES_DAY = "2026-06-10";

type Loose = SupabaseClient;

async function run(call: OpCall): Promise<string> {
  const outcome = await callAsOperator(call);
  if (!outcome.ok) throw new Error(`${call.fn}: ${outcome.error}`);
  return idOf(outcome);
}

// 1,000 lbs of RAW-TOM at 1.68, then a batch of 502 from 400 raw lbs (308 finished lbs at 2.6318).
async function receiveAndProduce(): Promise<void> {
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-06-01"));
  await run(produceCall(PROD_502_ID, 400, null, "2026-06-02"));
}

// AC-0011's sales on SALES_DAY: 100 lbs at 3.29, 50 lbs at 3.50, and 10 lbs at 3.00, voided.
async function recordDaySales(): Promise<void> {
  await run(saleCall(PROD_502_ID, 100, 3.29, SALES_DAY));
  await run(saleCall(PROD_502_ID, 50, 3.5, SALES_DAY));
  const voided = await run(saleCall(PROD_502_ID, 10, 3.0, SALES_DAY));
  await run(voidSaleCall(voided));
}

// The three stock values as the views' own text.
async function stockValue() {
  return query<{ raw_value: string; finished_value: string; total_value: string }>(
    `select raw_value::text, finished_value::text, total_value::text from public.v_stock_value`,
  );
}

const WORKED_STOCK = [{ raw_value: "1908.0000000", finished_value: "415.8244000", total_value: "2323.8244000" }];

beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

it("AC-0011: the daily sales view totals the day's sales that are not voided", async () => {
  await receiveAndProduce();
  await recordDaySales();
  // Another date has its own total, and a date whose only sale is voided has no row.
  await run(saleCall(PROD_502_ID, 20, 3.0, "2026-06-11"));
  const onlyVoided = await run(saleCall(PROD_502_ID, 5, 3.0, "2026-06-12"));
  await run(voidSaleCall(onlyVoided));

  const day = await query(
    `select sales_total::text as total from public.v_daily_sales where sale_date = $1`,
    [SALES_DAY],
  );
  expect(day).toEqual([{ total: "504.0000000" }]);
  const other = await query(`select sales_total::text as total from public.v_daily_sales where sale_date = '2026-06-11'`);
  expect(other).toEqual([{ total: "60.0000000" }]);
  const voidedDay = await query(`select 1 from public.v_daily_sales where sale_date = '2026-06-12'`);
  expect(voidedDay).toEqual([]);
  const all = await query(`select count(*)::int as n from public.v_daily_sales`);
  expect(all).toEqual([{ n: 2 }]);
});

it("AC-0012: the stock value view adds every lot and finished good, unrounded", async () => {
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-06-01"));
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 500, 1.8, "2026-06-01"));
  await run(produceCall(PROD_502_ID, 400, null, "2026-06-02"));
  await recordDaySales();
  expect(await stockValue()).toEqual(WORKED_STOCK);
});

it("AC-0012: a receipt whose cost is corrected values its lot, and the batch drawn from it, at the new cost", async () => {
  const drawn = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-06-01"));
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 500, 1.8, "2026-06-01"));
  await run(produceCall(PROD_502_ID, 400, null, "2026-06-02"));
  await recordDaySales();
  await run(correctCall(drawn, 1.86, 1000));
  // Raw: 600 lbs left of the corrected lot at 1.86 (1116) plus 500 at 1.80 (900). The batch restates:
  // 400 x 1.86 = 744 over 308 finished lbs is 2.4156, plus the 0.45 of fees is 2.8656; 158 x 2.8656 = 452.7648.
  expect(await stockValue()).toEqual([
    { raw_value: "2016.0000000", finished_value: "452.7648000", total_value: "2468.7648000" },
  ]);
});

it("AC-0012: a voided receipt and a reversed batch add nothing to the stock value", async () => {
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-06-01"));
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 500, 1.8, "2026-06-01"));
  await run(produceCall(PROD_502_ID, 400, null, "2026-06-02"));
  await recordDaySales();
  const extraLot = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 2.0, "2026-06-03"));
  await run(voidReceiptCall(extraLot));
  const extraBatch = await run(produceCall(PROD_502_ID, 100, null, "2026-06-04"));
  await run(reverseCall(extraBatch));
  expect(await stockValue()).toEqual(WORKED_STOCK);
});

it("AC-0015: each new view refuses anon, shows a non-operator no row, and shows an operator and service_role a row", async () => {
  await receiveAndProduce();
  await recordDaySales();
  const env = resolveStackEnv();
  const anon = createTypedClient(env.apiUrl, env.anonKey) as unknown as Loose;
  const service = createTypedClient(env.apiUrl, env.serviceRoleKey) as unknown as Loose;
  const nonOperator = (await signInNonOperator()) as unknown as Loose;
  const operator = (await signInOperator()) as unknown as Loose;
  for (const view of VIEWS) {
    const refused = await anon.from(view).select("*");
    expect(refused.error?.code, `anon ${view}`).toBe("42501");
    const none = await nonOperator.from(view).select("*");
    expect(none.error, `non-operator ${view}`).toBeNull();
    expect(none.data, `non-operator ${view}`).toEqual([]);
    for (const [role, client] of [["operator", operator], ["service_role", service]] as const) {
      const res = await client.from(view).select("*");
      expect(res.error, `${role} ${view}`).toBeNull();
      expect(res.data?.length, `${role} ${view}`).toBeGreaterThanOrEqual(1);
    }
  }
});

it("AC-0024: anon and public hold no privilege on the new views, and authenticated and service_role hold SELECT only", async () => {
  const rows = await query<{ view: string; grantee: string; privilege: string }>(
    `select c.relname as view,
            case when a.grantee = 0 then 'public' else pg_get_userbyid(a.grantee) end as grantee,
            a.privilege_type as privilege
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral aclexplode(c.relacl) a
     where n.nspname = 'public' and c.relname = any($1)
     order by 1, 2, 3`,
    [[...VIEWS]],
  );
  for (const view of VIEWS) {
    const held = (who: string) => rows.filter((r) => r.view === view && r.grantee === who).map((r) => r.privilege);
    expect(held("anon"), `anon on ${view}`).toEqual([]);
    expect(held("public"), `public on ${view}`).toEqual([]);
    expect(held("authenticated"), `authenticated on ${view}`).toEqual(["SELECT"]);
    expect(held("service_role"), `service_role on ${view}`).toEqual(["SELECT"]);
  }
  const options = await query<{ relname: string; reloptions: string[] | null }>(
    `select relname, reloptions from pg_class where relnamespace = 'public'::regnamespace and relname = any($1) order by 1`,
    [[...VIEWS]],
  );
  expect(options.map((o) => o.reloptions)).toEqual(VIEWS.map(() => ["security_invoker=true"]));
});

it("AC-0010: the stock on hand view gives a raw product its balance and a finished product its remaining lbs", async () => {
  expect(
    await query(`select count(*)::int as n from public.v_stock_on_hand where lbs_on_hand = 0`),
  ).toEqual([{ n: 2 }]);
  await receiveAndProduce();
  await recordDaySales();
  const rows = await query(
    `select code, kind, active, lbs_on_hand = (case code when 'RAW-TOM' then 600 else 158 end) as ok
     from public.v_stock_on_hand order by code`,
  );
  expect(rows).toEqual([
    { code: "502", kind: "finished", active: true, ok: true },
    { code: "RAW-TOM", kind: "raw", active: true, ok: true },
  ]);
});
