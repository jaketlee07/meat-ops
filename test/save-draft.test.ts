import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  checkSave,
  decideDiscard,
  decideSave,
  discardFormData,
  readDiscardFields,
  readSaveFields,
  saveFormData,
  type DiscardDeps,
  type LineInput,
  type SaveDeps,
  type SaveRequest,
  type SaveState,
} from "../src/app/invoices/save-draft.js";
import { draftDiscardFailureMessage, draftSaveFailureMessage } from "../src/lib/failures.js";
import { RpcError, type Lot } from "../src/lib/rpc.js";

const DRAFT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LINE_1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LINE_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ZERO = "00000000-0000-0000-0000-000000000000";
const TOM = "22222222-2222-2222-2222-222222222222";
const CHK = "55555555-5555-5555-5555-555555555555";
const REYES = "11111111-1111-1111-1111-111111111111";
const TODAY = "2026-10-09";

const line = (id: string, over: Partial<LineInput> = {}): LineInput => ({
  id,
  ticked: true,
  product: TOM,
  vendor: REYES,
  weight: "5000",
  cost: "1.68",
  date: "2026-10-01",
  ...over,
});
const request = (...lines: LineInput[]): SaveRequest => ({ draftId: DRAFT, today: TODAY, lines });

const stock = (qtyOnHand: number, movingAvgCost: number) => ({
  balance: { qtyOnHand, movingAvgCost },
  nonVoidReceipts: 1,
});

const lot = (number: string, productId: string, weight: number, cost: number, date: string) =>
  ({
    lot_number: number,
    product_id: productId,
    vendor_id: REYES,
    weight_lbs: weight,
    unit_cost: cost,
    received_date: date,
  }) as Lot;

const TRY_AGAIN = "The receipts weren't saved. Try again in a moment.";

function spyDeps(caller: SaveDeps<null>["caller"] = async () => ({ status: "operator", client: null })) {
  const calls: string[] = [];
  const written: Array<{ draftId: string; lines: unknown[] }> = [];
  const deps: SaveDeps<null> = {
    caller,
    readBefore: async (_client, productIds) => {
      calls.push(`readBefore ${productIds.join(",")}`);
      return {
        products: productIds.map((id) => ({
          id,
          code: id === TOM ? "RAW-TOM" : "RAW-CHK",
          description: id === TOM ? "Turkey Drums TOM (raw)" : "Chicken Thighs (raw)",
          stock: stock(id === TOM ? 0 : 100, 1.5),
        })),
        vendors: [{ id: REYES, name: "Reyes Meats" }],
      };
    },
    write: async (_client, draftId, lines) => {
      calls.push("write");
      written.push({ draftId, lines });
      return [lot("L-0001", TOM, 5000, 1.68, "2026-10-01"), lot("L-0002", TOM, 3000, 1.8, "2026-10-05")];
    },
    readAfter: async (_client, productIds) => {
      calls.push("readAfter");
      return productIds.map(() => stock(8000, 1.725));
    },
  };
  return { calls, written, deps };
}

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  log = vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  log.mockRestore();
});

const TWO = request(line(LINE_1), line(LINE_2, { weight: "3000", cost: "1.80", date: "2026-10-05" }));

// ---- Save outcome order ----

it("AC-0088: an ended session refuses and calls nothing", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "ended" }));
  expect(await decideSave(TWO, deps)).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to save these receipts.",
  });
  expect(calls).toEqual([]);
});

it("AC-0087: a non-operator is refused and nothing is called", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "not-operator" }));
  expect(await decideSave(TWO, deps)).toEqual({
    status: "refused",
    message: "The receipts weren't saved. This account isn't allowed to use Meat Ops.",
  });
  expect(calls).toEqual([]);
});

it("AC-0097, AC-0118: a failed caller check says try again, calls nothing, and logs one line", async () => {
  const { calls, deps } = spyDeps(async () => ({ status: "failed", error: new Error("fetch failed") }));
  expect(await decideSave(TWO, deps)).toEqual({ status: "refused", message: TRY_AGAIN });
  expect(calls).toEqual([]);
  expect(log).toHaveBeenCalledWith("saveDraft failed at before-write: fetch failed");
});

it("AC-0088 beats the rules: an ended session with a blank form is still signed out", async () => {
  const { deps } = spyDeps(async () => ({ status: "ended" }));
  expect((await decideSave(request(line(LINE_1, { ticked: false })), deps)).status).toBe("refused");
  expect(await decideSave(request(line(LINE_1, { ticked: false })), deps)).toMatchObject({
    message: "You're signed out. Sign in again to save these receipts.",
  });
});

it("AC-0084: no ticked line says to tick one and calls nothing after the caller check", async () => {
  const { calls, deps } = spyDeps();
  const state = await decideSave(request(line(LINE_1, { ticked: false, weight: "" })), deps);
  expect(state).toEqual({ status: "refused", message: "Tick at least one line to save." });
  expect(calls).toEqual([]);
  expect(await decideSave(request(), deps)).toEqual(state);
});

it("AC-0083: a field refusal comes back by line and field, with no read and no write", async () => {
  const { calls, deps } = spyDeps();
  const state = await decideSave(request(line(LINE_1), line(LINE_2, { product: "", weight: "" })), deps);
  expect(state).toEqual({
    status: "invalid",
    fieldErrors: { 1: { product: "Choose a product.", weight: "Enter the weight in lbs, like 5000 or 32.5." } },
  });
  expect(calls).toEqual([]);
});

it("AC-0097: a stock read before the write that fails says try again and writes nothing", async () => {
  const { calls, deps } = spyDeps();
  deps.readBefore = async () => {
    throw new Error("getStock failed: fetch failed");
  };
  expect(await decideSave(TWO, deps)).toEqual({ status: "refused", message: TRY_AGAIN });
  expect(calls).toEqual([]);
  expect(log).toHaveBeenCalledWith("saveDraft failed at before-write: getStock failed: fetch failed");
});

// ---- The rules ----

const WEIGHT_FORMAT = "Enter the weight in lbs, like 5000 or 32.5.";
const COST_FORMAT = "Enter the cost per lb, like 1.68.";
const RULES: Array<[keyof LineInput, string, string]> = [
  ["product", "", "Choose a product."],
  ["product", "not an id", "Choose a product."],
  ["vendor", "", "Choose a vendor."],
  ["weight", "", WEIGHT_FORMAT],
  ["weight", "5,000", WEIGHT_FORMAT],
  ["weight", "-5", WEIGHT_FORMAT],
  ["weight", "1.2345", "Use at most 3 decimal places for weight."],
  ["weight", "0.0000", "Use at most 3 decimal places for weight."],
  ["weight", "0", "Weight must be above 0."],
  ["weight", "0.0", "Weight must be above 0."],
  ["weight", "000", "Weight must be above 0."],
  ["cost", "", COST_FORMAT],
  ["cost", "-1", COST_FORMAT],
  ["cost", "1.68555", "Use at most 4 decimal places for cost."],
  ["date", "", "Enter the received date."],
  ["date", "2026-10-10", "The received date can't be after today."],
];

for (const [field, input, message] of RULES) {
  it(`AC-0083: ${field} ${JSON.stringify(input)} on a ticked line is refused with its message`, () => {
    expect(checkSave([line(LINE_1, { [field]: input })], TODAY)).toEqual({
      status: "invalid",
      fieldErrors: { 0: { [field]: message } },
    });
  });
}

it("AC-0083: the weight, cost, and date Receiving accepts pass, and the first matching row wins", () => {
  const accepted = { weight: "0.001", cost: "0", date: TODAY };
  expect(checkSave([line(LINE_1, accepted)], TODAY)).toBeNull();
  expect(checkSave([line(LINE_1, { weight: "32.125", cost: "1.6855" })], TODAY)).toBeNull();
  expect(checkSave([line(LINE_1, { weight: ".5" })], TODAY)).toBeNull();
});

it("AC-0090: an unticked line is never checked, and its values are never read", () => {
  const rules = checkSave([line(LINE_1), line(LINE_2, { ticked: false, product: "", weight: "x", date: "" })], TODAY);
  expect(rules).toBeNull();
});

// ---- The write call ----

it("AC-0082, AC-0091, AC-0100: the ticked lines go as typed, and the result carries the lots and stock", async () => {
  const { calls, written, deps } = spyDeps();
  const state = await decideSave(TWO, deps);
  expect(written).toEqual([
    {
      draftId: DRAFT,
      lines: [
        { lineId: LINE_1, productId: TOM, vendorId: REYES, weightLbs: "5000", unitCost: "1.68", receivedDate: "2026-10-01" },
        { lineId: LINE_2, productId: TOM, vendorId: REYES, weightLbs: "3000", unitCost: "1.80", receivedDate: "2026-10-05" },
      ],
    },
  ]);
  // One product, read once before and once after.
  expect(calls).toEqual([`readBefore ${TOM}`, "write", "readAfter"]);
  expect(state).toEqual({
    status: "saved",
    lots: [
      {
        lotNumber: "L-0001",
        productCode: "RAW-TOM",
        productDescription: "Turkey Drums TOM (raw)",
        vendorName: "Reyes Meats",
        weightLbs: 5000,
        unitCost: 1.68,
        receivedDate: "2026-10-01",
      },
      {
        lotNumber: "L-0002",
        productCode: "RAW-TOM",
        productDescription: "Turkey Drums TOM (raw)",
        vendorName: "Reyes Meats",
        weightLbs: 3000,
        unitCost: 1.8,
        receivedDate: "2026-10-05",
      },
    ],
    totals: [
      {
        code: "RAW-TOM",
        description: "Turkey Drums TOM (raw)",
        before: { qtyOnHand: 0, averageCost: 1.5 },
        after: { qtyOnHand: 8000, averageCost: 1.725 },
      },
    ],
  });
});

it("AC-0090: an unticked line is not sent, and each touched product is read once", async () => {
  const { calls, written, deps } = spyDeps();
  await decideSave(request(line(LINE_1), line(LINE_2, { product: CHK }), line(ZERO, { ticked: false, weight: "" })), deps);
  expect(calls[0]).toBe(`readBefore ${TOM},${CHK}`);
  expect(written[0]?.lines).toHaveLength(2);
});

it("AC-0085: a ticked line whose product went inactive names the line", async () => {
  const { deps } = spyDeps();
  deps.write = async () => {
    throw new RpcError(`confirmImportDraft failed: line 2: receive_lot: product ${TOM} is inactive`, "P0001");
  };
  expect(await decideSave(TWO, deps)).toEqual({
    status: "refused",
    message: "The receipts weren't saved. Line 2: This product is no longer active.",
  });
  expect(log).toHaveBeenCalledWith(
    `saveDraft failed at write: confirmImportDraft failed: line 2: receive_lot: product ${TOM} is inactive (code P0001)`,
  );
});

it("AC-0086: a draft that was saved or discarded says so", async () => {
  const { deps } = spyDeps();
  deps.write = async () => {
    throw new RpcError(
      `confirmImportDraft failed: confirm_import_draft: draft ${DRAFT} is already saved or discarded`,
      "P0001",
    );
  };
  expect(await decideSave(TWO, deps)).toEqual({
    status: "refused",
    message: "The receipts weren't saved. This draft was already saved or discarded.",
  });
});

it("AC-0059: any other refusal shows the engine's text after its prefix", async () => {
  const { deps } = spyDeps();
  deps.write = async () => {
    throw new RpcError(`confirmImportDraft failed: confirm_import_draft: line ${ZERO} is not in this draft`, "P0001");
  };
  expect(await decideSave(request(line(ZERO)), deps)).toEqual({
    status: "refused",
    message: `The receipts weren't saved. line ${ZERO} is not in this draft`,
  });
});

it("AC-0059: a line refusal of another kind keeps its line prefix", () => {
  expect(
    draftSaveFailureMessage(
      new RpcError("confirmImportDraft failed: line 1: receive_lot: weight must be above 0", "P0001"),
      "write",
    ),
  ).toBe("The receipts weren't saved. line 1: receive_lot: weight must be above 0");
});

it("AC-0087: a 42501 refusal from the write says the account is not allowed", async () => {
  const { deps } = spyDeps();
  deps.write = async () => {
    throw new RpcError("confirmImportDraft failed: permission denied", "42501");
  };
  expect(await decideSave(TWO, deps)).toEqual({
    status: "refused",
    message: "The receipts weren't saved. This account isn't allowed to use Meat Ops.",
  });
});

it("AC-0116: a write with no code, or with no lots, says the receipts may have been saved", async () => {
  const unknown = {
    status: "refused",
    message: "The receipts may have been saved. Reload this page to check the draft before saving again.",
  };
  const dropped = spyDeps().deps;
  dropped.write = async () => {
    throw new Error("confirmImportDraft failed: fetch failed");
  };
  expect(await decideSave(TWO, dropped)).toEqual(unknown);
  const empty = spyDeps().deps;
  empty.write = async () => [];
  expect(await decideSave(TWO, empty)).toEqual(unknown);
});

it("AC-0082: a read after the write fails, so the receipts are saved with no totals", async () => {
  const { deps } = spyDeps();
  deps.readAfter = async () => {
    throw new Error("getStock failed: permission denied");
  };
  const state: SaveState = await decideSave(TWO, deps);
  expect(state).toMatchObject({ status: "saved", totals: null });
  expect(state.status === "saved" && state.lots).toHaveLength(2);
  expect(log).toHaveBeenCalledWith("saveDraft: reading the totals after the write failed: getStock failed: permission denied");
});

// ---- The form ----

it("AC-0090: an unticked line posts only its id, and the server reads only ticked values", () => {
  const sent = request(line(LINE_1), line(LINE_2, { ticked: false, weight: "" }));
  const formData = saveFormData(sent);
  const names = [...formData.keys()];
  expect(names).toContain("save.0");
  expect(names.filter((name) => name.endsWith(".1"))).toEqual([]);
  expect(formData.getAll("lineId")).toEqual([LINE_1, LINE_2]);
  expect(readSaveFields(formData)).toEqual({
    draftId: DRAFT,
    today: TODAY,
    lines: [line(LINE_1), { id: LINE_2, ticked: false, product: "", vendor: "", weight: "", cost: "", date: "" }],
  });
});

it("a hand-made form is read as caller input: a file, a missing field, and a mark on no line read as blank", () => {
  const formData = new FormData();
  formData.set("draftId", new File(["x"], "x.txt"));
  formData.append("lineId", LINE_1);
  formData.set("save.0", "1");
  formData.set("weight.0", new File(["5"], "w.txt"));
  formData.set("save.5", "1");
  expect(readSaveFields(formData)).toEqual({
    draftId: "",
    today: "",
    lines: [{ id: LINE_1, ticked: true, product: "", vendor: "", weight: "", cost: "", date: "" }],
  });
});

// ---- Discard ----

function discardDeps(caller: DiscardDeps<null>["caller"] = async () => ({ status: "operator", client: null })) {
  const calls: string[] = [];
  const deps: DiscardDeps<null> = {
    caller,
    write: async (_client, draftId) => {
      calls.push(`write ${draftId}`);
      return { id: draftId };
    },
  };
  return { calls, deps };
}

it("AC-0092: a discard writes the draft id and says it is discarded", async () => {
  const { calls, deps } = discardDeps();
  expect(await decideDiscard(DRAFT, deps)).toEqual({ status: "discarded" });
  expect(calls).toEqual([`write ${DRAFT}`]);
  expect(readDiscardFields(discardFormData(DRAFT))).toBe(DRAFT);
});

it("AC-0096: an ended session refuses a discard and calls nothing", async () => {
  const { calls, deps } = discardDeps(async () => ({ status: "ended" }));
  expect(await decideDiscard(DRAFT, deps)).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to discard this draft.",
  });
  expect(calls).toEqual([]);
});

it("AC-0187: a non-operator's discard is refused and calls nothing", async () => {
  const { calls, deps } = discardDeps(async () => ({ status: "not-operator" }));
  expect(await decideDiscard(DRAFT, deps)).toEqual({
    status: "refused",
    message: "The draft wasn't discarded. This account isn't allowed to use Meat Ops.",
  });
  expect(calls).toEqual([]);
});

it("AC-0097: a failed caller check says try again, calls nothing, and logs one line", async () => {
  const { calls, deps } = discardDeps(async () => ({ status: "failed", error: new Error("fetch failed") }));
  expect(await decideDiscard(DRAFT, deps)).toEqual({
    status: "refused",
    message: "The draft wasn't discarded. Try again in a moment.",
  });
  expect(calls).toEqual([]);
  expect(log).toHaveBeenCalledWith("discardDraft failed at before-write: fetch failed");
});

it("AC-0188: a write with no code, or with no row, says the draft may have been discarded", async () => {
  const unknown = { status: "refused", message: "The draft may have been discarded. Reload this page to check it." };
  const dropped = discardDeps().deps;
  dropped.write = async () => {
    throw new Error("discardImportDraft failed: fetch failed");
  };
  expect(await decideDiscard(DRAFT, dropped)).toEqual(unknown);
  const empty = discardDeps().deps;
  empty.write = async () => null;
  expect(await decideDiscard(DRAFT, empty)).toEqual(unknown);
});

it("AC-0095: a draft that was saved or discarded says so", async () => {
  const { deps } = discardDeps();
  deps.write = async () => {
    throw new RpcError(
      `discardImportDraft failed: discard_import_draft: draft ${DRAFT} is already saved or discarded`,
      "P0001",
    );
  };
  expect(await decideDiscard(DRAFT, deps)).toEqual({
    status: "refused",
    message: "The draft wasn't discarded. It was already saved or discarded.",
  });
});

it("AC-0189: any other refusal shows the engine's text after its prefix", async () => {
  const { deps } = discardDeps();
  deps.write = async () => {
    throw new RpcError(`discardImportDraft failed: discard_import_draft: draft ${ZERO} not found`, "P0001");
  };
  expect(await decideDiscard(ZERO, deps)).toEqual({
    status: "refused",
    message: `The draft wasn't discarded. draft ${ZERO} not found`,
  });
});

it("a 42501 refusal from the discard write says the account is not allowed", () => {
  expect(draftDiscardFailureMessage(new RpcError("discardImportDraft failed: permission denied", "42501"), "write")).toBe(
    "The draft wasn't discarded. This account isn't allowed to use Meat Ops.",
  );
});
