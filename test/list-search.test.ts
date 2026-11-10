import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  escapeForImatch,
  parseListSearch,
  quoteForOr,
  type ListSearch,
} from "../src/lib/list-search.js";
import { listRecentBatches } from "../src/lib/production.js";
import { listRecentReceipts } from "../src/lib/receiving.js";
import { listRecentSales } from "../src/lib/sales.js";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsClient,
  callAsOperator,
  closePool,
  correctCall,
  CUSTOMER_ID,
  idOf,
  inOperatorTransaction,
  type OpCall,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  reverseCall,
  VENDOR_ID,
  voidReceiptCall,
  voidSaleCall,
} from "./db.js";
import { signInOperator } from "./users.js";

// Every name, number, and figure in this file is made up. The reads run against the local stack, seeded only
// through the operations and the master-data inserts the other suites use (vendors, customers).

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

const LONG = { timeout: 180_000 };

// The search a page would build from its address.
const searchOf = (q: string, date?: string, rows?: string): ListSearch => parseListSearch({ q, date, rows });

// ---- The address parser and the match values (pure) ----

describe("the address parser and the match values", () => {
  const letters = (n: number, letter = "a") => letter.repeat(n);

  it("AC-0011: white space at the start and end of the text is ignored, as trim removes it", () => {
    expect(parseListSearch({ q: "  abc  " }).text).toBe("abc");
    expect(parseListSearch({ q: "\tabc " }).text).toBe("abc");
    expect(parseListSearch({ q: "   " }).text).toBe("");
    expect(parseListSearch({ q: "a  b" }).text).toBe("a  b");
    expect(parseListSearch({}).text).toBe("");
    expect(parseListSearch({ q: ["a", "b"] }).text).toBe("");
  });

  it("AC-0015: NULs go, the text is trimmed, cut to 100 code units without splitting a pair, and trimmed again", () => {
    expect(parseListSearch({ q: "a\u0000b" }).text).toBe("ab");
    expect(parseListSearch({ q: "\u0000 \u0000x\u0000" }).text).toBe("x");
    // 3 spaces and 100 letters: trimmed first, so all 100 letters stay.
    expect(parseListSearch({ q: `   ${letters(100)}` }).text).toBe(letters(100));
    // 99 letters, a space, and a letter: the cut at 100 ends on the space, and the second trim removes it.
    expect(parseListSearch({ q: `${letters(99)} b` }).text).toBe(letters(99));
    expect(parseListSearch({ q: letters(150) }).text).toBe(letters(100));
    // An emoji across the cut (units 99 and 100) is dropped whole; one inside the 100 stays.
    expect(parseListSearch({ q: `${letters(99)}\u{1F600}` }).text).toBe(letters(99));
    expect(parseListSearch({ q: `${letters(98)}\u{1F600}` }).text).toBe(`${letters(98)}\u{1F600}`);
    expect(parseListSearch({ q: `${letters(98)}\u{1F600}b` }).text).toBe(`${letters(98)}\u{1F600}`);
    expect(parseListSearch({ q: "\\".repeat(100) }).text).toBe("\\".repeat(100));
  });

  it("AC-0016: a date counts only as a real yyyy-mm-dd day with a year from 0100 to 9999", () => {
    const dateOf = (date: unknown) => parseListSearch({ date }).date;
    expect(dateOf("2026-11-10")).toBe("2026-11-10");
    expect(dateOf("0100-01-01")).toBe("0100-01-01");
    expect(dateOf("9999-12-31")).toBe("9999-12-31");
    for (const bad of [
      "2026-02-30",
      "0000-01-01",
      "0099-12-31",
      "11/10/2026",
      "10000-01-01",
      "2026-1-1",
      "2026-11-10 ",
      "2026-11-10\n",
      "",
      undefined,
      ["2026-11-10"],
    ]) {
      expect(dateOf(bad), String(bad)).toBeNull();
    }
  });

  it("AC-0017: a row count in digits alone counts from 10 to 50; anything else counts as 10", () => {
    const rowsOf = (rows: unknown) => parseListSearch({ rows }).rows;
    expect(rowsOf("10")).toBe(10);
    expect(rowsOf("25")).toBe(25);
    expect(rowsOf("50")).toBe(50);
    expect(rowsOf("51")).toBe(50);
    expect(rowsOf("1000000")).toBe(50);
    expect(rowsOf("99999999999999999999")).toBe(50);
    expect(rowsOf("0050")).toBe(50);
    expect(rowsOf("9")).toBe(10);
    expect(rowsOf("0")).toBe(10);
    expect(rowsOf("000")).toBe(10);
    expect(rowsOf("010")).toBe(10);
    for (const bad of ["5", "-5", "+20", "20.0", "1e21", "20\n", " 20", "", "٢٠", undefined, ["20"]]) {
      expect(rowsOf(bad), String(bad)).toBe(10);
    }
  });

  it("AC-0009: the match values escape the regular-expression specials, and quote for or()", () => {
    expect(escapeForImatch("a.b*c")).toBe("a\\.b\\*c");
    expect(escapeForImatch("\\.^$*+?()[]{}|")).toBe("\\\\\\.\\^\\$\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|");
    expect(escapeForImatch('a,"b"')).toBe('a,"b"');
    expect(quoteForOr('a,"b"\\')).toBe('"a,\\"b\\"\\\\\\\\"');
    expect(quoteForOr("")).toBe('""');
  });
});

// ---- Shared seeding ----

async function run(call: OpCall): Promise<string> {
  const outcome = await callAsOperator(call);
  if (!outcome.ok) throw new Error(`${call.fn}: ${outcome.error}`);
  return idOf(outcome);
}

// For the calls that carry a lot, batch, or sale number or a note; the helper's parameter list does not.
async function runClient(call: OpCall): Promise<void> {
  const outcome = await callAsClient(operator, call);
  if (!outcome.ok) throw new Error(`${call.fn}: ${outcome.error}`);
}

async function newVendor(name: string): Promise<string> {
  const rows = await query("insert into vendors(name) values ($1) returning id", [name]);
  return String(rows[0]?.id);
}

async function newCustomer(name: string): Promise<string> {
  const rows = await query("insert into customers(name) values ($1) returning id", [name]);
  return String(rows[0]?.id);
}

const receiveWith = (
  vendor: string,
  lotNumber: string | null,
  date = "2026-05-12",
  notes: string | null = null,
  weight = 100,
): OpCall => ({
  fn: "receive_lot",
  args: {
    p_product_id: RAW_TOM_ID,
    p_vendor_id: vendor,
    p_weight_lbs: weight,
    p_unit_cost: 1.5,
    p_received: date,
    p_lot_number: lotNumber,
    p_notes: notes,
  },
});

const produceWith = (batchNumber: string | null, rawLbs = 10, date = "2026-05-20", notes: string | null = null): OpCall => ({
  fn: "produce_batch",
  args: {
    p_finished_product_id: PROD_502_ID,
    p_raw_lbs_in: rawLbs,
    p_finished_lbs_out: null,
    p_production_date: date,
    p_batch_number: batchNumber,
    p_notes: notes,
  },
});

const sellWith = (
  number: string | null,
  customer: string | null,
  date = "2026-10-08",
  lbs = 1,
): OpCall => ({
  fn: "record_sale",
  args: {
    p_finished_product_id: PROD_502_ID,
    p_lbs: lbs,
    p_price_per_lb: 3.29,
    p_customer_id: customer,
    p_sale_date: date,
    p_sale_number: number,
  },
});

// Raw stock for the batch and sale seeds.
async function stockRaw(lbs = 20000): Promise<void> {
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, 1.5, "2026-01-01"));
}

// Finished stock for the sale seeds.
async function stockFinished(): Promise<void> {
  await stockRaw();
  await run(produceCall(PROD_502_ID, 10000, null, "2026-02-01"));
}

const lotNumbersOf = (r: { receipts: { lotNumber: string }[] }) => r.receipts.map((x) => x.lotNumber);
const batchNumbersOf = (r: { batches: { batchNumber: string }[] }) => r.batches.map((x) => x.batchNumber);
const saleNumbersOf = (r: { sales: { saleNumber: string }[] }) => r.sales.map((x) => x.saleNumber);

// ---- AC-0009: each character matches only itself ----

const SPECIALS = Array.from({ length: 94 }, (_, i) => String.fromCharCode(33 + i)).filter((c) => !/[A-Za-z0-9]/.test(c));

interface Case {
  search: string;
  hits: string[];
}

const ACCENTED = ["QÉZ Foods", "Qéz Foods"];
const CASES: Case[] = [
  ...SPECIALS.map((c) => ({ search: `q${c}z`, hits: [`Q${c}Z Foods`] })),
  { search: "q z", hits: ["Q Z Foods"] },
  { search: "qéz", hits: ACCENTED },
  { search: "qÉz", hits: ACCENTED },
  { search: "50% off", hits: ["50% Off Meats"] },
  { search: "A_B", hits: ["A_B Foods"] },
  { search: "star*", hits: ["Star*Market"] },
  { search: "h, J", hits: ["Smith, Jones (Co)"] },
];
const DECOYS = [
  "QZ Foods",
  "QQZ Foods",
  "QxZ Foods",
  "Q9Z Foods",
  "QxxZ Foods",
  "500 Off Meats",
  "AXB Foods",
  "StarXMarket",
  "Smith Jones Co",
];
const NAMES = [...new Set([...CASES.flatMap((c) => c.hits), ...DECOYS])];

it("AC-0009: in Recent receipts each character of a search text matches only itself, in any letter case", LONG, async () => {
  // Per name: one receipt whose vendor holds it (lot V-<n>) and one whose lot number is it (vendor Reyes Meats).
  for (const [n, name] of NAMES.entries()) {
    await runClient(receiveWith(await newVendor(name), `V-${n}`));
    await runClient(receiveWith(VENDOR_ID, name));
  }
  for (const c of CASES) {
    const expected = c.hits.flatMap((h) => [`V-${NAMES.indexOf(h)}`, h]).sort();
    const found = await listRecentReceipts(operator, RAW_TOM_ID, searchOf(c.search));
    expect(lotNumbersOf(found).sort(), c.search).toEqual(expected);
    expect(found.total, c.search).toBe(expected.length);
  }
});

it("AC-0009: in Recent batches each character of a search text matches only itself, in any letter case", LONG, async () => {
  await stockRaw();
  for (const name of NAMES) await runClient(produceWith(name));
  for (const c of CASES) {
    const found = await listRecentBatches(operator, PROD_502_ID, searchOf(c.search));
    expect(batchNumbersOf(found).sort(), c.search).toEqual([...c.hits].sort());
    expect(found.total, c.search).toBe(c.hits.length);
  }
});

it("AC-0009: in Recent sales each character of a search text matches only itself, in any letter case", LONG, async () => {
  await stockFinished();
  // Per name: one sale whose number is it and one whose customer is it (number S-<n>).
  for (const [n, name] of NAMES.entries()) {
    await runClient(sellWith(name, null));
    await runClient(sellWith(`S-${n}`, await newCustomer(name)));
  }
  for (const c of CASES) {
    const expected = c.hits.flatMap((h) => [`S-${NAMES.indexOf(h)}`, h]).sort();
    const found = await listRecentSales(operator, searchOf(c.search));
    expect(saleNumbersOf(found).sort(), c.search).toEqual(expected);
    expect(found.total, c.search).toBe(expected.length);
  }
});

// ---- AC-0012: filter syntax is text, and only the searched columns match ----

const syntaxTexts = (column: string) => [
  `x",${column}.not.is.null,${column}.eq."`,
  `x),${column}.not.is.null,or(${column}.eq.y`,
];
const MARK = "ZQMARK";

it("AC-0012: in Recent receipts filter syntax matches as written, and unsearched text matches nothing", LONG, async () => {
  for (const [i, text] of syntaxTexts("lot_number").entries()) {
    await runClient(receiveWith(VENDOR_ID, `PLAIN-${i}`));
    await runClient(receiveWith(VENDOR_ID, text));
    await runClient(receiveWith(await newVendor(text), `VEND-${i}`));
  }
  for (const [i, text] of syntaxTexts("lot_number").entries()) {
    const found = await listRecentReceipts(operator, RAW_TOM_ID, searchOf(text));
    expect(lotNumbersOf(found).sort(), text).toEqual([text, `VEND-${i}`].sort());
    expect(found.total, text).toBe(2);
  }

  // The marker sits only in a receipt's notes, a void reason, and a correction reason.
  await runClient(receiveWith(VENDOR_ID, "NOTED", "2026-05-12", `${MARK} notes`));
  const voided = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 1.5));
  await run(voidReceiptCall(voided, `${MARK} void`));
  const corrected = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 1.5));
  await run(correctCall(corrected, 1.6, 100, `${MARK} correction`));
  await runClient(receiveWith(VENDOR_ID, `${MARK}-LOT`));
  const found = await listRecentReceipts(operator, RAW_TOM_ID, searchOf(MARK));
  expect(lotNumbersOf(found)).toEqual([`${MARK}-LOT`]);
  expect(found.total).toBe(1);
});

it("AC-0012: in Recent batches filter syntax matches as written, and unsearched text matches nothing", LONG, async () => {
  await stockRaw();
  for (const [i, text] of syntaxTexts("batch_number").entries()) {
    await runClient(produceWith(`PLAIN-${i}`));
    await runClient(produceWith(text));
  }
  for (const text of syntaxTexts("batch_number")) {
    const found = await listRecentBatches(operator, PROD_502_ID, searchOf(text));
    expect(batchNumbersOf(found), text).toEqual([text]);
    expect(found.total, text).toBe(1);
  }

  // The marker sits only in a batch's notes and its reversal reason.
  await runClient(produceWith("NOTED", 10, "2026-05-20", `${MARK} notes`));
  const reversed = await run(produceCall(PROD_502_ID, 10, null, "2026-05-20"));
  await run(reverseCall(reversed, `${MARK} reversal`));
  await runClient(produceWith(`${MARK}-BATCH`));
  const found = await listRecentBatches(operator, PROD_502_ID, searchOf(MARK));
  expect(batchNumbersOf(found)).toEqual([`${MARK}-BATCH`]);
  expect(found.total).toBe(1);
});

it("AC-0012: in Recent sales filter syntax matches as written, and unsearched text matches nothing", LONG, async () => {
  await stockFinished();
  for (const [i, text] of syntaxTexts("sale_number").entries()) {
    await runClient(sellWith(`PLAIN-${i}`, null));
    await runClient(sellWith(text, null));
    await runClient(sellWith(`CUST-${i}`, await newCustomer(text)));
  }
  for (const [i, text] of syntaxTexts("sale_number").entries()) {
    const found = await listRecentSales(operator, searchOf(text));
    expect(saleNumbersOf(found).sort(), text).toEqual([text, `CUST-${i}`].sort());
    expect(found.total, text).toBe(2);
  }

  // The marker sits only in a sale's void reason.
  const voided = await run(sellWith("TO-VOID", CUSTOMER_ID));
  await run(voidSaleCall(voided, `${MARK} void`));
  await runClient(sellWith(`${MARK}-SALE`, null));
  const found = await listRecentSales(operator, searchOf(MARK));
  expect(saleNumbersOf(found)).toEqual([`${MARK}-SALE`]);
  expect(found.total).toBe(1);
});

// ---- Order and paging ----

const dayBefore = (n: number) => new Date(Date.UTC(2026, 8, 30 - n)).toISOString().slice(0, 10);

async function seedReceipts(): Promise<string[]> {
  for (let i = 0; i < 25; i++) await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 1.5, dayBefore(i)));
  const rows = await query("select lot_number, received_date::text as d from lots where product_id = $1 order by receipt_seq", [
    RAW_TOM_ID,
  ]);
  const dates = rows.map((r) => String(r.d));
  expect(
    dates.length === 25 && dates.every((d, i) => i === 0 || d < String(dates[i - 1])),
    "seed property: each later receipt is dated earlier than the one entered before it",
  ).toBe(true);
  return rows.map((r) => String(r.lot_number)).reverse();
}

async function seedBatches(): Promise<string[]> {
  await stockRaw();
  for (let i = 0; i < 25; i++) await run(produceCall(PROD_502_ID, 10, null, dayBefore(i)));
  const rows = await query(
    `select pb.batch_number, pb.production_date::text as d
     from finished_goods fg join production_batches pb on pb.id = fg.batch_id
     where fg.finished_product_id = $1 order by fg.produced_seq`,
    [PROD_502_ID],
  );
  const dates = rows.map((r) => String(r.d));
  expect(
    dates.length === 25 && dates.every((d, i) => i === 0 || d < String(dates[i - 1])),
    "seed property: each later batch is dated earlier than the one entered before it",
  ).toBe(true);
  return rows.map((r) => String(r.batch_number)).reverse();
}

it("AC-0018: Recent receipts order their matches latest entered first", LONG, async () => {
  const expected = await seedReceipts();
  const found = await listRecentReceipts(operator, RAW_TOM_ID, searchOf("", undefined, "50"));
  expect(lotNumbersOf(found)).toEqual(expected);
  expect(found.total).toBe(25);
});

it("AC-0018: Recent batches order their matches latest entered first", LONG, async () => {
  const expected = await seedBatches();
  const found = await listRecentBatches(operator, PROD_502_ID, searchOf("", undefined, "50"));
  expect(batchNumbersOf(found)).toEqual(expected);
  expect(found.total).toBe(25);
});

it("AC-0023: a 20-row read of Recent receipts starts with the 10-row read's rows, in order", LONG, async () => {
  await seedReceipts();
  const ten = await listRecentReceipts(operator, RAW_TOM_ID, searchOf("", undefined, "10"));
  const twenty = await listRecentReceipts(operator, RAW_TOM_ID, searchOf("", undefined, "20"));
  expect(ten.receipts).toHaveLength(10);
  expect(twenty.receipts).toHaveLength(20);
  expect(lotNumbersOf(twenty).slice(0, 10)).toEqual(lotNumbersOf(ten));
});

it("AC-0023: a 20-row read of Recent batches starts with the 10-row read's rows, in order", LONG, async () => {
  await seedBatches();
  const ten = await listRecentBatches(operator, PROD_502_ID, searchOf("", undefined, "10"));
  const twenty = await listRecentBatches(operator, PROD_502_ID, searchOf("", undefined, "20"));
  expect(ten.batches).toHaveLength(10);
  expect(twenty.batches).toHaveLength(20);
  expect(batchNumbersOf(twenty).slice(0, 10)).toEqual(batchNumbersOf(ten));
});

it("AC-0023: a 20-row read of Recent sales starts with the 10-row read's rows, ties in descending sale_id order", LONG, async () => {
  await stockFinished();
  // 25 sales in one transaction share one created_at; 14 carry the newest sale date, so the 10th row sits in that group.
  await inOperatorTransaction(async (call) => {
    for (let i = 0; i < 25; i++) {
      const date = i < 14 ? "2026-10-20" : `2026-10-${String(19 - (i - 14)).padStart(2, "0")}`;
      const outcome = await call(sellWith(`TIE-${String(i).padStart(2, "0")}`, null, date));
      if (!outcome.ok) throw new Error(outcome.error);
    }
  });
  const stamps = await query("select count(distinct created_at)::int as n from v_sale_summary");
  expect(Number(stamps[0]?.n), "seed property: all 25 sales share one created_at").toBe(1);
  const newest = await query("select count(*)::int as n from v_sale_summary where sale_date = '2026-10-20'");
  expect(Number(newest[0]?.n), "seed property: at least 12 sales share the newest sale date").toBeGreaterThanOrEqual(12);

  const ten = await listRecentSales(operator, searchOf("", undefined, "10"));
  const twenty = await listRecentSales(operator, searchOf("", undefined, "20"));
  expect(ten.sales).toHaveLength(10);
  expect(twenty.sales).toHaveLength(20);
  expect(saleNumbersOf(twenty).slice(0, 10)).toEqual(saleNumbersOf(ten));
  const dates = twenty.sales.map((s) => s.saleDate);
  expect(dates).toEqual([...dates].sort().reverse());
  const tied = twenty.sales.filter((s) => s.saleDate === "2026-10-20").map((s) => s.id);
  expect(tied).toHaveLength(14);
  expect(tied).toEqual([...tied].sort().reverse());
});

it("AC-0046: Recent sales order by sale date, then by entry time, newest first", LONG, async () => {
  // Pair 1: the sale entered second has the earlier date, so only sale_date puts it below the other.
  // Pair 2: one sale date; the sale entered second has the smaller sale_id, so only created_at puts it above.
  // Sale ids are random, so the second pair's id property holds about half the time: start again from the reset helper.
  let order: string[] | null = null;
  for (let attempt = 0; attempt < 20 && order === null; attempt++) {
    await resetTestData();
    await stockFinished();
    const p1a = await run(sellWith("P1-A", null, "2026-10-10"));
    const p1b = await run(sellWith("P1-B", null, "2026-10-05"));
    const p2a = await run(sellWith("P2-A", null, "2026-10-12"));
    const p2b = await run(sellWith("P2-B", null, "2026-10-12"));
    const rows = await query(
      "select sale_number, sale_date::text as d, created_at::text as c, sale_id::text as id from v_sale_summary",
    );
    const by = (n: string) => rows.find((r) => r.sale_number === n);
    expect(new Set(rows.map((r) => r.c)).size, "seed property: the four sales have four different entry times").toBe(4);
    expect(String(by("P1-B")?.d) < String(by("P1-A")?.d), "seed property: pair 1's second sale has the earlier date").toBe(true);
    expect(by("P2-A")?.d, "seed property: pair 2 shares one sale date").toBe(by("P2-B")?.d);
    expect([p1a, p1b, p2a, p2b]).toEqual([by("P1-A")?.id, by("P1-B")?.id, by("P2-A")?.id, by("P2-B")?.id]);
    if (String(p2b) < String(p2a)) order = ["P2-B", "P2-A", "P1-A", "P1-B"];
  }
  expect(order, "seed property: pair 2's second sale has the smaller sale_id (20 tries)").not.toBeNull();
  const found = await listRecentSales(operator, searchOf("", undefined, "10"));
  expect(saleNumbersOf(found)).toEqual(order);
});

// ---- AC-0029: the vendor limit ----

it("AC-0029: 100 matching vendors list their receipts, a 101st gives the too-many result, and an empty text lists all", LONG, async () => {
  const slashes = "\\".repeat(100);
  const day = (i: number) => `2026-10-0${(i % 5) + 1}`;
  const addVendorReceipt = async (i: number) => {
    await run(receiveCall(RAW_TOM_ID, await newVendor(`${slashes}${String(i).padStart(3, "0")}`), 100, 1.5, day(i)));
  };
  for (let i = 0; i < 100; i++) await addVendorReceipt(i);

  const longest = searchOf(slashes, undefined, "50");
  expect(longest.text).toBe(slashes);
  const hundred = await listRecentReceipts(operator, RAW_TOM_ID, longest);
  expect(hundred.tooManyVendors).toBeUndefined();
  expect(hundred.receipts).toHaveLength(50);
  expect(hundred.total).toBe(100);

  await addVendorReceipt(100);
  const tooMany = await listRecentReceipts(operator, RAW_TOM_ID, longest);
  expect(tooMany.tooManyVendors).toBe(true);
  expect(tooMany.receipts).toEqual([]);
  expect(tooMany.total).toBe(0);

  // An empty or white-space-only text reads no vendors, with or without a date.
  const latest = async (date: string | null, rows: number) =>
    (
      await query(
        `select lot_number from lots where product_id = $1 ${date ? "and received_date = $3" : ""}
         order by receipt_seq desc limit $2`,
        date ? [RAW_TOM_ID, rows, date] : [RAW_TOM_ID, rows],
      )
    ).map((r) => String(r.lot_number));
  for (const q of ["", "   ", "\t  "]) {
    const noDate = await listRecentReceipts(operator, RAW_TOM_ID, searchOf(q));
    expect(noDate.tooManyVendors, JSON.stringify(q)).toBeUndefined();
    expect(lotNumbersOf(noDate), JSON.stringify(q)).toEqual(await latest(null, 10));
    expect(noDate.total).toBe(101);
    const dated = await listRecentReceipts(operator, RAW_TOM_ID, searchOf(q, "2026-10-03", "50"));
    expect(dated.tooManyVendors, JSON.stringify(q)).toBeUndefined();
    expect(lotNumbersOf(dated), JSON.stringify(q)).toEqual(await latest("2026-10-03", 50));
    expect(dated.total).toBe(lotNumbersOf(dated).length);
    expect(dated.total).toBeGreaterThan(0);
  }
});
