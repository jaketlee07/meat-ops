// The correct decision, apart from the "use server" wrapper so Vitest can import
// it: nothing here touches next/*, server-only, or src/app/_server.
import type { CallerOutcome } from "../sales/save-sale";
import { parseCorrectionForm, type CorrectionErrors, type CorrectionFields, type CorrectionInput } from "../../lib/correction-input";
import {
  actionFailureLogLine,
  correctionFailureMessage,
  correctionFieldErrors,
  CORRECTION_SIGNED_OUT,
  logMessage,
  NOT_ALLOWED,
  NOT_CORRECTED,
  type FailureStage,
} from "../../lib/failures";
import type { BatchMadeFrom, FinishedPrice, LotFigures, ProductStock } from "../../lib/receiving";
import type { Lot } from "../../lib/rpc";

// The figures the panel compares, each read from the database, never worked out
// from the other read: the lot, its product's stock, the suggested prices of the
// finished products made from it, and the batches made from the lot.
export interface CorrectionSnapshot {
  lot: LotFigures;
  stock: ProductStock;
  prices: FinishedPrice[];
  batches: BatchMadeFrom[];
}

export interface CorrectionAfter extends CorrectionSnapshot {
  // The reason on the correction row the write made.
  reason: string;
}

export interface CorrectionDetails {
  before: CorrectionSnapshot;
  after: CorrectionAfter;
}

export type CorrectionState =
  | { status: "idle" }
  // A form rule or the database's nothing-to-correct or weight-floor refusal; the
  // confirmation stays open and the errors say where.
  | { status: "invalid"; errors: CorrectionErrors }
  // The caller or the database refused the correction; the message says why.
  | { status: "refused"; message: string }
  // Details are null only when the correction is written but the reads after it failed.
  | { status: "corrected"; lotNumber: string; details: CorrectionDetails | null };

export interface CorrectionDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  // Null when the lot is not found.
  readBefore: (client: C, lotId: string) => Promise<CorrectionSnapshot | null>;
  write: (client: C, lotId: string, input: CorrectionInput) => Promise<Lot>;
  readAfter: (client: C, lot: Lot, before: CorrectionSnapshot) => Promise<CorrectionAfter>;
}

function failed(error: unknown, stage: FailureStage): CorrectionState {
  console.error(actionFailureLogLine("correctReceipt", stage, error));
  return { status: "refused", message: correctionFailureMessage(error, stage) };
}

// Settles who is calling first, then the reads before the write and the form
// rules, then the write, then the reads after it. A write that returned is a
// correction even if the reads after it fail.
export async function decideCorrection<C>(
  lotId: string,
  fields: CorrectionFields,
  deps: CorrectionDeps<C>,
): Promise<CorrectionState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: CORRECTION_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_CORRECTED} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return failed(caller.error, "before-write");
  const { client } = caller;

  let before: CorrectionSnapshot;
  try {
    const read = await deps.readBefore(client, lotId);
    // A lot that is not there cannot be corrected; it reads as a failed read before the write.
    if (!read) throw new Error("the lot was not found");
    before = read;
  } catch (error) {
    return failed(error, "before-write");
  }

  const parsed = parseCorrectionForm(fields, { cost: before.lot.costText, weight: before.lot.weightText });
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors };

  let lot: Lot;
  try {
    const written = await deps.write(client, lotId, parsed.value);
    // A write that resolves with no row is a write with no answer.
    if (!written) throw new Error("the write returned no lot");
    lot = written;
  } catch (error) {
    const errors = correctionFieldErrors(error);
    if (errors) {
      console.error(actionFailureLogLine("correctReceipt", "write", error));
      return { status: "invalid", errors };
    }
    return failed(error, "write");
  }

  // The correction is written. If a read fails, say so rather than throw: an
  // error would read as "not corrected" and invite a second correction.
  try {
    const after = await deps.readAfter(client, lot, before);
    return { status: "corrected", lotNumber: lot.lot_number, details: { before, after } };
  } catch (error) {
    // The error's message only: the log must hold no row data.
    console.error(`correctReceipt: reading the details after the write failed: ${logMessage(error)}`);
    return { status: "corrected", lotNumber: lot.lot_number, details: null };
  }
}
