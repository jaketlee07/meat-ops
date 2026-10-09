"use client";

import { priceAdvice, type PriceAction } from "../../lib/price-advice";
import type { PricingRow } from "../../lib/pricing";
import { ApplyButton } from "./apply-button";
import type { ChangeState } from "./save-change";

function isPriceAction(value: string | null): value is PriceAction {
  return value === "set" || value === "raise" || value === "lower";
}

// The advice sentence and the one-press button for a product that needs a new
// price (AC-0065, AC-0066, AC-0084). A row missing the action, the cost, or the
// suggested price shows nothing rather than a made-up price. The result goes to
// the parent's message region.
export function PriceAdviceBlock({ row, onResult }: { row: PricingRow; onResult: (state: ChangeState) => void }) {
  if (
    !row.needsNewPrice ||
    !isPriceAction(row.priceAction) ||
    row.costPerLb === null ||
    row.suggestedListPrice === null
  ) {
    return null;
  }
  const text = priceAdvice({
    costPerLb: row.costPerLb,
    suggestedListPrice: row.suggestedListPrice,
    targetMarginPct: row.targetMargin,
    listPricePerLb: row.listPrice,
    marginAtListPct: row.marginAtList,
    marginFeesPerLb: row.marginFeesPerLb ?? 0,
  });
  return (
    <>
      <p className="mt-3 break-words text-base">{text}</p>
      <ApplyButton
        productId={row.productId}
        action={row.priceAction}
        suggestedListPrice={row.suggestedListPrice}
        onResult={onResult}
      />
    </>
  );
}
