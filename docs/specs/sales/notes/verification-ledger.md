# Verification ledger: sales

Execution observations, newest last. Each entry names the task, the command, and the observed result.

## Before EXECUTE (2026-10-13)

- `origin/main` at 0d02e07 (vitest-upgrade closed) merged into `feat/sales` with no conflict. The merge brings Vitest 5, `.npmrc` `ignore-scripts=true`, the shared `src/app/facts.tsx`, `stock-view.ts`, and `before-after.tsx`, and the stack A and stack B steps in `AGENTS.md`.
- Stack A set up by the `AGENTS.md` steps: `npm ci` (183 packages, 0 vulnerabilities); `supabase start` (already running, project `meat-ops`); the running-folder check listed no folder; `supabase_migrations.schema_migrations` held exactly this branch's six migrations; `meat-ops-invoice` is on stack B (its `supabase/.env` sets `SUPABASE_PROJECT_ID`); `supabase db reset` applied the six migrations; `.env` written from `supabase status`.
- Setup step 5 on the merged tree: `npm test` exit 0 in 111 s, Vitest 410 passed (25 files), Playwright 220 passed.
- Stub digests: all four `stub: true` blocks extracted from `plan.md` match their recorded sha256.
- Canonical preflight: `workspace.toml` registers no spec, so `workspace-status` reports empty `ready` and `active` sets. The owner's request names this spec, so the build uses it. `check-base-freshness` reported the head current; `loop-engine status` read `CODE-IMPLEMENTATION` after `plan-locked`; `loop-cohort identity` and `plan check-current` passed.
- Anchor-test sweep: no test hashes or counts the content of a file this plan edits. The Tab-order control lists (`FORM_CONTROLS`, `MENU_CONTROLS`, `NAV_CONTROLS`) and the pricing suite's five-control slice are already in T5's Touches.

### Assumption trio

- **Touches:** the files each task's `Touches` names, and this ledger.
- **Done:** each task's `Tests` and `Done when`, with `npm run typecheck`, `npm run build`, and `npm test` green after each task (spec Always do).
- **Not changing:** the six ledger operations, any table, column, grant, or policy other than the new view's grants, `v_product_pricing`, `v_current_menu`, the numbers asserted in `test/costing.test.ts` and `test/pricing.test.ts`, and what the receiving, production, menu, and pricing pages show beyond the two new navigation links.

### Declined

- A shared void dialog for receipts and sales: an explicit requirement forbids it (sharing changes the receiving page, an Ask-first change; the plan names the copy as a deviation).
- A general paged-read helper for every list: rung 1, not needed; only a lot's trace can pass `max_rows`, and the plan's large-data-set row bounds every other read.
- A database function for a lot's customers or sales: the spec's Never do forbids a new database function.
- Summing a sale's lines or predicting its draws in TypeScript: the spec's Never do forbids it; `v_sale_summary` gives the total.

### Resolve-vs-surface record

Opened at PLAN. Each review finding is recorded here with its disposition; it closes at DECIDE.

## T1 (2026-10-13)

- Executed by the `implementer` subagent in the primary working tree; controller reran every gate.
- Stub materialized byte-identical at `test/sales.test.ts` (sha256 ebf6034d…cb3ef); observed red: `relation "public.v_sale_summary" does not exist`, after its fixture calls succeeded. The file then grew to 4 cases (AC-0010, AC-0011, AC-0012, AC-0015).
- Migration `supabase/migrations/20261013155724_sales_trace.sql`, applied with `supabase migration up`. `pg_class.reloptions` reads `{security_invoker=true}` on both views; `v_sale_traceability` keeps its 16 columns in order and appends `sale_id`, `sale_created_at`, `customer_id`, `raw_code`, `produced_seq`, `receipt_seq`; `anon` holds no SELECT on either view.
- `test/db.ts` gains `p_customer_id` and `p_sale_number` in `PARAM_TYPES`, `VALLEY_ID`, and `saleFixture({ listPrice, sale })`, which returns the lot, batch, and sale ids and the lot numbers.
- Controller fix: the implementer's added imports sat below the stub's test; they now join the stub's import block, which also takes `VALLEY_ID` from `test/db.ts` instead of a second copy.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 108 s, Vitest 414 passed (26 files), Playwright 220 passed; `npm run gen:types` leaves no diff.

## T2 (2026-10-13)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/sales-rules.test.ts` (sha256 d32a6630…3d4ba4); observed red: `Cannot find module '../src/lib/sale-input.js'`. The file then grew to 46 cases.
- Built: `src/lib/sale-input.ts` (`parseSaleForm`, `parseSaleNumber`, `parseLotFinder`), the sale texts and `saleSaveFailureMessage` and `saleVoidFailureMessage` in `src/lib/failures.ts`, and `isCalendarDate` exported from `src/lib/batch-input.ts`.
- Deviation: a refused sale void reads "The sale wasn't voided." and the engine's reason with a closing period, with no "Reload to see the latest stock." tail, because a sale void gives stock back. AC-0084 asks only for the lead sentence.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 139 s, Vitest 460 passed (27 files), Playwright 220 passed.
