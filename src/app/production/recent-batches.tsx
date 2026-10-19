import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { RecentBatches as Batches } from "../../lib/production";
import { Facts } from "../facts";
import { reverseBatch } from "./actions";
import { ReverseControl, type Preview } from "./reverse-control";

const HEADING_ID = "recent-batches-heading";

// The product's most recently entered batches, last entered first. The page
// renders this again after a save or a reversal, so the saved batch is the
// first one listed and a reversed one shows its reason. Each batch is a block of
// labeled facts, so the list fits 320 px. Every batch keeps its Reverse control
// in place, so a re-render of the list keeps the state of each; the control shows
// the button only while the batch is not reversed. `previews` holds what each
// batch that is not reversed would do, as the page read it.
export function RecentBatches({
  batches,
  total,
  productId,
  productCode,
  previews,
}: Batches & { productId: string; productCode: string; previews: Record<string, Preview> }) {
  return (
    <section aria-labelledby={HEADING_ID} className="space-y-4">
      <h2 id={HEADING_ID} className="text-xl font-semibold">
        Recent batches
      </h2>
      {total === 0 ? (
        <p>No batches for this product yet.</p>
      ) : (
        <>
          {total > batches.length && <p>{`Showing the ${batches.length} most recent of ${total} batches.`}</p>}
          <ul className="space-y-4">
            {batches.map((batch) => (
              <li key={batch.id} className="space-y-2">
                <Facts
                  rows={[
                    ["Batch number", batch.batchNumber],
                    ["Production date", formatDate(batch.productionDate)],
                    ["Raw lbs in", formatWeight(batch.rawLbsIn)],
                    ["Finished lbs out", formatWeight(batch.finishedLbsOut)],
                    ["Cost per finished lb", formatCostPerLb(batch.costPerFinishedLb)],
                  ]}
                />
                {batch.reversedAt !== null && (
                  <p className="break-words font-medium">{`Reversed: ${batch.reversalReason ?? ""}`}</p>
                )}
                <ReverseControl
                  batchNumber={batch.batchNumber}
                  madeOn={formatDate(batch.productionDate)}
                  finishedLbs={formatWeight(batch.finishedLbsOut)}
                  productCode={productCode}
                  reversed={batch.reversedAt !== null}
                  preview={previews[batch.id] ?? null}
                  reverseAction={reverseBatch.bind(null, batch.id, productId)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
