import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import {
  adjustCall,
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  correctCall,
  getLots,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  reverseCall,
  VENDOR_ID,
  type OpCall,
} from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// The Alerts rules after a receipt correction or a batch reversal. The
// fixtures are the ones test/alerts-watch.test.ts builds (copied, because
// that file keeps them private), with the watch's today passed in.
const TODAY = "2026-10-13";

const op = async (call: OpCall): Promise<string> => {
  const outcome = await callAsOperator(call);
  expect(outcome.error, `${call.fn} ${JSON.stringify(call.args)}`).toBeUndefined();
  return outcome.rows?.[0]?.id === undefined ? "" : idOf(outcome);
};
const receive = (weight: number, cost: number | string, received: string) =>
  op(receiveCall(RAW_TOM_ID, VENDOR_ID, weight, cost, received));
const produce = (raw: number, finished: number | null, date: string) =>
  op(produceCall(PROD_502_ID, raw, finished, date));
const runWatch = async () => {
  const outcome = await callAsOperator({ fn: "refresh_alerts", args: { p_today: TODAY } });
  expect(outcome.error, "refresh_alerts").toBeUndefined();
};
const alertRows = (type: string) =>
  query<{ status: string; ended: boolean; facts: Record<string, string> }>(
    `select a.status, a.ended_at is not null as ended,
            (select jsonb_object_agg(e.key, e.value #>> '{}') from jsonb_each(a.facts) e) as facts
     from public.alerts a where a.type = $1 order by a.created_at, a.id`,
    [type],
  );

// The cost fixture: four earlier receipts, then a fifth at `cost`. Returns the lots, oldest first.
async function costFixture(cost: string): Promise<string[]> {
  for (const [i, earlier] of ["1.60", "1.68", "1.70", "1.64"].entries()) {
    await receive(1000, earlier, `2026-10-0${i + 1}`);
  }
  await receive(1000, cost, "2026-10-05");
  return (await getLots(RAW_TOM_ID)).map((l) => l.id);
}

// The yield fixture: 502 with RAW-TOM's receipt.
const yieldFixture = () => receive(20000, 1.68, "2026-10-01");

// The stock fixture: 6,000 lbs received 2026-09-01 and three unmeasured batches.
async function stockFixture(): Promise<string[]> {
  await receive(6000, 1.68, "2026-09-01");
  const ids = [
    await produce(1000, null, "2026-09-15"),
    await produce(2100, null, "2026-09-16"),
    await produce(2100, null, "2026-10-13"),
  ];
  return ids;
}

// AC-0080
it("AC-0080: correcting the fifth receipt to 1.66 clears its cost alert", async () => {
  const lots = await costFixture("1.90");
  await runWatch();
  expect((await alertRows("cost_anomaly")).map((r) => [r.status, r.ended])).toEqual([["open", false]]);
  await op(correctCall(lots[4]!, "1.66", 1000));
  await runWatch();
  expect((await alertRows("cost_anomaly")).map((r) => [r.status, r.ended])).toEqual([["cleared", true]]);
});

// AC-0081
it("AC-0081: correcting the four earlier receipts to 1.90 clears the fifth's cost alert", async () => {
  const lots = await costFixture("1.90");
  await runWatch();
  expect((await alertRows("cost_anomaly")).map((r) => r.status)).toEqual(["open"]);
  for (const lot of lots.slice(0, 4)) await op(correctCall(lot, "1.90", 1000));
  await runWatch();
  expect((await alertRows("cost_anomaly")).map((r) => [r.status, r.ended])).toEqual([["cleared", true]]);
});

// AC-0082
it("AC-0082: correcting the fifth receipt from 1.66 to 1.90 opens a cost alert with its figures", async () => {
  const lots = await costFixture("1.66");
  await runWatch();
  expect(await alertRows("cost_anomaly")).toEqual([]);
  await op(correctCall(lots[4]!, "1.90", 1000));
  await runWatch();
  expect(
    (await alertRows("cost_anomaly")).map((r) => [r.status, r.facts.unit_cost, r.facts.usual_cost]),
  ).toEqual([["open", "1.9000", "1.6600"]]);
});

// AC-0083
it("AC-0083: reversing the 700-lb batch clears its yield alert", async () => {
  await yieldFixture();
  const batch = await produce(1000, 700, "2026-10-05");
  await runWatch();
  expect((await alertRows("yield_anomaly")).map((r) => r.status)).toEqual(["open"]);
  await op(reverseCall(batch));
  await runWatch();
  expect((await alertRows("yield_anomaly")).map((r) => [r.status, r.ended])).toEqual([["cleared", true]]);
});

// AC-0084
it("AC-0084: a reversed earlier batch is not a reference, so a fourth of 790 lbs opens no yield alert", async () => {
  await yieldFixture();
  const earlier: string[] = [];
  for (const date of ["2026-10-02", "2026-10-03", "2026-10-04"]) earlier.push(await produce(1000, 750, date));
  await op(reverseCall(earlier[1]!));
  await produce(1000, 790, "2026-10-05");
  await runWatch();
  expect(await alertRows("yield_anomaly")).toEqual([]);
});

// AC-0085
it("AC-0085: reversing the 2,100-lb batch and adjusting the receipt to 800 lbs clears the low-stock alert", async () => {
  const batches = await stockFixture();
  await runWatch();
  expect((await alertRows("low_stock")).map((r) => r.status)).toEqual(["open"]);
  await op(reverseCall(batches[2]!));
  const [lot] = await getLots(RAW_TOM_ID);
  await op(adjustCall(lot!.id, 800, "waste"));
  await runWatch();
  expect((await alertRows("low_stock")).map((r) => [r.status, r.ended])).toEqual([["cleared", true]]);
});
