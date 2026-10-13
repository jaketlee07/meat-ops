import { expect, it, vi } from "vitest";
import {
  decideSaleSave,
  decideSaleVoid,
  type SaleAfterWrite,
  type SaleReadyToWrite,
  type SaleSaveDeps,
  type SaleSaveState,
  type SaleVoidDeps,
} from "../src/app/sales/save-sale.js";
import { RpcError, type Sale } from "../src/lib/rpc.js";

const fields = {
  productCode: "502",
  lbs: "100",
  pricePerLb: "3.29",
  customerId: "",
  saleDate: "2026-10-08",
  today: "2026-10-09",
};

async function unreachable(): Promise<never> {
  throw new Error("unreachable");
}

// STUB: AC-0053
it("AC-0053: a read before the write fails, so nothing is written", async () => {
  let wrote = false;
  const deps: SaleSaveDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => {
      throw new Error("listSaleProducts failed: fetch failed");
    },
    write: async () => {
      wrote = true;
      return unreachable();
    },
    readAfter: unreachable,
  };
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "refused",
    message: "The sale wasn't saved. Try again in a moment.",
  });
  expect(wrote).toBe(false);
});

const TRY_AGAIN = "The sale wasn't saved. Try again in a moment.";
const NOT_ALLOWED_SAVE = "The sale wasn't saved. This account isn't allowed to use Meat Ops.";
const VOID_TRY_AGAIN = "The sale wasn't voided. Try again in a moment.";

const ready = {
  ok: true,
  input: { productCode: "502", lbs: 100, pricePerLb: 3.29, saleDate: "2026-10-08" },
  product: { id: "fp", code: "502", description: "Trim 50/50" },
  customerName: "Acme Foods",
  stockBefore: 800,
} as SaleReadyToWrite;

const sale: Sale = {
  id: "s1",
  sale_number: "S-0001",
  sale_date: "2026-10-08",
  customer_id: "c1",
  created_at: "2026-10-09T00:00:00Z",
  void_reason: null,
  voided_at: null,
};

const lots = [
  { saleItemId: "i1", batchNumber: "B-0001", productionDate: "2026-10-01", lbsSold: 100, rawLots: [] },
];

const after: SaleAfterWrite = {
  summary: {
    id: "s1",
    saleNumber: "S-0001",
    saleDate: "2026-10-08",
    createdAt: "2026-10-09T00:00:00Z",
    customerId: "c1",
    customer: "Acme Foods",
    productCode: "502",
    product: "Trim 50/50",
    lbsSold: 100,
    pricePerLb: 3.29,
    voidedAt: null,
    voidReason: null,
  },
  lots,
  stockAfter: 700,
};

function spyDeps(caller: SaleSaveDeps<null>["caller"]) {
  const calls: string[] = [];
  const deps: SaleSaveDeps<null> = {
    caller,
    readBefore: async () => {
      calls.push("readBefore");
      return ready;
    },
    write: async () => {
      calls.push("write");
      return sale;
    },
    readAfter: async () => {
      calls.push("readAfter");
      return after;
    },
  };
  return { calls, deps };
}

const operator = async () => ({ status: "operator" as const, client: null });

async function refusedByWrite(error: unknown): Promise<SaleSaveState> {
  const { deps } = spyDeps(operator);
  deps.write = async () => {
    throw error;
  };
  return decideSaleSave(fields, deps);
}

it("AC-0052: an ended session refuses and calls nothing", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "ended" }));
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to save this sale.",
  });
  expect(calls).toEqual([]);
});

it("AC-0006: a non-operator is refused and nothing is called", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "not-operator" }));
  expect(await decideSaleSave(fields, deps)).toEqual({ status: "refused", message: NOT_ALLOWED_SAVE });
  expect(calls).toEqual([]);
});

it("AC-0053: a failed caller check refuses and calls nothing", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "failed", error: new Error("fetch failed") }));
  expect(await decideSaleSave(fields, deps)).toEqual({ status: "refused", message: TRY_AGAIN });
  expect(calls).toEqual([]);
});

it("AC-0029: a form-rule refusal returns the field errors, with no write", async () => {
  const { calls, deps } = spyDeps(operator);
  deps.readBefore = async () => ({ ok: false, errors: { lbs: "Lbs must be above 0." } });
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "invalid",
    fieldErrors: { lbs: "Lbs must be above 0." },
  });
  expect(calls).toEqual([]);
});

it("AC-0030: a customer refusal returns the field error, with no write", async () => {
  const { calls, deps } = spyDeps(operator);
  deps.readBefore = async () => ({ ok: false, errors: { customerId: "Choose a customer from the list." } });
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "invalid",
    fieldErrors: { customerId: "Choose a customer from the list." },
  });
  expect(calls).toEqual([]);
});

it("AC-0054: a write with no answer says the sale may not have been saved", async () => {
  expect(await refusedByWrite(new RpcError("recordSale failed: fetch failed", ""))).toEqual({
    status: "refused",
    message: "The sale may not have been saved. Reload this page and check Recent sales before saving again.",
  });
});

it("AC-0054: a write that resolves with no row is a write with no answer", async () => {
  const { deps } = spyDeps(operator);
  deps.write = async () => undefined as unknown as Sale;
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "refused",
    message: "The sale may not have been saved. Reload this page and check Recent sales before saving again.",
  });
});

it("AC-0057: a permission refusal says the account isn't allowed", async () => {
  expect(await refusedByWrite(new RpcError("recordSale failed: permission denied", "42501"))).toEqual({
    status: "refused",
    message: NOT_ALLOWED_SAVE,
  });
});

it("AC-0050: a shortfall names the stock on hand and the stock needed", async () => {
  const error = new RpcError(
    "recordSale failed: record_sale: shortfall, only 40 lbs finished available on or before 2026-10-08, need 100",
    "P0001",
  );
  const state = await refusedByWrite(error);
  expect(state.status).toBe("refused");
  expect(state).toMatchObject({ message: expect.stringMatching(/^The sale wasn't saved\. Only .*40.* on hand/) });
  expect(state).toMatchObject({ message: expect.stringContaining("100") });
});

it("AC-0056: another engine refusal shows the engine's reason", async () => {
  const state = await refusedByWrite(
    new RpcError("recordSale failed: record_sale: invalid lbs, must be above 0", "P0001"),
  );
  expect(state).toEqual({ status: "refused", message: "The sale wasn't saved. invalid lbs, must be above 0" });
});

it("AC-0047: a failed read after the write is still a save, with details null", async () => {
  const { deps } = spyDeps(operator);
  deps.readAfter = async () => {
    throw new Error("getSaleSummary failed: fetch failed");
  };
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "saved",
    sale: {
      id: "s1",
      saleNumber: "S-0001",
      saleDate: "2026-10-08",
      productCode: "502",
      productDescription: "Trim 50/50",
      customerName: "Acme Foods",
    },
    details: null,
  });
});

it("the failed read after the write logs one line with only the error's message (the log line; AC-0048's screen text is in the browser suite)", async () => {
  const { deps } = spyDeps(operator);
  deps.readAfter = async () => {
    throw new Error("getSaleSummary failed: fetch failed");
  };
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await decideSaleSave(fields, deps);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("saveSale: reading the details after the write failed: getSaleSummary failed: fetch failed");
  } finally {
    spy.mockRestore();
  }
});

it("AC-0040: a saved sale carries the summary's lbs and price, the lots, and the stock before and after", async () => {
  const { calls, deps } = spyDeps(operator);
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "saved",
    sale: {
      id: "s1",
      saleNumber: "S-0001",
      saleDate: "2026-10-08",
      productCode: "502",
      productDescription: "Trim 50/50",
      customerName: "Acme Foods",
      lbs: 100,
      pricePerLb: 3.29,
    },
    details: { lots, stock: { before: 800, after: 700 } },
  });
  expect(calls).toEqual(["readBefore", "write", "readAfter"]);
});

it("AC-0044: a sale with no customer and a product off the menu keeps both as null", async () => {
  const { deps } = spyDeps(operator);
  deps.readBefore = async () => ({ ...ready, customerName: null, stockBefore: null });
  const state = await decideSaleSave(fields, deps);
  expect(state).toMatchObject({
    status: "saved",
    sale: { customerName: null },
    details: { stock: { before: null, after: 700 } },
  });
});

function spyVoid(caller: SaleVoidDeps<null>["caller"]) {
  const calls: string[] = [];
  const deps: SaleVoidDeps<null> = {
    caller,
    write: async () => {
      calls.push("write");
      return {};
    },
  };
  return { calls, deps };
}

it("AC-0085: an ended session refuses a void and writes nothing", async () => {
  const { calls, deps } = spyVoid(async () => ({ status: "ended" }));
  expect(await decideSaleVoid("s1", "Wrong customer", deps)).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to void this sale.",
  });
  expect(calls).toEqual([]);
});

it("AC-0005: a void by a non-operator is refused and writes nothing", async () => {
  const { calls, deps } = spyVoid(async () => ({ status: "not-operator" }));
  expect(await decideSaleVoid("s1", "Wrong customer", deps)).toEqual({
    status: "refused",
    message: "The sale wasn't voided. This account isn't allowed to use Meat Ops.",
  });
  expect(calls).toEqual([]);
});

it("AC-0087: a failed caller check refuses a void and writes nothing", async () => {
  const { calls, deps } = spyVoid(async () => ({ status: "failed", error: new Error("fetch failed") }));
  expect(await decideSaleVoid("s1", "Wrong customer", deps)).toEqual({ status: "refused", message: VOID_TRY_AGAIN });
  expect(calls).toEqual([]);
});

it.each(["", "   "])("AC-0080: a blank void reason %j is invalid, with no write", async (reason) => {
  const { calls, deps } = spyVoid(operator);
  expect(await decideSaleVoid("s1", reason, deps)).toEqual({
    status: "invalid",
    error: "Enter a reason for the void.",
  });
  expect(calls).toEqual([]);
});

it("AC-0088: a void write with no answer says the sale may not have been voided", async () => {
  const { deps } = spyVoid(operator);
  deps.write = async () => {
    throw new RpcError("voidSale failed: fetch failed", "");
  };
  expect(await decideSaleVoid("s1", "Wrong customer", deps)).toEqual({
    status: "refused",
    message: "The sale may not have been voided. Reload this page to see whether it was.",
  });
});

it("AC-0084: an engine refusal of a void shows the engine's reason", async () => {
  const { deps } = spyVoid(operator);
  deps.write = async () => {
    throw new RpcError("voidSale failed: void_sale: sale is already void", "P0001");
  };
  const state = await decideSaleVoid("s1", "Wrong customer", deps);
  expect(state.status).toBe("refused");
  expect(state).toMatchObject({ message: expect.stringMatching(/^The sale wasn't voided\. .*already void/) });
});

it("a void that returns is voided, and passes the id and the reason to the write", async () => {
  const seen: unknown[] = [];
  const { deps } = spyVoid(operator);
  deps.write = async (_client, id, reason) => {
    seen.push(id, reason);
    return {};
  };
  expect(await decideSaleVoid("s1", "Wrong customer", deps)).toEqual({ status: "voided" });
  expect(seen).toEqual(["s1", "Wrong customer"]);
});
