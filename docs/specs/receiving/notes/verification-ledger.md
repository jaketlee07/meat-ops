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
