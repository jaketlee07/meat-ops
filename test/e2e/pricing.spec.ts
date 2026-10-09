import { expect, test, type Page } from "@playwright/test";
import { callAsOperator, PROD_502_ID, RAW_TOM_ID, resetTestData, voidReceiptCall } from "../db";
import { checkPageState } from "./a11y";
import {
  addFinished,
  addRaw,
  receive,
  retire502,
  setListPrice,
} from "./menu-page";
import {
  captureAction,
  card,
  CHANGE_SIGNED_OUT,
  detail,
  detailControls,
  dropActionRequests,
  figure,
  GROUP_HEADINGS,
  group,
  groupHeadings,
  headingsIn,
  listCards,
  NAV_CONTROLS,
  NO_PRODUCTS,
  NOT_ACTIVE,
  NOT_SAVED,
  opens,
  opensDetail,
  productsSnapshot,
  receive502Lot,
  refusedRegion,
  replayText,
  savedRegion,
  setActive,
  setTarget,
  storedListPrice,
  storedTarget,
  WHAT_IF_CONTROLS,
  WHAT_IF_HEADING,
  whatIf,
  ZERO_ID,
} from "./pricing-page";
import { CHANGE_UNKNOWN } from "../../src/lib/failures";
import { factValue, NOT_ALLOWED, openForm as openReceiving } from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// The pricing page, end to end: a real browser over the production build and the
// local database. Fixtures are written through pg (master data) and the
// operations (stock); raw tables are read through pg to show what was or was not
// written.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

const FRAMING = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
};

const LINK_502 = "a 502 Smoked Turkey Drums Tom";
// Tab order of a page whose only product is 502, with a button on its card or without.
const WITH_502 = [...NAV_CONTROLS, LINK_502, ...WHAT_IF_CONTROLS];
const WITH_502_BUTTON = (name: string) => [...NAV_CONTROLS, LINK_502, `button ${name}`, ...WHAT_IF_CONTROLS];

// 502 over RAW-TOM's one receipt, with a target (a fraction) and a list price.
async function fixture502(target: number | null, listPrice: number | null): Promise<string> {
  const lot = await receive502Lot();
  await setTarget(PROD_502_ID, target);
  await setListPrice(PROD_502_ID, listPrice);
  return lot;
}

const ADVICE_502_WITH_BOTH =
  "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. At your list price of $2.68/lb, the margin is 1.8%.";

test.describe("access and navigation", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /pricing ends on /sign-in", async ({ page }) => {
      await page.goto("/pricing");
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test("AC-0006: /pricing carries the framing headers, signed out", async ({ request }) => {
      const response = await request.get("/pricing");
      for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
      const redirect = await request.get("/pricing", { maxRedirects: 0 });
      for (const [name, value] of Object.entries(FRAMING)) expect(redirect.headers()[name]).toBe(value);
    });
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0002: /pricing shows the not-allowed message, Sign out, and no product", async ({ page }) => {
      await fixture502(0.2, 2.68);
      await page.goto("/pricing");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(listCards(page)).toHaveCount(0);
      await expect(page.getByText("Smoked Turkey Drums Tom")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: WHAT_IF_HEADING })).toHaveCount(0);
      // AC-0130, AC-0131, AC-0132, AC-0139, AC-0141
      expect(await checkPageState(page)).toEqual(["button Sign out"]);
    });
  });

  test("AC-0004 and AC-0005: /pricing links all pages and marks only its own", async ({ page }) => {
    await page.goto("/pricing");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "Receiving" })).toHaveAttribute("href", "/receiving");
    await expect(nav.getByRole("link", { name: "Production" })).toHaveAttribute("href", "/production");
    await expect(nav.getByRole("link", { name: "Menu" })).toHaveAttribute("href", "/menu");
    await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    await expect(nav.getByRole("link", { name: "Pricing", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current]")).toHaveCount(1);
  });

  test("AC-0006: /pricing carries the framing headers, signed in as the operator", async ({ request }) => {
    const response = await request.get("/pricing");
    for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
  });
});

// Presses the AC-0066 button of 502 and returns the action request it sent,
// without the operator's cookie, as an attacker would replay it. The stored price
// is set back to none afterwards, so a replay that wrote would show.
async function capturedApply(page: Page) {
  await fixture502(0.2, null);
  await opens(page);
  const captured = page.waitForRequest((request) => request.method() === "POST" && "next-action" in request.headers());
  await page.getByRole("button", { name: "Set list price to $3.29/lb" }).click();
  const request = await captured;
  await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
  expect(await storedListPrice(PROD_502_ID)).toBe(3.29);
  await setListPrice(PROD_502_ID, null);
  const headers = await request.allHeaders();
  for (const name of ["cookie", "content-length", "host"]) delete headers[name];
  return { url: request.url(), headers, body: request.postDataBuffer() ?? Buffer.alloc(0) };
}

test.describe("a replayed change request", () => {
  test("AC-0003 and AC-0109: with no session or a non-operator's, it changes no product and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const sent = await capturedApply(page);
    const before = await productsSnapshot();
    const replays = [
      { who: "no session", storageState: undefined, message: CHANGE_SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: `${NOT_SAVED} ${NOT_ALLOWED}` },
    ];
    for (const { who, storageState, message } of replays) {
      const replay = await playwright.request.newContext({ baseURL, storageState });
      try {
        const response = await replay.post(sent.url, { headers: sent.headers, data: sent.body });
        expect(await response.text(), `response for ${who}`).toContain(message);
      } finally {
        await replay.dispose();
      }
      expect(await productsSnapshot(), `products after ${who}`).toEqual(before);
    }
  });

  test("AC-0118 and AC-0112: a product id that names no product returns the database's text and changes nothing", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const sent = await capturedApply(page);
    const before = await productsSnapshot();
    // The body is multipart; each field's value follows its name and a blank line.
    const text = sent.body.toString("utf8");
    const data = Buffer.from(
      text.replace(/(name="[^"]*productId"\r\n\r\n)[^\r]*/, `$1${ZERO_ID}`),
      "utf8",
    );
    expect(data.equals(sent.body)).toBe(false);
    const replay = await playwright.request.newContext({ baseURL, storageState: OPERATOR_STATE });
    try {
      const response = await replay.post(sent.url, { headers: sent.headers, data });
      expect(await response.text()).toContain(`${NOT_SAVED} product ${ZERO_ID} not found`);
    } finally {
      await replay.dispose();
    }
    expect(await productsSnapshot()).toEqual(before);
  });
});

// Three raw-cost products that need a new price, two of them below target; the
// rest as the AC-0064 check fixture describes. All entered out of code order.
async function orderingFixture() {
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
  await addFinished("ZB", "No cost B", rawY);
  await addFinished("ZA", "No cost A", rawY);
}

test.describe("the list", () => {
  test("AC-0060, AC-0061, and AC-0070: 502 once, with its figures and a link to its detail", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    await expect(listCards(page)).toHaveCount(1);
    const c = card(page, "502");
    await expect(c.getByRole("heading", { level: 3 })).toHaveText("502 Smoked Turkey Drums Tom");
    await expect(figure(c, "Cost per lb")).toHaveText("$2.6318/lb");
    await expect(figure(c, "List price")).toHaveText("$2.68/lb");
    await expect(figure(c, "Suggested price")).toHaveText("$3.29/lb");
    await expect(figure(c, "Margin at list price")).toHaveText("1.8%");
    await expect(figure(c, "Target margin")).toHaveText("20%");
    const link = c.getByRole("link", { name: "502 Smoked Turkey Drums Tom" });
    await expect(link).toHaveAttribute("href", "/pricing?product=502");
  });

  test("AC-0062, AC-0074, AC-0075, and AC-0076: the missing-value texts", async ({ page }) => {
    await fixture502(null, null);
    const noCost = await addRaw("RAWN");
    await addFinished("NOCOST", "Never received", noCost, { listPrice: 3 });
    await opens(page);
    const priced = card(page, "502");
    await expect(figure(priced, "List price")).toHaveText("No list price yet");
    await expect(figure(priced, "Target margin")).toHaveText("No target");
    await expect(figure(priced, "Margin at list price")).toHaveText("None yet");
    const empty = card(page, "NOCOST");
    await expect(figure(empty, "Cost per lb")).toHaveText("None yet");
    await expect(figure(empty, "Suggested price")).toHaveText("No price yet");
    // It has a list price, but its raw input has no cost.
    await expect(figure(empty, "List price")).toHaveText("$3.00/lb");
    await expect(figure(empty, "Margin at list price")).toHaveText("None yet");
  });

  test("AC-0063, AC-0077, AC-0064, and AC-0066: three groups in order, each in its order, with the right buttons", async ({
    page,
  }) => {
    await orderingFixture();
    await opens(page);
    expect(await groupHeadings(page)).toEqual(GROUP_HEADINGS);
    expect(await headingsIn(page, "Needs a new price")).toEqual([
      "NB Needs B",
      "ND Needs D",
      "NA Needs A",
      "NC Needs C",
    ]);
    expect(await headingsIn(page, "Priced")).toEqual(["PA Priced A", "PB Priced B"]);
    expect(await headingsIn(page, "No cost yet")).toEqual(["ZA No cost A", "ZB No cost B"]);

    await expect(card(page, "NB").getByRole("button")).toHaveText("Raise list price to $2.09/lb");
    await expect(card(page, "ND").getByRole("button")).toHaveText("Raise list price to $2.09/lb");
    await expect(card(page, "NA").getByRole("button")).toHaveText("Set list price to $1.67/lb");
    await expect(card(page, "NC").getByRole("button")).toHaveText("Lower list price to $1.67/lb");
    for (const code of ["PA", "PB", "ZA", "ZB"]) await expect(card(page, code).getByRole("button")).toHaveCount(0);

    // The pricing list with all three groups.
    const controls = await checkPageState(page);
    expect(controls.filter((label) => label.startsWith("button ")).length).toBe(1 + 4 + 1);
    expect(controls.slice(0, 5)).toEqual(NAV_CONTROLS);
  });

  test("AC-0065: the advice for each of the four cases, and the button's name", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    const advice = card(page, "502").locator("p").filter({ hasText: /^Cost is / });
    const cases = [
      {
        target: 0.2,
        list: 2.68,
        text: ADVICE_502_WITH_BOTH,
        button: "Raise list price to $3.29/lb",
      },
      {
        target: 0.2,
        list: null,
        text: "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. This product has no list price yet.",
        button: "Set list price to $3.29/lb",
      },
      {
        target: null,
        list: 2.5,
        text: "Cost is $2.6318/lb. With no target margin, the suggested price is cost plus $0.0500/lb in margin fees. At your list price of $2.50/lb, the margin is -5.27%.",
        button: "Raise list price to $2.68/lb",
      },
      {
        target: null,
        list: null,
        text: "Cost is $2.6318/lb. With no target margin, the suggested price is cost plus $0.0500/lb in margin fees. This product has no list price yet.",
        button: "Set list price to $2.68/lb",
      },
    ];
    for (const { target, list, text, button } of cases) {
      await setTarget(PROD_502_ID, target);
      await setListPrice(PROD_502_ID, list);
      await page.reload();
      await expect(advice).toHaveText(text);
      await expect(card(page, "502").getByRole("button")).toHaveText(button);
    }
    // A product at its suggested price shows no button.
    await setTarget(PROD_502_ID, null);
    await setListPrice(PROD_502_ID, 2.68);
    await page.reload();
    await expect(card(page, "502").getByRole("button")).toHaveCount(0);
  });

  test("AC-0068, AC-0069, AC-0134, and AC-0133: Raise moves 502 under Priced, with the message focused", async ({
    page,
  }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    expect(await checkPageState(page)).toEqual(WITH_502_BUTTON("Raise list price to $3.29/lb"));
    await page.getByRole("button", { name: "Raise list price to $3.29/lb" }).focus();
    await page.keyboard.press("Enter");
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
    await expect(savedRegion(page)).toBeFocused();
    await expect(savedRegion(page)).toHaveAttribute("role", "status");
    await expect(refusedRegion(page)).toHaveText("");

    await expect(group(page, "Priced")).toBeVisible();
    await expect(card(page, "502")).toBeVisible();
    expect(await headingsIn(page, "Priced")).toEqual(["502 Smoked Turkey Drums Tom"]);
    await expect(figure(card(page, "502"), "List price")).toHaveText("$3.29/lb");
    await expect(figure(card(page, "502"), "Margin at list price")).toHaveText("20.01%");
    // AC-0078: neither empty group prints a heading.
    expect(await groupHeadings(page)).toEqual(["Priced"]);
    expect(await storedListPrice(PROD_502_ID)).toBe(3.29);
    // The pricing list after a list price save.
    expect(await checkPageState(page)).toEqual(WITH_502);
  });

  test("AC-0067: a cost that changed after the page loaded still stores the price the button names", async ({
    page,
  }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    await receive(RAW_TOM_ID, 3000, 1.8);
    await page.getByRole("button", { name: "Raise list price to $3.29/lb" }).click();
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
    expect(await storedListPrice(PROD_502_ID)).toBe(3.29);
  });

  test("a second press while a save is pending sends nothing, and the button says so", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    let posts = 0;
    await page.route("**/pricing**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });
    const button = page.getByRole("button", { name: "Raise list price to $3.29/lb" });
    await button.click();
    await expect(button).toHaveAttribute("aria-disabled", "true");
    await expect(card(page, "502").getByRole("status")).toHaveText("Saving…");
    // Playwright waits for an enabled control, and aria-disabled is not enabled to it.
    await button.click({ force: true });
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
    expect(posts).toBe(1);
  });

  test("AC-0071: with no active finished product, the page says so and has no what-if", async ({ page }) => {
    await retire502();
    await opens(page);
    await expect(page.getByText(NO_PRODUCTS, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: WHAT_IF_HEADING })).toHaveCount(0);
    await expect(page.getByLabel("Raw product")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show prices" })).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
  });

  test("AC-0072: a new receipt and a load of both pages leave the stored list price alone", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await receive(RAW_TOM_ID, 3000, 1.8);
    await page.goto("/pricing");
    await page.goto("/menu");
    expect(await storedListPrice(PROD_502_ID)).toBe(2.68);
  });

  test("AC-0116: an Apply on a product made inactive after the load shows the refusal, focused", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    await setActive(PROD_502_ID, false);
    const before = await productsSnapshot();
    await page.getByRole("button", { name: "Raise list price to $3.29/lb" }).click();
    await expect(refusedRegion(page)).toHaveText(NOT_ACTIVE);
    await expect(refusedRegion(page)).toBeFocused();
    await expect(refusedRegion(page)).toHaveAttribute("role", "alert");
    await expect(savedRegion(page)).toHaveText("");
    expect(await productsSnapshot()).toEqual(before);
    // The pricing list after a change refusal.
    expect(await checkPageState(page)).toEqual(WITH_502_BUTTON("Raise list price to $3.29/lb"));
  });

  test("AC-0115 and AC-0137: a dropped Apply says it may not have been saved", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    const dropped = await dropActionRequests(page);
    const button = page.getByRole("button", { name: "Raise list price to $3.29/lb" });
    await button.click();
    await expect(refusedRegion(page)).toHaveText("The change may not have been saved. Reload this page to check it.");
    await expect(refusedRegion(page)).toBeFocused();
    expect(dropped.count).toBe(1);
    await expect(button).not.toHaveAttribute("aria-disabled", "true");
    expect(await storedListPrice(PROD_502_ID)).toBe(2.68);
  });

  test("AC-0070 and AC-0063: list, detail, save, and back", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await opens(page);
    await card(page, "502").getByRole("link", { name: "502 Smoked Turkey Drums Tom" }).click();
    await expect(page).toHaveURL(/\/pricing\?product=502$/);
    const d = detail(page);
    await expect(d.heading).toHaveText("502 Smoked Turkey Drums Tom");
    await d.price.fill("3.29");
    await d.savePrice.click();
    await expect(d.saved).toHaveText("List price for 502 saved: $3.29/lb.");
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(group(page, "Priced")).toBeVisible();
    expect(await headingsIn(page, "Priced")).toEqual(["502 Smoked Turkey Drums Tom"]);
    await expect(figure(card(page, "502"), "List price")).toHaveText("$3.29/lb");
    await expect(figure(card(page, "502"), "Margin at list price")).toHaveText("20.01%");
  });
});

test.describe("Receiving", () => {
  test("AC-0073: with a 20% target, choosing RAW-TOM shows 502's suggested price as $3.29/lb", async ({ page }) => {
    await fixture502(0.2, null);
    const f = await openReceiving(page);
    await f.code.fill("RAW-TOM");
    await expect(factValue(f.region, "502 Smoked Turkey Drums Tom")).toHaveText("$3.29/lb");
  });
});

test.describe("the what-if", () => {
  test("AC-0120 and AC-0129: the section and its picker, raw products in code order", async ({ page }) => {
    await retire502();
    const rawA = await addRaw("A1R");
    const rawB = await addRaw("502R");
    const rawC = await addRaw("1000R");
    await addRaw("UNUSED");
    const rawOff = await addRaw("OFFR");
    await addFinished("F1", "One", rawA);
    await addFinished("F2", "Two", rawB);
    await addFinished("F3", "Three", rawC);
    await addFinished("F4", "Four", rawOff, { active: false });
    await opens(page);
    const w = whatIf(page);
    await expect(page.getByRole("heading", { level: 2, name: WHAT_IF_HEADING })).toBeVisible();
    await expect(w.raw).toBeVisible();
    await expect(w.cost).toHaveAttribute("inputmode", "decimal");
    await expect(w.show).toBeVisible();
    expect(await w.raw.locator("option").allTextContents()).toEqual([
      "",
      "1000R 1000R raw",
      "502R 502R raw",
      "A1R A1R raw",
    ]);
  });

  test("AC-0121, AC-0124, and AC-0133: Show prices lists 502 at the typed cost and keeps both fields", async ({
    page,
  }) => {
    await fixture502(0.2, 3.29);
    await opens(page);
    const w = whatIf(page);
    // Keyboard alone: the picker's type-ahead, Tab, the cost, Tab, Enter.
    await w.raw.focus();
    await page.keyboard.type("RAW-TOM");
    await page.keyboard.press("Tab");
    await page.keyboard.type("2.00");
    await page.keyboard.press("Tab");
    await expect(w.show).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/pricing\?raw=RAW-TOM&cost=2\.00$/);
    const c = w.cards.filter({ has: page.getByRole("heading", { name: "502 Smoked Turkey Drums Tom" }) });
    await expect(figure(c, "Cost per lb")).toHaveText("$3.0474/lb");
    await expect(figure(c, "Suggested price")).toHaveText("$3.81/lb");
    await expect(figure(c, "Margin at today's list price")).toHaveText("7.37%");
    await expect(w.raw).toHaveValue("RAW-TOM");
    await expect(w.cost).toHaveValue("2.00");
    // The same page again from its URL.
    await page.reload();
    await expect(w.raw).toHaveValue("RAW-TOM");
    await expect(w.cost).toHaveValue("2.00");
    await expect(figure(c, "Suggested price")).toHaveText("$3.81/lb");
    // The what-if results.
    expect(await checkPageState(page)).toEqual(WITH_502);
  });

  test("AC-0075 and AC-0083: after RAW-TOM's only receipt is voided, its costs show None yet", async ({ page }) => {
    const lot = await fixture502(0.2, 3.29);
    const voided = await callAsOperator(voidReceiptCall(lot));
    expect(voided.ok, voided.error).toBe(true);
    await opens(page);
    const c = card(page, "502");
    await expect(group(page, "No cost yet").getByRole("heading", { name: "502 Smoked Turkey Drums Tom" })).toBeVisible();
    await expect(figure(c, "Cost per lb")).toHaveText("None yet");
    await expect(figure(c, "Suggested price")).toHaveText("No price yet");
    await expect(figure(c, "Margin at list price")).toHaveText("None yet");
    await opensDetail(page, "502");
    const main = page.locator("main");
    for (const label of ["Raw average cost", "Cost after shrink", "Cost per lb"]) {
      await expect(figure(main, label), label).toHaveText("None yet");
    }
    await expect(figure(main, "Suggested price")).toHaveText("No price yet");
  });

  test("AC-0143: the same prices after RAW-TOM's only receipt is voided", async ({ page }) => {
    const lot = await fixture502(0.2, 3.29);
    const voided = await callAsOperator(voidReceiptCall(lot));
    expect(voided.ok, voided.error).toBe(true);
    await opens(page, "/pricing?raw=RAW-TOM&cost=2.00");
    const c = whatIf(page).cards.filter({ has: page.getByRole("heading", { name: "502 Smoked Turkey Drums Tom" }) });
    await expect(figure(c, "Cost per lb")).toHaveText("$3.0474/lb");
    await expect(figure(c, "Suggested price")).toHaveText("$3.81/lb");
    await expect(figure(c, "Margin at today's list price")).toHaveText("7.37%");
  });

  test("AC-0122: a product with no list price shows None yet", async ({ page }) => {
    await fixture502(0.2, null);
    await opens(page, "/pricing?raw=RAW-TOM&cost=2.00");
    const c = whatIf(page).cards.filter({ has: page.getByRole("heading", { name: "502 Smoked Turkey Drums Tom" }) });
    await expect(figure(c, "Margin at today's list price")).toHaveText("None yet");
    await expect(figure(c, "Suggested price")).toHaveText("$3.81/lb");
  });

  test("AC-0123, AC-0135, and AC-0136: each refused input shows its message, focus, and describedby, and no results", async ({
    page,
  }) => {
    await fixture502(0.2, 3.29);
    await opens(page);
    const w = whatIf(page);
    const RAW_MESSAGE = "Choose a raw product.";
    const cases: Array<{ raw: string; cost: string; rawError?: string; costError?: string }> = [
      { raw: "", cost: "1.68", rawError: RAW_MESSAGE },
      { raw: "RAW-TOM", cost: "", costError: "Enter the cost per lb, like 1.68." },
      { raw: "RAW-TOM", cost: "1.6.8", costError: "Enter the cost per lb, like 1.68." },
      { raw: "RAW-TOM", cost: "-1", costError: "Enter the cost per lb, like 1.68." },
      { raw: "RAW-TOM", cost: "1.23456", costError: "Use at most 4 decimal places for cost." },
      { raw: "", cost: "", rawError: RAW_MESSAGE, costError: "Enter the cost per lb, like 1.68." },
    ];
    for (const { raw, cost, rawError, costError } of cases) {
      await w.raw.selectOption({ value: raw });
      await w.cost.fill(cost);
      await w.show.click();
      const label = `raw "${raw}" cost "${cost}"`;
      for (const [field, id, error] of [
        [w.raw, "what-if-raw-error", rawError],
        [w.cost, "what-if-cost-error", costError],
      ] as const) {
        if (error) {
          await expect(page.locator(`#${id}`), label).toHaveText(error);
          await expect(field, label).toHaveAttribute("aria-describedby", id);
        } else {
          await expect(page.locator(`#${id}`), label).toHaveCount(0);
          await expect(field, label).not.toHaveAttribute("aria-describedby", /.*/);
        }
      }
      await expect(rawError ? w.raw : w.cost, label).toBeFocused();
      await expect(w.cards, label).toHaveCount(0);
      await expect(page, label).toHaveURL(/\/pricing$/);
      // Every field keeps its value.
      await expect(w.cost).toHaveValue(cost);
    }
    // The what-if form after an AC-0123 refusal.
    expect(await checkPageState(page)).toEqual(WITH_502);
  });

  test("AC-0123: a URL with a bad cost shows the same message and no results", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opens(page, "/pricing?raw=RAW-TOM&cost=abc");
    const w = whatIf(page);
    await expect(page.locator("#what-if-cost-error")).toHaveText("Enter the cost per lb, like 1.68.");
    await expect(w.cost).toHaveAttribute("aria-describedby", "what-if-cost-error");
    await expect(w.raw).toHaveValue("RAW-TOM");
    await expect(w.cost).toHaveValue("abc");
    await expect(w.cards).toHaveCount(0);
  });

  test("AC-0125: a code that is no raw input of an active finished product is shown as text", async ({ page }) => {
    await fixture502(0.2, 3.29);
    for (const code of ["NOPE", "502", "<b>9</b>"]) {
      await opens(page, `/pricing?raw=${encodeURIComponent(code)}&cost=2`);
      const message = `No active finished product is made from ${code}.`;
      await expect(page.getByText(message, { exact: true }), code).toBeVisible();
      await expect(page.locator("main b"), code).toHaveCount(0);
      await expect(whatIf(page).cards, code).toHaveCount(0);
      await expect(whatIf(page).cost).toHaveValue("2");
    }
    // The what-if for an AC-0125 code.
    expect(await checkPageState(page)).toEqual(WITH_502);
    // A code padded with a space is not RAW-TOM's code.
    await opens(page, `/pricing?raw=${encodeURIComponent(" RAW-TOM")}&cost=2`);
    await expect(page.getByText(/^No active finished product is made from\s+RAW-TOM\.$/)).toBeVisible();
    await expect(whatIf(page).cards).toHaveCount(0);
  });

  test("a what-if field error from Enter in the field is an alert, and absent without an error", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opens(page);
    const w = whatIf(page);
    await w.raw.selectOption({ value: "RAW-TOM" });
    await w.cost.fill("abc");
    await w.cost.press("Enter");
    await expect(page.locator("#what-if-cost-error")).toHaveAttribute("role", "alert");
    await expect(page.locator("#what-if-raw-error")).toHaveCount(0);
    await expect(w.cost).toBeFocused();
  });

  test("the what-if outcome sits inside a status region that exists before it", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opens(page);
    const status = whatIf(page).section.locator("[role=status]");
    await expect(status).toHaveCount(1);
    await expect(status).toHaveText("");
    await opens(page, "/pricing?raw=RAW-TOM&cost=2.00");
    await expect(status.getByRole("listitem")).toHaveCount(1);
    await opens(page, "/pricing?raw=NOPE&cost=2");
    await expect(status).toHaveText("No active finished product is made from NOPE.");
  });

  test("AC-0124: after Back, the fields match the URL", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opens(page);
    const w = whatIf(page);
    await w.raw.selectOption({ value: "RAW-TOM" });
    await w.cost.fill("2.00");
    await w.show.click();
    await expect(page).toHaveURL(/cost=2\.00$/);
    await expect(w.cards).toHaveCount(1);
    await w.cost.fill("2.50");
    await w.show.click();
    await expect(page).toHaveURL(/cost=2\.50$/);
    await expect(w.cost).toHaveValue("2.50");
    await page.goBack();
    await expect(page).toHaveURL(/cost=2\.00$/);
    await expect(w.cost).toHaveValue("2.00");
    await expect(w.raw).toHaveValue("RAW-TOM");
    // Back to the page with nothing chosen: the raw product and cost clear too.
    await page.goBack();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(w.raw).toHaveValue("");
    await expect(w.cost).toHaveValue("");
  });

  test("after Back, a field error from the URL shows again", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opens(page, "/pricing?raw=RAW-TOM&cost=abc");
    const w = whatIf(page);
    const costError = page.locator("#what-if-cost-error");
    await expect(costError).toHaveText("Enter the cost per lb, like 1.68.");
    await w.cost.fill("2.00");
    await w.show.click();
    await expect(page).toHaveURL(/cost=2\.00$/);
    await expect(w.cards).toHaveCount(1);
    await expect(costError).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/cost=abc$/);
    await expect(costError).toHaveText("Enter the cost per lb, like 1.68.");
    await expect(w.cost).toHaveValue("abc");
  });
});

// The detail's figures as label and value pairs, in page order.
async function figures(page: Page): Promise<Array<[string, string]>> {
  const labels = await page.locator("main dt").allTextContents();
  const values = await page.locator("main dd").allTextContents();
  return labels.map((label, index) => [label.trim(), (values[index] ?? "").trim()]);
}

const NO_TARGET_SENTENCE = "No target margin. The suggested price is cost per lb plus the margin fees.";

test.describe("the detail", () => {
  test("AC-0080, AC-0081, and AC-0138: 502's build-up in order, with a target", async ({ page }) => {
    await fixture502(0.2, 2.68);
    await opensDetail(page, "502");
    const d = detail(page);
    await expect(d.heading).toHaveText("502 Smoked Turkey Drums Tom");
    expect(await figures(page)).toEqual([
      ["Raw input", "RAW-TOM Turkey Drums TOM (raw)"],
      ["Raw average cost", "$1.6800/lb"],
      ["Shrink", "23%"],
      ["Cost after shrink", "$2.1818/lb"],
      ["Direct cost of material", "$0.0500/lb"],
      ["Cost of freezing", "$0.0300/lb"],
      ["Belmont overhead", "$0.3700/lb"],
      ["Cost per lb", "$2.6318/lb"],
      ["Target margin", "20%"],
      ["Suggested price", "$3.29/lb"],
      ["List price", "$2.68/lb"],
      ["Margin at list price", "1.8%"],
    ]);
    await expect(page.getByText(NO_TARGET_SENTENCE)).toHaveCount(0);
    // AC-0138: the names of the fields.
    await expect(d.target).toHaveAccessibleName(/%/);
    await expect(d.price).toHaveAccessibleName(/per lb/);
    // The detail with a target margin.
    expect(await checkPageState(page)).toEqual(
      detailControls({ apply: "Raise list price to $3.29/lb", remove: true }),
    );
  });

  test("AC-0080 and AC-0082: with no target, the margin fees, the suggested price, and the sentence", async ({
    page,
  }) => {
    await fixture502(null, null);
    await opensDetail(page, "502");
    const figs = await figures(page);
    expect(figs.slice(7)).toEqual([
      ["Cost per lb", "$2.6318/lb"],
      ["Profit", "$0.0500/lb"],
      ["Suggested price", "$2.68/lb"],
      ["List price", "No list price yet"],
      ["Margin at list price", "None yet"],
    ]);
    expect(figs.map(([label]) => label)).not.toContain("Target margin");
    await expect(page.getByText(NO_TARGET_SENTENCE, { exact: true })).toBeVisible();
    // The sentence sits between the suggested price and the list price.
    const order = await page.locator("main dt, main p").allTextContents();
    const labels = order.map((text) => text.trim());
    expect(labels.indexOf("Suggested price")).toBeLessThan(labels.indexOf(NO_TARGET_SENTENCE));
    expect(labels.indexOf(NO_TARGET_SENTENCE)).toBeLessThan(labels.indexOf("List price"));
    // The detail with no target margin.
    expect(await checkPageState(page)).toEqual(detailControls({ apply: "Set list price to $2.68/lb", remove: false }));
  });

  test("AC-0083: a raw input with no cost shows None yet and No price yet", async ({ page }) => {
    await retire502();
    const raw = await addRaw("RAWN");
    await addFinished("NOCOST", "Never received", raw);
    await opensDetail(page, "NOCOST");
    const main = page.locator("main");
    for (const label of ["Raw average cost", "Cost after shrink", "Cost per lb"]) {
      await expect(figure(main, label), label).toHaveText("None yet");
    }
    await expect(figure(main, "Suggested price")).toHaveText("No price yet");
    await expect(figure(main, "Raw input")).toHaveText("RAWN RAWN raw");
    await expect(figure(main, "Shrink")).toHaveText("10%");
    await expect(main.getByRole("button", { name: /list price to/ })).toHaveCount(0);
  });

  test("AC-0084: a product that needs a new price shows its advice and button, and pressing it saves", async ({
    page,
  }) => {
    await fixture502(0.2, 2.68);
    await opensDetail(page, "502");
    const d = detail(page);
    await expect(page.getByText(ADVICE_502_WITH_BOTH, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Raise list price to $3.29/lb" }).click();
    await expect(d.saved).toHaveText("List price for 502 saved: $3.29/lb.");
    await expect(d.saved).toBeFocused();
    await expect(figure(d.main, "List price")).toHaveText("$3.29/lb");
    await expect(figure(d.main, "Margin at list price")).toHaveText("20.01%");
    await expect(d.price).toHaveValue("3.29");
    expect(await storedListPrice(PROD_502_ID)).toBe(3.29);
    // At its suggested price the advice and the button are gone.
    await expect(d.main.getByRole("button", { name: /list price to/ })).toHaveCount(0);
    await expect(page.getByText(/^Cost is /)).toHaveCount(0);
  });

  test("AC-0085: a code that is no active finished product's is shown as text", async ({ page }) => {
    await fixture502(0.2, 3.29);
    const rawId = await addRaw("RAWO");
    await addFinished("OLD", "Retired", rawId, { active: false });
    for (const code of ["NOPE", "RAW-TOM", "OLD", "<b>9</b>"]) {
      await opensDetail(page, code);
      await expect(page.getByText(`No active finished product has code ${code}.`, { exact: true }), code).toBeVisible();
      await expect(page.locator("main b"), code).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 2 }), code).toHaveCount(0);
      await expect(detail(page).target, code).toHaveCount(0);
    }
    // The not-active-product detail.
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
  });
});

test.describe("the target margin", () => {
  test("AC-0090: the field starts with the stored percent, or empty", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    await expect(detail(page).target).toHaveValue("20");
    await setTarget(PROD_502_ID, 0.225);
    await page.reload();
    await expect(detail(page).target).toHaveValue("22.5");
    await setTarget(PROD_502_ID, null);
    await page.reload();
    await expect(detail(page).target).toHaveValue("");
  });

  test("AC-0091, AC-0111, AC-0112, AC-0135, and AC-0136: each refused input shows its message beside the field", async ({
    page,
  }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    const d = detail(page);
    const before = await productsSnapshot();
    const cases: Array<[string, string]> = [
      ["", "Enter a target margin, like 20 or 22.5."],
      ["abc", "Enter a target margin, like 20 or 22.5."],
      ["1.2.3", "Enter a target margin, like 20 or 22.5."],
      ["20.123", "Use at most 2 decimal places for a target margin."],
      ["100", "A target margin must be below 100."],
      ["150.5", "A target margin must be below 100."],
    ];
    await d.price.fill("keep me");
    for (const [input, message] of cases) {
      await d.target.fill(input);
      await d.saveTarget.click();
      await expect(d.targetError, input).toHaveText(message);
      await expect(d.targetError, input).toHaveAttribute("role", "alert");
      await expect(d.target, input).toHaveAttribute("aria-describedby", "target-margin-error");
      await expect(d.target, input).toBeFocused();
      // The other field has no error, and every field keeps what was typed.
      await expect(d.priceError, input).toHaveCount(0);
      await expect(d.target, input).toHaveValue(input);
      await expect(d.price, input).toHaveValue("keep me");
      await expect(d.saved, input).toHaveText("");
      await expect(d.refused, input).toHaveText("");
    }
    expect(await productsSnapshot()).toEqual(before);
    // The detail after an AC-0091 refusal.
    expect(await checkPageState(page)).toEqual(detailControls({ remove: true }));
  });

  test("AC-0092, AC-0133, and AC-0134: 22.5 saves by keyboard; the detail re-reads, and the field shows the stored value", async ({
    page,
  }) => {
    await fixture502(null, null);
    await opensDetail(page, "502");
    const d = detail(page);
    // Before the save: the no-target layout.
    await expect(figure(d.main, "Profit")).toHaveText("$0.0500/lb");
    await expect(d.main.getByText(NO_TARGET_SENTENCE, { exact: true })).toBeVisible();
    await expect(d.target).toHaveValue("");
    await d.target.focus();
    await page.keyboard.type("22.50");
    await page.keyboard.press("Tab");
    await expect(d.saveTarget).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(d.saved).toHaveText("Target margin for 502 saved: 22.5%.");
    await expect(d.saved).toBeFocused();
    await expect(d.saved).toHaveAttribute("role", "status");
    await expect(d.refused).toHaveText("");
    await expect(figure(d.main, "Target margin")).toHaveText("22.5%");
    await expect(figure(d.main, "Suggested price")).toHaveText("$3.40/lb");
    // After the save: the target layout, with no margin fee and no no-target sentence.
    await expect(d.main.getByText(NO_TARGET_SENTENCE, { exact: true })).toHaveCount(0);
    await expect(d.main.getByText("Profit", { exact: true })).toHaveCount(0);
    await expect(d.target).toHaveValue("22.5");
    expect(await storedTarget(PROD_502_ID)).toBe(0.225);
    // The detail after a target save.
    expect(await checkPageState(page)).toEqual(
      detailControls({ apply: "Set list price to $3.40/lb", remove: true }),
    );
  });

  test("AC-0093: Remove target margin shows only when there is a target", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    await expect(detail(page).removeTarget).toBeVisible();
    await setTarget(PROD_502_ID, null);
    await page.reload();
    await expect(detail(page).removeTarget).toHaveCount(0);
  });

  test("AC-0094, AC-0133, and AC-0134: Remove target margin, by keyboard, brings back the margin fees", async ({
    page,
  }) => {
    await fixture502(0.2, null);
    await opensDetail(page, "502");
    const d = detail(page);
    await d.removeTarget.focus();
    await page.keyboard.press("Enter");
    await expect(d.saved).toHaveText("Target margin for 502 removed.");
    await expect(d.saved).toBeFocused();
    await expect(figure(d.main, "Profit")).toHaveText("$0.0500/lb");
    await expect(figure(d.main, "Suggested price")).toHaveText("$2.68/lb");
    await expect(d.target).toHaveValue("");
    await expect(d.removeTarget).toHaveCount(0);
    expect(await storedTarget(PROD_502_ID)).toBeNull();
    // The detail after a target removal.
    expect(await checkPageState(page)).toEqual(
      detailControls({ apply: "Set list price to $2.68/lb", remove: false }),
    );
  });
});

test.describe("the list price", () => {
  test("AC-0100: the field starts with the stored price with 2 decimals, or empty", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    await expect(detail(page).price).toHaveValue("3.29");
    await setListPrice(PROD_502_ID, 3.5);
    await page.reload();
    await expect(detail(page).price).toHaveValue("3.50");
    await setListPrice(PROD_502_ID, null);
    await page.reload();
    await expect(detail(page).price).toHaveValue("");
  });

  test("AC-0101, AC-0111, AC-0112, AC-0135, and AC-0136: each refused input shows its message beside the field", async ({
    page,
  }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    const d = detail(page);
    const before = await productsSnapshot();
    const cases: Array<[string, string]> = [
      ["", "Enter the price per lb, like 3.29."],
      ["abc", "Enter the price per lb, like 3.29."],
      ["1.2.3", "Enter the price per lb, like 3.29."],
      ["3.456", "Use at most 2 decimal places for a price."],
      ["0", "Price must be above 0."],
      ["0.00", "Price must be above 0."],
      ["100000000", "Price must be below 100,000,000."],
    ];
    await d.target.fill("keep me");
    for (const [input, message] of cases) {
      await d.price.fill(input);
      await d.savePrice.click();
      await expect(d.priceError, input).toHaveText(message);
      await expect(d.priceError, input).toHaveAttribute("role", "alert");
      await expect(d.price, input).toHaveAttribute("aria-describedby", "list-price-error");
      await expect(d.price, input).toBeFocused();
      await expect(d.targetError, input).toHaveCount(0);
      await expect(d.price, input).toHaveValue(input);
      await expect(d.target, input).toHaveValue("keep me");
      await expect(d.saved, input).toHaveText("");
      await expect(d.refused, input).toHaveText("");
    }
    expect(await productsSnapshot()).toEqual(before);
    // The detail after an AC-0101 refusal.
    expect(await checkPageState(page)).toEqual(detailControls({ remove: true }));
  });

  test("AC-0102, AC-0133, and AC-0134: 3.5 saves by keyboard and the detail shows 3.50 and 24.81%", async ({
    page,
  }) => {
    await fixture502(null, null);
    await opensDetail(page, "502");
    const d = detail(page);
    await d.price.focus();
    await page.keyboard.type("3.5");
    await page.keyboard.press("Tab");
    await expect(d.savePrice).toBeFocused();
    await page.keyboard.press("Space");
    await expect(d.saved).toHaveText("List price for 502 saved: $3.50/lb.");
    await expect(d.saved).toBeFocused();
    await expect(figure(d.main, "List price")).toHaveText("$3.50/lb");
    await expect(figure(d.main, "Margin at list price")).toHaveText("24.81%");
    await expect(d.price).toHaveValue("3.50");
    expect(await storedListPrice(PROD_502_ID)).toBe(3.5);
    // The detail after a list price save.
    expect(await checkPageState(page)).toEqual(
      detailControls({ apply: "Lower list price to $2.68/lb", remove: false }),
    );
  });

  test("a second press while a save is pending sends nothing, and the form says so", async ({ page }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    const d = detail(page);
    let posts = 0;
    await page.route("**/pricing**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) {
        posts += 1;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      await route.continue();
    });
    await d.price.fill("3.50");
    await d.savePrice.click();
    await expect(d.savePrice).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("#list-price-heading + form [role=status]")).toHaveText("Saving…");
    await d.savePrice.click({ force: true });
    await expect(d.saved).toHaveText("List price for 502 saved: $3.50/lb.");
    expect(posts).toBe(1);
  });
});

test.describe("a replayed change request on a detail", () => {
  test("AC-0003 and AC-0109: target saves, target removals, and price saves with no session or a non-operator's change nothing", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await fixture502(0.2, 3.29);
    const d = detail(page);
    const presses = [
      async () => {
        await d.target.fill("25");
        await d.saveTarget.click();
      },
      async () => {
        await d.removeTarget.click();
      },
      async () => {
        await d.price.fill("3.50");
        await d.savePrice.click();
      },
    ];
    const sent = [];
    for (const press of presses) {
      await opensDetail(page, "502");
      sent.push(await captureAction(page, press));
      await expect(d.saved).not.toHaveText("");
      await setTarget(PROD_502_ID, 0.2);
      await setListPrice(PROD_502_ID, 3.29);
    }
    const before = await productsSnapshot();
    const replays = [
      { who: "no session", storageState: undefined, message: CHANGE_SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: `${NOT_SAVED} ${NOT_ALLOWED}` },
    ];
    for (const { who, storageState, message } of replays) {
      for (const [index, request] of sent.entries()) {
        const text = await replayText(playwright, baseURL, request, storageState);
        expect(text, `request ${index} with ${who}`).toContain(message);
        expect(await productsSnapshot(), `products after request ${index} with ${who}`).toEqual(before);
      }
    }
  });
});

test.describe("refused and failed changes on a detail", () => {
  // Types a different value in each field, so a kept value shows.
  async function typeBoth(page: Page) {
    const d = detail(page);
    await d.target.fill("25");
    await d.price.fill("3.50");
    return d;
  }

  test("AC-0110, AC-0111, AC-0112, and AC-0137: a session that ended after the load keeps both fields", async ({
    page,
  }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    const d = await typeBoth(page);
    const before = await productsSnapshot();
    await page.context().clearCookies();
    await d.saveTarget.click();
    await expect(d.refused).toHaveText(CHANGE_SIGNED_OUT);
    await expect(d.refused).toBeFocused();
    await expect(d.refused).toHaveAttribute("role", "alert");
    await expect(d.target).toHaveValue("25");
    await expect(d.price).toHaveValue("3.50");
    expect(await productsSnapshot()).toEqual(before);
  });

  test("AC-0116, AC-0111, AC-0112, and AC-0137: a product made inactive after the load keeps both fields", async ({
    page,
  }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    const d = await typeBoth(page);
    await setActive(PROD_502_ID, false);
    const before = await productsSnapshot();
    for (const button of [d.saveTarget, d.removeTarget, d.savePrice]) {
      await button.click();
      await expect(d.refused).toHaveText(NOT_ACTIVE);
      await expect(d.refused).toBeFocused();
      await expect(d.saved).toHaveText("");
      await expect(d.target).toHaveValue("25");
      await expect(d.price).toHaveValue("3.50");
      expect(await productsSnapshot()).toEqual(before);
      // Focus leaves the message, so the next refusal moves it back.
      await d.target.focus();
    }
    // The detail after an AC-0116 refusal.
    expect(await checkPageState(page)).toEqual(detailControls({ remove: true }));
  });

  test("AC-0115, AC-0111, and AC-0137: a save whose connection drops says it may not have been saved", async ({
    page,
  }) => {
    await fixture502(0.2, 3.29);
    await opensDetail(page, "502");
    const d = await typeBoth(page);
    const before = await productsSnapshot();
    const dropped = await dropActionRequests(page);
    await d.savePrice.click();
    await expect(d.refused).toHaveText(CHANGE_UNKNOWN);
    await expect(d.refused).toBeFocused();
    expect(dropped.count).toBe(1);
    await expect(d.target).toHaveValue("25");
    await expect(d.price).toHaveValue("3.50");
    await expect(d.savePrice).not.toHaveAttribute("aria-disabled", "true");
    expect(await productsSnapshot()).toEqual(before);
    // The detail after an AC-0115 failure.
    expect(await checkPageState(page)).toEqual(detailControls({ remove: true }));
  });
});
