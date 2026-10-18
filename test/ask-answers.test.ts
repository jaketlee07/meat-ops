import { answerFor } from "../src/lib/ask-answers.js";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  CUSTOMER_ID,
  idOf,
  type OpCall,
  PROD_502_ID,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  saleFixture,
  seedInvoiceFixture,
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

// STUB: AC-0020
it("AC-0020: raw stock reads 8,000 lbs at $1.7250/lb in the production 502 fixture", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).ok).toBe(true);
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 3000, 1.8, "2026-10-05"))).ok).toBe(true);
  const answer = await answerFor(operator, { query: "raw_stock", productCode: "RAW-TOM" });
  expect(answer?.text).toEqual({
    lead: "You have 8,000 lbs of RAW-TOM Turkey Drums TOM (raw) on hand. Its average cost is $1.7250/lb.",
    items: [],
    tail: null,
  });
});

// STUB: AC-0034
it("AC-0034: the lots behind S-5000 are lot A then lot B, each once", async () => {
  const fixture = await saleFixture({ listPrice: true, sale: true });
  const answer = await answerFor(operator, { query: "sale_lots", number: "S-5000" });
  expect(answer?.text).toEqual({
    lead: "Sale S-5000 on Oct 8, 2026 (Fulton Market Deli): 5,000 lbs of 502 Smoked Turkey Drums Tom at $3.29/lb. It came from these raw lots:",
    items: [
      `Lot ${fixture.lotANumber}: RAW-TOM Turkey Drums TOM (raw) from Reyes Meats, received Oct 1, 2026, at $1.6800/lb`,
      `Lot ${fixture.lotBNumber}: RAW-TOM Turkey Drums TOM (raw) from Valley Poultry, received Oct 5, 2026, at $1.8000/lb`,
    ],
    tail: null,
  });
});

// ---- The rest of the T2 cases ----

const run = async (call: OpCall): Promise<string> => {
  const outcome = await callAsOperator(call);
  if (!outcome.ok) throw new Error(`${call.fn}: ${outcome.error}`);
  return idOf(outcome);
};

const setTarget = (percent: number | null) =>
  run({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: percent } });
const setPrice = (price: number) =>
  run({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: price } });
const receiveOnly = () => run(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
const saleTo = (number: string, lbs: number, date: string, customer: string | null) =>
  run({
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

const LOT_B_SENTENCE = (number: string) =>
  `Lot ${number}: 3,000 lbs of RAW-TOM Turkey Drums TOM (raw) from Valley Poultry, received Oct 5, 2026, at $1.8000/lb.`;
const LOT_A_SENTENCE = (number: string) =>
  `Lot ${number}: 5,000 lbs of RAW-TOM Turkey Drums TOM (raw) from Reyes Meats, received Oct 1, 2026, at $1.6800/lb.`;

it("AC-0021: raw stock with every receipt void reads 0 lbs and no average cost yet", async () => {
  const a = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
  const b = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 3000, 1.8, "2026-10-05"));
  await run(voidReceiptCall(a));
  await run(voidReceiptCall(b));
  const answer = await answerFor(operator, { query: "raw_stock", productCode: "RAW-TOM" });
  expect(answer?.text).toEqual({
    lead: "You have 0 lbs of RAW-TOM Turkey Drums TOM (raw) on hand, and no average cost yet.",
    items: [],
    tail: null,
  });
});

it("AC-0022: finished stock reads 5,390 lbs of 502 in the sale fixture", async () => {
  await saleFixture();
  const answer = await answerFor(operator, { query: "finished_stock", productCode: "502" });
  expect(answer?.text).toEqual({
    lead: "You have 5,390 lbs of 502 Smoked Turkey Drums Tom ready to sell.",
    items: [],
    tail: null,
  });
});

it("AC-0023: the margin case reads the advice and says it is below target", async () => {
  await receiveOnly();
  await setTarget(20);
  await setPrice(2.68);
  const answer = await answerFor(operator, { query: "product_margin", productCode: "502" });
  expect(answer?.text).toEqual({
    lead: "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. At your list price of $2.68/lb, the margin is 1.8%. That is below your target.",
    items: [],
    tail: null,
  });
});

it("AC-0024: the pricing 502 fixture reads the no-target, no-list-price advice", async () => {
  await receiveOnly();
  const answer = await answerFor(operator, { query: "product_margin", productCode: "502" });
  expect(answer?.text).toEqual({
    lead: "Cost is $2.6318/lb. With no target margin, the suggested price is cost plus $0.0500/lb in margin fees. This product has no list price yet.",
    items: [],
    tail: null,
  });
});

it("AC-0025: a product whose raw input has no cost says it has no cost yet", async () => {
  await run(voidReceiptCall(await receiveOnly()));
  const answer = await answerFor(operator, { query: "product_margin", productCode: "502" });
  expect(answer?.text).toEqual({ lead: "502 Smoked Turkey Drums Tom has no cost yet.", items: [], tail: null });
});

it("AC-0026: pricing attention lists the one product that needs a new price", async () => {
  await receiveOnly();
  await setTarget(20);
  await setPrice(2.68);
  const answer = await answerFor(operator, { query: "pricing_attention" });
  expect(answer?.text).toEqual({
    lead: "1 product needs a new price:",
    items: ["502 Smoked Turkey Drums Tom: Raise list price to $3.29/lb, below your target"],
    tail: null,
  });
});

// A second finished product, 503 made from a new raw RAW-TKB, the way the browser fixture adds it.
const RAW_TKB_ID = "88888888-8888-8888-8888-888888888888";
const PROD_503_ID = "99999999-9999-9999-9999-999999999999";
async function addProduct503(): Promise<void> {
  await query(
    `insert into products(id, code, description, species, kind) values ($1, 'RAW-TKB', 'Turkey Breast (raw)', 'Turkey', 'raw')`,
    [RAW_TKB_ID],
  );
  await query(
    `insert into products(id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct)
     values ($1, '503', 'Smoked Turkey Breast', 'Prospect Meats', 'Turkey', 'finished', '56cs/pl', 32.5, $2, 0.2300)`,
    [PROD_503_ID, RAW_TKB_ID],
  );
  await query(
    `insert into product_fees(product_id, fee_type_id, amount_per_lb)
     select $1, fee_type_id, amount_per_lb from product_fees
     where product_id = '33333333-3333-3333-3333-333333333333'`,
    [PROD_503_ID],
  );
  await run(receiveCall(RAW_TKB_ID, VENDOR_ID, 2000, 2.1, "2026-10-02"));
}

it("AC-0026, AC-0064: two products that need a new price read the plural lead, below-target 503 before 502", async () => {
  await receiveOnly();
  await addProduct503();
  // 502 has no list price (needs one, not below target); 503 is below its target.
  await run({ fn: "set_target_margin", args: { p_product_id: PROD_503_ID, p_target_percent: 20 } });
  await run({ fn: "set_list_price", args: { p_product_id: PROD_503_ID, p_price_per_lb: 1 } });
  const answer = await answerFor(operator, { query: "pricing_attention" });
  expect(answer?.text).toEqual({
    lead: "2 products need a new price:",
    items: [
      "503 Smoked Turkey Breast: Raise list price to $3.98/lb, below your target",
      "502 Smoked Turkey Drums Tom: Set list price to $2.68/lb",
    ],
    tail: null,
  });
});

it("AC-0027: pricing attention says no product needs a new price once the list price is 3.29", async () => {
  await receiveOnly();
  await setTarget(20);
  await setPrice(3.29);
  const answer = await answerFor(operator, { query: "pricing_attention" });
  expect(answer?.text).toEqual({ lead: "No product needs a new price right now.", items: [], tail: null });
});

it("AC-0028: sellable now lists 502 with its finished and raw lbs in the sale fixture", async () => {
  await saleFixture();
  const answer = await answerFor(operator, { query: "sellable_now" });
  expect(answer?.text).toEqual({
    lead: "You can sell 1 product now:",
    items: ["502 Smoked Turkey Drums Tom: 5,390 lbs ready, 1,000 lbs of raw on hand"],
    tail: null,
  });
});

it("AC-0028: two sellable products read the plural lead in code order", async () => {
  await receiveOnly();
  await addProduct503();
  const answer = await answerFor(operator, { query: "sellable_now" });
  expect(answer?.text).toEqual({
    lead: "You can sell 2 products now:",
    items: [
      "502 Smoked Turkey Drums Tom: 0 lbs ready, 5,000 lbs of raw on hand",
      "503 Smoked Turkey Breast: 0 lbs ready, 2,000 lbs of raw on hand",
    ],
    tail: null,
  });
});

it("AC-0029: sellable now says so when no product can be sold", async () => {
  const answer = await answerFor(operator, { query: "sellable_now" });
  expect(answer?.text).toEqual({ lead: "No product can be sold right now.", items: [], tail: null });
});

it("AC-0030: recent receipts lists lot B then lot A with vendor, weight, cost, and lot", async () => {
  const fixture = await saleFixture();
  const answer = await answerFor(operator, { query: "recent_receipts", productCode: "RAW-TOM" });
  expect(answer?.text).toEqual({
    lead: "Recent receipts of RAW-TOM Turkey Drums TOM (raw), most recent first:",
    items: [
      `Oct 5, 2026, Valley Poultry: 3,000 lbs at $1.8000/lb, lot ${fixture.lotBNumber}`,
      `Oct 1, 2026, Reyes Meats: 5,000 lbs at $1.6800/lb, lot ${fixture.lotANumber}`,
    ],
    tail: null,
  });
});

it("AC-0031: a void receipt's item ends with (void)", async () => {
  const id = await receiveOnly();
  await run(voidReceiptCall(id));
  const [lot] = await query<{ lot_number: string }>("select lot_number from public.lots where id = $1", [id]);
  const answer = await answerFor(operator, { query: "recent_receipts", productCode: "RAW-TOM" });
  expect(answer?.text.items).toEqual([
    `Oct 1, 2026, Reyes Meats: 5,000 lbs at $1.6800/lb, lot ${lot!.lot_number} (void)`,
  ]);
});

it("AC-0032: 11 receipts show the 10 most recent and say so", async () => {
  for (let i = 1; i <= 11; i++) await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 100 * i, 1.5, "2026-10-01"));
  const lots = await query<{ lot_number: string }>(
    "select lot_number from public.lots order by receipt_seq desc limit 10",
  );
  const answer = await answerFor(operator, { query: "recent_receipts", productCode: "RAW-TOM" });
  expect(answer?.text).toEqual({
    lead: "Recent receipts of RAW-TOM Turkey Drums TOM (raw), most recent first:",
    items: lots.map(
      (lot, index) =>
        `Oct 1, 2026, Reyes Meats: ${((11 - index) * 100).toLocaleString("en-US")} lbs at $1.5000/lb, lot ${lot.lot_number}`,
    ),
    tail: "Showing the 10 most recent of 11 receipts.",
  });
});

it("AC-0033: a raw product with no receipt says it has no receipts yet", async () => {
  const answer = await answerFor(operator, { query: "recent_receipts", productCode: "RAW-TOM" });
  expect(answer?.text).toEqual({
    lead: "RAW-TOM Turkey Drums TOM (raw) has no receipts yet.",
    items: [],
    tail: null,
  });
});

it("AC-0035: a sale with no customer shows (No customer)", async () => {
  const fixture = await saleFixture();
  await saleTo("S-5001", 100, "2026-10-08", null);
  const answer = await answerFor(operator, { query: "sale_lots", number: "S-5001" });
  expect(answer?.text).toEqual({
    lead: "Sale S-5001 on Oct 8, 2026 (No customer): 100 lbs of 502 Smoked Turkey Drums Tom at $3.29/lb. It came from these raw lots:",
    items: [
      `Lot ${fixture.lotANumber}: RAW-TOM Turkey Drums TOM (raw) from Reyes Meats, received Oct 1, 2026, at $1.6800/lb`,
      `Lot ${fixture.lotBNumber}: RAW-TOM Turkey Drums TOM (raw) from Valley Poultry, received Oct 5, 2026, at $1.8000/lb`,
    ],
    tail: null,
  });
});

it("AC-0036: a voided sale reads as voided with its reason", async () => {
  const fixture = await saleFixture({ listPrice: true, sale: true });
  await run(voidSaleCall(fixture.saleId!, "wrong customer"));
  const answer = await answerFor(operator, { query: "sale_lots", number: "S-5000" });
  expect(answer?.text).toEqual({ lead: "Sale S-5000 was voided: wrong customer.", items: [], tail: null });
});

it("AC-0037: a number that names no sale says so", async () => {
  const answer = await answerFor(operator, { query: "sale_lots", number: "S-9999" });
  expect(answer?.text).toEqual({ lead: "No sale has number S-9999.", items: [], tail: null });
});

it("AC-0038: lot B reached the 5,000-lb sale", async () => {
  const fixture = await saleFixture({ listPrice: true, sale: true });
  const answer = await answerFor(operator, { query: "lot_sales", number: fixture.lotBNumber });
  expect(answer?.text).toEqual({
    lead: `${LOT_B_SENTENCE(fixture.lotBNumber)} It reached these sales:`,
    items: ["S-5000 on Oct 8, 2026 (Fulton Market Deli)"],
    tail: null,
  });
});

it("AC-0019: a lot's sales list newest sale date first, then last entered first, each once", async () => {
  const fixture = await saleFixture({ listPrice: true, sale: true });
  for (const number of ["S-6002", "S-6001", "S-6003"]) await saleTo(number, 100, "2026-10-09", CUSTOMER_ID);
  const answer = await answerFor(operator, { query: "lot_sales", number: fixture.lotBNumber });
  expect(answer?.text.items).toEqual([
    "S-6003 on Oct 9, 2026 (Fulton Market Deli)",
    "S-6001 on Oct 9, 2026 (Fulton Market Deli)",
    "S-6002 on Oct 9, 2026 (Fulton Market Deli)",
    "S-5000 on Oct 8, 2026 (Fulton Market Deli)",
  ]);
});

it("AC-0039: a lot with no sale says no sale was made from it", async () => {
  const fixture = await saleFixture();
  const answer = await answerFor(operator, { query: "lot_sales", number: fixture.lotANumber });
  expect(answer?.text).toEqual({
    lead: `${LOT_A_SENTENCE(fixture.lotANumber)} No sale was made from this lot.`,
    items: [],
    tail: null,
  });
});

it("AC-0040: a void receipt says it was voided and nothing more", async () => {
  const id = await receiveOnly();
  await run(voidReceiptCall(id, "entered twice"));
  const [lot] = await query<{ lot_number: string }>("select lot_number from public.lots where id = $1", [id]);
  const answer = await answerFor(operator, { query: "lot_sales", number: lot!.lot_number });
  expect(answer?.text).toEqual({
    lead: `${LOT_A_SENTENCE(lot!.lot_number)} This receipt was voided: entered twice.`,
    items: [],
    tail: null,
  });
});

it("AC-0041: a number that names no receipt says so", async () => {
  const answer = await answerFor(operator, { query: "lot_sales", number: "L-UNKNOWN" });
  expect(answer?.text).toEqual({ lead: "No receipt has lot number L-UNKNOWN.", items: [], tail: null });
});

it("AC-0042, AC-0043: each query gives its looked-up line and link", async () => {
  const fixture = await saleFixture({ listPrice: true, sale: true });
  const cases: [Parameters<typeof answerFor>[1], string, { name: string; href: string }][] = [
    [
      { query: "raw_stock", productCode: "RAW-TOM" },
      "stock on hand for RAW-TOM Turkey Drums TOM (raw)",
      { name: "See it on Receiving", href: "/receiving?product=RAW-TOM" },
    ],
    [
      { query: "finished_stock", productCode: "502" },
      "finished stock for 502 Smoked Turkey Drums Tom",
      { name: "See it on the Menu", href: "/menu" },
    ],
    [
      { query: "product_margin", productCode: "502" },
      "cost and margin for 502 Smoked Turkey Drums Tom",
      { name: "See it on Pricing", href: "/pricing?product=502" },
    ],
    [
      { query: "pricing_attention" },
      "products that need a new price",
      { name: "See it on Pricing", href: "/pricing" },
    ],
    [{ query: "sellable_now" }, "products you can sell now", { name: "See it on the Menu", href: "/menu" }],
    [
      { query: "recent_receipts", productCode: "RAW-TOM" },
      "recent receipts of RAW-TOM Turkey Drums TOM (raw)",
      { name: "See it on Receiving", href: "/receiving?product=RAW-TOM" },
    ],
    [
      { query: "sale_lots", number: "S-5000" },
      "the lots behind sale S-5000",
      { name: "See the full trace", href: "/trace?sale=S-5000" },
    ],
    [
      { query: "lot_sales", number: fixture.lotANumber },
      `the sales from lot ${fixture.lotANumber}`,
      { name: "See the full trace", href: `/trace?lot=${encodeURIComponent(fixture.lotANumber)}` },
    ],
  ];
  for (const [choice, lookedUp, link] of cases) {
    const answer = await answerFor(operator, choice);
    expect(answer?.lookedUp, choice.query).toBe(lookedUp);
    expect(answer?.link, choice.query).toEqual(link);
  }
});

it("AC-0059, AC-0082: an inactive product or one of the wrong kind has no answer", async () => {
  await seedInvoiceFixture();
  for (const choice of [
    { query: "raw_stock", productCode: "RAW-OLD" },
    { query: "recent_receipts", productCode: "RAW-OLD" },
    { query: "raw_stock", productCode: "502" },
    { query: "recent_receipts", productCode: "502" },
    { query: "finished_stock", productCode: "RAW-TOM" },
    { query: "product_margin", productCode: "RAW-TOM" },
    { query: "finished_stock", productCode: "NOPE" },
  ] as const) {
    expect(await answerFor(operator, choice), `${choice.query} ${choice.productCode}`).toBeNull();
  }
});
