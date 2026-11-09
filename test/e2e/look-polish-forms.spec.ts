import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { openAsk } from "./ask-page";
import { openInvoices, openReview, seedDraft, seedFixture } from "./invoices-page";
import { withTextSize } from "./look-checks";
import { opensDetail, opens as opensPricing } from "./pricing-page";
import {
  batchItem,
  batchNumberOf,
  openForm as openProductionForm,
  openReversal,
  seed502Fixture,
  seedBatch,
} from "./production-page";
import {
  correctButton,
  lotNumberOf,
  openCorrection,
  openForm as openReceivingForm,
  RAW_TOM_URL,
  receiptItem,
  seedReceipt,
  voidButton,
  voidDialog as receiptVoidDialog,
} from "./receiving-page";
import {
  fixtureWithPrice,
  openForm as openSalesForm,
  saleNumbers,
  seedSale,
  voidDialog as saleVoidDialog,
} from "./sales-page";
import { OPERATOR_STATE } from "./states";
import { open as openTrace } from "./trace-page";

// Spec polish-forms-alerts, how the forms are drawn: the one label style (AC-0001), the number pairs that share
// a line and hold a whole figure (AC-0002, AC-0004), and the floor forms' Tab order (AC-0028). Operator session;
// data is reset before each test, then each test builds the state it reads with made-up data.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// ---- AC-0001: one label style ----

// Every label that names a field but a checkbox, with its computed style, and what --color-ink-secondary computes to.
async function labelStyles(scope: Locator) {
  return scope.evaluateAll((labels) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-ink-secondary)";
    document.body.append(probe);
    const ink = getComputedStyle(probe).color;
    probe.remove();
    return labels
      .filter((label) => (label as HTMLLabelElement).control?.getAttribute("type") !== "checkbox")
      .map((label) => {
        const css = getComputedStyle(label);
        return {
          text: (label.textContent ?? "").trim(),
          size: css.fontSize,
          weight: css.fontWeight,
          color: css.color,
          ink,
        };
      });
  });
}

// Each named label is on the page or dialog in the one style: 14 px, weight 500, in --color-ink-secondary.
async function expectOneLabelStyle(scope: Locator, names: string[]) {
  const found = await labelStyles(scope.locator("label"));
  expect(found.map((label) => label.text)).toEqual(expect.arrayContaining(names));
  for (const label of found) {
    expect({ text: label.text, size: label.size, weight: label.weight, color: label.color }).toEqual({
      text: label.text,
      size: "14px",
      weight: "500",
      color: label.ink,
    });
  }
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("AC-0001: /sign-in's labels are one style", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expectOneLabelStyle(page.locator("body"), ["Email", "Password"]);
  });
});

test("AC-0001: /receiving's form, Void dialog, and Correct dialog label their fields in one style", async ({ page }) => {
  const lot = await lotNumberOf(await seedReceipt(1000, 1.5));
  await openReceivingForm(page, RAW_TOM_URL);
  await expectOneLabelStyle(page.getByRole("form", { name: "New receipt" }), [
    "Product code",
    "Vendor",
    "Weight (lbs)",
    "Cost per lb ($)",
    "Received date",
    "Notes (optional)",
  ]);
  const item = receiptItem(page, lot);
  await voidButton(item).click();
  await expectOneLabelStyle(receiptVoidDialog(page), ["Reason for the void"]);
  await page.keyboard.press("Escape");
  await openCorrection(page, item, lot, {});
  await expectOneLabelStyle(page.getByRole("dialog", { name: `Correct receipt ${lot}` }), [
    "Cost per lb ($)",
    "Weight (lbs)",
    "Reason for the correction",
  ]);
});

test("AC-0001: /production's form and Reverse dialog label their fields in one style", async ({ page }) => {
  await seed502Fixture();
  const batch = await batchNumberOf(await seedBatch(1000, "2026-10-06"));
  await openProductionForm(page, "/production?product=502");
  await expectOneLabelStyle(page.getByRole("form", { name: "New batch" }), [
    "Product code",
    "Raw lbs",
    "Finished lbs (optional)",
    "Production date",
    "Notes (optional)",
  ]);
  const dialog = await openReversal(page, batchItem(page, batch), batch);
  await expectOneLabelStyle(dialog, ["Reason for the reversal"]);
});

test("AC-0001: /sales' form and Void dialog label their fields in one style", async ({ page }) => {
  await fixtureWithPrice();
  await seedSale(100);
  const [number] = await saleNumbers();
  await openSalesForm(page);
  await expectOneLabelStyle(page.getByRole("form", { name: "New sale" }), [
    "Product code",
    "Weight sold (lbs)",
    "Price per lb ($)",
    "Customer",
    "Sale date",
  ]);
  await page.getByRole("button", { name: `Void sale ${number}`, exact: true }).click();
  await expectOneLabelStyle(saleVoidDialog(page), ["Reason for the void"]);
});

test("AC-0001: /pricing's target margin, list price, and what-if forms label their fields in one style", async ({ page }) => {
  await seed502Fixture();
  await opensDetail(page, "502");
  await expectOneLabelStyle(page.getByRole("region", { name: "Product details" }), ["Target margin %", "List price per lb"]);
  await opensPricing(page);
  await expectOneLabelStyle(page.getByRole("region", { name: "What if raw cost changes?" }), [
    "Raw product",
    "Raw cost per lb",
  ]);
});

test("AC-0001: /trace's finders label their fields in one style", async ({ page }) => {
  await openTrace(page);
  await expectOneLabelStyle(page.getByRole("main"), ["Sale number", "Raw product code", "Received date"]);
});

test("AC-0001: /invoices' read forms and a draft's review label their fields in one style", async ({ page }) => {
  await seedFixture();
  await openInvoices(page);
  await expectOneLabelStyle(page.getByRole("main"), ["Invoice photo", "Receipt text"]);
  const id = await seedDraft({});
  await openReview(page, id);
  await expectOneLabelStyle(page.getByRole("region", { name: "Draft review" }), [
    "Product",
    "Vendor",
    "Weight (lbs)",
    "Cost per lb",
    "Received date",
  ]);
});

test("AC-0001: /ask labels its question field in one style", async ({ page }) => {
  await openAsk(page);
  await expectOneLabelStyle(page.getByRole("main"), ["Your question"]);
});

// ---- AC-0002 and AC-0004: number pairs ----

const FIGURE = "12,345.678";

type Pair = { page: string; open: (page: Page) => Promise<[Locator, Locator]> };

const PAIRS: Pair[] = [
  {
    page: "/receiving: Weight (lbs) and Cost per lb ($)",
    open: async (page) => {
      const f = await openReceivingForm(page);
      return [f.weight, f.cost];
    },
  },
  {
    page: "/production: Raw lbs and Finished lbs (optional)",
    open: async (page) => {
      const f = await openProductionForm(page);
      return [f.raw, f.finished];
    },
  },
  {
    page: "/sales: Weight sold (lbs) and Price per lb ($)",
    open: async (page) => {
      const f = await openSalesForm(page);
      return [f.lbs, f.price];
    },
  },
];

async function boxOf(target: Locator) {
  const found = await target.boundingBox();
  expect(found, "box").not.toBeNull();
  return found!;
}

// The second box is right of the first with the tops of their boxes within 1 px.
async function expectSharedLine(first: Locator, second: Locator) {
  const a = await boxOf(first);
  const b = await boxOf(second);
  expect(b.x, "the second field is right of the first").toBeGreaterThanOrEqual(a.x + a.width);
  expect(Math.abs(a.y - b.y), "the tops of the boxes").toBeLessThanOrEqual(1);
}

for (const { page: label, open } of PAIRS) {
  for (const width of [390, 1024, 1280]) {
    test(`AC-0002: ${label} share a line at ${width} px`, async ({ page }) => {
      await seed502Fixture();
      const [first, second] = await open(page);
      await withTextSize(page, width, 900, 16);
      await expectSharedLine(first, second);
    });
  }
}

// Where the pair shares a line, per the measured inner width of the form (15.4 to 20.5rem at the default size,
// 14.9 and 15.7rem at 1024 and 390 px with 20 px text, and 11.9rem at 1280 px with 20 px text, which stacks).
const SIZES: Array<{ width: number; px: number; shares: boolean }> = [
  { width: 390, px: 16, shares: true },
  { width: 1024, px: 16, shares: true },
  { width: 1280, px: 16, shares: true },
  { width: 390, px: 20, shares: true },
  { width: 1024, px: 20, shares: true },
  { width: 1280, px: 20, shares: false },
];

for (const { page: label, open } of PAIRS) {
  for (const { width, px, shares } of SIZES) {
    test(`AC-0004: ${label} hold ${FIGURE} whole at ${width} px with ${px} px text`, async ({ page }) => {
      await seed502Fixture();
      const pair = await open(page);
      await withTextSize(page, width, 900, px);
      if (shares) await expectSharedLine(pair[0], pair[1]);
      else expect((await boxOf(pair[1])).y, "the second field stacks under the first").toBeGreaterThan((await boxOf(pair[0])).y);
      for (const target of pair) {
        await target.fill(FIGURE);
        const fit = await target.evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
        expect(fit.scroll, "scroll width against client width").toBeLessThanOrEqual(fit.client);
      }
    });
  }
}

// ---- AC-0028: Tab order on the floor forms ----

// The labels of the fields Tab reaches from `start`, in order. A date box holds a stop for each of its month, day,
// and year parts, so a press that stays in the same field adds no name.
async function tabNames(page: Page, start: Locator, count: number) {
  await start.focus();
  const names: string[] = [];
  let last = await start.getAttribute("id");
  for (let presses = 0; names.length < count && presses < count + 6; presses++) {
    await page.keyboard.press("Tab");
    const now = await page.evaluate(() => {
      const node = document.activeElement as HTMLInputElement | null;
      return { id: node?.id ?? "", label: node?.labels?.[0]?.textContent?.trim() ?? "" };
    });
    if (now.id === last) continue;
    last = now.id;
    names.push(now.label);
  }
  return names;
}

const ORDERS: Array<{ page: string; open: (page: Page) => Promise<Locator>; names: string[] }> = [
  {
    page: "/receiving",
    open: async (page) => (await openReceivingForm(page)).code,
    names: ["Vendor", "Weight (lbs)", "Cost per lb ($)", "Received date", "Notes (optional)"],
  },
  {
    page: "/production",
    open: async (page) => (await openProductionForm(page)).code,
    names: ["Raw lbs", "Finished lbs (optional)", "Production date", "Notes (optional)"],
  },
  {
    page: "/sales",
    open: async (page) => (await openSalesForm(page)).code,
    names: ["Weight sold (lbs)", "Price per lb ($)", "Customer", "Sale date"],
  },
];

for (const { page: label, open, names } of ORDERS) {
  for (const width of [390, 1280]) {
    test(`AC-0028: Tab from Product code on ${label} at ${width} px reaches the other fields in order`, async ({ page }) => {
      await seed502Fixture();
      const start = await open(page);
      await withTextSize(page, width, 900, 16);
      expect(await tabNames(page, start, names.length)).toEqual(names);
    });
  }
}
