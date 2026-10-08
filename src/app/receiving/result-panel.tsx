import type { Ref } from "react";
import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { SaveState, Totals } from "./actions";
import { Facts } from "./facts";
import { NO_FINISHED, showAverage, showOnHand, showPrice } from "./stock-view";

interface Row {
  label: string;
  before: string;
  after: string;
}

// A table of values before and after the receipt, each as the database held it.
function BeforeAfter({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <table className="w-full border-collapse text-base">
      <thead>
        <tr className="border-y border-field-border">
          <th scope="col" className="py-2 pr-2 text-left font-medium text-ink-secondary">
            {title}
          </th>
          <th scope="col" className="px-2 py-2 text-right font-medium text-ink-secondary">
            Before
          </th>
          <th scope="col" className="py-2 pl-2 text-right font-medium text-ink-secondary">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-field-border">
            <th scope="row" className="break-words py-2 pr-2 text-left font-normal">
              {row.label}
            </th>
            <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{row.before}</td>
            <td className="whitespace-nowrap py-2 pl-2 text-right font-medium tabular-nums">{row.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalsView({ totals }: { totals: Totals }) {
  const { stock, prices } = totals;
  return (
    <>
      <BeforeAfter
        title="Stock"
        rows={[
          { label: "On hand", before: showOnHand(stock.before), after: showOnHand(stock.after) },
          { label: "Average cost", before: showAverage(stock.before), after: showAverage(stock.after) },
        ]}
      />
      {prices.length === 0 ? (
        <p>{NO_FINISHED}</p>
      ) : (
        <BeforeAfter
          title="Suggested price"
          rows={prices.map((price) => ({
            label: `${price.code} ${price.description}`,
            before: showPrice(price.before),
            after: showPrice(price.after),
          }))}
        />
      )}
    </>
  );
}

// The live region is in the page before it has content, so a screen reader
// announces what is put into it. After a save the form moves focus to the heading.
export function ResultPanel({ state, headingRef }: { state: SaveState; headingRef: Ref<HTMLHeadingElement> }) {
  return (
    <div role="status" aria-label="Receipt result" className="mt-6 space-y-4">
      {state.status === "saved" && (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-success">
            Receipt saved
          </h2>
          <Facts
            rows={[
              ["Lot number", state.lot.lotNumber],
              ["Product", `${state.lot.productCode} ${state.lot.productDescription}`],
              ["Vendor", state.lot.vendorName],
              ["Received", formatDate(state.lot.receivedDate)],
              ["Weight", formatWeight(state.lot.weightLbs)],
              ["Cost per lb", formatCostPerLb(state.lot.unitCost)],
            ]}
          />
          {state.totals ? (
            <TotalsView totals={state.totals} />
          ) : (
            <p>The receipt was saved, but its new totals could not be loaded. Reload the page to see them.</p>
          )}
        </>
      )}
    </div>
  );
}
