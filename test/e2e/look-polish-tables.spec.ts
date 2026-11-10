import { expect, test, type Locator, type Page } from "@playwright/test";
import { callAsOperator, idOf, PROD_502_ID, produceCall, RAW_TOM_ID, resetTestData, reverseCall, voidReceiptCall, voidSaleCall } from "../db";
import { addFinished, addRaw, cardFor, produce, sellableSwitch, setListPrice } from "./menu-page";
import { checkPageState } from "./a11y";
import { seedDraft } from "./invoices-page";
import { card as pricingCard, detail as pricingDetail, opensDetail, setTarget } from "./pricing-page";
import { seedBatch } from "./production-page";
import { factValue, lotNumberOf, seedReceipt } from "./receiving-page";
import { fields as saleFields, saleNumbers, seedSale } from "./sales-page";
import { withTextSize } from "./look-checks";
import { OPERATOR_STATE } from "./states";

// Spec polish-tables-status, how the lists and cards are drawn on Menu, Pricing, Sales, Receiving, Production,
// and the trace: the status tags with a dot and the quiet reason lines (AC-0001 to AC-0005), "No list price yet"
// as quiet regular text (AC-0023, AC-0024), the stock tiles' numbers on one line (AC-0014, AC-0022), the sale trace's
// labels above their values (AC-0015), whole lot numbers, sale numbers, and dates, the sale number as a link that
// takes a press, the lot number under its date, Void and Correct side by side, the quiet Void button, Recent
// sales' order and its 10 sales (AC-0006 to AC-0009, AC-0020), Pricing's apply button and advice box
// (AC-0010, AC-0011), Menu's switch, in normal colors, in forced colors, and at large text (AC-0012, AC-0021),
// no text above weight 500 on twelve surfaces (AC-0013), Menu's status tags on one line, and the page-state
// check on six screens (AC-0019). Operator session; data is reset before each test, then one fixed state is
// built with made-up data.

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
  // A tag (AC-0001) is a rounded element with its own fill: here, any element from the word up to its row (the
  // nearest li or dl, which is not counted) that has a fill and any rounded corner, whatever radius token it uses.
  // The card or panel that holds the list sits above the row, so it is never counted.
  const style = await word.evaluate((node) => {
    let inTag = false;
    for (let n: Element | null = node; n && !n.matches("li, dl"); n = n.parentElement) {
      const css = getComputedStyle(n);
      const rounded = [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomLeftRadius, css.borderBottomRightRadius].some(
        (r) => parseFloat(r) > 0,
      );
      if (css.backgroundColor !== "rgba(0, 0, 0, 0)" && rounded) inTag = true;
    }
    return { color: getComputedStyle(node).color, inTag };
  });
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

// ---- Stock tiles and the sale trace ----

// The two stock cards, each with where it opens, its region name, and its two tile labels. Their on-hand tile
// reads the raw product's stock, which one receipt of RAW-TOM sets.
const STOCK_CARDS = [
  { name: "Stock and prices", url: "/receiving?product=RAW-TOM", onHand: "On hand", average: "Average cost" },
  { name: "Product and raw stock", url: "/production?product=502", onHand: "Raw on hand", average: "Raw average cost" },
] as const;

// The two stock amounts AC-0014 names, each bought at $1.7520/lb.
const STOCKS = [12345.678, 1234567.891];

const STOCK_WIDTHS = [390, 1024, 1280];

// A tile's value as laid out: the lines its text holds (distinct line tops of a Range over the text before its
// first space, or over all of it), how far its text and its box reach against the tile, and whether the value's
// own content is cut (scroll width against client width).
function tileMeasure(value: Locator, whole: boolean) {
  return value.evaluate((node, all) => {
    const text = node.firstChild as Text;
    const end = all ? text.length : text.data.indexOf(" ") === -1 ? text.length : text.data.indexOf(" ");
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, end);
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
    const tops = new Set(rects.map((rect) => Math.round(rect.top)));
    const tile = node.parentElement!.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const textRight = Math.max(...rects.map((rect) => rect.right));
    const textLeft = Math.min(...rects.map((rect) => rect.left));
    return {
      lines: tops.size,
      textInside: textLeft >= tile.left - 0.5 && textRight <= tile.right + 0.5,
      boxInside: box.left >= tile.left - 0.5 && box.right <= tile.right + 0.5,
      uncut: node.scrollWidth <= node.clientWidth,
      tileUncut: node.parentElement!.scrollWidth <= node.parentElement!.clientWidth,
      width: Math.round(tile.width),
      top: Math.round(tile.top),
    };
  }, whole);
}

for (const card of STOCK_CARDS) {
  for (const lbs of STOCKS) {
    test(`AC-0014: ${card.name} keeps each tile number on one line inside its tile with ${lbs} lbs on hand`, async ({ page }) => {
      await seedReceipt(lbs, 1.752, "2026-10-01");
      for (const size of [16, 20]) {
        for (const width of STOCK_WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(card.url);
          const region = page.getByRole("region", { name: card.name });
          await expect(region).toBeVisible();
          await withTextSize(page, width, 900, size);
          for (const label of [card.onHand, card.average]) {
            const value = factValue(region, label);
            await expect(value).toHaveCount(1);
            const seen = await tileMeasure(value, false);
            const where = `${card.name}, ${label}, ${width} px, text ${size} px`;
            expect(seen.lines, `${where}: one line box`).toBe(1);
            expect(seen.textInside, `${where}: the number ends inside its tile`).toBe(true);
            expect(seen.boxInside, `${where}: the value's box ends inside its tile`).toBe(true);
            expect(seen.uncut, `${where}: the value is not cut`).toBe(true);
            expect(seen.tileUncut, `${where}: the tile is not cut`).toBe(true);
          }
        }
      }
    });
  }

  test(`AC-0022: ${card.name} keeps 12,345.678 lbs on one line with its unit`, async ({ page }) => {
    await seedReceipt(12345.678, 1.752, "2026-10-01");
    for (const width of STOCK_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(card.url);
      const region = page.getByRole("region", { name: card.name });
      const value = factValue(region, card.onHand);
      await expect(value).toHaveText("12,345.678 lbs");
      const seen = await tileMeasure(value, true);
      expect(seen.lines, `${width} px: the number and its unit share a line`).toBe(1);
      expect(seen.uncut, `${width} px: not cut`).toBe(true);
    }
  });
}

// Two batches of 502 and one sale that draws from both, so the sale trace holds a batch card for each and
// raw lot blocks inside them. Returns the sale's number.
async function sellFromTwoBatches(): Promise<string> {
  await seedReceipt(1500, 1.68, "2026-10-01");
  await seedReceipt(1500, 1.8, "2026-10-02");
  await seedBatch(1000, "2026-10-03", 800);
  await seedBatch(1000, "2026-10-04", 800);
  await seedSale(1200, "2026-10-05");
  return (await saleNumbers())[0]!;
}

for (const width of [1280, 1920]) {
  test(`AC-0015: a sale trace puts every label directly above its value at ${width} px`, async ({ page }) => {
    const number = await sellFromTwoBatches();
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/trace?sale=${number}`);
    const result = page.locator("section[aria-labelledby='sale-trace-heading']");
    await expect(result).toBeVisible();
    // The sale's card, two batch cards, and at least one raw lot block in each batch.
    const lists = result.locator("dl");
    expect(await lists.count()).toBeGreaterThanOrEqual(1 + 2 + 2);
    const rows = await lists.evaluateAll((dls) =>
      dls.flatMap((dl) =>
        [...dl.children].map((row) => {
          const label = row.querySelector("dt")!;
          const value = row.querySelector("dd")!;
          const a = label.getBoundingClientRect();
          const b = value.getBoundingClientRect();
          return {
            text: label.textContent,
            gap: b.top - a.bottom,
            offset: Math.abs(a.left - b.left),
            uncut: value.scrollWidth <= value.clientWidth,
          };
        }),
      ),
    );
    expect(rows.length).toBeGreaterThanOrEqual(5 + 2 * 2 + 2 * 5);
    for (const row of rows) {
      expect(row.gap, `${row.text}: label bottom at or above value top`).toBeGreaterThanOrEqual(-0.5);
      expect(row.offset, `${row.text}: left edges within 1 px`).toBeLessThanOrEqual(1);
      expect(row.uncut, `${row.text}: value not cut`).toBe(true);
    }
  });
}

// ---- Recent receipts and Recent sales ----

// One value shows whole: its text lies on a single line (a Range over the text holds one line top and is no
// taller than one line box) and does not run past its cell (scroll width against client width, on the node and
// on the cell that holds it).
function oneLine(value: Locator) {
  return value.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
    const lineBox = parseFloat(getComputedStyle(node).lineHeight);
    const cell = node.parentElement!;
    return {
      text: node.textContent ?? "",
      lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
      height: range.getBoundingClientRect().height,
      lineBox,
      uncut: node.scrollWidth <= node.clientWidth && cell.scrollWidth <= cell.clientWidth,
    };
  });
}

function expectWhole(seen: Awaited<ReturnType<typeof oneLine>>, expected: string) {
  expect(seen.text, "the value read").toBe(expected);
  expect(seen.lineBox, "a line box in px").toBeGreaterThan(0);
  expect(seen.lines, `${expected}: one line`).toBe(1);
  expect(seen.height, `${expected}: no taller than one line box`).toBeLessThanOrEqual(seen.lineBox + 1);
  expect(seen.uncut, `${expected}: not past its cell`).toBe(true);
}

for (const width of WIDTHS) {
  test(`AC-0006: every lot number and Received date, sale number and sale date shows whole on one line at ${width} px`, async ({ page }) => {
    const lots = await build();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/receiving?product=RAW-TOM");
    await expect(receipts(page).locator("div[aria-hidden='true']").first()).toBeVisible();
    for (const lot of [lots.inUse, lots.untouched, lots.voided]) {
      const item = receipts(page).locator("ul > li").filter({ hasText: lot });
      await expect(item).toHaveCount(1);
      expectWhole(await oneLine(item.locator("dd").nth(0)), lot);
      expectWhole(await oneLine(item.locator("dd").nth(1)), await item.locator("dd").nth(1).innerText());
    }
    await page.goto("/sales");
    await expect(sales(page).locator("div[aria-hidden='true']").first()).toBeVisible();
    for (const number of lots.sales) {
      const item = sales(page).locator("ul > li").filter({ has: page.getByRole("link", { name: number, exact: true }) });
      await expect(item).toHaveCount(1);
      expectWhole(await oneLine(item.getByRole("link", { name: number, exact: true })), number);
      expectWhole(await oneLine(item.locator("dd").nth(0)), await item.locator("dd").nth(0).innerText());
    }
  });

  test(`AC-0007: Void and Correct, and In use and Correct, sit side by side, Void and Correct with their tops level and In use with its middle level with Correct's, at ${width} px`, async ({ page }) => {
    const lots = await build();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/receiving?product=RAW-TOM");
    await expect(receipts(page).locator("div[aria-hidden='true']").first()).toBeVisible();
    const untouched = receipts(page).locator("ul > li").filter({ hasText: lots.untouched });
    const first = await untouched.getByRole("button", { name: `Void lot ${lots.untouched}`, exact: true }).boundingBox();
    const second = await untouched.getByRole("button", { name: `Correct lot ${lots.untouched}`, exact: true }).boundingBox();
    expect(Math.abs(first!.y - second!.y), "Void and Correct tops").toBeLessThanOrEqual(1);
    expect(first!.x + first!.width, "Void left of Correct").toBeLessThanOrEqual(second!.x + 1);

    const inUse = receipts(page).locator("ul > li").filter({ hasText: lots.inUse });
    const tag = inUse.getByText("In use", { exact: true });
    // The visible tag's own box (the pill), not its wrapper's.
    const pill = await tag.boundingBox();
    const correct = await inUse.getByRole("button", { name: `Correct lot ${lots.inUse}`, exact: true }).boundingBox();
    expect(Math.abs(pill!.y + pill!.height / 2 - (correct!.y + correct!.height / 2)), "In use and Correct middles").toBeLessThanOrEqual(1);
    expect(pill!.x + pill!.width, "In use left of Correct").toBeLessThanOrEqual(correct!.x + 1);
  });

  test(`AC-0008: no row's own Void button takes the error color and each is ink on the surface with the field border, 44 px tall, with 12 px padding at ${width} px`, async ({ page }) => {
    const lots = await build();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/sales");
    const error = await token(page, "--color-error");
    const ink = await token(page, "--color-ink");
    const surface = await token(page, "--color-surface");
    const border = await token(page, "--color-field-border");
    const lotNames = [`Void lot ${lots.untouched}`];
    const saleNames = lots.sales.map((number) => `Void sale ${number}`);
    for (const [url, names] of [["/receiving?product=RAW-TOM", lotNames], ["/sales", saleNames]] as const) {
      await page.goto(url);
      let seen = 0;
      for (const name of names) {
        const button = page.getByRole("button", { name, exact: true });
        if ((await button.count()) === 0) continue; // the voided sale has no Void button
        seen += 1;
        const style = await button.evaluate((node) => {
          const css = getComputedStyle(node);
          return {
            color: css.color,
            borders: [css.borderTopColor, css.borderRightColor, css.borderBottomColor, css.borderLeftColor],
            fill: css.backgroundColor,
            height: node.getBoundingClientRect().height,
            padding: [css.paddingLeft, css.paddingRight],
          };
        });
        expect(style.color, `${name} text`).not.toBe(error);
        expect(style.borders, `${name} border`).not.toContain(error);
        expect(style.fill, `${name} fill`).not.toBe(error);
        // The quiet look: ink on the surface with the field border, 44 px tall, px-3.
        expect(style.color).toBe(ink);
        expect(style.borders).toEqual([border, border, border, border]);
        expect(style.fill).toBe(surface);
        expect(style.height).toBe(44);
        expect(style.padding).toEqual(["12px", "12px"]);
      }
      expect(seen, `Void buttons read on ${url}`).toBeGreaterThan(0);
    }
  });
}

for (const width of WIDTHS) {
  test(`a pointer click on each sale number in Recent sales opens its trace at ${width} px`, async ({ page }) => {
    const lots = await build();
    await page.setViewportSize({ width, height: 900 });
    for (const number of lots.sales) {
      await page.goto("/sales");
      await expect(sales(page).locator("div[aria-hidden='true']").first(), "the table shows").toBeVisible();
      await sales(page).getByRole("link", { name: number, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/trace\\?sale=${number}$`));
    }
  });
}

test(`with a vendor name that wraps, each receipt's lot number sits directly under its date at 1280 px`, async ({ page }) => {
  const lots = await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/receiving?product=RAW-TOM");
  await expect(receipts(page).locator("div[aria-hidden='true']").first(), "the table shows").toBeVisible();
  for (const lot of [lots.inUse, lots.untouched, lots.voided]) {
    const item = receipts(page).locator("ul > li").filter({ hasText: lot });
    await expect(item).toHaveCount(1);
    // A cell's box stretches to its row, so the text itself is measured; each cell is found by its label.
    const text = (cell: Locator) =>
      cell.evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        const box = range.getBoundingClientRect();
        const tops = [...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top));
        return { top: box.top, bottom: box.bottom, left: box.left, lines: new Set(tops).size, lineHeight: parseFloat(getComputedStyle(node).lineHeight) };
      });
    const lotCell = await text(factValue(item, "Lot number"));
    const date = await text(factValue(item, "Received"));
    const vendor = await text(factValue(item, "Vendor"));
    const seen = {
      vendorLines: vendor.lines,
      // Two stacked lines leave only their leading between their text boxes; a blank line would add a whole line box.
      leading: date.lineHeight - (date.bottom - date.top),
      gap: lotCell.top - date.bottom,
      sameColumn: Math.abs(lotCell.left - date.left),
    };
    expect(seen.vendorLines, `${lot}: the vendor name wraps`).toBeGreaterThanOrEqual(2);
    expect(seen.sameColumn, `${lot}: lot number and date share a left edge`).toBeLessThanOrEqual(1);
    expect(seen.gap, `${lot}: no blank line under the date`).toBeLessThanOrEqual(seen.leading + 1);
    expect(seen.gap, `${lot}: the lot number is below the date`).toBeGreaterThanOrEqual(-1);
  }
});

// Three sales of 502 entered out of sale-date order, two on one date: entry order is A, B, C; the sale dates
// are A and C on 10 Oct and B on 12 Oct, so the list reads B, then C (entered after A on the same date), then A.
test("AC-0009: Recent sales lists by sale date, newest first, and by entry time within one date", async ({ page }) => {
  await seedReceipt(5000, 1.68, "2026-09-30");
  await seedBatch(2000, "2026-10-01");
  await seedSale(100, "2026-10-10");
  await seedSale(100, "2026-10-12");
  await seedSale(100, "2026-10-10");
  const [a, b, c] = await saleNumbers();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sales");
  const shown = await sales(page).locator("ul > li").getByRole("link").allTextContents();
  expect(shown).toEqual([b, c, a]);
});

// 11 sales of 502, the first entered carrying the newest sale date: the 10 newest by sale date show, so the one dated Oct 1 does not.
test("AC-0020: with 11 sales Recent sales shows the 10 newest by sale date", async ({ page }) => {
  await seedReceipt(5000, 1.68, "2026-09-30");
  await seedBatch(2000, "2026-10-01");
  await seedSale(10, "2026-10-30");
  for (let day = 1; day <= 10; day += 1) await seedSale(10, `2026-10-${String(day).padStart(2, "0")}`);
  const numbers = await saleNumbers();
  expect(numbers).toHaveLength(11);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sales");
  const shown = await sales(page).locator("ul > li").getByRole("link").allTextContents();
  expect(shown).toHaveLength(10);
  expect(shown).not.toContain(numbers[1]);
  expect([...shown].sort()).toEqual([numbers[0], ...numbers.slice(2)].sort());
  await expect(sales(page).getByText("Showing the 10 most recent of 11 sales.", { exact: true })).toBeVisible();
});

// ---- Pricing's advice, Menu's switch, and the weight pass ----

// Reading a color with an alpha channel as it is drawn on a backdrop (a fill such as primary/60 is not used
// by these checks, so the plain channels are enough).
function sameColor(a: string, b: string) {
  expect(channels(a)).toEqual(channels(b));
}

// 502 over RAW-TOM's one receipt at $1.68/lb, no list price: it needs a new price, so the Pricing list and its
// details panel each show an advice sentence and a button.
async function pricingWithAdvice() {
  await seedReceipt(5000, 1.68, "2026-10-01");
  await setTarget(PROD_502_ID, 0.2);
  await setListPrice(PROD_502_ID, 2.68);
}

// What an advice sentence and its box draw: the sentence's weight and color, and the fill of the box it sits in
// (the sentence's own element, or the nearest ancestor with a fill).
function adviceStyle(sentence: Locator) {
  return sentence.evaluate((node) => {
    const css = getComputedStyle(node);
    let box: HTMLElement | null = node as HTMLElement;
    while (box && getComputedStyle(box).backgroundColor === "rgba(0, 0, 0, 0)") box = box.parentElement;
    return { weight: css.fontWeight, color: css.color, fill: box ? getComputedStyle(box).backgroundColor : "none" };
  });
}

for (const width of WIDTHS) {
  test(`AC-0010: the apply button in the Pricing list is outlined in the primary color on the surface at ${width} px`, async ({ page }) => {
    await pricingWithAdvice();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/pricing");
    const button = pricingCard(page, "502").getByRole("button", { name: /list price to/ });
    await expect(button).toHaveCount(1);
    const style = await button.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        color: css.color,
        borders: [css.borderTopColor, css.borderRightColor, css.borderBottomColor, css.borderLeftColor],
        widths: [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth],
        fill: css.backgroundColor,
      };
    });
    const primary = await token(page, "--color-primary");
    sameColor(style.color, primary);
    for (const border of style.borders) sameColor(border, primary);
    for (const w of style.widths) expect(parseFloat(w)).toBeGreaterThan(0);
    sameColor(style.fill, await token(page, "--color-surface"));
    expect(contrast(style.color, style.fill), "button text on its fill").toBeGreaterThanOrEqual(4.5);
  });
}

test("AC-0011: the advice sentence in the Pricing list and in the details panel is weight 400 in the advice box", async ({ page }) => {
  await pricingWithAdvice();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/pricing");
  const fill = await token(page, "--color-advice-fill");
  const text = await token(page, "--color-advice-text");
  const inList = pricingCard(page, "502").getByText(/^Cost is /);
  await expect(inList).toHaveCount(1);
  const listStyle = await adviceStyle(inList);
  expect(listStyle.weight, "list sentence weight").toBe("400");
  sameColor(listStyle.fill, fill);
  sameColor(listStyle.color, text);
  expect(contrast(listStyle.color, listStyle.fill)).toBeGreaterThanOrEqual(4.5);

  await opensDetail(page, "502");
  const inPanel = pricingDetail(page).region.getByText(/^Cost is /);
  await expect(inPanel).toHaveCount(1);
  const panelStyle = await adviceStyle(inPanel);
  expect(panelStyle.weight, "panel sentence weight").toBe("400");
  sameColor(panelStyle.fill, fill);
  sameColor(panelStyle.color, text);
});

// The switch's parts as drawn: the track is the checkbox, the knob is its ::before. Colors and the knob's size
// come from computed styles. A pseudo-element has no box to measure, so the knob's left offset inside the track
// is its computed `left` plus its translate (the knob is absolutely positioned in the track).
function switchParts(box: Locator) {
  return box.evaluate((input) => {
    const track = input as HTMLInputElement;
    const css = getComputedStyle(track);
    const knob = getComputedStyle(track, "::before");
    const rect = track.getBoundingClientRect();
    const px = (value: string) => (value === "auto" || value === "normal" ? 0 : parseFloat(value));
    const translate = knob.translate === "none" ? 0 : parseFloat(knob.translate.split(" ")[0]!);
    const transform = knob.transform === "none" ? 0 : new DOMMatrixReadOnly(knob.transform).m41;
    const left = knob.position === "absolute" ? px(knob.left) + px(knob.marginLeft) : px(knob.marginLeft);
    const edges = [css.borderTopColor, css.borderRightColor, css.borderBottomColor, css.borderLeftColor];
    return {
      checked: track.checked,
      role: track.getAttribute("type"),
      trackW: rect.width,
      trackH: rect.height,
      trackFill: css.backgroundColor,
      trackEdge: edges[0]!,
      edgeWidth: parseFloat(css.borderTopWidth),
      radius: parseFloat(css.borderTopLeftRadius),
      knobW: px(knob.width),
      knobH: px(knob.height),
      knobFill: knob.backgroundColor,
      knobContent: knob.content,
      knobLeft: left + translate + transform,
      // The knob is centred by top and bottom 0 with auto margins; its used top margin is its offset.
      knobTop: knob.position === "absolute" ? px(knob.top) + px(knob.marginTop) : px(knob.marginTop),
      borderLeft: parseFloat(css.borderLeftWidth),
    };
  });
}

async function behindSwitch(box: Locator) {
  return box.evaluate((input) => {
    let node: HTMLElement | null = input.parentElement;
    while (node && getComputedStyle(node).backgroundColor === "rgba(0, 0, 0, 0)") node = node.parentElement;
    return node ? getComputedStyle(node).backgroundColor : "rgb(255, 255, 255)";
  });
}

for (const width of [390, 1280]) {
  test(`AC-0012, AC-0021: Menu's Sellable only is a checkbox drawn as a switch with a visible edge and knob at ${width} px`, async ({ page }) => {
    await build();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/menu");
    const box = page.getByRole("checkbox", { name: "Sellable only" });
    await expect(box).toHaveCount(1);
    await expect(box).not.toBeChecked();
    const surface = await token(page, "--color-surface");
    const primary = await token(page, "--color-primary");
    const border = await token(page, "--color-field-border");

    const off = await switchParts(box);
    expect(off.knobContent, "a knob drawn by ::before").not.toBe("none");
    expect(off.radius, "a rounded-full track").toBeGreaterThanOrEqual(off.trackH / 2);
    expect(off.knobW, "a round knob").toBe(off.knobH);
    expect(off.knobW).toBeGreaterThan(0);
    expect(off.knobW).toBeLessThan(off.trackH);
    sameColor(off.trackFill, surface);
    sameColor(off.trackEdge, border);
    expect(off.edgeWidth, "an edge").toBeGreaterThan(0);
    sameColor(off.knobFill, border);
    const behind = await behindSwitch(box);
    expect(contrast(off.trackEdge, behind), "off: edge against what is behind").toBeGreaterThanOrEqual(3);
    expect(contrast(off.knobFill, off.trackFill), "off: knob against the track").toBeGreaterThanOrEqual(3);
    const offLeft = off.knobLeft;

    await box.check();
    // The knob's move is a short transition (where motion is allowed): wait until it has stopped.
    await expect.poll(async () => (await switchParts(box)).knobLeft, "the knob's move ends").toBeGreaterThan(off.knobLeft + 20);
    await expect.poll(async () => {
      const first = (await switchParts(box)).knobLeft;
      await page.waitForTimeout(150);
      return first === (await switchParts(box)).knobLeft;
    }).toBe(true);
    const on = await switchParts(box);
    expect(on.checked).toBe(true);
    sameColor(on.trackFill, primary);
    sameColor(on.knobFill, surface);
    expect(contrast(on.trackFill, behind), "on: track against what is behind").toBeGreaterThanOrEqual(3);
    expect(contrast(on.knobFill, on.trackFill), "on: knob against the track").toBeGreaterThanOrEqual(3);

    // The knob sits at the track's left when off and at its right when on: measured as the knob's offset
    // from the track's inner left edge.
    const inner = off.trackW - 2 * off.borderLeft;
    expect(offLeft, "off: knob at the left").toBeLessThan(inner / 2 - off.knobW / 2);
    expect(on.knobLeft, "on: knob at the right").toBeGreaterThan(inner / 2 - on.knobW / 2);
    expect(on.knobLeft + on.knobW, "on: knob inside the track").toBeLessThanOrEqual(inner + 0.5);
    expect(await box.getAttribute("type")).toBe("checkbox");
  });
}

// The switch's knob and track as measured in px, for the two states below: the knob lies inside the track's
// inner box in both directions.
async function expectKnobInside(box: Locator, where: string) {
  const seen = await switchParts(box);
  const innerW = seen.trackW - 2 * seen.borderLeft;
  const innerH = seen.trackH - 2 * seen.edgeWidth;
  expect(seen.knobLeft, `${where}: knob not past the left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(seen.knobLeft + seen.knobW, `${where}: knob not past the right edge`).toBeLessThanOrEqual(innerW + 0.5);
  expect(seen.knobTop, `${where}: knob not past the top edge`).toBeGreaterThanOrEqual(-0.5);
  expect(seen.knobTop + seen.knobH, `${where}: knob not past the bottom edge`).toBeLessThanOrEqual(innerH + 0.5);
}

async function settled(page: Page, box: Locator) {
  await expect.poll(async () => {
    const first = (await switchParts(box)).knobLeft;
    await page.waitForTimeout(150);
    return first === (await switchParts(box)).knobLeft;
  }).toBe(true);
}

test("Menu's switch keeps its knob inside its track, off and on, with the browser's text at 24 px", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/menu");
  const box = page.getByRole("checkbox", { name: "Sellable only" });
  await expect(box).toHaveCount(1);
  await withTextSize(page, 1280, 900, 24);
  await settled(page, box);
  await expectKnobInside(box, "off");
  await box.check();
  await settled(page, box);
  await expectKnobInside(box, "on");
  expect((await switchParts(box)).knobLeft, "on: the knob moved right").toBeGreaterThan(20);
});

test("under forced colors Menu's switch knob has its own outline, at the track's left when off and its right when on", async ({ page }) => {
  await build();
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/menu");
  const box = page.getByRole("checkbox", { name: "Sellable only" });
  await expect(box).toHaveCount(1);
  const knobEdge = (input: Locator) => input.evaluate((node) => parseFloat(getComputedStyle(node, "::before").borderTopWidth));
  const off = await switchParts(box);
  expect(await knobEdge(box), "off: the knob has an outline").toBeGreaterThanOrEqual(2);
  const inner = off.trackW - 2 * off.borderLeft;
  expect(off.knobLeft, "off: knob at the left").toBeLessThan(inner / 2 - off.knobW / 2);
  await box.check();
  await settled(page, box);
  const on = await switchParts(box);
  expect(await knobEdge(box), "on: the knob has an outline").toBeGreaterThanOrEqual(2);
  expect(on.knobLeft, "on: knob at the right").toBeGreaterThan(inner / 2 - on.knobW / 2);
});

// ---- AC-0013: no text above weight 500 on the listed surfaces ----

// Every text node under `root` with its computed weight (read from its parent element), leaving out only the
// parts AC-0013 names, matched by structure: an element with the heading role, a list's header line (an
// aria-hidden row of column names), a table row's first column (under the header's first name), the values in
// a stock tile or a Pricing tile (the value element only, not the tile's label), a button, and a tag (a filled, fully rounded element). Returns the text nodes
// that render above 500, and how many it read.
function heavyText(root: Locator) {
  return root.evaluate((section) => {
    const heavy: { text: string; weight: string; where: string }[] = [];
    let read = 0;
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    const headerOf = (row: Element) => {
      const scope = row.closest("section, [role=region]") ?? section;
      const rowTop = row.getBoundingClientRect().top;
      let best: Element | null = null;
      for (const header of scope.querySelectorAll('div[aria-hidden="true"]')) {
        const rect = header.getBoundingClientRect();
        if (rect.width === 0 || header.children.length < 2 || rect.bottom > rowTop + 1) continue;
        if (!best || rect.bottom > best.getBoundingClientRect().bottom) best = header;
      }
      return best;
    };
    const describe = (el: Element) => {
      const path: string[] = [];
      for (let n: Element | null = el; n && n !== section && path.length < 4; n = n.parentElement) {
        path.push(n.tagName.toLowerCase() + (n.getAttribute("role") ? `[${n.getAttribute("role")}]` : ""));
      }
      return path.join(" < ");
    };
    const exempt = (el: Element, range: Range) => {
      let below: Element | null = null; // the child of `n` the climb came from
      for (let n: Element | null = el; n && n !== section.parentElement; below = n, n = n.parentElement) {
        const role = n.getAttribute("role");
        if (/^h[1-6]$/i.test(n.tagName) || role === "heading") return true;
        if (n.tagName === "BUTTON" || role === "button") return true;
        if (n.getAttribute("aria-hidden") === "true") return true; // a header line
        // A Pricing tile: its value is the tile's last child; its label is not exempt.
        if (n.tagName === "LI" && n.parentElement?.getAttribute("aria-label") === "Product counts" && below === n.lastElementChild) return true;
        const css = getComputedStyle(n);
        const h = n.getBoundingClientRect().height;
        if (css.backgroundColor !== "rgba(0, 0, 0, 0)" && h > 0 && parseFloat(css.borderTopLeftRadius) >= h / 2) return true; // a tag
        if (n.tagName === "DL" || n.tagName === "DD" || n.tagName === "DT") continue;
        // A stock tile: a filled box in a definition list that holds a label and its value.
        if (n.tagName === "DIV" && n.parentElement?.tagName === "DL" && css.backgroundColor !== "rgba(0, 0, 0, 0)" && !n.closest("li") && below?.tagName === "DD") return true;
      }
      // A table row's first column: the row is a list item under a header line, and the text lies within the
      // header's first name.
      const row = el.closest("li");
      if (row) {
        const header = headerOf(row);
        const first = header?.children[0];
        if (first) {
          const a = first.getBoundingClientRect();
          const r = range.getBoundingClientRect();
          const mid = (r.left + r.right) / 2;
          if (mid >= a.left - 0.5 && mid <= a.right + 0.5) return true;
        }
      }
      return false;
    };
    for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
      if (!node.data.trim()) continue;
      const el = node.parentElement!;
      const css = getComputedStyle(el);
      if (css.display === "none" || css.visibility === "hidden") continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      read += 1;
      if (parseInt(css.fontWeight, 10) <= 500) continue;
      if (exempt(el, range)) continue;
      heavy.push({ text: node.data.trim().slice(0, 40), weight: css.fontWeight, where: describe(el) });
    }
    return { heavy, read };
  });
}

// One surface of AC-0013: where it opens, how its root is found, and the text it must at least read (so a walk
// that found nothing cannot pass).
async function weightState(): Promise<{ lot: string; sale: string }> {
  const lots = await build();
  await seedDraft({ capturedOn: "2026-10-01", words: ["FIRST receipt line of the day", "second line"] });
  return { lot: lots.untouched, sale: lots.sales[0]! };
}

const WEIGHT_SURFACES: {
  name: string;
  url: (s: { lot: string; sale: string }) => string;
  root: (page: Page) => Locator;
  minimum: number;
}[] = [
  { name: "Recent receipts", url: () => "/receiving?product=RAW-TOM", root: receipts, minimum: 10 },
  { name: "Stock and prices", url: () => "/receiving?product=RAW-TOM", root: (p) => p.getByRole("region", { name: "Stock and prices" }), minimum: 4 },
  { name: "Recent batches", url: () => "/production?product=502", root: batches, minimum: 8 },
  { name: "Product and raw stock", url: () => "/production?product=502", root: (p) => p.getByRole("region", { name: "Product and raw stock" }), minimum: 4 },
  { name: "Recent sales", url: () => "/sales", root: sales, minimum: 10 },
  { name: "the Menu list", url: () => "/menu", root: (p) => sellableSwitch(p).locator("xpath=ancestor::section[1]"), minimum: 10 },
  { name: "the Pricing tiles", url: () => "/pricing", root: (p) => p.getByRole("list", { name: "Product counts" }), minimum: 3 },
  { name: "the Pricing list", url: () => "/pricing", root: (p) => p.locator("section[aria-labelledby^='group-']"), minimum: 8 },
  { name: "Drafts to confirm", url: () => "/invoices", root: (p) => p.getByRole("region", { name: "Drafts to confirm" }), minimum: 3 },
  { name: "a lot trace", url: (s) => `/trace?lot=${encodeURIComponent(s.lot)}`, root: (p) => p.locator("section[aria-labelledby='lot-trace-heading']"), minimum: 10 },
  { name: "a sale trace", url: (s) => `/trace?sale=${encodeURIComponent(s.sale)}`, root: (p) => p.locator("section[aria-labelledby='sale-trace-heading']"), minimum: 10 },
  { name: "a raw lot list", url: () => "/trace?raw=RAW-TOM", root: (p) => p.locator("section[aria-labelledby='lot-list-heading']"), minimum: 6 },
];

for (const surface of WEIGHT_SURFACES) {
  test(`AC-0013: no text in ${surface.name} renders above weight 500 at 1280 px`, async ({ page }) => {
    const state = await weightState();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(surface.url(state));
    const root = surface.root(page);
    await expect(root.first()).toBeVisible();
    const seen = { heavy: [] as { text: string; weight: string; where: string }[], read: 0 };
    for (const one of await root.all()) {
      const part = await heavyText(one);
      seen.heavy.push(...part.heavy);
      seen.read += part.read;
    }
    expect(seen.read, "text nodes read").toBeGreaterThanOrEqual(surface.minimum);
    expect(seen.heavy).toEqual([]);
  });
}

// ---- AC-0019: the page-state check on each screen state ----

test("AC-0019: /receiving with a product chosen and a void, an in-use, and an untouched receipt passes the page-state check", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/receiving?product=RAW-TOM");
  await expect(receipts(page).locator("ul > li")).toHaveCount(3);
  await expect(receipts(page).getByText("Voided", { exact: true })).toHaveCount(1);
  await expect(receipts(page).getByText("In use", { exact: true })).toHaveCount(1);
  await checkPageState(page);
});

test("AC-0019: /sales with three recent sales, one void, passes the page-state check", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sales");
  await expect(sales(page).locator("ul > li")).toHaveCount(3);
  await expect(sales(page).getByText("Voided", { exact: true })).toHaveCount(1);
  await checkPageState(page);
});

test("AC-0019: /menu with a sellable, a not-sellable, and a no-list-price product passes the page-state check", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/menu");
  await expect(cardFor(page, "FIN-B").getByText("Sellable now", { exact: true })).toHaveCount(1);
  await expect(cardFor(page, "FIN-C").getByText("Not sellable now", { exact: true })).toHaveCount(1);
  await expect(cardFor(page, "502").getByText("No list price yet", { exact: true })).toHaveCount(1);
  await checkPageState(page);
});

// The owner widened Menu's Status column to 9rem on 2026-11-08 so each tag's word stays on one line where the
// list is a table. The word's own text node is measured, since the tag's dot sits on a different line top.
test("Menu's status tags stay on one line where the list is a table, at 1280 px with default and 20 px text", async ({
  page,
}) => {
  await build();
  for (const size of [16, 20]) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/menu");
    await withTextSize(page, 1280, 900, size);
    await expect(page.locator("span", { hasText: /^Finished on hand$/ }), `${size} px: the header line`).toBeVisible();
    for (const [code, word] of [
      ["502", "Sellable now"],
      ["FIN-B", "Sellable now"],
      ["FIN-C", "Not sellable now"],
    ] as const) {
      const seen = await cardFor(page, code)
        .getByText(word, { exact: true })
        .evaluate((node) => {
          const text = [...node.childNodes].find((child) => child.nodeType === Node.TEXT_NODE) as Text;
          const range = document.createRange();
          range.selectNodeContents(text);
          const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
          const cell = node.parentElement!;
          return {
            lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
            uncut: node.scrollWidth <= node.clientWidth && cell.scrollWidth <= cell.clientWidth,
          };
        });
      expect(seen.lines, `${code} ${size} px: "${word}" on one line`).toBe(1);
      expect(seen.uncut, `${code} ${size} px: "${word}" not past its cell`).toBe(true);
    }
  }
});

test("AC-0019: /pricing with a product needing a new price passes the page-state check", async ({ page }) => {
  await pricingWithAdvice();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/pricing");
  await expect(page.getByText("Needs a new price").first()).toBeVisible();
  await expect(pricingCard(page, "502").getByRole("button", { name: /list price to/ })).toHaveCount(1);
  await checkPageState(page);
});

test("AC-0019: /production with a product chosen and a reversed batch passes the page-state check", async ({ page }) => {
  await build();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/production?product=502");
  await expect(batches(page).getByText("Reversed", { exact: true })).toHaveCount(1);
  await checkPageState(page);
});

test("AC-0019: /trace showing a sale drawn from two batches passes the page-state check", async ({ page }) => {
  const number = await sellFromTwoBatches();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/trace?sale=${number}`);
  await expect(page.locator("section[aria-labelledby='sale-trace-heading']")).toBeVisible();
  await checkPageState(page);
});
