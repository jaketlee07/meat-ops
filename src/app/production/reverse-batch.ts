// The reverse decision, apart from the "use server" wrapper so Vitest can import
// it: nothing here touches next/*, server-only, or src/app/_server.
import type { CallerOutcome } from "../sales/save-sale";
import { parseReversalReason } from "../../lib/correction-input";
import {
  actionFailureLogLine,
  logMessage,
  NOT_ALLOWED,
  NOT_REVERSED,
  REVERSAL_SIGNED_OUT,
  reversalFailureMessage,
  type FailureStage,
} from "../../lib/failures";
import type { ReversalPreview } from "../../lib/production";
import type { ProductStock } from "../../lib/receiving";
import type { ProductionBatch } from "../../lib/rpc";
import type { SaleSummary } from "../../lib/sales";

// Raw stock and finished lbs on hand, each as the database gave it. Finished lbs
// are null where the menu view had no row.
export interface ReversalStock {
  raw: ProductStock;
  finishedLbs: number | null;
}

export interface ReversalBefore {
  preview: ReversalPreview;
  stock: ReversalStock;
}

export interface ReversalAfter {
  stock: ReversalStock;
  // The sales the reversal voided, read after it.
  voidedSales: SaleSummary[];
}

export interface ReversalDetails {
  before: ReversalBefore;
  after: ReversalAfter;
}

export type ReversalState =
  | { status: "idle" }
  // The reason rule refused the form; nothing reached the database.
  | { status: "invalid"; error: string }
  | { status: "refused"; message: string }
  // Details are null only when the reversal is written but the reads after it failed.
  | { status: "reversed"; batchNumber: string; details: ReversalDetails | null };

export interface ReversalDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  readBefore: (client: C, batchId: string) => Promise<ReversalBefore>;
  write: (client: C, batchId: string, reason: string) => Promise<ProductionBatch>;
  readAfter: (client: C, batch: ProductionBatch, before: ReversalBefore) => Promise<ReversalAfter>;
}

function failed(error: unknown, stage: FailureStage): ReversalState {
  console.error(actionFailureLogLine("reverseBatch", stage, error));
  return { status: "refused", message: reversalFailureMessage(error, stage) };
}

// Settles who is calling first, then the reason rule and the reads before the
// write, then the write, then the reads after it. A write that returned is a
// reversal even if the reads after it fail.
export async function decideReversal<C>(
  batchId: string,
  reason: string,
  deps: ReversalDeps<C>,
): Promise<ReversalState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: REVERSAL_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_REVERSED} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return failed(caller.error, "before-write");
  const { client } = caller;

  const parsed = parseReversalReason(reason);
  if (!parsed.ok) return { status: "invalid", error: parsed.error };

  let before: ReversalBefore;
  try {
    before = await deps.readBefore(client, batchId);
  } catch (error) {
    return failed(error, "before-write");
  }

  let batch: ProductionBatch;
  try {
    const written = await deps.write(client, batchId, parsed.value);
    // A write that resolves with no row is a write with no answer.
    if (!written) throw new Error("the write returned no batch");
    batch = written;
  } catch (error) {
    return failed(error, "write");
  }

  // The batch is reversed. If a read fails, say so rather than throw: an error
  // would read as "not reversed" and invite a second reversal.
  try {
    const after = await deps.readAfter(client, batch, before);
    return { status: "reversed", batchNumber: batch.batch_number, details: { before, after } };
  } catch (error) {
    // The error's message only: the log must hold no row data.
    console.error(`reverseBatch: reading the details after the write failed: ${logMessage(error)}`);
    return { status: "reversed", batchNumber: batch.batch_number, details: null };
  }
}
