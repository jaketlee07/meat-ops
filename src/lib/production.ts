import type { TypedClient } from "./supabase.js";

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
      "batch_id, production_batches(batch_number, production_date, raw_lbs_in, finished_lbs_out, cost_per_finished_lb)",
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
  }));
  return { batches, total: count };
}
