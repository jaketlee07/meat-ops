import type { FinishedPrice, ProductStock } from "../../lib/receiving";
import { priceView } from "../stock-view";
import type { PriceChange } from "./actions";

// The suggested price of each finished product made from a raw product, before
// and after a change to its lots. Each figure is a read from the database.
export function priceChanges(
  before: { stock: ProductStock; prices: FinishedPrice[] },
  after: { stock: ProductStock; prices: FinishedPrice[] },
): PriceChange[] {
  return after.prices.map((row) => ({
    code: row.code,
    description: row.description,
    before: priceView(
      before.prices.find((candidate) => candidate.productId === row.productId),
      before.stock,
    ),
    after: priceView(row, after.stock),
  }));
}
