import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { RecentReceipt, RecentReceipts as Receipts } from "../../lib/receiving";
import { Facts } from "../facts";
import { correctReceipt, voidReceipt } from "./actions";
import { CorrectDialog } from "./correct-dialog";
import { VoidDialog } from "./void-dialog";

const HEADING_ID = "recent-receipts-heading";

// Each receipt is a block of labeled facts, so the list fits a 320 px screen
// with no sideways scroll. The status is the database's: a Void button where
// void_receipt would accept the lot, the reason where it is void, "In use"
// for every other receipt. Every receipt that is not void also has a Correct
// button. Both controls keep their place in the row, so a re-render of the list
// keeps the state of each.
function Status({ receipt }: { receipt: RecentReceipt }) {
  if (receipt.status === "void") {
    return <p className="break-words font-medium">{`Void: ${receipt.voidReason ?? ""}`}</p>;
  }
  return (
    <div className="flex flex-wrap items-start gap-2">
      {receipt.status === "in-use" ? (
        <p className="flex min-h-control items-center font-medium">In use</p>
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
    <section aria-labelledby={HEADING_ID} className="space-y-4">
      <h2 id={HEADING_ID} tabIndex={-1} className="text-xl font-semibold">
        Recent receipts
      </h2>
      {total === 0 ? (
        <p>No receipts for this product yet.</p>
      ) : (
        <>
          {total > receipts.length && <p>{`Showing the ${receipts.length} most recent of ${total} receipts.`}</p>}
          <ul className="space-y-4">
            {receipts.map((receipt) => (
              <li key={receipt.id} className="space-y-2">
                <Facts
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
                    <p className="break-words">{`Received as ${formatWeight(receipt.recordedWeightLbs)} at ${formatCostPerLb(receipt.recordedUnitCost)}.`}</p>
                    <p className="break-words">{`Corrected: ${receipt.correctedReason}`}</p>
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
