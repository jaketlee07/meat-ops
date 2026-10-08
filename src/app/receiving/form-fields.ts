import type { ReceiptField, ReceiptFields } from "../../lib/receipt-input";

// The form's fields in the order the page shows them. The first one with an
// error takes focus after a refusal.
export const FIELD_ORDER: readonly ReceiptField[] = [
  "productCode",
  "vendorId",
  "weight",
  "cost",
  "receivedDate",
  "notes",
];

const FIELD_NAMES = [...FIELD_ORDER, "today"] as const;

// Reads the receipt form's text fields. The browser and the save action both
// call this, so the same rules see the same values. A missing or non-text entry
// reads as blank, because a caller can send anything.
export function readFields(formData: FormData): ReceiptFields {
  const fields = { productCode: "", vendorId: "", weight: "", cost: "", receivedDate: "", notes: "", today: "" };
  for (const name of FIELD_NAMES) {
    const value = formData.get(name);
    if (typeof value === "string") fields[name] = value;
  }
  return fields;
}
