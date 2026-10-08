import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  getStock,
  listActiveRawProducts,
  listFinishedPrices,
  listRecentReceipts,
  listVendors,
} from "../src/lib/receiving.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { getPricing } from "../src/lib/views.js";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  idOf,
  PROD_502_ID,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
  voidReceiptCall,
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

async function receive(lbs: number, cost: number, date = "2026-05-01"): Promise<string> {
  const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, cost, date));
  expect(outcome.ok).toBe(true);
  return idOf(outcome);
}

describe("listRecentReceipts: the fields of a receipt", () => {
  it("returns the lot number, date, vendor, weight, cost, remaining, and void reason", async () => {
    const lotId = await receive(1000, 1.68, "2026-05-02");
    const [lot] = await query<{ lot_number: string }>("select lot_number from lots where id = $1", [lotId]);
    const { receipts, total } = await listRecentReceipts(operator, RAW_TOM_ID);
    expect(total).toBe(1);
    expect(receipts).toEqual([
      {
        id: lotId,
        lotNumber: lot?.lot_number,
        receivedDate: "2026-05-02",
        vendorName: "Reyes Meats",
        weightLbs: 1000,
        unitCost: 1.68,
        remainingLbs: 1000,
        voidReason: null,
        status: "untouched",
      },
    ]);
  });

  it("carries the void reason on a void receipt and still counts it", async () => {
    const lotId = await receive(1000, 1.68);
    expect((await callAsOperator(voidReceiptCall(lotId, "entered twice"))).ok).toBe(true);
    const { receipts, total } = await listRecentReceipts(operator, RAW_TOM_ID);
    expect(total).toBe(1);
    expect(receipts[0]?.status).toBe("void");
    expect(receipts[0]?.voidReason).toBe("entered twice");
  });

  it("returns no receipts and a zero count for a product with none", async () => {
    await receive(1000, 1.68);
    expect(await listRecentReceipts(operator, PROD_502_ID)).toEqual({ receipts: [], total: 0 });
  });
});

describe("listActiveRawProducts", () => {
  it("lists active raw products by code, leaving out inactive and finished ones", async () => {
    await query(
      `insert into products(code, description, species, kind, active) values
         ('RAW-BEEF', 'Beef Trim (raw)', 'Beef', 'raw', true),
         ('RAW-OLD', 'Retired (raw)', 'Pork', 'raw', false)`,
    );
    const products = await listActiveRawProducts(operator);
    expect(products.map((p) => p.code)).toEqual(["RAW-BEEF", "RAW-TOM"]);
    expect(products[1]).toEqual({
      id: RAW_TOM_ID,
      code: "RAW-TOM",
      description: "Turkey Drums TOM (raw)",
      species: "Turkey",
    });
  });
});

describe("AC-0008: listVendors", () => {
  it("sorts by name, ignoring case", async () => {
    await query(`insert into vendors(name) values ('zeta Foods'), ('Alpha Farms'), ('beta Co')`);
    const vendors = await listVendors(operator);
    expect(vendors.map((v) => v.name)).toEqual(["Alpha Farms", "beta Co", "Reyes Meats", "zeta Foods"]);
  });
});

describe("AC-0067: getStock", () => {
  it("returns no balance and no receipts for a product that has neither", async () => {
    expect(await getStock(operator, RAW_TOM_ID)).toEqual({ balance: null, nonVoidReceipts: 0 });
  });

  it("returns the balance row and the non-void receipt count", async () => {
    await receive(1000, 1.5, "2026-05-01");
    await receive(1000, 1.8, "2026-05-02");
    expect(await getStock(operator, RAW_TOM_ID)).toEqual({
      balance: { qtyOnHand: 2000, movingAvgCost: 1.65 },
      nonVoidReceipts: 2,
    });
  });

  it("counts zero non-void receipts once every receipt is void", async () => {
    const lotId = await receive(1000, 1.68);
    expect((await callAsOperator(voidReceiptCall(lotId))).ok).toBe(true);
    const stock = await getStock(operator, RAW_TOM_ID);
    expect(stock.nonVoidReceipts).toBe(0);
    expect(stock.balance?.qtyOnHand ?? 0).toBe(0);
  });
});

describe("listFinishedPrices", () => {
  it("lists the finished products made from the raw product, with a null price before any receipt", async () => {
    expect(await listFinishedPrices(operator, RAW_TOM_ID)).toEqual([
      {
        productId: PROD_502_ID,
        code: "502",
        description: "Smoked Turkey Drums Tom",
        finalPricePerLb: null,
      },
    ]);
  });

  it("returns the price the view holds, unchanged", async () => {
    await receive(1000, 1.68);
    const [row] = await getPricing(operator, "502");
    const [price] = await listFinishedPrices(operator, RAW_TOM_ID);
    expect(row?.final_price_per_lb).not.toBeNull();
    expect(price?.finalPricePerLb).toBe(row?.final_price_per_lb);
  });

  it("leaves out inactive finished products and those made from another raw product", async () => {
    const [other] = await query<{ id: string }>(
      `insert into products(code, description, species, kind) values ('RAW-BEEF', 'Beef Trim (raw)', 'Beef', 'raw') returning id`,
    );
    await query(
      `insert into products(code, description, species, kind, raw_product_id, shrink_pct, active) values
         ('503', 'Retired Drums', 'Turkey', 'finished', $1, 0.2, false),
         ('601', 'Beef Patties', 'Beef', 'finished', $2, 0.1, true)`,
      [RAW_TOM_ID, other?.id],
    );
    expect((await listFinishedPrices(operator, RAW_TOM_ID)).map((p) => p.code)).toEqual(["502"]);
    expect((await listFinishedPrices(operator, other?.id ?? "")).map((p) => p.code)).toEqual(["601"]);
  });

  it("returns an empty list for a raw product with no finished product (AC-0016)", async () => {
    const [other] = await query<{ id: string }>(
      `insert into products(code, description, species, kind) values ('RAW-BEEF', 'Beef Trim (raw)', 'Beef', 'raw') returning id`,
    );
    expect(await listFinishedPrices(operator, other?.id ?? "")).toEqual([]);
  });
});
