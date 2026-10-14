// Form rules for the sales screen and the trace lookups (AC-0029 to AC-0032,
// AC-0091, AC-0092, AC-0119). Pure: the browser runs them for instant messages
// and the actions run them again, so they read no database, no environment, and
// no clock. The caller passes the active finished product codes, the customer
// ids, and today's date (YYYY-MM-DD).
import { isCalendarDate } from "./batch-input";
import { decimalPlaces, NUMBER_TEXT } from "./number-text";

export interface SaleFields {
  productCode: string;
  lbs: string;
  pricePerLb: string;
  customerId: string;
  saleDate: string;
  today: string;
}

export type SaleField = Exclude<keyof SaleFields, "today">;

export interface SaleInput {
  productCode: string;
  lbs: number;
  pricePerLb: number;
  customerId?: string;
  saleDate: string;
}

export type SaleParse =
  | { ok: true; value: SaleInput }
  | { ok: false; errors: Partial<Record<SaleField, string>> };

// Within one field the first matching rule wins, so each field gets one message.
export function parseSaleForm(
  fields: SaleFields,
  finishedCodes: ReadonlySet<string>,
  customerIds: ReadonlySet<string>,
): SaleParse {
  const errors: Partial<Record<SaleField, string>> = {};

  const productCode = fields.productCode.trim();
  if (productCode === "") {
    errors.productCode = "Enter a product code.";
  } else if (!finishedCodes.has(productCode)) {
    errors.productCode = `No active finished product has code ${productCode}.`;
  }

  const lbs = Number(fields.lbs);
  if (!NUMBER_TEXT.test(fields.lbs)) {
    errors.lbs = "Enter the lbs sold, like 500 or 32.5.";
  } else if (decimalPlaces(fields.lbs) > 3) {
    errors.lbs = "Use at most 3 decimal places for weight.";
  } else if (lbs === 0) {
    errors.lbs = "Lbs must be above 0.";
  }

  // A price of 0 is allowed (AC-0032).
  const pricePerLb = Number(fields.pricePerLb);
  if (!NUMBER_TEXT.test(fields.pricePerLb)) {
    errors.pricePerLb = "Enter the price per lb, like 3.29.";
  } else if (decimalPlaces(fields.pricePerLb) > 2) {
    errors.pricePerLb = "Use at most 2 decimal places for a price.";
  } else if (pricePerLb >= 100_000_000) {
    errors.pricePerLb = "Price must be below 100,000,000.";
  }

  // An empty id is "No customer".
  if (fields.customerId !== "" && !customerIds.has(fields.customerId)) {
    errors.customerId = "Choose a customer from the list.";
  }

  // An invalid `today` refuses the form too, so nothing reaches the engine.
  if (!isCalendarDate(fields.saleDate) || !isCalendarDate(fields.today)) {
    errors.saleDate = "Enter the sale date.";
  } else if (fields.saleDate > fields.today) {
    errors.saleDate = "The sale date can't be after today.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const value: SaleInput = { productCode, lbs, pricePerLb, saleDate: fields.saleDate };
  if (fields.customerId !== "") value.customerId = fields.customerId;
  return { ok: true, value };
}

export function parseSaleNumber(text: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = text.trim();
  return value === "" ? { ok: false, error: "Enter a sale number." } : { ok: true, value };
}

export type LotFinderParse =
  | { ok: true; value: { rawCode: string; received?: string } }
  | { ok: false; errors: { rawCode?: string; received?: string } };

export function parseLotFinder({ rawCode, received }: { rawCode: string; received: string }): LotFinderParse {
  const errors: { rawCode?: string; received?: string } = {};
  const code = rawCode.trim();
  if (code === "") errors.rawCode = "Enter a raw product code.";
  // A blank received date means no date.
  if (received !== "" && !isCalendarDate(received)) {
    errors.received = "Enter the received date, or leave it blank.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: received === "" ? { rawCode: code } : { rawCode: code, received } };
}
