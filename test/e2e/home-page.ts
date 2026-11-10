import { expect, type Locator, type Page } from "@playwright/test";
import {
  callAsOperator,
  CUSTOMER_ID,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  reverseCall,
  VENDOR_ID,
  voidReceiptCall,
  voidSaleCall,
  type OpCall,
} from "../db";
import { formatWeight } from "../../src/lib/format";
import { appDate } from "./app-time";

// What the "Today" specs share: finding the sections, tiles, and entries, building the spec's data
// through the operations (never a write to a table test/db.ts protects), and the layout checks.
// Every name and figure is made up. The pg pool stays open: every spec in this worker shares it.

export const SECTIONS = ["Sales and stock value", "Open alerts", "Today's entries", "Stock on hand"] as const;
export const TILES = ["Today's sales", "Raw stock at cost", "Finished stock at cost", "All stock at cost"] as const;

export async function openToday(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
}

export function section(page: Page, name: (typeof SECTIONS)[number]): Locator {
  return page.getByRole("region", { name, exact: true });
}

// The four tiles' figures, read from the tile each label names.
export async function tileValues(page: Page): Promise<string[]> {
  const sales = section(page, "Sales and stock value");
  const shown: string[] = [];
  for (const label of TILES) {
    const tile = sales.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) });
    await expect(tile).toHaveCount(1);
    shown.push(((await tile.locator("dd").textContent()) ?? "").trim());
  }
  return shown;
}

// The text of each open alert's title, in the order shown.
export async function alertTitlesShown(page: Page): Promise<string[]> {
  const titles = await section(page, "Open alerts").getByRole("listitem").allTextContents();
  return titles.map((title) => title.trim());
}

export type ListName = "Receipts" | "Batches" | "Sales";

export function listHeading(page: Page, name: ListName, count: number): Locator {
  return section(page, "Today's entries").getByRole("heading", { level: 3, name: `${name} (${count})`, exact: true });
}

export interface Shown {
  number: string;
  lbs: string;
  product: string;
  // The lines after the product: a sale's customer, then a "Voided" or "Reversed" tag.
  rest: string[];
}

export async function entriesShown(page: Page, name: ListName): Promise<Shown[]> {
  const list = section(page, "Today's entries").getByRole("list", { name: new RegExp(`^${name} \\(`) });
  const rows: Shown[] = [];
  for (const item of await list.getByRole("listitem").all()) {
    const [number = "", lbs = "", product = "", ...rest] = (await item.locator(":scope > span").allTextContents()).map(
      (text) => text.trim(),
    );
    rows.push({ number, lbs, product, rest });
  }
  return rows;
}

export interface StockShown {
  code: string;
  description: string;
  lbs: string;
}

export async function stockShown(page: Page): Promise<StockShown[]> {
  const rows: StockShown[] = [];
  for (const item of await section(page, "Stock on hand").getByRole("listitem").all()) {
    const [code = "", description = "", lbs = ""] = (await item.locator(":scope > span").allTextContents()).map(
      (text) => text.trim(),
    );
    rows.push({ code, description, lbs });
  }
  return rows;
}

// ---- Data, through the operations ----

async function run(call: OpCall): Promise<string> {
  const outcome = await callAsOperator(call);
  expect(outcome.ok, `${call.fn}: ${outcome.error}`).toBe(true);
  return idOf(outcome);
}

export const receive = (productId: string, lbs: number | string, cost: number | string, daysAgo = 0) =>
  run(receiveCall(productId, VENDOR_ID, lbs, cost, appDate(-daysAgo)));
export const produce = (rawLbs: number | string, finishedLbs: number | string | null = null, daysAgo = 0) =>
  run(produceCall(PROD_502_ID, rawLbs, finishedLbs, appDate(-daysAgo)));
export const sell = (lbs: number | string, price: number | string, daysAgo = 0, customerId: string | null = null) =>
  run({
    fn: "record_sale",
    args: {
      p_finished_product_id: PROD_502_ID,
      p_lbs: lbs,
      p_price_per_lb: price,
      p_customer_id: customerId,
      p_sale_date: appDate(-daysAgo),
    },
  });
export const voidSale = (saleId: string) => run(voidSaleCall(saleId));
export const voidReceipt = (lotId: string) => run(voidReceiptCall(lotId));
export const reverseBatch = (batchId: string) => run(reverseCall(batchId));
export { CUSTOMER_ID, PROD_502_ID, RAW_TOM_ID };

// AC-0012's data, dated the app's today: RAW-TOM receipts of 1,000 lbs at 1.68 and 500 lbs at 1.80, a
// batch of 502 from 400 raw lbs (308 finished lbs at 2.6318), and sales of 100 lbs at 3.29 and 50 lbs at
// 3.50, plus a sale of 10 lbs at 3.00 that is voided.
export async function worked(): Promise<void> {
  await receive(RAW_TOM_ID, 1000, 1.68);
  await receive(RAW_TOM_ID, 500, 1.8);
  await produce(400);
  await sell(100, 3.29);
  await sell(50, 3.5);
  await voidSale(await sell(10, 3.0));
}

// ---- Read-backs ----

export async function numberOf(table: "lots" | "production_batches" | "sales", id: string): Promise<string> {
  const column = { lots: "lot_number", production_batches: "batch_number", sales: "sale_number" }[table];
  const [row] = await query<{ n: string }>(`select ${column} as n from public.${table} where id = $1`, [id]);
  return String(row?.n);
}

// What a receipt, batch, or sale should show, from the rows the operations wrote.
export async function expectedReceipt(id: string): Promise<Shown> {
  const [row] = await query<{ n: string; w: string; code: string; description: string; voided: boolean }>(
    `select l.lot_number as n, l.current_weight_lbs::text as w, p.code, p.description, l.voided_at is not null as voided
     from lots l join products p on p.id = l.product_id where l.id = $1`,
    [id],
  );
  return {
    number: row!.n,
    lbs: formatWeight(Number(row!.w)),
    product: `${row!.code} ${row!.description}`,
    rest: row!.voided ? ["Voided"] : [],
  };
}

export async function expectedBatch(id: string): Promise<Shown> {
  const [row] = await query<{ n: string; w: string; code: string; description: string; reversed: boolean }>(
    `select b.batch_number as n, b.finished_lbs_out::text as w, p.code, p.description, b.reversed_at is not null as reversed
     from production_batches b join products p on p.id = b.finished_product_id where b.id = $1`,
    [id],
  );
  return {
    number: row!.n,
    lbs: formatWeight(Number(row!.w)),
    product: `${row!.code} ${row!.description}`,
    rest: row!.reversed ? ["Reversed"] : [],
  };
}

export async function expectedSale(id: string): Promise<Shown> {
  const [row] = await query<{
    n: string;
    w: string;
    code: string;
    description: string;
    customer: string | null;
    voided: boolean;
  }>(
    `select sale_number as n, lbs_sold::text as w, finished_code as code, finished_product as description, customer,
            voided_at is not null as voided
     from v_sale_summary where sale_id = $1`,
    [id],
  );
  return {
    number: row!.n,
    lbs: formatWeight(Number(row!.w)),
    product: `${row!.code} ${row!.description}`,
    rest: [row!.customer ?? "No customer", ...(row!.voided ? ["Voided"] : [])],
  };
}

// ---- Refusing a read ----

// Withdraws the operator's read of the daily sales view (AC-0035). Restore it in a finally and in afterEach.
export async function revokeDailySalesRead(): Promise<void> {
  await query("revoke select on public.v_daily_sales from authenticated");
}

// Grants only when the read is missing: a GRANT makes PostgREST reload its schema cache.
export async function restoreDailySalesRead(): Promise<void> {
  const [row] = await query<{ granted: boolean }>(
    "select has_table_privilege('authenticated', 'public.v_daily_sales', 'select') as granted",
  );
  if (!row?.granted) await query("grant select on public.v_daily_sales to authenticated");
}

// ---- Layout ----

export const WIDTHS = [390, 1024, 1280] as const;
export const TEXT_SIZES = [16, 20] as const;

// Sets the viewport and the root text size, then waits two frames so container queries have settled.
export async function setLook(page: Page, width: number, px: number): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate((size) => {
    document.documentElement.style.fontSize = `${size}px`;
  }, px);
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
}

// Each located value is on one line, does not run past its own box, and sits inside the tile or card
// that holds it.
export async function expectWhole(values: Locator, what: string, least: number): Promise<void> {
  const found = await values.evaluateAll((elements) =>
    elements.map((element) => {
      const holder = element.closest("li, dl > div")!.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()];
      return {
        text: element.textContent ?? "",
        lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
        spill: element.scrollWidth - element.clientWidth,
        inside:
          rects.length > 0 &&
          Math.min(...rects.map((rect) => rect.left)) >= holder.left - 0.5 &&
          Math.max(...rects.map((rect) => rect.right)) <= holder.right + 0.5,
      };
    }),
  );
  expect(found.length, `${what}: values found`).toBeGreaterThanOrEqual(least);
  expect(found.filter((one) => one.lines !== 1 || one.spill > 1 || !one.inside), what).toEqual([]);
}

export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
    view: document.documentElement.clientWidth,
  }));
  expect(widths.page, "the page's scroll width").toBeLessThanOrEqual(widths.view);
  expect(widths.body, "the body's scroll width").toBeLessThanOrEqual(widths.view);
}

// The four sections in source order, by heading.
export async function sectionOrderInSource(page: Page): Promise<string[]> {
  return (await page.locator("main section > h2").allTextContents()).map((text) => text.trim());
}

// Each section starts below the one before it, or on the same row to its right.
export async function expectSectionsFlow(page: Page): Promise<void> {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  for (const name of SECTIONS) {
    const found = await section(page, name).boundingBox();
    expect(found, `${name} box`).not.toBeNull();
    boxes.push(found!);
  }
  boxes.slice(1).forEach((next, index) => {
    const before = boxes[index]!;
    const below = next.y >= before.y + before.height - 1;
    const rightOnRow = next.x >= before.x + before.width - 1 && next.y >= before.y - 1 && next.y < before.y + before.height;
    expect(below || rightOnRow, `${SECTIONS[index + 1]} follows ${SECTIONS[index]}`).toBe(true);
  });
}
