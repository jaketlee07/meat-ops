import { afterAll, beforeEach, expect, it } from "vitest";
import { callAsOperator, closePool, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterAll(async () => {
  await closePool();
});

const setListPrice = (price: number) =>
  callAsOperator({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: price } });

// STUB: AC-0067
it("AC-0067: set_list_price records each change with the old and new price and the cost then", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).error).toBeUndefined();
  expect((await setListPrice(2.68)).error).toBeUndefined();
  expect((await setListPrice(3.29)).error).toBeUndefined();
  expect(
    await query(
      `select old_price::text, new_price::text, cost_per_lb::text, baseline, changed_at is not null as dated
       from private.list_price_changes where product_id = $1 order by seq`,
      [PROD_502_ID],
    ),
  ).toEqual([
    { old_price: null, new_price: "2.68", cost_per_lb: "2.6318", baseline: false, dated: true },
    { old_price: "2.68", new_price: "3.29", cost_per_lb: "2.6318", baseline: false, dated: true },
  ]);
});
