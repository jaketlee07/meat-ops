import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { RecentBatches as Batches } from "../../lib/production";
import { Facts } from "../receiving/facts";

const HEADING_ID = "recent-batches-heading";

// The product's most recently entered batches, last entered first. The page
// renders this again after a save, so the saved batch is the first one listed.
// Each batch is a block of labeled facts, so the list fits 320 px.
export function RecentBatches({ batches, total }: Batches) {
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
              <li key={batch.id}>
                <Facts
                  rows={[
                    ["Batch number", batch.batchNumber],
                    ["Production date", formatDate(batch.productionDate)],
                    ["Raw lbs in", formatWeight(batch.rawLbsIn)],
                    ["Finished lbs out", formatWeight(batch.finishedLbsOut)],
                    ["Cost per finished lb", formatCostPerLb(batch.costPerFinishedLb)],
                  ]}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
