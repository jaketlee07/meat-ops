import { expect, test } from "@playwright/test";
import { adjustCall, callAsOperator, PROD_502_ID, produceCall, RAW_TOM_ID, resetTestData } from "../db";
import { checkPageState } from "./a11y";
import {
  addFinished,
  addRaw,
  cardFor,
  cardHeadings,
  cards,
  MENU_CONTROLS,
  NO_PRODUCTS,
  NOTHING_SELLABLE,
  produce,
  retire502,
  receive,
  sellableSwitch,
  setListPrice,
} from "./menu-page";
import { seed502Fixture } from "./production-page";
import { NOT_ALLOWED } from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// The menu page, end to end: a real browser over the production build and the
// local database. Fixtures are written through pg (master data) and the
// operations (stock).

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// Tab order with the switch: the navigation, Sign out, then the checkbox (no id or name).
const WITH_SWITCH = [...MENU_CONTROLS, "input"];

const FRAMING = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
};

// One sellable product (finished stock only), one with raw stock only, and one with neither.
async function sellabilityFixture() {
  await retire502();
  const rawA = await addRaw("RAW-A");
  const rawB = await addRaw("RAW-B");
  const rawC = await addRaw("RAW-C");
  const onlyFinished = await addFinished("F-FIN", "Only finished", rawA);
  await addFinished("F-RAW", "Only raw", rawB);
  await addFinished("F-NONE", "Neither", rawC);
  await receive(rawA, 100);
  await produce(onlyFinished, 100);
  await receive(rawB, 100);
}

test.describe("access and navigation", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /menu ends on /sign-in", async ({ page }) => {
      await page.goto("/menu");
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    for (const path of ["/sign-in", "/receiving", "/production", "/menu"]) {
      test(`AC-0006: ${path} carries the framing headers, signed out`, async ({ request }) => {
        const response = await request.get(path);
        for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
        // The redirect itself carries them too.
        const redirect = await request.get(path, { maxRedirects: 0 });
        for (const [name, value] of Object.entries(FRAMING)) expect(redirect.headers()[name]).toBe(value);
      });
    }
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0002: /menu shows the not-allowed message, Sign out, and no product", async ({ page }) => {
      await seed502Fixture();
      await page.goto("/menu");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(cards(page)).toHaveCount(0);
      await expect(page.getByText("Smoked Turkey Drums Tom")).toHaveCount(0);
      // AC-0130, AC-0131, AC-0132, AC-0139, AC-0141
      expect(await checkPageState(page)).toEqual(["button Sign out"]);
    });
  });

  for (const [path, current] of [
    ["/receiving", "Receiving"],
    ["/production", "Production"],
    ["/menu", "Menu"],
  ] as const) {
    test(`AC-0004 and AC-0005: ${path} links all pages and marks only its own`, async ({ page }) => {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav.getByRole("link", { name: "Receiving" })).toHaveAttribute("href", "/receiving");
      await expect(nav.getByRole("link", { name: "Production" })).toHaveAttribute("href", "/production");
      await expect(nav.getByRole("link", { name: "Menu" })).toHaveAttribute("href", "/menu");
      await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
      await expect(nav.getByRole("link", { name: current, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator("[aria-current]")).toHaveCount(1);
    });
  }

  for (const path of ["/sign-in", "/receiving", "/production", "/menu"]) {
    test(`AC-0006: ${path} carries the framing headers, signed in as the operator`, async ({ request }) => {
      const response = await request.get(path);
      for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
    });
  }
});

test.describe("the menu", () => {
  test("AC-0040 and AC-0042: each active finished product once, with its figures", async ({ page }) => {
    await sellabilityFixture();
    await page.goto("/menu");
    await expect(page.getByRole("heading", { level: 1, name: "Menu" })).toBeVisible();
    await expect(cards(page)).toHaveCount(3);
    const card = cardFor(page, "F-FIN");
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("F-FIN Only finished");
    await expect(card).toContainText("No list price yet");
    await expect(card).toContainText("Finished on hand");
    await expect(card).toContainText("Raw on hand");
    await expect(card).toContainText("Sellable now");
    await expect(cardFor(page, "F-NONE")).toContainText("Not sellable now");
    expect(await checkPageState(page)).toEqual(WITH_SWITCH);
  });

  test("AC-0051: products are in code order", async ({ page }) => {
    const raw = await addRaw("RAW-X");
    await addFinished("A1", "Third", raw);
    await addFinished("1000", "First", raw);
    await page.goto("/menu");
    expect(await cardHeadings(page)).toEqual(["1000 First", "502 Smoked Turkey Drums Tom", "A1 Third"]);
  });

  test("AC-0041: 502 with a 3.29 list price after a batch of 2,000 raw lbs", async ({ page }) => {
    await seed502LotOnly();
    await setListPrice(PROD_502_ID, 3.29);
    const outcome = await callAsOperator(produceCall(PROD_502_ID, 2000, null, "2026-10-06"));
    expect(outcome.ok, outcome.error).toBe(true);
    await page.goto("/menu");
    const card = cardFor(page, "502");
    await expect(card).toContainText("$3.29/lb");
    await expect(card.locator("dd").nth(0)).toHaveText("1,540 lbs");
    await expect(card.locator("dd").nth(1)).toHaveText("3,000 lbs");
    await expect(card).toContainText("Sellable now");
  });

  test("AC-0043: sellable when finished or raw lbs are above 0", async ({ page }) => {
    await sellabilityFixture();
    await page.goto("/menu");
    await expect(cardFor(page, "F-FIN")).toContainText("Sellable now");
    await expect(cardFor(page, "F-RAW")).toContainText("Sellable now");
    await expect(cardFor(page, "F-NONE")).toContainText("Not sellable now");
    await expect(cardFor(page, "F-NONE")).not.toContainText("Sellable now");
  });

  test("AC-0044: after the lot is adjusted to 0, 502 is Not sellable now", async ({ page }) => {
    const lot = await seed502LotOnly();
    await page.goto("/menu");
    await expect(cardFor(page, "502")).toContainText("Sellable now");
    const outcome = await callAsOperator(adjustCall(lot, 0));
    expect(outcome.ok, outcome.error).toBe(true);
    await page.reload();
    await expect(cardFor(page, "502")).toContainText("Not sellable now");
  });

  test("AC-0045: an inactive finished product is not listed", async ({ page }) => {
    await retire502();
    const raw = await addRaw("RAW-X");
    await addFinished("ACT", "Active one", raw);
    await addFinished("OFF", "Inactive one", raw, { active: false });
    await page.goto("/menu");
    expect(await cardHeadings(page)).toEqual(["ACT Active one"]);
  });
});

async function seed502LotOnly(): Promise<string> {
  return receive(RAW_TOM_ID, 5000, 1.68);
}

test.describe("Sellable only", () => {
  test("AC-0046 to AC-0048: starts off, narrows to sellable, and widens again, with no request", async ({ page }) => {
    await sellabilityFixture();
    await page.goto("/menu");
    await expect(sellableSwitch(page)).not.toBeChecked();
    await expect(cards(page)).toHaveCount(3);

    const requests: string[] = [];
    // Link prefetches to other pages may fire; the switch must send nothing to /menu or any action.
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/menu" || request.method() !== "GET") requests.push(request.url());
    });
    await sellableSwitch(page).check();
    expect(await cardHeadings(page)).toEqual(["F-FIN Only finished", "F-RAW Only raw"]);
    expect(await checkPageState(page)).toEqual(WITH_SWITCH);
    await sellableSwitch(page).uncheck();
    await expect(cards(page)).toHaveCount(3);
    expect(requests).toEqual([]);

    // Off again on each load.
    await sellableSwitch(page).check();
    await page.reload();
    await expect(sellableSwitch(page)).not.toBeChecked();
    await expect(cards(page)).toHaveCount(3);
  });

  test("AC-0047: one sellable and one unsellable product", async ({ page }) => {
    await retire502();
    const rawA = await addRaw("RAW-A");
    const rawB = await addRaw("RAW-B");
    await addFinished("SELL", "Sellable", rawA);
    await addFinished("NOPE", "Not sellable", rawB);
    await receive(rawA, 50);
    await page.goto("/menu");
    await sellableSwitch(page).check();
    expect(await cardHeadings(page)).toEqual(["SELL Sellable"]);
  });

  test("AC-0133: the switch works with the keyboard alone", async ({ page }) => {
    await sellabilityFixture();
    await page.goto("/menu");
    await sellableSwitch(page).focus();
    await page.keyboard.press("Space");
    await expect(sellableSwitch(page)).toBeChecked();
    await expect(cards(page)).toHaveCount(2);
    await page.keyboard.press("Space");
    await expect(sellableSwitch(page)).not.toBeChecked();
    await expect(cards(page)).toHaveCount(3);
  });

  test("AC-0049: with nothing sellable, the page says so", async ({ page }) => {
    await retire502();
    const raw = await addRaw("RAW-X");
    await addFinished("ONE", "One", raw);
    await page.goto("/menu");
    await sellableSwitch(page).check();
    await expect(page.getByText(NOTHING_SELLABLE, { exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(WITH_SWITCH);
  });
});

test.describe("no active finished product", () => {
  test("AC-0050: the page says to add one in Supabase Studio", async ({ page }) => {
    await retire502();
    await page.goto("/menu");
    await expect(page.getByText(NO_PRODUCTS, { exact: true })).toBeVisible();
    await expect(cards(page)).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(MENU_CONTROLS);
  });
});
