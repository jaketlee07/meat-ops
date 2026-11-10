import { formatWeight } from "../../lib/format";
import type { StockLine } from "../../lib/home";

const HEADING_ID = "stock-on-hand-heading";
const NOTHING = "No stock on hand.";

// Each product's lbs on hand, as the database counted them: code, description, lbs. The code and the
// lbs never break; the description takes what is left and wraps.
export function StockOnHand({ lines }: { lines: StockLine[] }) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-card border border-card-border bg-surface p-3.5 desk:p-4"
    >
      <h2 id={HEADING_ID} className="mb-3 text-xl font-semibold">
        Stock on hand
      </h2>
      {lines.length === 0 ? (
        <p className="text-base">{NOTHING}</p>
      ) : (
        <ul className="divide-y divide-card-border border-y border-card-border">
          {lines.map((line) => (
            <li key={line.productId} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5">
              <span className="whitespace-nowrap text-base font-semibold">{line.code}</span>
              <span className="min-w-0 flex-1 basis-32 break-words text-sm text-ink-secondary">{line.description}</span>
              <span className="whitespace-nowrap text-base font-semibold tabular-nums">{formatWeight(line.lbsOnHand)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
