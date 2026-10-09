import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { callAsOperator, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "../db";
import { OPERATOR_EMAIL } from "../users";
import { checkPageState } from "./a11y";
import {
  BATCH_URL,
  batchCount,
  batchNumbersInEntryOrder,
  batchRows,
  BATCH_UNKNOWN,
  CHECK_CONTROLS,
  checkDialog,
  CODE,
  fields,
  dropActionRequests,
  fillBatch,
  finishedRows,
  type Fields,
  FORM_CONTROLS,
  lotSnapshot,
  NO_PRODUCTS,
  NOT_SAVED,
  openForm,
  readValues,
  saveThrough,
  seed502Fixture,
  seedBatch,
  SIGNED_OUT,
} from "./production-page";
import {
  beforeAfter,
  deviceDate,
  factValue,
  lotNumberOf,
  NOT_ALLOWED,
  sendsActionRequest,
} from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE, signInThroughForm } from "./states";

// The production page, end to end: a real browser over the production build and
// the local database. Raw tables are read through pg to show what was or was
// not written.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// The facts list that follows a heading, for sections whose labels repeat.
function factsUnder(scope: Locator, heading: string): Locator {
  return scope.locator("h3", { hasText: heading }).locator("xpath=following-sibling::dl[1]");
}

test.describe("access and navigation", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /production ends on /sign-in", async ({ page }) => {
      await page.goto("/production");
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0002: /production shows the not-allowed message, Sign out, and no form", async ({ page }) => {
      await page.goto("/production");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByLabel("Product code")).toHaveCount(0);
      await expect(page.getByRole("form", { name: "New batch" })).toHaveCount(0);
      expect(await checkPageState(page)).toEqual(["button Sign out"]);
    });
  });

  for (const [path, current, other] of [
    ["/receiving", "Receiving", "Production"],
    ["/production", "Production", "Receiving"],
  ] as const) {
    test(`AC-0005 and AC-0006: ${path} links both pages and marks only its own`, async ({ page }) => {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav.getByRole("link", { name: "Receiving" })).toHaveAttribute("href", "/receiving");
      await expect(nav.getByRole("link", { name: "Production" })).toHaveAttribute("href", "/production");
      await expect(nav.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: other })).not.toHaveAttribute("aria-current", /.*/);
      await expect(nav.locator("[aria-current]")).toHaveCount(1);
    });
  }

  test("AC-0007 and AC-0068: Sign out on /production ends on /sign-in, and /production then ends there too", async ({
    browser,
    baseURL,
  }) => {
    // A session of its own, because signing out revokes it and the saved operator
    // session that later tests reuse must stay valid.
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await signInThroughForm(page, OPERATOR_EMAIL);
      await page.goto("/production");
      await expect(page.getByRole("form", { name: "New batch" })).toBeVisible();

      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/sign-in$/);

      await page.goto("/production");
      await expect(page).toHaveURL(/\/sign-in$/);
    } finally {
      await context.close();
    }
  });
});

test.describe("the form", () => {
  test("the empty form says to type a code and meets the page-state checks", async ({ page }) => {
    await openForm(page);
    await expect(page.getByText("Type a product code to start.")).toBeVisible();
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0008: a product code shows its description, raw input, shrink, and raw stock", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page);
    await f.code.fill(CODE);
    await expect(page.getByText("Smoked Turkey Drums Tom", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/production\?product=502$/);
    await expect(factValue(f.region, "Product")).toHaveText("502 Smoked Turkey Drums Tom");
    await expect(factValue(f.region, "Raw input")).toHaveText("RAW-TOM Turkey Drums TOM (raw)");
    await expect(factValue(f.region, "Shrink")).toHaveText("23%");
    await expect(factValue(f.region, "Raw on hand")).toHaveText("8,000 lbs");
    await expect(factValue(f.region, "Raw average cost")).toHaveText("$1.7250/lb");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0047: a raw input with no stock shows 0 lbs and None yet", async ({ page }) => {
    const f = await openForm(page, `/production?product=${CODE}`);
    await expect(factValue(f.region, "Raw on hand")).toHaveText("0 lbs");
    await expect(factValue(f.region, "Raw average cost")).toHaveText("None yet");
  });

  test("the product region is busy while a product loads", async ({ page }) => {
    const f = await openForm(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/production\?product=/, async (route) => {
      await gate;
      await route.continue();
    });
    await f.code.fill(CODE);
    await expect(f.region).toHaveAttribute("aria-busy", "true");
    release();
    await expect(factValue(f.region, "Shrink")).toHaveText("23%");
    await expect(f.region).toHaveAttribute("aria-busy", "false");
  });

  test("AC-0082 and AC-0083: with no active finished product the page says so, and Save opens no check step", async ({
    page,
  }) => {
    await query("update products set active = false where kind = 'finished'");
    const f = await openForm(page);
    await expect(page.getByText(NO_PRODUCTS, { exact: true })).toBeVisible();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);

    await fillBatch(f, {});
    const sent = sendsActionRequest(page);
    await f.save.click({ force: true });
    await expect(checkDialog(page)).toHaveCount(0);
    expect(await sent, "a save request left the page").toBe(false);
    expect(await batchCount()).toBe(0);
  });

  test.describe("in a time zone far from UTC", () => {
    test.use({ timezoneId: "Pacific/Auckland" });

    test("AC-0009: the production date starts at today on the device, not the UTC date", async ({ page }) => {
      // 03:00 on Jan 15 in Auckland (UTC+13) is 14:00 on Jan 14 in UTC.
      await page.clock.install({ time: new Date("2026-01-14T14:00:00Z") });
      const f = await openForm(page);
      expect(await deviceDate(page)).toBe("2026-01-15");
      await expect(f.date).toHaveValue("2026-01-15");
      await expect(f.date).toHaveAttribute("max", "2026-01-15");
    });
  });

  test("AC-0059: the raw lbs and finished lbs fields have lbs in their names", async ({ page }) => {
    await openForm(page);
    await expect(page.getByRole("textbox", { name: /lbs/ })).toHaveCount(2);
    await expect(page.getByRole("textbox", { name: /Raw lbs/ })).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: /Finished lbs/ })).toHaveCount(1);
  });
});

// Each row of the AC-0010 table: the field, the input, and the message beside it.
type FieldKey = "code" | "raw" | "finished" | "date" | "notes";
const FIELD_ID: Record<FieldKey, string> = {
  code: "product-code",
  raw: "raw-lbs",
  finished: "finished-lbs",
  date: "production-date",
  notes: "notes",
};
const RAW_FORMAT = "Enter the raw lbs, like 2000 or 32.5.";
const FINISHED_FORMAT = "Enter the finished lbs, like 1540 or 32.5, or leave it blank.";
const PLACES = "Use at most 3 decimal places for weight.";
// The not-a-calendar-date row (2026-02-30) cannot be typed into a date input; the
// rule tests in test/production-rules.test.ts cover it.
const RULES: Array<[FieldKey, string, string]> = [
  ["code", "", "Enter a product code."],
  ["code", "RAW-TOM", "No active finished product has code RAW-TOM."],
  ["code", "502-OLD", "No active finished product has code 502-OLD."],
  ["raw", "", RAW_FORMAT],
  ["raw", "2,000", RAW_FORMAT],
  ["raw", "-5", RAW_FORMAT],
  ["raw", "1.2345", PLACES],
  ["raw", "0", "Raw lbs must be above 0."],
  ["raw", "0.0", "Raw lbs must be above 0."],
  ["raw", "000", "Raw lbs must be above 0."],
  ["finished", "1,500", FINISHED_FORMAT],
  ["finished", "-1", FINISHED_FORMAT],
  ["finished", "1.2345", PLACES],
  ["finished", "0", "Finished lbs must be above 0."],
  ["finished", "2000.001", "Finished lbs can't be more than the raw lbs."],
  ["date", "", "Enter the production date."],
  ["date", "TOMORROW", "The production date can't be after today."],
  ["notes", "x".repeat(501), "Keep notes to 500 characters or fewer."],
];

test.describe("refused forms", () => {
  for (const [field, input, message] of RULES) {
    test(`AC-0010: ${field} ${JSON.stringify(input.slice(0, 12))} is refused beside its field`, async ({ page }) => {
      await query(
        `insert into products(code, description, kind, active, raw_product_id, shrink_pct)
         values ('502-OLD', 'Old finished product', 'finished', false, $1, 0.1)`,
        [RAW_TOM_ID],
      );
      const f = await openForm(page);
      await fillBatch(f, {});
      if (field === "date") await f.date.fill(input === "TOMORROW" ? await deviceDate(page, 1) : input);
      else await f[field].fill(input);
      const typed = await readValues(f);

      await f.save.click();

      const id = FIELD_ID[field];
      // AC-0010: the message is beside the field, AC-0054: the field points to it,
      // AC-0053: focus is on the field.
      await expect(page.locator(`#${id}-error`)).toHaveText(message);
      await expect(f[field]).toHaveAttribute("aria-describedby", `${id}-error`);
      await expect(f[field]).toBeFocused();
      // The check step stays closed, every field keeps its value, and nothing is written.
      await expect(checkDialog(page)).toHaveCount(0);
      expect(await readValues(f)).toEqual(typed);
      expect(await batchCount()).toBe(0);
    });
  }

  test("AC-0053 and AC-0054: with several errors, focus is on the first and each points to its message", async ({
    page,
  }) => {
    const f = await openForm(page);
    await f.date.fill("");
    await f.save.click();

    const expected: Array<[Locator, string, string]> = [
      [f.code, "product-code", "Enter a product code."],
      [f.raw, "raw-lbs", RAW_FORMAT],
      [f.date, "production-date", "Enter the production date."],
    ];
    for (const [control, id, message] of expected) {
      await expect(control).toHaveAttribute("aria-describedby", `${id}-error`);
      await expect(page.locator(`#${id}-error`)).toHaveText(message);
    }
    await expect(f.code).toBeFocused();
    await expect(f.finished).not.toHaveAttribute("aria-invalid", "true");
    await expect(f.notes).not.toHaveAttribute("aria-invalid", "true");
    expect(await batchCount()).toBe(0);
  });

  test("a code missing from the page's list beside a blank raw lbs shows both messages on the first Save", async ({
    page,
  }) => {
    const f = await openForm(page);
    await fillBatch(f, { code: "NOPE", raw: "" });
    await f.save.click();
    await expect(page.locator("#product-code-error")).toHaveText("No active finished product has code NOPE.");
    await expect(page.locator("#raw-lbs-error")).toHaveText(RAW_FORMAT);
    await expect(f.code).toBeFocused();
    expect(await batchCount()).toBe(0);
  });

  test("the form after an AC-0010 refusal of a blank raw lbs meets the page-state checks", async ({ page }) => {
    const f = await openForm(page);
    await fillBatch(f, { raw: "" });
    await f.save.click();
    await expect(page.locator("#raw-lbs-error")).toHaveText(RAW_FORMAT);
    await expect(f.raw).toBeFocused();
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });
});

test.describe("the check step", () => {
  test("AC-0013, AC-0014, AC-0016: the check step names the batch and says it can't be undone", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page);
    await fillBatch(f, {});
    await f.save.click();

    const dialog = checkDialog(page);
    await expect(dialog).toBeVisible();
    await expect(factValue(dialog, "Product")).toHaveText("502 Smoked Turkey Drums Tom");
    await expect(factValue(dialog, "Raw lbs")).toHaveText("2,000 lbs");
    await expect(factValue(dialog, "Production date")).toHaveText("Oct 6, 2026");
    await expect(factValue(dialog, "Finished lbs")).toHaveText("From shrink (23%)");
    await expect(dialog.getByText("A batch can't be undone.", { exact: true })).toBeVisible();
    // AC-0016: the description holds the code, the raw lbs, and the date.
    await expect(dialog).toHaveAccessibleDescription(/502.*2,000 lbs.*Oct 6, 2026/);
    // Go back is first and takes the initial focus.
    await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
    expect(await checkPageState(page)).toEqual(CHECK_CONTROLS);
    expect(await batchCount()).toBe(0);
  });

  test("AC-0013: a measured finished weight shows as typed", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page);
    await fillBatch(f, { finished: "1500" });
    await f.save.click();
    await expect(factValue(checkDialog(page), "Finished lbs")).toHaveText("1,500 lbs");
  });

  test("AC-0015, AC-0070, AC-0071, AC-0056: Go back closes the step, writes nothing, keeps every field, and focuses Save", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page);
    await fillBatch(f, { finished: "1500", notes: "kept note" });
    const typed = await readValues(f);
    await f.save.click();
    await checkDialog(page).getByRole("button", { name: "Go back" }).click();

    await expect(checkDialog(page)).toHaveCount(0);
    await expect(f.save).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    expect(await batchCount()).toBe(0);
  });

  test("Escape closes the step like Go back", async ({ page }) => {
    const f = await openForm(page);
    await fillBatch(f, {});
    await f.save.click();
    await expect(checkDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(checkDialog(page)).toHaveCount(0);
    await expect(f.save).toBeFocused();
    expect(await batchCount()).toBe(0);
  });

  test("AC-0017: pressing Save batch again while a save is pending writes no second batch", async ({ page }) => {
    await seed502Fixture();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = 0;
    await page.route("**/production**", async (route) => {
      if (route.request().method() === "POST") {
        held += 1;
        await gate;
      }
      await route.continue();
    });

    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    await f.save.click();
    const dialog = checkDialog(page);
    const confirm = dialog.getByRole("button", { name: "Save batch" });
    await confirm.click();
    await expect(dialog.getByText("Saving…")).toBeVisible();
    await expect(confirm).toHaveAttribute("aria-disabled", "true");
    await expect(dialog.getByRole("button", { name: "Go back" })).toHaveAttribute("aria-disabled", "true");
    await confirm.click({ force: true });
    release();

    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();
    expect(held).toBe(1);
    expect(await batchCount()).toBe(1);
  });
});

test.describe("saving", () => {
  test("AC-0011: boundary values save", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page);
    const today = await f.date.inputValue();
    await fillBatch(f, { raw: "0.001", finished: "0.001", date: today, notes: "n".repeat(500) });
    await saveThrough(page, f);
    await expect(page.getByRole("heading", { name: "Batch saved" })).toBeFocused();

    await fillBatch(f, { raw: "2000", finished: "2000", date: today });
    await saveThrough(page, f);
    await expect(f.raw).toHaveValue("");
    await expect.poll(batchCount).toBe(2);

    const rows = await batchRows();
    expect(rows.map((row) => [row.raw_lbs_in, row.finished_lbs_out])).toEqual([
      [0.001, 0.001],
      [2000, 2000],
    ]);
    expect(rows[0]?.production_date).toBe(today);
  });

  test("AC-0012: a product made active after the page loaded saves without a reload", async ({ page }) => {
    await seed502Fixture();
    await query(
      `insert into products(code, description, kind, active, raw_product_id, shrink_pct)
       values ('FIN-LATE', 'Late finished product', 'finished', false, $1, 0.1)`,
      [RAW_TOM_ID],
    );
    const f = await openForm(page);
    await query("update products set active = true where code = 'FIN-LATE'");
    await fillBatch(f, { code: "FIN-LATE", raw: "100" });
    await f.save.click();

    // The page re-rendered for the code, so the check step has its description and shrink.
    const dialog = checkDialog(page);
    await expect(factValue(dialog, "Product")).toHaveText("FIN-LATE Late finished product");
    await expect(factValue(dialog, "Finished lbs")).toHaveText("From shrink (10%)");
    await dialog.getByRole("button", { name: "Save batch" }).click();

    await expect(page.getByRole("heading", { name: "Batch saved" })).toBeFocused();
    await expect(page).toHaveURL(/\/production\?product=FIN-LATE$/);
    const rows = await batchRows();
    expect(rows.map((row) => [row.raw_lbs_in, row.finished_lbs_out, row.shrink_pct_used])).toEqual([[100, 90, 0.1]]);
  });

  test("AC-0051: a batch is completed, confirmed, and saved with the keyboard alone", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page);
    const tabTo = async (target: Locator) => {
      for (let press = 0; press < 20; press++) {
        await page.keyboard.press("Tab");
        if (await target.evaluate((element) => element === document.activeElement)) return;
      }
      throw new Error("Tab did not reach the control");
    };

    await tabTo(f.code);
    await page.keyboard.type(CODE);
    await tabTo(f.raw);
    await page.keyboard.type("250");
    await tabTo(f.save);
    await page.keyboard.press("Enter");

    const dialog = checkDialog(page);
    await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
    await tabTo(dialog.getByRole("button", { name: "Save batch" }));
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Batch saved" })).toBeFocused();
    const rows = await batchRows();
    expect(rows.map((row) => row.raw_lbs_in)).toEqual([250]);
  });
});

test.describe("the batch result", () => {
  test("AC-0018 to AC-0020, AC-0023, AC-0025, AC-0026, AC-0028, AC-0052: a batch of 2,000 raw lbs from shrink", async ({
    page,
  }) => {
    const { lotA } = await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { notes: "first batch" });
    await saveThrough(page, f);

    // AC-0052: focus is on the heading, inside the status region.
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();

    // The rows the engine wrote.
    expect(await batchRows()).toEqual([
      {
        raw_lbs_in: 2000,
        finished_lbs_out: 1540,
        shrink_pct_used: 0.23,
        raw_cost_total: 3360,
        cost_per_finished_lb: 2.6318,
        production_date: "2026-10-06",
        notes: "first batch",
      },
    ]);
    expect(await finishedRows()).toEqual([{ lbs_produced: 1540, lbs_remaining: 1540, cost_per_lb: 2.6318 }]);

    // AC-0018 to AC-0020.
    const [batch] = await query<{ batch_number: string }>("select batch_number from production_batches");
    await expect(factValue(f.result, "Batch number")).toHaveText(batch?.batch_number ?? "missing");
    await expect(factValue(f.result, "Product")).toHaveText("502 Smoked Turkey Drums Tom");
    await expect(factValue(f.result, "Production date")).toHaveText("Oct 6, 2026");
    await expect(factValue(f.result, "Raw lbs in")).toHaveText("2,000 lbs");
    await expect(factValue(f.result, "Finished lbs out")).toHaveText("1,540 lbs (from shrink)");
    await expect(factValue(f.result, "Product shrink")).toHaveText("23%");
    await expect(factValue(f.result, "Raw cost")).toHaveText("$3,360.00");
    await expect(factValue(f.result, "Cost per finished lb")).toHaveText("$2.6318/lb");

    // AC-0020 and AC-0023: one lot used, with its five fields.
    const lots = f.result.getByRole("listitem");
    await expect(lots).toHaveCount(1);
    await expect(factValue(lots, "Lot number")).toHaveText(await lotNumberOf(lotA));
    await expect(factValue(lots, "Received")).toHaveText("Oct 1, 2026");
    await expect(factValue(lots, "Vendor")).toHaveText("Reyes Meats");
    await expect(factValue(lots, "Lbs drawn")).toHaveText("2,000 lbs");
    await expect(factValue(lots, "Cost per lb")).toHaveText("$1.6800/lb");

    // AC-0025 and AC-0026.
    const finished = factsUnder(f.result, "Finished stock added");
    await expect(factValue(finished, "Finished lbs added")).toHaveText("1,540 lbs");
    await expect(factValue(finished, "Cost per lb")).toHaveText("$2.6318/lb");
    await expect(beforeAfter(f.result, /^On hand/)).toHaveText(["8,000 lbs", "6,000 lbs"]);
    await expect(beforeAfter(f.result, /^Average cost/)).toHaveText(["$1.7250/lb", "$1.7400/lb"]);

    // The raw stock in the product region re-renders from the database.
    await expect(factValue(f.region, "Raw on hand")).toHaveText("6,000 lbs");

    // AC-0028: product and date stay; raw lbs, finished lbs, and notes empty.
    await expect(f.code).toHaveValue(CODE);
    await expect(f.date).toHaveValue("2026-10-06");
    await expect(f.raw).toHaveValue("");
    await expect(f.finished).toHaveValue("");
    await expect(f.notes).toHaveValue("");

    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0021, AC-0027: a batch of 6,000 raw lbs draws lot A, then lot B", async ({ page }) => {
    const { lotA, lotB } = await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { raw: "6000" });
    await saveThrough(page, f);
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();

    expect((await batchRows())[0]).toMatchObject({
      finished_lbs_out: 4620,
      raw_cost_total: 10200,
      cost_per_finished_lb: 2.6578,
    });
    await expect(factValue(f.result, "Finished lbs out")).toHaveText("4,620 lbs (from shrink)");
    await expect(factValue(f.result, "Raw cost")).toHaveText("$10,200.00");
    await expect(factValue(f.result, "Cost per finished lb")).toHaveText("$2.6578/lb");

    const lots = f.result.getByRole("listitem");
    await expect(lots).toHaveCount(2);
    await expect(factValue(lots, "Lot number")).toHaveText([await lotNumberOf(lotA), await lotNumberOf(lotB)]);
    await expect(factValue(lots, "Lbs drawn")).toHaveText(["5,000 lbs", "1,000 lbs"]);
    await expect(factValue(lots, "Cost per lb")).toHaveText(["$1.6800/lb", "$1.8000/lb"]);
    await expect(beforeAfter(f.result, /^On hand/)).toHaveText(["8,000 lbs", "2,000 lbs"]);
    await expect(beforeAfter(f.result, /^Average cost/)).toHaveText(["$1.7250/lb", "$1.8000/lb"]);
  });

  test("AC-0019, AC-0022, AC-0072, AC-0081: a measured batch says measured and that shrink was not used", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { finished: "1500" });
    await saveThrough(page, f);
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();

    expect((await batchRows())[0]).toMatchObject({
      finished_lbs_out: 1500,
      shrink_pct_used: 0.23,
      raw_cost_total: 3360,
      cost_per_finished_lb: 2.69,
    });
    await expect(factValue(f.result, "Finished lbs out")).toHaveText("1,500 lbs (measured)");
    await expect(factValue(f.result, "Raw cost")).toHaveText("$3,360.00");
    await expect(factValue(f.result, "Cost per finished lb")).toHaveText("$2.6900/lb");
    await expect(factValue(f.result, "Product shrink")).toHaveText("23% (not used, finished lbs measured)");
  });

  test("AC-0024: lots are listed in draw order, not entry order", async ({ page }) => {
    // Received 2026-10-05 and entered first, then received 2026-10-01 and entered second.
    const later = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 3000, 1.8, "2026-10-05"));
    const earlier = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
    expect(later.ok && earlier.ok).toBe(true);
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { raw: "6000" });
    await saveThrough(page, f);
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();

    const lots = f.result.getByRole("listitem");
    await expect(factValue(lots, "Received")).toHaveText(["Oct 1, 2026", "Oct 5, 2026"]);
    await expect(factValue(lots, "Lbs drawn")).toHaveText(["5,000 lbs", "1,000 lbs"]);
  });
});

// Batches entered out of date order, so entry order and date order disagree. The
// last one entered has an earlier production date than every other batch.
const ENTRY_DATES = [6, 3, 7, 4, 5, 7, 3, 6, 4, 5, 7, 2].map((day) => `2026-10-0${day}`);

test.describe("recent batches", () => {
  test("AC-0038, AC-0076, AC-0040: the 10 last-entered batches, last entered first, and the count", async ({
    page,
  }) => {
    await seed502Fixture();
    for (const date of ENTRY_DATES) await seedBatch(100, date);
    const numbers = await batchNumbersInEntryOrder();
    expect(numbers).toHaveLength(12);

    const f = await openForm(page, BATCH_URL);
    const items = f.region.getByRole("listitem");
    await expect(items).toHaveCount(10);
    // Entry order, newest first: batches 12 down to 3. Batch 12 has the earliest date.
    await expect(factValue(f.region, "Batch number")).toHaveText(numbers.slice(2).reverse());
    await expect(factValue(f.region, "Production date").first()).toHaveText("Oct 2, 2026");
    await expect(factValue(f.region, "Production date")).toHaveText(
      ENTRY_DATES.slice(2)
        .reverse()
        .map((date) => `Oct ${Number(date.slice(-2))}, 2026`),
    );
    await expect(f.region.getByText("Showing the 10 most recent of 12 batches.", { exact: true })).toBeVisible();
  });

  test("AC-0040: with 10 batches or fewer there is no count line", async ({ page }) => {
    await seed502Fixture();
    for (const date of ENTRY_DATES.slice(0, 10)) await seedBatch(100, date);
    const f = await openForm(page, BATCH_URL);
    await expect(f.region.getByRole("listitem")).toHaveCount(10);
    await expect(f.region.getByText(/^Showing the/)).toHaveCount(0);

    await seedBatch(100, "2026-10-05");
    await page.reload();
    await expect(f.region.getByText("Showing the 10 most recent of 11 batches.", { exact: true })).toBeVisible();
  });

  test("AC-0039: each batch shows its number, date, raw lbs, finished lbs, and cost per finished lb", async ({
    page,
  }) => {
    await seed502Fixture();
    const id = await seedBatch(2000, "2026-10-06");
    const [row] = await query<{ batch_number: string }>("select batch_number from production_batches where id = $1", [
      id,
    ]);
    const f = await openForm(page, BATCH_URL);
    const item = f.region.getByRole("listitem");
    await expect(item).toHaveCount(1);
    await expect(factValue(item, "Batch number")).toHaveText(row?.batch_number ?? "missing");
    await expect(factValue(item, "Production date")).toHaveText("Oct 6, 2026");
    await expect(factValue(item, "Raw lbs in")).toHaveText("2,000 lbs");
    await expect(factValue(item, "Finished lbs out")).toHaveText("1,540 lbs");
    await expect(factValue(item, "Cost per finished lb")).toHaveText("$2.6318/lb");
  });

  test("AC-0041: a product with no batches says so", async ({ page }) => {
    const f = await openForm(page, BATCH_URL);
    await expect(f.region.getByText("No batches for this product yet.", { exact: true })).toBeVisible();
    await expect(f.region.getByRole("listitem")).toHaveCount(0);
  });

  test("AC-0042: after a save, the saved batch is first in the list", async ({ page }) => {
    await seed502Fixture();
    await seedBatch(100, "2026-10-07");
    const f = await openForm(page, BATCH_URL);
    await expect(f.region.getByRole("listitem")).toHaveCount(1);
    await fillBatch(f, { raw: "2000", date: "2026-10-02" });
    await saveThrough(page, f);
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();

    const numbers = await batchNumbersInEntryOrder();
    expect(numbers).toHaveLength(2);
    await expect(f.region.getByRole("listitem")).toHaveCount(2);
    await expect(factValue(f.region, "Batch number").first()).toHaveText(numbers[1] ?? "missing");
    await expect(factValue(f.region, "Production date").first()).toHaveText("Oct 2, 2026");
  });
});

// A finished product whose shrink leaves nothing from a very small batch.
async function addHighShrinkProduct(): Promise<void> {
  await query(
    `insert into products(code, description, kind, active, raw_product_id, shrink_pct)
     values ('FIN-SHR', 'High shrink product', 'finished', true, $1, 0.6)`,
    [RAW_TOM_ID],
  );
}

test.describe("refused and failed saves", () => {
  // Presses Save and confirms, then shows the refusal: the message is focused,
  // every field kept its value, no batch exists, and no lot changed.
  async function expectRefused(f: Fields, typed: Record<string, string>, message: string, lots: unknown) {
    await expect(f.message).toHaveText(message);
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    expect(await batchCount()).toBe(0);
    expect(await lotSnapshot()).toEqual(lots);
  }

  test("AC-0030, AC-0036, AC-0037, AC-0055: a shortfall is refused with the amounts, and the page meets the checks", async ({
    page,
  }) => {
    await seed502Fixture();
    const lots = await lotSnapshot();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { raw: "6000", date: "2026-10-03" });
    const typed = await readValues(f);
    await saveThrough(page, f);

    await expectRefused(
      f,
      typed,
      `${NOT_SAVED} Only 5,000 lbs of raw on hand was received on or before Oct 3, 2026, and this batch needs 6,000 lbs.`,
      lots,
    );
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0031, AC-0036, AC-0037, AC-0055: a product made inactive after the page loaded is refused", async ({
    page,
  }) => {
    await seed502Fixture();
    const lots = await lotSnapshot();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    const typed = await readValues(f);
    await query("update products set active = false where id = $1", [PROD_502_ID]);
    await saveThrough(page, f);
    await expectRefused(f, typed, `${NOT_SAVED} This product is no longer active.`, lots);
  });

  test("AC-0032, AC-0036, AC-0037, AC-0055: a raw input made inactive after the page loaded is refused", async ({
    page,
  }) => {
    await seed502Fixture();
    const lots = await lotSnapshot();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    const typed = await readValues(f);
    await query("update products set active = false where id = $1", [RAW_TOM_ID]);
    await saveThrough(page, f);
    await expectRefused(f, typed, `${NOT_SAVED} Its raw product is no longer active.`, lots);
  });

  test("AC-0033, AC-0036, AC-0037, AC-0055: a session that ended after the form loaded keeps the form", async ({
    page,
  }) => {
    await seed502Fixture();
    const lots = await lotSnapshot();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { notes: "kept" });
    const typed = await readValues(f);
    await page.context().clearCookies();
    await saveThrough(page, f);
    await expectRefused(f, typed, SIGNED_OUT, lots);
  });

  test("AC-0075, AC-0036, AC-0037, AC-0055: any other engine refusal shows its own reason", async ({ page }) => {
    await seed502Fixture();
    await addHighShrinkProduct();
    const lots = await lotSnapshot();
    const f = await openForm(page, "/production?product=FIN-SHR");
    await fillBatch(f, { code: "FIN-SHR", raw: "0.001", date: "2026-10-06" });
    const typed = await readValues(f);
    await saveThrough(page, f);
    await expectRefused(f, typed, `${NOT_SAVED} invalid yield, finished lbs out would be 0`, lots);
  });

  test("AC-0074, AC-0037, AC-0055: a save whose connection drops keeps the form and says it may have been saved", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { notes: "kept" });
    const typed = await readValues(f);
    const dropped = await dropActionRequests(page);
    await saveThrough(page, f);

    await expect(f.message).toHaveText(BATCH_UNKNOWN);
    await expect(f.message).toBeFocused();
    // The request never reached the server, and every field keeps its value.
    expect(dropped.count).toBe(1);
    expect(await readValues(f)).toEqual(typed);
    expect(await batchCount()).toBe(0);
    await expect(f.save).toBeEnabled();
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });
});

// The grant the reads after a save depend on. The test withdraws it from the
// operator's role and gives back exactly that.
const REVOKE_LOTS_READ = "revoke select on table public.production_batch_lots from authenticated";
const RESTORE_LOTS_READ = "grant select on table public.production_batch_lots to authenticated";

test.describe("a save whose reads afterward fail", () => {
  test.afterEach(async () => {
    await query(RESTORE_LOTS_READ);
  });

  test("AC-0029, AC-0073: the batch is shown, and the lots and stock are replaced by a reload message", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { notes: "reads fail" });
    await f.save.click();
    const dialog = checkDialog(page);
    await expect(dialog).toBeVisible();

    try {
      await query(REVOKE_LOTS_READ);
      await dialog.getByRole("button", { name: "Save batch" }).click();
      await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();
    } finally {
      await query(RESTORE_LOTS_READ);
    }

    expect(await batchCount()).toBe(1);
    const [batch] = await query<{ batch_number: string }>("select batch_number from production_batches");
    // AC-0029: the AC-0018 fields of the batch the engine returned.
    await expect(factValue(f.result, "Batch number")).toHaveText(batch?.batch_number ?? "missing");
    await expect(factValue(f.result, "Product")).toHaveText("502 Smoked Turkey Drums Tom");
    await expect(factValue(f.result, "Production date")).toHaveText("Oct 6, 2026");
    await expect(factValue(f.result, "Raw lbs in")).toHaveText("2,000 lbs");
    await expect(factValue(f.result, "Finished lbs out")).toHaveText("1,540 lbs (from shrink)");
    await expect(factValue(f.result, "Product shrink")).toHaveText("23%");
    await expect(factValue(f.result, "Raw cost")).toHaveText("$3,360.00");
    await expect(factValue(f.result, "Cost per finished lb")).toHaveText("$2.6318/lb");
    // AC-0073: no lots used, finished stock, or before-and-after stock, and the message instead.
    await expect(
      f.result.getByText("The batch was saved, but its lots and stock couldn't be loaded. Reload this page to see them.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(f.result.getByRole("heading", { name: "Lots used" })).toHaveCount(0);
    await expect(f.result.getByRole("heading", { name: "Finished stock added" })).toHaveCount(0);
    await expect(f.result.getByRole("table")).toHaveCount(0);
    await expect(f.result.getByRole("listitem")).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });
});

test.describe("a replayed save request", () => {
  // Saves one batch for real and returns the request it sent, without the
  // operator's cookie, as an attacker would replay it.
  async function capturedSave(page: Page) {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    const captured = page.waitForRequest(
      (request) => request.method() === "POST" && "next-action" in request.headers(),
    );
    await saveThrough(page, f);
    const request = await captured;
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeFocused();
    expect(await batchCount()).toBe(1);
    const headers = await request.allHeaders();
    for (const name of ["cookie", "content-length", "host"]) delete headers[name];
    return { url: request.url(), headers, body: request.postDataBuffer() ?? Buffer.alloc(0) };
  }

  test("AC-0003, AC-0004, AC-0067: with no session or a non-operator's, it writes no batch and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const sent = await capturedSave(page);
    const lots = await lotSnapshot();
    const replays = [
      { who: "no session", storageState: undefined, message: SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: `${NOT_SAVED} ${NOT_ALLOWED}` },
    ];
    for (const { who, storageState, message } of replays) {
      const replay = await playwright.request.newContext({ baseURL, storageState });
      try {
        const response = await replay.post(sent.url, { headers: sent.headers, data: sent.body });
        expect(await response.text(), `response for ${who}`).toContain(message);
      } finally {
        await replay.dispose();
      }
      expect(await batchCount(), `batches after ${who}`).toBe(1);
      expect(await lotSnapshot(), `lots after ${who}`).toEqual(lots);
    }
  });

  test("AC-0069: with an operator session, a date that is not YYYY-MM-DD writes no batch", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const sent = await capturedSave(page);
    const lots = await lotSnapshot();
    // The body is multipart; each field's value follows its name and a blank line.
    const text = sent.body.toString("utf8");
    const withValue = (name: string, value: string) =>
      Buffer.from(text.replace(new RegExp(`(name="[^"]*${name}"\\r\\n\\r\\n)[^\\r]*`), `$1${value}`), "utf8");
    expect(withValue("productionDate", "2026-02-30").equals(sent.body)).toBe(false);
    expect(withValue("today", "2026-02-30").equals(sent.body)).toBe(false);

    const bodies = [
      { which: "a production date of 2026-02-30", data: withValue("productionDate", "2026-02-30") },
      { which: "a production date of 6/10/2026", data: withValue("productionDate", "6/10/2026") },
      { which: "a today of 2026-02-30", data: withValue("today", "2026-02-30") },
      { which: "a today of 10/08/2026", data: withValue("today", "10/08/2026") },
    ];
    for (const { which, data } of bodies) {
      const replay = await playwright.request.newContext({ baseURL, storageState: OPERATOR_STATE });
      try {
        const response = await replay.post(sent.url, { headers: sent.headers, data });
        expect(await response.text(), `response for ${which}`).toContain("Enter the production date.");
      } finally {
        await replay.dispose();
      }
      expect(await batchCount(), `batches after ${which}`).toBe(1);
      expect(await lotSnapshot(), `lots after ${which}`).toEqual(lots);
    }
  });
});

test.describe("messages while the check step is open", () => {
  test("a fixed field shows no old message, aria-invalid, or describedby while the step is open or after Go back", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page);
    await fillBatch(f, { raw: "" });
    await f.save.click();
    await expect(page.locator("#raw-lbs-error")).toHaveText(RAW_FORMAT);
    await expect(f.raw).toHaveAttribute("aria-invalid", "true");

    await f.raw.fill("2000");
    await f.save.click();
    await expect(checkDialog(page)).toBeVisible();
    const cleared = async () => {
      await expect(page.locator("#raw-lbs-error")).toHaveCount(0);
      await expect(f.raw).not.toHaveAttribute("aria-invalid", /.*/);
      await expect(f.raw).not.toHaveAttribute("aria-describedby", /.*/);
    };
    await cleared();
    await checkDialog(page).getByRole("button", { name: "Go back" }).click();
    await expect(checkDialog(page)).toHaveCount(0);
    await cleared();
  });

  test("a save that succeeds clears an earlier refusal banner", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { raw: "6000", date: "2026-10-03" });
    await saveThrough(page, f);
    await expect(f.message).toContainText("Only 5,000 lbs of raw on hand");

    await f.raw.fill("1000");
    await saveThrough(page, f);
    await expect(page.getByRole("heading", { name: "Batch saved" })).toBeVisible();
    await expect(f.message).toHaveText("");
  });

  test("a refusal banner stays while the step is open and after Go back", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { raw: "6000", date: "2026-10-03" });
    await saveThrough(page, f);
    await expect(f.message).toContainText("Only 5,000 lbs of raw on hand");
    const banner = await f.message.innerText();

    await f.raw.fill("1000");
    await f.save.click();
    await expect(checkDialog(page)).toBeVisible();
    await expect(f.message).toHaveText(banner);
    await checkDialog(page).getByRole("button", { name: "Go back" }).click();
    await expect(checkDialog(page)).toHaveCount(0);
    await expect(f.message).toHaveText(banner);
  });

  test("the may-not-have-been-saved warning stays beside a field error, and through the passing Save that follows", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    await dropActionRequests(page);
    await saveThrough(page, f);
    await expect(f.message).toHaveText(BATCH_UNKNOWN);

    await f.raw.fill("abc");
    await f.save.click();
    await expect(page.locator("#raw-lbs-error")).toHaveText("Enter the raw lbs, like 2000 or 32.5.");
    await expect(f.message).toHaveText(BATCH_UNKNOWN);

    await f.raw.fill("2000");
    await f.save.click();
    await expect(checkDialog(page)).toBeVisible();
    await expect(f.message).toHaveText(BATCH_UNKNOWN);
  });

  test("the may-not-have-been-saved warning stays after a passing Save and after Go back", async ({ page }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    await dropActionRequests(page);
    await saveThrough(page, f);
    await expect(f.message).toHaveText(BATCH_UNKNOWN);

    await f.save.click();
    await expect(checkDialog(page)).toBeVisible();
    await expect(f.message).toHaveText(BATCH_UNKNOWN);
    await checkDialog(page).getByRole("button", { name: "Go back" }).click();
    await expect(checkDialog(page)).toHaveCount(0);
    await expect(f.message).toHaveText(BATCH_UNKNOWN);
  });
});

test.describe("the current-page nav link", () => {
  test("each press of Production keeps the product and renders its stock and recent batches again", async ({ page }) => {
    await seed502Fixture();
    await seedBatch(100, "2026-10-07");
    const f = await openForm(page, BATCH_URL);
    await expect(factValue(f.region, "Raw on hand")).toHaveText("7,900 lbs");

    // Stock changes behind the page before each press, so only a fresh render
    // of the region can show the new figure; the page before the press cannot.
    for (const [raw, onHand] of [[100, "7,800 lbs"], [200, "7,600 lbs"]] as const) {
      await seedBatch(raw, "2026-10-07");
      await page.getByRole("link", { name: "Production", exact: true }).click();
      await expect(factValue(f.region, "Raw on hand")).toHaveText(onHand);
      await expect(f.code).toHaveValue(CODE);
      await expect(f.region.getByRole("heading", { name: "Recent batches" })).toBeVisible();
      await expect(page).toHaveURL(/\/production\?product=502$/);
    }
  });

  test("a press while the first region request is still loading still renders the region", async ({ page }) => {
    await seed502Fixture();
    await seedBatch(100, "2026-10-07");
    const f = await openForm(page, BATCH_URL);
    await expect(factValue(f.region, "Raw on hand")).toHaveText("7,900 lbs");
    // Every region request for this product is held until both presses are done,
    // so the second press lands while the first request is still loading.
    const held: Route[] = [];
    await page.route(/product=502/, async (route) => {
      if (route.request().resourceType() === "fetch") held.push(route);
      else await route.continue();
    });
    await seedBatch(100, "2026-10-07");
    const link = page.getByRole("link", { name: "Production", exact: true });
    await link.click();
    await expect.poll(() => held.length).toBe(1);
    await link.click();
    // The newer navigation drops the first request, so the second press must ask again.
    await expect.poll(() => held.length).toBe(2);
    await page.unroute(/product=502/);
    for (const route of held) await route.continue().catch(() => undefined);
    await expect(factValue(f.region, "Raw on hand")).toHaveText("7,800 lbs");
    await expect(page).toHaveURL(/\/production\?product=502$/);
  });

  test("a late region answer for another code still ends with the field's product shown", async ({ page }) => {
    await seed502Fixture();
    await query("insert into products(code, description, species, kind, raw_product_id, shrink_pct) values ('503', 'Smoked Turkey Necks', 'Turkey', 'finished', $1, 0.2)", [RAW_TOM_ID]);
    const f = await openForm(page, BATCH_URL);
    await expect(factValue(f.region, "Raw on hand")).toHaveText("8,000 lbs");
    // The other code's region answer is held until the field holds 502 again.
    const held: Route[] = [];
    await page.route(/product=503/, async (route) => {
      if (route.request().resourceType() === "fetch") held.push(route);
      else await route.continue();
    });
    await f.code.fill("503");
    await expect.poll(() => held.length).toBe(1);
    await f.code.fill("502");
    // Stock changes behind the page, so only a fresh render of this product's
    // region can show the new figure; the page before the answer landed cannot.
    await seedBatch(100, "2026-10-07");
    await page.unroute(/product=503/);
    for (const route of held) await route.continue().catch(() => undefined);
    await expect(factValue(f.region, "Raw on hand")).toHaveText("7,900 lbs");
    await expect(page).toHaveURL(/\/production\?product=502$/);
  });
});
