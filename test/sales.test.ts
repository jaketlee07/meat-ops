import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { createTypedClient, type TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsClient,
  closePool,
  CUSTOMER_ID,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  saleFixture,
  VALLEY_ID,
  VENDOR_ID,
  voidSaleCall,
} from "./db.js";
import { resolveStackEnv } from "./env.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0010
it("AC-0010: the sale summary gives the 5,000-lb sale its total lbs and price", async () => {
  await query("insert into vendors(id, name) values ($1, 'Valley Poultry')", [VALLEY_ID]);
  for (const call of [
    receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"),
    receiveCall(RAW_TOM_ID, VALLEY_ID, 3000, 1.8, "2026-10-05"),
    produceCall(PROD_502_ID, 6000, null, "2026-10-06"),
    produceCall(PROD_502_ID, 1000, null, "2026-10-07"),
    {
      fn: "record_sale" as const,
      args: {
        p_finished_product_id: PROD_502_ID,
        p_lbs: 5000,
        p_price_per_lb: 3.29,
        p_customer_id: CUSTOMER_ID,
        p_sale_date: "2026-10-08",
        p_sale_number: "S-5000",
      },
    },
  ]) {
    expect((await callAsClient(operator, call)).ok).toBe(true);
  }
  const rows = await query(
    `select lbs_sold::text, price_per_lb::text, finished_code, customer
     from public.v_sale_summary where sale_number = 'S-5000'`,
  );
  expect(rows).toEqual([
    { lbs_sold: "5000.000", price_per_lb: "3.2900", finished_code: "502", customer: "Fulton Market Deli" },
  ]);
});

it("AC-0011: a void sale's summary row carries the reason and void time and keeps its totals", async () => {
  const fx = await saleFixture({ listPrice: true, sale: true });
  const voided = await callAsClient(operator, voidSaleCall(String(fx.saleId), "wrong customer"));
  expect(voided.ok).toBe(true);
  const rows = await query(
    `select lbs_sold::text, price_per_lb::text, void_reason, voided_at is not null as has_void_time
     from public.v_sale_summary where sale_number = 'S-5000'`,
  );
  expect(rows).toEqual([
    { lbs_sold: "5000.000", price_per_lb: "3.2900", void_reason: "wrong customer", has_void_time: true },
  ]);
});

it("AC-0012: the summary has exactly one row per sale", async () => {
  await saleFixture({ listPrice: true });
  const sell = (lbs: number, number: string, customer: string | null) => ({
    fn: "record_sale" as const,
    args: {
      p_finished_product_id: PROD_502_ID,
      p_lbs: lbs,
      p_price_per_lb: 3.29,
      p_customer_id: customer,
      p_sale_date: "2026-10-08",
      p_sale_number: number,
    },
  });
  expect((await callAsClient(operator, sell(100, "S-ONE", CUSTOMER_ID))).ok).toBe(true);
  expect((await callAsClient(operator, sell(5000, "S-5000", CUSTOMER_ID))).ok).toBe(true);
  expect((await callAsClient(operator, sell(50, "S-NOCUST", null))).ok).toBe(true);
  const doomed = await callAsClient(operator, sell(10, "S-VOID", CUSTOMER_ID));
  expect(doomed.ok).toBe(true);
  expect((await callAsClient(operator, voidSaleCall(idOf(doomed), "wrong customer"))).ok).toBe(true);

  const lines = await query<{ n: string }>(
    "select count(*)::text as n from public.sale_items where sale_id = (select id from public.sales where sale_number = 'S-5000')",
  );
  expect(lines[0]?.n).toBe("2");
  const [sales] = await query<{ n: string }>("select count(*)::text as n from public.sales");
  const [summary] = await query<{ n: string; d: string }>(
    "select count(*)::text as n, count(distinct sale_id)::text as d from public.v_sale_summary",
  );
  expect(sales?.n).toBe("4");
  expect(summary).toEqual({ n: sales?.n, d: sales?.n });
});

it("AC-0015: service_role reads both views after the 5,000-lb sale", async () => {
  await saleFixture({ listPrice: true, sale: true });
  const env = resolveStackEnv();
  const service = createTypedClient(env.apiUrl, env.serviceRoleKey);
  for (const view of ["v_sale_summary", "v_sale_traceability"] as const) {
    const res = await service.from(view).select("sale_number");
    expect(res.error, view).toBeNull();
    expect(res.data?.length, view).toBeGreaterThanOrEqual(1);
  }
});
