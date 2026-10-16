import { afterAll, beforeEach, expect, it } from "vitest";
import { callAsOperator, closePool, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0060
it("AC-0060: apply_alert_price sets the list price and marks the alert actioned", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).error).toBeUndefined();
  expect(
    (await callAsOperator({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: 20 } })).error,
  ).toBeUndefined();
  expect(
    (await callAsOperator({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: 2.68 } })).error,
  ).toBeUndefined();
  expect((await callAsOperator({ fn: "refresh_alerts", args: { p_today: "2026-10-13" } })).error).toBeUndefined();
  const [alert] = await query<{ id: string }>("select id::text as id from public.alerts where type = 'margin_below_target'");
  expect(alert).toBeDefined();
  const applied = await callAsOperator({
    fn: "apply_alert_price",
    args: { p_alert_id: alert?.id ?? null, p_price_per_lb: 3.29 },
  });
  expect(applied.error).toBeUndefined();
  expect(await query("select list_price_per_lb::text as price from public.products where id = $1", [PROD_502_ID])).toEqual([
    { price: "3.29" },
  ]);
  expect(
    await query("select status, ended_at is not null as ended from public.alerts where id = $1", [alert?.id]),
  ).toEqual([{ status: "actioned", ended: true }]);
});
