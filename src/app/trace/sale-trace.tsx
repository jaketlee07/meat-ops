import Link from "next/link";
import { formatCostPerLb, formatDate, formatPricePerLb, formatWeight } from "../../lib/format";
import type { SaleTrace } from "../../lib/trace";
import { Facts } from "../facts";

const LINK =
  "inline-flex min-h-control min-w-control items-center break-all rounded-md text-primary underline";

// A sale's trace: the sale's facts, then each finished lot it drew from with the
// raw lots that batch drew from stacked inside. Every value is React text, so a
// number typed into the URL shows as typed and never as markup.
export function SaleTraceView({ number, trace }: { number: string; trace: SaleTrace | null }) {
  if (!trace) return <p className="break-words text-base">{`No sale has number ${number}.`}</p>;
  const { sale, lots } = trace;
  return (
    <section aria-labelledby="sale-trace-heading" className="space-y-4">
      <h2 id="sale-trace-heading" className="break-words text-xl font-semibold">
        {sale.saleNumber}
      </h2>
      <Facts
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
          <h3 className="text-lg font-semibold">Where it came from</h3>
          <ul className="space-y-4">
            {lots.map((lot) => (
              <li key={lot.saleItemId} className="space-y-2 rounded-md border border-field-border p-3">
                <h4 className="break-words text-base font-semibold">{lot.batchNumber}</h4>
                <Facts
                  rows={[
                    ["Made", formatDate(lot.productionDate)],
                    ["Lbs drawn", formatWeight(lot.lbsSold)],
                  ]}
                />
                <ul className="space-y-3">
                  {lot.rawLots.map((raw) => (
                    <li key={raw.lotNumber} className="space-y-1">
                      <h5 className="text-base font-semibold">
                        <Link href={`/trace?lot=${encodeURIComponent(raw.lotNumber)}`} className={LINK}>
                          {raw.lotNumber}
                        </Link>
                      </h5>
                      <Facts
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
