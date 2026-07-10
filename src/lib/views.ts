import type { Database } from "./database.types.js";
import type { TypedClient } from "./supabase.js";

// Typed reads over the three views. The views are the only read path for cost
// and availability. Wrappers return full-precision numeric as delivered by the
// database; rounding for display happens at the UI layer, not here.

type Views = Database["public"]["Views"];

export type ProductPricing = Views["v_product_pricing"]["Row"];
export type MenuItem = Views["v_current_menu"]["Row"];
export type SaleTrace = Views["v_sale_traceability"]["Row"];

export async function getPricing(
  client: TypedClient,
  productCode?: string,
): Promise<ProductPricing[]> {
  let query = client.from("v_product_pricing").select("*");
  if (productCode !== undefined) query = query.eq("code", productCode);
  const { data, error } = await query;
  if (error) throw new Error(`getPricing failed: ${error.message}`);
  return data;
}

export async function getMenu(client: TypedClient): Promise<MenuItem[]> {
  const { data, error } = await client.from("v_current_menu").select("*");
  if (error) throw new Error(`getMenu failed: ${error.message}`);
  return data;
}

export async function getTrace(
  client: TypedClient,
  saleNumber?: string,
): Promise<SaleTrace[]> {
  let query = client.from("v_sale_traceability").select("*");
  if (saleNumber !== undefined) query = query.eq("sale_number", saleNumber);
  const { data, error } = await query;
  if (error) throw new Error(`getTrace failed: ${error.message}`);
  return data;
}
