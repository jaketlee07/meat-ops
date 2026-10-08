import { expect, test, type Locator } from "@playwright/test";
import { query, RAW_TOM_ID, resetTestData } from "../db";
import { resolveStackEnv } from "../env";
import { OPERATOR_EMAIL } from "../users";
import { checkPageState } from "./a11y";
import {
  beforeAfter,
  CODE,
  deviceDate,
  factValue,
  fillReceipt,
  FORM_CONTROLS,
  type Fields,
  lotCount,
  NOT_SAVED,
  openForm,
  readValues,
  seedReceipt,
  SIGNED_OUT,
  VENDOR,
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
    await expect(page.getByText("No vendors yet. Add one in Supabase Studio.")).toBeVisible();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
    await f.save.click({ force: true });
    await expect(f.result).toBeEmpty();
    expect(await lotCount()).toBe(0);
  });

  test("AC-0008: vendors are listed by name, alphabetical ignoring case", async ({ page }) => {
    await query("insert into vendors(name) values ('acme'), ('Bayside')");
    const f = await openForm(page);
    await expect(f.vendor.locator("option")).toHaveText(["Choose a vendor", "acme", "Bayside", VENDOR]);
  });

  test.describe("in a time zone far from UTC", () => {
    test.use({ timezoneId: "Pacific/Auckland" });

    test("AC-0009: the received date starts at today on the device", async ({ page }) => {
      const f = await openForm(page);
      const today = await deviceDate(page);
      await expect(f.date).toHaveValue(today);
      await expect(f.date).toHaveAttribute("max", today);
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

    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
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
});
