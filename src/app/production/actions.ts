"use server";

import { revalidatePath } from "next/cache";
import { parseBatchForm } from "../../lib/batch-input";
import { batchSaveFailureMessage, logMessage } from "../../lib/failures";
import { getFinishedLot, listFinishedProducts, listLotsUsed } from "../../lib/production";
import { getStock } from "../../lib/receiving";
import { produceBatch } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { readFields } from "./form-fields";
import { decideSave, type CallerOutcome, type SaveState } from "./save-batch";

export type { SaveState } from "./save-batch";

async function caller(): Promise<CallerOutcome<TypedClient>> {
  const outcome = await checkCaller();
  return outcome.status === "operator" ? { status: "operator", client: outcome.supabase } : outcome;
}

// A server action is a public POST endpoint, so every argument is caller input.
// The rules and the product lookup run inside readBefore; decideSave takes each
// database call as an argument. The rules take every finished code, so a product
// made inactive after the page loaded reaches produce_batch and is refused there
// with its own reason. Nothing here may reject: a rejected action loses the form.
export async function saveBatch(formData: FormData): Promise<SaveState> {
  let state: SaveState;
  try {
    state = await decideSave(readFields(formData), {
      caller,
      readBefore: async (client, fields) => {
        const products = await listFinishedProducts(client);
        const byCode = new Map(products.map((product) => [product.code, product]));
        const parsed = parseBatchForm(fields, new Set(byCode.keys()));
        if (!parsed.ok) return { ok: false, errors: parsed.errors };
        const product = byCode.get(parsed.value.productCode);
        // Unreachable while the parse takes these codes. The message holds no form text, because it reaches the log.
        if (!product) throw new Error("parseBatchForm accepted a code that is not in the product list");
        if (!product.raw) throw new Error("the finished product has no raw input");
        return { ok: true, input: parsed.value, product, stockBefore: await getStock(client, product.raw.id) };
      },
      write: (client, { input, product }) =>
        produceBatch(client, {
          finishedProductId: product.id,
          rawLbsIn: input.rawLbs,
          finishedLbsOut: input.finishedLbs,
          productionDate: input.productionDate,
          notes: input.notes,
        }),
      readAfter: async (client, batch, { product }) => {
        const [lotsUsed, finishedLot, stockAfter] = await Promise.all([
          listLotsUsed(client, batch.id),
          getFinishedLot(client, batch.id),
          getStock(client, product.raw?.id ?? ""),
        ]);
        return { lotsUsed, finishedLot, stockAfter };
      },
    });
  } catch (error) {
    console.error(`saveBatch failed unexpectedly: ${logMessage(error)}`);
    return { status: "refused", message: batchSaveFailureMessage(error, "before-write") };
  }
  // Outside the try: once a batch is written, nothing here may turn it into
  // "wasn't saved". A page render that follows a failed read would swap the form
  // for the error page and lose the panel, so revalidate only once the totals loaded.
  if (state.status === "saved" && state.totals) revalidatePath("/production");
  return state;
}
