import { expect, test, type Locator, type Page } from "@playwright/test";
import { callAsOperator, idOf, PROD_502_ID, produceCall, RAW_TOM_ID, resetTestData, reverseCall, voidReceiptCall, voidSaleCall } from "../db";
import { addFinished, addRaw, cardFor, produce } from "./menu-page";
import { card as pricingCard, detail as pricingDetail, opensDetail } from "./pricing-page";
import { seedBatch } from "./production-page";
import { lotNumberOf, seedReceipt } from "./receiving-page";
import { fields as saleFields, saleNumbers, seedSale } from "./sales-page";
import { OPERATOR_STATE } from "./states";

// Spec polish-tables-status, the status tags and the quiet reasons: how a status word, a void's reason,
// and "No list price yet" are drawn on Menu, Pricing, Sales, Receiving, and Production. Operator session;
// data is reset before each test, then one fixed state is built with made-up data.

test.use({ storageState: OPERATOR_STATE });

const REASON = "Entered twice by mistake";
const WIDTHS = [1280, 1440];

// The state: a raw product (RAW-TOM) with one untouched receipt, one in use, and one voided; three sales of
// 502 with the middle one voided; two batches of 502 with the second reversed; and a sellable finished product.
// 502 has no list price, so it reads "No list price yet". FIN-B is sellable now and FIN-C, with no stock, is not.
async function build() {
  const inUse = await seedReceipt(5000, 1.68, "2026-10-01");
  const untouched = await seedReceipt(3000, 1.8, "2026-10-05");
  const voided = await seedReceipt(2000, 1.7, "2026-10-06");
  const voidOutcome = await callAsOperator(voidReceiptCall(voided, REASON));
  expect(voidOutcome.ok, voidOutcome.error).toBe(true);
  await seedBatch(2000, "2026-10-07");
  await seedSale(100, "2026-10-08");
  const secondSale = await seedSale(150, "2026-10-09");
  await seedSale(200, "2026-10-10");
  const saleVoid = await callAsOperator(voidSaleCall(secondSale, REASON));
  expect(saleVoid.ok, saleVoid.error).toBe(true);
  const reversedId = idOf(await callAsOperator(produceCall(PROD_502_ID, 500, null, "2026-10-11")));
  const reversal = await callAsOperator(reverseCall(reversedId, REASON));
  expect(reversal.ok, reversal.error).toBe(true);
  const finished = await addFinished("FIN-B", "Finished B", RAW_TOM_ID, { listPrice: 3.29 });
  await produce(finished, 400);
  await addFinished("FIN-C", "Finished C", await addRaw("RAW-NONE"));
  return {
    inUse: await lotNumberOf(inUse),
    untouched: await lotNumberOf(untouched),
    voided: await lotNumberOf(voided),
    sales: await saleNumbers(),
  };
}

test.beforeEach(async () => {
  await resetTestData();
});

// A token's color as the browser computes it, so a test never copies a hex value.
function token(page: Page, name: string): Promise<string> {
  return page.evaluate((variable) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${variable})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);
}

function channels(color: string): number[] {
  const match = color.match(/rgba?\(([^)]+)\)/);
  expect(match, `a color: ${color}`).not.toBeNull();
  return match![1]!.split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);
}

function luminance(color: string): number {
  const [r, g, b] = channels(color).map((value) => {
    const unit = value / 255;
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

// What a status word's element draws: its corners against half its height, its fill against what sits behind
// it, its text color, and the color of the dot before the word.
function drawn(word: Locator) {
  return word.evaluate((node) => {
    const css = getComputedStyle(node);
    let behind: HTMLElement | null = node.parentElement;
    while (behind && getComputedStyle(behind).backgroundColor === "rgba(0, 0, 0, 0)") behind = behind.parentElement;
    const dot = node.querySelector(':scope > [aria-hidden="true"]');
    return {
      pill: parseFloat(css.borderTopLeftRadius) >= node.getBoundingClientRect().height / 2,
      fill: css.backgroundColor,
      behind: behind ? getComputedStyle(behind).backgroundColor : "none",
      text: css.color,
      dot: dot ? getComputedStyle(dot).backgroundColor : null,
    };
  });
}

// A status word shows in a tag with a dot of the tone's color, and its word clears 4.5:1 on the fill.
async function expectTag(page: Page, word: Locator, tone: "priced" | "nocost") {
  await expect(word).toHaveCount(1);
  const style = await drawn(word);
  expect(style.pill, "a rounded tag").toBe(true);
  expect(style.fill, "a fill apart from what is behind").not.toBe(style.behind);
  expect(style.fill, "a fill").not.toBe("rgba(0, 0, 0, 0)");
  expect(style.dot, "a dot before the word").toBe(await token(page, `--color-status-${tone}`));
  expect(contrast(style.text, style.fill), "word on fill").toBeGreaterThanOrEqual(4.5);
}

function receipts(page: Page): Locator {
  return page.getByRole("region", { name: "Recent receipts" });
}
function sales(page: Page): Locator {
  return page.getByRole("region", { name: "Recent sales" });
}
function batches(page: Page): Locator {
  return page.getByRole("region", { name: "Recent batches" });
}

test("AC-0001, AC-0002, AC-0003: Menu's two statuses are tags with a dot", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/menu");
  await expectTag(page, cardFor(page, "FIN-B").getByText("Sellable now", { exact: true }), "priced");
  await expectTag(page, cardFor(page, "FIN-C").getByText("Not sellable now", { exact: true }), "nocost");
});

test("AC-0001, AC-0002, AC-0003: In use and Voided in Recent receipts are tags with a dot", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/receiving?product=RAW-TOM");
  await expectTag(page, receipts(page).getByText("In use", { exact: true }), "nocost");
  await expectTag(page, receipts(page).getByText("Voided", { exact: true }), "nocost");
});

test("AC-0001, AC-0002, AC-0003: Voided in Recent sales is a tag with a dot", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sales");
  await expectTag(page, sales(page).getByText("Voided", { exact: true }), "nocost");
});

test("AC-0001, AC-0002, AC-0003: Reversed in Recent batches is a tag with a dot", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/production?product=502");
  await expectTag(page, batches(page).getByText("Reversed", { exact: true }), "nocost");
});

// The three lists, each with where it opens and the word that marks its voided or reversed row.
const LISTS = [
  { name: "Recent receipts", url: "/receiving?product=RAW-TOM", region: receipts, mark: "Voided", rows: 3 },
  { name: "Recent sales", url: "/sales", region: sales, mark: "Voided", rows: 3 },
  { name: "Recent batches", url: "/production?product=502", region: batches, mark: "Reversed", rows: 2 },
] as const;

for (const list of LISTS) {
  test(`AC-0004: ${list.name} shows its reason as quiet text and no line starts with Void: or Reversed:`, async ({ page }) => {
    await build();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(list.url);
    const section = list.region(page);
    const reason = section.getByText(REASON, { exact: true });
    await expect(reason).toHaveCount(1);
    const style = await reason.evaluate((node) => {
      const css = getComputedStyle(node);
      return { color: css.color, weight: css.fontWeight };
    });
    expect(style.color).toBe(await token(page, "--color-ink-secondary"));
    expect(style.weight).toBe("400");
    await expect(section.getByText(/^(Void|Reversed):/)).toHaveCount(0);
  });

  for (const width of WIDTHS) {
    test(`AC-0005: a ${list.mark.toLowerCase()} row in ${list.name} adds at most one line of its reason at ${width} px`, async ({ page }) => {
      await build();
      await page.setViewportSize({ width, height: 900 });
      await page.goto(list.url);
      const section = list.region(page);
      // The list reads as a table here: its header line is shown.
      await expect(section.locator("div[aria-hidden='true']").first()).toBeVisible();
      const items = section.locator("ul").first().locator(":scope > li");
      await expect(items).toHaveCount(list.rows);
      const marked = items.filter({ hasText: REASON });
      await expect(marked).toHaveCount(1);
      const plain = items.filter({ hasNotText: REASON });
      const plainHeights = await plain.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      const tallest = Math.max(...plainHeights);
      const line = await marked.getByText(REASON).evaluate((node) => parseFloat(getComputedStyle(node).lineHeight));
      expect(line, "a line height in px").toBeGreaterThan(0);
      const height = (await marked.evaluate((node) => node.getBoundingClientRect().height));
      expect(height).toBeLessThanOrEqual(tallest + line);
    });
  }
}

// "No list price yet" is gray text in --color-ink-secondary, outside any tag.
async function expectQuiet(page: Page, word: Locator) {
  await expect(word).toHaveCount(1);
  const style = await word.evaluate((node) => ({
    color: getComputedStyle(node).color,
    inTag: node.closest('[class*="rounded-full"]') !== null,
  }));
  expect(style.color).toBe(await token(page, "--color-ink-secondary"));
  expect(style.inTag, "outside any tag").toBe(false);
}

// "No list price yet" renders at font weight 400.
async function expectRegular(word: Locator) {
  await expect(word).toHaveCount(1);
  expect(await word.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("400");
}

test("AC-0023: No list price yet is gray text, outside a tag, in the Menu list", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/menu");
  await expectQuiet(page, cardFor(page, "502").getByText("No list price yet", { exact: true }));
});

test("AC-0023: No list price yet is gray text, outside a tag, in the Pricing list and the Product details panel", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await opensDetail(page, "502");
  const panel = pricingDetail(page).region;
  await expectQuiet(page, panel.getByText("No list price yet", { exact: true }));
  await expectQuiet(page, pricingCard(page, "502").getByText("No list price yet", { exact: true }));
});

test("AC-0023: No list price yet is gray text, outside a tag, in the New sale form's product facts", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sales");
  const f = saleFields(page);
  await f.code.fill("502");
  await expectQuiet(page, f.facts.getByText("No list price yet", { exact: true }));
});

for (const width of [390, 1280]) {
  test(`AC-0024: No list price yet is at weight 400 in the Menu list at ${width} px`, async ({ page }) => {
    await build();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/menu");
    await expectRegular(cardFor(page, "502").getByText("No list price yet", { exact: true }));
  });
}

test("AC-0024: No list price yet is at weight 400 in the Pricing list and the Product details panel", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await opensDetail(page, "502");
  await expectRegular(pricingDetail(page).region.getByText("No list price yet", { exact: true }));
  await expectRegular(pricingCard(page, "502").getByText("No list price yet", { exact: true }));
});
