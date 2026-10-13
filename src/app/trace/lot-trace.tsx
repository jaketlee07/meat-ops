import Link from "next/link";
import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { LotTrace } from "../../lib/trace";
import { Facts } from "../facts";

const LINK =
  "inline-flex min-h-control min-w-control items-center break-all rounded-md text-primary underline";

// A raw lot's trace: the receipt, the customers and sales its stock reached, and
// the finished stock still on hand from it. Every value is React text.
export function LotTraceView({ number, trace }: { number: string; trace: LotTrace | null }) {
  if (!trace) return <p tabIndex={-1} data-result-focus className="break-words text-base">{`No receipt has lot number ${number}.`}</p>;
  const { lot, customers, hasNoCustomer, sales, finishedStock } = trace;
  return (
    <section aria-labelledby="lot-trace-heading" className="space-y-4">
      <h2 id="lot-trace-heading" tabIndex={-1} data-result-focus className="break-words text-xl font-semibold">
        {lot.lotNumber}
      </h2>
      <Facts
        rows={[
          ["Raw product", `${lot.rawCode} ${lot.rawProduct}`],
          ["Vendor", lot.vendor],
          ["Received", formatDate(lot.receivedDate)],
          ["Weight received", formatWeight(lot.weightLbs)],
          ["Cost per lb", formatCostPerLb(lot.costPerLb)],
          ["Raw on hand", formatWeight(lot.remainingLbs)],
        ]}
      />
      {lot.voidedAt !== null && (
        <p className="break-words font-medium">{`This receipt was voided: ${lot.voidReason ?? ""}.`}</p>
      )}

      {sales.length === 0 ? (
        <p className="text-base">No sale was made from this lot.</p>
      ) : (
        <>
          <h3 className="text-lg font-semibold">Customers</h3>
          <ul className="space-y-1 break-words text-base">
            {customers.map((customer) => (
              <li key={customer.id}>{customer.name}</li>
            ))}
            {hasNoCustomer && <li>No customer</li>}
          </ul>
          <h3 className="text-lg font-semibold">Sales from this lot</h3>
          <ul className="space-y-4">
            {sales.map((sale, index) => (
              <li key={`${sale.saleNumber}-${index}`} className="space-y-2">
                <h4 className="text-base font-semibold">
                  <Link href={`/trace?sale=${encodeURIComponent(sale.saleNumber)}`} className={LINK}>
                    {sale.saleNumber}
                  </Link>
                </h4>
                <Facts
                  rows={[
                    ["Sale date", formatDate(sale.saleDate)],
                    ["Customer", sale.customer ?? "No customer"],
                    ["Product", sale.productCode],
                    ["Batch number", sale.batchNumber],
                    ["Lbs drawn", formatWeight(sale.lbsSold)],
                  ]}
                />
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="text-lg font-semibold">Finished stock on hand from this lot</h3>
      {finishedStock.length === 0 ? (
        <p className="text-base">No finished stock from this lot is on hand.</p>
      ) : (
        <ul className="space-y-4">
          {finishedStock.map((stock) => (
            <li key={stock.batchNumber} className="space-y-2">
              <h4 className="break-words text-base font-semibold">{stock.batchNumber}</h4>
              <Facts
                rows={[
                  ["Product", `${stock.productCode} ${stock.product}`],
                  ["Made", formatDate(stock.producedDate)],
                  ["Lbs on hand", formatWeight(stock.lbsRemaining)],
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
