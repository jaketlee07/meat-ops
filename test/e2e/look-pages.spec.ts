import { expect, test, type Locator, type Page } from "@playwright/test";
import { callAsOperator, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "../db";
import { checkDesktopWalk, checkPageState } from "./a11y";
import { withSeeAlerts } from "./alerts-page";
import { addFinished, addRaw, receive, retire502 } from "./menu-page";
import {
  card,
  detailControls,
  GROUP_HEADINGS,
  group,
  headingsIn,
  NAV_CONTROLS,
  NO_PRODUCTS,
  opens,
  opensDetail,
  setTarget,
  WHAT_IF_HEADING,
} from "./pricing-page";
import {
  correctPanel,
  correctThrough,
  FORM_CONTROLS,
  fillReceipt,
  lotNumberOf,
  openForm,
  RAW_TOM_URL,
  RECEIVING_FORM,
  receiptItem,
  seedReceipt,
  voidThrough,
} from "./receiving-page";
import { OPERATOR_STATE } from "./states";

// The look E pages at the widths where their layout changes: the Pricing list's
// content cap, tiles, and table look, and Receiving's two-column layout and receipts table. Operator session; data is reset before each test.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

const FIGURES = ["Cost per lb", "List price", "Suggested price", "Margin at list price", "Target margin"];

// The same products as `orderingFixture` in pricing.spec.ts: four need a new price,
// two are priced, two have no cost yet. `withNoCost: false` leaves the last group empty.
async function pricingFixture(withNoCost = true) {
  await retire502();
  const rawX = await addRaw("RAWX");
  const rawY = await addRaw("RAWY");
  await receive(rawX, 1000, 1.5);
  const nd = await addFinished("ND", "Needs D", rawX, { listPrice: 1.7 });
  await addFinished("NA", "Needs A", rawX);
  await addFinished("NC", "Needs C", rawX, { listPrice: 2.5 });
  const nb = await addFinished("NB", "Needs B", rawX, { listPrice: 1.7 });
  await setTarget(nd, 0.2);
  await setTarget(nb, 0.2);
  await addFinished("PB", "Priced B", rawX, { listPrice: 1.67 });
  await addFinished("PA", "Priced A", rawX, { listPrice: 1.67 });
  if (withNoCost) {
    await addFinished("ZB", "No cost B", rawY);
    await addFinished("ZA", "No cost A", rawY);
  }
}

function tiles(page: Page): Locator {
  return page.getByRole("list", { name: "Product counts" });
}

async function tileReadings(page: Page): Promise<{ label: string; count: string }[]> {
  return tiles(page)
    .getByRole("listitem")
    .evaluateAll((items) =>
      items.map((item) => {
        const spans = item.querySelectorAll("span");
        return { label: spans[0]?.textContent?.trim() ?? "", count: spans[1]?.textContent?.trim() ?? "" };
      }),
    );
}

async function boxes(scope: Locator) {
  const all = await scope.all();
  return Promise.all(
    all.map(async (item) => {
      const box = await item.boundingBox();
      expect(box, "box").not.toBeNull();
      return box!;
    }),
  );
}

// AC-0003: every product's five figures sit on one line under its group's header line, each
// under its own column, and none is cut off by its cell or by its group.
async function expectOneLineRows(page: Page) {
  const sections = await page.locator("section[aria-labelledby^='group-']").all();
  expect(sections).toHaveLength(3);
  let rows = 0;
  for (const section of sections) {
    const header = section.locator("div[aria-hidden='true']");
    await expect(header).toBeVisible();
    expect(await header.locator("span").allTextContents()).toEqual(["Product", ...FIGURES]);
    const columns = await boxes(header.locator("span"));
    const edge = await box(section);

    for (const item of await section.locator("li").all()) {
      rows += 1;
      const cells = await boxes(values(item));
      expect(cells).toHaveLength(5);
      const tops = cells.map((cell) => cell.y);
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(4);
      const product = await box(item.locator("h3"));
      expect(Math.abs(product.x - columns[0]!.x), "product column left").toBeLessThanOrEqual(1);
      cells.forEach((cell, index) => {
        const column = columns[index + 1]!;
        expect(Math.abs(cell.x - column.x), `figure ${index} left`).toBeLessThanOrEqual(1);
        expect(Math.abs(cell.width - column.width), `figure ${index} width`).toBeLessThanOrEqual(1);
        expect(cell.x, `figure ${index} inside its group, left`).toBeGreaterThanOrEqual(edge.x);
        expect(cell.x + cell.width, `figure ${index} inside its group, right`).toBeLessThanOrEqual(edge.x + edge.width);
        expect(cell.y + cell.height, `figure ${index} inside its group, bottom`).toBeLessThanOrEqual(edge.y + edge.height);
      });
      // The labels are hidden visually here: the header line names the columns.
      for (const label of await boxes(item.locator("dt"))) expect(label.width).toBeLessThanOrEqual(1);
    }
  }
  expect(rows).toBe(8);

  const fits = await page
    .locator("section[aria-labelledby^='group-'] li dd")
    .evaluateAll((cells) => cells.map((cell) => cell.scrollWidth <= cell.clientWidth));
  expect(fits.length).toBe(8 * 5);
  expect(fits.filter((fit) => !fit)).toEqual([]);
}

// AC-0004: each figure sits below the one before it, beside a visible label.
async function expectStackedRows(page: Page) {
  const row = card(page, "NB");
  const cells = await boxes(values(row));
  expect(cells).toHaveLength(5);
  for (let i = 1; i < cells.length; i += 1) {
    expect(cells[i]!.y, `value ${i} below value ${i - 1}`).toBeGreaterThanOrEqual(
      cells[i - 1]!.y + cells[i - 1]!.height,
    );
  }
  const labels = row.locator("dt");
  await expect(labels).toHaveCount(5);
  for (const label of await labels.all()) await expect(label).toBeVisible();
  for (const box of await boxes(labels)) expect(box.width).toBeGreaterThan(20);
  await expect(group(page, "Needs a new price").locator("div[aria-hidden='true']")).toBeHidden();

  // In every product's card each label is beside its value, on the value's first line.
  const items = await page.locator("section[aria-labelledby^='group-'] li").all();
  expect(items).toHaveLength(8);
  for (const item of items) {
    const itemLabels = await boxes(item.locator("dt"));
    const itemValues = await boxes(values(item));
    expect(itemLabels).toHaveLength(5);
    itemLabels.forEach((label, index) => {
      expect(Math.abs(label.y - itemValues[index]!.y), `label ${index} on its value's first line`).toBeLessThanOrEqual(4);
      expect(label.x + label.width, `label ${index} left of its value`).toBeLessThanOrEqual(itemValues[index]!.x + 1);
    });
  }
}

function values(scope: Locator): Locator {
  return scope.locator("dd");
}

test.describe("the Pricing content cap", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /pricing lifts the 34rem cap on every child of main at ${width}x${height}`, async ({ page }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opens(page);
      const widths = await page.locator("main > *").evaluateAll((children) =>
        children.map((child) => getComputedStyle(child).maxWidth),
      );
      expect(widths.length).toBeGreaterThan(2);
      expect(widths.filter((value) => value !== "none")).toEqual([]);
    });
  }
});

test.describe("the tiles", () => {
  test("AC-0002: three tiles in order, each counting its group's products", async ({ page }) => {
    await pricingFixture();
    await opens(page);
    const readings = await tileReadings(page);
    expect(readings.map((reading) => reading.label)).toEqual(GROUP_HEADINGS);
    for (const { label, count } of readings) {
      expect(count, `count for ${label}`).toBe(String((await headingsIn(page, label)).length));
    }
    expect(readings.map((reading) => reading.count)).toEqual(["4", "2", "2"]);
    await expect(tiles(page).getByRole("heading")).toHaveCount(0);

    const controls = await checkPageState(page);
    await checkDesktopWalk(page);
    expect(controls.filter((label) => label.startsWith("button ")).length).toBe(1 + 4 + 1);
    expect(controls.slice(0, NAV_CONTROLS.length)).toEqual(NAV_CONTROLS);
  });

  test("AC-0002: an emptied group reads 0 and has no section", async ({ page }) => {
    await pricingFixture(false);
    await opens(page);
    expect(await tileReadings(page)).toEqual([
      { label: "Needs a new price", count: "4" },
      { label: "Priced", count: "2" },
      { label: "No cost yet", count: "0" },
    ]);
    await expect(group(page, "No cost yet")).toHaveCount(0);
    await checkPageState(page);
    await checkDesktopWalk(page);
  });

  test("AC-0002: with no active finished product there are no tiles and today's message shows", async ({ page }) => {
    await retire502();
    await opens(page);
    await expect(page.getByText(NO_PRODUCTS)).toBeVisible();
    await expect(tiles(page)).toHaveCount(0);
  });
});

test.describe("the table look", () => {
  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0003: at ${width}x${height} a product reads as one row under a header line`, async ({ page }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opens(page);
      await expectOneLineRows(page);

      if (width === 1280) {
        await checkPageState(page);
        await checkDesktopWalk(page);
      }
    });
  }

  for (const [width, height] of [
    [1279, 800],
    [1024, 768],
    [390, 844],
  ] as const) {
    test(`AC-0004: at ${width}x${height} a product stays a card with each label beside its value`, async ({ page }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opens(page);
      await expectStackedRows(page);
    });
  }
});

// The details view at /pricing?product=NB. NB needs a new price: it has a target and a list price below the suggestion.
function panel(page: Page): Locator {
  return page.getByRole("region", { name: "Product details" });
}

const APPLY = /list price to/;

test.describe("the product details beside the list", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0005: at ${width}x${height} the details region sits right of the list, under the tiles`, async ({
      page,
    }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opensDetail(page, "NB");
      await expect(tiles(page)).toBeVisible();
      for (const heading of GROUP_HEADINGS) await expect(group(page, heading)).toBeVisible();
      await expect(panel(page)).toBeVisible();
      const region = await panel(page).boundingBox();
      expect(region, "region box").not.toBeNull();
      const lists = await boxes(page.locator("section[aria-labelledby^='group-']"));
      expect(lists).toHaveLength(3);
      const listRight = Math.max(...lists.map((box) => box.x + box.width));
      expect(region!.x).toBeGreaterThanOrEqual(listRight);
      const tilesBox = await box(tiles(page));
      expect(region!.y, "the region sits below the tiles").toBeGreaterThanOrEqual(tilesBox.y + tilesBox.height);
    });

    test(`AC-0005: at ${width}x${height} the first group's top lines up with the region's top`, async ({ page }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opensDetail(page, "NB");
      const first = await box(group(page, "Needs a new price"));
      const region = await box(panel(page));
      expect(Math.abs(first.y - region.y)).toBeLessThanOrEqual(2);
    });
  }

  test("AC-0006: at 1280x720 the region holds the heading, the build-up, the advice, the button, and both forms", async ({
    page,
  }) => {
    await pricingFixture();
    await page.setViewportSize({ width: 1280, height: 720 });
    await opensDetail(page, "NB");
    const region = panel(page);
    await expect(region.getByRole("heading", { level: 2 }).first()).toHaveText("NB Needs B");
    const labels = (await region.locator("dt").allTextContents()).map((text) => text.trim());
    for (const label of ["Raw input", "Raw average cost", "Shrink", "Cost after shrink", "Cost per lb", "Target margin", "Suggested price", "List price", "Margin at list price"]) {
      expect(labels, label).toContain(label);
    }
    for (const dt of await region.locator("dt").all()) await expect(dt).toBeVisible();
    for (const dt of await boxes(region.locator("dt"))) expect(dt.width).toBeGreaterThan(20);
    await expect(region.getByText(/^Cost is /)).toBeVisible();
    await expect(region.getByRole("button", { name: APPLY })).toHaveCount(1);
    await expect(region.getByRole("button", { name: APPLY })).toBeVisible();
    await expect(region.locator("#change-saved")).toBeAttached();
    await expect(region.locator("#change-refused")).toBeAttached();
    for (const [heading, field, save] of [
      ["Target margin", "Target margin %", "Save target"],
      ["List price", "List price per lb", "Save price"],
    ] as const) {
      await expect(region.getByRole("heading", { level: 2, name: heading })).toBeVisible();
      await expect(region.getByRole("textbox", { name: field })).toBeVisible();
      await expect(region.getByRole("button", { name: save })).toBeVisible();
    }
    await expect(region.getByRole("button", { name: "Remove target margin" })).toBeVisible();

    const apply = (await region.getByRole("button", { name: APPLY }).textContent())!.trim();
    expect(await checkPageState(page)).toEqual(withSeeAlerts(detailControls({ apply, remove: true })));
    await checkDesktopWalk(page);
  });

  test("AC-0021: the details view has no what-if section", async ({ page }) => {
    await pricingFixture();
    await opensDetail(page, "NB");
    await expect(page.getByRole("heading", { name: WHAT_IF_HEADING })).toHaveCount(0);
    await expect(page.getByText(WHAT_IF_HEADING)).toHaveCount(0);
    await expect(page.locator("#what-if-raw")).toHaveCount(0);
  });

  for (const [width, height] of [
    [1023, 768],
    [390, 844],
  ] as const) {
    test(`AC-0007: at ${width}x${height} the details show alone, with no tile and no group`, async ({ page }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opensDetail(page, "NB");
      await expect(panel(page)).toBeVisible();
      await expect(tiles(page)).toBeHidden();
      for (const heading of GROUP_HEADINGS) await expect(group(page, heading)).toBeHidden();
      for (const section of await page.locator("section[aria-labelledby^='group-']").all()) {
        await expect(section).toBeHidden();
      }
    });
  }

  test("AC-0008: the open product's row has no button and no advice, and the panel has the button", async ({
    page,
  }) => {
    await pricingFixture();
    await opensDetail(page, "NB");
    const row = card(page, "NB");
    await expect(row).toBeVisible();
    await expect(row.getByRole("button")).toHaveCount(0);
    await expect(row.getByText(/^Cost is /)).toHaveCount(0);
    await expect(row.getByRole("link", { name: /^NB / })).toHaveAttribute("aria-current", "page");
    await expect(panel(page).getByRole("button", { name: APPLY })).toHaveCount(1);
    // Another product that needs a new price keeps its advice and button, and is not marked open.
    await expect(card(page, "NA").getByRole("button", { name: APPLY })).toHaveCount(1);
    await expect(card(page, "NA").getByRole("link")).not.toHaveAttribute("aria-current", "page");
    // The row wears the accent edge on its left, and the other rows do not. From 1280 px up it is
    // drawn as a shadow, so it takes no room from the row's columns.
    const edge = (el: Element) => {
      const style = getComputedStyle(el);
      return { border: style.borderLeftWidth, shadow: style.boxShadow };
    };
    expect(await row.evaluate(edge)).toEqual({ border: "0px", shadow: expect.stringContaining("inset") });
    expect(await card(page, "NA").evaluate(edge)).toEqual({ border: "0px", shadow: "none" });
  });

  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0009: at ${width}x${height} Tab reaches every control in the region before any list link`, async ({
      page,
    }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opensDetail(page, "NB");
      const total = await panel(page).evaluate(
        (el) => el.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])").length,
      );
      expect(total, "controls in the region").toBe(6);

      const walk: { inRegion: boolean; listLink: boolean }[] = [];
      for (let press = 0; press < 60; press += 1) {
        await page.keyboard.press("Tab");
        const step = await page.evaluate(() => {
          const el = document.activeElement!;
          return {
            inRegion: el.closest("[aria-label='Product details']") !== null,
            listLink: el.tagName === "A" && el.closest("section[aria-labelledby^='group-']") !== null,
          };
        });
        walk.push(step);
        if (step.listLink) break;
      }
      expect(walk.at(-1)?.listLink, "Tab reached a list link").toBe(true);
      expect(walk.filter((step) => step.inRegion)).toHaveLength(total);
      expect(walk.slice(0, -1).filter((step) => step.listLink)).toEqual([]);
    });
  }

  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0003: at ${width}x${height} the list beside the panel reads as one row per product`, async ({
      page,
    }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opensDetail(page, "NB");
      await expectOneLineRows(page);
    });
  }

  for (const [width, height] of [
    [1279, 800],
    [1024, 768],
  ] as const) {
    test(`AC-0004: at ${width}x${height} the list beside the panel keeps each product a card`, async ({ page }) => {
      await pricingFixture();
      await page.setViewportSize({ width, height });
      await opensDetail(page, "NB");
      await expectStackedRows(page);
    });
  }
});

// ---- Receiving: /receiving?product=RAW-TOM with three receipts, one of them void ----

const RECEIPT_FIGURES = ["Lot number", "Received", "Vendor", "Weight", "Cost per lb", "Remaining"];

// Three receipts of RAW-TOM, the middle one voided through the page. Returns nothing:
// the page is left open on /receiving?product=RAW-TOM at the given size.
// With `long`, two more receipts carry the longest figures the form accepts (a six-digit weight with
// three decimals, a cost of $10 or more with four decimals) and a one-word vendor name with no space.
const LONG_VENDOR = "Internationalmeatpackersincorporated";
const LONG_WEIGHTS = ["100,000.125 lbs", "200,000.25 lbs"];

async function seedLongReceipts() {
  const [vendor] = await query<{ id: string }>("insert into vendors(name) values ($1) returning id", [LONG_VENDOR]);
  const first = await callAsOperator(receiveCall(RAW_TOM_ID, vendor!.id, 100000.125, 12.3456, "2026-05-08"));
  expect(first.ok, first.error).toBe(true);
  const second = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 200000.25, 10.5, "2026-05-09"));
  expect(second.ok, second.error).toBe(true);
}

async function opensReceiving(page: Page, width: number, height: number, long = false) {
  if (long) await seedLongReceipts();
  await seedReceipt(1000, 1.5, "2026-05-10");
  const middle = await seedReceipt(2000, 1.6, "2026-05-11");
  await seedReceipt(3000, 1.7, "2026-05-12");
  await page.setViewportSize({ width, height });
  await page.goto(RAW_TOM_URL);
  await expect(recentReceipts(page)).toBeVisible();
  await expect(recentReceipts(page).locator("li")).toHaveCount(long ? 5 : 3);
  await voidThrough(page, receiptItem(page, await lotNumberOf(middle)), "entered twice");
  await expect(recentReceipts(page).getByText("Void: entered twice")).toBeVisible();
}

function receivingForm(page: Page): Locator {
  return page.getByRole("form", { name: RECEIVING_FORM });
}

function stockCard(page: Page): Locator {
  return page.getByRole("region", { name: "Stock and prices" });
}

function recentReceipts(page: Page): Locator {
  return page.getByRole("region", { name: "Recent receipts" });
}

async function box(target: Locator) {
  const found = await target.boundingBox();
  expect(found, "box").not.toBeNull();
  return found!;
}

test.describe("the Receiving layout", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /receiving lifts the 34rem cap on every child of main at ${width}x${height}`, async ({ page }) => {
      await opensReceiving(page, width, height);
      const widths = await page.locator("main > *").evaluateAll((children) =>
        children.map((child) => getComputedStyle(child).maxWidth),
      );
      expect(widths.length).toBeGreaterThan(2);
      expect(widths.filter((value) => value !== "none")).toEqual([]);
    });
  }

  for (const [width, height] of [
    [1023, 768],
    [390, 844],
  ] as const) {
    test(`AC-0010: at ${width}x${height} the form, the stock card, and Recent receipts run top to bottom`, async ({
      page,
    }) => {
      await opensReceiving(page, width, height);
      const form = await box(receivingForm(page));
      const stock = await box(stockCard(page));
      const heading = await box(recentReceipts(page).getByRole("heading", { name: "Recent receipts" }));
      expect(form.y + form.height).toBeLessThanOrEqual(stock.y);
      expect(stock.y + stock.height).toBeLessThanOrEqual(heading.y);
      await expect(stockCard(page).getByText("On hand", { exact: true })).toBeVisible();
      await expect(stockCard(page).getByText("Average cost", { exact: true })).toBeVisible();
      await expect(stockCard(page).getByRole("heading", { name: "Suggested price per lb" })).toBeVisible();
    });
  }

  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0011: at ${width}x${height} the title is above, and the form is left of the stock card and Recent receipts`, async ({
      page,
    }) => {
      await opensReceiving(page, width, height);
      const title = await box(page.getByRole("heading", { level: 1, name: "Receiving" }));
      const form = await box(receivingForm(page));
      const stock = await box(stockCard(page));
      const recent = await box(recentReceipts(page));
      expect(title.y + title.height).toBeLessThanOrEqual(form.y);
      expect(title.y + title.height).toBeLessThanOrEqual(stock.y);
      expect(Math.abs(form.y - stock.y)).toBeLessThanOrEqual(1);
      expect(form.x + form.width).toBeLessThanOrEqual(stock.x);
      expect(form.x + form.width).toBeLessThanOrEqual(recent.x);
      expect(stock.y + stock.height).toBeLessThanOrEqual(recent.y);
    });
  }

  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0012: at ${width}x${height} a receipt reads as one row under a header line`, async ({ page }) => {
      await opensReceiving(page, width, height, true);
      const recent = recentReceipts(page);
      const header = recent.locator("div[aria-hidden='true']");
      await expect(header).toBeVisible();
      const names = (await header.locator("span").allTextContents()).map((text) => text.trim());
      expect(names).toEqual([...RECEIPT_FIGURES, ""]);
      const columns = await boxes(header.locator("span"));

      const rows = await recent.locator("li").all();
      expect(rows).toHaveLength(5);
      for (const row of rows) {
        const cells = await boxes(values(row));
        expect(cells).toHaveLength(6);
        // A long figure wraps at the space before its unit, so only the short rows are one line.
        const longRow = LONG_WEIGHTS.includes((await values(row).nth(3).textContent())!.trim());
        if (!longRow) {
          const tops = cells.map((cell) => cell.y);
          expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(4);
        }
        // Each figure sits in the column the header line names.
        cells.forEach((cell, index) => {
          expect(Math.abs(cell.x - columns[index]!.x), `column ${index} left`).toBeLessThanOrEqual(1);
          expect(Math.abs(cell.width - columns[index]!.width), `column ${index} width`).toBeLessThanOrEqual(1);
        });
        // The labels are hidden visually here: the header line names the columns.
        for (const label of await boxes(row.locator("dt"))) expect(label.width).toBeLessThanOrEqual(1);
        expect(await row.locator("dt").allTextContents()).toEqual(RECEIPT_FIGURES);
      }

      // Every value stays inside its cell, the long figures and the long vendor name included.
      const fits = await recent.locator("li dd").evaluateAll((cells) =>
        cells.map((cell) => ({ text: cell.textContent, fits: cell.scrollWidth <= cell.clientWidth })),
      );
      expect(fits).toHaveLength(5 * 6);
      expect(fits.filter((cell) => !cell.fits)).toEqual([]);
      // A figure breaks at the space before its unit, never inside the number.
      for (const weight of ["100,000.125", "200,000.25"]) {
        const cell = recent.locator("li dd").filter({ hasText: `${weight} lbs` });
        await expect(cell).toHaveCount(2);
        const pieces = await cell.first().evaluate((el, number) => {
          const range = document.createRange();
          range.setStart(el.firstChild!, 0);
          range.setEnd(el.firstChild!, number.length);
          return range.getClientRects().length;
        }, weight);
        expect(pieces, `${weight} is in one piece`).toBe(1);
      }

      if (width === 1280) {
        expect(await checkPageState(page)).toEqual([
          ...FORM_CONTROLS,
          "button Void",
          "button Correct",
          "button Void",
          "button Correct",
          "button Void",
          "button Correct",
          "button Void",
          "button Correct",
        ]);
        await checkDesktopWalk(page);
      }
    });
  }

  test("AC-0012: at 1280x900 a corrected receipt's panel shows whole across its row", async ({ page }) => {
    const id = await seedReceipt(12345.678, 1.74, "2026-10-20");
    await seedReceipt(1234.567, 1.69, "2026-10-27");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(RAW_TOM_URL);
    const lot = await lotNumberOf(id);
    const item = receiptItem(page, lot);
    await correctThrough(page, item, lot, { cost: "1.80" });
    const panel = correctPanel(item);
    await expect(panel.getByRole("heading", { name: "Receipt corrected" })).toBeVisible();

    const section = await box(recentReceipts(page));
    const row = await box(item);
    const figures = await box(item.locator("dl").first());
    const shown = await box(panel);
    expect(shown.width, "the panel is as wide as the row's figures").toBeGreaterThanOrEqual(figures.width - 1);
    expect(shown.x + shown.width, "the panel ends inside its receipt").toBeLessThanOrEqual(row.x + row.width);
    const tables = await boxes(panel.locator("table"));
    expect(tables.length, "before and after tables").toBeGreaterThan(0);
    for (const table of tables) {
      expect(table.x, "a table starts inside the section").toBeGreaterThanOrEqual(section.x);
      expect(table.x + table.width, "a table ends inside the section").toBeLessThanOrEqual(section.x + section.width);
    }
    // Void and Correct stay where they were in the order of the page.
    await expect(item.getByRole("button", { name: /^Void lot / })).toBeVisible();
    await expect(item.getByRole("button", { name: /^Correct lot / })).toBeVisible();
  });

  test("AC-0011: at 1024x768 the saved result stays in the form's column", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    const f = await openForm(page, RAW_TOM_URL);
    await fillReceipt(f, { weight: "5000", cost: "1.68" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeVisible();
    const form = await box(receivingForm(page));
    const result = await box(f.result);
    expect(result.x).toBeGreaterThanOrEqual(form.x - 1);
    expect(result.x + result.width).toBeLessThanOrEqual(form.x + form.width + 1);
    expect(result.y).toBeGreaterThanOrEqual(form.y + form.height - 1);
  });

  for (const [width, height] of [
    [1279, 800],
    [1024, 768],
    [390, 844],
  ] as const) {
    test(`AC-0013: at ${width}x${height} a receipt stays a card with each label beside its value`, async ({
      page,
    }) => {
      await opensReceiving(page, width, height);
      const recent = recentReceipts(page);
      await expect(recent.locator("div[aria-hidden='true']")).toBeHidden();
      for (const row of await recent.locator("li").all()) {
        const cells = await boxes(values(row));
        expect(cells).toHaveLength(6);
        for (let i = 1; i < cells.length; i += 1) {
          expect(cells[i]!.y, `value ${i} below value ${i - 1}`).toBeGreaterThanOrEqual(
            cells[i - 1]!.y + cells[i - 1]!.height,
          );
        }
        const labels = row.locator("dt");
        await expect(labels).toHaveCount(6);
        for (const label of await labels.all()) await expect(label).toBeVisible();
        for (const label of await boxes(labels)) expect(label.width).toBeGreaterThan(20);
        // Each label is beside its value: on the same line, and to the left of it.
        const labelBoxes = await boxes(labels);
        labelBoxes.forEach((label, index) => {
          expect(Math.abs(label.y - cells[index]!.y), `label ${index} on its value's line`).toBeLessThanOrEqual(12);
          expect(label.x + label.width).toBeLessThanOrEqual(cells[index]!.x + 1);
        });
      }
    });
  }
});
