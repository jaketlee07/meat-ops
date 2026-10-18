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
  reverseCall,
  saleCall,
  saleFixture,
  sqlOf,
  tableFingerprints,
  voidReceiptCall,
  voidSaleCall,
  type OpCall,
  type SaleFixture,
} from "./db.js";
import { resolveStackEnv } from "./env.js";
import { signInNonOperator, signInOperator } from "./users.js";

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

// STUB: AC-0044
it("AC-0044: reversing batch 2 voids the 5,000-lb sale with the batch's reason and time", async () => {
  const fixture = await saleFixture({ sale: true });
  const outcome = await callAsClient(operator, reverseCall(fixture.batch2Id, "entered twice"));
  expect(outcome.ok, outcome.error).toBe(true);
  const batchNumber = (
    await query<{ n: string }>("select batch_number as n from public.production_batches where id = $1", [
      fixture.batch2Id,
    ])
  )[0]?.n;
  const rows = await query<{ reason: string; same_time: boolean }>(
    `select s.void_reason as reason, s.voided_at = b.reversed_at as same_time
     from public.sales s cross join public.production_batches b
     where s.id = $1 and b.id = $2`,
    [fixture.saleId, fixture.batch2Id],
  );
  expect(rows).toEqual([{ reason: `Reversed with batch ${batchNumber}: entered twice`, same_time: true }]);
});

// ---- Helpers ----

async function reverse(batchId: string, reason = "entered twice"): Promise<void> {
  const outcome = await callAsClient(operator, reverseCall(batchId, reason));
  expect(outcome.ok, outcome.error).toBe(true);
}

async function ok(call: OpCall): Promise<string> {
  const outcome = await callAsClient(operator, call);
  expect(outcome.ok, outcome.error).toBe(true);
  return idOf(outcome);
}

async function remaining(lotId: string): Promise<string> {
  const [row] = await query<{ r: string }>("select remaining_lbs::text as r from public.lots where id = $1", [lotId]);
  return String(row?.r);
}

async function finishedRemaining(batchId: string): Promise<string> {
  const [row] = await query<{ r: string }>(
    "select lbs_remaining::text as r from public.finished_goods where batch_id = $1",
    [batchId],
  );
  return String(row?.r);
}

// 502's finished lbs on hand: every finished lot's remaining lbs.
async function finishedOnHand(): Promise<string> {
  const [row] = await query<{ r: string }>(
    "select coalesce(sum(lbs_remaining), 0)::text as r from public.finished_goods where finished_product_id = $1",
    [PROD_502_ID],
  );
  return String(row?.r);
}

async function batchNumber(batchId: string): Promise<string> {
  const [row] = await query<{ n: string }>("select batch_number as n from public.production_batches where id = $1", [
    batchId,
  ]);
  return String(row?.n);
}

interface SaleState {
  voided: boolean;
  reason: string | null;
}

async function saleState(saleId: string): Promise<SaleState> {
  const [row] = await query<{ voided: boolean; reason: string | null }>(
    "select voided_at is not null as voided, void_reason as reason from public.sales where id = $1",
    [saleId],
  );
  return row as SaleState;
}

const REFUSED_REASON = /reverse_batch: invalid reason, give at least one non-space character/;

// ---- Reversing a batch ----

describe("reverse_batch", () => {
  it("AC-0040: reversing batch 2 marks it reversed with the reason and a time", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch2Id);
    const rows = await query(
      `select reversal_reason, reversed_at is not null as timed
       from public.production_batches where id = any($1::uuid[]) order by production_date`,
      [[fixture.batch1Id, fixture.batch2Id]],
    );
    expect(rows).toEqual([
      { reversal_reason: null, timed: false },
      { reversal_reason: "entered twice", timed: true },
    ]);
  });

  it("AC-0041: after reversing batch 2, lot B has 2,000 lbs remaining", async () => {
    const fixture = await saleFixture();
    expect(await remaining(fixture.lotBId)).toBe("1000.000");
    await reverse(fixture.batch2Id);
    expect(await remaining(fixture.lotBId)).toBe("2000.000");
  });

  it("AC-0042: after reversing batch 2, its finished lot is empty and 502 has 4,620 finished lbs", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch2Id);
    expect(await finishedRemaining(fixture.batch2Id)).toBe("0.000");
    expect(await finishedOnHand()).toBe("4620.000");
  });

  it("AC-0043: reversing batch 1 leaves lot A with 5,000 lbs and lot B with 2,000 lbs", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch1Id);
    expect(await remaining(fixture.lotAId)).toBe("5000.000");
    expect(await remaining(fixture.lotBId)).toBe("2000.000");
  });

  it("AC-0052: after reversing batch 1, RAW-TOM's average is 1.7143", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch1Id);
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 7000, moving_avg_cost: 1.7143 });
  });

  it("AC-0044: the reversal returns the batch and the sale is voided with its reason", async () => {
    const fixture = await saleFixture({ sale: true });
    const outcome = await callAsClient(operator, reverseCall(fixture.batch2Id, "entered twice"));
    expect(outcome.ok, outcome.error).toBe(true);
    expect(outcome.rows?.[0]).toMatchObject({ id: fixture.batch2Id, reversal_reason: "entered twice" });
    expect(await saleState(fixture.saleId!)).toEqual({
      voided: true,
      reason: `Reversed with batch ${await batchNumber(fixture.batch2Id)}: entered twice`,
    });
  });

  it("AC-0045: after the reversal, batch 1's finished lot has 4,620 lbs and 502 has 4,620 on hand", async () => {
    const fixture = await saleFixture({ sale: true });
    expect(await finishedOnHand()).toBe("390.000");
    await reverse(fixture.batch2Id);
    expect(await finishedRemaining(fixture.batch1Id)).toBe("4620.000");
    expect(await finishedRemaining(fixture.batch2Id)).toBe("0.000");
    expect(await finishedOnHand()).toBe("4620.000");
  });

  it("AC-0046: a sale that was already void keeps its own reason and time", async () => {
    const fixture = await saleFixture({ sale: true });
    await ok(voidSaleCall(fixture.saleId!, "wrong customer"));
    const before = await query("select void_reason, voided_at from public.sales where id = $1", [fixture.saleId]);
    await reverse(fixture.batch2Id);
    expect(await query("select void_reason, voided_at from public.sales where id = $1", [fixture.saleId])).toEqual(
      before,
    );
    expect(before[0]).toMatchObject({ void_reason: "wrong customer" });
  });

  it("AC-0047: a sale with no line on the reversed batch's finished lot is not voided", async () => {
    const fixture = await saleFixture();
    // Dated before batch 2, so it can draw only batch 1.
    const saleId = await ok(saleCall(PROD_502_ID, 1000, 3.29, "2026-10-06"));
    await reverse(fixture.batch2Id);
    expect(await saleState(saleId)).toEqual({ voided: false, reason: null });
  });

  it("AC-0048: reversing a reversed batch is refused and changes nothing", async () => {
    const fixture = await saleFixture({ sale: true });
    await reverse(fixture.batch2Id);
    await expectRefused(
      operator,
      reverseCall(fixture.batch2Id),
      new RegExp(`reverse_batch: batch ${fixture.batch2Id} is already reversed`),
    );
  });

  it("AC-0049: a blank reason or an unknown batch is refused and changes nothing", async () => {
    const fixture = await saleFixture({ sale: true });
    for (const reason of [null, "", "   ", " \t\r\n "]) {
      await expectRefused(operator, reverseCall(fixture.batch2Id, reason), REFUSED_REASON);
    }
    const unknown = "00000000-0000-0000-0000-000000000099";
    await expectRefused(operator, reverseCall(unknown), new RegExp(`reverse_batch: invalid batch ${unknown}, not found`));
  });

  it("AC-0050: a reversal waits behind a sale and then voids it", async () => {
    const fixture = await saleFixture();
    const [sale, reversal] = await raceCalls(
      saleCall(PROD_502_ID, 4700, 3.29, "2026-10-08"),
      reverseCall(fixture.batch2Id, "entered twice"),
    );
    expect(sale.ok, sale.error).toBe(true);
    expect(reversal.ok, reversal.error).toBe(true);
    expect(reversal.waitedOn).toBeDefined();
    expect(await saleState(idOf(sale))).toEqual({
      voided: true,
      reason: `Reversed with batch ${await batchNumber(fixture.batch2Id)}: entered twice`,
    });
  });

  it("AC-0051: a sale waits behind a reversal and is then refused for a shortfall", async () => {
    const fixture = await saleFixture();
    const [reversal, sale] = await raceCalls(
      reverseCall(fixture.batch2Id),
      saleCall(PROD_502_ID, 4700, 3.29, "2026-10-08"),
    );
    expect(reversal.ok, reversal.error).toBe(true);
    expect(sale.ok).toBe(false);
    expect(sale.error).toMatch(/record_sale: shortfall/);
    expect(sale.waitedOn).toBeDefined();
  });

  it("AC-0053: a batch waits behind a reversal and then draws 1,500 lbs from lot B", async () => {
    const fixture = await saleFixture();
    const [reversal, batch] = await raceCalls(
      reverseCall(fixture.batch2Id),
      produceCall(PROD_502_ID, 1500, null, "2026-10-08"),
    );
    expect(reversal.ok, reversal.error).toBe(true);
    expect(batch.ok, batch.error).toBe(true);
    expect(batch.waitedOn).toBeDefined();
    const rows = await query(
      "select lot_id, lbs_consumed::text as lbs from public.production_batch_lots where batch_id = $1",
      [idOf(batch)],
    );
    expect(rows).toEqual([{ lot_id: fixture.lotBId, lbs: "1500.000" }]);
  });

  it("AC-0054: a batch of an inactive finished product can be reversed", async () => {
    const fixture = await saleFixture();
    await query("update public.products set active = false where id = $1", [PROD_502_ID]);
    await reverse(fixture.batch2Id);
    const [row] = await query<{ reversed: boolean }>(
      "select reversed_at is not null as reversed from public.production_batches where id = $1",
      [fixture.batch2Id],
    );
    expect(row?.reversed).toBe(true);
    expect(await remaining(fixture.lotBId)).toBe("2000.000");
  });
});

// ---- The operations that now skip reversed batches ----

describe("operations after a reversal", () => {
  it("AC-0060: a receipt whose only batch was reversed can be voided", async () => {
    const lotId = await ok(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-10-01"));
    const batchId = await ok(produceCall(PROD_502_ID, 1000, null, "2026-10-02"));
    await reverse(batchId);
    await ok(voidReceiptCall(lotId));
    const [row] = await query<{ voided: boolean; remaining: string }>(
      "select voided_at is not null as voided, remaining_lbs::text as remaining from public.lots where id = $1",
      [lotId],
    );
    expect(row).toEqual({ voided: true, remaining: "0.000" });
  });

  it("AC-0062: after reversing batch 2, adjust_lot accepts lot B at 2,000 lbs and refuses 2,000.001", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch2Id);
    await expectRefused(operator, adjustCall(fixture.lotBId, 2000.001), /adjust_lot: invalid new remaining lbs/);
    await ok(adjustCall(fixture.lotBId, 2000));
    expect(await remaining(fixture.lotBId)).toBe("2000.000");
  });

  it("AC-0066: voiding receipts after a reversed batch gives the average the last void lot carried", async () => {
    // RAW-TOM at 0 lbs on hand with an average of 1.8000.
    const first = await ok(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.8, "2026-10-01"));
    await ok(adjustCall(first, 0, "waste"));
    const l1 = await ok(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 18, "2026-10-02"));
    const l2 = await ok(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 20, "2026-10-03"));
    const l3 = await ok(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 2, "2026-10-04"));
    const batchId = await ok(produceCall(PROD_502_ID, 2500, null, "2026-10-05"));
    await reverse(batchId);
    await ok(adjustCall(l3, 0, "waste"));
    await ok(voidReceiptCall(l1));
    await ok(voidReceiptCall(l2));
    expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
  });

  it("AC-0067: void_receipt refuses lot B, which batch 1 still uses, after batch 2 is reversed", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch2Id);
    await expectRefused(
      operator,
      voidReceiptCall(fixture.lotBId),
      new RegExp(`void_receipt: invalid, lot ${fixture.lotBId} has been consumed`),
    );
  });
});

// ---- The catalog ----

describe("catalog", () => {
  it("AC-0202: correct_receipt and reverse_batch are SECURITY DEFINER with search_path empty", async () => {
    const rows = await query(
      `select p.proname, p.prosecdef, p.proconfig
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname in ('correct_receipt', 'reverse_batch')
       order by 1`,
    );
    expect(rows).toEqual([
      { proname: "correct_receipt", prosecdef: true, proconfig: ['search_path=""'] },
      { proname: "reverse_batch", prosecdef: true, proconfig: ['search_path=""'] },
    ]);
  });

  it("AC-0001: a non-operator's reversal fails with 42501 and changes nothing", async () => {
    const fixture = await saleFixture({ sale: true });
    await reverse(fixture.batch1Id);
    const bad = "00000000-0000-0000-0000-000000000099";
    const calls: [string, OpCall][] = [
      ["valid", reverseCall(fixture.batch2Id)],
      ["reversed batch (AC-0048)", reverseCall(fixture.batch1Id)],
      ["blank reason (AC-0049)", reverseCall(fixture.batch2Id, "  ")],
      ["null reason (AC-0049)", reverseCall(fixture.batch2Id, null)],
      ["unknown batch (AC-0049)", reverseCall(bad)],
    ];
    for (const [label, call] of calls) {
      const before = await tableFingerprints();
      const res = await (
        nonOperator as unknown as { rpc: (f: string, a: object) => Promise<{ error: { code?: string } | null }> }
      ).rpc(call.fn, call.args);
      expect(res.error?.code, label).toBe("42501");
      expect(await tableFingerprints(), label).toEqual(before);
    }
  });
});

// ---- AC-0038: every pair, both orders ----

type Op = "receive_lot" | "produce_batch" | "void_receipt" | "adjust_lot" | "record_sale" | "void_sale" | "correct_receipt" | "reverse_batch";

interface PairFixture extends SaleFixture {
  lotCId: string;
}

// One call per operation that succeeds alone over the sale fixture with a third
// receipt, lot C, which nothing uses. `slot` picks a different target when a
// pair holds the same operation twice.
function callFor(op: Op, f: PairFixture, slot: 0 | 1): OpCall {
  switch (op) {
    case "receive_lot":
      return receiveCall(RAW_TOM_ID, VENDOR_ID, 500, 1.7, "2026-10-09");
    case "produce_batch":
      return produceCall(PROD_502_ID, 500, null, "2026-10-08");
    case "void_receipt":
      return voidReceiptCall(f.lotCId);
    case "adjust_lot":
      return adjustCall(f.lotBId, 500);
    case "record_sale":
      return saleCall(PROD_502_ID, 100, 3.29, "2026-10-08");
    case "void_sale":
      return voidSaleCall(f.saleId!);
    case "correct_receipt":
      return slot === 0 ? correctCall(f.lotBId, 1.9, 3000) : correctCall(f.lotAId, 1.86, 5000);
    case "reverse_batch":
      return reverseCall(slot === 0 ? f.batch2Id : f.batch1Id);
  }
}

const OTHERS: Op[] = ["receive_lot", "produce_batch", "void_receipt", "adjust_lot", "record_sale", "void_sale"];
const PAIRS: [Op, Op][] = [
  ...OTHERS.map((op): [Op, Op] => ["correct_receipt", op]),
  ["correct_receipt", "correct_receipt"],
  ["correct_receipt", "reverse_batch"],
  ...OTHERS.map((op): [Op, Op] => ["reverse_batch", op]),
  ["reverse_batch", "reverse_batch"],
];
const ORDERED = PAIRS.flatMap(([a, b]): [string, Op, Op][] => [
  [`${a} then ${b}`, a, b],
  [`${b} then ${a}`, b, a],
]);

describe("AC-0038: a correction or reversal beside any other operation", () => {
  it.each(ORDERED)("AC-0038: %s keeps the invariants", async (_name, first, second) => {
    const fixture = await saleFixture({ sale: true });
    const lotCId = await ok(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 2, "2026-10-09"));
    const f: PairFixture = { ...fixture, lotCId };
    const same = first === second;
    const [a, b] = await raceCalls(callFor(first, f, 0), callFor(second, f, same ? 1 : 0));
    expect(a.ok, `${first}: ${a.error}`).toBe(true);
    // The second call may be refused by the first's result, never by a lock failure.
    expect(b.error ?? "", `${second}`).not.toMatch(/deadlock|timeout|could not serialize/);
    await assertLedgerInvariants();
    await assertAverageIsStockOnHand();
  });
});

// ---- AC-0039 and AC-0055: lock order, read from pg_locks ----

describe("lock order", () => {
  const pool = new Pool({ connectionString: resolveStackEnv().dbUrl });
  afterAll(async () => {
    await pool.end();
  });
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // A holder takes one row lock. The call starts on an operator session and is
  // seen waiting. Returns the relations the waiting backend holds a RowShareLock
  // or RowExclusiveLock on, read before the holder rolls back.
  async function relationsHeldWhileWaiting(holdSql: string, call: OpCall): Promise<string[]> {
    const holder = await pool.connect();
    const session: PoolClient = await pool.connect();
    try {
      await holder.query("begin");
      await holder.query(holdSql);
      await session.query("begin");
      await session.query("set local role authenticated");
      await session.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "authenticated", sub: await getOperatorId() }),
      ]);
      const pid = Number((await session.query("select pg_backend_pid() as pid")).rows[0].pid);
      const sql = sqlOf(call);
      const pending = session.query(sql.text, sql.values).then(
        () => undefined,
        (err: unknown) => err,
      );
      let waiting = false;
      for (let i = 0; i < 200 && !waiting; i++) {
        const { rows } = await pool.query(
          "select 1 from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'",
          [pid],
        );
        waiting = rows.length > 0;
        if (!waiting) await sleep(15);
      }
      expect(waiting, `${call.fn} was seen waiting`).toBe(true);
      const { rows } = await pool.query(
        `select distinct c.relname
         from pg_locks l join pg_class c on c.oid = l.relation
         where l.pid = $1 and l.locktype = 'relation' and l.granted
           and l.mode in ('RowShareLock', 'RowExclusiveLock')
         order by 1`,
        [pid],
      );
      await holder.query("rollback");
      expect(await pending, `${call.fn} finished after the holder rolled back`).toBeUndefined();
      return rows.map((r) => String(r.relname));
    } finally {
      await holder.query("rollback").catch(() => undefined);
      await session.query("rollback").catch(() => undefined);
      holder.release();
      session.release();
    }
  }

  const operations = (f: SaleFixture): [string, OpCall][] => [
    ["correct_receipt", correctCall(f.lotBId, 1.9, 3000)],
    ["reverse_batch", reverseCall(f.batch2Id)],
  ];

  it.each(["correct_receipt", "reverse_batch"])(
    "AC-0039: %s takes the raw product's stock row before any other row",
    async (name) => {
      const fixture = await saleFixture({ sale: true });
      const call = operations(fixture).find(([n]) => n === name)![1];
      const held = await relationsHeldWhileWaiting(
        `select 1 from public.inventory_balances where product_id = '${RAW_TOM_ID}' for update`,
        call,
      );
      expect(held).toContain("inventory_balances");
      expect(held.filter((r) => !r.startsWith("inventory_balances"))).toEqual([]);
    },
  );

  it.each(["correct_receipt", "reverse_batch"])(
    "AC-0055: %s takes the finished product's products row before any batch, finished lot, or sale row",
    async (name) => {
      const fixture = await saleFixture({ sale: true });
      const call = operations(fixture).find(([n]) => n === name)![1];
      const held = await relationsHeldWhileWaiting(
        `select 1 from public.products where id = '${PROD_502_ID}' for no key update`,
        call,
      );
      expect(held).toContain("inventory_balances");
      for (const table of ["production_batches", "finished_goods", "sales", "sale_items"]) {
        expect(held, table).not.toContain(table);
      }
    },
  );
});

// ---- The ledger checks, each with one violating row in a rolled-back transaction ----

describe("ledger checks name a violation", () => {
  const pool = new Pool({ connectionString: resolveStackEnv().dbUrl });
  afterAll(async () => {
    await pool.end();
  });

  async function named(write: string, check: string, absent: string[] = []): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(write);
      const found = (await ledgerViolations(client)).map((v) => v.violation.slice(0, 7));
      expect(found).toContain(check);
      for (const other of absent) expect(found).not.toContain(other);
    } finally {
      await client.query("rollback");
      client.release();
    }
    expect(await ledgerViolations(pool, true)).toEqual([]);
  }

  it("AC-0068: a finished lot of a batch that is not reversed with the wrong remaining lbs", async () => {
    const fixture = await saleFixture({ sale: true });
    await named(
      `update public.finished_goods set lbs_remaining = lbs_remaining - 1 where batch_id = '${fixture.batch2Id}'`,
      "AC-0068",
    );
  });

  it("AC-0068: a reversed batch's finished lot is checked by AC-0072, not AC-0068", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch2Id);
    await named(
      `update public.finished_goods set lbs_remaining = 1 where batch_id = '${fixture.batch2Id}'`,
      "AC-0072",
      ["AC-0068"],
    );
  });

  it("AC-0071: a void lot with a consumption row of a batch that is not reversed", async () => {
    const fixture = await saleFixture();
    await named(
      `update public.lots set voided_at = now(), void_reason = 'x', remaining_lbs = 0 where id = '${fixture.lotBId}'`,
      "AC-0071",
    );
  });

  it("AC-0071: a void lot whose only consumption rows belong to a reversed batch is not flagged", async () => {
    const lotId = await ok(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.68, "2026-10-01"));
    await reverse(await ok(produceCall(PROD_502_ID, 1000, null, "2026-10-02")));
    await ok(voidReceiptCall(lotId));
    expect(await ledgerViolations(pool, true)).toEqual([]);
  });

  it("AC-0072: a reversed batch's finished lot with lbs remaining", async () => {
    const fixture = await saleFixture();
    await reverse(fixture.batch2Id);
    await named(
      `update public.finished_goods set lbs_remaining = 5 where batch_id = '${fixture.batch2Id}'`,
      "AC-0072",
    );
  });

  it("AC-0073: a reversed batch's finished lot with a line of a non-void sale", async () => {
    const fixture = await saleFixture({ sale: true });
    await reverse(fixture.batch2Id);
    await named(
      `update public.sales set voided_at = null, void_reason = null where id = '${fixture.saleId}'`,
      "AC-0073",
    );
  });
});
