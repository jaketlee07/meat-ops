import { expect, it, vi } from "vitest";
import {
  decideReceiptSave,
  decideReceiptVoid,
  type ReceiptReadyToWrite,
  type ReceiptSaveDeps,
  type ReceiptVoidDeps,
} from "../src/app/receiving/save-receipt.js";
import { RpcError, type Lot } from "../src/lib/rpc.js";

const ready: ReceiptReadyToWrite = {
  ok: true,
  input: { productCode: "RAW-TOM", vendorId: "v1", weightLbs: 500, unitCost: 1.85, receivedDate: "2026-10-08" },
  product: { id: "p1", code: "RAW-TOM", description: "Turkey Drums TOM (raw)" },
  stockBefore: { balance: { qtyOnHand: 1000, movingAvgCost: 1.8 }, nonVoidReceipts: 2 },
  pricesBefore: [],
  vendors: [{ id: "v1", name: "Acme Foods" }],
};

const lot = {
  id: "lot-1",
  lot_number: "L-0003",
  vendor_id: "v1",
  received_date: "2026-10-08",
  weight_lbs: 500,
  unit_cost: 1.85,
} as Lot;

function saveDeps(overrides: Partial<ReceiptSaveDeps<null>>): ReceiptSaveDeps<null> {
  return {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => ready,
    write: async () => lot,
    readAfter: async () => ({
      stockAfter: { balance: { qtyOnHand: 1500, movingAvgCost: 1.8167 }, nonVoidReceipts: 3 },
      pricesAfter: [],
    }),
    ...overrides,
  };
}

function voidDeps(write: ReceiptVoidDeps<null>["write"]): ReceiptVoidDeps<null> {
  return { caller: async () => ({ status: "operator", client: null }), write };
}

// Runs a decision with console.error captured, and returns its result and every line it logged.
async function logged<T>(run: () => Promise<T>): Promise<{ result: T; lines: unknown[][] }> {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await run();
    return { result, lines: [...spy.mock.calls] };
  } finally {
    spy.mockRestore();
  }
}

// STUB: AC-0001
it("AC-0001, AC-0005: a read after the write fails, so the save carries the written lot and no totals, and logs the failed read", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptSave(
      new FormData(),
      saveDeps({
        readAfter: async () => {
          throw new Error("getStock failed: fetch failed\nother side closed");
        },
      }),
    ),
  );
  expect(result).toEqual({
    status: "saved",
    lot: {
      lotNumber: "L-0003",
      productCode: "RAW-TOM",
      productDescription: "Turkey Drums TOM (raw)",
      vendorName: "Acme Foods",
      receivedDate: "2026-10-08",
      weightLbs: 500,
      unitCost: 1.85,
    },
    totals: null,
  });
  expect(lines).toEqual([
    ["saveReceipt: reading the totals after the write failed: getStock failed: fetch failed\nother side closed"],
  ]);
});

// STUB: AC-0002
it("AC-0002, AC-0005: the engine refuses the write as not allowed, so the save says this account isn't allowed and logs the write stage", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptSave(
      new FormData(),
      saveDeps({
        write: async () => {
          throw new RpcError("receiveLot failed: permission denied for function receive_lot", "42501");
        },
      }),
    ),
  );
  expect(result).toEqual({
    status: "refused",
    message: "The receipt wasn't saved. This account isn't allowed to use Meat Ops.",
  });
  expect(lines).toEqual([
    ["saveReceipt failed at write: receiveLot failed: permission denied for function receive_lot (code 42501)"],
  ]);
});

// STUB: AC-0003
it("AC-0003, AC-0005: the write gets no answer, so the save may have happened and the log names the write stage", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptSave(
      new FormData(),
      saveDeps({
        write: async () => {
          throw new RpcError("receiveLot failed: TypeError: fetch failed", "");
        },
      }),
    ),
  );
  expect(result).toEqual({
    status: "refused",
    message: "The receipt may not have been saved. Reload this page and check Recent receipts before saving again.",
  });
  expect(lines).toEqual([["saveReceipt failed at write: receiveLot failed: TypeError: fetch failed"]]);
});

// STUB: AC-0004
it("AC-0004, AC-0005: the void's write gets no answer, so the void may have happened and the log names the write stage", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptVoid(
      "lot-1",
      "Entered twice",
      voidDeps(async () => {
        throw new RpcError("voidReceipt failed: TypeError: fetch failed", "");
      }),
    ),
  );
  expect(result).toEqual({
    status: "refused",
    message: "The receipt may not have been voided. Reload this page to see whether it was.",
  });
  expect(lines).toEqual([["voidReceipt failed at write: voidReceipt failed: TypeError: fetch failed"]]);
});
