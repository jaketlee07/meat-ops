import { expect, test, type Locator, type Page } from "@playwright/test";
import { callAsOperator, CUSTOMER_ID, resetTestData, reverseCall, voidSaleCall } from "../db";
import { checkDesktopWalk, checkPageState } from "./a11y";
import {
  BATCH_URL,
  batchItem,
  batchNumberOf,
  fillBatch,
  FORM_CONTROLS,
  openForm,
  reversePanel,
  reverseButton,
  reverseMessage,
  reverseThrough,
  saveThrough,
  seed502Fixture,
  seedBatch,
} from "./production-page";
import {
  correctPanel,
  correctThrough,
  factValue,
  fillReceipt,
  lotNumberOf,
  openForm as openReceivingForm,
  RAW_TOM_URL,
  receiptItem,
  RECEIVING_FORM,
  seedReceipt,
} from "./receiving-page";
import {
  fillSale,
  fixtureWithPrice,
  FORM_CONTROLS as SALE_FORM_CONTROLS,
  listControls,
  openForm as openSalesForm,
  recentItem,
  saleNumbers,
  seedSale,
  voidButtonOf,
  voidThrough,
} from "./sales-page";
import {
  box,
  boxes,
  values,
  withTextSize,
  expectNoCap,
  type RowList,
  expectTable,
  expectNoSpill,
  expectCards,
  expectEitherFits,
  expectSpansRow,
  expectButtonsInside,
  expectTablesFit,
} from "./look-checks";
import { OPERATOR_STATE } from "./states";
import { lastSaleNumber, open as openTrace, receiveOn, threeBatchSale, TRACE_CONTROLS, TWELVE_DATES, twoLotSale } from "./trace-page";

// The look E floor pages at the widths where their layout changes: Production's and Sales' two-column
// layouts, Production's stock tiles, the Recent batches and Recent sales tables, and Trace's side-by-side
// forms and its three lists. Operator session; data is reset before each test.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

const BATCH_FIGURES = ["Batch number", "Production date", "Raw lbs in", "Finished lbs out", "Cost per finished lb"];

function productionForm(page: Page): Locator {
  return page.getByRole("form", { name: "New batch" });
}

function stockCard(page: Page): Locator {
  return page.getByRole("region", { name: "Product and raw stock" });
}

function recentBatches(page: Page): Locator {
  return page.getByRole("region", { name: "Recent batches" });
}

// Three batches of 502: the first two written through the engine, the third saved through the
// page, then the second reversed through the page. The page is left on the third batch's "Batch
// saved" result and the second batch's "Batch reversed" panel, at the given size. The list reads,
// newest first: the third batch, the reversed second, the first.
async function opensProduction(page: Page, width: number, height: number) {
  await seed502Fixture();
  const firstId = await seedBatch(2000, "2026-10-06");
  const secondId = await seedBatch(1500, "2026-10-07");
  const second = await batchNumberOf(secondId);
  await page.setViewportSize({ width: 1280, height: 900 });
  const f = await openForm(page, BATCH_URL);
  await expect(recentBatches(page).locator("li")).toHaveCount(2);
  await fillBatch(f, { raw: "1000", date: "2026-10-08" });
  await saveThrough(page, f);
  await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeVisible();
  await expect(recentBatches(page).locator("li")).toHaveCount(3);
  const item = batchItem(page, second);
  await reverseThrough(page, item, second, "entered twice");
  await expect(reversePanel(item).getByRole("heading", { name: "Batch reversed" })).toBeVisible();
  await page.setViewportSize({ width, height });
  return { f, first: await batchNumberOf(firstId), firstId, item };
}

// The three listed batches, in page order, as a list of rows.
function batchList(page: Page): RowList {
  const recent = recentBatches(page);
  return {
    // Each batch's dialog holds lists of its own, so the rows are the list's direct children.
    items: recent.locator(":scope > div > ul > li"),
    header: recent.locator("div[aria-hidden='true']"),
    names: [...BATCH_FIGURES, ""],
    figures: BATCH_FIGURES,
    numbered: false,
    numeric: ["Raw lbs in", "Finished lbs out", "Cost per finished lb"],
  };
}

// What Tab reaches with the three batches listed: the form, then a Reverse button for each batch
// that is not reversed.
const CONTROLS = [...FORM_CONTROLS, "button Reverse", "button Reverse"];

test.describe("the Production layout", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /production lifts the 34rem cap on every child of main but a dialog at ${width}x${height}`, async ({
      page,
    }) => {
      await opensProduction(page, width, height);
      await expectNoCap(page);
    });

    test(`AC-0002: at ${width}x${height} the title is above, and the form and result are left of the stock card and Recent batches`, async ({
      page,
    }) => {
      const { f } = await opensProduction(page, width, height);
      const title = await box(page.getByRole("heading", { level: 1, name: "Production" }));
      const form = await box(productionForm(page));
      const result = await box(f.result);
      const stock = await box(stockCard(page));
      const recent = await box(recentBatches(page));
      expect(title.y + title.height).toBeLessThanOrEqual(form.y);
      expect(title.y + title.height).toBeLessThanOrEqual(stock.y);
      expect(Math.abs(form.y - stock.y)).toBeLessThanOrEqual(1);
      expect(form.x + form.width).toBeLessThanOrEqual(stock.x);
      expect(form.x + form.width).toBeLessThanOrEqual(recent.x);
      expect(result.x + result.width, "the result is left of the stock card").toBeLessThanOrEqual(stock.x);
      expect(result.x + result.width, "the result is left of Recent batches").toBeLessThanOrEqual(recent.x);
      expect(form.y + form.height, "the result is below the form").toBeLessThanOrEqual(result.y + 1);
      expect(stock.y + stock.height).toBeLessThanOrEqual(recent.y);
    });
  }

  for (const [width, height] of [
    [1023, 768],
    [390, 844],
  ] as const) {
    test(`AC-0003: at ${width}x${height} the form, the result, the stock card, and Recent batches run top to bottom`, async ({
      page,
    }) => {
      const { f } = await opensProduction(page, width, height);
      const form = await box(productionForm(page));
      const result = await box(f.result);
      const stock = await box(stockCard(page));
      const recent = await box(recentBatches(page));
      expect(form.y + form.height).toBeLessThanOrEqual(result.y);
      expect(result.y + result.height).toBeLessThanOrEqual(stock.y);
      expect(stock.y + stock.height).toBeLessThanOrEqual(recent.y);
    });
  }

  for (const [width, height] of [
    [390, 844],
    [1280, 720],
  ] as const) {
    test(`AC-0004: at ${width}x${height} Raw on hand and Raw average cost are two tiles side by side, each label above its value`, async ({
      page,
    }) => {
      const { f } = await opensProduction(page, width, height);
      const tiles = [];
      for (const label of ["Raw on hand", "Raw average cost"]) {
        const term = f.region.locator("dt").filter({ hasText: new RegExp(`^${label}$`) });
        const value = factValue(f.region, label);
        await expect(value).toBeVisible();
        const [name, figure, tile] = await Promise.all([box(term), box(value), box(term.locator(".."))]);
        expect(name.y + name.height, `${label}: the label is above its value`).toBeLessThanOrEqual(figure.y + 1);
        expect(figure.y, `${label}: the value is below its label`).toBeGreaterThan(name.y);
        tiles.push(tile);
      }
      expect(Math.abs(tiles[0]!.y - tiles[1]!.y), "the tiles share a top").toBeLessThanOrEqual(1);
      expect(tiles[0]!.x + tiles[0]!.width, "the second tile is right of the first").toBeLessThanOrEqual(tiles[1]!.x);
    });
  }

  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0005: at ${width}x${height} a batch reads as one row under a header line`, async ({ page }) => {
      await opensProduction(page, width, height);
      await expectTable(batchList(page), 3);

      if (width === 1280) {
        expect(await checkPageState(page)).toEqual(CONTROLS);
        await checkDesktopWalk(page);
      }
    });
  }

  for (const [width, height, size] of [
    [390, 844, 16],
    [1024, 768, 16],
    [1280, 900, 20],
  ] as const) {
    test(`AC-0006: at ${width}x${height} with ${size} px text each batch stays a card, its figures on their own lines beside visible labels`, async ({
      page,
    }) => {
      await opensProduction(page, width, height);
      if (size !== 16) await withTextSize(page, width, height, size);
      await expectCards(batchList(page), 3);
    });
  }

  // The panel and the refusal take the batch's whole row only in the table look, which shows at 1280 px.
  test("AC-0007, AC-0027: at 1280x720 a batch's Batch reversed panel spans its row below the figures, and its tables stay in the section", async ({
    page,
  }) => {
    const { item } = await opensProduction(page, 1280, 720);
    const panel = reversePanel(item);
    await expect(panel.getByRole("heading", { name: "Batch reversed" })).toBeVisible();
    await expect(recentBatches(page).locator("div[aria-hidden='true']"), "the table shows").toBeVisible();

    const section = await box(recentBatches(page));
    await expectSpansRow(item, panel, "the panel");
    const tables = await boxes(panel.locator("table"));
    expect(tables.length, "before and after tables").toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.x, "a table starts inside the section").toBeGreaterThanOrEqual(section.x);
      expect(table.x + table.width, "a table ends inside the section").toBeLessThanOrEqual(section.x + section.width);
    }
    expect(await checkPageState(page)).toEqual(CONTROLS);
    await checkDesktopWalk(page);
  });

  test("AC-0007: at 1280x720 a reverse refusal spans its batch's row below the figures", async ({ page }) => {
    const { first, firstId } = await opensProduction(page, 1280, 720);
    // The first batch is reversed behind the page's back, so its Reverse button is refused.
    const outcome = await callAsOperator(reverseCall(firstId, "keyed twice"));
    expect(outcome.ok, outcome.error).toBe(true);
    const item = batchItem(page, first);
    const before = await box(reverseButton(item));
    await reverseThrough(page, item, first, "entered twice");
    const message = reverseMessage(item);
    await expect(message).toHaveText(/./);

    const figures = await box(item.locator(":scope > dl"));
    expect(before.x, "the Reverse button sat in the last column, right of the figures").toBeGreaterThanOrEqual(
      figures.x + figures.width - 1,
    );
    await expectSpansRow(item, message.locator("..").locator(".."), "the message area");
  });

  for (const [width, height, size] of [
    [390, 844, 16],
    [1024, 768, 16],
    [1280, 720, 16],
    [1440, 900, 16],
    [1280, 720, 20],
  ] as const) {
    test(`AC-0029: at ${width}x${height} with ${size} px text every Reverse batch button sits inside Recent batches`, async ({
      page,
    }) => {
      await opensProduction(page, width, height);
      if (size !== 16) await withTextSize(page, width, height, size);
      await expectButtonsInside(recentBatches(page), recentBatches(page).getByRole("button", { name: /^Reverse batch / }), 2);
    });
  }
});

const SALE_FIGURES = ["Sale date", "Customer", "Product", "Lbs", "Price per lb"];

function salesForm(page: Page): Locator {
  return page.getByRole("form", { name: "New sale" });
}

function recentSales(page: Page): Locator {
  return page.getByRole("region", { name: "Recent sales" });
}

// The listed sales, in page order, as a list of rows: the sale number is the row's own cell.
function saleList(page: Page): RowList {
  const recent = recentSales(page);
  return {
    items: recent.locator(":scope > div > ul > li"),
    header: recent.locator("div[aria-hidden='true']"),
    names: [...SALE_FIGURES, ""],
    figures: SALE_FIGURES,
    numbered: true,
    stacked: true,
    numeric: ["Lbs", "Price per lb"],
  };
}

// Three sales of 502: the first two written through the engine (the first with no customer, the
// second to the deli), the third saved through the page, then the second voided through the page.
// The page is left on the third sale's "Sale saved" result and the second sale's "Voided" tag and its reason, at the
// given size. The list reads, newest first: the third sale, the void second, the first.
async function opensSales(page: Page, width: number, height: number) {
  await fixtureWithPrice();
  const firstId = await seedSale(2000, "2026-10-06");
  await seedSale(1500, "2026-10-07", 3.29, CUSTOMER_ID);
  await page.setViewportSize({ width: 1280, height: 900 });
  const f = await openSalesForm(page);
  await expect(recentSales(page).locator("li")).toHaveCount(2);
  await fillSale(f, { lbs: "100", customer: "Fulton Market Deli", date: "2026-10-08" });
  await f.save.click();
  await expect(f.result.getByRole("heading", { name: "Sale saved" })).toBeVisible();
  await expect(recentSales(page).locator("li")).toHaveCount(3);
  const [first = "", second = "", third = ""] = await saleNumbers();
  await voidThrough(page, second, "keyed twice");
  await expect(recentItem(page, second).getByText("Voided", { exact: true })).toBeVisible();
  await expect(recentItem(page, second).getByText("keyed twice", { exact: true })).toBeVisible();
  await page.setViewportSize({ width, height });
  return { f, first, firstId, second, third };
}

// What Tab reaches with the three sales listed and the third's result showing.
function saleControls(numbers: { first: string; second: string; third: string }): string[] {
  return [
    ...SALE_FORM_CONTROLS,
    "a Trace this sale",
    ...listControls([
      { number: numbers.third, voidable: true },
      { number: numbers.second, voidable: false },
      { number: numbers.first, voidable: true },
    ]),
  ];
}

test.describe("the Sales layout", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /sales lifts the 34rem cap on every child of main but a dialog at ${width}x${height}`, async ({
      page,
    }) => {
      await opensSales(page, width, height);
      await expectNoCap(page);
    });

    test(`AC-0008: at ${width}x${height} the title is above the form, and the form and result are left of Recent sales`, async ({
      page,
    }) => {
      const { f } = await opensSales(page, width, height);
      const title = await box(page.getByRole("heading", { level: 1, name: "Sales" }));
      const form = await box(salesForm(page));
      const result = await box(f.result);
      const recent = await box(recentSales(page));
      expect(title.y + title.height).toBeLessThanOrEqual(form.y);
      expect(title.y + title.height).toBeLessThanOrEqual(recent.y);
      expect(Math.abs(form.y - recent.y)).toBeLessThanOrEqual(1);
      expect(form.x + form.width).toBeLessThanOrEqual(recent.x);
      expect(result.x + result.width, "the result is left of Recent sales").toBeLessThanOrEqual(recent.x);
      expect(form.y + form.height, "the result is below the form").toBeLessThanOrEqual(result.y + 1);
    });
  }

  for (const [width, height] of [
    [1023, 768],
    [390, 844],
  ] as const) {
    test(`AC-0009: at ${width}x${height} the form, the result, and Recent sales run top to bottom`, async ({ page }) => {
      const { f } = await opensSales(page, width, height);
      const form = await box(salesForm(page));
      const result = await box(f.result);
      const recent = await box(recentSales(page));
      expect(form.y + form.height).toBeLessThanOrEqual(result.y);
      expect(result.y + result.height).toBeLessThanOrEqual(recent.y);
    });
  }

  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0010: at ${width}x${height} a sale reads as one row under a header line`, async ({ page }) => {
      const numbers = await opensSales(page, width, height);
      await expectTable(saleList(page), 3);

      if (width === 1280) {
        expect(await checkPageState(page)).toEqual(saleControls(numbers));
        await checkDesktopWalk(page);
      }
    });
  }

  for (const [width, height, size] of [
    [390, 844, 16],
    [1024, 768, 16],
    [1280, 900, 20],
  ] as const) {
    test(`AC-0011: at ${width}x${height} with ${size} px text each sale stays a card, its figures on their own lines beside visible labels`, async ({
      page,
    }) => {
      await opensSales(page, width, height);
      if (size !== 16) await withTextSize(page, width, height, size);
      await expectCards(saleList(page), 3);
    });
  }

  // The refusal takes the sale's whole row only in the table look, which shows at 1280 px.
  test("AC-0012: at 1280x720 a void refusal spans its sale's row below the figures", async ({ page }) => {
    const { first, firstId } = await opensSales(page, 1280, 720);
    // The first sale is voided behind the page's back, so its Void button is refused.
    const outcome = await callAsOperator(voidSaleCall(firstId));
    expect(outcome.ok, outcome.error).toBe(true);
    const item = recentItem(page, first);
    await expect(recentSales(page).locator("div[aria-hidden='true']"), "the table shows").toBeVisible();
    const before = await box(voidButtonOf(page, first));
    await voidThrough(page, first, "keyed twice");
    const message = item.getByRole("alert");
    await expect(message).toHaveText(/./);

    const figures = await box(item.locator(":scope > dl"));
    expect(before.x, "the Void button sat in the last column, right of the figures").toBeGreaterThanOrEqual(
      figures.x + figures.width - 1,
    );
    await expectSpansRow(item, message.locator("..").locator(".."), "the message area");
  });

  for (const [width, height, size] of [
    [390, 844, 16],
    [1024, 768, 16],
    [1280, 720, 16],
    [1440, 900, 16],
    [1280, 720, 20],
  ] as const) {
    test(`AC-0030: at ${width}x${height} with ${size} px text every Void sale button sits inside Recent sales`, async ({
      page,
    }) => {
      await opensSales(page, width, height);
      if (size !== 16) await withTextSize(page, width, height, size);
      await expectButtonsInside(recentSales(page), recentSales(page).getByRole("button", { name: /^Void sale / }), 2);
    });
  }
});

// Trace.

// A lot's trace with two sales, a customer on one, and finished stock on hand: the lot first received
// is the one the batch drew from first, the later lot is traced. The page is left on the lot trace at
// the given size.
async function opensLotTrace(page: Page, width: number, height: number) {
  const { later } = await twoLotSale();
  await seedSale(20, "2026-10-07", 3.29, CUSTOMER_ID);
  await page.setViewportSize({ width, height });
  await openTrace(page, `/trace?lot=${later}`);
  const lot = page.getByRole("region", { name: later, exact: true });
  await expect(lot.getByRole("heading", { level: 2, name: later })).toBeVisible();
  return { lot, later };
}

// A sale's trace over three batches, and the raw lots they drew from.
async function opensSaleTrace(page: Page, width: number, height: number) {
  await threeBatchSale();
  const number = await lastSaleNumber();
  await page.setViewportSize({ width, height });
  await openTrace(page, `/trace?sale=${number}`);
  const sale = page.getByRole("region", { name: number, exact: true });
  await expect(sale.getByRole("heading", { level: 2, name: number })).toBeVisible();
  return { sale, number };
}

// Three receipts of RAW-TOM, listed newest received first.
async function opensLotList(page: Page, width: number, height: number) {
  await receiveOn(TWELVE_DATES.slice(0, 3));
  await page.setViewportSize({ width, height });
  await openTrace(page, "/trace?raw=RAW-TOM");
  const list = page.getByRole("region", { name: "Receipts of RAW-TOM" });
  await expect(list.getByRole("heading", { level: 2, name: "Receipts of RAW-TOM" })).toBeVisible();
  return { list };
}

// A result's heading and its facts list are one white card: the heading's bottom edge is the facts list's top.
async function expectCardJoin(result: Locator) {
  const card = await box(result.locator(":scope > h2"));
  const facts = await box(result.locator(":scope > dl"));
  expect(Math.abs(card.y + card.height - facts.y), "the card runs from its heading into its facts").toBeLessThanOrEqual(1);
}

// What Tab reaches on a result: the finder's controls, then each link in the result, in page order.
async function traceControls(result: Locator): Promise<string[]> {
  const links = (await result.locator("a").allTextContents()).map((text) => text.trim());
  return [...TRACE_CONTROLS, ...links.map((label) => `a ${label}`)];
}

// Trace's three lists.
function salesFromLot(lot: Locator): RowList {
  const heading = lot.locator('h3:text-is("Sales from this lot")');
  return {
    items: heading.locator("+ ul > li"),
    header: heading.locator("~ div[aria-hidden='true']"),
    names: ["Sale number", "Sale date", "Customer", "Product", "Batch number", "Lbs drawn"],
    figures: ["Sale date", "Customer", "Product", "Batch number", "Lbs drawn"],
    numbered: true,
    numeric: ["Lbs drawn"],
  };
}

function stockFromLot(lot: Locator): RowList {
  const heading = lot.locator('h3:text-is("Finished stock on hand from this lot")');
  return {
    items: heading.locator("+ ul > li"),
    header: heading.locator("~ div[aria-hidden='true']"),
    names: ["Batch number", "Product", "Made", "Lbs on hand"],
    figures: ["Product", "Made", "Lbs on hand"],
    numbered: true,
    numeric: ["Lbs on hand"],
  };
}

function receiptsOf(list: Locator): RowList {
  return {
    items: list.locator("ul > li"),
    header: list.locator("div[aria-hidden='true']"),
    names: ["Lot number", "Received", "Vendor", "Weight"],
    figures: ["Received", "Vendor", "Weight"],
    numbered: true,
    numeric: ["Weight"],
  };
}

const TRACE_WIDTHS = [
  [1280, 720],
  [1440, 900],
] as const;

test.describe("the Trace layout", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /trace lifts the 34rem cap on every child of main but a dialog at ${width}x${height}`, async ({
      page,
    }) => {
      await opensLotTrace(page, width, height);
      await expectNoCap(page);
    });

    test(`AC-0013: at ${width}x${height} Find a sale is left of Find a raw lot, their tops level`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const f = await openTrace(page);
      const sale = await box(f.saleSection);
      const lot = await box(f.lotSection);
      expect(Math.abs(sale.y - lot.y), "tops level").toBeLessThanOrEqual(1);
      expect(sale.x + sale.width, "Find a sale is left of Find a raw lot").toBeLessThanOrEqual(lot.x);
      if (width === 1280) {
        expect(await checkPageState(page)).toEqual(TRACE_CONTROLS);
        await checkDesktopWalk(page);
      }
    });
  }

  test("AC-0028: at 390x844 Find a sale is above Find a raw lot", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const f = await openTrace(page);
    const sale = await box(f.saleSection);
    const lot = await box(f.lotSection);
    expect(sale.y + sale.height, "Find a sale is above Find a raw lot").toBeLessThanOrEqual(lot.y);
  });

  for (const [width, height] of TRACE_WIDTHS) {
    test(`AC-0014: at ${width}x${height} Sales from this lot reads as a table under a header line`, async ({ page }) => {
      const { lot } = await opensLotTrace(page, width, height);
      await expectTable(salesFromLot(lot), 2);
      if (width === 1280) {
        expect(await checkPageState(page)).toEqual(await traceControls(lot));
        await checkDesktopWalk(page);
      }
    });

    test(`AC-0015: at ${width}x${height} Finished stock on hand from this lot reads as a table under a header line`, async ({
      page,
    }) => {
      const { lot } = await opensLotTrace(page, width, height);
      await expectTable(stockFromLot(lot), 1);
    });

    test(`AC-0016: at ${width}x${height} the raw lot list reads as a table under a header line`, async ({ page }) => {
      const { list } = await opensLotList(page, width, height);
      await expectTable(receiptsOf(list), 3);
      if (width === 1280) {
        expect(await checkPageState(page)).toEqual(await traceControls(list));
        await checkDesktopWalk(page);
      }
    });

    test(`AC-0014, AC-0015: at ${width}x${height} with 20 px text no figure runs past its cell, and a card keeps its labels beside its values`, async ({
      page,
    }) => {
      const { lot } = await opensLotTrace(page, width, height);
      await withTextSize(page, width, height, 20);
      await expectEitherFits(salesFromLot(lot), 2);
      await expectEitherFits(stockFromLot(lot), 1);
    });

    test(`AC-0016: at ${width}x${height} with 20 px text no figure runs past its cell, and a card keeps its labels beside its values`, async ({
      page,
    }) => {
      const { list } = await opensLotList(page, width, height);
      await withTextSize(page, width, height, 20);
      await expectEitherFits(receiptsOf(list), 3);
    });
  }

  test("AC-0014, AC-0015: at 390x844 each sale and each batch is a card with its labels beside its values", async ({
    page,
  }) => {
    const { lot } = await opensLotTrace(page, 390, 844);
    await expectCards(salesFromLot(lot), 2);
    await expectCards(stockFromLot(lot), 1);
  });

  test("AC-0016: at 390x844 each lot is a card with its labels beside its values", async ({ page }) => {
    const { list } = await opensLotList(page, 390, 844);
    await expectCards(receiptsOf(list), 3);
  });

  for (const [width, height, beside] of [
    [1024, 768, false],
    [1280, 720, true],
    [1440, 900, true],
  ] as const) {
    test(`at ${width}x${height} Customers sits ${beside ? "beside" : "above"} Sales from this lot`, async ({ page }) => {
      const { lot } = await opensLotTrace(page, width, height);
      const customers = await box(lot.locator('h3:text-is("Customers")').locator(".."));
      const sales = await box(lot.locator('h3:text-is("Sales from this lot")').locator("../.."));
      if (beside) {
        expect(customers.x + customers.width, "Customers is left of Sales").toBeLessThanOrEqual(sales.x);
        expect(Math.abs(customers.y - sales.y), "tops level").toBeLessThanOrEqual(1);
      } else {
        expect(customers.y + customers.height, "Customers is above Sales").toBeLessThanOrEqual(sales.y);
      }
      await expectCardJoin(lot);
    });
  }

  test("at 1280x720 the sale's heading runs into its facts, each batch is a card, and the page checks pass", async ({
    page,
  }) => {
    const { sale } = await opensSaleTrace(page, 1280, 720);
    await expectCardJoin(sale);
    // A batch that loses its card loses its border, its rounded corners, or its white fill.
    const cards = await sale.locator(":scope > ul > li").evaluateAll((items) =>
      items.map((item) => {
        const style = getComputedStyle(item);
        return {
          border: style.borderTopWidth,
          radius: parseFloat(style.borderTopLeftRadius) > 0,
          fill: style.backgroundColor,
        };
      }),
    );
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.border, "a batch card has a border").toBe("1px");
      expect(card.radius, "a batch card has rounded corners").toBe(true);
      expect(card.fill, "a batch card has the surface fill").toBe("rgb(255, 255, 255)");
    }
    expect(await checkPageState(page)).toEqual(await traceControls(sale));
    await checkDesktopWalk(page);
  });
});

// ---- Long figures ----

// Two raw lots of 987,654.321 lbs at $12.3456, two batches of 346,913.578 lbs, and two sales of
// 100,000.123 lbs at $12.34: every weight column holds a six-digit weight with three decimals, and every
// cost and price is $10 or more. Returns the first lot's number; both batches drew from it.
async function seedLongRows(): Promise<string> {
  const first = await seedReceipt(987654.321, 12.3456, "2026-10-01");
  await seedReceipt(987654.321, 12.3456, "2026-10-02");
  await seedBatch(346913.578, "2026-10-06", 346913.578);
  await seedBatch(346913.578, "2026-10-07", 346913.578);
  await seedSale(100000.123, "2026-10-08", 12.34, CUSTOMER_ID);
  await seedSale(100000.123, "2026-10-09", 12.34, CUSTOMER_ID);
  return lotNumberOf(first);
}

test.describe("the lists with long figures", () => {
  for (const [width, height] of TRACE_WIDTHS) {
    test(`AC-0005: at ${width}x${height} each batch with six-digit weights and a cost of $10 or more reads as one row, every number whole in its cell`, async ({
      page,
    }) => {
      await seedLongRows();
      await page.setViewportSize({ width, height });
      await openForm(page, BATCH_URL);
      await expectTable(batchList(page), 2);
    });

    test(`AC-0010: at ${width}x${height} each sale with a six-digit weight and a price of $10 or more reads as one row, every number whole in its cell`, async ({
      page,
    }) => {
      await seedLongRows();
      await page.setViewportSize({ width, height });
      await openSalesForm(page);
      await expectTable(saleList(page), 2);
    });

    test(`AC-0014, AC-0015: at ${width}x${height} the lot's sales and finished stock with six-digit weights read as tables, every number whole in its cell`, async ({
      page,
    }) => {
      const lot = await seedLongRows();
      await page.setViewportSize({ width, height });
      await openTrace(page, `/trace?lot=${lot}`);
      const result = page.getByRole("region", { name: lot, exact: true });
      await expectTable(salesFromLot(result), 2);
      await expectTable(stockFromLot(result), 2);
    });

    test(`AC-0016: at ${width}x${height} the raw lot list with six-digit weights reads as a table, every number whole in its cell`, async ({
      page,
    }) => {
      await seedLongRows();
      await page.setViewportSize({ width, height });
      await openTrace(page, "/trace?raw=RAW-TOM");
      await expectTable(receiptsOf(page.getByRole("region", { name: "Receipts of RAW-TOM" })), 2);
    });

    test(`AC-0014, AC-0015, AC-0016: at ${width}x${height} with 20 px text and long figures no figure runs past its cell, and a card keeps its labels beside its values`, async ({
      page,
    }) => {
      const lot = await seedLongRows();
      await page.setViewportSize({ width, height });
      await openTrace(page, `/trace?lot=${lot}`);
      const result = page.getByRole("region", { name: lot, exact: true });
      await withTextSize(page, width, height, 20);
      await expectEitherFits(salesFromLot(result), 2);
      await expectEitherFits(stockFromLot(result), 2);
      await openTrace(page, "/trace?raw=RAW-TOM");
      await withTextSize(page, width, height, 20);
      await expectEitherFits(receiptsOf(page.getByRole("region", { name: "Receipts of RAW-TOM" })), 2);
    });
  }

  test("AC-0006: at 1280x900 with 20 px text and long figures each batch stays a card and no figure runs past its cell", async ({
    page,
  }) => {
    await seedLongRows();
    await openForm(page, BATCH_URL);
    await withTextSize(page, 1280, 900, 20);
    await expectCards(batchList(page), 2);
    await expectNoSpill(batchList(page), 2);
  });

  test("AC-0011: at 1280x900 with 20 px text and long figures each sale stays a card and no figure runs past its cell", async ({
    page,
  }) => {
    await seedLongRows();
    await openSalesForm(page);
    await withTextSize(page, 1280, 900, 20);
    await expectCards(saleList(page), 2);
    await expectNoSpill(saleList(page), 2);
  });
});

// ---- The saved result stays under the form ----

// With ten recent rows and a result just saved: the form card ends within its own bottom padding and border
// plus 1 px below its Save button, and the result starts at or below the form and no more than 1rem plus 1 px
// below it.
async function expectResultUnderForm(page: Page, form: Locator, save: Locator, result: Locator) {
  const handles = { form: await form.elementHandle(), save: await save.elementHandle(), result: await result.elementHandle() };
  expect(handles.form && handles.save && handles.result, "the form, its Save button, and the result are in the page").toBeTruthy();
  const measured = await page.evaluate(({ form, save, result }) => {
    const style = getComputedStyle(form);
    return {
      formBottom: form.getBoundingClientRect().bottom,
      saveBottom: save.getBoundingClientRect().bottom,
      resultTop: result.getBoundingClientRect().top,
      padding: parseFloat(style.paddingBottom) + parseFloat(style.borderBottomWidth),
      rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
    };
  }, { form: handles.form!, save: handles.save!, result: handles.result! });
  expect(measured.formBottom - measured.saveBottom, "the form ends just below its Save button").toBeLessThanOrEqual(
    measured.padding + 1,
  );
  expect(measured.resultTop, "the result is at or below the form").toBeGreaterThanOrEqual(measured.formBottom);
  expect(measured.resultTop - measured.formBottom, "the result starts within 1rem of the form").toBeLessThanOrEqual(
    measured.rem + 1,
  );
}

const GAP_SIZES = [
  [1024, 768, 16],
  [1280, 720, 16],
  [1280, 720, 20],
] as const;

test.describe("the saved result under the form", () => {
  for (const [width, height, px] of GAP_SIZES) {
    test(`AC-0032: /production at ${width}x${height}, ${px} px text, with ten recent batches the saved result starts under the form`, async ({
      page,
    }) => {
      await seed502Fixture();
      for (let day = 1; day <= 10; day += 1) await seedBatch(100, `2026-10-${String(day).padStart(2, "0")}`);
      await page.setViewportSize({ width: 1280, height: 900 });
      const f = await openForm(page, BATCH_URL);
      await expect(recentBatches(page).locator("li")).toHaveCount(10);
      await fillBatch(f, { raw: "100", date: "2026-10-11" });
      await saveThrough(page, f);
      await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeVisible();
      await withTextSize(page, width, height, px);
      const form = page.getByRole("form", { name: "New batch" });
      await expectResultUnderForm(page, form, form.getByRole("button", { name: "Save", exact: true }), f.result);
    });

    test(`AC-0032: /sales at ${width}x${height}, ${px} px text, with ten recent sales the saved result starts under the form`, async ({
      page,
    }) => {
      await fixtureWithPrice();
      for (let day = 11; day <= 20; day += 1) await seedSale(10, `2026-10-${day}`);
      await page.setViewportSize({ width: 1280, height: 900 });
      const f = await openSalesForm(page);
      await expect(recentSales(page).locator("li")).toHaveCount(10);
      await fillSale(f, { lbs: "10", date: "2026-10-21" });
      await f.save.click();
      await expect(f.result.getByRole("heading", { name: "Sale saved" })).toBeVisible();
      await withTextSize(page, width, height, px);
      const form = page.getByRole("form", { name: "New sale" });
      await expectResultUnderForm(page, form, form.getByRole("button", { name: "Save sale", exact: true }), f.result);
    });

    test(`AC-0032: /receiving at ${width}x${height}, ${px} px text, with ten recent receipts the saved result starts under the form`, async ({
      page,
    }) => {
      for (let day = 1; day <= 10; day += 1) await seedReceipt(100 + day, 1.5, `2026-10-${String(day).padStart(2, "0")}`);
      await page.setViewportSize({ width: 1280, height: 900 });
      const f = await openReceivingForm(page, RAW_TOM_URL);
      await expect(page.getByRole("region", { name: "Recent receipts" }).locator("li")).toHaveCount(10);
      await fillReceipt(f, { weight: "100", cost: "1.9" });
      await f.save.click();
      await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeVisible();
      await withTextSize(page, width, height, px);
      const form = page.getByRole("form", { name: RECEIVING_FORM });
      await expectResultUnderForm(page, form, form.getByRole("button", { name: "Save", exact: true }), f.result);
    });
  }
});

async function atSize(page: Page, [width, height, px]: readonly [number, number, number]) {
  await withTextSize(page, width, height, px);
  return `${width}x${height}, ${px} px text`;
}

const RESULT_SIZES = [
  [1024, 768, 16],
  [1280, 720, 16],
  [1440, 900, 16],
  [1280, 720, 20],
] as const;

const PANEL_SIZES = [
  [390, 844, 20],
  [1024, 768, 20],
  [1280, 720, 16],
] as const;

test.describe("before-and-after tables in saved results", () => {
  test("AC-0033: /production, the saved result's table fits the card at every size with long figures", async ({ page }) => {
    await seedReceipt(987654.321, 12.3456, "2026-10-01");
    await page.setViewportSize({ width: 1280, height: 900 });
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, { raw: "123456.789", date: "2026-10-08" });
    await saveThrough(page, f);
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeVisible();
    for (const size of RESULT_SIZES) await expectTablesFit(`production ${await atSize(page, size)}`, f.result, 1, 4);
  });

  test("AC-0033: /sales, the saved result's table fits the card at every size with long figures", async ({ page }) => {
    await seedReceipt(987654.321, 12.3456, "2026-10-01");
    await seedBatch(346913.578, "2026-10-06", 346913.578);
    await page.setViewportSize({ width: 1280, height: 900 });
    const f = await openSalesForm(page);
    await fillSale(f, { lbs: "123456.789", price: "12.34", customer: "Fulton Market Deli", date: "2026-10-08" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Sale saved" })).toBeVisible();
    for (const size of RESULT_SIZES) await expectTablesFit(`sales ${await atSize(page, size)}`, f.result, 1, 2);
  });

  test("AC-0033: /receiving, the saved result's tables fit the card at every size with long figures", async ({ page }) => {
    await seedReceipt(987654.321, 12.3456, "2026-10-01");
    await seedBatch(246913.578, "2026-10-06", 246913.578);
    await page.setViewportSize({ width: 1280, height: 900 });
    const f = await openReceivingForm(page);
    await fillReceipt(f, { weight: "123456.789", cost: "12.5" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeVisible();
    for (const size of RESULT_SIZES) await expectTablesFit(`receiving ${await atSize(page, size)}`, f.result, 2, 6);
  });

  test("AC-0034: /production, the Batch reversed panel's tables fit its batch at every size with long figures", async ({
    page,
  }) => {
    await seedReceipt(987654.321, 12.3456, "2026-10-01");
    const batchId = await seedBatch(346913.578, "2026-10-06", 346913.578);
    await seedSale(123456.789, "2026-10-08", 12.34, CUSTOMER_ID);
    const number = await batchNumberOf(batchId);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openForm(page, BATCH_URL);
    const item = batchItem(page, number);
    await reverseThrough(page, item, number, "entered twice");
    await expect(reversePanel(item).getByRole("heading", { name: "Batch reversed" })).toBeVisible();
    for (const size of PANEL_SIZES) await expectTablesFit(`production panel ${await atSize(page, size)}`, item, 2, 6);
  });

  test("AC-0034: /receiving, the Receipt corrected panel's tables fit its receipt at every size with long figures", async ({
    page,
  }) => {
    const lotId = await seedReceipt(987654.321, 12.3456, "2026-10-01");
    await seedBatch(246913.578, "2026-10-06", 246913.578);
    const lot = await lotNumberOf(lotId);
    await page.setViewportSize({ width: 1280, height: 900 });
    await openReceivingForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lot);
    await correctThrough(page, item, lot, { cost: "12.5", weight: "999999.999" });
    await expect(correctPanel(item).getByRole("heading", { name: "Receipt corrected" })).toBeVisible();
    await expect(item.locator("th", { hasText: "Cost per finished lb" }), "the batch table shows").toBeVisible();
    for (const size of PANEL_SIZES) await expectTablesFit(`receiving panel ${await atSize(page, size)}`, item, 3, 14);
  });
});
