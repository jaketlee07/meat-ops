"use server";

import { revalidatePath } from "next/cache";
import { draftDiscardFailureMessage, draftSaveFailureMessage, logMessage, READ_TRY_AGAIN } from "../../lib/failures";
import { readCatalog } from "../../lib/invoices";
import { getStock, listRawProducts, listVendors } from "../../lib/receiving";
import { confirmImportDraft, createImportDraft, discardImportDraft } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { modelReady, readReceipt } from "../_server/model";
import { readPhotoFields, readTextFields } from "./form-fields";
import { decideRead, type CallerOutcome, type ReadRequest, type ReadState } from "./read-invoice";
import {
  decideDiscard,
  decideSave,
  readDiscardFields,
  readSaveFields,
  type DiscardState,
  type SaveState,
} from "./save-draft";

export type { ReadState } from "./read-invoice";
export type { DiscardState, SaveState } from "./save-draft";

async function caller(): Promise<CallerOutcome<TypedClient>> {
  const outcome = await checkCaller();
  return outcome.status === "operator" ? { status: "operator", client: outcome.supabase } : outcome;
}

// A server action is a public POST endpoint, so every field is caller input; the
// input rules run inside decideRead after the caller is settled. Nothing here
// may reject: a rejected action would lose the form's fields.
async function read(request: ReadRequest): Promise<ReadState> {
  let state: ReadState;
  try {
    state = await decideRead(request, {
      caller,
      modelReady,
      readCatalog,
      readModel: readReceipt,
      writeDraft: createImportDraft,
    });
  } catch (error) {
    console.error(`readInvoice failed unexpectedly: ${logMessage(error)}`);
    return { status: "refused", source: request.source, message: READ_TRY_AGAIN };
  }
  // Only after a draft is written. The browser then opens its review.
  if (state.status === "read") revalidatePath("/invoices");
  return state;
}

export async function readPhoto(formData: FormData): Promise<ReadState> {
  return read({ source: "photo", ...readPhotoFields(formData) });
}

export async function readText(formData: FormData): Promise<ReadState> {
  return read({ source: "text", ...readTextFields(formData) });
}

// A server action is a public POST endpoint, so every field is caller input. The
// rules run inside decideSave after the caller is settled. Nothing here may
// reject: a rejected action would lose the review's fields.
export async function saveDraft(formData: FormData): Promise<SaveState> {
  let state: SaveState;
  try {
    state = await decideSave(readSaveFields(formData), {
      caller,
      readBefore: async (client, productIds) => {
        // Every raw product, so one made inactive after the review loaded reaches
        // receive_lot and is refused there with its own reason (AC-0085).
        const [products, vendors, stocks] = await Promise.all([
          listRawProducts(client),
          listVendors(client),
          Promise.all(productIds.map((id) => getStock(client, id))),
        ]);
        return {
          products: productIds.flatMap((id, index) => {
            const product = products.find((candidate) => candidate.id === id);
            const stock = stocks[index];
            return product && stock ? [{ ...product, stock }] : [];
          }),
          vendors,
        };
      },
      write: confirmImportDraft,
      readAfter: (client, productIds) => Promise.all(productIds.map((id) => getStock(client, id))),
    });
  } catch (error) {
    console.error(`saveDraft failed unexpectedly: ${logMessage(error)}`);
    return { status: "refused", message: draftSaveFailureMessage(error, "before-write") };
  }
  // Outside the try: once the lots are written, nothing here may turn them into
  // "weren't saved". A page render that follows a failed read would swap the
  // review for the error page and lose the result, so revalidate only once the
  // totals loaded.
  if (state.status === "saved" && state.totals) revalidatePath("/invoices");
  return state;
}

export async function discardDraft(formData: FormData): Promise<DiscardState> {
  let state: DiscardState;
  try {
    state = await decideDiscard(readDiscardFields(formData), { caller, write: discardImportDraft });
  } catch (error) {
    console.error(`discardDraft failed unexpectedly: ${logMessage(error)}`);
    return { status: "refused", message: draftDiscardFailureMessage(error, "before-write") };
  }
  // Nothing is read after a discard, so a discard is always followed by a fresh page.
  if (state.status === "discarded") revalidatePath("/invoices");
  return state;
}
