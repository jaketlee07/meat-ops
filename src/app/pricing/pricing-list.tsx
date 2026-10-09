"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatCostPerLb, formatMargin, formatPricePerLb } from "../../lib/format";
import { priceAdvice, type PriceAction } from "../../lib/price-advice";
import type { PricingRow } from "../../lib/pricing";
import { ApplyButton } from "./apply-button";
import type { ChangeState } from "./save-change";

const GROUPS = [
  { heading: "Needs a new price", pick: (row: PricingRow) => row.needsNewPrice },
  { heading: "Priced", pick: (row: PricingRow) => row.hasCost && !row.needsNewPrice },
  { heading: "No cost yet", pick: (row: PricingRow) => !row.hasCost && !row.needsNewPrice },
] as const;

interface Message {
  kind: "saved" | "refused";
  text: string;
}

function isPriceAction(value: string | null): value is PriceAction {
  return value === "set" || value === "raise" || value === "lower";
}

// The three headed groups of product cards. The database sorted the rows and set
// every flag, so a row goes to its group by its flags and keeps its place. The
// list owns the message region: a saved list price moves its card to another
// group, so the message cannot live in the card.
export function PricingList({ rows }: { rows: PricingRow[] }) {
  const [message, setMessage] = useState<Message | null>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const refusedRef = useRef<HTMLDivElement>(null);

  // Keyboard focus follows the message (AC-0134, AC-0137).
  useEffect(() => {
    if (!message) return;
    (message.kind === "saved" ? savedRef : refusedRef).current?.focus();
  }, [message]);

  function show(state: ChangeState) {
    if (state.status === "saved") setMessage({ kind: "saved", text: state.message });
    else if (state.status === "refused") setMessage({ kind: "refused", text: state.message });
    else if (state.status === "invalid") setMessage({ kind: "refused", text: state.fieldError });
  }

  return (
    <div className="space-y-6">
      {/* Both regions are in the page before they have text, so each message is announced. */}
      <div>
        <div
          ref={savedRef}
          role="status"
          tabIndex={-1}
          className="break-words text-base font-medium text-success"
        >
          {message?.kind === "saved" ? message.text : null}
        </div>
        <div
          ref={refusedRef}
          role="alert"
          tabIndex={-1}
          className="break-words text-base font-medium text-error"
        >
          {message?.kind === "refused" ? message.text : null}
        </div>
      </div>
      {GROUPS.map(({ heading, pick }) => {
        const group = rows.filter(pick);
        if (group.length === 0) return null;
        return (
          <section key={heading} aria-labelledby={`group-${heading.replaceAll(" ", "-")}`}>
            <h2 id={`group-${heading.replaceAll(" ", "-")}`} className="mb-3 text-xl font-semibold">
              {heading}
            </h2>
            <ul className="space-y-3">
              {group.map((row) => (
                <ProductCard key={row.productId} row={row} onResult={show} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ProductCard({ row, onResult }: { row: PricingRow; onResult: (state: ChangeState) => void }) {
  const advice =
    row.needsNewPrice &&
    isPriceAction(row.priceAction) &&
    row.costPerLb !== null &&
    row.suggestedListPrice !== null
      ? {
          action: row.priceAction,
          suggestedListPrice: row.suggestedListPrice,
          text: priceAdvice({
            costPerLb: row.costPerLb,
            suggestedListPrice: row.suggestedListPrice,
            targetMarginPct: row.targetMargin,
            listPricePerLb: row.listPrice,
            marginAtListPct: row.marginAtList,
            marginFeesPerLb: row.marginFeesPerLb ?? 0,
          }),
        }
      : null;

  return (
    <li className="rounded-md border border-field-border p-3">
      <h3 className="text-lg font-semibold break-words">
        <Link
          href={`/pricing?product=${encodeURIComponent(row.code)}`}
          className="inline-flex min-h-control items-center text-primary underline"
        >
          {row.code} {row.description}
        </Link>
      </h3>
      <dl className="mt-1 space-y-1 text-base tabular-nums">
        <Figure label="Cost per lb" value={row.costPerLb === null ? "None yet" : formatCostPerLb(row.costPerLb)} />
        <Figure
          label="List price"
          value={row.listPrice === null ? "No list price yet" : formatPricePerLb(row.listPrice)}
        />
        <Figure
          label="Suggested price"
          value={row.suggestedListPrice === null ? "No price yet" : formatPricePerLb(row.suggestedListPrice)}
        />
        <Figure
          label="Margin at list price"
          value={row.marginAtList === null ? "None yet" : formatMargin(row.marginAtList)}
        />
        <Figure
          label="Target margin"
          value={row.targetMargin === null ? "No target" : formatMargin(row.targetMargin)}
        />
      </dl>
      {advice && (
        <>
          <p className="mt-3 break-words text-base">{advice.text}</p>
          <ApplyButton
            productId={row.productId}
            action={advice.action}
            suggestedListPrice={advice.suggestedListPrice}
            onResult={onResult}
          />
        </>
      )}
    </li>
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
