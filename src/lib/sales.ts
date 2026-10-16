import type { Database } from "./database.types.js";
import type { TypedClient } from "./supabase.js";

// Typed reads for the sale screen. Like receiving.ts, every read throws on error
// and returns numbers as the database delivered them. Nothing here writes or
// computes a weight, price, or cost; sorting names is an ordering only.

type SummaryRow = Omit<Database["public"]["Views"]["v_sale_summary"]["Row"], "finished_product_id">;

export interface SaleProduct {
  productId: string;
  code: string;
  description: string;
  listPricePerLb: number | null;
  finishedLbsAvailable: number;
}

export interface Customer {
  id: string;
  name: string;
}

// One sale, void or not. customer is null for a sale with no customer.
export interface SaleSummary {
  id: string;
  saleNumber: string;
  saleDate: string;
  createdAt: string;
  customerId: string | null;
  customer: string | null;
  productCode: string;
  product: string;
  lbsSold: number;
  pricePerLb: number;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface RecentSales {
  sales: SaleSummary[];
  // Every sale, void or not, for "Showing the 10 most recent of N".
  total: number;
}

const RECENT_SALE_LIMIT = 10;
export const SUMMARY_COLUMNS =
  "sale_id, sale_number, sale_date, created_at, customer_id, customer, finished_code, finished_product, lbs_sold, price_per_lb, voided_at, void_reason";

// The view types every column as nullable; a row missing one of these is not a sale row.
export function required<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`${what} failed: the database sent a row without a required column`);
  return value;
}

export function saleSummary(row: SummaryRow, what: string): SaleSummary {
  return {
    id: required(row.sale_id, what),
    saleNumber: required(row.sale_number, what),
    saleDate: required(row.sale_date, what),
    createdAt: required(row.created_at, what),
    customerId: row.customer_id,
    customer: row.customer,
    productCode: required(row.finished_code, what),
    product: required(row.finished_product, what),
    lbsSold: required(row.lbs_sold, what),
    pricePerLb: required(row.price_per_lb, what),
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
  };
}

// v_current_menu holds only active finished products.
export async function listSaleProducts(client: TypedClient): Promise<SaleProduct[]> {
  const { data, error } = await client
    .from("v_current_menu")
    .select("product_id, code, description, list_price_per_lb, finished_lbs_available")
    .order("code");
  if (error) throw new Error(`listSaleProducts failed: ${error.message}`);
  return data.map((row) => ({
    productId: required(row.product_id, "listSaleProducts"),
    code: required(row.code, "listSaleProducts"),
    description: required(row.description, "listSaleProducts"),
    listPricePerLb: row.list_price_per_lb,
    finishedLbsAvailable: required(row.finished_lbs_available, "listSaleProducts"),
  }));
}

export function byName(a: Customer, b: Customer): number {
  return a.name.localeCompare(b.name, "en", { sensitivity: "base" });
}

export async function listCustomers(client: TypedClient): Promise<Customer[]> {
  const { data, error } = await client.from("customers").select("id, name");
  if (error) throw new Error(`listCustomers failed: ${error.message}`);
  return data.sort(byName);
}

// Null when the menu has no row for the product (made inactive after the page loaded).
export async function getFinishedOnHand(client: TypedClient, productId: string): Promise<number | null> {
  const { data, error } = await client
    .from("v_current_menu")
    .select("finished_lbs_available")
    .eq("product_id", productId)
    .maybeSingle();
  if (error) throw new Error(`getFinishedOnHand failed: ${error.message}`);
  return data?.finished_lbs_available ?? null;
}

export async function listRecentSales(client: TypedClient): Promise<RecentSales> {
  const { data, error, count } = await client
    .from("v_sale_summary")
    .select(SUMMARY_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(RECENT_SALE_LIMIT);
  if (error) throw new Error(`listRecentSales failed: ${error.message}`);
  if (count === null) throw new Error("listRecentSales failed: the database sent no count");
  return { sales: data.map((row) => saleSummary(row, "listRecentSales")), total: count };
}

export async function getSaleSummary(client: TypedClient, saleId: string): Promise<SaleSummary | null> {
  const { data, error } = await client
    .from("v_sale_summary")
    .select(SUMMARY_COLUMNS)
    .eq("sale_id", saleId)
    .maybeSingle();
  if (error) throw new Error(`getSaleSummary failed: ${error.message}`);
  return data ? saleSummary(data, "getSaleSummary") : null;
}
