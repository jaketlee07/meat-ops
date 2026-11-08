"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatCostPerLb, formatMargin, formatPricePerLb } from "../../lib/format";
import type { PricingRow } from "../../lib/pricing";
import { PriceAdviceBlock } from "./price-advice-block";
import type { ChangeState } from "./save-change";
import { Figure } from "./figure";

const GROUPS = [
  { heading: "Needs a new price", pick: (row: PricingRow) => row.needsNewPrice },
  { heading: "Priced", pick: (row: PricingRow) => row.hasCost && !row.needsNewPrice },
  { heading: "No cost yet", pick: (row: PricingRow) => !row.hasCost && !row.needsNewPrice },
] as const;

// One template for a group's header line and every product row, so the columns line up. Where the
// list is a table (the `price-table` variant, see globals.css) each product is one row of it.
const TABLE_COLUMNS = "price-table:grid-cols-[minmax(0,2.2fr)_repeat(5,minmax(0,1fr))] price-table:gap-x-2 price-table:px-3.5";
const COLUMN_NAMES = ["Cost per lb", "List price", "Suggested price", "Margin at list price", "Target margin"];

// The open product's row: a tint and an accent edge on the left.
// Where the list is a table the edge is an inset shadow, so it takes no room from the row's content and
// the row's columns stay under the header line's.
const OPEN_ROW = "bg-page border-l-4 border-l-primary price-table:shadow-[inset_4px_0_0_0_var(--color-primary)]";

const TILE_EDGES = {
  "Needs a new price": "border-t-status-needs",
  Priced: "border-t-status-priced",
  "No cost yet": "border-t-status-nocost",
} as const;

// The count of products in each group, counted from the rows the list shows.
export function ProductTiles({ rows }: { rows: PricingRow[] }) {
  return (
    <ul aria-label="Product counts" className="mb-4 grid grid-cols-3 gap-2 desk:gap-3">
      {GROUPS.map(({ heading, pick }) => (
        <li
          key={heading}
          className={`flex flex-col-reverse gap-0.5 rounded-xl border border-t-3 border-card-border bg-surface px-2.5 py-2 desk:flex-col desk:gap-1 desk:rounded-card desk:px-4 desk:py-3 ${TILE_EDGES[heading]}`}
        >
          <span className="text-xs font-semibold text-ink-secondary desk:text-sm">{heading}</span>
          <span className="text-2xl font-bold tabular-nums">{rows.filter(pick).length}</span>
        </li>
      ))}
    </ul>
  );
}

interface Message {
  kind: "saved" | "refused";
  text: string;
}

// The three headed groups of product cards. The database sorted the rows and set
// every flag, so a row goes to its group by its flags and keeps its place. The
// list owns the message region: a saved list price moves its card to another
// group, so the message cannot live in the card. The product whose details are
// open (openCode) is marked and leaves out its advice, which the details hold.
export function PricingList({ rows, openCode }: { rows: PricingRow[]; openCode?: string }) {
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
    <div className="@container/pricing space-y-6">
      {/* Both regions are in the page before they have text, so each message is announced.
          Beside the details panel, with no message the first group sits at the panel's top. */}
      <div className={openCode === undefined ? undefined : "mb-0 has-[[role]:not(:empty)]:mb-6"}>
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
          <section
            key={heading}
            aria-labelledby={`group-${heading.replaceAll(" ", "-")}`}
            className="price-table:overflow-hidden price-table:rounded-card price-table:border price-table:border-card-border price-table:bg-surface"
          >
            <h2
              id={`group-${heading.replaceAll(" ", "-")}`}
              className="mb-2.5 text-lg font-bold price-table:mb-0 price-table:px-3.5 price-table:py-3 price-table:text-base"
            >
              {heading}
            </h2>
            {/* Where the list is a table the header line names the columns; each row's own labels are hidden visually and stay in the page. */}
            <div
              aria-hidden="true"
              className={`hidden border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary price-table:grid ${TABLE_COLUMNS}`}
            >
              <span>Product</span>
              {COLUMN_NAMES.map((name) => (
                <span key={name} className="text-right">
                  {name}
                </span>
              ))}
            </div>
            <ul className="space-y-3 price-table:space-y-0">
              {group.map((row) => (
                <ProductCard key={row.productId} row={row} open={row.code === openCode} onResult={show} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function ProductCard({
  row,
  open,
  onResult,
}: {
  row: PricingRow;
  open: boolean;
  onResult: (state: ChangeState) => void;
}) {
  return (
    <li
      className={`rounded-card border border-card-border p-3.5 price-table:grid price-table:items-center price-table:rounded-none price-table:border-0 price-table:border-t price-table:py-2 ${TABLE_COLUMNS} ${open ? OPEN_ROW : "bg-surface"}`}
    >
      <h3 className="text-lg font-bold break-words price-table:text-base">
        <Link
          href={`/pricing?product=${encodeURIComponent(row.code)}`}
          aria-current={open ? "page" : undefined}
          className="inline-flex min-h-control items-center text-primary underline"
        >
          {row.code} {row.description}
        </Link>
      </h3>
      <dl
        className={`mt-2.5 flex flex-col gap-y-1.5 text-note tabular-nums${
          row.listPrice === null ? " [&>div:nth-child(2)>dd]:font-normal [&>div:nth-child(2)>dd]:text-ink-secondary" : ""
        } price-table:col-span-5 price-table:mt-0 price-table:grid price-table:grid-cols-subgrid price-table:gap-y-0 price-table:text-sm price-table:[&>div]:contents price-table:[&_dd]:text-right price-table:[&_dt]:sr-only`}
      >
        <Figure
          label="Cost per lb"
          value={!row.hasCost || row.costPerLb === null ? "None yet" : formatCostPerLb(row.costPerLb)}
        />
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
      {!open && <PriceAdviceBlock row={row} onResult={onResult} />}
    </li>
  );
}
