# Plan: zero-stock-average

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** `docs/costing.md` (the costing math's owner) and `docs/architecture/overview.md` "Insertion order and the hosted check"; analogous implementations: `receipt_seq` and `produced_seq`, numbered for existing rows and then made identities, and `private.refresh_balance`, the one balance refresh, both in `supabase/migrations/20261007181933_engine_hardening.sql`; tests: the AC-0053 block of `test/corrections.test.ts`, and `assertAverageIsStockOnHand` and `inOperatorTransaction` in `test/db.ts`; uncertainty: the bodies of `void_receipt` and `private.refresh_balance` this change replaces, and the corrections names it reads (`current_unit_cost`, `reversed_at`), come from the corrections branch and are confirmed against the merged `main` at T1

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/<feature>/notes/verification-ledger.md` (or the adopter's
> equivalent). A genuine artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round. Treating them as
> contract is how a review spends a round on prose no gate consumes — the
> measured share is over half the plan's lines. `Grounding` stays *recorded*,
> because a per-task resolution that nobody wrote is not grounding; what it stops
> being is a claim a reviewer holds the plan to.

## Approach

One migration changes the engine, and the tests and docs follow it. The
migration adds one sequence and an order-number column on `production_batches`
and `lot_adjustments`. It numbers the rows already there and makes the sequence
the column default. It then rewrites `private.refresh_balance` so that, when a
raw product's lbs on hand sum to 0, it sets the zero-stock average from the last
stock-lowering change. `void_receipt` loses its three steps and calls the plain
refresh. Every other operation already calls the plain refresh, so production,
adjustments, and corrections get the rule without an edit. Last, the migration
refreshes every balance, so a balance already at 0 lbs takes the rule at once.
All of it runs on stack B; stack A is shared with other folders.

The riskiest part is the base. The corrections branch rewrites `void_receipt`
and `refresh_balance` and adds the current cost and the reversed mark this rule
reads. So the build starts only on a branch rebased onto a `main` that holds
corrections (T1), and the migration copies those bodies from the merged
migration rather than from today's `main`.

The testing story: a new suite, `test/zero-stock.test.ts`, holds the new golden
cases and the catalog checks. The existing AC-0053 block in
`test/corrections.test.ts` keeps its cases, three with new expected values. The
stock-on-hand average check in `test/db.ts` also checks every zero-stock
balance, so every suite that registers it tests AC-0001 after each test. A probe
on a two-step migration covers the backfill and the balance refresh, and a
browser test covers the page.

## Constraints

- `AGENTS.md` hard rules: the costing math lives in Postgres (rule 1 through SYSTEM-SPEC §11), every number on screen is rounded (rule 3), no em dashes (rule 4), `type(scope): description` commits (rule 5), `npm test` after any migration or `src/lib/` change with a red costing test stopping the work (rule 6), and schema changes only through `supabase/migrations/` and the local stack (rule 7).
- `SYSTEM-SPEC.md` §11: ledger tables are written only through the operations.
- `docs/costing.md`: invariant 4 (`lots_guard` freezes `prior_avg_cost` among others) and the stock-on-hand average for stock above 0 stay as they are.
- The corrections spec's definitions of current cost, correction, and reversed batch, cited by the spec rather than restated.
- The foundation-hardening criterion on two lots received in one transaction shows the repository's precedent for same-transaction order: an insertion number, not a time.

## Construction tests

Most construction tests live under **Tasks** below. Cross-cutting:

**Integration tests:** the extended `assertAverageIsStockOnHand` runs after every test of each suite that registers it (`test/engine.test.ts`, `test/corrections.test.ts`, `test/zero-stock.test.ts`, and the corrections suites that register it on the rebased `main`), so AC-0001 is checked over every fixture those suites build.
**End-to-end:** the T5 Playwright test, run by `npm test` against the built app.
**Manual verification:** the T3 probe, in the verification ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Costing truth, `docs/costing.md` | T4 | Diff of the zero-stock rule, `void_receipt`, and `correct_receipt` sections and the opening's test list | close-work finds each statement and its figures in passing tests |
| Master brief, `SYSTEM-SPEC.md` §4, §5 | T4 | Diff of the three §4 entries and the two §5 contracts | close-work matches them to the migration |
| Current architecture, `docs/architecture/overview.md` | T4 | Diff of "Insertion order and the hosted check" | close-work matches it to the migration |
| Shipped ledger criteria | T4 | The four amendment notes | close-work finds the four notes |
| Interface compatibility, `src/lib/database.types.ts` | T2 | `npm run gen:types` output | no diff on the closing commit |
| Execution record | T1, T3 | Ledger entries | close-work reads the ledger |

Design facts with an owner: the rule and its order number go to `docs/costing.md`; the column and the backfill keys go to `SYSTEM-SPEC.md` §4 and the overview. The SQL shape below is mechanically evident from the migration and is delivery residue.

## Design (LLD)

### Design decisions

- **The last change, not a replay.** When stock is 0, the last stock-lowering change took every lb on hand, so the lbs it took are exactly the stock just before it, and their average is the average the product had then. A replay of every receipt, batch, and adjustment gives the same value from the same rows with more code. A rolled-back probe on stack B, 2026-10-18, with a temporary shared sequence on both tables, gave this formula 2.0000, 1.8000, 2.0000, 3.0000 and 2.0000 (AC-0008 in each order), and 0.0000 for the histories of AC-0004, AC-0006, AC-0007, AC-0008, and AC-0013, where today's rule stores 1.8000, 18.0000, 1.8000, 2.5000, 2.5000, and 0.0000; after a batch leaves 0 lbs, the formula equals the stored 1.8000. Traces to AC-0001.
- **One rule in the one refresh.** `private.refresh_balance` sets the zero-stock average itself and loses its `p_zero_stock_avg` argument. For a batch or an adjustment that leaves 0 lbs, the value equals the stored one it replaces (spec Assumptions), so those results do not move. Rejected: a recompute inside `void_receipt` and `correct_receipt` alone, two code paths for one rule (owner decision 2026-10-18). Traces to AC-0001, AC-0010, AC-0011.
- **One shared sequence as a column default.** `private.stock_change_seq` feeds `stock_seq bigint not null default nextval(...)` on both tables. The insert that draws it runs after the operation holds the raw product's `inventory_balances` row, so the numbers follow the order the operations ran, inside one transaction too. Rejected: ordering by `created_at` and `adjusted_at`, which hold the transaction's start time and tie inside one transaction (owner decision 2026-10-18); `clock_timestamp()` defaults, which can tie and change what existing columns mean; a number on `lots`, since a receipt never lowers stock. Traces to AC-0008, AC-0015.
- **`lots.prior_avg_cost` stays.** It is frozen by `lots_guard`, defined in SYSTEM-SPEC §4, and no longer read by the engine.

### Data & schema

- `create sequence private.stock_change_seq as bigint`, then revoke all on it from `public`, `anon`, `authenticated`, and `service_role`. The operations are `SECURITY DEFINER` functions owned by `postgres`, so their inserts can draw from it.
- Add `stock_seq bigint` to `production_batches` and `lot_adjustments`. Number every existing row of both tables in one pass, in this order: time (`production_batches.created_at`, `lot_adjustments.adjusted_at`); at equal times a batch before an adjustment; then batches by their finished lot's `produced_seq` and adjustments by `id`. Move the sequence past the highest number given (`setval(..., n, true)`, or `setval(..., 1, false)` with no rows), then set the column `not null` and its default to `nextval('private.stock_change_seq')`. Equal times arise only inside one transaction, which the app never does with two such changes.
- After the new `private.refresh_balance` exists, call it once for every `inventory_balances` row, so a balance already at 0 lbs takes its zero-stock average. For stock above 0 it writes the same stock-on-hand average.
- No new index: the recompute reaches one product's batches through `production_batch_lots (lot_id)` and its adjustments through `lot_adjustments (lot_id)`, both indexed.

### Interfaces & contracts

- `private.refresh_balance(p_raw_product_id uuid)` replaces `private.refresh_balance(uuid, numeric)`: drop the old function, create the new one `security definer` with `set search_path = ''` as the old one is, and revoke all on it from `public`, `anon`, `authenticated`, and `service_role`. PL/pgSQL resolves calls when they run, so the callers that pass one argument need no edit.
- `void_receipt(uuid, text)` keeps its signature, `security definer`, and `set search_path = ''`. Its body is the one in the latest migration that defines it on the rebased `main`, without the two searches and with `perform private.refresh_balance(v_product);`. The migration repeats the revoke and the grant to `authenticated` that the corrections migration gives it.
- `correct_receipt` needs no change when its body on the rebased `main` calls `private.refresh_balance` with one argument (T1 confirms it).
- The generated types gain `stock_seq` on both tables.

### Behavior & rules

The zero-stock branch of `private.refresh_balance`, as a sketch:

```sql
with changes as (
    select b.stock_seq, b.id as batch_id, null::uuid as adjustment_id
    from public.production_batches b
    where b.reversed_at is null
      and exists (select 1 from public.production_batch_lots pbl
                  join public.lots l on l.id = pbl.lot_id
                  where pbl.batch_id = b.id and l.product_id = p_raw_product_id)
    union all
    select a.stock_seq, null, a.id
    from public.lot_adjustments a
    join public.lots l on l.id = a.lot_id
    where l.product_id = p_raw_product_id
      and a.new_remaining_lbs < a.old_remaining_lbs
), last_change as (
    select * from changes order by stock_seq desc limit 1
), taken as (
    select pbl.lbs_consumed as lbs, l.current_unit_cost as cost
    from last_change c
    join public.production_batch_lots pbl on pbl.batch_id = c.batch_id
    join public.lots l on l.id = pbl.lot_id
    union all
    select a.old_remaining_lbs - a.new_remaining_lbs, l.current_unit_cost
    from last_change c
    join public.lot_adjustments a on a.id = c.adjustment_id
    join public.lots l on l.id = a.lot_id
)
select coalesce(sum(lbs * cost) / sum(lbs), 0) from taken;
```

The value is assigned to `moving_avg_cost`, a `numeric(12,4)`, which rounds half away from zero, as the branch for stock above 0 does. The check in `test/db.ts` states the same predicate in its own SQL, so a wrong engine and a right check disagree.

### Failure, edge cases & resilience

- Locks do not change: every operation that writes a batch or an adjustment already holds the raw product's stock row when it inserts, so the sequence adds no lock and no wait.
- A history whose replay with corrected weights would dip below 0 lbs (a count down, a count back up, then a weight correction down to the floor) still gets the average cost of what the last change took; no criterion pins that history.

## Tasks

Stub validation, 2026-10-18. The T2 block below was extracted from this file
into a `git archive` copy of `HEAD` (`ca5c891`) in the session's scratch
directory, outside the repository, and its sha256 recorded from that extraction
(the code lines plus one terminal newline).

- **Compile:** `tsc --noEmit -p tsconfig.json` exited 0.
- **Red:** Vitest 5.0.3 ran the file against stack B, which held `main`'s ten migrations, and exited 1. Both cases failed their assertion with a `moving_avg_cost` of 18 where 1.8 was expected, after their fixture calls succeeded.
- **Isolation:** the run went through `sandbox-exec` with: network denied except to `localhost` and the Docker socket (global setup's network check runs `docker`); file-content reads denied except for the root directory's own listing, the repository, the Node 22.17.0 install under `~/.nvm/versions/node/v22.17.0`, the scratch directory, `os.tmpdir()`, `/private/var/db/timezone`, `/System`, `/usr`, `/private/etc`, `/dev`, `/Applications/Docker.app`, and `~/.docker`; file writes denied except under the scratch directory, `os.tmpdir()`, and `/dev`; and a 120-second `alarm`. Under the same profile, a read of `~/.zshrc`, a write into the repository, and a request to `example.com` were each refused. Vitest ran as `node node_modules/vitest/vitest.mjs` with `--configLoader runner` and a scratch copy of the config whose cache directory is in scratch. The stack details came from `supabase status -o env` outside the sandbox and were passed in the environment.
- **Declared test-harness side effects,** all on stack B through `localhost`: global setup's idempotent creation of the test users and their allowlist rows; `resetTestData`'s truncate and reseed; and the stub's committed fixture calls.
- The scratch copy was removed.

### T1: The rebased branch is green on its stack before any change

**Depends on:** none

**Touches:** `docs/specs/zero-stock-average/notes/verification-ledger.md`

**Tests:** no stub (goal-based check)
- On the branch rebased onto a `main` that holds the corrections merge, the ledger records: the rebase commit; that the corrections spec on `main` still defines current cost, correction, and reversed batch, and still states AC-0025 and AC-0066 at 1.8000; that the latest migration defining `void_receipt` still holds the two searches; that `correct_receipt` calls `private.refresh_balance` with one argument; and a green `E2E_PORT=3200 npm test` on stack B with its pass count.

**Approach:**
- `git fetch`, then `git rebase origin/main`.
- Read the corrections spec and migration on `main` for the four facts. A fact that no longer holds stops the work for a spec amendment.
- Run the `AGENTS.md` folder check for stack B, copy `supabase/stack-b.env` to `supabase/.env`, run `npm ci`, `supabase start`, and `npm run db:reset:stack-b`, and make the `.env`.

**Done when:** the T1 Tests entries are in the ledger.

### T2: The zero-stock rule holds after every operation

**Depends on:** T1

**Touches:** `supabase/migrations/*_zero_stock_average.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/zero-stock.test.ts`, `test/corrections.test.ts`, `test/receipt-corrections.test.ts`, `test/batch-reversal.test.ts`

**Tests:**
- `test/zero-stock.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0006: lots entered out of date order and voided %s leave 1.8000" (AC-0006). sha256 `d4bbc0cfe674676262690388ea7ccc1cae3663bf619f6339abb55ea0241f00c1`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import { produceBatch, receiveLot, voidReceipt, type Lot } from "../src/lib/rpc.js";
import { signInOperator } from "./users.js";
import {
  PROD_502_ID,
  RAW_TOM_ID,
  VENDOR_ID,
  assertAverageIsStockOnHand,
  assertLedgerInvariants,
  closePool,
  getInventoryBalance,
  resetTestData,
} from "./db.js";

let client: TypedClient;

beforeAll(async () => {
  client = await signInOperator();
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

async function receive(cost: number, received: string): Promise<Lot> {
  return receiveLot(client, {
    productId: RAW_TOM_ID,
    vendorId: VENDOR_ID,
    weightLbs: 1000,
    unitCost: cost,
    received,
  });
}

async function produce(productionDate: string): Promise<void> {
  await produceBatch(client, { finishedProductId: PROD_502_ID, rawLbsIn: 1000, productionDate });
}

// The zero-stock start: 0 lbs on hand at an average of 1.8000.
async function zeroStockStart(): Promise<void> {
  await receive(1.8, "2026-05-10");
  await produce("2026-05-11");
}

// STUB: AC-0006
it.each([
  ["first to last", [0, 1]],
  ["last to first", [1, 0]],
])("AC-0006: lots entered out of date order and voided %s leave 1.8000", async (_name, order) => {
  await zeroStockStart();
  const lots = [await receive(18, "2026-05-14"), await receive(20, "2026-05-12")];
  for (const index of order) {
    await voidReceipt(client, lots[index!]!.id, "entered twice");
  }
  expect(await getInventoryBalance(RAW_TOM_ID)).toEqual({ qty_on_hand: 0, moving_avg_cost: 1.8 });
});
```

- The same file grows in EXECUTE with one test each for AC-0007, AC-0009, AC-0010, AC-0012, AC-0013, AC-0019, and AC-0020; AC-0008 once per order, each order's two changes run through `inOperatorTransaction`; AC-0014 for each of the three roles and three privileges; AC-0021 for each role and both functions; and AC-0001's check test, which sets RAW-TOM's balance to 0 lbs at an average other than its zero-stock average through `pg` inside a transaction it rolls back and sees the check report it. AC-0009 to AC-0012 and AC-0019 call `correct_receipt` and `reverse_batch` through the wrappers the corrections build adds (discovery predicate: their exports in `src/lib/` on the rebased `main`).
- `assertAverageIsStockOnHand` in `test/db.ts` also reports each raw product whose balance has 0 lbs on hand and an average that differs from its zero-stock average, in its own SQL.
- `test/corrections.test.ts`, the AC-0053 block: its titles cite AC-0002, AC-0003, AC-0004, and AC-0005 here, and its cases take the values the spec's Ask-first exception gives for this file.
- `test/receipt-corrections.test.ts` and `test/batch-reversal.test.ts`: the cases for the corrections spec's AC-0025 and AC-0066 take the values the spec's Ask-first exception gives, and the AC-0025 case cites AC-0011 here (discovery predicate: `grep -n 'AC-0025\|AC-0066'` over the two files on the rebased `main`).

**Approach:**
- Write the migration as Design gives it: the sequence, the columns, the backfill, the default, the new `private.refresh_balance`, and `void_receipt`.
- `supabase migration up` on this folder's stack, then `npm run gen:types`.
- Materialize the stub unchanged, check its bytes against the digest, and see it red before the migration runs.

**Done when:** the T2 Tests are green and `E2E_PORT=3200 npm test` is green.

### T3: Rows made before the migration get numbers in the order they were made

**Depends on:** T2

**Touches:** `docs/specs/zero-stock-average/notes/verification-ledger.md`

**Tests:** no stub (goal-based check)
- The ledger records the probe for AC-0015, AC-0017, and AC-0018: the commands, RAW-TOM's average before and after the migration, the four probe-history rows in the order they were made with their `stock_seq`, and the AC-0018 batch's and adjustment's `stock_seq`.

**Approach:**
- On stack B, after the folder check, move the T2 migration out of `supabase/migrations/` and run `npm run db:reset:stack-b`.
- Through `psql` as `postgres`, which `private.assert_caller` lets through, seed RAW-TOM, its vendor, and 502 as `test/db.ts` does, then make the spec's probe history, each step in its own transaction, and read RAW-TOM's balance.
- Move the migration back, run `supabase migration up` with stack B's settings, and read the four rows' `stock_seq` and RAW-TOM's average; then make the AC-0018 steps and read their `stock_seq`.
- Run `npm run db:reset:stack-b` again and `E2E_PORT=3200 npm test`.

**Done when:** the T3 Tests entry is in the ledger and the stack holds every migration.

### T4: The docs and the shipped criteria state the rule

**Depends on:** T2

**Touches:** `docs/costing.md`, `SYSTEM-SPEC.md`, `docs/architecture/overview.md`, `docs/specs/foundation-hardening/spec.md`, `docs/specs/corrections/spec.md`

**Tests:** no stub (goal-based check)
- Each Durable Outputs row of the spec for these five files holds, and every average the edited sections give as a result is one a passing test asserts. The diff of these five files adds no em dash (U+2014).

**Approach:**
- `docs/costing.md`: restate the zero-stock rule as the zero-stock average with its order number; replace the `void_receipt` steps, examples, and known limit with the rule and the examples of AC-0002 to AC-0007; point `correct_receipt`'s zero-stock sentence at the rule; add `test/zero-stock.test.ts` to the opening's list.
- `SYSTEM-SPEC.md` §4 (the `production_batches`, `lot_adjustments`, and `inventory_balances` entries) and §5, and the overview section with its keys and tie rule, as their Durable Outputs rows give them.
- The four amendment notes, in the form `*Amended (owner-approved 2026-10-18): ...*`.

**Done when:** the T4 Tests hold.

### T5: The receiving page shows the recomputed average after a void

**Depends on:** T2

**Touches:** `test/e2e/receiving.spec.ts`

**Tests:** no stub (manual QA, exercised by the E2E suite)
- `test/e2e/receiving.spec.ts`, in its "voiding" block: a test titled for AC-0016 makes the AC-0004 history up to its void through the operations, voids the 18.00 receipt through Recent receipts, and reads "On hand" and "Average cost" from the stock region, as that block's "voiding the second receipt" test does (discovery predicate: the seed helpers that file already imports, and the `test/db.ts` call helpers for a batch and an adjustment).

**Approach:**
- Build the fixture with the helpers the file already uses, then drive the void with `voidThrough`.

**Done when:** the T5 test is green in `E2E_PORT=3200 npm test`.

## Rollout

- **Delivery:** one migration, applied in file order after the corrections migration. It is additive: the new columns and sequence can be dropped and the old `refresh_balance` and `void_receipt` restored by a later migration; nothing is deleted. It rewrites every zero-stock balance's average to the rule's value; balances above 0 lbs keep the same value.
- **Infrastructure:** none.
- **External-system integration:** none. The hosted project takes this migration in file order with the rest under the hosted rollout intent, with the owner's approval.
- **Deployment sequencing:** the corrections migration first, then this one. The app reads no new column, so no app change waits on it.

## Risks

- The corrections merge can land with names or bodies that differ from its approved spec. T1 reads them before any edit, and a difference stops the work for an amendment.
- A suite on the rebased `main` that builds a zero-stock balance by writing tables directly would fail the extended check. The check reports the product and the values, which points at the fixture.
- Stack A is shared with other folders, so every run, reset, and probe of this work is on stack B.

## Changelog

- 2026-10-18: initial plan.
