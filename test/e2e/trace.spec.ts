import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  callAsOperator,
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
import { batchNumbersInDrawOrder, seedSale } from "./sales-page";

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
      await expect(f.status).toBeEmpty();
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
      await expect(f.status).toBeEmpty();
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
    await expect(f.status).toBeEmpty();

    // Both fields wrong: each shows its own message, the code row first.
    await open(page, "/trace?raw=&received=2026-02-30");
    expect(await describedText(f.code)).toBe(CODE_REFUSAL);
    expect(await describedText(f.received)).toBe(DATE_REFUSAL);
    await expect(f.status).toBeEmpty();
  });
});
