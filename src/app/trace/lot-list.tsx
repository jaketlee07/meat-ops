import Link from "next/link";
import { formatDate, formatWeight } from "../../lib/format";
import type { FoundLots } from "../../lib/trace";
import { Facts } from "../facts";

const LINK =
  "inline-flex min-h-control min-w-control items-center break-all rounded-control text-primary underline";

// Where the section is a table (the `lots-table` variant: the section is the container named
// `lotlist` and at least 27rem wide at the current text size) the header line and every lot share
// one template: the lot number, then Received, Vendor, and Weight. Otherwise each lot is a card.
// The header line follows the list in the page and `order` puts it above the list, so each lot
// stays in the page's order. A lot number breaks only at its hyphens.
const TABLE_COLUMNS =
  "lots-table:grid-cols-[minmax(7rem,1.2fr)_minmax(5.5rem,1fr)_minmax(5rem,2fr)_6rem] lots-table:gap-x-1.5 lots-table:px-4";
// The figures list sits on the three columns after the lot number, the same way Sales' does: each pair
// becomes a cell, its label stays in the page and is hidden visually, the first two values read left and
// the weight reads right.
const FIGURE_CELLS = [
  "lots-table:[&>dl]:grid lots-table:[&>dl]:col-start-2 lots-table:[&>dl]:col-span-3 lots-table:[&>dl]:grid-cols-subgrid lots-table:[&>dl]:border-y-0",
  "lots-table:[&>dl>div]:contents lots-table:[&>dl>div>dt]:sr-only",
  "lots-table:[&>dl>div>dd]:min-w-0 lots-table:[&>dl>div>dd]:max-w-none lots-table:[&>dl>div>dd]:shrink lots-table:[&>dl>div>dd]:text-sm lots-table:[&>dl>div>dd]:font-normal",
  "lots-table:[&>dl>div:nth-child(-n+2)>dd]:text-left",
].join(" ");
const COLUMN_NAMES = ["Lot number", "Received", "Vendor", "Weight"];

// The receipts of one raw product, newest first, or those of one received date.
export function LotList({ code, received, found }: { code: string; received?: string; found: FoundLots | null }) {
  if (!found) return <p tabIndex={-1} data-result-focus className="break-words text-base">{`No raw product has code ${code}.`}</p>;
  const { rawProduct, lots, total } = found;
  return (
    <section aria-labelledby="lot-list-heading" className="@container/lotlist">
      {/* The container cannot style itself, so this div carries the table's card edge. */}
      <div className="flex flex-col gap-4 lots-table:gap-0 lots-table:overflow-hidden lots-table:rounded-card lots-table:border lots-table:border-card-border lots-table:bg-surface">
        <h2
          id="lot-list-heading"
          tabIndex={-1}
          data-result-focus
          className="break-words text-lg font-bold lots-table:-outline-offset-2 lots-table:px-4 lots-table:py-3"
        >
          {`Receipts of ${rawProduct.code}`}
        </h2>
        {lots.length === 0 ? (
          <p className="break-words text-base lots-table:px-4 lots-table:pb-3">
            {received === undefined
              ? `No receipts of ${rawProduct.code} yet.`
              : `No receipt of ${rawProduct.code} was received on ${formatDate(received)}.`}
          </p>
        ) : (
          <>
            {total > lots.length && (
              <p className="lots-table:px-4 lots-table:pb-3">{`Showing the ${lots.length} most recent of ${total} receipts.`}</p>
            )}
            <ul className="flex flex-col gap-3 lots-table:order-2 lots-table:gap-0">
              {lots.map((lot) => (
                <li
                  key={lot.lotNumber}
                  className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3 lots-table:grid lots-table:items-center lots-table:gap-y-0 lots-table:rounded-none lots-table:border-0 lots-table:border-t lots-table:py-1.5 ${TABLE_COLUMNS} ${FIGURE_CELLS}`}
                >
                  <h3 className="text-base font-bold lots-table:col-start-1 lots-table:text-sm lots-table:font-medium">
                    <Link href={`/trace?lot=${encodeURIComponent(lot.lotNumber)}`} className={`${LINK} lots-table:break-normal`}>
                      {lot.lotNumber}
                    </Link>
                  </h3>
                  <Facts
                    rows={[
                      ["Received", formatDate(lot.receivedDate)],
                      ["Vendor", lot.vendor],
                      ["Weight", formatWeight(lot.weightLbs)],
                    ]}
                  />
                </li>
              ))}
            </ul>
            {/* Where the section is a table the header line names the columns; each lot's own labels are hidden visually and stay in the page. */}
            <div
              aria-hidden="true"
              className={`hidden items-end border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary lots-table:order-1 lots-table:grid ${TABLE_COLUMNS}`}
            >
              {COLUMN_NAMES.map((name, index) => (
                <span key={name} className={index === 3 ? "text-right" : undefined}>
                  {name}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
