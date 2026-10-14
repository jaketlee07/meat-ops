"use client";

import Link from "next/link";
import type { Ref } from "react";
import { formatDate, formatPricePerLb, formatWeight } from "../../lib/format";
import { BeforeAfter } from "../before-after";
import { Facts } from "../facts";
import type { SaleSaveState } from "./save-sale";
import { useVoidedSales } from "./voided-sales";

const LINK = "inline-flex min-h-control min-w-control items-center rounded-md text-primary underline";

// A stock figure as the database gave it, or a word where the menu had no row.
function stock(lbs: number | null): string {
  return lbs === null ? "Not available" : formatWeight(lbs);
}

// The live region is in the page before it has content, so a screen reader
// announces what is put into it. After a save the form moves focus to the heading.
// Lots drawn are a stacked list, not a table, so a long batch number fits 320 px.
export function ResultPanel({ state, headingRef }: { state: SaleSaveState; headingRef: Ref<HTMLHeadingElement> }) {
  const { voided } = useVoidedSales();
  const saved = state.status === "saved" ? state : null;
  const sale = saved?.sale;
  const details = saved?.details ?? null;
  const wasVoided = sale ? voided.has(sale.id) : false;

  const rows: Array<readonly [string, string]> = [];
  if (sale) {
    rows.push(
      ["Sale number", sale.saleNumber],
      ["Product", `${sale.productCode} ${sale.productDescription}`],
      ["Customer", sale.customerName ?? "No customer"],
      ["Sale date", formatDate(sale.saleDate)],
    );
    if (details && sale.lbs !== undefined && sale.pricePerLb !== undefined) {
      rows.push(["Lbs", formatWeight(sale.lbs)], ["Price per lb", formatPricePerLb(sale.pricePerLb)]);
    }
  }

  return (
    <div role="status" aria-label="Sale result" className="mt-6 space-y-4">
      {sale && (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-success">
            Sale saved
          </h2>
          <Facts rows={rows} />
          {wasVoided && <p className="font-medium">This sale was voided.</p>}
          {details ? (
            <>
              <h3 className="text-lg font-semibold">Finished lots drawn</h3>
              <ol className="space-y-3">
                {details.lots.map((lot) => (
                  <li key={lot.saleItemId}>
                    <Facts
                      rows={[
                        ["Batch number", lot.batchNumber],
                        ["Made", formatDate(lot.productionDate)],
                        ["Lbs drawn", formatWeight(lot.lbsSold)],
                      ]}
                    />
                  </li>
                ))}
              </ol>
              {!wasVoided && (
                <BeforeAfter
                  title="Finished stock"
                  rows={[
                    {
                      label: `${sale.productCode} on hand`,
                      before: stock(details.stock.before),
                      after: stock(details.stock.after),
                    },
                  ]}
                />
              )}
            </>
          ) : (
            <p>The sale was saved, but its details couldn&apos;t be loaded. Reload this page to see them.</p>
          )}
          <p>
            <Link href={`/trace?sale=${encodeURIComponent(sale.saleNumber)}`} className={LINK}>
              Trace this sale
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
