import { afterAll, beforeEach, expect, it } from "vitest";
import { ALERT_TYPES, buildFiveAlertFixture, type AlertType } from "./alert-fixtures.js";
import {
  callAsOperator,
  closePool,
  getLots,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  raceCalls,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  tableFingerprints,
  VENDOR_ID,
  voidReceiptCall,
  type OpCall,
} from "./db.js";

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

// ---- Helpers for the rest of the file ----

const op = async (call: OpCall): Promise<string> => {
  const outcome = await callAsOperator(call);
  expect(outcome.error, `${call.fn} ${JSON.stringify(call.args)}`).toBeUndefined();
  return outcome.rows?.[0]?.id === undefined ? "" : idOf(outcome);
};
const setPrice = (price: number, product = PROD_502_ID) =>
  op({ fn: "set_list_price", args: { p_product_id: product, p_price_per_lb: price } });
const setTarget = (percent: number) =>
  op({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: percent } });
const produce = (raw: number, finished: number | null, date: string) =>
  op(produceCall(PROD_502_ID, raw, finished, date));
const runWatch = async (today = TODAY) => {
  const outcome = await callAsOperator({ fn: "refresh_alerts", args: { p_today: today } });
  expect(outcome.error, "refresh_alerts").toBeUndefined();
  return outcome.rows?.[0] as { open_count: number; urgent_count: number };
};

// The margin case: the 502 fixture with a 20% target and a 2.68 list price.
async function marginCase(): Promise<void> {
  await receive(5000, 1.68, "2026-10-01");
  await setTarget(20);
  await setPrice(2.68);
}

// The cost fixture's four earlier receipts, then a fifth at `cost`.
async function costFixture(cost: string, received = "2026-10-05"): Promise<void> {
  for (const [i, earlier] of ["1.60", "1.68", "1.70", "1.64"].entries()) {
    await receive(1000, earlier, `2026-10-0${i + 1}`);
  }
  await receive(1000, cost, received);
}

interface AlertRow {
  id: string;
  type: string;
  severity: string;
  status: string;
  product_id: string;
  lot_id: string | null;
  batch_id: string | null;
  ended: boolean;
  facts: Record<string, string>;
}
// Facts come back as text, so a stored scale such as 0.0180 stays visible.
const alertRows = (where = "true", values: unknown[] = []) =>
  query<AlertRow>(
    `select a.id::text, a.type, a.severity, a.status, a.product_id::text, a.lot_id::text, a.batch_id::text,
            a.ended_at is not null as ended,
            (select jsonb_object_agg(e.key, e.value #>> '{}') from jsonb_each(a.facts) e) as facts
     from public.alerts a where ${where} order by a.created_at, a.type, a.id`,
    values,
  );

// The dismiss function arrives in a later task, so the fixture dismisses an
// alert the way that function will.
const dismissAlert = (id: string) =>
  query("update public.alerts set status = 'dismissed', closed_at = now(), updated_at = now() where id = $1", [id]);

const historyFingerprint = async () =>
  (
    await query<{ f: string }>(
      `select count(*)::text || ':' || md5(coalesce(string_agg(t::text, '|' order by seq), '')) as f
       from private.list_price_changes t`,
    )
  )[0]?.f;

// AC-0032
it("AC-0032: five earlier receipts give a usual cost of 1.50 and a band of 0.60, so 2.40 alerts and 2.39 does not", async () => {
  for (const [cost, alerts] of [["2.40", true], ["2.39", false]] as const) {
    await resetTestData();
    for (const [i, earlier] of ["1.00", "1.50", "2.00", "1.20", "1.80"].entries()) {
      await receive(1000, earlier, `2026-09-2${i}`);
    }
    await receive(1000, cost, "2026-10-05");
    await runWatch();
    const rows = await alertRows("a.type = 'cost_anomaly'");
    expect(rows.map((r) => [r.facts.usual_cost, r.facts.band, r.facts.reference_count, r.facts.unit_cost]), cost).toEqual(
      alerts ? [["1.5000", "0.6000", "5", Number(cost).toFixed(4)]] : [],
    );
  }
});

// AC-0033
it("AC-0033: only the latest 10 earlier receipts count, so fifteen earlier receipts give a usual cost of 1.65", async () => {
  const costs = [...Array<string>(5).fill("1.00"), ...Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? "1.60" : "1.70"))];
  for (const [i, cost] of costs.entries()) {
    await receive(1000, cost, `2026-09-${String(i + 1).padStart(2, "0")}`);
  }
  await receive(1000, "1.85", "2026-10-05");
  await runWatch();
  const rows = await alertRows("a.type = 'cost_anomaly'");
  expect(rows.map((r) => [r.facts.usual_cost, r.facts.reference_count, r.facts.change])).toEqual([
    ["1.6500", "10", "0.1212"],
  ]);
});

// AC-0034
it("AC-0034: fewer than 3 earlier receipts open no cost alert, after the second and third are voided", async () => {
  for (const voided of [false, true]) {
    await resetTestData();
    await costFixture("1.90");
    if (voided) {
      const lots = await getLots(RAW_TOM_ID);
      for (const lot of [lots[1], lots[2]]) expect((await callAsOperator(voidReceiptCall(lot!.id))).error).toBeUndefined();
    }
    await runWatch();
    expect((await alertRows("a.type = 'cost_anomaly'")).length, `voided ${voided}`).toBe(voided ? 0 : 1);
  }
});

// AC-0047
it("AC-0047: a receipt on the watch's today minus 13 days is recent, and one a day earlier is not", async () => {
  for (const [received, alerts] of [["2026-09-30", true], ["2026-09-29", false]] as const) {
    await resetTestData();
    for (const [i, earlier] of ["1.60", "1.68", "1.70", "1.64"].entries()) {
      await receive(1000, earlier, `2026-09-2${i + 3}`);
    }
    await receive(1000, "1.90", received);
    await runWatch();
    expect((await alertRows("a.type = 'cost_anomaly'")).length, received).toBe(alerts ? 1 : 0);
  }
});

// AC-0048
it("AC-0048: voiding the lot before the watch leaves no cost alert for it", async () => {
  for (const voided of [false, true]) {
    await resetTestData();
    await costFixture("1.90");
    if (voided) {
      const lots = await getLots(RAW_TOM_ID);
      expect((await callAsOperator(voidReceiptCall(lots[4]!.id))).error).toBeUndefined();
    }
    await runWatch();
    expect((await alertRows("a.type = 'cost_anomaly'")).length, `voided ${voided}`).toBe(voided ? 0 : 1);
  }
});

// AC-0196
it("AC-0196: earlier receipts at 0 per lb open no cost alert and the watch returns without error", async () => {
  for (const [i] of [0, 1, 2, 3].entries()) await receive(1000, 0, `2026-10-0${i + 1}`);
  await receive(1000, "1.90", "2026-10-05");
  await runWatch();
  expect(await alertRows("a.type = 'cost_anomaly'")).toEqual([]);
});

// The yield fixture: 502 with RAW-TOM's receipt, then batches of 1,000 raw lbs.
async function yieldFixture(received = "2026-10-01"): Promise<void> {
  await receive(20000, 1.68, received);
}

// AC-0035
it("AC-0035: the yield rule opens a yield alert exactly at the 0.03 band of the shrink used", async () => {
  const cases: ReadonlyArray<[number, string, boolean]> = [
    [700, "0.3000", true],
    [740, "0.2600", true],
    [745, "0.2550", false],
    [770, "0.2300", false],
  ];
  for (const [finished, shrink, alerts] of cases) {
    await resetTestData();
    await yieldFixture();
    await produce(1000, finished, "2026-10-05");
    await runWatch();
    const rows = await alertRows("a.type = 'yield_anomaly'");
    expect(
      rows.map((r) => [r.severity, r.facts.shrink, r.facts.usual_shrink, r.facts.band, r.facts.shrink_used]),
      String(finished),
    ).toEqual(alerts ? [["medium", shrink, "0.2300", "0.0300", "0.2300"]] : []);
  }
});

// AC-0036
it("AC-0036: three earlier batches of 750 lbs give a usual shrink of 0.2500, and only 790 alerts", async () => {
  for (const [finished, alerts] of [[790, true], [775, false], [770, false]] as const) {
    await resetTestData();
    await yieldFixture();
    for (const date of ["2026-10-02", "2026-10-03", "2026-10-04"]) await produce(1000, 750, date);
    const fourth = idOf(await callAsOperator(produceCall(PROD_502_ID, 1000, finished, "2026-10-05")));
    await runWatch();
    const rows = await alertRows("a.type = 'yield_anomaly' and a.batch_id = $1", [fourth]);
    expect(rows.map((r) => [r.facts.usual_shrink, r.facts.band]), String(finished)).toEqual(
      alerts ? [["0.2500", "0.0300"]] : [],
    );
  }
});

// Unmeasured earlier batches do not count as references, and fewer than 3
// measured earlier batches fall back to the shrink used. Both sit inside
// AC-0036's yield fixture.
it("AC-0036: unmeasured batches are not references, and two earlier batches are too few", async () => {
  // Three measured batches at shrink 0.30 and three unmeasured at 0.23: a 790
  // lb fourth has a usual shrink of 0.3000 from the measured three alone.
  await yieldFixture();
  for (const [i, finished] of [700, 770, 700, 770, 700, 770].entries()) await produce(1000, finished, `2026-10-0${i + 1}`);
  const fourth = idOf(await callAsOperator(produceCall(PROD_502_ID, 1000, 790, "2026-10-07")));
  await runWatch();
  expect((await alertRows("a.type = 'yield_anomaly' and a.batch_id = $1", [fourth])).map((r) => [r.facts.usual_shrink, r.facts.band])).toEqual([
    ["0.3000", "0.0300"],
  ]);

  // An unmeasured fourth at a set shrink of 0.10 is no yield alert.
  await resetTestData();
  await yieldFixture();
  for (const date of ["2026-10-02", "2026-10-03", "2026-10-04"]) await produce(1000, 750, date);
  await query("update public.products set shrink_pct = 0.10 where id = $1", [PROD_502_ID]);
  const unmeasured = await produce(1000, null, "2026-10-05");
  await runWatch();
  expect(await alertRows("a.type = 'yield_anomaly' and a.batch_id = $1", [unmeasured])).toEqual([]);

  // Two earlier batches at 750 lbs: the usual shrink stays the shrink used.
  await resetTestData();
  await yieldFixture();
  for (const date of ["2026-10-02", "2026-10-03"]) await produce(1000, 750, date);
  const third = await produce(1000, 780, "2026-10-04");
  await runWatch();
  expect(await alertRows("a.type = 'yield_anomaly' and a.batch_id = $1", [third])).toEqual([]);
});

// AC-0193
it("AC-0193: earlier batches of 800, 750, and 700 lbs give a shrink band of 0.1500, so 600 alerts and 610 does not", async () => {
  for (const [finished, alerts] of [[600, true], [610, false]] as const) {
    await resetTestData();
    await yieldFixture();
    for (const [i, earlier] of [800, 750, 700].entries()) await produce(1000, earlier, `2026-10-0${i + 2}`);
    const fourth = idOf(await callAsOperator(produceCall(PROD_502_ID, 1000, finished, "2026-10-05")));
    await runWatch();
    const rows = await alertRows("a.type = 'yield_anomaly' and a.batch_id = $1", [fourth]);
    expect(rows.map((r) => [r.facts.usual_shrink, r.facts.band]), String(finished)).toEqual(
      alerts ? [["0.2500", "0.1500"]] : [],
    );
  }
});

// AC-0194
it("AC-0194: only the latest 10 earlier batches count, so fifteen earlier batches give a usual shrink of 0.2500", async () => {
  await receive(20000, 1.68, "2026-09-01");
  const finished = [...Array<number>(5).fill(600), ...Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 760 : 740))];
  for (const [i, lbs] of finished.entries()) await produce(1000, lbs, `2026-09-${String(i + 2).padStart(2, "0")}`);
  const sixteenth = idOf(await callAsOperator(produceCall(PROD_502_ID, 1000, 785, "2026-10-05")));
  await runWatch();
  const rows = await alertRows("a.type = 'yield_anomaly' and a.batch_id = $1", [sixteenth]);
  expect(rows.map((r) => [r.facts.usual_shrink, r.facts.band])).toEqual([["0.2500", "0.0300"]]);
});

// AC-0037
it("AC-0037: a batch on the watch's today minus 13 days is recent, and one a day earlier is not", async () => {
  for (const [date, alerts] of [["2026-09-30", true], ["2026-09-29", false]] as const) {
    await resetTestData();
    await yieldFixture("2026-09-01");
    await produce(1000, 700, date);
    await runWatch();
    expect((await alertRows("a.type = 'yield_anomaly'")).length, date).toBe(alerts ? 1 : 0);
  }
});

// The stock fixture: 6,000 lbs received 2026-09-01 and three unmeasured batches.
async function stockFixture(extraLbs?: number): Promise<void> {
  await receive(6000, 1.68, "2026-09-01");
  await produce(1000, null, "2026-09-15");
  await produce(2100, null, "2026-09-16");
  await produce(2100, null, "2026-10-13");
  if (extraLbs !== undefined) await receive(extraLbs, 1.68, "2026-10-13");
}
const stockFacts = async () =>
  (await alertRows("a.type = 'low_stock'")).map((r) => [r.severity, r.product_id, r.facts] as const);

// AC-0038
it("AC-0038: the stock fixture opens one low-stock alert with its figures", async () => {
  await stockFixture();
  await runWatch();
  expect(await stockFacts()).toEqual([
    ["medium", RAW_TOM_ID, { on_hand: "800.000", daily_use: "150.000", days_left: "5.3333", order_lbs: "1300" }],
  ]);
  expect((await alertRows()).length).toBe(1);
});

// AC-0039
it("AC-0039: the stock fixture on 2026-10-14 opens no low-stock alert", async () => {
  await stockFixture();
  await runWatch("2026-10-14");
  expect(await alertRows()).toEqual([]);
});

// AC-0040
it("AC-0040: exactly 7 days left opens no low-stock alert", async () => {
  await stockFixture(250);
  await runWatch();
  expect(await alertRows()).toEqual([]);
});

// AC-0049
it("AC-0049: 1,049 lbs on hand opens a low-stock alert with 6.9933 days left", async () => {
  await stockFixture(249);
  await runWatch();
  expect(await stockFacts()).toEqual([
    ["medium", RAW_TOM_ID, { on_hand: "1049.000", daily_use: "150.000", days_left: "6.9933", order_lbs: "1051" }],
  ]);
});

// AC-0195
it("AC-0195: an order of 1,299.25 lbs rounds up to 1,300", async () => {
  await stockFixture(0.75);
  await runWatch();
  expect(await stockFacts()).toEqual([
    ["medium", RAW_TOM_ID, { on_hand: "800.750", daily_use: "150.000", days_left: "5.3383", order_lbs: "1300" }],
  ]);
});

// The price case: 502 with no target, a 2.68 list price, then a second receipt.
async function priceCase(second = "2.20"): Promise<void> {
  await receive(5000, 1.68, "2026-10-01");
  await setPrice(2.68);
  await receive(3000, second, "2026-10-02");
}

// AC-0041
it("AC-0041: the price case opens one price alert with its figures", async () => {
  await priceCase();
  await runWatch();
  const rows = await alertRows("a.type = 'price_stale'");
  expect(rows.length).toBe(1);
  const [row] = rows;
  expect(row?.severity).toBe("low");
  expect(row?.product_id).toBe(PROD_502_ID);
  const { changed_at, ...figures } = row!.facts;
  expect(figures).toEqual({
    list_price: "2.68",
    cost_then: "2.6318",
    cost_per_lb: "2.8851",
    drift: "0.0962",
    price_action: "raise",
    suggested_list_price: "2.94",
  });
  // The last change's time, as UTC ISO text, equals the history row's.
  const [change] = await query<{ at: Date }>(
    "select changed_at as at from private.list_price_changes where product_id = $1 order by seq desc limit 1",
    [PROD_502_ID],
  );
  expect(changed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
  expect(new Date(changed_at!).getTime()).toBe(change?.at.getTime());
});

// The price rule's other clauses, inside AC-0041's price case.
it("AC-0041: only the last list-price change counts, and only a product that needs a new price alerts", async () => {
  // A later change restarts the drift: 502 was repriced at the current cost.
  await receive(5000, 1.68, "2026-10-01");
  await setPrice(2.5);
  await receive(3000, "2.20", "2026-10-02");
  await setPrice(2.9);
  await runWatch();
  expect(await alertRows("a.type = 'price_stale'")).toEqual([]);

  // A cost that moved 11% but a list price that still equals the suggested
  // price (0.30 of margin fee became a processing fee) needs no new price.
  await resetTestData();
  await query(
    `insert into public.product_fees(product_id, fee_type_id, amount_per_lb)
     select $1, id, 0.30 from public.fee_types where code = 'broker'`,
    [PROD_502_ID],
  );
  await receive(5000, 1.68, "2026-10-01");
  await setPrice(2.98);
  await query(
    `update public.product_fees set amount_per_lb = 0
     where product_id = $1 and fee_type_id = (select id from public.fee_types where code = 'broker')`,
    [PROD_502_ID],
  );
  await query(
    `insert into public.product_fees(product_id, fee_type_id, amount_per_lb)
     select $1, id, 0.30 from public.fee_types where code = 'cutting'`,
    [PROD_502_ID],
  );
  const [pricing] = await query<{ cost: string; suggested: string; needs: boolean }>(
    `select cost_per_lb::text as cost, suggested_list_price::text as suggested, needs_new_price as needs
     from public.v_product_pricing where product_id = $1`,
    [PROD_502_ID],
  );
  expect(pricing).toEqual({ cost: "2.9318", suggested: "2.98", needs: false });
  await runWatch();
  expect(await alertRows("a.type = 'price_stale'")).toEqual([]);
});

// AC-0042
it("AC-0042: a second receipt at 1.80 opens no price alert", async () => {
  await priceCase("1.80");
  await runWatch();
  expect(await alertRows("a.type = 'price_stale'")).toEqual([]);
});

// AC-0078
it("AC-0078: a drift of exactly 0.0500 opens a price alert and one just under does not", async () => {
  for (const [second, alerts] of [["1.7286", true], ["1.7284", false]] as const) {
    await resetTestData();
    await receive(1000, "1.54", "2026-10-01");
    await setPrice(2.5);
    await receive(1000, second, "2026-10-02");
    await runWatch();
    const rows = await alertRows("a.type = 'price_stale'");
    expect(rows.map((r) => [r.facts.cost_then, r.facts.cost_per_lb, r.facts.drift]), second).toEqual(
      alerts ? [["2.4500", "2.5725", "0.0500"]] : [],
    );
  }
});

// AC-0043
it("AC-0043: a 20% target set after the list price opens a margin alert and no price alert", async () => {
  await receive(5000, 1.68, "2026-10-01");
  await setPrice(2.68);
  await setTarget(20);
  await receive(3000, "2.20", "2026-10-02");
  await runWatch();
  expect((await alertRows()).map((r) => [r.type, r.product_id])).toEqual([["margin_below_target", PROD_502_ID]]);
});

// AC-0044
it("AC-0044: a list price set before the first receipt records no cost, so no price alert opens", async () => {
  await setPrice(2.68);
  await receive(5000, 1.68, "2026-10-01");
  await receive(3000, "2.20", "2026-10-02");
  const [row] = await query<{ cost: string | null }>(
    "select cost_per_lb::text as cost from private.list_price_changes where product_id = $1",
    [PROD_502_ID],
  );
  expect(row?.cost).toBeNull();
  await runWatch();
  expect(await alertRows()).toEqual([]);
});

// AC-0197
it("AC-0197: a recorded cost of 0 opens no price alert and the watch returns without error", async () => {
  await query("delete from public.product_fees where product_id = $1", [PROD_502_ID]);
  await receive(5000, 0, "2026-10-01");
  await setPrice(2.68);
  const [row] = await query<{ cost: string | null }>(
    "select cost_per_lb::text as cost from private.list_price_changes where product_id = $1",
    [PROD_502_ID],
  );
  expect(row?.cost).toBe("0.0000");
  await receive(3000, "2.20", "2026-10-02");
  await runWatch();
  expect(await alertRows("a.type = 'price_stale'")).toEqual([]);
});

// AC-0045
it("AC-0045: margin and cost alerts are high, yield and low-stock medium, and price low", async () => {
  await buildFiveAlertFixture();
  const rows = await query<{ type: string; severity: string }>("select type, severity from public.alerts order by type");
  expect(rows).toEqual([
    { type: "cost_anomaly", severity: "high" },
    { type: "low_stock", severity: "medium" },
    { type: "margin_below_target", severity: "high" },
    { type: "price_stale", severity: "low" },
    { type: "yield_anomaly", severity: "medium" },
  ]);
});

const deactivate = (productId: string, active = false) =>
  query("update public.products set active = $2 where id = $1", [productId, active]);

// AC-0046
for (const type of ALERT_TYPES) {
  it(`AC-0046: an inactive product opens no ${type} alert on the first watch`, async () => {
    const fx = await buildFiveAlertFixture({ watch: false });
    await deactivate(fx.subjects[type].productId);
    await runWatch(fx.today);
    expect(await alertRows("a.type = $1", [type]), "inactive").toEqual([]);
    // The same data with the product active opens one, so the product was the cause.
    await deactivate(fx.subjects[type].productId, true);
    await runWatch(fx.today);
    expect((await alertRows("a.type = $1", [type])).length, "active again").toBe(1);
  });
}

// AC-0079
for (const type of ALERT_TYPES) {
  for (const dismissed of [false, true]) {
    it(`AC-0079: making the product inactive ends the ${type} alert${dismissed ? ", also when it was dismissed first" : ""}`, async () => {
      const fx = await buildFiveAlertFixture();
      const [alert] = await alertRows("a.type = $1", [type]);
      expect(alert?.ended).toBe(false);
      if (dismissed) await dismissAlert(alert!.id);
      await deactivate(fx.subjects[type].productId);
      await runWatch(fx.today);
      expect(await alertRows("a.type = $1", [type])).toEqual([
        { ...alert, status: dismissed ? "dismissed" : "cleared", ended: true },
      ]);
    });
  }
}

// AC-0050
it("AC-0050: a second watch over unchanged data opens no alert and changes no alerts row", async () => {
  const fx = await buildFiveAlertFixture();
  const rowsOf = () => query("select a::text as row from public.alerts a order by a.id");
  const before = await rowsOf();
  expect(before.length).toBe(5);
  expect(await runWatch(fx.today)).toEqual({ open_count: 5, urgent_count: 2 });
  expect(await rowsOf()).toEqual(before);
});

// AC-0051
it("AC-0051: no two live alerts share a type and a subject", async () => {
  await buildFiveAlertFixture();
  await runWatch();
  expect(
    await query(
      `select type from public.alerts where ended_at is null
       group by type, product_id, lot_id, batch_id having count(*) > 1`,
    ),
  ).toEqual([]);
  // The database refuses a duplicate live alert, also for a subject with no lot or batch.
  const copy = `insert into public.alerts(type, severity, product_id, lot_id, batch_id, facts)
                 select type, severity, product_id, lot_id, batch_id, facts from public.alerts where type = $1`;
  for (const type of ALERT_TYPES) {
    await expect(query(copy, [type]), type).rejects.toMatchObject({ code: "23505" });
  }
  // An ended alert does not hold the subject.
  await query("update public.alerts set status = 'cleared', closed_at = now(), ended_at = now() where type = 'low_stock'");
  await query(copy, ["low_stock"]);
});

// AC-0052
it("AC-0052: a changed list price updates the open margin alert's figures", async () => {
  await marginCase();
  await runWatch();
  const [first] = await alertRows();
  await setPrice(2.9);
  await runWatch();
  const rows = await alertRows();
  expect(rows.length).toBe(1);
  expect(rows[0]).toMatchObject({ id: first?.id, status: "open", ended: false });
  expect(rows[0]?.facts).toMatchObject({ list_price: "2.90", margin_at_list: "0.0925" });
});

// AC-0053
it("AC-0053: a list price that clears the margin marks the alert cleared with an end time", async () => {
  await marginCase();
  await runWatch();
  await setPrice(3.29);
  await runWatch();
  expect((await alertRows()).map((r) => [r.status, r.ended])).toEqual([["cleared", true]]);
});

// AC-0054
it("AC-0054: a dismissed margin alert stays live and no new one opens while the condition holds", async () => {
  await marginCase();
  await runWatch();
  const [alert] = await alertRows();
  await dismissAlert(alert!.id);
  await runWatch();
  await runWatch();
  expect((await alertRows()).map((r) => [r.id, r.status, r.ended])).toEqual([[alert!.id, "dismissed", false]]);
});

// AC-0055
it("AC-0055: a dismissed margin alert ends when its problem clears, and a new one opens when it returns", async () => {
  await marginCase();
  await runWatch();
  const [alert] = await alertRows();
  await dismissAlert(alert!.id);
  await setPrice(3.29);
  await runWatch();
  expect((await alertRows()).map((r) => [r.status, r.ended])).toEqual([["dismissed", true]]);
  await setPrice(2.68);
  await runWatch();
  const rows = await alertRows();
  expect(rows.map((r) => [r.status, r.ended])).toEqual([
    ["dismissed", true],
    ["open", false],
  ]);
  expect(rows[1]?.id).not.toBe(alert!.id);
});

// AC-0056
it("AC-0056: voiding the lot of an open cost alert marks the alert cleared", async () => {
  await costFixture("1.90");
  await runWatch();
  expect((await alertRows("a.type = 'cost_anomaly'")).map((r) => r.status)).toEqual(["open"]);
  const lots = await getLots(RAW_TOM_ID);
  expect((await callAsOperator(voidReceiptCall(lots[4]!.id))).error).toBeUndefined();
  await runWatch();
  expect((await alertRows("a.type = 'cost_anomaly'")).map((r) => [r.status, r.ended])).toEqual([["cleared", true]]);
});

// AC-0057
it("AC-0057: a watch changes no row in any table but alerts", async () => {
  const fx = await buildFiveAlertFixture({ watch: false });
  const everythingElse = async () => {
    const { alerts: _alerts, ...rest } = await tableFingerprints();
    return { ...rest, history: await historyFingerprint() };
  };
  const before = await everythingElse();
  await runWatch(fx.today);
  expect((await alertRows()).length).toBe(5);
  expect(await everythingElse()).toEqual(before);
  await runWatch(fx.today);
  expect(await everythingElse()).toEqual(before);
});

// AC-0058
it("AC-0058: two watches at the same time leave exactly one live margin alert", async () => {
  await marginCase();
  const watchCall: OpCall = { fn: "refresh_alerts", args: { p_today: TODAY } };
  const [a, b] = await raceCalls(watchCall, watchCall);
  expect(a.error).toBeUndefined();
  expect(b.error).toBeUndefined();
  expect(b.waitedOn?.some((w) => w.startsWith("advisory")), "the second watch waited on the first").toBe(true);
  expect((await alertRows("a.type = 'margin_below_target' and a.ended_at is null")).length).toBe(1);
  expect((await alertRows()).length).toBe(1);
});

// AC-0059
it("AC-0059: a watch with no today is refused and changes no table", async () => {
  await marginCase();
  const before = { ...(await tableFingerprints()), history: await historyFingerprint() };
  const outcome = await callAsOperator({ fn: "refresh_alerts", args: { p_today: null } });
  expect(outcome.ok).toBe(false);
  expect(outcome.error).toMatch(/refresh_alerts: today is required/);
  expect({ ...(await tableFingerprints()), history: await historyFingerprint() }).toEqual(before);
});
