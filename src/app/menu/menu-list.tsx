"use client";

import { useState } from "react";
import { formatPricePerLb, formatWeight } from "../../lib/format";
import { Facts } from "../facts";

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

// Where the list is a table (the `menu-table` variant: the list's section is the container named `menu`
// and at least 42rem wide at the current text size) the switch, its status line, the header line, and
// every product sit in one white card, and each product is one row of one template: the product's
// heading, then four figure columns. Otherwise the switch is a card and each product is a card. The
// fixed columns hold "No list price yet", a header that names finished stock, a header that names raw
// stock, and "Not sellable now"; the product column takes what is left and wraps a long name.
const TABLE_COLUMNS =
  "menu-table:grid-cols-[minmax(0,1fr)_8rem_7.5rem_6.5rem_8rem] menu-table:gap-x-3 menu-table:px-4";
const COLUMN_NAMES = ["Product", "List price", "Finished on hand", "Raw on hand", "Status"];
// The Facts list sits on the two columns after the list price, the same "cells" way Production's does,
// through the row's own classes: each pair becomes a cell, its label stays in the page and is hidden
// visually, and the values read right.
const FIGURE_CELLS = [
  "menu-table:[&>dl]:grid menu-table:[&>dl]:col-span-2 menu-table:[&>dl]:grid-cols-subgrid menu-table:[&>dl]:border-y-0",
  "menu-table:[&>dl>div]:contents menu-table:[&>dl>div>dt]:sr-only",
  "menu-table:[&>dl>div>dd]:min-w-0 menu-table:[&>dl>div>dd]:max-w-none menu-table:[&>dl>div>dd]:shrink menu-table:[&>dl>div>dd]:text-sm menu-table:[&>dl>div>dd]:font-normal",
].join(" ");

// The switch filters the list in the browser, with no request, and starts off on
// every load. The database decides which products are sellable; this only filters.
export function MenuList({ items }: { items: MenuCard[] }) {
  const [sellableOnly, setSellableOnly] = useState(false);
  const shown = sellableOnly ? items.filter((item) => item.sellable) : items;

  if (items.length === 0) return <p className="text-base">{NONE}</p>;

  return (
    <section className="@container/menu">
      {/* The container cannot style itself, so this div carries the table's card edge. */}
      <div className="menu-table:overflow-hidden menu-table:rounded-card menu-table:border menu-table:border-card-border menu-table:bg-surface">
        <label className="mb-3 flex min-h-control items-center gap-3 rounded-card border border-card-border bg-surface px-3 text-base font-medium menu-table:mb-0 menu-table:rounded-none menu-table:border-0 menu-table:px-4">
          <input
            type="checkbox"
            checked={sellableOnly}
            onChange={(event) => setSellableOnly(event.target.checked)}
            className="h-control w-control"
          />
          Sellable only
        </label>
        <div role="status">
          {sellableOnly && shown.length === 0 && (
            <p className="mb-3 text-base menu-table:mb-0 menu-table:px-4 menu-table:pb-3">{NOTHING_SELLABLE}</p>
          )}
        </div>
        {shown.length > 0 && (
          <>
            {/* Where the list is a table the header line names the columns; each product's own labels are hidden visually and stay in the page. */}
            <div
              aria-hidden="true"
              className={`hidden items-end border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary menu-table:grid ${TABLE_COLUMNS}`}
            >
              {COLUMN_NAMES.map((name, index) => (
                <span key={name} className={index >= 1 && index <= 3 ? "text-right" : undefined}>
                  {name}
                </span>
              ))}
            </div>
            <ul className="space-y-3 menu-table:space-y-0">
              {shown.map((item) => (
                <li
                  key={item.id}
                  className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface p-3.5 menu-table:grid menu-table:min-h-control menu-table:items-center menu-table:gap-y-0 menu-table:rounded-none menu-table:border-0 menu-table:border-t menu-table:py-1.5 ${TABLE_COLUMNS} ${FIGURE_CELLS}`}
                >
                  <h2 className="text-lg font-bold break-words menu-table:text-base">
                    {item.code} {item.description}
                  </h2>
                  <p className="text-xl font-bold tabular-nums break-words menu-table:text-right menu-table:text-sm menu-table:font-semibold">
                    {item.listPrice === null ? "No list price yet" : formatPricePerLb(item.listPrice)}
                  </p>
                  <Facts
                    rows={[
                      ["Finished on hand", formatWeight(item.finishedLbs)],
                      ["Raw on hand", formatWeight(item.rawLbs)],
                    ]}
                  />
                  <p className="font-semibold break-words menu-table:text-sm">
                    {item.sellable ? "Sellable now" : "Not sellable now"}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
