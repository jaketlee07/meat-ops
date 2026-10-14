import type { SaleField, SaleFields } from "../../lib/sale-input";

// The form's fields in the order the page shows them. The first one with an
// error takes focus after a refusal.
export const FIELD_ORDER: readonly SaleField[] = [
  "productCode",
  "lbs",
  "pricePerLb",
  "customerId",
  "saleDate",
];

const FIELD_NAMES = [...FIELD_ORDER, "today"] as const;

// Reads the sale form's text fields in the save action. A missing or non-text
// entry reads as blank, because a caller can send anything.
export function readFields(formData: FormData): SaleFields {
  const fields = { productCode: "", lbs: "", pricePerLb: "", customerId: "", saleDate: "", today: "" };
  for (const name of FIELD_NAMES) {
    const value = formData.get(name);
    if (typeof value === "string") fields[name] = value;
  }
  return fields;
}
