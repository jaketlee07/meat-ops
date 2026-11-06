import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { checkDesktopWalk, checkPageState } from "./a11y";
import { box, boxes, measureCells, withTextSize } from "./look-checks";
import {
  addFinished,
  addRaw,
  cards,
  MENU_CONTROLS,
  produce,
  receive,
  retire502,
  sellableSwitch,
} from "./menu-page";
import { OPERATOR_STATE } from "./states";

// The look E pages of spec 3b (Menu, Invoices, Ask, Alerts) at the widths where their layout changes.
// Operator session; data is reset before each test, and each test builds its own page state.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// ---- Menu ----

const MENU_COLUMNS = ["Product", "List price", "Finished on hand", "Raw on hand", "Status"];
const FIGURE_LABELS = ["Finished on hand", "Raw on hand"];

// What Tab reaches on /menu: the shell, then the switch.
const WITH_SWITCH = [...MENU_CONTROLS, "input"];

// Six products, four sellable now and two not: a $10 price, one with no list price and stock, one with no
// list price and none, one with raw stock only, and one with no finished stock. The seeded 502 is retired.
const SIX = [
  { code: "M-ONE", description: "Smoked Turkey Wings", price: 10, raw: 500, finished: true },
  { code: "M-TWO", description: "Smoked Turkey Drums Tom", price: 1.99, raw: 123456.789, finished: true },
  { code: "M-THREE", description: "Turkey Necks", price: null, raw: 0, finished: false },
  { code: "M-FOUR", description: "Smoked Ham Hocks", price: 3.49, raw: 640, finished: false },
  { code: "M-FIVE", description: "Beef Jerky Strips", price: null, raw: 300, finished: true },
  { code: "M-SIX", description: "Smoked Pork Neck Bones With A Long Name", price: 12.5, raw: 0, finished: false },
] as const;
const SELLABLE_NOW = 4;

async function seedSix(): Promise<void> {
  await retire502();
  for (const item of SIX) {
    const raw = await addRaw(`R-${item.code}`);
    const finished = await addFinished(item.code, item.description, raw, { listPrice: item.price });
    if (item.raw > 0) await receive(raw, item.raw);
    if (item.finished) await produce(finished, 100);
  }
}

async function opensMenu(page: Page, width: number, height: number): Promise<void> {
  await seedSix();
  await page.setViewportSize({ width, height });
  await page.goto("/menu");
  await expect(cards(page)).toHaveCount(SIX.length);
}

function menuHeader(page: Page): Locator {
  return page.locator("main section div[aria-hidden='true']");
}

// A product's four figure cells in column order: the list price and the sellable line (the `p`s), and the
// `dl`'s two `dd`s.
function productCells(row: Locator): { heading: Locator; price: Locator; finished: Locator; raw: Locator; status: Locator } {
  return {
    heading: row.getByRole("heading", { level: 2 }),
    price: row.locator(":scope > p").first(),
    finished: row.locator(":scope > dl dd").nth(0),
    raw: row.locator(":scope > dl dd").nth(1),
    status: row.locator(":scope > p").last(),
  };
}

// No product's text runs past its cell, and a figure number (a price or a weight) sits in one piece.
async function expectMenuNoSpill(page: Page, rows: number): Promise<void> {
  const cells = await measureCells(cards(page).locator(":scope > h2, :scope > p, :scope > dl dd"));
  expect(cells).toHaveLength(rows * 5);
  for (let row = 0; row < rows; row += 1) {
    const [heading, price, finished, raw, status] = cells.slice(row * 5, row * 5 + 5);
    expect(heading!.text).toMatch(/^M-/);
    expect(finished!.figure, `row ${row} finished is a figure`).toBe(true);
    expect(raw!.figure, `row ${row} raw is a figure`).toBe(true);
    expect(price!.figure || price!.text === "No list price yet", `row ${row} price`).toBe(true);
    expect(status!.text).toMatch(/ellable now$/);
  }
  expect(cells.filter((cell) => !cell.fits || cell.pieces !== 1)).toEqual([]);
}

// The list reads as one table: one header line naming the columns in order, each product on one line with its
// cells in those columns and the two labels hidden visually, and no figure past its cell.
async function expectMenuTable(page: Page, rows: number): Promise<void> {
  const header = menuHeader(page);
  await expect(header).toBeVisible();
  const names = (await header.locator("span").allTextContents()).map((text) => text.trim());
  expect(names).toEqual(MENU_COLUMNS);
  const headerBox = await box(header);
  const columns = await boxes(header.locator("span"));
  const items = await cards(page).all();
  expect(items).toHaveLength(rows);
  for (const row of items) {
    const rowBox = await box(row);
    expect(rowBox.y, "the header line is above the row").toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    const parts = productCells(row);
    const cells = await Promise.all([parts.heading, parts.price, parts.finished, parts.raw, parts.status].map(box));
    const middles = cells.map((cell) => cell.y + cell.height / 2);
    expect(Math.max(...middles) - Math.min(...middles), "one line").toBeLessThanOrEqual(6);
    cells.forEach((cell, index) => {
      expect(Math.abs(cell.x - columns[index]!.x), `column ${index} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(cell.width - columns[index]!.width), `column ${index} width`).toBeLessThanOrEqual(1);
      expect(cell.x + cell.width, `column ${index} inside the row`).toBeLessThanOrEqual(rowBox.x + rowBox.width);
    });
    for (const label of await boxes(row.locator(":scope > dl dt"))) expect(label.width).toBeLessThanOrEqual(1);
    expect(await row.locator(":scope > dl dt").allTextContents()).toEqual(FIGURE_LABELS);
  }
  await expectMenuNoSpill(page, rows);
}

// The list reads as cards: no header line; each product shows, top to bottom, its heading, its list price, each
// of the two figures beside its visible label, and its sellable line. Each product and the switch are cards.
async function expectMenuCards(page: Page, rows: number): Promise<void> {
  await expect(menuHeader(page), "the table is off").toBeHidden();
  const items = await cards(page).all();
  expect(items).toHaveLength(rows);
  for (const row of items) {
    const parts = productCells(row);
    const labels = row.locator(":scope > dl dt");
    await expect(labels).toHaveCount(2);
    const stack = [
      await box(parts.heading),
      await box(parts.price),
      await box(labels.nth(0)),
      await box(labels.nth(1)),
      await box(parts.status),
    ];
    for (let i = 1; i < stack.length; i += 1) {
      expect(stack[i]!.y, `part ${i} below part ${i - 1}`).toBeGreaterThanOrEqual(stack[i - 1]!.y + stack[i - 1]!.height - 1);
    }
    for (const [index, value] of [parts.finished, parts.raw].entries()) {
      const label = await box(labels.nth(index));
      const shown = await box(value);
      expect(label.width, `label ${index} is not hidden`).toBeGreaterThan(20);
      expect(Math.abs(label.y - shown.y), `label ${index} on its value's first line`).toBeLessThanOrEqual(4);
      expect(label.x + label.width, `label ${index} left of its value`).toBeLessThanOrEqual(shown.x + 1);
      await expect(labels.nth(index)).toBeVisible();
    }
    expect(await labels.allTextContents()).toEqual(FIGURE_LABELS);
    const style = await row.evaluate((node) => {
      const css = getComputedStyle(node);
      return { background: css.backgroundColor, border: css.borderTopWidth, radius: css.borderTopLeftRadius };
    });
    expect(style, "a product is a white card").toEqual({ background: "rgb(255, 255, 255)", border: "1px", radius: "14px" });
  }
  const label = await sellableSwitch(page).locator("..").evaluate((node) => {
    const css = getComputedStyle(node);
    return { background: css.backgroundColor, border: css.borderTopWidth, radius: css.borderTopLeftRadius };
  });
  expect(label, "the switch is its own white card").toEqual({ background: "rgb(255, 255, 255)", border: "1px", radius: "14px" });
  await expectMenuNoSpill(page, rows);
}

// A table or cards, whichever fits the room: either way no figure runs past its cell.
async function expectMenuEitherFits(page: Page, rows: number): Promise<void> {
  if (await menuHeader(page).isVisible()) return expectMenuTable(page, rows);
  return expectMenuCards(page, rows);
}

test.describe("the Menu layout", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /menu lifts the 34rem cap on every child of main but a dialog at ${width}x${height}`, async ({
      page,
    }) => {
      await opensMenu(page, width, height);
      const widths = await page.locator("main > *").evaluateAll((children) =>
        children.filter((child) => child.tagName !== "DIALOG").map((child) => getComputedStyle(child).maxWidth),
      );
      expect(widths.length).toBeGreaterThanOrEqual(2);
      expect(widths.filter((value) => value !== "none")).toEqual([]);
    });
  }

  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
    [1440, 900],
  ] as const) {
    for (const ticked of [false, true]) {
      test(`AC-0002: at ${width}x${height} each product is a row under one header line with Sellable only ${ticked ? "ticked" : "not ticked"}`, async ({
        page,
      }) => {
        await opensMenu(page, width, height);
        if (ticked) await sellableSwitch(page).check();
        await expectMenuTable(page, ticked ? SELLABLE_NOW : SIX.length);
      });
    }
  }

  test("AC-0003: at 390x844 each product is a card with each label beside its value", async ({ page }) => {
    await opensMenu(page, 390, 844);
    await expectMenuCards(page, SIX.length);
  });

  test("AC-0003: at 1280x720 with 20 px text no figure runs past its cell, and a card keeps its labels beside its values", async ({
    page,
  }) => {
    await opensMenu(page, 1280, 720);
    await withTextSize(page, 1280, 720, 20);
    await expectMenuEitherFits(page, SIX.length);
  });

  test("AC-0016: /menu with six products passes the page-state check at 390x844", async ({ page }) => {
    await opensMenu(page, 390, 844);
    expect(await checkPageState(page)).toEqual(WITH_SWITCH);
  });

  test("AC-0016: /menu with six products passes the page-state check at 1280x720", async ({ page }) => {
    await opensMenu(page, 1280, 720);
    expect(await checkPageState(page)).toEqual(WITH_SWITCH);
    await checkDesktopWalk(page);
  });

  // AC-0025: a 17 px always-visible scrollbar takes 17 px of the width, so the section is about 1rem narrower.
  test("AC-0025: at 1024x768 with 17 px of the width taken, Menu still reads as a table under its header line", async ({
    page,
  }) => {
    await opensMenu(page, 1024, 768);
    await page.evaluate(() => {
      document.documentElement.style.paddingRight = "17px";
    });
    await expectMenuTable(page, SIX.length);
  });
});
