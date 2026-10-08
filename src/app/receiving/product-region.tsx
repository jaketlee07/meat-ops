import type { FinishedPrice, ProductStock, RecentReceipts as Receipts } from "../../lib/receiving";
import { Facts } from "./facts";
import { RecentReceipts } from "./recent-receipts";
import { NO_FINISHED, priceView, showAverage, showOnHand, showPrice, stockView } from "./stock-view";

// The chosen product's stock, the current suggested price of each finished
// product made from it, and its recent receipts, as the database holds them
// now. The page renders this again after a save or a void, so it is where a
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
      <h2 className="text-xl font-semibold">Stock and prices</h2>
      <Facts rows={[["On hand", showOnHand(view)], ["Average cost", showAverage(view)]]} />
      <h3 className="text-lg font-semibold">Suggested price per lb</h3>
      {prices.length === 0 ? (
        <p>{NO_FINISHED}</p>
      ) : (
        <Facts
          rows={prices.map((row) => [
            `${row.code} ${row.description}`,
            showPrice(priceView(row, stock)),
          ])}
        />
      )}
      <RecentReceipts {...recent} />
    </>
  );
}
