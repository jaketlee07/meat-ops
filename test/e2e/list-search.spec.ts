import { expect, test, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { checkPageState } from "./a11y";
import { withTextSize } from "./look-checks";
import {
  expectInside,
  expectNoSidewaysScroll,
  menuSearch,
  menuStatus,
  NO_MATCH,
  sectionOf,
  typeMenuSearch,
} from "./list-search-page";
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
    const box = menuSearch(page);
    const section = sectionOf(sellableSwitch(page));
    await expect(section.getByRole("textbox", { name: "Search products", exact: true })).toHaveCount(1);
    await expect(box).toBeVisible();
    const boxTop = (await box.boundingBox())!;
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
    await typeMenuSearch(page, "\tjerky ");
    expect(await cardHeadings(page)).toEqual(["J-400 Beef Jerky"]);
    await typeMenuSearch(page, "\t  ");
    expect((await cardHeadings(page)).length).toBe(4);
  });

  test("AC-0014: Menu's box takes at most 100 characters", async ({ page }) => {
    await seedFour();
    await opensMenu(page);
    const box = menuSearch(page);
    await expect(box).toHaveAttribute("maxlength", "100");
    await box.click();
    await page.keyboard.insertText("a".repeat(120));
    expect((await box.inputValue()).length).toBe(100);
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
