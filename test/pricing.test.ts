import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  PROD_502_ID,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
} from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0010
it("AC-0010: a 20% target gives 502 a suggested price of 3.29", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).ok).toBe(true);
  const target = await callAsOperator({
    fn: "set_target_margin",
    args: { p_product_id: PROD_502_ID, p_target_percent: 20 },
  });
  expect(target.error).toBeUndefined();
  const rows = await query(
    `select cost_per_lb::text, final_price_per_lb::text, suggested_list_price::text
     from public.v_product_pricing where product_id = $1`,
    [PROD_502_ID],
  );
  expect(rows).toEqual([{ cost_per_lb: "2.6318", final_price_per_lb: "3.29", suggested_list_price: "3.29" }]);
});

// ---- The rest of the T1 pricing cases ----

import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedClient } from "../src/lib/supabase.js";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  idOf,
  produceCall,
  tableFingerprints,
  voidReceiptCall,
  type Arg,
  type CallOutcome,
  type OpCall,
} from "./db.js";
import { resolveStackEnv } from "./env.js";
import { signInNonOperator, signInOperator } from "./users.js";

const stack = resolveStackEnv();

// Sign-ins are rate limited, so each role signs in at most once per file.
let operatorClient: Promise<TypedClient> | undefined;
let nonOperatorClient: Promise<TypedClient> | undefined;
const asOperator = (): Promise<TypedClient> => (operatorClient ??= signInOperator());
const asNonOperator = (): Promise<TypedClient> => (nonOperatorClient ??= signInNonOperator());
const loose = (client: TypedClient): SupabaseClient => client as unknown as SupabaseClient;

const receive = async (cost: Arg = 1.68, weight: Arg = 5000): Promise<string> => {
  const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, weight, cost, "2026-10-01"));
  expect(outcome.error).toBeUndefined();
  return idOf(outcome);
};
const setTarget = (productId: string, percent: Arg): Promise<CallOutcome> =>
  callAsOperator({ fn: "set_target_margin", args: { p_product_id: productId, p_target_percent: percent } });
const setPrice = (productId: string, price: Arg): Promise<CallOutcome> =>
  callAsOperator({ fn: "set_list_price", args: { p_product_id: productId, p_price_per_lb: price } });
const whatIfCall = (cost: Arg, raw: string = RAW_TOM_ID): OpCall => ({
  fn: "price_what_if",
  args: { p_raw_product_id: raw, p_raw_cost_per_lb: cost },
});
const whatIf = async (cost: Arg, raw: string = RAW_TOM_ID): Promise<Record<string, unknown>[]> => {
  const outcome = await callAsOperator(whatIfCall(cost, raw));
  expect(outcome.error).toBeUndefined();
  return outcome.rows ?? [];
};

const PRICING_COLUMNS = `product_id, code, cost_per_lb::text, final_price_per_lb::text, suggested_list_price::text,
  margin_at_list_pct::text, list_price_per_lb::text, target_margin_pct::text, has_cost, price_action,
  needs_new_price, below_target`;
const pricingRow = async (productId: string = PROD_502_ID): Promise<Record<string, unknown>> => {
  const rows = await query(`select ${PRICING_COLUMNS} from public.v_product_pricing where product_id = $1`, [
    productId,
  ]);
  expect(rows).toHaveLength(1);
  return rows[0]!;
};

// A refusal leaves every table as it was.
async function expectRefusal(call: OpCall, text: string): Promise<void> {
  const before = await tableFingerprints();
  const outcome = await callAsOperator(call);
  expect(outcome.ok, `${call.fn} ${JSON.stringify(call.args)} should be refused`).toBe(false);
  expect(outcome.error).toContain(text);
  expect(await tableFingerprints()).toEqual(before);
}

async function expectNonOperatorRefusal(fn: string, args: Record<string, unknown>): Promise<void> {
  const client = loose(await asNonOperator());
  const before = await tableFingerprints();
  const { error } = await client.rpc(fn, args);
  expect(error?.code).toBe("42501");
  expect(error?.message).toContain(`${fn}: not allowed (caller is not an operator)`);
  expect(await tableFingerprints()).toEqual(before);
}

const addProduct = async (
  code: string,
  opts: { kind?: string; raw?: string | null; shrink?: number | null; active?: boolean } = {},
): Promise<string> => {
  const kind = opts.kind ?? "finished";
  const rows = await query<{ id: string }>(
    `insert into public.products(code, description, kind, raw_product_id, shrink_pct, active)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [
      code,
      `Product ${code}`,
      kind,
      kind === "finished" ? (opts.raw === undefined ? RAW_TOM_ID : opts.raw) : null,
      kind === "finished" ? (opts.shrink === undefined ? 0.1 : opts.shrink) : null,
      opts.active ?? true,
    ],
  );
  return rows[0]!.id;
};

const UNKNOWN_ID = "00000000-0000-0000-0000-000000000000";

it("AC-0011: a target margin of 0 gives 502 a suggested price of 2.64", async () => {
  await receive();
  expect((await setTarget(PROD_502_ID, 0)).error).toBeUndefined();
  expect((await pricingRow()).final_price_per_lb).toBe("2.64");
});

it("AC-0012: the profit fee does not move the suggested price under a target", async () => {
  await receive();
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await pricingRow()).final_price_per_lb).toBe("3.29");
  await query(
    `update public.product_fees set amount_per_lb = 0.50
     where product_id = $1 and fee_type_id = (select id from public.fee_types where code = 'profit')`,
    [PROD_502_ID],
  );
  const row = await pricingRow();
  expect(row.final_price_per_lb).toBe("3.29");
  expect((await query(`select margin_per_lb::text from public.v_product_pricing where product_id = $1`, [PROD_502_ID]))[0]).toEqual({
    margin_per_lb: "0.5000",
  });
});

it("AC-0013: a target margin of 22.5 gives 502 a suggested price of 3.40", async () => {
  await receive();
  expect((await setTarget(PROD_502_ID, 22.5)).error).toBeUndefined();
  expect((await pricingRow()).final_price_per_lb).toBe("3.40");
});

it("AC-0019: a 1.6632 receipt gives cost 2.6100, price 3.27, and margin 0.2018 at 3.27", async () => {
  await receive(1.6632);
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 3.27)).error).toBeUndefined();
  const row = await pricingRow();
  expect(row.cost_per_lb).toBe("2.6100");
  expect(row.final_price_per_lb).toBe("3.27");
  expect(row.margin_at_list_pct).toBe("0.2018");
});

it("AC-0014: margin at list price for four list prices", async () => {
  await receive();
  const margins: Record<string, string> = {};
  for (const price of ["2.68", "3.29", "3.50", "2.50"]) {
    expect((await setPrice(PROD_502_ID, price)).error).toBeUndefined();
    margins[price] = String((await pricingRow()).margin_at_list_pct);
  }
  expect(margins).toEqual({ "2.68": "0.0180", "3.29": "0.2001", "3.50": "0.2481", "2.50": "-0.0527" });
});

it("AC-0015: the price action with a 20% target", async () => {
  await receive();
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  const seen: Record<string, unknown> = {};
  const needs: Record<string, unknown> = {};
  let row = await pricingRow();
  seen.none = row.price_action;
  needs.none = row.needs_new_price;
  for (const price of ["2.68", "3.50", "3.29"]) {
    expect((await setPrice(PROD_502_ID, price)).error).toBeUndefined();
    row = await pricingRow();
    seen[price] = row.price_action;
    needs[price] = row.needs_new_price;
  }
  expect(seen).toEqual({ none: "set", "2.68": "raise", "3.50": "lower", "3.29": null });
  expect(needs).toEqual({ none: true, "2.68": true, "3.50": true, "3.29": false });
});

it("AC-0016: below target only with a target and a list price under it", async () => {
  await receive();
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 2.68)).error).toBeUndefined();
  expect((await pricingRow()).below_target).toBe(true);
  expect((await setPrice(PROD_502_ID, 3.5)).error).toBeUndefined();
  expect((await pricingRow()).below_target).toBe(false);
  expect((await setTarget(PROD_502_ID, null)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 2.68)).error).toBeUndefined();
  expect((await pricingRow()).below_target).toBe(false);
});

it("AC-0017: with the only receipt voided, the pricing view gives no price, margin, or action", async () => {
  const lotId = await receive();
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 2.68)).error).toBeUndefined();
  expect((await callAsOperator(voidReceiptCall(lotId))).error).toBeUndefined();
  const row = await pricingRow();
  expect(row.has_cost).toBe(false);
  expect(row.suggested_list_price).toBeNull();
  expect(row.margin_at_list_pct).toBeNull();
  expect(row.price_action).toBeNull();
  expect(row.needs_new_price).toBe(false);
  expect(row.below_target).toBe(false);
});

it("AC-0018: a non-operator reads no row from either view, where the operator reads one", async () => {
  await receive();
  const operator = await asOperator();
  const outsider = await asNonOperator();
  for (const view of ["v_product_pricing", "v_current_menu"] as const) {
    const seen = await operator.from(view).select("product_id");
    expect(seen.error).toBeNull();
    expect(seen.data?.length).toBeGreaterThanOrEqual(1);
    const hidden = await outsider.from(view).select("product_id");
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);
  }
  const options = await query<{ relname: string; reloptions: string[] | null }>(
    `select relname, reloptions from pg_class
     where relname in ('v_product_pricing', 'v_current_menu') order by relname`,
  );
  expect(options.map((o) => o.reloptions)).toEqual([["security_invoker=true"], ["security_invoker=true"]]);
});

it("AC-0020: a what-if for RAW-TOM at 2.00 with a 20% target and a 3.29 list price", async () => {
  await receive();
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 3.29)).error).toBeUndefined();
  const rows = await whatIf(2.0);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    code: "502",
    cost_per_lb: "3.0474",
    final_price_per_lb: "3.81",
    suggested_list_price: "3.81",
    margin_at_list_pct: "0.0737",
  });
});

it("AC-0021: a what-if with no target gives a suggested price of 3.0974", async () => {
  await receive();
  const rows = await whatIf(2.0);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ code: "502", cost_per_lb: "3.0474", final_price_per_lb: "3.0974" });
});

it("AC-0022: a what-if at the raw average gives what the pricing view gives", async () => {
  await receive(1.68, 5000);
  await receive(1.8, 3000);
  const other = await addProduct("503", { shrink: 0.1 });
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 3.29)).error).toBeUndefined();
  const [balance] = await query<{ moving_avg_cost: string }>(
    `select moving_avg_cost::text from public.inventory_balances where product_id = $1`,
    [RAW_TOM_ID],
  );
  expect(balance?.moving_avg_cost).toBe("1.7250");
  const rows = await whatIf(balance!.moving_avg_cost);
  expect(rows.map((r) => r.code)).toEqual(["502", "503"]);
  for (const productId of [PROD_502_ID, other]) {
    const view = await pricingRow(productId);
    const shown = rows.find((r) => r.product_id === productId);
    expect(shown).toMatchObject({
      cost_per_lb: view.cost_per_lb,
      final_price_per_lb: view.final_price_per_lb,
      suggested_list_price: view.suggested_list_price,
      margin_at_list_pct: view.margin_at_list_pct,
    });
  }
  expect(rows[0]).toMatchObject({
    cost_per_lb: "2.6903",
    final_price_per_lb: "3.37",
    margin_at_list_pct: "0.1823",
  });
  expect(rows[1]).toMatchObject({ margin_at_list_pct: null, list_price_per_lb: null, target_margin_pct: null });
});

it("AC-0023: a what-if returns exactly the active finished products made from the raw product", async () => {
  await receive();
  await addProduct("503");
  await addProduct("504", { active: false });
  const otherRaw = await addProduct("RAW-X", { kind: "raw" });
  await addProduct("601", { raw: otherRaw });
  expect((await whatIf(2.0)).map((r) => r.code)).toEqual(["502", "503"]);
  expect((await whatIf(2.0, otherRaw)).map((r) => r.code)).toEqual(["601"]);
});

it("AC-0026: a what-if returns its products in code order", async () => {
  await receive();
  for (const code of ["A1", "50", "a2", "1000"]) await addProduct(code);
  expect((await whatIf(2.0)).map((r) => r.code)).toEqual(["1000", "50", "502", "A1", "a2"]);
});

it("AC-0028: a what-if counts its cost though RAW-TOM's only receipt is void", async () => {
  const lotId = await receive();
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 3.29)).error).toBeUndefined();
  expect((await callAsOperator(voidReceiptCall(lotId))).error).toBeUndefined();
  const rows = await whatIf(2.0);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    cost_per_lb: "3.0474",
    final_price_per_lb: "3.81",
    suggested_list_price: "3.81",
    margin_at_list_pct: "0.0737",
  });
});

it("AC-0024: a what-if changes no table", async () => {
  await receive();
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  const before = await tableFingerprints();
  expect(await whatIf(2.0)).toHaveLength(1);
  expect(await tableFingerprints()).toEqual(before);
});

it("AC-0025: a what-if is refused for a non-operator and for a bad raw cost", async () => {
  await receive();
  await expectNonOperatorRefusal("price_what_if", { p_raw_product_id: RAW_TOM_ID, p_raw_cost_per_lb: 2 });
  await expectRefusal(whatIfCall(-0.01), "price_what_if: cost must be 0 or above");
  await expectRefusal(whatIfCall(null), "price_what_if: cost must be a finite number");
  await expectRefusal(whatIfCall("NaN"), "price_what_if: cost must be a finite number");
  await expectRefusal(whatIfCall("Infinity"), "price_what_if: cost must be a finite number");
  await expectRefusal(whatIfCall("-Infinity"), "price_what_if: cost must be a finite number");
  expect((await whatIf(0)).map((r) => r.code)).toEqual(["502"]);
});

it("AC-0027: service_role reads the pricing view and the menu view", async () => {
  await receive();
  const service = createTypedClient(stack.apiUrl, stack.serviceRoleKey);
  for (const view of ["v_product_pricing", "v_current_menu"] as const) {
    const res = await service.from(view).select("product_id");
    expect(res.error).toBeNull();
    expect(res.data?.length).toBeGreaterThanOrEqual(1);
  }
});

it("AC-0030: set_target_margin stores 22.5 as 0.2250, 0 as 0, and no value removes it", async () => {
  const read = async () =>
    (await query(`select target_margin_pct::text as t from public.products where id = $1`, [PROD_502_ID]))[0]?.t;
  const set = await setTarget(PROD_502_ID, 22.5);
  expect(set.error).toBeUndefined();
  expect(set.rows?.[0]).toMatchObject({ id: PROD_502_ID, target_margin_pct: "0.2250" });
  expect(await read()).toBe("0.2250");
  expect((await setTarget(PROD_502_ID, 0)).error).toBeUndefined();
  expect(await read()).toBe("0.0000");
  expect((await setTarget(PROD_502_ID, null)).error).toBeUndefined();
  expect(await read()).toBeNull();
});

it("AC-0031: set_target_margin refusals", async () => {
  const bad = (value: Arg, text: string) =>
    expectRefusal(
      { fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: value } },
      `set_target_margin: ${text}`,
    );
  const range = "target must be from 0 up to but not including 100";
  await bad(-0.01, range);
  await bad(100, range);
  await bad(150, range);
  await bad(1.234, "target has more than 2 decimal places");
  await bad("NaN", "target must be a finite number");
  await bad("Infinity", "target must be a finite number");
  await bad("-Infinity", "target must be a finite number");
  await expectRefusal(
    { fn: "set_target_margin", args: { p_product_id: RAW_TOM_ID, p_target_percent: 20 } },
    `set_target_margin: product ${RAW_TOM_ID} is not a finished product`,
  );
  await expectRefusal(
    { fn: "set_target_margin", args: { p_product_id: UNKNOWN_ID, p_target_percent: 20 } },
    `set_target_margin: product ${UNKNOWN_ID} not found`,
  );
  await expectNonOperatorRefusal("set_target_margin", { p_product_id: PROD_502_ID, p_target_percent: 20 });
  await query(`update public.products set active = false where id = $1`, [PROD_502_ID]);
  await expectRefusal(
    { fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: 20 } },
    `set_target_margin: product ${PROD_502_ID} is inactive`,
  );
});

it("AC-0032: set_list_price stores 3.29", async () => {
  const set = await setPrice(PROD_502_ID, 3.29);
  expect(set.error).toBeUndefined();
  expect(set.rows?.[0]).toMatchObject({ id: PROD_502_ID, list_price_per_lb: "3.29" });
  expect((await query(`select list_price_per_lb::text as p from public.products where id = $1`, [PROD_502_ID]))[0]).toEqual({
    p: "3.29",
  });
});

it("AC-0033: set_list_price refusals", async () => {
  const bad = (value: Arg, text: string) =>
    expectRefusal(
      { fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: value } },
      `set_list_price: ${text}`,
    );
  await bad(0, "price must be above 0");
  await bad(-1, "price must be above 0");
  await bad(3.456, "price has more than 2 decimal places");
  await bad(100000000, "price must be below 100000000");
  await bad(null, "price must be a finite number");
  await bad("NaN", "price must be a finite number");
  await bad("Infinity", "price must be a finite number");
  await bad("-Infinity", "price must be a finite number");
  await expectRefusal(
    { fn: "set_list_price", args: { p_product_id: RAW_TOM_ID, p_price_per_lb: 3.29 } },
    `set_list_price: product ${RAW_TOM_ID} is not a finished product`,
  );
  await expectRefusal(
    { fn: "set_list_price", args: { p_product_id: UNKNOWN_ID, p_price_per_lb: 3.29 } },
    `set_list_price: product ${UNKNOWN_ID} not found`,
  );
  await expectNonOperatorRefusal("set_list_price", { p_product_id: PROD_502_ID, p_price_per_lb: 3.29 });
  await query(`update public.products set active = false where id = $1`, [PROD_502_ID]);
  await expectRefusal(
    { fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: 3.29 } },
    `set_list_price: product ${PROD_502_ID} is inactive`,
  );
});

it("AC-0034: a successful write changes only the named column of the named product", async () => {
  await receive();
  expect((await callAsOperator(produceCall(PROD_502_ID, 1000, null, "2026-10-02"))).error).toBeUndefined();
  await addProduct("503");
  const snapshot = async () => ({
    tables: await tableFingerprints(),
    row: (await query<{ r: Record<string, unknown> }>(`select to_jsonb(p) as r from public.products p where id = $1`, [PROD_502_ID]))[0]!.r,
    others: (
      await query<{ h: string }>(
        `select coalesce(string_agg(p::text, '|' order by p.id), '') as h from public.products p where p.id <> $1`,
        [PROD_502_ID],
      )
    )[0]!.h,
  });
  const check = async (write: () => Promise<CallOutcome>, column: string, expected: number) => {
    const before = await snapshot();
    expect((await write()).error).toBeUndefined();
    const after = await snapshot();
    const { products: beforeProducts, ...beforeTables } = before.tables;
    const { products: afterProducts, ...afterTables } = after.tables;
    expect(afterTables).toEqual(beforeTables);
    expect(afterProducts).not.toEqual(beforeProducts);
    expect(after.others).toEqual(before.others);
    expect(after.row).toEqual({ ...before.row, [column]: expected });
  };
  await check(() => setTarget(PROD_502_ID, 22.5), "target_margin_pct", 0.225);
  await check(() => setPrice(PROD_502_ID, 3.29), "list_price_per_lb", 3.29);
});

it("AC-0035: anon and service_role cannot execute the three functions", async () => {
  const signatures = [
    "public.set_target_margin(uuid, numeric)",
    "public.set_list_price(uuid, numeric)",
    "public.price_what_if(uuid, numeric)",
  ];
  for (const signature of signatures) {
    for (const role of ["anon", "service_role"]) {
      const [row] = await query<{ ok: boolean }>(
        `select has_function_privilege($1, $2::regprocedure, 'EXECUTE') as ok`,
        [role, signature],
      );
      expect(row?.ok, `${role} EXECUTE on ${signature}`).toBe(false);
    }
    const [row] = await query<{ ok: boolean }>(
      `select has_function_privilege('authenticated', $1::regprocedure, 'EXECUTE') as ok`,
      [signature],
    );
    expect(row?.ok, `authenticated EXECUTE on ${signature}`).toBe(true);
  }
});

it("AC-0036: a raw product cannot take a target margin or a list price", async () => {
  await expect(
    query(`update public.products set target_margin_pct = 0.1 where id = $1`, [RAW_TOM_ID]),
  ).rejects.toThrow(/products_pricing_finished_only/);
  await expect(
    query(`update public.products set list_price_per_lb = 3.29 where id = $1`, [RAW_TOM_ID]),
  ).rejects.toThrow(/products_pricing_finished_only/);
  expect(
    await query(`select target_margin_pct, list_price_per_lb from public.products where id = $1`, [RAW_TOM_ID]),
  ).toEqual([{ target_margin_pct: null, list_price_per_lb: null }]);
});

it("AC-0037: a finished product's target and list price keep their limits for every writer", async () => {
  for (const value of ["-0.0001", "1", "1.5", "NaN"]) {
    await expect(
      query(`update public.products set target_margin_pct = $2::numeric where id = $1`, [PROD_502_ID, value]),
      `target ${value}`,
    ).rejects.toThrow(/products_target_margin_range/);
  }
  for (const value of ["0", "-1", "NaN"]) {
    await expect(
      query(`update public.products set list_price_per_lb = $2::numeric where id = $1`, [PROD_502_ID, value]),
      `price ${value}`,
    ).rejects.toThrow(/products_list_price_range/);
  }
  expect(
    await query(`select target_margin_pct, list_price_per_lb from public.products where id = $1`, [PROD_502_ID]),
  ).toEqual([{ target_margin_pct: null, list_price_per_lb: null }]);
});

it("AC-0038: every function the migration adds sets search_path to an empty value", async () => {
  const rows = await query<{ proname: string; proconfig: string[] | null }>(
    `select p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('set_target_margin', 'set_list_price', 'price_what_if')
     order by 1`,
  );
  expect(rows.map((r) => r.proname)).toEqual(["price_what_if", "set_list_price", "set_target_margin"]);
  for (const row of rows) expect(row.proconfig, row.proname).toEqual(['search_path=""']);
});

it("the below-target check compares the rounded margin, so 0.19997 shown as 0.2000 is not below target", async () => {
  await receive(1.6802);
  expect((await setTarget(PROD_502_ID, 20)).error).toBeUndefined();
  expect((await setPrice(PROD_502_ID, 3.29)).error).toBeUndefined();
  const row = await pricingRow();
  expect(row).toMatchObject({
    cost_per_lb: "2.6321",
    suggested_list_price: "3.30",
    margin_at_list_pct: "0.2000",
    price_action: "raise",
    needs_new_price: true,
    below_target: false,
  });
});
