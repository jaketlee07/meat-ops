import { expect, it, vi } from "vitest";
import {
  decideCorrection,
  type CorrectionAfter,
  type CorrectionDeps,
  type CorrectionSnapshot,
} from "../src/app/receiving/correct-receipt.js";
import {
  decideReversal,
  type ReversalAfter,
  type ReversalBefore,
  type ReversalDeps,
} from "../src/app/production/reverse-batch.js";
import { RpcError, type Lot, type ProductionBatch } from "../src/lib/rpc.js";

async function unreachable(): Promise<never> {
  throw new Error("unreachable");
}

// STUB: AC-0109
it("AC-0109: a read before the write fails, so nothing is written", async () => {
  let wrote = false;
  const deps: CorrectionDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => {
      throw new Error("getLotFigures failed: fetch failed");
    },
    write: async () => {
      wrote = true;
      return unreachable();
    },
    readAfter: unreachable,
  };
  expect(
    await decideCorrection("lot-a", { cost: "1.86", weight: "5000", reason: "invoice price" }, deps),
  ).toEqual({ status: "refused", message: "The receipt wasn't corrected. Try again in a moment." });
  expect(wrote).toBe(false);
});

const fields = { cost: "1.90", weight: "3000", reason: "invoice price" };

const snapshot: CorrectionSnapshot = {
  lot: {
    lotNumber: "L-2",
    productId: "raw-1",
    costText: "1.8000",
    weightText: "3000.000",
    unitCost: 1.8,
    weightLbs: 3000,
    remainingLbs: 1000,
    voidedAt: null,
  },
  stock: { balance: { qtyOnHand: 1000, movingAvgCost: 1.8 }, nonVoidReceipts: 2 },
  prices: [],
  batches: [],
};
const afterSnapshot: CorrectionAfter = { ...snapshot, reason: "invoice price" };
const lot = { id: "lot-a", lot_number: "L-2" } as Lot;

function correctionDeps(overrides: Partial<CorrectionDeps<null>> = {}): CorrectionDeps<null> {
  return {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => snapshot,
    write: async () => lot,
    readAfter: async () => afterSnapshot,
    ...overrides,
  };
}

function quiet() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

async function neverCalled(): Promise<never> {
  throw new Error("must not be called");
}

it("AC-0005: a correct request with no session is told to sign in again", async () => {
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    caller: async () => ({ status: "ended" }),
    readBefore: neverCalled,
    write: neverCalled,
  }));
  expect(state).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to correct this receipt.",
  });
});

it("AC-0007: a correct request from a non-operator is refused with the account message", async () => {
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    caller: async () => ({ status: "not-operator" }),
    readBefore: neverCalled,
    write: neverCalled,
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The receipt wasn't corrected. This account isn't allowed to use Meat Ops.",
  });
});

it("a caller check that failed reads as a failure before the write", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    caller: async () => ({ status: "failed", error: new Error("getUser failed: fetch failed") }),
    readBefore: neverCalled,
    write: neverCalled,
  }));
  expect(state).toEqual({ status: "refused", message: "The receipt wasn't corrected. Try again in a moment." });
  log.mockRestore();
});

it("a lot that is not found is refused before the write", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    readBefore: async () => null,
    write: neverCalled,
  }));
  expect(state).toEqual({ status: "refused", message: "The receipt wasn't corrected. Try again in a moment." });
  log.mockRestore();
});

it("AC-0103: a blank reason is invalid and nothing is written", async () => {
  const state = await decideCorrection("lot-a", { ...fields, reason: "  " }, correctionDeps({ write: neverCalled }));
  expect(state).toEqual({ status: "invalid", errors: { reason: "Enter a reason for the correction." } });
});

it("AC-0104: the page finds the cost and weight unchanged and nothing is written", async () => {
  const state = await decideCorrection(
    "lot-a",
    { cost: "1.8", weight: "3000", reason: "same" },
    correctionDeps({ write: neverCalled }),
  );
  expect(state).toEqual({
    status: "invalid",
    errors: { form: "Change the cost or the weight to correct this receipt." },
  });
});

it("AC-0105: the weight-floor refusal is a weight-field error and keeps the confirmation open", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", { ...fields, weight: "1999.999" }, correctionDeps({
    write: async () => {
      throw new RpcError("correctReceipt failed: correct_receipt: invalid weight 1999.999, must be at least 2000.000 lbs", "P0001");
    },
  }));
  expect(state).toEqual({
    status: "invalid",
    errors: {
      weight:
        "The weight can't be less than 2,000 lbs. Production used or adjustments removed that much of this receipt.",
    },
  });
  log.mockRestore();
});

it("AC-0104: the database finds the cost and weight unchanged and shows the form message", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    write: async () => {
      throw new RpcError("correctReceipt failed: correct_receipt: invalid, nothing to correct", "P0001");
    },
  }));
  expect(state).toEqual({
    status: "invalid",
    errors: { form: "Change the cost or the weight to correct this receipt." },
  });
  log.mockRestore();
});

it("AC-0107: a refused write closes with the refusal and the reload hint", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    write: async () => {
      throw new RpcError("correctReceipt failed: correct_receipt: lot lot-a is already void", "P0001");
    },
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The receipt wasn't corrected. lot lot-a is already void. Reload to see the latest stock.",
  });
  log.mockRestore();
});

it("a write the account may not make is refused with the account message", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    write: async () => {
      throw new RpcError("correctReceipt failed: permission denied", "42501");
    },
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The receipt wasn't corrected. This account isn't allowed to use Meat Ops.",
  });
  log.mockRestore();
});

it("AC-0110: a write that gets no answer says the receipt may not have been corrected", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    write: async () => {
      throw new Error("correctReceipt failed: fetch failed");
    },
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The receipt may not have been corrected. Reload this page to see whether it was.",
  });
  log.mockRestore();
});

it("AC-0110: a write that resolves with no row is a write with no answer", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    write: async () => undefined as unknown as Lot,
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The receipt may not have been corrected. Reload this page to see whether it was.",
  });
  log.mockRestore();
});

it("AC-0111: a read after the write fails, so the lot is corrected with no details", async () => {
  const log = quiet();
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    readAfter: async () => {
      throw new Error("getLotFigures failed: fetch failed");
    },
  }));
  expect(state).toEqual({ status: "corrected", lotNumber: "L-2", details: null });
  log.mockRestore();
});

it("AC-0096: a correction returns the lot number and the figures before and after", async () => {
  const written: unknown[] = [];
  const after: CorrectionAfter = {
    ...afterSnapshot,
    lot: { ...snapshot.lot, costText: "1.9000", unitCost: 1.9 },
  };
  const state = await decideCorrection("lot-a", fields, correctionDeps({
    write: async (_client, lotId, input) => {
      written.push(lotId, input);
      return lot;
    },
    readAfter: async () => after,
  }));
  expect(written).toEqual(["lot-a", { unitCost: 1.9, weightLbs: 3000, reason: "invoice price" }]);
  expect(state).toEqual({
    status: "corrected",
    lotNumber: "L-2",
    details: { before: snapshot, after },
  });
});

const reversalBefore: ReversalBefore = {
  preview: {
    batchNumber: "B-2",
    productionDate: "2026-10-07",
    finishedLbs: 4230,
    lots: [{ lotNumber: "L-2", lbs: 1000 }],
    sales: [],
  },
  stock: { raw: { balance: { qtyOnHand: 1000, movingAvgCost: 1.8 }, nonVoidReceipts: 2 }, finishedLbs: 390 },
};
const reversalAfter: ReversalAfter = {
  stock: { raw: { balance: { qtyOnHand: 2000, movingAvgCost: 1.8 }, nonVoidReceipts: 2 }, finishedLbs: 4620 },
  voidedSales: [],
};
const batch = { id: "batch-b", batch_number: "B-2" } as ProductionBatch;

function reversalDeps(overrides: Partial<ReversalDeps<null>> = {}): ReversalDeps<null> {
  return {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => reversalBefore,
    write: async () => batch,
    readAfter: async () => reversalAfter,
    ...overrides,
  };
}

it("AC-0006: a reverse request with no session is told to sign in again", async () => {
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    caller: async () => ({ status: "ended" }),
    readBefore: neverCalled,
    write: neverCalled,
  }));
  expect(state).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to reverse this batch.",
  });
});

it("AC-0007: a reverse request from a non-operator is refused with the account message", async () => {
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    caller: async () => ({ status: "not-operator" }),
    readBefore: neverCalled,
    write: neverCalled,
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The batch wasn't reversed. This account isn't allowed to use Meat Ops.",
  });
});

it("a caller check that failed reads as a failure before the write", async () => {
  const log = quiet();
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    caller: async () => ({ status: "failed", error: new Error("getUser failed: fetch failed") }),
    readBefore: neverCalled,
    write: neverCalled,
  }));
  expect(state).toEqual({ status: "refused", message: "The batch wasn't reversed. Try again in a moment." });
  log.mockRestore();
});

it("AC-0139: a blank reason is invalid and nothing is read or written", async () => {
  const state = await decideReversal("batch-b", "   ", reversalDeps({
    readBefore: neverCalled,
    write: neverCalled,
  }));
  expect(state).toEqual({ status: "invalid", error: "Enter a reason for the reversal." });
});

it("AC-0143: a read before the write fails, so nothing is written", async () => {
  const log = quiet();
  let wrote = false;
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    readBefore: async () => {
      throw new Error("getReversalPreview failed: fetch failed");
    },
    write: async () => {
      wrote = true;
      return batch;
    },
  }));
  expect(state).toEqual({ status: "refused", message: "The batch wasn't reversed. Try again in a moment." });
  expect(wrote).toBe(false);
  log.mockRestore();
});

it("AC-0140: a refused write closes with the refusal and the reload hint", async () => {
  const log = quiet();
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    write: async () => {
      throw new RpcError("reverseBatch failed: reverse_batch: batch batch-b is already reversed", "P0001");
    },
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The batch wasn't reversed. batch batch-b is already reversed. Reload to see the latest stock.",
  });
  log.mockRestore();
});

it("AC-0144: a write that gets no answer says the batch may not have been reversed", async () => {
  const log = quiet();
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    write: async () => {
      throw new Error("reverseBatch failed: fetch failed");
    },
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The batch may not have been reversed. Reload this page to see whether it was.",
  });
  log.mockRestore();
});

it("AC-0144: a write that resolves with no row is a write with no answer", async () => {
  const log = quiet();
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    write: async () => undefined as unknown as ProductionBatch,
  }));
  expect(state).toEqual({
    status: "refused",
    message: "The batch may not have been reversed. Reload this page to see whether it was.",
  });
  log.mockRestore();
});

it("AC-0145: a read after the write fails, so the batch is reversed with no details", async () => {
  const log = quiet();
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    readAfter: async () => {
      throw new Error("listSalesVoidedBy failed: permission denied");
    },
  }));
  expect(state).toEqual({ status: "reversed", batchNumber: "B-2", details: null });
  log.mockRestore();
});

it("AC-0135: a reversal returns the batch number and the figures before and after", async () => {
  const written: unknown[] = [];
  const state = await decideReversal("batch-b", "entered twice", reversalDeps({
    write: async (_client, batchId, reason) => {
      written.push(batchId, reason);
      return batch;
    },
  }));
  expect(written).toEqual(["batch-b", "entered twice"]);
  expect(state).toEqual({
    status: "reversed",
    batchNumber: "B-2",
    details: { before: reversalBefore, after: reversalAfter },
  });
});
