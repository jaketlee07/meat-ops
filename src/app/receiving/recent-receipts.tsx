import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { RecentReceipt, RecentReceipts as Receipts } from "../../lib/receiving";
import { voidReceipt } from "./actions";
import { Facts } from "./facts";
import { VoidDialog } from "./void-dialog";

const HEADING_ID = "recent-receipts-heading";

// Each receipt is a block of labeled facts, so the list fits a 320 px screen
// with no sideways scroll. The status is the database's: a Void button where
// void_receipt would accept the lot, the reason where it is void, "In use"
// for every other receipt.
function Status({ receipt }: { receipt: RecentReceipt }) {
  if (receipt.status === "void") {
    return <p className="break-words font-medium">{`Void: ${receipt.voidReason ?? ""}`}</p>;
  }
  if (receipt.status === "in-use") return <p className="font-medium">In use</p>;
  return (
    <VoidDialog
      lotNumber={receipt.lotNumber}
      weight={formatWeight(receipt.weightLbs)}
      vendor={receipt.vendorName}
      voidAction={voidReceipt.bind(null, receipt.id)}
      listHeadingId={HEADING_ID}
    />
  );
}

// The product's most recently entered receipts, last entered first. The page
// renders this again after a save or a void, so it always shows the database's
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
                <Status receipt={receipt} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
