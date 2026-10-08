import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  adjustLot,
  produceBatch,
  receiveLot,
  recordSale,
  voidReceipt,
  voidSale,
  type Lot,
} from "../src/lib/rpc.js";
import { getTrace, getTraceByLot } from "../src/lib/views.js";
import { signInOperator } from "./users.js";
import {
  CUSTOMER_ID,
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  assertAverageIsStockOnHand,
  adjustCall,
  assertLedgerInvariants,
  closePool,
  expectRefused,
  getInventoryBalance,
  produceCall as produceOp,
  query,
  raceCalls,
  receiveCall as receiveOp,
  resetTestData,
  saleCall as saleOp,
  voidReceiptCall,
  voidSaleCall,
  type Arg,
  type CallOutcome,
  type OpCall,
} from "./db.js";

// The suite signs in as the operator with the anon key, the same path as the
// app, and sends every call and refusal through that client. Only NaN (JSON
// cannot carry it) and two-session races go through the pg helpers in
// test/db.ts, which call the same operations as the operator.
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

// The shared call definitions in test/db.ts, fixed to the raw product, vendor,
// and finished product this suite uses.
const receiveCall = (weight: Arg, cost: Arg, received: string): OpCall =>
  receiveOp(RAW_TOM_ID, VENDOR_ID, weight, cost, received);
const produceCall = (rawLbs: Arg, date = "2026-05-20"): OpCall =>
  produceOp(PROD_502_ID, rawLbs, null, date);
const saleCall = (lbs: Arg, date = "2026-05-21"): OpCall => saleOp(PROD_502_ID, lbs, 2.68, date);

async function receive(weight: number, cost: number, received = "2026-05-12"): Promise<Lot> {
  return receiveLot(client, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: weight,
    unitCost: cost,
    received,
  });
}

async function produce(rawLbs: number, productionDate = "2026-05-20"): Promise<void> {
  await produceBatch(client, { finishedProductId: PROD_502_ID, rawLbsIn: rawLbs, productionDate });
}

interface LotState {
  remaining_lbs: number;
  weight_lbs: number;
  unit_cost: number;
  voided: boolean;
  void_reason: string | null;
}

async function lotState(lotId: string): Promise<LotState> {
  const [row] = await query(
    `select remaining_lbs::float8 as remaining_lbs, weight_lbs::float8 as weight_lbs,
            unit_cost::float8 as unit_cost, voided_at is not null as voided, void_reason
     from lots where id = $1`,
    [lotId],
  );
  return row as unknown as LotState;
}

// A refusal carries the keyword and leaves every table unchanged.
const refused = (call: OpCall, keyword: RegExp): Promise<void> => expectRefused(client, call, keyword);

const BAD_REASONS: [string, string | null][] = [
  ["NULL", null],
  ["the empty string", ""],
  ["only spaces", "   "],
];

describe("void_receipt", () => {
  it("AC-0034: voids an untouched lot and takes its weight out of stock", async () => {
    await receive(1000, 1.68, "2026-05-12");
    const second = await receive(500, 1.8, "2026-05-13");
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 1500, moving_avg_cost: 1.72 });

    const voided = await voidReceipt(client, second.id, "entered twice");
    expect(voided.voided_at).not.toBeNull();
    expect(voided.void_reason).toBe("entered twice");

    expect(await lotState(second.id)).toEqual({
      remaining_lbs: 0,
      weight_lbs: 500,
      unit_cost: 1.8,
      voided: true,
      void_reason: "entered twice",
    });
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 1000, moving_avg_cost: 1.68 });
  });

  describe("AC-0035: refusals change nothing", () => {
    it("a partly consumed lot", async () => {
      const lot = await receive(1000, 1.68);
      await produce(100);
      await refused(voidReceiptCall(lot.id), /invalid/);
    });

    it("a lot adjusted back to its full weight", async () => {
      const lot = await receive(1000, 1.68);
      await adjustLot(client, { lotId: lot.id, newRemainingLbs: 600, reason: "count" });
      await adjustLot(client, { lotId: lot.id, newRemainingLbs: 1000, reason: "count" });
      expect((await lotState(lot.id)).remaining_lbs).toBe(1000);
      await refused(voidReceiptCall(lot.id), /invalid/);
    });

    it("a lot that is already void", async () => {
      await receive(1000, 1.68);
      const lot = await receive(500, 1.8, "2026-05-13");
      await voidReceipt(client, lot.id, "entered twice");
      await refused(voidReceiptCall(lot.id), /already void/);
    });

    it("an unknown lot", async () => {
      await refused(voidReceiptCall("99999999-9999-9999-9999-999999999999"), /invalid/);
    });

    it.each(BAD_REASONS)("a reason that is %s", async (_name, reason) => {
      const lot = await receive(1000, 1.68);
      await refused(voidReceiptCall(lot.id, reason), /invalid/);
    });
  });

  describe("AC-0053: voiding to zero stock restores the prior average", () => {
    // 0 lbs on hand at an average of 1.8000: receive and produce the same lot.
    async function startAtZeroStock(): Promise<void> {
      await receive(1000, 1.8, "2026-05-10");
      await produce(1000, "2026-05-11");
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
    }

    it("a single void returns the average to 1.8000", async () => {
      await startAtZeroStock();
      const lot = await receive(1000, 18, "2026-05-12");
      expect((await getInventoryBalance(RAW_TOM_ID))?.moving_avg_cost).toBe(18);
      await voidReceipt(client, lot.id, "entered twice");
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
    });

    it.each([
      ["first to last", [0, 1]],
      ["last to first", [1, 0]],
    ])("two lots voided %s end at 1.8000", async (_name, order) => {
      await startAtZeroStock();
      const lots = [await receive(1000, 18, "2026-05-12"), await receive(1000, 18, "2026-05-13")];
      for (const index of order) {
        await voidReceipt(client, lots[index!]!.id, "entered twice");
      }
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
    });

    it("a void lot followed by a lot adjusted to zero still returns to 1.8000", async () => {
      await startAtZeroStock();
      const voided = await receive(1000, 18, "2026-05-12");
      const later = await receive(1000, 2, "2026-05-13");
      await adjustLot(client, { lotId: later.id, newRemainingLbs: 0, reason: "count" });
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 1000, moving_avg_cost: 18 });
      await voidReceipt(client, voided.id, "entered twice");
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
    });

    it.each([
      ["first to last", [0, 1]],
      ["last to first", [1, 0]],
    ])("two void lots before a lot adjusted to zero, voided %s, end at 1.8000", async (_name, order) => {
      await startAtZeroStock();
      const voided = [await receive(1000, 18, "2026-05-12"), await receive(1000, 20, "2026-05-12")];
      const later = await receive(1000, 2, "2026-05-13");
      await adjustLot(client, { lotId: later.id, newRemainingLbs: 0, reason: "waste" });
      for (const index of order) {
        await voidReceipt(client, voided[index!]!.id, "entered twice");
      }
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
    });

    it("the search after the last lot production drew from skips an earlier void lot", async () => {
      await startAtZeroStock();
      await receive(1000, 2, "2026-05-12");
      await produce(1000, "2026-05-12");
      // Entered late with an earlier date, so it sits before the consumed 2.00 lot.
      const early = await receive(1000, 18, "2026-05-11");
      await voidReceipt(client, early.id, "entered twice");
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 2 });
      await receive(1000, 2.5, "2026-05-12");
      await produce(1000, "2026-05-12");
      const late = await receive(1000, 20, "2026-05-13");
      const wasted = await receive(1000, 3, "2026-05-14");
      await adjustLot(client, { lotId: wasted.id, newRemainingLbs: 0, reason: "waste" });
      await voidReceipt(client, late.id, "entered twice");
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 2.5 });
    });

    it("lots received in one date keep insertion order when two are voided", async () => {
      await startAtZeroStock();
      const lots = [await receive(1000, 18, "2026-05-12"), await receive(1000, 18, "2026-05-12")];
      await voidReceipt(client, lots[1]!.id, "entered twice");
      await voidReceipt(client, lots[0]!.id, "entered twice");
      expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
    });
  });
});

// A sale spanning two finished lots, plus a second sale to keep.
async function twoFinishedLotsAndSales(): Promise<{ big: string; small: string }> {
  await receive(2000, 1.68, "2026-05-12");
  await produce(1000, "2026-05-20"); // 770 finished lbs
  await produce(200, "2026-05-20"); // 154 finished lbs
  const big = await recordSale(client, {
    finishedProductId: PROD_502_ID,
    lbs: 800,
    pricePerLb: 2.68,
    customerId: CUSTOMER_ID,
    saleDate: "2026-05-21",
    saleNumber: "S-BIG",
  });
  const small = await recordSale(client, {
    finishedProductId: PROD_502_ID,
    lbs: 10,
    pricePerLb: 2.68,
    saleDate: "2026-05-21",
    saleNumber: "S-SMALL",
  });
  return { big: big.id, small: small.id };
}

async function finishedRemaining(): Promise<number[]> {
  const rows = await query(
    "select lbs_remaining::float8 as left from finished_goods order by produced_seq",
  );
  return rows.map((r) => Number(r.left));
}

describe("void_sale", () => {
  it("AC-0036: returns each line's lbs to its finished lot and leaves the trace", async () => {
    const { big } = await twoFinishedLotsAndSales();
    expect(await finishedRemaining()).toEqual([0, 114]);
    expect((await getTrace(client, "S-BIG")).length).toBeGreaterThan(0);

    const voided = await voidSale(client, big, "wrong customer");
    expect(voided.voided_at).not.toBeNull();
    expect(voided.void_reason).toBe("wrong customer");

    expect(await finishedRemaining()).toEqual([770, 144]);
    expect(await getTrace(client, "S-BIG")).toEqual([]);
    expect((await getTrace(client, "S-SMALL")).length).toBeGreaterThan(0);
  });

  describe("AC-0037: refusals change nothing", () => {
    it("a sale that is already void", async () => {
      const { big } = await twoFinishedLotsAndSales();
      await voidSale(client, big, "wrong customer");
      await refused(voidSaleCall(big), /already void/);
    });

    it("an unknown sale", async () => {
      await refused(voidSaleCall("99999999-9999-9999-9999-999999999999"), /invalid/);
    });

    it.each(BAD_REASONS)("a reason that is %s", async (_name, reason) => {
      const { big } = await twoFinishedLotsAndSales();
      await refused(voidSaleCall(big, reason), /invalid/);
    });
  });
});

describe("adjust_lot", () => {
  // A 1,000 lb lot with 600 lbs consumed, so the cap is 400 lbs.
  async function consumedLot(): Promise<Lot> {
    const lot = await receive(1000, 1.68);
    await produce(600);
    expect((await lotState(lot.id)).remaining_lbs).toBe(400);
    return lot;
  }

  it("AC-0038: sets remaining lbs, records the adjustment, and leaves unit cost", async () => {
    const lot = await consumedLot();
    const adjusted = await adjustLot(client, {
      lotId: lot.id,
      newRemainingLbs: 250,
      reason: "waste",
      note: "dropped pallet",
    });
    expect(adjusted.remaining_lbs).toBe(250);
    expect((await lotState(lot.id)).unit_cost).toBe(1.68);

    const rows = await query(
      `select old_remaining_lbs::float8 as old, new_remaining_lbs::float8 as new, reason, note
       from lot_adjustments where lot_id = $1`,
      [lot.id],
    );
    expect(rows).toEqual([{ old: 400, new: 250, reason: "waste", note: "dropped pallet" }]);
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 250, moving_avg_cost: 1.68 });
  });

  it("AC-0038: both ends of the range are accepted", async () => {
    const lot = await consumedLot();
    await adjustLot(client, { lotId: lot.id, newRemainingLbs: 400, reason: "count" });
    expect((await lotState(lot.id)).remaining_lbs).toBe(400);
    await adjustLot(client, { lotId: lot.id, newRemainingLbs: 0, reason: "spoilage" });
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.68 });
  });

  describe("AC-0039: refusals change nothing", () => {
    it.each<[string, Arg]>([
      ["NULL", null],
      ["NaN", "NaN"],
      ["-1", -1],
      ["401, one above the cap", 401],
    ])("a new value of %s", async (_name, value) => {
      const lot = await consumedLot();
      await refused(adjustCall(lot.id, value), /invalid/);
    });

    it("a void lot", async () => {
      await receive(1000, 1.68);
      const lot = await receive(500, 1.8, "2026-05-13");
      await voidReceipt(client, lot.id, "entered twice");
      await refused(adjustCall(lot.id, 0), /already void/);
    });

    it("a reason outside count, waste, spoilage, other", async () => {
      const lot = await consumedLot();
      await refused(adjustCall(lot.id, 100, "theft"), /invalid/);
      await refused(adjustCall(lot.id, 100, null), /invalid/);
    });

    it("an unknown lot", async () => {
      await refused(adjustCall("99999999-9999-9999-9999-999999999999", 1), /invalid/);
    });
  });

  it("AC-0028: the average after an adjustment is the stock-on-hand average", async () => {
    await receive(1000, 1.68, "2026-05-12");
    const second = await receive(1000, 1.8, "2026-05-13");
    await adjustLot(client, { lotId: second.id, newRemainingLbs: 250, reason: "waste" });
    // (1000 x 1.68 + 250 x 1.80) / 1250 = 1.704
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 1250, moving_avg_cost: 1.704 });
  });
});

describe("trace", () => {
  it("AC-0040, AC-0041: either raw lot traces to the sale and its customer, and every line counts once", async () => {
    const l1 = await receive(600, 1.68, "2026-05-12");
    const l2 = await receive(700, 1.8, "2026-05-13");
    await produce(1000, "2026-05-20"); // draws 600 from L1 and 400 from L2
    await produce(200, "2026-05-20"); // draws 200 from L2
    const spanning = await recordSale(client, {
      finishedProductId: PROD_502_ID,
      lbs: 800, // 770 from the first finished lot, 30 from the second
      pricePerLb: 2.68,
      customerId: CUSTOMER_ID,
      saleDate: "2026-05-21",
      saleNumber: "S-TRACE-1",
    });
    const noCustomer = await recordSale(client, {
      finishedProductId: PROD_502_ID,
      lbs: 50,
      pricePerLb: 2.7,
      saleDate: "2026-05-21",
      saleNumber: "S-TRACE-2",
    });

    for (const lot of [l1, l2]) {
      const rows = await getTraceByLot(client, lot.lot_number);
      const first = rows.filter((r) => r.sale_number === "S-TRACE-1");
      expect(first.length, `S-TRACE-1 in the trace of ${lot.lot_number}`).toBeGreaterThan(0);
      expect(new Set(first.map((r) => r.customer))).toEqual(new Set(["Fulton Market Deli"]));
    }
    expect((await getTraceByLot(client, l1.lot_number)).map((r) => r.sale_number)).not.toContain("S-TRACE-2");
    const second = (await getTraceByLot(client, l2.lot_number)).filter((r) => r.sale_number === "S-TRACE-2");
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((r) => r.customer === null)).toBe(true);

    const distinctLines = async (): Promise<number> =>
      new Set((await getTrace(client)).map((r) => r.sale_item_id)).size;
    const lines = async (): Promise<number> =>
      Number(
        (await query("select count(*)::int as n from sale_items si join sales s on s.id = si.sale_id where s.voided_at is null"))[0]?.n,
      );
    expect(await lines()).toBe(3);
    expect(await distinctLines()).toBe(3);

    await voidSale(client, noCustomer.id, "wrong customer");
    expect(await lines()).toBe(2);
    expect(await distinctLines()).toBe(2);
    expect(spanning.voided_at).toBeNull();
  });
});

describe("AC-0015: concurrent corrections keep the invariants", () => {
  async function rawFixture(): Promise<{ l1: Lot; l2: Lot; l3: Lot }> {
    return { l1: await receive(1000, 1.68), l2: await receive(500, 1.8, "2026-05-13"), l3: await receive(500, 2.0, "2026-05-14") };
  }

  const rawPairs: [string, (f: { l1: Lot; l2: Lot; l3: Lot }) => [OpCall, OpCall]][] = [
    ["receive_lot + void_receipt", (f) => [receiveCall(400, 1.9, "2026-05-15"), voidReceiptCall(f.l3.id)]],
    ["receive_lot + adjust_lot", (f) => [receiveCall(400, 1.9, "2026-05-15"), adjustCall(f.l2.id, 300)]],
    ["produce_batch + void_receipt", (f) => [produceCall(800), voidReceiptCall(f.l3.id)]],
    ["produce_batch + adjust_lot", (f) => [produceCall(800), adjustCall(f.l3.id, 300)]],
    ["void_receipt + void_receipt", (f) => [voidReceiptCall(f.l2.id), voidReceiptCall(f.l3.id)]],
    ["void_receipt + adjust_lot", (f) => [voidReceiptCall(f.l3.id), adjustCall(f.l2.id, 300)]],
    ["adjust_lot + adjust_lot", (f) => [adjustCall(f.l2.id, 300), adjustCall(f.l2.id, 200, "waste")]],
  ];
  it.each(rawPairs)("%s on one raw product", async (_name, calls) => {
    const [first, second] = calls(await rawFixture());
    const [a, b] = await raceCalls(first, second);
    expect(a.error).toBeUndefined();
    expect(b.error).toBeUndefined();
    await assertLedgerInvariants();
    await assertAverageIsStockOnHand();
  });

  // 1,000 finished lbs, one sale of 200 lbs and one of 100 lbs to void.
  async function finishedFixture(): Promise<{ s0: string; s1: string }> {
    await receive(3000, 1.68);
    await produceBatch(client, {
      finishedProductId: PROD_502_ID,
      rawLbsIn: 1300,
      finishedLbsOut: 1000,
      productionDate: "2026-05-19",
    });
    const s0 = await recordSale(client, { finishedProductId: PROD_502_ID, lbs: 200, pricePerLb: 2.68, saleDate: "2026-05-20" });
    const s1 = await recordSale(client, { finishedProductId: PROD_502_ID, lbs: 100, pricePerLb: 2.68, saleDate: "2026-05-20" });
    return { s0: s0.id, s1: s1.id };
  }

  const finishedPairs: [string, (f: { s0: string; s1: string }) => [OpCall, OpCall]][] = [
    ["produce_batch + void_sale", (f) => [produceCall(500), voidSaleCall(f.s0)]],
    ["record_sale + void_sale", (f) => [saleCall(300), voidSaleCall(f.s0)]],
    ["void_sale + void_sale", (f) => [voidSaleCall(f.s0), voidSaleCall(f.s1)]],
  ];
  it.each(finishedPairs)("%s on one finished product", async (_name, calls) => {
    const [first, second] = calls(await finishedFixture());
    const [a, b] = await raceCalls(first, second);
    expect(a.error).toBeUndefined();
    expect(b.error).toBeUndefined();
    await assertLedgerInvariants();
    await assertAverageIsStockOnHand();
  });
});

describe("AC-0016: the first call to finish removes the other's precondition", () => {
  function exactlyOne(outcomes: [CallOutcome, CallOutcome], refusal: RegExp): void {
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.find((o) => !o.ok)?.error).toMatch(refusal);
  }

  it("two void_sale calls on one sale", async () => {
    await receive(1000, 1.68);
    await produce(500);
    const sale = await recordSale(client, { finishedProductId: PROD_502_ID, lbs: 100, pricePerLb: 2.68, saleDate: "2026-05-21" });
    exactlyOne(await raceCalls(voidSaleCall(sale.id), voidSaleCall(sale.id)), /already void/);
    expect(await finishedRemaining()).toEqual([385]);
  });

  it("two void_receipt calls on one lot", async () => {
    const lot = await receive(1000, 1.68);
    exactlyOne(await raceCalls(voidReceiptCall(lot.id), voidReceiptCall(lot.id)), /already void/);
    expect((await lotState(lot.id)).voided).toBe(true);
  });

  it.each([
    ["void_receipt first", true],
    ["adjust_lot first", false],
  ])("void_receipt and adjust_lot on one lot, %s", async (_name, voidFirst) => {
    const lot = await receive(1000, 1.68);
    const calls: [OpCall, OpCall] = [voidReceiptCall(lot.id), adjustCall(lot.id, 600)];
    exactlyOne(
      await raceCalls(...(voidFirst ? calls : [calls[1], calls[0]] as [OpCall, OpCall])),
      voidFirst ? /already void/ : /invalid/,
    );
  });

  it.each([
    ["void_receipt first", true],
    ["produce_batch first", false],
  ])("void_receipt and a produce_batch that can draw only from that lot, %s", async (_name, voidFirst) => {
    const lot = await receive(1000, 1.68);
    const calls: [OpCall, OpCall] = [voidReceiptCall(lot.id), produceCall(500)];
    const outcomes = await raceCalls(...(voidFirst ? calls : [calls[1], calls[0]] as [OpCall, OpCall]));
    exactlyOne(outcomes, voidFirst ? /shortfall/ : /invalid/);
  });

  it.each([
    ["produce_batch first", true],
    ["adjust_lot first", false],
  ])("produce_batch and adjust_lot on a lot the batch draws from, %s", async (_name, produceFirst) => {
    // Adjusting to 800 fits the cap of 1,000 now, but not after 900 lbs are consumed;
    // the batch of 900 fits the lot now, but not after the lot is set to 800.
    const lot = await receive(1000, 1.68);
    const calls: [OpCall, OpCall] = [produceCall(900), adjustCall(lot.id, 800)];
    exactlyOne(
      await raceCalls(...(produceFirst ? calls : [calls[1], calls[0]] as [OpCall, OpCall])),
      produceFirst ? /invalid/ : /shortfall/,
    );
    expect((await lotState(lot.id)).remaining_lbs).toBe(produceFirst ? 100 : 800);
  });
});
