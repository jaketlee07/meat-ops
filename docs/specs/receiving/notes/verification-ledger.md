# Verification ledger: receiving

Execution observations, newest last. Each entry names the task, the command, and the observed result.

## Gates before EXECUTE (2026-10-08)

- Pre-EXECUTE reviews closed clean after five rounds: adversarial (direct clean, round 5), security (adjudicated clean, round 5), shaping (Clean, round 4; the spec is unchanged since). Raw and adjudication artifacts are under the ignored `.context/reviews/8bd1023d-4bec-4e12-a2b5-8d29179b0f2c/`.
- Owner approved the spec, then the plan, in chat on 2026-10-08; `approve-plan` recorded the baseline and `plan check-current --require-schedule` passed after `plan-locked`.
- project-knowledge unavailable: `--capture --producer-profile work-loop --semantic-gate plan-locked` refused with `staged_dual_writer` (the legacy knowledge base is not migrated). No fallback file was created. The spec-approved gate had no reusable spec-authoring practice to admit.

## T1 (2026-10-08)

- Executed by the `implementer` subagent in the primary working tree; controller reran every check.
- Baseline before install: `npm test` 107 passed (5 files). After: 107 passed (5 files).
- `npm run typecheck` exit 0; `npm run build` exit 0 (routes `/`, `/_not-found`).
- AC-0060: 27 of 27 runs (9 check names x build, start, dev) exited 1, printed the name, and printed no marker (scratch `ac0060.mjs`).
- AC-0063: `npm run start` and `npm run dev` process trees each held one listener, on `127.0.0.1` (scratch `ac0063.mjs`).
- AC-0064 grep and the three AC-0039 greps print nothing.
- `npx playwright test --list` loads the config (the localhost guard fires on a non-local `API_URL`); with no spec yet it exits 1 "No tests found". T5 adds the first spec.
- Deviation: `test:e2e` is `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 playwright test`. On Node 22.17 with Playwright 1.64 the default synchronous module hooks fail to load `@supabase/supabase-js` ("Unexpected module status 3"); the variable is read in `node_modules/playwright/lib/common/index.js`. T5's `test` script calls `npm run test:e2e` after Vitest.
- Deviation: `next.config.ts` sets `agentRules: false`, a Next.js 16.4 option, because `next dev` otherwise appends a managed block to `AGENTS.md`.
- Controller fix: `npm update source-map-js` moved only `source-map-js` 1.2.1 to 1.2.2 (GHSA-68fv-2mgg-jv7q, high, via `@tailwindcss/postcss`); `npm run audit` now reports 0 vulnerabilities in shipped dependencies.
- Observed, out of scope: `npm audit` including dev dependencies reports 2 critical, 1 high, and 3 moderate advisories, all in the `vitest` 2.1.9 tree already on `main` (`tinypool`, `vite`, `vite-node`, `esbuild`, `@vitest/mocker`); fixing them needs a major Vitest upgrade.

## T2 (2026-10-08)

- Executed by the `implementer` subagent; controller reran gates.
- Stub materialized byte-identical: `test/operator-check.test.ts` sha256 51a04baf… (matches the plan block). Observed red before implementation: "TypeError: isOperator is not a function". Access suite red after the migration and before the fixture entry: "fixture has valid arguments for check_operator" and "fixture exercises check_operator".
- Migration `supabase/migrations/20261008110703_operator_check.sql` (SECURITY INVOKER, `search_path = ''`, revoke then grant EXECUTE to `authenticated`); applied with `supabase migration up`.
- Controller gates: `npm run typecheck` exit 0; `npm test` 108 passed (6 files); AC-0033 `supabase db advisors --local --type security --fail-on warn` exit 0, "No issues found"; AC-0034 regeneration byte-identical, the only type change is `check_operator: { Args: never; Returns: undefined }`.
- The access model in `docs/architecture/overview.md` names `check_operator` for every role in the same task as its grant.

## T3 (2026-10-08)

- Executed by the `implementer` subagent; controller reran gates.
- Stubs materialized byte-identical: `test/format.test.ts` sha256 c9cde669…, `test/receipt-input.test.ts` sha256 751b9bae… (match the plan blocks, re-checked after the runs). Observed red before implementation: "Failed to load url ../src/lib/format.js" and "../src/lib/receipt-input.js".
- `src/lib/format.ts` and `src/lib/receipt-input.ts` are pure (no imports, no environment, no clock). Extra cases live in `test/format-extra.test.ts` and `test/receipt-input-extra.test.ts` so the stubs stay byte-identical; they were written after the implementation, not red-first.
- Controller gates: `npm run typecheck` exit 0; `npm test` 152 passed (10 files).
- Observation: the approved `format.test.ts` stub restores `process.env.TZ = originalTz`; when `TZ` was unset this leaves the string "undefined", which Node treats as UTC for later files in the same Vitest fork. Harmless for the current suites; the stub is pinned, so it stays.
- Interpretation fixed in code: a number field needs at least one digit; "5." and ".5" are accepted; blank means empty after `trim()`; notes and the void reason are returned as typed.

## T4 (2026-10-08)

- Executed by the `implementer` subagent; controller reran gates.
- Stub materialized byte-identical: `test/receiving-data.test.ts` sha256 e89e03df… Observed red before implementation: "Failed to load url ../src/lib/receiving.js".
- `src/lib/receiving.ts`: `listRecentReceipts` (receipt_seq desc, limit 10, exact count, status from the void_receipt rule), `listActiveRawProducts`, `listVendors` (case-insensitive sort), `getStock` (balance or null, plus the non-void receipt count), `listFinishedPrices`. Reads only. Extra cases in `test/receiving-data-extra.test.ts` (12).
- Controller gates: `npm run typecheck` exit 0; `npm test` 167 passed (12 files). AC-0038 and AC-0040 greps print nothing.

## T5 (2026-10-08)

- Executed by the `implementer` subagent; controller reran gates and the goal-based checks.
- `supabase/config.toml` `[auth.sessions]` set to `timebox = "168h"` and `inactivity_timeout = "12h"`; local stack restarted. AC-0062: `docker inspect supabase_auth_meat-ops` shows `GOTRUE_SESSIONS_TIMEBOX=168h0m0s` and `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=12h0m0s`.
- Controller gates: `npm run typecheck` exit 0; `npm test` (now `vitest run && npm run test:e2e`, AC-0036) exit 0, Vitest 167 passed (12 files), Playwright 9 passed (2 setup, 7 auth specs).
- `test/e2e/auth.spec.ts` covers AC-0001, AC-0003, AC-0041, AC-0004 (message and Sign out), AC-0005, AC-0061, AC-0006 (at sign-in and after a proxy refresh of an expired access token), with the per-state helper (AC-0025, AC-0026, AC-0054, AC-0030, AC-0031) on the sign-in, failed sign-in, and non-operator states. The implementer mutation-checked the helper, AC-0061, and AC-0006 by breaking each control and watching the test fail.
- AC-0068: `test/e2e/checks/ac0068-env-reload.sh` (controller rerun): before, GET /sign-in 200; after "Reload env: .env.local", GET /sign-in, GET /receiving, and POST /receiving each 500 "Server misconfigured." with no marker in the body or the dev log; `.env.local` removed afterwards.
- The T1 check scripts move into the repository beside it: `test/e2e/checks/ac0060-privileged-guard.mjs` and `ac0063-loopback-only.mjs` (run as `node <script> "$PWD"`).
- Deviation: AC-0005 and AC-0061 sign in through the form as the non-operator, whose page has a Sign out button before T6 gives the operator one.
- Observed: with the REST container stopped, a request to `/receiving` waited past 30 s, because the operator check has no timeout; the error page appears only when the call fails. Auth cookies carry no `Secure` attribute on plain-http localhost; the app HTTPS hosting intent covers it.

## T6 (2026-10-08)

- Executed by the `implementer` subagent; controller reran gates.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0, Vitest 167 passed (12 files), Playwright 47 passed (2 setup, 45 specs). AC-0038, AC-0039 (three greps), AC-0040, AC-0059 print nothing; no em dashes under `src/` or `test/e2e/`.
- `test/e2e/receiving.spec.ts` covers AC-0007 to AC-0019 (AC-0010 once per table row), AC-0042 and AC-0046 (both ended-session cases), AC-0027, AC-0055, AC-0028, AC-0056, AC-0057 (AC-0019 and AC-0042 members), AC-0029, and AC-0067 (on-hand and first-receipt rows); the per-state helper runs on the empty form, after a blank-weight refusal, after an AC-0019 refusal, after an AC-0042 refusal, and after a save. `test/e2e/auth.spec.ts` gains the AC-0002 and AC-0004 form assertions and the save halves of AC-0044 and AC-0066 (replay with no cookies and with the non-operator state; lot count unchanged; each body carries its message).
- Deviation from the T6 row's Touches: `src/proxy.ts` and `src/app/_server/session.ts` changed, because AC-0042's second case could not hold otherwise. When the proxy cleared a refused session on a server-action POST, Next.js rendered the page again inside the action's response, the page redirected to `/sign-in`, and the form was lost (observed as `set-cookie` clears plus `x-action-revalidated`). Now the proxy skips a cookie batch made only of clears on a non-GET/HEAD request (a refresh with new tokens still writes, reads unchanged), and `createSessionClient({ readOnly: true })` lets the save action read the session without writing cookies. The action then answers "signed out" itself. The post-gates security review covers this change.
- Deviation: the form submits from `onSubmit` with `startTransition`, not `<form action>`, because React's post-action form reset cleared the vendor select after a refused save; the kept-values assertions fail under `<form action>` and pass now.
- Deviation: the ended-session second case signs in through the app's own form in a new browser context (fresh operator session, never saved under `test/e2e/.auth/`) rather than through the auth API, to get the app's exact cookie format.
- A non-operator's save reads "The receipt wasn't saved. This account isn't allowed to use Meat Ops." After a successful write whose follow-up read fails, the panel says the receipt was saved and its totals could not be loaded, rather than reading as "not saved".
- Observed: `receiveLot` in `src/lib/rpc.ts` drops the SQLSTATE, so `src/app/receiving/refusal.ts` maps refusals from the engine's message text. Every raw product (inactive included) is read by a private helper in `actions.ts`.

## T7 (2026-10-08)

- Executed by the `implementer` subagent; controller reran gates and checked the rendered screens.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0, Vitest 167 passed (12 files), Playwright 61 passed (2 setup, 59 specs). AC-0038, AC-0039 (three greps), AC-0040, AC-0059, AC-0064 print nothing; no em dashes.
- `test/e2e/receiving.spec.ts` adds AC-0020 (12 receipts entered out of date order), AC-0047, AC-0048 (the 10 and 11 boundary), AC-0049, AC-0021 (the T4 fixture), AC-0022, AC-0050 (Cancel and Escape send no request), AC-0051, AC-0023, AC-0052 with AC-0057, AC-0053 with AC-0067 (all-void rows), and AC-0043 with AC-0057 (both ended-session cases); the per-state helper runs on the list, the open void confirmation, and the list after an AC-0052 refusal. `test/e2e/auth.spec.ts` adds the void halves of AC-0044 and AC-0066, plus tampered operator replays (blank reason, unknown lot) that write no void mark and a control replay that does.
- Deviation from the T7 row's Touches: `test/e2e/a11y.ts` now starts the Tab walk inside an open modal dialog, because the page body is inert while one is open; `test/e2e/receiving-page.ts` gained void helpers. The AC-0012 tab-order expectation gained the two Void buttons that now follow a save.
- Controller layout fix in `src/app/receiving/facts.tsx`: at 320 px a value such as "$2.75/lb" split mid-word; the value now keeps its width (up to 60%) and the label wraps. Screens checked at 390 px and 1280 px (empty, product chosen, refused save, saved with before and after, void confirmation): no overflow, values intact, focus ring visible on the first errored field.
- Observed: a refused void does not re-render the region, so a stale Void button stays until the next load; re-rendering would unmount the message AC-0052 and AC-0057 require.

## T8 (2026-10-08)

- Executed by the controller.
- Durable outputs: `docs/architecture/overview.md` gains the `src/app/`, guard, and `test/e2e/` area rows, the session limits in the `supabase/config.toml` row, the write-path sentence, and an "App trust boundary" section (variables, cookies, sessions, network, the proxy authorizes nothing); the `check_operator` access-model rows landed in T2. `AGENTS.md` "Build and test commands" lists dev, build, test, test:e2e, audit, the one-time browser install, and the `.env` command (verified: it prints exactly `SUPABASE_URL` and `SUPABASE_ANON_KEY`). `docs/costing.md` states the AC-0024 formats and the AC-0067 texts in its Rounding note, and its opening names `test/format.test.ts` and `test/e2e/receiving.spec.ts`.
- Closing goal-based checks, all on the T8 tree: AC-0033 advisor exit 0; AC-0034 regeneration byte-identical; AC-0035 build exit 0; AC-0037 typecheck exit 0; AC-0038, AC-0059, AC-0039 (three greps), AC-0040, AC-0064 print nothing; AC-0065 `npm run audit` "found 0 vulnerabilities"; AC-0062 `GOTRUE_SESSIONS_TIMEBOX=168h0m0s`, `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=12h0m0s`; AC-0060 27 of 27 refused; AC-0063 start and dev each one listener on `127.0.0.1`; AC-0068 three 500s with no marker; AC-0036 `npm test` exit 0, Vitest 167 passed, Playwright 61 passed.
- Foundation-hardening AC-0049 for `AGENTS.md`: every cited path exists except the exempt `CONTRIBUTING.md` and `AGENTS.local.md`. The doc edits add no em dashes.

## Post-gates review, round 1 (2026-10-08)

Reviewers on `git diff 7d81cf2..dc8294a`, each report adjudicated (artifacts under the ignored `.context/reviews/8bd1023d-4bec-4e12-a2b5-8d29179b0f2c/`):

- adversarial-reviewer: 12 sustained (1 Concern: the device date is read once at mount, so a form open past midnight refuses the real date; 11 Nits).
- quality-engineer: 17 sustained (Concerns: the midnight date; the AC-0068 script exits 0 whatever it observes; the AC-0009 test catches a UTC-based default only part of the day; 14 Nits), 1 refuted (rollback path).
- frontend-reviewer: Major sustained (error page Try again calls `reset`, which does not re-fetch); 3 Minors sustained (a thrown save or void loses the form; the error page drops focus; result-panel numbers cannot wrap at 320 px); 2 refuted; 2 indeterminate pending owner decisions (sign-in copy for non-credential failures; announcing the void dialog's lot sentence).
- security-reviewer: 1 Nit sustained (the AC-0068 script cannot fail); 1 indeterminate pending an owner decision (no Host-header check, so a DNS-rebinding page could drive sign-in and spend the shared sign-in limit).
- experience-reviewer: named skip (not installed).

Owner decisions, in chat on 2026-10-08:

1. Fix the DNS-rebinding exposure now: refuse any request whose Host is not the loopback host the app serves (spec amendment, re-approval).
2. Fix scope "nearly everything": the Concerns and the Major; the Host check; failure handling (a failed or unreachable save or void keeps the form and says honestly that the receipt may or may not be saved; a time limit on server database calls); sign-in failures that are not bad credentials; the stale result panel after voiding a just-saved receipt; the stale region after a refused void; the docs, ledger, and test-strength Nits. Two test-tool refinements go to the backlog: a test seam for the "saved, totals not loaded" branch, and opacity-aware ring scoring in `test/e2e/a11y.ts`.
3. Sign-in failures other than bad credentials read "Couldn't sign in right now. Wait a few minutes and try again." and leave a server-side record; "Email or password is incorrect." stays for bad credentials.
4. The void confirmation announces its lot sentence to screen readers (`aria-describedby`).

Review state: `findings-remain` (seq 24) and `review record` round 1 with 29 fingerprints. The new criteria go through a controlled contract amendment.
