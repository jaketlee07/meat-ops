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
  card,
  CHANGE_SIGNED_OUT,
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
  productsSnapshot,
  receive502Lot,
  refusedRegion,
  savedRegion,
  setActive,
  setTarget,
  storedListPrice,
  WHAT_IF_CONTROLS,
  WHAT_IF_HEADING,
  whatIf,
  ZERO_ID,
} from "./pricing-page";
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
  });
});
