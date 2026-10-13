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
// and after. It sits outside the status region, so only the sentence is announced.
export function SavedResult({ saved }: { saved: Saved }) {
  return (
    <section aria-label="Saved receipts" className="space-y-4">
      <ul className="space-y-4">
        {saved.lots.map((lot) => (
          <li key={lot.lotNumber}>
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
        saved.totals.map((product) => (
          <BeforeAfter
            key={product.code}
            title={`${product.code} ${product.description}`}
            rows={[
              { label: "On hand", before: showOnHand(product.before), after: showOnHand(product.after) },
              { label: "Average cost", before: showAverage(product.before), after: showAverage(product.after) },
            ]}
          />
        ))
      ) : (
        <p>The receipts were saved, but the new totals could not be loaded. Reload the page to see them.</p>
      )}
    </section>
  );
}
