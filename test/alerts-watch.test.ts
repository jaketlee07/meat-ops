import { afterAll, beforeEach, expect, it } from "vitest";
import { callAsOperator, closePool, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterAll(async () => {
  await closePool();
});

const TODAY = "2026-10-13";
const watch = () => callAsOperator({ fn: "refresh_alerts", args: { p_today: TODAY } });
const receive = async (weight: number, cost: number | string, received: string) =>
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, weight, cost, received))).error).toBeUndefined();

// STUB: AC-0030
it("AC-0030: a watch in the margin case opens one urgent margin alert with its figures", async () => {
  await receive(5000, 1.68, "2026-10-01");
  expect(
    (await callAsOperator({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: 20 } })).error,
  ).toBeUndefined();
  expect(
    (await callAsOperator({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: 2.68 } })).error,
  ).toBeUndefined();
  expect((await watch()).error).toBeUndefined();
  expect(
    await query(
      `select type, severity, status, product_id::text, facts->>'list_price' as list_price,
              facts->>'margin_at_list' as margin_at_list, facts->>'target_margin' as target_margin,
              facts->>'cost_per_lb' as cost_per_lb, facts->>'suggested_list_price' as suggested_list_price
       from public.alerts`,
    ),
  ).toEqual([
    {
      type: "margin_below_target",
      severity: "high",
      status: "open",
      product_id: PROD_502_ID,
      list_price: "2.68",
      margin_at_list: "0.0180",
      target_margin: "0.2000",
      cost_per_lb: "2.6318",
      suggested_list_price: "3.29",
    },
  ]);
});

// STUB: AC-0031
it("AC-0031: the cost rule opens a cost alert exactly at its band", async () => {
  const cases: ReadonlyArray<[string, string | null]> = [
    ["1.90", "0.1446"],
    ["1.826", "0.1000"],
    ["1.8259", null],
    ["1.80", null],
    ["1.49", "-0.1024"],
  ];
  for (const [cost, change] of cases) {
    await resetTestData();
    for (const [i, earlier] of ["1.60", "1.68", "1.70", "1.64"].entries()) {
      await receive(1000, earlier, `2026-10-0${i + 1}`);
    }
    await receive(1000, cost, "2026-10-05");
    expect((await watch()).error).toBeUndefined();
    const rows = await query(
      `select a.severity, a.facts->>'change' as change, a.facts->>'usual_cost' as usual_cost,
              a.facts->>'reference_count' as reference_count, l.unit_cost::text as unit_cost
       from public.alerts a join public.lots l on l.id = a.lot_id
       where a.type = 'cost_anomaly'`,
    );
    expect(rows, cost).toEqual(
      change === null
        ? []
        : [{ severity: "high", change, usual_cost: "1.6600", reference_count: "4", unit_cost: Number(cost).toFixed(4) }],
    );
  }
});
