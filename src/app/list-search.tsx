"use client";

import Form from "next/form";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { DEFAULT_ROWS, isSearchSet, type ListSearch, MAX_ROWS } from "../lib/list-search";
import { CONTROL, DATE_BOX, IconBox, LABEL } from "./form-parts";

// The search form and the lines under a Recent list, shared by Recent receipts, Recent batches, and Recent
// sales. The page parses its address with `parseListSearch` (src/lib/list-search.ts); `SearchForm` receives the
// result's `text` and `date`, and `ListEnd` the whole search. Nothing here reads the database.

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

// One string for a parsed address: the chosen product, the search text and date, and the row count.
const addressKey = (product: string | null, text: string, date: string | null, rows: number): string =>
  JSON.stringify([product, text, date, rows]);

// The id of a list's Search text box, such as "receipts-search-text".
const textIdOf = (slug: string): string => `${slug}-search-text`;

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
  const textId = textIdOf(slug);
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

// What a Recent list says under its rows, and its link. It stays in the page in every state. Its status region
// holds the line, so a screen reader hears each new one; the link sits after the region, outside it. A press of
// "Show 10 more" or "Clear search" that navigates this tab arms one focus move for the address it opens: to the first
// row it adds, or to the list's Search box. The first page to land after the press runs that move only if it is that
// address, and disarms it either way, so a press that another navigation overtakes moves nothing. `listId` is the id
// of the list's `ul`, whose rows carry `tabIndex={-1}`.
export function ListEnd({
  noun,
  slug,
  listId,
  path,
  product,
  search,
  shown,
  total,
  tooMany = false,
  inset,
  collapsed,
}: {
  // "receipts", "batches", or "sales".
  noun: string;
  // The search form's `slug`, which names its Search box.
  slug: string;
  listId: string;
  path: string;
  product: string | null;
  // The address's search; its row count is from 10 to 50.
  search: ListSearch;
  // How many rows the list shows, and how many match.
  shown: number;
  total: number;
  // Recent receipts only: more vendor names match the text than a search supports.
  tooMany?: boolean;
  inset: string;
  // The classes that cancel the section's gap above this end while it shows nothing, so it takes no room there.
  collapsed: string;
}) {
  const searching = isSearchSet(search);
  // The armed focus move: the key of the address it waits for, and where to move focus there.
  const armed = useRef<{ key: string; target: () => Element | null | undefined } | null>(null);
  // `search` reaches here only through server components, so each page that lands brings its own object, and this
  // runs once for each page.
  useEffect(() => {
    const move = armed.current;
    armed.current = null;
    if (move === null || move.key !== addressKey(product, search.text, search.date, search.rows)) return;
    const target = move.target();
    if (target instanceof HTMLElement) target.focus();
  }, [product, search]);

  const clear = (
    <Link
      href={addressOf(path, product, "", null, null)}
      scroll={false}
      // Next calls onNavigate only for a press that navigates in this tab, not a Cmd, Ctrl, Shift, or Alt one, so only
      // that press arms a move: to the Search box, on the page with no search.
      onNavigate={() => {
        armed.current = {
          key: addressKey(product, "", null, DEFAULT_ROWS),
          target: () => document.getElementById(textIdOf(slug)),
        };
      }}
      className={LINK}
    >
      Clear search
    </Link>
  );
  let line: string | null = null;
  let link: ReactNode = null;
  if (tooMany) {
    line = TOO_MANY_VENDORS;
    link = clear;
  } else if (total === 0) {
    // With no search the list says its own "none yet" line.
    if (searching) {
      line = `No ${noun} match.`;
      link = clear;
    }
  } else if (shown < total && shown >= MAX_ROWS) {
    line = `Showing ${shown} of ${total} ${noun}. Search or pick a date to find the rest.`;
  } else if (shown < total) {
    line = `Showing ${shown} of ${total} ${noun}.`;
    const rows = Math.min(MAX_ROWS, search.rows + STEP);
    link = (
      <Link
        href={addressOf(path, product, search.text, search.date, rows)}
        replace
        scroll={false}
        // As for Clear search, only a press that navigates this tab arms the move: to the row at the count shown now,
        // the first the press adds, if the page it opens has that row.
        onNavigate={() => {
          armed.current = {
            key: addressKey(product, search.text, search.date, rows),
            target: () => document.getElementById(listId)?.children[shown],
          };
        }}
        className={LINK}
      >
        Show 10 more
      </Link>
    );
  }
  // Each address gives its line a new element, so a search whose line reads as the last one's is announced too.
  const lineKey = addressKey(product, search.text, search.date, search.rows);
  return (
    <div className={line === null ? collapsed : inset}>
      <div role="status">{line !== null && <p key={lineKey}>{line}</p>}</div>
      {link}
    </div>
  );
}
