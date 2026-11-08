import { expect, test, type Locator, type Page } from "@playwright/test";
import { callAsOperator, idOf, PROD_502_ID, produceCall, RAW_TOM_ID, resetTestData, reverseCall, voidReceiptCall, voidSaleCall } from "../db";
import { addFinished, addRaw, cardFor, produce } from "./menu-page";
import { card as pricingCard, detail as pricingDetail, opensDetail } from "./pricing-page";
import { seedBatch } from "./production-page";
import { factValue, lotNumberOf, seedReceipt } from "./receiving-page";
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

// The size the browser's text size is set to for the second pass, as a larger setting would.
async function setRootSize(page: Page, size: string) {
  await page.evaluate((value) => {
    document.documentElement.style.fontSize = value;
  }, size);
}

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
      for (const size of ["", "20px"]) {
        for (const width of STOCK_WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(card.url);
          const region = page.getByRole("region", { name: card.name });
          await expect(region).toBeVisible();
          await setRootSize(page, size);
          for (const label of [card.onHand, card.average]) {
            const value = factValue(region, label);
            await expect(value).toHaveCount(1);
            const seen = await tileMeasure(value, false);
            const where = `${card.name}, ${label}, ${width} px, text ${size || "default"}`;
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

  test(`AC-0007: Void and Correct, and In use and Correct, sit side by side with their tops level at ${width} px`, async ({ page }) => {
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
    // The tag's own cell is as tall as a button, so its top is the tag's top; the pill sits in its middle.
    const cell = await tag.locator("..").boundingBox();
    const pill = await tag.boundingBox();
    const correct = await inUse.getByRole("button", { name: `Correct lot ${lots.inUse}`, exact: true }).boundingBox();
    expect(Math.abs(cell!.y - correct!.y), "In use cell and Correct tops").toBeLessThanOrEqual(1);
    expect(Math.abs(pill!.y + pill!.height / 2 - (correct!.y + correct!.height / 2)), "In use and Correct middles").toBeLessThanOrEqual(1);
    expect(pill!.x + pill!.width, "In use left of Correct").toBeLessThanOrEqual(correct!.x + 1);
  });

  test(`AC-0008: no row's own Void button takes the error color at ${width} px`, async ({ page }) => {
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

// 11 sales of 502, the first entered carrying the newest sale date: the 10 last-entered show, so it does not.
test("AC-0020: with 11 sales Recent sales shows the 10 most recently entered", async ({ page }) => {
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
  expect(shown).not.toContain(numbers[0]);
  expect([...shown].sort()).toEqual(numbers.slice(1).sort());
  await expect(sales(page).getByText("Showing the 10 most recent of 11 sales.", { exact: true })).toBeVisible();
});
