import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listRecentReceipts } from "../src/lib/receiving.js";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  adjustCall,
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  idOf,
  PROD_502_ID,
  produceCall,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
  voidReceiptCall,
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

async function receive(lbs: number, date: string): Promise<string> {
  const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, 1.68, date));
  expect(outcome.ok).toBe(true);
  return idOf(outcome);
}

// Entered out of date order, so entry order and date order disagree.
const ENTRY_DAYS = [21, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// STUB: AC-0020
describe("AC-0020: recent receipts, last entered first", () => {
  it("returns the 10 most recently entered receipts, newest entry first", async () => {
    for (const day of ENTRY_DAYS) await receive(100, `2026-05-${day}`);
    const { receipts } = await listRecentReceipts(operator, RAW_TOM_ID);
    expect(receipts.map((r) => r.receivedDate)).toEqual(
      [20, 19, 18, 17, 16, 15, 14, 13, 12, 11].map((day) => `2026-05-${day}`),
    );
  });
});

// STUB: AC-0048
describe("AC-0048: receipt count", () => {
  it("counts every receipt of the product", async () => {
    for (const day of ENTRY_DAYS) await receive(100, `2026-05-${day}`);
    const { total } = await listRecentReceipts(operator, RAW_TOM_ID);
    expect(total).toBe(12);
  });
});

// STUB: AC-0021
describe("AC-0021: receipt status", () => {
  it("labels untouched, in-use, and void receipts", async () => {
    const consumed = await receive(1000, "2026-05-01");
    const adjusted = await receive(1000, "2026-05-02");
    const voided = await receive(1000, "2026-05-03");
    const untouched = await receive(1000, "2026-05-04");
    expect((await callAsOperator(produceCall(PROD_502_ID, 500))).ok).toBe(true);
    expect((await callAsOperator(adjustCall(adjusted, 900))).ok).toBe(true);
    expect((await callAsOperator(adjustCall(adjusted, 1000))).ok).toBe(true);
    expect((await callAsOperator(voidReceiptCall(voided))).ok).toBe(true);

    const { receipts } = await listRecentReceipts(operator, RAW_TOM_ID);
    const statusOf = (id: string) => receipts.find((r) => r.id === id)?.status;
    expect(statusOf(untouched)).toBe("untouched");
    expect(statusOf(consumed)).toBe("in-use");
    expect(statusOf(adjusted)).toBe("in-use");
    expect(statusOf(voided)).toBe("void");
  });
});
