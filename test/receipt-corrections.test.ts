import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  adjustCall,
  assertAverageIsStockOnHand,
  assertLedgerInvariants,
  callAsClient,
  closePool,
  correctCall,
  expectRefused,
  getInventoryBalance,
  getOperatorId,
  idOf,
  ledgerViolations,
  produceCall,
  query,
  raceCalls,
  receiveCall,
  resetTestData,
  saleCall,
  saleFixture,
  sqlOf,
  tableFingerprints,
  voidReceiptCall,
  type OpCall,
  type SaleFixture,
} from "./db.js";
import { resolveStackEnv } from "./env.js";
import { NON_OPERATOR_EMAIL, signInNonOperator, signInOperator } from "./users.js";

let operator: TypedClient;
let nonOperator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
  nonOperator = await signInNonOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
  await assertAverageIsStockOnHand();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0012
it("AC-0012: correcting lot A to 1.86 per lb restates batch 1 and leaves batch 2", async () => {
  const fixture = await saleFixture({ sale: true });
  const outcome = await callAsClient(operator, correctCall(fixture.lotAId, 1.86, 5000, "invoice price"));
  expect(outcome.ok, outcome.error).toBe(true);
  const rows = await query<{ raw: string; cost: string }>(
    `select raw_cost_total::text as raw, cost_per_finished_lb::text as cost
     from public.production_batches where id = any($1::uuid[]) order by production_date`,
    [[fixture.batch1Id, fixture.batch2Id]],
  );
  expect(rows).toEqual([
    { raw: "11100.0000", cost: "2.8526" },
    { raw: "1800.0000", cost: "2.7877" },
  ]);
});

// ---- Helpers ----

async function correct(call: OpCall): Promise<void> {
  const outcome = await callAsClient(operator, call);
  expect(outcome.ok, outcome.error).toBe(true);
}

async function setUp(): Promise<SaleFixture> {
  return saleFixture({ sale: true });
}

interface BatchFigures {
  raw: string;
  cost: string;
}

async function batchFigures(ids: string[]): Promise<BatchFigures[]> {
  const rows = await query<BatchFigures>(
    `select raw_cost_total::text as raw, cost_per_finished_lb::text as cost
     from public.production_batches where id = any($1::uuid[]) order by production_date`,
    [ids],
  );
  return rows;
}

// Every figure a correction can restate, read through pg in a fixed order.
async function figures(): Promise<unknown> {
  return {
    batches: await query(
      `select batch_number, raw_cost_total::text, cost_per_finished_lb::text
       from public.production_batches order by production_date, batch_number`,
    ),
    finished: await query(
      `select b.batch_number, f.cost_per_lb::text, f.lbs_remaining::text
       from public.finished_goods f join public.production_batches b on b.id = f.batch_id
       order by b.batch_number`,
    ),
    lines: await query(
      `select b.batch_number, si.cost_per_lb::text, si.lbs_sold::text
       from public.sale_items si
       join public.finished_goods f on f.id = si.finished_goods_id
       join public.production_batches b on b.id = f.batch_id
       order by b.batch_number`,
    ),
    consumption: await query(
      `select b.batch_number, l.lot_number, pbl.lot_unit_cost::text, pbl.lbs_consumed::text
       from public.production_batch_lots pbl
       join public.production_batches b on b.id = pbl.batch_id
       join public.lots l on l.id = pbl.lot_id
       order by b.batch_number, l.lot_number`,
    ),
    balance: await getInventoryBalance(RAW_TOM_ID),
  };
}

async function lotRow(id: string): Promise<Record<string, string>> {
  const [row] = await query<Record<string, string>>(
    `select unit_cost::text, current_unit_cost::text, weight_lbs::text, current_weight_lbs::text,
            remaining_lbs::text
     from public.lots where id = $1`,
    [id],
  );
  return row as Record<string, string>;
}

// ---- Correcting a receipt ----

describe("correct_receipt", () => {
  it("AC-0010: a correction writes one record with the old and new values", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotAId, 1.86, 5000, "invoice price"));
    const rows = await query(
      `select lot_id::text, old_unit_cost::text as old_cost, new_unit_cost::text as new_cost,
              old_weight_lbs::text as old_weight, new_weight_lbs::text as new_weight,
              reason, corrected_at is not null as timed
       from public.receipt_corrections`,
    );
    expect(rows).toEqual([
      {
        lot_id: fixture.lotAId,
        old_cost: "1.6800",
        new_cost: "1.8600",
        old_weight: "5000.000",
        new_weight: "5000.000",
        reason: "invoice price",
        timed: true,
      },
    ]);
  });

  it("AC-0011: the recorded cost stays and the current cost changes", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotAId, 1.86, 5000));
    expect(await lotRow(fixture.lotAId)).toMatchObject({ unit_cost: "1.6800", current_unit_cost: "1.8600" });
  });

  it("AC-0013: the finished lot and the sale line from batch 1 take the new cost", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotAId, 1.86, 5000));
    const finished = await query<{ id: string; cost: string }>(
      `select batch_id::text as id, cost_per_lb::text as cost from public.finished_goods
       where batch_id = any($1::uuid[]) order by produced_date`,
      [[fixture.batch1Id, fixture.batch2Id]],
    );
    expect(finished.map((r) => r.cost)).toEqual(["2.8526", "2.7877"]);
    const lines = await query<{ batch: string; cost: string }>(
      `select f.batch_id::text as batch, si.cost_per_lb::text as cost
       from public.sale_items si join public.finished_goods f on f.id = si.finished_goods_id
       where si.sale_id = $1 order by f.produced_date`,
      [fixture.saleId],
    );
    expect(lines).toEqual([
      { batch: fixture.batch1Id, cost: "2.8526" },
      { batch: fixture.batch2Id, cost: "2.7877" },
    ]);
  });

  it("AC-0014: every consumption row on lot A takes the lot cost 1.8600", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotAId, 1.86, 5000));
    const rows = await query<{ cost: string }>(
      "select lot_unit_cost::text as cost from public.production_batch_lots where lot_id = $1",
      [fixture.lotAId],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.cost === "1.8600")).toBe(true);
  });

  it("AC-0015: correcting lot A leaves RAW-TOM at 1,000 lbs and 1.8000 (lot A is used up)", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotAId, 1.86, 5000));
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 1000, moving_avg_cost: 1.8 });
  });

  it("AC-0016 and AC-0017: correcting lot B to 1.90 restates both batches and moves the average", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 1.9, 3000));
    expect(await batchFigures([fixture.batch1Id, fixture.batch2Id])).toMatchObject([
      { cost: "2.6794" },
      { cost: "2.9175" },
    ]);
    expect((await getInventoryBalance(RAW_TOM_ID))?.moving_avg_cost).toBe(1.9);
  });

  it("AC-0018: a restated batch keeps the processing fees it was costed with", async () => {
    const fixture = await setUp();
    await query(
      `update public.product_fees set amount_per_lb = 0.50
       where product_id = $1 and fee_type_id = (select id from public.fee_types where code = 'overhead')`,
      [PROD_502_ID],
    );
    await correct(correctCall(fixture.lotAId, 1.86, 5000));
    expect(await batchFigures([fixture.batch1Id, fixture.batch2Id])).toMatchObject([
      { cost: "2.8526" },
      { cost: "2.7877" },
    ]);
  });

  it("AC-0019: correcting back returns every figure to its value before", async () => {
    const fixture = await setUp();
    const before = await figures();
    await correct(correctCall(fixture.lotAId, 1.86, 5000, "typo"));
    expect(await figures()).not.toEqual(before);
    await correct(correctCall(fixture.lotAId, 1.68, 5000, "typo undone"));
    expect(await figures()).toEqual(before);
  });

  it("AC-0020: correcting lot B to 3,100 lbs moves its remaining lbs and the stock", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 1.8, 3100));
    expect((await lotRow(fixture.lotBId)).remaining_lbs).toBe("1100.000");
    expect((await getInventoryBalance(RAW_TOM_ID))?.qty_on_hand).toBe(1100);
  });

  it("AC-0021: a weight-only correction changes no batch, finished lot, sale line, or consumption row", async () => {
    const fixture = await setUp();
    const tables = ["production_batches", "finished_goods", "sale_items", "production_batch_lots", "sales"];
    const pick = (all: Record<string, string>) => tables.map((t) => all[t]);
    const before = pick(await tableFingerprints());
    await correct(correctCall(fixture.lotBId, 1.8, 3100));
    expect(pick(await tableFingerprints())).toEqual(before);
  });

  it("AC-0022: correcting lot B to 2,000 lbs leaves 0 remaining and keeps the average", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 1.8, 2000));
    expect((await lotRow(fixture.lotBId)).remaining_lbs).toBe("0.000");
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
  });

  it("AC-0023: correcting lot B to 1,999.999 lbs is refused", async () => {
    const fixture = await setUp();
    await expectRefused(
      operator,
      correctCall(fixture.lotBId, 1.8, 1999.999),
      /correct_receipt: invalid weight 1999\.999, must be at least 2000\.000 lbs/,
    );
  });

  it("AC-0024: after an adjustment to 900 lbs the weight floor is 2,100 lbs", async () => {
    const fixture = await setUp();
    expect((await callAsClient(operator, adjustCall(fixture.lotBId, 900))).ok).toBe(true);
    await expectRefused(
      operator,
      correctCall(fixture.lotBId, 1.8, 2099.999),
      /invalid weight 2099\.999, must be at least 2100\.000 lbs/,
    );
    await correct(correctCall(fixture.lotBId, 1.8, 2100));
    expect((await lotRow(fixture.lotBId)).remaining_lbs).toBe("0.000");
  });

  it("AC-0025: at 0 lbs on hand a cost correction keeps the average", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 1.8, 2000));
    await correct(correctCall(fixture.lotBId, 1.9, 2000));
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
  });

  it("AC-0026: a correction that changes nothing after rounding is refused", async () => {
    const fixture = await setUp();
    await expectRefused(operator, correctCall(fixture.lotAId, 1.68, 5000), /correct_receipt: invalid, nothing to correct/);
    await expectRefused(operator, correctCall(fixture.lotAId, 1.68004, 5000.0004), /nothing to correct/);
  });

  it("AC-0027: a void receipt is refused", async () => {
    await resetTestData();
    const lot = await callAsClient(operator, receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 2, "2026-10-01"));
    expect(lot.ok, lot.error).toBe(true);
    const id = idOf(lot);
    expect((await callAsClient(operator, voidReceiptCall(id))).ok).toBe(true);
    await expectRefused(operator, correctCall(id, 2.5, 100), /correct_receipt: lot .* is already void/);
  });

  it("AC-0028: a null, empty, or white-space reason is refused", async () => {
    const fixture = await setUp();
    for (const reason of [null, "", "   ", " \t\r\n "]) {
      await expectRefused(operator, correctCall(fixture.lotAId, 1.86, 5000, reason), /invalid reason/);
    }
  });

  it("AC-0029: a bad cost or weight is refused", async () => {
    const fixture = await setUp();
    for (const cost of [null, "NaN", -0.01]) {
      await expectRefused(operator, correctCall(fixture.lotAId, cost, 5000), /invalid unit cost, must be 0 or above/);
    }
    for (const weight of [null, "NaN", 0, -5]) {
      await expectRefused(operator, correctCall(fixture.lotAId, 1.86, weight), /invalid weight, must be above 0/);
    }
  });

  it("AC-0030: a lot id that does not exist is refused", async () => {
    await setUp();
    await expectRefused(
      operator,
      correctCall("00000000-0000-0000-0000-000000000099", 1.86, 5000),
      /correct_receipt: invalid lot .*, not found/,
    );
  });

  it("AC-0031: a cost of 0 is accepted", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 0, 3000));
    expect(await batchFigures([fixture.batch1Id, fixture.batch2Id])).toMatchObject([
      { cost: "2.2682" },
      { cost: "0.4500" },
    ]);
  });

  it("AC-0032: a lot corrected twice holds two corrections and the second's values", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotAId, 1.86, 5000, "first"));
    await correct(correctCall(fixture.lotAId, 1.9, 5000, "second"));
    const rows = await query(
      "select new_unit_cost::text as cost, reason from public.receipt_corrections order by correction_seq",
    );
    expect(rows).toEqual([
      { cost: "1.8600", reason: "first" },
      { cost: "1.9000", reason: "second" },
    ]);
    expect(await lotRow(fixture.lotAId)).toMatchObject({ current_unit_cost: "1.9000" });
  });

  it("AC-0033: correcting a third receipt moves the average from 1.9000 to 2.0000", async () => {
    const fixture = await setUp();
    const lotC = await callAsClient(operator, receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 2, "2026-10-07"));
    expect(lotC.ok, lotC.error).toBe(true);
    expect((await getInventoryBalance(RAW_TOM_ID))?.moving_avg_cost).toBe(1.9);
    await correct(correctCall(idOf(lotC), 2.2, 1000));
    expect((await getInventoryBalance(RAW_TOM_ID))?.moving_avg_cost).toBe(2);
    expect(fixture.lotAId).toBeDefined();
  });

  it("AC-0034: a receipt of an inactive raw product can be corrected", async () => {
    const fixture = await setUp();
    await query("update public.products set active = false where id = $1", [RAW_TOM_ID]);
    await correct(correctCall(fixture.lotBId, 1.9, 3000));
    expect(await batchFigures([fixture.batch2Id])).toMatchObject([{ cost: "2.9175" }]);
  });

  it("AC-0035: a sale waits behind a correction and then carries the corrected cost", async () => {
    const fixture = await setUp();
    const [, sale] = await raceCalls(
      correctCall(fixture.lotBId, 1.9, 3000),
      saleCall(PROD_502_ID, 100, 3.29, "2026-10-08"),
    );
    expect(sale.ok, sale.error).toBe(true);
    expect(sale.waitedOn).toBeDefined();
    const [line] = await query<{ cost: string }>(
      "select cost_per_lb::text as cost from public.sale_items where sale_id = $1",
      [idOf(sale)],
    );
    expect(line?.cost).toBe("2.9175");
  });

  it("AC-0036: a correction waits behind a sale and restates the sale's line", async () => {
    const fixture = await setUp();
    const [sale, correction] = await raceCalls(
      saleCall(PROD_502_ID, 100, 3.29, "2026-10-08"),
      correctCall(fixture.lotBId, 1.9, 3000),
    );
    expect(sale.ok, sale.error).toBe(true);
    expect(correction.ok, correction.error).toBe(true);
    expect(correction.waitedOn).toBeDefined();
    const [line] = await query<{ cost: string }>(
      "select cost_per_lb::text as cost from public.sale_items where sale_id = $1",
      [idOf(sale)],
    );
    expect(line?.cost).toBe("2.9175");
  });

  it("AC-0037: a batch waits behind a correction and then draws at the corrected cost", async () => {
    const fixture = await setUp();
    const [, batch] = await raceCalls(
      correctCall(fixture.lotBId, 1.9, 3000),
      produceCall(PROD_502_ID, 500, null, "2026-10-08"),
    );
    expect(batch.ok, batch.error).toBe(true);
    expect(batch.waitedOn).toBeDefined();
    const rows = await query<{ cost: string }>(
      "select lot_unit_cost::text as cost from public.production_batch_lots where batch_id = $1",
      [idOf(batch)],
    );
    expect(rows).toEqual([{ cost: "1.9000" }]);
  });

  it("AC-0061: an untouched receipt corrected to 1,100 lbs can be voided", async () => {
    const lot = await callAsClient(operator, receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-10-01"));
    expect(lot.ok, lot.error).toBe(true);
    await correct(correctCall(idOf(lot), 1.68, 1100));
    expect((await callAsClient(operator, voidReceiptCall(idOf(lot)))).ok).toBe(true);
    expect((await lotRow(idOf(lot))).remaining_lbs).toBe("0.000");
  });

  it("AC-0063: after lot B is corrected to 3,100 lbs it can be adjusted to 1,100 lbs and no higher", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 1.8, 3100));
    await expectRefused(operator, adjustCall(fixture.lotBId, 1100.001), /adjust_lot: invalid new remaining lbs/);
    const outcome = await callAsClient(operator, adjustCall(fixture.lotBId, 1100));
    expect(outcome.ok, outcome.error).toBe(true);
  });

  it("AC-0064: a batch made after a cost correction uses the current cost", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 1.9, 3000));
    const batch = await callAsClient(operator, produceCall(PROD_502_ID, 500, null, "2026-10-08"));
    expect(batch.ok, batch.error).toBe(true);
    const [row] = await query<{ total: string; cost: string }>(
      `select b.raw_cost_total::text as total, pbl.lot_unit_cost::text as cost
       from public.production_batches b join public.production_batch_lots pbl on pbl.batch_id = b.id
       where b.id = $1`,
      [idOf(batch)],
    );
    expect(row).toEqual({ total: "950.0000", cost: "1.9000" });
  });

  it("AC-0065: the trace view gives the current raw lot cost", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotBId, 1.9, 3000));
    const rows = await query<{ cost: string }>(
      "select raw_lot_cost_per_lb::text as cost from public.v_sale_traceability where raw_lot = $1",
      [fixture.lotBNumber],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.cost === "1.9000")).toBe(true);
  });

  it("a correction leaves every lot's prior average as it was entered", async () => {
    await resetTestData();
    const first = await callAsClient(operator, receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 18, "2026-10-02"));
    const second = await callAsClient(operator, receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 2, "2026-10-03"));
    expect(first.ok && second.ok, `${first.error} ${second.error}`).toBe(true);
    await correct(correctCall(idOf(first), 1.8, 1000));
    const [row] = await query<{ prior: string }>(
      "select prior_avg_cost::text as prior from public.lots where id = $1",
      [idOf(second)],
    );
    expect(row?.prior).toBe("18.0000");
  });

  it("AC-0204: no API role holds a privilege on the correction table's identity sequence", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      const [row] = await query<{ ok: boolean }>(
        `select bool_or(has_sequence_privilege($1, 'public.receipt_corrections_correction_seq_seq', p)) as ok
         from unnest(array['USAGE', 'SELECT', 'UPDATE']) p`,
        [role],
      );
      expect(row?.ok, role).toBe(false);
    }
  });

  it("AC-0001: a non-operator's correction fails with 42501 and changes nothing", async () => {
    const fixture = await setUp();
    const lotVoid = await callAsClient(operator, receiveCall(RAW_TOM_ID, VENDOR_ID, 100, 2, "2026-10-01"));
    expect((await callAsClient(operator, voidReceiptCall(idOf(lotVoid)))).ok).toBe(true);
    const bad = "00000000-0000-0000-0000-000000000099";
    const calls: [string, OpCall][] = [
      ["valid", correctCall(fixture.lotBId, 1.9, 3000)],
      ["weight below the floor (AC-0023)", correctCall(fixture.lotBId, 1.8, 1999.999)],
      ["nothing to correct (AC-0026)", correctCall(fixture.lotAId, 1.68, 5000)],
      ["void lot (AC-0027)", correctCall(idOf(lotVoid), 2.5, 100)],
      ["blank reason (AC-0028)", correctCall(fixture.lotAId, 1.86, 5000, "  ")],
      ["empty reason (AC-0028)", correctCall(fixture.lotAId, 1.86, 5000, "")],
      ["spaces, tabs, and line breaks reason (AC-0028)", correctCall(fixture.lotAId, 1.86, 5000, " \t\r\n ")],
      ["null reason (AC-0028)", correctCall(fixture.lotAId, 1.86, 5000, null)],
      ["null cost (AC-0029)", correctCall(fixture.lotAId, null, 5000)],
      ["negative cost (AC-0029)", correctCall(fixture.lotAId, -1, 5000)],
      ["zero weight (AC-0029)", correctCall(fixture.lotAId, 1.86, 0)],
      ["null weight (AC-0029)", correctCall(fixture.lotAId, 1.86, null)],
      ["unknown lot (AC-0030)", correctCall(bad, 1.86, 5000)],
    ];
    const run = async (label: string, call: OpCall) => {
      const before = await tableFingerprints();
      const res = await (nonOperator as unknown as { rpc: (f: string, a: object) => Promise<{ error: { code?: string } | null }> }).rpc(call.fn, call.args);
      expect(res.error?.code, label).toBe("42501");
      expect(await tableFingerprints(), label).toEqual(before);
    };
    for (const [label, call] of calls) await run(label, call);

    // JSON cannot carry NaN, so these go through a pg session that carries the
    // non-operator's claims, the same as the client's token would.
    const nonOperatorId = String((await query("select id from auth.users where email = $1", [NON_OPERATOR_EMAIL]))[0]?.id);
    const pool = new Pool({ connectionString: resolveStackEnv().dbUrl });
    try {
      for (const [label, call] of [
        ["NaN cost (AC-0029)", correctCall(fixture.lotAId, "NaN", 5000)],
        ["NaN weight (AC-0029)", correctCall(fixture.lotAId, 1.86, "NaN")],
      ] as [string, OpCall][]) {
        const before = await tableFingerprints();
        const client = await pool.connect();
        try {
          await client.query("begin");
          await client.query("set local role authenticated");
          await client.query("select set_config('request.jwt.claims', $1, true)", [
            JSON.stringify({ role: "authenticated", sub: nonOperatorId }),
          ]);
          const sql = sqlOf(call);
          await expect(client.query(sql.text, sql.values), label).rejects.toMatchObject({ code: "42501" });
        } finally {
          await client.query("rollback").catch(() => undefined);
          client.release();
        }
        expect(await tableFingerprints(), label).toEqual(before);
      }
    } finally {
      await pool.end();
    }

    // The AC-0024 state: lot B adjusted to 900 lbs, then 2,099.999 lbs.
    expect((await callAsClient(operator, adjustCall(fixture.lotBId, 900))).ok).toBe(true);
    await run("weight below the adjusted floor (AC-0024)", correctCall(fixture.lotBId, 1.8, 2099.999));
  });
});

// ---- Argument checks come before the lock ----

describe("argument checks before the lock", () => {
  const pool = new Pool({ connectionString: resolveStackEnv().dbUrl });
  afterAll(async () => {
    await pool.end();
  });

  it("a weight above 0 that rounds to 0 is refused without waiting on the raw product's stock row", async () => {
    const fixture = await setUp();
    const holder = await pool.connect();
    const session: PoolClient = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query(`select 1 from public.inventory_balances where product_id = '${RAW_TOM_ID}' for update`);
      await session.query("begin");
      await session.query("set local role authenticated");
      await session.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "authenticated", sub: await getOperatorId() }),
      ]);
      // A call that waited on the held row would fail with a lock timeout instead.
      await session.query("set local lock_timeout = '1s'");
      const sql = sqlOf(correctCall(fixture.lotBId, 1.9, 0.0004));
      await expect(session.query(sql.text, sql.values)).rejects.toThrow(
        "correct_receipt: invalid weight, must be above 0",
      );
    } finally {
      await session.query("rollback").catch(() => undefined);
      await holder.query("rollback").catch(() => undefined);
      holder.release();
      session.release();
    }
  });
});

// ---- The ledger checks, each with one violating row in a rolled-back transaction ----

describe("ledger checks name a violation", () => {
  const pool = new Pool({ connectionString: resolveStackEnv().dbUrl });
  afterAll(async () => {
    await pool.end();
  });

  async function named(write: string, check: string, includeAverage = false): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(write);
      const found = await ledgerViolations(client, includeAverage);
      expect(found.map((v) => v.violation.slice(0, 7))).toContain(check);
    } finally {
      await client.query("rollback");
      client.release();
    }
    expect(await ledgerViolations(pool, true)).toEqual([]);
  }

  it("AC-0069: remaining above current weight minus used", async () => {
    const fixture = await setUp();
    await named(`update public.lots set remaining_lbs = 1500 where id = '${fixture.lotBId}'`, "AC-0069");
  });

  it("AC-0070: remaining below current weight minus used minus adjusted", async () => {
    const fixture = await setUp();
    await named(`update public.lots set remaining_lbs = 900 where id = '${fixture.lotBId}'`, "AC-0070");
  });

  it("AC-0074: a consumption row cost that is not the lot's current cost", async () => {
    await setUp();
    await named("update public.production_batch_lots set lot_unit_cost = 9", "AC-0074");
  });

  it("AC-0075: a finished lot cost that is not its batch's", async () => {
    await setUp();
    await named("update public.finished_goods set cost_per_lb = 9", "AC-0075");
  });

  it("AC-0076: a sale line cost that is not its finished lot's", async () => {
    await setUp();
    await named("update public.sale_items set cost_per_lb = 9", "AC-0076");
  });

  it("AC-0077: a batch raw cost total that is not the sum of its consumption rows", async () => {
    await setUp();
    await named("update public.production_batches set raw_cost_total = raw_cost_total + 1", "AC-0077");
  });

  it("AC-0078: a current cost that is not the latest correction's", async () => {
    const fixture = await setUp();
    await correct(correctCall(fixture.lotAId, 1.86, 5000));
    await named(`update public.lots set corrected_unit_cost = 9 where id = '${fixture.lotAId}'`, "AC-0078");
  });

  it("AC-0079: an average that is not the stock-on-hand average", async () => {
    await setUp();
    await named("update public.inventory_balances set moving_avg_cost = 9", "AC-0079", true);
  });
});
