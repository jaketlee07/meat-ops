import type { FinishedPrice, ProductStock, RecentReceipts as Receipts } from "../../lib/receiving";
import { Facts } from "../facts";
import { NO_FINISHED, priceView, showAverage, showOnHand, showPrice, stockView } from "../stock-view";
import { RecentReceipts } from "./recent-receipts";

// The chosen product's stock card (stock and the current suggested price of each
// finished product made from it) and its recent receipts, as the database holds them
// now. Two sections: the page's layout places each beside the form from desk up. The page renders this again after a save or a void, so it is where a
// change in the ledger shows up.
export function ProductRegion({
  stock,
  prices,
  recent,
}: {
  stock: ProductStock;
  prices: FinishedPrice[];
  recent: Receipts;
}) {
  const view = stockView(stock);
  return (
    <>
      <section aria-labelledby="stock-heading" className="space-y-3 rounded-card border border-card-border bg-surface p-3.5 desk:mb-4 desk:p-4 desk:[grid-area:stock] wide:grid wide:grid-cols-2 wide:gap-x-6 wide:gap-y-3 wide:space-y-0">
        <h2 id="stock-heading" className="text-lg font-bold wide:col-span-2">
          Stock and prices
        </h2>
        <div className="wide:col-start-1 wide:row-span-2 wide:row-start-2 wide:self-start">
          <Facts look="tiles" rows={[["On hand", showOnHand(view)], ["Average cost", showAverage(view)]]} />
        </div>
        <h3 className="text-base font-bold wide:col-start-2 wide:row-start-2">Suggested price per lb</h3>
        {prices.length === 0 ? (
          <p className="wide:col-start-2 wide:row-start-3">{NO_FINISHED}</p>
        ) : (
          <div className="wide:col-start-2 wide:row-start-3">
            <Facts
            look="quiet"
            rows={prices.map((row) => [
              `${row.code} ${row.description}`,
              showPrice(priceView(row, stock)),
            ])}
            />
          </div>
        )}
      </section>
      <RecentReceipts {...recent} />
    </>
  );
}
