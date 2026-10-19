import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import { correctReceipt, produceBatch, receiveLot, reverseBatch, voidReceipt, type Lot } from "../src/lib/rpc.js";
import { signInOperator } from "./users.js";
import {
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  adjustCall,
  assertAverageIsStockOnHand,
  assertLedgerInvariants,
  averageViolations,
  closePool,
  getInventoryBalance,
  inOperatorTransaction,
  produceCall,
  query,
  resetTestData,
} from "./db.js";
import { resolveStackEnv } from "./env.js";

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

async function receive(cost: number, received: string): Promise<Lot> {
  return receiveLot(client, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: 1000,
    unitCost: cost,
    received,
  });
}

async function produce(productionDate: string): Promise<void> {
  await produceBatch(client, { finishedProductId: PROD_502_ID, rawLbsIn: 1000, productionDate });
}

// The zero-stock start: 0 lbs on hand at an average of 1.8000.
async function zeroStockStart(): Promise<void> {
  await receive(1.8, "2026-05-10");
  await produce("2026-05-11");
}

// STUB: AC-0006
it.each([
  ["first to last", [0, 1]],
  ["last to first", [1, 0]],
])("AC-0006: lots entered out of date order and voided %s leave 1.8000", async (_name, order) => {
  await zeroStockStart();
  const lots = [await receive(18, "2026-05-14"), await receive(20, "2026-05-12")];
  for (const index of order) {
    await voidReceipt(client, lots[index!]!.id, "entered twice");
  }
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
});

it("AC-0007: voiding after a batch that drew an earlier-dated lot leaves that lot's 2.0000", async () => {
  await zeroStockStart();
  const voided = await receive(18, "2026-05-13");
  await receive(2, "2026-05-12");
  await produce("2026-05-12");
  await voidReceipt(client, voided.id, "entered twice");
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 2 });
});

it.each([
  ["the adjustment runs second", "adjustment", 3],
  ["the batch runs second", "batch", 2],
])("AC-0008: two changes in one transaction, when %s, leave the cost the second change took", async (_name, second, average) => {
  await receive(2, "2026-05-10");
  const y = await receive(3, "2026-05-11");
  const v = await receive(18, "2026-05-20");
  const batch = produceCall(PROD_502_ID, 1000, null, "2026-05-15");
  const adjustment = adjustCall(y.id, 0);
  await inOperatorTransaction(async (call) => {
    for (const change of second === "adjustment" ? [batch, adjustment] : [adjustment, batch]) {
      const outcome = await call(change);
      expect(outcome.ok, outcome.error).toBe(true);
    }
  });
  await voidReceipt(client, v.id, "entered twice");
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: average });
});

it("AC-0009: a reversed batch counts as never entered, so voiding its lot leaves 1.8000", async () => {
  await zeroStockStart();
  const lot = await receive(2, "2026-05-12");
  const batch = await produceBatch(client, { finishedProductId: PROD_502_ID, rawLbsIn: 1000, productionDate: "2026-05-12" });
  await reverseBatch(client, batch.id, "entered twice");
  await voidReceipt(client, lot.id, "entered twice");
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
});

it("AC-0010: at 0 lbs on hand, correcting the consumed lot to 1.90 per lb moves the average to 1.9000", async () => {
  // The zero-stock start, keeping its lot.
  const first = await receive(1.8, "2026-05-10");
  await produce("2026-05-11");
  await correctReceipt(client, { lotId: first.id, unitCost: 1.9, weightLbs: 1000, reason: "invoice price" });
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.9 });
});

it("AC-0012: a void after the consumed lot is corrected to 1.90 per lb leaves 1.9000", async () => {
  // The zero-stock start, keeping its lot.
  const first = await receive(1.8, "2026-05-10");
  await produce("2026-05-11");
  const voided = await receive(18, "2026-05-12");
  await correctReceipt(client, { lotId: first.id, unitCost: 1.9, weightLbs: 1000, reason: "invoice price" });
  await voidReceipt(client, voided.id, "entered twice");
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.9 });
});

it("AC-0019: a weight correction that empties stock after a batch leaves the batch's 1.3333", async () => {
  await receive(1, "2026-05-12");
  const q = await receive(2, "2026-05-13");
  await produceBatch(client, { finishedProductId: PROD_502_ID, rawLbsIn: 1500, productionDate: "2026-05-13" });
  await correctReceipt(client, { lotId: q.id, unitCost: 2, weightLbs: 500, reason: "weight ticket" });
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.3333 });
});

it("AC-0013: voiding the only lot leaves an average of 0.0000", async () => {
  const lot = await receive(1.68, "2026-05-10");
  await voidReceipt(client, lot.id, "entered twice");
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 0 });
});

describe("access", () => {
  const ROLES = ["anon", "authenticated", "service_role"];

  it.each(ROLES.flatMap((role) => ["USAGE", "SELECT", "UPDATE"].map((privilege) => [role, privilege])))(
    "AC-0014: %s holds no %s on the stock-change sequence",
    async (role, privilege) => {
      const [row] = await query<{ held: boolean }>(
        "select has_sequence_privilege($1, 'private.stock_change_seq', $2) as held",
        [role, privilege],
      );
      expect(row?.held).toBe(false);
    },
  );

  it.each(["public.void_receipt(uuid, text)", "private.refresh_balance(uuid)"])(
    "AC-0020: %s is SECURITY DEFINER with search_path set to empty",
    async (fn) => {
      const [row] = await query<{ prosecdef: boolean; proconfig: string[] }>(
        "select prosecdef, proconfig from pg_proc where oid = $1::regprocedure",
        [fn],
      );
      expect(row).toEqual({ prosecdef: true, proconfig: ['search_path=""'] });
    },
  );

  it.each([
    ["authenticated", "holds", "public.void_receipt(uuid, text)"],
    ["anon", "holds no", "public.void_receipt(uuid, text)"],
    ["service_role", "holds no", "public.void_receipt(uuid, text)"],
    ["authenticated", "holds no", "private.refresh_balance(uuid)"],
    ["anon", "holds no", "private.refresh_balance(uuid)"],
    ["service_role", "holds no", "private.refresh_balance(uuid)"],
  ])("AC-0021: %s %s EXECUTE on %s", async (role, holds, fn) => {
    const [row] = await query<{ held: boolean }>(
      "select has_function_privilege($1, $2::regprocedure, 'EXECUTE') as held",
      [role, fn],
    );
    expect(row?.held).toBe(holds === "holds");
  });
});

describe("the zero-stock check", () => {
  const pool = new Pool({ connectionString: resolveStackEnv().dbUrl });
  afterAll(async () => {
    await pool.end();
  });

  it("AC-0001: the check reports a balance at 0 lbs whose average is not its zero-stock average", async () => {
    await zeroStockStart();
    const session = await pool.connect();
    try {
      await session.query("begin");
      await session.query(
        `update public.inventory_balances set qty_on_hand = 0, moving_avg_cost = 2.5 where product_id = '${RAW_TOM_ID}'`,
      );
      expect(await averageViolations(session)).toEqual([
        { violation: "AC-0001 zero-stock average <> average the last change took", subject: RAW_TOM_ID },
      ]);
    } finally {
      await session.query("rollback");
      session.release();
    }
    expect(await averageViolations(pool)).toEqual([]);
  });
});
