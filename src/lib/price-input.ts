// Form rules for the pricing screen (AC-0091, AC-0101, AC-0123). Pure: the
// browser runs them for instant messages and the change actions run them again.
// A parsed value is the number the text spells. Nothing is computed from it:
// the database divides the target by 100, and the checks below only compare the
// typed number with a limit.
import { decimalPlaces, NUMBER_TEXT } from "./number-text";

export type ValueParse = { ok: true; value: number } | { ok: false; error: string };

// The first matching row wins, so each field gets one message.
export function parseTargetMargin(text: string): ValueParse {
  if (!NUMBER_TEXT.test(text)) return { ok: false, error: "Enter a target margin, like 20 or 22.5." };
  if (decimalPlaces(text) > 2) return { ok: false, error: "Use at most 2 decimal places for a target margin." };
  const value = Number(text);
  if (value >= 100) return { ok: false, error: "A target margin must be below 100." };
  return { ok: true, value };
}

export function parseListPrice(text: string): ValueParse {
  if (!NUMBER_TEXT.test(text)) return { ok: false, error: "Enter the price per lb, like 3.29." };
  if (decimalPlaces(text) > 2) return { ok: false, error: "Use at most 2 decimal places for a price." };
  const value = Number(text);
  if (value === 0) return { ok: false, error: "Price must be above 0." };
  if (value >= 100_000_000) return { ok: false, error: "Price must be below 100,000,000." };
  return { ok: true, value };
}

export interface WhatIfFields {
  rawCode: string;
  cost: string;
}

export type WhatIfField = keyof WhatIfFields;

export type WhatIfParse =
  | { ok: true; value: { rawCode: string; cost: number } }
  | { ok: false; errors: Partial<Record<WhatIfField, string>> };

// A code that is not in `rawCodes` is not a form error: AC-0125 answers it on
// the results side. Only "none chosen" is refused here.
export function parseWhatIf(fields: WhatIfFields, _rawCodes?: ReadonlySet<string>): WhatIfParse {
  const errors: Partial<Record<WhatIfField, string>> = {};
  if (fields.rawCode.trim() === "") errors.rawCode = "Choose a raw product.";
  if (!NUMBER_TEXT.test(fields.cost)) {
    errors.cost = "Enter the cost per lb, like 1.68.";
  } else if (decimalPlaces(fields.cost) > 4) {
    errors.cost = "Use at most 4 decimal places for cost.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { rawCode: fields.rawCode.trim(), cost: Number(fields.cost) } };
}
