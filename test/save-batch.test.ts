import { expect, it } from "vitest";
import { decideSave, type SaveDeps } from "../src/app/production/save-batch.js";

const validFields = {
  productCode: "502",
  rawLbs: "2000",
  finishedLbs: "",
  productionDate: "2026-10-06",
  notes: "",
  today: "2026-10-08",
};

async function unreachable(): Promise<never> {
  throw new Error("unreachable");
}

// STUB: AC-0034
it("AC-0034: a read before the write fails, so nothing is written", async () => {
  let wrote = false;
  const deps: SaveDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => {
      throw new Error("listFinishedProducts failed: fetch failed");
    },
    write: async () => {
      wrote = true;
      return unreachable();
    },
    readAfter: unreachable,
  };
  expect(await decideSave(validFields, deps)).toEqual({
    status: "refused",
    message: "The batch wasn't saved. Try again in a moment.",
  });
  expect(wrote).toBe(false);
});

import { RpcError, type ProductionBatch } from "../src/lib/rpc.js";
import { resultView } from "../src/app/production/result-view.js";
import type { AfterWrite, ReadyToWrite, SaveState } from "../src/app/production/save-batch.js";

const TRY_AGAIN = "The batch wasn't saved. Try again in a moment.";

const stock = (qtyOnHand: number, movingAvgCost: number) => ({
  balance: { qtyOnHand, movingAvgCost },
  nonVoidReceipts: 1,
});

function ready(finishedLbs?: number): ReadyToWrite {
  return {
    ok: true,
    input: { productCode: "502", rawLbs: 2000, productionDate: "2026-10-06", finishedLbs },
    product: {
      id: "fp",
      code: "502",
      description: "Trim 50/50",
      shrinkPct: 0.23,
      raw: { id: "rp", code: "102", description: "Raw trim", active: true },
    },
    stockBefore: stock(8000, 1.725),
  } as ReadyToWrite;
}

const batch = (finishedLbsOut: number): ProductionBatch => ({
  id: "b1",
  batch_number: "B-0001",
  production_date: "2026-10-06",
  raw_lbs_in: 2000,
  finished_lbs_out: finishedLbsOut,
  raw_cost_total: 3360,
  cost_per_finished_lb: 2.6318,
  shrink_pct_used: 0.23,
  finished_product_id: "fp",
  created_at: "2026-10-08T00:00:00Z",
  notes: null,
});

const after: AfterWrite = {
  lotsUsed: [
    { lotNumber: "L-1", receivedDate: "2026-10-01", vendorName: "Acme", lbsDrawn: 2000, costPerLb: 1.68 },
  ],
  finishedLot: { lbsProduced: 1540, costPerLb: 2.6318 },
  stockAfter: stock(6000, 1.74),
} as AfterWrite;

function spyDeps(caller: SaveDeps<null>["caller"]) {
  const calls: string[] = [];
  const deps: SaveDeps<null> = {
    caller,
    readBefore: async () => {
      calls.push("readBefore");
      return ready();
    },
    write: async () => {
      calls.push("write");
      return batch(1540);
    },
    readAfter: async () => {
      calls.push("readAfter");
      return after;
    },
  };
  return { calls, deps };
}

function saved(state: SaveState) {
  if (state.status !== "saved") throw new Error(`expected saved, got ${state.status}`);
  return state;
}

it("AC-0004: an ended session refuses and calls nothing", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "ended" }));
  expect(await decideSave(validFields, deps)).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to save this batch.",
  });
  expect(calls).toEqual([]);
});

it("AC-0067: a non-operator is refused and nothing is called", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "not-operator" }));
  expect(await decideSave(validFields, deps)).toEqual({
    status: "refused",
    message: "The batch wasn't saved. This account isn't allowed to use Meat Ops.",
  });
  expect(calls).toEqual([]);
});

it("AC-0034: a failed caller check refuses and calls nothing", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "failed", error: new Error("fetch failed") }));
  expect(await decideSave(validFields, deps)).toEqual({ status: "refused", message: TRY_AGAIN });
  expect(calls).toEqual([]);
});

it("AC-0010: field errors from the rules come back as an invalid state, with no write", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "operator", client: null }));
  deps.readBefore = async () => ({ ok: false, errors: { rawLbs: "Raw lbs must be above 0." } });
  expect(await decideSave(validFields, deps)).toEqual({
    status: "invalid",
    fieldErrors: { rawLbs: "Raw lbs must be above 0." },
  });
  expect(calls).toEqual([]);
});

it("AC-0035: a write that throws with no code says the batch may not have been saved", async () => {
  const { deps } = spyDeps(async () => ({ status: "operator", client: null }));
  deps.write = async () => {
    throw new Error("produceBatch failed: fetch failed");
  };
  expect(await decideSave(validFields, deps)).toEqual({
    status: "refused",
    message:
      "The batch may not have been saved. Reload this page and check Recent batches before saving again.",
  });
});

it("AC-0035: a write that resolves with no batch row says the batch may not have been saved", async () => {
  const { deps } = spyDeps(async () => ({ status: "operator", client: null }));
  deps.write = async () => null as unknown as ProductionBatch;
  expect(await decideSave(validFields, deps)).toEqual({
    status: "refused",
    message:
      "The batch may not have been saved. Reload this page and check Recent batches before saving again.",
  });
});

it("AC-0075: an engine refusal outside AC-0030 to AC-0033 is shown after the lead", async () => {
  const { deps } = spyDeps(async () => ({ status: "operator", client: null }));
  deps.write = async () => {
    throw new RpcError("produceBatch failed: produce_batch: something else is wrong", "P0001");
  };
  const state = await decideSave(validFields, deps);
  expect(state).toEqual({ status: "refused", message: "The batch wasn't saved. something else is wrong" });
});

it("AC-0080: a not-allowed refusal from the write gets the not-allowed text", async () => {
  const { deps } = spyDeps(async () => ({ status: "operator", client: null }));
  deps.write = async () => {
    throw new RpcError("produceBatch failed: permission denied", "42501");
  };
  expect(await decideSave(validFields, deps)).toEqual({
    status: "refused",
    message: "The batch wasn't saved. This account isn't allowed to use Meat Ops.",
  });
});

it("AC-0029, AC-0073: a read after the write fails, so the batch is saved with no totals", async () => {
  const { deps } = spyDeps(async () => ({ status: "operator", client: null }));
  deps.readAfter = async () => {
    throw new Error("listLotsUsed failed: permission denied");
  };
  const state = saved(await decideSave(validFields, deps));
  expect(state.totals).toBeNull();
  expect(state.batch.batchNumber).toBe("B-0001");
  const view = resultView(state);
  expect(view.lines).toContainEqual({ label: "Batch number", value: "B-0001" });
  expect(view.lines).toContainEqual({ label: "Product shrink", value: "23%" });
  expect(view.sections).toBeNull();
  expect(view.notice).toBe(
    "The batch was saved, but its lots and stock couldn't be loaded. Reload this page to see them.",
  );
});

it("AC-0018, AC-0019, AC-0025, AC-0026: every read succeeds, so the totals are carried and shown", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "operator", client: null }));
  const state = saved(await decideSave(validFields, deps));
  expect(calls).toEqual(["readBefore", "write", "readAfter"]);
  expect(state.totals?.stock.before).toEqual({ qtyOnHand: 8000, averageCost: 1.725 });
  const view = resultView(state);
  expect(view.notice).toBeNull();
  expect(view.lines).toContainEqual({ label: "Finished lbs out", value: "1,540 lbs (from shrink)" });
  expect(view.lines).toContainEqual({ label: "Product shrink", value: "23%" });
  expect(view.sections?.lotsUsed).toEqual([
    { lotNumber: "L-1", receivedDate: "Oct 1, 2026", vendorName: "Acme", lbsDrawn: "2,000 lbs", costPerLb: "$1.6800/lb" },
  ]);
  expect(view.sections?.finishedStock).toEqual({ lbs: "1,540 lbs", costPerLb: "$2.6318/lb" });
  expect(view.sections?.stock).toEqual({
    onHandBefore: "8,000 lbs",
    onHandAfter: "6,000 lbs",
    averageBefore: "$1.7250/lb",
    averageAfter: "$1.7400/lb",
  });
});

it("AC-0072: the not-used note shows only when finished lbs was filled", async () => {
  const { deps } = spyDeps(async () => ({ status: "operator", client: null }));
  deps.readBefore = async () => ready(1500);
  deps.write = async () => batch(1500);
  const view = resultView(saved(await decideSave(validFields, deps)));
  expect(view.lines).toContainEqual({
    label: "Product shrink",
    value: "23% (not used, finished lbs measured)",
  });
  expect(view.lines).toContainEqual({ label: "Finished lbs out", value: "1,500 lbs (measured)" });
});
