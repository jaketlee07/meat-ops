// The save and discard actions' decisions, apart from the "use server" wrapper so
// Vitest can import them: nothing here touches next/*, server-only, or
// src/app/_server. The browser imports the rules, the field names, and the state
// types, so it checks what the server will check.
import {
  actionFailureLogLine,
  CHOOSE_PRODUCT,
  CHOOSE_VENDOR,
  DISCARD_SIGNED_OUT,
  draftDiscardFailureMessage,
  draftSaveFailureMessage,
  logMessage,
  NO_LINE_TICKED,
  NOT_ALLOWED,
  NOT_DISCARDED,
  NOT_SAVED_RECEIPTS,
  RECEIPTS_SIGNED_OUT,
  type FailureStage,
} from "../../lib/failures";
import { isUuid } from "../../lib/invoices";
import { costError, receivedDateError, weightError } from "../../lib/receipt-input";
import type { ProductStock } from "../../lib/receiving";
import type { ConfirmLine, Lot } from "../../lib/rpc";
import { stockView, type StockView } from "../stock-view";

// ---- The form's fields ----

export const DRAFT_FIELD = "draftId";
export const TODAY_FIELD = "today";
// One hidden entry per line, in review order. Position i names the other fields of line i.
export const LINE_ID_FIELD = "lineId";
const SAVE_MARK = "1";

export const LINE_FIELDS = ["product", "vendor", "weight", "cost", "date"] as const;
export type LineField = (typeof LINE_FIELDS)[number];

// The field name for line `index` (0-based, review order). A ticked line sends its
// save mark and its five values; an unticked line sends only its id (AC-0090).
export const lineFieldName = (name: LineField | "save", index: number): string => `${name}.${index}`;

export interface LineInput {
  id: string;
  ticked: boolean;
  product: string;
  vendor: string;
  weight: string;
  cost: string;
  date: string;
}

export interface SaveRequest {
  draftId: string;
  today: string;
  lines: LineInput[];
}

function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// A server action is a public POST endpoint, so a missing or non-text entry
// reads as blank, because a caller can send anything. Only a ticked line's
// values are read.
export function readSaveFields(formData: FormData): SaveRequest {
  const ids = formData.getAll(LINE_ID_FIELD).map((id) => (typeof id === "string" ? id : ""));
  return {
    draftId: textOf(formData, DRAFT_FIELD),
    today: textOf(formData, TODAY_FIELD),
    lines: ids.map((id, index) => {
      const ticked = textOf(formData, lineFieldName("save", index)) === SAVE_MARK;
      const value = (field: LineField) => (ticked ? textOf(formData, lineFieldName(field, index)) : "");
      return {
        id,
        ticked,
        product: value("product"),
        vendor: value("vendor"),
        weight: value("weight"),
        cost: value("cost"),
        date: value("date"),
      };
    }),
  };
}

// The form as the browser sends it: every line's id, and for a ticked line its mark and values.
export function saveFormData(request: SaveRequest): FormData {
  const formData = new FormData();
  formData.set(DRAFT_FIELD, request.draftId);
  formData.set(TODAY_FIELD, request.today);
  request.lines.forEach((line, index) => {
    formData.append(LINE_ID_FIELD, line.id);
    if (!line.ticked) return;
    formData.set(lineFieldName("save", index), SAVE_MARK);
    for (const field of LINE_FIELDS) formData.set(lineFieldName(field, index), line[field]);
  });
  return formData;
}

export function discardFormData(draftId: string): FormData {
  const formData = new FormData();
  formData.set(DRAFT_FIELD, draftId);
  return formData;
}

export function readDiscardFields(formData: FormData): string {
  return textOf(formData, DRAFT_FIELD);
}

// ---- The rules ----

// Field messages by line position (0-based) and field.
export type FieldErrors = Record<number, Partial<Record<LineField, string>>>;

export type RuleOutcome =
  | { status: "invalid"; fieldErrors: FieldErrors }
  // Not beside a field: no line is ticked, or the save was refused or failed.
  | { status: "refused"; message: string };

// A picker's value is a row id. Blank is "Choose ..."; so is any text that is
// no id, which no picker sends.
const pickerError = (value: string, message: string): string | null => (isUuid(value) ? null : message);

// AC-0083 and AC-0084. Only ticked lines are checked; within one field the first
// matching row wins. Weight, cost, and date are Receiving's own rules.
export function checkSave(lines: readonly LineInput[], today: string): RuleOutcome | null {
  if (!lines.some((line) => line.ticked)) return { status: "refused", message: NO_LINE_TICKED };
  const fieldErrors: FieldErrors = {};
  lines.forEach((line, index) => {
    if (!line.ticked) return;
    const messages: Partial<Record<LineField, string>> = {};
    const found: Record<LineField, string | null> = {
      product: pickerError(line.product, CHOOSE_PRODUCT),
      vendor: pickerError(line.vendor, CHOOSE_VENDOR),
      weight: weightError(line.weight),
      cost: costError(line.cost),
      date: receivedDateError(line.date, today),
    };
    for (const field of LINE_FIELDS) {
      const message = found[field];
      if (message) messages[field] = message;
    }
    if (Object.keys(messages).length > 0) fieldErrors[index] = messages;
  });
  return Object.keys(fieldErrors).length > 0 ? { status: "invalid", fieldErrors } : null;
}

// ---- The states ----

export interface SavedLot {
  lotNumber: string;
  productCode: string;
  productDescription: string;
  vendorName: string;
  weightLbs: number;
  unitCost: number;
  receivedDate: string;
}

export interface ProductTotals {
  code: string;
  description: string;
  before: StockView;
  after: StockView;
}

export type SaveState =
  | { status: "idle" }
  // A rule refused the form, or the caller or the database refused or failed the save; the message says why.
  | RuleOutcome
  // Totals are null only when the lots are written but the reads after them failed.
  | { status: "saved"; lots: SavedLot[]; totals: ProductTotals[] | null };

export type DiscardState = { status: "refused"; message: string } | { status: "discarded" };

export type CallerOutcome<C> =
  | { status: "operator"; client: C }
  | { status: "ended" }
  | { status: "not-operator" }
  | { status: "failed"; error: unknown };

// What the save reads before its write call: each touched raw product's stock,
// and the names a result needs. The "before" stock is read here, never worked out
// from "after".
export interface BeforeWrite {
  products: Array<{ id: string; code: string; description: string; stock: ProductStock }>;
  vendors: Array<{ id: string; name: string }>;
}

export interface SaveDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  readBefore: (client: C, productIds: string[]) => Promise<BeforeWrite>;
  write: (client: C, draftId: string, lines: ConfirmLine[]) => Promise<Lot[]>;
  // One stock per given product, in the given order.
  readAfter: (client: C, productIds: string[]) => Promise<ProductStock[]>;
}

export interface DiscardDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  write: (client: C, draftId: string) => Promise<{ id: string } | null | undefined>;
}

function saveFailed(error: unknown, stage: FailureStage): SaveState {
  console.error(actionFailureLogLine("saveDraft", stage, error));
  return { status: "refused", message: draftSaveFailureMessage(error, stage) };
}

function discardFailed(error: unknown, stage: FailureStage): DiscardState {
  console.error(actionFailureLogLine("discardDraft", stage, error));
  return { status: "refused", message: draftDiscardFailureMessage(error, stage) };
}

// The spec's save outcome order: the session, the caller, a caller check that
// fails, the field rules, the reads before the write call, the write call, then
// the saved result. A write that returned is a save even if the reads after it fail.
export async function decideSave<C>(request: SaveRequest, deps: SaveDeps<C>): Promise<SaveState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: RECEIPTS_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_SAVED_RECEIPTS} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return saveFailed(caller.error, "before-write");
  const { client } = caller;

  const refusal = checkSave(request.lines, request.today);
  if (refusal) return refusal;

  const ticked = request.lines.filter((line) => line.ticked);
  // The raw products the lines touch, once each, in the order the lines first name them.
  const productIds = [...new Set(ticked.map((line) => line.product))];

  let before: BeforeWrite;
  try {
    before = await deps.readBefore(client, productIds);
  } catch (error) {
    return saveFailed(error, "before-write");
  }

  let lots: Lot[];
  try {
    const written = await deps.write(
      client,
      request.draftId,
      ticked.map((line) => ({
        lineId: line.id,
        productId: line.product,
        vendorId: line.vendor,
        weightLbs: line.weight,
        unitCost: line.cost,
        receivedDate: line.date,
      })),
    );
    // A write that resolves with no lot is a write with no answer (AC-0116).
    if (!Array.isArray(written) || written.length === 0) throw new Error("the write returned no lots");
    lots = written;
  } catch (error) {
    return saveFailed(error, "write");
  }

  const productOf = (id: string) => before.products.find((product) => product.id === id);
  const saved: SavedLot[] = lots.map((lot) => ({
    lotNumber: lot.lot_number,
    productCode: productOf(lot.product_id)?.code ?? "Unknown product",
    productDescription: productOf(lot.product_id)?.description ?? "",
    vendorName: before.vendors.find((vendor) => vendor.id === lot.vendor_id)?.name ?? "Unknown vendor",
    weightLbs: lot.weight_lbs,
    unitCost: lot.unit_cost,
    receivedDate: lot.received_date,
  }));

  // The lots are written. If a read fails, say so rather than throw: an error
  // would read as "not saved" and invite a second save.
  try {
    const after = await deps.readAfter(client, productIds);
    return {
      status: "saved",
      lots: saved,
      totals: productIds.map((id, index) => {
        const product = productOf(id);
        const stockAfter = after[index];
        // Unreachable while readAfter answers one stock per product.
        if (!product || !stockAfter) throw new Error("the stock reads do not match the touched products");
        return {
          code: product.code,
          description: product.description,
          before: stockView(product.stock),
          after: stockView(stockAfter),
        };
      }),
    };
  } catch (error) {
    // The error's message only: the log must hold no row data.
    console.error(`saveDraft: reading the totals after the write failed: ${logMessage(error)}`);
    return { status: "saved", lots: saved, totals: null };
  }
}

// The discard outcome order: the session, the caller, a caller check that fails,
// then the write call. Nothing is read before it.
export async function decideDiscard<C>(draftId: string, deps: DiscardDeps<C>): Promise<DiscardState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: DISCARD_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_DISCARDED} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return discardFailed(caller.error, "before-write");

  try {
    // A write that resolves with no row is a write with no answer (AC-0188).
    if (!(await deps.write(caller.client, draftId))) throw new Error("the write returned no draft");
  } catch (error) {
    return discardFailed(error, "write");
  }
  return { status: "discarded" };
}
