# Plan: foundation-hardening

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** engine contract in `SYSTEM-SPEC.md` §5 and §6; analogous implementations are the three functions in `supabase/migrations/0001_init.sql`; their tests are `test/costing.test.ts` with setup in `test/db.ts`, `test/env.ts`, `test/global-setup.ts`. Named deviation: the repository has no precedent for RLS, policies, `SECURITY DEFINER`, or auth users. Those mechanisms follow the Supabase security checklist (supabase skill, read 2026-10-07) and the Supabase changelog entry of 2026-04-28, which stops exposing new `public` tables to the Data API by default. Each migration therefore revokes the local default privileges on its new objects and grants every permission explicitly.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/foundation-hardening/notes/verification-ledger.md`.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material.

## Approach

The work lands as five dependency-ordered layers. Each leaves `npm test` green.

1. Remove the lot-cost hook and narrow the `supabase db` permission, because the hook blocks writing the immutability test.
2. Rewrite the three engine functions in one new migration. They gain the caller check, locking, validation, date rules, insertion-order FIFO, and the stock-on-hand average. The same migration adds the operator allowlist and the lot freeze trigger. The test harness gains the localhost guard first, then operator and non-operator users, and the golden and engine suites move onto the operator.
3. Lock down access in a second migration: RLS, grants, `security_invoker` views, sign-up off, and 12-character passwords.
4. Add the three correction operations and the trace view changes in a third migration, and extend the access and race tests over the new objects.
5. Bring `SYSTEM-SPEC.md`, the costing reference, the architecture overview, and agent guidance up to date.

The riskiest part is layer 3. One missed grant leaves a hole, and one extra revoke breaks the app path. Two independent nets catch it: the catalog-driven access tests (AC-0001 to AC-0009) and the Supabase security advisor (AC-0051).

Migrations are created with `supabase migration new <name>` and applied locally with `supabase migration up`.

## Constraints

- `SYSTEM-SPEC.md` §2, §6, and §11, as amended by this spec for six operations.
- The numeric expectations in `test/costing.test.ts` stay unchanged. Changing them is an ask-first boundary.
- No ADR or RFC governs this area.

## Construction tests

**Integration tests:** every TDD test except AC-0042 is an integration test against the local stack (`npm test`).
**Ledger-invariant `afterEach`:** every suite that changes lots (`test/costing.test.ts`, `test/engine.test.ts`, `test/corrections.test.ts`) runs one helper from `test/db.ts` after each test. It checks AC-0030, AC-0031, AC-0054, and AC-0032 for every raw product, lot, and finished lot with catalog-wide queries; before T4 the adjustment term of AC-0031 is 0. T4 extends it to subtract adjustments, to count only non-void sale lines, and to check AC-0033.
**Race harness:** one helper in `test/db.ts` runs two calls together. Session A opens a transaction and makes its call. Session B makes its call. The helper polls until B's backend shows `wait_event_type = 'Lock'` in `pg_stat_activity` or B's call has already settled (pairs that do not contend, such as `produce_batch` with `record_sale`, never wait), then commits A and awaits B. Both sessions run `set local role authenticated` and set `request.jwt.claims` to the operator's id, so they pass the same caller check as the app. It returns each call's outcome so a test can count successes, and AC-0015 tests also assert AC-0028 for the raw product afterwards.
**Manual verification:** none. No user-facing surface ships in this spec.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Costing reference / `docs/costing.md` | T5 | File restored and updated | Each expected-result figure in it appears in a passing assertion in `test/costing.test.ts`, `test/engine.test.ts`, or `test/corrections.test.ts` |
| Master brief / `SYSTEM-SPEC.md` | T5 | Diff touches only the sections the spec's Master brief row lists | Each amendment in the spec's Master brief row is present |
| Architecture and access model / `docs/architecture/overview.md` | T5 | Overview names the allowlist, the write path per role, the `service_role` master-data exception, and the owner-account steps | Steps match `private.operators` in the T2 migration |
| Agent guidance / `AGENTS.md` | T5 | AC-0047, AC-0048, AC-0049 checks | Each of the 7 hard rules in the spec's closed list is present |
| Interface compatibility / `src/lib/` | T2, T3, T4 | AC-0046 check; `npm run typecheck` | Typecheck passes on the closing commit |

The access model and caller rules in the LLD go to the architecture overview. The average, zero-stock, void, and adjustment rules go to `docs/costing.md`. Locking, ordering columns, and trigger mechanics are mechanically inferable from the migrations.

## Design (LLD)

### Design decisions

- **Operations are `SECURITY DEFINER` in `public` with `set search_path = ''` and schema-qualified names.** EXECUTE goes to `authenticated` only. `PUBLIC`, `anon`, and `service_role` are revoked, because no admin path needs the operations; the seed runs as `postgres`, which owns them. Rejected: `SECURITY INVOKER` with RLS write policies, because operators could then write ledger tables directly (AC-0006). Traces to AC-0001, AC-0003, AC-0006, AC-0051.
- **One caller check, `private.assert_caller()`, runs first in every operation.** It reads `current_setting('request.jwt.claims', true)` and treats NULL and the empty string as missing. Missing claims are allowed only when `session_user` is `postgres` or `supabase_admin`; that is the seed and test-setup path (AC-0045). A role claim of `authenticated` is allowed only when `sub` is in `private.operators`. Everything else raises SQLSTATE `42501`. `session_user` is used because `current_user` inside a `SECURITY DEFINER` body is the owner. Rejected: `auth.role()`, which Supabase has deprecated. Traces to AC-0003, AC-0005.
- **One balance refresh, `private.refresh_balance(raw_product_id, zero_stock_avg)`, recomputes `qty_on_hand` and the stock-on-hand average from lots.** Every operation that changes lots calls it after taking the balance-row lock. When the remaining sum is 0, it keeps the stored average, except that `void_receipt` passes the `prior_avg_cost` of the first lot, in FIFO order, among the product's void lots after its last non-void lot. `receive_lot` records `prior_avg_cost` from the balance row before it adds the lot (0 when the product has no balance yet). Rejected: the incremental weighted formula, which drifts once FIFO consumes lots. Traces to AC-0028, AC-0029, AC-0030, AC-0053.
- **Serialization by row lock.** `receive_lot`, `produce_batch`, `void_receipt`, and `adjust_lot` lock the raw product's `inventory_balances` row `FOR UPDATE` before reading stock, so any two of them on one raw product run one after the other. `record_sale` and `void_sale` lock the finished product's `products` row `FOR NO KEY UPDATE`, which does not block the foreign-key checks `produce_batch` makes. Every precondition is read after the lock. A shortfall check after each FIFO loop stays as a second net. Traces to AC-0013 to AC-0017.
- **Insertion-order FIFO.** Identity columns `lots.receipt_seq` and `finished_goods.produced_seq` break ties after the date. Rejected: `created_at`, which is equal within one transaction. Traces to AC-0027.
- **Frozen lot columns by trigger.** `private.lots_guard()` runs `BEFORE UPDATE` on `lots` and raises when any of `unit_cost`, `weight_lbs`, `product_id`, `vendor_id`, `received_date`, `lot_number`, or `prior_avg_cost` changes. Traces to AC-0012.
- **Voids mark, never delete.** `voided_at` and `void_reason` on `lots` and `sales`; a reason is refused when it is NULL or `btrim(reason) = ''`. Traces to AC-0034 to AC-0037.
- **The operator allowlist lives in `private`,** which the Data API does not expose (`supabase/config.toml` `[api] schemas`). Every `private` function has `PUBLIC` EXECUTE revoked. `authenticated` gets USAGE on `private` and EXECUTE on `private.is_operator()` only, which is `SECURITY DEFINER` so RLS policies can call it. Traces to AC-0002, AC-0004.

### Data & schema

- New: `private.operators (user_id uuid primary key references auth.users(id) on delete cascade, added_at timestamptz not null default now())`.
- New: `public.lot_adjustments (id uuid pk, lot_id uuid not null references lots, old_remaining_lbs numeric(14,3) not null, new_remaining_lbs numeric(14,3) not null, reason text not null check (reason in ('count','waste','spoilage','other')), note text, adjusted_at timestamptz not null default now())`.
- Changed (T2): `lots` gains `receipt_seq bigint generated always as identity` and `prior_avg_cost numeric(12,4)`; `vendor_id` becomes `not null`. The migration fills `prior_avg_cost` for existing lots with their product's current `moving_avg_cost` before it creates the freeze trigger.
- Changed (T4): `lots` gains `voided_at timestamptz` and `void_reason text`.
- Changed: `finished_goods` gains `produced_seq bigint generated always as identity`.
- Changed: `sales` gains `voided_at timestamptz`, `void_reason text`.
- Dropped: `public.reset_test_data()`, if present.
- RLS is enabled on every `public` table. Every table has a `SELECT` policy `to authenticated using ((select private.is_operator()))`. Master-data tables add `INSERT` and `UPDATE` policies with the same predicate in `USING` and `WITH CHECK`. There are no `DELETE` policies.
- Grants, per role:
  - `anon`: nothing on any `public` table, view, or function.
  - `authenticated`: `SELECT` on every `public` table and view; `INSERT, UPDATE` on master-data tables; EXECUTE on the six operations.
  - `service_role`: `SELECT` on every `public` table and view; `INSERT, UPDATE` on master-data tables (owner exception, 2026-10-07); no `DELETE` anywhere; no write on ledger tables; no EXECUTE on operations.
- Auth config (`supabase/config.toml`): `[auth] enable_signup = false`, `[auth.email] enable_signup = false`, `minimum_password_length = 12`.

### Interfaces & contracts

The three existing signatures stay the same, so `src/lib/rpc.ts` call sites do not change. New operations:

- `void_receipt(p_lot_id uuid, p_reason text) returns public.lots`
- `void_sale(p_sale_id uuid, p_reason text) returns public.sales`
- `adjust_lot(p_lot_id uuid, p_new_remaining_lbs numeric, p_reason text, p_note text default null) returns public.lots`

`v_sale_traceability` gains `sale_item_id` and `customer` (a left join, so a sale with no customer stays in the trace), and excludes void sales. New wrappers: `voidReceipt`, `voidSale`, `adjustLot` in `src/lib/rpc.ts`, and `getTraceByLot` in `src/lib/views.ts`.

### Behavior & rules

- Quantities (`receive_lot` weight, `produce_batch` raw lbs in, `record_sale` lbs) must be non-NULL, not NaN, and above 0. Money (`receive_lot` unit cost, `record_sale` price) must be non-NULL, not NaN, and 0 or above.
- Measured yield: NULL means `round(raw_lbs_in × (1 − shrink_pct), 3)`. Otherwise it must be not NaN, above 0, and at most `raw_lbs_in`.
- Products must be active and of the right kind. `produce_batch` also requires the raw input to be active.
- `produce_batch` reads only lots with `received_date <= p_production_date`; `record_sale` reads only finished goods with `produced_date <= p_sale_date`. Availability and consumption use the same filter.
- `void_receipt` requires a void reason, `remaining_lbs = weight_lbs`, no `production_batch_lots` row for the lot, no `lot_adjustments` row, and the lot not already void.
- `adjust_lot` requires a non-void lot, a value from 0 to `weight_lbs − consumed lbs`, and a known reason.
- `void_sale` requires a void reason and a non-void sale, and returns each line's `lbs_sold` to its `finished_goods` row.
- Errors carry the operation name and one keyword (`shortfall`, `invalid`, `inactive`, `void`, `not allowed`) so tests match on the keyword.

### Failure, edge cases & resilience

- Two writers on one product: the second waits on the row lock, then re-reads stock and preconditions and fails if they no longer hold (AC-0013, AC-0014, AC-0016).
- A batch whose eligible lots run out mid-loop raises `shortfall` and rolls back the whole call (AC-0017).
- Zero stock after production or an adjustment keeps the previous average (AC-0029); zero stock after a void restores the voided lot's prior average (AC-0053).

## Tasks

### T1: Lot-cost hook removed and remote database commands no longer pre-approved

**Depends on:** none
**Touches:** .claude/hooks/guard-lot-cost.py, .claude/settings.json

**Tests:**
- AC-0050: `grep -rl guard-lot-cost .claude` prints nothing, and a `python3 -c` JSON read of `.claude/settings.json` finds no `permissions.allow` entry that starts with `Bash(supabase` and contains `*`. No stub (goal-based).

**Approach:**
- Delete `.claude/hooks/guard-lot-cost.py` and the `PreToolUse` block that runs it.
- Replace `Bash(supabase db:*)` with exact local forms: `Bash(supabase db reset)`, `Bash(supabase migration up)`, `Bash(supabase db advisors --local --type security --fail-on warn)`.

**Done when:** the AC-0050 checks in Tests pass, and `npm test` stays green.

### T2: Engine operations are locked, validated, ordered, and average from stock on hand

**Depends on:** T1
**Touches:** supabase/migrations/*_engine_hardening.sql, src/lib/database.types.ts, test/engine.test.ts, test/costing.test.ts, test/env.test.ts, test/db.ts, test/env.ts, test/global-setup.ts, test/users.ts

**Tests:**
- `AC-0042: refuses a database URL whose host is not local` and `AC-0042: refuses an API URL whose host is not local` (AC-0042), stub: true. Validated 2026-10-07: `tsc --noEmit` passes; red under `vitest run` with `expected [Function] to throw an error` on both. Harness: a `git archive` copy in session scratch, run under `sandbox-exec` with outbound network denied except localhost, writes to the repository denied, a 120 s alarm, and `--cache=false`; no database contact.

```ts
import { afterEach, describe, expect, it } from "vitest";
import { resolveStackEnv } from "./env.js";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe("Test-harness safety", () => {
  // STUB: AC-0042
  it("AC-0042: refuses a database URL whose host is not local", () => {
    process.env.API_URL = "http://127.0.0.1:54321";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL = "postgresql://postgres:postgres@db.example.com:5432/postgres";
    expect(() => resolveStackEnv()).toThrow(/not local/);
  });

  // STUB: AC-0042
  it("AC-0042: refuses an API URL whose host is not local", () => {
    process.env.API_URL = "https://example.supabase.co";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    expect(() => resolveStackEnv()).toThrow(/not local/);
  });
});
```

- `AC-0028: the average after production is the stock-on-hand average` (AC-0028), stub: true. Validated 2026-10-07: `tsc --noEmit` passes; red under `vitest run` with `expected 1.725 to be 1.8`. Harness: as above; declared side effect: the local test database is truncated.

```ts
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTypedClient, type TypedClient } from "../src/lib/supabase.js";
import { produceBatch, receiveLot } from "../src/lib/rpc.js";
import { resolveStackEnv } from "./env.js";
import {
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  closePool,
  getInventoryBalance,
  resetTestData,
} from "./db.js";

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

describe("Engine hardening", () => {
  // STUB: AC-0028
  it("AC-0028: the average after production is the stock-on-hand average", async () => {
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
      rawLbsIn: 5000,
      productionDate: "2026-05-20",
    });

    const balance = await getInventoryBalance(RAW_TOM_ID);
    expect(balance?.moving_avg_cost).toBe(1.8);
  });
});
```

- AC-0042 build-out: a `DB_URL` of `postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=db.example.com` and one with an empty host are refused. The guard uses the standard `URL` parser, refuses an empty host, and refuses any `host` query parameter, because `pg` lets that parameter replace the URL host.
- AC-0012 (`postgres`): an `UPDATE` of each frozen column through a plain `pg` session is refused, and a re-read shows the lot unchanged.
- AC-0013, AC-0014: the race harness. Fixture for AC-0013: one 1,000 lb raw lot and two finished products made from it; each call needs 800 raw lbs. Fixture for AC-0014: 100 lbs of finished stock; each sale needs 80 lbs.
- AC-0015 (pairs within {`receive_lot`, `produce_batch`} on one raw product, and within {`produce_batch`, `record_sale`} on one finished product): the race harness, then the ledger-invariant helper.
- AC-0017: after each successful call in the engine suite, `sum(lbs_consumed)` for the batch and `sum(lbs_sold)` for the sale equal the requested amounts.
- AC-0018, AC-0019, AC-0020, AC-0021: a table per operation over NULL, `'NaN'`, 0, and -1 (0 is valid for money), plus one valid measured yield. NaN goes through a `pg` session with operator claims, because JSON cannot carry it. Each refusal leaves row counts unchanged; each paired valid call succeeds.
- AC-0022, AC-0023, AC-0024, AC-0025: refusal cases for NULL vendor, unknown vendor, inactive raw, inactive finished, inactive raw input, and wrong kind for each operation, each with a row-count check.
- AC-0026: lots received 2026-05-12 and 2026-05-19; a batch dated 2026-05-15 for more than the first lot fails with `shortfall`; a sale dated before its batch fails the same way.
- AC-0027: two same-date lots with different costs received in one `pg` transaction, and two same-date batches produced in one transaction; a batch smaller than the first lot draws only from the first-received lot, and a sale smaller than the first batch draws only from the first-produced finished lot, on 5 repeated runs.
- AC-0029: receive 1,000 lbs at 2.00, produce all 1,000 raw lbs, and `moving_avg_cost` stays 2.0000; then receive 1,000 lbs at 2.40, produce all of it, and the average stays 2.4000.
- AC-0030, AC-0031, AC-0054, AC-0032: the ledger-invariant `afterEach` in `test/engine.test.ts` and `test/costing.test.ts`.
- AC-0043 (costing and engine files): `grep -nE 'serviceRoleKey|SERVICE_ROLE_KEY|createTypedClient|createClient' test/costing.test.ts test/engine.test.ts` prints nothing. No stub (goal-based).
- AC-0045: after `supabase db reset`, `docker exec -i supabase_db_meat-ops psql -U postgres -v ON_ERROR_STOP=1 < supabase/seed.sql` exits 0. No stub (goal-based).

**Approach:**
- Materialize the AC-0042 stub and land the guard in `test/env.ts` first, before any setup change that writes.
- `supabase migration new engine_hardening`. In it, create schema `private`, `private.operators`, `private.is_operator()`, `private.assert_caller()`, `private.refresh_balance()`, and `private.lots_guard()` with its trigger. Revoke `PUBLIC` EXECUTE on every `private` function.
- Add the identity columns, make `lots.vendor_id` not null, and replace the three functions per the LLD with their grants.
- `test/global-setup.ts`: create an operator and a non-operator user through the admin API and insert the operator into `private.operators` through `pg`. `test/users.ts`: sign-in helpers. `test/env.ts`: expose `ANON_KEY`.
- `supabase migration up`, then `npm run gen:types`.
- Materialize the AC-0028 stub, prove its red, then move its client to the operator and fill the remaining tests. Move `test/costing.test.ts` to the operator client.

**Done when:** every test named in this task's Tests is green, the AC-0043 and AC-0045 commands give the stated results, and the 7 tests in `test/costing.test.ts` still pass.

### T3: Only a signed-in operator reaches data and operations

**Depends on:** T2
**Touches:** supabase/migrations/*_access_lockdown.sql, supabase/config.toml, src/lib/database.types.ts, test/access.test.ts, test/users.ts, test/global-setup.ts

**Tests:**
- The catalog fixture is `no stub (implementation-discovered)`. Discovery predicate: the anon key and user sessions are available from the T2 harness. Proof obligation: the AC-0001 test goes red against the T2 schema before this task's migration is applied.
- AC-0001: `test/access.test.ts` lists `public` tables and views from `pg_class` and `public` functions from `pg_proc` at run time. For each, the anon REST read or RPC returns code `42501`, and a GraphQL `__schema` query with the anon key lists no collection field for it. RPC arguments come from `proargnames` with type-valid dummy values.
- AC-0002, AC-0003, AC-0004, AC-0005: a fixture puts at least one row in every `public` table and view through the operations. The non-operator gets `42501` or 0 rows from each relation and `42501` from every `public` function in the catalog, with `pg` row counts unchanged. The operator gets at least 1 row from each relation and success from each operation.
- AC-0052: `has_function_privilege('service_role', oid, 'EXECUTE')` is false for every `public` function in the catalog list.
- AC-0055: the `service_role` client inserts then updates one row in each master-data table, and a `pg` read sees the update.
- AC-0006, AC-0007, AC-0009: direct insert, update, and delete on each ledger table for anon, non-operator, operator, and `service_role`; insert, update, and delete on each master-data table for anon and non-operator; delete on each master-data table for the operator and `service_role`. Each returns an error or changes no rows, with `pg` row counts and values unchanged.
- AC-0008: the operator inserts then updates one row in each master-data table, and a `pg` read sees the update.
- AC-0010: `auth.signUp` with a fresh email returns an error and `auth.users` has no row for it.
- AC-0011: a second operator, created by global setup only for this test, calls `auth.updateUser` with an 11-character password and gets an error, then with a 12-character password and succeeds. No other test signs in as that user.
- AC-0012 (anon, non-operator, operator, `service_role`): a direct `UPDATE` of `lots.unit_cost` is refused and the lot is unchanged.
- AC-0044: `select count(*) from pg_proc where proname = 'reset_test_data'` returns 0. No stub (goal-based).
- AC-0051: `supabase db advisors --local --type security --fail-on warn` exits 0. No stub (goal-based).

**Approach:**
- `supabase migration new access_lockdown`: enable RLS, add policies, set the per-role grants, `alter view ... set (security_invoker = true)` on the three views, and `drop function if exists public.reset_test_data()`.
- Set the auth config per the LLD, then `supabase stop` and `supabase start` so auth reloads.

**Done when:** every test named in this task's Tests is green, the AC-0044 and AC-0051 commands give the stated results, and the 7 tests in `test/costing.test.ts` still pass.

### T4: The owner can void receipts and sales, adjust lots, and trace from a lot

**Depends on:** T3
**Touches:** supabase/migrations/*_corrections.sql, src/lib/database.types.ts, src/lib/rpc.ts, src/lib/views.ts, test/corrections.test.ts, test/access.test.ts, test/db.ts

**Tests:**
- `no stub (implementation-discovered)`. Discovery predicate: the generated `Database["public"]["Functions"]` entries for `void_receipt`, `void_sale`, and `adjust_lot`, and the new `v_sale_traceability` columns, exist only after this task's migration and `npm run gen:types`. Proof obligation: each test below goes red against a migration whose three functions raise `not implemented`, before the bodies are written.
- AC-0015 (the 10 remaining pairs, each involving `void_receipt`, `adjust_lot`, or `void_sale`): the race harness, then the ledger-invariant helper.
- AC-0016: the race harness on each of the five named pairs; the helper's outcomes show exactly one success.
- AC-0034, AC-0035: void an untouched lot and check the lot row, `qty_on_hand`, and the average. Then refuse a partly consumed lot, a lot adjusted back to full weight, an already-void lot, and the reasons NULL, `''`, and `'   '`, each with an unchanged-row check.
- AC-0053: with 0 lbs on hand at an average of 1.8000, receive 1,000 lbs at 18.00, void it, and `moving_avg_cost` is 1.8000. Then, from the same start, receive two such lots and void them first-to-last, and in a fresh run last-to-first; both end at 1.8000.
- AC-0036, AC-0037: void a sale that spans two finished lots; check each finished lot's `lbs_remaining` and that `getTrace` no longer returns it. Then refuse a second void and the reasons NULL, `''`, and `'   '`.
- AC-0038, AC-0039: on a 1,000 lb lot with 600 lbs consumed, adjust to 250 with reason `waste` and check the adjustment row and `unit_cost`. Then a table of refusals: NULL, `'NaN'`, -1, 401, a void lot, and reason `'theft'`.
- AC-0028 (after `adjust_lot`): a raw product with two lots at 1.68 and 1.80 on hand; adjust the 1.80 lot down; `moving_avg_cost` equals the stock-on-hand average of the remaining lots.
- AC-0040, AC-0041: lots L1 and L2, a batch drawing from both, two batches, one sale spanning both finished lots, and one sale with no customer. `getTraceByLot` for L1 and for L2 each return the first sale with customer `Fulton Market Deli`. The distinct `sale_item_id` count equals the `sale_items` count on non-void sales.
- AC-0001, AC-0002, AC-0003, AC-0052, AC-0004, AC-0005, AC-0006, AC-0007, AC-0055: the T3 access tests re-run with the fixture extended so `lot_adjustments` holds a row and each new operation has valid arguments.
- AC-0030, AC-0031, AC-0054, AC-0032, AC-0033: the ledger-invariant `afterEach` in `test/corrections.test.ts`, with the helper extended for void sales and void lots.
- AC-0043 (corrections file): the AC-0043 grep from T2, run on `test/corrections.test.ts`, prints nothing. No stub (goal-based).
- AC-0046: `npm run gen:types && git diff --exit-code src/lib/database.types.ts` exits 0. No stub (goal-based).
- AC-0045 and AC-0051 re-run after this migration with the same commands as T2 and T3.

**Approach:**
- `supabase migration new corrections`: add the columns and `lot_adjustments`, then create the three functions with the same caller check, locks, and grants. Recreate `v_sale_traceability` `with (security_invoker = true)` and set its grants. Enable RLS and add the operator `SELECT` policy on `lot_adjustments`.
- Add the wrappers. Add `lot_adjustments` to the truncate list in `test/db.ts`.

**Done when:** every test named in this task's Tests is green, the AC-0043, AC-0045, AC-0046, and AC-0051 commands give the stated results, and `npm run typecheck` passes.

### T5: The brief, docs, and agent guidance match the hardened engine

**Depends on:** T4
**Touches:** SYSTEM-SPEC.md, AGENTS.md, docs/costing.md, docs/architecture/overview.md, .claude/skills/verify-costing/SKILL.md, .claude/agents/costing-verifier.md, test/db.ts

**Tests:**
- AC-0047: `grep -nF` for each of the six placeholders in `AGENTS.md` prints nothing. No stub (goal-based).
- AC-0048: a grep for `](SYSTEM-SPEC.md)` and `](docs/costing.md)` in `AGENTS.md` each match at least once. No stub (goal-based).
- AC-0049: a script extracts Markdown link targets, backticked repository-relative paths, and bare tokens starting with `docs/`, `src/`, `test/`, `supabase/`, or `.claude/` from the named surfaces, skips module import specifiers and the two exempt names, and runs `test -e` on each; every check passes. No stub (goal-based).

**Approach:**
- `SYSTEM-SPEC.md`: amend the sections the spec's Master brief row lists: §4 (new fields, `lot_adjustments`), §5 (six operations, a short behavior description for each new one), §10 (owner login in scope), §11 (six operations, and `lot_adjustments` among the tables written only through them), and §13 item 1 (six operations). Touch no other section.
- `AGENTS.md`: fill the project line and the commands (lint and build stated as none), link `SYSTEM-SPEC.md`, `docs/costing.md`, and `docs/architecture/overview.md`, and add a "Hard rules" section with the spec's closed list of 7 rules.
- `docs/costing.md`: restore from `2e320a5`, drop the 2.74 example, and add the stock-on-hand average, the zero-stock rule, the void and adjustment rules, and the trigger behind invariant 4.
- `docs/architecture/overview.md`: replace the template with the areas, the per-role access model including the `service_role` master-data exception, and the owner-account steps: create the user in Studio with a password of at least 12 characters, confirm it is new with no earlier sessions, then insert its id into `private.operators`.
- Fix stale paths and commands in the verify-costing skill, the costing-verifier agent, and `test/db.ts` comments.

**Done when:** the AC-0047, AC-0048, and AC-0049 checks pass, and `npm test` and `npm run typecheck` pass.

## Rollout

- **Delivery:** local only. The spec ships when the local stack passes every criterion.
- **Infrastructure:** the local auth config changes, which needs a stack restart. No new services.
- **External-system integration:** none in this spec. Applying the migrations to the hosted project is a separate, ask-first follow-on.
- **Deployment sequencing (for that follow-on):** turn off sign-up and set the 12-character password floor in the hosted dashboard; apply every migration the hosted project lacks, in file order; create the owner user with a password of at least 12 characters and confirm it is new with no earlier sessions; insert its id into `private.operators`; then run the read-only check for the anon key and a signed-in non-operator before any real data is loaded. Until the allowlist insert, the owner is locked out, which fails safe.

## Risks

- `lots.vendor_id` becoming `not null` fails on any database that holds a lot with no vendor. Local data is test residue. Remote data is unknown, so the follow-on checks for null vendors first.
- Lots that exist before T2 get the product's current average as their prior average, which is the best value available; voiding one of them to zero stock restores that value.
- Adding identity columns rewrites `lots` and `finished_goods`. Both are tiny today.
- `supabase stop` and `supabase start` take about a minute and keep data.
- Lock timing could make the race tests flaky. Polling `pg_stat_activity` for the lock wait, instead of sleeping, keeps them deterministic. The 16 race pairs add a few seconds to the suite.
- `supabase/.temp/cli-latest` is rewritten by the CLI on many commands. Restore it before each commit.

## Changelog

- 2026-10-07: initial plan.
- 2026-10-07: round-1 review revision. Harness users move into T2 so the race tests run as the operator; T4 re-runs the access tests over its new objects; `service_role` loses ledger writes and operation EXECUTE; the caller check trusts claim-less sessions only for named logins; void and adjustment limits follow the owner's rulings; T5 amends SYSTEM-SPEC.
- 2026-10-07: round-2 review revision. The localhost guard moves into T2 ahead of user creation; races cover every pair of operations on one product; ledger invariants are checked after every test; master-data writes are tested for every role; `service_role` keeps master-data insert and update but no delete; voids need a reason; T5 also amends SYSTEM-SPEC §13 item 1.
- 2026-10-07: round-3 review revision. The race harness also finishes when the second call never waits; `service_role` is swept over every function; lot remaining lbs is an exact equality; voiding to zero stock restores the lot's prior average; a void reason needs a non-space character; the password test uses its own operator.
- 2026-10-07: round-4 review revision. AC-0052 checks the catalog privilege; a lot upper bound joins the invariants and the race checks; the produce-and-adjust race is listed; voiding to zero follows the owner's as-if-never-entered ruling; the admin key's master-data writes are tested; existing lots get a prior average.
