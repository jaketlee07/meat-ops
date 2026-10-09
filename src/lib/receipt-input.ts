// Form rules for the receiving screen (AC-0010, AC-0011, AC-0051). Pure: the
// browser runs them for instant messages and the save action runs them again,
// so they read no database, no environment, and no clock. The caller passes
// the active raw product codes and today's date (YYYY-MM-DD).

import { decimalPlaces, NUMBER_TEXT } from "./number-text";

export interface ReceiptFields {
  productCode: string;
  vendorId: string;
  weight: string;
  cost: string;
  receivedDate: string;
  notes: string;
  today: string;
}

export type ReceiptField = Exclude<keyof ReceiptFields, "today">;

export interface ReceiptInput {
  productCode: string;
  vendorId: string;
  weightLbs: number;
  unitCost: number;
  receivedDate: string;
  notes?: string;
}

export type ReceiptParse =
  | { ok: true; value: ReceiptInput }
  | { ok: false; errors: Partial<Record<ReceiptField, string>> };

const MAX_NOTES_LENGTH = 500;

// Within one field the first matching rule wins, so each field gets one message.
export function parseReceiptForm(fields: ReceiptFields, rawCodes: ReadonlySet<string>): ReceiptParse {
  const errors: Partial<Record<ReceiptField, string>> = {};

  const productCode = fields.productCode.trim();
  if (productCode === "") {
    errors.productCode = "Enter a product code.";
  } else if (!rawCodes.has(productCode)) {
    errors.productCode = `No active raw product has code ${productCode}.`;
  }

  if (fields.vendorId.trim() === "") {
    errors.vendorId = "Choose a vendor.";
  }

  const weightLbs = Number(fields.weight);
  if (!NUMBER_TEXT.test(fields.weight)) {
    errors.weight = "Enter the weight in lbs, like 5000 or 32.5.";
  } else if (decimalPlaces(fields.weight) > 3) {
    errors.weight = "Use at most 3 decimal places for weight.";
  } else if (weightLbs === 0) {
    errors.weight = "Weight must be above 0.";
  }

  const unitCost = Number(fields.cost);
  if (!NUMBER_TEXT.test(fields.cost)) {
    errors.cost = "Enter the cost per lb, like 1.68.";
  } else if (decimalPlaces(fields.cost) > 4) {
    errors.cost = "Use at most 4 decimal places for cost.";
  }

  if (fields.receivedDate.trim() === "") {
    errors.receivedDate = "Enter the received date.";
  } else if (fields.receivedDate > fields.today) {
    errors.receivedDate = "The received date can't be after today.";
  }

  if (fields.notes.length > MAX_NOTES_LENGTH) {
    errors.notes = "Keep notes to 500 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const value: ReceiptInput = {
    productCode,
    vendorId: fields.vendorId,
    weightLbs,
    unitCost,
    receivedDate: fields.receivedDate,
  };
  if (fields.notes.trim() !== "") value.notes = fields.notes;
  return { ok: true, value };
}

export function parseVoidReason(
  reason: string,
): { ok: true; value: string } | { ok: false; error: string } {
  if (reason.trim() === "") return { ok: false, error: "Enter a reason for the void." };
  return { ok: true, value: reason };
}
