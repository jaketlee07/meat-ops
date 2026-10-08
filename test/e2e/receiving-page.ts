import { expect, type Locator, type Page } from "@playwright/test";
import { callAsOperator, idOf, query, RAW_TOM_ID, receiveCall, VENDOR_ID } from "../db";

// What the receiving specs share: how to find the form's parts, fill it, and
// read raw tables through pg. The pg pool stays open: every spec in this worker
// shares it.

export const CODE = "RAW-TOM";
export const VENDOR = "Reyes Meats";
export const SIGNED_OUT = "You're signed out. Sign in again to save this receipt.";
export const NOT_SAVED = "The receipt wasn't saved.";
export const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";
export const VOID_SIGNED_OUT = "You're signed out. Sign in again to void this receipt.";
export const NOT_VOIDED = "The receipt wasn't voided.";
// AC-0071 and AC-0073: the write call got no answer, so the save or void may have happened.
export const SAVE_UNKNOWN =
  "The receipt may not have been saved. Reload this page and check Recent receipts before saving again.";
export const VOID_UNKNOWN = "The receipt may not have been voided. Reload this page to see whether it was.";
// The receiving page with RAW-TOM chosen, so its stock and receipts are shown.
export const RAW_TOM_URL = `/receiving?product=${CODE}`;
// The accessible name of the receiving form.
export const RECEIVING_FORM = "New receipt";

// What Tab reaches on the receiving page, in order.
export const FORM_CONTROLS = [
  "button Sign out",
  "input #product-code",
  "select #vendor",
  "input #weight",
  "input #cost",
  "input #received-date",
  "textarea #notes",
  "button Save",
];

export function fields(page: Page) {
  return {
    code: page.getByLabel("Product code"),
    vendor: page.getByLabel("Vendor", { exact: true }),
    weight: page.getByLabel("Weight (lbs)"),
    cost: page.getByLabel("Cost per lb ($)"),
    date: page.getByLabel("Received date"),
    notes: page.getByLabel("Notes (optional)"),
    save: page.getByRole("button", { name: "Save" }),
    message: page.locator("#receipt-message"),
    result: page.getByRole("status", { name: "Receipt result" }),
    region: page.locator("#product-region"),
  };
}

export type Fields = ReturnType<typeof fields>;

// Opens the form and waits until the device date has filled the date field,
// which is also when the hidden `today` value is in place.
export async function openForm(page: Page, url = "/receiving"): Promise<Fields> {
  await page.goto(url);
  const f = fields(page);
  await expect(f.date).not.toHaveValue("");
  return f;
}

export async function fillReceipt(
  f: Fields,
  values: { code?: string; vendor?: string; weight?: string; cost?: string },
): Promise<void> {
  const { code = CODE, vendor = VENDOR, weight = "5000", cost = "1.68" } = values;
  await f.code.fill(code);
  await f.vendor.selectOption({ label: vendor });
  await f.weight.fill(weight);
  await f.cost.fill(cost);
}

// Every field's current value, to show that a refused save kept all of them.
export async function readValues(f: Fields): Promise<Record<string, string>> {
  return {
    code: await f.code.inputValue(),
    vendor: await f.vendor.inputValue(),
    weight: await f.weight.inputValue(),
    cost: await f.cost.inputValue(),
    date: await f.date.inputValue(),
    notes: await f.notes.inputValue(),
  };
}

// Aborts every server action request the page sends from now on, as a dropped
// connection would, before the server sees it. Returns a count of the aborted requests.
export async function dropActionRequests(page: Page): Promise<{ readonly count: number }> {
  const dropped = { count: 0 };
  await page.route("**/receiving**", async (route) => {
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

export async function lotCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from lots");
  return row?.n ?? -1;
}

// Receives a lot of RAW-TOM through the engine, as the operator, and returns its id.
export async function seedReceipt(lbs: number, cost: number, date = "2026-05-12"): Promise<string> {
  const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, cost, date));
  expect(outcome.ok, outcome.error).toBe(true);
  return idOf(outcome);
}

export async function lotNumberOf(id: string): Promise<string> {
  const [row] = await query<{ lot_number: string }>("select lot_number from lots where id = $1", [id]);
  return row?.lot_number ?? "missing";
}

// How many lots carry a void mark, for "no new void mark".
export async function voidMarks(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from lots where voided_at is not null");
  return row?.n ?? -1;
}

// What a lot holds in the ledger, to show a refused void left it unchanged.
export async function lotState(id: string) {
  const [row] = await query<{ remaining: number; voided: boolean; reason: string | null }>(
    "select remaining_lbs::float8 as remaining, voided_at is not null as voided, void_reason as reason from lots where id = $1",
    [id],
  );
  return row;
}

// The list item of one receipt in the recent receipts list, found by lot number.
export function receiptItem(page: Page, lotNumber: string): Locator {
  return page.locator("#product-region li").filter({ hasText: lotNumber });
}

// The Void button of a receipt. Its name carries the lot number, so each is distinct.
export function voidButton(item: Locator): Locator {
  return item.getByRole("button", { name: /^Void lot / });
}

export function voidDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Void this receipt?" });
}

// Opens the confirmation, types a reason, and presses the confirm button.
export async function voidThrough(page: Page, item: Locator, reason: string): Promise<void> {
  await voidButton(item).click();
  const dialog = voidDialog(page);
  await dialog.getByLabel("Reason for the void").fill(reason);
  await dialog.getByRole("button", { name: "Void receipt" }).click();
}

// The value cell that follows a label in a list of facts.
export function factValue(scope: Locator, label: string): Locator {
  return scope
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
}

// The before and after cells of one table row.
export function beforeAfter(scope: Locator, label: string | RegExp): Locator {
  return scope.getByRole("row", { name: label }).getByRole("cell");
}

// The date on the browser's device, shifted by whole days.
export async function deviceDate(page: Page, offsetDays = 0): Promise<string> {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    return date.toLocaleDateString("en-CA");
  }, offsetDays);
}
