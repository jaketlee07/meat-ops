import { expect, test, type Locator, type Page } from "@playwright/test";
import { callAsOperator, resetTestData, reverseCall } from "../db";
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
import { factValue } from "./receiving-page";
import { OPERATOR_STATE } from "./states";

// The look E floor pages at the widths where their layout changes: Production's two-column
// layout, stock tiles, and Recent batches table. Operator session; data is reset before each test.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

const BATCH_FIGURES = ["Batch number", "Production date", "Raw lbs in", "Finished lbs out", "Cost per finished lb"];

async function box(target: Locator) {
  const found = await target.boundingBox();
  expect(found, "box").not.toBeNull();
  return found!;
}

async function boxes(scope: Locator) {
  return Promise.all((await scope.all()).map((item) => box(item)));
}

function values(scope: Locator): Locator {
  return scope.locator("dd");
}

function productionForm(page: Page): Locator {
  return page.getByRole("form", { name: "New batch" });
}

function stockCard(page: Page): Locator {
  return page.getByRole("region", { name: "Product and raw stock" });
}

function recentBatches(page: Page): Locator {
  return page.getByRole("region", { name: "Recent batches" });
}

async function withTextSize(page: Page, width: number, height: number, px: number) {
  await page.setViewportSize({ width, height });
  await page.evaluate((size) => {
    document.documentElement.style.fontSize = `${size}px`;
  }, px);
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

// Each of the three listed batches, in page order.
function rowsOf(page: Page): Locator {
  return recentBatches(page).locator("li");
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
      const widths = await page.locator("main > *").evaluateAll((children) =>
        children.filter((child) => child.tagName !== "DIALOG").map((child) => getComputedStyle(child).maxWidth),
      );
      expect(widths.length).toBeGreaterThan(2);
      expect(widths.filter((value) => value !== "none")).toEqual([]);
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
      const recent = recentBatches(page);
      const header = recent.locator("div[aria-hidden='true']");
      await expect(header).toBeVisible();
      const names = (await header.locator("span").allTextContents()).map((text) => text.trim());
      expect(names).toEqual([...BATCH_FIGURES, ""]);
      const columns = await boxes(header.locator("span"));

      const rows = await rowsOf(page).all();
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        const cells = await boxes(values(row.locator(":scope > dl")));
        expect(cells).toHaveLength(5);
        const tops = cells.map((cell) => cell.y);
        expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(4);
        // Each figure sits in the column the header line names, in the header's order.
        cells.forEach((cell, index) => {
          expect(Math.abs(cell.x - columns[index]!.x), `column ${index} left`).toBeLessThanOrEqual(1);
          expect(Math.abs(cell.width - columns[index]!.width), `column ${index} width`).toBeLessThanOrEqual(1);
        });
        // The labels are hidden visually here: the header line names the columns.
        for (const label of await boxes(row.locator(":scope > dl dt"))) expect(label.width).toBeLessThanOrEqual(1);
        expect(await row.locator(":scope > dl dt").allTextContents()).toEqual(BATCH_FIGURES);
      }

      // No figure's text runs past its cell.
      const fits = await recent.locator("li > dl dd").evaluateAll((cells) =>
        cells.map((cell) => ({ text: cell.textContent, fits: cell.scrollWidth <= cell.clientWidth })),
      );
      expect(fits).toHaveLength(3 * 5);
      expect(fits.filter((cell) => !cell.fits)).toEqual([]);

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
      const recent = recentBatches(page);
      await expect(recent.locator("div[aria-hidden='true']"), "the table is off").toBeHidden();
      const rows = await rowsOf(page).all();
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        const figures = row.locator(":scope > dl");
        const cells = await boxes(values(figures));
        const labels = await boxes(figures.locator("dt"));
        expect(cells).toHaveLength(5);
        expect(labels).toHaveLength(5);
        for (let i = 1; i < cells.length; i += 1) {
          expect(cells[i]!.y, `value ${i} below value ${i - 1}`).toBeGreaterThanOrEqual(
            cells[i - 1]!.y + cells[i - 1]!.height,
          );
        }
        labels.forEach((label, index) => {
          expect(label.width, `label ${index} is not hidden`).toBeGreaterThan(20);
          expect(Math.abs(label.y - cells[index]!.y), `label ${index} on its value's first line`).toBeLessThanOrEqual(4);
          expect(label.x + label.width, `label ${index} left of its value`).toBeLessThanOrEqual(cells[index]!.x + 1);
        });
        for (const label of await figures.locator("dt").all()) await expect(label).toBeVisible();
      }
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
    const row = await box(item);
    const figures = await box(item.locator(":scope > dl"));
    const shown = await box(panel);
    expect(shown.y, "the panel sits below the figures").toBeGreaterThanOrEqual(figures.y + figures.height - 1);
    expect(shown.x, "the panel starts at the row's left padding").toBeLessThanOrEqual(figures.x + 1);
    expect(shown.x + shown.width, "the panel runs to the row's right padding").toBeGreaterThanOrEqual(
      row.x + row.width - 17,
    );
    expect(shown.x + shown.width, "the panel ends inside its batch").toBeLessThanOrEqual(row.x + row.width);
    const tables = await boxes(panel.locator("table"));
    expect(tables.length, "before and after tables").toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.x, "a table starts inside the section").toBeGreaterThanOrEqual(section.x);
      expect(table.x + table.width, "a table ends inside the section").toBeLessThanOrEqual(section.x + section.width);
    }
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Reverse", "button Reverse"]);
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

    const row = await box(item);
    const figures = await box(item.locator(":scope > dl"));
    const area = await box(message.locator("..").locator(".."));
    expect(before.x, "the Reverse button sat in the last column, right of the figures").toBeGreaterThanOrEqual(
      figures.x + figures.width - 1,
    );
    expect(area.y, "the message sits below the figures").toBeGreaterThanOrEqual(figures.y + figures.height - 1);
    expect(area.x).toBeLessThanOrEqual(figures.x + 1);
    expect(area.x + area.width, "the message area runs to the row's right padding").toBeGreaterThanOrEqual(
      row.x + row.width - 17,
    );
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
      const buttons = recentBatches(page).getByRole("button", { name: /^Reverse batch / });
      await expect(buttons).toHaveCount(2);
      const section = await box(recentBatches(page));
      for (const button of await boxes(buttons)) {
        expect(button.x, "a button starts inside the section").toBeGreaterThanOrEqual(section.x);
        expect(button.x + button.width, "a button ends inside the section").toBeLessThanOrEqual(section.x + section.width);
        expect(button.y + button.height, "a button ends inside the section, bottom").toBeLessThanOrEqual(
          section.y + section.height,
        );
      }
    });
  }
});
