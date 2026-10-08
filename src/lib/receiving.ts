import type { Database } from "./database.types.js";
import type { TypedClient } from "./supabase.js";

// Typed reads for the receiving screen. Like views.ts, every read throws on
// error and returns rows as the database delivered them. Nothing here writes,
// and nothing computes a cost, price, average, or stock value; the receipt
// status below only compares two columns the database already holds.

type Tables = Database["public"]["Tables"];

export type RawProduct = Pick<Tables["products"]["Row"], "id" | "code" | "description" | "species">;
export type Vendor = Pick<Tables["vendors"]["Row"], "id" | "name">;

// Mirrors the void_receipt rule from columns the operator can read: void when
// voided_at is set; untouched when remaining_lbs equals weight_lbs and the lot
// has no lot_adjustments rows; in use otherwise. The engine stays authoritative.
export type ReceiptStatus = "untouched" | "in-use" | "void";

export interface RecentReceipt {
  id: string;
  lotNumber: string;
  receivedDate: string;
  vendorName: string;
  weightLbs: number;
  unitCost: number;
  remainingLbs: number;
  voidReason: string | null;
  status: ReceiptStatus;
}

export interface RecentReceipts {
  receipts: RecentReceipt[];
  // Every receipt of the product, void or not, for "Showing the 10 most recent of N".
  total: number;
}

export interface Stock {
  qtyOnHand: number;
  movingAvgCost: number;
}

export interface ProductStock {
  // Null when the product has no inventory_balances row.
  balance: Stock | null;
  // Receipts with no voided_at. Zero means there is no average or price to show.
  nonVoidReceipts: number;
}

export interface FinishedPrice {
  productId: string;
  code: string;
  description: string;
  // Null when the raw product has no non-void receipt.
  finalPricePerLb: number | null;
}

const RECENT_RECEIPT_LIMIT = 10;

export async function listRecentReceipts(
  client: TypedClient,
  productId: string,
): Promise<RecentReceipts> {
  const { data, error, count } = await client
    .from("lots")
    .select(
      "id, lot_number, received_date, weight_lbs, unit_cost, remaining_lbs, void_reason, voided_at, vendors(name), lot_adjustments(count)",
      { count: "exact" },
    )
    .eq("product_id", productId)
    .order("receipt_seq", { ascending: false })
    .limit(RECENT_RECEIPT_LIMIT);
  if (error) throw new Error(`listRecentReceipts failed: ${error.message}`);
  if (count === null) throw new Error("listRecentReceipts failed: the database sent no count");

  const receipts = data.map((lot) => {
    const adjustments = lot.lot_adjustments[0]?.count ?? 0;
    const status: ReceiptStatus =
      lot.voided_at !== null
        ? "void"
        : lot.remaining_lbs === lot.weight_lbs && adjustments === 0
          ? "untouched"
          : "in-use";
    return {
      id: lot.id,
      lotNumber: lot.lot_number,
      receivedDate: lot.received_date,
      vendorName: lot.vendors.name,
      weightLbs: lot.weight_lbs,
      unitCost: lot.unit_cost,
      remainingLbs: lot.remaining_lbs,
      voidReason: lot.void_reason,
      status,
    };
  });
  return { receipts, total: count };
}

export async function listActiveRawProducts(client: TypedClient): Promise<RawProduct[]> {
  const { data, error } = await client
    .from("products")
    .select("id, code, description, species")
    .eq("kind", "raw")
    .eq("active", true)
    .order("code");
  if (error) throw new Error(`listActiveRawProducts failed: ${error.message}`);
  return data;
}

// Every raw product, active or not, for the save action. The save rules take every
// code, so a product made inactive after the page loaded reaches receive_lot and is
// refused there with its own reason.
export async function listRawProducts(
  client: TypedClient,
): Promise<Pick<RawProduct, "id" | "code" | "description">[]> {
  const { data, error } = await client.from("products").select("id, code, description").eq("kind", "raw");
  if (error) throw new Error(`listRawProducts failed: ${error.message}`);
  return data;
}

export async function listVendors(client: TypedClient): Promise<Vendor[]> {
  const { data, error } = await client.from("vendors").select("id, name");
  if (error) throw new Error(`listVendors failed: ${error.message}`);
  return data.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

export async function getStock(client: TypedClient, productId: string): Promise<ProductStock> {
  const [balance, receipts] = await Promise.all([
    client
      .from("inventory_balances")
      .select("qty_on_hand, moving_avg_cost")
      .eq("product_id", productId)
      .maybeSingle(),
    client
      .from("lots")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .is("voided_at", null),
  ]);
  if (balance.error) throw new Error(`getStock failed: ${balance.error.message}`);
  if (receipts.error) throw new Error(`getStock failed: ${receipts.error.message}`);
  if (receipts.count === null) throw new Error("getStock failed: the database sent no count");
  return {
    balance: balance.data
      ? { qtyOnHand: balance.data.qty_on_hand, movingAvgCost: balance.data.moving_avg_cost }
      : null,
    nonVoidReceipts: receipts.count,
  };
}

export async function listFinishedPrices(
  client: TypedClient,
  rawProductId: string,
): Promise<FinishedPrice[]> {
  const products = await client
    .from("products")
    .select("id")
    .eq("kind", "finished")
    .eq("active", true)
    .eq("raw_product_id", rawProductId);
  if (products.error) throw new Error(`listFinishedPrices failed: ${products.error.message}`);
  const ids = products.data.map((product) => product.id);
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from("v_product_pricing")
    .select("product_id, code, description, final_price_per_lb")
    .in("product_id", ids)
    .order("code");
  if (error) throw new Error(`listFinishedPrices failed: ${error.message}`);
  // The view types every column as nullable; the first three come from NOT NULL
  // products columns, so a row without them is not a product row.
  return data.flatMap((row) =>
    row.product_id === null || row.code === null || row.description === null
      ? []
      : [
          {
            productId: row.product_id,
            code: row.code,
            description: row.description,
            finalPricePerLb: row.final_price_per_lb,
          },
        ],
  );
}
