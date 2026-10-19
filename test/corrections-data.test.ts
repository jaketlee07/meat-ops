import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { getReversalPreview, listRecentBatches, listSalesVoidedBy } from "../src/lib/production.js";
import { getLotFigures, listBatchesMadeFrom, listRecentReceipts } from "../src/lib/receiving.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { findLots, getLotTrace, getSaleTrace } from "../src/lib/trace.js";
import {
  assertLedgerInvariants,
  callAsClient,
  closePool,
  correctCall,
  CUSTOMER_ID,
  idOf,
  PROD_502_ID,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  reverseCall,
  saleFixture,
  VENDOR_ID,
  voidSaleCall,
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

// STUB: AC-0097
it("AC-0097: the batches made from lot B come in draw order with their costs per finished lb", async () => {
  const fixture = await saleFixture({ sale: true });
  expect(await listBatchesMadeFrom(operator, fixture.lotBId)).toEqual([
    {
      batchId: fixture.batch1Id,
      batchNumber: expect.any(String),
      productCode: "502",
      productionDate: "2026-10-06",
      costPerFinishedLb: 2.6578,
      reversed: false,
    },
    {
      batchId: fixture.batch2Id,
      batchNumber: expect.any(String),
      productCode: "502",
      productionDate: "2026-10-07",
      costPerFinishedLb: 2.7877,
      reversed: false,
    },
  ]);
});

async function expectOk(call: ReturnType<typeof correctCall>): Promise<string> {
  const outcome = await callAsClient(operator, call);
  expect(outcome.error).toBeUndefined();
  expect(outcome.ok).toBe(true);
  return idOf(outcome);
}

it("AC-0118: a reversed batch is marked reversed in the list of batches made from lot B", async () => {
  const fixture = await saleFixture();
  await expectOk(reverseCall(fixture.batch2Id));
  const batches = await listBatchesMadeFrom(operator, fixture.lotBId);
  expect(batches.map((b) => [b.batchId, b.reversed])).toEqual([
    [fixture.batch1Id, false],
    [fixture.batch2Id, true],
  ]);
});

it("AC-0160: a corrected lot's cost per lb is its current cost on both trace pages", async () => {
  const fixture = await saleFixture({ sale: true });
  await expectOk(correctCall(fixture.lotAId, 1.86, 5000));
  const lot = await getLotTrace(operator, fixture.lotANumber);
  expect(lot?.lot.costPerLb).toBe(1.86);
  const sale = await getSaleTrace(operator, "S-5000");
  const batch1 = sale?.lots.find((l) => l.rawLots.some((r) => r.lotNumber === fixture.lotANumber));
  expect(batch1?.rawLots.find((r) => r.lotNumber === fixture.lotANumber)?.costPerLb).toBe(1.86);
});

it("AC-0161: a corrected lot's trace gives its current weight received", async () => {
  const fixture = await saleFixture();
  await expectOk(correctCall(fixture.lotBId, 1.8, 3100));
  const trace = await getLotTrace(operator, fixture.lotBNumber);
  expect(trace?.lot.weightLbs).toBe(3100);
  expect(trace?.lot.costPerLb).toBe(1.8);
});

it("AC-0162: the lot finder gives a corrected lot's current weight", async () => {
  const fixture = await saleFixture();
  await expectOk(correctCall(fixture.lotBId, 1.8, 3100));
  const found = await findLots(operator, "RAW-TOM");
  expect(found?.lots.map((l) => [l.lotNumber, l.weightLbs])).toEqual([
    [fixture.lotBNumber, 3100],
    [fixture.lotANumber, 5000],
  ]);
});

it("AC-0115: recent receipts give current and recorded values, the texts, and the latest reason", async () => {
  const lotId = await expectOk(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-10-01"));
  const untouched = await listRecentReceipts(operator, RAW_TOM_ID);
  expect(untouched.receipts[0]).toMatchObject({
    weightLbs: 1000,
    unitCost: 1.68,
    recordedWeightLbs: 1000,
    recordedUnitCost: 1.68,
    correctedReason: null,
    status: "untouched",
  });
  await expectOk(correctCall(lotId, 1.7, 1200, "invoice price"));
  await expectOk(correctCall(lotId, 1.7, 1300, "recount"));
  const { receipts } = await listRecentReceipts(operator, RAW_TOM_ID);
  expect(receipts[0]).toMatchObject({
    weightLbs: 1300,
    unitCost: 1.7,
    weightText: "1300.000",
    costText: "1.7000",
    recordedWeightLbs: 1000,
    recordedUnitCost: 1.68,
    remainingLbs: 1300,
    correctedReason: "recount",
    status: "untouched",
  });
});

it("AC-0115: a receipt whose only batch is reversed is untouched again", async () => {
  const fixture = await saleFixture();
  await expectOk(reverseCall(fixture.batch1Id));
  await expectOk(reverseCall(fixture.batch2Id));
  const { receipts } = await listRecentReceipts(operator, RAW_TOM_ID);
  expect(receipts.map((r) => [r.id, r.status])).toEqual([
    [fixture.lotBId, "untouched"],
    [fixture.lotAId, "untouched"],
  ]);
});

it("getLotFigures gives a lot's current figures as numbers and as text, and null for no lot", async () => {
  const fixture = await saleFixture();
  await expectOk(correctCall(fixture.lotBId, 1.9, 3000));
  expect(await getLotFigures(operator, fixture.lotBId)).toEqual({
    lotNumber: fixture.lotBNumber,
    productId: RAW_TOM_ID,
    costText: "1.9000",
    weightText: "3000.000",
    unitCost: 1.9,
    weightLbs: 3000,
    remainingLbs: 1000,
    voidedAt: null,
  });
  expect(await getLotFigures(operator, "99999999-9999-9999-9999-999999999999")).toBeNull();
});

it("listRecentBatches marks a reversed batch with its time and reason", async () => {
  const fixture = await saleFixture();
  await expectOk(reverseCall(fixture.batch2Id, "entered twice"));
  const { batches } = await listRecentBatches(operator, PROD_502_ID);
  expect(batches.map((b) => b.id)).toEqual([fixture.batch2Id, fixture.batch1Id]);
  expect(batches[0]?.reversedAt).toEqual(expect.any(String));
  expect(batches[0]?.reversalReason).toBe("entered twice");
  expect(batches[1]).toMatchObject({ reversedAt: null, reversalReason: null });
});

it("getReversalPreview lists the lots, the finished lbs, and the non-void sales on the batch", async () => {
  const fixture = await saleFixture({ sale: true });
  const preview = await getReversalPreview(operator, fixture.batch2Id);
  expect(preview).toMatchObject({
    productionDate: "2026-10-07",
    finishedLbs: 770,
    lots: [{ lotNumber: fixture.lotBNumber, lbs: 1000 }],
  });
  expect(preview.sales).toHaveLength(1);
  expect(preview.sales[0]).toMatchObject({
    saleNumber: "S-5000",
    saleDate: "2026-10-08",
    customerId: CUSTOMER_ID,
    lbsSold: 5000,
    pricePerLb: 3.29,
    voidedAt: null,
  });
  const withoutSale = await getReversalPreview(operator, await batchWithoutSale());
  expect(withoutSale.sales).toEqual([]);
});

async function batchWithoutSale(): Promise<string> {
  const outcome = await callAsClient(operator, {
    fn: "produce_batch",
    args: { p_finished_product_id: PROD_502_ID, p_raw_lbs_in: 100, p_finished_lbs_out: null, p_production_date: "2026-10-09" },
  });
  expect(outcome.ok).toBe(true);
  return idOf(outcome);
}

it("listSalesVoidedBy lists the sale a reversal voided and leaves out one voided earlier", async () => {
  const fixture = await saleFixture({ sale: true });
  const earlier = await expectOk({
    fn: "record_sale",
    args: {
      p_finished_product_id: PROD_502_ID,
      p_lbs: 100,
      p_price_per_lb: 3.29,
      p_customer_id: CUSTOMER_ID,
      p_sale_date: "2026-10-08",
      p_sale_number: "S-0100",
    },
  });
  await expectOk(voidSaleCall(earlier));
  expect(await listSalesVoidedBy(operator, fixture.batch2Id)).toEqual([]);
  expect((await getReversalPreview(operator, fixture.batch2Id)).sales.map((s) => s.saleNumber)).toEqual(["S-5000"]);
  await expectOk(reverseCall(fixture.batch2Id));
  const voided = await listSalesVoidedBy(operator, fixture.batch2Id);
  expect(voided.map((s) => s.saleNumber)).toEqual(["S-5000"]);
  expect(voided[0]?.voidedAt).not.toBeNull();
});
