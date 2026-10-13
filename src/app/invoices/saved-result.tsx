import type { Ref } from "react";
import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import { BeforeAfter } from "../before-after";
import { Facts } from "../facts";
import { showAverage, showOnHand } from "../stock-view";
import type { SaveState } from "./save-draft";

type Saved = Extract<SaveState, { status: "saved" }>;

// What a save made: each new lot, then each touched raw product's stock before
// and after. The status region around it is in the page before it has content,
// so a screen reader announces what is put into it; a save moves focus to the heading.
export function SavedResult({ saved, headingRef }: { saved: Saved; headingRef: Ref<HTMLHeadingElement> }) {
  const count = saved.lots.length;
  return (
    <>
      <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-success">
        {count === 1 ? "Saved 1 receipt." : `Saved ${count} receipts.`}
      </h2>
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
    </>
  );
}
