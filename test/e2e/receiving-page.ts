import { expect, type Locator, type Page } from "@playwright/test";
import { callAsOperator, query, RAW_TOM_ID, receiveCall, VENDOR_ID } from "../db";

// What the receiving specs share: how to find the form's parts, fill it, and
// read raw tables through pg. The pg pool stays open: every spec in this worker
// shares it.

export const CODE = "RAW-TOM";
export const VENDOR = "Reyes Meats";
export const SIGNED_OUT = "You're signed out. Sign in again to save this receipt.";
export const NOT_SAVED = "The receipt wasn't saved.";
export const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";
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

export async function lotCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from lots");
  return row?.n ?? -1;
}

// Receives a lot of RAW-TOM through the engine, as the operator.
export async function seedReceipt(lbs: number, cost: number): Promise<void> {
  const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, cost, "2026-05-12"));
  expect(outcome.ok, outcome.error).toBe(true);
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
