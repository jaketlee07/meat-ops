# Verification ledger: zero-stock-average

Execution observations, newest last. Each entry names the task, the command,
and the observed result. Work runs in the `meat-ops` folder on this Mac
(Node 22.17.0), on stack B.

## Gates before EXECUTE

- Pre-EXECUTE reviews closed after four rounds on 2026-10-18. Raw and adjudication artifacts are under the ignored `.context/reviews/04390e72-bb6f-4404-ae44-9b4ebd36cbc9/`, with round dispositions in `dispositions.md` there.
  - adversarial-reviewer: 11 findings in round 1 and 3 in round 2, of which adjudication sustained 7 and 2, all advisory or nit; byte-exact Clean in rounds 3 and 4.
  - shaping-reviewer: 7 findings and 2 advisories in round 1, 2 findings and 1 advisory in round 2, 1 finding in round 3, all repaired; Clean in round 4.
- The owner's decisions of 2026-10-18 are in the spec's Assumptions.
- The owner approved the spec, then the plan, in chat. `approve-plan` recorded the baseline and `schedule` set three waves: T1; T2; T3, T4, and T5. `plan-locked` fires at the start of T1, which waits for the corrections merge into `main`.
- `lint-contract-item-alignment.py` reports 7 references that resolve to no criterion in this folder: the corrections spec's AC-0025 and AC-0066 and foundation-hardening's AC-0029 and AC-0053, each named beside its spec.
- This folder ran `npm ci` on 2026-10-18, after `main`'s lockfile added the Anthropic SDK. The T2 stub's red run and the formula probe used stack B, which held `main`'s ten migrations; the probe rolled back.
- Project-knowledge capture is not attempted at the gates; the store refused captures in earlier sessions (`staged_dual_writer`). Reusable lessons go to the session memory.

## T1: the branch is green on stack B before any change

- 2026-10-19. The build runs on `fix/zero-stock-average-build`, made from `origin/main` at `04bc7f1`. That commit holds the corrections merge (PR #26, `77e7243`) and its close-out (PR #27). PR #25 had already merged this spec and plan, so a new branch from `main` stands in for the plan's rebase.
- The four corrections facts hold on `main`:
  - The corrections spec (Status: Shipped) defines current cost and weight as `current_unit_cost` and `current_weight_lbs`, a correction, and a reversed batch as a `production_batches` row with a `reversed_at`. Its AC-0025 and AC-0066 state 1.8000.
  - The latest migration that defines `void_receipt` is `20261018205556_batch_reversal.sql`, not `20261018053447_receipt_corrections.sql` as the spec's first Assumption says. It still holds the two searches and calls `private.refresh_balance(v_product, coalesce(v_zero_avg, v_lot.prior_avg_cost))`.
  - `correct_receipt` (`20261018053447_receipt_corrections.sql`) and `reverse_batch` (`20261018205556_batch_reversal.sql`) call `private.refresh_balance` with one argument.
  - `private.refresh_balance(uuid, numeric default null)` is last defined in `20261018053447_receipt_corrections.sql` and reads `current_unit_cost`.
- The latest `produce_batch` and `adjust_lot` lock the raw product's `inventory_balances` row before they insert their `production_batches` or `lot_adjustments` row. Neither table has a trigger.
- Setup: this folder's `supabase/.env` is an exact copy of `supabase/stack-b.env`. `npm ci` exited 0. The folder check listed no folder. `npm run db:reset:stack-b` applied all 13 migrations, and the `.env` was remade from stack B.
- `npm run typecheck` exited 0. `E2E_PORT=3200 npm test` exited 0: Vitest 50 files and 1,001 tests passed, then the browser suite built the app and passed 654 tests in 9.0 minutes.

## T2: the zero-stock rule holds after every operation

- 2026-10-19. The stub materialized into `test/zero-stock.test.ts` with sha256 `d4bbc0cfe674676262690388ea7ccc1cae3663bf619f6339abb55ea0241f00c1`, the plan's digest. Before the migration, `npx vitest run test/zero-stock.test.ts` exited 1 on stack B: both AC-0006 cases read a `moving_avg_cost` of 18 where 1.8 was expected.
- `supabase migration up` applied `20261019195238_zero_stock_average.sql` to stack B. `npm run gen:types` added `stock_seq` to the `production_batches` and `lot_adjustments` types (8 lines). On the stack, no function calls `private.refresh_balance` with two arguments, and only `private.refresh_balance(uuid)` exists.
- With the file grown, the AC-0001 check test failed until `averageViolations` in `test/db.ts` gained the zero-stock branch, then passed.
- Bundled fixes (tier 3, same concern): `test/save-batch.test.ts` builds a `ProductionBatch` row by hand, so it gains `stock_seq: 1` for the regenerated type, as it gained `reversed_at` and `reversal_reason` for corrections. Without it, `npm run typecheck` reported TS2741 there.
- `npm run typecheck` exited 0. `E2E_PORT=3200 npm test` exited 0: Vitest 51 files and 1,029 tests passed, 28 of them in `test/zero-stock.test.ts`, then the browser suite passed 654 tests in 9.6 minutes. The only asserted values that changed are the five the spec's Ask-first item lists.

## T3: rows made before the migration get numbers in the order they were made

- 2026-10-19, on stack B, after the folder check listed no folder, against `supabase/migrations/20261019195238_zero_stock_average.sql` with sha256 `5ac1fb02d5f8b0c7415d91968737a465afccfd0252863c894ff2a52211489c66`, the file after the round 3 review fixes. Three earlier runs gave the same numbers and average, against the file before the round 1, round 2, and round 3 fixes.
- The commands, in order:
  1. Move the migration file out of `supabase/migrations/`, then run `npm run db:reset:stack-b`, which applies the 13 migrations before it.
  2. Run part 1 below through `docker exec -i supabase_db_meat-ops-b psql -U postgres -v ON_ERROR_STOP=1 -q < part1.sql`, as `postgres`, which `private.assert_caller` lets through. psql autocommits, so each operation runs in its own transaction.
  3. Move the migration file back, then run `supabase migration up`, which applies it.
  4. Run part 2 below the same way.
  5. Run `npm run db:reset:stack-b` again, which leaves the stack with all 14 migrations for the gates.
- Part 1, the master data and the probe history:

  ```sql
  -- T3 probe, part 1: on stack B migrated to 20261018224140, as postgres.
  -- psql autocommits, so each statement is its own transaction.
  \set ON_ERROR_STOP on
  truncate
    import_draft_lines, import_drafts,
    sale_items, sales, customers,
    finished_goods, production_batch_lots, production_batches,
    lot_adjustments, receipt_corrections, lots, inventory_balances,
    product_fees, products, fee_types, vendors,
    private.list_price_changes, alerts, alert_digests
    restart identity cascade;
  insert into fee_types(code, name, kind, sort_order) values
    ('cutting','Cutting','processing',1),('defrosting','Defrosting','processing',2),
    ('process','Process','processing',3),('direct_material','Direct cost of material','processing',4),
    ('labor','TP cost of labor','processing',5),('freezing','Cost of freezing','processing',6),
    ('seasoning','Seasoning','processing',7),('overhead','Belmont overhead','processing',8),
    ('profit','Profit','margin',9),('broker','Broker commission','margin',10);
  insert into vendors(id, name) values ('11111111-1111-1111-1111-111111111111', 'Reyes Meats');
  insert into products(id, code, description, species, kind) values
    ('22222222-2222-2222-2222-222222222222', 'RAW-TOM', 'Turkey Drums TOM (raw)', 'Turkey', 'raw');
  insert into products(id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct) values
    ('33333333-3333-3333-3333-333333333333', '502', 'Smoked Turkey Drums Tom', 'Prospect Meats',
     'Turkey', 'finished', '56cs/pl', 32.5, '22222222-2222-2222-2222-222222222222', 0.2300);
  insert into product_fees(product_id, fee_type_id, amount_per_lb)
  select '33333333-3333-3333-3333-333333333333', ft.id, x.amt
  from (values ('direct_material',0.05),('freezing',0.03),('overhead',0.37),('profit',0.05)) x(code,amt)
  join fee_types ft on ft.code = x.code;

  -- The probe history.
  select id as lot_180a from public.receive_lot(p_product_id => '22222222-2222-2222-2222-222222222222', p_vendor_id => '11111111-1111-1111-1111-111111111111', p_weight_lbs => 1000, p_unit_cost => 1.80, p_received => '2026-05-10') \gset
  select id as batch_1 from public.produce_batch(p_finished_product_id => '33333333-3333-3333-3333-333333333333', p_raw_lbs_in => 1000, p_production_date => '2026-05-10') \gset
  select id as lot_250 from public.receive_lot(p_product_id => '22222222-2222-2222-2222-222222222222', p_vendor_id => '11111111-1111-1111-1111-111111111111', p_weight_lbs => 1000, p_unit_cost => 2.50, p_received => '2026-05-11') \gset
  select id as adj_lot from public.adjust_lot(p_lot_id => :'lot_250', p_new_remaining_lbs => 0, p_reason => 'count') \gset
  select id as lot_180b from public.receive_lot(p_product_id => '22222222-2222-2222-2222-222222222222', p_vendor_id => '11111111-1111-1111-1111-111111111111', p_weight_lbs => 1000, p_unit_cost => 1.80, p_received => '2026-05-12') \gset
  select id as batch_2 from public.produce_batch(p_finished_product_id => '33333333-3333-3333-3333-333333333333', p_raw_lbs_in => 1000, p_production_date => '2026-05-12') \gset
  select id as lot_1800 from public.receive_lot(p_product_id => '22222222-2222-2222-2222-222222222222', p_vendor_id => '11111111-1111-1111-1111-111111111111', p_weight_lbs => 1000, p_unit_cost => 18.00, p_received => '2026-05-13') \gset
  select id as lot_200 from public.receive_lot(p_product_id => '22222222-2222-2222-2222-222222222222', p_vendor_id => '11111111-1111-1111-1111-111111111111', p_weight_lbs => 1000, p_unit_cost => 2.00, p_received => '2026-05-14') \gset
  select id as adj_lot2 from public.adjust_lot(p_lot_id => :'lot_200', p_new_remaining_lbs => 0, p_reason => 'count') \gset
  select id as voided from public.void_receipt(p_lot_id => :'lot_1800', p_reason => 'entered twice') \gset

  \echo 'Before the migration, RAW-TOM balance:'
  select qty_on_hand, moving_avg_cost from public.inventory_balances
  where product_id = '22222222-2222-2222-2222-222222222222';
  \echo 'The four changes in the order they were made:'
  select 'batch' as kind, b.created_at as made_at, l.unit_cost as lot_cost
  from public.production_batches b
  join public.production_batch_lots pbl on pbl.batch_id = b.id
  join public.lots l on l.id = pbl.lot_id
  union all
  select 'adjustment', a.adjusted_at, l.unit_cost
  from public.lot_adjustments a join public.lots l on l.id = a.lot_id
  order by made_at;
  ```

- Part 2, the reads and the AC-0018 steps:

  ```sql
  -- T3 probe, part 2: after `supabase migration up` applies 20261019195238, as postgres.
  \set ON_ERROR_STOP on
  \echo 'AC-0015: the four changes in the order they were made, with their numbers:'
  select 'batch' as kind, b.created_at as made_at, l.unit_cost as lot_cost, b.stock_seq
  from public.production_batches b
  join public.production_batch_lots pbl on pbl.batch_id = b.id
  join public.lots l on l.id = pbl.lot_id
  union all
  select 'adjustment', a.adjusted_at, l.unit_cost, a.stock_seq
  from public.lot_adjustments a join public.lots l on l.id = a.lot_id
  order by made_at;
  \echo 'AC-0017: RAW-TOM balance after the migration:'
  select qty_on_hand, moving_avg_cost from public.inventory_balances
  where product_id = '22222222-2222-2222-2222-222222222222';

  -- AC-0018: new changes after the migration.
  select id as lot_300 from public.receive_lot(p_product_id => '22222222-2222-2222-2222-222222222222', p_vendor_id => '11111111-1111-1111-1111-111111111111', p_weight_lbs => 1000, p_unit_cost => 3.00, p_received => '2026-05-15') \gset
  select id as batch_3 from public.produce_batch(p_finished_product_id => '33333333-3333-3333-3333-333333333333', p_raw_lbs_in => 1000, p_production_date => '2026-05-15') \gset
  select id as lot_400 from public.receive_lot(p_product_id => '22222222-2222-2222-2222-222222222222', p_vendor_id => '11111111-1111-1111-1111-111111111111', p_weight_lbs => 1000, p_unit_cost => 4.00, p_received => '2026-05-16') \gset
  select id as adj_lot3 from public.adjust_lot(p_lot_id => :'lot_400', p_new_remaining_lbs => 0, p_reason => 'count') \gset
  \echo 'AC-0018: the new batch and adjustment, with their numbers:'
  select 'batch' as kind, stock_seq from public.production_batches where id = :'batch_3'
  union all
  select 'adjustment', stock_seq from public.lot_adjustments where lot_id = :'lot_400';
  \echo 'The highest number among the four probe-history rows:'
  select max(stock_seq) from (
      select stock_seq from public.production_batches where id <> :'batch_3'
      union all
      select stock_seq from public.lot_adjustments where lot_id <> :'lot_400') old;
  ```

- Before the migration, RAW-TOM had 0.000 lbs on hand at an average of 1.8000, the value the old second search gives.
- After the migration, the four probe-history rows, in the order they were made:

  | Change | Made at (UTC) | Lot cost | `stock_seq` |
  | --- | --- | ---: | ---: |
  | batch | 2026-10-19 21:45:45.041335 | 1.8000 | 1 |
  | adjustment | 2026-10-19 21:45:45.049077 | 2.5000 | 2 |
  | batch | 2026-10-19 21:45:45.052165 | 1.8000 | 3 |
  | adjustment | 2026-10-19 21:45:45.054173 | 2.0000 | 4 |

- AC-0015: the numbers rise in the order the rows were made.
- AC-0017: after the migration, RAW-TOM had 0.000 lbs on hand at an average of 2.0000, the cost of the 2.00 lot the last adjustment took.
- AC-0018: the AC-0018 batch got `stock_seq` 5 and its adjustment 6, both above the probe history's highest, 4.

## T4: the docs and the shipped criteria state the rule

- 2026-10-19. `docs/costing.md`: the zero-stock rule states the zero-stock average, `stock_seq`, and `private.stock_change_seq`. The `void_receipt` section has no three steps, no prior-average rule, and no known limit, and its six examples give the averages of AC-0002 to AC-0007 (1.8000, 1.8000, 2.0000, 2.0000, 1.8000, 2.0000). The `correct_receipt` zero-stock sentence points at the rule, and the opening's list names `test/zero-stock.test.ts`.
- Each average those sections give is asserted by a passing test: 2.0000 and 2.4000 in `test/engine.test.ts`; the `void_receipt` examples in the AC-0053 block of `test/corrections.test.ts`, `test/zero-stock.test.ts`, and the AC-0066 case of `test/batch-reversal.test.ts`; 1.8000 and 1.9000 after the lot B corrections in the AC-0022 and AC-0025 cases of `test/receipt-corrections.test.ts`.
- `SYSTEM-SPEC.md` §4 names `stock_seq` on `production_batches` and `lot_adjustments`, and its `inventory_balances` entry gives the zero-stock average in place of "keeps its last value". §5 "Void a receipt" and "Correct a receipt" say the average at 0 lbs is recomputed as `docs/costing.md` gives it, with no known limit.
- `docs/architecture/overview.md` "Insertion order and the hosted check" names `stock_seq`, what it orders, and the keys and tie rule that number existing rows.
- The amendment notes are on foundation-hardening AC-0029 (names AC-0001 here) and AC-0053 (names AC-0001 to AC-0007 here), and on the corrections spec's AC-0025 (names AC-0011 here) and AC-0066 (names AC-0001 here).
- `git diff | grep '^+' | grep -c` for U+2014 printed 0.

## T5: the receiving page shows the recomputed average after a void

- 2026-10-19. `test/e2e/receiving.spec.ts`, in the "voiding" block, makes the AC-0004 history up to its void through the operations, sees "$18.0000/lb", voids the 18.00 receipt through Recent receipts, and reads "0 lbs" and "$2.0000/lb" from the stock region. It passed in the run below.

## Wave 3 gates

- 2026-10-19, after the folder check listed no folder: `npm run db:reset:stack-b` applied all 14 migrations, and `npm run typecheck` exited 0. `E2E_PORT=3200 npm test` exited 0: Vitest 51 files and 1,029 tests passed, then the browser suite built the app and passed 655 tests in 9.1 minutes.
- `npm run gen:types` on the migrated stack left no diff in `src/lib/database.types.ts`.

## Review round 1 fixes

- 2026-10-19. Round 1 sustained 9 findings, none refuted, from the adversarial and quality reviewers. The fixes:
  - The migration's step 4 holds each raw product's `inventory_balances` row before it refreshes the product, as the operations do, so a receipt saved while the migration applies is not overwritten by stale sums.
  - The migration's step 1 comment says why `stock_seq` is a plain default and not an identity column: one sequence spans two tables, and only the operations write them.
  - `test/zero-stock.test.ts` gains five cases: a count that leaves a lot as it was, a count that raises a lot, a batch and an adjustment on a second raw product made after RAW-TOM's own last change, and the check reporting a balance at 0 lbs with no stock-lowering change whose average is not 0. The `averageViolations` check is unchanged.
  - `docs/costing.md` claims only what the rule gives. After voids alone, the average is the one the product would have if the voided receipts had never been entered. A reversal or a weight correction does not re-run the draws of later batches.
  - `docs/architecture/overview.md`'s write-path sentence says the refresh sets the zero-stock average at 0 lbs on hand.
  - The T3 entry above holds the probe's exact SQL and the migration digest, from a re-run against the changed migration.
- Mutation proof, on stack B with `npx vitest run test/zero-stock.test.ts`. Each fault was loaded on its own, then removed by `npm run db:reset:stack-b` or `git checkout -- test/db.ts`:
  - `<=` in place of `<` in the adjustment filter turned the equal-count case red.
  - No adjustment filter turned both count cases red.
  - No product filter in the batch search turned the second-product batch case red.
  - No product filter in the adjustment search turned the second-product adjustment case red.
  - `z.avg` in place of `coalesce(z.avg, 0)` in `test/db.ts` turned the no-change check case red.
- For close-out: the spec's Objective, which is working material, still says the average at 0 lbs is the one the product would have with reversed batches never entered and corrected receipts entered at current values. That holds after voids alone. The ACs' definitions already fix the rule. The approved spec's hash is pinned during the build, so the Objective is corrected at close-out.
- Gates after the fixes, after the folder check listed no folder: `npm run db:reset:stack-b` applied all 14 migrations, and `npm run typecheck` exited 0. `E2E_PORT=3200 npm test` exited 0: Vitest 51 files and 1,034 tests passed, then the browser suite passed 655 tests in 9.9 minutes.

## Review round 2 fixes

- 2026-10-19. Round 2 sustained 2 nits, none refuted. Both were fixed.
  - The deadlock fix is graded a concern, since it changes the migration's locking.
- `docs/costing.md` no longer says a void lot was never drawn. It says, as invariant 6 does, that a void lot has no adjustment row and no consumption row of a batch that is not reversed.
- The migration first takes `inventory_balances` in `exclusive` mode, inside a `DO` block, and step 4 is back to one set-based refresh.
  - The operations that lock a raw product's balance row take it before they touch batches or adjustments, except `reverse_batch`, which reads its batch first. So for every operation but a reversal, the migration now takes its locks in the same order. The round 3 section below has the cases that can still fail.
  - A top-level `lock table` failed under `supabase migration up` with `LOCK TABLE can only be used in transaction blocks (SQLSTATE 25P01)`. The CLI applies the file as one implicit transaction, not a transaction block. That failed apply left no `stock_seq` column and no `schema_migrations` row.
- Lock-order probe on stack B. Each run had the 13 earlier migrations, one RAW-TOM receipt, and a second session that held RAW-TOM's balance row for 4 seconds, then read `production_batches` and committed. `supabase migration up` started 1.5 seconds into the hold.
  - The cd2b597 migration, sha256 `87af2f1f54dda067cf08e2a6c0cf5cc28a2fc40f21c53c9c2da9fc2d2740d4f0`, applied, and the holding session failed with `ERROR: deadlock detected`. It was waiting for an AccessShareLock on `production_batches` while the migration waited for its row.
  - The fixed migration, sha256 `0e3145cb3f2741bb347c9e0554ea4fc9fbd935abf27c48c676d1daed1c897038`, applied, and the holding session committed with no error.
- Receipt-in-flight probe with the fixed migration. A second session called `receive_lot` for 500 lbs at 2.40 and held the transaction for 4 seconds while the migration started. Afterwards RAW-TOM had 1,500.000 lbs on hand, equal to its lots' remaining lbs, at an average of 2.0000.
- Gates after the fixes, after the folder check listed no folder: `npm run db:reset:stack-b` applied all 14 migrations, and `npm run typecheck` exited 0. `E2E_PORT=3200 npm test` exited 0: Vitest 51 files and 1,034 tests passed, then the browser suite passed 655 tests in 8.9 minutes.

## Review round 3 fixes

- 2026-10-19. Round 3 sustained the same gap from both reviewers, as an advisory and a nit, none refuted. The round 2 comment said every operation locks the balance row first, so an operation and the migration never deadlock. Two cases break that claim, and both were reproduced on stack B against the round 2 file (sha256 `0e3145cb3f2741bb347c9e0554ea4fc9fbd935abf27c48c676d1daed1c897038`). Each run had the 13 earlier migrations, a RAW-TOM receipt, a batch, and an untouched 18.00 receipt.
  - Reversal order: a session read `production_batches`, slept 4 seconds, then locked RAW-TOM's balance row, with `supabase migration up` started 1.5 seconds in. The migration applied, and the session failed with `ERROR: deadlock detected`. It was waiting for a RowShareLock on `inventory_balances` while the migration waited for an AccessExclusiveLock on `production_batches`.
  - Waiting void: a session held RAW-TOM's balance row for 4 seconds, the migration started at 1.5 seconds, and a `void_receipt` call started at 2.5 seconds and queued behind it. The migration applied, and the void failed with `function private.refresh_balance(uuid, numeric) does not exist`, raised from its old body at the two-argument refresh. Afterwards the 18.00 lot was not void, and RAW-TOM had 1,500.000 lbs on hand, equal to its lots, at 12.6000.
- The fix changes only the migration's comment, which now claims only what holds. The operations that take the balance row take it before they touch batches or adjustments, except `reverse_batch`. A reversal that has read its batch can deadlock with the apply, and a void that waited behind the lock fails on its old body. The failed call, or the file, rolls back whole and can be run again, so the file is applied while no operation runs. `git diff` of the migration changes comment lines only.
- The T3 probe was re-run against the new file, as the T3 entry records. Gates, after the folder check listed no folder: `npm run db:reset:stack-b` applied all 14 migrations, and `npm run typecheck` exited 0. `E2E_PORT=3200 npm test` exited 0: Vitest 51 files and 1,034 tests passed, then the browser suite passed 655 tests in 8.8 minutes.
