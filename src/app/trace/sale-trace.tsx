import Link from "next/link";
import { formatCostPerLb, formatDate, formatPricePerLb, formatWeight } from "../../lib/format";
import type { SaleTrace } from "../../lib/trace";
import { Facts } from "../facts";

const LINK =
  "inline-flex min-h-control min-w-control items-center break-all rounded-control text-primary underline";

// A sale's trace: the sale's facts, then each finished lot it drew from with the
// raw lots that batch drew from stacked inside. The heading and the facts list are one white card:
// the heading draws its top edge, the list its bottom edge, and the negative margin closes the gap
// between them (the list stays a direct child of the section, as does the batch list). Every value is React text, so a
// number typed into the URL shows as typed and never as markup.
export function SaleTraceView({ number, trace }: { number: string; trace: SaleTrace | null }) {
  if (!trace) return <p tabIndex={-1} data-result-focus className="break-words text-base">{`No sale has number ${number}.`}</p>;
  const { sale, lots } = trace;
  return (
    <section aria-labelledby="sale-trace-heading" className="flex flex-col gap-4">
      <h2 id="sale-trace-heading" tabIndex={-1} data-result-focus className="-mb-4 break-words rounded-t-card border border-b-0 border-card-border bg-surface px-4 pb-3 pt-4 text-lg font-bold">
        {sale.saleNumber}
      </h2>
      <Facts
        look="card"
        rows={[
          ["Sale date", formatDate(sale.saleDate)],
          ["Customer", sale.customer ?? "No customer"],
          ["Product", `${sale.productCode} ${sale.product}`],
          ["Lbs", formatWeight(sale.lbsSold)],
          ["Price per lb", formatPricePerLb(sale.pricePerLb)],
        ]}
      />
      {sale.voidedAt !== null ? (
        <p className="break-words font-medium">{`This sale was voided: ${sale.voidReason ?? ""}.`}</p>
      ) : (
        <>
          <h3 className="-mb-2 text-lg font-bold">Where it came from</h3>
          <ul className="flex flex-col gap-3">
            {lots.map((lot) => (
              <li key={lot.saleItemId} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3">
                <h4 className="break-words text-base font-bold">{lot.batchNumber}</h4>
                <Facts
                  look="plain"
                  rows={[
                    ["Made", formatDate(lot.productionDate)],
                    ["Lbs drawn", formatWeight(lot.lbsSold)],
                  ]}
                />
                <ul className="flex flex-col gap-2">
                  {lot.rawLots.map((raw) => (
                    <li key={raw.lotNumber} className="flex flex-col gap-1 rounded-control bg-tint px-3 pb-2.5 pt-1">
                      <h5 className="text-note font-bold">
                        <Link href={`/trace?lot=${encodeURIComponent(raw.lotNumber)}`} className={LINK}>
                          {raw.lotNumber}
                        </Link>
                      </h5>
                      <Facts
                        look="plain"
                        rows={[
                          ["Raw product", `${raw.rawCode} ${raw.rawProduct}`],
                          ["Vendor", raw.vendor],
                          ["Received", formatDate(raw.receivedDate)],
                          ["Lbs drawn", formatWeight(raw.lbsDrawn)],
                          ["Cost per lb", formatCostPerLb(raw.costPerLb)],
                        ]}
                      />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
