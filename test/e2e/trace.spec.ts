import { readFileSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  callAsOperator,
  CUSTOMER_ID,
  produceCall,
  PROD_502_ID,
  resetTestData,
  saleFixture,
  RAW_TOM_ID,
  voidReceiptCall,
  voidSaleCall,
  query,
} from "../db";
import { checkPageState } from "./a11y";
import { setActive } from "./pricing-page";
import { factValue, NOT_ALLOWED } from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";
import {
  batchNumberOf,
  BOLD,
  CODE_REFUSAL,
  DATE_REFUSAL,
  describedText,
  lastSaleNumber,
  open,
  RAW_CODE,
  RAW_NAME,
  receiveIds,
  receiveOn,
  SALE_NUMBER_REFUSAL,
  threeBatchSale,
  TRACE_CONTROLS,
  TWELVE_DATES,
  twoLotSale,
} from "./trace-page";
import { batchNumbersInDrawOrder, seedSale, tabTo } from "./sales-page";

// The trace page, end to end: a real browser over the production build and the
// local database. Fixtures are written through pg and the engine's operations.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// The finished lot cards of a sale's trace, and the raw lots inside one.
function batchCards(result: Locator): Locator {
  return result.locator(":scope > ul > li");
}

function rawLots(card: Locator): Locator {
  return card.locator("ul > li");
}

function saleResult(page: Page, number: string): Locator {
  return page.getByRole("region", { name: number, exact: true });
}

async function pressAndWait(page: Page, press: () => Promise<void>, url: RegExp): Promise<void> {
  await press();
  await expect(page).toHaveURL(url);
}

test.describe("access", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /trace ends on /sign-in", async ({ page }) => {
      await page.goto("/trace");
      await expect(page).toHaveURL(/\/sign-in$/);
    });
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0002: /trace shows the not-allowed message, Sign out, and no form, sale, or lot", async ({ page }) => {
      await saleFixture({ listPrice: true, sale: true });
      await page.goto("/trace?sale=S-5000");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByLabel("Sale number")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Find a sale" })).toHaveCount(0);
      await expect(page.getByText("S-5000")).toHaveCount(0);
      await expect(page.getByText("Fulton Market Deli")).toHaveCount(0);
    });
  });
});

test.describe("find a sale", () => {
  test("AC-0090: /trace shows both finders with their fields and buttons", async ({ page }) => {
    const f = await open(page);
    await expect(f.saleSection.getByRole("heading", { level: 2, name: "Find a sale" })).toBeVisible();
    await expect(f.saleSection.getByLabel("Sale number")).toBeVisible();
    await expect(f.saleSection.getByRole("button", { name: "Show sale" })).toBeVisible();
    await expect(f.lotSection.getByRole("heading", { level: 2, name: "Find a raw lot" })).toBeVisible();
    await expect(f.lotSection.getByLabel("Raw product code")).toBeVisible();
    await expect(f.lotSection.getByLabel("Received date")).toHaveAttribute("type", "date");
    await expect(f.lotSection.getByRole("button", { name: "Show lots" })).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("AC-0091: Show sale shows the sale's trace, with or without spaces around the number", async ({ page }) => {
    await saleFixture({ listPrice: true, sale: true });
    const f = await open(page);
    await f.sale.fill("S-5000");
    await pressAndWait(page, () => f.showSale.click(), /\/trace\?sale=S-5000$/);
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeVisible();

    await open(page);
    await f.sale.fill("   S-5000  ");
    await pressAndWait(page, () => f.showSale.click(), /\/trace\?sale=S-5000$/);
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeVisible();
    await expect(f.sale).toHaveValue("S-5000");
  });

  for (const [name, text] of [
    ["blank", ""],
    ["spaces-only", "    "],
  ] as const) {
    test(`AC-0092: Show sale with a ${name} sale number shows the message beside the field`, async ({ page }) => {
      await saleFixture({ listPrice: true, sale: true });
      const f = await open(page);
      await f.sale.fill(text);
      await f.showSale.click();
      await expect(f.saleSection.getByText(SALE_NUMBER_REFUSAL, { exact: true })).toBeVisible();
      expect(await describedText(f.sale)).toBe(SALE_NUMBER_REFUSAL);
      await expect(page).toHaveURL(/\/trace$/);
      await expect(f.result).toHaveCount(0);
    });
  }

  test("AC-0093: an unknown number is shown as literal text and adds no element", async ({ page }) => {
    await saleFixture({ listPrice: true, sale: true });
    const f = await open(page);
    await f.sale.fill(BOLD);
    await f.showSale.click();
    await expect(page.getByText(`No sale has number ${BOLD}.`, { exact: true })).toBeVisible();
    await expect(page.locator("main b")).toHaveCount(0);

    await open(page, "/trace?sale=S-9999");
    await expect(page.getByText("No sale has number S-9999.", { exact: true })).toBeVisible();
  });
});

test.describe("a sale's trace", () => {
  test("AC-0095: the sale number heads the trace, then the sale's facts", async ({ page }) => {
    await saleFixture({ listPrice: true, sale: true });
    await open(page, "/trace?sale=S-5000");
    const r = saleResult(page, "S-5000");
    await expect(r.getByRole("heading", { level: 2, name: "S-5000" })).toBeVisible();
    await expect(factValue(r, "Sale date")).toHaveText("Oct 8, 2026");
    await expect(factValue(r, "Customer")).toHaveText("Fulton Market Deli");
    await expect(factValue(r, "Product")).toHaveText("502 Smoked Turkey Drums Tom");
    await expect(factValue(r, "Lbs")).toHaveText("5,000 lbs");
    await expect(factValue(r, "Price per lb")).toHaveText("$3.29/lb");
    await expect(r.getByRole("heading", { level: 3, name: "Where it came from" })).toBeVisible();
  });

  test("AC-0095: a sale with no customer says No customer", async ({ page }) => {
    await saleFixture({ listPrice: true });
    await seedSale(100);
    const number = await lastSaleNumber();
    await open(page, `/trace?sale=${number}`);
    await expect(factValue(saleResult(page, number), "Customer")).toHaveText("No customer");
  });

  test("AC-0096, AC-0097, and AC-0098: the 5,000-lb sale's batches and the raw lots under each", async ({ page }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    const batch1 = await batchNumberOf(fx.batch1Id);
    const batch2 = await batchNumberOf(fx.batch2Id);
    await open(page, "/trace?sale=S-5000");
    const r = saleResult(page, "S-5000");

    const cards = batchCards(r);
    await expect(cards).toHaveCount(2);

    const first = cards.nth(0);
    await expect(first.getByRole("heading", { level: 4 }).first()).toHaveText(batch1);
    await expect(factValue(first, "Made")).toHaveText("Oct 6, 2026");
    await expect(factValue(first, "Lbs drawn").first()).toHaveText("4,620 lbs");
    const firstRaw = rawLots(first);
    await expect(firstRaw).toHaveCount(2);
    await expect(firstRaw.nth(0).getByRole("link")).toHaveText(fx.lotANumber);
    await expect(factValue(firstRaw.nth(0), "Raw product")).toHaveText(RAW_NAME);
    await expect(factValue(firstRaw.nth(0), "Vendor")).toHaveText("Reyes Meats");
    await expect(factValue(firstRaw.nth(0), "Received")).toHaveText("Oct 1, 2026");
    await expect(factValue(firstRaw.nth(0), "Lbs drawn")).toHaveText("5,000 lbs");
    await expect(factValue(firstRaw.nth(0), "Cost per lb")).toHaveText("$1.6800/lb");
    await expect(firstRaw.nth(1).getByRole("link")).toHaveText(fx.lotBNumber);
    await expect(factValue(firstRaw.nth(1), "Vendor")).toHaveText("Valley Poultry");
    await expect(factValue(firstRaw.nth(1), "Received")).toHaveText("Oct 5, 2026");
    await expect(factValue(firstRaw.nth(1), "Lbs drawn")).toHaveText("1,000 lbs");
    await expect(factValue(firstRaw.nth(1), "Cost per lb")).toHaveText("$1.8000/lb");

    const second = cards.nth(1);
    await expect(second.getByRole("heading", { level: 4 }).first()).toHaveText(batch2);
    await expect(factValue(second, "Made")).toHaveText("Oct 7, 2026");
    await expect(factValue(second, "Lbs drawn").first()).toHaveText("380 lbs");
    const secondRaw = rawLots(second);
    await expect(secondRaw).toHaveCount(1);
    await expect(secondRaw.nth(0).getByRole("link")).toHaveText(fx.lotBNumber);
    await expect(factValue(secondRaw.nth(0), "Vendor")).toHaveText("Valley Poultry");
    await expect(factValue(secondRaw.nth(0), "Lbs drawn")).toHaveText("1,000 lbs");
    await expect(factValue(secondRaw.nth(0), "Cost per lb")).toHaveText("$1.8000/lb");
  });

  test("AC-0099: the finished lots are in draw order", async ({ page }) => {
    await threeBatchSale();
    const number = await lastSaleNumber();
    const expected = await batchNumbersInDrawOrder();
    await open(page, `/trace?sale=${number}`);
    const cards = batchCards(saleResult(page, number));
    await expect(cards).toHaveCount(3);
    const shown = await cards.locator(":scope > h4").allTextContents();
    expect(shown).toEqual(expected);
    const made = await cards.evaluateAll((items) =>
      items.map((item) => item.querySelector("dd")?.textContent ?? ""),
    );
    expect(made).toEqual(["Oct 6, 2026", "Oct 6, 2026", "Oct 7, 2026"]);
  });

  test("AC-0100: the raw lots under a finished lot are in draw order", async ({ page }) => {
    const { later, earlier } = await twoLotSale();
    const number = await lastSaleNumber();
    await open(page, `/trace?sale=${number}`);
    const cards = batchCards(saleResult(page, number));
    await expect(cards).toHaveCount(1);
    await expect(rawLots(cards.first()).getByRole("link")).toHaveText([earlier, later]);
  });

  test("AC-0101: a raw lot's number links to that lot's trace", async ({ page }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    await open(page, "/trace?sale=S-5000");
    const link = saleResult(page, "S-5000").getByRole("link", { name: fx.lotANumber, exact: true });
    await expect(link).toHaveAttribute("href", `/trace?lot=${encodeURIComponent(fx.lotANumber)}`);
    await link.click();
    await expect(page).toHaveURL(/\/trace\?lot=/);
    await expect(page.getByRole("heading", { level: 2, name: fx.lotANumber })).toBeVisible();
  });

  test("AC-0102: a void sale shows its facts and the reason and no lot", async ({ page }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    const outcome = await callAsOperator(voidSaleCall(fx.saleId ?? "", "wrong customer"));
    expect(outcome.ok, outcome.error).toBe(true);
    await open(page, "/trace?sale=S-5000");
    const r = saleResult(page, "S-5000");
    await expect(r.getByRole("heading", { level: 2, name: "S-5000" })).toBeVisible();
    await expect(factValue(r, "Sale date")).toHaveText("Oct 8, 2026");
    await expect(factValue(r, "Customer")).toHaveText("Fulton Market Deli");
    await expect(factValue(r, "Lbs")).toHaveText("5,000 lbs");
    await expect(r.getByText("This sale was voided: wrong customer.", { exact: true })).toBeVisible();
    await expect(r.getByRole("heading", { name: "Where it came from" })).toHaveCount(0);
    await expect(r.getByRole("listitem")).toHaveCount(0);
    await expect(r.getByRole("link")).toHaveCount(0);
  });
});

test.describe("find a raw lot", () => {
  // The lot numbers a list shows, in order.
  function listed(page: Page): Locator {
    return page.getByRole("region", { name: `Receipts of ${RAW_CODE}` }).getByRole("listitem").getByRole("link");
  }

  // The expected order of lot numbers: received date newest first, then last entered first.
  function newestFirst(numbers: string[], dates: string[]): string[] {
    return numbers
      .map((number, index) => ({ number, date: dates[index] ?? "", index }))
      .sort((a, b) => (a.date === b.date ? b.index - a.index : a.date < b.date ? 1 : -1))
      .map((entry) => entry.number);
  }

  test("AC-0110 and AC-0111: with no date the 10 most recent receipts are listed, with the count", async ({
    page,
  }) => {
    const numbers = await receiveOn(TWELVE_DATES);
    const f = await open(page);
    await f.code.fill(` ${RAW_CODE} `);
    await pressAndWait(page, () => f.showLots.click(), /\/trace\?raw=RAW-TOM$/);
    await expect(page.getByText("Showing the 10 most recent of 12 receipts.", { exact: true })).toBeVisible();
    await expect(listed(page)).toHaveText(newestFirst(numbers, TWELVE_DATES).slice(0, 10));
  });

  test("AC-0110: 10 or fewer receipts are all listed, with no count line", async ({ page }) => {
    const dates = TWELVE_DATES.slice(0, 3);
    const numbers = await receiveOn(dates);
    await open(page, "/trace?raw=RAW-TOM");
    await expect(listed(page)).toHaveText(newestFirst(numbers, dates));
    await expect(page.getByText(/^Showing the/)).toHaveCount(0);
  });

  test("AC-0112: with a date, every receipt of that date is listed, last entered first", async ({ page }) => {
    const numbers = await receiveOn(TWELVE_DATES);
    const f = await open(page);
    await f.code.fill(RAW_CODE);
    await f.received.fill("2026-09-12");
    await pressAndWait(page, () => f.showLots.click(), /\/trace\?raw=RAW-TOM&received=2026-09-12$/);
    await expect(listed(page)).toHaveText([numbers[11] ?? "", numbers[2] ?? ""]);
    await expect(page.getByText(/^Showing the/)).toHaveCount(0);
  });

  test("AC-0113: each receipt shows a link to its trace, its received date, vendor, and weight", async ({ page }) => {
    const numbers = await receiveOn(["2026-09-10"], () => 2500);
    await open(page, "/trace?raw=RAW-TOM");
    const item = page.getByRole("region", { name: `Receipts of ${RAW_CODE}` }).getByRole("listitem");
    await expect(item).toHaveCount(1);
    const link = item.getByRole("link");
    await expect(link).toHaveText(numbers[0] ?? "");
    await expect(link).toHaveAttribute("href", `/trace?lot=${encodeURIComponent(numbers[0] ?? "")}`);
    await expect(factValue(item, "Received")).toHaveText("Sep 10, 2026");
    await expect(factValue(item, "Vendor")).toHaveText("Reyes Meats");
    await expect(factValue(item, "Weight")).toHaveText("2,500 lbs");
  });

  test("AC-0114: a void receipt is not listed, with or without a date", async ({ page }) => {
    const dates = ["2026-09-10", "2026-09-10", "2026-09-11"];
    const ids = await receiveIds(dates);
    const kept = await query<{ lot_number: string }>(
      "select lot_number from lots where id = any($1::uuid[]) order by receipt_seq desc",
      [[ids[0], ids[2]]],
    );
    const outcome = await callAsOperator(voidReceiptCall(ids[1] ?? ""));
    expect(outcome.ok, outcome.error).toBe(true);
    await open(page, "/trace?raw=RAW-TOM");
    await expect(listed(page)).toHaveText(kept.map((row) => row.lot_number));
    await open(page, "/trace?raw=RAW-TOM&received=2026-09-10");
    await expect(listed(page)).toHaveCount(1);
    await expect(listed(page)).toHaveText(
      (await query<{ lot_number: string }>("select lot_number from lots where id = $1", [ids[0]])).map(
        (row) => row.lot_number,
      ),
    );
  });

  test("AC-0115: the receipts of an inactive raw product are listed", async ({ page }) => {
    const dates = ["2026-09-10", "2026-09-11"];
    const numbers = await receiveOn(dates);
    await setActive(RAW_TOM_ID, false);
    await open(page, "/trace?raw=RAW-TOM");
    await expect(listed(page)).toHaveText(newestFirst(numbers, dates));
    await open(page, "/trace?raw=RAW-TOM&received=2026-09-10");
    await expect(listed(page)).toHaveText([numbers[0] ?? ""]);
  });

  test("AC-0116: a code that is not a raw product's code says so, as literal text", async ({ page }) => {
    await saleFixture({ listPrice: true });
    const f = await open(page);
    await f.code.fill(BOLD);
    await pressAndWait(page, () => f.showLots.click(), /\/trace\?raw=/);
    await expect(page.getByText(`No raw product has code ${BOLD}.`, { exact: true })).toBeVisible();
    await expect(page.locator("main b")).toHaveCount(0);

    await f.code.fill("502");
    await f.showLots.click();
    await expect(page.getByText("No raw product has code 502.", { exact: true })).toBeVisible();
  });

  test("AC-0117: a raw product with no non-void receipt and no date says it has none yet", async ({ page }) => {
    await open(page, "/trace?raw=RAW-TOM");
    await expect(page.getByText("No receipts of RAW-TOM yet.", { exact: true })).toBeVisible();

    const [id] = await receiveIds(["2026-09-10"]);
    await callAsOperator(voidReceiptCall(id ?? ""));
    await open(page, "/trace?raw=RAW-TOM");
    await expect(page.getByText("No receipts of RAW-TOM yet.", { exact: true })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ has: page.getByRole("link", { name: /^L/ }) })).toHaveCount(0);
  });

  test("AC-0118: a date with no receipt says so, in the date format", async ({ page }) => {
    await receiveOn(["2026-09-10"]);
    const f = await open(page);
    await f.code.fill(RAW_CODE);
    await f.received.fill("2026-09-30");
    await pressAndWait(page, () => f.showLots.click(), /received=2026-09-30$/);
    await expect(
      page.getByText("No receipt of RAW-TOM was received on Sep 30, 2026.", { exact: true }),
    ).toBeVisible();
  });

  test("AC-0119: a blank or spaces-only code is refused beside its field and lists no receipt", async ({ page }) => {
    await receiveOn(["2026-09-10"]);
    const f = await open(page);
    for (const text of ["", "   "]) {
      await f.code.fill(text);
      await f.showLots.click();
      await expect(f.lotSection.getByText(CODE_REFUSAL, { exact: true })).toBeVisible();
      expect(await describedText(f.code)).toBe(CODE_REFUSAL);
      await expect(f.received).not.toHaveAttribute("aria-invalid", "true");
      await expect(page).toHaveURL(/\/trace$/);
      await expect(f.result).toHaveCount(0);
    }
  });

  test("AC-0119: a received date that is not a calendar date is refused beside its field", async ({ page }) => {
    await receiveOn(["2026-09-10"]);
    // A date input cannot hold 2026-02-30, so the bad date arrives as a typed URL.
    const f = await open(page, "/trace?raw=RAW-TOM&received=2026-02-30");
    await expect(f.lotSection.getByText(DATE_REFUSAL, { exact: true })).toBeVisible();
    expect(await describedText(f.received)).toBe(DATE_REFUSAL);
    await expect(f.code).not.toHaveAttribute("aria-invalid", "true");
    await expect(f.code).toHaveValue("RAW-TOM");
    await expect(f.result).toHaveCount(0);

    // Both fields wrong: each shows its own message, the code row first.
    await open(page, "/trace?raw=&received=2026-02-30");
    expect(await describedText(f.code)).toBe(CODE_REFUSAL);
    expect(await describedText(f.received)).toBe(DATE_REFUSAL);
    await expect(f.result).toHaveCount(0);
  });
});

// A lot's trace result, and the list items under one of its h3 headings.
function lotResult(page: Page, number: string): Locator {
  return page.getByRole("region", { name: number, exact: true });
}

function under(result: Locator, heading: string): Locator {
  return result.locator(`h3:text-is("${heading}") + ul > li`);
}

// Each item's h4 text, then the text of each of its facts.
function rowsOf(items: Locator): Promise<string[][]> {
  return items.evaluateAll((nodes) =>
    nodes.map((node) => [
      node.querySelector("h4")?.textContent ?? "",
      ...[...node.querySelectorAll("dd")].map((value) => value.textContent ?? ""),
    ]),
  );
}

const FULTON = "Fulton Market Deli";
const SALES_FROM_LOT = "Sales from this lot";
const STOCK_HEADING = "Finished stock on hand from this lot";
const NO_STOCK = "No finished stock from this lot is on hand.";
const NO_SALE = "No sale was made from this lot.";

async function addCustomer(name: string): Promise<string> {
  const rows = await query<{ id: string }>("insert into customers(name) values ($1) returning id", [name]);
  return rows[0]?.id ?? "";
}

test.describe("a lot's trace", () => {
  test("AC-0120 and AC-0121: the heading, then the lot's facts, over lot B after the 5,000-lb sale", async ({
    page,
  }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    await open(page, `/trace?lot=${fx.lotBNumber}`);
    const r = lotResult(page, fx.lotBNumber);
    await expect(r.getByRole("heading", { level: 2, name: fx.lotBNumber })).toBeVisible();
    await expect(r.locator(":scope > dl dt")).toHaveText([
      "Raw product",
      "Vendor",
      "Received",
      "Weight received",
      "Cost per lb",
      "Raw on hand",
    ]);
    await expect(factValue(r, "Raw product")).toHaveText(RAW_NAME);
    await expect(factValue(r, "Vendor")).toHaveText("Valley Poultry");
    await expect(factValue(r, "Received")).toHaveText("Oct 5, 2026");
    await expect(factValue(r, "Weight received")).toHaveText("3,000 lbs");
    await expect(factValue(r, "Cost per lb")).toHaveText("$1.8000/lb");
    await expect(factValue(r, "Raw on hand")).toHaveText("1,000 lbs");
  });

  test("AC-0122: customers are listed once, by name ignoring case, then No customer; a void sale's is not", async ({
    page,
  }) => {
    const fx = await saleFixture({ listPrice: true });
    const beta = await addCustomer("beta Deli");
    const alpha = await addCustomer("Alpha Foods");
    await seedSale(1, "2026-10-08", 3.29, CUSTOMER_ID);
    await seedSale(1, "2026-10-08", 3.29, CUSTOMER_ID);
    await seedSale(1, "2026-10-08", 3.29, beta);
    await seedSale(1, "2026-10-08", 3.29, null);
    const voided = await seedSale(1, "2026-10-08", 3.29, alpha);
    const outcome = await callAsOperator(voidSaleCall(voided, "wrong customer"));
    expect(outcome.ok, outcome.error).toBe(true);

    await open(page, `/trace?lot=${fx.lotBNumber}`);
    const r = lotResult(page, fx.lotBNumber);
    await expect(r.getByRole("heading", { level: 3, name: "Customers" })).toBeVisible();
    await expect(under(r, "Customers")).toHaveText(["beta Deli", FULTON, "No customer"]);
    await expect(under(r, SALES_FROM_LOT)).toHaveCount(4);
  });

  test("AC-0123, AC-0125: each sale line shows its facts, and the 5,000-lb sale is listed once per batch", async ({
    page,
  }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    const batch1 = await batchNumberOf(fx.batch1Id);
    const batch2 = await batchNumberOf(fx.batch2Id);
    await open(page, `/trace?lot=${fx.lotBNumber}`);
    const r = lotResult(page, fx.lotBNumber);
    await expect(r.getByRole("heading", { level: 3, name: SALES_FROM_LOT })).toBeVisible();
    const items = under(r, SALES_FROM_LOT);
    await expect(items.first().locator("dt")).toHaveText([
      "Sale date",
      "Customer",
      "Product",
      "Batch number",
      "Lbs drawn",
    ]);
    await expect(items.getByRole("link")).toHaveCount(2);
    for (const link of await items.getByRole("link").all()) {
      await expect(link).toHaveAttribute("href", "/trace?sale=S-5000");
    }
    expect(await rowsOf(items)).toEqual([
      ["S-5000", "Oct 8, 2026", FULTON, "502", batch1, "4,620 lbs"],
      ["S-5000", "Oct 8, 2026", FULTON, "502", batch2, "380 lbs"],
    ]);

    await open(page, `/trace?lot=${fx.lotANumber}`);
    expect(await rowsOf(under(lotResult(page, fx.lotANumber), SALES_FROM_LOT))).toEqual([
      ["S-5000", "Oct 8, 2026", FULTON, "502", batch1, "4,620 lbs"],
    ]);
  });

  test("AC-0124: sales are listed by sale date newest first, then last entered first, lines in draw order", async ({
    page,
  }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    const batch1 = await batchNumberOf(fx.batch1Id);
    const batch2 = await batchNumberOf(fx.batch2Id);
    const numbers: string[] = [];
    for (const date of ["2026-10-10", "2026-10-08", "2026-10-09"]) {
      await seedSale(1, date);
      numbers.push(await lastSaleNumber());
    }
    await open(page, `/trace?lot=${fx.lotBNumber}`);
    const rows = await rowsOf(under(lotResult(page, fx.lotBNumber), SALES_FROM_LOT));
    expect(rows.map((row) => [row[0], row[1], row[4]])).toEqual([
      [numbers[0], "Oct 10, 2026", batch2],
      [numbers[2], "Oct 9, 2026", batch2],
      [numbers[1], "Oct 8, 2026", batch2],
      ["S-5000", "Oct 8, 2026", batch1],
      ["S-5000", "Oct 8, 2026", batch2],
    ]);
  });

  test("AC-0126: a void sale's lines are not listed", async ({ page }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    const outcome = await callAsOperator(voidSaleCall(fx.saleId ?? "", "wrong customer"));
    expect(outcome.ok, outcome.error).toBe(true);
    await seedSale(10);
    const kept = await lastSaleNumber();
    await open(page, `/trace?lot=${fx.lotBNumber}`);
    const r = lotResult(page, fx.lotBNumber);
    expect((await rowsOf(under(r, SALES_FROM_LOT))).map((row) => row[0])).toEqual([kept]);
    await expect(r.getByText("S-5000")).toHaveCount(0);
  });

  test("AC-0127, AC-0128, and AC-0129: a lot with no sale says so; its finished stock is listed in draw order", async ({
    page,
  }) => {
    const fx = await saleFixture({ listPrice: true });
    const batch1 = await batchNumberOf(fx.batch1Id);
    const batch2 = await batchNumberOf(fx.batch2Id);
    await open(page, `/trace?lot=${fx.lotBNumber}`);
    const r = lotResult(page, fx.lotBNumber);
    await expect(r.getByText(NO_SALE, { exact: true })).toBeVisible();
    await expect(r.getByRole("heading", { name: "Customers" })).toHaveCount(0);
    await expect(r.getByRole("heading", { name: SALES_FROM_LOT })).toHaveCount(0);
    await expect(r.getByRole("heading", { level: 3, name: STOCK_HEADING })).toBeVisible();
    const stock = under(r, STOCK_HEADING);
    await expect(stock.first().locator("dt")).toHaveText(["Product", "Made", "Lbs on hand"]);
    expect(await rowsOf(stock)).toEqual([
      [batch1, "502 Smoked Turkey Drums Tom", "Oct 6, 2026", "4,620 lbs"],
      [batch2, "502 Smoked Turkey Drums Tom", "Oct 7, 2026", "770 lbs"],
    ]);

    await open(page, `/trace?lot=${fx.lotANumber}`);
    expect(await rowsOf(under(lotResult(page, fx.lotANumber), STOCK_HEADING))).toEqual([
      [batch1, "502 Smoked Turkey Drums Tom", "Oct 6, 2026", "4,620 lbs"],
    ]);
  });

  test("AC-0130 and AC-0131: after the 5,000-lb sale, lot B holds batch 2 only and lot A holds none", async ({
    page,
  }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    const batch2 = await batchNumberOf(fx.batch2Id);
    await open(page, `/trace?lot=${fx.lotBNumber}`);
    expect(await rowsOf(under(lotResult(page, fx.lotBNumber), STOCK_HEADING))).toEqual([
      [batch2, "502 Smoked Turkey Drums Tom", "Oct 7, 2026", "390 lbs"],
    ]);

    await open(page, `/trace?lot=${fx.lotANumber}`);
    const a = lotResult(page, fx.lotANumber);
    await expect(a.getByText(NO_STOCK, { exact: true })).toBeVisible();
    await expect(under(a, STOCK_HEADING)).toHaveCount(0);
  });

  test("AC-0132: a void receipt's trace shows its heading, facts, and the void reason", async ({ page }) => {
    const [id] = await receiveIds(["2026-09-10"]);
    const outcome = await callAsOperator(voidReceiptCall(id ?? "", "entered twice"));
    expect(outcome.ok, outcome.error).toBe(true);
    const [row] = await query<{ lot_number: string }>("select lot_number from lots where id = $1", [id]);
    const number = row?.lot_number ?? "";
    await open(page, `/trace?lot=${number}`);
    const r = lotResult(page, number);
    await expect(r.getByRole("heading", { level: 2, name: number })).toBeVisible();
    await expect(factValue(r, "Raw product")).toHaveText(RAW_NAME);
    await expect(factValue(r, "Vendor")).toHaveText("Reyes Meats");
    await expect(factValue(r, "Received")).toHaveText("Sep 10, 2026");
    await expect(factValue(r, "Weight received")).toHaveText("100 lbs");
    await expect(r.getByText("This receipt was voided: entered twice.", { exact: true })).toBeVisible();
  });

  test("AC-0134: an unknown lot number says so as literal text and adds no element", async ({ page }) => {
    await saleFixture({ listPrice: true });
    await open(page, `/trace?lot=${encodeURIComponent(BOLD)}`);
    await expect(page.getByText(`No receipt has lot number ${BOLD}.`, { exact: true })).toBeVisible();
    await expect(page.locator("main b")).toHaveCount(0);

    await open(page, "/trace?lot=L-9999");
    await expect(page.getByText("No receipt has lot number L-9999.", { exact: true })).toBeVisible();
  });

  test("AC-0135: every sale and customer is listed past max_rows", async ({ page }) => {
    test.setTimeout(900_000);
    const toml = readFileSync("supabase/config.toml", "utf8");
    const maxRows = Number(/^max_rows\s*=\s*(\d+)/m.exec(toml)?.[1]);
    expect(maxRows).toBeGreaterThan(0);
    const [lot] = await receiveOn(["2026-10-01"], () => 5000);
    const made = await callAsOperator(produceCall(PROD_502_ID, 2000, null, "2026-10-01"));
    expect(made.ok, made.error).toBe(true);
    const oldest = await addCustomer("Oldest Co");
    for (let i = 0; i <= maxRows; i++) {
      const sold = await callAsOperator({
        fn: "record_sale",
        args: {
          p_finished_product_id: PROD_502_ID,
          p_lbs: 1,
          p_price_per_lb: 3.29,
          p_customer_id: i === 0 ? oldest : CUSTOMER_ID,
          p_sale_date: "2026-10-08",
          p_sale_number: `B-${String(i).padStart(5, "0")}`,
        },
      });
      expect(sold.ok, sold.error).toBe(true);
    }
    await open(page, `/trace?lot=${lot}`);
    const r = lotResult(page, lot ?? "");
    const sales = under(r, SALES_FROM_LOT);
    await expect(sales).toHaveCount(maxRows + 1, { timeout: 120_000 });
    await expect(r.getByRole("link")).toHaveCount(maxRows + 1);
    await expect(under(r, "Customers")).toHaveText(["Fulton Market Deli", "Oldest Co"]);
    await expect(sales.last().getByRole("link")).toHaveText("B-00000");
    await expect(factValue(sales.last(), "Customer")).toHaveText("Oldest Co");
  });
});

test.describe("focus after Show sale and Show lots", () => {
  test("the result heading, or the no-result sentence, takes focus; a typed URL does not", async ({ page }) => {
    await saleFixture({ listPrice: true, sale: true });
    const f = await open(page);
    await f.sale.fill("S-5000");
    await f.showSale.click();
    await expect(page).toHaveURL(/\/trace\?sale=S-5000$/);
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeFocused();

    await f.sale.fill(BOLD);
    await f.showSale.click();
    await expect(page.getByText(`No sale has number ${BOLD}.`, { exact: true })).toBeFocused();

    await f.code.fill(RAW_CODE);
    await f.showLots.click();
    await expect(page).toHaveURL(/\/trace\?raw=RAW-TOM$/);
    await expect(page.getByRole("heading", { level: 2, name: `Receipts of ${RAW_CODE}` })).toBeFocused();

    await f.code.fill("NOPE");
    await f.showLots.click();
    await expect(page.getByText("No raw product has code NOPE.", { exact: true })).toBeFocused();

    // Pressing Show sale again for the number on the page puts focus on its heading too.
    await open(page, "/trace?sale=S-5000");
    const heading = page.getByRole("heading", { level: 2, name: "S-5000" });
    await expect(heading).not.toBeFocused();
    await f.showSale.click();
    await expect(heading).toBeFocused();
  });

  test("the result is not in a live region", async ({ page }) => {
    await saleFixture({ listPrice: true, sale: true });
    await open(page, "/trace?sale=S-5000");
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.locator("main [aria-live]")).toHaveCount(0);
  });
});

test.describe("keyboard and focus", () => {
  test("AC-0153: Show sale, Show lots, and a lot and a sale link are used with the keyboard alone", async ({
    page,
  }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    const f = await open(page);

    await tabTo(page, f.sale);
    await page.keyboard.type("S-5000");
    await tabTo(page, f.showSale);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/trace\?sale=S-5000$/);
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeFocused();

    const lotLink = saleResult(page, "S-5000").getByRole("link", { name: fx.lotANumber, exact: true });
    await tabTo(page, lotLink);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/trace\?lot=/);
    await expect(page.getByRole("heading", { level: 2, name: fx.lotANumber })).toBeFocused();

    const saleLink = lotResult(page, fx.lotANumber).getByRole("link", { name: "S-5000", exact: true });
    await tabTo(page, saleLink, 40);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/trace\?sale=S-5000$/);
    await expect(saleResult(page, "S-5000").getByRole("heading", { level: 3 })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeFocused();

    // Back and Forward move to a new lookup too, so focus follows them.
    await page.goBack();
    await expect(page).toHaveURL(/\/trace\?lot=/);
    await expect(page.getByRole("heading", { level: 2, name: fx.lotANumber })).toBeFocused();
    await page.goForward();
    await expect(page).toHaveURL(/\/trace\?sale=S-5000$/);
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeFocused();

    await open(page);
    await tabTo(page, f.code);
    await page.keyboard.type(RAW_CODE);
    await tabTo(page, f.showLots);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/trace\?raw=RAW-TOM$/);
    await expect(page.getByRole("heading", { level: 2, name: `Receipts of ${RAW_CODE}` })).toBeFocused();
  });

  test("AC-0155, AC-0156, and the page state after AC-0092: focus is on the sale field, which is described", async ({
    page,
  }) => {
    const f = await open(page);
    await f.showSale.click();
    await expect(f.sale).toBeFocused();
    await expect(f.sale).toHaveAttribute("aria-invalid", "true");
    await expect(f.sale).toHaveAttribute("aria-describedby", "find-sale-number-error");
    expect(await describedText(f.sale)).toBe(SALE_NUMBER_REFUSAL);
    await expect(f.code).not.toHaveAttribute("aria-invalid", "true");
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("AC-0155, AC-0156, and the page state after AC-0119: focus is on the code field, which is described", async ({
    page,
  }) => {
    const f = await open(page);
    await f.showLots.click();
    await expect(f.code).toBeFocused();
    await expect(f.code).toHaveAttribute("aria-invalid", "true");
    await expect(f.code).toHaveAttribute("aria-describedby", "find-raw-code-error");
    expect(await describedText(f.code)).toBe(CODE_REFUSAL);
    await expect(f.received).not.toHaveAttribute("aria-invalid", "true");
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("AC-0155 and AC-0156: a date refused alone is described, and focus goes to it on a refused press", async ({
    page,
  }) => {
    await receiveOn(["2026-09-10"]);
    const f = await open(page, "/trace?raw=RAW-TOM&received=2026-02-30");
    await expect(f.received).toHaveAttribute("aria-describedby", "find-received-error");
    expect(await describedText(f.received)).toBe(DATE_REFUSAL);
    await f.code.fill("");
    await f.showLots.click();
    await expect(f.code).toBeFocused();
    expect(await describedText(f.code)).toBe(CODE_REFUSAL);
  });
});

test.describe("page states", () => {
  const withLinks = (...labels: string[]) => [...TRACE_CONTROLS, ...labels.map((label) => `a ${label}`)];

  async function resultLinks(page: Page): Promise<string[]> {
    return (await page.getByRole("main").locator("section[aria-labelledby] a").allTextContents()).map((t) => t.trim());
  }

  test("a sale's trace", async ({ page }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    await open(page, "/trace?sale=S-5000");
    await expect(page.getByRole("heading", { level: 2, name: "S-5000" })).toBeVisible();
    expect(await checkPageState(page)).toEqual(withLinks(fx.lotANumber, fx.lotBNumber, fx.lotBNumber));
  });

  test("a void sale's trace", async ({ page }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    await callAsOperator(voidSaleCall(fx.saleId ?? "", "wrong customer"));
    await open(page, "/trace?sale=S-5000");
    await expect(page.getByText("This sale was voided: wrong customer.")).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("an AC-0093 page", async ({ page }) => {
    const f = await open(page);
    await f.sale.fill(BOLD);
    await f.showSale.click();
    await expect(page.getByText(`No sale has number ${BOLD}.`, { exact: true })).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("a lot list", async ({ page }) => {
    const numbers = await receiveOn(TWELVE_DATES.slice(0, 3));
    await open(page, "/trace?raw=RAW-TOM");
    await expect(page.getByRole("heading", { level: 2, name: "Receipts of RAW-TOM" })).toBeVisible();
    const links = await resultLinks(page);
    expect([...links].sort()).toEqual([...numbers].sort());
    expect(await checkPageState(page)).toEqual(withLinks(...links));
  });

  test("a lot list with more than 10 receipts", async ({ page }) => {
    await receiveOn(TWELVE_DATES);
    await open(page, "/trace?raw=RAW-TOM");
    await expect(page.getByText("Showing the 10 most recent of 12 receipts.", { exact: true })).toBeVisible();
    const links = await resultLinks(page);
    expect(links).toHaveLength(10);
    expect(await checkPageState(page)).toEqual(withLinks(...links));
  });

  test("an AC-0116 page", async ({ page }) => {
    const f = await open(page);
    await f.code.fill(BOLD);
    await f.showLots.click();
    await expect(page.getByText(`No raw product has code ${BOLD}.`, { exact: true })).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("an AC-0117 page", async ({ page }) => {
    await open(page, "/trace?raw=RAW-TOM");
    await expect(page.getByText("No receipts of RAW-TOM yet.", { exact: true })).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("a lot's trace with sales and finished stock", async ({ page }) => {
    const fx = await saleFixture({ listPrice: true, sale: true });
    await open(page, `/trace?lot=${fx.lotBNumber}`);
    await expect(under(lotResult(page, fx.lotBNumber), STOCK_HEADING)).toHaveCount(1);
    expect(await checkPageState(page)).toEqual(withLinks("S-5000", "S-5000"));
  });

  test("a lot's trace with neither", async ({ page }) => {
    const [number] = await receiveOn(["2026-10-01"]);
    await open(page, `/trace?lot=${number}`);
    const r = lotResult(page, number ?? "");
    await expect(r.getByText(NO_SALE, { exact: true })).toBeVisible();
    await expect(r.getByText(NO_STOCK, { exact: true })).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("a void receipt's trace", async ({ page }) => {
    const [id] = await receiveIds(["2026-09-10"]);
    await callAsOperator(voidReceiptCall(id ?? "", "entered twice"));
    const [row] = await query<{ lot_number: string }>("select lot_number from lots where id = $1", [id]);
    await open(page, `/trace?lot=${row?.lot_number}`);
    await expect(page.getByText("This receipt was voided: entered twice.", { exact: true })).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test("an AC-0134 page", async ({ page }) => {
    await open(page, `/trace?lot=${encodeURIComponent(BOLD)}`);
    await expect(page.getByText(`No receipt has lot number ${BOLD}.`, { exact: true })).toBeVisible();
    expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    for (const path of ["/trace", "/sales"]) {
      test(`the non-operator page at ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
        expect(await checkPageState(page)).toEqual(["button Sign out"]);
      });
    }
  });
});
