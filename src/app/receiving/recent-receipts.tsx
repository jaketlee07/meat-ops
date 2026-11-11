import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { ListSearch } from "../../lib/list-search";
import type { RecentReceipt, RecentReceipts as Receipts } from "../../lib/receiving";
import { Facts } from "../facts";
import { ListEnd, SearchForm } from "../list-search";
import { REASON_LINE, StatusTag } from "../status-tag";
import { correctReceipt, voidReceipt } from "./actions";
import { CorrectDialog } from "./correct-dialog";
import { VoidDialog } from "./void-dialog";

const HEADING_ID = "recent-receipts-heading";
const LIST_ID = "recent-receipts-list";
// The search form and the lines under the list line up with the list's own text where the section is a card.
const INSET = "wide:px-4 wide:pb-3";

// Where the section is a table (the `receipt-table` variant: 1280 px wide and the section wide
// enough for these tracks at the current text size) it reads as one template for the header line
// and every receipt: a first column that stacks the Received date over the lot number, three figure
// columns, the vendor, and an actions column. Otherwise each receipt is a card. The first column holds a
// lot number ("L-20261031-" and six hex digits, up to about 141 px at 14 px text) on one line; the figure
// columns hold a six-digit weight with three decimals (about 86 px) or a cost of $10 or more (about 81 px),
// and a figure's unit may drop under its number; the actions column holds "In use" and Correct side by
// side (about 155 px). The vendor takes what is left and may wrap.
const TABLE_COLUMNS =
  "receipt-table:grid-cols-[9rem_minmax(0,1fr)_5.4rem_5.15rem_5.4rem_9.8rem] receipt-table:gap-x-1.5 receipt-table:px-4";
// The facts list spans the five columns before the actions and places each value by hand: the date over
// the lot number in the first column, the vendor and the figures on the date's line. Values read left in the
// first two columns and right in the figures; no line of the first cell breaks, and any other value breaks
// inside a word only when nothing else fits. The lot number is the second line, in quiet ink; the vendor spans
// both lines, so a vendor that wraps onto a second line leaves the lot number directly under its date.
const FIGURE_CELLS = [
  "receipt-table:[&>dl]:col-span-5",
  "receipt-table:[&>dl>div:nth-child(-n+3)>dd]:text-left",
  "receipt-table:[&>dl>div:nth-child(-n+2)>dd]:whitespace-nowrap receipt-table:[&>dl>div:nth-child(-n+2)>dd]:break-normal",
  "receipt-table:[&>dl>div:nth-child(1)>dd]:col-start-1 receipt-table:[&>dl>div:nth-child(1)>dd]:row-start-2 receipt-table:[&>dl>div:nth-child(1)>dd]:text-ink-secondary",
  "receipt-table:[&>dl>div:nth-child(2)>dd]:col-start-1 receipt-table:[&>dl>div:nth-child(2)>dd]:row-start-1",
  "receipt-table:[&>dl>div:nth-child(3)>dd]:col-start-2 receipt-table:[&>dl>div:nth-child(3)>dd]:row-start-1 receipt-table:[&>dl>div:nth-child(3)>dd]:row-span-2",
  "receipt-table:[&>dl>div:nth-child(4)>dd]:col-start-3 receipt-table:[&>dl>div:nth-child(4)>dd]:row-start-1",
  "receipt-table:[&>dl>div:nth-child(5)>dd]:col-start-4 receipt-table:[&>dl>div:nth-child(5)>dd]:row-start-1",
  "receipt-table:[&>dl>div:nth-child(6)>dd]:col-start-5 receipt-table:[&>dl>div:nth-child(6)>dd]:row-start-1",
].join(" ");
const COLUMN_NAMES = ["Received", "Vendor", "Weight", "Cost per lb", "Remaining"];
// The status and buttons sit in the last column, on the receipt's first line.
const ACTIONS = "receipt-table:col-start-6 receipt-table:row-start-1 receipt-table:justify-end";
// Void and Correct are two quiet outlined buttons side by side, a 6 px gap apart with their tops level.
// The buttons live in the dialog components, so their look is set here, from the row that holds them:
// ink on the surface with the field border, 44 px tall (the global button rule), and px-3.
const QUIET_BUTTONS =
  "[&>div>button]:border-field-border [&>div>button]:px-3 [&>div>button]:text-sm [&>div>button]:text-ink";
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
    // The "Voided" tag sits in the actions column; the reason is its own quiet line, across the row below the figures.
    return (
      <>
        <p className={`flex ${ACTIONS}`}>
          <StatusTag tone="nocost">Voided</StatusTag>
        </p>
        <p className={`${REASON_LINE} receipt-table:col-span-full`}>{receipt.voidReason ?? ""}</p>
      </>
    );
  }
  return (
    <div className={`flex flex-wrap items-start gap-1.5 ${QUIET_BUTTONS} ${ACTIONS} ${MESSAGE_ROW}`}>
      {receipt.status === "in-use" ? (
        <p className="flex min-h-control items-center">
          <StatusTag tone="nocost">In use</StatusTag>
        </p>
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

// The product's receipts that match the search, latest entered first: the first `search.rows`, 10 with no
// search. The page renders this again after a save, a void, or a correction, so it always shows the
// database's current status. A found receipt renders as a recent one does.
export function RecentReceipts({
  receipts,
  total,
  tooManyVendors,
  search,
  productCode,
}: Receipts & { search: ListSearch; productCode: string }) {
  const searching = search.text !== "" || search.date !== null;
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="@container/receipts space-y-2 wide:space-y-0 wide:overflow-hidden wide:rounded-card wide:border wide:border-card-border wide:bg-surface"
    >
      <h2 id={HEADING_ID} tabIndex={-1} className="text-lg font-bold wide:-outline-offset-2 wide:px-4 wide:py-3">
        Recent receipts
      </h2>
      <SearchForm
        name="Search receipts"
        slug="receipts"
        dateLabel="Received on"
        path="/receiving"
        product={productCode}
        text={search.text}
        date={search.date}
        inset={INSET}
      />
      {total === 0 && !searching && <p className="wide:px-4 wide:pb-3">No receipts for this product yet.</p>}
      {total > 0 && (
        <>
          {/* Where the section is a table the header line names the columns; each receipt's own labels are hidden visually and stay in the page. */}
          <div
            aria-hidden="true"
            className={`hidden border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary receipt-table:grid ${TABLE_COLUMNS}`}
          >
            {COLUMN_NAMES.map((name, index) => (
              <span key={name} className={index >= 2 ? "text-right" : undefined}>
                {name}
              </span>
            ))}
            <span />
          </div>
          <ul id={LIST_ID} className="space-y-3 wide:px-4 wide:pb-4 receipt-table:space-y-0 receipt-table:p-0">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                tabIndex={-1}
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
      <ListEnd
        noun="receipts"
        listId={LIST_ID}
        path="/receiving"
        product={productCode}
        text={search.text}
        date={search.date}
        rows={search.rows}
        shown={receipts.length}
        total={total}
        tooMany={tooManyVendors === true}
        inset={INSET}
      />
    </section>
  );
}
