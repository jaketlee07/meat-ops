import { formatCostPerLb, formatPricePerLb, formatWeight } from "../../lib/format";
import type { FinishedPrice, ProductStock } from "../../lib/receiving";

// What the screen shows for a product's stock and prices. Every number is the
// one the database returned; the only choice made here is which rows have
// nothing to show (AC-0067), keyed on the non-void receipt count.

export const NO_AVERAGE = "None yet";
export const NO_PRICE = "No price yet";
export const NO_FINISHED = "No finished products are made from this raw product.";

export interface StockView {
  qtyOnHand: number;
  // Null when the product has no non-void receipt.
  averageCost: number | null;
}

export function stockView({ balance, nonVoidReceipts }: ProductStock): StockView {
  return {
    qtyOnHand: balance?.qtyOnHand ?? 0,
    averageCost: balance && nonVoidReceipts > 0 ? balance.movingAvgCost : null,
  };
}

// Null when the raw product has no non-void receipt, or has no such price row.
export function priceView(row: FinishedPrice | undefined, stock: ProductStock): number | null {
  return stock.nonVoidReceipts > 0 ? (row?.finalPricePerLb ?? null) : null;
}

export const showOnHand = (view: StockView): string => formatWeight(view.qtyOnHand);

export const showAverage = (view: StockView): string =>
  view.averageCost === null ? NO_AVERAGE : formatCostPerLb(view.averageCost);

export const showPrice = (price: number | null): string =>
  price === null ? NO_PRICE : formatPricePerLb(price);
