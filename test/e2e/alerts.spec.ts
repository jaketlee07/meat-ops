import { expect, test, type Page } from "@playwright/test";
import { buildFiveAlertFixture, RAW_BEEF_ID } from "../alert-fixtures";
import { callAsOperator, PROD_502_ID, query, receiveCall, resetTestData, VENDOR_ID } from "../db";
import { formatDate } from "../../src/lib/format";
import { CHANGE_UNKNOWN, DISMISS_UNKNOWN } from "../../src/lib/failures";
import { checkPageState } from "./a11y";
import {
  alertGroup,
  alertIdOf,
  alertsSnapshot,
  alertStates,
  banner,
  captureAction,
  CHANGE_SIGNED_OUT,
  closeAlert,
  costEarlier,
  dismissButton,
  DISMISS_SIGNED_OUT,
  dropActionRequests,
  groupTitles,
  HEADER_PAGES,
  marginCase,
  MARGIN_SENTENCE,
  MARGIN_TITLE,
  NAV_CONTROLS,
  NO_LONGER_OPEN_CHANGE,
  NO_LONGER_OPEN_DISMISS,
  NOT_ACTIVE,
  NOT_DISMISSED,
  NOT_SAVED_CHANGE,
  opens,
  priceCase,
  RAISE_329,
  receiveTom,
  refusedRegion,
  savedRegion,
  sectionHeadings,
  setActive,
  storedListPrice,
  textWithoutBanner,
  watch,
  WATCH_FAILED,
  withSeeAlerts,
  withValue,
  withWatchRefused,
  yieldBatch,
  ZERO_ID,
} from "./alerts-page";
import { appDate } from "./app-time";
import { replayText } from "./pricing-page";
import { FORM_CONTROLS as RECEIVING_CONTROLS, fillReceipt, NOT_ALLOWED, openForm } from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// The alerts page and the urgent banner, end to end: a real browser over the
// production build and the local database. Fixtures go through the operations
// (and pg for master data), dated from the app's today, which the suite fixes
// through TZ (playwright.config.ts, test/e2e/app-time.ts).

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

const FRAMING = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
};

const COST_NEXT_STEP =
  "Check it against the invoice. If the cost is wrong, void the receipt on Receiving before production uses it.";
const ALL_PAGES = [...HEADER_PAGES, "/alerts"] as const;

// A dismissed alert's replacement of an action: presses the first button named so.
async function pressReprice(page: Page, name = RAISE_329) {
  await page.getByRole("button", { name, exact: true }).click();
}

// The five-alert fixture for the app's real today, with no watch run yet.
async function fiveAlerts(opts: { watch: boolean } = { watch: false }) {
  return buildFiveAlertFixture({ today: appDate(), watch: opts.watch });
}

async function lotTitle(lotId: string | null): Promise<string> {
  const [row] = await query<{ lot_number: string }>("select lot_number from lots where id = $1", [lotId]);
  return `Unusual cost: lot ${row?.lot_number}`;
}

async function batchTitle(batchId: string | null): Promise<string> {
  const [row] = await query<{ batch_number: string }>("select batch_number from production_batches where id = $1", [
    batchId,
  ]);
  return `Unusual yield: batch ${row?.batch_number}`;
}

const LOW_STOCK_TITLE = "Low stock: RAW-BEEF Beef Trim (raw)";
const PRICE_TITLE = "Price not updated: 503 Seasoned Turkey Drums";

test.describe("access and navigation", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /alerts ends on /sign-in", async ({ page }) => {
      await page.goto("/alerts");
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test("AC-0007: /alerts carries the framing headers, signed out", async ({ request }) => {
      const response = await request.get("/alerts");
      for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
      const redirect = await request.get("/alerts", { maxRedirects: 0 });
      for (const [name, value] of Object.entries(FRAMING)) expect(redirect.headers()[name]).toBe(value);
    });
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0002: /alerts shows the not-allowed message, Sign out, and no alert", async ({ page }) => {
      await marginCase();
      await watch();
      await page.goto("/alerts");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByRole("group")).toHaveCount(0);
      await expect(page.getByText("Smoked Turkey Drums Tom")).toHaveCount(0);
      // AC-0130, AC-0131, AC-0132, AC-0139, AC-0141
      expect(await checkPageState(page)).toEqual(["button Sign out"]);
    });
  });

  test("AC-0007: /alerts carries the framing headers, signed in", async ({ request }) => {
    const response = await request.get("/alerts");
    expect(response.status()).toBe(200);
    for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
  });

  test("AC-0005: every header page ends its Primary navigation with a link to /alerts", async ({ page }) => {
    for (const url of ALL_PAGES) {
      await page.goto(url);
      const links = page.getByRole("navigation", { name: "Primary" }).getByRole("link");
      await expect(links.last(), url).toHaveText("Alerts");
      await expect(links.last(), url).toHaveAttribute("href", "/alerts");
    }
  });

  test("AC-0006: on /alerts only the Alerts link carries aria-current, and its value is page", async ({ page }) => {
    await opens(page);
    const marked = page.getByRole("navigation", { name: "Primary" }).locator("a[aria-current]");
    await expect(marked).toHaveCount(1);
    await expect(marked).toHaveText("Alerts");
    await expect(marked).toHaveAttribute("aria-current", "page");
  });
});

test.describe("a replayed action request", () => {
  test("AC-0003, AC-0118, AC-0120, AC-0122: no session or a non-operator's changes nothing; the operator's bad requests change nothing", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await marginCase();
    await opens(page);
    const reprice = await captureAction(page, () => pressReprice(page));
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
    // Put the fixture back the way the page loaded it, so the replays face an open alert.
    await query("update products set list_price_per_lb = 2.68 where id = $1", [PROD_502_ID]);
    await query("update alerts set status = 'open', closed_at = null, ended_at = null");
    await opens(page);
    const dismiss = await captureAction(page, () => dismissButton(page, MARGIN_TITLE).click());
    await expect(savedRegion(page)).toHaveText("Alert dismissed.");
    await query("update alerts set status = 'open', closed_at = null, ended_at = null");

    const before = await alertsSnapshot();
    const replays = [
      {
        who: "no session",
        storageState: undefined,
        reprice: CHANGE_SIGNED_OUT,
        dismiss: DISMISS_SIGNED_OUT,
      },
      {
        who: "a non-operator's session",
        storageState: NON_OPERATOR_STATE,
        reprice: `${NOT_SAVED_CHANGE} ${NOT_ALLOWED}`,
        dismiss: `${NOT_DISMISSED} ${NOT_ALLOWED}`,
      },
    ];
    for (const replay of replays) {
      expect(await replayText(playwright, baseURL, reprice, replay.storageState), `reprice, ${replay.who}`).toContain(
        replay.reprice,
      );
      expect(await replayText(playwright, baseURL, dismiss, replay.storageState), `dismiss, ${replay.who}`).toContain(
        replay.dismiss,
      );
      expect(await alertsSnapshot(), `after ${replay.who}`).toEqual(before);
    }

    // AC-0120: the list-price form rule's message, for a price it refuses.
    const refusals: ReadonlyArray<[string, string]> = [
      ["abc", "Enter the price per lb, like 3.29."],
      ["3.299", "Use at most 2 decimal places for a price."],
      ["0", "Price must be above 0."],
    ];
    for (const [value, message] of refusals) {
      const text = await replayText(playwright, baseURL, withValue(reprice, "value", value), OPERATOR_STATE);
      expect(text, value).toContain(message);
      expect(await alertsSnapshot(), `after ${value}`).toEqual(before);
    }

    // AC-0122: the database's text for an id that names no alert.
    const noAlert = "alert 00000000-0000-0000-0000-000000000000 not found";
    expect(
      await replayText(playwright, baseURL, withValue(dismiss, "alertId", ZERO_ID), OPERATOR_STATE),
    ).toContain(`${NOT_DISMISSED} ${noAlert}`);
    expect(
      await replayText(playwright, baseURL, withValue(reprice, "alertId", ZERO_ID), OPERATOR_STATE),
    ).toContain(`${NOT_SAVED_CHANGE} ${noAlert}`);
    expect(await alertsSnapshot()).toEqual(before);
  });
});

test.describe("the urgent banner", () => {
  test("AC-0010 and AC-0135: in the margin case every header page but /alerts shows the banner in its region", async ({
    page,
  }) => {
    await marginCase();
    for (const url of HEADER_PAGES) {
      await page.goto(url);
      const region = banner(page);
      await expect(region, url).toBeVisible();
      await expect(region.getByText("1 urgent alert needs you.", { exact: true }), url).toBeVisible();
      await expect(region.getByRole("link", { name: "See alerts" }), url).toHaveAttribute("href", "/alerts");
    }
  });

  test("AC-0011: two open urgent alerts say 2 urgent alerts need you", async ({ page }) => {
    await marginCase();
    await costEarlier();
    await receiveTom(1000, "1.90", 0);
    await page.goto("/receiving");
    await expect(banner(page).getByText("2 urgent alerts need you.", { exact: true })).toBeVisible();
  });

  test("AC-0012: no urgent open alert shows no banner, also with a dismissed urgent one and an open other one", async ({
    page,
  }) => {
    for (const url of HEADER_PAGES) {
      await page.goto(url);
      await expect(banner(page), `${url} with no alert`).toHaveCount(0);
    }
    await marginCase();
    await yieldBatch();
    await watch();
    const margin = await alertIdOf("margin_below_target");
    expect((await callAsOperator({ fn: "dismiss_alert", args: { p_alert_id: margin } })).ok).toBe(true);
    expect(await alertStates()).toEqual([
      { type: "margin_below_target", status: "dismissed" },
      { type: "yield_anomaly", status: "open" },
    ]);
    for (const url of HEADER_PAGES) {
      await page.goto(url);
      await expect(banner(page), `${url} with a dismissed urgent alert`).toHaveCount(0);
    }
  });

  test("AC-0013: /alerts shows no banner", async ({ page }) => {
    await marginCase();
    await opens(page);
    await expect(alertGroup(page, MARGIN_TITLE)).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByText("urgent alert needs you")).toHaveCount(0);
  });

  test("AC-0014: a fifth receipt at 1.90 saved on /receiving shows the banner with the result, without a reload", async ({
    page,
  }) => {
    await costEarlier();
    const f = await openForm(page);
    await expect(banner(page)).toHaveCount(0);
    await page.evaluate(() => {
      (window as unknown as { __kept: boolean }).__kept = true;
    });
    await fillReceipt(f, { weight: "1000", cost: "1.90" });
    await f.date.fill(appDate());
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeVisible();
    await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
  });

  test("AC-0015: pressing Raise list price to $3.29/lb on /pricing shows the page without the banner", async ({
    page,
  }) => {
    await marginCase();
    await page.goto("/pricing");
    await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
    await pressReprice(page);
    await expect(page.getByText("List price for 502 saved: $3.29/lb.")).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
  });

  test("AC-0016 and AC-0017: a refused watch shows Alerts couldn't be checked, and the rest of /receiving as it is without a banner", async ({
    page,
  }) => {
    await marginCase();
    await page.goto("/receiving");
    // The rest of the page as it is when the watch succeeds with no open urgent alert.
    await query("update alerts set status = 'dismissed', closed_at = now()");
    await page.reload();
    await expect(banner(page)).toHaveCount(0);
    const expected = await textWithoutBanner(page);

    await withWatchRefused(async () => {
      await page.reload();
      await expect(banner(page).getByText(WATCH_FAILED, { exact: true })).toBeVisible();
      await expect(banner(page).getByRole("link")).toHaveCount(0);
      expect(await textWithoutBanner(page)).toBe(expected);
      // AC-0130, AC-0131, AC-0132, AC-0139, AC-0141: /receiving with the watch failure line.
      expect(await checkPageState(page)).toEqual(RECEIVING_CONTROLS);

      await opens(page);
      const line = page.getByText(WATCH_FAILED, { exact: true });
      await expect(line).toBeVisible();
      await expect(banner(page)).toHaveCount(0);
      // The line sits above the first section.
      const lineAt = await line.boundingBox();
      const headingAt = await page.getByRole("heading", { level: 2, name: "Today's digest" }).boundingBox();
      expect(lineAt && headingAt && lineAt.y < headingAt.y).toBe(true);
      // The watch failure line state of /alerts.
      expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
    });
  });

  test("a restored watch shows the banner again", async ({ page }) => {
    await marginCase();
    await withWatchRefused(async () => {
      await page.goto("/receiving");
      await expect(banner(page).getByText(WATCH_FAILED, { exact: true })).toBeVisible();
    });
    await page.goto("/receiving");
    await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
  });
});

test.describe("the page", () => {
  test("AC-0020, AC-0180, AC-0022, AC-0023, AC-0024, AC-0025: five alerts, in sections, each a group with its words and controls", async ({
    page,
  }) => {
    const fixture = await fiveAlerts();
    await opens(page);
    expect(await sectionHeadings(page)).toEqual(["Today's digest", "Urgent", "Other alerts"]);

    const costTitle = await lotTitle(fixture.subjects.cost_anomaly.lotId);
    const yieldTitle = await batchTitle(fixture.subjects.yield_anomaly.batchId);
    // Code order within a watch: 502 (margin, yield), 503 (price), RAW-BEEF (low stock), RAW-TOM (cost).
    expect(await groupTitles(page, "Urgent")).toEqual([MARGIN_TITLE, costTitle]);
    expect(await groupTitles(page, "Other alerts")).toEqual([yieldTitle, PRICE_TITLE, LOW_STOCK_TITLE]);

    const titles = [MARGIN_TITLE, costTitle, yieldTitle, PRICE_TITLE, LOW_STOCK_TITLE];
    for (const title of titles) {
      const group = alertGroup(page, title);
      await expect(group).toBeVisible();
      await expect(group.getByRole("heading", { level: 3, name: title, exact: true })).toBeVisible();
      // AC-0025: the name starts with Dismiss and the title, the visible text is Dismiss.
      const dismiss = dismissButton(page, title);
      await expect(dismiss).toHaveText("Dismiss");
      await expect(group.getByRole("button", { name: /^Dismiss / })).toHaveCount(1);
    }

    // AC-0022: sentence and next step.
    await expect(alertGroup(page, MARGIN_TITLE).getByText(/^At your list price of \$2\.68\/lb, the margin is /)).toBeVisible();
    await expect(alertGroup(page, costTitle).getByText(`Next step: ${COST_NEXT_STEP}`, { exact: true })).toBeVisible();
    await expect(alertGroup(page, costTitle).getByText(/ from Reyes Meats, received /)).toBeVisible();
    await expect(alertGroup(page, yieldTitle).getByText(/^502 Smoked Turkey Drums Tom made 700 lbs from 1,000 lbs on /)).toBeVisible();
    await expect(alertGroup(page, yieldTitle).getByText(/^Next step: Check the finished weight\. /)).toBeVisible();
    await expect(alertGroup(page, PRICE_TITLE).getByText(/^Your list price of .* has not changed since /)).toBeVisible();
    await expect(alertGroup(page, LOW_STOCK_TITLE).getByText(/ that lasts \d+(\.\d)? days?\.$/)).toBeVisible();
    await expect(alertGroup(page, LOW_STOCK_TITLE).getByText(/^Next step: Order about [\d,]+ lbs to cover 14 days\.$/)).toBeVisible();

    // AC-0023: a price button on the margin and price alerts only, named for the action and the price.
    const priceName = /^(Raise|Lower) list price to \$\d[\d,]*\.\d\d\/lb$/;
    for (const title of [MARGIN_TITLE, PRICE_TITLE]) {
      await expect(alertGroup(page, title).getByRole("button", { name: priceName })).toHaveCount(1);
      await expect(alertGroup(page, title).getByText("Next step", { exact: true })).toBeVisible();
    }
    for (const title of [costTitle, yieldTitle, LOW_STOCK_TITLE]) {
      await expect(alertGroup(page, title).getByRole("button", { name: /list price/ })).toHaveCount(0);
    }

    // AC-0024: the links.
    const links: ReadonlyArray<[string, string, string]> = [
      [costTitle, "Go to Receiving", "/receiving"],
      [LOW_STOCK_TITLE, "Go to Receiving", "/receiving"],
      [yieldTitle, "Go to Production", "/production"],
    ];
    for (const [title, name, href] of links) {
      await expect(alertGroup(page, title).getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
    }
    for (const title of [MARGIN_TITLE, PRICE_TITLE]) {
      await expect(alertGroup(page, title).getByRole("link")).toHaveCount(0);
    }
  });

  test("AC-0022, AC-0023: the margin case reads as the spec writes it", async ({ page }) => {
    await marginCase();
    await opens(page);
    const group = alertGroup(page, MARGIN_TITLE);
    await expect(group.getByText(MARGIN_SENTENCE, { exact: true })).toBeVisible();
    await expect(group.getByRole("button", { name: RAISE_329, exact: true })).toBeVisible();
  });

  test("AC-0022: the cost fixture's alert reads as the spec writes it", async ({ page }) => {
    await costEarlier();
    const lot = await receiveTom(1000, "1.90", 0);
    const title = await lotTitle(lot);
    await opens(page);
    const group = alertGroup(page, title);
    await expect(
      group.getByText(
        `RAW-TOM Turkey Drums TOM (raw) from Reyes Meats, received ${formatDate(appDate())}, cost $1.9000/lb. That is 14.46% above the usual $1.6600/lb, the middle of its last 4 receipts.`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect(group.getByText(`Next step: ${COST_NEXT_STEP}`, { exact: true })).toBeVisible();
  });

  test("AC-0022: the price case's alert reads as the spec writes it", async ({ page }) => {
    await priceCase();
    await opens(page);
    const group = alertGroup(page, "Price not updated: 502 Smoked Turkey Drums Tom");
    await expect(
      group.getByText(
        `Your list price of $2.68/lb has not changed since ${formatDate(appDate())}, when cost was $2.6318/lb. Cost is now $2.8851/lb, up 9.62%.`,
        { exact: true },
      ),
    ).toBeVisible();
    await expect(group.getByRole("button", { name: "Raise list price to $2.94/lb", exact: true })).toBeVisible();
  });

  test("AC-0181: a section with no alert is left out", async ({ page }) => {
    await marginCase();
    await opens(page);
    expect(await sectionHeadings(page)).toEqual(["Today's digest", "Urgent"]);
    await resetTestData();
    await priceCase();
    await opens(page);
    expect(await sectionHeadings(page)).toEqual(["Today's digest", "Other alerts"]);
  });

  test("AC-0182: within a section the alerts are newest creation first, then oldest subject first", async ({ page }) => {
    await marginCase();
    // The earlier urgent alert, from an earlier watch.
    await watch();
    await costEarlier();
    // Entered first but received later: the lot received a day ago comes first.
    const later = await receiveTom(1000, "1.95", 0);
    const earlier = await receiveTom(1000, "1.90", 1);
    await opens(page);
    expect(await groupTitles(page, "Urgent")).toEqual([await lotTitle(earlier), await lotTitle(later), MARGIN_TITLE]);
    await expect(page.getByRole("region", { name: "Other alerts" })).toHaveCount(0);
  });

  test("AC-0021: with no open alert the page says so under Today's digest, also with a digest written for today", async ({
    page,
  }) => {
    await opens(page);
    const digest = page.getByRole("region", { name: "Today's digest", exact: true });
    await expect(digest.getByText("No open alerts.", { exact: true })).toBeVisible();
    expect(await sectionHeadings(page)).toEqual(["Today's digest"]);
    await query(
      `insert into alert_digests(digest_date, status, paragraphs, model, claimed_at, finished_at)
       values ($1, 'written', array['Everything is fine today.'], 'claude-opus-5-5', now(), now())`,
      [appDate()],
    );
    await opens(page);
    await expect(digest.getByText("No open alerts.", { exact: true })).toBeVisible();
    await expect(page.getByText("Everything is fine today.")).toHaveCount(0);
    // The page state with no open alert.
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
  });

  test("AC-0026: a dismissed, actioned, or cleared alert does not appear", async ({ page }) => {
    const fixture = await fiveAlerts({ watch: true });
    const margin = await alertIdOf("margin_below_target");
    const price = await alertIdOf("price_stale");
    const [suggested] = await query<{ price: string }>(
      "select facts->>'suggested_list_price' as price from alerts where id = $1",
      [price],
    );
    expect((await callAsOperator({ fn: "dismiss_alert", args: { p_alert_id: margin } })).ok).toBe(true);
    expect(
      (await callAsOperator({ fn: "apply_alert_price", args: { p_alert_id: price, p_price_per_lb: suggested?.price ?? null } })).ok,
    ).toBe(true);
    // More stock ends the low-stock alert at the next watch.
    expect((await callAsOperator(receiveCall(RAW_BEEF_ID, VENDOR_ID, 5000, "2.00", appDate()))).ok).toBe(true);

    await opens(page);
    expect(await groupTitles(page, "Urgent")).toEqual([await lotTitle(fixture.subjects.cost_anomaly.lotId)]);
    expect(await groupTitles(page, "Other alerts")).toEqual([await batchTitle(fixture.subjects.yield_anomaly.batchId)]);
    for (const title of [MARGIN_TITLE, PRICE_TITLE, LOW_STOCK_TITLE]) await expect(alertGroup(page, title)).toHaveCount(0);
    const states = await alertStates();
    expect(states.filter((row) => row.status !== "open").map((row) => `${row.type} ${row.status}`).sort()).toEqual([
      "low_stock cleared",
      "margin_below_target dismissed",
      "price_stale actioned",
    ]);
  });

  test("AC-0027: alert text shows as literal text and adds no element", async ({ page }) => {
    await marginCase();
    await query("update products set description = '<b>9</b>' where id = $1", [PROD_502_ID]);
    await opens(page);
    const group = alertGroup(page, "Margin below target: 502 <b>9</b>");
    await expect(group).toBeVisible();
    await expect(group.locator("b")).toHaveCount(0);
    await expect(page.locator("main b")).toHaveCount(0);
  });

  test("AC-0028: the page shows the figures its own watch left", async ({ page }) => {
    await marginCase();
    await opens(page);
    await expect(alertGroup(page, MARGIN_TITLE).getByText("At your list price of $2.68/lb", { exact: false })).toBeVisible();
    await page.goto("about:blank");
    await query("update products set list_price_per_lb = 2.90 where id = $1", [PROD_502_ID]);
    await opens(page);
    await expect(alertGroup(page, MARGIN_TITLE).getByText("At your list price of $2.90/lb", { exact: false })).toBeVisible();
  });
});

test.describe("reprice and dismiss", () => {
  test("AC-0111, AC-0116, AC-0133: Raise list price saves the price named, says so focused, and the alert goes", async ({
    page,
  }) => {
    await marginCase();
    await opens(page);
    const button = page.getByRole("button", { name: RAISE_329, exact: true });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
    await expect(savedRegion(page)).toBeFocused();
    await expect(alertGroup(page, MARGIN_TITLE)).toHaveCount(0);
    expect(await storedListPrice(PROD_502_ID)).toBe("3.29");
    expect(await alertStates()).toEqual([{ type: "margin_below_target", status: "actioned" }]);
    // The page state after a reprice.
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
  });

  test("AC-0112: the button stores the price it names, also when the cost changed after the page loaded", async ({
    page,
  }) => {
    await marginCase();
    await opens(page);
    await receiveTom(5000, 2.5, 0);
    await pressReprice(page);
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
    expect(await storedListPrice(PROD_502_ID)).toBe("3.29");
  });

  test("AC-0113: in the price case Raise list price to $2.94/lb stores 2.94 and records the change", async ({
    page,
  }) => {
    await priceCase();
    await opens(page);
    await pressReprice(page, "Raise list price to $2.94/lb");
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $2.94/lb.");
    expect(await storedListPrice(PROD_502_ID)).toBe("2.94");
    const history = await query(
      "select old_price::text as old_price, new_price::text as new_price from private.list_price_changes where product_id = $1 order by seq",
      [PROD_502_ID],
    );
    expect(history).toEqual([
      { old_price: null, new_price: "2.68" },
      { old_price: "2.68", new_price: "2.94" },
    ]);
  });

  test("AC-0115, AC-0116, AC-0133: Dismiss says so focused, and the alert goes while the others stay", async ({
    page,
  }) => {
    await marginCase();
    await yieldBatch();
    await opens(page);
    const dismiss = dismissButton(page, MARGIN_TITLE);
    await dismiss.focus();
    await page.keyboard.press("Space");
    await expect(savedRegion(page)).toHaveText("Alert dismissed.");
    await expect(savedRegion(page)).toBeFocused();
    await expect(alertGroup(page, MARGIN_TITLE)).toHaveCount(0);
    expect(await alertStates()).toEqual([
      { type: "margin_below_target", status: "dismissed" },
      { type: "yield_anomaly", status: "open" },
    ]);
    // The page state after a dismiss.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, "a Go to Production", "button Dismiss"]);
  });

  test("AC-0133: a link in an alert and the banner's See alerts link work from the keyboard", async ({ page }) => {
    await marginCase();
    await yieldBatch();
    await opens(page);
    await page.getByRole("link", { name: "Go to Production" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/production$/);
    await expect(banner(page)).toBeVisible();
    await banner(page).getByRole("link", { name: "See alerts" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/alerts$/);
    await expect(page.getByRole("heading", { level: 1, name: "Alerts" })).toBeVisible();
  });

  for (const kind of ["reprice", "dismiss"] as const) {
    const signedOut = kind === "reprice" ? CHANGE_SIGNED_OUT : DISMISS_SIGNED_OUT;

    test(`AC-0117, AC-0123, AC-0137: a ${kind} after the session ended says so, focused, and the alert stays`, async ({
      page,
    }) => {
      await marginCase();
      await opens(page);
      const before = await alertsSnapshot();
      await page.context().clearCookies();
      await (kind === "reprice" ? pressReprice(page) : dismissButton(page, MARGIN_TITLE).click());
      await expect(refusedRegion(page)).toHaveText(signedOut);
      await expect(refusedRegion(page)).toBeFocused();
      await expect(alertGroup(page, MARGIN_TITLE)).toBeVisible();
      await expect(page.getByRole("button", { name: RAISE_329, exact: true })).toBeVisible();
      await expect(dismissButton(page, MARGIN_TITLE)).toBeVisible();
      expect(await alertsSnapshot()).toEqual(before);
      // The page state after an AC-0117 outcome.
      expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, `button ${RAISE_329}`, "button Dismiss"]);
    });

    test(`AC-0121, AC-0123, AC-0137: a ${kind} on an alert closed after the load says it is no longer open`, async ({
      page,
    }) => {
      await marginCase();
      await opens(page);
      const id = await alertIdOf("margin_below_target");
      for (const status of ["dismissed", "actioned", "cleared"]) {
        await query(
          `update alerts set status = $2, closed_at = now(), ended_at = case when $2 = 'dismissed' then null else now() end where id = $1`,
          [id, status],
        );
        await (kind === "reprice" ? pressReprice(page) : dismissButton(page, MARGIN_TITLE).click());
        await expect(refusedRegion(page), status).toHaveText(
          kind === "reprice" ? NO_LONGER_OPEN_CHANGE : NO_LONGER_OPEN_DISMISS,
        );
        await expect(refusedRegion(page), status).toBeFocused();
        await expect(alertGroup(page, MARGIN_TITLE), status).toBeVisible();
        await expect(page.getByRole("button", { name: RAISE_329, exact: true }), status).toBeVisible();
        expect(await storedListPrice(PROD_502_ID), status).toBe("2.68");
        await query("update alerts set status = 'open', closed_at = null, ended_at = null where id = $1", [id]);
        await dismissButton(page, MARGIN_TITLE).focus();
      }
      // The page state after an AC-0121 outcome.
      expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, `button ${RAISE_329}`, "button Dismiss"]);
    });
  }

  test("AC-0147, AC-0123, AC-0137: a reprice for a product made inactive after the load says so, and the alert stays", async ({
    page,
  }) => {
    await marginCase();
    await opens(page);
    await setActive(PROD_502_ID, false);
    await pressReprice(page);
    await expect(refusedRegion(page)).toHaveText(NOT_ACTIVE);
    await expect(refusedRegion(page)).toBeFocused();
    await expect(alertGroup(page, MARGIN_TITLE)).toBeVisible();
    await expect(page.getByRole("button", { name: RAISE_329, exact: true })).toBeVisible();
    expect(await storedListPrice(PROD_502_ID)).toBe("2.68");
    // The page state after an AC-0147 outcome.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, `button ${RAISE_329}`, "button Dismiss"]);
  });

  test("a press whose connection drops says the change may not have happened, focused, and the alert stays", async ({
    page,
  }) => {
    await marginCase();
    await opens(page);
    const before = await alertsSnapshot();
    const dropped = await dropActionRequests(page);
    await pressReprice(page);
    await expect(refusedRegion(page)).toHaveText(CHANGE_UNKNOWN);
    await expect(refusedRegion(page)).toBeFocused();
    await dismissButton(page, MARGIN_TITLE).click();
    await expect(refusedRegion(page)).toHaveText(DISMISS_UNKNOWN);
    await expect(refusedRegion(page)).toBeFocused();
    expect(dropped.count).toBe(2);
    await expect(alertGroup(page, MARGIN_TITLE)).toBeVisible();
    expect(await alertsSnapshot()).toEqual(before);
  });

  test("the page states with urgent and other alerts, and with only other alerts, pass the page checks", async ({
    page,
  }) => {
    await fiveAlerts();
    await opens(page);
    const priced = await page.getByRole("button", { name: /^(Raise|Lower) list price to / }).allTextContents();
    expect(priced).toHaveLength(2);
    // Urgent: the margin alert, then the cost alert; other: yield, price, low stock.
    expect(await checkPageState(page)).toEqual([
      ...NAV_CONTROLS,
      `button ${priced[0]}`,
      "button Dismiss",
      "a Go to Receiving",
      "button Dismiss",
      "a Go to Production",
      "button Dismiss",
      `button ${priced[1]}`,
      "button Dismiss",
      "a Go to Receiving",
      "button Dismiss",
    ]);

    await resetTestData();
    await receiveTom(5000, 1.68, 10);
    await yieldBatch();
    await opens(page);
    expect(await sectionHeadings(page)).toEqual(["Today's digest", "Other alerts"]);
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, "a Go to Production", "button Dismiss"]);
  });

  test("/receiving with the urgent banner passes the page checks", async ({ page }) => {
    await marginCase();
    await openForm(page);
    await expect(banner(page)).toBeVisible();
    expect(await checkPageState(page)).toEqual(withSeeAlerts(RECEIVING_CONTROLS));
  });
});
