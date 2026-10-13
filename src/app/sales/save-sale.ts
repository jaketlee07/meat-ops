// The sale save and void decisions, apart from the "use server" wrapper so Vitest
// can import them: nothing here touches next/*, server-only, or src/app/_server.
import {
  actionFailureLogLine,
  logMessage,
  NOT_ALLOWED,
  NOT_SAVED_SALE,
  NOT_VOIDED_SALE,
  saleSaveFailureMessage,
  saleVoidFailureMessage,
  type FailureStage,
} from "../../lib/failures";
import { parseVoidReason } from "../../lib/receipt-input";
import type { Sale } from "../../lib/rpc";
import type { SaleField, SaleFields, SaleInput } from "../../lib/sale-input";
import type { SaleSummary } from "../../lib/sales";
import type { TraceFinishedLot } from "../../lib/trace";

export interface SavedSale {
  id: string;
  saleNumber: string;
  saleDate: string;
  productCode: string;
  productDescription: string;
  // Null for a sale with no customer.
  customerName: string | null;
  // From the sale summary read after the write; absent when details is null.
  lbs?: number;
  pricePerLb?: number;
}

export interface SaleDetails {
  lots: TraceFinishedLot[];
  // Finished lbs on hand for the product, each as the database gave it. Two reads,
  // never one worked out from the other. Null where the menu view had no row.
  stock: { before: number | null; after: number | null };
}

export type SaleSaveState =
  | { status: "idle" }
  // A form rule refused the sale; nothing reached the database.
  | { status: "invalid"; fieldErrors: Partial<Record<SaleField, string>> }
  // The caller or the database refused the save; the message says why.
  | { status: "refused"; message: string }
  // Details are null only when the sale is written but the reads after it failed.
  | { status: "saved"; sale: SavedSale; details: SaleDetails | null };

export type SaleVoidState =
  // The reason rule refused the form; nothing reached the database.
  | { status: "invalid"; error: string }
  | { status: "refused"; message: string }
  | { status: "voided" };

export type CallerOutcome<C> =
  | { status: "operator"; client: C }
  | { status: "ended" }
  | { status: "not-operator" }
  | { status: "failed"; error: unknown };

export type SaleBeforeWrite =
  | { ok: false; errors: Partial<Record<SaleField, string>> }
  | {
      ok: true;
      input: SaleInput;
      product: { id: string; code: string; description: string };
      customerName: string | null;
      stockBefore: number | null;
    };

export type SaleReadyToWrite = Extract<SaleBeforeWrite, { ok: true }>;

export interface SaleAfterWrite {
  summary: SaleSummary;
  lots: TraceFinishedLot[];
  stockAfter: number | null;
}

export interface SaleSaveDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  readBefore: (client: C, fields: SaleFields) => Promise<SaleBeforeWrite>;
  write: (client: C, before: SaleReadyToWrite) => Promise<Sale>;
  readAfter: (client: C, sale: Sale, before: SaleReadyToWrite) => Promise<SaleAfterWrite>;
}

export interface SaleVoidDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  write: (client: C, saleId: string, reason: string) => Promise<unknown>;
}

const SIGNED_OUT = "You're signed out. Sign in again to save this sale.";
const VOID_SIGNED_OUT = "You're signed out. Sign in again to void this sale.";

function saveFailed(error: unknown, stage: FailureStage): SaleSaveState {
  console.error(actionFailureLogLine("saveSale", stage, error));
  return { status: "refused", message: saleSaveFailureMessage(error, stage) };
}

function voidFailed(error: unknown, stage: FailureStage): SaleVoidState {
  console.error(actionFailureLogLine("voidSale", stage, error));
  return { status: "refused", message: saleVoidFailureMessage(error, stage) };
}

// Settles who is calling first, then the form rules and the reads before the
// write, then the write, then the reads after it. A write that returned is a
// save even if the reads after it fail.
export async function decideSaleSave<C>(fields: SaleFields, deps: SaleSaveDeps<C>): Promise<SaleSaveState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_SAVED_SALE} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return saveFailed(caller.error, "before-write");
  const { client } = caller;

  let before: SaleBeforeWrite;
  try {
    before = await deps.readBefore(client, fields);
  } catch (error) {
    return saveFailed(error, "before-write");
  }
  if (!before.ok) return { status: "invalid", fieldErrors: before.errors };

  let sale: Sale;
  try {
    const written = await deps.write(client, before);
    // A write that resolves with no row is a write with no answer.
    if (!written) throw new Error("the write returned no sale");
    sale = written;
  } catch (error) {
    return saveFailed(error, "write");
  }

  const saved: SavedSale = {
    id: sale.id,
    saleNumber: sale.sale_number,
    saleDate: sale.sale_date,
    productCode: before.product.code,
    productDescription: before.product.description,
    customerName: before.customerName,
  };

  // The sale is written. If a read fails, say so rather than throw: an error
  // would read as "not saved" and invite a duplicate sale.
  try {
    const after = await deps.readAfter(client, sale, before);
    return {
      status: "saved",
      sale: { ...saved, lbs: after.summary.lbsSold, pricePerLb: after.summary.pricePerLb },
      details: { lots: after.lots, stock: { before: before.stockBefore, after: after.stockAfter } },
    };
  } catch (error) {
    // The error's message only: the log must hold no row data.
    console.error(`saveSale: reading the details after the write failed: ${logMessage(error)}`);
    return { status: "saved", sale: saved, details: null };
  }
}

export async function decideSaleVoid<C>(
  saleId: string,
  reason: string,
  deps: SaleVoidDeps<C>,
): Promise<SaleVoidState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: VOID_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_VOIDED_SALE} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return voidFailed(caller.error, "before-write");

  const parsed = parseVoidReason(reason);
  if (!parsed.ok) return { status: "invalid", error: parsed.error };

  try {
    await deps.write(caller.client, saleId, parsed.value);
  } catch (error) {
    return voidFailed(error, "write");
  }
  return { status: "voided" };
}
