import type { Database } from "./database.types.js";
import { byName, required, saleSummary, SUMMARY_COLUMNS, type Customer, type SaleSummary } from "./sales";
import type { TypedClient } from "./supabase.js";

// Typed reads for the sale and lot trace screens. Like receiving.ts, every read
// throws on error and returns numbers as delivered. Grouping, sorting, and
// de-duplicating rows are orderings; nothing here computes a weight, price, or cost.

type TraceRow = Database["public"]["Views"]["v_sale_traceability"]["Row"];

export interface TraceRawLot {
  lotNumber: string;
  rawCode: string;
  rawProduct: string;
  vendor: string;
  receivedDate: string;
  lbsDrawn: number;
  costPerLb: number;
}

export interface TraceFinishedLot {
  saleItemId: string;
  batchNumber: string;
  productionDate: string;
  lbsSold: number;
  rawLots: TraceRawLot[];
}

export interface SaleTrace {
  sale: SaleSummary;
  lots: TraceFinishedLot[];
}

export interface FoundLot {
  lotNumber: string;
  receivedDate: string;
  vendor: string;
  weightLbs: number;
}

export interface FoundLots {
  rawProduct: { id: string; code: string; description: string };
  lots: FoundLot[];
  total: number;
}

export interface LotSale {
  saleNumber: string;
  saleDate: string;
  customer: string | null;
  productCode: string;
  batchNumber: string;
  lbsSold: number;
}

export interface LotFinishedStock {
  batchNumber: string;
  productCode: string;
  product: string;
  producedDate: string;
  lbsRemaining: number;
}

export interface LotTrace {
  lot: {
    lotNumber: string;
    rawCode: string;
    rawProduct: string;
    vendor: string;
    receivedDate: string;
    weightLbs: number;
    costPerLb: number;
    remainingLbs: number;
    voidedAt: string | null;
    voidReason: string | null;
  };
  // Distinct customers among the lot's sales, sorted by name.
  customers: Customer[];
  // True when any of the lot's sales has no customer; the page lists "No customer" last.
  hasNoCustomer: boolean;
  sales: LotSale[];
  finishedStock: LotFinishedStock[];
}

const FIND_LOT_LIMIT = 10;
// Half of max_rows in supabase/config.toml, so one page is never cut short.
export const PAGE_SIZE = 500;

function traceLots(rows: TraceRow[], what: string): TraceFinishedLot[] {
  const lots = new Map<string, TraceFinishedLot>();
  for (const row of rows) {
    const id = required(row.sale_item_id, what);
    let lot = lots.get(id);
    if (!lot) {
      lot = {
        saleItemId: id,
        batchNumber: required(row.batch_number, what),
        productionDate: required(row.production_date, what),
        lbsSold: required(row.lbs_sold, what),
        rawLots: [],
      };
      lots.set(id, lot);
    }
    lot.rawLots.push({
      lotNumber: required(row.raw_lot, what),
      rawCode: required(row.raw_code, what),
      rawProduct: required(row.raw_product, what),
      vendor: required(row.vendor, what),
      receivedDate: required(row.received_date, what),
      lbsDrawn: required(row.raw_lbs_from_lot, what),
      costPerLb: required(row.raw_lot_cost_per_lb, what),
    });
  }
  return [...lots.values()];
}

const TRACE_COLUMNS =
  "sale_item_id, batch_number, production_date, lbs_sold, raw_lot, raw_code, raw_product, vendor, received_date, raw_lbs_from_lot, raw_lot_cost_per_lb";

async function readSaleLots(client: TypedClient, saleId: string, what: string): Promise<TraceFinishedLot[]> {
  const { data, error } = await client
    .from("v_sale_traceability")
    .select(TRACE_COLUMNS)
    .eq("sale_id", saleId)
    .order("production_date")
    .order("produced_seq")
    .order("received_date")
    .order("receipt_seq");
  if (error) throw new Error(`${what} failed: ${error.message}`);
  return traceLots(data as TraceRow[], what);
}

export async function listSaleLots(client: TypedClient, saleId: string): Promise<TraceFinishedLot[]> {
  return readSaleLots(client, saleId, "listSaleLots");
}

export async function getSaleTrace(client: TypedClient, saleNumber: string): Promise<SaleTrace | null> {
  const { data, error } = await client
    .from("v_sale_summary")
    .select(SUMMARY_COLUMNS)
    .eq("sale_number", saleNumber)
    .maybeSingle();
  if (error) throw new Error(`getSaleTrace failed: ${error.message}`);
  if (!data) return null;
  const sale = saleSummary(data, "getSaleTrace");
  return { sale, lots: await readSaleLots(client, sale.id, "getSaleTrace") };
}

export async function findLots(
  client: TypedClient,
  rawCode: string,
  received?: string,
): Promise<FoundLots | null> {
  const product = await client
    .from("products")
    .select("id, code, description")
    .eq("kind", "raw")
    .eq("code", rawCode)
    .maybeSingle();
  if (product.error) throw new Error(`findLots failed: ${product.error.message}`);
  if (!product.data) return null;

  let query = client
    .from("lots")
    .select("lot_number, received_date, weight_lbs, vendors(name)", { count: "exact" })
    .eq("product_id", product.data.id)
    .is("voided_at", null);
  if (received === undefined) {
    query = query
      .order("received_date", { ascending: false })
      .order("receipt_seq", { ascending: false })
      .limit(FIND_LOT_LIMIT);
  } else {
    query = query.eq("received_date", received).order("receipt_seq", { ascending: false });
  }
  const { data, error, count } = await query;
  if (error) throw new Error(`findLots failed: ${error.message}`);
  if (count === null) throw new Error("findLots failed: the database sent no count");
  return {
    rawProduct: product.data,
    lots: data.map((lot) => ({
      lotNumber: lot.lot_number,
      receivedDate: lot.received_date,
      vendor: lot.vendors.name,
      weightLbs: lot.weight_lbs,
    })),
    total: count,
  };
}

export interface PageRead<T> {
  rows: T[];
  count: number;
}

// Reads every page of a set whose rows carry a unique saleItemId key. PostgREST
// stops a read at max_rows without an error, so the set counts only when every
// page reported the same count and it holds exactly that many distinct keys.
// One repeat is allowed; a second miss throws rather than return a partial list.
export async function readAllPages<T extends { sale_item_id: string | null }>(
  readPage: (from: number, to: number) => Promise<PageRead<T>>,
): Promise<T[]> {
  const attempt = async (): Promise<T[] | null> => {
    const rows: T[] = [];
    let count: number | null = null;
    while (count === null || rows.length < count) {
      const page = await readPage(rows.length, rows.length + PAGE_SIZE - 1);
      if (count !== null && page.count !== count) return null;
      count = page.count;
      if (page.rows.length === 0) break;
      rows.push(...page.rows);
    }
    const distinct = new Set(rows.map((row) => row.sale_item_id));
    return rows.length === count && distinct.size === count ? rows : null;
  };
  const rows = (await attempt()) ?? (await attempt());
  if (rows === null) throw new Error("the sale lines changed while they were being read");
  return rows;
}

const LOT_SALE_COLUMNS =
  "sale_item_id, sale_number, sale_date, sale_created_at, customer_id, customer, finished_code, batch_number, production_date, produced_seq, lbs_sold";

export async function getLotTrace(client: TypedClient, lotNumber: string): Promise<LotTrace | null> {
  const lotRead = await client
    .from("lots")
    .select(
      "id, lot_number, received_date, weight_lbs, unit_cost, remaining_lbs, voided_at, void_reason, products(code, description), vendors(name)",
    )
    .eq("lot_number", lotNumber)
    .maybeSingle();
  if (lotRead.error) throw new Error(`getLotTrace failed: ${lotRead.error.message}`);
  const lot = lotRead.data;
  if (!lot) return null;

  let rows: TraceRow[];
  try {
    rows = await readAllPages<TraceRow>(async (from, to) => {
      const { data, error, count } = await client
        .from("v_sale_traceability")
        .select(LOT_SALE_COLUMNS, { count: "exact" })
        .eq("raw_lot", lotNumber)
        .order("sale_item_id")
        .range(from, to);
      if (error) throw new Error(error.message);
      if (count === null) throw new Error("the database sent no count");
      return { rows: data as TraceRow[], count };
    });
  } catch (error) {
    throw new Error(`getLotTrace failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  const ordered = rows.slice().sort(
    (a, b) =>
      (b.sale_date ?? "").localeCompare(a.sale_date ?? "") ||
      (b.sale_created_at ?? "").localeCompare(a.sale_created_at ?? "") ||
      (a.production_date ?? "").localeCompare(b.production_date ?? "") ||
      (a.produced_seq ?? 0) - (b.produced_seq ?? 0) ||
      (a.sale_item_id ?? "").localeCompare(b.sale_item_id ?? ""),
  );
  const sales = ordered.map((row) => ({
    saleNumber: required(row.sale_number, "getLotTrace"),
    saleDate: required(row.sale_date, "getLotTrace"),
    customer: row.customer,
    productCode: required(row.finished_code, "getLotTrace"),
    batchNumber: required(row.batch_number, "getLotTrace"),
    lbsSold: required(row.lbs_sold, "getLotTrace"),
  }));
  const named = new Map<string, Customer>();
  let hasNoCustomer = false;
  for (const row of rows) {
    if (row.customer_id === null) hasNoCustomer = true;
    else named.set(row.customer_id, { id: row.customer_id, name: required(row.customer, "getLotTrace") });
  }

  const used = await client.from("production_batch_lots").select("batch_id").eq("lot_id", lot.id);
  if (used.error) throw new Error(`getLotTrace failed: ${used.error.message}`);
  const batchIds = used.data.map((row) => row.batch_id);
  let finishedStock: LotFinishedStock[] = [];
  if (batchIds.length > 0) {
    const stock = await client
      .from("finished_goods")
      .select("produced_date, lbs_remaining, production_batches(batch_number), products(code, description)")
      .in("batch_id", batchIds)
      .gt("lbs_remaining", 0)
      .order("produced_date")
      .order("produced_seq");
    if (stock.error) throw new Error(`getLotTrace failed: ${stock.error.message}`);
    finishedStock = stock.data.map((row) => ({
      batchNumber: row.production_batches.batch_number,
      productCode: row.products.code,
      product: row.products.description,
      producedDate: row.produced_date,
      lbsRemaining: row.lbs_remaining,
    }));
  }

  return {
    lot: {
      lotNumber: lot.lot_number,
      rawCode: lot.products.code,
      rawProduct: lot.products.description,
      vendor: lot.vendors.name,
      receivedDate: lot.received_date,
      weightLbs: lot.weight_lbs,
      costPerLb: lot.unit_cost,
      remainingLbs: lot.remaining_lbs,
      voidedAt: lot.voided_at,
      voidReason: lot.void_reason,
    },
    customers: [...named.values()].sort(byName),
    hasNoCustomer,
    sales,
    finishedStock,
  };
}
