import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { batchSaveFailureMessage } from "../src/lib/failures.js";
import {
  getFinishedLot,
  listActiveFinishedProducts,
  listLotsUsed,
  listRecentBatches,
} from "../src/lib/production.js";
import { getStock } from "../src/lib/receiving.js";
import { produceBatch } from "../src/lib/rpc.js";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
} from "./db.js";
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

// STUB: AC-0008
it("AC-0008: the active finished products carry their raw input and shrink", async () => {
  const products = await listActiveFinishedProducts(operator);
  expect(products.find((product) => product.code === "502")).toMatchObject({
    shrinkPct: 0.23,
    raw: { id: RAW_TOM_ID, code: "RAW-TOM" },
  });
});

async function receive(lbs: number, cost: number, date: string): Promise<void> {
  const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, cost, date));
  expect(outcome.ok).toBe(true);
}

it("lists no inactive finished product and no raw product", async () => {
  await query(
    `insert into products(code, description, species, kind, raw_product_id, shrink_pct, active)
     values ('503', 'Retired', 'Turkey', 'finished', $1, 0.1, false)`,
    [RAW_TOM_ID],
  );
  const codes = (await listActiveFinishedProducts(operator)).map((product) => product.code);
  expect(codes).toEqual(["502"]);
});

it("AC-0023, AC-0024: lots used come in draw order with their fields", async () => {
  await receive(1000, 1.8, "2026-10-05");
  await receive(1000, 1.68, "2026-10-01");
  const batch = await callAsOperator(produceCall(PROD_502_ID, 1500, null, "2026-10-06"));
  expect(batch.ok).toBe(true);
  const lots = await listLotsUsed(operator, idOf(batch));
  expect(lots.map((lot) => lot.receivedDate)).toEqual(["2026-10-01", "2026-10-05"]);
  expect(lots[0]).toMatchObject({ vendorName: "Reyes Meats", lbsDrawn: 1000, costPerLb: 1.68 });
  expect(lots[1]).toMatchObject({ lbsDrawn: 500, costPerLb: 1.8 });
  expect(lots[0]?.lotNumber).toEqual(expect.any(String));
});

it("AC-0024: two lots received on the same day are listed in entry order", async () => {
  await receive(1000, 1.8, "2026-10-05");
  await receive(1000, 1.68, "2026-10-05");
  const batch = await callAsOperator(produceCall(PROD_502_ID, 1500, null, "2026-10-06"));
  expect(batch.ok).toBe(true);
  const lots = await listLotsUsed(operator, idOf(batch));
  expect(lots.map((lot) => [lot.lbsDrawn, lot.costPerLb])).toEqual([
    [1000, 1.8],
    [500, 1.68],
  ]);
});

it("AC-0025: the finished lot of the AC-0020 batch", async () => {
  await receive(5000, 1.68, "2026-10-01");
  await receive(3000, 1.8, "2026-10-05");
  const batch = await callAsOperator(produceCall(PROD_502_ID, 2000, null, "2026-10-06"));
  expect(batch.ok).toBe(true);
  expect(await getFinishedLot(operator, idOf(batch))).toEqual({
    lbsProduced: 1540,
    costPerLb: 2.6318,
  });
});

it("AC-0038, AC-0040, AC-0076: the 10 last-entered of 12 batches, newest entry first", async () => {
  await receive(5000, 1.68, "2026-09-01");
  const dates = ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "05"];
  for (const day of dates) {
    expect((await callAsOperator(produceCall(PROD_502_ID, 100, null, `2026-09-${day}`))).ok).toBe(
      true,
    );
  }
  const { batches, total } = await listRecentBatches(operator, PROD_502_ID);
  expect(total).toBe(12);
  expect(batches.map((batch) => batch.productionDate)).toEqual(
    ["05", "20", "19", "18", "17", "16", "15", "14", "13", "12"].map((day) => `2026-09-${day}`),
  );
  expect(batches[0]).toMatchObject({ rawLbsIn: 100, finishedLbsOut: 77 });
});

it("AC-0047: a raw input with no inventory row has no balance", async () => {
  expect((await getStock(operator, RAW_TOM_ID)).balance).toBeNull();
});

it("AC-0030: a real shortfall refusal gives the shortfall text", async () => {
  await receive(5000, 1.68, "2026-10-01");
  await receive(3000, 1.8, "2026-10-05");
  const error = await produceBatch(operator, {
    finishedProductId: PROD_502_ID,
    rawLbsIn: 6000,
    productionDate: "2026-10-03",
  }).then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).not.toBeNull();
  expect(batchSaveFailureMessage(error, "write")).toBe(
    "The batch wasn't saved. Only 5,000 lbs of raw on hand was received on or before Oct 3, 2026, and this batch needs 6,000 lbs.",
  );
});
