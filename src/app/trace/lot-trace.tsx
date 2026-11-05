import Link from "next/link";
import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { LotTrace } from "../../lib/trace";
import { CARD_SECTION, CARD_TOP, Facts } from "../facts";

const LINK =
  "inline-flex min-h-control min-w-control items-center break-all rounded-control text-primary underline";

// Each list's own columns. A list reads as a table where its wrapper is wide enough (its variant in
// globals.css): the row's `li` holds the column rules and places `Facts`'s pairs on them through its own
// classes, the same way Recent sales does. The header line follows the list in the page and `order` puts it
// above the list, because trace.spec.ts finds a list's rows with `h3 + ul > li`, so each `ul` must stay its
// `h3`'s next sibling. Otherwise each item is a card with each label beside its value.
const SALE_COLUMNS =
  "tsale-table:grid-cols-[6rem_5.5rem_minmax(0,1fr)_4rem_6rem_5.5rem] tsale-table:gap-x-1.5 tsale-table:px-4";
const SALE_CELLS = [
  "tsale-table:[&>dl]:grid tsale-table:[&>dl]:col-start-2 tsale-table:[&>dl]:col-span-5 tsale-table:[&>dl]:grid-cols-subgrid tsale-table:[&>dl]:border-y-0",
  "tsale-table:[&>dl>div]:contents tsale-table:[&>dl>div>dt]:sr-only",
  "tsale-table:[&>dl>div>dd]:min-w-0 tsale-table:[&>dl>div>dd]:max-w-none tsale-table:[&>dl>div>dd]:shrink tsale-table:[&>dl>div>dd]:text-sm tsale-table:[&>dl>div>dd]:font-normal",
  "tsale-table:[&>dl>div:nth-child(-n+4)>dd]:text-left",
].join(" ");
const SALE_NAMES = ["Sale number", "Sale date", "Customer", "Product", "Batch number", "Lbs drawn"];

const STOCK_COLUMNS =
  "tstock-table:grid-cols-[minmax(7rem,1fr)_minmax(8rem,2fr)_6rem_6rem] tstock-table:gap-x-1.5 tstock-table:px-4";
const STOCK_CELLS = [
  "tstock-table:[&>dl]:grid tstock-table:[&>dl]:col-start-2 tstock-table:[&>dl]:col-span-3 tstock-table:[&>dl]:grid-cols-subgrid tstock-table:[&>dl]:border-y-0",
  "tstock-table:[&>dl>div]:contents tstock-table:[&>dl>div>dt]:sr-only",
  "tstock-table:[&>dl>div>dd]:min-w-0 tstock-table:[&>dl>div>dd]:max-w-none tstock-table:[&>dl>div>dd]:shrink tstock-table:[&>dl>div>dd]:text-sm tstock-table:[&>dl>div>dd]:font-normal",
  "tstock-table:[&>dl>div:nth-child(-n+2)>dd]:text-left",
].join(" ");
const STOCK_NAMES = ["Batch number", "Product", "Made", "Lbs on hand"];

// A raw lot's trace: the receipt, the customers and sales its stock reached, and
// the finished stock still on hand from it. Every value is React text. The lot's heading and its facts
// list are one white card (CARD_SECTION, CARD_TOP, and the "card-cols" look in facts.tsx draw it); both stay
// direct children of the section, which is the container named `tracelot`. Customers sits beside "Sales from this lot" where the section is wide (`lot-wide`).
export function LotTraceView({ number, trace }: { number: string; trace: LotTrace | null }) {
  if (!trace) return <p tabIndex={-1} data-result-focus className="break-words text-base">{`No receipt has lot number ${number}.`}</p>;
  const { lot, customers, hasNoCustomer, sales, finishedStock } = trace;
  return (
    <section aria-labelledby="lot-trace-heading" className={`@container/tracelot ${CARD_SECTION}`}>
      <h2
        id="lot-trace-heading"
        tabIndex={-1}
        data-result-focus
        className={CARD_TOP}
      >
        {lot.lotNumber}
      </h2>
      <Facts
        look="card-cols"
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
        <div className="grid items-start gap-4 lot-wide:grid-cols-[16.25rem_minmax(0,1fr)]">
          <div className="rounded-card border border-card-border bg-surface p-4">
            <h3 className="mb-2.5 text-lg font-bold">Customers</h3>
            <ul className="break-words border-b border-card-border text-base">
              {customers.map((customer) => (
                <li key={customer.id} className="border-t border-card-border py-2">
                  {customer.name}
                </li>
              ))}
              {hasNoCustomer && <li className="border-t border-card-border py-2">No customer</li>}
            </ul>
          </div>
          <div className="@container/tracesales min-w-0">
            {/* The container cannot style itself, so this div carries the table's card edge. */}
            <div className="flex flex-col gap-3 tsale-table:gap-0 tsale-table:overflow-hidden tsale-table:rounded-card tsale-table:border tsale-table:border-card-border tsale-table:bg-surface">
              <h3 className="text-lg font-bold tsale-table:px-4 tsale-table:py-3">Sales from this lot</h3>
              <ul className="flex flex-col gap-3 tsale-table:order-2 tsale-table:gap-0">
                {sales.map((sale, index) => (
                  <li
                    key={`${sale.saleNumber}-${index}`}
                    className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3 tsale-table:grid tsale-table:items-center tsale-table:gap-y-0 tsale-table:rounded-none tsale-table:border-0 tsale-table:border-t tsale-table:py-1.5 ${SALE_COLUMNS} ${SALE_CELLS}`}
                  >
                    <h4 className="text-base font-bold tsale-table:col-start-1 tsale-table:text-sm tsale-table:font-medium">
                      <Link
                        href={`/trace?sale=${encodeURIComponent(sale.saleNumber)}`}
                        className={`${LINK} tsale-table:break-normal`}
                      >
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
              {/* Where the wrapper is a table the header line names the columns; each sale's own labels are hidden visually and stay in the page. */}
              <div
                aria-hidden="true"
                className={`hidden items-end border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary tsale-table:order-1 tsale-table:grid ${SALE_COLUMNS}`}
              >
                {SALE_NAMES.map((name, index) => (
                  <span key={name} className={index === 5 ? "text-right" : undefined}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="@container/tracestock">
        {/* The container cannot style itself, so this div carries the table's card edge. */}
        <div className="flex flex-col gap-3 tstock-table:gap-0 tstock-table:overflow-hidden tstock-table:rounded-card tstock-table:border tstock-table:border-card-border tstock-table:bg-surface">
          <h3 className="text-lg font-bold tstock-table:px-4 tstock-table:py-3">Finished stock on hand from this lot</h3>
          {finishedStock.length === 0 ? (
            <p className="text-base tstock-table:px-4 tstock-table:pb-3">No finished stock from this lot is on hand.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-3 tstock-table:order-2 tstock-table:gap-0">
                {finishedStock.map((stock) => (
                  <li
                    key={stock.batchNumber}
                    className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3 tstock-table:grid tstock-table:items-center tstock-table:gap-y-0 tstock-table:rounded-none tstock-table:border-0 tstock-table:border-t tstock-table:py-2.5 ${STOCK_COLUMNS} ${STOCK_CELLS}`}
                  >
                    <h4 className="break-words text-base font-bold tstock-table:text-sm tstock-table:font-medium">{stock.batchNumber}</h4>
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
              <div
                aria-hidden="true"
                className={`hidden items-end border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary tstock-table:order-1 tstock-table:grid ${STOCK_COLUMNS}`}
              >
                {STOCK_NAMES.map((name, index) => (
                  <span key={name} className={index === 3 ? "text-right" : undefined}>
                    {name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
