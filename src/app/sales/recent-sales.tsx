import Link from "next/link";
import { formatDate, formatPricePerLb, formatWeight } from "../../lib/format";
import type { RecentSales as Sales, SaleSummary } from "../../lib/sales";
import { Facts } from "../facts";
import { StatusTag } from "../status-tag";
import { voidSale } from "./actions";
import { VoidDialog } from "./void-dialog";

const HEADING_ID = "recent-sales-heading";

// Where the section is a table (the `sale-table` variant: the section is the container named
// `sales` and at least 40rem wide at the current text size) it reads as one template for the header
// line and every sale: a first column that stacks the sale date over the sale number, four figure
// columns, and an actions column. Otherwise each sale is a card. The first column holds a sale number
// (about 139 px at 14 px text) and a date on one line each; the fixed columns hold a product code, a six-digit weight with three
// decimals, and a price; the customer takes what is left and may wrap.
const TABLE_COLUMNS =
  "sale-table:grid-cols-[9rem_minmax(0,1fr)_4rem_5.5rem_5.25rem_5rem] sale-table:gap-x-1.5 sale-table:px-4";
// The figures list sits on the five columns before the actions, the same "cells" way Production's does,
// through the row's own classes: it takes the row's two lines (the date on the first, the sale number
// under it on the second), each pair becomes a cell, its label stays in the page and is hidden visually,
// the first three values read left and the two figures read right. The date and the customer, product,
// and figures all sit on the first line; no part of the date breaks.
const FIGURE_CELLS = [
  "sale-table:[&>dl]:grid sale-table:[&>dl]:col-start-1 sale-table:[&>dl]:col-span-5 sale-table:[&>dl]:row-start-1 sale-table:[&>dl]:row-span-2 sale-table:[&>dl]:grid-cols-subgrid sale-table:[&>dl]:grid-rows-subgrid sale-table:[&>dl]:border-y-0",
  "sale-table:[&>dl>div]:contents sale-table:[&>dl>div>dt]:sr-only",
  "sale-table:[&>dl>div>dd]:row-start-1 sale-table:[&>dl>div>dd]:min-w-0 sale-table:[&>dl>div>dd]:max-w-none sale-table:[&>dl>div>dd]:shrink sale-table:[&>dl>div>dd]:text-sm sale-table:[&>dl>div>dd]:font-normal",
  "sale-table:[&>dl>div:nth-child(-n+3)>dd]:text-left",
  "sale-table:[&>dl>div:nth-child(1)>dd]:whitespace-nowrap sale-table:[&>dl>div:nth-child(1)>dd]:break-normal",
].join(" ");
const COLUMN_NAMES = ["Sale date", "Customer", "Product", "Lbs", "Price per lb"];
// The Void button or the "Voided" tag sits in the last column, across the sale's two lines.
const ACTIONS = "sale-table:col-start-6 sale-table:row-start-1 sale-table:row-span-2 sale-table:justify-end";
// The Void button is a quiet outlined button: ink on the surface with the field border, 44 px tall (the
// global button rule), and px-3. It lives in the dialog component, so its look is set here, from the row.
const QUIET_BUTTONS =
  "[&>div>button]:border-field-border [&>div>button]:px-3 [&>div>button]:text-sm [&>div>button]:text-ink";
// While a refusal has text, the actions area takes a row of its own across the sale, below the
// figures; its place in the page does not change.
const MESSAGE_ROW =
  "sale-table:status-has-message:col-span-full sale-table:status-has-message:col-start-1 sale-table:status-has-message:row-start-auto sale-table:status-has-message:row-span-1 sale-table:status-has-message:justify-start sale-table:status-has-message:pb-2";

// The database's mark: a Void button on a sale that is not void, a "Voided" tag and the
// reason on one that is.
function Status({ sale }: { sale: SaleSummary }) {
  if (sale.voidedAt !== null) {
    // The "Voided" tag sits in the actions column; the reason is its own quiet line, across the row below the figures.
    return (
      <>
        <p className={`flex ${ACTIONS}`}>
          <StatusTag tone="nocost">Voided</StatusTag>
        </p>
        <p className="min-w-0 break-words text-sm text-ink-secondary sale-table:col-span-full">{sale.voidReason ?? ""}</p>
      </>
    );
  }
  return (
    <div className={`flex flex-wrap items-start gap-x-1.5 ${QUIET_BUTTONS} ${ACTIONS} ${MESSAGE_ROW}`}>
      <VoidDialog
        saleId={sale.id}
        saleNumber={sale.saleNumber}
        productCode={sale.productCode}
        lbs={formatWeight(sale.lbsSold)}
        customer={sale.customer}
        voidAction={voidSale.bind(null, sale.id)}
        listHeadingId={HEADING_ID}
      />
    </div>
  );
}

// The 10 last-entered sales, shown by sale date, newest first, void ones included. Each is a
// card of labeled facts, so the list fits a 320 px screen with no sideways
// scroll; where the section is a table it is a row of it. The page renders this
// again after a save or a void.
export function RecentSales({ sales, total }: Sales) {
  return (
    <section aria-labelledby={HEADING_ID} className="@container/sales mt-8 desk:mt-0 desk:[grid-area:recent]">
      {/* The container cannot style itself, so this div carries the table's card edge. */}
      <div className="space-y-2 sale-table:space-y-0 sale-table:overflow-hidden sale-table:rounded-card sale-table:border sale-table:border-card-border sale-table:bg-surface">
        <h2 id={HEADING_ID} tabIndex={-1} className="text-lg font-bold sale-table:-outline-offset-2 sale-table:px-4 sale-table:py-3">
          Recent sales
        </h2>
        {total === 0 ? (
          <p className="sale-table:px-4 sale-table:pb-3">No sales yet.</p>
        ) : (
          <>
            {total > sales.length && (
              <p className="sale-table:px-4 sale-table:pb-3">{`Showing the ${sales.length} most recent of ${total} sales.`}</p>
            )}
            {/* Where the section is a table the header line names the columns; each sale's own labels are hidden visually and stay in the page. */}
            <div
              aria-hidden="true"
              className={`hidden items-end border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary sale-table:grid ${TABLE_COLUMNS}`}
            >
              {COLUMN_NAMES.map((name, index) => (
                <span key={name} className={index >= 3 ? "text-right" : undefined}>
                  {name}
                </span>
              ))}
              <span />
            </div>
            <ul className="space-y-3 sale-table:space-y-0">
              {sales.map((sale) => (
                <li
                  key={sale.id}
                  className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3 sale-table:grid sale-table:items-center sale-table:gap-y-0 sale-table:rounded-none sale-table:border-0 sale-table:border-t sale-table:py-1.5 ${TABLE_COLUMNS} ${FIGURE_CELLS}`}
                >
                  <h3 className="text-base font-bold sale-table:col-start-1 sale-table:row-start-2 sale-table:whitespace-nowrap sale-table:text-sm sale-table:font-medium">
                    <Link
                      href={`/trace?sale=${encodeURIComponent(sale.saleNumber)}`}
                      className="inline-flex min-h-control min-w-control items-center break-all rounded-control text-primary underline sale-table:break-normal"
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
      </div>
    </section>
  );
}
