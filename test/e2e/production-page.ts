import { expect, type Locator, type Page } from "@playwright/test";
import { callAsOperator, idOf, PROD_502_ID, produceCall, query, RAW_TOM_ID, receiveCall, VENDOR_ID } from "../db";

// What the production specs share: how to find the form's parts, fill it, and
// read raw tables through pg. Helpers that need nothing production-specific
// (factValue, beforeAfter, deviceDate, sendsActionRequest) come from the
// receiving helpers. The pg pool stays open: every spec in this worker shares it.

export const CODE = "502";
export const BATCH_URL = `/production?product=${CODE}`;
export const NO_PRODUCTS = "No active finished products yet. Add one in Supabase Studio, then reload this page.";
export const CHECK_HEADING = "Check this batch";
export const SIGNED_OUT = "You're signed out. Sign in again to save this batch.";
export const NOT_SAVED = "The batch wasn't saved.";
export const BATCH_UNKNOWN =
  "The batch may not have been saved. Reload this page and check Recent batches before saving again.";

// What Tab reaches on the production page, in order.
export const FORM_CONTROLS = [
  "a Receiving",
  "a Production",
  "a Menu",
  "a Pricing",
  "button Sign out",
  "input #product-code",
  "input #raw-lbs",
  "input #finished-lbs",
  "input #production-date",
  "textarea #notes",
  "button Save",
];

// What Tab reaches inside the open check step.
export const CHECK_CONTROLS = ["button Go back", "button Save batch"];

export function fields(page: Page) {
  return {
    code: page.getByLabel("Product code"),
    raw: page.getByLabel("Raw lbs"),
    finished: page.getByLabel("Finished lbs"),
    date: page.getByLabel("Production date"),
    notes: page.getByLabel("Notes (optional)"),
    save: page.getByRole("button", { name: "Save", exact: true }),
    message: page.locator("#batch-message"),
    result: page.getByRole("status", { name: "Batch result" }),
    region: page.locator("#product-region"),
  };
}

export type Fields = ReturnType<typeof fields>;

// Opens the form and waits until the device date has filled the date field.
export async function openForm(page: Page, url = "/production"): Promise<Fields> {
  await page.goto(url);
  const f = fields(page);
  await expect(f.date).not.toHaveValue("");
  return f;
}

export async function fillBatch(
  f: Fields,
  values: { code?: string; raw?: string; finished?: string; date?: string; notes?: string },
): Promise<void> {
  const { code = CODE, raw = "2000", finished = "", date = "2026-10-06", notes = "" } = values;
  await f.code.fill(code);
  await f.raw.fill(raw);
  await f.finished.fill(finished);
  await f.date.fill(date);
  await f.notes.fill(notes);
}

// Every field's current value, to show that a refused or failed save kept all of them.
export async function readValues(f: Fields): Promise<Record<string, string>> {
  return {
    code: await f.code.inputValue(),
    raw: await f.raw.inputValue(),
    finished: await f.finished.inputValue(),
    date: await f.date.inputValue(),
    notes: await f.notes.inputValue(),
  };
}

export function checkDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: CHECK_HEADING });
}

// Presses Save, then Save batch in the check step.
export async function saveThrough(page: Page, f: Fields): Promise<void> {
  await f.save.click();
  const dialog = checkDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Save batch" }).click();
}

// The 502 fixture: RAW-TOM lot A (5,000 lbs at 1.68, received 2026-10-01), then lot B
// (3,000 lbs at 1.80, received 2026-10-05). The product itself is the seed's 502.
export async function seed502Fixture(): Promise<{ lotA: string; lotB: string }> {
  const a = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
  expect(a.ok, a.error).toBe(true);
  const b = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 3000, 1.8, "2026-10-05"));
  expect(b.ok, b.error).toBe(true);
  return { lotA: idOf(a), lotB: idOf(b) };
}

// Writes a batch of 502 through the engine, as the operator, and returns its id.
export async function seedBatch(rawLbs: number, date = "2026-10-06", finishedLbs: number | null = null) {
  const outcome = await callAsOperator(produceCall(PROD_502_ID, rawLbs, finishedLbs, date));
  expect(outcome.ok, outcome.error).toBe(true);
  return idOf(outcome);
}

export async function batchCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from production_batches");
  return row?.n ?? -1;
}

// The batches written, with the figures the engine stored.
export async function batchRows() {
  return query<{
    raw_lbs_in: number;
    finished_lbs_out: number;
    shrink_pct_used: number;
    raw_cost_total: number;
    cost_per_finished_lb: number;
    production_date: string;
    notes: string | null;
  }>(
    `select b.raw_lbs_in::float8, b.finished_lbs_out::float8, b.shrink_pct_used::float8,
            b.raw_cost_total::float8, b.cost_per_finished_lb::float8,
            b.production_date::text, b.notes
     from production_batches b join finished_goods g on g.batch_id = b.id
     order by g.produced_seq`,
  );
}

// The finished lots written.
export async function finishedRows() {
  return query<{ lbs_produced: number; lbs_remaining: number; cost_per_lb: number }>(
    "select lbs_produced::float8, lbs_remaining::float8, cost_per_lb::float8 from finished_goods order by produced_seq",
  );
}

// Aborts every server action request the production page sends from now on, as
// a dropped connection would, before the server sees it. Returns a count of the
// aborted requests.
export async function dropActionRequests(page: Page): Promise<{ readonly count: number }> {
  const dropped = { count: 0 };
  await page.route("**/production**", async (route) => {
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

// The batch numbers of the batches written, in the order they were entered.
export async function batchNumbersInEntryOrder(): Promise<string[]> {
  const rows = await query<{ batch_number: string }>(
    `select b.batch_number from production_batches b
     join finished_goods g on g.batch_id = b.id order by g.produced_seq`,
  );
  return rows.map((row) => row.batch_number);
}

// What the lots hold, to show a refused save changed none of them.
export async function lotSnapshot() {
  return query<{ id: string; remaining_lbs: number }>(
    "select id, remaining_lbs::float8 from lots order by receipt_seq",
  );
}
