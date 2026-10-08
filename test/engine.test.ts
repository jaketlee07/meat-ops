import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  produceBatch,
  receiveLot,
  recordSale,
  voidSale,
  type ProduceBatchInput,
  type ProductionBatch,
  type RecordSaleInput,
  type Sale,
} from "../src/lib/rpc.js";
import { signInOperator } from "./users.js";
import {
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  assertAverageIsStockOnHand,
  assertBatchConsumed,
  assertLedgerInvariants,
  assertRequestedTotals,
  assertSaleLines,
  callAsClient,
  closePool,
  expectRefused,
  getInventoryBalance,
  getLots,
  idOf,
  inOperatorTransaction,
  produceCall,
  query,
  raceCalls,
  receiveCall,
  resetTestData,
  saleCall,
  type Arg,
  type CallOutcome,
  type OpCall,
} from "./db.js";

// The suite signs in as the operator with the anon key, the same path as the
// app, and sends every call and refusal through that client. Only NaN (JSON
// cannot carry it), one-transaction ordering cases, and two-session races go
// through the pg helpers in test/db.ts, which call the same operations as the
// operator. After every successful produce_batch and record_sale the suite
// checks AC-0017: the batch drew exactly its raw lbs in, and the sale lines add
// up to exactly the lbs requested.
let client: TypedClient;

beforeAll(async () => {
  client = await signInOperator();
});

beforeEach(async () => {
  await resetTestData();
});

afterEach(async () => {
  await assertLedgerInvariants();
  await assertAverageIsStockOnHand();
});

afterAll(async () => {
  await closePool();
});

const VENDOR_2_ID = "55555555-5555-5555-5555-555555555555";
const PROD_503_ID = "66666666-6666-6666-6666-666666666666";
const UNKNOWN_ID = "99999999-9999-9999-9999-999999999999";

// A successful call through the client; AC-0017 is checked on the result.
async function expectOk(call: OpCall): Promise<CallOutcome> {
  const outcome = await callAsClient(client, call);
  expect(outcome.error).toBeUndefined();
  expect(outcome.ok).toBe(true);
  await assertRequestedTotals(call, outcome);
  return outcome;
}

const refused = (call: OpCall, keyword: RegExp): Promise<void> => expectRefused(client, call, keyword);

async function produce(input: ProduceBatchInput): Promise<ProductionBatch> {
  const batch = await produceBatch(client, input);
  await assertBatchConsumed(batch.id, input.rawLbsIn);
  return batch;
}

async function sell(input: RecordSaleInput): Promise<Sale> {
  const sale = await recordSale(client, input);
  await assertSaleLines(sale.id, input.lbs);
  return sale;
}

// Two overlapping sessions; AC-0017 is checked on whichever calls succeeded.
async function race(first: OpCall, second: OpCall): Promise<[CallOutcome, CallOutcome]> {
  const outcomes = await raceCalls(first, second);
  await assertRequestedTotals(first, outcomes[0]);
  await assertRequestedTotals(second, outcomes[1]);
  return outcomes;
}

async function addSecondFinishedProduct(): Promise<void> {
  await query(
    `insert into products(id, code, description, species, kind, raw_product_id, shrink_pct)
     values ($1, '503', 'Smoked Turkey Drums Tom, second pack', 'Turkey', 'finished', $2, 0.2300)`,
    [PROD_503_ID, RAW_TOM_ID],
  );
}

async function setActive(productId: string, active: boolean): Promise<void> {
  await query("update products set active = $2 where id = $1", [productId, active]);
}

async function receiveStock(weight: number, cost = 1.68, received = "2026-05-12"): Promise<void> {
  await receiveLot(client, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: weight,
    unitCost: cost,
    received,
  });
}

describe("Engine hardening", () => {
  // STUB: AC-0028
  it("AC-0028: the average after production is the stock-on-hand average", async () => {
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 3000,
      unitCost: 1.8,
      received: "2026-05-19",
    });
    await produce({
      finishedProductId: PROD_502_ID,
      rawLbsIn: 5000,
      productionDate: "2026-05-20",
    });

    const balance = await getInventoryBalance(RAW_TOM_ID);
    expect(balance?.moving_avg_cost).toBe(1.8);
  });

  it("AC-0029: zero stock after production keeps the previous average", async () => {
    await receiveStock(1000, 2.0);
    await produce({
      finishedProductId: PROD_502_ID,
      rawLbsIn: 1000,
      productionDate: "2026-05-20",
    });
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 2 });

    await receiveStock(1000, 2.4, "2026-05-21");
    await produce({
      finishedProductId: PROD_502_ID,
      rawLbsIn: 1000,
      productionDate: "2026-05-22",
    });
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 2.4 });
  });

  describe("AC-0012: frozen lot columns", () => {
    it("refuses an UPDATE of each frozen column through a plain pg session", async () => {
      await query("insert into vendors(id, name) values ($1, 'Second Vendor')", [VENDOR_2_ID]);
      const lot = await receiveLot(client, {
        productId: RAW_TOM_ID,
        vendorId: VENDOR_ID,
        weightLbs: 1000,
        unitCost: 1.68,
        received: "2026-05-12",
      });
      const snapshot = async () =>
        (await query("select to_jsonb(l) as row from lots l where id = $1", [lot.id]))[0];
      const before = await snapshot();

      const frozen: [string, unknown][] = [
        ["unit_cost", 9],
        ["weight_lbs", 9000],
        ["product_id", PROD_502_ID],
        ["vendor_id", VENDOR_2_ID],
        ["received_date", "2026-01-01"],
        ["lot_number", "L-CHANGED"],
        ["prior_avg_cost", 7],
      ];
      for (const [column, value] of frozen) {
        await expect(
          query(`update lots set ${column} = $1 where id = $2`, [value, lot.id]),
          column,
        ).rejects.toThrow(/not allowed/);
        expect(await snapshot(), column).toEqual(before);
      }
    });
  });

  describe("AC-0013, AC-0014, AC-0015: concurrent calls", () => {
    it("AC-0013: two batches that fit alone but not together: one wins, one shortfall", async () => {
      await addSecondFinishedProduct();
      await receiveStock(1000);

      const [a, b] = await race(produceCall(PROD_502_ID, 800), produceCall(PROD_503_ID, 800));

      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
      expect([a, b].find((o) => !o.ok)?.error).toMatch(/shortfall/);
      expect((await getInventoryBalance(RAW_TOM_ID))?.qty_on_hand).toBe(200);
    });

    it("AC-0014: two sales that fit alone but not together: one wins, one shortfall", async () => {
      await receiveStock(1000);
      await produce({
        finishedProductId: PROD_502_ID,
        rawLbsIn: 200,
        finishedLbsOut: 100,
        productionDate: "2026-05-20",
      });

      const [a, b] = await race(
        saleCall(PROD_502_ID, 80, 2.68),
        saleCall(PROD_502_ID, 80, 2.68),
      );

      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
      expect([a, b].find((o) => !o.ok)?.error).toMatch(/shortfall/);
      const [fg] = await query("select lbs_remaining::float8 as left from finished_goods");
      expect(fg?.left).toBe(20);
      // The second sale queued on the finished product's products-row lock, taken
      // before any finished lot is read. Without that lock it would wait on a
      // finished_goods row instead.
      expect(b.waitedOn).toContain("tuple:products");
    });

    const rawPairs: [string, (c: number) => OpCall, (c: number) => OpCall][] = [
      ["receive_lot + receive_lot", (c) => receiveCall(RAW_TOM_ID, VENDOR_ID, 500, 1.7 + c / 100, "2026-05-13"), (c) => receiveCall(RAW_TOM_ID, VENDOR_ID, 600, 1.9 + c / 100, "2026-05-14")],
      ["receive_lot + produce_batch", (c) => receiveCall(RAW_TOM_ID, VENDOR_ID, 500, 1.7 + c / 100, "2026-05-13"), () => produceCall(PROD_502_ID, 800)],
      ["produce_batch + produce_batch", () => produceCall(PROD_502_ID, 700), () => produceCall(PROD_502_ID, 800)],
    ];
    it.each(rawPairs)("AC-0015: %s on one raw product keeps the invariants", async (_name, first, second) => {
      await receiveStock(2000);
      const [a, b] = await race(first(1), second(2));
      expect(a.error).toBeUndefined();
      expect(b.error).toBeUndefined();
      await assertLedgerInvariants();
      await assertAverageIsStockOnHand();
    });

    const finishedPairs: [string, OpCall, OpCall][] = [
      ["produce_batch + produce_batch", produceCall(PROD_502_ID, 500), produceCall(PROD_502_ID, 400)],
      ["produce_batch + record_sale", produceCall(PROD_502_ID, 500), saleCall(PROD_502_ID, 300, 2.68)],
      ["record_sale + record_sale", saleCall(PROD_502_ID, 300, 2.68), saleCall(PROD_502_ID, 400, 2.7)],
    ];
    it.each(finishedPairs)("AC-0015: %s on one finished product keeps the invariants", async (_name, first, second) => {
      await receiveStock(3000);
      await produce({
        finishedProductId: PROD_502_ID,
        rawLbsIn: 1300,
        finishedLbsOut: 1000,
        productionDate: "2026-05-19",
      });
      const [a, b] = await race(first, second);
      expect(a.error).toBeUndefined();
      expect(b.error).toBeUndefined();
      await assertLedgerInvariants();
      await assertAverageIsStockOnHand();
    });
  });

  it("AC-0017: consumed lbs and sale lines add up to exactly what was asked", async () => {
    await receiveStock(600, 1.68, "2026-05-12");
    await receiveStock(600, 1.8, "2026-05-19");

    const batchA = await produce({
      finishedProductId: PROD_502_ID,
      rawLbsIn: 1000,
      productionDate: "2026-05-20",
    });
    const [consumedA] = await query(
      "select sum(lbs_consumed)::float8 as total, count(*)::int as n from production_batch_lots where batch_id = $1",
      [batchA.id],
    );
    expect(consumedA).toEqual({ total: 1000, n: 2 });

    const batchB = await produce({
      finishedProductId: PROD_502_ID,
      rawLbsIn: 200,
      productionDate: "2026-05-20",
    });
    const [consumedB] = await query(
      "select sum(lbs_consumed)::float8 as total from production_batch_lots where batch_id = $1",
      [batchB.id],
    );
    expect(consumedB?.total).toBe(200);

    // 770 + 154 finished lbs; a 800 lb sale spans both finished lots.
    const sale = await sell({
      finishedProductId: PROD_502_ID,
      lbs: 800,
      pricePerLb: 2.68,
      saleDate: "2026-05-21",
    });
    const [lines] = await query(
      "select sum(lbs_sold)::float8 as total, count(*)::int as n from sale_items where sale_id = $1",
      [sale.id],
    );
    expect(lines).toEqual({ total: 800, n: 2 });
  });

  describe("AC-0018, AC-0019, AC-0020, AC-0021: argument validation", () => {
    const badQuantities: Arg[] = [null, "NaN", 0, -1];

    it("AC-0018: receive_lot weight", async () => {
      for (const weight of badQuantities) {
        await refused(receiveCall(RAW_TOM_ID, VENDOR_ID, weight, 1.68), /invalid/);
      }
      await expectOk(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68));
    });

    it("AC-0018: produce_batch raw lbs in", async () => {
      await receiveStock(2000);
      for (const lbs of badQuantities) {
        await refused(produceCall(PROD_502_ID, lbs), /invalid/);
      }
      await expectOk(produceCall(PROD_502_ID, 1000));
    });

    it("AC-0018: record_sale lbs", async () => {
      await receiveStock(2000);
      await expectOk(produceCall(PROD_502_ID, 1000));
      for (const lbs of badQuantities) {
        await refused(saleCall(PROD_502_ID, lbs, 2.68), /invalid/);
      }
      await expectOk(saleCall(PROD_502_ID, 100, 2.68));
    });

    it("AC-0019: receive_lot unit cost accepts 0 and refuses NULL, NaN, negative", async () => {
      for (const cost of [null, "NaN", -1] as Arg[]) {
        await refused(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, cost), /invalid/);
      }
      await expectOk(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 0));
    });

    it("AC-0019: record_sale price accepts 0 and refuses NULL, NaN, negative", async () => {
      await receiveStock(2000);
      await expectOk(produceCall(PROD_502_ID, 1000));
      for (const price of [null, "NaN", -1] as Arg[]) {
        await refused(saleCall(PROD_502_ID, 100, price), /invalid/);
      }
      await expectOk(saleCall(PROD_502_ID, 100, 0));
    });

    it("AC-0020: a NULL measured yield records raw lbs x (1 - shrink), rounded to 3 decimals", async () => {
      await receiveStock(2000);
      const batch = await produce({
        finishedProductId: PROD_502_ID,
        rawLbsIn: 1000.001,
        productionDate: "2026-05-20",
      });
      // 1000.001 x 0.77 = 770.00077, which rounds to 770.001.
      expect(Number(batch.finished_lbs_out)).toBe(770.001);
    });

    it("AC-0021: a measured yield above 0 and at most raw lbs in is recorded; others are refused", async () => {
      await receiveStock(5000);
      for (const measured of ["NaN", 0, -1, 2000.001] as Arg[]) {
        await refused(produceCall(PROD_502_ID, 2000, measured), /invalid/);
      }
      const partial = await expectOk(produceCall(PROD_502_ID, 2000, 1500));
      expect(Number(partial.rows?.[0]?.finished_lbs_out)).toBe(1500);
      const boundary = await expectOk(produceCall(PROD_502_ID, 2000, 2000));
      expect(Number(boundary.rows?.[0]?.finished_lbs_out)).toBe(2000);
    });
  });

  describe("AC-0022, AC-0023, AC-0024, AC-0025: vendor, active, and kind checks", () => {
    it("AC-0022: receive_lot refuses a NULL or unknown vendor", async () => {
      await refused(receiveCall(RAW_TOM_ID, null, 1000, 1.68), /invalid/);
      await refused(receiveCall(RAW_TOM_ID, UNKNOWN_ID, 1000, 1.68), /invalid/);
    });

    it("AC-0023: receive_lot refuses an inactive raw product", async () => {
      await setActive(RAW_TOM_ID, false);
      await refused(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68), /inactive/);
    });

    it("AC-0023: produce_batch refuses an inactive finished product", async () => {
      await receiveStock(2000);
      await setActive(PROD_502_ID, false);
      await refused(produceCall(PROD_502_ID, 500), /inactive/);
    });

    it("AC-0023: record_sale refuses an inactive finished product", async () => {
      await receiveStock(2000);
      await expectOk(produceCall(PROD_502_ID, 1000));
      await setActive(PROD_502_ID, false);
      await refused(saleCall(PROD_502_ID, 100, 2.68), /inactive/);
    });

    it("AC-0024: produce_batch refuses a finished product whose raw input is inactive", async () => {
      await receiveStock(2000);
      await setActive(RAW_TOM_ID, false);
      await refused(produceCall(PROD_502_ID, 500), /inactive/);
    });

    it("AC-0025: each operation refuses a product of the wrong kind", async () => {
      await receiveStock(2000);
      await expectOk(produceCall(PROD_502_ID, 1000));
      await refused(receiveCall(PROD_502_ID, VENDOR_ID, 1000, 1.68), /invalid/);
      await refused(produceCall(RAW_TOM_ID, 500), /invalid/);
      await refused(saleCall(RAW_TOM_ID, 100, 2.68), /invalid/);
    });
  });

  it("AC-0026: batches and sales only use stock dated on or before them", async () => {
    await receiveStock(1000, 1.68, "2026-05-12");
    await receiveStock(1000, 1.8, "2026-05-19");

    await expect(
      produceBatch(client, { finishedProductId: PROD_502_ID, rawLbsIn: 1500, productionDate: "2026-05-15" }),
    ).rejects.toThrow(/shortfall/);
    expect((await getLots(RAW_TOM_ID)).map((l) => l.remaining_lbs)).toEqual([1000, 1000]);

    await produce({
      finishedProductId: PROD_502_ID,
      rawLbsIn: 1000,
      productionDate: "2026-05-15",
    });
    expect((await getLots(RAW_TOM_ID)).map((l) => l.remaining_lbs)).toEqual([0, 1000]);

    await expect(
      recordSale(client, { finishedProductId: PROD_502_ID, lbs: 100, pricePerLb: 2.68, saleDate: "2026-05-14" }),
    ).rejects.toThrow(/shortfall/);
    await sell({
      finishedProductId: PROD_502_ID,
      lbs: 100,
      pricePerLb: 2.68,
      saleDate: "2026-05-15",
    });
  });

  describe("AC-0027: insertion order within a date", () => {
    it.each([1, 2, 3, 4, 5])("run %i: same-date lots and batches are used first-in first-out", async () => {
      // Two same-date lots received in one transaction, with different costs.
      const [firstLot, secondLot] = await inOperatorTransaction(async (call) => [
        await call(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68)),
        await call(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 2.0)),
      ]);
      const firstLotId = idOf(firstLot!);
      const secondLotId = idOf(secondLot!);

      // Two same-date batches produced in one transaction; each makes 77 finished lbs.
      const firstProduce = produceCall(PROD_502_ID, 100, null, "2026-05-20");
      const secondProduce = produceCall(PROD_502_ID, 100, null, "2026-05-20");
      const [firstBatch, secondBatch] = await inOperatorTransaction(async (call) => [
        await call(firstProduce),
        await call(secondProduce),
      ]);
      expect(firstBatch?.ok && secondBatch?.ok).toBe(true);
      await assertRequestedTotals(firstProduce, firstBatch!);
      await assertRequestedTotals(secondProduce, secondBatch!);

      // 200 raw lbs came from the first-received lot only.
      const consumed = await query(
        "select lot_id from production_batch_lots where batch_id in ($1, $2)",
        [idOf(firstBatch!), idOf(secondBatch!)],
      );
      expect(consumed.map((r) => r.lot_id)).toEqual([firstLotId, firstLotId]);
      const lots = await getLots(RAW_TOM_ID);
      expect(lots.find((l) => l.id === firstLotId)?.remaining_lbs).toBe(800);
      expect(lots.find((l) => l.id === secondLotId)?.remaining_lbs).toBe(1000);

      // The batches updated the first lot, so the raw lots now sit in storage as
      // second, first. Without receipt_seq the draw would follow that order.
      const rawStorage = await query("select id from lots order by ctid");
      expect(rawStorage.map((r) => r.id)).toEqual([secondLotId, firstLotId]);

      // Move the first finished lot's row the same way: a small sale from it, then
      // its void, leave the finished lots stored as second, first.
      const firstFinishedId = String(
        (await query("select id from finished_goods where batch_id = $1", [idOf(firstBatch!)]))[0]?.id,
      );
      const secondFinishedId = String(
        (await query("select id from finished_goods where batch_id = $1", [idOf(secondBatch!)]))[0]?.id,
      );
      const small = await expectOk(saleCall(PROD_502_ID, 10, 2.68));
      await voidSale(client, idOf(small), "move the first finished lot's row");
      const finishedStorage = await query("select id from finished_goods order by ctid");
      expect(finishedStorage.map((r) => r.id)).toEqual([secondFinishedId, firstFinishedId]);

      // A sale smaller than the first batch draws only from the first-produced
      // finished lot, although that lot is stored second.
      const sale = await expectOk(saleCall(PROD_502_ID, 50, 2.68));
      const lines = await query("select finished_goods_id from sale_items where sale_id = $1", [
        idOf(sale),
      ]);
      expect(lines.map((r) => r.finished_goods_id)).toEqual([firstFinishedId]);
    });
  });
});
