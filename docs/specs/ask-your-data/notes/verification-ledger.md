# Verification ledger: ask-your-data

Observations and owner decisions recorded after the spec and plan baselines. The spec and plan stay pinned; this file carries what the work learned. Newest last.

## Before EXECUTE (2026-10-18)

- 2026-10-16: the owner approved the spec and the plan. `approve-plan` recorded the baseline (spec hash c60bc9a94d66…, plan hash bf6c6acde413…).
- 2026-10-18: the owner directed a merge of `origin/main` into `feat/ask-your-data` (merge commit fb472a1) in place of the rebase the spec's Always do names. `main` was at ca5c891, Alerts' merge (PR #22), so the build's precondition holds. The merge had no conflict. Outside this spec's folder the merged tree equals ca5c891 (`git diff --stat ca5c891 HEAD -- . ':!docs/specs/ask-your-data'` prints nothing). "`main` when the build starts" in AC-0127 to AC-0131 is ca5c891.
- 2026-10-18: the owner directed this folder onto stack B, in place of the stack A the spec's Assumptions name. Setup by `AGENTS.md` "Set up a folder on stack B": `npm ci` (190 packages, 0 vulnerabilities); the copy (`cmp` reports an exact copy); `supabase start` (stack B was already running); the folder check (it listed only `../meat-ops`, which has no `supabase/.env` and so is on stack A); `npm run db:reset:stack-b` (applied main's migrations through `20261016204845_alerts.sql`); the `.env` command (`SUPABASE_URL` is `http://127.0.0.1:55321`; no `ANTHROPIC_API_KEY` line). Tests run as `E2E_PORT=3200 npm test`, after the folder check lists no other stack B folder. `../meat-ops-alerts` is also a stack B folder; it was not running.
- 2026-10-18: baseline `E2E_PORT=3200 npm test` on the merged code before any ask-your-data change: pass. Vitest 41 files, 734 tests, 24 s; Playwright 542 tests, 5.8 m.
- Canonical preflight: `workspace.toml` registers no spec, so `workspace-status` reports empty `ready` and `active` sets. The owner's request names this spec, so the build uses it. `check-base-freshness` reported the head current; `loop-engine status` read SPEC-PLAN-APPROVED; `loop-cohort identity` and `plan check-current` passed; `approve-plan` was a no-op; `schedule` persisted 5 waves (T1, T2, T3, T4, T5); `plan-locked` moved the run to CODE-IMPLEMENTATION. Tasks run one at a time.
- Stub digests: the three `stub: true` blocks extracted from `plan.md` match their recorded sha256 (T1 `ceb6a5f1…`, T2 `8002424a…`, T3 `e35573e8…`).
- Dependencies & integration predicate: on ca5c891, `src/app/_server/model.ts` has a private `buildClient()` that sets `apiKey`, `baseURL`, `authToken: null`, `webhookKey: null`, `logLevel: "off"`, `maxRetries: 0`, and the sparse `fetch`; `writeDigest` already passes a per-request `{ timeout, signal }` to `messages.create`. The predicate holds, so no extraction is needed.
- Anchor-test sweep: no test hashes or snapshots a file this plan edits. The Primary-navigation control lists that name "a Alerts" are in `test/e2e/menu-page.ts`, `invoices-page.ts`, `sales-page.ts`, `trace-page.ts`, `receiving-page.ts`, and `production-page.ts`, all inside T4's Touches. `test/e2e/invoices.spec.ts` reads every file under `.next/static` for the test key; it keeps passing as long as no key reaches the client bundle.
- Main-at-start checks, on ca5c891: AC-0127's command prints nothing. AC-0128's list is `src/app/_server/model.ts`, `src/app/_server/session.ts`, `src/privileged-env.ts`.
- Project-knowledge capture is not attempted at the gates; the store refused captures in earlier sessions. Reusable lessons go to the session memory.

### Assumption trio

- **Touches:** the files each task's `Touches` names, and this ledger.
- **Done:** each task's `Tests` and `Done when`, with `npm run typecheck`, `npm run build`, and `E2E_PORT=3200 npm test` green after each task (spec Always do).
- **Not changing:** any file under `supabase/`; any existing read in `src/lib/` beyond exporting `hasExactly` unchanged; the invoice and digest requests in `model.ts`; what any other page shows beyond the Ask link; `package.json` dependencies.

### Declined

- A new read or view for any answer: the spec's Never do forbids a file under `supabase/`, and every answer has a shared read (plan Design table).
- Importing `stockView` from `src/app/stock-view.ts` into `src/lib/`: AC-0124 forbids an import from `src/app/` in `src/lib/`; the one rule is repeated instead (plan Design).
- Storing the last answer in the URL or session storage so a reload keeps it: the spec's Never do forbids storing an answer, and AC-0014 wants a reload to clear it.
- A retry on a failed model request: rung 1, not needed; AC-0068 requires exactly one request.
- A shared "ask" helper for the three model calls in `model.ts`: rung 1, not needed; `askModel` reuses `buildClient` and `failureOf` and adds only its own parse.

### Resolve-vs-surface record

Opened at PLAN. Each review finding is recorded here with its disposition; it closes at DECIDE.

## T1 (2026-10-18)

- Executed by the `implementer` subagent in the primary working tree; controller reran every gate.
- Stub materialized byte-identical at `test/ask-rules.test.ts` (sha256 ceb6a5f1…278644); observed red: `Cannot find module '../src/lib/ask.js'`. The file then grew to 29 cases.
- Built: `src/lib/ask.ts` (the catalog, the page texts, `checkQuestion`, `INSTRUCTIONS`, `answerSchema`, `askRequest`, `parseModelAnswer`, `interpret`, `parseLookup`, and the failure kinds, messages, and log line); `hasExactly` exported from `src/lib/invoice-reading.ts` with no other change; `test/fixtures/questions/questions.json`, 34 samples (24 in-catalog, 2 ambiguous, 8 out-of-catalog).
- `INSTRUCTIONS` equals the plan's fixed text line for line (15 lines), checked by a script that compares the two.
- Deviation: `askFailureKind` repeats invoice entry's three-line rule, because `failureKind`'s result type holds kinds Ask does not have (`too-long`). Invoice reading is unchanged.
- Controller fixes: the exported `hasExactly` line regained the space the edit dropped; the question-set test no longer carries AC-0110's id, since AC-0110 is closed only by the live run.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `E2E_PORT=3200 npm test` exit 0, Vitest 763 passed (42 files, 24 s), Playwright 542 passed (5.7 m).

## T2 (2026-10-18)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/ask-answers.test.ts` (sha256 8002424a…1091b); observed red: `Cannot find module '../src/lib/ask-answers.js'`. The file then grew to 25 cases.
- Built: `src/lib/ask-answers.ts` (`readProductLists`, `answerFor`, and the `Answer` type). Each query calls the read the plan's Design table names; no shared read, no file under `supabase/`, and `ask.ts` are changed.
- `listPricing` already sorts "Needs a new price" below target first, then by code (menu-pricing AC-0064), and `getMenu` sorts by code; `v_product_pricing`, and so `v_current_menu`, hold active finished products only (`supabase/migrations/20261009070619_menu_pricing.sql`).
- Notes: `set_target_margin` takes percent units, so the fixtures pass 20 for a 20% target. In AC-0035's fixture a 100-lb draw from batch 1 takes from both raw lots, so its items list lot A and lot B; the criterion checks only "(No customer)". `pricing_attention` keeps rows that need a new price and carry a price action and a suggested price, as the pricing page's advice does.
- Controller fix: the test file's second import from `./db.js` now joins the stub's import block.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `E2E_PORT=3200 npm test` exit 0, Vitest 788 passed (43 files, 27 s), Playwright 542 passed (6.4 m).

## T3 (2026-10-18)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/ask-actions.test.ts` (sha256 e35573e8…68be1ae); observed red, with `src/app/ask/ask-question.ts` moved aside: `Cannot find module '../src/app/ask/ask-question.js'`. The file then grew to 22 cases.
- Built: `askModel` in `src/app/_server/model.ts` (the shared `buildClient`, one `messages.create` with `{ timeout: 60_000, signal }` where `signal` is its own `AbortSignal.timeout(60_000)`, no-answer whenever that deadline fired, then `parseModelAnswer`); `src/app/ask/ask-question.ts` (`decideAsk`, `decideLookup`, `AskDeps`, `LookupDeps`, `AskState`); `askQuestion` and `lookUpAnswer` in `LoggedAction`. `readReceipt` and `writeDigest` are unchanged.
- The deadline follows `writeDigest`'s `AbortSignal.timeout` rather than the plan Design's `AbortController` and timer; both abort the request at 60 seconds, and the rule keys on "the deadline fired", not on the error's class.
- `LookupDeps` holds only the caller and the read, so a lookup cannot reach the model check, the product lists, or the model. A throw from `askModel` is logged as `askQuestion failed: kind=service-error` only, so no error text can carry the question into the log.
- AC-0127's command prints nothing.
- Controller fixes: three test labels named the wrong criterion (now AC-0047, AC-0068, AC-0069); the choose state's `query` is typed as a product query.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `E2E_PORT=3200 npm test` exit 0, Vitest 810 passed (44 files, 32 s), Playwright 542 passed (6.1 m).

## T4 (2026-10-18)

- Executed in two `implementer` dispatches; controller reran every gate. Part 1 built every T4 app file and the browser tests for access and navigation, the page, answers on screen, and choosing (commit 2f5dd3f). Part 2 wrote the tests for the request, the failures, the spare-app and 60-second cases, and the remaining page states.
- Built: `src/app/ask/page.tsx`, `ask-panel.tsx`, `actions.ts` (`askQuestion`, `lookUpAnswer`), `form-fields.ts`, and `error.tsx`; the Ask link just before Alerts in `src/app/page-header.tsx`; "a Ask" before "a Alerts" in the control lists of `test/e2e/menu-page.ts`, `invoices-page.ts`, `sales-page.ts`, `trace-page.ts`, `receiving-page.ts`, and `production-page.ts` (`pricing-page.ts` and `alerts-page.ts` take `MENU_CONTROLS`); `test/e2e/ask-page.ts` and `test/e2e/ask.spec.ts`, 64 tests.
- Deviation: `test/e2e/fake-model.mjs` is unchanged. Alerts already added `{ stallAfterHeaders: true }` (a 200, its headers, and part of a body, then nothing until reset), which is the answer the plan named `{ stallBody: true }`; the AC-0078 stalled-body case uses it.
- AC-0086 is checked by one route watch on every server-action POST to `/ask` the browser sends, in every test of the file: it fingerprints every `public` table and both `private` tables (`private.list_price_changes`, `private.operators`) before and after the press, and an `afterEach` asserts no change. AC-0059's test exempts `products`, which it changes by hand while the press is held. Replayed requests are fingerprinted explicitly in the AC-0069 and AC-0082 replay test.
- AC-0070 uses a revoked session plus an expired access token, as `receiving.spec.ts` AC-0042 does: the proxy refreshes an expired token alone, and the press then succeeds.
- AC-0075 revokes `select` on `public.products` after `/ask` loads, since the page load reads no product; the grant is restored in a `finally`.
- The two 60-second AC-0078 cases run on a spare app started with `ANTHROPIC_API_KEY` set to the suite's test key and `ANTHROPIC_BASE_URL` to the fake model; each shows the message, sends one request, and leaves exactly one `askQuestion failed: kind=no-answer` line in the spare app's output.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `E2E_PORT=3200 npm test` exit 0, Vitest 810 passed (44 files, 26 s), Playwright 606 passed (8.3 m).
