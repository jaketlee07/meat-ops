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

- 2026-10-19, on stack B, after the folder check listed no folder. `20261019195238_zero_stock_average.sql` was moved out of `supabase/migrations/`, and `npm run db:reset:stack-b` applied the 13 migrations before it.
- As `postgres` through `docker exec -i supabase_db_meat-ops-b psql -U postgres -v ON_ERROR_STOP=1`, a script seeded the master data `test/db.ts` seeds and made the spec's probe history, one autocommitted statement per operation. Before the migration, RAW-TOM had 0.000 lbs on hand at an average of 1.8000, the value the old second search gives.
- The migration was moved back and `supabase migration up` applied it. The four probe-history rows, in the order they were made:

  | Change | Made at (UTC) | Lot cost | `stock_seq` |
  | --- | --- | ---: | ---: |
  | batch | 2026-10-19 20:15:28.787134 | 1.8000 | 1 |
  | adjustment | 2026-10-19 20:15:28.789719 | 2.5000 | 2 |
  | batch | 2026-10-19 20:15:28.790894 | 1.8000 | 3 |
  | adjustment | 2026-10-19 20:15:28.791992 | 2.0000 | 4 |

- AC-0015: the numbers rise in the order the rows were made.
- AC-0017: after the migration, RAW-TOM had 0.000 lbs on hand at an average of 2.0000, the cost of the 2.00 lot the last adjustment took.
- AC-0018: receiving a lot at 3.00 received 2026-05-15, producing 1,000 raw lbs on 2026-05-15, receiving a lot at 4.00 received 2026-05-16, and adjusting it to 0 lbs gave the batch `stock_seq` 5 and the adjustment 6, both above the probe history's highest, 4.

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
