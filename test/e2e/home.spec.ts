import { expect, test, type Locator } from "@playwright/test";
import { buildFiveAlertFixture } from "../alert-fixtures";
import { callAsOperator, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, seedInvoiceFixture, VENDOR_ID } from "../db";
import { formatWeight } from "../../src/lib/format";
import { banner, groupTitles, marginCase, opens, withWatchRefused, WATCH_FAILED } from "./alerts-page";
import { appDate } from "./app-time";
import {
  alertTitlesShown,
  CUSTOMER_ID,
  entriesShown,
  expectedBatch,
  expectedReceipt,
  expectedSale,
  expectNoSidewaysScroll,
  expectSectionsFlow,
  expectWhole,
  listHeading,
  numberOf,
  openToday,
  produce,
  receive,
  restoreDailySalesRead,
  reverseBatch,
  revokeDailySalesRead,
  section,
  SECTIONS,
  sectionOrderInSource,
  sell,
  setLook,
  stockShown,
  TEXT_SIZES,
  tileValues,
  voidReceipt,
  voidSale,
  WIDTHS,
  worked,
} from "./home-page";
import { OPERATOR_EMAIL } from "../users";
import { NON_OPERATOR_STATE, OPERATOR_STATE, signInThroughForm } from "./states";

// "Today" at `/`, end to end: a real browser over the production build and the local database. Every
// receipt, batch, and sale goes through the operations, dated from the app's today (test/e2e/app-time.ts);
// a product and its active flag are master data. Each test opens `/` directly.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

test.afterEach(async () => {
  await restoreDailySalesRead();
});

const FIGURES = ["$0.00", "$0.00", "$0.00", "$0.00"];

test.describe("access", () => {
  test.describe("a signed-in non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0003: / shows the not-allowed page and none of the sections", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Not allowed" })).toBeVisible();
      for (const name of SECTIONS) await expect(section(page, name)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: "Today" })).toHaveCount(0);
    });
  });
});

test.describe("sales and stock value", () => {
  test("AC-0014: AC-0012's receipts, batch, and sales dated today give four tiles", async ({ page }) => {
    await worked();
    await openToday(page);
    expect(await tileValues(page)).toEqual(["$504.00", "$1,908.00", "$415.82", "$2,323.82"]);
  });

  test("AC-0013: no sale dated today, or only voided ones, reads $0.00 in Today's sales", async ({ page }) => {
    await receive(RAW_TOM_ID, 2000, 1.68, 3);
    await produce(400, null, 2);
    // A sale dated yesterday and none today.
    await sell(100, 3.29, 1);
    await openToday(page);
    expect((await tileValues(page))[0]).toBe("$0.00");
    // A sale dated today that is then voided.
    await voidSale(await sell(40, 3.5));
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    const tiles = await tileValues(page);
    expect(tiles[0]).toBe("$0.00");
    expect(tiles[1], "stock still counts").not.toBe("$0.00");
  });

  test("AC-0027: with no lot and no finished good, each stock tile reads $0.00", async ({ page }) => {
    await openToday(page);
    expect(await tileValues(page)).toEqual(FIGURES);
  });
});

test.describe("open alerts", () => {
  test("AC-0004, AC-0026: with open alerts the titles run in /alerts order and See alerts links to /alerts", async ({
    page,
  }) => {
    await buildFiveAlertFixture({ today: appDate(), watch: false });
    await opens(page);
    const expected = [...(await groupTitles(page, "Urgent")), ...(await groupTitles(page, "Other alerts"))];
    expect(expected.length, "five alerts").toBe(5);

    await openToday(page);
    expect(await alertTitlesShown(page)).toEqual(expected);
    const link = section(page, "Open alerts").getByRole("link", { name: "See alerts", exact: true });
    await expect(link).toHaveAttribute("href", "/alerts");
    await expect(banner(page)).toHaveCount(0);
    await link.click();
    await expect(page).toHaveURL(/\/alerts$/);
  });

  test("AC-0005, AC-0026: with no open alerts the section reads No open alerts. and still links to /alerts", async ({
    page,
  }) => {
    await openToday(page);
    const alerts = section(page, "Open alerts");
    await expect(alerts.getByText("No open alerts.", { exact: true })).toBeVisible();
    await expect(alerts.getByRole("listitem")).toHaveCount(0);
    await expect(alerts.getByRole("link", { name: "See alerts", exact: true })).toHaveAttribute("href", "/alerts");
  });

  test("AC-0021, AC-0022: when the watch fails the section reads Alerts couldn't be checked. and no Urgent alerts region shows", async ({
    page,
  }) => {
    await buildFiveAlertFixture({ today: appDate(), watch: true });
    await withWatchRefused(async () => {
      await openToday(page);
      const alerts = section(page, "Open alerts");
      await expect(alerts.getByText(WATCH_FAILED, { exact: true })).toBeVisible();
      await expect(alerts.getByRole("listitem")).toHaveCount(0);
      await expect(alerts.getByText("No open alerts.")).toHaveCount(0);
      await expect(alerts.getByRole("link", { name: "See alerts", exact: true })).toBeVisible();
      await expect(banner(page)).toHaveCount(0);
    });
  });
});

test.describe("today's entries", () => {
  test("AC-0007, AC-0008: each list holds the day's entries only, newest first, with their values and tags", async ({
    page,
  }) => {
    await seedInvoiceFixture();
    const chickenId = "55555555-5555-5555-5555-555555555555";
    await receive(RAW_TOM_ID, 3000, 1.68, 1);
    const day = [
      await receive(RAW_TOM_ID, 1000, 1.68),
      await receive(chickenId, 500, 2.1),
      await receive(RAW_TOM_ID, 12.5, 1.7),
    ];
    await voidReceipt(day[1]!);
    const yesterdayBatch = await produce(100, null, 1);
    const batches = [await produce(400), await produce(150, 100), await produce(120)];
    await reverseBatch(batches[2]!);
    const yesterdaySale = await sell(10, 3.29, 1);
    const sales = [await sell(25, 3.29, 0, CUSTOMER_ID), await sell(30.5, 3.4), await sell(12, 3.0, 0, CUSTOMER_ID)];
    await voidSale(sales[2]!);

    await openToday(page);
    await expect(listHeading(page, "Receipts", 3)).toBeVisible();
    await expect(listHeading(page, "Batches", 3)).toBeVisible();
    await expect(listHeading(page, "Sales", 3)).toBeVisible();

    const newestFirst = <T>(ids: T[]): T[] => [...ids].reverse();
    expect(await entriesShown(page, "Receipts")).toEqual(await Promise.all(newestFirst(day).map(expectedReceipt)));
    expect(await entriesShown(page, "Batches")).toEqual(await Promise.all(newestFirst(batches).map(expectedBatch)));
    expect(await entriesShown(page, "Sales")).toEqual(await Promise.all(newestFirst(sales).map(expectedSale)));

    // The tags: Voided on the voided receipt and sale, Reversed on the reversed batch, none elsewhere.
    expect((await entriesShown(page, "Receipts")).map((row) => row.rest)).toEqual([[], ["Voided"], []]);
    expect((await entriesShown(page, "Batches")).map((row) => row.rest)).toEqual([["Reversed"], [], []]);
    expect((await entriesShown(page, "Sales")).map((row) => row.rest)).toEqual([
      ["Fulton Market Deli", "Voided"],
      ["No customer"],
      ["Fulton Market Deli"],
    ]);

    // Nothing dated another day.
    const entries = (await section(page, "Today's entries").textContent()) ?? "";
    expect(entries).not.toContain(await numberOf("production_batches", yesterdayBatch));
    expect(entries).not.toContain(await numberOf("sales", yesterdaySale));
    const [yesterdayLot] = await query<{ lot_number: string }>("select lot_number from lots where received_date = $1", [
      appDate(-1),
    ]);
    expect(entries).not.toContain(yesterdayLot!.lot_number);
  });

  test("AC-0009, AC-0031: counts in the headings and None today. in an empty list", async ({ page }) => {
    await receive(RAW_TOM_ID, 1000, 1.68, 2);
    await receive(RAW_TOM_ID, 800, 1.7);
    await receive(RAW_TOM_ID, 700, 1.72);
    await produce(400, null, 1);
    await sell(50, 3.29);
    await openToday(page);
    await expect(listHeading(page, "Receipts", 2)).toBeVisible();
    await expect(listHeading(page, "Batches", 0)).toBeVisible();
    await expect(listHeading(page, "Sales", 1)).toBeVisible();
    const entries = section(page, "Today's entries");
    await expect(entries.getByText("None today.", { exact: true })).toHaveCount(1);
    expect(await entriesShown(page, "Batches")).toEqual([]);
    // The one empty list is Batches: its heading's block holds the line.
    const batchesBlock = entries
      .locator("div")
      .filter({ has: page.getByRole("heading", { level: 3, name: "Batches (0)", exact: true }) })
      .last();
    await expect(batchesBlock.getByText("None today.", { exact: true })).toBeVisible();
  });
});

test.describe("stock on hand", () => {
  test("AC-0010: every active product and every inactive one with stock, with its lbs from the balances and finished goods", async ({
    page,
  }) => {
    await seedInvoiceFixture();
    const holdId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1";
    const finishedId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3";
    await query(
      `insert into products(id, code, description, species, kind, active) values ($1, 'RAW-HOLD', 'Held Wings (raw)', 'Turkey', 'raw', true)`,
      [holdId],
    );
    await query(
      `insert into products(id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct)
       values ($1, '503', 'Smoked Turkey Wings', 'Prospect Meats', 'Turkey', 'finished', '56cs/pl', 32.5, $2, 0.2300)`,
      [finishedId, RAW_TOM_ID],
    );
    await query(
      `insert into product_fees(product_id, fee_type_id, amount_per_lb)
       select $1, fee_type_id, amount_per_lb from product_fees where product_id = $2`,
      [finishedId, PROD_502_ID],
    );
    await receive(RAW_TOM_ID, 2000, 1.68);
    const heldLot = await callAsOperator(receiveCall(holdId, VENDOR_ID, 340.5, 1.2, appDate()));
    expect(heldLot.ok, heldLot.error).toBe(true);
    await produce(400);
    const wings = await callAsOperator({
      fn: "produce_batch",
      args: { p_finished_product_id: finishedId, p_raw_lbs_in: 200, p_finished_lbs_out: null, p_production_date: appDate() },
    });
    expect(wings.ok, wings.error).toBe(true);
    // Two inactive products: RAW-HOLD and 503 still hold stock; RAW-OLD (from the invoice fixture) holds none.
    await query("update products set active = false where id in ($1, $2)", [holdId, finishedId]);

    const expected = await query<{ code: string; description: string; active: boolean; lbs: string }>(
      `select p.code, p.description, p.active,
              case p.kind
                when 'raw' then coalesce((select ib.qty_on_hand from inventory_balances ib where ib.product_id = p.id), 0)
                else coalesce((select sum(fg.lbs_remaining) from finished_goods fg where fg.finished_product_id = p.id), 0)
              end::text as lbs
       from products p`,
    );
    const listed = expected
      .filter((row) => row.active || Number(row.lbs) > 0)
      .map((row) => ({ code: row.code, description: row.description, lbs: formatWeight(Number(row.lbs)) }));
    expect(listed.map((row) => row.code).sort(), "the inactive ones that hold stock are in, RAW-OLD is out").toEqual(
      ["502", "503", "RAW-CHK", "RAW-HOLD", "RAW-TOM"],
    );

    await openToday(page);
    const byCode = (a: { code: string }, b: { code: string }) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
    expect([...(await stockShown(page))].sort(byCode)).toEqual([...listed].sort(byCode));
    // An active raw product with no balance row shows 0 lbs.
    expect((await stockShown(page)).find((row) => row.code === "RAW-CHK")?.lbs).toBe("0 lbs");
  });

  test("AC-0032: with no product to list the section reads No stock on hand.", async ({ page }) => {
    await query("truncate product_fees, products restart identity cascade");
    await openToday(page);
    await expect(section(page, "Stock on hand").getByText("No stock on hand.", { exact: true })).toBeVisible();
    await expect(section(page, "Stock on hand").getByRole("listitem")).toHaveCount(0);
    expect(await tileValues(page)).toEqual(FIGURES);
  });
});

test.describe("layout", () => {
  test("AC-0030: the four sections run in order in the source and on screen at each width and text size", async ({
    page,
  }) => {
    await buildFiveAlertFixture({ today: appDate(), watch: false });
    await produce(100);
    await sell(10, 3.29);
    await openToday(page);
    await expect(section(page, "Open alerts").getByRole("listitem")).toHaveCount(5);
    await expect(listHeading(page, "Sales", 1)).toBeVisible();

    for (const width of WIDTHS) {
      for (const px of TEXT_SIZES) {
        await setLook(page, width, px);
        const at = `${width} px at ${px} px text`;
        expect(await sectionOrderInSource(page), `source order at ${at}`).toEqual([...SECTIONS]);
        await expectSectionsFlow(page);
        for (const name of SECTIONS) {
          const spill = await section(page, name).evaluate((node) => node.scrollWidth - node.clientWidth);
          expect(spill, `${name} spill at ${at}`).toBeLessThanOrEqual(1);
        }
        // The two lower sections share a row only where their shared container fits both: the
        // default text size at 1280 px.
        const entries = await section(page, "Today's entries").boundingBox();
        const stock = await section(page, "Stock on hand").boundingBox();
        const sameRow = stock!.x >= entries!.x + entries!.width - 1;
        expect(sameRow, `Stock on hand beside Today's entries at ${at}`).toBe(width === 1280 && px === 16);
      }
    }
  });

  test("AC-0016, AC-0028: long values stay whole on one line and the page does not scroll sideways", async ({
    page,
  }) => {
    await receive(RAW_TOM_ID, 1800000, 1.68);
    await receive(RAW_TOM_ID, "1234567.891", 1.68);
    await produce(1800000, "1386000.123");
    await sell("1000000.123", 3.5);

    await openToday(page);
    expect(await tileValues(page)).toEqual(["$3,500,000.43", "$2,074,074.06", "$1,015,874.80", "$3,089,948.86"]);
    const stockLbs = (await stockShown(page)).find((row) => row.code === "RAW-TOM")?.lbs;
    expect(stockLbs).toBe("1,234,567.891 lbs");
    expect((await entriesShown(page, "Receipts")).map((row) => row.lbs)).toEqual(["1,234,567.891 lbs", "1,800,000 lbs"]);
    expect((await entriesShown(page, "Batches")).map((row) => row.lbs)).toEqual(["1,386,000.123 lbs"]);
    expect((await entriesShown(page, "Sales")).map((row) => row.lbs)).toEqual(["1,000,000.123 lbs"]);

    const entries = section(page, "Today's entries");
    const stock = section(page, "Stock on hand");
    for (const width of WIDTHS) {
      for (const px of TEXT_SIZES) {
        await setLook(page, width, px);
        const at = `${width} px at ${px} px text`;
        await expectWhole(section(page, "Sales and stock value").locator("dd"), `money figures at ${at}`, 4);
        await expectWhole(entries.locator("li > span:nth-child(1)"), `entry numbers at ${at}`, 4);
        await expectWhole(entries.locator("li > span:nth-child(2)"), `entry lbs at ${at}`, 4);
        await expectWhole(stock.locator("li > span:nth-child(3)"), `stock lbs at ${at}`, 2);
        await expectNoSidewaysScroll(page);
      }
    }
  });
});

test.describe("a read that fails", () => {
  test("AC-0035: a refused read shows the error view headed Today with Try again and no money tile", async ({ page }) => {
    await worked();
    await revokeDailySalesRead();
    try {
      await page.goto("/");
      await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
      await expect(page.getByText("Today's sales", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Raw stock at cost", { exact: true })).toHaveCount(0);
      await expect(section(page, "Sales and stock value")).toHaveCount(0);
    } finally {
      await restoreDailySalesRead();
    }
  });
});

test.describe("getting to Today", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: signing in as an operator through the form ends on / headed Today", async ({ page }) => {
      await signInThroughForm(page, OPERATOR_EMAIL);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
    });
  });

  // The side menu's and the phone menu's Primary navigation, each checked for its first link.
  async function expectTodayFirst(nav: Locator): Promise<void> {
    const links = nav.getByRole("link");
    await expect(links.first()).toHaveText("Today");
    await expect(links.first()).toHaveAttribute("href", "/");
    await expect(links.nth(1)).toHaveText("Receiving");
    await expect(links.first()).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current]")).toHaveCount(1);
  }

  test("AC-0002, AC-0025: at 390 px the phone menu lists Today first and marks it current on /", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await openToday(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(menu).toBeVisible();
    await expectTodayFirst(menu.getByRole("navigation", { name: "Primary" }));
  });

  test("AC-0002, AC-0025: at 1280 px the side menu lists Today first and marks it current on /", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openToday(page);
    await expectTodayFirst(page.getByRole("complementary", { name: "Side menu" }).getByRole("navigation", { name: "Primary" }));
  });
});

test.describe("the urgent banner", () => {
  test("AC-0006: with one urgent alert open, the Urgent alerts region is absent on / and /alerts and present on the eight other pages the menus list", async ({
    page,
  }) => {
    await marginCase();
    await openToday(page);
    await expect(banner(page), "/").toHaveCount(0);
    await opens(page);
    await expect(banner(page), "/alerts").toHaveCount(0);
    for (const path of ["/receiving", "/production", "/menu", "/pricing", "/sales", "/trace", "/invoices", "/ask"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
      await expect(banner(page), path).toHaveCount(1);
    }
  });
});

test.describe("the urgent count on Today", () => {
  // The badge is aria-hidden, so it is found by that attribute inside the link.
  const badge = (link: Locator) => link.locator('span[aria-hidden="true"]');

  test("AC-0023: at 390 px the top bar's and the phone menu's Alerts links show the urgent count", async ({ page }) => {
    await marginCase();
    await page.setViewportSize({ width: 390, height: 800 });
    await openToday(page);
    const top = page.getByRole("link", { name: "Alerts, 1 urgent", exact: true });
    await expect(badge(top)).toHaveText("1");
    await page.getByRole("button", { name: "Open menu" }).click();
    const inMenu = page.getByRole("dialog", { name: "Menu" }).getByRole("link", { name: "Alerts", exact: true });
    await expect(badge(inMenu)).toHaveText("1");
  });

  test("AC-0023: at 1280 px the side menu's Alerts link shows the urgent count", async ({ page }) => {
    await marginCase();
    await page.setViewportSize({ width: 1280, height: 800 });
    await openToday(page);
    const side = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: "Alerts", exact: true });
    await expect(badge(side)).toHaveText("1");
  });
});
