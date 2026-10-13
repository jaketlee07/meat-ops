"use server";

import { revalidatePath } from "next/cache";
import { logMessage, READ_TRY_AGAIN } from "../../lib/failures";
import { readCatalog } from "../../lib/invoices";
import { createImportDraft } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { modelReady, readReceipt } from "../_server/model";
import { readPhotoFields, readTextFields } from "./form-fields";
import { decideRead, type CallerOutcome, type ReadRequest, type ReadState } from "./read-invoice";

export type { ReadState } from "./read-invoice";

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
