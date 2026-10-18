import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { callAsOperator, idOf, PROD_502_ID, query, saleFixture, type SaleFixture } from "../db";
import type { SentAction } from "./pricing-page";

// What the sales specs share: how to find the form's parts, fill it, and read
// raw tables through pg. Helpers that need nothing sales-specific (captureAction,
// replayText, factValue, beforeAfter, deviceDate, sendsActionRequest) come from
// the pricing and receiving helpers. The pg pool stays open: every spec in this
// worker shares it.

export const CODE = "502";
export const NO_PRODUCTS = "No active finished products yet. Add one in Supabase Studio, then reload this page.";
export const SAVED_HEADING = "Sale saved";
export const SIGNED_OUT = "You're signed out. Sign in again to save this sale.";
export const VOID_SIGNED_OUT = "You're signed out. Sign in again to void this sale.";
export const NOT_SAVED = "The sale wasn't saved.";
export const NOT_VOIDED = "The sale wasn't voided.";
export const SAVE_UNKNOWN =
  "The sale may not have been saved. Reload this page and check Recent sales before saving again.";
export const VOID_UNKNOWN = "The sale may not have been voided. Reload this page to see whether it was.";
export const DETAILS_MISSING =
  "The sale was saved, but its details couldn't be loaded. Reload this page to see them.";

// What Tab reaches on /sales before any sale exists, in order.
export const FORM_CONTROLS = [
  "a Receiving",
  "a Production",
  "a Menu",
  "a Pricing",
  "a Sales",
  "a Trace",
  "a Invoices",
  "a Ask",
  "a Alerts",
  "button Sign out",
  "input #product-code",
  "input #lbs",
  "input #price-per-lb",
  "select #customer",
  "input #sale-date",
  "button Save sale",
];

export function fields(page: Page) {
  return {
    code: page.getByLabel("Product code"),
    lbs: page.getByLabel("Weight sold (lbs)"),
    price: page.getByLabel("Price per lb"),
    customer: page.getByLabel("Customer", { exact: true }),
    date: page.getByLabel("Sale date"),
    save: page.getByRole("button", { name: "Save sale" }),
    message: page.locator("#sale-message"),
    saving: page.locator("#sale-saving"),
    facts: page.locator("#product-facts"),
    result: page.getByRole("status", { name: "Sale result" }),
    recent: page.getByRole("region", { name: "Recent sales" }),
  };
}

export type Fields = ReturnType<typeof fields>;

// Opens the form and waits until the device date has filled the date field.
export async function openForm(page: Page, url = "/sales"): Promise<Fields> {
  await page.goto(url);
  const f = fields(page);
  await expect(f.date).not.toHaveValue("");
  return f;
}

// Types a sale. The price is typed only when given, so the fill from the list
// price shows; a customer is picked by name, and "No customer" is the default.
export async function fillSale(
  f: Fields,
  values: { code?: string; lbs?: string; price?: string; customer?: string; date?: string },
): Promise<void> {
  const { code = CODE, lbs = "100", price, customer, date } = values;
  await f.code.fill(code);
  if (price !== undefined) await f.price.fill(price);
  await f.lbs.fill(lbs);
  if (customer !== undefined) await f.customer.selectOption({ label: customer });
  if (date !== undefined) await f.date.fill(date);
}

// Every field's current value, to show that a refused or failed save kept all of them.
export async function readValues(f: Fields): Promise<Record<string, string>> {
  return {
    code: await f.code.inputValue(),
    lbs: await f.lbs.inputValue(),
    price: await f.price.inputValue(),
    customer: await f.customer.inputValue(),
    date: await f.date.inputValue(),
  };
}

// The sale fixture with a 3.29 list price, as the spec names it.
export function fixtureWithPrice(): Promise<SaleFixture> {
  return saleFixture({ listPrice: true });
}

// Writes a sale of 502 through the engine, as the operator, and returns its id.
export async function seedSale(lbs: number, date = "2026-10-08", price = 3.29, customerId: string | null = null) {
  const outcome = await callAsOperator({
    fn: "record_sale",
    args: {
      p_finished_product_id: PROD_502_ID,
      p_lbs: lbs,
      p_price_per_lb: price,
      p_customer_id: customerId,
      p_sale_date: date,
    },
  });
  expect(outcome.ok, outcome.error).toBe(true);
  return idOf(outcome);
}

export async function saleCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from sales");
  return row?.n ?? -1;
}

// The sales written, in entry order, with the line figures the engine stored.
export async function saleRows() {
  return query<{
    sale_number: string;
    sale_date: string;
    customer_id: string | null;
    voided: boolean;
    prices: number[];
    lbs: number[];
  }>(
    `select s.sale_number, s.sale_date::text, s.customer_id, s.voided_at is not null as voided,
            array_agg(i.price_per_lb::float8) as prices,
            array_agg(i.lbs_sold::float8) as lbs
     from sales s join sale_items i on i.sale_id = s.id
     group by s.id order by s.created_at`,
  );
}

// How many sales carry a void mark, for "no new void mark".
export async function voidMarks(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from sales where voided_at is not null");
  return row?.n ?? -1;
}

// What the finished lots hold, to show a refused or replayed request changed none of them.
export async function finishedSnapshot() {
  return query<{ id: string; lbs_remaining: number }>(
    "select id, lbs_remaining::float8 from finished_goods order by produced_seq",
  );
}

// The batch numbers of 502's batches in draw order.
export async function batchNumbersInDrawOrder(): Promise<string[]> {
  const rows = await query<{ batch_number: string }>(
    `select b.batch_number from production_batches b
     join finished_goods g on g.batch_id = b.id
     order by b.production_date, g.produced_seq`,
  );
  return rows.map((row) => row.batch_number);
}

// Aborts every server action request /sales sends from now on, as a dropped
// connection would, before the server sees it. Returns a count of them.
export async function dropActionRequests(page: Page): Promise<{ readonly count: number }> {
  const dropped = { count: 0 };
  await page.route("**/sales**", async (route) => {
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

// Captures the first server action request /sales sends after `press` and aborts
// it before the server sees it, so a void it carries has not happened and can be replayed.
export async function captureAndAbortAction(page: Page, press: () => Promise<void>): Promise<SentAction> {
  let seen: Request | undefined;
  await page.route("**/sales**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) {
      seen = request;
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await press();
  await expect.poll(() => seen).toBeDefined();
  if (!seen) throw new Error("no action request was captured");
  const headers = await seen.allHeaders();
  for (const name of ["cookie", "content-length", "host"]) delete headers[name];
  return { url: seen.url(), headers, body: seen.postDataBuffer() ?? Buffer.alloc(0) };
}

// Holds every server action request /sales sends until `release` is called.
// `held` counts the requests that reached the hold.
export async function holdActionRequests(page: Page) {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const state = { held: 0, release: () => release() };
  await page.route("**/sales**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) {
      state.held += 1;
      await gate;
    }
    await route.continue();
  });
  return state;
}

// Withdraws the operator's read of sale_items (the AC-0047 case). Restore it in
// a finally and in afterEach.
export async function revokeSaleItemsRead(): Promise<void> {
  await query("revoke select on public.sale_items from authenticated");
}

// Grants only when the read is missing: a GRANT makes PostgREST reload its schema cache.
export async function restoreSaleItemsRead(): Promise<void> {
  const [row] = await query<{ granted: boolean }>(
    "select has_table_privilege('authenticated', 'public.sale_items', 'select') as granted",
  );
  if (!row?.granted) await query("grant select on public.sale_items to authenticated");
}

export function recentItem(page: Page, saleNumber: string): Locator {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name: saleNumber, exact: true }) });
}

export function voidDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Void this sale?" });
}

// Opens the confirmation of one sale, types a reason, and presses the confirm button.
export async function voidThrough(page: Page, saleNumber: string, reason: string): Promise<void> {
  await page.getByRole("button", { name: `Void sale ${saleNumber}`, exact: true }).click();
  const dialog = voidDialog(page);
  await dialog.getByLabel("Reason for the void").fill(reason);
  await dialog.getByRole("button", { name: "Void sale", exact: true }).click();
}

// Fills every field of a sale and returns what the form then holds, so a refusal
// or failure that keeps them all is visible.
export async function fillEverything(
  f: Fields,
  values: { lbs?: string; date?: string } = {},
): Promise<Record<string, string>> {
  const { lbs = "100", date = "2026-10-08" } = values;
  await fillSale(f, { lbs, price: "3.10", customer: "Fulton Market Deli", date });
  return readValues(f);
}

// What the database holds for one sale's void mark.
export async function saleState(id: string) {
  const [row] = await query<{ voided: boolean; reason: string | null }>(
    "select voided_at is not null as voided, void_reason as reason from sales where id = $1",
    [id],
  );
  return row;
}

// The sale numbers in entry order.
export async function saleNumbers(): Promise<string[]> {
  return (await saleRows()).map((row) => row.sale_number);
}

// Presses Tab until the control has focus.
export async function tabTo(page: Page, target: Locator, limit = 30): Promise<void> {
  for (let press = 0; press < limit; press++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  throw new Error("Tab did not reach the control");
}

// The Void button of one sale.
export function voidButtonOf(page: Page, saleNumber: string): Locator {
  return page.getByRole("button", { name: `Void sale ${saleNumber}`, exact: true });
}

// What Tab reaches after the form on a page whose recent list holds these sale
// numbers, in order: each sale's link, then its Void button when it has one.
export function listControls(sales: Array<{ number: string; voidable: boolean }>): string[] {
  return sales.flatMap(({ number, voidable }) => [`a ${number}`, ...(voidable ? ["button Void"] : [])]);
}

export const DIALOG_CONTROLS = ["button Cancel", "textarea reason", "button Void sale"];
