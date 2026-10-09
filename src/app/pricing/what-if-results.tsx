import { formatCostPerLb, formatMargin, formatPricePerLb } from "../../lib/format";
import type { WhatIfRow } from "../../lib/pricing";

// What each finished product made from the raw product would cost and sell for
// at the typed raw cost, every figure from price_what_if. The code in the
// message is React text, never markup (AC-0125).
export function WhatIfResults({ rawCode, rows }: { rawCode: string; rows: WhatIfRow[] | null }) {
  if (rows === null || rows.length === 0) {
    return <p className="mt-4 break-words text-base">No active finished product is made from {rawCode}.</p>;
  }
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((row) => (
        <li key={row.product_id} className="rounded-md border border-field-border p-3">
          <h3 className="text-lg font-semibold break-words">
            {row.code} {row.description}
          </h3>
          <dl className="mt-1 space-y-1 text-base tabular-nums">
            <Figure label="Cost per lb" value={formatCostPerLb(row.cost_per_lb)} />
            <Figure label="Suggested price" value={formatPricePerLb(row.suggested_list_price)} />
            <Figure
              label="Margin at today's list price"
              value={row.margin_at_list_pct === null ? "None yet" : formatMargin(row.margin_at_list_pct)}
            />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-2">
      <dt className="text-ink-secondary">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
