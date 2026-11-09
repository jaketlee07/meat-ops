import { expect, test, type Locator, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { banner, marginCase, openDigest, seedDigest, withWatchRefused } from "./alerts-page";
import { openAsk } from "./ask-page";
import { openInvoices, openReview, seedDraft, seedFixture } from "./invoices-page";
import { withTextSize } from "./look-checks";
import { opensDetail, opens as opensPricing } from "./pricing-page";
import {
  batchItem,
  batchNumberOf,
  openForm as openProductionForm,
  openReversal,
  reverseButton,
  reverseDialog,
  seed502Fixture,
  seedBatch,
} from "./production-page";
import {
  correctButton,
  fillReceipt,
  lotNumberOf,
  openCorrection,
  openForm as openReceivingForm,
  RAW_TOM_URL,
  receiptItem,
  seedReceipt,
  voidButton,
  SAVE_UNKNOWN,
  sendsActionRequest,
  VOID_UNKNOWN,
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

// Spec polish-forms-alerts, how the forms and alerts are drawn: the one label style (AC-0001), the number pairs that
// share a line and hold a whole figure (AC-0002, AC-0004), the floor forms' Tab order (AC-0028), the quiet urgent
// banner (AC-0012, AC-0013, AC-0014), and the digest list (AC-0022, AC-0023). Operator session;
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

// ---- The quiet banner and the digest list ----

// What a design token computes to as a color, read through a probe so the test never guesses a literal.
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${name})`;
    document.body.append(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, token);
}

// The region's fill and the color of each of its four edges.
async function bannerFrame(region: Locator) {
  return region.evaluate((node) => {
    const css = getComputedStyle(node);
    return {
      fill: css.backgroundColor,
      edges: [css.borderTopColor, css.borderRightColor, css.borderBottomColor, css.borderLeftColor],
    };
  });
}

async function expectQuietFrame(page: Page, region: Locator) {
  const surface = await tokenColor(page, "--color-surface");
  const edge = await tokenColor(page, "--color-card-border");
  const frame = await bannerFrame(region);
  expect(frame.fill, "fill is --color-surface").toBe(surface);
  expect(frame.edges, "every edge is --color-card-border").toEqual([edge, edge, edge, edge]);
  for (const token of ["--color-error-wash", "--color-error-edge"]) {
    const loud = await tokenColor(page, token);
    expect(frame.fill, `fill is not ${token}`).not.toBe(loud);
    expect(frame.edges, `no edge is ${token}`).not.toContain(loud);
  }
}

test("AC-0012: the Urgent alerts region with an urgent alert is a surface card with a card-border edge", async ({ page }) => {
  await marginCase();
  await page.goto("/receiving");
  await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
  await expectQuietFrame(page, banner(page));
});

test("AC-0012: the Urgent alerts region with the alert check failed is a surface card with a card-border edge", async ({ page }) => {
  await withWatchRefused(async () => {
    await page.goto("/receiving");
    await expect(banner(page).getByText("Alerts couldn't be checked.", { exact: true })).toBeVisible();
    await expectQuietFrame(page, banner(page));
  });
});

for (const width of [390, 1280]) {
  test(`AC-0013: at ${width} px the banner's sentence is regular ink after an error-colored dot, with its link`, async ({ page }) => {
    await marginCase();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/receiving");
    const region = banner(page);
    const sentence = region.getByText("1 urgent alert needs you.", { exact: true });
    await expect(sentence).toBeVisible();
    await expect(region.getByRole("link", { name: "See alerts", exact: true })).toBeVisible();
    const ink = await tokenColor(page, "--color-ink");
    const error = await tokenColor(page, "--color-error");
    const read = await sentence.evaluate((node) => {
      const css = getComputedStyle(node);
      const text = document.createRange();
      text.selectNodeContents(Array.from(node.childNodes).find((child) => child.nodeType === Node.TEXT_NODE)!);
      const dots = Array.from(node.querySelectorAll("[aria-hidden=true]")).map((dot) => ({
        fill: getComputedStyle(dot).backgroundColor,
        right: dot.getBoundingClientRect().right,
        width: dot.getBoundingClientRect().width,
        height: dot.getBoundingClientRect().height,
      }));
      return { weight: css.fontWeight, color: css.color, textLeft: text.getBoundingClientRect().left, dots };
    });
    expect(read.weight, "weight").toBe("400");
    expect(read.color, "color").toBe(ink);
    expect(read.dots, "one dot before the sentence").toHaveLength(1);
    const [dot] = read.dots as [(typeof read.dots)[number]];
    expect(dot.fill, "the dot's fill").toBe(error);
    expect(dot.width, "the dot has a size").toBeGreaterThan(0);
    expect(dot.right, "the dot is left of the sentence").toBeLessThanOrEqual(read.textLeft);
  });

  test(`AC-0014: at ${width} px the banner with an urgent alert is one line`, async ({ page }) => {
    await marginCase();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/receiving");
    const region = banner(page);
    await expect(region).toBeVisible();
    const read = await region.evaluate((node) => {
      const css = getComputedStyle(node);
      return {
        height: node.getBoundingClientRect().height,
        borders: parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth),
      };
    });
    expect(read.height, "height").toBeLessThanOrEqual(44 + read.borders);
  });
}

const DIGEST = [
  "The 502 margin is 1.8%, below your 20% target.",
  "Two receipts came in above their usual cost.",
  "Nothing else needs you today.",
];

async function openWrittenDigest(page: Page) {
  await marginCase();
  await seedDigest({ status: "written", paragraphs: DIGEST });
  await openDigest(page);
}

test("AC-0022: a three-paragraph digest is a list of three items in order, with the footer after the list", async ({ page }) => {
  await openWrittenDigest(page);
  const region = page.getByRole("region", { name: "Today's digest", exact: true });
  const list = region.getByRole("list");
  await expect(list).toHaveCount(1);
  await expect(list.getByRole("listitem")).toHaveText(DIGEST);
  const footer = region.getByText("Written by Claude from the alerts open at the time.", { exact: false });
  await expect(footer).toBeVisible();
  expect(await list.getByText("Written by Claude").count(), "the footer is outside the list").toBe(0);
  const after = await list.evaluate((node, text) => {
    const foot = Array.from(node.ownerDocument.querySelectorAll("p")).find((p) => p.textContent?.includes(text));
    return !!foot && !!(node.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING);
  }, "Written by Claude");
  expect(after, "the footer follows the list").toBe(true);
});

test("AC-0023: each digest item shows a --color-status-nocost dot before its text", async ({ page }) => {
  await openWrittenDigest(page);
  const nocost = await tokenColor(page, "--color-status-nocost");
  const items = page.getByRole("region", { name: "Today's digest", exact: true }).getByRole("listitem");
  await expect(items).toHaveCount(3);
  for (const item of await items.all()) {
    const read = await item.evaluate((node) => {
      const dots = Array.from(node.querySelectorAll("[aria-hidden=true]")).map((dot) => ({
        fill: getComputedStyle(dot).backgroundColor,
        right: dot.getBoundingClientRect().right,
        width: dot.getBoundingClientRect().width,
      }));
      const body = document.createRange();
      body.selectNodeContents(node.lastElementChild!);
      return { dots, textLeft: body.getBoundingClientRect().left };
    });
    expect(read.dots, "one dot").toHaveLength(1);
    const [dot] = read.dots as [(typeof read.dots)[number]];
    expect(dot.fill, "the dot's fill").toBe(nocost);
    expect(dot.width, "the dot has a size").toBeGreaterThan(0);
    expect(dot.right, "the dot is left of the text").toBeLessThanOrEqual(read.textLeft);
  }
});

// ---- AC-0019, AC-0020, AC-0033: the six waiting buttons ----

// Holds every server action request the page sends to `glob` until `release` is called, counting them. A released
// request ends as a dropped connection (the form answers it as a refusal) or, with "continue", goes on to the server.
async function holdActions(page: Page, glob: string, end: "abort" | "continue" = "abort") {
  const held = { count: 0 };
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(glob, async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) {
      held.count += 1;
      await gate;
      await (end === "abort" ? route.abort() : route.continue());
    } else {
      await route.continue();
    }
  });
  return { held, release };
}

// What a waiting button shows: no disabled attribute, aria-disabled, focus, and opacity.
async function waitingState(button: Locator) {
  return button.evaluate((node) => ({
    disabled: node.hasAttribute("disabled"),
    ariaDisabled: node.getAttribute("aria-disabled"),
    focused: node === document.activeElement,
    opacity: getComputedStyle(node).opacity,
  }));
}

const WAITING = { disabled: false, ariaDisabled: "true", focused: true, opacity: "1" };

// Presses a held button a second time three ways, none of which may send a request: a mouse press, Enter, and Space.
async function pressAgain(page: Page, button: Locator) {
  const sent = sendsActionRequest(page);
  await button.click({ force: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  expect(await sent, "a second press sent a request").toBe(false);
}

test("AC-0019 and AC-0020: Save on /receiving waits focusable at full opacity and a second press sends nothing", async ({ page }) => {
  const { held, release } = await holdActions(page, "**/receiving**");
  const f = await openReceivingForm(page, RAW_TOM_URL);
  await fillReceipt(f, {});
  await f.save.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => held.count).toBe(1);
  await expect(f.save).toHaveAttribute("aria-disabled", "true");
  expect(await waitingState(f.save)).toEqual(WAITING);
  await pressAgain(page, f.save);
  const sent = sendsActionRequest(page);
  await f.weight.press("Enter");
  expect(await sent, "Enter in a field sent a request").toBe(false);
  expect(held.count).toBe(1);
  // A queued second save would leave as soon as the first settles, so the window spans the release.
  const afterRelease = sendsActionRequest(page);
  release();
  await expect(f.message).toHaveText(SAVE_UNKNOWN);
  expect(await afterRelease, "a second save left after the first settled").toBe(false);
  expect(held.count).toBe(1);
});

test("AC-0019, AC-0020, and AC-0033: the receipt Void dialog's Cancel and Void receipt wait, and Cancel leaves the dialog open", async ({ page }) => {
  const lot = await lotNumberOf(await seedReceipt(1000, 1.5));
  const { held, release } = await holdActions(page, "**/receiving**");
  await openReceivingForm(page, RAW_TOM_URL);
  const item = receiptItem(page, lot);
  const dialog = receiptVoidDialog(page);
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  const confirm = dialog.getByRole("button", { name: "Void receipt" });

  await voidButton(item).click();
  await dialog.getByLabel("Reason for the void").fill("keyed twice");
  await confirm.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => held.count).toBe(1);
  await expect(confirm).toHaveAttribute("aria-disabled", "true");
  expect(await waitingState(confirm)).toEqual(WAITING);
  await cancel.focus();
  expect(await waitingState(cancel)).toEqual(WAITING);

  await pressAgain(page, confirm);
  expect(held.count).toBe(1);
  await cancel.click({ force: true });
  await expect(dialog).toBeVisible();

  // The request is dropped and answered as a refusal, which closes the dialog. A queued second void would
  // leave as soon as the first settles, so the window spans the release.
  const afterRelease = sendsActionRequest(page);
  release();
  await expect(dialog).toBeHidden();
  expect(await afterRelease, "a second void left after the first settled").toBe(false);
  expect(held.count).toBe(1);
  await expect(item.getByText(VOID_UNKNOWN)).toBeVisible();
  await voidButton(item).click();
  await expect(dialog).toBeVisible();
  await cancel.click();
  await expect(dialog).toBeHidden();
  await voidButton(item).click();
  await expect(dialog).toBeVisible();
  await cancel.click();
  await expect(dialog).toBeHidden();
});

test("AC-0019 and AC-0033: the Correct dialog's Cancel waits focusable at full opacity and leaves the dialog open", async ({ page }) => {
  const lot = await lotNumberOf(await seedReceipt(1000, 1.5));
  const { held, release } = await holdActions(page, "**/receiving**");
  await openReceivingForm(page, RAW_TOM_URL);
  const item = receiptItem(page, lot);
  const dialog = await openCorrection(page, item, lot, { cost: "1.75", reason: "invoice price" });
  const cancel = dialog.getByRole("button", { name: "Cancel" });

  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect.poll(() => held.count).toBe(1);
  await expect(cancel).toHaveAttribute("aria-disabled", "true");
  await cancel.focus();
  expect(await waitingState(cancel)).toEqual(WAITING);
  await cancel.click({ force: true });
  await expect(dialog).toBeVisible();

  release();
  await expect(dialog).toBeHidden();
  await correctButton(item).click();
  await expect(dialog).toBeVisible();
  await cancel.click();
  await expect(dialog).toBeHidden();
  await correctButton(item).click();
  await expect(dialog).toBeVisible();
  await cancel.click();
  await expect(dialog).toBeHidden();
});

test("AC-0019 and AC-0033: the Reverse dialog's Cancel waits focusable at full opacity and leaves the dialog open", async ({ page }) => {
  await seed502Fixture();
  const batch = await batchNumberOf(await seedBatch(1000, "2026-10-06"));
  const { held, release } = await holdActions(page, "**/production**");
  await openProductionForm(page, "/production?product=502");
  const item = batchItem(page, batch);
  const dialog = await openReversal(page, item, batch, "entered twice");
  const cancel = dialog.getByRole("button", { name: "Cancel" });

  await dialog.getByRole("button", { name: "Reverse batch", exact: true }).click();
  await expect.poll(() => held.count).toBe(1);
  await expect(cancel).toHaveAttribute("aria-disabled", "true");
  await cancel.focus();
  expect(await waitingState(cancel)).toEqual(WAITING);
  await cancel.click({ force: true });
  await expect(dialog).toBeVisible();

  release();
  await expect(dialog).toBeHidden();
  await reverseButton(item).click();
  await expect(reverseDialog(page, batch)).toBeVisible();
  await cancel.click();
  await expect(dialog).toBeHidden();
  await reverseButton(item).click();
  await expect(dialog).toBeVisible();
  await cancel.click();
  await expect(dialog).toBeHidden();
});

test.describe("signed out and waiting", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("AC-0019 and AC-0020: Sign in waits focusable at full opacity and a second press sends nothing", async ({ page }) => {
    const { held, release } = await holdActions(page, "**/sign-in**", "continue");
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("operator@meat-ops.test");
    await page.getByLabel("Password").fill("not-the-password");
    const signIn = page.getByRole("button", { name: "Sign in" });
    await signIn.focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => held.count).toBe(1);
    await expect(signIn).toHaveAttribute("aria-disabled", "true");
    expect(await waitingState(signIn)).toEqual(WAITING);
    await pressAgain(page, signIn);
    const sent = sendsActionRequest(page);
    await page.getByLabel("Password").press("Enter");
    await page.getByLabel("Email").press("Enter");
    expect(await sent, "Enter in a field sent a request").toBe(false);
    expect(held.count).toBe(1);
    release();
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    expect(held.count).toBe(1);
  });
});
