// The advice sentence and button name for a product that needs a new price
// (AC-0065, AC-0066). Pure. The row carries what the pricing view returned; this
// only picks the sentence and formats each number. The database decided every
// comparison, so nothing here compares or computes a price.
import { formatCostPerLb, formatMargin, formatPricePerLb } from "./format";

export type PriceAction = "set" | "raise" | "lower";

export interface AdviceRow {
  costPerLb: number;
  suggestedListPrice: number;
  targetMarginPct: number | null;
  listPricePerLb: number | null;
  marginAtListPct: number | null;
  marginFeesPerLb: number;
}

export function priceAdvice(row: AdviceRow): string {
  const cost = `Cost is ${formatCostPerLb(row.costPerLb)}.`;
  const rule =
    row.targetMarginPct === null
      ? `With no target margin, the suggested price is cost plus ${formatCostPerLb(row.marginFeesPerLb)} in margin fees.`
      : `${formatPricePerLb(row.suggestedListPrice)} holds your ${formatMargin(row.targetMarginPct)} target margin.`;
  const list =
    row.listPricePerLb === null || row.marginAtListPct === null
      ? "This product has no list price yet."
      : `At your list price of ${formatPricePerLb(row.listPricePerLb)}, the margin is ${formatMargin(row.marginAtListPct)}.`;
  return `${cost} ${rule} ${list}`;
}

const VERB: Record<PriceAction, string> = { set: "Set", raise: "Raise", lower: "Lower" };

export function priceButtonName(action: PriceAction, suggestedListPrice: number): string {
  return `${VERB[action]} list price to ${formatPricePerLb(suggestedListPrice)}`;
}
