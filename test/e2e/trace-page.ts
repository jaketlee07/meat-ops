import { expect, type Locator, type Page } from "@playwright/test";
import { callAsOperator, idOf, PROD_502_ID, query, RAW_TOM_ID, receiveCall, produceCall, VENDOR_ID } from "../db";
import { lotNumberOf } from "./receiving-page";
import { seedSale } from "./sales-page";

// What the trace specs share: the find forms' parts, an open helper, the Tab
// order of the empty page, and fixtures written through pg. The pg pool stays
// open: every spec in this worker shares it.

export const RAW_CODE = "RAW-TOM";
export const RAW_NAME = "RAW-TOM Turkey Drums TOM (raw)";
export const BOLD = "<b>9</b>";

export const SALE_NUMBER_REFUSAL = "Enter a sale number.";
export const CODE_REFUSAL = "Enter a raw product code.";
export const DATE_REFUSAL = "Enter the received date, or leave it blank.";

// What Tab reaches on the empty /trace page, in order.
export const TRACE_CONTROLS = [
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
  "input #find-sale-number",
  "button Show sale",
  "input #find-raw-code",
  "input #find-received",
  "button Show lots",
];

export function finders(page: Page) {
  return {
    saleSection: page.getByRole("region", { name: "Find a sale" }),
    lotSection: page.getByRole("region", { name: "Find a raw lot" }),
    sale: page.getByLabel("Sale number"),
    showSale: page.getByRole("button", { name: "Show sale" }),
    code: page.getByLabel("Raw product code"),
    received: page.getByLabel("Received date"),
    showLots: page.getByRole("button", { name: "Show lots" }),
    // The heading or no-result sentence of the result on the page; none until a lookup is shown.
    result: page.locator("[data-result-focus]"),
  };
}

export type Finders = ReturnType<typeof finders>;

export async function open(page: Page, url = "/trace"): Promise<Finders> {
  await page.goto(url);
  await expect(page.getByRole("heading", { level: 1, name: "Trace" })).toBeVisible();
  return finders(page);
}

// The text of the message that an input's aria-describedby points to.
export async function describedText(input: Locator): Promise<string> {
  const id = await input.getAttribute("aria-describedby");
  if (!id) return "";
  return (await input.page().locator(`[id="${id}"]`).textContent()) ?? "";
}

// The batch number of a batch, by id.
export async function batchNumberOf(id: string): Promise<string> {
  const [row] = await query<{ batch_number: string }>("select batch_number from production_batches where id = $1", [id]);
  return row?.batch_number ?? "missing";
}

// The number of the sale entered last.
export async function lastSaleNumber(): Promise<string> {
  const [row] = await query<{ sale_number: string }>("select sale_number from sales order by created_at desc limit 1");
  return row?.sale_number ?? "missing";
}

// Receives lots of RAW-TOM on the given dates, in order, and returns their lot numbers in entry order.
export async function receiveOn(dates: string[], weight = (index: number) => 100 + index): Promise<string[]> {
  const numbers: string[] = [];
  for (const [index, date] of dates.entries()) {
    const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, weight(index), 1.5, date));
    expect(outcome.ok, outcome.error).toBe(true);
    numbers.push(await lotNumberOf(idOf(outcome)));
  }
  return numbers;
}

export async function receiveIds(dates: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const date of dates) {
    const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 1.5, date));
    expect(outcome.ok, outcome.error).toBe(true);
    ids.push(idOf(outcome));
  }
  return ids;
}

// 12 receipts whose received dates are not in entry order, the 3rd and 12th on one date.
export const TWELVE_DATES = [
  "2026-09-10",
  "2026-09-03",
  "2026-09-12",
  "2026-09-05",
  "2026-09-01",
  "2026-09-08",
  "2026-09-15",
  "2026-09-02",
  "2026-09-07",
  "2026-09-14",
  "2026-09-04",
  "2026-09-12",
];

// A fixture of three 502 batches, two made on one day, and one 2,000-lb sale across them.
export async function threeBatchSale(): Promise<void> {
  await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 8000, 1.68, "2026-10-01"));
  for (const date of ["2026-10-07", "2026-10-06", "2026-10-06"]) {
    const outcome = await callAsOperator(produceCall(PROD_502_ID, 1000, null, date));
    expect(outcome.ok, outcome.error).toBe(true);
  }
  await seedSale(2000);
}

// Two lots of RAW-TOM, the 2026-10-05 lot entered first, one batch drawing from both, and a sale of it.
export async function twoLotSale(): Promise<{ later: string; earlier: string }> {
  const later = (await receiveOn(["2026-10-05"]))[0] ?? "";
  const earlier = (await receiveOn(["2026-10-01"]))[0] ?? "";
  const outcome = await callAsOperator(produceCall(PROD_502_ID, 150, null, "2026-10-06"));
  expect(outcome.ok, outcome.error).toBe(true);
  await seedSale(50);
  return { later, earlier };
}
