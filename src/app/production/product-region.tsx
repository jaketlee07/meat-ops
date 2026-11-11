import type { ListSearch } from "../../lib/list-search";
import type { FinishedProduct, RecentBatches as Batches } from "../../lib/production";
import type { ProductStock } from "../../lib/receiving";
import { formatShrink } from "../../lib/format";
import { Facts } from "../facts";
import { showAverage, showOnHand, stockView } from "../stock-view";
import { RecentBatches } from "./recent-batches";
import type { Preview } from "./reverse-control";

const NO_SHRINK = "None";

// The chosen finished product, its raw input, the shrink it is made with, and
// the raw input's stock as the database holds them now. The page renders this
// again after a save or a reversal, so it is where a change in the ledger shows
// up. Two sections: the stock card and the recent batches, which the page's layout places
// beside the form from desk up.
export function ProductRegion({
  product,
  stock,
  recent,
  previews,
  search,
}: {
  product: FinishedProduct;
  stock: ProductStock | null;
  recent: Batches;
  previews: Record<string, Preview>;
  search: ListSearch;
}) {
  const raw = product.raw;
  const view = stock ? stockView(stock) : null;
  return (
    <>
      <section
        aria-labelledby="stock-heading"
        className="flex flex-wrap gap-x-6 gap-y-3 rounded-card border border-card-border bg-surface p-3.5 desk:mb-4 desk:p-4 desk:[grid-area:stock]"
      >
        <h2 id="stock-heading" className="w-full text-lg font-bold">
          Product and raw stock
        </h2>
        <div className="min-w-0 grow basis-72">
          <Facts
            look="quiet"
            rows={[
              ["Product", `${product.code} ${product.description}`],
              ["Raw input", raw ? `${raw.code} ${raw.description}` : "None"],
              ["Shrink", product.shrinkPct === null ? NO_SHRINK : formatShrink(product.shrinkPct)],
            ]}
          />
        </div>
        {view && (
          <div className="min-w-0 grow basis-60 self-start">
            <Facts
              look="tiles"
              rows={[
                ["Raw on hand", showOnHand(view)],
                ["Raw average cost", showAverage(view)],
              ]}
            />
          </div>
        )}
      </section>
      <RecentBatches {...recent} productId={product.id} productCode={product.code} previews={previews} search={search} />
    </>
  );
}
