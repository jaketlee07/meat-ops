import { expect, test, type Locator } from "@playwright/test";
import {
  adjustCall,
  callAsOperator,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  resetTestData,
  voidReceiptCall,
} from "../db";
import { resolveStackEnv } from "../env";
import { OPERATOR_EMAIL } from "../users";
import { checkPageState } from "./a11y";
import {
  beforeAfter,
  CODE,
  deviceDate,
  dropActionRequests,
  factValue,
  fillReceipt,
  FORM_CONTROLS,
  type Fields,
  lotCount,
  lotNumberOf,
  lotState,
  NOT_SAVED,
  NOT_VOIDED,
  openForm,
  RAW_TOM_URL,
  readValues,
  receiptItem,
  SAVE_UNKNOWN,
  seedReceipt,
  sendsActionRequest,
  SIGNED_OUT,
  VENDOR,
  VOID_SIGNED_OUT,
  VOID_UNKNOWN,
  voidButton,
  voidDialog,
  voidMarks,
  voidThrough,
} from "./receiving-page";
import { isAuthCookie, readSession, withExpiredAccessToken } from "./session";
import { OPERATOR_STATE, signInThroughForm } from "./states";

// The receiving form, end to end: a real browser over the production build and
// the local database. Raw tables are read through pg to show what was or was
// not written.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

test.describe("the form", () => {
  test("AC-0007: a product code shows its description, species, and stock", async ({ page }) => {
    await seedReceipt(5000, 1.68);
    const f = await openForm(page);
    await expect(page.getByText("Type a product code to start.")).toBeVisible();
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);

    await f.code.fill(CODE);
    await expect(page.getByText("Turkey Drums TOM (raw) · Turkey")).toBeVisible();
    await expect(page).toHaveURL(/\/receiving\?product=RAW-TOM$/);
    await expect(factValue(f.region, "On hand")).toHaveText("5,000 lbs");
    await expect(factValue(f.region, "Average cost")).toHaveText("$1.6800/lb");
    await expect(factValue(f.region, "502 Smoked Turkey Drums Tom")).toHaveText("$2.68/lb");
  });

  test("AC-0067: a product with no receipt shows 0 lbs, None yet, and No price yet", async ({ page }) => {
    const f = await openForm(page);
    await f.code.fill(CODE);
    await expect(factValue(f.region, "On hand")).toHaveText("0 lbs");
    await expect(factValue(f.region, "Average cost")).toHaveText("None yet");
    await expect(factValue(f.region, "502 Smoked Turkey Drums Tom")).toHaveText("No price yet");
  });

  test("AC-0007: a product made active after the page loaded shows its description once a save has re-rendered the page", async ({
    page,
  }) => {
    await query(
      "insert into products(code, description, species, kind, active) values ('RAW-LATE', 'Late raw product', 'Pork', 'raw', false)",
    );
    const f = await openForm(page);
    await query("update products set active = true where code = 'RAW-LATE'");

    // The page's product list predates the change, so the code shows no description.
    await f.code.fill("RAW-LATE");
    await expect(f.code).toHaveValue("RAW-LATE");
    await expect(page.getByText("Late raw product · Pork")).toHaveCount(0);

    // A save re-renders the page, which reads the products again.
    await fillReceipt(f, {});
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();

    await f.code.fill("RAW-LATE");
    await expect(page.getByText("Late raw product · Pork")).toBeVisible();
    await expect(factValue(f.region, "On hand")).toHaveText("0 lbs");
    await expect(factValue(f.region, "Average cost")).toHaveText("None yet");
  });

  test("the product region is busy while a product loads", async ({ page }) => {
    await seedReceipt(5000, 1.68);
    const f = await openForm(page);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/receiving\?product=/, async (route) => {
      await gate;
      await route.continue();
    });

    await f.code.fill(CODE);
    await expect(f.region).toHaveAttribute("aria-busy", "true");
    release();
    await expect(factValue(f.region, "On hand")).toHaveText("5,000 lbs");
    await expect(f.region).toHaveAttribute("aria-busy", "false");
  });

  test("the first-run state says what is missing, and Save is aria-disabled", async ({ page }) => {
    await query("delete from vendors");
    const f = await openForm(page);
    await expect(page.getByText("No vendors yet. Add one in Supabase Studio, then reload this page.")).toBeVisible();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
    await f.save.click({ force: true });
    await expect(f.result).toBeEmpty();
    expect(await lotCount()).toBe(0);
  });

  test("the first-run state with no active raw product says to reload, and Save stays aria-disabled until it does", async ({
    page,
  }) => {
    await query("update products set active = false where kind = 'raw'");
    const f = await openForm(page);
    await expect(
      page.getByText("No active raw products yet. Add one in Supabase Studio, then reload this page."),
    ).toBeVisible();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");

    // A product made active now does not unblock a page that loaded without one.
    // The filled form is valid and its code is marked for a server check, so only
    // the aria-disabled block keeps the forced click from sending a save.
    await query("update products set active = true where id = $1", [RAW_TOM_ID]);
    await fillReceipt(f, {});
    const sent = sendsActionRequest(page);
    await f.save.click({ force: true });
    await expect(f.result).toBeEmpty();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    expect(await sent, "a save request left the page").toBe(false);
    expect(await lotCount()).toBe(0);

    await page.reload();
    await expect(f.save).not.toHaveAttribute("aria-disabled", "true");
  });

  test("AC-0008: vendors are listed by name, alphabetical ignoring case", async ({ page }) => {
    await query("insert into vendors(name) values ('acme'), ('Bayside')");
    const f = await openForm(page);
    await expect(f.vendor.locator("option")).toHaveText(["Choose a vendor", "acme", "Bayside", VENDOR]);
  });

  test.describe("in a time zone far from UTC", () => {
    test.use({ timezoneId: "Pacific/Auckland" });

    test("AC-0009: the received date starts at today on the device, not the UTC date", async ({ page }) => {
      // 03:00 on Jan 15 in Auckland (UTC+13) is 14:00 on Jan 14 in UTC. With the
      // clock pinned there, a default taken from the UTC date is a day behind at
      // any hour of the real day.
      const pinned = new Date("2026-01-14T14:00:00Z");
      expect(pinned.toISOString().slice(0, 10)).toBe("2026-01-14");
      await page.clock.install({ time: pinned });

      const f = await openForm(page);
      expect(await deviceDate(page)).toBe("2026-01-15");
      await expect(f.date).toHaveValue("2026-01-15");
      await expect(f.date).toHaveAttribute("max", "2026-01-15");
    });

    test("AC-0010 and AC-0011 across midnight: a form loaded at 23:59 saves a receipt dated the new day", async ({
      page,
    }) => {
      // 23:59 on Jan 14 in Auckland (UTC+13).
      await page.clock.install({ time: new Date("2026-01-14T10:59:00Z") });
      const f = await openForm(page);
      await expect(f.date).toHaveValue("2026-01-14");
      await fillReceipt(f, {});

      // Two minutes pass, to 00:01 on Jan 15. The form was loaded the day before.
      await page.clock.fastForward(120_000);
      expect(await deviceDate(page)).toBe("2026-01-15");
      await f.date.fill("2026-01-15");
      await f.save.click();

      await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
      await expect(f.date).toHaveAttribute("max", "2026-01-15");
      const lots = await query<{ date: string }>("select received_date::text as date from lots");
      expect(lots).toEqual([{ date: "2026-01-15" }]);
    });
  });

  test("AC-0029: the weight field's name has lbs and the cost field's has per lb", async ({ page }) => {
    await openForm(page);
    await expect(page.getByRole("textbox", { name: /lbs/ })).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: /per lb/ })).toHaveCount(1);
  });
});

// Each row of the AC-0010 table: the field, the input, and the message beside it.
type FieldKey = "code" | "vendor" | "weight" | "cost" | "date" | "notes";
const FIELD_ID: Record<FieldKey, string> = {
  code: "product-code",
  vendor: "vendor",
  weight: "weight",
  cost: "cost",
  date: "received-date",
  notes: "notes",
};
const WEIGHT_FORMAT = "Enter the weight in lbs, like 5000 or 32.5.";
const WEIGHT_PLACES = "Use at most 3 decimal places for weight.";
const COST_FORMAT = "Enter the cost per lb, like 1.68.";
const RULES: Array<[FieldKey, string, string]> = [
  ["code", "", "Enter a product code."],
  ["code", "502", "No active raw product has code 502."],
  ["code", "RAW-OLD", "No active raw product has code RAW-OLD."],
  ["vendor", "", "Choose a vendor."],
  ["weight", "", WEIGHT_FORMAT],
  ["weight", "5,000", WEIGHT_FORMAT],
  ["weight", "-5", WEIGHT_FORMAT],
  ["weight", "1.2345", WEIGHT_PLACES],
  ["weight", "0.0000", WEIGHT_PLACES],
  ["weight", "0", "Weight must be above 0."],
  ["weight", "0.0", "Weight must be above 0."],
  ["weight", "000", "Weight must be above 0."],
  ["cost", "", COST_FORMAT],
  ["cost", "-1", COST_FORMAT],
  ["cost", "1.68555", "Use at most 4 decimal places for cost."],
  ["date", "", "Enter the received date."],
  ["date", "TOMORROW", "The received date can't be after today."],
  ["notes", "x".repeat(501), "Keep notes to 500 characters or fewer."],
];

test.describe("refused forms", () => {
  for (const [field, input, message] of RULES) {
    test(`AC-0010: ${field} ${JSON.stringify(input.slice(0, 12))} is refused beside its field`, async ({ page }) => {
      await query(
        "insert into products(code, description, kind, active) values ('RAW-OLD', 'Old raw product', 'raw', false)",
      );
      const f = await openForm(page);
      await fillReceipt(f, {});
      const control = f[field];
      if (field === "vendor") await f.vendor.selectOption({ label: "Choose a vendor" });
      else if (field === "date") await f.date.fill(input === "TOMORROW" ? await deviceDate(page, 1) : input);
      else await control.fill(input);
      const typed = await readValues(f);

      await f.save.click();

      const id = FIELD_ID[field];
      // AC-0010: the message is beside the field, and AC-0056: the field points to it.
      await expect(page.locator(`#${id}-error`)).toHaveText(message);
      await expect(control).toHaveAttribute("aria-describedby", `${id}-error`);
      // AC-0028: focus is on the field with the error.
      await expect(control).toBeFocused();
      // AC-0046: every field keeps its value, and nothing is written.
      expect(await readValues(f)).toEqual(typed);
      expect(await lotCount()).toBe(0);
    });
  }

  test("AC-0028 and AC-0056: with several errors, focus is on the first field and each points to its message", async ({
    page,
  }) => {
    const f = await openForm(page);
    await f.save.click();

    const expected: Array<[Locator, string, string]> = [
      [f.code, "product-code", "Enter a product code."],
      [f.vendor, "vendor", "Choose a vendor."],
      [f.weight, "weight", WEIGHT_FORMAT],
      [f.cost, "cost", COST_FORMAT],
    ];
    for (const [control, id, message] of expected) {
      await expect(control).toHaveAttribute("aria-describedby", `${id}-error`);
      await expect(page.locator(`#${id}-error`)).toHaveText(message);
    }
    await expect(f.code).toBeFocused();
    await expect(f.date).not.toHaveAttribute("aria-invalid", "true");
    await expect(f.notes).not.toHaveAttribute("aria-invalid", "true");
    expect(await lotCount()).toBe(0);
  });

  test("AC-0010, AC-0028, and AC-0078: a code missing from the page's list beside a blank weight shows both messages on the first Save", async ({
    page,
  }) => {
    const f = await openForm(page);
    await fillReceipt(f, { code: "RAW-NOPE", weight: "" });
    await f.save.click();

    // The code is not in the page's list, so the server runs every rule on the
    // whole form and returns every field error together.
    await expect(page.locator("#product-code-error")).toHaveText("No active raw product has code RAW-NOPE.");
    await expect(page.locator("#weight-error")).toHaveText(WEIGHT_FORMAT);
    await expect(f.code).toHaveAttribute("aria-describedby", "product-code-error");
    await expect(f.code).toBeFocused();
    expect(await lotCount()).toBe(0);
  });

  test("the form after an AC-0010 refusal of a blank weight meets the page-state checks", async ({ page }) => {
    const f = await openForm(page);
    await fillReceipt(f, { weight: "" });
    await f.save.click();
    await expect(page.locator("#weight-error")).toHaveText(WEIGHT_FORMAT);
    await expect(f.weight).toBeFocused();
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });
});

test.describe("saving", () => {
  test("AC-0011: boundary values save", async ({ page }) => {
    const f = await openForm(page);
    const today = await f.date.inputValue();
    await fillReceipt(f, { weight: "0.001", cost: "0" });
    await f.notes.fill("n".repeat(500));
    await f.save.click();
    await expect(page.getByRole("heading", { name: "Receipt saved" })).toBeFocused();

    await fillReceipt(f, { weight: "32.125", cost: "1.6855" });
    await f.save.click();
    await expect(f.weight).toHaveValue("");

    const lots = await query<{ weight: number; cost: number; date: string; note_length: number | null }>(
      `select weight_lbs::float8 as weight, unit_cost::float8 as cost, received_date::text as date,
              length(notes) as note_length
       from lots order by receipt_seq`,
    );
    expect(lots).toEqual([
      { weight: 0.001, cost: 0, date: today, note_length: 500 },
      { weight: 32.125, cost: 1.6855, date: today, note_length: null },
    ]);
  });

  test("AC-0012, AC-0013, AC-0015, AC-0017, AC-0055: a save shows the lot and its before and after", async ({
    page,
  }) => {
    await seedReceipt(5000, 1.68);
    const f = await openForm(page, `/receiving?product=${CODE}`);
    await fillReceipt(f, { weight: "3000", cost: "1.80" });
    await f.date.fill("2026-05-13");
    await f.notes.fill("second truck");
    await f.save.click();

    // AC-0055: focus is on the heading, inside the status region.
    const heading = f.result.getByRole("heading", { name: "Receipt saved" });
    await expect(heading).toBeFocused();

    // AC-0012: the lot the engine wrote.
    const [lot] = await query<{ lot_number: string }>(
      "select lot_number from lots order by receipt_seq desc limit 1",
    );
    await expect(factValue(f.result, "Lot number")).toHaveText(lot?.lot_number ?? "missing");
    await expect(factValue(f.result, "Product")).toHaveText("RAW-TOM Turkey Drums TOM (raw)");
    await expect(factValue(f.result, "Vendor")).toHaveText(VENDOR);
    await expect(factValue(f.result, "Received")).toHaveText("May 13, 2026");
    await expect(factValue(f.result, "Weight")).toHaveText("3,000 lbs");
    await expect(factValue(f.result, "Cost per lb")).toHaveText("$1.8000/lb");

    // AC-0013 and AC-0015: values the database held before and after.
    await expect(beforeAfter(f.result, /^On hand/)).toHaveText(["5,000 lbs", "8,000 lbs"]);
    await expect(beforeAfter(f.result, /^Average cost/)).toHaveText(["$1.6800/lb", "$1.7250/lb"]);
    await expect(beforeAfter(f.result, /^502 Smoked Turkey Drums Tom/)).toHaveText(["$2.68/lb", "$2.74/lb"]);

    // The stock region re-renders from the database after the save.
    await expect(factValue(f.region, "On hand")).toHaveText("8,000 lbs");

    // AC-0017: product, vendor, and date stay; weight, cost, and notes empty.
    await expect(f.code).toHaveValue(CODE);
    await expect(f.vendor.locator("option:checked")).toHaveText(VENDOR);
    await expect(f.date).toHaveValue("2026-05-13");
    await expect(f.weight).toHaveValue("");
    await expect(f.cost).toHaveValue("");
    await expect(f.notes).toHaveValue("");

    // Both receipts are untouched, so the list adds a Void button for each.
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Void", "button Void"]);
  });

  test("AC-0014 and AC-0067: a first receipt shows 0 lbs, None yet, and No price yet before", async ({ page }) => {
    const f = await openForm(page);
    await fillReceipt(f, {});
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();

    await expect(beforeAfter(f.result, /^On hand/)).toHaveText(["0 lbs", "5,000 lbs"]);
    await expect(beforeAfter(f.result, /^Average cost/)).toHaveText(["None yet", "$1.6800/lb"]);
    await expect(beforeAfter(f.result, /^502 Smoked Turkey Drums Tom/)).toHaveText(["No price yet", "$2.68/lb"]);
  });

  test("AC-0016: a raw product with no finished product says so", async ({ page }) => {
    await query(
      "insert into products(code, description, species, kind) values ('RAW-PORK', 'Pork Shoulder (raw)', 'Pork', 'raw')",
    );
    const f = await openForm(page);
    await fillReceipt(f, { code: "RAW-PORK", weight: "100", cost: "2" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
    await expect(f.result.getByText("No finished products are made from this raw product.")).toBeVisible();
    await expect(beforeAfter(f.result, /^On hand/)).toHaveText(["0 lbs", "100 lbs"]);
  });

  test("AC-0078: codes that became active or were added after the page loaded save without a reload", async ({
    page,
  }) => {
    await query(
      "insert into products(code, description, species, kind, active) values ('RAW-LATE', 'Late raw product', 'Pork', 'raw', false)",
    );
    const f = await openForm(page);

    // Set active after the page loaded: not in the page's product list.
    await query("update products set active = true where code = 'RAW-LATE'");
    await fillReceipt(f, { code: "RAW-LATE", weight: "100", cost: "2" });
    await f.save.click();
    await expect(factValue(f.result, "Product")).toHaveText("RAW-LATE Late raw product");

    // AC-0020: the page follows the saved code, so its region lists the saved lot.
    await expect(page).toHaveURL(/\/receiving\?product=RAW-LATE$/);
    await expect(receiptItem(page, await factValue(f.result, "Lot number").innerText())).toBeVisible();
    await expect(factValue(f.region, "On hand")).toHaveText("100 lbs");

    // Inserted after the save re-rendered the page, so it is not in the list either.
    await query(
      "insert into products(code, description, species, kind) values ('RAW-NEW', 'New raw product', 'Beef', 'raw')",
    );
    await fillReceipt(f, { code: "RAW-NEW", weight: "200", cost: "3" });
    await f.save.click();
    await expect(factValue(f.result, "Product")).toHaveText("RAW-NEW New raw product");
    await expect(page).toHaveURL(/\/receiving\?product=RAW-NEW$/);
    await expect(receiptItem(page, await factValue(f.result, "Lot number").innerText())).toBeVisible();
    await expect(factValue(f.region, "On hand")).toHaveText("200 lbs");

    const written = await query<{ code: string; lots: number }>(
      `select p.code, count(*)::int as lots
       from lots l join products p on p.id = l.product_id
       group by p.code order by p.code`,
    );
    expect(written).toEqual([
      { code: "RAW-LATE", lots: 1 },
      { code: "RAW-NEW", lots: 1 },
    ]);
  });

  test("AC-0026 with long numbers: the after-save state fits 320 px with over 100,000 lbs on hand", async ({
    page,
  }) => {
    await seedReceipt(100000.125, 1.68);
    const f = await openForm(page, RAW_TOM_URL);
    await fillReceipt(f, { weight: "200000.25", cost: "1.80" });
    await f.save.click();

    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
    await expect(beforeAfter(f.result, /^On hand/)).toHaveText(["100,000.125 lbs", "300,000.375 lbs"]);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Void", "button Void"]);
  });

  test("AC-0018: pressing Save again while a save is pending writes no second lot", async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = 0;
    await page.route("**/receiving**", async (route) => {
      if (route.request().method() === "POST") {
        held += 1;
        await gate;
      }
      await route.continue();
    });

    const f = await openForm(page, `/receiving?product=${CODE}`);
    await fillReceipt(f, {});
    await f.save.click();
    await expect(f.save).toBeDisabled();
    await f.save.click({ force: true });
    await f.weight.press("Enter");
    release();

    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
    expect(held).toBe(1);
    expect(await lotCount()).toBe(1);
  });

  test("AC-0027: a receipt is completed and saved with the keyboard alone", async ({ page }) => {
    const f = await openForm(page);
    const tabTo = async (target: Locator) => {
      for (let press = 0; press < 12; press++) {
        await page.keyboard.press("Tab");
        if (await target.evaluate((element) => element === document.activeElement)) return;
      }
      throw new Error("Tab did not reach the control");
    };

    await tabTo(f.code);
    await page.keyboard.type(CODE);
    await tabTo(f.vendor);
    await page.keyboard.type("Reyes");
    await tabTo(f.weight);
    await page.keyboard.type("250");
    await tabTo(f.cost);
    await page.keyboard.type("1.5");
    await tabTo(f.save);
    await page.keyboard.press("Enter");

    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
    const lots = await query<{ weight: number; cost: number }>(
      "select weight_lbs::float8 as weight, unit_cost::float8 as cost from lots",
    );
    expect(lots).toEqual([{ weight: 250, cost: 1.5 }]);
  });
});

test.describe("refusals after the rules pass", () => {
  // Fills every field, so a refusal that keeps them all is visible.
  async function fillAll(f: Fields, weight = "700", cost = "1.9"): Promise<Record<string, string>> {
    await fillReceipt(f, { weight, cost });
    await f.date.fill("2026-05-13");
    await f.notes.fill("kept note");
    return readValues(f);
  }

  test("AC-0019, AC-0046, and AC-0057: a product made inactive after the page loaded is refused", async ({
    page,
  }) => {
    const f = await openForm(page, `/receiving?product=${CODE}`);
    const typed = await fillAll(f);
    await query("update products set active = false where id = $1", [RAW_TOM_ID]);
    await f.save.click();

    await expect(f.message).toHaveText(`${NOT_SAVED} This product is no longer active.`);
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0019 and AC-0046: any other refusal from the database shows its own reason", async ({ page }) => {
    const f = await openForm(page, `/receiving?product=${CODE}`);
    const typed = await fillAll(f);
    await query("delete from vendors");
    await f.save.click();

    await expect(f.message).toHaveText(/^The receipt wasn't saved\. invalid vendor [0-9a-f-]{36}$/);
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    expect(await lotCount()).toBe(0);
  });

  test("AC-0042, AC-0046, and AC-0057: a session that ended after the form loaded keeps the form", async ({
    page,
  }) => {
    const f = await openForm(page, `/receiving?product=${CODE}`);
    const typed = await fillAll(f);
    await page.context().clearCookies();
    await f.save.click();

    await expect(f.message).toHaveText(SIGNED_OUT);
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0042 and AC-0046: an expired access token refreshes and saves, and a revoked session keeps the form", async ({
    browser,
    baseURL,
  }) => {
    // A session of its own, so the saved operator session that later tests
    // reuse is untouched. It is never saved under test/e2e/.auth/.
    const context = await browser.newContext({ baseURL });
    const sessionCookies = async () => (await context.cookies()).filter(isAuthCookie);
    try {
      const page = await context.newPage();
      await signInThroughForm(page, OPERATOR_EMAIL);
      const f = await openForm(page, `/receiving?product=${CODE}`);

      // The access token expired while the form was open. The proxy refreshes
      // it ahead of the action, so the action sees the new session and saves.
      await context.addCookies(withExpiredAccessToken(await sessionCookies()));
      await fillAll(f);
      await f.save.click();
      await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
      expect(await lotCount()).toBe(1);

      // End the session at the auth server, then age the access token so the
      // proxy has to refresh it, and the refresh is refused.
      const cookies = await sessionCookies();
      const stack = resolveStackEnv();
      const revoked = await fetch(`${stack.apiUrl}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: { apikey: stack.anonKey, authorization: `Bearer ${readSession(cookies).access_token}` },
      });
      expect(revoked.status).toBe(204);
      await context.addCookies(withExpiredAccessToken(cookies));

      const typed = await fillAll(f, "800", "2");
      await f.save.click();
      await expect(f.message).toHaveText(SIGNED_OUT);
      await expect(f.message).toBeFocused();
      expect(await readValues(f)).toEqual(typed);
      expect(await lotCount()).toBe(1);
    } finally {
      await context.close();
    }
  });

  test("AC-0071, AC-0081, and AC-0057: a save whose connection drops keeps the form and says it may not have been saved", async ({
    page,
  }) => {
    const f = await openForm(page, `/receiving?product=${CODE}`);
    const typed = await fillAll(f);
    const dropped = await dropActionRequests(page);
    await f.save.click();

    await expect(f.message).toHaveText(SAVE_UNKNOWN);
    await expect(f.message).toBeFocused();
    // The save request never reached the server, and every field keeps its value.
    expect(dropped.count).toBe(1);
    expect(await readValues(f)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    await expect(f.save).toBeEnabled();
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });
});

// Receipts of RAW-TOM entered out of date order, so entry order and date order disagree.
const ENTRY_DAYS = [21, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

test.describe("recent receipts", () => {
  test("AC-0020 and AC-0048: the 10 most recently entered receipts, newest entry first, and the count", async ({
    page,
  }) => {
    const ids: string[] = [];
    for (const day of ENTRY_DAYS) ids.push(await seedReceipt(100, 1.68, `2026-05-${day}`));
    // The first receipt entered is void. It falls outside the 10, and it still counts.
    const [first] = ids;
    expect((await callAsOperator(voidReceiptCall(first ?? ""))).ok).toBe(true);

    const f = await openForm(page, RAW_TOM_URL);
    await expect(f.region.getByRole("listitem")).toHaveCount(10);
    await expect(factValue(f.region, "Received")).toHaveText(
      [20, 19, 18, 17, 16, 15, 14, 13, 12, 11].map((day) => `May ${day}, 2026`),
    );
    await expect(f.region.getByText("Showing the 10 most recent of 12 receipts.", { exact: true })).toBeVisible();
  });

  test("AC-0048: with 10 receipts or fewer there is no count line", async ({ page }) => {
    for (const day of ENTRY_DAYS.slice(0, 10)) await seedReceipt(100, 1.68, `2026-05-${day}`);
    const f = await openForm(page, RAW_TOM_URL);
    await expect(f.region.getByRole("listitem")).toHaveCount(10);
    await expect(f.region.getByText(/^Showing the/)).toHaveCount(0);

    await seedReceipt(100, 1.68, "2026-05-22");
    await page.reload();
    await expect(f.region.getByText("Showing the 10 most recent of 11 receipts.", { exact: true })).toBeVisible();
  });

  test("AC-0047: each receipt shows its lot number, date, vendor, weight, cost, and remaining lbs", async ({
    page,
  }) => {
    const id = await seedReceipt(2000, 1.725, "2026-04-03");
    expect((await callAsOperator(produceCall(PROD_502_ID, 500))).ok).toBe(true);
    const lotNumber = await lotNumberOf(id);

    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);
    await expect(factValue(item, "Lot number")).toHaveText(lotNumber);
    await expect(factValue(item, "Received")).toHaveText("Apr 3, 2026");
    await expect(factValue(item, "Vendor")).toHaveText(VENDOR);
    await expect(factValue(item, "Weight")).toHaveText("2,000 lbs");
    await expect(factValue(item, "Cost per lb")).toHaveText("$1.7250/lb");
    await expect(factValue(item, "Remaining")).toHaveText("1,500 lbs");
  });

  test("AC-0049: a product with no receipts says so", async ({ page }) => {
    const f = await openForm(page, RAW_TOM_URL);
    await expect(f.region.getByText("No receipts for this product yet.", { exact: true })).toBeVisible();
    await expect(f.region.getByRole("listitem")).toHaveCount(0);
  });

  test("AC-0021: Void on untouched receipts, the reason on void ones, In use on the rest", async ({ page }) => {
    // The T4 fixture: one production drew from, one adjusted down and back to
    // its full weight, one void, and one untouched.
    const consumed = await seedReceipt(1000, 1.68, "2026-05-01");
    const adjusted = await seedReceipt(1000, 1.68, "2026-05-02");
    const voided = await seedReceipt(1000, 1.68, "2026-05-03");
    const untouched = await seedReceipt(1000, 1.68, "2026-05-04");
    expect((await callAsOperator(produceCall(PROD_502_ID, 500))).ok).toBe(true);
    expect((await callAsOperator(adjustCall(adjusted, 900))).ok).toBe(true);
    expect((await callAsOperator(adjustCall(adjusted, 1000))).ok).toBe(true);
    expect((await callAsOperator(voidReceiptCall(voided, "entered twice"))).ok).toBe(true);

    await openForm(page, RAW_TOM_URL);
    const item = async (id: string) => receiptItem(page, await lotNumberOf(id));

    const untouchedItem = await item(untouched);
    await expect(voidButton(untouchedItem)).toBeVisible();
    await expect(untouchedItem.getByText("In use")).toHaveCount(0);
    await expect(untouchedItem.getByText(/^Void: /)).toHaveCount(0);

    for (const id of [consumed, adjusted]) {
      const inUse = await item(id);
      await expect(inUse.getByText("In use", { exact: true })).toBeVisible();
      await expect(voidButton(inUse)).toHaveCount(0);
      await expect(inUse.getByText(/^Void: /)).toHaveCount(0);
    }

    const voidItem = await item(voided);
    await expect(voidItem.getByText("Void: entered twice", { exact: true })).toBeVisible();
    await expect(voidButton(voidItem)).toHaveCount(0);
    await expect(voidItem.getByText("In use")).toHaveCount(0);

    // Four receipts at phone width: no sideways scroll, and one Void button to reach.
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Void"]);
  });
});

test.describe("the void confirmation", () => {
  test("AC-0022: Void opens a confirmation that names the lot, weight, and vendor and asks for a reason", async ({
    page,
  }) => {
    const lotNumber = await lotNumberOf(await seedReceipt(1000, 1.68));
    await openForm(page, RAW_TOM_URL);
    await voidButton(receiptItem(page, lotNumber)).click();

    const dialog = voidDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Lot ${lotNumber}, 1,000 lbs, from ${VENDOR}.`);
    const reason = dialog.getByLabel("Reason for the void");
    await expect(reason).toBeVisible();

    // Cancel is the first stop and holds focus on open, so Tab reaches the reason next.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(reason).toBeFocused();

    expect(await checkPageState(page)).toEqual(["button Cancel", "textarea reason", "button Void receipt"]);
  });

  test("AC-0079: the open confirmation's accessible description holds the lot number, weight, and vendor", async ({
    page,
  }) => {
    const lotNumber = await lotNumberOf(await seedReceipt(1000, 1.68));
    await openForm(page, RAW_TOM_URL);
    await voidButton(receiptItem(page, lotNumber)).click();

    await expect(voidDialog(page)).toHaveAccessibleDescription(
      new RegExp(`Lot ${lotNumber}, 1,000 lbs, from ${VENDOR}\\.`),
    );
  });

  test("AC-0050: Cancel and Escape close the confirmation and change nothing", async ({ page }) => {
    const id = await seedReceipt(1000, 1.68);
    const before = await lotState(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, await lotNumberOf(id));
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });

    const dialog = voidDialog(page);
    const reason = dialog.getByLabel("Reason for the void");
    await voidButton(item).click();
    await reason.fill("typed by mistake");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(voidButton(item)).toBeFocused();

    // Reopening starts with an empty reason, and Escape closes it the same way.
    await voidButton(item).click();
    await expect(reason).toHaveValue("");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(voidButton(item)).toBeFocused();

    expect(posts).toEqual([]);
    expect(await voidMarks()).toBe(0);
    expect(await lotState(id)).toEqual(before);
    await expect(item.getByText(/^Void: /)).toHaveCount(0);
  });

  test("AC-0051: a blank or spaces-only reason shows its message and changes nothing", async ({ page }) => {
    const id = await seedReceipt(1000, 1.68);
    const before = await lotState(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, await lotNumberOf(id));
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });

    const dialog = voidDialog(page);
    const reason = dialog.getByLabel("Reason for the void");
    const confirm = dialog.getByRole("button", { name: "Void receipt" });
    await voidButton(item).click();
    for (const blank of ["", "   "]) {
      await reason.fill(blank);
      await confirm.click();
      const message = dialog.getByText("Enter a reason for the void.", { exact: true });
      await expect(message).toBeVisible();
      // The confirmation stays open, the field holds focus and points to the message.
      await expect(reason).toBeFocused();
      await expect(reason).toHaveAttribute("aria-describedby", (await message.getAttribute("id")) ?? "missing");
    }

    expect(posts).toEqual([]);
    expect(await voidMarks()).toBe(0);
    expect(await lotState(id)).toEqual(before);
  });
});

test.describe("voiding", () => {
  test("AC-0023: voiding the second receipt shows it as void and the first receipt's stock and average", async ({
    page,
  }) => {
    const first = await seedReceipt(1000, 1.68, "2026-05-12");
    const second = await seedReceipt(500, 1.8, "2026-05-13");
    const f = await openForm(page, RAW_TOM_URL);
    await expect(factValue(f.region, "On hand")).toHaveText("1,500 lbs");

    const item = receiptItem(page, await lotNumberOf(second));
    await voidThrough(page, item, "keyed twice");

    await expect(item.getByText("Void: keyed twice", { exact: true })).toBeVisible();
    await expect(voidButton(item)).toHaveCount(0);
    await expect(factValue(f.region, "On hand")).toHaveText("1,000 lbs");
    await expect(factValue(f.region, "Average cost")).toHaveText("$1.6800/lb");
    await expect(factValue(f.region, "502 Smoked Turkey Drums Tom")).toHaveText("$2.68/lb");

    // The first receipt is untouched by the void, and focus moved to the list.
    const firstItem = receiptItem(page, await lotNumberOf(first));
    await expect(voidButton(firstItem)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent receipts" })).toBeFocused();
    expect(await lotState(second)).toEqual({ remaining: 0, voided: true, reason: "keyed twice" });
    expect(await lotState(first)).toEqual({ remaining: 1000, voided: false, reason: null });
    expect(await voidMarks()).toBe(1);
  });

  test("AC-0076: voiding the saved receipt from the list marks the panel voided and drops its totals", async ({
    page,
  }) => {
    await query(
      "insert into products(code, description, kind) values ('RAW-PORK', 'Pork Shoulder (raw)', 'raw')",
    );
    const f = await openForm(page, RAW_TOM_URL);
    await fillReceipt(f, { weight: "1000", cost: "1.68" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
    await expect(beforeAfter(f.result, /^On hand/)).toHaveText(["0 lbs", "1,000 lbs"]);

    const lotNumber = (await factValue(f.result, "Lot number").textContent()) ?? "missing";
    await voidThrough(page, receiptItem(page, lotNumber), "wrong product");

    const voided = f.result.getByText("This receipt was voided.", { exact: true });
    await expect(voided).toBeVisible();
    await expect(f.result.getByRole("table")).toHaveCount(0);
    await expect(f.result.getByText("Before")).toHaveCount(0);
    await expect(factValue(f.result, "Lot number")).toHaveText(lotNumber);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);

    // Choosing another product swaps the list, and the panel still says so.
    await f.code.fill("RAW-PORK");
    await expect(factValue(f.region, "On hand")).toHaveText("0 lbs");
    await expect(voided).toBeVisible();
    await expect(f.result.getByRole("table")).toHaveCount(0);
  });

  test("AC-0053 and AC-0067: voiding the only receipt shows 0 lbs, None yet, and No price yet", async ({ page }) => {
    const id = await seedReceipt(5000, 1.68);
    const f = await openForm(page, RAW_TOM_URL);
    await expect(factValue(f.region, "Average cost")).toHaveText("$1.6800/lb");

    await voidThrough(page, receiptItem(page, await lotNumberOf(id)), "wrong product");

    await expect(factValue(f.region, "On hand")).toHaveText("0 lbs");
    await expect(factValue(f.region, "Average cost")).toHaveText("None yet");
    await expect(factValue(f.region, "502 Smoked Turkey Drums Tom")).toHaveText("No price yet");
    await expect(f.region.getByText("Void: wrong product", { exact: true })).toBeVisible();
  });

  test("AC-0052, AC-0057, and AC-0077: a lot production drew from after the list loaded is refused, and stays as it was", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, await lotNumberOf(id));
    await expect(voidButton(item)).toBeVisible();

    // Production draws from the lot after the list shows it as untouched.
    expect((await callAsOperator(produceCall(PROD_502_ID, 500))).ok).toBe(true);
    const before = await lotState(id);
    expect(before).toEqual({ remaining: 500, voided: false, reason: null });

    await voidThrough(page, item, "keyed twice");

    // AC-0077: the engine's reason, then the hint to reload for the latest stock.
    const message = item.getByRole("alert");
    await expect(message).toHaveText(
      new RegExp(`^${NOT_VOIDED} invalid, lot [0-9a-f-]{36} has been consumed\\. Reload to see the latest stock\\.$`),
    );
    await expect(message).toBeFocused();
    await expect(voidDialog(page)).toBeHidden();
    expect(await lotState(id)).toEqual(before);
    expect(await voidMarks()).toBe(0);
    await expect(item.getByText(/^Void: /)).toHaveCount(0);

    // The list after the refusal: the message is in the page, the dialog is closed.
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Void"]);
  });
});

test.describe("voiding when the connection drops", () => {
  test("AC-0073 and AC-0057: the list stays and says the receipt may not have been voided", async ({ page }) => {
    const id = await seedReceipt(1000, 1.68);
    const before = await lotState(id);
    const f = await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, await lotNumberOf(id));
    await expect(voidButton(item)).toBeVisible();
    const dropped = await dropActionRequests(page);

    await voidThrough(page, item, "keyed twice");

    const message = item.getByRole("alert");
    await expect(message).toHaveText(VOID_UNKNOWN);
    await expect(message).toBeFocused();
    // The void request never reached the server, the dialog is closed, and the
    // list is still on screen with the receipt untouched.
    expect(dropped.count).toBe(1);
    await expect(voidDialog(page)).toBeHidden();
    await expect(voidButton(item)).toBeVisible();
    await expect(factValue(f.region, "On hand")).toHaveText("1,000 lbs");
    expect(await lotState(id)).toEqual(before);
    expect(await voidMarks()).toBe(0);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Void"]);
  });
});

test.describe("voiding after the session ended", () => {
  test("AC-0043 and AC-0057: with no session cookie, the void is refused and the lot is unchanged", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const before = await lotState(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, await lotNumberOf(id));
    await expect(voidButton(item)).toBeVisible();

    await page.context().clearCookies();
    await voidThrough(page, item, "keyed twice");

    const message = item.getByRole("alert");
    await expect(message).toHaveText(VOID_SIGNED_OUT);
    await expect(message).toBeFocused();
    expect(await lotState(id)).toEqual(before);
    expect(await voidMarks()).toBe(0);
  });

  test("AC-0043 and AC-0057: an expired access token refreshes and voids, and a revoked session is refused", async ({
    browser,
    baseURL,
  }) => {
    const first = await seedReceipt(1000, 1.68, "2026-05-12");
    const second = await seedReceipt(500, 1.8, "2026-05-13");
    const secondBefore = await lotState(second);

    // A session of its own, so the saved operator session that later tests
    // reuse is untouched. It is never saved under test/e2e/.auth/.
    const context = await browser.newContext({ baseURL });
    const sessionCookies = async () => (await context.cookies()).filter(isAuthCookie);
    try {
      const page = await context.newPage();
      await signInThroughForm(page, OPERATOR_EMAIL);
      await openForm(page, RAW_TOM_URL);
      const firstItem = receiptItem(page, await lotNumberOf(first));
      const secondItem = receiptItem(page, await lotNumberOf(second));

      // The access token expired while the list was open. The proxy refreshes
      // it ahead of the action, so the action sees the new session and voids.
      await context.addCookies(withExpiredAccessToken(await sessionCookies()));
      await voidThrough(page, firstItem, "keyed twice");
      await expect(firstItem.getByText("Void: keyed twice", { exact: true })).toBeVisible();
      expect(await voidMarks()).toBe(1);

      // End the session at the auth server, then age the access token so the
      // proxy has to refresh it, and the refresh is refused.
      const cookies = await sessionCookies();
      const stack = resolveStackEnv();
      const revoked = await fetch(`${stack.apiUrl}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: { apikey: stack.anonKey, authorization: `Bearer ${readSession(cookies).access_token}` },
      });
      expect(revoked.status).toBe(204);
      await context.addCookies(withExpiredAccessToken(cookies));

      await voidThrough(page, secondItem, "wrong price");
      const message = secondItem.getByRole("alert");
      await expect(message).toHaveText(VOID_SIGNED_OUT);
      await expect(message).toBeFocused();
      expect(await lotState(second)).toEqual(secondBefore);
      expect(await voidMarks()).toBe(1);
    } finally {
      await context.close();
    }
  });
});
