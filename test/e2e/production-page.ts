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
  "a Sales",
  "a Trace",
  "a Invoices",
  "a Ask",
  "a Alerts",
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

// ---- Reverse (corrections AC-0130 to AC-0151) ----

export const REVERSE_SIGNED_OUT = "You're signed out. Sign in again to reverse this batch.";
export const NOT_REVERSED = "The batch wasn't reversed.";
// AC-0144 and AC-0149: the write call got no answer, so the reversal may have happened.
export const REVERSAL_UNKNOWN = "The batch may not have been reversed. Reload this page to see whether it was.";
export const NOT_LOADED = "The new figures couldn't be loaded. Reload to see them.";
export const REASON_REFUSAL = "Enter a reason for the reversal.";

// What Tab reaches inside an open reversal, in order.
export const REVERSE_DIALOG_CONTROLS = ["button Cancel", "textarea reason", "button Reverse batch"];

// The list item of one batch in Recent batches, found by its batch number.
export function batchItem(page: Page, batchNumber: string): Locator {
  return page
    .locator("#product-region")
    .getByRole("listitem")
    .filter({ has: page.locator("dd", { hasText: new RegExp(`^${batchNumber}$`) }) });
}

// The Reverse button of a batch. Its name carries the batch number, so each is distinct.
export function reverseButton(item: Locator): Locator {
  return item.getByRole("button", { name: /^Reverse batch / });
}

export function reverseDialog(page: Page, batchNumber: string): Locator {
  return page.getByRole("dialog", { name: `Reverse batch ${batchNumber}` });
}

// The message a closing refusal leaves in a list item: the reversal's alert region, found by its text.
export function reverseMessage(item: Locator): Locator {
  return item.getByRole("alert").filter({ hasText: /reverse/i });
}

// The "Batch reversed" panel of one list item.
export function reversePanel(item: Locator): Locator {
  return item.getByRole("status", { name: /^Reversal of batch / });
}

// Opens the confirmation and types the reason. It does not press Reverse batch.
export async function openReversal(page: Page, item: Locator, batchNumber: string, reason?: string): Promise<Locator> {
  await reverseButton(item).click();
  const dialog = reverseDialog(page, batchNumber);
  if (reason !== undefined) await dialog.getByLabel("Reason for the reversal").fill(reason);
  return dialog;
}

export async function reverseThrough(page: Page, item: Locator, batchNumber: string, reason = "entered twice"): Promise<Locator> {
  const dialog = await openReversal(page, item, batchNumber, reason);
  await dialog.getByRole("button", { name: "Reverse batch", exact: true }).click();
  return dialog;
}

export async function batchNumberOf(id: string): Promise<string> {
  const [row] = await query<{ n: string }>("select batch_number as n from production_batches where id = $1", [id]);
  return row?.n ?? "missing";
}

export async function reversedCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from production_batches where reversed_at is not null");
  return row?.n ?? -1;
}

// What a batch, its finished lot, and the sales hold in the ledger, to show a refused or missing reversal changed none of it.
export async function reversalState(batchId: string) {
  const [row] = await query<{ reversed: boolean; reason: string | null; finished: string; voided: number; lots: string }>(
    `select b.reversed_at is not null as reversed, b.reversal_reason as reason,
            g.lbs_remaining::text as finished,
            (select count(*)::int from sales where voided_at is not null) as voided,
            (select string_agg(remaining_lbs::text, ',' order by receipt_seq) from lots) as lots
     from production_batches b join finished_goods g on g.batch_id = b.id where b.id = $1`,
    [batchId],
  );
  return row;
}
