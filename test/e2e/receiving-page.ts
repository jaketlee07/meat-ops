import { expect, type Locator, type Page } from "@playwright/test";
import { Pool, type PoolClient } from "pg";
import { callAsOperator, getOperatorId, idOf, query, RAW_TOM_ID, receiveCall, VENDOR_ID } from "../db";
import { resolveStackEnv } from "../env";

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
    // Scoped to the form: the Correct confirmations in the list carry fields with the same labels.
    weight: page.getByRole("form", { name: RECEIVING_FORM }).getByLabel("Weight (lbs)"),
    cost: page.getByRole("form", { name: RECEIVING_FORM }).getByLabel("Cost per lb ($)"),
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

// Whether the page sends a server action request (a POST with a next-action
// header) within `ms` of this call. Call it before the step that might send one,
// and read the answer after: the wait covers the whole window, so a request that
// leaves a moment late is still seen.
export function sendsActionRequest(page: Page, ms = 1500): Promise<boolean> {
  return page
    .waitForRequest((request) => request.method() === "POST" && "next-action" in request.headers(), { timeout: ms })
    .then(
      () => true,
      () => false,
    );
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

// The message a void leaves in a list item. Correct leaves its own alert region
// in the same item, so the void's is found by its text: every void message says "void".
export function voidMessage(item: Locator): Locator {
  return item.getByRole("alert").filter({ hasText: /void/i });
}

// ---- Correct (corrections AC-0090 to AC-0118) ----

export const CORRECT_SIGNED_OUT = "You're signed out. Sign in again to correct this receipt.";
export const NOT_CORRECTED = "The receipt wasn't corrected.";
// AC-0110 and AC-0116: the write call got no answer, so the correction may have happened.
export const CORRECTION_UNKNOWN = "The receipt may not have been corrected. Reload this page to see whether it was.";
export const NOTHING_TO_CORRECT = "Change the cost or the weight to correct this receipt.";
export const NOT_LOADED = "The new figures couldn't be loaded. Reload to see them.";

// The Correct button of a receipt. Its name carries the lot number, so each is distinct.
export function correctButton(item: Locator): Locator {
  return item.getByRole("button", { name: /^Correct lot / });
}

export function correctDialog(page: Page, lotNumber: string): Locator {
  return page.getByRole("dialog", { name: `Correct receipt ${lotNumber}` });
}

// The message a closing refusal leaves in a list item: the correction's alert region, found by its text.
export function correctMessage(item: Locator): Locator {
  return item.getByRole("alert").filter({ hasText: /correct/i });
}

// The "Receipt corrected" panel of one list item.
export function correctPanel(item: Locator): Locator {
  return item.getByRole("status", { name: /^Correction of lot / });
}

export interface CorrectionValues {
  cost?: string;
  weight?: string;
  reason?: string;
}

// Opens the confirmation and types the values; empty strings clear a field and
// an omitted one keeps what the dialog opened with. It does not press Save.
export async function openCorrection(
  page: Page,
  item: Locator,
  lotNumber: string,
  values: CorrectionValues,
): Promise<Locator> {
  await correctButton(item).click();
  const dialog = correctDialog(page, lotNumber);
  if (values.cost !== undefined) await dialog.getByLabel("Cost per lb ($)").fill(values.cost);
  if (values.weight !== undefined) await dialog.getByLabel("Weight (lbs)").fill(values.weight);
  if (values.reason !== undefined) await dialog.getByLabel("Reason for the correction").fill(values.reason);
  return dialog;
}

export async function correctThrough(
  page: Page,
  item: Locator,
  lotNumber: string,
  values: CorrectionValues,
): Promise<Locator> {
  const dialog = await openCorrection(page, item, lotNumber, { reason: "invoice price", ...values });
  await dialog.getByRole("button", { name: "Save correction" }).click();
  return dialog;
}

export async function correctionCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from receipt_corrections");
  return row?.n ?? -1;
}

// What a lot holds in the ledger after a refused or missing correction.
export async function correctedState(id: string) {
  const [row] = await query<{ cost: string; weight: string; remaining: string }>(
    "select current_unit_cost::text as cost, current_weight_lbs::text as weight, remaining_lbs::text as remaining from lots where id = $1",
    [id],
  );
  return row;
}

// A pg session that holds RAW-TOM's inventory_balances row, which every
// correct_receipt on it queues behind. Sessions are the caller's to release.
const lockPool = new Pool({ connectionString: resolveStackEnv().dbUrl, max: 3 });

export interface StockLock {
  // Waits until the app's correct_receipt call is stuck behind this lock holder.
  waiting(): Promise<void>;
  // Runs correct_receipt as the operator inside the lock holder's transaction.
  correctInside(lotId: string, cost: string, weight: string, reason: string): Promise<void>;
  // Commits and lets the waiting call go on. Safe to call twice.
  release(): Promise<void>;
}

export async function holdStockLock(): Promise<StockLock> {
  const client: PoolClient = await lockPool.connect();
  let open = true;
  await client.query("begin");
  await client.query("select 1 from public.inventory_balances where product_id = $1 for update", [RAW_TOM_ID]);
  const pid = Number((await client.query("select pg_backend_pid() as pid")).rows[0].pid);
  return {
    async waiting() {
      await expect
        .poll(
          async () =>
            (
              await query(
                "select 1 from pg_stat_activity where wait_event_type = 'Lock' and pid <> $1 and datname = current_database() and query like '%correct_receipt%' and $1 = any(pg_blocking_pids(pid))",
                [pid],
              )
            ).length,
          { timeout: 10_000 },
        )
        .toBeGreaterThan(0);
    },
    async correctInside(lotId, cost, weight, reason) {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "authenticated", sub: await getOperatorId() }),
      ]);
      await client.query("select * from public.correct_receipt($1, $2, $3, $4)", [lotId, cost, weight, reason]);
    },
    async release() {
      if (!open) return;
      open = false;
      await client.query("commit").catch(() => undefined);
      client.release();
    },
  };
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
