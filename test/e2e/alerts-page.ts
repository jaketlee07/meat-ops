import { expect, type Locator, type Page } from "@playwright/test";
import {
  callAsOperator,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  VENDOR_ID,
} from "../db";
import { appDate } from "./app-time";
import { MENU_CONTROLS } from "./menu-page";

// What the alerts specs share: finding the groups and messages, and building the
// spec's fixtures through the operations (every receipt, batch, target, and list
// price) with dates counted from the app's today (test/e2e/app-time.ts). The pg
// pool stays open: every spec in this worker shares it.

export const NOT_SAVED_CHANGE = "The change wasn't saved.";
export const NOT_DISMISSED = "The alert wasn't dismissed.";
export const CHANGE_SIGNED_OUT = "You're signed out. Sign in again to save this change.";
export const DISMISS_SIGNED_OUT = "You're signed out. Sign in again to dismiss this alert.";
export const NO_LONGER_OPEN_CHANGE = `${NOT_SAVED_CHANGE} This alert is no longer open.`;
export const NO_LONGER_OPEN_DISMISS = `${NOT_DISMISSED} It is no longer open.`;
export const NOT_ACTIVE = `${NOT_SAVED_CHANGE} This product is no longer active.`;
export const WATCH_FAILED = "Alerts couldn't be checked.";
export const ZERO_ID = "00000000-0000-0000-0000-000000000000";

export const HEADER_PAGES = ["/receiving", "/production", "/menu", "/pricing", "/invoices", "/sales", "/trace"] as const;

// Tab order of the header: the links, then Sign out. The banner's link, when
// there is one, comes next.
export const NAV_CONTROLS = MENU_CONTROLS;

// A page with the urgent banner: its See alerts link comes right after Sign out in tab order.
export function withSeeAlerts(controls: readonly string[]): string[] {
  const at = controls.indexOf("button Sign out");
  return [...controls.slice(0, at + 1), "a See alerts", ...controls.slice(at + 1)];
}

export const MARGIN_TITLE = "Margin below target: 502 Smoked Turkey Drums Tom";
export const MARGIN_SENTENCE =
  "At your list price of $2.68/lb, the margin is 1.8%, below your 20% target. Cost is $2.6318/lb.";
export const RAISE_329 = "Raise list price to $3.29/lb";

export async function opens(page: Page, url = "/alerts"): Promise<void> {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Alerts" })).toBeVisible();
}

// The group of one alert, found by its title.
export function alertGroup(page: Page, title: string): Locator {
  return page.getByRole("group", { name: title, exact: true });
}

export function groupTitles(page: Page, section: string): Promise<string[]> {
  return page
    .getByRole("region", { name: section, exact: true })
    .getByRole("heading", { level: 3 })
    .allTextContents()
    .then((titles) => titles.map((title) => title.trim()));
}

export async function sectionHeadings(page: Page): Promise<string[]> {
  return (await page.getByRole("heading", { level: 2 }).allTextContents()).map((text) => text.trim());
}

// The page's saved and refused message regions, which exist before they have text.
export function savedRegion(page: Page): Locator {
  return page.locator("main [role=status][tabindex='-1']");
}

export function refusedRegion(page: Page): Locator {
  return page.locator("main [role=alert][tabindex='-1']");
}

export function banner(page: Page): Locator {
  return page.getByRole("region", { name: "Urgent alerts", exact: true });
}

export function dismissButton(page: Page, title: string): Locator {
  return page.getByRole("button", { name: `Dismiss ${title}`, exact: true });
}

// ---- Fixtures, through the operations ----

async function run(call: Parameters<typeof callAsOperator>[0]): Promise<string> {
  const outcome = await callAsOperator(call);
  expect(outcome.ok, `${call.fn}: ${outcome.error}`).toBe(true);
  return idOf(outcome);
}

export async function receiveTom(lbs: number, cost: number | string, daysAgo = 0): Promise<string> {
  return run(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, cost, appDate(-daysAgo)));
}

export async function setPrice(productId: string, price: number): Promise<void> {
  await run({ fn: "set_list_price", args: { p_product_id: productId, p_price_per_lb: price } });
}

export async function setTargetPercent(productId: string, percent: number): Promise<void> {
  await run({ fn: "set_target_margin", args: { p_product_id: productId, p_target_percent: percent } });
}

// The margin case: the 502 fixture with a 20% target and a 2.68 list price.
export async function marginCase(): Promise<void> {
  await receiveTom(5000, 1.68, 10);
  await setTargetPercent(PROD_502_ID, 20);
  await setPrice(PROD_502_ID, 2.68);
}

// The cost fixture's four earlier receipts, 1,000 lbs each on the four days
// before the app's today. A fifth receipt at 1.90 opens a cost alert.
export async function costEarlier(): Promise<void> {
  for (const [index, cost] of ["1.60", "1.68", "1.70", "1.64"].entries()) {
    await receiveTom(1000, cost, 4 - index);
  }
}

// The price case: the 502 fixture with no target and a 2.68 list price set now,
// then a second RAW-TOM receipt of 3,000 lbs at 2.20.
export async function priceCase(): Promise<void> {
  await receiveTom(5000, 1.68, 3);
  await setPrice(PROD_502_ID, 2.68);
  await receiveTom(3000, 2.2, 0);
}

// A measured batch of 502 from 1,000 raw lbs to 700 finished lbs on the app's today.
export async function yieldBatch(): Promise<string> {
  return run(produceCall(PROD_502_ID, 1000, 700, appDate()));
}

// One watch, as the app runs it on a page load, so the alerts exist before a page opens.
export async function watch(): Promise<void> {
  const outcome = await callAsOperator({ fn: "refresh_alerts", args: { p_today: appDate() } });
  expect(outcome.ok, outcome.error).toBe(true);
}

export async function alertIdOf(type: string, where = "true"): Promise<string> {
  const [row] = await query<{ id: string }>(
    `select id::text as id from alerts where type = $1 and status = 'open' and ${where} order by created_at limit 1`,
    [type],
  );
  if (!row) throw new Error(`no open ${type} alert`);
  return row.id;
}

export interface AlertRowState {
  type: string;
  status: string;
}

export async function alertStates(): Promise<AlertRowState[]> {
  return query<AlertRowState>("select type, status from alerts order by type, created_at, id");
}

export async function storedListPrice(productId: string): Promise<string | null> {
  const [row] = await query<{ price: string | null }>(
    "select list_price_per_lb::text as price from products where id = $1",
    [productId],
  );
  return row?.price ?? null;
}

// What a request that changes nothing must leave alone: the alerts, the
// products, and the private price history.
export async function alertsSnapshot(): Promise<unknown> {
  return {
    alerts: await query("select * from alerts order by id"),
    products: await query("select * from products order by code"),
    history: await query("select * from private.list_price_changes order by seq"),
  };
}

// Closes an alert behind the page's back, as another tab or a watch would.
export async function closeAlert(id: string): Promise<void> {
  await query("update alerts set status = 'dismissed', closed_at = now() where id = $1", [id]);
}

export async function setActive(productId: string, active: boolean): Promise<void> {
  await query("update products set active = $2 where id = $1", [productId, active]);
}

// Runs `during` with the watch refused to signed-in users, and restores the
// grant whether or not it passes (AC-0016, AC-0017).
export async function withWatchRefused(during: () => Promise<void>): Promise<void> {
  await query("revoke execute on function public.refresh_alerts(date) from authenticated");
  try {
    await during();
  } finally {
    await query("grant execute on function public.refresh_alerts(date) to authenticated");
  }
}

// The page's text without the banner region, to compare a page with and
// without a banner (AC-0017).
export function textWithoutBanner(page: Page): Promise<string> {
  return page.locator("main").evaluate((main) => {
    const copy = main.cloneNode(true) as HTMLElement;
    for (const region of copy.querySelectorAll("[role=region][aria-label='Urgent alerts']")) region.remove();
    return copy.innerText ?? copy.textContent ?? "";
  });
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

// The multipart body carries each field's value after its name and a blank line.
export function withValue(sent: SentAction, name: string, value: string): SentAction {
  const text = sent.body.toString("utf8");
  const changed = text.replace(new RegExp(`(name="[^"]*${name}"\\r\\n\\r\\n)[^\\r]*`), `$1${value}`);
  expect(changed === text, `${name} set to ${value} changes the body`).toBe(false);
  return { ...sent, body: Buffer.from(changed, "utf8") };
}

// Aborts every server action request the page sends from now on, as a dropped
// connection would, before the server sees it. Returns a count of them.
export async function dropActionRequests(page: Page): Promise<{ readonly count: number }> {
  const dropped = { count: 0 };
  await page.route("**/alerts**", async (route) => {
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
