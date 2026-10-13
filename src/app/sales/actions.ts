"use server";

import { revalidatePath } from "next/cache";
import {
  actionFailureLogLine,
  saleSaveFailureMessage,
  saleVoidFailureMessage,
} from "../../lib/failures";
import { listFinishedProducts } from "../../lib/production";
import { recordSale, voidSale as voidSaleCall } from "../../lib/rpc";
import { parseSaleForm } from "../../lib/sale-input";
import { getFinishedOnHand, getSaleSummary, listCustomers } from "../../lib/sales";
import type { TypedClient } from "../../lib/supabase";
import { listSaleLots } from "../../lib/trace";
import { checkCaller } from "../_server/caller";
import { readFields } from "./form-fields";
import {
  decideSaleSave,
  decideSaleVoid,
  type CallerOutcome,
  type SaleSaveState,
  type SaleVoidState,
} from "./save-sale";

export type { SaleSaveState, SaleVoidState } from "./save-sale";

async function caller(): Promise<CallerOutcome<TypedClient>> {
  const outcome = await checkCaller();
  return outcome.status === "operator" ? { status: "operator", client: outcome.supabase } : outcome;
}

// A server action is a public POST endpoint, so every argument is caller input.
// The rules take every finished code, so a product made inactive after the page
// loaded reaches record_sale and is refused there with its own reason. Nothing
// here may reject: a rejected action loses the form.
export async function saveSale(formData: FormData): Promise<SaleSaveState> {
  let state: SaleSaveState;
  try {
    state = await decideSaleSave(readFields(formData), {
      caller,
      readBefore: async (client, fields) => {
        const [products, customers] = await Promise.all([listFinishedProducts(client), listCustomers(client)]);
        const byCode = new Map(products.map((product) => [product.code, product]));
        const customerById = new Map(customers.map((customer) => [customer.id, customer]));
        const parsed = parseSaleForm(fields, new Set(byCode.keys()), new Set(customerById.keys()));
        if (!parsed.ok) return { ok: false, errors: parsed.errors };
        const product = byCode.get(parsed.value.productCode);
        // Unreachable while the parse takes these codes. The message holds no form text, because it reaches the log.
        if (!product) throw new Error("parseSaleForm accepted a code that is not in the product list");
        const customerName = parsed.value.customerId ? (customerById.get(parsed.value.customerId)?.name ?? null) : null;
        return {
          ok: true,
          input: parsed.value,
          product: { id: product.id, code: product.code, description: product.description },
          customerName,
          stockBefore: await getFinishedOnHand(client, product.id),
        };
      },
      write: (client, { input, product }) =>
        recordSale(client, {
          finishedProductId: product.id,
          lbs: input.lbs,
          pricePerLb: input.pricePerLb,
          customerId: input.customerId,
          saleDate: input.saleDate,
        }),
      readAfter: async (client, sale, { product }) => {
        const [summary, lots, stockAfter] = await Promise.all([
          getSaleSummary(client, sale.id),
          listSaleLots(client, sale.id),
          getFinishedOnHand(client, product.id),
        ]);
        if (!summary) throw new Error("getSaleSummary found no row for the written sale");
        return { summary, lots, stockAfter };
      },
    });
  } catch (error) {
    console.error(actionFailureLogLine("saveSale", "before-write", error));
    return { status: "refused", message: saleSaveFailureMessage(error, "before-write") };
  }
  // Outside the try: once a sale is written, nothing here may turn it into
  // "wasn't saved". A render that follows a failed read would lose the panel, so
  // revalidate only once the details loaded.
  if (state.status === "saved" && state.details) revalidatePath("/sales");
  return state;
}

// The sale id is bound where the list renders and the reason comes from the
// dialog; a request can carry any value for either, so both are caller input.
export async function voidSale(saleId: string, reason: string): Promise<SaleVoidState> {
  let state: SaleVoidState;
  try {
    state = await decideSaleVoid(typeof saleId === "string" ? saleId : "", typeof reason === "string" ? reason : "", {
      caller,
      write: (client, id, text) => voidSaleCall(client, id, text),
    });
  } catch (error) {
    console.error(actionFailureLogLine("voidSale", "before-write", error));
    return { status: "refused", message: saleVoidFailureMessage(error, "before-write") };
  }
  if (state.status === "voided") revalidatePath("/sales");
  return state;
}
