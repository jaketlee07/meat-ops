import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { saleSaveFailureMessage } from "../src/lib/failures.js";
import { recordSale } from "../src/lib/rpc.js";
import { getFinishedOnHand, listCustomers, listRecentSales, listSaleProducts } from "../src/lib/sales.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { findLots, getLotTrace, getSaleTrace, listSaleLots, PAGE_SIZE, readAllPages } from "../src/lib/trace.js";
import {
  assertLedgerInvariants,
  callAsClient,
  callAsOperator,
  closePool,
  CUSTOMER_ID,
  idOf,
  type OpCall,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  saleFixture,
  VALLEY_ID,
  VENDOR_ID,
  voidReceiptCall,
  voidSaleCall,
} from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0098
it("AC-0098: a sale's trace lists its finished lots and their raw lots in draw order", async () => {
  await query("insert into vendors(id, name) values ($1, 'Valley Poultry')", [VALLEY_ID]);
  for (const call of [
    receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"),
    receiveCall(RAW_TOM_ID, VALLEY_ID, 3000, 1.8, "2026-10-05"),
    produceCall(PROD_502_ID, 6000, null, "2026-10-06"),
    produceCall(PROD_502_ID, 1000, null, "2026-10-07"),
    {
      fn: "record_sale" as const,
      args: {
        p_finished_product_id: PROD_502_ID,
        p_lbs: 5000,
        p_price_per_lb: 3.29,
        p_customer_id: CUSTOMER_ID,
        p_sale_date: "2026-10-08",
        p_sale_number: "S-5000",
      },
    },
  ]) {
    expect((await callAsClient(operator, call)).ok).toBe(true);
  }
  const trace = await getSaleTrace(operator, "S-5000");
  expect(trace?.lots.map((lot) => [lot.productionDate, lot.lbsSold])).toEqual([
    ["2026-10-06", 4620],
    ["2026-10-07", 380],
  ]);
  expect(trace?.lots.map((lot) => lot.rawLots.map((raw) => [raw.vendor, raw.lbsDrawn]))).toEqual([
    [
      ["Reyes Meats", 5000],
      ["Valley Poultry", 1000],
    ],
    [["Valley Poultry", 1000]],
  ]);
});

async function run(call: OpCall): Promise<string> {
  const outcome = await callAsOperator(call);
  if (!outcome.ok) throw new Error(`${call.fn}: ${outcome.error}`);
  return idOf(outcome);
}

const sellCall = (
  lbs: number,
  date: string,
  customer: string | null,
  number: string,
  product = PROD_502_ID,
): OpCall => ({
  fn: "record_sale",
  args: {
    p_finished_product_id: product,
    p_lbs: lbs,
    p_price_per_lb: 3.29,
    p_customer_id: customer,
    p_sale_date: date,
    p_sale_number: number,
  },
});

async function numberOf(table: "lots" | "production_batches", id: string): Promise<string> {
  const col = table === "lots" ? "lot_number" : "batch_number";
  return String((await query(`select ${col} as n from public.${table} where id = $1`, [id]))[0]?.n);
}

async function finishedOnHand(): Promise<number> {
  return Number((await query("select sum(lbs_remaining)::float8 as n from finished_goods"))[0]?.n);
}

it("listSaleProducts gives active finished products in code order; listCustomers ignores case", async () => {
  await saleFixture({ listPrice: true });
  const products = await listSaleProducts(operator);
  const codes = products.map((p) => p.code);
  expect(codes).toEqual([...codes].sort());
  expect(codes).not.toContain((await query("select code from products where id = $1", [RAW_TOM_ID]))[0]?.code);
  const p502 = products.find((p) => p.productId === PROD_502_ID);
  expect(p502?.listPricePerLb).toBe(3.29);
  expect(p502?.finishedLbsAvailable).toBe(5390);
  expect(await getFinishedOnHand(operator, PROD_502_ID)).toBe(5390);
  await query("update products set active = false where id = $1", [PROD_502_ID]);
  expect(await getFinishedOnHand(operator, PROD_502_ID)).toBeNull();

  await query("insert into customers(name) values ('banana co'), ('Apple Co'), ('cherry co'), ('BLUEBERRY co')");
  const names = (await listCustomers(operator)).map((c) => c.name);
  expect(names.filter((n) => /^(banana|Apple|cherry|BLUEBERRY)/.test(n))).toEqual([
    "Apple Co",
    "banana co",
    "BLUEBERRY co",
    "cherry co",
  ]);
});

it("AC-0070, AC-0071, AC-0074: the recent sales are the last 10 entered, void ones included", async () => {
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
  await run(produceCall(PROD_502_ID, 2000, null, "2026-10-01"));
  const ids: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const date = i === 12 ? "2026-10-02" : "2026-10-05";
    ids.push(await run(sellCall(1, date, i % 2 ? CUSTOMER_ID : null, `T-${String(i).padStart(2, "0")}`)));
  }
  await run(voidSaleCall(ids[4]!));
  const { sales, total } = await listRecentSales(operator);
  expect(total).toBe(12);
  expect(sales.map((s) => s.saleNumber)).toEqual(
    Array.from({ length: 10 }, (_, k) => `T-${String(12 - k).padStart(2, "0")}`),
  );
  expect(sales[0]?.saleDate).toBe("2026-10-02");
  expect(sales[0]?.customer).toBeNull();
  expect(sales.find((s) => s.saleNumber === "T-05")?.voidedAt).not.toBeNull();
  expect(sales.find((s) => s.saleNumber === "T-05")?.voidReason).toBe("wrong customer");
});

it("AC-0043: a sale's finished lots list by production date, then entry order", async () => {
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 10000, 1.68, "2026-10-01"));
  const late = await run(produceCall(PROD_502_ID, 100, null, "2026-10-07"));
  const early1 = await run(produceCall(PROD_502_ID, 100, null, "2026-10-06"));
  const early2 = await run(produceCall(PROD_502_ID, 100, null, "2026-10-06"));
  const saleId = await run(sellCall(await finishedOnHand(), "2026-10-08", CUSTOMER_ID, "S-ALL"));
  const trace = await getSaleTrace(operator, "S-ALL");
  const expected = [early1, early2, late].map((id) => numberOf("production_batches", id));
  expect(trace?.lots.map((lot) => lot.batchNumber)).toEqual(await Promise.all(expected));
  expect((await listSaleLots(operator, saleId)).map((lot) => lot.batchNumber)).toEqual(
    await Promise.all(expected),
  );
});

it("AC-0100: a finished lot's raw lots list by received date, then entry order", async () => {
  const later = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.8, "2026-10-05"));
  const earlier = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-10-01"));
  await run(produceCall(PROD_502_ID, 1500, null, "2026-10-06"));
  await run(sellCall(await finishedOnHand(), "2026-10-08", CUSTOMER_ID, "S-RAW"));
  const trace = await getSaleTrace(operator, "S-RAW");
  expect(trace?.lots).toHaveLength(1);
  expect(trace?.lots[0]?.rawLots.map((raw) => raw.lotNumber)).toEqual([
    await numberOf("lots", earlier),
    await numberOf("lots", later),
  ]);
});

it("a void sale traces to its summary and no lots; an unknown number gives null", async () => {
  const fx = await saleFixture({ sale: true });
  await run(voidSaleCall(fx.saleId!));
  const trace = await getSaleTrace(operator, "S-5000");
  expect(trace?.sale.voidedAt).not.toBeNull();
  expect(trace?.lots).toEqual([]);
  expect(await getSaleTrace(operator, "NO-SUCH")).toBeNull();
});

it("AC-0110, AC-0112: findLots chooses the 10 latest by date then entry, with the total", async () => {
  const dates = [
    "2026-09-10", "2026-09-20", "2026-09-05", "2026-09-20", "2026-09-15", "2026-09-01",
    "2026-09-25", "2026-09-12", "2026-09-30", "2026-09-02", "2026-09-18", "2026-09-08",
  ];
  const numbers: string[] = [];
  for (const d of dates) numbers.push(await numberOf("lots", await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 1.5, d))));
  const voided = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 1.5, "2026-09-29"));
  await run(voidReceiptCall(voided));
  const code = String((await query("select code from products where id = $1", [RAW_TOM_ID]))[0]?.code);

  const found = await findLots(operator, code);
  const expected = dates
    .map((d, i) => ({ d, i }))
    .sort((a, b) => b.d.localeCompare(a.d) || b.i - a.i)
    .slice(0, 10)
    .map((e) => numbers[e.i]);
  expect(found?.lots.map((l) => l.lotNumber)).toEqual(expected);
  expect(found?.total).toBe(12);
  expect(found?.lots[0]).toMatchObject({ receivedDate: "2026-09-30", vendor: "Reyes Meats", weightLbs: 100 });

  const dated = await findLots(operator, code, "2026-09-20");
  expect(dated?.lots.map((l) => l.lotNumber)).toEqual([numbers[3], numbers[1]]);
  expect(dated?.total).toBe(2);

  await query("update products set active = false where id = $1", [RAW_TOM_ID]);
  expect((await findLots(operator, code))?.total).toBe(12);
  const finishedCode = String((await query("select code from products where id = $1", [PROD_502_ID]))[0]?.code);
  expect(await findLots(operator, finishedCode)).toBeNull();
});

it("AC-0122, AC-0124: a lot's customers and sales, in screen order", async () => {
  const fx = await saleFixture();
  await query("insert into customers(id, name) values ('66666666-6666-6666-6666-666666666666', 'Zeta Foods'), ('77777777-7777-7777-7777-777777777777', 'Mid Co')");
  const ZETA = "66666666-6666-6666-6666-666666666666";
  await run(sellCall(10, "2026-10-08", CUSTOMER_ID, "L-1"));
  await run(sellCall(10, "2026-10-09", CUSTOMER_ID, "L-2"));
  await run(sellCall(10, "2026-10-09", ZETA, "L-3"));
  await run(sellCall(10, "2026-10-07", null, "L-4"));
  const mid = await run(sellCall(10, "2026-10-10", "77777777-7777-7777-7777-777777777777", "L-5"));
  await run(voidSaleCall(mid));
  const trace = await getLotTrace(operator, fx.lotBNumber);
  expect(trace?.customers.map((c) => c.name)).toEqual(["Fulton Market Deli", "Zeta Foods"]);
  expect(trace?.hasNoCustomer).toBe(true);
  expect(trace?.sales.map((s) => s.saleNumber)).toEqual(["L-3", "L-2", "L-1", "L-4"]);
  expect(trace?.sales.map((s) => s.customer)).toEqual(["Zeta Foods", "Fulton Market Deli", "Fulton Market Deli", null]);
});

it("AC-0125, AC-0129, AC-0130: a lot's sale lines and finished stock", async () => {
  const fx = await saleFixture();
  const before = (id: string) => getLotTrace(operator, id);
  const b1 = await numberOf("production_batches", fx.batch1Id);
  const b2 = await numberOf("production_batches", fx.batch2Id);
  expect((await before(fx.lotBNumber))?.finishedStock.map((s) => [s.batchNumber, s.lbsRemaining])).toEqual([
    [b1, 4620],
    [b2, 770],
  ]);
  expect((await before(fx.lotANumber))?.finishedStock.map((s) => [s.batchNumber, s.lbsRemaining])).toEqual([[b1, 4620]]);
  expect((await before(fx.lotBNumber))?.sales).toEqual([]);

  await run(sellCall(5000, "2026-10-08", CUSTOMER_ID, "S-5000"));
  const lotB = await before(fx.lotBNumber);
  expect(lotB?.sales.map((s) => [s.saleNumber, s.batchNumber, s.lbsSold])).toEqual([
    ["S-5000", b1, 4620],
    ["S-5000", b2, 380],
  ]);
  expect(lotB?.finishedStock.map((s) => [s.batchNumber, s.lbsRemaining])).toEqual([[b2, 390]]);
  expect((await before(fx.lotANumber))?.sales.map((s) => [s.saleNumber, s.batchNumber, s.lbsSold])).toEqual([
    ["S-5000", b1, 4620],
  ]);
  expect(lotB?.lot).toMatchObject({ vendor: "Valley Poultry", weightLbs: 3000, costPerLb: 1.8, voidedAt: null });
  expect(await getLotTrace(operator, "NO-SUCH-LOT")).toBeNull();
});

it("AC-0135: a lot's trace returns every sale line past max_rows", async () => {
  const maxRows = Number(/^max_rows\s*=\s*(\d+)/m.exec(readFileSync("supabase/config.toml", "utf8"))?.[1]);
  expect(maxRows).toBeGreaterThan(0);
  const lot = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
  await run(produceCall(PROD_502_ID, 2000, null, "2026-10-01"));
  const oldest = (await query<{ id: string }>("insert into customers(name) values ('Oldest Co') returning id"))[0]!.id;
  for (let i = 0; i <= maxRows; i++) {
    await run(sellCall(1, "2026-10-08", i === 0 ? oldest : CUSTOMER_ID, `B-${String(i).padStart(5, "0")}`));
  }
  const trace = await getLotTrace(operator, await numberOf("lots", lot));
  expect(trace?.sales).toHaveLength(maxRows + 1);
  expect(new Set(trace?.sales.map((s) => s.saleNumber)).size).toBe(maxRows + 1);
  expect(trace?.sales.at(-1)).toMatchObject({ saleNumber: "B-00000", customer: "Oldest Co" });
  expect(trace?.customers.map((c) => c.name)).toContain("Oldest Co");
}, 600_000);

const fakePages = (countFor: (call: number) => number) => {
  let calls = 0;
  const read = async (from: number, to: number) => {
    const count = countFor(calls++);
    const rows = Array.from({ length: Math.max(0, Math.min(to + 1, count) - from) }, (_, k) => ({
      sale_item_id: `item-${from + k}`,
    }));
    return { rows, count };
  };
  return { read, calls: () => calls };
};

it("AC-0135: a count that changes between pages is read once more, then throws", async () => {
  const pages = fakePages((call) => 600 + call);
  await expect(readAllPages(pages.read)).rejects.toThrow();
  expect(pages.calls()).toBe(4);
  expect(PAGE_SIZE).toBeLessThan(600);
});

it("AC-0135: a repeated sale line key at a stable count is read once more, then throws", async () => {
  let calls = 0;
  const read = async (from: number, to: number) => {
    calls++;
    const rows = Array.from({ length: Math.max(0, Math.min(to + 1, 600) - from) }, (_, k) => ({
      sale_item_id: `item-${(from + k) % 5}`,
    }));
    return { rows, count: 600 };
  };
  await expect(readAllPages(read)).rejects.toThrow("the sale lines changed while they were being read");
  expect(calls).toBe(2 * Math.ceil(600 / PAGE_SIZE));
});

it("AC-0135: a repeat with a stable count returns its set", async () => {
  const pages = fakePages((call) => (call === 1 ? 601 : 600));
  const rows = await readAllPages(pages.read);
  expect(rows).toHaveLength(600);
  expect(pages.calls()).toBe(4);
});

it("a real shortfall refusal gets the engine's wording from saleSaveFailureMessage", async () => {
  await saleFixture();
  let caught: unknown;
  try {
    await recordSale(operator, {
      finishedProductId: PROD_502_ID,
      lbs: 5000,
      pricePerLb: 3.29,
      customerId: CUSTOMER_ID,
      saleDate: "2026-10-06",
      saleNumber: "S-SHORT",
    });
  } catch (error) {
    caught = error;
  }
  expect(saleSaveFailureMessage(caught, "write")).toBe(
    "The sale wasn't saved. Only 4,620 lbs of finished stock made on or before Oct 6, 2026 is on hand, and this sale needs 5,000 lbs.",
  );
});
