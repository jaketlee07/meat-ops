# Verification ledger: corrections

Execution observations, newest last. Each entry names the task, the command, and the observed result.

## Before EXECUTE (2026-10-18)

- `feat/corrections` rebased onto `origin/main` at ca5c891 (Alerts merged, PR #22) with no conflict, and pushed with upstream `origin/feat/corrections`. Invoice entry and Alerts are both on `main`, so the spec's Alerts links resolve.
- Stack A set up by the `AGENTS.md` steps: `npm ci` (0 vulnerabilities; the lockfile changed with the rebase); `supabase start` (already running, project `meat-ops`); the running-folder check listed only `meat-ops-ask`, whose `supabase/.env` is an exact copy of `supabase/stack-b.env`, so no stack A folder was running; `supabase_migrations.schema_migrations` held exactly `main`'s ten migrations, the same as this folder; `supabase db reset` applied them; `.env` written from `supabase status`.
- Setup step 5 on the rebased tree: the folder check listed no stack A folder; `npm test` exit 0, Vitest 734 passed (41 files, 34 s), Playwright 542 passed (6.4 min).
- Canonical preflight: `workspace.toml` registers no spec, so `workspace-status` has empty `ready` and `active` sets; the owner's request names this spec, so the build uses it. `check-base-freshness` reported the head current. Resumption: `loop-engine status` read `SPEC-PLAN-APPROVED` after `plan-approved`; `loop-cohort identity` passed; `approve-plan` was a no-op; `schedule` persisted six waves (T1; T2; T3, T4, T5; T6; T7, T8; T9); `plan-locked` moved the engine to `CODE-IMPLEMENTATION`; `plan check-current --require-schedule` passed.
- T3's discovery predicate on the rebased tree: the only Alerts function that reads `unit_cost` or the batch tables is `public.refresh_alerts(p_today date)` in `supabase/migrations/20261016204845_alerts.sql` (cost rule at about lines 190 to 245, yield rule at about 253 to 266, stock rule at about 319 to 320). The old next-step sentence lives in `src/lib/alert-text.ts:114`, `test/alert-text.test.ts:151`, and `test/e2e/alerts.spec.ts:96`.
- Anchor-test sweep: no test hashes or counts the content of a file this plan edits. The receiving and production browser helpers' Tab-order lists are in T7's and T8's Touches. The Alerts browser suite walks `/receiving` only with no product chosen, so no Recent receipts list, and no Correct button, joins its control lists.
- Observation: since the spec was written, `test/invoice-costing.test.ts`, `test/invoice-data.test.ts`, and `test/invoices-data.test.ts` also register `assertLedgerInvariants`, so 13 existing suites register it, not the 10 the Testing Strategy lists as "today". The listed suites still register it, and the extra three run the new checks too.
- Observation: the `meat-ops` folder is on `fix/zero-stock-average`, which works the zero-stock intent this spec's Follow-on names. Both branches replace `void_receipt`; whichever merges second rebases and carries the other's change into its replacement.

### Assumption trio

- **Touches:** the files each task's `Touches` names, and this ledger.
- **Done:** each task's `Tests` and `Done when`, with `npm run typecheck`, `npm run build`, and `npm test` green after each task (spec Always do).
- **Not changing:** `receive_lot`, `record_sale`, `void_sale`, the pricing functions, `v_product_pricing`, `v_current_menu`, `v_sale_summary`, the columns `lots_guard` freezes, the numbers asserted in the four golden suites, and any page beyond the current values and the alert outcomes the spec names.

### Declined

- A restatement history table per batch: rung 1, not needed; the correction rows reproduce every old figure (plan Design).
- A trigger that ties the corrected columns to the latest correction: rung 1; the AC-0078 check after every test covers it, and the security review refuted the need.
- A shared confirmation dialog for void, correct, and reverse: an explicit requirement forbids it (`docs/product/intents/shared-display-parts.md` owns shared parts; the plan names the copies as a deviation).
- A preview function that computes a correction's effects before saving: the spec's Never do forbids computing a "before" figure, and the correction is undone by correcting back.
- A new Corrections page: the owner chose the existing lists.

### Resolve-vs-surface record

Opened at PLAN. Each review finding is recorded here with its disposition; it closes at DECIDE.
