"use server";

import { revalidatePath } from "next/cache";
import { NOT_ALLOWED, saveFailureMessage, voidFailureMessage } from "../../lib/failures";
import { parseReceiptForm, parseVoidReason, type ReceiptField } from "../../lib/receipt-input";
import {
  getStock,
  listFinishedPrices,
  listRawProducts,
  listVendors,
  type FinishedPrice,
  type ProductStock,
} from "../../lib/receiving";
import { receiveLot, voidReceipt as voidReceiptCall, type Lot } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { readFields } from "./form-fields";
import { priceView, stockView, type StockView } from "./stock-view";

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

const NOT_SAVED = "The receipt wasn't saved.";
const SIGNED_OUT = "You're signed out. Sign in again to save this receipt.";
const NOT_VOIDED = "The receipt wasn't voided.";
const VOID_SIGNED_OUT = "You're signed out. Sign in again to void this receipt.";

function refused(message: string): SaveState {
  return { status: "refused", message };
}

function priceChanges(
  before: { stock: ProductStock; prices: FinishedPrice[] },
  after: { stock: ProductStock; prices: FinishedPrice[] },
): PriceChange[] {
  return after.prices.map((row) => ({
    code: row.code,
    description: row.description,
    before: priceView(
      before.prices.find((candidate) => candidate.productId === row.productId),
      before.stock,
    ),
    after: priceView(row, after.stock),
  }));
}

// Everything a save reads before its write call, in one place so a single catch
// maps a failure in any of those calls. The save rules take every raw code, so a
// product made inactive after the page loaded reaches receive_lot and is refused
// there with its own reason.
async function readBeforeWrite(supabase: TypedClient, formData: FormData) {
  const rawProducts = await listRawProducts(supabase);
  const byCode = new Map(rawProducts.map((product) => [product.code, product]));
  const parsed = parseReceiptForm(readFields(formData), new Set(byCode.keys()));
  if (!parsed.ok) return { ok: false as const, errors: parsed.errors };
  const input = parsed.value;
  const product = byCode.get(input.productCode);
  if (!product) throw new Error(`parseReceiptForm accepted unknown code ${input.productCode}`);

  // "Before" is read here, ahead of the write, never worked out from "after".
  const [stockBefore, pricesBefore, vendors] = await Promise.all([
    getStock(supabase, product.id),
    listFinishedPrices(supabase, product.id),
    listVendors(supabase),
  ]);
  return { ok: true as const, input, product, stockBefore, pricesBefore, vendors };
}

// A server action is a public POST endpoint, so every argument is caller input.
// It settles who is calling first, then the form rules, then calls the engine
// with the signed-in session. The engine stays the authority on every refusal.
// A failure before the write call says the receipt wasn't saved; a write call
// that got no answer says it may not have been (src/lib/failures.ts).
export async function saveReceipt(formData: FormData): Promise<SaveState> {
  // Who is calling comes before any rule that reads through row-level security,
  // so a non-operator never sees a field error built from rows it cannot read.
  const caller = await checkCaller();
  if (caller.status === "ended") return refused(SIGNED_OUT);
  if (caller.status === "not-operator") return refused(`${NOT_SAVED} ${NOT_ALLOWED}`);
  if (caller.status === "failed") return refused(saveFailureMessage(caller.error, "before-write"));
  const { supabase } = caller;

  let prior;
  try {
    prior = await readBeforeWrite(supabase, formData);
  } catch (error) {
    return refused(saveFailureMessage(error, "before-write"));
  }
  if (!prior.ok) return { status: "invalid", fieldErrors: prior.errors };
  const { input, product, stockBefore, pricesBefore, vendors } = prior;

  let lot: Lot;
  try {
    lot = await receiveLot(supabase, {
      productId: product.id,
      vendorId: input.vendorId,
      weightLbs: input.weightLbs,
      unitCost: input.unitCost,
      received: input.receivedDate,
      notes: input.notes,
    });
  } catch (error) {
    return refused(saveFailureMessage(error, "write"));
  }

  // The lot is written. If this read fails, say so rather than throw: an error
  // would read as "not saved" and invite a second, duplicate receipt.
  let totals: Totals | null = null;
  try {
    const [stockAfter, pricesAfter] = await Promise.all([
      getStock(supabase, product.id),
      listFinishedPrices(supabase, product.id),
    ]);
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

  revalidatePath("/receiving");
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

// Voids one untouched receipt. The lot id is bound to the action where the list
// renders, and the reason comes from the dialog; a request can carry any value
// for either, so both are caller input. The engine decides whether the lot is
// still untouched, and its refusal is shown as is. A void has one call before
// the write call, the caller check; a write call that got no answer says the
// receipt may not have been voided (src/lib/failures.ts).
export async function voidReceipt(lotId: string, reason: string): Promise<VoidState> {
  const caller = await checkCaller();
  if (caller.status === "ended") return { status: "refused", message: VOID_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_VOIDED} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") {
    return { status: "refused", message: voidFailureMessage(caller.error, "before-write") };
  }

  const parsed = parseVoidReason(typeof reason === "string" ? reason : "");
  if (!parsed.ok) return { status: "invalid", error: parsed.error };

  try {
    await voidReceiptCall(caller.supabase, typeof lotId === "string" ? lotId : "", parsed.value);
  } catch (error) {
    return { status: "refused", message: voidFailureMessage(error, "write") };
  }

  revalidatePath("/receiving");
  return { status: "voided" };
}
