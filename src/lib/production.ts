import { saleSummary, SUMMARY_COLUMNS, type SaleSummary } from "./sales";
import type { TypedClient } from "./supabase.js";
import { readAllPages } from "./trace";

// Typed reads for the production screen. Like receiving.ts, every read throws on
// error and returns rows as the database delivered them. Nothing here writes or
// computes a cost, shrink, average, or stock value; sorting lots into draw order
// is an ordering only.

export interface RawInput {
  id: string;
  code: string;
  description: string;
  active: boolean;
}

export interface FinishedProduct {
  id: string;
  code: string;
  description: string;
  shrinkPct: number | null;
  raw: RawInput | null;
}

export interface LotUsed {
  lotNumber: string;
  receivedDate: string;
  vendorName: string;
  lbsDrawn: number;
  costPerLb: number;
}

export interface FinishedLot {
  lbsProduced: number;
  costPerLb: number;
}

export interface RecentBatch {
  id: string;
  batchNumber: string;
  productionDate: string;
  rawLbsIn: number;
  finishedLbsOut: number;
  costPerFinishedLb: number;
  // Both null on a batch that is not reversed.
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface ReversalPreview {
  batchNumber: string;
  productionDate: string;
  finishedLbs: number;
  // The lots the batch drew from and the lbs that go back to each, in draw order.
  lots: { lotNumber: string; lbs: number }[];
  // The sales that are not void and have a line on the batch's finished lot.
  sales: SaleSummary[];
}

export interface RecentBatches {
  batches: RecentBatch[];
  // Every batch of the product, for "Showing the 10 most recent of N batches".
  total: number;
}

const RECENT_BATCH_LIMIT = 10;
const FINISHED_COLUMNS =
  "id, code, description, shrink_pct, raw:raw_product_id(id, code, description, active)";

function finishedProduct(row: {
  id: string;
  code: string;
  description: string;
  shrink_pct: number | null;
  raw: RawInput | null;
}): FinishedProduct {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    shrinkPct: row.shrink_pct,
    raw: row.raw,
  };
}

export async function listActiveFinishedProducts(client: TypedClient): Promise<FinishedProduct[]> {
  const { data, error } = await client
    .from("products")
    .select(FINISHED_COLUMNS)
    .eq("kind", "finished")
    .eq("active", true)
    .order("code");
  if (error) throw new Error(`listActiveFinishedProducts failed: ${error.message}`);
  return data.map(finishedProduct);
}

// Every finished product, active or not, for the save action. A product made
// inactive after the page loaded reaches produce_batch and is refused there.
export async function listFinishedProducts(client: TypedClient): Promise<FinishedProduct[]> {
  const { data, error } = await client
    .from("products")
    .select(FINISHED_COLUMNS)
    .eq("kind", "finished");
  if (error) throw new Error(`listFinishedProducts failed: ${error.message}`);
  return data.map(finishedProduct);
}

export async function listLotsUsed(client: TypedClient, batchId: string): Promise<LotUsed[]> {
  const { data, error } = await client
    .from("production_batch_lots")
    .select(
      "lbs_consumed, lot_unit_cost, lots(lot_number, received_date, receipt_seq, vendors(name))",
    )
    .eq("batch_id", batchId);
  if (error) throw new Error(`listLotsUsed failed: ${error.message}`);
  return data
    .slice()
    .sort(
      (a, b) =>
        a.lots.received_date.localeCompare(b.lots.received_date) ||
        a.lots.receipt_seq - b.lots.receipt_seq,
    )
    .map((row) => ({
      lotNumber: row.lots.lot_number,
      receivedDate: row.lots.received_date,
      vendorName: row.lots.vendors.name,
      lbsDrawn: row.lbs_consumed,
      costPerLb: row.lot_unit_cost,
    }));
}

export async function getFinishedLot(client: TypedClient, batchId: string): Promise<FinishedLot> {
  const { data, error } = await client
    .from("finished_goods")
    .select("lbs_produced, cost_per_lb")
    .eq("batch_id", batchId)
    .single();
  if (error) throw new Error(`getFinishedLot failed: ${error.message}`);
  return { lbsProduced: data.lbs_produced, costPerLb: data.cost_per_lb };
}

export async function listRecentBatches(
  client: TypedClient,
  finishedProductId: string,
): Promise<RecentBatches> {
  const { data, error, count } = await client
    .from("finished_goods")
    .select(
      "batch_id, production_batches(batch_number, production_date, raw_lbs_in, finished_lbs_out, cost_per_finished_lb, reversed_at, reversal_reason)",
      { count: "exact" },
    )
    .eq("finished_product_id", finishedProductId)
    .order("produced_seq", { ascending: false })
    .limit(RECENT_BATCH_LIMIT);
  if (error) throw new Error(`listRecentBatches failed: ${error.message}`);
  if (count === null) throw new Error("listRecentBatches failed: the database sent no count");
  const batches = data.map((row) => ({
    id: row.batch_id,
    batchNumber: row.production_batches.batch_number,
    productionDate: row.production_batches.production_date,
    rawLbsIn: row.production_batches.raw_lbs_in,
    finishedLbsOut: row.production_batches.finished_lbs_out,
    costPerFinishedLb: row.production_batches.cost_per_finished_lb,
    reversedAt: row.production_batches.reversed_at,
    reversalReason: row.production_batches.reversal_reason,
  }));
  return { batches, total: count };
}

// How many sale ids one summary read takes, so its URL and its rows stay small.
const SALE_ID_CHUNK = 100;

// Every sale, void or not, with a line on the batch's finished lot, oldest first.
async function listSalesOnBatch(client: TypedClient, batchId: string, what: string): Promise<SaleSummary[]> {
  const finished = await client.from("finished_goods").select("id").eq("batch_id", batchId).single();
  if (finished.error) throw new Error(`${what} failed: ${finished.error.message}`);
  let lines;
  try {
    lines = await readAllPages(async (from, to) => {
      const { data, error, count } = await client
        .from("sale_items")
        .select("sale_item_id:id, sale_id", { count: "exact" })
        .eq("finished_goods_id", finished.data.id)
        .order("id")
        .range(from, to);
      if (error) throw new Error(error.message);
      if (count === null) throw new Error("the database sent no count");
      return { rows: data, count };
    });
  } catch (error) {
    throw new Error(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const saleIds = [...new Set(lines.map((line) => line.sale_id))];
  const sales: SaleSummary[] = [];
  for (let at = 0; at < saleIds.length; at += SALE_ID_CHUNK) {
    const { data, error } = await client
      .from("v_sale_summary")
      .select(SUMMARY_COLUMNS)
      .in("sale_id", saleIds.slice(at, at + SALE_ID_CHUNK));
    if (error) throw new Error(`${what} failed: ${error.message}`);
    sales.push(...data.map((row) => saleSummary(row, what)));
  }
  return sales.sort(
    (a, b) => a.saleDate.localeCompare(b.saleDate) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

// What reversing the batch would do: the lots that get lbs back, the finished
// lbs that leave stock, and the sales it would void.
export async function getReversalPreview(client: TypedClient, batchId: string): Promise<ReversalPreview> {
  const { data, error } = await client
    .from("production_batches")
    .select("batch_number, production_date, finished_lbs_out")
    .eq("id", batchId)
    .single();
  if (error) throw new Error(`getReversalPreview failed: ${error.message}`);
  const [lots, sales] = await Promise.all([
    listLotsUsed(client, batchId),
    listSalesOnBatch(client, batchId, "getReversalPreview"),
  ]);
  return {
    batchNumber: data.batch_number,
    productionDate: data.production_date,
    finishedLbs: data.finished_lbs_out,
    lots: lots.map((lot) => ({ lotNumber: lot.lotNumber, lbs: lot.lbsDrawn })),
    sales: sales.filter((sale) => sale.voidedAt === null),
  };
}

// The sales the batch's reversal voided: those voided at the batch's reversal time.
export async function listSalesVoidedBy(client: TypedClient, batchId: string): Promise<SaleSummary[]> {
  const { data, error } = await client
    .from("production_batches")
    .select("reversed_at")
    .eq("id", batchId)
    .single();
  if (error) throw new Error(`listSalesVoidedBy failed: ${error.message}`);
  if (data.reversed_at === null) return [];
  const sales = await listSalesOnBatch(client, batchId, "listSalesVoidedBy");
  return sales.filter((sale) => sale.voidedAt === data.reversed_at);
}
