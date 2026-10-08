import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTypedClient } from "../src/lib/supabase.js";
import {
  adjustLot,
  isOperator,
  produceBatch,
  receiveLot,
  recordSale,
  voidReceipt,
  voidSale,
} from "../src/lib/rpc.js";
import { resolveStackEnv } from "./env.js";
import { signInNonOperator, signInOperator, signInPasswordOperator } from "./users.js";
import {
  CUSTOMER_ID,
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  closePool,
  query,
  resetTestData,
  tableFingerprints,
} from "./db.js";

// Access model, checked against the catalog at run time so a new table, view or
// function is covered without editing this file. Every "refused" assertion also
// reads the tables back through pg: row counts and contents must not change.
// Each role signs in once and the session is reused (the local auth limit is 30
// sign-ins per 5 minutes per IP).

const env = resolveStackEnv();

// Dynamic table and function names, so the generated Database type does not apply.
type Loose = SupabaseClient;
const loose = (c: unknown): Loose => c as Loose;

const MASTER_TABLES = ["vendors", "customers", "products", "fee_types", "product_fees"];
const FIRST_COLUMN_FILTER_FALLBACK = "id";

interface Relation {
  name: string;
  kind: string;
}
interface Fn {
  oid: string;
  name: string;
  args: { name: string; type: string }[];
}

let relations: Relation[];
let tables: Relation[];
let ledgerTables: Relation[];
let functions: Fn[];

let anon: Loose;
let nonOperator: Loose;
let operator: Loose;
let service: Loose;
const exercised = new Set<string>();
let lotId: string;
// Arguments that succeed for an operator in the fixture's current state, one
// entry per operation. A new operation needs an entry here.
let validArgs: Record<string, Record<string, unknown>>;

async function loadCatalog(): Promise<void> {
  relations = await query<Relation>(`
    select c.relname as name, c.relkind as kind
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p', 'f')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
    order by 1`);
  tables = relations.filter((r) => r.kind === "r" || r.kind === "p");
  ledgerTables = tables.filter((t) => !MASTER_TABLES.includes(t.name));
  const rows = await query<{ oid: string; name: string; names: string[] | null; types: string[] }>(`
    select p.oid::text as oid, p.proname as name, p.proargnames as names,
           array(select format_type(t, null) from unnest(p.proargtypes) t) as types
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
    order by 2`);
  functions = rows.map((r) => ({
    oid: r.oid,
    name: r.name,
    args: r.types.map((type, i) => ({ name: r.names?.[i] ?? `arg${i + 1}`, type })),
  }));
}

function dummyValue(type: string): unknown {
  switch (type) {
    case "uuid":
      return "00000000-0000-0000-0000-000000000001";
    case "numeric":
    case "integer":
    case "bigint":
    case "smallint":
    case "double precision":
      return 1;
    case "date":
      return "2026-01-01";
    case "boolean":
      return true;
    default:
      return "x";
  }
}

function dummyArgs(fn: Fn): Record<string, unknown> {
  return Object.fromEntries(fn.args.map((a) => [a.name, dummyValue(a.type)]));
}

// Row count and content hash for every public table, read through pg.
const snapshot = tableFingerprints;

async function firstColumn(table: string): Promise<string> {
  const rows = await query<{ name: string }>(
    `select attname as name from pg_attribute
     where attrelid = ('public."' || $1 || '"')::regclass and attnum > 0 and not attisdropped
     order by attnum limit 1`,
    [table],
  );
  return rows[0]?.name ?? FIRST_COLUMN_FILTER_FALLBACK;
}

// One existing row of a table without its identity or generated columns, so a
// write attempt is well formed and only permissions can refuse it.
async function rowTemplate(table: string): Promise<Record<string, unknown>> {
  const rows = await query<{ r: Record<string, unknown> }>(
    `select to_jsonb(t) - coalesce((
        select array_agg(attname::text) from pg_attribute
        where attrelid = ('public."' || $1 || '"')::regclass and attnum > 0 and not attisdropped
          and (attidentity <> '' or attgenerated <> '')), '{}') as r
     from public."${table}" t limit 1`,
    [table],
  );
  const row = { ...(rows[0]?.r ?? {}) };
  if ("id" in row) row.id = randomUUID();
  return row;
}

interface WriteResult {
  error: { code?: string; message: string } | null;
  rows: unknown[];
}

function settle(res: { data: unknown; error: { code?: string; message: string } | null }): WriteResult {
  return { error: res.error, rows: Array.isArray(res.data) ? res.data : [] };
}

function refused(res: WriteResult): boolean {
  return res.error !== null || res.rows.length === 0;
}

async function tryInsert(c: Loose, table: string, row: Record<string, unknown>): Promise<WriteResult> {
  return settle(await c.from(table).insert(row).select());
}
async function tryUpdate(
  c: Loose,
  table: string,
  col: string,
  values: Record<string, unknown>,
): Promise<WriteResult> {
  return settle(await c.from(table).update(values).not(col, "is", null).select());
}
async function tryDelete(c: Loose, table: string, col: string): Promise<WriteResult> {
  return settle(await c.from(table).delete().not(col, "is", null).select());
}

interface Refs {
  productId: string;
  feeTypeId: string;
}

function masterRow(table: string, suffix: string, refs: Refs): Record<string, unknown> {
  switch (table) {
    case "vendors":
      return { name: `Vendor ${suffix}` };
    case "customers":
      return { name: `Customer ${suffix}` };
    case "fee_types":
      return { code: `fee-${suffix}`, name: `Fee ${suffix}`, kind: "processing", sort_order: 99 };
    case "products":
      return { code: `p-${suffix}`, description: `Product ${suffix}`, kind: "raw" };
    case "product_fees":
      return { product_id: refs.productId, fee_type_id: refs.feeTypeId, amount_per_lb: 0.01 };
    default:
      throw new Error(`no master-data payload for ${table}`);
  }
}

const MASTER_UPDATE: Record<string, { col: string; value: unknown }> = {
  vendors: { col: "name", value: "Vendor renamed" },
  customers: { col: "name", value: "Customer renamed" },
  fee_types: { col: "name", value: "Fee renamed" },
  products: { col: "description", value: "Product renamed" },
  product_fees: { col: "amount_per_lb", value: 0.02 },
};

// Insert then update one row in each master-data table as `c`, then read each
// change back through pg.
async function masterRound(c: Loose): Promise<void> {
  const suffix = randomUUID().slice(0, 8);
  const refs: Refs = { productId: PROD_502_ID, feeTypeId: "" };
  const order = ["vendors", "customers", "fee_types", "products", "product_fees"];
  expect([...order].sort()).toEqual([...MASTER_TABLES].sort());
  for (const table of order) {
    const ins = await c.from(table).insert(masterRow(table, suffix, refs)).select().single();
    expect(ins.error, `${table} insert`).toBeNull();
    const row = ins.data as Record<string, unknown>;
    if (table === "fee_types") refs.feeTypeId = String(row.id);
    if (table === "products") refs.productId = String(row.id);

    const key = table === "product_fees" ? { product_id: row.product_id, fee_type_id: row.fee_type_id } : { id: row.id };
    const upd = MASTER_UPDATE[table]!;
    let q = c.from(table).update({ [upd.col]: upd.value });
    for (const [k, v] of Object.entries(key)) q = q.eq(k, v as string);
    const res = await q.select();
    expect(res.error, `${table} update`).toBeNull();
    expect(res.data, `${table} update rows`).toHaveLength(1);

    const where = Object.keys(key).map((k, i) => `${k} = $${i + 1}`).join(" and ");
    const back = await query<Record<string, unknown>>(
      `select ${upd.col}::text as v from public."${table}" where ${where}`,
      Object.values(key),
    );
    const seen = back[0]?.v;
    expect(typeof upd.value === "number" ? Number(seen) : seen, `${table} read-back`).toBe(upd.value);
  }
}

beforeAll(async () => {
  await loadCatalog();
  anon = loose(createTypedClient(env.apiUrl, env.anonKey));
  service = loose(createTypedClient(env.apiUrl, env.serviceRoleKey));
  nonOperator = loose(await signInNonOperator());
  const operatorTyped = await signInOperator();
  operator = loose(operatorTyped);

  // Fixture: at least one row in every table and view, through the operations.
  await resetTestData();
  const lot = await receiveLot(operatorTyped, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: 1000,
    unitCost: 2,
    received: "2026-05-12",
  });
  exercised.add("receive_lot");
  lotId = lot.id;
  await produceBatch(operatorTyped, {
    finishedProductId: PROD_502_ID,
    rawLbsIn: 500,
    productionDate: "2026-05-13",
  });
  exercised.add("produce_batch");
  await recordSale(operatorTyped, {
    finishedProductId: PROD_502_ID,
    lbs: 100,
    pricePerLb: 5,
    customerId: CUSTOMER_ID,
    saleDate: "2026-05-14",
  });
  exercised.add("record_sale");

  // Corrections: a lot adjustment row, a void lot, and a void sale. The first
  // sale stays non-void, so the trace view keeps a row.
  const adjusted = await receiveLot(operatorTyped, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: 800,
    unitCost: 3,
    received: "2026-05-12",
  });
  await adjustLot(operatorTyped, { lotId: adjusted.id, newRemainingLbs: 700, reason: "count" });
  exercised.add("adjust_lot");
  const doomed = await receiveLot(operatorTyped, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: 100,
    unitCost: 3,
    received: "2026-05-12",
  });
  await voidReceipt(operatorTyped, doomed.id, "access fixture");
  exercised.add("void_receipt");
  const wrongSale = await recordSale(operatorTyped, {
    finishedProductId: PROD_502_ID,
    lbs: 10,
    pricePerLb: 5,
    saleDate: "2026-05-14",
  });
  await voidSale(operatorTyped, wrongSale.id, "access fixture");
  exercised.add("void_sale");
  expect(await isOperator(operatorTyped), "operator passes check_operator").toBe(true);
  exercised.add("check_operator");

  // Targets that stay valid: an untouched lot to void, a sale to void, a lot to adjust.
  const untouched = await receiveLot(operatorTyped, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: 50,
    unitCost: 2,
    received: "2026-05-12",
  });
  const spare = await recordSale(operatorTyped, {
    finishedProductId: PROD_502_ID,
    lbs: 5,
    pricePerLb: 5,
    saleDate: "2026-05-14",
  });
  validArgs = {
    receive_lot: {
      p_product_id: RAW_TOM_ID,
      p_vendor_id: VENDOR_ID,
      p_weight_lbs: 10,
      p_unit_cost: 2,
      p_received: "2026-05-12",
    },
    produce_batch: {
      p_finished_product_id: PROD_502_ID,
      p_raw_lbs_in: 10,
      p_production_date: "2026-05-20",
    },
    record_sale: {
      p_finished_product_id: PROD_502_ID,
      p_lbs: 10,
      p_price_per_lb: 5,
      p_sale_date: "2026-05-21",
    },
    void_receipt: { p_lot_id: untouched.id, p_reason: "access test" },
    void_sale: { p_sale_id: spare.id, p_reason: "access test" },
    adjust_lot: { p_lot_id: adjusted.id, p_new_remaining_lbs: 600, p_reason: "count" },
    check_operator: {},
  };
});

afterAll(async () => {
  await closePool();
});

describe("Access model", () => {
  it("AC-0001: anon reads no relation, calls no function, and sees no GraphQL collection", async () => {
    expect(relations.length).toBeGreaterThan(0);
    expect(functions.length).toBeGreaterThan(0);
    const before = await snapshot();

    for (const r of relations) {
      const res = await anon.from(r.name).select("*").limit(1);
      expect(res.error?.code, `anon read ${r.name}`).toBe("42501");
    }
    for (const fn of functions) {
      const res = await anon.rpc(fn.name, dummyArgs(fn));
      expect(res.error?.code, `anon rpc ${fn.name}`).toBe("42501");
    }
    expect(await snapshot()).toEqual(before);

    const response = await fetch(`${env.apiUrl}/graphql/v1`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: env.anonKey,
        authorization: `Bearer ${env.anonKey}`,
      },
      body: JSON.stringify({
        query: "{ __schema { queryType { fields { name } } mutationType { fields { name } } } }",
      }),
    });
    const body = (await response.json()) as {
      data?: {
        __schema: {
          queryType: { fields: { name: string }[] } | null;
          mutationType: { fields: { name: string }[] } | null;
        };
      };
    };
    expect(body.data, "GraphQL introspection answered").toBeDefined();
    const schema = body.data!.__schema;
    const fields = [...(schema.queryType?.fields ?? []), ...(schema.mutationType?.fields ?? [])].map(
      (f) => f.name.toLowerCase().replace(/_/g, ""),
    );
    for (const r of relations) {
      const base = r.name.toLowerCase().replace(/_/g, "");
      expect(
        fields.filter((f) => f.startsWith(base) && f.includes("collection")),
        `GraphQL collection for ${r.name}`,
      ).toEqual([]);
    }
    for (const fn of functions) {
      expect(fields, `GraphQL field for ${fn.name}`).not.toContain(fn.name.toLowerCase().replace(/_/g, ""));
    }
  });

  it("AC-0002, AC-0003, AC-0005: a signed-in non-operator reads nothing and calls no operation", async () => {
    const before = await snapshot();
    for (const r of relations) {
      const res = await nonOperator.from(r.name).select("*").limit(1);
      const denied = res.error?.code === "42501";
      expect(denied || (res.data ?? []).length === 0, `non-operator read ${r.name}`).toBe(true);
    }
    for (const fn of functions) {
      // Arguments that would succeed for an operator, so only the caller check can refuse.
      expect(validArgs[fn.name], `fixture has valid arguments for ${fn.name}`).toBeDefined();
      const res = await nonOperator.rpc(fn.name, validArgs[fn.name]!);
      expect(res.error?.code, `non-operator rpc ${fn.name}`).toBe("42501");
    }
    expect(await snapshot()).toEqual(before);
  });

  it("AC-0005: the operator's call succeeds with the same arguments", async () => {
    for (const fn of functions) {
      const res = await operator.rpc(fn.name, validArgs[fn.name]!);
      expect(res.error, `operator rpc ${fn.name}`).toBeNull();
    }
  });

  it("AC-0004: the operator reads at least one row from every table and view and runs every operation", async () => {
    for (const r of relations) {
      const res = await operator.from(r.name).select("*").limit(1);
      expect(res.error, `operator read ${r.name}`).toBeNull();
      expect((res.data ?? []).length, `operator rows in ${r.name}`).toBeGreaterThanOrEqual(1);
    }
    // The fixture calls each operation through the operator session. A new
    // function needs a valid call added to the fixture.
    for (const fn of functions) {
      expect(exercised.has(fn.name), `fixture exercises ${fn.name}`).toBe(true);
    }
  });

  it("AC-0052: service_role cannot execute any public function", async () => {
    for (const fn of functions) {
      const [row] = await query<{ ok: boolean }>(
        "select has_function_privilege('service_role', $1::oid, 'EXECUTE') as ok",
        [fn.oid],
      );
      expect(row?.ok, `service_role EXECUTE on ${fn.name}`).toBe(false);
      const res = await service.rpc(fn.name, dummyArgs(fn));
      expect(res.error?.code, `service_role rpc ${fn.name}`).toBe("42501");
    }
  });

  it("AC-0055: service_role inserts then updates a row in each master-data table", async () => {
    await masterRound(service);
  });

  it("AC-0008: the operator inserts then updates a row in each master-data table", async () => {
    await masterRound(operator);
  });

  it("AC-0006, AC-0007, AC-0009: direct writes to ledger tables are refused for every role", async () => {
    const roles: [string, Loose][] = [
      ["anon", anon],
      ["non-operator", nonOperator],
      ["operator", operator],
      ["service_role", service],
    ];
    for (const t of ledgerTables) {
      const col = await firstColumn(t.name);
      const template = await rowTemplate(t.name);
      const updateCol = Object.keys(template).find((k) => k !== col) ?? col;
      const updateValues = { [updateCol]: template[updateCol] ?? null };
      for (const [role, c] of roles) {
        const before = await snapshot();
        for (const [verb, res] of [
          ["insert", await tryInsert(c, t.name, template)],
          ["update", await tryUpdate(c, t.name, col, updateValues)],
          ["delete", await tryDelete(c, t.name, col)],
        ] as const) {
          expect(refused(res), `${role} ${verb} ${t.name}`).toBe(true);
          expect(res.error?.code, `${role} ${verb} ${t.name} code`).toBe("42501");
        }
        expect(await snapshot(), `${role} left ${t.name} unchanged`).toEqual(before);
      }
    }
  });

  it("AC-0006, AC-0007, AC-0009: master-data writes are refused to anon and non-operators, and deletes to every role", async () => {
    const [cutting] = await query<{ id: string }>("select id from fee_types where code = 'cutting'");
    const refs: Refs = { productId: PROD_502_ID, feeTypeId: cutting!.id };
    const suffix = randomUUID().slice(0, 8);

    for (const t of MASTER_TABLES) {
      const col = await firstColumn(t);
      const upd = MASTER_UPDATE[t]!;
      for (const [role, c] of [["anon", anon], ["non-operator", nonOperator]] as [string, Loose][]) {
        const before = await snapshot();
        const results = [
          ["insert", await tryInsert(c, t, masterRow(t, `${role}-${suffix}`, refs))],
          ["update", await tryUpdate(c, t, col, { [upd.col]: upd.value })],
          ["delete", await tryDelete(c, t, col)],
        ] as const;
        for (const [verb, res] of results) expect(refused(res), `${role} ${verb} ${t}`).toBe(true);
        expect(await snapshot(), `${role} left ${t} unchanged`).toEqual(before);
      }
      for (const [role, c] of [["operator", operator], ["service_role", service]] as [string, Loose][]) {
        const before = await snapshot();
        const res = await tryDelete(c, t, col);
        expect(refused(res), `${role} delete ${t}`).toBe(true);
        expect(await snapshot(), `${role} left ${t} unchanged`).toEqual(before);
      }
    }
  });

  it("AC-0012: no role can update lots.unit_cost directly", async () => {
    const roles: [string, Loose][] = [
      ["anon", anon],
      ["non-operator", nonOperator],
      ["operator", operator],
      ["service_role", service],
    ];
    const [original] = await query<{ unit_cost: string }>("select unit_cost from lots where id = $1", [lotId]);
    for (const [role, c] of roles) {
      const before = await snapshot();
      const res = settle(await c.from("lots").update({ unit_cost: 99 }).eq("id", lotId).select());
      expect(refused(res), `${role} update lots.unit_cost`).toBe(true);
      const [after] = await query<{ unit_cost: string }>("select unit_cost from lots where id = $1", [lotId]);
      expect(after?.unit_cost, `${role} left unit_cost`).toBe(original?.unit_cost);
      expect(await snapshot(), `${role} left tables unchanged`).toEqual(before);
    }
  });

  it("AC-0010: sign-up is refused and creates no user", async () => {
    const email = `signup-${randomUUID().slice(0, 8)}@meat-ops.test`;
    const { data, error } = await anon.auth.signUp({ email, password: "a-long-enough-password-1" });
    expect(error?.status).toBe(422);
    expect(error?.code).toBe("signup_disabled");
    expect(data.user).toBeNull();
    const rows = await query("select 1 from auth.users where email = $1", [email]);
    expect(rows).toEqual([]);
  });

  it("AC-0011: the password floor is 12 characters", async () => {
    const client = loose(await signInPasswordOperator());
    const tooShort = await client.auth.updateUser({ password: "eleven-char" });
    expect("eleven-char".length).toBe(11);
    expect(tooShort.error).not.toBeNull();

    const ok = await client.auth.updateUser({ password: "twelve-chars" });
    expect("twelve-chars".length).toBe(12);
    expect(ok.error).toBeNull();
  });
});
