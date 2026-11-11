import { expect, type Locator, type Page } from "@playwright/test";
import type { TypedClient } from "../../src/lib/supabase";
import {
  callAsClient,
  type OpCall,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  reverseCall,
  VENDOR_ID,
  voidReceiptCall,
  voidSaleCall,
} from "../db";
import { signInOperator } from "../users";
import { openReversal } from "./production-page";

// What the list-search specs share, named for all four lists: each list's search box, the section it sits in,
// and the checks of where a control sits. Menu's box is read through these; the three Recent lists add theirs beside it.

export const NO_MATCH = "No products match.";

// The section of the list a control belongs to: the nearest section above it.
export function sectionOf(control: Locator): Locator {
  return control.locator("xpath=ancestor::section[1]");
}

export function menuSearch(page: Page): Locator {
  return page.getByRole("textbox", { name: "Search products", exact: true });
}

// The status region inside Menu's section (the shell has one of its own).
export function menuStatus(page: Page): Locator {
  return sectionOf(page.getByLabel("Sellable only")).getByRole("status");
}

// Types a search into Menu's box as the owner would, one input event per change.
export async function typeMenuSearch(page: Page, text: string): Promise<void> {
  const box = menuSearch(page);
  await box.click();
  await box.fill(text);
  await expect(box).toHaveValue(text);
}

export async function boxOf(target: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const found = await target.boundingBox();
  expect(found, "box").not.toBeNull();
  return found!;
}

// A control sits inside its section's box, and neither it nor an ancestor clips or overflows sideways.
export async function expectInside(control: Locator, section: Locator, named: string): Promise<void> {
  const inner = await boxOf(control);
  const outer = await boxOf(section);
  expect(inner.x, `${named}: left edge`).toBeGreaterThanOrEqual(outer.x - 0.5);
  expect(inner.y, `${named}: top edge`).toBeGreaterThanOrEqual(outer.y - 0.5);
  expect(inner.x + inner.width, `${named}: right edge`).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
  expect(inner.y + inner.height, `${named}: bottom edge`).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
  const overflow = await control.evaluate((node) => ({
    // A text box scrolls its own long text inside itself, so only the other controls are read for their own overflow.
    own: node instanceof HTMLInputElement && node.type === "text" ? 0 : node.scrollWidth - node.clientWidth,
    clippedBy: (() => {
      const clips: string[] = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent);
        if (css.overflowX !== "visible" && parent.scrollWidth > parent.clientWidth + 0.5) {
          clips.push(parent.tagName.toLowerCase());
        }
      }
      return clips;
    })(),
  }));
  expect(overflow.own, `${named}: its own content overflows sideways`).toBeLessThanOrEqual(0);
  expect(overflow.clippedBy, `${named}: an ancestor clips sideways`).toEqual([]);
}

// The page does not scroll sideways at its current size.
export async function expectNoSidewaysScroll(page: Page, named: string): Promise<void> {
  const read = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  expect(read.scroll, `${named}: the page's scroll width`).toBeLessThanOrEqual(read.client);
  expect(read.body, `${named}: the body's scroll width`).toBeLessThanOrEqual(read.client);
}

// ---- The three Recent lists ----

export interface RecentList {
  key: "receipts" | "batches" | "sales";
  // The accessible name of the search form, the date box's label, and the plural the lines use.
  form: string;
  dateLabel: string;
  noun: string;
  // The page, with `?product=` where the page has one, and the page's h1.
  path: string;
  product: string | null;
  title: string;
  // The id of the list's `ul`, the ids of the two boxes, and a number as it reads in a row.
  listId: string;
  textId: string;
  dateId: string;
  numberPattern: RegExp;
  prefix: string;
}

export const RECEIPTS: RecentList = {
  key: "receipts",
  form: "Search receipts",
  dateLabel: "Received on",
  noun: "receipts",
  path: "/receiving",
  product: "RAW-TOM",
  title: "Receiving",
  listId: "recent-receipts-list",
  textId: "receipts-search-text",
  dateId: "receipts-search-date",
  numberPattern: /LT-\d{3}/,
  prefix: "LT",
};
export const BATCHES: RecentList = {
  key: "batches",
  form: "Search batches",
  dateLabel: "Produced on",
  noun: "batches",
  path: "/production",
  product: "502",
  title: "Production",
  listId: "recent-batches-list",
  textId: "batches-search-text",
  dateId: "batches-search-date",
  numberPattern: /BT-\d{3}/,
  prefix: "BT",
};
export const SALES: RecentList = {
  key: "sales",
  form: "Search sales",
  dateLabel: "Sold on",
  noun: "sales",
  path: "/sales",
  product: null,
  title: "Sales",
  listId: "recent-sales-list",
  textId: "sales-search-text",
  dateId: "sales-search-date",
  numberPattern: /SL-\d{3}/,
  prefix: "SL",
};
export const RECENT_LISTS = [RECEIPTS, BATCHES, SALES] as const;

export const ALPHA = "Alpha Farms";
export const BETA = "Beta Meats";
export const GAMMA = "Gamma Ranch";
export const DAY_A = "2026-09-15";
export const DAY_B = "2026-09-16";

export const numberOf = (list: RecentList, i: number): string => `${list.prefix}-${String(i).padStart(3, "0")}`;
export const numbersOf = (list: RecentList, indexes: number[]): string[] => indexes.map((i) => numberOf(list, i));

// Where a mixed seed puts row i of 12: three groups of four (the name that vendors and customers carry), and the
// first six on one day, the rest on the next.
export const groupOf = (i: number): string => (i <= 4 ? ALPHA : i <= 8 ? BETA : GAMMA);
export const mixedDay = (i: number): string => (i <= 6 ? DAY_A : DAY_B);

let operatorClient: TypedClient | null = null;
async function operator(): Promise<TypedClient> {
  operatorClient ??= await signInOperator();
  return operatorClient;
}

async function runOperation(call: OpCall): Promise<string> {
  const outcome = await callAsClient(await operator(), call);
  expect(outcome.ok, `${call.fn}: ${outcome.error}`).toBe(true);
  // The operation answers a one-row table: the client hands back the row, or an array holding it.
  const answer = outcome.rows?.[0] as { id?: string } | { id?: string }[] | undefined;
  const row = Array.isArray(answer) ? answer[0] : answer;
  return String(row?.id);
}

async function namedId(table: "vendors" | "customers", name: string): Promise<string> {
  const found = await query<{ id: string }>(`select id from ${table} where name = $1`, [name]);
  if (found[0]) return String(found[0].id);
  const [row] = await query<{ id: string }>(`insert into ${table}(name) values ($1) returning id`, [name]);
  return String(row?.id);
}

export interface Seed {
  // "mixed": three groups and two days, as groupOf and mixedDay say. "uniform": one name, one day.
  shape: "mixed" | "uniform";
  vendor?: (i: number) => string;
  // The number of the first row, 1 when unset, so a later seed adds rows after an earlier one's. Only a seed from 1
  // stocks the raw and finished lots that batches and sales draw from.
  from?: number;
}

const dayOf = (shape: Seed["shape"], i: number): string => (shape === "mixed" ? mixedDay(i) : DAY_A);
const nameOf = (seed: Seed, i: number): string => seed.vendor?.(i) ?? (seed.shape === "mixed" ? groupOf(i) : ALPHA);

// Raw stock for the batch and sale seeds, through the operation.
async function stockRaw(): Promise<void> {
  await runOperation(receiveCall(RAW_TOM_ID, VENDOR_ID, 100000, 1.5, "2026-01-01"));
}

// Seeds n rows of a list through the operations, numbered from `seed.from` (1 when unset) in entry order, so the
// newest entered has the highest number. Returns the ids of the receipts, batches, or sales, in the same order.
export async function seedRows(list: RecentList, n: number, seed: Seed = { shape: "uniform" }): Promise<string[]> {
  const ids: string[] = [];
  const from = seed.from ?? 1;
  const last = from + n - 1;
  if (list.key === "receipts") {
    for (let i = from; i <= last; i++) {
      const vendor = await namedId("vendors", nameOf(seed, i));
      ids.push(
        await runOperation({
          fn: "receive_lot",
          args: {
            p_product_id: RAW_TOM_ID,
            p_vendor_id: vendor,
            p_weight_lbs: 100,
            p_unit_cost: 1.5,
            p_received: dayOf(seed.shape, i),
            p_lot_number: numberOf(list, i),
            p_notes: null,
          },
        }),
      );
    }
    return ids;
  }
  if (from === 1) await stockRaw();
  if (list.key === "batches") {
    for (let i = from; i <= last; i++) {
      ids.push(
        await runOperation({
          fn: "produce_batch",
          args: {
            p_finished_product_id: PROD_502_ID,
            p_raw_lbs_in: 10,
            p_finished_lbs_out: null,
            p_production_date: dayOf(seed.shape, i),
            p_batch_number: numberOf(list, i),
            p_notes: null,
          },
        }),
      );
    }
    return ids;
  }
  if (from === 1) await runOperation(produceCall(PROD_502_ID, 50000, null, "2026-02-01"));
  for (let i = from; i <= last; i++) {
    const customer = await namedId("customers", nameOf(seed, i));
    ids.push(
      await runOperation({
        fn: "record_sale",
        args: {
          p_finished_product_id: PROD_502_ID,
          p_lbs: 1,
          p_price_per_lb: 3.29,
          p_customer_id: customer,
          p_sale_date: dayOf(seed.shape, i),
          p_sale_number: numberOf(list, i),
        },
      }),
    );
  }
  return ids;
}

// Voids a receipt or a sale, or reverses a batch, through its operation, so its row carries its tag and reason.
export async function closeRow(list: RecentList, id: string, reason: string): Promise<void> {
  const call =
    list.key === "receipts" ? voidReceiptCall(id, reason) : list.key === "batches" ? reverseCall(id, reason) : voidSaleCall(id, reason);
  await runOperation(call);
}

// ---- Addresses, controls, and what a list shows ----

export function addressOf(list: RecentList, params: Record<string, string> = {}): string {
  const query = new URLSearchParams();
  if (list.product !== null) query.set("product", list.product);
  for (const [key, value] of Object.entries(params)) query.set(key, value);
  const text = query.toString();
  return text === "" ? list.path : `${list.path}?${text}`;
}

export async function opensList(page: Page, list: RecentList, params: Record<string, string> = {}, width = 1280, height = 720): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(addressOf(list, params));
  await expect(page.getByRole("heading", { level: 1, name: list.title })).toBeVisible();
  await expect(page.getByText("Couldn't load this page.")).toHaveCount(0);
}

export const searchForm = (page: Page, list: RecentList): Locator => page.getByRole("form", { name: list.form, exact: true });
export const listSection = (page: Page, list: RecentList): Locator => sectionOf(searchForm(page, list));
export const textBoxOf = (page: Page, list: RecentList): Locator =>
  searchForm(page, list).getByRole("textbox", { name: "Search", exact: true });
export const dateBoxOf = (page: Page, list: RecentList): Locator =>
  searchForm(page, list).getByLabel(list.dateLabel, { exact: true });
export const searchButtonOf = (page: Page, list: RecentList): Locator =>
  searchForm(page, list).getByRole("button", { name: "Search", exact: true });
export const rowsOf = (page: Page, list: RecentList): Locator => page.locator(`#${list.listId} > li`);
export const showMoreOf = (page: Page, list: RecentList): Locator =>
  listSection(page, list).getByRole("link", { name: "Show 10 more", exact: true });
export const clearOf = (page: Page, list: RecentList): Locator =>
  listSection(page, list).getByRole("link", { name: "Clear search", exact: true });
export const showingLine = (page: Page, list: RecentList, shown: number, total: number): Locator =>
  listSection(page, list).getByText(`Showing ${shown} of ${total} ${list.noun}.`, { exact: true });
export const capLine = (page: Page, list: RecentList, total: number): Locator =>
  listSection(page, list).getByText(`Showing 50 of ${total} ${list.noun}. Search or pick a date to find the rest.`, { exact: true });
export const noMatchLine = (page: Page, list: RecentList): Locator =>
  listSection(page, list).getByText(`No ${list.noun} match.`, { exact: true });
export const TOO_MANY = "Too many vendors match. Type more of the name.";

// The numbers of the rows shown, in order.
export async function shown(page: Page, list: RecentList): Promise<string[]> {
  const texts = await rowsOf(page, list).evaluateAll((items) => items.map((item) => item.textContent ?? ""));
  return texts.map((text) => text.match(list.numberPattern)?.[0] ?? `(no number in "${text.slice(0, 40)}")`);
}

// What one row of a Recent list shows outside its dialogs: its look, each label with its value, every other line
// (the tags and reason lines among them), and each link and button by its name, text, address, and look. A row
// found by a search or "Show 10 more" is compared with this record of it among the 10 latest (AC-0030 to AC-0035).
export interface RowRecord {
  look: string;
  facts: string[];
  lines: string[];
  controls: string[];
}

export function recordRow(row: Locator): Promise<RowRecord> {
  return row.evaluate((item) => {
    const text = (node: Element | null) => (node?.textContent ?? "").replace(/\s+/g, " ").trim();
    const outsideDialogs = (selector: string) => [...item.querySelectorAll(selector)].filter((node) => node.closest("dialog") === null);
    return {
      look: item.className,
      facts: outsideDialogs("dl > div").map((pair) => `${text(pair.querySelector("dt"))}: ${text(pair.querySelector("dd"))}`),
      lines: outsideDialogs("p, h3")
        .map(text)
        .filter((line) => line !== ""),
      controls: outsideDialogs("a[href], button").map((control) =>
        [control.tagName.toLowerCase(), `"${control.getAttribute("aria-label") ?? text(control)}":`, text(control), control.getAttribute("href") ?? "", control.className]
          .filter((part) => part !== "")
          .join(" "),
      ),
    };
  });
}

// What a batch's Reverse confirmation shows once open, as the browser lays out its text. Cancel closes it again.
export async function recordReversal(page: Page, item: Locator, batchNumber: string): Promise<string> {
  const dialog = await openReversal(page, item, batchNumber);
  await expect(dialog).toBeVisible();
  const text = await dialog.evaluate((node) => (node as HTMLElement).innerText);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  return text;
}

// Fills the boxes and presses the button, then waits for the address to carry the search.
export async function searchFor(page: Page, list: RecentList, text: string, date = ""): Promise<void> {
  await textBoxOf(page, list).fill(text);
  await dateBoxOf(page, list).fill(date);
  await searchButtonOf(page, list).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === text && url.searchParams.get("date") === date);
}

export function paramsOf(page: Page): URLSearchParams {
  return new URL(page.url()).searchParams;
}

// The scroll offset of the page, or of the main area when that scrolls instead.
export const scrollY = (page: Page): Promise<number> => page.evaluate(() => window.scrollY);
