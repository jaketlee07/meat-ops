import type { FinishedProduct, RecentBatches as Batches } from "../../lib/production";
import type { ProductStock } from "../../lib/receiving";
import { formatShrink } from "../../lib/format";
import { Facts } from "../receiving/facts";
import { showAverage, showOnHand, stockView } from "../receiving/stock-view";
import { RecentBatches } from "./recent-batches";

const NO_SHRINK = "None";

// The chosen finished product, its raw input, the shrink it is made with, and
// the raw input's stock as the database holds them now. The page renders this
// again after a save, so it is where a change in the ledger shows up. The
// product's recent batches go below the facts.
export function ProductRegion({
  product,
  stock,
  recent,
}: {
  product: FinishedProduct;
  stock: ProductStock | null;
  recent: Batches;
}) {
  const raw = product.raw;
  const view = stock ? stockView(stock) : null;
  return (
    <>
      <h2 className="text-xl font-semibold">Product and raw stock</h2>
      <Facts
        rows={[
          ["Product", `${product.code} ${product.description}`],
          ["Raw input", raw ? `${raw.code} ${raw.description}` : "None"],
          ["Shrink", product.shrinkPct === null ? NO_SHRINK : formatShrink(product.shrinkPct)],
          ...(view
            ? ([
                ["Raw on hand", showOnHand(view)],
                ["Raw average cost", showAverage(view)],
              ] as const)
            : []),
        ]}
      />
      <RecentBatches {...recent} />
    </>
  );
}
