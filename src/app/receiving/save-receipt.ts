// The receipt save and void decisions, apart from the "use server" wrapper so Vitest
// can import them: nothing here touches next/*, server-only, or src/app/_server.
import {
  actionFailureLogLine,
  NOT_ALLOWED,
  NOT_SAVED,
  NOT_VOIDED,
  saveFailureMessage,
  voidFailureMessage,
  type FailureStage,
} from "../../lib/failures";
import {
  parseVoidReason,
  type ReceiptField,
  type ReceiptInput,
} from "../../lib/receipt-input";
import type { FinishedPrice, ProductStock, RawProduct, Vendor } from "../../lib/receiving";
import type { Lot } from "../../lib/rpc";
import type { CallerOutcome } from "../sales/save-sale";
import { stockView, type StockView } from "../stock-view";
import { priceChanges } from "./totals";

export interface SavedLot {
  lotNumber: string;
  productCode: string;
  productDescription: string;
  vendorName: string;
  receivedDate: string;
  weightLbs: number;
  unitCost: number;
}

export interface PriceChange {
  code: string;
  description: string;
  // Null where there is no price to show.
  before: number | null;
  after: number | null;
}

export interface Totals {
  stock: { before: StockView; after: StockView };
  prices: PriceChange[];
}

export type SaveState =
  | { status: "idle" }
  // An AC-0010 rule refused the form; nothing reached the database.
  | { status: "invalid"; fieldErrors: Partial<Record<ReceiptField, string>> }
  // The caller or the database refused the save; the message says why.
  | { status: "refused"; message: string }
  // Totals are null only when the lot is written but the second read failed.
  | { status: "saved"; lot: SavedLot; totals: Totals | null };

export type VoidState =
  // The reason rule refused the form (AC-0051); nothing reached the database.
  | { status: "invalid"; error: string }
  // The caller or the database refused the void; the message says why.
  | { status: "refused"; message: string }
  | { status: "voided" };

export type ReceiptBeforeWrite =
  | { ok: false; errors: Partial<Record<ReceiptField, string>> }
  | {
      ok: true;
      input: ReceiptInput;
      product: Pick<RawProduct, "id" | "code" | "description">;
      stockBefore: ProductStock;
      pricesBefore: FinishedPrice[];
      vendors: Vendor[];
    };

export type ReceiptReadyToWrite = Extract<ReceiptBeforeWrite, { ok: true }>;

export interface ReceiptSaveDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  readBefore: (client: C, formData: FormData) => Promise<ReceiptBeforeWrite>;
  write: (client: C, ready: ReceiptReadyToWrite) => Promise<Lot>;
  readAfter: (
    client: C,
    ready: ReceiptReadyToWrite,
  ) => Promise<{ stockAfter: ProductStock; pricesAfter: FinishedPrice[] }>;
}

export interface ReceiptVoidDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  write: (client: C, lotId: string, reason: string) => Promise<unknown>;
}

const SIGNED_OUT = "You're signed out. Sign in again to save this receipt.";
const VOID_SIGNED_OUT = "You're signed out. Sign in again to void this receipt.";

function refused(message: string): SaveState {
  return { status: "refused", message };
}

// A failure that becomes a screen message also leaves one server log line, so a
// message that reads "Try again in a moment." on every try can still be traced.
function saveFailed(error: unknown, stage: FailureStage): SaveState {
  console.error(actionFailureLogLine("saveReceipt", stage, error));
  return refused(saveFailureMessage(error, stage));
}

function voidFailed(error: unknown, stage: FailureStage): VoidState {
  console.error(actionFailureLogLine("voidReceipt", stage, error));
  return { status: "refused", message: voidFailureMessage(error, stage) };
}

// A server action is a public POST endpoint, so every argument is caller input.
// It settles who is calling first, then the form rules, then calls the engine
// with the signed-in session. The engine stays the authority on every refusal.
// A failure before the write call says the receipt wasn't saved; a write call
// that got no answer says it may not have been (src/lib/failures.ts).
export async function decideReceiptSave<C>(formData: FormData, deps: ReceiptSaveDeps<C>): Promise<SaveState> {
  // Who is calling comes before any rule that reads through row-level security,
  // so a non-operator never sees a field error built from rows it cannot read.
  const caller = await deps.caller();
  if (caller.status === "ended") return refused(SIGNED_OUT);
  if (caller.status === "not-operator") return refused(`${NOT_SAVED} ${NOT_ALLOWED}`);
  if (caller.status === "failed") return saveFailed(caller.error, "before-write");
  const { client } = caller;

  let prior: ReceiptBeforeWrite;
  try {
    prior = await deps.readBefore(client, formData);
  } catch (error) {
    return saveFailed(error, "before-write");
  }
  if (!prior.ok) return { status: "invalid", fieldErrors: prior.errors };
  const { product, stockBefore, pricesBefore, vendors } = prior;

  let lot: Lot;
  try {
    lot = await deps.write(client, prior);
  } catch (error) {
    return saveFailed(error, "write");
  }

  // The lot is written. If this read fails, say so rather than throw: an error
  // would read as "not saved" and invite a second, duplicate receipt.
  let totals: Totals | null = null;
  try {
    const { stockAfter, pricesAfter } = await deps.readAfter(client, prior);
    totals = {
      stock: { before: stockView(stockBefore), after: stockView(stockAfter) },
      prices: priceChanges(
        { stock: stockBefore, prices: pricesBefore },
        { stock: stockAfter, prices: pricesAfter },
      ),
    };
  } catch (error) {
    // The error's message only: the log must hold no row data.
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`saveReceipt: reading the totals after the write failed: ${reason}`);
    totals = null;
  }

  return {
    status: "saved",
    lot: {
      lotNumber: lot.lot_number,
      productCode: product.code,
      productDescription: product.description,
      vendorName: vendors.find((vendor) => vendor.id === lot.vendor_id)?.name ?? "Unknown vendor",
      receivedDate: lot.received_date,
      weightLbs: lot.weight_lbs,
      unitCost: lot.unit_cost,
    },
    totals,
  };
}

// Voids one untouched receipt. The engine decides whether the lot is still
// untouched, and its refusal is shown as is. A void has one call before the
// write call, the caller check; a write call that got no answer says the
// receipt may not have been voided (src/lib/failures.ts).
export async function decideReceiptVoid<C>(
  lotId: string,
  reason: string,
  deps: ReceiptVoidDeps<C>,
): Promise<VoidState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: VOID_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_VOIDED} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return voidFailed(caller.error, "before-write");

  const parsed = parseVoidReason(reason);
  if (!parsed.ok) return { status: "invalid", error: parsed.error };

  try {
    await deps.write(caller.client, lotId, parsed.value);
  } catch (error) {
    return voidFailed(error, "write");
  }
  return { status: "voided" };
}
