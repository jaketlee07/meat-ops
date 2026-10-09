// Number text rules shared by the receiving and production form rules. Pure.

// Digits with at most one decimal point, and at least one digit.
export const NUMBER_TEXT = /^(\d+\.?\d*|\.\d+)$/;

export function decimalPlaces(text: string): number {
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}
