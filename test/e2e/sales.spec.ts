import { expect, test, type Locator, type Page } from "@playwright/test";
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
} from "../db";
import { addFinished, retire502, setListPrice } from "./menu-page";
import { captureAction, replayText } from "./pricing-page";
import { deviceDate, factValue, beforeAfter, NOT_ALLOWED, sendsActionRequest } from "./receiving-page";
import {
  batchNumbersInDrawOrder,
  CODE,
  DETAILS_MISSING,
  finishedSnapshot,
  fillSale,
  fixtureWithPrice,
  holdActionRequests,
  NO_PRODUCTS,
  openForm,
  readValues,
  restoreSaleItemsRead,
  revokeSaleItemsRead,
  SAVED_HEADING,
  saleCount,
  saleRows,
  seedSale,
  SIGNED_OUT,
  voidMarks,
  VOID_SIGNED_OUT,
  voidThrough,
} from "./sales-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// The sales page, end to end: a real browser over the production build and the
// local database. Raw tables are read through pg to show what was or was not
// written. Refusals, failures, the recent sales list and its void, keyboard and
// focus, and the page-state checks are in the next part of this suite.

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
    const sent = await captureAction(page, () => voidThrough(page, sale?.sale_number ?? "", "wrong customer"));
    await expect.poll(voidMarks).toBe(1);
    const lots = await finishedSnapshot();
    for (const { who, storageState } of replays) {
      const text = await replayText(playwright, baseURL, sent, storageState);
      if (storageState) expect(text, `response for ${who}`).toContain(NOT_ALLOWED);
      else expect(text, `response for ${who}`).toContain(VOID_SIGNED_OUT);
      expect(await voidMarks(), `void marks after ${who}`).toBe(1);
      expect(await finishedSnapshot(), `finished lots after ${who}`).toEqual(lots);
    }
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

test.describe("the result", () => {
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
