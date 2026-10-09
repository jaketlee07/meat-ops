export interface ChangeFields {
  productId: string;
  value: string;
}

// Reads a change form's text fields in the change actions. A missing or non-text
// entry reads as blank, because a caller can send anything.
export function readChangeFields(formData: FormData): ChangeFields {
  const fields = { productId: "", value: "" };
  for (const name of ["productId", "value"] as const) {
    const entry = formData.get(name);
    if (typeof entry === "string") fields[name] = entry;
  }
  return fields;
}
