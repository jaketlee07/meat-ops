import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { checkPageState } from "./a11y";
import { addFinished, addRaw, receive, retire502 } from "./menu-page";
import {
  card,
  GROUP_HEADINGS,
  group,
  headingsIn,
  NAV_CONTROLS,
  NO_PRODUCTS,
  opens,
  setTarget,
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
    });
  }
});
