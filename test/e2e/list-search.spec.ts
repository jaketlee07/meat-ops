import { expect, test, type Locator, type Page } from "@playwright/test";
import { callAsOperator, query, resetTestData, voidReceiptCall } from "../db";
import { checkPageState } from "./a11y";
import { box, withTextSize } from "./look-checks";
import {
  addressOf,
  ALPHA,
  BATCHES,
  capLine,
  clearOf,
  closeRow,
  dateBoxOf,
  DAY_A,
  DAY_B,
  expectInside,
  expectNoSidewaysScroll,
  listSection,
  lowestScrollY,
  menuSearch,
  menuStatus,
  NO_MATCH,
  noMatchLine,
  numberOf,
  numbersOf,
  opensList,
  paramsOf,
  RECEIPTS,
  receiveNumbered,
  RECENT_LISTS,
  type RecentList,
  recordReversal,
  recordRow,
  rowsOf,
  type RowRecord,
  SALES,
  scrollY,
  searchButtonOf,
  searchFor,
  searchForm,
  sectionOf,
  seedOtherProductRow,
  seedRows,
  shown,
  showingLine,
  showMoreOf,
  textBoxOf,
  TOO_MANY,
  typeMenuSearch,
  watchLowestScroll,
} from "./list-search-page";
import {
  FORM_CONTROLS as BATCH_FORM_CONTROLS,
  BATCH_SEARCH_STOPS,
  batchItem,
  reversalState,
  reversedCount,
  reverseButton,
  reverseDialog,
  reversePanel,
  reverseThrough,
} from "./production-page";
import {
  beforeAfter,
  correctButton,
  correctDialog,
  correctedState,
  correctionCount,
  correctPanel,
  correctThrough,
  factValue,
  fields as receiptFields,
  lotState,
  FORM_CONTROLS as RECEIPT_FORM_CONTROLS,
  RECEIPT_SEARCH_STOPS,
  receiptItem,
  voidButton,
  voidMarks as receiptVoidMarks,
  voidThrough as voidReceiptThrough,
} from "./receiving-page";
import {
  fields as saleFields,
  recentItem,
  FORM_CONTROLS as SALE_FORM_CONTROLS,
  SALE_SEARCH_STOPS,
  saleState,
  voidButtonOf,
  voidMarks as saleVoidMarks,
  voidThrough as voidSaleThrough,
} from "./sales-page";
import {
  addFinished,
  addRaw,
  cardHeadings,
  MENU_CONTROLS,
  MENU_SEARCH_STOP,
  NOTHING_SELLABLE,
  produce,
  receive,
  retire502,
  sellableSwitch,
} from "./menu-page";
import { OPERATOR_STATE } from "./states";

// The search boxes of the four lists, end to end. Menu's box is here; the three Recent lists' forms join it.
// Every name is made up. Operator session; data is reset before each test.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// Four products, two sellable now (finished stock) and two not, the seeded 502 retired.
async function seedFour(): Promise<void> {
  await retire502();
  const rawA = await addRaw("RAW-A");
  const rawB = await addRaw("RAW-B");
  const rawC = await addRaw("RAW-C");
  const rawD = await addRaw("RAW-D");
  const ham = await addFinished("H-100", "Smoked Ham Hocks", rawA);
  const wings = await addFinished("W-200", "Turkey Wings", rawB);
  await addFinished("H-300", "Ham Steaks", rawC);
  await addFinished("J-400", "Beef Jerky", rawD);
  await receive(rawA, 100);
  await produce(ham, 100);
  await receive(rawB, 100);
  await produce(wings, 100);
}

async function opensMenu(page: Page, width = 1280, height = 720): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto("/menu");
  await expect(page.getByRole("heading", { level: 1, name: "Menu" })).toBeVisible();
}

// Characters from `!` to `~` that are not a letter or digit.
const PUNCTUATION = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).filter((c) => !/[A-Za-z0-9]/.test(c));

test.describe("Menu's search box", () => {
  test("AC-0007: 'Search products' is a text box inside the Menu list's section, above the switch", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    const searchBox = menuSearch(page);
    const section = sectionOf(sellableSwitch(page));
    await expect(section.getByRole("textbox", { name: "Search products", exact: true })).toHaveCount(1);
    await expect(searchBox).toBeVisible();
    const boxTop = (await searchBox.boundingBox())!;
    const switchTop = (await sellableSwitch(page).boundingBox())!;
    expect(boxTop.y + boxTop.height).toBeLessThanOrEqual(switchTop.y);
  });

  test("AC-0045: the box shows the switch's products whose code or name contains the text, and no other", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    expect(await cardHeadings(page)).toEqual(["H-100 Smoked Ham Hocks", "H-300 Ham Steaks", "J-400 Beef Jerky", "W-200 Turkey Wings"]);
    // A name, in another letter case.
    await typeMenuSearch(page, "HAM");
    expect(await cardHeadings(page)).toEqual(["H-100 Smoked Ham Hocks", "H-300 Ham Steaks"]);
    // A code, in lower case.
    await typeMenuSearch(page, "h-");
    expect(await cardHeadings(page)).toEqual(["H-100 Smoked Ham Hocks", "H-300 Ham Steaks"]);
    await typeMenuSearch(page, "w-2");
    expect(await cardHeadings(page)).toEqual(["W-200 Turkey Wings"]);
    // The switch's choice still holds: Ham Steaks has no stock, so it leaves.
    await typeMenuSearch(page, "ham");
    await sellableSwitch(page).check();
    expect(await cardHeadings(page)).toEqual(["H-100 Smoked Ham Hocks"]);
    await typeMenuSearch(page, "");
    expect(await cardHeadings(page)).toEqual(["H-100 Smoked Ham Hocks", "W-200 Turkey Wings"]);
    await typeMenuSearch(page, "e");
    expect(await cardHeadings(page)).toEqual(["H-100 Smoked Ham Hocks", "W-200 Turkey Wings"]);
    await sellableSwitch(page).uncheck();
    expect(await cardHeadings(page)).toEqual(["H-100 Smoked Ham Hocks", "H-300 Ham Steaks", "J-400 Beef Jerky", "W-200 Turkey Wings"]);
    await typeMenuSearch(page, "jerky");
    expect(await cardHeadings(page)).toEqual(["J-400 Beef Jerky"]);
  });

  test("AC-0010: AC-0009's four examples give the same result as a product name", async ({ page }) => {
    await retire502();
    const raw = await addRaw("RAW-X");
    const names = [
      ["E-1", "50% Off Meats"],
      ["E-2", "500 Off Meats"],
      ["E-3", "A_B Foods"],
      ["E-4", "AXB Foods"],
      ["E-5", "Star*Market"],
      ["E-6", "StarXMarket"],
      ["E-7", "Smith, Jones (Co)"],
      ["E-8", "Smith Jones Co"],
    ] as const;
    for (const [code, name] of names) await addFinished(code, name, raw);
    await opensMenu(page);
    for (const [text, expected] of [
      ["50% off", ["E-1 50% Off Meats"]],
      ["A_B", ["E-3 A_B Foods"]],
      ["star*", ["E-5 Star*Market"]],
      ["h, J", ["E-7 Smith, Jones (Co)"]],
    ] as const) {
      await typeMenuSearch(page, text);
      expect(await cardHeadings(page), `search "${text}"`).toEqual(expected);
    }
  });

  test("AC-0010: the same four examples match a product code", async ({ page }) => {
    await retire502();
    const raw = await addRaw("RAW-X");
    for (const code of ["50% Off", "500 Off", "A_B", "AXB", "Star*", "StarX", "Sm, Jo (Co)", "Sm Jo Co"]) {
      await addFinished(code, "Made up", raw);
    }
    await opensMenu(page);
    for (const [text, expected] of [
      ["50% off", ["50% Off Made up"]],
      ["A_B", ["A_B Made up"]],
      ["star*", ["Star* Made up"]],
      ["m, j", ["Sm, Jo (Co) Made up"]],
    ] as const) {
      await typeMenuSearch(page, text);
      expect(await cardHeadings(page), `search "${text}"`).toEqual(expected);
    }
  });

  test("AC-0010: every printable ASCII character that is not a letter or digit matches only itself", async ({ page }) => {
    await retire502();
    const raw = await addRaw("RAW-X");
    // Each character c has a product named "pcq" and a decoy "pXq", which a pattern reading c as syntax would also find.
    for (const [index, c] of PUNCTUATION.entries()) {
      await addFinished(`C${index}`, `p${c}q`, raw);
      await addFinished(`D${index}`, "pXq", raw);
    }
    await opensMenu(page);
    for (const [index, c] of PUNCTUATION.entries()) {
      await typeMenuSearch(page, `p${c}q`);
      expect(await cardHeadings(page), `search "p${c}q"`).toEqual([`C${index} p${c}q`]);
    }
  });

  test("AC-0011: a tab at the text's start and a no-break space at its end are ignored", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    await typeMenuSearch(page, "\tjerky\u00a0");
    expect(await cardHeadings(page)).toEqual(["J-400 Beef Jerky"]);
    await typeMenuSearch(page, "\t \u00a0");
    expect((await cardHeadings(page)).length).toBe(4);
  });

  test("AC-0014: Menu's box takes at most 100 characters", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    const searchBox = menuSearch(page);
    await expect(searchBox).toHaveAttribute("maxlength", "100");
    await searchBox.click();
    await page.keyboard.insertText("a".repeat(120));
    expect((await searchBox.inputValue()).length).toBe(100);
  });

  test("AC-0028: a search that matches nothing reads 'No products match.', with the switch on and off", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    const status = menuStatus(page);
    await typeMenuSearch(page, "zzz");
    await expect(status).toHaveText(NO_MATCH);
    await expect(page.getByText(NOTHING_SELLABLE)).toHaveCount(0);
    await sellableSwitch(page).check();
    await expect(status).toHaveText(NO_MATCH);
    await expect(page.getByText(NOTHING_SELLABLE)).toHaveCount(0);
    // Text that matches a product the switch hides is also a miss.
    await typeMenuSearch(page, "jerky");
    await expect(status).toHaveText(NO_MATCH);
  });

  test("AC-0028: with the text empty once trimmed, the lines are today's", async ({ page }) => {
    await retire502();
    const raw = await addRaw("RAW-A");
    await addFinished("F-NONE", "Neither", raw);
    await opensMenu(page);
    const status = menuStatus(page);
    await expect(status).toHaveText("");
    await sellableSwitch(page).check();
    await expect(status).toHaveText(NOTHING_SELLABLE);
    await typeMenuSearch(page, "   ");
    await expect(status).toHaveText(NOTHING_SELLABLE);
    await typeMenuSearch(page, "zzz");
    await expect(status).toHaveText(NO_MATCH);
    await typeMenuSearch(page, "");
    await expect(status).toHaveText(NOTHING_SELLABLE);
    await sellableSwitch(page).uncheck();
    await expect(status).toHaveText("");
    await typeMenuSearch(page, " \t ");
    await expect(status).toHaveText("");
    await expect(page.getByRole("heading", { level: 2, name: "F-NONE Neither" })).toBeVisible();
  });
});

test.describe("Menu's search box, where it sits and how it looks", () => {
  test("AC-0037: 'Search products' comes right before the switch in the Tab order, and no other stop moves", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    expect(await checkPageState(page)).toEqual([...MENU_CONTROLS, MENU_SEARCH_STOP, "input"]);
    // By hand: the stop before the box is the last of the shell's, and the one after it is the switch.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await menuSearch(page).focus();
    await page.keyboard.press("Tab");
    await expect(sellableSwitch(page)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(menuSearch(page)).toBeFocused();
  });

  for (const [width, height] of [
    [390, 844],
    [1024, 768],
    [1280, 720],
  ] as const) {
    for (const size of [null, 20] as const) {
      const where = `at ${width}x${height}${size ? ` with ${size} px text` : ""}`;

      test(`AC-0038: ${where} the box stays inside the box of the list's section`, async ({ page }) => {
        await seedFour();
        await opensMenu(page, width, height);
        if (size) await withTextSize(page, width, height, size);
        await typeMenuSearch(page, "a".repeat(100));
        const section = sectionOf(sellableSwitch(page));
        await expectInside(menuSearch(page), section, "the box");
        await expectInside(page.getByText("Search products", { exact: true }), section, "its label");
        await expectInside(sellableSwitch(page), section, "the switch");
      });

      test(`AC-0039: ${where} /menu with a search entered does not scroll sideways`, async ({ page }) => {
        await seedFour();
        await opensMenu(page, width, height);
        if (size) await withTextSize(page, width, height, size);
        await typeMenuSearch(page, "ham");
        await expectNoSidewaysScroll(page, "with a search");
        await typeMenuSearch(page, "a".repeat(100));
        await expectNoSidewaysScroll(page, "with a long search");
        await typeMenuSearch(page, "zzz");
        await expectNoSidewaysScroll(page, "with a search that matches nothing");
      });
    }
  }

  test("AC-0040: the label follows the field-label rule and the box the control look", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    const label = page.getByText("Search products", { exact: true });
    const read = await page.evaluate(() => {
      const box = document.getElementById("menu-search") as HTMLInputElement;
      const labelNode = document.querySelector('label[for="menu-search"]') as HTMLElement;
      const probe = document.createElement("span");
      probe.style.cssText =
        "color: var(--color-ink-secondary); background-color: var(--color-surface); border: 1px solid var(--color-field-border); border-radius: var(--radius-control)";
      document.body.append(probe);
      const want = getComputedStyle(probe);
      const expected = {
        ink: want.color,
        surface: want.backgroundColor,
        border: want.borderTopColor,
        radius: want.borderTopLeftRadius,
      };
      probe.remove();
      const l = getComputedStyle(labelNode);
      const c = getComputedStyle(box);
      return {
        expected,
        label: { size: l.fontSize, weight: l.fontWeight, color: l.color },
        control: {
          size: c.fontSize,
          background: c.backgroundColor,
          border: c.borderTopColor,
          borderWidth: c.borderTopWidth,
          radius: c.borderTopLeftRadius,
          height: box.getBoundingClientRect().height,
          width: box.getBoundingClientRect().width,
          parent: box.parentElement!.getBoundingClientRect().width,
        },
      };
    });
    await expect(label).toBeVisible();
    expect(read.label).toEqual({ size: "14px", weight: "500", color: read.expected.ink });
    expect(read.control.size).toBe("16px");
    expect(read.control.background).toBe(read.expected.surface);
    expect(read.control.border).toBe(read.expected.border);
    expect(read.control.borderWidth).toBe("1px");
    expect(read.control.radius).toBe(read.expected.radius);
    expect(read.control.height).toBeGreaterThanOrEqual(44);
    expect(read.control.width).toBeCloseTo(read.control.parent, 0);
  });

  test("AC-0041: /menu passes the page-state check with a search entered and with one that matches nothing", async ({ page }) => {
    await seedFour();
    await opensMenu(page, 1280, 720);
    await typeMenuSearch(page, "ham");
    expect(await checkPageState(page)).toEqual([...MENU_CONTROLS, MENU_SEARCH_STOP, "input"]);
    await typeMenuSearch(page, "zzz");
    await expect(menuStatus(page)).toHaveText(NO_MATCH);
    expect(await checkPageState(page)).toEqual([...MENU_CONTROLS, MENU_SEARCH_STOP, "input"]);
  });
});

// ---- The three Recent lists: search, paging, and the lines under each list ----

const FORM_STOPS: Record<RecentList["key"], string[]> = {
  receipts: RECEIPT_FORM_CONTROLS,
  batches: BATCH_FORM_CONTROLS,
  sales: SALE_FORM_CONTROLS,
};

const SIZES = [
  [390, 844],
  [1024, 768],
  [1280, 720],
] as const;


// The controls inside the list's rows that Tab reaches, named as the page-state walk names them.
async function listStops(page: Page, list: RecentList): Promise<string[]> {
  return page.locator(`#${list.listId}`).evaluate((ul) =>
    [...ul.querySelectorAll("a[href], button")]
      .filter((el) => !el.closest("dialog"))
      .map((el) => `${el.tagName.toLowerCase()} ${el.id ? `#${el.id}` : (el.getAttribute("name") ?? el.textContent?.trim() ?? "")}`.trim()),
  );
}

const SEARCH_STOPS: Record<RecentList["key"], string[]> = {
  receipts: RECEIPT_SEARCH_STOPS,
  batches: BATCH_SEARCH_STOPS,
  sales: SALE_SEARCH_STOPS,
};

for (const list of RECENT_LISTS) {
  test.describe(`${list.title}: the ${list.noun} search form`, () => {
    test(`AC-0001, AC-0003, AC-0005: "${list.form}" sits in the list's section above its rows, with the text box, the date box, and the button in that order`, async ({ page }) => {
      await seedRows(list, 12, { shape: "mixed" });
      await opensList(page, list);
      const form = searchForm(page, list);
      await expect(form).toHaveCount(1);
      const section = listSection(page, list);
      await expect(section.getByRole("heading", { level: 2 })).toHaveCount(1);
      await expect(section.getByRole("form", { name: list.form, exact: true })).toHaveCount(1);
      // In this order: a text box named Search, a date box named for the list, and a button named Search.
      const parts = await form.locator("input:not([type=hidden]), button").evaluateAll((nodes) =>
        nodes.map((node) => (node instanceof HTMLInputElement ? node.type : node.tagName.toLowerCase())),
      );
      expect(parts).toEqual(["text", "date", "button"]);
      await expect(textBoxOf(page, list)).toBeVisible();
      await expect(dateBoxOf(page, list)).toBeVisible();
      await expect(searchButtonOf(page, list)).toBeVisible();
      await expect(form.getByRole("textbox", { name: "Search", exact: true })).toHaveCount(1);
      // Above its rows.
      const formBox = await box(form);
      const firstRow = await box(rowsOf(page, list).first());
      expect(formBox.y + formBox.height).toBeLessThanOrEqual(firstRow.y);
    });

    test(`AC-0002, AC-0004, AC-0006, AC-0008, AC-0013: a search lists the rows its text and date match, keeps the search in the address, and an empty one lists as no search does`, async ({ page }) => {
      await seedRows(list, 12, { shape: "mixed" });
      // AC-0002 and AC-0004: another product's row numbered 000 on DAY_A (a receipt's from Beta Meats) matches the
      // name, number, and date searches below. Each list below is exact, so it leaves that row out.
      const other = list.product === null ? null : await seedOtherProductRow(list);
      await opensList(page, list);
      // No search: the 10 newest.
      expect(await shown(page, list)).toEqual(numbersOf(list, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]));
      // A name: the vendor or customer for receipts and sales; the number's own start for batches.
      const byName = list.key === "batches" ? `${list.prefix}-01` : "bETa";
      await searchFor(page, list, byName);
      const expectedByName = list.key === "batches" ? [12, 11, 10] : [8, 7, 6, 5];
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, expectedByName));
      // The address holds the search, beside the product where the page has one, and no row count.
      expect(paramsOf(page).get("q")).toBe(byName);
      expect(paramsOf(page).get("product")).toBe(list.product);
      expect(paramsOf(page).has("rows")).toBe(false);
      // A number's own text.
      await searchFor(page, list, `${list.prefix}-00`);
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [9, 8, 7, 6, 5, 4, 3, 2, 1]));
      expect(await shown(page, list), "the other product's row").not.toContain(numberOf(list, 0));
      // A date alone, and a date with text.
      await searchFor(page, list, "", DAY_A);
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [6, 5, 4, 3, 2, 1]));
      expect(paramsOf(page).get("date")).toBe(DAY_A);
      await searchFor(page, list, list.key === "batches" ? `${list.prefix}-00` : "beta", DAY_A);
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, list.key === "batches" ? [6, 5, 4, 3, 2, 1] : [6, 5]));
      await searchFor(page, list, "", DAY_B);
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [12, 11, 10, 9, 8, 7]));
      // Opening the address the search made shows the same list, with the boxes filled.
      const address = page.url();
      await page.goto(addressOf(list));
      await page.goto(address);
      expect(await shown(page, list)).toEqual(numbersOf(list, [12, 11, 10, 9, 8, 7]));
      await expect(dateBoxOf(page, list)).toHaveValue(DAY_B);
      // AC-0008: an empty text and an empty date, or a text of spaces, list as no search does.
      await searchFor(page, list, "");
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]));
      await searchFor(page, list, "   ");
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]));
      // The other product's row does match the number search: its own list shows it.
      if (other !== null) {
        await opensList(page, { ...list, product: other }, { q: `${list.prefix}-00` });
        expect(await shown(page, list)).toEqual(numbersOf(list, [0]));
      }
    });

    if (list.key === "receipts") {
      test(`AC-0002: a receipt's vendor name and lot number are searched, in any letter case`, async ({ page }) => {
        await seedRows(list, 12, { shape: "mixed" });
        await opensList(page, list);
        await searchFor(page, list, "gamma");
        await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [12, 11, 10, 9]));
        await searchFor(page, list, "lt-005");
        await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [5]));
      });
    }

    if (list.key === "sales") {
      test(`AC-0006: a sale's product code, product name, customer, and sale number are searched, in any letter case`, async ({ page }) => {
        await seedRows(list, 12, { shape: "mixed" });
        await opensList(page, list);
        await searchFor(page, list, "502");
        await expect.poll(() => shown(page, list)).toHaveLength(10);
        await searchFor(page, list, "drums tom");
        await expect.poll(() => shown(page, list)).toHaveLength(10);
        await searchFor(page, list, "gamma");
        await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [12, 11, 10, 9]));
        await searchFor(page, list, "sl-005");
        await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [5]));
      });
    }

    test(`AC-0014, AC-0015: the box takes at most 100 characters; a longer address text is cut, and a NUL is dropped`, async ({ page }) => {
      await seedRows(list, 12, { shape: "mixed" });
      await opensList(page, list);
      const searchBox = textBoxOf(page, list);
      await expect(searchBox).toHaveAttribute("maxlength", "100");
      await searchBox.click();
      await page.keyboard.insertText("a".repeat(120));
      expect((await searchBox.inputValue()).length).toBe(100);
      // By address: 150 letters are cut to 100, with no error view.
      await opensList(page, list, { q: "a".repeat(150) });
      expect(await textBoxOf(page, list).inputValue()).toBe("a".repeat(100));
      await expect(noMatchLine(page, list)).toBeVisible();
      // A NUL goes and what is left searches: "LT-%00005" reads as "LT-005".
      await opensList(page, list, { q: `${list.prefix}-\u0000005` });
      expect(await textBoxOf(page, list).inputValue()).toBe(`${list.prefix}-005`);
      expect(await shown(page, list)).toEqual(numbersOf(list, [5]));
      await opensList(page, list, { q: "\u0000" });
      expect(await shown(page, list)).toHaveLength(10);
      await expect(noMatchLine(page, list)).toHaveCount(0);
      // Spaces at both ends are trimmed, and an emoji across the cut goes whole.
      await opensList(page, list, { q: `  ${list.prefix}-005  ` });
      expect(await shown(page, list)).toEqual(numbersOf(list, [5]));
      await opensList(page, list, { q: `${"a".repeat(99)}\u{1F600}` });
      expect(await textBoxOf(page, list).inputValue()).toBe("a".repeat(99));
      // Typed: the text and its spaces reach the address and the list.
      await opensList(page, list);
      await searchFor(page, list, `  ${list.prefix}-005  `);
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [5]));
    });

    test(`AC-0016: an address date of 2026-02-30, 0000-01-01, or 11/10/2026 is ignored, its box shows empty, and the page opens`, async ({ page }) => {
      await seedRows(list, 12, { shape: "mixed" });
      for (const date of ["2026-02-30", "0000-01-01", "11/10/2026"]) {
        await opensList(page, list, { date });
        await expect(dateBoxOf(page, list), `date ${date}`).toHaveValue("");
        expect(await shown(page, list), `date ${date}`).toEqual(numbersOf(list, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]));
      }
    });

    test(`AC-0027: a search that matches nothing says so, keeps its text in the boxes, and Clear search goes back to the page with no search`, async ({ page }) => {
      await seedRows(list, 12, { shape: "mixed" });
      await opensList(page, list);
      await searchFor(page, list, "zzz", DAY_A);
      await expect(noMatchLine(page, list)).toBeVisible();
      await expect(listSection(page, list).getByRole("status").getByText(`No ${list.noun} match.`, { exact: true })).toBeVisible();
      await expect(rowsOf(page, list)).toHaveCount(0);
      await expect(textBoxOf(page, list)).toHaveValue("zzz");
      await expect(dateBoxOf(page, list)).toHaveValue(DAY_A);
      await expect(listSection(page, list).getByText(/^Showing /)).toHaveCount(0);
      await expect(showMoreOf(page, list)).toHaveCount(0);
      const clear = clearOf(page, list);
      await expect(clear).toHaveCount(1);
      await clear.click();
      await expect(page).toHaveURL(addressOf(list), { timeout: 15_000 });
      await expect.poll(() => shown(page, list)).toHaveLength(10);
      await expect(textBoxOf(page, list)).toBeFocused();
      await expect(noMatchLine(page, list)).toHaveCount(0);
      await expect(textBoxOf(page, list)).toHaveValue("");
      await expect(dateBoxOf(page, list)).toHaveValue("");
      // A date with no row on it is also a miss.
      await searchFor(page, list, "", "2026-01-01");
      await expect(noMatchLine(page, list)).toBeVisible();
    });
  });

  test.describe(`${list.title}: paging`, () => {
    test(`AC-0019, AC-0020, AC-0022, AC-0024, AC-0025, AC-0026: with 25 rows, Show 10 more adds the next 10 below, keeps the boxes and the scroll, and focuses the first added row`, async ({ page }) => {
      test.setTimeout(240_000);
      await seedRows(list, 25);
      await opensList(page, list, { q: list.prefix, date: DAY_A });
      expect(await shown(page, list)).toEqual(numbersOf(list, Array.from({ length: 10 }, (_, i) => 25 - i)));
      await expect(showingLine(page, list, 10, 25)).toBeVisible();
      const more = showMoreOf(page, list);
      await expect(more).toHaveCount(1);
      // The line is above the link, and the link is below the rows.
      const lineBox = await box(showingLine(page, list, 10, 25));
      const linkBox = await box(more);
      const lastRow = await box(rowsOf(page, list).last());
      expect(lineBox.y).toBeGreaterThanOrEqual(lastRow.y + lastRow.height - 1);
      expect(linkBox.y).toBeGreaterThanOrEqual(lineBox.y + lineBox.height - 1);
      // By keyboard: the first press adds rows 15 to 6.
      await more.focus();
      await more.scrollIntoViewIfNeeded();
      expect(await scrollY(page), "the page is scrolled to the link").toBeGreaterThan(0);
      await watchLowestScroll(page);
      await page.keyboard.press("Enter");
      await expect(rowsOf(page, list)).toHaveCount(20);
      expect(await shown(page, list)).toEqual(numbersOf(list, Array.from({ length: 20 }, (_, i) => 25 - i)));
      await expect(showingLine(page, list, 20, 25)).toBeVisible();
      expect(paramsOf(page).get("rows")).toBe("20");
      // AC-0024: the boxes keep their values. AC-0026: focus is on row 11. AC-0025: from the press to that focus,
      // the page never reached its top.
      await expect(textBoxOf(page, list)).toHaveValue(list.prefix);
      await expect(dateBoxOf(page, list)).toHaveValue(DAY_A);
      await expect(rowsOf(page, list).nth(10)).toBeFocused();
      expect(await lowestScrollY(page), "the lowest scroll offset from the press to the focus").toBeGreaterThan(0);
      // By pointer: the second press adds the last 5, and the line and the link go.
      await showMoreOf(page, list).scrollIntoViewIfNeeded();
      await watchLowestScroll(page);
      await showMoreOf(page, list).click();
      await expect(rowsOf(page, list)).toHaveCount(25);
      await expect(rowsOf(page, list).nth(20)).toBeFocused();
      expect(await lowestScrollY(page), "the lowest scroll offset from the press to the focus").toBeGreaterThan(0);
      await expect(listSection(page, list).getByText(/^Showing /)).toHaveCount(0);
      await expect(showMoreOf(page, list)).toHaveCount(0);
      expect(paramsOf(page).get("rows")).toBe("30");
      await expect(textBoxOf(page, list)).toHaveValue(list.prefix);
    });

    test(`AC-0019, AC-0020, AC-0022: with 12 rows, one press shows every row and ends the line and the link, and a search whose 9 matches all show has neither`, async ({ page }) => {
      await seedRows(list, 12);
      await opensList(page, list);
      await expect(showingLine(page, list, 10, 12)).toBeVisible();
      await showMoreOf(page, list).click();
      await expect(rowsOf(page, list)).toHaveCount(12);
      await expect(rowsOf(page, list).nth(10)).toBeFocused();
      await expect(listSection(page, list).getByText(/^Showing /)).toHaveCount(0);
      await expect(showMoreOf(page, list)).toHaveCount(0);
      // A search that 9 rows match, read at 10 rows: all 9 show, with no line and no link.
      await opensList(page, list, { q: list.prefix, date: DAY_A, rows: "10" });
      await searchFor(page, list, `${list.prefix}-00`, DAY_A);
      await expect.poll(() => shown(page, list)).toHaveLength(9);
      await expect(listSection(page, list).getByText(/^Showing /)).toHaveCount(0);
      await expect(showMoreOf(page, list)).toHaveCount(0);
    });

    test(`AC-0013, AC-0017, AC-0019, AC-0020, AC-0021, AC-0022, AC-0025, AC-0026: with 55 rows, Show 10 more goes until 50, where the cap line takes its place`, async ({ page }) => {
      test.setTimeout(240_000);
      await seedRows(list, 55);
      await opensList(page, list);
      for (const rows of [10, 20, 30, 40]) {
        await expect(rowsOf(page, list)).toHaveCount(rows);
        await expect(showingLine(page, list, rows, 55)).toBeVisible();
        await expect(capLine(page, list, 55)).toHaveCount(0);
        if (rows > 10) {
          await expect(rowsOf(page, list).nth(rows - 10)).toBeFocused();
          expect(await lowestScrollY(page), `the lowest scroll offset from press ${rows / 10 - 1} to the focus`).toBeGreaterThan(0);
        }
        await showMoreOf(page, list).scrollIntoViewIfNeeded();
        await watchLowestScroll(page);
        await showMoreOf(page, list).click();
      }
      await expect(rowsOf(page, list)).toHaveCount(50);
      await expect(rowsOf(page, list).nth(40)).toBeFocused();
      expect(await lowestScrollY(page), "the lowest scroll offset from press 4 to the focus").toBeGreaterThan(0);
      await expect(capLine(page, list, 55)).toBeVisible();
      await expect(showMoreOf(page, list)).toHaveCount(0);
      await expect(listSection(page, list).getByText(`Showing 50 of 55 ${list.noun}.`, { exact: true })).toHaveCount(0);
      expect(paramsOf(page).get("rows")).toBe("50");
      expect(await shown(page, list)).toEqual(numbersOf(list, Array.from({ length: 50 }, (_, i) => 55 - i)));
      // Past the cap, a search finds the rest.
      await searchFor(page, list, `${list.prefix}-00`, DAY_A);
      await expect.poll(() => shown(page, list)).toEqual(numbersOf(list, [9, 8, 7, 6, 5, 4, 3, 2, 1]));
      await expect(capLine(page, list, 55)).toHaveCount(0);
      // An address with a search and a row count opens the same list, with the boxes filled.
      await opensList(page, list, { rows: "20", q: list.prefix, date: DAY_A });
      await expect(textBoxOf(page, list)).toHaveValue(list.prefix);
      await expect(dateBoxOf(page, list)).toHaveValue(DAY_A);
      await expect(rowsOf(page, list)).toHaveCount(20);
    });

    test(`AC-0017: the row counts 1000000 and 99999999999999999999 count as 50, and 5, -5, +20, 20.0, and 1e21 as 10, with no error view`, async ({ page }) => {
      test.setTimeout(240_000);
      await seedRows(list, 55);
      for (const [rows, count] of [
        ["1000000", 50],
        ["99999999999999999999", 50],
        ["5", 10],
        ["-5", 10],
        ["+20", 10],
        ["20.0", 10],
        ["1e21", 10],
      ] as const) {
        await opensList(page, list, { rows });
        await expect(rowsOf(page, list), `rows=${rows}`).toHaveCount(count);
        if (count === 50) await expect(capLine(page, list, 55), `rows=${rows}`).toBeVisible();
      }
    });
  });
}

test.describe("Recent receipts: too many vendors", () => {
  async function seedFarms(): Promise<void> {
    for (let i = 1; i <= 101; i++) {
      await query("insert into vendors(name) values ($1)", [`Farm ${String(i).padStart(3, "0")}`]);
    }
    await seedRows(RECEIPTS, 3, { shape: "uniform", vendor: (i) => `Farm ${String(i).padStart(3, "0")}` });
  }

  test("AC-0047: more than 100 matching vendors reads 'Too many vendors match.' with Clear search, and no receipt, line, or link", async ({ page }) => {
    test.setTimeout(240_000);
    await seedFarms();
    // A RAW-TOM receipt from Reyes Meats whose lot number holds the text, so a lot-number read would list it.
    await receiveNumbered("LT-004-FARM");
    await opensList(page, RECEIPTS);
    expect(await shown(page, RECEIPTS)).toEqual(numbersOf(RECEIPTS, [4, 3, 2, 1]));
    await searchFor(page, RECEIPTS, "farm");
    const section = listSection(page, RECEIPTS);
    await expect(section.getByText(TOO_MANY, { exact: true })).toBeVisible();
    await expect(rowsOf(page, RECEIPTS)).toHaveCount(0);
    await expect(section.getByText(/^Showing /)).toHaveCount(0);
    await expect(showMoreOf(page, RECEIPTS)).toHaveCount(0);
    await expect(noMatchLine(page, RECEIPTS)).toHaveCount(0);
    await expect(textBoxOf(page, RECEIPTS)).toHaveValue("farm");
    await expect(clearOf(page, RECEIPTS)).toHaveCount(1);
    // Opened by address too, with a date and a row count.
    await opensList(page, RECEIPTS, { q: "farm", date: DAY_A, rows: "30" });
    await expect(section.getByText(TOO_MANY, { exact: true })).toBeVisible();
    await expect(rowsOf(page, RECEIPTS)).toHaveCount(0);
    // More of the name narrows it.
    await searchFor(page, RECEIPTS, "farm 002");
    await expect.poll(() => shown(page, RECEIPTS)).toEqual(numbersOf(RECEIPTS, [2]));
    await expect(section.getByText(TOO_MANY, { exact: true })).toHaveCount(0);
    // With few vendors matching, the lot number's own text finds that receipt.
    await searchFor(page, RECEIPTS, "004-farm");
    await expect.poll(() => shown(page, RECEIPTS)).toEqual(numbersOf(RECEIPTS, [4]));
    // Clear search goes back.
    await searchFor(page, RECEIPTS, "farm");
    await clearOf(page, RECEIPTS).click();
    await expect(page).toHaveURL(addressOf(RECEIPTS));
    await expect.poll(() => shown(page, RECEIPTS)).toEqual(numbersOf(RECEIPTS, [4, 3, 2, 1]));
    await expect(textBoxOf(page, RECEIPTS)).toHaveValue("");
    // In the too-many case that lot number is not read either: nothing is listed.
    await opensList(page, RECEIPTS, { q: "farm", date: "" });
    await expect(rowsOf(page, RECEIPTS)).toHaveCount(0);
  });

  test("AC-0041: the page-state check reports nothing in the too-many case, and the Tab order is the form, the search controls, and Clear search", async ({ page }) => {
    test.setTimeout(240_000);
    await seedFarms();
    await opensList(page, RECEIPTS, { q: "farm" });
    await expect(listSection(page, RECEIPTS).getByText(TOO_MANY, { exact: true })).toBeVisible();
    const order = await checkPageState(page);
    expect(order).toEqual([...RECEIPT_FORM_CONTROLS, ...SEARCH_STOPS.receipts, "a Clear search"]);
  });
});

test.describe("The Recent lists: the Tab order, the layout, the look, and the page-state check", () => {
  for (const list of RECENT_LISTS) {
    test(`AC-0037, AC-0041: ${list.title}'s search controls come after the stops before the list and before its own, and Show 10 more right after them`, async ({ page }) => {
      await seedRows(list, 12, { shape: "mixed" });
      await opensList(page, list);
      const order = await checkPageState(page);
      const before = FORM_STOPS[list.key];
      const own = await listStops(page, list);
      expect(own.length, "the rows have stops of their own").toBeGreaterThan(0);
      expect(order).toEqual([...before, ...SEARCH_STOPS[list.key], ...own, "a Show 10 more"]);
      // By hand: the stop before the text box is the entry form's last, and the one after the button is the list's
      // first. (The date box takes several presses of its own, one for each part of the date, so the walk skips it.)
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await searchButtonOf(page, list).focus();
      await page.keyboard.press("Tab");
      await expect(rowsOf(page, list).first().locator("a[href], button").first()).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(searchButtonOf(page, list)).toBeFocused();
      await textBoxOf(page, list).focus();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("button", { name: /^Save/ }).first()).toBeFocused();
    });

    test(`AC-0037, AC-0041: ${list.title}'s no-match page tabs the search controls, then Clear search`, async ({ page }) => {
      await seedRows(list, 12, { shape: "mixed" });
      await opensList(page, list, { q: "zzz" });
      await expect(noMatchLine(page, list)).toBeVisible();
      expect(await checkPageState(page)).toEqual([...FORM_STOPS[list.key], ...SEARCH_STOPS[list.key], "a Clear search"]);
    });

    test(`AC-0041: ${list.title} passes the page-state check with a search entered, after Show 10 more, and at 50 rows`, async ({ page }) => {
      test.setTimeout(240_000);
      await seedRows(list, 55, { shape: "uniform" });
      await opensList(page, list, { q: list.prefix, date: DAY_A });
      await checkPageState(page);
      await showMoreOf(page, list).click();
      await expect(rowsOf(page, list)).toHaveCount(20);
      await checkPageState(page);
      await opensList(page, list, { rows: "50" });
      await expect(capLine(page, list, 55)).toBeVisible();
      const order = await checkPageState(page);
      expect(order.slice(0, FORM_STOPS[list.key].length + 3)).toEqual([...FORM_STOPS[list.key], ...SEARCH_STOPS[list.key]]);
      expect(order).not.toContain("a Show 10 more");
    });

    for (const [width, height] of SIZES) {
      for (const size of [null, 20] as const) {
        const where = `at ${width}x${height}${size ? ` with ${size} px text` : ""}`;
        test(`AC-0038, AC-0039: ${list.title} ${where}, each search control stays inside its section, and the page does not scroll sideways`, async ({ page }) => {
          await seedRows(list, 12, { shape: "uniform" });
          await opensList(page, list, {}, width, height);
          if (size) await withTextSize(page, width, height, size);
          const section = listSection(page, list);
          const label = (id: string) => searchForm(page, list).locator(`label[for="${id}"]`);
          const checkControls = async (named: string) => {
            await expectInside(textBoxOf(page, list), section, `${named}: the text box`);
            await expectInside(label(list.textId), section, `${named}: its label`);
            await expectInside(dateBoxOf(page, list), section, `${named}: the date box`);
            await expectInside(label(list.dateId), section, `${named}: its label`);
            await expectInside(searchButtonOf(page, list), section, `${named}: the button`);
            await expectInside(searchForm(page, list), section, `${named}: the form`);
            await expectNoSidewaysScroll(page, named);
          };
          await checkControls("no search");
          await expectInside(showMoreOf(page, list), section, "Show 10 more");
          // A search with a long text and a date.
          await textBoxOf(page, list).fill("a".repeat(100));
          await dateBoxOf(page, list).fill(DAY_A);
          await checkControls("a search typed");
          await searchButtonOf(page, list).click();
          await expect(noMatchLine(page, list)).toBeVisible();
          await checkControls("a search that matches nothing");
          await expectInside(clearOf(page, list), section, "Clear search");
          await expectInside(noMatchLine(page, list), section, "the no-match line");
          // A search that finds rows.
          await opensList(page, list, { q: list.prefix, date: DAY_A }, width, height);
          if (size) await withTextSize(page, width, height, size);
          await checkControls("a search that finds rows");
          await expectInside(showMoreOf(page, list), section, "Show 10 more");
        });
      }
    }

    test(`AC-0040: ${list.title}'s labels follow the field-label rule and its boxes the control and date-box rules`, async ({ page }) => {
      await seedRows(list, 12, { shape: "uniform" });
      for (const [width, height] of [[1280, 720], [390, 844]] as const) {
        await opensList(page, list, {}, width, height);
        const read = await page.evaluate(
          ({ textId, dateId, formName }) => {
            const probe = document.createElement("span");
            probe.style.cssText =
              "color: var(--color-ink-secondary); background-color: var(--color-surface); border: 1px solid var(--color-field-border); border-radius: var(--radius-control)";
            document.body.append(probe);
            const want = getComputedStyle(probe);
            const expected = { ink: want.color, surface: want.backgroundColor, border: want.borderTopColor, radius: want.borderTopLeftRadius };
            probe.remove();
            const readField = (id: string) => {
              const input = document.getElementById(id) as HTMLInputElement;
              const label = document.querySelector(`label[for="${id}"]`) as HTMLElement;
              const l = getComputedStyle(label);
              const c = getComputedStyle(input);
              const wrapper = input.parentElement as HTMLElement;
              const icon = wrapper.querySelector(":scope > span[aria-hidden='true']");
              return {
                label: { size: l.fontSize, weight: l.fontWeight, color: l.color },
                control: {
                  size: c.fontSize,
                  background: c.backgroundColor,
                  border: c.borderTopColor,
                  borderWidth: c.borderTopWidth,
                  radius: c.borderTopLeftRadius,
                  height: input.getBoundingClientRect().height,
                  width: input.getBoundingClientRect().width,
                  padLeft: c.paddingLeft,
                  padRight: c.paddingRight,
                },
                wrapperIsBox: wrapper.className.includes("relative"),
                icon: icon ? { hidden: icon.getAttribute("aria-hidden"), svg: icon.querySelectorAll("svg").length, events: getComputedStyle(icon).pointerEvents } : null,
                type: input.type,
              };
            };
            const button = document.querySelector(`form[aria-label="${formName}"] button[type=submit]`) as HTMLElement | null;
            return { expected, text: readField(textId), date: readField(dateId), button: button ? button.getBoundingClientRect().height : 0 };
          },
          { textId: list.textId, dateId: list.dateId, formName: list.form },
        );
        for (const field of [read.text, read.date]) {
          expect(field.label).toEqual({ size: "14px", weight: "500", color: read.expected.ink });
          expect(field.control.size).toBe("16px");
          expect(field.control.background).toBe(read.expected.surface);
          expect(field.control.border).toBe(read.expected.border);
          expect(field.control.borderWidth).toBe("1px");
          expect(field.control.radius).toBe(read.expected.radius);
          expect(field.control.height).toBeGreaterThanOrEqual(44);
        }
        // The date box: 12 px left and 40 px right padding, at least 156 px wide, in an icon box that draws a calendar.
        expect(read.date.type).toBe("date");
        expect(read.date.control.padLeft).toBe("12px");
        expect(read.date.control.padRight).toBe("40px");
        expect(read.date.control.width).toBeGreaterThanOrEqual(156);
        expect(read.date.wrapperIsBox).toBe(true);
        expect(read.date.icon).toEqual({ hidden: "true", svg: 1, events: "none" });
        expect(read.button).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test("AC-0037, AC-0041: a list whose rows have no stops tabs Show 10 more right after the search controls", async ({ page }) => {
    const ids = await seedRows(RECEIPTS, 12, { shape: "uniform" });
    for (const id of ids) {
      const outcome = await callAsOperator(voidReceiptCall(id));
      expect(outcome.ok, outcome.error).toBe(true);
    }
    await opensList(page, RECEIPTS);
    expect(await listStops(page, RECEIPTS)).toEqual([]);
    expect(await checkPageState(page)).toEqual([...RECEIPT_FORM_CONTROLS, ...SEARCH_STOPS.receipts, "a Show 10 more"]);
  });
});

// ---- Row actions on found rows ----

// How a test lists the two oldest of 12 rows once they have left the 10 latest.
const ROUTES = ["a search", "Show 10 more"] as const;
type Route = (typeof ROUTES)[number];

// Row 1 stays open for its action; row 2 is voided or reversed first, so it carries its tag and reason.
const OLDEST = 1;
const CLOSED = 2;

// Seeds 10 rows, closes row 2 through its operation, and records rows 1 and 2 while they are among the 10 latest.
// The page is left on that list.
async function recordOldest(
  page: Page,
  list: RecentList,
  item: (number: string) => Locator,
): Promise<{ ids: string[]; open: RowRecord; closed: RowRecord }> {
  const ids = await seedRows(list, 10);
  await closeRow(list, ids[CLOSED - 1] ?? "", "entered twice");
  await opensList(page, list);
  expect(await shown(page, list), "the 10 latest").toEqual(numbersOf(list, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]));
  return { ids, open: await recordRow(item(numberOf(list, OLDEST))), closed: await recordRow(item(numberOf(list, CLOSED))) };
}

// Adds rows 11 and 12, so rows 1 and 2 are the oldest of 12 and leave the 10 latest, then lists them by the route:
// a search that matches rows 1 to 9, or one press of "Show 10 more". Returns the address and the rows it lists.
async function findOldest(page: Page, list: RecentList, route: Route): Promise<{ address: string; listed: string[] }> {
  await seedRows(list, 2, { shape: "uniform", from: 11 });
  await opensList(page, list);
  expect(await shown(page, list), "the 10 latest").toEqual(numbersOf(list, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]));
  let listed: string[];
  if (route === "a search") {
    await searchFor(page, list, `${list.prefix}-00`);
    listed = numbersOf(list, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
  } else {
    await showMoreOf(page, list).click();
    await expect(rowsOf(page, list)).toHaveCount(12);
    expect(paramsOf(page).get("rows")).toBe("20");
    listed = numbersOf(list, [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  }
  await expect.poll(() => shown(page, list)).toEqual(listed);
  // The page stays loaded from here on: a reload would also show what a save changed.
  await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
  return { address: page.url(), listed };
}

// AC-0036: after a save the page keeps its address, with its search and row count, and lists the same rows, with
// no reload.
async function expectKept(page: Page, list: RecentList, route: Route, found: { address: string; listed: string[] }): Promise<void> {
  expect(page.url(), "the address").toBe(found.address);
  expect(await shown(page, list), "the rows listed").toEqual(found.listed);
  await expect(textBoxOf(page, list)).toHaveValue(route === "a search" ? `${list.prefix}-00` : "");
  expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept), "no reload").toBe(true);
}

test.describe("Row actions on found rows", () => {
  for (const route of ROUTES) {
    test(`AC-0030, AC-0031, AC-0036: a receipt found by ${route} shows what it showed among the 10 latest, and its Correct and Void save as they do there, on the same address`, async ({ page }) => {
      const oldest = numberOf(RECEIPTS, OLDEST);
      const closed = numberOf(RECEIPTS, CLOSED);
      const item = receiptItem(page, oldest);
      const recorded = await recordOldest(page, RECEIPTS, (number) => receiptItem(page, number));
      // The records hold what the comparison reads: the figures, Void and Correct, and a void receipt's tag and reason.
      expect(recorded.open.facts).toEqual([
        `Lot number: ${oldest}`,
        "Received: Sep 15, 2026",
        `Vendor: ${ALPHA}`,
        "Weight: 100 lbs",
        "Cost per lb: $1.5000/lb",
        "Remaining: 100 lbs",
      ]);
      expect(recorded.open.controls).toEqual([
        expect.stringMatching(new RegExp(`^button "Void lot ${oldest}": Void `)),
        expect.stringMatching(new RegExp(`^button "Correct lot ${oldest}": Correct `)),
      ]);
      expect(recorded.closed.lines).toEqual(["Voided", "entered twice"]);
      expect(recorded.closed.controls).toEqual([]);

      const found = await findOldest(page, RECEIPTS, route);
      // AC-0030: the same figures, tags, and buttons.
      expect(await recordRow(item)).toEqual(recorded.open);
      expect(await recordRow(receiptItem(page, closed))).toEqual(recorded.closed);
      const region = receiptFields(page).region;
      await expect(factValue(region, "On hand")).toHaveText("1,100 lbs");

      // AC-0031: Correct saves as it does among the 10 latest (correct.spec.ts, AC-0096, AC-0099, and AC-0100).
      await correctThrough(page, item, oldest, { cost: "1.75", reason: "invoice price" });
      const panel = correctPanel(item);
      const heading = panel.getByRole("heading", { name: "Receipt corrected" });
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
      await expect(panel.getByText(`Lot ${oldest}`, { exact: true })).toBeVisible();
      await expect(correctDialog(page, oldest)).toBeHidden();
      await expect(beforeAfter(panel, /^Cost per lb/)).toHaveText(["$1.5000/lb", "$1.7500/lb"]);
      await expect(beforeAfter(panel, /^Weight/)).toHaveText(["100 lbs", "100 lbs"]);
      await expect(beforeAfter(panel, /^On hand/)).toHaveText(["1,100 lbs", "1,100 lbs"]);
      // (1,000 lbs at $1.50 and 100 lbs at $1.75) / 1,100 lbs = $1.5227/lb; 502's price is that / 0.77 + $0.50 of fees.
      await expect(beforeAfter(panel, /^Average cost/)).toHaveText(["$1.5000/lb", "$1.5227/lb"]);
      await expect(beforeAfter(panel, /^502 Smoked Turkey Drums Tom/)).toHaveText(["$2.45/lb", "$2.48/lb"]);
      await expect(panel.getByText("No batch cost changed.", { exact: true })).toBeVisible();
      // AC-0036: the row shows its new values, on the same address.
      await expect(factValue(item, "Cost per lb")).toHaveText("$1.7500/lb");
      await expect(item.getByText("Received as 100 lbs at $1.5000/lb.", { exact: true })).toBeVisible();
      await expect(item.getByText("Corrected: invoice price", { exact: true })).toBeVisible();
      await expect(factValue(region, "Average cost")).toHaveText("$1.5227/lb");
      await expectKept(page, RECEIPTS, route, found);
      expect(await correctionCount()).toBe(1);
      expect(await correctedState(recorded.ids[OLDEST - 1] ?? "")).toMatchObject({ cost: "1.7500" });

      // AC-0031: Void saves as it does among the 10 latest (receiving.spec.ts, AC-0023).
      await voidReceiptThrough(page, item, "keyed twice");
      await expect(item.getByText("Voided", { exact: true })).toBeVisible();
      await expect(item.getByText("keyed twice", { exact: true })).toBeVisible();
      await expect(voidButton(item)).toHaveCount(0);
      await expect(correctButton(item)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Recent receipts" })).toBeFocused();
      await expect(factValue(region, "On hand")).toHaveText("1,000 lbs");
      await expect(factValue(region, "Average cost")).toHaveText("$1.5000/lb");
      // AC-0036: the row shows it is void, on the same address.
      await expectKept(page, RECEIPTS, route, found);
      expect(await lotState(recorded.ids[OLDEST - 1] ?? "")).toEqual({ remaining: 0, voided: true, reason: "keyed twice" });
      expect(await receiptVoidMarks()).toBe(2);
    });

    test(`AC-0032, AC-0033, AC-0036: a batch found by ${route} shows what it showed among the 10 latest, with the same Reverse confirmation, and its Reverse saves as it does there, on the same address`, async ({ page }) => {
      const oldest = numberOf(BATCHES, OLDEST);
      const closed = numberOf(BATCHES, CLOSED);
      const item = batchItem(page, oldest);
      const recorded = await recordOldest(page, BATCHES, (number) => batchItem(page, number));
      const confirmation = await recordReversal(page, item, oldest);
      // The records hold what the comparison reads: the figures, Reverse, a reversed batch's tag and reason, and
      // what the confirmation says.
      expect(recorded.open.facts).toEqual([
        `Batch number: ${oldest}`,
        "Production date: Sep 15, 2026",
        "Raw lbs in: 10 lbs",
        "Finished lbs out: 7.7 lbs",
        expect.stringMatching(/^Cost per finished lb: \$\d+\.\d{4}\/lb$/),
      ]);
      expect(recorded.open.controls).toEqual([expect.stringMatching(new RegExp(`^button "Reverse batch ${oldest}": Reverse `))]);
      expect(recorded.closed.lines).toEqual(["Reversed", "entered twice"]);
      expect(recorded.closed.controls).toEqual([]);
      expect(confirmation).toContain(`Batch ${oldest}, made Sep 15, 2026, 7.7 lbs finished.`);
      expect(confirmation).toContain("No sale drew from this batch.");

      const found = await findOldest(page, BATCHES, route);
      // AC-0032: the same figures, tags, and buttons. AC-0033: the same confirmation.
      expect(await recordRow(item)).toEqual(recorded.open);
      expect(await recordRow(batchItem(page, closed))).toEqual(recorded.closed);
      expect(await recordReversal(page, item, oldest)).toBe(confirmation);

      // AC-0033: Reverse saves as it does among the 10 latest (reverse.spec.ts, AC-0135, AC-0137, and AC-0138).
      await reverseThrough(page, item, oldest, "keyed twice");
      const panel = reversePanel(item);
      const heading = panel.getByRole("heading", { name: "Batch reversed" });
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
      await expect(panel.getByText(`Batch ${oldest}`, { exact: true })).toBeVisible();
      await expect(reverseDialog(page, oldest)).toBeHidden();
      // 100,000 raw lbs less 11 open batches of 10; 11 open batches of 7.7 finished lbs, then 10.
      await expect(beforeAfter(panel, /^On hand/)).toHaveText(["99,890 lbs", "99,900 lbs"]);
      await expect(beforeAfter(panel, /^Average cost/)).toHaveText(["$1.5000/lb", "$1.5000/lb"]);
      await expect(beforeAfter(panel, /^502 finished lbs on hand/)).toHaveText(["84.7 lbs", "77 lbs"]);
      await expect(panel.getByText("No sale was voided.", { exact: true })).toBeVisible();
      // AC-0036: the row shows it is reversed, on the same address.
      await expect(item.getByText("Reversed", { exact: true })).toBeVisible();
      await expect(item.locator("p", { hasText: /^keyed twice$/ })).toBeVisible();
      await expect(reverseButton(item)).toHaveCount(0);
      await expectKept(page, BATCHES, route, found);
      expect(await reversedCount()).toBe(2);
      expect(await reversalState(recorded.ids[OLDEST - 1] ?? "")).toMatchObject({ reversed: true, reason: "keyed twice", voided: 0 });
    });

    test(`AC-0034, AC-0035, AC-0036: a sale found by ${route} shows what it showed among the 10 latest, and its Void saves as it does there, on the same address`, async ({ page }) => {
      const oldest = numberOf(SALES, OLDEST);
      const closed = numberOf(SALES, CLOSED);
      const item = recentItem(page, oldest);
      const recorded = await recordOldest(page, SALES, (number) => recentItem(page, number));
      // The records hold what the comparison reads: the figures, the trace link and Void, and a void sale's tag and reason.
      expect(recorded.open.facts).toEqual([
        "Sale date: Sep 15, 2026",
        `Customer: ${ALPHA}`,
        "Product: 502",
        "Lbs: 1 lbs",
        "Price per lb: $3.29/lb",
      ]);
      expect(recorded.open.controls).toEqual([
        expect.stringMatching(new RegExp(`^a "${oldest}": ${oldest} /trace\\?sale=${oldest} `)),
        expect.stringMatching(new RegExp(`^button "Void sale ${oldest}": Void `)),
      ]);
      expect(recorded.closed.lines).toEqual([closed, "Voided", "entered twice"]);
      expect(recorded.closed.controls).toEqual([expect.stringMatching(new RegExp(`^a "${closed}": `))]);

      const found = await findOldest(page, SALES, route);
      // AC-0034: the same figures, tags, and buttons.
      expect(await recordRow(item)).toEqual(recorded.open);
      expect(await recordRow(recentItem(page, closed))).toEqual(recorded.closed);
      // 50,000 raw lbs make 38,500 finished lbs, less 11 open sales of 1 lb.
      const f = saleFields(page);
      await f.code.fill("502");
      await expect(factValue(f.facts, "Finished on hand")).toHaveText("38,489 lbs");
      await f.code.fill("");

      // AC-0035: Void saves as it does among the 10 latest (sales.spec.ts, AC-0082 and AC-0158).
      await voidSaleThrough(page, oldest, "wrong customer");
      await expect(item.getByText("Voided", { exact: true })).toBeVisible();
      await expect(item.getByText("wrong customer", { exact: true })).toBeVisible();
      await expect(voidButtonOf(page, oldest)).toHaveCount(0);
      await expect(item.getByRole("button")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Recent sales" })).toBeFocused();
      // AC-0036: the row shows it is void, on the same address.
      await expectKept(page, SALES, route, found);
      expect(await saleState(recorded.ids[OLDEST - 1] ?? "")).toEqual({ voided: true, reason: "wrong customer" });
      expect(await saleVoidMarks()).toBe(2);
      await f.code.fill("502");
      await expect(factValue(f.facts, "Finished on hand")).toHaveText("38,490 lbs");
    });
  }
});
