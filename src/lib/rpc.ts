import type { Database } from "./database.types.js";
import type { TypedClient } from "./supabase.js";

// Thin, typed wrappers over the three costing RPCs. These do no math: they map
// friendly argument names to the SQL parameter names, call the function, and
// return the typed row. All cost and inventory logic lives in Postgres.

type Functions = Database["public"]["Functions"];

export type Lot = Functions["receive_lot"]["Returns"];
export type ProductionBatch = Functions["produce_batch"]["Returns"];
export type Sale = Functions["record_sale"]["Returns"];

export interface ReceiveLotInput {
  productId: string;
  vendorId: string;
  weightLbs: number;
  unitCost: number;
  received?: string;
  lotNumber?: string;
  notes?: string;
}

export async function receiveLot(client: TypedClient, input: ReceiveLotInput): Promise<Lot> {
  const { data, error } = await client.rpc("receive_lot", {
    p_product_id: input.productId,
    p_vendor_id: input.vendorId,
    p_weight_lbs: input.weightLbs,
    p_unit_cost: input.unitCost,
    p_received: input.received,
    p_lot_number: input.lotNumber,
    p_notes: input.notes,
  });
  if (error) throw new Error(`receiveLot failed: ${error.message}`);
  return data as Lot;
}

export interface ProduceBatchInput {
  finishedProductId: string;
  rawLbsIn: number;
  finishedLbsOut?: number;
  productionDate?: string;
  batchNumber?: string;
  notes?: string;
}

export async function produceBatch(
  client: TypedClient,
  input: ProduceBatchInput,
): Promise<ProductionBatch> {
  const { data, error } = await client.rpc("produce_batch", {
    p_finished_product_id: input.finishedProductId,
    p_raw_lbs_in: input.rawLbsIn,
    p_finished_lbs_out: input.finishedLbsOut,
    p_production_date: input.productionDate,
    p_batch_number: input.batchNumber,
    p_notes: input.notes,
  });
  if (error) throw new Error(`produceBatch failed: ${error.message}`);
  return data as ProductionBatch;
}

export interface RecordSaleInput {
  finishedProductId: string;
  lbs: number;
  pricePerLb: number;
  customerId?: string;
  saleDate?: string;
  saleNumber?: string;
}

export async function recordSale(client: TypedClient, input: RecordSaleInput): Promise<Sale> {
  const { data, error } = await client.rpc("record_sale", {
    p_finished_product_id: input.finishedProductId,
    p_lbs: input.lbs,
    p_price_per_lb: input.pricePerLb,
    p_customer_id: input.customerId,
    p_sale_date: input.saleDate,
    p_sale_number: input.saleNumber,
  });
  if (error) throw new Error(`recordSale failed: ${error.message}`);
  return data as Sale;
}
