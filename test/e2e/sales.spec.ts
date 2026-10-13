import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import {
  callAsOperator,
  CUSTOMER_ID,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  saleFixture,
  VENDOR_ID,
  voidSaleCall,
} from "../db";
import { resolveStackEnv } from "../env";
import { OPERATOR_EMAIL } from "../users";
import { checkPageState } from "./a11y";
import { addFinished, retire502, setListPrice } from "./menu-page";
import { captureAction, replayText } from "./pricing-page";
import { deviceDate, factValue, beforeAfter, NOT_ALLOWED, sendsActionRequest } from "./receiving-page";
import {
  batchNumbersInDrawOrder,
  captureAndAbortAction,
  CODE,
  DETAILS_MISSING,
  DIALOG_CONTROLS,
  dropActionRequests,
  fillEverything,
  finishedSnapshot,
  fillSale,
  fixtureWithPrice,
  FORM_CONTROLS,
  holdActionRequests,
  listControls,
  NO_PRODUCTS,
  NOT_VOIDED,
  openForm,
  readValues,
  recentItem,
  restoreSaleItemsRead,
  revokeSaleItemsRead,
  SAVE_UNKNOWN,
  SAVED_HEADING,
  saleCount,
  saleNumbers,
  saleRows,
  saleState,
  seedSale,
  SIGNED_OUT,
  tabTo,
  VOID_SIGNED_OUT,
  VOID_UNKNOWN,
  voidButtonOf,
  voidDialog,
  voidMarks,
  voidThrough,
} from "./sales-page";
import { isAuthCookie, readSession, withExpiredAccessToken } from "./session";
import { NON_OPERATOR_STATE, OPERATOR_STATE, signInThroughForm } from "./states";

// The sales page, end to end: a real browser over the production build and the
// local database. Raw tables are read through pg to show what was or was not
// written.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// AC-0047 and AC-0048 take the operator's read of sale_items away; it comes back
// whether or not the test passes.
test.afterEach(async () => {
  await restoreSaleItemsRead();
});

const FRAMING = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
};

const PAGES = [
  ["/receiving", "Receiving"],
  ["/production", "Production"],
  ["/menu", "Menu"],
  ["/pricing", "Pricing"],
  ["/sales", "Sales"],
  ["/trace", "Trace"],
] as const;

test.describe("access and navigation", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /sales ends on /sign-in", async ({ page }) => {
      await page.goto("/sales");
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    for (const path of ["/sales", "/trace"]) {
      test(`AC-0009: ${path} carries the framing headers, signed out`, async ({ request }) => {
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

    test("AC-0002: /sales shows the not-allowed message, Sign out, and no form or sale", async ({ page }) => {
      await saleFixture({ listPrice: true, sale: true });
      await page.goto("/sales");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByLabel("Product code")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Recent sales" })).toHaveCount(0);
      await expect(page.getByText("S-5000")).toHaveCount(0);
    });
  });

  test.describe("signed in as the operator", () => {
    for (const path of ["/sales", "/trace"]) {
      test(`AC-0009: ${path} carries the framing headers, signed in`, async ({ request }) => {
        const response = await request.get(path);
        for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
      });
    }
  });

  for (const [path, current] of PAGES) {
    test(`AC-0007 and AC-0008: ${path} links all six pages in order and marks only its own`, async ({ page }) => {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Primary" });
      for (const [href, name] of PAGES) {
        await expect(nav.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
      }
      const names = PAGES.map(([, name]) => name);
      const shown = (await nav.getByRole("link").allTextContents()).map((text) => text.trim());
      expect(shown.filter((name) => names.includes(name as (typeof names)[number]))).toEqual(names);
      await expect(nav.getByRole("link", { name: current, exact: true })).toHaveAttribute("aria-current", "page");
      await expect(nav.locator("[aria-current]")).toHaveCount(1);
    });
  }
});

test.describe("replayed save and void requests", () => {
  const replays = [
    { who: "no session", storageState: undefined },
    { who: "a non-operator's session", storageState: NON_OPERATOR_STATE },
  ];

  // The sale is written for real once, so the request exists; the replays must write no more.
  async function capturedSave(page: Page) {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "100" });
    const sent = await captureAction(page, () => f.save.click());
    await expect(page.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    expect(await saleCount()).toBe(1);
    return sent;
  }

  test("AC-0003, AC-0004, and AC-0006: a replayed save with no session or a non-operator's writes nothing and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const sent = await capturedSave(page);
    const lots = await finishedSnapshot();
    for (const { who, storageState } of replays) {
      const text = await replayText(playwright, baseURL, sent, storageState);
      if (storageState) expect(text, `response for ${who}`).toContain(NOT_ALLOWED);
      else expect(text, `response for ${who}`).toContain(SIGNED_OUT);
      expect(await saleCount(), `sales after ${who}`).toBe(1);
      expect(await finishedSnapshot(), `finished lots after ${who}`).toEqual(lots);
    }
  });

  test("AC-0003, AC-0005, and AC-0006: a replayed void with no session or a non-operator's marks nothing and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await fixtureWithPrice();
    await seedSale(100);
    await page.goto("/sales");
    const [sale] = await saleRows();
    // The captured void is stopped before the server sees it, so the sale is still open for the replays.
    const sent = await captureAndAbortAction(page, () => voidThrough(page, sale?.sale_number ?? "", "wrong customer"));
    expect(await voidMarks(), "void marks after the captured request was stopped").toBe(0);
    const lots = await finishedSnapshot();
    for (const { who, storageState } of replays) {
      const text = await replayText(playwright, baseURL, sent, storageState);
      if (storageState) expect(text, `response for ${who}`).toContain(NOT_ALLOWED);
      else expect(text, `response for ${who}`).toContain(VOID_SIGNED_OUT);
      expect(await voidMarks(), `void marks after ${who}`).toBe(0);
      expect(await finishedSnapshot(), `finished lots after ${who}`).toEqual(lots);
    }
    // Control: the same request from the operator's session does void the sale, so the
    // refusals above came from who sent it, not from a bad copy.
    await replayText(playwright, baseURL, sent, OPERATOR_STATE);
    expect(await voidMarks(), "void marks after the operator's own copy").toBe(1);
  });

  // The multipart body carries each field's value after its name and a blank line.
  function withValue(body: Buffer, name: string, value: string): Buffer {
    const text = body.toString("utf8");
    const changed = text.replace(new RegExp(`(name="[^"]*${name}"\\r\\n\\r\\n)[^\\r]*`), `$1${value}`);
    expect(changed === text, `${name} set to ${value} changes the body`).toBe(false);
    return Buffer.from(changed, "utf8");
  }

  test("AC-0030: a replayed save with an unknown customer id writes no sale and refuses that field", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const sent = await capturedSave(page);
    const lots = await finishedSnapshot();
    const body = withValue(sent.body, "customerId", "00000000-0000-0000-0000-000000000000");
    const text = await replayText(playwright, baseURL, { ...sent, body }, OPERATOR_STATE);
    expect(text).toContain("Choose a customer from the list.");
    expect(await saleCount()).toBe(1);
    expect(await finishedSnapshot()).toEqual(lots);
  });

  test("AC-0029 and AC-0031: a replayed save with a sale date or a today that is not YYYY-MM-DD writes no sale", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const sent = await capturedSave(page);
    const lots = await finishedSnapshot();
    const bodies = [
      { which: "a sale date of 2026-02-30", data: withValue(sent.body, "saleDate", "2026-02-30") },
      { which: "a sale date of 6/10/2026", data: withValue(sent.body, "saleDate", "6/10/2026") },
      { which: "a today of 2026-02-30", data: withValue(sent.body, "today", "2026-02-30") },
      { which: "a today of 10/08/2026", data: withValue(sent.body, "today", "10/08/2026") },
    ];
    for (const { which, data } of bodies) {
      const text = await replayText(playwright, baseURL, { ...sent, body: data }, OPERATOR_STATE);
      expect(text, `response for ${which}`).toContain("Enter the sale date.");
      expect(await saleCount(), `sales after ${which}`).toBe(1);
      expect(await finishedSnapshot(), `finished lots after ${which}`).toEqual(lots);
    }
  });
});

test.describe("the form", () => {
  test("AC-0020: a product's code shows its description, list price, and finished lbs on hand", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await f.code.fill(CODE);
    await expect(factValue(f.facts, "Product")).toHaveText("Smoked Turkey Drums Tom");
    await expect(factValue(f.facts, "List price")).toHaveText("$3.29/lb");
    await expect(factValue(f.facts, "Finished on hand")).toHaveText("5,390 lbs");
  });

  test("AC-0020 and AC-0022: a product with no list price says so and empties the price field", async ({ page }) => {
    await saleFixture();
    const f = await openForm(page);
    await f.price.fill("9.99");
    await f.code.fill(CODE);
    await expect(factValue(f.facts, "List price")).toHaveText("No list price yet");
    await expect(f.price).toHaveValue("");
  });

  test("AC-0021: the price field takes the list price with 2 decimals: 3.29 for 3.29, 3.50 for 3.5", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await f.code.fill(CODE);
    await expect(f.price).toHaveValue("3.29");
    await setListPrice(PROD_502_ID, 3.5);
    await page.reload();
    const again = await openForm(page);
    await again.code.fill(CODE);
    await expect(again.price).toHaveValue("3.50");
  });

  test("AC-0023: a different product's code resets the price from that product, and a code outside the list leaves it", async ({
    page,
  }) => {
    await fixtureWithPrice();
    await addFinished("503", "Smoked Turkey Necks", RAW_TOM_ID, { listPrice: 4.1 });
    await addFinished("504", "Smoked Turkey Wings", RAW_TOM_ID);
    const f = await openForm(page);
    await f.code.fill("502");
    await expect(f.price).toHaveValue("3.29");
    await f.price.fill("3.10");
    await f.code.fill("503");
    await expect(f.price).toHaveValue("4.10");
    await f.price.fill("4.00");
    await f.code.fill("50");
    await expect(f.price).toHaveValue("4.00");
    await f.code.fill("504");
    await expect(f.price).toHaveValue("");
    await f.price.fill("2.00");
    await f.code.fill("502");
    await expect(f.price).toHaveValue("3.29");
  });

  test("AC-0024: a typed price of 3.10 over the list price writes lines at 3.10", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { code: "502", price: "3.10", lbs: "100" });
    await f.save.click();
    await expect(page.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    const rows = await saleRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.prices).toEqual([3.1]);
    expect(rows[0]?.lbs).toEqual([100]);
  });

  test("AC-0025: the customer field starts at No customer, then lists customers by name ignoring case", async ({
    page,
  }) => {
    await query("insert into customers(name) values ('beta Deli'), ('Zeta Meats'), ('alpha Foods')");
    const f = await openForm(page);
    await expect(f.customer).toHaveValue("");
    expect(await f.customer.locator("option").allTextContents()).toEqual([
      "No customer",
      "alpha Foods",
      "beta Deli",
      "Fulton Market Deli",
      "Zeta Meats",
    ]);
    await expect(f.customer.locator("option:checked")).toHaveText("No customer");
  });

  test("AC-0026: the sale date starts at today's date on the device", async ({ page }) => {
    const f = await openForm(page);
    await expect(f.date).toHaveValue(await deviceDate(page));
    await expect(f.date).toHaveAttribute("max", await deviceDate(page));
  });

  test("AC-0027: with no active finished product the page says so and Save sale sends nothing", async ({ page }) => {
    await retire502();
    const f = await openForm(page);
    await expect(page.getByText(NO_PRODUCTS, { exact: true })).toBeVisible();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    await fillSale(f, { price: "3.29" });
    const sent = sendsActionRequest(page);
    await f.save.click({ force: true });
    expect(await sent).toBe(false);
    expect(await saleCount()).toBe(0);
  });

  test("AC-0028: a save with No customer writes a sale with no customer", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "100" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    await expect(factValue(f.result, "Customer")).toHaveText("No customer");
    const rows = await saleRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.customer_id).toBeNull();
  });

  const TOMORROW = 1;
  const CODE_ROWS: Array<[string, string]> = [
    ["", "Enter a product code."],
    ["RAW-TOM", "No active finished product has code RAW-TOM."],
    ["999", "No active finished product has code 999."],
    ["505", "No active finished product has code 505."],
  ];
  const LBS_ROWS: Array<[string, string]> = [
    ["", "Enter the lbs sold, like 500 or 32.5."],
    ["abc", "Enter the lbs sold, like 500 or 32.5."],
    ["1.2.3", "Enter the lbs sold, like 500 or 32.5."],
    ["-5", "Enter the lbs sold, like 500 or 32.5."],
    ["1.2345", "Use at most 3 decimal places for weight."],
    ["0", "Lbs must be above 0."],
    ["0.0", "Lbs must be above 0."],
    ["000", "Lbs must be above 0."],
  ];
  const PRICE_ROWS: Array<[string, string]> = [
    ["", "Enter the price per lb, like 3.29."],
    ["abc", "Enter the price per lb, like 3.29."],
    ["3.2.9", "Enter the price per lb, like 3.29."],
    ["1.234", "Use at most 2 decimal places for a price."],
    ["100000000.123", "Use at most 2 decimal places for a price."],
    ["100000000", "Price must be below 100,000,000."],
  ];

  async function refusedBesideField(page: Page, field: "code" | "lbs" | "price" | "date", id: string, input: string, message: string) {
    await fixtureWithPrice();
    await addFinished("505", "Smoked Turkey Skin", RAW_TOM_ID, { active: false });
    const f = await openForm(page);
    await fillSale(f, { code: "502", lbs: "100", price: "3.29" });
    await f[field].fill(input);
    const before = await readValues(f);
    await f.save.click();
    await expect(page.locator(`#${id}-error`)).toHaveText(message);
    await expect(f[field]).toHaveAttribute("aria-invalid", "true");
    await expect(f[field]).toHaveAttribute("aria-describedby", `${id}-error`);
    expect(await readValues(f)).toEqual(before);
    expect(await saleCount()).toBe(0);
  }

  for (const [input, message] of CODE_ROWS) {
    test(`AC-0029: product code ${JSON.stringify(input)} is refused beside its field`, async ({ page }) => {
      await refusedBesideField(page, "code", "product-code", input, message);
    });
  }
  for (const [input, message] of LBS_ROWS) {
    test(`AC-0029: lbs ${JSON.stringify(input)} is refused beside its field`, async ({ page }) => {
      await refusedBesideField(page, "lbs", "lbs", input, message);
    });
  }
  for (const [input, message] of PRICE_ROWS) {
    test(`AC-0029: price per lb ${JSON.stringify(input)} is refused beside its field`, async ({ page }) => {
      await refusedBesideField(page, "price", "price-per-lb", input, message);
    });
  }

  test("AC-0029: a blank sale date is refused beside its field", async ({ page }) => {
    await refusedBesideField(page, "date", "sale-date", "", "Enter the sale date.");
  });

  test("AC-0029: a sale date after today is refused beside its field", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const tomorrow = await deviceDate(page, TOMORROW);
    await fillSale(f, { code: "502", lbs: "100", price: "3.29", date: tomorrow });
    await f.save.click();
    await expect(page.locator("#sale-date-error")).toHaveText("The sale date can't be after today.");
    await expect(f.date).toHaveValue(tomorrow);
    expect(await saleCount()).toBe(0);
  });

  test("AC-0032: lbs 0.001 at price 0 saves one sale", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "0.001", price: "0" });
    await f.save.click();
    await expect(page.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    const rows = await saleRows();
    expect(rows).toHaveLength(1);
    expect([rows[0]?.lbs, rows[0]?.prices]).toEqual([[0.001], [0]]);
  });

  test("AC-0032: lbs 1540 at price 99999999.99 saves one sale", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "1540", price: "99999999.99" });
    await f.save.click();
    await expect(page.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    const rows = await saleRows();
    expect(rows).toHaveLength(1);
    expect([rows[0]?.lbs, rows[0]?.prices]).toEqual([[1540], [99999999.99]]);
  });

  test("AC-0033: a product added after the load saves without a reload, with the typed price kept", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const rawId = RAW_TOM_ID;
    const finishedId = await addFinished("503", "Smoked Turkey Necks", rawId, { listPrice: 9.99 });
    const outcome = await callAsOperator(produceCall(finishedId, 100, null, "2026-10-08"));
    expect(outcome.ok, outcome.error).toBe(true);
    await fillSale(f, { code: "503", price: "5.25", lbs: "10" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    const rows = await saleRows();
    expect(rows).toHaveLength(1);
    expect([rows[0]?.lbs, rows[0]?.prices]).toEqual([[10], [5.25]]);
    await expect(factValue(f.result, "Product")).toHaveText("503 Smoked Turkey Necks");
  });

  test("AC-0033 and AC-0034: while the page's list reloads for a new code, Save sale is pending and shows no old field error", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const finishedId = await addFinished("503", "Smoked Turkey Necks", RAW_TOM_ID, { listPrice: 9.99 });
    const outcome = await callAsOperator(produceCall(finishedId, 100, null, "2026-10-08"));
    expect(outcome.ok, outcome.error).toBe(true);
    // A refused form first, so there are field errors the wait must not keep showing.
    await fillSale(f, { lbs: "" });
    await f.save.click();
    await expect(f.lbs).toHaveAttribute("aria-invalid", "true");
    await fillSale(f, { code: "503", price: "5.25", lbs: "10" });
    // Hold the render the form waits for, so the wait can be seen.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      (url) => url.pathname === "/sales" && url.searchParams.has("product"),
      async (route) => {
        await gate;
        await route.continue();
      },
    );
    await f.save.click();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    await expect(f.saving).toHaveText("Saving…");
    await expect(page.locator("form [aria-invalid]")).toHaveCount(0);
    await expect(page.locator("form [id$='-error']")).toHaveCount(0);
    expect(await saleCount()).toBe(0);
    release();
    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    expect(await saleCount()).toBe(1);
  });

  test("AC-0029 and AC-0034: once corrected, no field shows as invalid while the save is pending", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "" });
    await f.save.click();
    await expect(page.locator("#lbs-error")).toBeVisible();
    await f.lbs.fill("100");
    const hold = await holdActionRequests(page);
    await f.save.click();
    await expect(f.saving).toHaveText("Saving…");
    await expect(page.locator("form [aria-invalid]")).toHaveCount(0);
    await expect(page.locator("form [id$='-error']")).toHaveCount(0);
    hold.release();
    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
  });

  test("AC-0030 and AC-0157: a customer deleted after the page loaded is refused beside Customer, with focus on the message", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const [gone] = await query<{ id: string }>("insert into customers(name) values ('Gone Co') returning id");
    const f = await openForm(page);
    await fillSale(f, { lbs: "100", customer: "Gone Co" });
    await query("delete from customers where id = $1", [gone?.id]);
    await f.save.click();
    const message = page.locator("#customer-error");
    await expect(message).toHaveText("Choose a customer from the list.");
    await expect(message).toBeFocused();
    expect(await saleCount()).toBe(0);
  });

  test("AC-0034: pressing Save sale again while a save is pending writes no second sale", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "100" });
    const hold = await holdActionRequests(page);
    await f.save.click();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    await expect(f.saving).toHaveText("Saving…");
    // Playwright waits for an enabled control, and aria-disabled is not enabled to it.
    await f.save.click({ force: true });
    await f.date.press("Enter");
    hold.release();
    await expect(page.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    expect(hold.held).toBe(1);
    expect(await saleCount()).toBe(1);
  });
});

// The value shown for one label in each of the matched blocks, in page order.
function valuesOf(blocks: Locator, label: string): Promise<string[]> {
  return blocks.evaluateAll(
    (items, name) =>
      items.map((item) => {
        const term = [...item.querySelectorAll("dt")].find((dt) => dt.textContent === name);
        return term?.nextElementSibling?.textContent ?? "";
      }),
    label,
  );
}

// The 5,000-lb sale entered on the page, with the price as filled.
async function enter5000(page: Page) {
  await fixtureWithPrice();
  const f = await openForm(page);
  await fillSale(f, { lbs: "5000", customer: "Fulton Market Deli", date: "2026-10-08" });
  await expect(f.price).toHaveValue("3.29");
  await f.save.click();
  await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
  return f;
}

test.describe("the result", () => {
  test("AC-0040, AC-0041, AC-0042, AC-0044, and AC-0045: the saved sale, its lots, and the stock before and after", async ({
    page,
  }) => {
    const f = await enter5000(page);
    const [sale] = await saleRows();
    const [batch1, batch2] = await batchNumbersInDrawOrder();
    const r = f.result;
    await expect(factValue(r, "Sale number")).toHaveText(sale?.sale_number ?? "");
    await expect(factValue(r, "Product")).toHaveText("502 Smoked Turkey Drums Tom");
    await expect(factValue(r, "Customer")).toHaveText("Fulton Market Deli");
    await expect(factValue(r, "Sale date")).toHaveText("Oct 8, 2026");
    await expect(factValue(r, "Lbs")).toHaveText("5,000 lbs");
    await expect(factValue(r, "Price per lb")).toHaveText("$3.29/lb");

    const lots = r.getByRole("listitem");
    await expect(lots).toHaveCount(2);
    await expect(factValue(lots.nth(0), "Batch number")).toHaveText(batch1 ?? "");
    await expect(factValue(lots.nth(0), "Made")).toHaveText("Oct 6, 2026");
    await expect(factValue(lots.nth(0), "Lbs drawn")).toHaveText("4,620 lbs");
    await expect(factValue(lots.nth(1), "Batch number")).toHaveText(batch2 ?? "");
    await expect(factValue(lots.nth(1), "Made")).toHaveText("Oct 7, 2026");
    await expect(factValue(lots.nth(1), "Lbs drawn")).toHaveText("380 lbs");

    await expect(beforeAfter(r, /on hand/)).toHaveText(["5,390 lbs", "390 lbs"]);
    await expect(r.getByRole("link", { name: "Trace this sale" })).toHaveAttribute(
      "href",
      `/trace?sale=${sale?.sale_number}`,
    );
  });

  test("AC-0043: the lots drawn are in draw order: production date, then entry order", async ({ page }) => {
    await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 8000, 1.68, "2026-10-01"));
    for (const date of ["2026-10-07", "2026-10-06", "2026-10-06"]) {
      const outcome = await callAsOperator(produceCall(PROD_502_ID, 1000, null, date));
      expect(outcome.ok, outcome.error).toBe(true);
    }
    await setListPrice(PROD_502_ID, 3.29);
    const f = await openForm(page);
    await fillSale(f, { lbs: "2000", date: "2026-10-08" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    const expected = await batchNumbersInDrawOrder();
    const lots = f.result.getByRole("listitem");
    await expect(lots).toHaveCount(3);
    expect(await valuesOf(f.result.locator("li"), "Batch number")).toEqual(expected);
    expect(await valuesOf(f.result.locator("li"), "Made")).toEqual(["Oct 6, 2026", "Oct 6, 2026", "Oct 7, 2026"]);
  });

  test("AC-0046: after a save the customer and date keep their values and the product, lbs, and price empty", async ({
    page,
  }) => {
    const f = await enter5000(page);
    expect(await readValues(f)).toEqual({
      code: "",
      lbs: "",
      price: "",
      customer: CUSTOMER_ID,
      date: "2026-10-08",
    });
  });

  test("AC-0047 and AC-0048: when the reads after the write fail, the sale is still shown, without lots or stock", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "5000", customer: "Fulton Market Deli", date: "2026-10-08" });
    try {
      await revokeSaleItemsRead();
      await f.save.click();
      await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    } finally {
      await restoreSaleItemsRead();
    }
    const [sale] = await saleRows();
    expect(await saleCount()).toBe(1);
    await expect(factValue(f.result, "Sale number")).toHaveText(sale?.sale_number ?? "");
    await expect(factValue(f.result, "Sale date")).toHaveText("Oct 8, 2026");
    await expect(factValue(f.result, "Lbs")).toHaveCount(0);
    await expect(factValue(f.result, "Price per lb")).toHaveCount(0);
    await expect(f.result.getByText(DETAILS_MISSING, { exact: true })).toBeVisible();
    await expect(f.result.getByRole("heading", { name: "Finished lots drawn" })).toHaveCount(0);
    await expect(f.result.getByRole("table")).toHaveCount(0);
  });
});

// Ends the session at the auth server, then ages the access token so the proxy
// has to refresh it and the refresh is refused.
async function endSessionAtAuthServer(context: BrowserContext): Promise<void> {
  const cookies = (await context.cookies()).filter(isAuthCookie);
  const stack = resolveStackEnv();
  const revoked = await fetch(`${stack.apiUrl}/auth/v1/logout?scope=local`, {
    method: "POST",
    headers: { apikey: stack.anonKey, authorization: `Bearer ${readSession(cookies).access_token}` },
  });
  expect(revoked.status).toBe(204);
  await context.addCookies(withExpiredAccessToken(cookies));
}

// A session of its own, so the saved operator session that later tests reuse is
// untouched. It is never saved under test/e2e/.auth/.
async function withOwnSession(
  browser: { newContext: (options: { baseURL?: string }) => Promise<BrowserContext> },
  baseURL: string | undefined,
  run: (context: BrowserContext, page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await signInThroughForm(page, OPERATOR_EMAIL);
    await run(context, page);
  } finally {
    await context.close();
  }
}

// A refused or failed save wrote no sale and changed no finished lot (AC-0058).
async function expectNothingWritten(lots: Awaited<ReturnType<typeof finishedSnapshot>>): Promise<void> {
  expect(await saleCount()).toBe(0);
  expect(await finishedSnapshot()).toEqual(lots);
}

test.describe("save refusals and failures", () => {
  test("AC-0050, AC-0058, AC-0059, and AC-0157: a sale needing more than was made by its date is refused", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const typed = await fillEverything(f, { lbs: "5000", date: "2026-10-06" });
    const lots = await finishedSnapshot();
    await f.save.click();

    await expect(f.message).toHaveText(
      "The sale wasn't saved. Only 4,620 lbs of finished stock made on or before Oct 6, 2026 is on hand, and this sale needs 5,000 lbs.",
    );
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    await expectNothingWritten(lots);
    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toHaveCount(0);
    // The form after an AC-0050 refusal.
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0051, AC-0058, AC-0059, and AC-0157: a product made inactive after the page loaded is refused", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const typed = await fillEverything(f);
    const lots = await finishedSnapshot();
    await query("update products set active = false where id = $1", [PROD_502_ID]);
    await f.save.click();

    await expect(f.message).toHaveText("The sale wasn't saved. This product is no longer active.");
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    await expectNothingWritten(lots);
  });

  test("AC-0052, AC-0058, AC-0059, and AC-0157: with the session cookies gone, the save is refused and the form kept", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const typed = await fillEverything(f);
    const lots = await finishedSnapshot();
    await page.context().clearCookies();
    await f.save.click();

    await expect(f.message).toHaveText(SIGNED_OUT);
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    await expectNothingWritten(lots);
  });

  test("AC-0052, AC-0058, AC-0059, and AC-0157: a session revoked after the form loaded is refused and the form kept", async ({
    browser,
    baseURL,
  }) => {
    await fixtureWithPrice();
    await withOwnSession(browser, baseURL, async (context, page) => {
      const f = await openForm(page);
      const typed = await fillEverything(f);
      const lots = await finishedSnapshot();
      await endSessionAtAuthServer(context);
      await f.save.click();

      await expect(f.message).toHaveText(SIGNED_OUT);
      await expect(f.message).toBeFocused();
      expect(await readValues(f)).toEqual(typed);
      await expectNothingWritten(lots);
    });
  });

  test("AC-0055, AC-0058, AC-0059, and AC-0157: a save whose connection drops keeps the form and says it may not have been saved", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const typed = await fillEverything(f);
    const lots = await finishedSnapshot();
    const dropped = await dropActionRequests(page);
    await f.save.click();

    await expect(f.message).toHaveText(SAVE_UNKNOWN);
    await expect(f.message).toBeFocused();
    // The request never reached the server, and every field keeps its value.
    expect(dropped.count).toBe(1);
    expect(await readValues(f)).toEqual(typed);
    await expectNothingWritten(lots);
    await expect(f.save).toBeEnabled();
    // The form after an AC-0055 failure.
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0056, AC-0058, AC-0059, and AC-0157: lbs of 400 nines pass the rules and show the engine's reason", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    const typed = await fillEverything(f, { lbs: "9".repeat(400) });
    const lots = await finishedSnapshot();
    await f.save.click();

    await expect(f.message).toHaveText("The sale wasn't saved. invalid lbs, must be above 0");
    await expect(f.message).toBeFocused();
    expect(await readValues(f)).toEqual(typed);
    await expectNothingWritten(lots);
  });
});

test.describe("keyboard, focus, and names", () => {
  test("AC-0155, AC-0156, and the page state after AC-0029: focus goes to the first field with an error and every error is described", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await f.save.click();

    // Product code, lbs, and price are all blank; the customer and date are fine.
    await expect(f.code).toBeFocused();
    for (const [field, id] of [
      [f.code, "product-code"],
      [f.lbs, "lbs"],
      [f.price, "price-per-lb"],
    ] as const) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
      await expect(field).toHaveAttribute("aria-describedby", `${id}-error`);
      await expect(page.locator(`#${id}-error`)).toBeVisible();
    }
    expect(await saleCount()).toBe(0);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);

    // With only a later field wrong, focus goes there.
    await f.code.fill(CODE);
    await f.price.fill("3.29");
    await f.save.click();
    await expect(f.lbs).toBeFocused();
    await expect(f.lbs).toHaveAttribute("aria-describedby", "lbs-error");
    await expect(f.code).not.toHaveAttribute("aria-invalid", "true");
  });

  test("AC-0161: the lbs field's name contains lbs and the price field's contains per lb", async ({ page }) => {
    const f = await openForm(page);
    await expect(f.lbs).toHaveAccessibleName(/lbs/);
    await expect(f.price).toHaveAccessibleName(/per lb/);
  });

  test("AC-0153 and AC-0154: a sale is saved and then voided with the keyboard alone", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);

    await tabTo(page, f.code);
    await page.keyboard.type(CODE);
    await tabTo(page, f.lbs);
    await page.keyboard.type("100");
    await tabTo(page, f.customer);
    await page.keyboard.type("Fulton");
    await tabTo(page, f.save);
    await page.keyboard.press("Enter");

    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeFocused();
    const [sale] = await saleRows();
    expect(sale).toMatchObject({ prices: [3.29], lbs: [100], customer_id: CUSTOMER_ID, voided: false });
    const number = sale?.sale_number ?? "";
    await expect(voidButtonOf(page, number)).toBeVisible();

    // The Void button opens the confirmation with Space; Cancel holds focus first.
    await tabTo(page, voidButtonOf(page, number));
    await page.keyboard.press("Space");
    const dialog = voidDialog(page);
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    const reason = dialog.getByLabel("Reason for the void");
    await expect(reason).toBeFocused();
    await page.keyboard.type("wrong customer");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Void sale", exact: true })).toBeFocused();
    await page.keyboard.press("Space");

    await expect(recentItem(page, number).getByText("Void: wrong customer", { exact: true })).toBeVisible();
    await expect(f.recent.getByRole("heading", { name: "Recent sales" })).toBeFocused();
    const [row] = await query<{ id: string }>("select id from sales");
    expect(await saleState(row?.id ?? "")).toEqual({ voided: true, reason: "wrong customer" });
  });

  test("AC-0158: after a void, focus is on the Recent sales heading", async ({ page }) => {
    await fixtureWithPrice();
    await seedSale(100);
    await openForm(page);
    const [number] = await saleNumbers();
    await voidThrough(page, number ?? "", "keyed twice");

    await expect(recentItem(page, number ?? "").getByText("Void: keyed twice", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent sales" })).toBeFocused();
  });

  test("AC-0081 and AC-0160: Cancel and Escape close the confirmation, change nothing, and return focus to Void", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const id = await seedSale(100);
    await openForm(page);
    const [number = ""] = await saleNumbers();
    const lots = await finishedSnapshot();
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });

    const dialog = voidDialog(page);
    const reason = dialog.getByLabel("Reason for the void");
    await voidButtonOf(page, number).click();
    await reason.fill("typed by mistake");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(voidButtonOf(page, number)).toBeFocused();

    // Reopening starts with an empty reason, and Escape closes it the same way.
    await voidButtonOf(page, number).click();
    await expect(reason).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(voidButtonOf(page, number)).toBeFocused();

    expect(posts).toEqual([]);
    expect(await saleState(id)).toEqual({ voided: false, reason: null });
    expect(await finishedSnapshot()).toEqual(lots);
  });
});

test.describe("recent sales", () => {
  test("AC-0070, AC-0074, and AC-0076: the 10 last entered of 12, though the last has the earliest date, and the count", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const dates = [
      "2026-10-09",
      "2026-10-10",
      "2026-10-07",
      "2026-10-12",
      "2026-10-08",
      "2026-10-11",
      "2026-10-09",
      "2026-10-12",
      "2026-10-07",
      "2026-10-10",
      "2026-10-11",
      "2026-10-06",
    ];
    const ids: string[] = [];
    for (const date of dates) ids.push(await seedSale(10, date));
    const numbers = await saleNumbers();
    // One void sale outside the 10 and one inside: both count in N.
    for (const index of [0, 4]) {
      const outcome = await callAsOperator(voidSaleCall(ids[index] ?? ""));
      expect(outcome.ok, outcome.error).toBe(true);
    }

    const f = await openForm(page);
    const items = f.recent.getByRole("listitem");
    await expect(items).toHaveCount(10);
    await expect(items.getByRole("heading")).toHaveText(numbers.slice(2).reverse());
    await expect(f.recent.getByText("Showing the 10 most recent of 12 sales.", { exact: true })).toBeVisible();
    await expect(factValue(items.first(), "Sale date")).toHaveText("Oct 6, 2026");

    // AC-0076: a saved sale joins the top of the list, and the count follows.
    await fillSale(f, { lbs: "20", date: "2026-10-08" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: SAVED_HEADING })).toBeVisible();
    const saved = await factValue(f.result, "Sale number").textContent();
    await expect(f.recent.getByText("Showing the 10 most recent of 13 sales.", { exact: true })).toBeVisible();
    await expect(items.first().getByRole("heading")).toHaveText(saved ?? "");
  });

  test("AC-0074: with 10 sales there is no count line", async ({ page }) => {
    await fixtureWithPrice();
    for (let n = 0; n < 10; n++) await seedSale(10);
    const f = await openForm(page);
    await expect(f.recent.getByRole("listitem")).toHaveCount(10);
    await expect(f.recent.getByText(/^Showing the/)).toHaveCount(0);
  });

  test("AC-0071: the sales run last entered first, whatever their dates", async ({ page }) => {
    await fixtureWithPrice();
    for (const date of ["2026-10-09", "2026-10-07", "2026-10-11"]) await seedSale(10, date);
    const numbers = await saleNumbers();
    const f = await openForm(page);
    const items = f.recent.getByRole("listitem");
    await expect(items.getByRole("heading")).toHaveText([...numbers].reverse());
    await expect(factValue(items, "Sale date")).toHaveText(["Oct 11, 2026", "Oct 7, 2026", "Oct 9, 2026"]);
  });

  test("AC-0072 and AC-0073: each sale shows its figures and links to its trace", async ({ page }) => {
    await fixtureWithPrice();
    await seedSale(100, "2026-10-08", 3.29, CUSTOMER_ID);
    await seedSale(2500, "2026-10-09", 4.5);
    const [first = "", second = ""] = await saleNumbers();
    const f = await openForm(page);

    const withCustomer = recentItem(page, first);
    await expect(factValue(withCustomer, "Sale date")).toHaveText("Oct 8, 2026");
    await expect(factValue(withCustomer, "Customer")).toHaveText("Fulton Market Deli");
    await expect(factValue(withCustomer, "Product")).toHaveText("502");
    await expect(factValue(withCustomer, "Lbs")).toHaveText("100 lbs");
    await expect(factValue(withCustomer, "Price per lb")).toHaveText("$3.29/lb");
    await expect(withCustomer.getByRole("link", { name: first, exact: true })).toHaveAttribute(
      "href",
      `/trace?sale=${first}`,
    );

    const without = recentItem(page, second);
    await expect(factValue(without, "Sale date")).toHaveText("Oct 9, 2026");
    await expect(factValue(without, "Customer")).toHaveText("No customer");
    await expect(factValue(without, "Lbs")).toHaveText("2,500 lbs");
    await expect(factValue(without, "Price per lb")).toHaveText("$4.50/lb");
    await expect(without.getByRole("link", { name: second, exact: true })).toHaveAttribute(
      "href",
      `/trace?sale=${second}`,
    );
    await expect(f.recent.getByRole("listitem")).toHaveCount(2);
  });

  test("AC-0075: with no sale the list says so, and the page meets the page-state checks", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await expect(f.recent.getByText("No sales yet.", { exact: true })).toBeVisible();
    await expect(f.recent.getByRole("listitem")).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0077: a sale that is not void has a Void button, and a void one shows its reason", async ({ page }) => {
    await fixtureWithPrice();
    await seedSale(100);
    const second = await seedSale(200);
    expect((await callAsOperator(voidSaleCall(second, "wrong customer"))).ok).toBe(true);
    const [open = "", voided = ""] = await saleNumbers();
    await openForm(page);

    const openItem = recentItem(page, open);
    await expect(voidButtonOf(page, open)).toBeVisible();
    await expect(openItem.getByText(/^Void: /)).toHaveCount(0);
    const voidItem = recentItem(page, voided);
    await expect(voidItem.getByText("Void: wrong customer", { exact: true })).toBeVisible();
    await expect(voidItem.getByRole("button")).toHaveCount(0);
  });
});

test.describe("the void confirmation", () => {
  test("AC-0078 and the open-confirmation page state: it names the sale and asks for a reason", async ({ page }) => {
    await fixtureWithPrice();
    await seedSale(100, "2026-10-08", 3.29, CUSTOMER_ID);
    await seedSale(2500);
    const [first = "", second = ""] = await saleNumbers();
    await openForm(page);
    const dialog = voidDialog(page);

    await voidButtonOf(page, first).click();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`Sale ${first}, 502, 100 lbs, to Fulton Market Deli.`);
    await expect(dialog.getByLabel("Reason for the void")).toBeVisible();
    // Cancel is the first stop and holds focus on open, so Tab reaches the reason next.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Reason for the void")).toBeFocused();
    expect(await checkPageState(page)).toEqual(DIALOG_CONTROLS);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    await voidButtonOf(page, second).click();
    await expect(dialog).toContainText(`Sale ${second}, 502, 2,500 lbs, No customer.`);
  });

  test("AC-0079: the open confirmation's accessible description holds the sale number, lbs, and customer", async ({
    page,
  }) => {
    await fixtureWithPrice();
    await seedSale(100, "2026-10-08", 3.29, CUSTOMER_ID);
    const [number = ""] = await saleNumbers();
    await openForm(page);
    await voidButtonOf(page, number).click();
    await expect(voidDialog(page)).toHaveAccessibleDescription(
      new RegExp(`Sale ${number}, 502, 100 lbs, to Fulton Market Deli\\.`),
    );
  });

  test("AC-0080 and AC-0089: a blank or spaces-only reason shows its message and changes nothing", async ({ page }) => {
    await fixtureWithPrice();
    const id = await seedSale(100);
    const [number = ""] = await saleNumbers();
    await openForm(page);
    const lots = await finishedSnapshot();
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });

    const dialog = voidDialog(page);
    const reason = dialog.getByLabel("Reason for the void");
    await voidButtonOf(page, number).click();
    for (const blank of ["", "   "]) {
      await reason.fill(blank);
      await dialog.getByRole("button", { name: "Void sale", exact: true }).click();
      const message = dialog.getByText("Enter a reason for the void.", { exact: true });
      await expect(message).toBeVisible();
      // The confirmation stays open, the field holds focus and points to the message.
      await expect(reason).toBeFocused();
      await expect(reason).toHaveAttribute("aria-describedby", (await message.getAttribute("id")) ?? "missing");
    }

    expect(posts).toEqual([]);
    expect(await saleState(id)).toEqual({ voided: false, reason: null });
    expect(await finishedSnapshot()).toEqual(lots);
    // The list after an AC-0080 refusal: the confirmation is open with its message.
    expect(await checkPageState(page)).toEqual(DIALOG_CONTROLS);
  });
});

test.describe("voiding", () => {
  test("AC-0082: voiding the 5,000-lb sale shows it as void and puts 5,390 lbs back on hand", async ({ page }) => {
    const f = await enter5000(page);
    const [number = ""] = await saleNumbers();
    await f.code.fill(CODE);
    await expect(factValue(f.facts, "Finished on hand")).toHaveText("390 lbs");
    await f.code.fill("");

    await voidThrough(page, number, "wrong customer");

    await expect(recentItem(page, number).getByText("Void: wrong customer", { exact: true })).toBeVisible();
    await f.code.fill(CODE);
    await expect(factValue(f.facts, "Finished on hand")).toHaveText("5,390 lbs");
  });

  test("AC-0083 and AC-0158: voiding the sale in the Sale saved panel marks the panel and drops its stock", async ({
    page,
  }) => {
    const f = await enter5000(page);
    const [number = ""] = await saleNumbers();
    await expect(beforeAfter(f.result, /on hand/)).toHaveText(["5,390 lbs", "390 lbs"]);
    await expect(f.result.getByText("This sale was voided.")).toHaveCount(0);

    await voidThrough(page, number, "wrong customer");

    await expect(f.result.getByText("This sale was voided.", { exact: true })).toBeVisible();
    await expect(f.result.getByRole("table")).toHaveCount(0);
    await expect(f.result.getByText("Before")).toHaveCount(0);
    await expect(factValue(f.result, "Sale number")).toHaveText(number);
    await expect(page.getByRole("heading", { name: "Recent sales" })).toBeFocused();
    // The form after a void of the sale in the panel; the sale has no Void button now.
    expect(await checkPageState(page)).toEqual([
      ...FORM_CONTROLS,
      "a Trace this sale",
      ...listControls([{ number, voidable: false }]),
    ]);
  });

  test("AC-0084, AC-0089, and AC-0159: a sale voided elsewhere after the list loaded is refused and stays as it was", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const id = await seedSale(100);
    const [number = ""] = await saleNumbers();
    await openForm(page);
    await expect(voidButtonOf(page, number)).toBeVisible();

    // Another session voids the sale after the list shows it as open.
    expect((await callAsOperator(voidSaleCall(id, "voided elsewhere"))).ok).toBe(true);
    const lots = await finishedSnapshot();

    await voidThrough(page, number, "second void");

    const item = recentItem(page, number);
    const message = item.getByRole("alert");
    await expect(message).toHaveText(new RegExp(`^${NOT_VOIDED} `));
    await expect(message).toBeFocused();
    await expect(voidDialog(page)).toBeHidden();
    expect(await saleState(id)).toEqual({ voided: true, reason: "voided elsewhere" });
    expect(await voidMarks()).toBe(1);
    expect(await finishedSnapshot()).toEqual(lots);
    await expect(item.getByText("Void: second void")).toHaveCount(0);
    // The list after an AC-0084 refusal: still showing the sale with its Void button.
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...listControls([{ number, voidable: true }])]);
  });

  test("AC-0034 (the plan's loading row): while a void is pending the pressed button keeps focus, both buttons are disabled, and neither a second confirm, Cancel, nor Escape acts", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const id = await seedSale(100);
    const [number = ""] = await saleNumbers();
    await openForm(page);
    const hold = await holdActionRequests(page);
    await voidThrough(page, number, "keyed twice");

    const dialog = voidDialog(page);
    const confirm = dialog.getByRole("button", { name: "Void sale", exact: true });
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await expect(dialog.getByRole("status")).toHaveText("Voiding…");
    await expect(confirm).toBeFocused();
    await expect(confirm).toHaveAttribute("aria-disabled", "true");
    await expect(cancel).toHaveAttribute("aria-disabled", "true");
    await confirm.click({ force: true });
    await page.keyboard.press("Enter");
    await cancel.click({ force: true });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    expect(hold.held).toBe(1);

    hold.release();
    await expect(recentItem(page, number).getByText("Void: keyed twice", { exact: true })).toBeVisible();
    await expect(dialog).toBeHidden();
    expect(await saleState(id)).toEqual({ voided: true, reason: "keyed twice" });
    expect(hold.held).toBe(1);
  });

  test("AC-0085, AC-0089, and AC-0159: with the session cookies gone, the void is refused and the sale unchanged", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const id = await seedSale(100);
    const [number = ""] = await saleNumbers();
    await openForm(page);
    await expect(voidButtonOf(page, number)).toBeVisible();
    const lots = await finishedSnapshot();

    await page.context().clearCookies();
    await voidThrough(page, number, "keyed twice");

    const message = recentItem(page, number).getByRole("alert");
    await expect(message).toHaveText(VOID_SIGNED_OUT);
    await expect(message).toBeFocused();
    expect(await saleState(id)).toEqual({ voided: false, reason: null });
    expect(await finishedSnapshot()).toEqual(lots);
  });

  test("AC-0085, AC-0089, and AC-0159: a session revoked after the list loaded is refused and the sale unchanged", async ({
    browser,
    baseURL,
  }) => {
    await fixtureWithPrice();
    const id = await seedSale(100);
    const [number = ""] = await saleNumbers();
    const lots = await finishedSnapshot();
    await withOwnSession(browser, baseURL, async (context, page) => {
      await openForm(page);
      await expect(voidButtonOf(page, number)).toBeVisible();
      await endSessionAtAuthServer(context);

      await voidThrough(page, number, "keyed twice");

      const message = recentItem(page, number).getByRole("alert");
      await expect(message).toHaveText(VOID_SIGNED_OUT);
      await expect(message).toBeFocused();
      expect(await saleState(id)).toEqual({ voided: false, reason: null });
      expect(await finishedSnapshot()).toEqual(lots);
    });
  });

  test("AC-0086, AC-0089, and AC-0159: a void whose connection drops keeps the list and says it may not have been voided", async ({
    page,
  }) => {
    await fixtureWithPrice();
    const id = await seedSale(100);
    const [number = ""] = await saleNumbers();
    await openForm(page);
    await expect(voidButtonOf(page, number)).toBeVisible();
    const lots = await finishedSnapshot();
    const dropped = await dropActionRequests(page);

    await voidThrough(page, number, "keyed twice");

    const message = recentItem(page, number).getByRole("alert");
    await expect(message).toHaveText(VOID_UNKNOWN);
    await expect(message).toBeFocused();
    // The request never reached the server; the list is on screen with the sale untouched.
    expect(dropped.count).toBe(1);
    await expect(voidDialog(page)).toBeHidden();
    await expect(voidButtonOf(page, number)).toBeVisible();
    expect(await saleState(id)).toEqual({ voided: false, reason: null });
    expect(await finishedSnapshot()).toEqual(lots);
  });
});

test.describe("page states", () => {
  test("the empty form meets the page-state checks", async ({ page }) => {
    await fixtureWithPrice();
    await openForm(page);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("the form with a product that has a list price meets the page-state checks", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await f.code.fill(CODE);
    await expect(factValue(f.facts, "List price")).toHaveText("$3.29/lb");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("the form with a product that has no list price meets the page-state checks", async ({ page }) => {
    await saleFixture();
    const f = await openForm(page);
    await f.code.fill(CODE);
    await expect(factValue(f.facts, "List price")).toHaveText("No list price yet");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("the form with no active finished product meets the page-state checks", async ({ page }) => {
    await retire502();
    const f = await openForm(page);
    await expect(page.getByText(NO_PRODUCTS, { exact: true })).toBeVisible();
    await expect(f.save).toHaveAttribute("aria-disabled", "true");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("the form after a save meets the page-state checks", async ({ page }) => {
    const f = await enter5000(page);
    const [number = ""] = await saleNumbers();
    await expect(f.recent.getByRole("listitem")).toHaveCount(1);
    expect(await checkPageState(page)).toEqual([
      ...FORM_CONTROLS,
      "a Trace this sale",
      ...listControls([{ number, voidable: true }]),
    ]);
  });

  test("the form after an AC-0047 save meets the page-state checks", async ({ page }) => {
    await fixtureWithPrice();
    const f = await openForm(page);
    await fillSale(f, { lbs: "5000", customer: "Fulton Market Deli", date: "2026-10-08" });
    try {
      await revokeSaleItemsRead();
      await f.save.click();
      await expect(f.result.getByText(DETAILS_MISSING, { exact: true })).toBeVisible();
    } finally {
      await restoreSaleItemsRead();
    }
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "a Trace this sale"]);
  });
});
