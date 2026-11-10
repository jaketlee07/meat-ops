import { required } from "./sales";
import type { TypedClient } from "./supabase.js";

// Typed reads for the "Today" page. Like receiving.ts, every read throws on
// error: none returns an empty list, a zero, or a missing row in place of a
// failure. A money figure with no row is 0 only after the read succeeded. Nothing
// here adds or multiplies a weight or an amount; the database computed each figure.

export interface TodayReceipt {
  id: string;
  lotNumber: string;
  productCode: string;
  productDescription: string;
  weightLbs: number;
  voided: boolean;
}

export interface TodayBatch {
  id: string;
  batchNumber: string;
  productCode: string;
  productDescription: string;
  finishedLbsOut: number;
  reversed: boolean;
}

export interface TodaySale {
  id: string;
  saleNumber: string;
  productCode: string;
  productDescription: string;
  customer: string | null;
  lbsSold: number;
  voided: boolean;
}

// An entry list with its exact count, for the heading "Receipts (2)".
export interface Counted<T> {
  entries: T[];
  total: number;
}

export interface StockValue {
  raw: number;
  finished: number;
  total: number;
}

export interface StockLine {
  productId: string;
  code: string;
  description: string;
  lbsOnHand: number;
}

function counted<T>(entries: T[], count: number | null, what: string): Counted<T> {
  if (count === null) throw new Error(`${what} failed: the database sent no count`);
  return { entries, total: count };
}

// The lots received on the date, last entered first, voided ones included.
export async function listTodayReceipts(client: TypedClient, today: string): Promise<Counted<TodayReceipt>> {
  const { data, error, count } = await client
    .from("lots")
    .select("id, lot_number, current_weight_lbs, voided_at, products(code, description)", { count: "exact" })
    .eq("received_date", today)
    .order("receipt_seq", { ascending: false });
  if (error) throw new Error(`listTodayReceipts failed: ${error.message}`);
  const entries = data.map((lot) => ({
    id: lot.id,
    lotNumber: lot.lot_number,
    productCode: lot.products.code,
    productDescription: lot.products.description,
    weightLbs: required(lot.current_weight_lbs, "listTodayReceipts"),
    voided: lot.voided_at !== null,
  }));
  return counted(entries, count, "listTodayReceipts");
}

// The batches produced on the date, last entered first, reversed ones included.
export async function listTodayBatches(client: TypedClient, today: string): Promise<Counted<TodayBatch>> {
  const { data, error, count } = await client
    .from("production_batches")
    .select("id, batch_number, finished_lbs_out, reversed_at, products(code, description)", { count: "exact" })
    .eq("production_date", today)
    .order("stock_seq", { ascending: false });
  if (error) throw new Error(`listTodayBatches failed: ${error.message}`);
  const entries = data.map((batch) => ({
    id: batch.id,
    batchNumber: batch.batch_number,
    productCode: batch.products.code,
    productDescription: batch.products.description,
    finishedLbsOut: batch.finished_lbs_out,
    reversed: batch.reversed_at !== null,
  }));
  return counted(entries, count, "listTodayBatches");
}

// The sales dated the date, last entered first, voided ones included.
export async function listTodaySales(client: TypedClient, today: string): Promise<Counted<TodaySale>> {
  const { data, error, count } = await client
    .from("v_sale_summary")
    .select("sale_id, sale_number, customer, finished_code, finished_product, lbs_sold, voided_at", { count: "exact" })
    .eq("sale_date", today)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listTodaySales failed: ${error.message}`);
  const entries = data.map((sale) => ({
    id: required(sale.sale_id, "listTodaySales"),
    saleNumber: required(sale.sale_number, "listTodaySales"),
    productCode: required(sale.finished_code, "listTodaySales"),
    productDescription: required(sale.finished_product, "listTodaySales"),
    customer: sale.customer,
    lbsSold: required(sale.lbs_sold, "listTodaySales"),
    voided: sale.voided_at !== null,
  }));
  return counted(entries, count, "listTodaySales");
}

// The date's sales total, from the daily sales view. A date with no sale that is
// not voided has no row, which reads as 0 once the read has succeeded.
export async function getTodaySales(client: TypedClient, today: string): Promise<number> {
  const { data, error } = await client.from("v_daily_sales").select("sales_total").eq("sale_date", today).maybeSingle();
  if (error) throw new Error(`getTodaySales failed: ${error.message}`);
  return data ? required(data.sales_total, "getTodaySales") : 0;
}

// The stock value view's one row. With no lot and no finished good it has none,
// which reads as 0 once the read has succeeded.
export async function getStockValue(client: TypedClient): Promise<StockValue> {
  const { data, error } = await client
    .from("v_stock_value")
    .select("raw_value, finished_value, total_value")
    .maybeSingle();
  if (error) throw new Error(`getStockValue failed: ${error.message}`);
  if (!data) return { raw: 0, finished: 0, total: 0 };
  return {
    raw: required(data.raw_value, "getStockValue"),
    finished: required(data.finished_value, "getStockValue"),
    total: required(data.total_value, "getStockValue"),
  };
}

// Every active product, and every inactive one that still holds stock.
export async function listStockOnHand(client: TypedClient): Promise<StockLine[]> {
  const { data, error } = await client
    .from("v_stock_on_hand")
    .select("product_id, code, description, lbs_on_hand")
    .or("active.eq.true,lbs_on_hand.gt.0")
    .order("code");
  if (error) throw new Error(`listStockOnHand failed: ${error.message}`);
  return data.map((row) => ({
    productId: required(row.product_id, "listStockOnHand"),
    code: required(row.code, "listStockOnHand"),
    description: required(row.description, "listStockOnHand"),
    lbsOnHand: required(row.lbs_on_hand, "listStockOnHand"),
  }));
}
