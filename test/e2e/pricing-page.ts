import { expect, type Locator, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
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

// The detail at /pricing?product=<code>. Its message regions have ids of their own,
// apart from the list's, and exist before they have text.
export async function opensDetail(page: Page, code: string): Promise<void> {
  await page.goto(`/pricing?product=${encodeURIComponent(code)}`);
  await expect(page.getByRole("heading", { level: 1, name: "Pricing" })).toBeVisible();
}

export function detail(page: Page) {
  return {
    main: page.locator("main"),
    heading: page.getByRole("heading", { level: 2 }).first(),
    target: page.getByRole("textbox", { name: "Target margin %" }),
    price: page.getByRole("textbox", { name: "List price per lb" }),
    saveTarget: page.getByRole("button", { name: "Save target" }),
    removeTarget: page.getByRole("button", { name: "Remove target margin" }),
    savePrice: page.getByRole("button", { name: "Save price" }),
    saved: page.locator("#change-saved"),
    refused: page.locator("#change-refused"),
    targetError: page.locator("#target-margin-error"),
    priceError: page.locator("#list-price-error"),
  };
}

export type Detail = ReturnType<typeof detail>;

// What Tab reaches on a detail, in order: an Apply button when the product needs
// a new price, the target form (Remove only with a target), then the price form.
export function detailControls(options: { apply?: string; remove: boolean }): string[] {
  return [
    ...NAV_CONTROLS,
    ...(options.apply ? [`button ${options.apply}`] : []),
    "input #target-margin",
    "button Save target",
    ...(options.remove ? ["button Remove target margin"] : []),
    "input #list-price",
    "button Save price",
  ];
}

export async function storedTarget(productId: string): Promise<number | null> {
  const [row] = await query<{ target: number | null }>(
    "select target_margin_pct::float8 as target from products where id = $1",
    [productId],
  );
  return row?.target ?? null;
}

// Aborts every server action request the pricing page sends from now on, as a
// dropped connection would, before the server sees it. Returns a count of them.
export async function dropActionRequests(page: Page): Promise<{ readonly count: number }> {
  const dropped = { count: 0 };
  await page.route("**/pricing**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) {
      dropped.count += 1;
      await route.abort();
    } else {
      await route.continue();
    }
  });
  return dropped;
}

export interface SentAction {
  url: string;
  headers: Record<string, string>;
  body: Buffer;
}

// Runs `press` and returns the action request it sent, without the operator's
// cookie, as an attacker would replay it.
export async function captureAction(page: Page, press: () => Promise<void>): Promise<SentAction> {
  const captured = page.waitForRequest((request) => request.method() === "POST" && "next-action" in request.headers());
  await press();
  const request = await captured;
  const headers = await request.allHeaders();
  for (const name of ["cookie", "content-length", "host"]) delete headers[name];
  return { url: request.url(), headers, body: request.postDataBuffer() ?? Buffer.alloc(0) };
}

// Replays a captured request in a fresh context and returns the response text.
export async function replayText(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string | undefined,
  sent: SentAction,
  storageState: string | undefined,
): Promise<string> {
  const replay = await playwright.request.newContext({ baseURL, storageState });
  try {
    const response = await replay.post(sent.url, { headers: sent.headers, data: sent.body });
    return await response.text();
  } finally {
    await replay.dispose();
  }
}
