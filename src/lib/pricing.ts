import { RpcError } from "./rpc";
import type { TypedClient } from "./supabase.js";

// Typed reads for the pricing screen. Like production.ts, every read throws on
// error and returns values as the database delivered them. Nothing here computes
// a cost, price, or margin; the pricing view and price_what_if decide every
// number and every comparison. Ordering happens in the database.

export interface PricingRow {
  productId: string;
  code: string;
  description: string;
  costPerLb: number | null;
  listPrice: number | null;
  suggestedListPrice: number | null;
  marginAtList: number | null;
  targetMargin: number | null;
  marginFeesPerLb: number | null;
  hasCost: boolean;
  priceAction: string | null;
  needsNewPrice: boolean;
  belowTarget: boolean;
}

export interface FeeLine {
  name: string;
  amountPerLb: number;
}

export interface PricingDetail extends PricingRow {
  rawAverageCost: number | null;
  shrink: number | null;
  costAfterShrink: number | null;
  raw: { code: string; description: string } | null;
  processingFees: FeeLine[];
  marginFees: FeeLine[];
}

export interface WhatIfRawProduct {
  id: string;
  code: string;
  description: string;
}

export type WhatIfRow = {
  code: string;
  description: string;
  cost_per_lb: number;
  final_price_per_lb: number;
  list_price_per_lb: number;
  margin_at_list_pct: number;
  product_id: string;
  suggested_list_price: number;
  target_margin_pct: number;
};

const PRICING_COLUMNS =
  "product_id, code, description, cost_per_lb, list_price_per_lb, suggested_list_price, margin_at_list_pct, target_margin_pct, margin_per_lb, has_cost, price_action, needs_new_price, below_target, raw_cost_per_lb, shrink_pct, post_shrink_cost_per_lb";

interface PricingViewRow {
  product_id: string | null;
  code: string | null;
  description: string | null;
  cost_per_lb: number | null;
  list_price_per_lb: number | null;
  suggested_list_price: number | null;
  margin_at_list_pct: number | null;
  target_margin_pct: number | null;
  margin_per_lb: number | null;
  has_cost: boolean | null;
  price_action: string | null;
  needs_new_price: boolean | null;
  below_target: boolean | null;
}

function pricingRow(row: PricingViewRow): PricingRow {
  return {
    productId: row.product_id ?? "",
    code: row.code ?? "",
    description: row.description ?? "",
    costPerLb: row.cost_per_lb,
    listPrice: row.list_price_per_lb,
    suggestedListPrice: row.suggested_list_price,
    marginAtList: row.margin_at_list_pct,
    targetMargin: row.target_margin_pct,
    marginFeesPerLb: row.margin_per_lb,
    hasCost: row.has_cost ?? false,
    priceAction: row.price_action,
    needsNewPrice: row.needs_new_price ?? false,
    belowTarget: row.below_target ?? false,
  };
}

// The list's three groups in the order the screen shows them, sorted by the database.
export async function listPricing(client: TypedClient): Promise<PricingRow[]> {
  const { data, error } = await client
    .from("v_product_pricing")
    .select(PRICING_COLUMNS)
    .order("needs_new_price", { ascending: false })
    .order("has_cost", { ascending: false })
    .order("below_target", { ascending: false })
    .order("code");
  if (error) throw new Error(`listPricing failed: ${error.message}`);
  return data.map(pricingRow);
}

// null when the code is not an active finished product's (unknown, raw, or inactive).
export async function getPricingDetail(
  client: TypedClient,
  code: string,
): Promise<PricingDetail | null> {
  const product = await client
    .from("products")
    .select("id, raw:raw_product_id(code, description)")
    .eq("code", code)
    .eq("kind", "finished")
    .eq("active", true)
    .maybeSingle();
  if (product.error) throw new Error(`getPricingDetail failed: ${product.error.message}`);
  if (!product.data) return null;
  const productId = product.data.id;

  const [view, fees] = await Promise.all([
    client.from("v_product_pricing").select(PRICING_COLUMNS).eq("product_id", productId).maybeSingle(),
    client
      .from("fee_types")
      .select("name, kind, sort_order, product_fees!inner(amount_per_lb)")
      .eq("product_fees.product_id", productId)
      .order("sort_order"),
  ]);
  if (view.error) throw new Error(`getPricingDetail failed: ${view.error.message}`);
  if (fees.error) throw new Error(`getPricingDetail failed: ${fees.error.message}`);
  if (!view.data) return null;

  const lines = (kind: string): FeeLine[] =>
    fees.data
      .filter((fee) => fee.kind === kind)
      .map((fee) => ({ name: fee.name, amountPerLb: fee.product_fees[0]!.amount_per_lb }));
  return {
    ...pricingRow(view.data),
    rawAverageCost: view.data.raw_cost_per_lb,
    shrink: view.data.shrink_pct,
    costAfterShrink: view.data.post_shrink_cost_per_lb,
    raw: product.data.raw,
    processingFees: lines("processing"),
    marginFees: lines("margin"),
  };
}

// The what-if picker: active raw products that feed at least one active finished product.
export async function listWhatIfRawProducts(client: TypedClient): Promise<WhatIfRawProduct[]> {
  const finished = await client
    .from("products")
    .select("raw_product_id")
    .eq("kind", "finished")
    .eq("active", true);
  if (finished.error) throw new Error(`listWhatIfRawProducts failed: ${finished.error.message}`);
  const rawIds = [
    ...new Set(finished.data.map((row) => row.raw_product_id).filter((id) => id !== null)),
  ];
  if (rawIds.length === 0) return [];
  const { data, error } = await client
    .from("products")
    .select("id, code, description")
    .eq("kind", "raw")
    .eq("active", true)
    .in("id", rawIds)
    .order("code");
  if (error) throw new Error(`listWhatIfRawProducts failed: ${error.message}`);
  return data;
}

export async function runWhatIf(
  client: TypedClient,
  rawProductId: string,
  rawCostPerLb: number,
): Promise<WhatIfRow[]> {
  const { data, error } = await client.rpc("price_what_if", {
    p_raw_product_id: rawProductId,
    p_raw_cost_per_lb: rawCostPerLb,
  });
  if (error) throw new RpcError(`runWhatIf failed: ${error.message}`, error.code ?? "");
  return data;
}
