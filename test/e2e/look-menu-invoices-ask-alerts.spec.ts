import { expect, test, type Locator, type Page } from "@playwright/test";
import { buildFiveAlertFixture } from "../alert-fixtures";
import { resetTestData, saleFixture } from "../db";
import { checkDesktopWalk, checkPageState } from "./a11y";
import { alertGroup, digestRegion, MARGIN_TITLE, NAV_CONTROLS as ALERTS_NAV, opens } from "./alerts-page";
import { appDate } from "./app-time";
import {
  box,
  boxes,
  expectButtonsInside,
  expectNoCap,
  expectTablesFit,
  expectUncountedNoCap,
  expectWhiteCard,
  measureCells,
  WHITE_CARD,
  withTextSize,
} from "./look-checks";
import {
  fakeModel,
  FORM_CONTROLS,
  NAV_CONTROLS,
  openInvoices,
  openReview,
  review,
  reviewControls,
  seedDraft,
  seedFixture,
  seedLines,
} from "./invoices-page";
import { ask, askControls, modelAnswer, openAsk } from "./ask-page";
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
    await expectWhiteCard(row, "a product is a white card");
  }
  await expectWhiteCard(sellableSwitch(page).locator(".."), "the switch is its own white card");
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
      await expectUncountedNoCap(page);
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

  // The switch's focus ring (the checkbox's box grown by the outline's offset and width) sits inside the card's
  // padding box, which clips, and the offset is not negative, so the ring keeps the card's white behind it.
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`Always do: at ${width}x${height} the Sellable only switch's focus ring sits inside the table's card`, async ({ page }) => {
      await opensMenu(page, width, height);
      const checkbox = sellableSwitch(page);
      for (let presses = 0; presses < 30; presses += 1) {
        if (await checkbox.evaluate((node) => node === document.activeElement)) break;
        await page.keyboard.press("Tab");
      }
      await expect(checkbox).toBeFocused();
      const ring = await checkbox.evaluate((node) => {
        const css = getComputedStyle(node);
        const card = node.parentElement!.parentElement!;
        const cardCss = getComputedStyle(card);
        const rect = node.getBoundingClientRect();
        const outer = card.getBoundingClientRect();
        const offset = parseFloat(css.outlineOffset);
        const grow = offset + parseFloat(css.outlineWidth);
        return {
          style: css.outlineStyle,
          offset,
          grow,
          overflow: cardCss.overflow,
          top: rect.top - grow - (outer.top + parseFloat(cardCss.borderTopWidth)),
          left: rect.left - grow - (outer.left + parseFloat(cardCss.borderLeftWidth)),
          bottom: outer.bottom - parseFloat(cardCss.borderBottomWidth) - (rect.bottom + grow),
          right: outer.right - parseFloat(cardCss.borderRightWidth) - (rect.right + grow),
        };
      });
      expect(ring.overflow, "the table's card clips").toBe("hidden");
      expect(ring.style, "a focus ring is drawn").not.toBe("none");
      expect(ring.offset, "the outline offset is not negative").toBeGreaterThanOrEqual(0);
      expect(ring.grow).toBeGreaterThan(0);
      for (const side of ["top", "left", "bottom", "right"] as const) {
        expect(ring[side], `the ring's ${side} edge is inside the card's padding box`).toBeGreaterThanOrEqual(-0.5);
      }
    });
  }
});

// ---- Invoices ----

const DRAFT_COLUMNS = ["Captured", "From", "Lines", "First words"];

// Three waiting drafts, newest first: a text capture of three lines, a photo of one line, and a text
// capture of two lines.
const THREE = [
  { date: "Oct 9, 2026", source: "Text", lines: "3 lines", words: "NEWEST TURKEY DRUMS 40# CASE" },
  { date: "Oct 8, 2026", source: "Photo", lines: "1 line", words: "PHOTO WORDS" },
  { date: "Oct 1, 2026", source: "Text", lines: "2 lines", words: "FIRST receipt line of the day" },
] as const;

async function seedThree(): Promise<void> {
  await seedFixture();
  // The list is newest capture time first, so the oldest is made first.
  await seedDraft({ capturedOn: "2026-10-01", words: ["FIRST receipt line of the day", "second line"] });
  await seedDraft({ source: "photo", capturedOn: "2026-10-08", words: ["PHOTO WORDS"] });
  await seedLines([{ words: "NEWEST TURKEY DRUMS 40# CASE" }, { words: "b" }, { words: "c" }], { source: "text" });
}

async function opensInvoices(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await seedThree();
  const p = await openInvoices(page);
  await expect(p.draftLinks).toHaveCount(3);
  return p;
}

function draftsHeader(page: Page): Locator {
  return page.getByRole("region", { name: "Drafts to confirm" }).locator("div[aria-hidden='true']");
}

// The boxes of named locators.
async function namedBoxes<K extends string>(targets: Record<K, Locator>): Promise<Record<K, Awaited<ReturnType<typeof box>>>> {
  const found = await Promise.all(Object.entries<Locator>(targets).map(async ([key, target]) => [key, await box(target)] as const));
  return Object.fromEntries(found) as Record<K, Awaited<ReturnType<typeof box>>>;
}

// A draft's parts: the date, the source, the comma, the line count, and the first words.
function draftParts(link: Locator) {
  return {
    date: link.locator(":scope > span:nth-child(1)"),
    source: link.locator(":scope > span:nth-child(2) > span:nth-child(1)"),
    comma: link.locator(":scope > span:nth-child(2) > span:nth-child(2)"),
    lines: link.locator(":scope > span:nth-child(2) > span:nth-child(3)"),
    words: link.locator(":scope > span:nth-child(3)"),
  };
}

// AC-0022: each draft is one link whose text is its date, source, ", ", line count, and first words.
async function expectLinkText(p: Awaited<ReturnType<typeof opensInvoices>>): Promise<void> {
  const links = await p.draftLinks.all();
  expect(links).toHaveLength(THREE.length);
  for (const [index, link] of links.entries()) {
    const row = THREE[index]!;
    expect(await link.textContent(), `draft ${index}`).toBe(`${row.date}${row.source}, ${row.lines}${row.words}`);
  }
  await expect(p.draftsSection.locator("li")).toHaveCount(THREE.length);
  await expect(p.draftsSection.locator("li > a")).toHaveCount(THREE.length);
}

// No part's text runs past its cell.
async function expectDraftsNoSpill(p: Awaited<ReturnType<typeof opensInvoices>>): Promise<void> {
  for (const link of await p.draftLinks.all()) {
    const { date, source, lines, words } = draftParts(link);
    for (const part of [date, source, lines, words]) {
      expect(await part.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    const edge = await box(link);
    for (const part of [date, source, lines, words]) {
      const shown = await box(part);
      expect(shown.x + shown.width).toBeLessThanOrEqual(edge.x + edge.width + 0.5);
    }
  }
}

// The drafts read as one table: one header line naming the columns in order, each draft on one line with
// its parts under those columns, the comma hidden visually, and no text past its cell.
async function expectDraftsTable(page: Page, p: Awaited<ReturnType<typeof opensInvoices>>): Promise<void> {
  const header = draftsHeader(page);
  await expect(header).toBeVisible();
  expect((await header.locator("span").allTextContents()).map((text) => text.trim())).toEqual(DRAFT_COLUMNS);
  const headerBox = await box(header);
  const columns = await boxes(header.locator("span"));
  for (const link of await p.draftLinks.all()) {
    const edge = await box(link);
    expect(edge.y, "the header line is above the draft").toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    const { date, source, comma, lines, words } = draftParts(link);
    const cells = await Promise.all([date, source, lines, words].map(box));
    const middles = cells.map((cell) => cell.y + cell.height / 2);
    expect(Math.max(...middles) - Math.min(...middles), "one line").toBeLessThanOrEqual(6);
    cells.forEach((cell, index) => {
      expect(Math.abs(cell.x - columns[index]!.x), `column ${index} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(cell.width - columns[index]!.width), `column ${index} width`).toBeLessThanOrEqual(1);
    });
    expect((await box(comma)).width, "the comma is hidden visually").toBeLessThanOrEqual(1);
    expect(await comma.textContent()).toBe(", ");
  }
  await expectDraftsNoSpill(p);
}

// The drafts read as cards: no header line; each draft is a white card showing its date, then its source
// and line count, then its first words, each on its own line.
async function expectDraftsCards(page: Page, p: Awaited<ReturnType<typeof opensInvoices>>): Promise<void> {
  await expect(draftsHeader(page), "the table is off").toBeHidden();
  for (const link of await p.draftLinks.all()) {
    const { date, source, comma, lines, words } = draftParts(link);
    const { date: dateBox, source: sourceBox, comma: commaBox, lines: linesBox, words: wordsBox } = await namedBoxes({
      date,
      source,
      comma,
      lines,
      words,
    });
    expect(sourceBox.y, "source below the date").toBeGreaterThanOrEqual(dateBox.y + dateBox.height - 1);
    expect(Math.abs(linesBox.y - sourceBox.y), "line count on the source's line").toBeLessThanOrEqual(4);
    expect(commaBox.width, "the comma is shown").toBeGreaterThan(1);
    expect(linesBox.x, "line count after the source").toBeGreaterThanOrEqual(sourceBox.x + sourceBox.width - 1);
    expect(wordsBox.y, "words below the source and count").toBeGreaterThanOrEqual(sourceBox.y + sourceBox.height - 1);
    await expectWhiteCard(link, "a draft is a white card");
  }
}

async function expectDraftsEither(page: Page, p: Awaited<ReturnType<typeof opensInvoices>>): Promise<void> {
  if (await draftsHeader(page).isVisible()) return expectDraftsTable(page, p);
  await expectDraftsNoSpill(p);
  return expectDraftsCards(page, p);
}

test.describe("the Invoices layout", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /invoices lifts the 34rem cap on every child of main in the read view and a draft's review at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await seedFixture();
      const id = await seedDraft({});
      await openInvoices(page);
      await expectNoCap(page);
      await page.goto(`/invoices?draft=${id}`);
      await expect(page.getByRole("heading", { name: "Draft review" })).toBeVisible();
      await expectNoCap(page);
    });

    test(`AC-0004: at ${width}x${height} the read forms sit side by side with their tops and their buttons' tops level, above Drafts to confirm`, async ({
      page,
    }) => {
      const p = await opensInvoices(page, width, height);
      const { photo, text, photoButton, textButton, drafts } = await namedBoxes({
        photo: p.photoSection,
        text: p.textSection,
        photoButton: p.readPhoto,
        textButton: p.readText,
        drafts: p.draftsSection,
      });
      expect(photo.x + photo.width, "Read an invoice is left of Type a receipt").toBeLessThanOrEqual(text.x + 1);
      expect(Math.abs(photo.y - text.y), "form tops level").toBeLessThanOrEqual(1);
      expect(Math.abs(photoButton.y - textButton.y), "button tops level").toBeLessThanOrEqual(1);
      expect(drafts.y, "drafts below both").toBeGreaterThanOrEqual(Math.max(photo.y + photo.height, text.y + text.height) - 1);
    });
  }

  test("AC-0023: at 390x844 Read an invoice sits above Type a receipt, above Drafts to confirm", async ({ page }) => {
    const p = await opensInvoices(page, 390, 844);
    const { photo, text, drafts } = await namedBoxes({ photo: p.photoSection, text: p.textSection, drafts: p.draftsSection });
    expect(text.y).toBeGreaterThanOrEqual(photo.y + photo.height - 1);
    expect(drafts.y).toBeGreaterThanOrEqual(text.y + text.height - 1);
  });

  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0005: at ${width}x${height} each draft is a row under one header line`, async ({ page }) => {
      const p = await opensInvoices(page, width, height);
      await expectDraftsTable(page, p);
    });
  }

  test("AC-0005: at 390x844 each draft is a card with its date, its source and line count, and its first words on their own lines", async ({
    page,
  }) => {
    const p = await opensInvoices(page, 390, 844);
    await expectDraftsCards(page, p);
  });

  test("AC-0005: at 1280x720 with 20 px text no draft's text runs past its row or card", async ({ page }) => {
    const p = await opensInvoices(page, 1280, 720);
    await withTextSize(page, 1280, 720, 20);
    await expectDraftsEither(page, p);
  });

  for (const [width, height] of [
    [390, 844],
    [1024, 768],
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0022: at ${width}x${height} each draft is one link whose text is its date, source, count, and words`, async ({
      page,
    }) => {
      const p = await opensInvoices(page, width, height);
      await expectLinkText(p);
    });
  }

  test("AC-0022: at 1280x720 with 20 px text each draft is one link whose text is its date, source, count, and words", async ({
    page,
  }) => {
    const p = await opensInvoices(page, 1280, 720);
    await withTextSize(page, 1280, 720, 20);
    await expectLinkText(p);
  });

  test("AC-0016: /invoices with three drafts waiting passes the page-state check at 390x844", async ({ page }) => {
    await opensInvoices(page, 390, 844);
    const labels = await checkPageState(page);
    expect(labels.slice(0, FORM_CONTROLS.length)).toEqual(FORM_CONTROLS);
    expect(labels.slice(FORM_CONTROLS.length)).toHaveLength(3);
  });

  test("AC-0016: /invoices with three drafts waiting passes the page-state check at 1280x720", async ({ page }) => {
    await opensInvoices(page, 1280, 720);
    // The axe scan runs here, on the drafts' table look; the phone-width walk it returns ends with the three drafts.
    const phone = await checkPageState(page);
    expect(phone.slice(0, FORM_CONTROLS.length)).toEqual(FORM_CONTROLS);
    expect(phone.slice(FORM_CONTROLS.length)).toHaveLength(3);
    // The side menu's stops come first at this width; the form's four controls and the three drafts end the walk.
    const labels = await checkDesktopWalk(page);
    expect(labels.slice(-7, -3)).toEqual(FORM_CONTROLS.slice(-4));
    expect(labels.slice(-3)).toHaveLength(3);
  });
});

// ---- A draft's review ----

// AC-0001 for a draft's review is checked by the "Invoices" tests above (the draft's review at 1024 and 1280 px).

const REVIEW_WORDS = ["TKY DRUMS 40# CASE", "TKY WING 40# CS", "CHICKEN THIGH 40#"];
const FIELDS = ["product", "vendor", "weight", "cost", "date"] as const;
type Kind = "photo" | "typed";

// The sizes AC-0006 names, in the order its two looks use them: beside the lines, then above them.
const BESIDE = [
  { width: 1024, height: 768, px: 16 },
  { width: 1280, height: 720, px: 16 },
  { width: 1440, height: 900, px: 16 },
  { width: 1280, height: 720, px: 20 },
] as const;
const ABOVE = [
  { width: 390, height: 844, px: 16 },
  { width: 1024, height: 768, px: 20 },
] as const;

// A three-line photo draft or a one-line typed draft, opened at the size.
async function opensReview(page: Page, width: number, height: number, kind: Kind) {
  await page.setViewportSize({ width, height });
  await seedFixture();
  const id = kind === "photo" ? await seedDraft({ source: "photo", words: REVIEW_WORDS }) : await seedDraft({});
  return { id, r: await openReview(page, id) };
}

async function atTextSize(page: Page, width: number, height: number, px: number): Promise<void> {
  if (px !== 16) await withTextSize(page, width, height, px);
}

function capture(page: Page, kind: Kind): Locator {
  return page.getByRole("region", { name: kind === "photo" ? "Invoice photo" : "You typed", exact: true });
}

function linesForm(page: Page): Locator {
  return page.getByRole("form", { name: "Lines", exact: true });
}

// The capture section is the first column and the Lines form the second, with their tops level.
async function expectBeside(page: Page, kind: Kind): Promise<void> {
  const { shown, lines } = await namedBoxes({ shown: capture(page, kind), lines: linesForm(page) });
  expect(shown.x + shown.width, "the capture section is left of the form").toBeLessThanOrEqual(lines.x + 1);
  expect(Math.abs(shown.y - lines.y), "tops level").toBeLessThanOrEqual(1);
}

async function expectAbove(page: Page, kind: Kind): Promise<void> {
  const { shown, lines } = await namedBoxes({ shown: capture(page, kind), lines: linesForm(page) });
  expect(lines.y, "the form is below the capture section").toBeGreaterThanOrEqual(shown.y + shown.height - 1);
}

const control = (page: Page, n: number, field: (typeof FIELDS)[number]) => page.locator(`#line-${n}-${field}`);

// Each line's fields: side by side in two rows, or each below the one before in today's order.
async function expectFieldRows(page: Page, lineCount: number, rows: boolean): Promise<void> {
  for (let n = 1; n <= lineCount; n += 1) {
    const [product, vendor, weight, cost, date] = await Promise.all(FIELDS.map((field) => box(control(page, n, field))));
    const after = (next: typeof product, previous: typeof product) =>
      expect(next!.y, `line ${n}: below`).toBeGreaterThanOrEqual(previous!.y + previous!.height - 1);
    const right = (next: typeof product, previous: typeof product) =>
      expect(next!.x, `line ${n}: right of`).toBeGreaterThanOrEqual(previous!.x + previous!.width - 1);
    if (rows) {
      expect(Math.abs(product!.y - vendor!.y), `line ${n}: Product and Vendor tops`).toBeLessThanOrEqual(1);
      right(vendor, product);
      expect(Math.abs(weight!.y - cost!.y), `line ${n}: Weight and Cost tops`).toBeLessThanOrEqual(1);
      expect(Math.abs(cost!.y - date!.y), `line ${n}: Cost and Date tops`).toBeLessThanOrEqual(1);
      right(cost, weight);
      right(date, cost);
      after(weight, product);
    } else {
      after(vendor, product);
      after(weight, vendor);
      after(cost, weight);
      after(date, cost);
    }
  }
}

// Every field's control ends inside its line, and its label sits above it.
async function expectFieldsInside(page: Page, lineCount: number): Promise<void> {
  const r = review(page);
  for (let n = 1; n <= lineCount; n += 1) {
    const line = await box(r.line(n).group);
    for (const field of FIELDS) {
      const shown = await box(control(page, n, field));
      expect(shown.x, `line ${n} ${field}: starts inside`).toBeGreaterThanOrEqual(line.x);
      expect(shown.x + shown.width, `line ${n} ${field}: ends inside`).toBeLessThanOrEqual(line.x + line.width);
      expect(shown.y + shown.height, `line ${n} ${field}: ends inside, bottom`).toBeLessThanOrEqual(line.y + line.height);
      const label = await box(page.locator(`label[for="line-${n}-${field}"]`));
      expect(label.y + label.height, `line ${n} ${field}: label above`).toBeLessThanOrEqual(shown.y + 1);
      expect(label.x, `line ${n} ${field}: label over its control`).toBeLessThan(shown.x + shown.width);
      expect(label.x + label.width, `line ${n} ${field}: label over its control, right`).toBeGreaterThan(shown.x);
    }
  }
}

test.describe("a draft's review layout", () => {
  for (const kind of ["photo", "typed"] as const) {
    for (const { width, height, px } of BESIDE) {
      test(`AC-0006: the ${kind} review at ${width}x${height} with ${px} px text keeps its capture section left of the Lines form`, async ({
        page,
      }) => {
        await opensReview(page, width, height, kind);
        await atTextSize(page, width, height, px);
        await expectBeside(page, kind);
      });
    }
    for (const { width, height, px } of ABOVE) {
      test(`AC-0006: the ${kind} review at ${width}x${height} with ${px} px text keeps its capture section above the Lines form`, async ({
        page,
      }) => {
        await opensReview(page, width, height, kind);
        await atTextSize(page, width, height, px);
        await expectAbove(page, kind);
      });
    }
  }

  test("AC-0007: at 1280x720 the whole Invoice photo section is in view once Save receipts is", async ({ page }) => {
    const { r } = await opensReview(page, 1280, 720, "photo");
    await r.save.scrollIntoViewIfNeeded();
    await expect.poll(async () => (await box(capture(page, "photo"))).y).toBeGreaterThanOrEqual(0);
    const shown = await box(capture(page, "photo"));
    expect(shown.y + shown.height, "the section ends inside the viewport").toBeLessThanOrEqual(720);
    const save = await box(r.save);
    expect(save.y + save.height, "Save receipts is in view").toBeLessThanOrEqual(720);
    expect(await page.evaluate(() => window.scrollY), "the page scrolled").toBeGreaterThan(0);
  });

  for (const { width, height } of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    test(`AC-0008: at ${width}x${height} each line's fields sit in two rows, inside their line, labels above`, async ({
      page,
    }) => {
      await opensReview(page, width, height, "photo");
      await expectFieldRows(page, REVIEW_WORDS.length, true);
      await expectFieldsInside(page, REVIEW_WORDS.length);
    });
  }

  for (const { width, height } of [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
  ]) {
    test(`AC-0008: at ${width}x${height} each of a line's fields sits below the one before, inside its line, label above`, async ({
      page,
    }) => {
      await opensReview(page, width, height, "photo");
      await expectFieldRows(page, REVIEW_WORDS.length, false);
      await expectFieldsInside(page, REVIEW_WORDS.length);
    });
  }

  for (const { width, height } of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
  ]) {
    test(`AC-0008: at ${width}x${height} with 20 px text every control ends inside its line and every label sits above it`, async ({
      page,
    }) => {
      await opensReview(page, width, height, "photo");
      await withTextSize(page, width, height, 20);
      await expectFieldsInside(page, REVIEW_WORDS.length);
    });
  }

  // AC-0025: a 17 px always-visible scrollbar takes 17 px of the width, so the view is about 1rem narrower.
  test("AC-0025: at 1024x768 with 17 px of the width taken, the capture section stays left of the Lines form", async ({
    page,
  }) => {
    await opensReview(page, 1024, 768, "photo");
    await page.evaluate(() => {
      document.documentElement.style.paddingRight = "17px";
    });
    await expectBeside(page, "photo");
  });

  // Each line's closed Product picker is at least as wide as a copy of it holding only the chosen option at
  // its own natural width, so the arrow and the whole chosen name fit; Product and Vendor stay side by side.
  async function expectProductWhole(page: Page): Promise<void> {
    for (let n = 1; n <= REVIEW_WORDS.length; n += 1) {
      const widths = await control(page, n, "product").evaluate((node) => {
        const picker = node as HTMLSelectElement;
        const copy = picker.cloneNode(false) as HTMLSelectElement;
        copy.removeAttribute("id");
        copy.style.width = "auto";
        copy.style.position = "absolute";
        copy.style.visibility = "hidden";
        copy.append(new Option(picker.selectedOptions[0]!.text));
        picker.parentElement!.append(copy);
        const natural = copy.getBoundingClientRect().width;
        copy.remove();
        return { shown: picker.getBoundingClientRect().width, natural };
      });
      expect(widths.natural, `line ${n}: the copy has a width`).toBeGreaterThan(100);
      expect(widths.shown, `line ${n}: the Product picker holds its chosen option`).toBeGreaterThanOrEqual(widths.natural - 0.5);
    }
  }

  async function productBesideVendor(page: Page): Promise<boolean> {
    for (let n = 1; n <= REVIEW_WORDS.length; n += 1) {
      const product = await box(control(page, n, "product"));
      const vendor = await box(control(page, n, "vendor"));
      if (Math.abs(product.y - vendor.y) > 1 || vendor.x < product.x + product.width - 1) return false;
    }
    return true;
  }

  test("Always do: at 1280x720 each Product picker shows its chosen option whole, beside Vendor with tops level", async ({ page }) => {
    await opensReview(page, 1280, 720, "photo");
    expect(await productBesideVendor(page), "Product beside Vendor").toBe(true);
    await expectProductWhole(page);
  });

  test("Always do: at the narrowest viewport where Product sits beside Vendor each Product picker shows its chosen option whole", async ({
    page,
  }) => {
    await opensReview(page, 1280, 720, "photo");
    // Step down 1 px at a time until Product drops below Vendor; measure at the last width where they sat side by side.
    let narrowest = 1280;
    for (let width = 1279; width >= 1024; width -= 1) {
      await page.setViewportSize({ width, height: 720 });
      if (!(await productBesideVendor(page))) break;
      narrowest = width;
    }
    expect(narrowest, "the paired layout ends above 1024 px").toBeGreaterThan(1024);
    expect(narrowest, "the paired layout ends below 1280 px").toBeLessThan(1280);
    await page.setViewportSize({ width: narrowest, height: 720 });
    expect(await productBesideVendor(page), `Product beside Vendor at ${narrowest} px`).toBe(true);
    await expectProductWhole(page);
  });
});

// ---- Saved receipts ----

const RAW_CHK_LABEL = "RAW-CHK Chicken Thighs (raw)";

// Three lines saved: the first two for RAW-TOM and the third, chosen in its Product field, for RAW-CHK.
// `heavy` types six-digit weights with three decimals and costs of $10 or more into every line first.
async function savesThreeLines(page: Page, width: number, height: number, heavy: boolean) {
  await page.setViewportSize({ width, height });
  await seedFixture();
  const id = await seedDraft({ source: "photo", words: REVIEW_WORDS });
  const r = await openReview(page, id);
  await r.line(3).product.selectOption({ label: RAW_CHK_LABEL });
  if (heavy) {
    for (let n = 1; n <= 3; n += 1) {
      await r.line(n).weight.fill("123456.789");
      await r.line(n).cost.fill("12.5");
    }
  }
  await r.save.click();
  await expect(r.result).toContainText("Saved 3 receipts.");
  await expect(r.details).toBeVisible();
  return r;
}

test.describe("saved receipts layout", () => {
  for (const { width, height, pair } of [
    { width: 1280, height: 720, pair: true },
    { width: 1440, height: 900, pair: true },
    { width: 390, height: 844, pair: false },
    { width: 1024, height: 768, pair: false },
  ]) {
    test(`AC-0009: at ${width}x${height} the saved lots and tables ${pair ? "sit two to a row" : "each sit below the one before"}`, async ({
      page,
    }) => {
      const r = await savesThreeLines(page, width, height, false);
      const lots = await boxes(r.details.locator(":scope > ul > li"));
      expect(lots).toHaveLength(3);
      const tables = await boxes(r.details.locator("table"));
      expect(tables).toHaveLength(2);
      const below = (next: (typeof lots)[number], previous: (typeof lots)[number], what: string) =>
        expect(next.y, what).toBeGreaterThanOrEqual(previous.y + previous.height - 1);
      if (pair) {
        expect(lots[0]!.x + lots[0]!.width, "the second lot is right of the first").toBeLessThanOrEqual(lots[1]!.x + 1);
        expect(Math.abs(lots[0]!.y - lots[1]!.y), "lot tops level").toBeLessThanOrEqual(1);
        below(lots[2]!, lots[0]!, "the third lot is below the first");
        expect(Math.abs(lots[2]!.x - lots[0]!.x), "the third lot is in the first column").toBeLessThanOrEqual(1);
        expect(tables[0]!.x + tables[0]!.width, "the second table is right of the first").toBeLessThanOrEqual(tables[1]!.x + 1);
        expect(Math.abs(tables[0]!.y - tables[1]!.y), "table tops level").toBeLessThanOrEqual(1);
      } else {
        below(lots[1]!, lots[0]!, "the second lot is below the first");
        below(lots[2]!, lots[1]!, "the third lot is below the second");
        below(tables[1]!, tables[0]!, "the second table is below the first");
      }
      below(tables[0]!, lots[2]!, "the tables are below the lots");
    });
  }

  for (const { width, height, px } of [
    { width: 1024, height: 768, px: 16 },
    { width: 1280, height: 720, px: 16 },
    { width: 1440, height: 900, px: 16 },
    { width: 1280, height: 720, px: 20 },
  ]) {
    test(`AC-0021: at ${width}x${height} with ${px} px text six-digit weights and costs of $10 or more stay inside their tables`, async ({
      page,
    }) => {
      const r = await savesThreeLines(page, width, height, true);
      await atTextSize(page, width, height, px);
      const cards = r.details.locator("table").locator("xpath=..");
      await expect(cards).toHaveCount(2);
      for (const [index, card] of (await cards.all()).entries()) {
        await expectTablesFit(`table ${index}`, card, 1, 3);
      }
    });
  }
});

// ---- The draft's buttons ----

// The alpha of a computed color: `rgba(...)`, or a `color(...)` or `oklab(...)` ending in `/ alpha)`.
function alphaOf(color: string): number {
  const slash = color.match(/\/\s*([\d.]+)(%?)\s*\)$/);
  if (slash) return slash[2] ? Number(slash[1]) / 100 : Number(slash[1]);
  const rgba = color.match(/^rgba\(([^)]*)\)$/);
  const parts = rgba?.[1]?.split(",") ?? [];
  return parts.length === 4 ? Number(parts[3]) : 1;
}

// Holds every server action request the page sends until `release`, and counts them as the route sees them.
async function holdActions(page: Page) {
  const seen = { count: 0 };
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/invoices**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) {
      seen.count += 1;
      await gate;
    }
    await route.continue();
  });
  return { seen, release };
}

async function countActions(page: Page) {
  const seen = { count: 0 };
  await page.route("**/invoices**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) seen.count += 1;
    await route.continue();
  });
  return seen;
}

async function buttonState(button: Locator) {
  return button.evaluate((node) => {
    const css = getComputedStyle(node);
    return {
      disabled: node.hasAttribute("disabled"),
      ariaDisabled: node.getAttribute("aria-disabled"),
      opacity: css.opacity,
      fill: css.backgroundColor,
      text: css.color,
      border: css.borderTopColor,
      focused: document.activeElement === node,
    };
  });
}

test.describe("the draft's waiting buttons", () => {
  test("AC-0010: while a save is held both buttons stay focusable, faded by color, and the pressed one keeps focus", async ({
    page,
  }) => {
    await seedFixture();
    const r = await openReview(page, await seedDraft({}));
    const rest = { save: await buttonState(r.save), discard: await buttonState(r.discard) };
    expect(rest.save).toMatchObject({ disabled: false, ariaDisabled: null, opacity: "1" });
    expect(alphaOf(rest.save.fill), "the fill at rest").toBe(1);
    expect(rest.discard).toMatchObject({ disabled: false, ariaDisabled: null, opacity: "1" });
    expect(alphaOf(rest.discard.text), "Discard draft's text at rest").toBe(1);
    expect(alphaOf(rest.discard.border), "Discard draft's border at rest").toBe(1);
    const held = await holdActions(page);
    await r.save.focus();
    await page.keyboard.press("Enter");
    await expect(r.save).toHaveAttribute("aria-disabled", "true");
    const save = await buttonState(r.save);
    const discard = await buttonState(r.discard);
    for (const state of [save, discard]) {
      expect(state.disabled, "no disabled attribute").toBe(false);
      expect(state.ariaDisabled).toBe("true");
      expect(state.opacity, "opacity stays 1").toBe("1");
    }
    expect(alphaOf(save.fill), "Save receipts' fill").toBeCloseTo(0.6, 2);
    expect(alphaOf(discard.text), "Discard draft's text").toBeCloseTo(0.6, 2);
    expect(alphaOf(discard.border), "Discard draft's border").toBeCloseTo(0.6, 2);
    expect(save.focused, "the pressed button keeps focus").toBe(true);
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Save receipts");
    held.release();
    await expect(r.result).toContainText("Saved 1 receipt.");
  });

  test("AC-0010: while a discard is held both buttons stay focusable, faded by color, and the pressed one keeps focus", async ({
    page,
  }) => {
    await seedFixture();
    const r = await openReview(page, await seedDraft({}));
    const held = await holdActions(page);
    await r.discard.focus();
    await page.keyboard.press("Enter");
    await expect(r.discard).toHaveAttribute("aria-disabled", "true");
    const save = await buttonState(r.save);
    const discard = await buttonState(r.discard);
    for (const state of [save, discard]) {
      expect(state.disabled, "no disabled attribute").toBe(false);
      expect(state.ariaDisabled).toBe("true");
      expect(state.opacity, "opacity stays 1").toBe("1");
    }
    expect(alphaOf(save.fill), "Save receipts' fill").toBeCloseTo(0.6, 2);
    expect(alphaOf(discard.text), "Discard draft's text").toBeCloseTo(0.6, 2);
    expect(alphaOf(discard.border), "Discard draft's border").toBeCloseTo(0.6, 2);
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe("Discard draft");
    held.release();
    await expect(r.result).toContainText("Draft discarded.");
  });

  // Playwright treats aria-disabled as disabled, so a press is forced as a finger would make it.
  test("AC-0020: a second press of Save receipts or Discard draft while a save runs sends no request", async ({ page }) => {
    await seedFixture();
    const r = await openReview(page, await seedDraft({}));
    const held = await holdActions(page);
    await r.save.focus();
    await page.keyboard.press("Enter");
    await expect(r.save).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await r.save.click({ force: true });
    await r.discard.click({ force: true });
    await expect.poll(() => held.seen.count).toBe(1);
    held.release();
    // Soft, so a build that lets a second press through is also counted: its second outcome replaces the first.
    await expect.soft(r.result).toContainText("Saved 1 receipt.");
    await page.waitForTimeout(1000);
    expect(held.seen.count, "action requests from the first press to one second after its outcome").toBe(1);
  });

  test("AC-0020: a second press of Discard draft or Save receipts while a discard runs sends no request", async ({
    page,
  }) => {
    await seedFixture();
    const r = await openReview(page, await seedDraft({}));
    const held = await holdActions(page);
    await r.discard.focus();
    await page.keyboard.press("Enter");
    await expect(r.discard).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Enter");
    await r.discard.click({ force: true });
    await r.save.click({ force: true });
    await expect.poll(() => held.seen.count).toBe(1);
    held.release();
    // Soft, so a build that lets a second press through is also counted: its second outcome replaces the first.
    await expect.soft(r.result).toContainText("Draft discarded.");
    await page.waitForTimeout(1000);
    expect(held.seen.count, "action requests from the first press to one second after its outcome").toBe(1);
  });

  // A press that lands before React renders the waiting state meets only the press-time ref. Two clicks from one
  // page.evaluate land in one task, so no render separates them; a build that guards on `pending` alone sends both.
  for (const [button, outcome] of [
    ["Save receipts", "Saved 1 receipt."],
    ["Discard draft", "Draft discarded."],
  ] as const) {
    test(`AC-0020: two presses of ${button} dispatched in one task send one request`, async ({ page }) => {
      await seedFixture();
      const r = await openReview(page, await seedDraft({}));
      const held = await holdActions(page);
      await page.evaluate((name) => {
        const target = [...document.querySelectorAll("button")].find((node) => node.textContent === name)!;
        target.click();
        target.click();
      }, button);
      await expect.poll(() => held.seen.count).toBe(1);
      held.release();
      // Soft, so a build that lets a second press through is also counted.
      await expect.soft(r.result).toContainText(outcome);
      await page.waitForTimeout(1000);
      expect(held.seen.count, "action requests from the first press to one second after its outcome").toBe(1);
    });
  }

  // The press train: from the first press, on each tick, Save receipts and then Discard draft are both pressed
  // in one task, until the first press's outcome shows or 5 s after the held request is released. A press that
  // lands after the action settles and before the outcome renders meets neither the ref nor the waiting state.
  // `TICK` is the gap between ticks in ms; 0 runs a tick on every task.
  const TICK = 10;
  for (const [first, outcome] of [
    ["Save receipts", "Saved 1 receipt."],
    ["Discard draft", "Draft discarded."],
  ] as const) {
    test(`AC-0020: a press train of both buttons after a press of ${first} sends one request, and the outcome shows`, async ({
      page,
    }) => {
      await seedFixture();
      const r = await openReview(page, await seedDraft({}));
      const held = await holdActions(page);
      await page.evaluate(
        ({ name, tick }) => {
          const w = window as unknown as { __train: { released: number | null; done: boolean; shown: boolean; ticks: number } };
          w.__train = { released: null, done: false, shown: false, ticks: 0 };
          const press = (label: string) => [...document.querySelectorAll("button")].find((node) => node.textContent === label)?.click();
          press(name);
          const step = () => {
            const result = document.querySelector("[aria-label='Draft result']");
            const shown = (result?.textContent ?? "").trim() !== "";
            const released = w.__train.released;
            if (shown || (released !== null && performance.now() - released > 5000)) {
              Object.assign(w.__train, { done: true, shown });
              return false;
            }
            press("Save receipts");
            press("Discard draft");
            w.__train.ticks += 1;
            return true;
          };
          if (tick > 0) {
            const id = setInterval(() => step() || clearInterval(id), tick);
          } else {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => step() && channel.port2.postMessage(0);
            channel.port2.postMessage(0);
          }
        },
        { name: first, tick: TICK },
      );
      await expect.poll(() => held.seen.count).toBe(1);
      await page.waitForTimeout(200);
      held.release();
      await page.evaluate(() => {
        (window as unknown as { __train: { released: number } }).__train.released = performance.now();
      });
      await page.waitForFunction(() => (window as unknown as { __train: { done: boolean } }).__train.done, null, {
        timeout: 15_000,
      });
      // One second after the outcome shows (or after the train gave up).
      await page.waitForTimeout(1000);
      const train = await page.evaluate(() => (window as unknown as { __train: { shown: boolean; ticks: number } }).__train);
      expect(train.ticks, "the train pressed on many ticks").toBeGreaterThan(10);
      expect.soft(held.seen.count, "action requests from the first press to one second after its outcome").toBe(1);
      expect.soft(train.shown, "the first press's outcome shows").toBe(true);
      await expect(r.result).toContainText(outcome);
    });
  }

  test("AC-0020: a save the page refuses before sending leaves both buttons usable, and one press after the fix sends one request", async ({
    page,
  }) => {
    await seedFixture();
    const r = await openReview(page, await seedLines([{ words: "TKY DRUMS 40#", weight_lbs: null }]));
    const seen = await countActions(page);
    await expect(r.line(1).weight).toHaveValue("");
    await r.save.click();
    await expect(r.line(1).weight).toBeFocused();
    await expect(r.line(1).weight).toHaveAttribute("aria-invalid", "true");
    for (const button of [r.save, r.discard]) await expect(button).not.toHaveAttribute("aria-disabled", /.*/);
    expect(seen.count, "a refused save sends nothing").toBe(0);
    await r.line(1).weight.fill("100");
    await r.save.click();
    await expect(r.result).toContainText("Saved 1 receipt.");
    await expect(r.details).toBeVisible();
    await page.waitForTimeout(1000);
    expect(seen.count, "one request after the weight is filled").toBe(1);
  });
});

// ---- Page state ----

test.describe("a draft's review page state", () => {
  test("AC-0016: the review of a draft read from a photo passes the page-state check at 390x844", async ({ page }) => {
    await opensReview(page, 390, 844, "photo");
    expect(await checkPageState(page)).toEqual(reviewControls(REVIEW_WORDS.length));
  });

  test("AC-0016: the review of a draft read from a photo passes the page-state check at 1280x720", async ({ page }) => {
    await opensReview(page, 1280, 720, "photo");
    expect(await checkPageState(page)).toEqual(reviewControls(REVIEW_WORDS.length));
    const walked = await checkDesktopWalk(page);
    const own = reviewControls(REVIEW_WORDS.length).slice(NAV_CONTROLS.length);
    expect(walked.slice(-own.length)).toEqual(own);
  });

  for (const [width, height] of [
    [390, 844],
    [1280, 720],
  ] as const) {
    test(`AC-0016: a draft just saved passes the page-state check at ${width}x${height}`, async ({ page }) => {
      await savesThreeLines(page, width, height, false);
      expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
      if (width === 1280) await checkDesktopWalk(page);
    });
  }
});

// ---- Ask ----

// The sale fixture makes one product sellable now, so the fake model's sellable_now answer shows an
// answer with a list and a link.
async function showsAnswer(page: Page, baseURL: string | undefined, width: number, height: number) {
  await saleFixture();
  const model = fakeModel(baseURL);
  await model.reset();
  await model.answer(modelAnswer({ query: "sellable_now" }));
  await page.setViewportSize({ width, height });
  const p = await openAsk(page);
  await ask(p, "What can I sell right now?");
  await expect(p.answer).toBeVisible();
  await expect(p.link).toHaveText("See it on the Menu");
  return p;
}

test.describe("the Ask layout", () => {
  test("AC-0001: at 1280 px with an answer, /ask's form, answer, and examples end within 544 px of <main>'s content", async ({
    page,
    baseURL,
  }) => {
    const p = await showsAnswer(page, baseURL, 1280, 720);
    const content = await page.locator("main").evaluate((el) => {
      const style = getComputedStyle(el);
      return el.getBoundingClientRect().left + el.clientLeft + parseFloat(style.paddingLeft);
    });
    for (const [name, target] of [
      ["form", page.locator("main form")],
      ["answer", p.answer],
      ["examples", p.examples],
    ] as const) {
      const b = await box(target);
      expect(b.x + b.width - content, `${name} right edge from the content's left edge`).toBeLessThanOrEqual(544.5);
    }
  });
});

test.describe("the Ask page state", () => {
  for (const [width, height] of [
    [390, 844],
    [1280, 720],
  ] as const) {
    test(`AC-0016: /ask with an answer passes the page-state check at ${width}x${height}`, async ({ page, baseURL }) => {
      await showsAnswer(page, baseURL, width, height);
      expect(await checkPageState(page)).toEqual(askControls("a See it on the Menu"));
      if (width === 1280) await checkDesktopWalk(page);
    });
  }
});

// ---- Alerts ----

// What Tab reaches in the five cards, in order: Urgent (margin, cost), then Other alerts (yield, price, low stock).
const ALERT_CONTROLS = [
  "button Raise list price to $3.51/lb",
  "button Dismiss",
  "a Go to Receiving",
  "button Dismiss",
  "a Go to Production",
  "button Dismiss",
  "button Raise list price to $2.27/lb",
  "button Dismiss",
  "a Go to Receiving",
  "button Dismiss",
];

const URGENT = "Urgent";
const OTHER = "Other alerts";

// The five-alert fixture (two urgent, three other) with a written digest, opened at the size.
async function opensAlerts(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await buildFiveAlertFixture({ today: appDate(), watch: false });
  await opens(page);
  await expect(alertCards(page, URGENT)).toHaveCount(2);
  await expect(alertCards(page, OTHER)).toHaveCount(3);
}

function alertCards(page: Page, section: string): Locator {
  return page.getByRole("region", { name: section, exact: true }).getByRole("group");
}

// Every alert's group, in the order the page shows them.
function allCards(page: Page): Locator {
  return page.getByRole("region", { name: /^(Urgent|Other alerts)$/ }).getByRole("group");
}

function repriceOf(card: Locator): Locator {
  return card.locator("button:not([aria-label])");
}

function dismissOf(card: Locator): Locator {
  return card.getByRole("button", { name: /^Dismiss / });
}

// The second card sits to the right of the first with tops level, in each section; in "Other alerts" the
// third sits below the first, in the first's column.
async function expectPaired(page: Page, third: boolean): Promise<void> {
  for (const section of [URGENT, OTHER]) {
    const [first, second, next] = await boxes(alertCards(page, section));
    expect(second!.x, `${section}: the second card is right of the first`).toBeGreaterThanOrEqual(first!.x + first!.width - 1);
    expect(Math.abs(second!.y - first!.y), `${section}: tops level`).toBeLessThanOrEqual(1);
    if (third && section === OTHER) {
      expect(next!.y, "the third card is below the first").toBeGreaterThanOrEqual(first!.y + first!.height - 1);
      expect(Math.abs(next!.x - first!.x), "the third card is in the first's column").toBeLessThanOrEqual(1);
    }
  }
}

// Each card sits below the one before, in one column.
async function expectOneColumn(page: Page): Promise<void> {
  const found = await boxes(allCards(page));
  expect(found).toHaveLength(5);
  for (let i = 1; i < found.length; i += 1) {
    expect(found[i]!.y, `card ${i} is below card ${i - 1}`).toBeGreaterThanOrEqual(found[i - 1]!.y + found[i - 1]!.height - 1);
    expect(Math.abs(found[i]!.x - found[0]!.x), `card ${i} is in the first card's column`).toBeLessThanOrEqual(1);
  }
}

// A card's inner width: its client width less its padding.
function innerWidth(card: Locator): Promise<number> {
  return card.evaluate((node) => {
    const css = getComputedStyle(node);
    return node.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
  });
}

// Every card with a reprice button: the second alert of "Urgent" (margin) and of "Other alerts" (price).
async function repriceCards(page: Page): Promise<Locator[]> {
  const found: Locator[] = [];
  for (const card of await allCards(page).all()) if ((await repriceOf(card).count()) > 0) found.push(card);
  expect(found).toHaveLength(2);
  return found;
}

// Every button and link sits inside its card.
async function expectControlsInside(page: Page): Promise<void> {
  for (const card of await allCards(page).all()) await expectButtonsInside(card, card.locator("button, a"), 2);
}

test.describe("the Alerts layout", () => {
  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
  ] as const) {
    test(`AC-0001: /alerts lifts the 34rem cap on every child of main but a dialog at ${width}x${height}`, async ({
      page,
    }) => {
      await opensAlerts(page, width, height);
      await expectUncountedNoCap(page);
    });
  }

  for (const [width, height] of [
    [1024, 768],
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0011: at ${width}x${height} each section's cards sit two to a row`, async ({ page }) => {
      await opensAlerts(page, width, height);
      await expectPaired(page, true);
    });
  }

  test("AC-0011: at 1280x720 with 20 px text each section's cards sit two to a row", async ({ page }) => {
    await opensAlerts(page, 1280, 720);
    await withTextSize(page, 1280, 720, 20);
    await expectPaired(page, true);
  });

  test("AC-0011: at 390x844 each card sits below the one before", async ({ page }) => {
    await opensAlerts(page, 390, 844);
    await expectOneColumn(page);
  });

  test("AC-0011: at 1024x768 with 20 px text each card sits below the one before", async ({ page }) => {
    await opensAlerts(page, 1024, 768);
    await withTextSize(page, 1024, 768, 20);
    await expectOneColumn(page);
  });

  for (const [width, height] of [
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0012: at ${width}x${height} Dismiss sits right of the reprice button with tops level, at their own width`, async ({
      page,
    }) => {
      await opensAlerts(page, width, height);
      for (const card of await repriceCards(page)) {
        const reprice = await box(repriceOf(card));
        const dismiss = await box(dismissOf(card));
        const inner = await innerWidth(card);
        expect(dismiss.x, "Dismiss is right of the reprice button").toBeGreaterThanOrEqual(reprice.x + reprice.width - 1);
        expect(Math.abs(dismiss.y - reprice.y), "tops level").toBeLessThanOrEqual(1);
        expect(reprice.width + dismiss.width, "the buttons keep their own width").toBeLessThan(inner);
      }
    });

    test(`AC-0013: at ${width}x${height} every paragraph in Today's digest is at most 45rem wide`, async ({ page }) => {
      await opensAlerts(page, width, height);
      const paragraphs = await boxes(digestRegion(page).locator("p"));
      expect(paragraphs.length).toBeGreaterThanOrEqual(1);
      for (const paragraph of paragraphs) expect(paragraph.width).toBeLessThanOrEqual(720.5);
    });
  }

  test("AC-0012: at 390x844 each of an alert's buttons spans its card's inner width", async ({ page }) => {
    await opensAlerts(page, 390, 844);
    for (const card of await allCards(page).all()) {
      const inner = await innerWidth(card);
      for (const button of await boxes(card.locator("button"))) {
        expect(Math.abs(button.width - inner), "a button spans the card").toBeLessThanOrEqual(1);
      }
    }
  });

  for (const [width, height] of [
    [390, 844],
    [1024, 768],
    [1280, 720],
    [1440, 900],
  ] as const) {
    test(`AC-0024: at ${width}x${height} every alert's buttons and link sit inside its card`, async ({ page }) => {
      await opensAlerts(page, width, height);
      await expectControlsInside(page);
    });
  }

  test("AC-0024: at 1280x720 with 20 px text every alert's buttons and link sit inside its card", async ({ page }) => {
    await opensAlerts(page, 1280, 720);
    await withTextSize(page, 1280, 720, 20);
    await expectControlsInside(page);
  });

  // AC-0025: a 17 px always-visible scrollbar takes 17 px of the width, so the section is about 1rem narrower.
  test("AC-0025: at 1024x768 with 17 px of the width taken, each alerts section keeps its first two cards side by side", async ({
    page,
  }) => {
    await opensAlerts(page, 1024, 768);
    await page.evaluate(() => {
      document.documentElement.style.paddingRight = "17px";
    });
    await expectPaired(page, false);
  });
});

test.describe("the Alerts page state", () => {
  for (const [width, height] of [
    [390, 844],
    [1280, 720],
  ] as const) {
    test(`AC-0016: /alerts with five alerts and a written digest passes the page-state check at ${width}x${height}`, async ({
      page,
    }) => {
      await opensAlerts(page, width, height);
      await expect(alertGroup(page, MARGIN_TITLE)).toBeVisible();
      expect(await checkPageState(page)).toEqual([...ALERTS_NAV, ...ALERT_CONTROLS]);
      if (width === 1280) await checkDesktopWalk(page);
    });
  }
});

// ---- The three style details ----

test.describe("the three style details of the boards", () => {
  test("AC-0017: at 1280x720 the Drafts to confirm heading and all three draft links sit in one white card", async ({ page }) => {
    const p = await opensInvoices(page, 1280, 720);
    const heading = page.getByRole("heading", { name: "Drafts to confirm", level: 2 });
    // The heading's ancestors, nearest first, each with its card style and how many draft links it holds.
    const ancestors = await heading.evaluate((node) => {
      const found = [];
      for (let el = node.parentElement; el; el = el.parentElement) {
        const css = getComputedStyle(el);
        found.push({
          style: { background: css.backgroundColor, border: css.borderTopWidth, radius: css.borderTopLeftRadius },
          links: el.querySelectorAll("a[href^='/invoices?draft=']").length,
        });
      }
      return found;
    });
    const card = ancestors.find((ancestor) => JSON.stringify(ancestor.style) === JSON.stringify(WHITE_CARD));
    expect(card?.links, "one card holds the heading and the three drafts").toBe(3);
    await expect(p.draftLinks).toHaveCount(3);
  });

  for (const [width, height] of [
    [390, 844],
    [1280, 720],
  ] as const) {
    test(`AC-0017: at ${width}x${height} each line's legend sits inside its card, below the fieldset's top border`, async ({ page }) => {
      await opensReview(page, width, height, "photo");
      const fieldsets = await page.locator("fieldset").all();
      expect(fieldsets).toHaveLength(REVIEW_WORDS.length);
      for (const [index, fieldset] of fieldsets.entries()) {
        const { fieldsetTop, border, legendTop } = await fieldset.evaluate((node) => ({
          fieldsetTop: node.getBoundingClientRect().top,
          border: parseFloat(getComputedStyle(node).borderTopWidth),
          legendTop: node.querySelector(":scope > legend")!.getBoundingClientRect().top,
        }));
        expect(legendTop, `line ${index + 1}'s legend top`).toBeGreaterThanOrEqual(fieldsetTop + border - 0.5);
      }
    });
  }

  test("AC-0017: at 1280x720 no saved lot card's facts list or its first row has a top border", async ({ page }) => {
    const r = await savesThreeLines(page, 1280, 720, false);
    const lots = await r.details.locator(":scope > ul > li").all();
    expect(lots).toHaveLength(3);
    for (const [index, lot] of lots.entries()) {
      const tops = await lot.evaluate((node) => {
        const list = node.querySelector("dl")!;
        return [getComputedStyle(list).borderTopWidth, getComputedStyle(list.firstElementChild!).borderTopWidth];
      });
      expect(tops, `lot ${index + 1}: the list's and its first row's top borders`).toEqual(["0px", "0px"]);
    }
  });
});
