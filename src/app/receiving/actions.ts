"use server";

import { revalidatePath } from "next/cache";
import type { CorrectionFields } from "../../lib/correction-input";
import { actionFailureLogLine, correctionFailureMessage } from "../../lib/failures";
import { parseReceiptForm } from "../../lib/receipt-input";
import {
  getLatestCorrectionReason,
  getLotFigures,
  getStock,
  listActiveRawProducts,
  listBatchesMadeFrom,
  listFinishedPrices,
  listRawProducts,
  listVendors,
} from "../../lib/receiving";
import { correctReceipt as correctReceiptCall, receiveLot, voidReceipt as voidReceiptCall } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { type CallerOutcome } from "../sales/save-sale";
import { decideCorrection, type CorrectionSnapshot, type CorrectionState } from "./correct-receipt";
import { readFields, readRecheck } from "./form-fields";
import {
  decideReceiptSave,
  decideReceiptVoid,
  type ReceiptBeforeWrite,
  type SaveState,
  type VoidState,
} from "./save-receipt";

export type { CorrectionState } from "./correct-receipt";
export type { SaveState, Totals, VoidState } from "./save-receipt";

// Everything a save reads before its write call, in one place so a single catch
// maps a failure in any of those calls. For a code the page knew, the save rules
// take every raw code, so a product made inactive after the page loaded reaches
// receive_lot and is refused there with its own reason. For a code the form
// marked as missing from the page's product list, they take the active raw
// products as of now: an inactive code gets the field message, and one made
// active since the page loaded saves. The mark only picks which message a
// refused code gets; the engine refuses an inactive product either way.
async function readBeforeWrite(supabase: TypedClient, formData: FormData): Promise<ReceiptBeforeWrite> {
  const rawProducts = readRecheck(formData) ? await listActiveRawProducts(supabase) : await listRawProducts(supabase);
  const byCode = new Map(rawProducts.map((product) => [product.code, product]));
  const parsed = parseReceiptForm(readFields(formData), new Set(byCode.keys()));
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const input = parsed.value;
  const product = byCode.get(input.productCode);
  // Unreachable while the parse takes these codes. The message holds no form text, because it reaches the log.
  if (!product) throw new Error("parseReceiptForm accepted a code that is not in the product list");

  // "Before" is read here, ahead of the write, never worked out from "after".
  const [stockBefore, pricesBefore, vendors] = await Promise.all([
    getStock(supabase, product.id),
    listFinishedPrices(supabase, product.id),
    listVendors(supabase),
  ]);
  return { ok: true, input, product, stockBefore, pricesBefore, vendors };
}

// A server action is a public POST endpoint, so every argument is caller input.
// The decision (save-receipt.ts) settles the caller first, then the form rules,
// then calls the engine with the signed-in session; this wires the real calls.
export async function saveReceipt(formData: FormData): Promise<SaveState> {
  const state = await decideReceiptSave(formData, {
    caller,
    readBefore: readBeforeWrite,
    write: (client, { product, input }) =>
      receiveLot(client, {
        productId: product.id,
        vendorId: input.vendorId,
        weightLbs: input.weightLbs,
        unitCost: input.unitCost,
        received: input.receivedDate,
        notes: input.notes,
      }),
    readAfter: async (client, { product }) => {
      const [stockAfter, pricesAfter] = await Promise.all([
        getStock(client, product.id),
        listFinishedPrices(client, product.id),
      ]);
      return { stockAfter, pricesAfter };
    },
  });
  // A page render that follows a failed read would swap the form for the error
  // page and lose this panel, so the page is revalidated only once the totals
  // loaded. Otherwise the panel keeps the lot and says to reload.
  if (state.status === "saved" && state.totals) revalidatePath("/receiving");
  return state;
}

// Voids one untouched receipt. The lot id is bound to the action where the list
// renders, and the reason comes from the dialog; a request can carry any value
// for either, so both are caller input. The decision is in save-receipt.ts.
export async function voidReceipt(lotId: string, reason: string): Promise<VoidState> {
  const state = await decideReceiptVoid(typeof lotId === "string" ? lotId : "", typeof reason === "string" ? reason : "", {
    caller,
    write: voidReceiptCall,
  });
  if (state.status === "voided") revalidatePath("/receiving");
  return state;
}

async function caller(): Promise<CallerOutcome<TypedClient>> {
  const outcome = await checkCaller();
  return outcome.status === "operator" ? { status: "operator", client: outcome.supabase } : outcome;
}

async function snapshot(client: TypedClient, productId: string, lotId: string): Promise<Omit<CorrectionSnapshot, "lot">> {
  const [stock, prices, batches] = await Promise.all([
    getStock(client, productId),
    listFinishedPrices(client, productId),
    listBatchesMadeFrom(client, lotId),
  ]);
  return { stock, prices, batches };
}

// Corrects one receipt. The lot id is bound to the action where the list
// renders and the fields come from the dialog; a request can carry any value
// for either, so both are caller input. The decision (correct-receipt.ts)
// settles the caller first, reads the figures, runs the form rules, calls
// correct_receipt, and reads the figures again; every figure is the database's.
// Nothing here may reject: a rejected action would unmount the list.
export async function correctReceipt(lotId: string, fields: CorrectionFields): Promise<CorrectionState> {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  let state: CorrectionState;
  try {
    state = await decideCorrection(
      text(lotId),
      { cost: text(fields?.cost), weight: text(fields?.weight), reason: text(fields?.reason) },
      {
        caller,
        readBefore: async (client, id) => {
          const lot = await getLotFigures(client, id);
          return lot ? { lot, ...(await snapshot(client, lot.productId, id)) } : null;
        },
        write: (client, id, input) =>
          correctReceiptCall(client, { lotId: id, unitCost: input.unitCost, weightLbs: input.weightLbs, reason: input.reason }),
        readAfter: async (client, written) => {
          const [lot, rest, reason] = await Promise.all([
            getLotFigures(client, written.id),
            snapshot(client, written.product_id, written.id),
            getLatestCorrectionReason(client, written.id),
          ]);
          if (!lot) throw new Error("getLotFigures found no row for the corrected lot");
          if (reason === null) throw new Error("getLatestCorrectionReason found no row for the corrected lot");
          return { lot, ...rest, reason };
        },
      },
    );
  } catch (error) {
    console.error(actionFailureLogLine("correctReceipt", "before-write", error));
    return { status: "refused", message: correctionFailureMessage(error, "before-write") };
  }
  // A render that follows a failed read would swap the list for the error page
  // and lose the panel, so revalidate only once the details loaded.
  if (state.status === "corrected" && state.details) revalidatePath("/receiving");
  return state;
}
