import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { checkPageState } from "./a11y";
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
import { OPERATOR_STATE } from "./states";

// The look E pages at the widths where their layout changes: the Pricing list's
// content cap, tiles, and table look. Operator session; data is reset before each test.

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

// AC-0003: a product's five figures sit on one line under the group's header line.
async function expectOneLineRows(page: Page) {
  const row = card(page, "NB");
  const tops = (await boxes(values(row))).map((box) => box.y);
  expect(tops).toHaveLength(5);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(4);

  const header = group(page, "Needs a new price").locator("div[aria-hidden='true']");
  await expect(header).toBeVisible();
  expect(await header.locator("span").allTextContents()).toEqual(["Product", ...FIGURES]);

  const fits = await page
    .locator("section[aria-labelledby^='group-'] li dd")
    .evaluateAll((cells) => cells.map((cell) => cell.scrollWidth <= cell.clientWidth));
  expect(fits.length).toBe(8 * 5);
  expect(fits.filter((fit) => !fit)).toEqual([]);

  // The labels are hidden visually here: the header line names the columns.
  const labelBoxes = await boxes(row.locator("dt"));
  for (const box of labelBoxes) expect(box.width).toBeLessThanOrEqual(1);
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
  });

  test("AC-0002: with no active finished product there are no tiles and today's message shows", async ({ page }) => {
    await retire502();
    await opens(page);
    await expect(page.getByText(NO_PRODUCTS)).toBeVisible();
    await expect(tiles(page)).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Product counts" })).toHaveCount(0);
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

      if (width === 1280) await checkPageState(page);
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
    // The row wears the accent edge on its left, and the other rows do not.
    expect(await row.evaluate((el) => getComputedStyle(el).borderLeftWidth)).toBe("4px");
    expect(await card(page, "NA").evaluate((el) => getComputedStyle(el).borderLeftWidth)).not.toBe("4px");
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
