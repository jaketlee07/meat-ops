import type { BatchField, BatchFields } from "../../lib/batch-input";

// The form's fields in the order the page shows them. The first one with an
// error takes focus after a refusal.
export const FIELD_ORDER: readonly BatchField[] = [
  "productCode",
  "rawLbs",
  "finishedLbs",
  "productionDate",
  "notes",
];

const FIELD_NAMES = [...FIELD_ORDER, "today"] as const;

// Reads the batch form's text fields in the save action. The form builds its
// FormData from the check step's fields, so the same rules see the same values. A missing or non-text entry reads
// as blank, because a caller can send anything.
export function readFields(formData: FormData): BatchFields {
  const fields = { productCode: "", rawLbs: "", finishedLbs: "", productionDate: "", notes: "", today: "" };
  for (const name of FIELD_NAMES) {
    const value = formData.get(name);
    if (typeof value === "string") fields[name] = value;
  }
  return fields;
}
