import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import { BeforeAfter } from "../before-after";
import { Facts } from "../facts";
import { showAverage, showOnHand } from "../stock-view";
import type { SaveState } from "./save-draft";

type Saved = Extract<SaveState, { status: "saved" }>;

// The outcome sentence. The review puts it in its status region, so a screen
// reader announces it, and a save moves focus to it.
export const savedSentence = (count: number) => (count === 1 ? "Saved 1 receipt." : `Saved ${count} receipts.`);

// What a save made: each new lot, then each touched raw product's stock before
// and after. It sits outside the status region, so only the sentence is announced. The section is the
// container named saved (`saved-pair` in globals.css): where it has room the lot cards and the tables each sit
// two to a row. The list's items are exactly the lots; the tables sit outside it, each on its own card.
const CARD = "min-w-0 rounded-card border border-card-border bg-surface p-4";
const PAIR = "grid grid-cols-1 items-start gap-4 saved-pair:grid-cols-2";

export function SavedResult({ saved }: { saved: Saved }) {
  return (
    <section aria-label="Saved receipts" className="@container/saved space-y-4">
      <ul className={PAIR}>
        {saved.lots.map((lot) => (
          <li key={lot.lotNumber} className={`${CARD} [&>dl]:border-t-0`}>
            <Facts
              rows={[
                ["Lot number", lot.lotNumber],
                ["Product", `${lot.productCode} ${lot.productDescription}`],
                ["Vendor", lot.vendorName],
                ["Received", formatDate(lot.receivedDate)],
                ["Weight", formatWeight(lot.weightLbs)],
                ["Cost per lb", formatCostPerLb(lot.unitCost)],
              ]}
            />
          </li>
        ))}
      </ul>
      {saved.totals ? (
        <div className={PAIR}>
          {saved.totals.map((product) => (
            <div key={product.code} className={CARD}>
              <BeforeAfter
                title={`${product.code} ${product.description}`}
                rows={[
                  { label: "On hand", before: showOnHand(product.before), after: showOnHand(product.after) },
                  { label: "Average cost", before: showAverage(product.before), after: showAverage(product.after) },
                ]}
              />
            </div>
          ))}
        </div>
      ) : (
        <p>The receipts were saved, but the new totals could not be loaded. Reload the page to see them.</p>
      )}
    </section>
  );
}
