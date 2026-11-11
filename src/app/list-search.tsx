"use client";

import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MAX_ROWS } from "../lib/list-search";
import { CONTROL, DATE_BOX, IconBox, LABEL } from "./form-parts";

// The search form and the lines under a Recent list, shared by Recent receipts, Recent batches, and Recent
// sales. The page parses its address with `parseListSearch` (src/lib/list-search.ts) and passes the result
// in as `text`, `date`, and `rows`; nothing here reads the database.

const STEP = 10;

export const TOO_MANY_VENDORS = "Too many vendors match. Type more of the name.";

// A secondary button, as the invoice draft review's: each floor page keeps Save as its one main button.
const BUTTON = "min-w-24 rounded-control border border-field-border bg-surface px-4 text-base font-bold text-ink";
const LINK = "inline-flex min-h-control items-center rounded-control text-primary underline";

// The page's own address, with the chosen product where the page has one and the search that is set.
function addressOf(path: string, product: string | null, text: string, date: string | null, rows: number | null): string {
  const params = new URLSearchParams();
  if (product !== null) params.set("product", product);
  if (text !== "") params.set("q", text);
  if (date !== null) params.set("date", date);
  if (rows !== null) params.set("rows", String(rows));
  const query = params.toString();
  return query === "" ? path : `${path}?${query}`;
}

// The named GET form above a list: a text box, a date box, and a button. It sends the page's own address its
// `q` and `date` (and the hidden `product`), with no `rows`, so a new search opens at 10 rows. The boxes show
// the address's search and follow it when it changes; "Show 10 more" leaves them as they are.
export function SearchForm({
  name,
  slug,
  dateLabel,
  path,
  product,
  text,
  date,
  inset,
}: {
  // The form's accessible name, such as "Search receipts".
  name: string;
  // Makes the boxes' ids, such as "receipts".
  slug: string;
  dateLabel: string;
  path: string;
  product: string | null;
  text: string;
  date: string | null;
  // The classes that line the form up with the list's own text, where the list is a card.
  inset: string;
}) {
  const key = JSON.stringify([text, date]);
  const [seen, setSeen] = useState(key);
  const [typed, setTyped] = useState(text);
  const [day, setDay] = useState(date ?? "");
  if (seen !== key) {
    setSeen(key);
    setTyped(text);
    setDay(date ?? "");
  }
  const textId = `${slug}-search-text`;
  const dateId = `${slug}-search-date`;
  return (
    <Form action={path} scroll={false} aria-label={name} className={`flex flex-wrap items-end gap-3 ${inset}`}>
      {product !== null && <input type="hidden" name="product" value={product} />}
      <div className="min-w-0 grow basis-48">
        <label htmlFor={textId} className={LABEL}>
          Search
        </label>
        <input
          id={textId}
          name="q"
          type="text"
          autoComplete="off"
          maxLength={100}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className={CONTROL}
        />
      </div>
      <div className="min-w-40 grow basis-44">
        <label htmlFor={dateId} className={LABEL}>
          {dateLabel}
        </label>
        <IconBox icon="calendar">
          <input id={dateId} name="date" type="date" value={day} onChange={(event) => setDay(event.target.value)} className={DATE_BOX} />
        </IconBox>
      </div>
      <button type="submit" className={BUTTON}>
        Search
      </button>
    </Form>
  );
}

// What a Recent list says under its rows, and "Show 10 more". It stays in the page in every state, so that
// once a press of "Show 10 more" has added rows it can focus the first of them, even when that press shows
// the last match and the link goes. `listId` is the id of the list's `ul`, whose rows carry `tabIndex={-1}`.
export function ListEnd({
  noun,
  listId,
  path,
  product,
  text,
  date,
  rows,
  shown,
  total,
  tooMany = false,
  inset,
}: {
  // "receipts", "batches", or "sales".
  noun: string;
  listId: string;
  path: string;
  product: string | null;
  text: string;
  date: string | null;
  // The row count the address asked for, from 10 to 50.
  rows: number;
  // How many rows the list shows, and how many match.
  shown: number;
  total: number;
  // Recent receipts only: more vendor names match the text than a search supports.
  tooMany?: boolean;
  inset: string;
}) {
  const asked = useRef<number | null>(null);
  useEffect(() => {
    if (asked.current === null || shown <= asked.current) return;
    const row = document.getElementById(listId)?.children[asked.current];
    asked.current = null;
    if (row instanceof HTMLElement) row.focus();
  }, [shown, listId]);

  const clear = (
    <Link href={addressOf(path, product, "", null, null)} scroll={false} className={LINK}>
      Clear search
    </Link>
  );
  if (tooMany) {
    return (
      <div className={inset}>
        <p>{TOO_MANY_VENDORS}</p>
        {clear}
      </div>
    );
  }
  if (total === 0) {
    // With no search the list says its own "none yet" line.
    return text === "" && date === null ? null : (
      <div className={inset}>
        <p>{`No ${noun} match.`}</p>
        {clear}
      </div>
    );
  }
  if (shown >= total) return null;
  if (shown >= MAX_ROWS) {
    return (
      <p className={inset}>{`Showing ${shown} of ${total} ${noun}. Search or pick a date to find the rest.`}</p>
    );
  }
  return (
    <div className={inset}>
      <p>{`Showing ${shown} of ${total} ${noun}.`}</p>
      <Link
        href={addressOf(path, product, text, date, Math.min(MAX_ROWS, rows + STEP))}
        replace
        scroll={false}
        onClick={() => {
          asked.current = shown;
        }}
        className={LINK}
      >
        Show 10 more
      </Link>
    </div>
  );
}
