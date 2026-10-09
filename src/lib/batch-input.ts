// Form rules for the production screen (AC-0010, AC-0011, AC-0069). Pure: the
// browser runs them for instant messages and the save action runs them again,
// so they read no database, no environment, and no clock. The caller passes
// the active finished product codes and today's date (YYYY-MM-DD).
import { decimalPlaces, NUMBER_TEXT } from "./number-text";

export interface BatchFields {
  productCode: string;
  rawLbs: string;
  finishedLbs: string;
  productionDate: string;
  notes: string;
  today: string;
}

export type BatchField = Exclude<keyof BatchFields, "today">;

export interface BatchInput {
  productCode: string;
  rawLbs: number;
  finishedLbs?: number;
  productionDate: string;
  notes?: string;
}

export type BatchParse =
  | { ok: true; value: BatchInput }
  | { ok: false; errors: Partial<Record<BatchField, string>> };

const MAX_NOTES_LENGTH = 500;
const DATE_TEXT = /^(\d{4})-(\d{2})-(\d{2})$/;

// A real calendar date written YYYY-MM-DD: 2026-02-30 is refused.
function isCalendarDate(text: string): boolean {
  const match = DATE_TEXT.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

// Within one field the first matching rule wins, so each field gets one message.
export function parseBatchForm(fields: BatchFields, finishedCodes: ReadonlySet<string>): BatchParse {
  const errors: Partial<Record<BatchField, string>> = {};

  const productCode = fields.productCode.trim();
  if (productCode === "") {
    errors.productCode = "Enter a product code.";
  } else if (!finishedCodes.has(productCode)) {
    errors.productCode = `No active finished product has code ${productCode}.`;
  }

  const rawLbs = Number(fields.rawLbs);
  let rawOk = false;
  if (!NUMBER_TEXT.test(fields.rawLbs)) {
    errors.rawLbs = "Enter the raw lbs, like 2000 or 32.5.";
  } else if (decimalPlaces(fields.rawLbs) > 3) {
    errors.rawLbs = "Use at most 3 decimal places for weight.";
  } else if (rawLbs === 0) {
    errors.rawLbs = "Raw lbs must be above 0.";
  } else {
    rawOk = true;
  }

  const finishedLbs = Number(fields.finishedLbs);
  const finishedGiven = fields.finishedLbs.trim() !== "";
  if (finishedGiven) {
    if (!NUMBER_TEXT.test(fields.finishedLbs)) {
      errors.finishedLbs = "Enter the finished lbs, like 1540 or 32.5, or leave it blank.";
    } else if (decimalPlaces(fields.finishedLbs) > 3) {
      errors.finishedLbs = "Use at most 3 decimal places for weight.";
    } else if (finishedLbs === 0) {
      errors.finishedLbs = "Finished lbs must be above 0.";
    } else if (rawOk && finishedLbs > rawLbs) {
      errors.finishedLbs = "Finished lbs can't be more than the raw lbs.";
    }
  }

  // An invalid `today` refuses the form too, so nothing reaches the engine.
  if (!isCalendarDate(fields.productionDate) || !isCalendarDate(fields.today)) {
    errors.productionDate = "Enter the production date.";
  } else if (fields.productionDate > fields.today) {
    errors.productionDate = "The production date can't be after today.";
  }

  if (fields.notes.length > MAX_NOTES_LENGTH) {
    errors.notes = "Keep notes to 500 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const value: BatchInput = { productCode, rawLbs, productionDate: fields.productionDate };
  if (finishedGiven) value.finishedLbs = finishedLbs;
  if (fields.notes.trim() !== "") value.notes = fields.notes;
  return { ok: true, value };
}
