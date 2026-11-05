import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { RecentReceipt, RecentReceipts as Receipts } from "../../lib/receiving";
import { Facts } from "../facts";
import { correctReceipt, voidReceipt } from "./actions";
import { CorrectDialog } from "./correct-dialog";
import { VoidDialog } from "./void-dialog";

const HEADING_ID = "recent-receipts-heading";

// From wide up the section reads as a table: one template for the header line and every
// receipt, six figure columns and an actions column. Under wide each receipt is a card.
const TABLE_COLUMNS =
  "wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_repeat(3,minmax(0,1fr))_minmax(0,1.4fr)] wide:gap-x-2 wide:px-4";
const COLUMN_NAMES = ["Lot number", "Received", "Vendor", "Weight", "Cost per lb", "Remaining"];
// The status and buttons sit in the last column, on the receipt's first line.
const ACTIONS = "wide:col-start-7 wide:row-start-1 wide:justify-end";

// Each receipt is a card of labeled facts, so the list fits a 320 px screen
// with no sideways scroll; from wide up it is a row of a table. The status is the database's: a Void button where
// void_receipt would accept the lot, the reason where it is void, "In use"
// for every other receipt. Every receipt that is not void also has a Correct
// button. Both controls keep their place in the row, so a re-render of the list
// keeps the state of each.
function Status({ receipt }: { receipt: RecentReceipt }) {
  if (receipt.status === "void") {
    return <p className={`break-words font-semibold text-error ${ACTIONS} wide:text-right`}>{`Void: ${receipt.voidReason ?? ""}`}</p>;
  }
  return (
    <div className={`flex flex-wrap items-start gap-2 ${ACTIONS}`}>
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
      className="space-y-2 desk:[grid-area:recent] wide:space-y-0 wide:overflow-hidden wide:rounded-card wide:border wide:border-card-border wide:bg-surface"
    >
      <h2 id={HEADING_ID} tabIndex={-1} className="text-lg font-bold wide:px-4 wide:py-3">
        Recent receipts
      </h2>
      {total === 0 ? (
        <p className="wide:px-4 wide:pb-3">No receipts for this product yet.</p>
      ) : (
        <>
          {total > receipts.length && <p className="wide:px-4 wide:pb-3">{`Showing the ${receipts.length} most recent of ${total} receipts.`}</p>}
          {/* From wide up the header line names the columns; each receipt's own labels are hidden visually and stay in the page. */}
          <div
            aria-hidden="true"
            className={`hidden border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary wide:grid ${TABLE_COLUMNS}`}
          >
            {COLUMN_NAMES.map((name, index) => (
              <span key={name} className={index >= 3 ? "text-right" : undefined}>
                {name}
              </span>
            ))}
            <span />
          </div>
          <ul className="space-y-3 wide:space-y-0">
            {receipts.map((receipt) => (
              <li
                key={receipt.id}
                className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3 wide:grid wide:items-center wide:gap-y-0 wide:rounded-none wide:border-0 wide:border-t wide:py-1.5 ${TABLE_COLUMNS}`}
              >
                <Facts
                  inline
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
                    <p className="break-words wide:col-span-full">{`Received as ${formatWeight(receipt.recordedWeightLbs)} at ${formatCostPerLb(receipt.recordedUnitCost)}.`}</p>
                    <p className="break-words wide:col-span-full wide:pb-2">{`Corrected: ${receipt.correctedReason}`}</p>
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
