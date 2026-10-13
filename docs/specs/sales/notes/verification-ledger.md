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

## T3 (2026-10-13)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/sales-data.test.ts` (sha256 670c2cd7…366d52); observed red: `Cannot find module '../src/lib/trace.js'`. The file then grew to 13 cases, the AC-0135 case writing 1,001 one-pound sales in about 5 s.
- Built: `src/lib/sales.ts` (`listSaleProducts`, `listCustomers`, `getFinishedOnHand`, `listRecentSales`, `getSaleSummary`) and `src/lib/trace.ts` (`getSaleTrace`, `listSaleLots`, `findLots`, `getLotTrace`, and the paging loop `readAllPages` with 500-row pages, half of `max_rows`).
- Controller fix: the test file's added imports now sit in one ordered block and take `VALLEY_ID` from `test/db.ts`.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 192 s, Vitest 473 passed (28 files), Playwright 220 passed. `meat-ops-invoice` ran its own suite on stack B at the same time.

## T4 (2026-10-13)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/save-sale.test.ts` (sha256 0daf82fd…445dd4); observed red: `Cannot find module '../src/app/sales/save-sale.js'`. The file then grew to 23 cases.
- Built: `src/app/sales/save-sale.ts` (`decideSaleSave`, `decideSaleVoid`, and their state types), `src/app/sales/form-fields.ts`, and `src/app/sales/actions.ts` (`saveSale`, `voidSale`).
- Deviations: the saved sale's lbs and price per lb are present only when the reads after the write succeeded (AC-0040, AC-0047); the stock before and after stay the database's numbers (null where the menu view has no row), and the page formats them; `decideSaleVoid` takes only the caller check and the write; a missing summary row after the write counts as a failed read.
- Controller fix: the test file's added imports now join the stub's import block.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 219 s, Vitest 496 passed (29 files), Playwright 220 passed.

## T5, part 1 (2026-10-13)

- The controller split T5 into two `implementer` dispatches: part 1 builds every T5 app file and the browser tests for access, navigation, the form, and the result; part 2 writes the tests for refusals, failures, recent sales and void, keyboard and focus, and the page-state checks.
- Built: the Sales and Trace links in `src/app/page-header.tsx`; `src/app/sales/page.tsx`, `sale-form.tsx`, `result-panel.tsx`, `recent-sales.tsx`, `void-dialog.tsx`, `voided-sales.tsx` (a client context that tells the "Sale saved" panel its sale was voided from this page's list, AC-0083), and `error.tsx`; a heading-only `src/app/trace/page.tsx` until T6; `test/e2e/sales-page.ts` and `test/e2e/sales.spec.ts` (54 tests); the Tab-order lists in the receiving, production, and menu helpers and the pricing suite's navigation slice.
- Deviations: the lbs label reads "Weight sold (lbs)" and the price label "Price per lb ($)"; a stock figure the menu view has no row for shows "Not available"; a voided panel keeps its lots and drops only the before-and-after stock.
- Controller fix: the void confirmation said "to No customer" for a sale with no customer; it now says "No customer".
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 1 in 351 s: Vitest 496 passed (29 files); Playwright 272 passed and 1 failed, `production.spec.ts` "AC-0010: code \"RAW-TOM\" is refused beside its field", whose `openForm` waited 5 s for the device date to fill. `meat-ops-invoice` was running its own browser suite on stack B at the same time. `npx playwright test test/e2e/production.spec.ts` then passed 69 of 69 in 1.0 min. The full suite runs again after part 2.

## T5, part 2 (2026-10-13)

- Executed by the `implementer` subagent; controller reran every gate.
- `test/e2e/sales.spec.ts` grew to 87 tests: refusals and failures (AC-0050, AC-0051, AC-0052, AC-0055, AC-0056, each also checking AC-0058 through `pg`, AC-0059, and AC-0157), recent sales and void (AC-0070 to AC-0086, AC-0089), keyboard and focus (AC-0153 to AC-0161), and `checkPageState` with a Tab-order assertion in the 14 `/sales` page states other than the error page. No app code changed.
- Mutation checks, each a temporary edit to `src/app/sales/void-dialog.tsx` that was restored: skipping `markVoided` turned the AC-0083 test red; skipping the focus move to "Recent sales" turned three tests red (AC-0158, the keyboard-only AC-0153 and AC-0154 test, and the AC-0083 test); skipping `setRefusal` turned the AC-0084 test red.
- Observed: after an AC-0047 save the page is not revalidated, so Recent sales still shows the list it loaded until a reload, as the design says and as the panel's "Reload this page to see them." asks.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 415 s, Vitest 496 passed (29 files), Playwright 305 passed.

## T6, part 1 (2026-10-13)

- Executed by the `implementer` subagent; controller reran every gate. Split like T5: part 1 builds every `/trace` file and the tests for access, find a sale, a sale's trace, and find a raw lot.
- Built: `src/app/trace/page.tsx` (reads `?sale=`, `?lot=`, or `?raw=&received=`, in that order of precedence, and runs the same rules as the forms), `find-forms.tsx`, `sale-trace.tsx`, `lot-list.tsx`, `lot-trace.tsx`, and `error.tsx`; `test/e2e/trace-page.ts` and `test/e2e/trace.spec.ts` (25 tests: AC-0001, AC-0002, AC-0090 to AC-0093, AC-0095 to AC-0102, AC-0110 to AC-0119).
- The implementer's `npm test` stopped at Vitest: `test/access.test.ts` "AC-0006, AC-0007, AC-0009: direct writes to ledger tables are refused for every role" timed out at 5 s, alone too. Read on stack A: `pg_class` held 355,294 dead rows, and the Realtime slot `cainophile_tjzdry5c` held `catalog_xmin` 45,478 transactions back (the local stack note in `docs/architecture/overview.md`). With the owner's approval (2026-10-13), the slot's backend was ended as `supabase_admin`; Realtime opened `cainophile_uyt9dfig` at once, and `vacuum pg_class` left 0 dead rows.
- Controller gates after the fix: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 127 s (415 s before the fix), Vitest 496 passed (29 files), Playwright 330 passed.
