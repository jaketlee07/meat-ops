# Verification ledger: foundation-hardening

Execution observations, newest last. Each entry names the task, the command, and the observed result.

## T1 (2026-10-07)

- Executed by the controller, not the `implementer` subagent: deleting the hook script while the hook was still loaded would deny every tool call, so the order was settings first, a probe, then deletion.
- Probe: `true "update lots set unit_cost = 1"` ran after the settings edit, so the hook no longer fired.
- AC-0050: `grep -rl guard-lot-cost .claude` printed nothing (exit 1); JSON read of `.claude/settings.json` found no `Bash(supabase…*)` allow entry.
- Gates: `npm run typecheck` exit 0; `npm test` 7/7 passed.

## T2 (2026-10-07)

- Executed by the `implementer` subagent in the primary working tree; controller reran gates.
- Stubs materialized byte-identical before build-out: `test/env.test.ts` sha256 0cebd0de…, `test/engine.test.ts` sha256 7b369d2f… (match the plan payloads). Observed red: env "expected [Function] to throw an error" (2/2); engine "expected 1.725 to be 1.8".
- Migration `supabase/migrations/20261007181933_engine_hardening.sql` applied with `supabase migration up`; types regenerated.
- Controller gates: `npm run typecheck` exit 0; `npm test` 44/44 passed (3 files).
- AC-0043 grep on `test/costing.test.ts` and `test/engine.test.ts`: no output (exit 1). AC-0045: implementer reported seed load exit 0 after `supabase db reset`.
- Implementer mutation check: removing the balance-row lock from `produce_batch` turned the AC-0015 receive/produce race red.
- Deviations recorded by the implementer: `assert_caller(p_operation)` argument for error text; the guard also refuses `hostaddr`; null date arguments raise `invalid`; `getLots` orders by `receipt_seq`.

## T3 (2026-10-07)

- Executed by the `implementer` subagent; controller reran gates and probes.
- Proof obligation: `vitest run test/access.test.ts -t AC-0001` against the T2 schema failed with `anon read customers: expected undefined to be '42501'` before the migration existed.
- Migration `supabase/migrations/20261007182816_access_lockdown.sql`; stack restarted for auth config.
- Controller gates: `npm run typecheck` exit 0; `npm test` 55/55 passed (4 files).
- Controller probes: `/auth/v1/settings` disable_signup true with the email provider on; `/auth/v1/signup` returned 422 `signup_disabled`; anon REST read of `lots` returned 42501; anon GraphQL `lotsCollection` is an unknown field; `supabase db advisors --local --type security --fail-on warn` exit 0 (AC-0051); `reset_test_data` count 0 (AC-0044); RLS on 12/12 public tables.
- Design correction (LLD is working material, plan text pinned): `[auth.email] enable_signup` stays `true`, because `false` disables email logins entirely and would make every operator criterion unreachable. `[auth] enable_signup = false` alone refuses sign-up (AC-0010 green). A comment in `supabase/config.toml` records why.
- INSERT policies carry only `WITH CHECK`, because Postgres rejects `USING` on INSERT policies.

## T4 (2026-10-07)

- Executed by the `implementer` subagent; controller reran gates and checks.
- Proof obligation: a migration with the three functions raising `not implemented` gave 47/47 red in `test/corrections.test.ts` (after the implementer hardened two vacuous AC-0016 assertions).
- Migration `supabase/migrations/20261007183252_corrections.sql`.
- Implementer mutation check: removing the balance-row lock from `void_receipt` and `adjust_lot` turned 4 AC-0015 race pairs red.
- Controller checks: `supabase db reset` then seed load exit 0 (AC-0045); `npm run gen:types` left `src/lib/database.types.ts` byte-identical (AC-0046); `npm run typecheck` exit 0; `npm test` 103/103 passed (5 files); AC-0043 grep on the three suites printed nothing; `supabase db advisors --local --type security --fail-on warn` exit 0 (AC-0051).
- Implementer additions beyond the task body: void reason refused on tab/newline-only text too; `CHECK ((voided_at is null) = (void_reason is null))` on `lots` and `sales`; index on `lot_adjustments(lot_id)`; AC-0016 pairs run in both orders; refusal checks compare an md5 of every ledger table.

## T5 (2026-10-07)

- Executed by the `implementer` subagent; controller reran the checks.
- AC-0047: no bundle placeholder in `AGENTS.md`. AC-0048: one link each to `SYSTEM-SPEC.md` and `docs/costing.md`. AC-0049: 23 citations checked, 0 missing (throwaway script in session scratch).
- `SYSTEM-SPEC.md` diff hunks fall only in §4, §5, §10, §11, and §13 item 1.
- `AGENTS.md` "Hard rules" holds the spec's 7 rules; no em dashes in the changed docs.
- Gates: `npm run typecheck` exit 0; `npm test` 103/103 passed (5 files).

## Final GATES (2026-10-07)

- No lint script exists. `npm run typecheck` exit 0. `npm test` 103/103 passed (5 files).

## Code-review round-1 fixes (2026-10-07)

- Executed by the `implementer` subagent; controller reran gates.
- Implementer mutation proofs: removing `produced_seq` from `record_sale`'s ORDER BY turned the AC-0027 finished-goods test red (5 of 5 runs); removing `for no key update` from `record_sale` turned AC-0014's lock assertion red. Restored with `supabase db reset`.
- Backfill check on a scratch database: pre-existing lots numbered in old FIFO order; next insert continued above the maximum.
- Controller gates: `supabase db reset` exit 0; seed load exit 0; `npm run gen:types` no diff; `npm run typecheck` exit 0; `npm test` 104/104 on two runs; AC-0043 grep no output; security advisors exit 0; both identity sequences show no USAGE for anon or authenticated.

## Code-review round-2 fixes (2026-10-07)

- Executed by the controller (small FIX unit).
- New test "two void lots before a lot adjusted to zero, voided first to last / last to first, end at 1.8000": red on the prior fallback (first-to-last case), green after the change.
- Controller gates: `supabase db reset` exit 0; seed load exit 0; `npm run gen:types` no diff; `npm run typecheck` exit 0; `npm test` 106/106 (5 files); security advisors exit 0; AC-0049 path check 23/23.
- Known limit recorded in `docs/costing.md` by owner decision (2026-10-07): void lots on both sides of a non-void lot adjusted to 0.

## Code-review round-3 closing changes (2026-10-07)

- Executed by the controller. New test "the fallback skips a void lot that comes before a lot production drew from": green on the real function; red on a mutant without the consumed-lot filter (average 2 instead of 2.5); restored with `supabase db reset`.
- Docs narrowed to the code's behavior; out-of-order known limits recorded in `docs/costing.md` by owner decision (2026-10-07).
- Controller gates: `supabase db reset` exit 0; seed load exit 0; `npm run gen:types` no diff; `npm run typecheck` exit 0; `npm test` 107/107 (5 files); security advisors exit 0; AC-0049 path check 23/23.

## Code-review round-4 doc changes (2026-10-07)

- Executed by the controller: docs/costing.md void_receipt section restated as three ordered steps plus a general known limit; follow-on recorded in the spec's Follow-ons; one test retitled; migration comment wording.
- Gates: `npm run typecheck` exit 0; `npm test` 107/107; AC-0049 path check 23/23; spec lints clean.

## Learnings capture (2026-10-07)

- project-knowledge unavailable: the knowledge store is not activated (`docs/knowledge/patterns.jsonl` is empty and holds no topics), and the work-loop producer gates (`spec-approved`, `plan-locked`) had already passed. Reusable lessons are listed in the PR description instead.
