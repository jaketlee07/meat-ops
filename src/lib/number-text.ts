// Number text rules shared by the receiving and production form rules. Pure.

// Digits with at most one decimal point, and at least one digit. The engine holds
// two copies of this rule, c_number in create_import_draft and in
// confirm_import_draft (last defined in
// supabase/migrations/20261013195533_invoice_entry_number_text.sql), which also
// allow a leading minus. test/invoice-data.test.ts checks they agree; edit all
// three together.
export const NUMBER_TEXT = /^(\d+\.?\d*|\.\d+)$/;

export function decimalPlaces(text: string): number {
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}
