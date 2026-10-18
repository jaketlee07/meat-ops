// Form rules for the correction and reversal dialogs (corrections AC-0102 to
// AC-0104, AC-0139). Pure: the browser runs them for instant messages and the
// actions run them again before the write. The cost and weight rows are the
// receiving screen's (receipt-input.ts), so the two screens never disagree.

import { costError, weightError } from "./receipt-input";

export interface CorrectionFields {
  cost: string;
  weight: string;
  reason: string;
}

export type CorrectionErrors = Partial<Record<keyof CorrectionFields | "form", string>>;

export interface CorrectionInput {
  unitCost: number;
  weightLbs: number;
  reason: string;
}

export type CorrectionParse = { ok: true; value: CorrectionInput } | { ok: false; errors: CorrectionErrors };

export const NOTHING_TO_CORRECT = "Change the cost or the weight to correct this receipt.";

// `current` is the receipt's cost and weight as the database's text. A typed
// value passed its decimal-place rule, so it equals the engine's rounded value
// exactly when it equals the current number.
export function parseCorrectionForm(
  fields: CorrectionFields,
  current: { cost: string; weight: string },
): CorrectionParse {
  const errors: CorrectionErrors = {};
  const costMessage = costError(fields.cost);
  if (costMessage) errors.cost = costMessage;
  const weightMessage = weightError(fields.weight);
  if (weightMessage) errors.weight = weightMessage;
  if (fields.reason.trim() === "") errors.reason = "Enter a reason for the correction.";

  const unitCost = Number(fields.cost);
  const weightLbs = Number(fields.weight);
  if (!costMessage && !weightMessage && unitCost === Number(current.cost) && weightLbs === Number(current.weight)) {
    errors.form = NOTHING_TO_CORRECT;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { unitCost, weightLbs, reason: fields.reason } };
}

export function parseReversalReason(
  reason: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (reason.trim() === "") return { ok: false, error: "Enter a reason for the reversal." };
  return { ok: true, value: reason };
}
