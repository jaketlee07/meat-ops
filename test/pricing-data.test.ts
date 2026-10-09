import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { getPricingDetail } from "../src/lib/pricing.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { assertLedgerInvariants, closePool, resetTestData } from "./db.js";
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

// STUB: AC-0080
it("AC-0080: the detail lists the processing fees by name in fee-type order", async () => {
  const detail = await getPricingDetail(operator, "502");
  expect(detail?.processingFees.map((fee) => fee.name)).toEqual([
    "Direct cost of material",
    "Cost of freezing",
    "Belmont overhead",
  ]);
  expect(detail?.marginFees.map((fee) => fee.name)).toEqual(["Profit"]);
});

// ---- The rest of the T4 cases ----

import { changeFailureMessage } from "../src/lib/failures.js";
import { listPricing, listWhatIfRawProducts, runWhatIf } from "../src/lib/pricing.js";
import { RpcError, setListPrice, setTargetMargin } from "../src/lib/rpc.js";
import { callAsOperator, PROD_502_ID, query, RAW_TOM_ID, receiveCall, VENDOR_ID } from "./db.js";

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

const addProduct = async (
  code: string,
  opts: { kind?: "raw" | "finished"; raw?: string; active?: boolean } = {},
): Promise<string> => {
  const kind = opts.kind ?? "finished";
  const rows = await query<{ id: string }>(
    `insert into public.products(code, description, kind, raw_product_id, shrink_pct, active)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      code,
      `Product ${code}`,
      kind,
      kind === "finished" ? (opts.raw ?? RAW_TOM_ID) : null,
      kind === "finished" ? 0.1 : null,
      opts.active ?? true,
    ],
  );
  return rows[0]!.id;
};

const receive = async (raw: string = RAW_TOM_ID, cost = 1.68): Promise<void> => {
  const outcome = await callAsOperator(receiveCall(raw, VENDOR_ID, 5000, cost, "2026-10-01"));
  expect(outcome.error).toBeUndefined();
};

const rejection = async (run: () => Promise<unknown>): Promise<unknown> => {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
};

it("AC-0064: the list is in group order, then code order", async () => {
  await receive();
  await query(`update public.products set active = false where id = $1`, [PROD_502_ID]);
  const noCostRaw = await addProduct("RAW-NC", { kind: "raw" });
  // Entered out of group and code order. Cost per lb is 1.8667 and the suggested price 1.87.
  const ids = {
    p2: await addProduct("P2"),
    n2: await addProduct("N2", { raw: noCostRaw }),
    setPrice: await addProduct("C-SET"),
    below1: await addProduct("D-BT1"),
    p1: await addProduct("P1"),
    lower: await addProduct("A-LOW"),
    n1: await addProduct("N1", { raw: noCostRaw }),
    below2: await addProduct("B-BT2"),
  };
  await setListPrice(operator, ids.p1, 1.87);
  await setListPrice(operator, ids.p2, 1.87);
  await setListPrice(operator, ids.lower, 5);
  for (const id of [ids.below1, ids.below2]) {
    await setTargetMargin(operator, id, 50);
    await setListPrice(operator, id, 1.9);
  }

  const rows = await listPricing(operator);
  expect(rows.map((row) => row.code)).toEqual([
    "B-BT2",
    "D-BT1",
    "A-LOW",
    "C-SET",
    "P1",
    "P2",
    "N1",
    "N2",
  ]);
  expect(rows.map((row) => [row.needsNewPrice, row.belowTarget, row.hasCost, row.priceAction])).toEqual([
    [true, true, true, "raise"],
    [true, true, true, "raise"],
    [true, false, true, "lower"],
    [true, false, true, "set"],
    [false, false, true, null],
    [false, false, true, null],
    [false, false, false, null],
    [false, false, false, null],
  ]);

  const view = await query<Record<string, number | string | boolean | null>>(
    `select product_id, code, description, cost_per_lb::float8, list_price_per_lb::float8,
            suggested_list_price::float8, margin_at_list_pct::float8, target_margin_pct::float8,
            margin_per_lb::float8
     from public.v_product_pricing`,
  );
  for (const row of rows) {
    const expected = view.find((v) => v.code === row.code)!;
    expect(row).toMatchObject({
      productId: expected.product_id,
      description: expected.description,
      costPerLb: expected.cost_per_lb,
      listPrice: expected.list_price_per_lb,
      suggestedListPrice: expected.suggested_list_price,
      marginAtList: expected.margin_at_list_pct,
      targetMargin: expected.target_margin_pct,
      marginFeesPerLb: expected.margin_per_lb,
    });
  }
});

it("AC-0085: the detail is null for an unknown, a raw, and an inactive code", async () => {
  await addProduct("OLD", { active: false });
  expect(await getPricingDetail(operator, "NOPE")).toBeNull();
  expect(await getPricingDetail(operator, "RAW-TOM")).toBeNull();
  expect(await getPricingDetail(operator, "OLD")).toBeNull();
});

it("the detail carries 502's raw input and its numbers", async () => {
  await receive();
  const detail = await getPricingDetail(operator, "502");
  expect(detail?.raw).toEqual({ code: "RAW-TOM", description: "Turkey Drums TOM (raw)" });
  expect(detail).toMatchObject({
    productId: PROD_502_ID,
    code: "502",
    rawAverageCost: 1.68,
    shrink: 0.23,
    hasCost: true,
  });
  expect(detail?.processingFees.map((fee) => fee.amountPerLb)).toEqual([0.05, 0.03, 0.37]);
  expect(detail?.marginFees).toEqual([{ name: "Profit", amountPerLb: 0.05 }]);
});

it("AC-0129: the what-if picker lists active raw inputs of active finished products in code order", async () => {
  const zed = await addProduct("RAW-ZED", { kind: "raw" });
  const alp = await addProduct("RAW-ALP", { kind: "raw" });
  const old = await addProduct("RAW-OLD", { kind: "raw", active: false });
  const retired = await addProduct("RAW-RETIRED", { kind: "raw" });
  await addProduct("RAW-IDLE", { kind: "raw" });
  await addProduct("Z9", { raw: zed });
  await addProduct("Y9", { raw: alp });
  await addProduct("X9", { raw: old });
  await addProduct("W9", { raw: retired, active: false });
  expect(await listWhatIfRawProducts(operator)).toEqual([
    { id: alp, code: "RAW-ALP", description: "Product RAW-ALP" },
    { id: RAW_TOM_ID, code: "RAW-TOM", description: "Turkey Drums TOM (raw)" },
    { id: zed, code: "RAW-ZED", description: "Product RAW-ZED" },
  ]);
});

it("no raw product feeds an active finished product, so the picker is empty", async () => {
  await query(`update public.products set active = false where id = $1`, [PROD_502_ID]);
  expect(await listWhatIfRawProducts(operator)).toEqual([]);
});

it("AC-0020: the what-if for RAW-TOM at 2.00 gives the golden numbers", async () => {
  await receive();
  await setTargetMargin(operator, PROD_502_ID, 20);
  await setListPrice(operator, PROD_502_ID, 3.29);
  const rows = await runWhatIf(operator, RAW_TOM_ID, 2);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    code: "502",
    cost_per_lb: 3.0474,
    final_price_per_lb: 3.81,
    suggested_list_price: 3.81,
    margin_at_list_pct: 0.0737,
  });
});

it("AC-0116: a change to an inactive product gives the inactive message", async () => {
  await query(`update public.products set active = false where id = $1`, [PROD_502_ID]);
  const text = "The change wasn't saved. This product is no longer active.";
  for (const run of [
    () => setTargetMargin(operator, PROD_502_ID, 20),
    () => setListPrice(operator, PROD_502_ID, 3.29),
  ]) {
    const error = await rejection(run);
    expect(error).toBeInstanceOf(RpcError);
    expect(changeFailureMessage(error, "write")).toBe(text);
  }
});

it("AC-0118: a change to an unknown product id gives the not-found message", async () => {
  const error = await rejection(() => setListPrice(operator, UNKNOWN_ID, 3.29));
  expect(error).toBeInstanceOf(RpcError);
  expect(changeFailureMessage(error, "write")).toBe(
    `The change wasn't saved. product ${UNKNOWN_ID} not found`,
  );
});

it("a null target removes the target", async () => {
  await setTargetMargin(operator, PROD_502_ID, 20);
  const row = await setTargetMargin(operator, PROD_502_ID, null);
  expect(row.target_margin_pct).toBeNull();
});
