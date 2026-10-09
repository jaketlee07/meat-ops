// The save action's decisions, apart from the "use server" wrapper so Vitest can
// import them: nothing here touches next/*, server-only, or src/app/_server.
import type { BatchField, BatchFields, BatchInput } from "../../lib/batch-input";
import {
  actionFailureLogLine,
  batchSaveFailureMessage,
  logMessage,
  NOT_ALLOWED,
  NOT_SAVED_BATCH,
  type FailureStage,
} from "../../lib/failures";
import type { FinishedLot, FinishedProduct, LotUsed } from "../../lib/production";
import type { ProductStock } from "../../lib/receiving";
import type { ProductionBatch } from "../../lib/rpc";
import { stockView, type StockView } from "../receiving/stock-view";

export interface SavedBatch {
  batchNumber: string;
  productionDate: string;
  rawLbsIn: number;
  finishedLbsOut: number;
  rawCostTotal: number;
  costPerFinishedLb: number;
  shrinkPctUsed: number;
  productCode: string;
  productDescription: string;
  // True when the finished lbs field was filled ("measured"), false for "from shrink".
  finishedLbsGiven: boolean;
}

export interface Totals {
  lotsUsed: LotUsed[];
  finishedLot: FinishedLot;
  stock: { before: StockView; after: StockView };
}

export type SaveState =
  | { status: "idle" }
  // An AC-0010 rule refused the form; nothing reached the database.
  | { status: "invalid"; fieldErrors: Partial<Record<BatchField, string>> }
  // The caller or the database refused the save; the message says why.
  | { status: "refused"; message: string }
  // Totals are null only when the batch is written but the reads after it failed.
  | { status: "saved"; batch: SavedBatch; totals: Totals | null };

export type CallerOutcome<C> =
  | { status: "operator"; client: C }
  | { status: "ended" }
  | { status: "not-operator" }
  | { status: "failed"; error: unknown };

export type BeforeWrite =
  | { ok: false; errors: Partial<Record<BatchField, string>> }
  | { ok: true; input: BatchInput; product: FinishedProduct; stockBefore: ProductStock };

export type ReadyToWrite = Extract<BeforeWrite, { ok: true }>;

export interface AfterWrite {
  lotsUsed: LotUsed[];
  finishedLot: FinishedLot;
  stockAfter: ProductStock;
}

export interface SaveDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  readBefore: (client: C, fields: BatchFields) => Promise<BeforeWrite>;
  write: (client: C, before: ReadyToWrite) => Promise<ProductionBatch>;
  readAfter: (client: C, batch: ProductionBatch, before: ReadyToWrite) => Promise<AfterWrite>;
}

const SIGNED_OUT = "You're signed out. Sign in again to save this batch.";

function failed(error: unknown, stage: FailureStage): SaveState {
  console.error(actionFailureLogLine("saveBatch", stage, error));
  return { status: "refused", message: batchSaveFailureMessage(error, stage) };
}

// Settles who is calling first, then the form rules and the reads before the
// write, then the write, then the reads after it. A write that returned is a
// save even if the reads after it fail.
export async function decideSave<C>(fields: BatchFields, deps: SaveDeps<C>): Promise<SaveState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_SAVED_BATCH} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return failed(caller.error, "before-write");
  const { client } = caller;

  let before: BeforeWrite;
  try {
    before = await deps.readBefore(client, fields);
  } catch (error) {
    return failed(error, "before-write");
  }
  if (!before.ok) return { status: "invalid", fieldErrors: before.errors };

  let batch: ProductionBatch;
  try {
    const written = await deps.write(client, before);
    // A write that resolves with no row is a write with no answer (AC-0035).
    if (!written) throw new Error("the write returned no batch");
    batch = written;
  } catch (error) {
    return failed(error, "write");
  }

  const saved: SavedBatch = {
    batchNumber: batch.batch_number,
    productionDate: batch.production_date,
    rawLbsIn: batch.raw_lbs_in,
    finishedLbsOut: batch.finished_lbs_out,
    rawCostTotal: batch.raw_cost_total,
    costPerFinishedLb: batch.cost_per_finished_lb,
    shrinkPctUsed: batch.shrink_pct_used,
    productCode: before.product.code,
    productDescription: before.product.description,
    finishedLbsGiven: before.input.finishedLbs !== undefined,
  };

  // The batch is written. If a read fails, say so rather than throw: an error
  // would read as "not saved" and invite a duplicate batch.
  try {
    const after = await deps.readAfter(client, batch, before);
    return {
      status: "saved",
      batch: saved,
      totals: {
        lotsUsed: after.lotsUsed,
        finishedLot: after.finishedLot,
        stock: { before: stockView(before.stockBefore), after: stockView(after.stockAfter) },
      },
    };
  } catch (error) {
    // The error's message only: the log must hold no row data.
    console.error(`saveBatch: reading the totals after the write failed: ${logMessage(error)}`);
    return { status: "saved", batch: saved, totals: null };
  }
}
