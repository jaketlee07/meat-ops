import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { OPERATOR_EMAIL } from "../users";
import { checkDesktopWalk, checkPageState } from "./a11y";
import { banner, costEarlier, marginCase, receiveTom, withWatchRefused } from "./alerts-page";
import { checkDialog, fillBatch, openForm, seed502Fixture } from "./production-page";
import { RAW_TOM_URL } from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE, signInThroughForm } from "./states";

// The app shell, end to end: the page color, the side menu, the top bar, the
// phone menu, the focus outlines, and the urgent counts on the Alerts links.

const PAGE_COLOR = "rgb(243, 246, 250)";
const NAVY = "rgb(15, 39, 108)";
const WHITE = "rgb(255, 255, 255)";
const BLUE = "rgb(29, 78, 216)";
const PHONE = { width: 320, height: 640 };
const TITLES = ["Receiving", "Production", "Menu", "Pricing", "Sales", "Trace", "Invoices", "Ask", "Alerts"];
// The menus list "Today" first, ahead of the nine pages.
const MENU_TITLES = ["Today", ...TITLES];
const NINE_PAGES = ["/receiving", "/production", "/menu", "/pricing", "/sales", "/trace", "/invoices", "/ask", "/alerts"];

test.beforeEach(async () => {
  await resetTestData();
});

async function bodyColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe("page color", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0006: /sign-in has the #F3F6FA page", async ({ page }) => {
      await page.goto("/sign-in");
      expect(await bodyColor(page)).toBe(PAGE_COLOR);
    });
  });

  test.describe("operator", () => {
    test.use({ storageState: OPERATOR_STATE });

    for (const path of NINE_PAGES) {
      test(`AC-0006: ${path} has the #F3F6FA page`, async ({ page }) => {
        await page.goto(path);
        expect(await bodyColor(page)).toBe(PAGE_COLOR);
      });
    }
  });

  test.describe("non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0006: /receiving not-allowed view has the #F3F6FA page", async ({ page }) => {
      await page.goto("/receiving");
      await expect(page.getByRole("heading", { level: 1, name: "Not allowed" })).toBeVisible();
      expect(await bodyColor(page)).toBe(PAGE_COLOR);
    });
  });
});

// ---- Helpers ----

function primaryNav(page: Page): Locator {
  return page.getByRole("navigation", { name: "Primary" });
}

// The side menu is the Primary navigation's parent.
function sideMenu(page: Page): Locator {
  return primaryNav(page).locator("xpath=..");
}

function topBar(page: Page): Locator {
  return page.getByRole("banner");
}

function phoneMenu(page: Page): Locator {
  return page.getByRole("dialog", { name: "Menu" });
}

function backgroundOf(target: Locator): Promise<string> {
  return target.evaluate((el) => getComputedStyle(el).backgroundColor);
}

async function open(page: Page, path: string, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

async function openPhoneMenu(page: Page, path = "/receiving"): Promise<void> {
  await open(page, path, PHONE);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(phoneMenu(page)).toBeVisible();
}

// A focused control must be drawn as keyboard focus: it matches :focus-visible and
// its outline is drawn, so the color read is the ring and not just the text color.
async function focusedOutline(page: Page): Promise<string> {
  const ring = await page.evaluate(() => {
    const el = document.activeElement as Element;
    const style = getComputedStyle(el);
    return { visible: el.matches(":focus-visible"), style: style.outlineStyle, color: style.outlineColor };
  });
  expect(ring.visible, "the focused control matches :focus-visible").toBe(true);
  expect(ring.style, "the focused control draws an outline").not.toBe("none");
  return ring.color;
}

// One key press sets keyboard modality, then the control takes focus directly, so
// the number of presses does not grow with the page.
async function ringAfterKeyboardFocus(page: Page, target: Locator): Promise<string> {
  await page.keyboard.press("Tab");
  await target.focus();
  await expect(target).toBeFocused();
  return focusedOutline(page);
}

// Opens the phone menu the keyboard way: focus Open menu, press Enter.
async function openPhoneMenuByKeyboard(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open menu" }).focus();
  await page.keyboard.press("Enter");
  await expect(phoneMenu(page)).toBeVisible();
}

test.describe("the shell", () => {
  test.use({ storageState: OPERATOR_STATE });

  for (const [index, path] of NINE_PAGES.entries()) {
    const title = TITLES[index] ?? "";

    test(`AC-0001, AC-0002, AC-0003, AC-0004: ${path} shows the top bar at 1023 and the side menu at 1024`, async ({
      page,
    }) => {
      await open(page, path, { width: 1023, height: 720 });
      await expect(topBar(page)).toBeVisible();
      await expect(sideMenu(page)).toHaveCount(0);
      expect(await backgroundOf(topBar(page))).toBe(NAVY);
      const bar = topBar(page);
      const menuButton = bar.getByRole("button", { name: "Open menu" });
      const heading = bar.getByRole("heading", { level: 1, name: title, exact: true });
      const alertsLink = bar.getByRole("link", { name: "Alerts", exact: true });
      await expect(alertsLink).toHaveAttribute("href", "/alerts");
      const [a, b, c] = await Promise.all([menuButton.boundingBox(), heading.boundingBox(), alertsLink.boundingBox()]);
      expect(a && b && c && a.x < b.x && b.x < c.x, "menu button, title, Alerts link left to right").toBe(true);

      await page.setViewportSize({ width: 1024, height: 720 });
      await expect(topBar(page)).toBeHidden();
      const side = sideMenu(page);
      await expect(side).toBeVisible();
      expect(await backgroundOf(side)).toBe(NAVY);
      await expect(primaryNav(page).getByRole("link")).toHaveText(MENU_TITLES);
      const brand = side.getByText("Meat Ops", { exact: true });
      const signOut = side.getByRole("button", { name: "Sign out" });
      const [brandBox, navBox, outBox] = await Promise.all([
        brand.boundingBox(),
        primaryNav(page).boundingBox(),
        signOut.boundingBox(),
      ]);
      expect(
        brandBox && navBox && outBox && brandBox.y < navBox.y && navBox.y + navBox.height <= outBox.y,
        "Meat Ops, then the Primary navigation, then Sign out, top to bottom",
      ).toBe(true);
    });

    test(`AC-0005: ${path} shows one level-1 heading, ${title}, at 320 and at 1280`, async ({ page }) => {
      for (const size of [PHONE, { width: 1280, height: 720 }]) {
        await open(page, path, size);
        const headings = page.getByRole("heading", { level: 1 });
        await expect(headings, `${path} at ${size.width}`).toHaveCount(1);
        await expect(headings).toHaveText(title);
      }
    });
  }
});

test.describe("the phone menu", () => {
  test.use({ storageState: OPERATOR_STATE });

  test("AC-0002, AC-0008, AC-0009: Open menu opens a modal Menu dialog on navy with Close menu first and focused", async ({
    page,
  }) => {
    await openPhoneMenu(page);
    const dialog = phoneMenu(page);
    expect(await dialog.evaluate((el) => el.matches(":modal"))).toBe(true);
    expect(await backgroundOf(dialog)).toBe(NAVY);
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    await expect(dialog.getByRole("navigation", { name: "Primary" }).getByRole("link")).toHaveText(MENU_TITLES);
    const parts = await Promise.all([
      dialog.getByRole("button", { name: "Close menu" }).boundingBox(),
      dialog.getByRole("navigation", { name: "Primary" }).boundingBox(),
      dialog.getByRole("button", { name: "Sign out" }).boundingBox(),
    ]);
    const [close, nav, out] = parts;
    expect(close && nav && out && close.y < nav.y && nav.y < out.y, "Close menu, links, Sign out, top to bottom").toBe(
      true,
    );
  });

  const ways: ReadonlyArray<readonly [string, (page: Page) => Promise<void>]> = [
    ["Escape", (page) => page.keyboard.press("Escape")],
    ["Close menu", (page) => page.getByRole("button", { name: "Close menu" }).click()],
    [
      "a tap on the dimmed page",
      async (page) => {
        const box = await phoneMenu(page).boundingBox();
        if (!box) throw new Error("the menu has no box");
        const right = box.x + box.width;
        await page.mouse.click(right + (PHONE.width - right) / 2, 320);
      },
    ],
  ];
  for (const [way, close] of ways) {
    test(`AC-0010, AC-0011: ${way} closes the phone menu and focus returns to Open menu`, async ({ page }) => {
      await openPhoneMenu(page);
      await close(page);
      await expect(phoneMenu(page)).toBeHidden();
      await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
    });
  }

  test("AC-0010: a tap on an empty part of the menu panel leaves the menu open", async ({ page }) => {
    await openPhoneMenu(page);
    const nav = await primaryNav(page).last().boundingBox();
    const box = await phoneMenu(page).boundingBox();
    if (!nav || !box) throw new Error("no boxes");
    const point = { x: box.x + box.width - 20, y: nav.y + nav.height + 10 };
    const hitsControl = await page.evaluate(
      ({ x, y }) => !!document.elementFromPoint(x, y)?.closest("a, button, input, select, textarea"),
      point,
    );
    expect(hitsControl, "the point is on no control").toBe(false);
    await page.mouse.click(point.x, point.y);
    await expect(phoneMenu(page)).toBeVisible();
  });

  for (const [index, path] of NINE_PAGES.entries()) {
    const title = TITLES[index] ?? "";
    test(`AC-0012: choosing ${title} in the phone menu shows ${path} with the menu closed`, async ({ page }) => {
      await openPhoneMenu(page);
      await phoneMenu(page).getByRole("link", { name: title, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { level: 1, name: title, exact: true })).toBeVisible();
      await expect(phoneMenu(page)).toBeHidden();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    });
  }

  test("AC-0014: widening to 1024 closes the phone menu and the side menu then responds", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 720 });
    await page.goto("/receiving");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(phoneMenu(page)).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 720 });
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(primaryNav(page).getByRole("link", { name: "Receiving", exact: true })).toBeFocused();
    await primaryNav(page).getByRole("link", { name: "Production", exact: true }).click();
    await expect(page).toHaveURL(/\/production$/);
  });

  test("widening to 1024 with the phone menu closed leaves focus where it was", async ({ page }) => {
    await page.setViewportSize({ width: 1023, height: 720 });
    await page.goto("/receiving");
    const field = page.locator("#product-code");
    await field.focus();
    await expect(field).toBeFocused();
    await page.setViewportSize({ width: 1024, height: 720 });
    await expect(primaryNav(page).getByRole("link", { name: "Receiving", exact: true })).toBeVisible();
    await expect(field).toBeFocused();
  });

  test("AC-0015: the page-state check passes with the phone menu open, reaching Close menu, the nine links, Sign out", async ({
    page,
  }) => {
    await openPhoneMenu(page);
    expect(await checkPageState(page)).toEqual([
      "button Close menu",
      ...MENU_TITLES.map((title) => `a ${title}`),
      "button Sign out",
    ]);
  });
});

test.describe("Sign out in the phone menu", () => {
  test("AC-0013: ends on /sign-in and /receiving then ends there too", async ({ browser, baseURL }) => {
    // A session of its own in a new context, because signing out revokes it.
    const context = await browser.newContext({ baseURL });
    try {
      const page = await context.newPage();
      await page.setViewportSize(PHONE);
      await signInThroughForm(page, OPERATOR_EMAIL);
      await page.getByRole("button", { name: "Open menu" }).click();
      await phoneMenu(page).getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
      await page.goto("/receiving");
      await expect(page).toHaveURL(/\/sign-in$/);
    } finally {
      await context.close();
    }
  });
});

test.describe("focus outlines", () => {
  test.describe("operator", () => {
    test.use({ storageState: OPERATOR_STATE });

    test("AC-0016: a focused control in the side menu, the top bar, and the open phone menu draws a white outline", async ({
      page,
    }) => {
      await open(page, "/receiving", { width: 1280, height: 720 });
      expect(await ringAfterKeyboardFocus(page, primaryNav(page).getByRole("link", { name: "Production" }))).toBe(WHITE);
      expect(await ringAfterKeyboardFocus(page, sideMenu(page).getByRole("button", { name: "Sign out" }))).toBe(WHITE);

      await open(page, "/receiving", PHONE);
      expect(await ringAfterKeyboardFocus(page, page.locator("#menu-button"))).toBe(WHITE);
      expect(await ringAfterKeyboardFocus(page, page.locator("#alerts-link"))).toBe(WHITE);

      await openPhoneMenuByKeyboard(page);
      await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
      expect(await focusedOutline(page)).toBe(WHITE);
      expect(
        await ringAfterKeyboardFocus(page, phoneMenu(page).getByRole("link", { name: "Menu", exact: true })),
      ).toBe(WHITE);
      expect(await ringAfterKeyboardFocus(page, phoneMenu(page).getByRole("button", { name: "Sign out" }))).toBe(WHITE);
    });

    test("AC-0017: a focused control in the page's content, the banner, and the Void confirmation draws a blue outline", async ({
      page,
    }) => {
      await marginCase();
      await receiveTom(1000, "1.68", 0);
      await open(page, RAW_TOM_URL, { width: 1280, height: 720 });
      expect(await ringAfterKeyboardFocus(page, page.locator("#product-code"))).toBe(BLUE);
      expect(await ringAfterKeyboardFocus(page, banner(page).getByRole("link", { name: "See alerts" }))).toBe(BLUE);

      const voidButton = page.getByRole("button", { name: /^Void lot/ }).first();
      await page.keyboard.press("Tab");
      await voidButton.focus();
      expect(await focusedOutline(page)).toBe(BLUE);
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog", { name: "Void this receipt?" })).toBeVisible();
      expect(await focusedOutline(page)).toBe(BLUE);
    });
  });

  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0017: a focused control on /sign-in draws a blue outline", async ({ page }) => {
      await page.goto("/sign-in");
      expect(await ringAfterKeyboardFocus(page, page.getByLabel("Email"))).toBe(BLUE);
    });
  });

  test.describe("non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0017: a focused control in the not-allowed view draws a blue outline", async ({ page }) => {
      await page.goto("/receiving");
      await expect(page.getByRole("heading", { level: 1, name: "Not allowed" })).toBeVisible();
      expect(await ringAfterKeyboardFocus(page, page.getByRole("button", { name: "Sign out" }))).toBe(BLUE);
    });
  });
});

test.describe("the desktop walk", () => {
  test.use({ storageState: OPERATOR_STATE });

  test("AC-0018: with one urgent alert, the page-state check passes and the 1280 walk reaches the nine links, then Sign out, first", async ({
    page,
  }) => {
    await marginCase();
    await open(page, "/receiving", { width: 1280, height: 720 });
    await checkPageState(page);
    const labels = await checkDesktopWalk(page);
    expect(labels.slice(0, 11)).toEqual([
      ...MENU_TITLES.map((title) => (title === "Alerts" ? "a Alerts1" : `a ${title}`)),
      "button Sign out",
    ]);
  });
});

test.describe("the urgent counts", () => {
  test.use({ storageState: OPERATOR_STATE });

  // The badge is aria-hidden, so it is found by that attribute inside the link.
  function badge(link: Locator): Locator {
    return link.locator('span[aria-hidden="true"]');
  }

  async function sideAlerts(page: Page): Promise<Locator> {
    return primaryNav(page).getByRole("link", { name: "Alerts", exact: true });
  }

  // The link is shown, so a count of 0 can only mean no badge.
  async function expectNoBadge(link: Locator): Promise<void> {
    await expect(link).toBeVisible();
    await expect(badge(link)).toHaveCount(0);
  }

  test("AC-0019, AC-0020: one urgent alert shows 1 on the three Alerts links, and the top bar link says Alerts, 1 urgent", async ({
    page,
  }) => {
    await marginCase();
    await open(page, "/receiving", { width: 1280, height: 720 });
    await expect(badge(await sideAlerts(page))).toHaveText("1");

    await open(page, "/receiving", PHONE);
    const top = page.getByRole("link", { name: "Alerts, 1 urgent", exact: true });
    await expect(top).toHaveAttribute("href", "/alerts");
    await expect(top).toHaveAttribute("id", "alerts-link");
    await expect(badge(top)).toHaveText("1");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(badge(await sideAlerts(page))).toHaveText("1");
  });

  test("AC-0019, AC-0020: two urgent alerts show 2", async ({ page }) => {
    await marginCase();
    await costEarlier();
    await receiveTom(1000, "1.90", 0);
    await open(page, "/receiving", PHONE);
    const top = page.getByRole("link", { name: "Alerts, 2 urgent", exact: true });
    await expect(badge(top)).toHaveText("2");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(badge(await sideAlerts(page))).toHaveText("2");
  });

  test("AC-0019, AC-0020: no urgent alert shows no badge and the name Alerts", async ({ page }) => {
    await open(page, "/receiving", PHONE);
    const top = page.getByRole("link", { name: "Alerts", exact: true });
    await expect(top).toHaveAttribute("id", "alerts-link");
    await expectNoBadge(top);
    await page.getByRole("button", { name: "Open menu" }).click();
    await expectNoBadge(await sideAlerts(page));
  });

  test("AC-0019, AC-0020: a failed watch shows no badge and the name Alerts", async ({ page }) => {
    await marginCase();
    await withWatchRefused(async () => {
      await open(page, "/receiving", PHONE);
      await expect(banner(page)).toBeVisible();
      const top = page.getByRole("link", { name: "Alerts", exact: true });
      await expect(top).toHaveAttribute("id", "alerts-link");
      await expectNoBadge(top);
      await page.getByRole("button", { name: "Open menu" }).click();
      await expectNoBadge(await sideAlerts(page));
    });
  });

  test("AC-0019, AC-0020: /alerts shows no badge even with an urgent alert open", async ({ page }) => {
    await marginCase();
    await open(page, "/alerts", { width: 1280, height: 720 });
    await expectNoBadge(await sideAlerts(page));
    await open(page, "/alerts", PHONE);
    const top = page.getByRole("link", { name: "Alerts", exact: true });
    await expect(top).toHaveAttribute("id", "alerts-link");
    await expectNoBadge(top);
  });

  test("the top bar's Alerts link marks /alerts as the current page and no other", async ({ page }) => {
    await open(page, "/alerts", PHONE);
    await expect(page.locator("#alerts-link")).toHaveAttribute("aria-current", "page");
    await open(page, "/receiving", PHONE);
    await expect(page.locator("#alerts-link")).not.toHaveAttribute("aria-current", /.*/);
  });

  test("the page-state check passes at 320 with the badge showing on the closed top bar", async ({ page }) => {
    await marginCase();
    await page.setViewportSize(PHONE);
    await page.goto("/receiving");
    await expect(badge(page.locator("#alerts-link"))).toHaveText("1");
    await checkPageState(page);
  });

  test("AC-0019: the side menu's and the phone menu's Alerts links keep the name Alerts while a badge shows", async ({
    page,
  }) => {
    await marginCase();
    await open(page, "/receiving", { width: 1280, height: 720 });
    const side = await sideAlerts(page);
    await expect(side).toHaveAttribute("href", "/alerts");
    await expect(badge(side)).toHaveText("1");

    await openPhoneMenu(page);
    const inMenu = phoneMenu(page).getByRole("link", { name: "Alerts", exact: true });
    await expect(inMenu).toHaveAttribute("href", "/alerts");
    await expect(badge(inMenu)).toHaveText("1");
  });
});

// ---- The lone card ----

// The card is <main>: white, holding the heading and every control, with the
// "MO" mark and "Meat Ops" ahead of it in the document.
async function expectLoneCard(page: Page): Promise<void> {
  const card = page.getByRole("main");
  expect(await backgroundOf(card)).toBe(WHITE);
  await expect(card.getByRole("heading", { level: 1 })).toHaveCount(1);
  expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
  expect(await page.locator("button, input").count()).toBe(await card.locator("button, input").count());
  const before = await page.evaluate(() => {
    const main = document.querySelector("main") as Element;
    const text = (needle: string) =>
      Array.from(document.querySelectorAll("span")).find((el) => el.textContent === needle);
    const comesBefore = (el: Element | undefined) =>
      !!el && !!(el.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING) && !main.contains(el);
    return { mark: comesBefore(text("MO")), name: comesBefore(text("Meat Ops")) };
  });
  expect(before).toEqual({ mark: true, name: true });
}

test.describe("the lone card", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0021: /sign-in is one white card", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
      await expectLoneCard(page);
    });
  });

  test.describe("non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0021: the not-allowed view is one white card", async ({ page }) => {
      await page.goto("/receiving");
      await expect(page.getByRole("heading", { level: 1, name: "Not allowed" })).toBeVisible();
      await expectLoneCard(page);
    });
  });
});

test.describe("landmarks", () => {
  test.describe("operator", () => {
    test.use({ storageState: OPERATOR_STATE });

    test("the side menu is the complementary landmark named Side menu and holds Sign out", async ({ page }) => {
      await open(page, "/receiving", { width: 1280, height: 720 });
      const side = page.getByRole("complementary", { name: "Side menu" });
      await expect(side.getByRole("button", { name: "Sign out" })).toBeVisible();
    });
  });

  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("the banner landmark on /sign-in holds Meat Ops", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(page.getByRole("banner").getByText("Meat Ops", { exact: true })).toBeVisible();
    });
  });
});

test.describe("the desktop content cap", () => {
  test.use({ storageState: OPERATOR_STATE });

  test("at 1280, /ask's examples section spans the full width and /production's check step keeps its own 28rem", async ({ page }) => {
    await seed502Fixture();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/ask");
    // The examples section is a direct child of <main>, after the shell's title-and-banner div.
    const examples = page.locator("main > section[aria-labelledby='examples-heading']");
    await expect(examples).toHaveCount(1);
    expect(await examples.evaluate((el) => getComputedStyle(el).maxWidth)).toBe("none");
    const [section, main] = await examples.evaluate((el) => {
      const parent = el.closest("main")!;
      const style = getComputedStyle(parent);
      const own = el.getBoundingClientRect();
      const left = parent.getBoundingClientRect().left + parent.clientLeft + parseFloat(style.paddingLeft);
      return [
        [own.left, own.right],
        [left, left + parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)],
      ];
    });
    expect(Math.abs(section![0]! - main![0]!), "examples left edge against <main>'s content").toBeLessThanOrEqual(1);
    expect(Math.abs(section![1]! - main![1]!), "examples right edge against <main>'s content").toBeLessThanOrEqual(1);
    const f = await openForm(page);
    await fillBatch(f, {});
    await f.save.click();
    const dialog = checkDialog(page);
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => getComputedStyle(el).maxWidth)).toBe("448px");
  });
});
