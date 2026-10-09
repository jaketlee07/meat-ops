import { expect, type Locator, type Page } from "@playwright/test";
import { query, RAW_TOM_ID } from "../db";
import { MENU_CONTROLS, receive } from "./menu-page";
import { factValue } from "./receiving-page";

// What the pricing specs share: finding the groups, cards, and what-if parts, and
// writing fixtures through pg (master data) and the operations (stock). Product
// fixtures (addRaw, addFinished, setListPrice) come from the menu helpers. The pg
// pool stays open: every spec in this worker shares it.

export const NO_PRODUCTS = "No active finished products yet. Add one in Supabase Studio, then reload this page.";
export const NOT_SAVED = "The change wasn't saved.";
export const CHANGE_SIGNED_OUT = "You're signed out. Sign in again to save this change.";
export const NOT_ACTIVE = `${NOT_SAVED} This product is no longer active.`;
export const WHAT_IF_HEADING = "What if raw cost changes?";
export const ZERO_ID = "00000000-0000-0000-0000-000000000000";

export const NAV_CONTROLS = MENU_CONTROLS;
// What Tab reaches after the cards, in order: the what-if form.
export const WHAT_IF_CONTROLS = ["select #what-if-raw", "input #what-if-cost", "button Show prices"];

export const GROUP_HEADINGS = ["Needs a new price", "Priced", "No cost yet"];

// A group's section, found by its heading.
export function group(page: Page, heading: string): Locator {
  return page.getByRole("region", { name: heading, exact: true });
}

export function listCards(page: Page): Locator {
  return page.locator("section[aria-labelledby^='group-'] li").filter({ has: page.getByRole("heading", { level: 3 }) });
}

export function card(page: Page, code: string): Locator {
  return listCards(page).filter({ has: page.getByRole("heading", { level: 3, name: new RegExp(`^${code} `) }) });
}

// The headings of the cards in a group, in order.
export async function headingsIn(page: Page, heading: string): Promise<string[]> {
  const texts = await group(page, heading).getByRole("heading", { level: 3 }).allTextContents();
  return texts.map((text) => text.trim());
}

export function figure(scope: Locator, label: string): Locator {
  return factValue(scope, label);
}

// The group headings on the page, in order, without the what-if heading.
export async function groupHeadings(page: Page): Promise<string[]> {
  const all = await page.getByRole("heading", { level: 2 }).allTextContents();
  return all.map((text) => text.trim()).filter((text) => text !== WHAT_IF_HEADING);
}

export function whatIf(page: Page) {
  const section = page.getByRole("region", { name: WHAT_IF_HEADING });
  return {
    section,
    raw: page.getByLabel("Raw product"),
    cost: page.getByLabel("Raw cost per lb"),
    show: page.getByRole("button", { name: "Show prices" }),
    cards: section.getByRole("listitem"),
  };
}

export type WhatIf = ReturnType<typeof whatIf>;

// The page's saved and refused message regions, which exist before they have text.
export function savedRegion(page: Page): Locator {
  return page.locator("main [role=status][tabindex='-1']");
}

export function refusedRegion(page: Page): Locator {
  return page.locator("main [role=alert][tabindex='-1']");
}

export async function setTarget(productId: string, fraction: number | null): Promise<void> {
  await query("update products set target_margin_pct = $2 where id = $1", [productId, fraction]);
}

export async function setActive(productId: string, active: boolean): Promise<void> {
  await query("update products set active = $2 where id = $1", [productId, active]);
}

export async function storedListPrice(productId: string): Promise<number | null> {
  const [row] = await query<{ price: number | null }>(
    "select list_price_per_lb::float8 as price from products where id = $1",
    [productId],
  );
  return row?.price ?? null;
}

// The 502 fixture: the seeded 502 over RAW-TOM's one receipt of 5,000 lbs at 1.68.
export async function receive502Lot(): Promise<string> {
  return receive(RAW_TOM_ID, 5000, 1.68);
}

export async function opens(page: Page, url = "/pricing"): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible();
}

export { productsSnapshot } from "./menu-page";
