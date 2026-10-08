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
5. Under `npm run dev`, Next.js answers its own dev-tool addresses before the proxy runs, so the Host check (AC-0069) covers `npm run start`, which becomes the command for daily use. The dev-mode exposure to a DNS-rebinding page is accepted (chosen in chat, 2026-10-08, during the amendment review).

Review state: `findings-remain` (seq 24) and `review record` round 1 with 29 fingerprints. The new criteria go through a controlled contract amendment.

## Amendment review (2026-10-08)

The amendment (spec sha256 9e886c4d77ca9f45d686b2d8aab0893aff5020146b2942eeafe63d869cb59a6a, plan sha256 992456bdaef3f238238027433b5856d3f90f3a4d158e22eb76b6a65c81d48b22) closed clean after five rounds, numbered 6 to 10 after the five pre-EXECUTE rounds before the build. Artifacts are under the ignored `.context/reviews/8bd1023d-4bec-4e12-a2b5-8d29179b0f2c/`.

- adversarial-reviewer: direct clean in rounds 9 and 10, after 11, 3, and 2 sustained findings in rounds 6 to 8.
- security-reviewer: adjudicated clean in rounds 8 to 10, after round 6 (2 sustained, 1 refuted, 1 indeterminate made moot by covering every path) and round 7 (1 sustained, 1 refuted).
- shaping-reviewer: Clean in round 5 of its own count, after 10, 7, 3, and 1 findings.
- The final T10 stub was compiled against placeholder declarations of `RpcError` and the `src/lib/failures.ts` surface (exit 0) and, with the placeholder removed, failed with "Failed to load url ../src/lib/failures.js".
- Facts probed during review: Node 22.17.0's default HTTP server answers an HTTP/1.1 request with no `Host` with 400 before any handler runs and passes an HTTP/1.0 one to the handler (scratch probe); the local auth server's key list holds one EC key with alg ES256.
- Deviation: the spec and plan were revised between rounds without firing `findings-remain` and `spec-ready` around each revision. The state stayed SPEC-PLAN-REVIEW from seq 26, and every fired reviewer reached clean on the final hashes above.
- Owner approval, in chat on 2026-10-08: the amended spec is approved, and the write-call clauses of AC-0072 and AC-0083 resting on unit rules alone is accepted, with the end-to-end test queued in `docs/product/intents/receiving-test-refinements.md`.

## T9 (2026-10-08)

- Executed by the `implementer` subagent; the controller reran the gates.
- Controller gates: `npm run typecheck` exit 0; `npm test` exit 0 in 61 s, Vitest 167 passed (12 files), Playwright 65 passed (2 setup, 63 specs). The implementer's `npm run build` exited 0.
- `src/proxy.ts` exports no matcher, so it runs on every request. It refuses a missing or non-local Host with 421 before the privileged check, and skips session work for `/_next/static/`, `/_next/image`, and `/favicon.ico`.
- `test/e2e/auth.spec.ts` adds four AC-0069 tests: a foreign Host on five paths gets 421; an HTTP/1.1 request with no Host gets Node's 400 and an HTTP/1.0 one gets 421; a captured sign-in action replayed with a foreign Host to `/sign-in` and `/favicon.ico` gets 421 and adds no `auth.sessions` row; `127.0.0.1:3100` and `localhost:3100` are served. The tests spend no sign-in.
- Red check by the implementer: with the proxy from HEAD, the foreign-Host, no-Host, and replay tests failed (`/` answered 307; the Host-less HTTP/1.0 request got the 200 sign-in page).
- Deviations: the replay also sets `origin` and `referer` to the foreign name, as a rebinding page would, so Next's own action origin check cannot mask the proxy's answer. The static paths match exactly (`/_next/image`, `/favicon.ico`) or by the `/_next/static/` prefix. The Host match ignores case.

## T10 (2026-10-08)

- Executed by the `implementer` subagent; the controller made one fix and reran the gates.
- Red: `test/failures.test.ts`, byte-identical to the plan's T10 stub, failed with "Failed to load url ../src/lib/failures.js" before the module existed; it then passed 14 of 14.
- Controller gates: `npm run typecheck` exit 0; `npm test` exit 0 in 81 s, Vitest 182 passed (13 files), Playwright 65 passed.
- `src/lib/rpc.ts` throws `RpcError` from every wrapper, `isOperator` included, with the old message text and PostgREST's code ("" when there is none). `src/lib/failures.ts` holds the messages, the sign-in mapping and log line, `sessionOutcome`, `withTimeout`, and `DB_CALL_TIMEOUT_MS` (10,000), and imports nothing. `listRawProducts` is in `src/lib/receiving.ts`, with a local-stack case that includes an inactive raw product; the private copy in `actions.ts` goes in T11.
- Controller fix: an engine refusal of a void now ends its reason with a period before "Reload to see the latest stock.", and a not-allowed refusal (42501) carries no reload hint.
- Observed: `withTimeout` bounds the wait for the response headers; a body that stalls after them is not bounded, which matches AC-0082's "no response".

## T11 (2026-10-08)

- Executed by the `implementer` subagent; the controller reran the gates.
- Controller gates: `npm run typecheck` exit 0; `npm test` exit 0 in 71 s, Vitest 182 passed (13 files), Playwright 68 passed. No file under `src/` imports `refusal.ts`, which is deleted; no em dashes in `src/` or `test/`. The implementer's `npm run build` exited 0.
- `src/app/_server/caller.ts` (`checkCaller`) serves `saveReceipt` and `voidReceipt`: the read-only client, `getClaims` read through `sessionOutcome`, then `isOperator`, with the outcomes operator, ended, not-operator, and failed. `signIn` and `signOut` keep their own client.
- Every server-side Supabase client, the proxy's included, passes `withTimeout(fetch, 10000)` as `global.fetch`. Read from node_modules: supabase-js 2.117.3 hands it to the auth client (sign-in, user lookup, refresh, and the signing-key fetch behind `getClaims`), to PostgREST, and to storage and functions; `@supabase/ssr` 0.12.7 passes `global` through.
- Tests added or changed: AC-0071 with AC-0081 and AC-0057 (save request aborted; exact message, values kept, focus, no lot, per-state checks), AC-0073 with AC-0057 (void request aborted; list kept, exact message, focus, lot unchanged, per-state checks), AC-0077 (the refused void ends with the reload hint; the stale stock assertion is gone), AC-0066 (full refusal texts), and a second AC-0005 test that signs out its own session.
- Implementer probe, not committed: a scratch forwarder in front of the local stack failed or hung chosen calls against the built app. Sign-in with auth answering 503 or dropping the connection showed the AC-0070 message, and the log lines were "sign-in failed: code=none status=503" and "sign-in failed: no answer from the auth server", with no email or password. `/receiving` with REST answering 503 showed the error page with focus on its heading, and Try again showed the form without a reload. A save with REST hanging showed "The receipt wasn't saved. Try again in a moment." at 10.1 s. A save with only the `receive_lot` call hanging showed the AC-0071 message at 10.1 s, which exercises the write-call clause of AC-0072 once by hand. No lot was written.
- Order kept: the void's caller check runs before the reason rule, as before.

## T12 (2026-10-08)

- Executed by the `implementer` subagent; the controller reran the gates.
- Controller gates: `npm run typecheck` exit 0; `npm test` exit 0 in 88 s, Vitest 183 passed (13 files), Playwright 75 passed. No em dashes in the added lines. The implementer's `npm run build` exited 0.
- The form reads the device date when Save is pressed, and its product list from the latest `products` prop. A non-blank code missing from that list is sent with the hidden `recheckCode=1` mark; the server checks a marked code against `listActiveRawProducts` read at save time and an unmarked code against every raw code. The result panel says "This receipt was voided." with no totals once the list shows its lot as void. Result-panel cells wrap, and the void dialog's description is its lot sentence.
- Tests: AC-0009 pins the clock to 14:00 UTC on Jan 14 (03:00 on Jan 15 in Auckland); a save across midnight; AC-0078 for a product set active and one inserted after load; AC-0007 after a save; AC-0076 with the per-state checks; AC-0079; long numbers (200,000.25 lbs onto 100,000.125 lbs) with the per-state checks at 320 px; the first-run reload text. `test/e2e/a11y.ts` ends the Tab walk only on a return to the first element. `test/format-extra.test.ts` checks the date in Pacific/Pago_Pago and Pacific/Kiritimati.
- Red against HEAD (the six `src/app/receiving` files reverted, new tests kept): the midnight, AC-0078, AC-0076, AC-0007-after-save, first-run, long-number ("scroll width 354 is over 320"), and AC-0079 (empty description) tests failed. The date case failed with `timeZone: "UTC"` removed from `src/lib/format.ts` ("expected 'Oct 6, 2026' to be 'Oct 7, 2026'"). AC-0009 passed on both, since HEAD already used the device date.
- Deviations: both first-run notices (products and vendors) add "then reload this page"; the voided panel state stays once seen, so choosing another product does not bring the totals back; `page.tsx` passes the lot numbers the list shows as void.
- Observed: a form with a missing code and another bad field shows the other field's message first and the code message on the next Save, because the browser skips the code rule for a code it does not know. After a marked save, the product region stays empty until the code is typed again. `test/format.test.ts` restores an unset TZ as the string "undefined" (outside T12's Touches).

## T8, after the amendment (2026-10-08)

- Executed by the controller.
- Durable outputs: `docs/architecture/overview.md` names `failures.ts` and `_server/caller.ts`, scopes the caller-check sentence to `saveReceipt` and `voidReceipt`, and its trust-boundary section gains the Host check (with the accepted dev-mode exposure) and the failure handling (the 10-second request limit, the messages by stage, the ended-session rule, the sign-in log line). `AGENTS.md` lists `npm run start` for daily use and `npm run dev` for development only, with the exposure. `docs/costing.md` says weight drops trailing zeros. `.env.example` holds only `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- `test/e2e/checks/ac0068-env-reload.sh` exits non-zero unless all three answers are 500 and the marker is in no body and not in the dev log. Red: with the proxy's privileged check switched off, it printed GET /sign-in 200, GET /receiving 307, POST /receiving 307, then FAIL, and exited 1; the proxy was restored from HEAD.
- Goal-based checks, all on this tree: AC-0033 advisor exit 0; AC-0034 regeneration leaves no diff; AC-0035 build exit 0; AC-0037 typecheck exit 0; AC-0038, AC-0059, AC-0039 (three greps), AC-0040, AC-0064 print nothing; AC-0065 `npm run audit` "found 0 vulnerabilities"; AC-0062 `GOTRUE_SESSIONS_TIMEBOX=168h0m0s`, `GOTRUE_SESSIONS_INACTIVITY_TIMEOUT=12h0m0s`; AC-0060 27 of 27 refused; AC-0063 one listener on `127.0.0.1` (port 3106 for dev); AC-0068 three 500s, no marker, PASS; AC-0036 `npm test` exit 0 in 119 s, Vitest 183 passed, Playwright 75 passed.
- Foundation-hardening AC-0049 for `AGENTS.md`: every cited path exists except the conditional `CONTRIBUTING.md` and `AGENTS.local.md`. The doc edits add no em dashes.
- Recorded run against `npm run start` on port 3100, scripted with Playwright in the ignored `.context/recorded-run/` (one test, passed in 1.7 min; every container running afterwards):
  1. Auth stopped, sign-in: "Couldn't sign in right now. Wait a few minutes and try again."; the server log line was "sign-in failed: no answer from the auth server", and the log held neither the email nor the password (AC-0070, AC-0080).
  2. Form filled, app server restarted, auth stopped, Save: "The receipt wasn't saved. Try again in a moment."; every field kept; focus on the message; lots 0 before and after (AC-0072 auth lookup, AC-0081, AC-0057).
  3. REST stopped, `/receiving`: the error page after 10.15 s, focus on its heading, the per-state checks passed (its one control is Try again); REST started, Try again showed the receiving form without a reload (AC-0074, AC-0075, the error page state).
  4. Form filled, REST stopped, Save: "The receipt wasn't saved. Try again in a moment." after 10.1 s; every field kept; focus on the message; no lot (AC-0072, AC-0081, AC-0057).
  5. List shown, REST stopped, void confirmed: "The receipt wasn't voided. Try again in a moment."; the list kept the receipt; focus on the message; the lot unchanged at 500 lbs, not void (AC-0083, AC-0057).
  6. REST paused, Save: "The receipt wasn't saved. Try again in a moment." after 10.44 s; lots 1 before and after (AC-0082).
- The write-call clauses of AC-0072 and AC-0083 rest on T10 (accepted by the owner); the T11 probe also showed the AC-0071 message at 10.1 s with only `receive_lot` hung.

## Records the post-build review asked for (2026-10-08)

- Files changed outside a task's Touches: T3 added `test/format-extra.test.ts` and `test/receipt-input-extra.test.ts`, and T4 added `test/receiving-data-extra.test.ts`, each with cases beyond the plan's stubs (rounding ties, input edge cases, and read edge cases). T6 (commit 29f7942) created `test/e2e/receiving-page.ts`, the shared receiving test helpers, which its Touches do not list; it also edited `src/proxy.ts` and `src/app/_server/session.ts`, recorded in its entry. T7's deviations are recorded in its entry. T9 to T12 stayed inside their Touches.
- Build gap: T2, T3, and T4 recorded typecheck and `npm test`, which then ran Vitest only, and no `npm run build` at commits 3837238, 72f1939, and a6fcc19. Every later task built, and the final tree builds (AC-0035 above).

## Post-gates review, round 2 (2026-10-08)

Reviewers on `git diff dc8294a..2f90951`, each report adjudicated (artifacts under the ignored `.context/reviews/8bd1023d-4bec-4e12-a2b5-8d29179b0f2c/2-post-gates-*`):

- security-reviewer: 1 Concern sustained (a failed sign-out keeps the auth cookies, so the session can come back; AC-0005), 1 refuted (the hosting intent need not restate the Host check yet).
- frontend-reviewer: 2 Minors sustained (a failed re-render after a save can replace the "Receipt saved" panel with the error page; the region stays blank after a marked save); 2 indeterminate, settled by the owner below.
- adversarial-reviewer: 5 Nits sustained (the `AGENTS.md` stop-first rule omits `npm run start`; an unknown code beside another bad field gets its message a Save late; the same re-render failure; no quality verdict yet on the AC-0018 test; step 6 above did not quote its message); 1 indeterminate settled by git: `git log --diff-filter=A` shows T6's commit 29f7942 created `test/e2e/receiving-page.ts`, now recorded above.
- quality-engineer: 5 Nits sustained (save and void failures leave no server log line; the overview understated the longest waits; two `failures.ts` branches can never run and the void not-allowed rule had no test; the first-run test cannot fail; the failure prefixes were defined twice), 2 refuted.

Owner decisions, in chat on 2026-10-08:

6. The error page's focused heading carries the failure message as its accessible description.
7. Try again reads "Trying again…" and ignores presses while it waits.

Review state: `findings-remain` (seq 39) and `review record` round 2 with 6 fingerprints. Every sustained finding is fixed in this pass; none needs a contract change.

## Review round 2 fixes (2026-10-08)

- Executed by the `implementer` subagent (code and tests) and the controller (`AGENTS.md`, the overview, this ledger); the controller reran the gates and the by-hand checks.
- Controller gates: `npm run typecheck` exit 0; `npm test` exit 0 in 103 s, Vitest 192 passed (14 files), Playwright 76 passed. `test/failures.test.ts`, the pinned T10 stub, is unchanged. No em dashes in the added lines.
- Fixes: `signOut` removes every `sb-…-auth-token` cookie and logs the auth error's code and status when the auth server returns an error or no answer; `saveReceipt` revalidates only when the after-write totals loaded, so a failed re-render cannot replace the "Receipt saved" panel; a marked save moves the URL to the saved product, so its region shows; a code missing from the page's product list sends the whole form to the server, which returns every field error; save and void failures write one log line (`actionFailureLogLine`: action, stage, the error's message and code, no form values); the unreachable before-write 42501 branches are gone; the failure prefixes come from `src/lib/failures.ts` alone; the error page's heading is described by its failure message and Try again reads "Trying again…" with `aria-disabled` while it waits; the first-run test shows that no save request left the page. `test/failures-extra.test.ts` adds 9 cases.
- Red checks by the implementer: removing the write-stage 42501 void rule failed the new case ("…Meat Ops. Reload to see the latest stock."); reverting `receipt-form.tsx` failed the first-run test ("a save request left the page"), the unknown-code test (`#product-code-error` not found), and the AC-0078 test (the URL stayed `/receiving`).
- Controller check against `npm run start`, scripted in the ignored `.context/recorded-run/round2.spec.ts`: with an expired access token and the auth container stopped, Sign out ended on `/sign-in` after 61.3 s with no auth cookie left, the log line read "sign-out failed: no answer from the auth server", and `/receiving` after the auth server came back ended on `/sign-in` (AC-0005). With REST stopped, the error page's heading was focused and described as "Couldn't load this page."; Try again read "Trying again…" with `aria-disabled="true"`, read "Try again" again after the second failure, passed the per-state checks, and showed the form once REST was back. The implementer reproduced the sign-out finding on the old code: the same run kept `sb-127-auth-token` and `/receiving` stayed signed in.
- Deviations: the URL move after a marked save also waits for the totals, since a URL change renders the page; the unreachable invariant message in `readBeforeWrite` no longer quotes the typed code, so no form value reaches the log; the error page's pending button fades like Save.
- Observed: the vendors-missing first-run test refuses before any request, so it does not depend on Save's `aria-disabled` block.
