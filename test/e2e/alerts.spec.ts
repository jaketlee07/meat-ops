import os from "node:os";
import { expect, test, type Page } from "@playwright/test";
import { buildFiveAlertFixture, RAW_BEEF_ID } from "../alert-fixtures";
import { callAsOperator, PROD_502_ID, query, receiveCall, resetTestData, VENDOR_ID } from "../db";
import { resolveStackEnv } from "../env";
import { OPERATOR_EMAIL } from "../users";
import { formatDate } from "../../src/lib/format";
import { CHANGE_UNKNOWN, DISMISS_UNKNOWN } from "../../src/lib/failures";
import { checkPageState } from "./a11y";
import {
  alertGroup,
  alertIdOf,
  alertsSnapshot,
  alertStates,
  banner,
  BEING_WRITTEN,
  captureAction,
  CHANGE_SIGNED_OUT,
  closeAlert,
  costEarlier,
  DIGEST_FOOTER,
  DIGEST_SIGNED_OUT,
  digestRegion,
  digestRows,
  dismissButton,
  DISMISS_SIGNED_OUT,
  dropActionRequests,
  groupTitles,
  HEADER_PAGES,
  KEY_REFUSED_DIGEST,
  marginCase,
  MARGIN_SENTENCE,
  MARGIN_TITLE,
  NAV_CONTROLS,
  NO_LONGER_OPEN_CHANGE,
  NO_LONGER_OPEN_DISMISS,
  NOT_ACTIVE,
  NOT_DISMISSED,
  NOT_SAVED_CHANGE,
  NOT_WRITTEN_NOT_ALLOWED,
  opens,
  openDigest,
  priceCase,
  RAISE_329,
  receiveTom,
  refusedRegion,
  savedRegion,
  SEEDED_DIGEST,
  sectionHeadings,
  seedDigest,
  setActive,
  shownFacts,
  storedListPrice,
  textWithoutBanner,
  tryAgain,
  TRY_AGAIN_DIGEST,
  watch,
  WATCH_FAILED,
  withSeeAlerts,
  withValue,
  withWatchRefused,
  WRITING_DIGEST,
  yieldBatch,
  ZERO_ID,
} from "./alerts-page";
import { appDate } from "./app-time";
import {
  ANTHROPIC_TEST_AUTH_TOKEN,
  ANTHROPIC_TEST_KEY,
  type FakeAnswer,
  type FakeModel,
  fakeModel,
} from "./invoices-page";
import { replayText } from "./pricing-page";
import { readSession } from "./session";
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
  "Check it against the invoice. If the cost is wrong, correct the receipt on Receiving.";
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
    const status = page.locator("main > div > [role=status]");
    await expect(status).toHaveCount(1);
    await page.evaluate(() => {
      (window as unknown as { __kept: boolean }).__kept = true;
      (window as unknown as { __status: Element | null }).__status = document.querySelector("main > div > [role=status]");
    });
    await fillReceipt(f, { weight: "1000", cost: "1.90" });
    await f.date.fill(appDate());
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeVisible();
    await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
    // The banner sits in a status container the page had before the save, so it is announced.
    await expect(status.getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => {
        const kept = (window as unknown as { __status: Element | null }).__status;
        return kept !== null && kept.isConnected && kept.contains(document.querySelector("[aria-label='Urgent alerts']"));
      }),
    ).toBe(true);
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
    await watch();
    // Touch the earlier lot's alert so the table holds it after the later lot's.
    await query("update alerts set updated_at = now() where lot_id = $1", [earlier]);
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
    // opens() stored a written digest for today.
    expect(await query("select status from alert_digests where digest_date = $1", [appDate()])).toEqual([
      { status: "written" },
    ]);
    await opens(page);
    await expect(digest.getByText("No open alerts.", { exact: true })).toBeVisible();
    await expect(page.getByText(SEEDED_DIGEST)).toHaveCount(0);
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

  test("while one write is held, the card's other button carries aria-disabled", async ({
    page,
  }) => {
    await marginCase();
    await opens(page);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/alerts**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) await gate;
      await route.continue();
    });
    const raise = page.getByRole("button", { name: RAISE_329, exact: true });
    const dismiss = dismissButton(page, MARGIN_TITLE);
    await raise.click();
    await expect(raise).toHaveAttribute("aria-disabled", "true");
    await expect(dismiss).toHaveAttribute("aria-disabled", "true");
    release();
    await expect(savedRegion(page)).toHaveText("List price for 502 saved: $3.29/lb.");
  });

  test("while a Dismiss is held, the card's reprice button carries aria-disabled", async ({
    page,
  }) => {
    await marginCase();
    await opens(page);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/alerts**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) await gate;
      await route.continue();
    });
    const raise = page.getByRole("button", { name: RAISE_329, exact: true });
    await dismissButton(page, MARGIN_TITLE).click();
    await expect(raise).toHaveAttribute("aria-disabled", "true");
    release();
    await expect(savedRegion(page)).toHaveText("Alert dismissed.");
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

// ---- The digest ----

// A digest that passes the checks for the margin case: every number is one the
// facts hold, and it names 502.
function marginDigest(text = "The 502 margin is 1.8%, below your 20% target. Raise the price to $3.29/lb."): FakeAnswer {
  return { text: JSON.stringify({ paragraphs: [text] }) };
}

// For the five-alert fixture: it names every alert's product code and holds no figure.
const FIVE_DIGEST: FakeAnswer = {
  text: JSON.stringify({ paragraphs: ["Look at 502, RAW-TOM, 503, and RAW-BEEF first."] }),
};

test.describe("the digest", () => {
  let model: FakeModel;

  test.beforeEach(async ({ baseURL }) => {
    model = fakeModel(baseURL);
    await model.reset();
  });

  test("AC-0080, AC-0081, AC-0134, AC-0130: the first visit sends one request, says so in a status region, and shows the digest without moving focus", async ({
    page,
  }) => {
    await marginCase();
    await model.answer({ hold: true, then: marginDigest() });
    // The in-flight message sits in a status region that was in the page before its text.
    await page.addInitScript(() => {
      const seen = { regionAddedWithText: false };
      (window as unknown as { __digest: typeof seen }).__digest = seen;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            for (const region of [node, ...node.querySelectorAll("[role=status]")]) {
              if (region.getAttribute("role") === "status" && region.textContent?.includes("Writing today's digest")) {
                seen.regionAddedWithText = true;
              }
            }
          }
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await openDigest(page);
    const writing = digestRegion(page).locator("p[role=status]");
    await expect(writing).toHaveText(WRITING_DIGEST);
    await model.waitForRequests(1);
    expect(await page.evaluate(() => (window as unknown as { __digest: { regionAddedWithText: boolean } }).__digest)).toEqual({
      regionAddedWithText: false,
    });
    // The page state while a digest is being written.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, `button ${RAISE_329}`, "button Dismiss"]);

    // AC-0134: focus stays where it was when the automatic outcome arrives.
    await dismissButton(page, MARGIN_TITLE).focus();
    await model.release();
    const text = "The 502 margin is 1.8%, below your 20% target. Raise the price to $3.29/lb.";
    await expect(digestRegion(page).getByText(text, { exact: true })).toBeVisible();
    await expect(digestRegion(page).getByText(DIGEST_FOOTER, { exact: true })).toBeVisible();
    await expect(writing).toHaveText("");
    await expect(dismissButton(page, MARGIN_TITLE)).toBeFocused();
    expect(await model.requests()).toHaveLength(1);
    expect(await digestRows()).toEqual([{ status: "written", paragraphs: [text], failure_kind: null }]);
    // The page state with a written digest.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, `button ${RAISE_329}`, "button Dismiss"]);
  });

  test("AC-0082: a second load the same day sends nothing and shows the stored digest, also after a new alert", async ({
    page,
  }) => {
    await marginCase();
    await model.answer(marginDigest());
    await openDigest(page);
    await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toBeVisible();
    await yieldBatch();
    await openDigest(page);
    await expect(page.getByRole("region", { name: "Other alerts" })).toBeVisible();
    await expect(digestRegion(page).getByText("The 502 margin is 1.8%", { exact: false })).toBeVisible();
    await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toBeVisible();
    await page.reload();
    await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toBeVisible();
    expect(await model.requests()).toHaveLength(1);
  });

  test("AC-0085: with no open alert a load sends nothing and stores no digest", async ({ page }) => {
    await openDigest(page);
    await expect(digestRegion(page).getByText("No open alerts.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(digestRegion(page).getByText("No open alerts.", { exact: true })).toBeVisible();
    expect(await model.requests()).toEqual([]);
    expect(await digestRows()).toEqual([]);
  });

  test("AC-0083, AC-0097, AC-0098, AC-0109, AC-0162: the request has the fixed fields, one user message of the page's own facts, and no machine value", async ({
    page,
  }) => {
    await buildFiveAlertFixture({ today: appDate(), watch: false });
    await model.answer(FIVE_DIGEST, FIVE_DIGEST);
    await openDigest(page);
    await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toBeVisible();
    const facts = await shownFacts(page);
    expect(facts.split("\n")).toHaveLength(6);
    const [first] = await model.requests();
    expect(first).toBeDefined();
    const { body, headers } = first!;

    // AC-0083
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.max_tokens).toBe(16000);
    expect(Object.keys(body.output_config).sort()).toEqual(["effort", "format"]);
    expect(body.output_config.effort).toBe("low");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema).toEqual({
      type: "object",
      properties: { paragraphs: { type: "array", items: { type: "string" } } },
      required: ["paragraphs"],
      additionalProperties: false,
    });
    expect(headers["anthropic-beta"]).toBeUndefined();

    // AC-0097: one user message, whose text is the facts the page's sentences make.
    expect(body.messages).toEqual([{ role: "user", content: [{ type: "text", text: facts }] }]);

    // AC-0109 and AC-0162.
    expect(headers["x-api-key"]).toBe(ANTHROPIC_TEST_KEY);
    expect(headers.authorization).toBeUndefined();
    expect(JSON.stringify({ headers, body })).not.toContain(ANTHROPIC_TEST_AUTH_TOKEN);
    const squash = (text: string) => text.toLowerCase().replaceAll(/\s+/g, "");
    const machine = [
      os.hostname(),
      os.type(),
      os.platform(),
      `Other:${os.platform()}`,
      "macOS",
      "Windows",
      "Linux",
      os.arch(),
      process.version,
      process.version.replace(/^v/, ""),
      "MacOS",
      "FreeBSD",
      "OpenBSD",
      "iOS",
      "Android",
      "Unknown",
    ];
    for (const [name, value] of Object.entries(headers)) {
      for (const word of machine) expect(squash(value), `${name} holds ${word}`).not.toContain(squash(word));
    }
    expect(Object.keys(headers).filter((name) => name.startsWith("x-stainless"))).toEqual([]);
    expect(headers["user-agent"]).not.toMatch(/Anthropic/i);

    // AC-0098: the same system text for a different set of open alerts.
    await closeAlert(await alertIdOf("yield_anomaly"));
    await closeAlert(await alertIdOf("low_stock"));
    await query("delete from alert_digests");
    await openDigest(page);
    await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toBeVisible();
    const requests = await model.requests();
    expect(requests).toHaveLength(2);
    expect(requests[1]!.body.messages).not.toEqual(body.messages);
    expect(requests[1]!.body.system).toBe(body.system);
    expect(typeof body.system).toBe("string");
    expect(body.system.length).toBeGreaterThan(100);
  });

  test("AC-0099: the request holds none of the master data, the operator's email, the session, or the anon key", async ({
    page,
    context,
  }) => {
    await buildFiveAlertFixture({ today: appDate(), watch: false });
    await query(
      "update vendors set contact_name = 'Sentinel Contact', phone = '555-0199', email = 'sentinel@example.test', notes = 'sentinel vendor note'",
    );
    await query("update products set brand = 'Sentinel Brand'");
    await query("update lots set notes = 'sentinel lot note'");
    await query("update production_batches set notes = 'sentinel batch note'");
    await query("insert into customers(name) values ('Sentinel Customer')");
    await model.answer(FIVE_DIGEST);
    await openDigest(page);
    await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toBeVisible();
    const cookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
    expect(cookies.length).toBeGreaterThan(0);
    const session = readSession(cookies);
    const sentinels = [
      "Sentinel Contact",
      "555-0199",
      "sentinel@example.test",
      "sentinel vendor note",
      "Sentinel Brand",
      "sentinel lot note",
      "sentinel batch note",
      "Sentinel Customer",
      OPERATOR_EMAIL,
      resolveStackEnv().anonKey,
      session.access_token,
      session.refresh_token,
      ...cookies.map((cookie) => cookie.value),
    ];
    const [request] = await model.requests();
    const sent = JSON.stringify({ headers: request!.headers, body: request!.body });
    for (const sentinel of sentinels) expect(sent, sentinel.slice(0, 24)).not.toContain(sentinel);
  });

  test("AC-0110: a paragraph shows as literal text and adds no element", async ({ page }) => {
    await marginCase();
    await query("update products set description = '<b>9</b>' where id = $1", [PROD_502_ID]);
    await model.answer({ text: JSON.stringify({ paragraphs: ["Check 502 <b>9</b> first."] }) });
    await openDigest(page);
    await expect(digestRegion(page).getByText("Check 502 <b>9</b> first.", { exact: true })).toBeVisible();
    await expect(page.locator("main b")).toHaveCount(0);
  });

  test("AC-0003, AC-0004, AC-0124, AC-0125, AC-0084, AC-0198, AC-0204: replayed digest requests", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await marginCase();
    await model.answer(marginDigest());
    // The request the page sent on its own, as a replay would carry it.
    const sent = await captureAction(page, () => openDigest(page));
    await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toBeVisible();
    await query("delete from alert_digests");
    await model.reset();

    // A day with no row: no session or a non-operator's session changes nothing and sends nothing.
    const before = await alertsSnapshot();
    expect(await replayText(playwright, baseURL, sent, undefined)).toContain(DIGEST_SIGNED_OUT);
    expect(await replayText(playwright, baseURL, sent, NON_OPERATOR_STATE)).toContain(NOT_WRITTEN_NOT_ALLOWED);
    expect(await alertsSnapshot()).toEqual(before);
    expect(await model.requests()).toEqual([]);

    // AC-0084: a written day returns its digest and sends nothing.
    await seedDigest({ status: "written", paragraphs: ["Stored paragraph for today."] });
    expect(await replayText(playwright, baseURL, sent, OPERATOR_STATE)).toContain("Stored paragraph for today.");
    expect(await model.requests()).toEqual([]);

    // AC-0204: the page's own send for a failed day or an aged claim gets the page's message, with no request.
    const days: ReadonlyArray<[Parameters<typeof seedDigest>[0], string]> = [
      [{ status: "failed", kind: "service-error" }, TRY_AGAIN_DIGEST],
      [{ status: "failed", kind: "key-refused" }, KEY_REFUSED_DIGEST],
      [{ status: "writing", ageSeconds: 181 }, TRY_AGAIN_DIGEST],
      [{ status: "writing", ageSeconds: 100 }, BEING_WRITTEN],
    ];
    for (const [day, message] of days) {
      await query("delete from alert_digests");
      await seedDigest(day);
      const rows = await digestRows();
      expect(await replayText(playwright, baseURL, sent, OPERATOR_STATE), JSON.stringify(day)).toContain(message);
      expect(await digestRows(), JSON.stringify(day)).toEqual(rows);
      expect(await model.requests(), JSON.stringify(day)).toEqual([]);
    }

    // AC-0198: with no open alert the replay says so and stores nothing.
    await query("delete from alert_digests");
    await query("update alerts set status = 'dismissed', closed_at = now()");
    expect(await replayText(playwright, baseURL, sent, OPERATOR_STATE)).toContain("No open alerts.");
    expect(await digestRows()).toEqual([]);
    expect(await model.requests()).toEqual([]);
  });

  test("AC-0088, AC-0095, AC-0185, AC-0136, AC-0130: a refused key says so with Try again, a reload sends nothing, and Try again sends one request", async ({
    page,
  }) => {
    for (const status of [401, 403]) {
      await resetTestData();
      await model.reset();
      await marginCase();
      await model.answer({ status });
      await openDigest(page);
      await expect(digestRegion(page).getByText(KEY_REFUSED_DIGEST, { exact: true })).toBeVisible();
      await expect(tryAgain(page)).toBeVisible();
      await model.waitForRequests(1);
      expect(await digestRows(), String(status)).toEqual([{ status: "failed", paragraphs: null, failure_kind: "key-refused" }]);
    }
    // The page state after an AC-0088 outcome.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, "button Try again", `button ${RAISE_329}`, "button Dismiss"]);

    // AC-0095: a reload shows the same message and sends nothing.
    await page.reload();
    await expect(digestRegion(page).getByText(KEY_REFUSED_DIGEST, { exact: true })).toBeVisible();
    await expect(tryAgain(page)).toBeVisible();
    expect(await model.requests()).toHaveLength(1);

    // AC-0185 and AC-0136: Try again sends one request, and focus lands on the outcome's message.
    await model.answer({ status: 500 });
    // AC-0133: from the keyboard alone.
    await tryAgain(page).focus();
    await page.keyboard.press("Enter");
    await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true })).toBeVisible();
    await expect(digestRegion(page).locator("[tabindex='-1']")).toBeFocused();
    expect(await model.requests()).toHaveLength(2);
    expect(await digestRows()).toEqual([{ status: "failed", paragraphs: null, failure_kind: "service-error" }]);

    await model.answer(marginDigest());
    await tryAgain(page).click();
    await expect(digestRegion(page).getByText(DIGEST_FOOTER, { exact: true })).toBeVisible();
    await expect(digestRegion(page).locator("[tabindex='-1']")).toBeFocused();
    await expect(tryAgain(page)).toHaveCount(0);
    expect(await model.requests()).toHaveLength(3);
    expect((await digestRows())[0]?.status).toBe("written");
  });

  // Each way the digest request can end that AC-0090 names, but the 60 second wait.
  const FAILURES: ReadonlyArray<{ name: string; answer: FakeAnswer; kind: string }> = [
    { name: "an error status", answer: { status: 500 }, kind: "service-error" },
    { name: "a dropped connection", answer: { drop: true }, kind: "service-error" },
    {
      name: "a refusal",
      answer: { text: JSON.stringify({ paragraphs: ["502 is fine."] }), stop_reason: "refusal" },
      kind: "declined",
    },
    {
      name: "max_tokens",
      answer: { text: JSON.stringify({ paragraphs: ["502 is fine."] }), stop_reason: "max_tokens" },
      kind: "too-long",
    },
    { name: "an answer that is not JSON", answer: { text: "not json" }, kind: "unreadable" },
    { name: "an answer with the wrong shape", answer: { text: JSON.stringify({ lines: [] }) }, kind: "unreadable" },
    {
      name: "seven paragraphs",
      answer: { text: JSON.stringify({ paragraphs: Array.from({ length: 7 }, () => "502 again.") }) },
      kind: "unreadable",
    },
    { name: "an empty paragraph", answer: { text: JSON.stringify({ paragraphs: ["  "] }) }, kind: "unreadable" },
    {
      name: "a number the facts do not hold",
      answer: marginDigest("The 502 margin is 1.8%, below your 20% target. Aim for 3.30."),
      kind: "unfaithful",
    },
    { name: "a missing product code", answer: { text: JSON.stringify({ paragraphs: ["All is well."] }) }, kind: "unfaithful" },
  ];

  test("AC-0090, AC-0095, AC-0130: each way the request fails says the digest wasn't written, offers Try again, and leaves the day failed", async ({
    page,
  }) => {
    for (const failure of FAILURES) {
      await resetTestData();
      await model.reset();
      await marginCase();
      await model.answer(failure.answer);
      await openDigest(page);
      await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true }), failure.name).toBeVisible();
      await expect(tryAgain(page), failure.name).toBeVisible();
      await expect(digestRegion(page).getByText(DIGEST_FOOTER), failure.name).toHaveCount(0);
      expect(await model.requests(), failure.name).toHaveLength(1);
      expect(await digestRows(), failure.name).toEqual([{ status: "failed", paragraphs: null, failure_kind: failure.kind }]);
      // AC-0095: a reload shows the message again and sends nothing.
      await page.reload();
      await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true }), failure.name).toBeVisible();
      await expect(tryAgain(page), failure.name).toBeVisible();
      expect(await model.requests(), failure.name).toHaveLength(1);
    }
    // The page state after an AC-0090 outcome.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, "button Try again", `button ${RAISE_329}`, "button Dismiss"]);
  });

  test("AC-0090: no answer within 60 seconds ends the wait with the same message", async ({ page }) => {
    test.setTimeout(150_000);
    await marginCase();
    await model.answer({ hold: true, then: marginDigest() });
    await openDigest(page);
    await expect(digestRegion(page).locator("[role=status]", { hasText: WRITING_DIGEST })).toBeVisible();
    await model.waitForRequests(1);
    await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(tryAgain(page)).toBeVisible();
    expect(await digestRows()).toEqual([{ status: "failed", paragraphs: null, failure_kind: "no-answer" }]);
    expect(await model.requests()).toHaveLength(1);
  });

  test("AC-0090: an answer that starts but never finishes also ends the wait at 60 seconds", async ({ page }) => {
    test.setTimeout(150_000);
    await marginCase();
    await model.answer({ stallAfterHeaders: true });
    await openDigest(page);
    await model.waitForRequests(1);
    await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true })).toBeVisible({ timeout: 90_000 });
    await expect(tryAgain(page)).toBeVisible();
    expect(await digestRows()).toEqual([{ status: "failed", paragraphs: null, failure_kind: "no-answer" }]);
    expect(await model.requests()).toHaveLength(1);
  });

  test("AC-0090, AC-0089: a refused store of the paragraphs says the digest wasn't written and leaves the day writing", async ({
    page,
  }) => {
    await marginCase();
    await model.answer(marginDigest());
    await query("revoke execute on function public.finish_digest(date, text[], text) from authenticated");
    try {
      await openDigest(page);
      await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true })).toBeVisible();
      await expect(tryAgain(page)).toBeVisible();
      await expect(digestRegion(page).getByText(DIGEST_FOOTER)).toHaveCount(0);
      expect(await model.requests()).toHaveLength(1);
      expect(await digestRows()).toEqual([{ status: "writing", paragraphs: null, failure_kind: null }]);
    } finally {
      await query("grant execute on function public.finish_digest(date, text[], text) to authenticated");
    }
    // With the claim fresh, a reload says another write is in progress and sends nothing.
    await page.reload();
    await expect(digestRegion(page).getByText(BEING_WRITTEN, { exact: true })).toBeVisible();
    expect(await model.requests()).toHaveLength(1);
  });

  test("AC-0089, AC-0199, AC-0185: a fresh claim says it is being written; an aged one offers Try again, which sends one request", async ({
    page,
  }) => {
    await marginCase();
    await seedDigest({ status: "writing", ageSeconds: 100 });
    await openDigest(page);
    await expect(digestRegion(page).getByText(BEING_WRITTEN, { exact: true })).toBeVisible();
    await expect(tryAgain(page)).toHaveCount(0);
    expect(await model.requests()).toEqual([]);
    // The page state with a claim being written.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, `button ${RAISE_329}`, "button Dismiss"]);

    await query("update alert_digests set claimed_at = now() - interval '181 seconds'");
    await page.reload();
    await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true })).toBeVisible();
    await expect(tryAgain(page)).toBeVisible();
    expect(await model.requests()).toEqual([]);
    // The page state after an AC-0199 outcome.
    expect(await checkPageState(page)).toEqual([...NAV_CONTROLS, "button Try again", `button ${RAISE_329}`, "button Dismiss"]);

    await model.answer(marginDigest());
    await tryAgain(page).click();
    await expect(digestRegion(page).getByText(DIGEST_FOOTER, { exact: true })).toBeVisible();
    expect(await model.requests()).toHaveLength(1);
    expect((await digestRows())[0]?.status).toBe("written");
  });

  test("AC-0096: a digest stored for yesterday only does not stop today's request", async ({ page }) => {
    await marginCase();
    await seedDigest({ status: "written", date: appDate(-1), paragraphs: ["Yesterday's digest."] });
    await model.answer(marginDigest());
    await openDigest(page);
    await expect(digestRegion(page).getByText(DIGEST_FOOTER, { exact: true })).toBeVisible();
    await expect(page.getByText("Yesterday's digest.")).toHaveCount(0);
    expect(await model.requests()).toHaveLength(1);
  });

  test("AC-0190: a digest that reaches the model sends one request, also for 429, 500, 529, and a dropped connection", async ({
    page,
  }) => {
    const answers: ReadonlyArray<[string, FakeAnswer]> = [
      ["429", { status: 429 }],
      ["500", { status: 500 }],
      ["529", { status: 529 }],
      ["a drop", { drop: true }],
    ];
    for (const [name, answer] of answers) {
      await resetTestData();
      await model.reset();
      await marginCase();
      await model.answer(answer, marginDigest());
      await openDigest(page);
      await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true }), name).toBeVisible();
      await page.waitForTimeout(500);
      expect(await model.requests(), name).toHaveLength(1);
    }
  });

  test("AC-0205: after the page's own send fails, leaving and pressing Back sends no further request", async ({ page }) => {
    await marginCase();
    await model.answer({ status: 500 }, marginDigest());
    await openDigest(page);
    await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true })).toBeVisible();
    await model.waitForRequests(1);
    await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Receiving" }).click();
    await expect(page).toHaveURL(/\/receiving$/);
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Alerts" })).toBeVisible();
    await expect(digestRegion(page).getByText(TRY_AGAIN_DIGEST, { exact: true })).toBeVisible();
    await page.waitForTimeout(1000);
    expect(await model.requests()).toHaveLength(1);
    expect(await digestRows()).toEqual([{ status: "failed", paragraphs: null, failure_kind: "service-error" }]);
  });
});
