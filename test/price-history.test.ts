import { afterAll, beforeEach, expect, it } from "vitest";
import {
  callAsOperator,
  closePool,
  getOperatorId,
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
afterAll(async () => {
  await closePool();
});

const setListPrice = (price: number) =>
  callAsOperator({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: price } });

// STUB: AC-0067
it("AC-0067: set_list_price records each change with the old and new price and the cost then", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).error).toBeUndefined();
  expect((await setListPrice(2.68)).error).toBeUndefined();
  expect((await setListPrice(3.29)).error).toBeUndefined();
  expect(
    await query(
      `select old_price::text, new_price::text, cost_per_lb::text, baseline, changed_at is not null as dated
       from private.list_price_changes where product_id = $1 order by seq`,
      [PROD_502_ID],
    ),
  ).toEqual([
    { old_price: null, new_price: "2.68", cost_per_lb: "2.6318", baseline: false, dated: true },
    { old_price: "2.68", new_price: "3.29", cost_per_lb: "2.6318", baseline: false, dated: true },
  ]);
});

const history = (productId = PROD_502_ID) =>
  query(
    `select old_price::text, new_price::text, baseline from private.list_price_changes
     where product_id = $1 order by seq`,
    [productId],
  );

// One multi-statement query runs on one connection and in one transaction, so
// `set local role` holds for the statements after it.
async function asRole(role: "authenticated" | "service_role" | "anon", statement: string): Promise<void> {
  const claims =
    role === "authenticated"
      ? JSON.stringify({ role, sub: await getOperatorId() })
      : JSON.stringify({ role });
  await query(`set local role ${role}; select set_config('request.jwt.claims', '${claims}', true); ${statement}`);
}

const SET_PRICE = `update public.products set list_price_per_lb = 4.10 where id = '${PROD_502_ID}'`;

// AC-0068
it("AC-0068: a direct update as the operator, service_role, and postgres, and an insert, each record one row", async () => {
  await asRole("authenticated", SET_PRICE);
  expect(await history()).toEqual([{ old_price: null, new_price: "4.10", baseline: false }]);
  await asRole("service_role", SET_PRICE.replace("4.10", "4.20"));
  expect(await history()).toHaveLength(2);
  await query(SET_PRICE.replace("4.10", "4.30"));
  expect(await history()).toEqual([
    { old_price: null, new_price: "4.10", baseline: false },
    { old_price: "4.10", new_price: "4.20", baseline: false },
    { old_price: "4.20", new_price: "4.30", baseline: false },
  ]);

  const newId = "88888888-8888-8888-8888-888888888888";
  await query(
    `insert into public.products(id, code, description, species, kind, raw_product_id, shrink_pct, list_price_per_lb)
     values ($1, '503', 'Smoked Turkey Wings', 'Turkey', 'finished', $2, 0.2, 5.55)`,
    [newId, RAW_TOM_ID],
  );
  expect(await history(newId)).toEqual([{ old_price: null, new_price: "5.55", baseline: false }]);
  await query(
    `insert into public.products(id, code, description, species, kind, raw_product_id, shrink_pct)
     values ('99999999-9999-9999-9999-999999999999', '504', 'No price', 'Turkey', 'finished', $1, 0.2)`,
    [RAW_TOM_ID],
  );
  expect(await query("select 1 from private.list_price_changes where product_id = '99999999-9999-9999-9999-999999999999'")).toEqual([]);
});

it("AC-0184: an update that leaves the list price unchanged records no row", async () => {
  expect((await setListPrice(2.68)).error).toBeUndefined();
  await query(`update public.products set list_price_per_lb = 2.68, description = 'Renamed' where id = '${PROD_502_ID}'`);
  await query(`update public.products set description = 'Renamed again' where id = '${PROD_502_ID}'`);
  expect(await history()).toEqual([{ old_price: null, new_price: "2.68", baseline: false }]);
});

it("AC-0069: a change for a product whose raw input has no cost records no cost per lb", async () => {
  expect((await setListPrice(2.68)).error).toBeUndefined();
  expect(await query("select cost_per_lb from private.list_price_changes where product_id = $1", [PROD_502_ID])).toEqual([
    { cost_per_lb: null },
  ]);
});

it("AC-0070: the baseline step gives each priced product one baseline row and a product with no price none", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).error).toBeUndefined();
  await query(
    `insert into public.products(id, code, description, species, kind, raw_product_id, shrink_pct)
     values ('99999999-9999-9999-9999-999999999999', '504', 'No price', 'Turkey', 'finished', '${RAW_TOM_ID}', 0.2)`,
  );
  await query(
    `alter table public.products disable trigger user;
     update public.products set list_price_per_lb = 3.29 where id = '${PROD_502_ID}';
     alter table public.products enable trigger user;`,
  );
  expect(await history()).toEqual([]);
  await query("select private.baseline_list_prices()");
  expect(
    await query("select product_id, old_price::text, new_price::text, cost_per_lb::text, baseline from private.list_price_changes"),
  ).toEqual([{ product_id: PROD_502_ID, old_price: null, new_price: "3.29", cost_per_lb: "2.6318", baseline: true }]);
  // A rerun adds nothing.
  await query("select private.baseline_list_prices()");
  expect(await history()).toHaveLength(1);
});

it("AC-0071: anon, authenticated, and service_role can neither read nor change the history", async () => {
  expect((await setListPrice(2.68)).error).toBeUndefined();
  const statements = [
    "select * from private.list_price_changes",
    "insert into private.list_price_changes(product_id, new_price) select id, 1 from public.products limit 1",
    "update private.list_price_changes set new_price = 9",
    "delete from private.list_price_changes",
    "truncate private.list_price_changes",
  ];
  for (const role of ["anon", "authenticated", "service_role"] as const) {
    for (const statement of statements) {
      await expect(asRole(role, statement), `${role}: ${statement}`).rejects.toMatchObject({ code: "42501" });
    }
  }
  expect(await history()).toEqual([{ old_price: null, new_price: "2.68", baseline: false }]);
});

it("AC-0188: nothing the migration adds in private grants a privilege to anon, authenticated, or service_role", async () => {
  const roles = ["anon", "authenticated", "service_role"];
  const fns = await query<{ oid: string; name: string }>(
    `select p.oid::text, p.proname as name from pg_proc p
     where p.pronamespace = 'private'::regnamespace
       and p.proname in ('record_list_price_change', 'baseline_list_prices')`,
  );
  expect(fns.map((f) => f.name).sort()).toEqual(["baseline_list_prices", "record_list_price_change"]);
  for (const fn of fns) {
    for (const role of roles) {
      const [row] = await query<{ ok: boolean }>("select has_function_privilege($1, $2::oid, 'EXECUTE') as ok", [role, fn.oid]);
      expect(row?.ok, `${role} EXECUTE on ${fn.name}`).toBe(false);
    }
  }
  const seqs = await query<{ name: string }>(
    `select c.relname as name from pg_class c
     where c.relnamespace = 'private'::regnamespace and c.relkind = 'S' and c.relname like 'list_price_changes%'`,
  );
  expect(seqs).toEqual([{ name: "list_price_changes_seq_seq" }]);
  for (const seq of seqs) {
    for (const role of roles) {
      for (const priv of ["USAGE", "SELECT", "UPDATE"]) {
        const [row] = await query<{ ok: boolean }>("select has_sequence_privilege($1, $2, $3) as ok", [
          role,
          `private.${seq.name}`,
          priv,
        ]);
        expect(row?.ok, `${role} ${priv} on ${seq.name}`).toBe(false);
      }
    }
  }
});
