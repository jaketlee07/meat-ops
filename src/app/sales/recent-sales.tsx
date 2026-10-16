import Link from "next/link";
import { formatDate, formatPricePerLb, formatWeight } from "../../lib/format";
import type { RecentSales as Sales, SaleSummary } from "../../lib/sales";
import { Facts } from "../facts";
import { voidSale } from "./actions";
import { VoidDialog } from "./void-dialog";

const HEADING_ID = "recent-sales-heading";

// The database's mark: a Void button on a sale that is not void, the reason on
// one that is.
function Status({ sale }: { sale: SaleSummary }) {
  if (sale.voidedAt !== null) {
    return <p className="break-words font-medium">{`Void: ${sale.voidReason ?? ""}`}</p>;
  }
  return (
    <VoidDialog
      saleId={sale.id}
      saleNumber={sale.saleNumber}
      productCode={sale.productCode}
      lbs={formatWeight(sale.lbsSold)}
      customer={sale.customer}
      voidAction={voidSale.bind(null, sale.id)}
      listHeadingId={HEADING_ID}
    />
  );
}

// The 10 last-entered sales, last entered first, void ones included. Each is a
// block of labeled facts, so the list fits a 320 px screen with no sideways
// scroll. The page renders this again after a save or a void.
export function RecentSales({ sales, total }: Sales) {
  return (
    <section aria-labelledby={HEADING_ID} className="space-y-4">
      <h2 id={HEADING_ID} tabIndex={-1} className="text-xl font-semibold">
        Recent sales
      </h2>
      {total === 0 ? (
        <p>No sales yet.</p>
      ) : (
        <>
          {total > sales.length && <p>{`Showing the ${sales.length} most recent of ${total} sales.`}</p>}
          <ul className="space-y-4">
            {sales.map((sale) => (
              <li key={sale.id} className="space-y-2">
                <h3 className="text-lg font-semibold">
                  <Link
                    href={`/trace?sale=${encodeURIComponent(sale.saleNumber)}`}
                    className="inline-flex min-h-control min-w-control items-center break-all rounded-md text-primary underline"
                  >
                    {sale.saleNumber}
                  </Link>
                </h3>
                <Facts
                  rows={[
                    ["Sale date", formatDate(sale.saleDate)],
                    ["Customer", sale.customer ?? "No customer"],
                    ["Product", sale.productCode],
                    ["Lbs", formatWeight(sale.lbsSold)],
                    ["Price per lb", formatPricePerLb(sale.pricePerLb)],
                  ]}
                />
                <Status sale={sale} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
