import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { RecentReceipt, RecentReceipts as Receipts } from "../../lib/receiving";
import { Facts } from "../facts";
import { correctReceipt, voidReceipt } from "./actions";
import { CorrectDialog } from "./correct-dialog";
import { VoidDialog } from "./void-dialog";

const HEADING_ID = "recent-receipts-heading";

// Where the section is a table (the `receipt-table` variant: 1280 px wide and the section wide
// enough for these tracks at the current text size) it reads as one template for the header line
// and every receipt: six figure columns and an actions column. Otherwise each receipt is a card.
// The figure columns are sized for a six-digit weight with three decimals, or a cost of $10 or
// more; a figure's unit may drop under its number. The lot number column holds "L-20261031-", so a
// lot number may wrap at its second hyphen. The date and vendor may wrap, and the vendor takes
// what is left.
const TABLE_COLUMNS =
  "receipt-table:grid-cols-[5.75rem_3.5rem_minmax(0,1fr)_5.5rem_5.5rem_5.5rem_5.75rem] receipt-table:gap-x-1.5 receipt-table:px-4";
// The facts list spans the six figure columns. The first three values read left and the
// figures read right; a lot number breaks only at its hyphen, any other value breaks inside
// a word only when nothing else fits.
const FIGURE_CELLS =
  "receipt-table:[&>dl]:col-span-6 receipt-table:[&>dl>div:nth-child(-n+3)>dd]:text-left receipt-table:[&>dl>div:first-child>dd]:break-normal";
const COLUMN_NAMES = ["Lot number", "Received", "Vendor", "Weight", "Cost per lb", "Remaining"];
// The status and buttons sit in the last column, on the receipt's first line.
const ACTIONS = "receipt-table:col-start-7 receipt-table:row-start-1 receipt-table:justify-end";
// While a refusal or the "Receipt corrected" panel has text, the status area takes a row of its
// own across the receipt, below the figures; its place in the page does not change.
const MESSAGE_ROW =
  "receipt-table:status-has-message:col-span-full receipt-table:status-has-message:col-start-1 receipt-table:status-has-message:row-start-auto receipt-table:status-has-message:justify-start receipt-table:status-has-message:pb-2";

// Each receipt is a card of labeled facts, so the list fits a 320 px screen
// with no sideways scroll; where the section is a table it is a row of it. The status is the database's: a Void button where
// void_receipt would accept the lot, the reason where it is void, "In use"
// for every other receipt. Every receipt that is not void also has a Correct
// button. Both controls keep their place in the row, so a re-render of the list
// keeps the state of each.
function Status({ receipt }: { receipt: RecentReceipt }) {
  if (receipt.status === "void") {
    return <p className={`break-words font-semibold text-error ${ACTIONS} receipt-table:text-right`}>{`Void: ${receipt.voidReason ?? ""}`}</p>;
  }
  return (
    <div className={`flex flex-wrap items-start gap-2 ${ACTIONS} ${MESSAGE_ROW}`}>
      {receipt.status === "in-use" ? (
        <p className="flex min-h-control items-center rounded-full bg-card-border px-2.5 text-sm font-semibold">In use</p>
      ) : (
        <VoidDialog
          lotNumber={receipt.lotNumber}
          weight={formatWeight(receipt.weightLbs)}
          vendor={receipt.vendorName}
          voidAction={voidReceipt.bind(null, receipt.id)}
          listHeadingId={HEADING_ID}
        />
      )}
      <CorrectDialog
        lotNumber={receipt.lotNumber}
        vendor={receipt.vendorName}
        weight={formatWeight(receipt.weightLbs)}
        costText={receipt.costText}
        weightText={receipt.weightText}
        correctAction={correctReceipt.bind(null, receipt.id)}
      />
    </div>
  );
}

// The product's most recently entered receipts, last entered first. The page
// renders this again after a save, a void, or a correction, so it always shows the database's
// current status.
export function RecentReceipts({ receipts, total }: Receipts) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="@container/receipts space-y-2 desk:[grid-area:recent] wide:space-y-0 wide:overflow-hidden wide:rounded-card wide:border wide:border-card-border wide:bg-surface"
    >
      <h2 id={HEADING_ID} tabIndex={-1} className="text-lg font-bold wide:-outline-offset-2 wide:px-4 wide:py-3">
        Recent receipts
      </h2>
      {total === 0 ? (
        <p className="wide:px-4 wide:pb-3">No receipts for this product yet.</p>
      ) : (
        <>
          {total > receipts.length && <p className="wide:px-4 wide:pb-3">{`Showing the ${receipts.length} most recent of ${total} receipts.`}</p>}
          {/* Where the section is a table the header line names the columns; each receipt's own labels are hidden visually and stay in the page. */}
          <div
            aria-hidden="true"
            className={`hidden border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary receipt-table:grid ${TABLE_COLUMNS}`}
          >
            {COLUMN_NAMES.map((name, index) => (
              <span key={name} className={index >= 3 ? "text-right" : undefined}>
                {name}
              </span>
            ))}
            <span />
          </div>
          <ul className="space-y-3 wide:px-4 wide:pb-4 receipt-table:space-y-0 receipt-table:p-0">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3 receipt-table:grid receipt-table:items-center receipt-table:gap-y-0 receipt-table:rounded-none receipt-table:border-0 receipt-table:border-t receipt-table:py-1.5 ${TABLE_COLUMNS} ${FIGURE_CELLS}`}
              >
                <Facts
                  look="cells"
                  rows={[
                    ["Lot number", receipt.lotNumber],
                    ["Received", formatDate(receipt.receivedDate)],
                    ["Vendor", receipt.vendorName],
                    ["Weight", formatWeight(receipt.weightLbs)],
                    ["Cost per lb", formatCostPerLb(receipt.unitCost)],
                    ["Remaining", formatWeight(receipt.remainingLbs)],
                  ]}
                />
                {receipt.correctedReason !== null && (
                  <>
                    <p className="break-words receipt-table:col-span-full">{`Received as ${formatWeight(receipt.recordedWeightLbs)} at ${formatCostPerLb(receipt.recordedUnitCost)}.`}</p>
                    <p className="break-words receipt-table:col-span-full receipt-table:pb-2">{`Corrected: ${receipt.correctedReason}`}</p>
                  </>
                )}
                <Status receipt={receipt} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
