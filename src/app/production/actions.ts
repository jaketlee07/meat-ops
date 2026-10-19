"use server";

import { revalidatePath } from "next/cache";
import { parseBatchForm } from "../../lib/batch-input";
import { actionFailureLogLine, batchSaveFailureMessage, logMessage, reversalFailureMessage } from "../../lib/failures";
import { getFinishedLot, listFinishedProducts, listLotsUsed, listSalesVoidedBy } from "../../lib/production";
import { getStock } from "../../lib/receiving";
import { produceBatch, reverseBatch as reverseBatchCall } from "../../lib/rpc";
import { getFinishedOnHand } from "../../lib/sales";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { readFields } from "./form-fields";
import { decideReversal, type ReversalState, type ReversalStock } from "./reverse-batch";
import { decideSave, type CallerOutcome, type SaveState } from "./save-batch";

export type { ReversalState } from "./reverse-batch";
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

// The raw input's stock and the finished lbs on hand of one finished product,
// as the database holds them now.
async function readStocks(client: TypedClient, finishedProductId: string): Promise<ReversalStock> {
  const products = await listFinishedProducts(client);
  const rawId = products.find((product) => product.id === finishedProductId)?.raw?.id;
  if (!rawId) throw new Error("the finished product has no raw input");
  const [raw, finishedLbs] = await Promise.all([getStock(client, rawId), getFinishedOnHand(client, finishedProductId)]);
  return { raw, finishedLbs };
}

// Reverses one batch. The batch id and its finished product's id are bound to
// the action where the list renders, and the reason comes from the dialog; a
// request can carry any value for any of them, so all are caller input. The
// ids only choose which stock the panel reads; the engine decides the reversal.
// The decision (reverse-batch.ts) settles the caller first, reads the stock,
// runs the reason rule, calls reverse_batch, and reads the stock again and the
// sales the reversal voided. Nothing here may reject: a rejected action would
// unmount the list and lose the panel.
export async function reverseBatch(batchId: string, finishedProductId: string, reason: string): Promise<ReversalState> {
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  let state: ReversalState;
  try {
    state = await decideReversal(text(batchId), text(reason), {
      caller,
      readBefore: async (client) => ({ stock: await readStocks(client, text(finishedProductId)) }),
      write: (client, id, why) => reverseBatchCall(client, id, why),
      readAfter: async (client, batch) => {
        const [stock, voidedSales] = await Promise.all([
          readStocks(client, batch.finished_product_id),
          listSalesVoidedBy(client, batch.id),
        ]);
        return { stock, voidedSales };
      },
    });
  } catch (error) {
    console.error(actionFailureLogLine("reverseBatch", "before-write", error));
    return { status: "refused", message: reversalFailureMessage(error, "before-write") };
  }
  // A render that follows a failed read would swap the list for the error page
  // and lose the panel, so revalidate only once the details loaded. A product
  // made inactive since the page loaded has no finished lbs on hand (the menu
  // has no row for it), and the page leaves an inactive product out, so a render
  // would drop the region that holds the panel; the panel stays and the list
  // updates on the next load.
  if (state.status === "reversed" && state.details && state.details.after.stock.finishedLbs !== null) {
    revalidatePath("/production");
  }
  return state;
}
