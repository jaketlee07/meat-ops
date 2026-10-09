import { expect, type Locator, type Page } from "@playwright/test";
import { callAsOperator, idOf, produceCall, query, receiveCall, VENDOR_ID } from "../db";

// What the menu specs share: finding the cards and writing fixtures through pg
// (master data) and the operations (stock). The pg pool stays open: every spec
// in this worker shares it.

export const NO_PRODUCTS = "No active finished products yet. Add one in Supabase Studio, then reload this page.";
export const NOTHING_SELLABLE = "No product can be sold right now.";

// What Tab reaches on the menu page, in order.
export const MENU_CONTROLS = ["a Receiving", "a Production", "a Menu", "a Pricing", "button Sign out"];

export function sellableSwitch(page: Page): Locator {
  return page.getByLabel("Sellable only");
}

// One card per product; the card's heading is "<code> <description>".
export function cards(page: Page): Locator {
  return page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) });
}

export function cardFor(page: Page, code: string): Locator {
  return cards(page).filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(`^${code} `) }) });
}

// The headings of the cards shown, in order.
export async function cardHeadings(page: Page): Promise<string[]> {
  return (await cards(page).getByRole("heading", { level: 2 }).allTextContents()).map((text) => text.trim());
}

export async function addRaw(code: string, description = `${code} raw`): Promise<string> {
  const [row] = await query<{ id: string }>(
    "insert into products(code, description, species, kind) values ($1, $2, 'Turkey', 'raw') returning id",
    [code, description],
  );
  return String(row?.id);
}

export async function addFinished(
  code: string,
  description: string,
  rawId: string,
  options: { active?: boolean; listPrice?: number | null } = {},
): Promise<string> {
  const { active = true, listPrice = null } = options;
  const [row] = await query<{ id: string }>(
    `insert into products(code, description, species, kind, raw_product_id, shrink_pct, active, list_price_per_lb)
     values ($1, $2, 'Turkey', 'finished', $3, 0.1000, $4, $5) returning id`,
    [code, description, rawId, active, listPrice],
  );
  return String(row?.id);
}

// The seeded 502 is active; a test that wants only its own products retires it.
export async function retire502(): Promise<void> {
  await query("update products set active = false where code = '502'");
}

export async function setListPrice(productId: string, price: number | null): Promise<void> {
  await query("update products set list_price_per_lb = $2 where id = $1", [productId, price]);
}

export async function receive(rawId: string, lbs: number, cost = 1.5): Promise<string> {
  const outcome = await callAsOperator(receiveCall(rawId, VENDOR_ID, lbs, cost, "2026-10-01"));
  expect(outcome.ok, outcome.error).toBe(true);
  return idOf(outcome);
}

export async function produce(finishedId: string, rawLbs: number): Promise<void> {
  const outcome = await callAsOperator(produceCall(finishedId, rawLbs, null, "2026-10-02"));
  expect(outcome.ok, outcome.error).toBe(true);
}

// The master data a request must leave untouched.
export async function productsSnapshot(): Promise<unknown[]> {
  return query("select * from products order by code");
}
