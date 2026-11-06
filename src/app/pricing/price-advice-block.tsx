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
export type AdviceLook = "row" | "stacked";

// The caller picks the look. "row" is for a product in the Pricing list: where the list is a table (`price-table`, see globals.css) the sentence and the
// button sit side by side on one line. "stacked" is for a narrow panel: the sentence in its
// amber box, then a full-width button, at every width.
const BLOCK_CLASS: Record<AdviceLook, string> = {
  row: "mt-2.5 flex flex-col gap-2.5 price-table:col-span-full price-table:mt-0 price-table:flex-row price-table:flex-wrap price-table:items-center price-table:gap-x-3 price-table:gap-y-2 price-table:pb-1.5 price-table:pt-1",
  stacked: "flex flex-col gap-2.5",
};
const TEXT_CLASS: Record<AdviceLook, string> = {
  row: "break-words rounded-control bg-advice-fill px-3 py-2.5 text-note font-semibold text-advice-text price-table:flex-1 price-table:basis-56 price-table:bg-transparent price-table:p-0 price-table:text-sm",
  stacked: "break-words rounded-control bg-advice-fill px-3 py-2.5 text-note font-semibold text-advice-text",
};

export function PriceAdviceBlock({
  row,
  onResult,
  look = "row",
}: {
  row: PricingRow;
  onResult: (state: ChangeState) => void;
  look?: AdviceLook;
}) {
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
    <div className={BLOCK_CLASS[look]}>
      <p className={TEXT_CLASS[look]}>{text}</p>
      <ApplyButton
        productId={row.productId}
        action={row.priceAction}
        suggestedListPrice={row.suggestedListPrice}
        onResult={onResult}
        look={look}
      />
    </div>
  );
}
