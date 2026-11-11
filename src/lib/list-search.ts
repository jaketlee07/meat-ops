import { isCalendarDate } from "./batch-input";

// What a Recent list's search reads: the address parser and the values that reach PostgREST. The parser makes
// a search from the address's q, date, and rows; the two value builders turn the text into one escaped
// regular-expression value, so each character matches only itself. Nothing here reads the database.

export interface ListSearch {
  // Trimmed, at most 100 UTF-16 code units, no NUL. Empty means no text filter.
  text: string;
  // A real calendar day written yyyy-mm-dd, or null.
  date: string | null;
  // How many rows to read, from 10 to 50.
  rows: number;
}

export const DEFAULT_ROWS = 10;
export const MAX_ROWS = 50;
const MAX_TEXT_UNITS = 100;

// The search a list reads when its address carries none.
export const NO_SEARCH: ListSearch = { text: "", date: null, rows: DEFAULT_ROWS };

// Whether a search narrows the list: a text or a date. A row count alone does not.
export function isSearchSet(search: ListSearch): boolean {
  return search.text !== "" || search.date !== null;
}

function textOf(value: unknown): string {
  if (typeof value !== "string") return "";
  let text = value.replaceAll("\u0000", "").trim();
  if (text.length > MAX_TEXT_UNITS) {
    // Keep the longest start of at most 100 units that does not split a surrogate pair.
    let end = MAX_TEXT_UNITS;
    const last = text.charCodeAt(end - 1);
    const next = text.charCodeAt(end);
    if (last >= 0xd800 && last <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end -= 1;
    text = text.slice(0, end).trim();
  }
  return text;
}

function dateOf(value: unknown): string | null {
  if (typeof value !== "string" || !isCalendarDate(value)) return null;
  const year = Number(value.slice(0, 4));
  return year >= 100 && year <= 9999 ? value : null;
}

function rowsOf(value: unknown): number {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) return DEFAULT_ROWS;
  // Leading zeros go, so no digit string becomes a number past 50.
  const digits = value.replace(/^0+/, "");
  if (digits.length > 2) return MAX_ROWS;
  return Math.min(MAX_ROWS, Math.max(DEFAULT_ROWS, Number(digits || "0")));
}

export function parseListSearch(params: { q?: unknown; date?: unknown; rows?: unknown }): ListSearch {
  return { text: textOf(params.q), date: dateOf(params.date), rows: rowsOf(params.rows) };
}

// The text with the regular-expression specials escaped, for a single-column imatch, where quotes are kept
// as written.
export function escapeForImatch(text: string): string {
  return text.replace(/[\\.^$*+?()[\]{}|]/g, "\\$&");
}

// The same value double-quoted for or(), which parses commas, parentheses, and quotes as syntax. The
// escaped value goes through the quoting's own escape of \ and ".
export function quoteForOr(text: string): string {
  return `"${escapeForImatch(text).replace(/[\\"]/g, "\\$&")}"`;
}
