"use client";

import { useState } from "react";
import { formatPricePerLb, formatWeight } from "../../lib/format";

export interface MenuCard {
  id: string;
  code: string;
  description: string;
  listPrice: number | null;
  finishedLbs: number;
  rawLbs: number;
  sellable: boolean;
}

const NONE = "No active finished products yet. Add one in Supabase Studio, then reload this page.";
const NOTHING_SELLABLE = "No product can be sold right now.";

// The switch filters the list in the browser, with no request, and starts off on
// every load. The database decides which products are sellable; this only filters.
export function MenuList({ items }: { items: MenuCard[] }) {
  const [sellableOnly, setSellableOnly] = useState(false);
  const shown = sellableOnly ? items.filter((item) => item.sellable) : items;

  if (items.length === 0) return <p className="text-base">{NONE}</p>;

  return (
    <div>
      <label className="mb-4 flex min-h-control items-center gap-3 text-base font-medium">
        <input
          type="checkbox"
          checked={sellableOnly}
          onChange={(event) => setSellableOnly(event.target.checked)}
          className="h-control w-control"
        />
        Sellable only
      </label>
      <div role="status">{sellableOnly && shown.length === 0 && <p className="text-base">{NOTHING_SELLABLE}</p>}</div>
      {shown.length > 0 && (
        <ul className="space-y-3">
          {shown.map((item) => (
            <li key={item.id} className="rounded-md border border-field-border p-3">
              <h2 className="text-lg font-semibold break-words">
                {item.code} {item.description}
              </h2>
              <p className="mt-1 text-base tabular-nums">
                {item.listPrice === null ? "No list price yet" : formatPricePerLb(item.listPrice)}
              </p>
              <dl className="mt-2 space-y-1 text-base tabular-nums">
                <div className="flex flex-wrap justify-between gap-x-2">
                  <dt className="text-ink-secondary">Finished on hand</dt>
                  <dd>{formatWeight(item.finishedLbs)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-x-2">
                  <dt className="text-ink-secondary">Raw on hand</dt>
                  <dd>{formatWeight(item.rawLbs)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-base font-medium">{item.sellable ? "Sellable now" : "Not sellable now"}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
