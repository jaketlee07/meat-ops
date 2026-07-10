import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTypedClient, type TypedClient } from "../src/lib/supabase.js";
import { produceBatch, receiveLot, recordSale } from "../src/lib/rpc.js";
import { getPricing, getTrace } from "../src/lib/views.js";
import { resolveStackEnv } from "./env.js";
import {
  CUSTOMER_ID,
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  closePool,
  getFinishedGoods,
  getInventoryBalance,
  getLots,
  resetTestData,
  sumRemainingLots,
} from "./db.js";

// The seven golden invariants from docs/costing.md. Each test builds its exact
// scenario through the RPC wrappers, then asserts. No cost math in TypeScript:
// the wrappers call the Postgres functions and the assertions read views or raw
// tables. Prices are asserted on rounded display values (toFixed) per the doc;
// values exact by construction (1.725, 1540, 3360) are asserted with equality.

const env = resolveStackEnv();
let client: TypedClient;

beforeAll(() => {
  client = createTypedClient(env.apiUrl, env.serviceRoleKey);
});

beforeEach(async () => {
  await resetTestData();
});

afterAll(async () => {
  await closePool();
});

// Conservation holds after any mutating scenario, so it is checked at the end of
// every mutating test in addition to its own dedicated case (invariant 6).
async function assertConservation(): Promise<void> {
  const balance = await getInventoryBalance(RAW_TOM_ID);
  const lotSum = await sumRemainingLots(RAW_TOM_ID);
  if (balance !== null) {
    expect(balance.qty_on_hand).toBeCloseTo(lotSum, 3);
  }
  for (const fg of await getFinishedGoods(PROD_502_ID)) {
    expect(fg.lbs_remaining).toBeLessThanOrEqual(fg.lbs_produced);
  }
}

describe("Costing golden invariants", () => {
  it("1. Moving average: 5000@1.68 then 3000@1.80 => exactly 1.725", async () => {
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 3000,
      unitCost: 1.8,
      received: "2026-05-19",
    });

    const balance = await getInventoryBalance(RAW_TOM_ID);
    expect(balance).not.toBeNull();
    expect(balance!.qty_on_hand).toBe(8000);
    expect(balance!.moving_avg_cost).toBe(1.725);
    await assertConservation();
  });

  it("2. Pricing tie-out: single lot at 1.68 + fees => final price displays 2.68", async () => {
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });

    const pricing = await getPricing(client, "502");
    expect(pricing).toHaveLength(1);
    const row = pricing[0]!;
    expect(Number(row.raw_cost_per_lb)).toBe(1.68);
    expect(Number(row.post_shrink_cost_per_lb).toFixed(4)).toBe("2.1818");
    expect(Number(row.cost_per_lb).toFixed(2)).toBe("2.63");
    expect(Number(row.final_price_per_lb).toFixed(2)).toBe("2.68");
  });

  it("3. Shrinkage yield: 2000 lbs raw at 23% => 1540 lbs finished", async () => {
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });

    const batch = await produceBatch(client, {
      finishedProductId: PROD_502_ID,
      rawLbsIn: 2000,
      productionDate: "2026-05-20",
    });

    expect(Number(batch.finished_lbs_out)).toBe(1540);
    await assertConservation();
  });

  it("4. Lot cost is immutable: a price rise creates a new lot, never overwrites", async () => {
    const first = await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 3000,
      unitCost: 1.8,
      received: "2026-05-19",
    });

    const lots = await getLots(RAW_TOM_ID);
    expect(lots).toHaveLength(2);

    // The original lot still carries its original cost; the rise added a new lot.
    const original = lots.find((l) => l.id === first.id);
    expect(original).toBeDefined();
    expect(original!.unit_cost).toBe(1.68);
    expect(lots.map((l) => l.unit_cost).sort()).toEqual([1.68, 1.8]);
    await assertConservation();
  });

  it("5. FIFO / specific identification: 2000 lb batch draws entirely from the 1.68 lot", async () => {
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 3000,
      unitCost: 1.8,
      received: "2026-05-19",
    });

    const batch = await produceBatch(client, {
      finishedProductId: PROD_502_ID,
      rawLbsIn: 2000,
      productionDate: "2026-05-20",
    });

    // 2000 * 1.68 = 3360, all from the oldest lot; not the 1.725 moving average.
    expect(Number(batch.raw_cost_total)).toBe(3360);
    expect(Number(batch.cost_per_finished_lb).toFixed(4)).toBe("2.6318");

    // The 1.68 lot gave up 2000 lbs; the 1.80 lot is untouched.
    const lots = await getLots(RAW_TOM_ID);
    const oldLot = lots.find((l) => l.unit_cost === 1.68)!;
    const newLot = lots.find((l) => l.unit_cost === 1.8)!;
    expect(oldLot.remaining_lbs).toBe(3000);
    expect(newLot.remaining_lbs).toBe(3000);
    await assertConservation();
  });

  it("6. Conservation: qty_on_hand equals sum of remaining lot lbs after production", async () => {
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 3000,
      unitCost: 1.8,
      received: "2026-05-19",
    });
    await produceBatch(client, {
      finishedProductId: PROD_502_ID,
      rawLbsIn: 2000,
      productionDate: "2026-05-20",
    });

    const balance = await getInventoryBalance(RAW_TOM_ID);
    const lotSum = await sumRemainingLots(RAW_TOM_ID);
    expect(balance).not.toBeNull();
    // 8000 received - 2000 consumed = 6000, and lots must agree exactly.
    expect(balance!.qty_on_hand).toBe(6000);
    expect(lotSum).toBe(6000);
    expect(balance!.qty_on_hand).toBe(lotSum);
    await assertConservation();
  });

  it("7. Traceability: every sale_item resolves to a raw lot with vendor and received_date", async () => {
    await receiveLot(client, {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 5000,
      unitCost: 1.68,
      received: "2026-05-12",
    });
    await produceBatch(client, {
      finishedProductId: PROD_502_ID,
      rawLbsIn: 2000,
      productionDate: "2026-05-20",
    });
    const sale = await recordSale(client, {
      finishedProductId: PROD_502_ID,
      lbs: 500,
      pricePerLb: 2.68,
      customerId: CUSTOMER_ID,
      saleDate: "2026-05-21",
    });

    const trace = await getTrace(client, sale.sale_number);
    expect(trace.length).toBeGreaterThan(0);

    for (const row of trace) {
      expect(row.raw_lot).toBeTruthy();
      expect(row.vendor).toBeTruthy();
      expect(row.received_date).toBeTruthy();
    }

    // Reverse: the sold sale is reachable from the lot it touched.
    expect(trace.some((r) => r.sale_number === sale.sale_number)).toBe(true);
    expect(trace.some((r) => r.raw_lot !== null && r.vendor === "Reyes Meats")).toBe(true);
    await assertConservation();
  });
});
