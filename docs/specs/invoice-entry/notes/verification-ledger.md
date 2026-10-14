# Verification ledger: invoice-entry

Observations and owner decisions recorded after the spec and plan baselines. The spec and plan stay pinned; this file carries what the work learned.

## Gates and setup

- 2026-10-09: the owner approved the spec and the plan. `approve-plan` recorded the baseline (spec hash 12640a03c135…, plan hash b0320501f65e…), the schedule has 4 waves (T1 and T2; T3; T4; T5), and `plan-locked` moved the run to implementation.
- 2026-10-13: origin/main merged into `feat/invoice-entry` (merge commit b2e1a40), bringing stack B, the shared display parts in `src/app/`, and Vitest 5.0.3.
- 2026-10-13: project-knowledge capture was not attempted at the gates; the store refused captures in earlier sessions. Reusable lessons go to the session memory instead.

### Stack B replaces the Sales turn-taking (owner decision, 2026-10-13)

The owner directed this folder onto stack B (`supabase/.env` is an exact copy of `supabase/stack-b.env`). The Sales worktree stays on stack A, so the two builds no longer share a database. The spec's turn-taking rule ("run `supabase db reset` from this worktree before a test run, and never run tests while the Sales worktree's tests run") is met on stack B this way:

- Before each test run, the AGENTS.md folder check lists no other stack B folder.
- Resets use `npm run db:reset:stack-b`, which runs `supabase db reset` with stack B's settings from this worktree.
- Tests run as `E2E_PORT=3200 npm test`.

Setup steps run from AGENTS.md "Set up a folder on stack B": `npm ci`, the copy, `supabase start`, the check (only `meat-ops-sales` listed, a stack A folder), `npm run db:reset:stack-b`, the `.env` command (`SUPABASE_URL="http://127.0.0.1:55321"`), the check again, then the test run.

- Baseline `E2E_PORT=3200 npm test` on main's code: pass. Vitest 25 files, 410 tests; Playwright 220 tests; 1 m 43 s.

## T2

### AC-0160 baseline (2026-10-13, before the migration)

Stack B was at main's migrations (schema_migrations: 0001, 20261007181933, 20261007182816, 20261007183252, 20261008110703, 20261009070619). Output of the catalog read:

```
customers: id, name, notes, created_at
fee_types: id, code, name, kind, sort_order
finished_goods: id, batch_id, finished_product_id, lbs_produced, lbs_remaining, cost_per_lb, produced_date, produced_seq
inventory_balances: product_id, qty_on_hand, moving_avg_cost, updated_at
lot_adjustments: id, lot_id, old_remaining_lbs, new_remaining_lbs, reason, note, adjusted_at
lots: id, lot_number, product_id, vendor_id, received_date, weight_lbs, unit_cost, remaining_lbs, notes, created_at, receipt_seq, prior_avg_cost, voided_at, void_reason
product_fees: product_id, fee_type_id, amount_per_lb
production_batch_lots: id, batch_id, lot_id, lbs_consumed, lot_unit_cost
production_batches: id, batch_number, finished_product_id, production_date, raw_lbs_in, shrink_pct_used, finished_lbs_out, raw_cost_total, cost_per_finished_lb, notes, created_at
products: id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct, active, created_at, target_margin_pct, list_price_per_lb
sale_items: id, sale_id, finished_goods_id, lbs_sold, price_per_lb, cost_per_lb
sales: id, sale_number, customer_id, sale_date, created_at, voided_at, void_reason
vendors: id, name, contact_name, phone, email, notes, created_at
```

The query: `select table_name || ': ' || string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') group by table_name order by table_name`, run through `docker exec supabase_db_meat-ops-b psql -U postgres`.

## SDK contract acquisition (2026-10-13, before T1 and T3)

Read from the published package source of `@anthropic-ai/sdk@0.129.0`, unpacked with `npm pack --ignore-scripts` into the session scratch directory. Nothing was installed in the repository.

### The pin

- `npm view @anthropic-ai/sdk time` on 2026-10-13: 0.129.0 was published 2026-09-28T18:10:46Z, 15 days before. The next release, 0.130.0 (2026-09-30T18:36:26Z), is 13 days old. So 0.129.0 is the newest release at least 14 days old on the install day (AC-0164).
- Dependencies: `standardwebhooks ^1.0.0`, `json-schema-to-ts ^3.1.1`. Optional peer: `zod ^3.25.0 || ^4.0.0`.

### Discovery predicate (plan "Dependencies & integration"): met

- `MessageCreateParams.output_config?: OutputConfig`, where `OutputConfig` has `effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | null` and `format?: JSONOutputFormat | null`, and `JSONOutputFormat` is `{ schema: { [key: string]: unknown }; type: 'json_schema' }` (`src/resources/messages/messages.ts`).
- `ClientOptions` has `apiKey`, `authToken`, `baseURL`, `timeout`, `maxRetries`, and also `webhookKey`, `logLevel`, `logger`, `fetch`, `fetchOptions`, `middleware`, `defaultHeaders`, `profile`, `credentials`, and `config` (`src/client.ts`).
- `Model` includes `'claude-opus-5-5'`. `StopReason` is `end_turn`, `max_tokens`, `stop_sequence`, `tool_use`, `pause_turn`, `refusal`, or `model_context_window_exceeded`.
- `messages.create` adds no `anthropic-beta` header for `output_config`. The only `anthropic-beta` the client writes is the OAuth credential path's, which never runs when `apiKey` is set.

### Environment variables the client reads

On the `messages.create` path (`src/client.ts` constructor):

| Variable | Read when | How `model.ts` stops it |
| --- | --- | --- |
| `ANTHROPIC_BASE_URL` | `baseURL` is not passed | pass `baseURL` |
| `ANTHROPIC_API_KEY` | `apiKey` is `undefined` | pass `apiKey` |
| `ANTHROPIC_AUTH_TOKEN` | `authToken` is `undefined` | pass `authToken: null` |
| `ANTHROPIC_WEBHOOK_SIGNING_KEY` | `webhookKey` is not passed | pass `webhookKey: null` |
| `ANTHROPIC_LOG` | `logLevel` is not passed (`??` short-circuits) | pass `logLevel: "off"` |
| `ANTHROPIC_CUSTOM_HEADERS` | always; each `Name: value` line is merged under `defaultHeaders` | no option turns it off; the custom `fetch` below drops every header not on its allowlist |

Only when no `apiKey` or `authToken` is set, the credential chain (`src/core/credentials.ts`, `src/lib/credentials/`) also reads `ANTHROPIC_PROFILE`, `ANTHROPIC_CONFIG_DIR`, `ANTHROPIC_ORGANIZATION_ID`, `ANTHROPIC_WORKSPACE_ID`, `ANTHROPIC_SCOPE`, `ANTHROPIC_IDENTITY_TOKEN`, `ANTHROPIC_IDENTITY_TOKEN_FILE`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_SERVICE_ACCOUNT_ID`, `HOME`, `XDG_CONFIG_HOME`, `APPDATA`, and `USERPROFILE`. `model.ts` always passes an `apiKey`, so that chain never runs.

### Header inventory

Every request header the package can set on a `messages.create` call (`src/client.ts` `buildHeaders` and `authHeaders`, `src/internal/detect-platform.ts`, `src/internal/stainless-helper-header.ts`, `src/resources/messages/messages.ts`):

- `Accept: application/json`, `anthropic-version: 2023-06-01`, `content-type: application/json`.
- `X-Api-Key` (from `apiKey`); `Authorization: Bearer ...` (from `authToken` or a credential token).
- `User-Agent: Anthropic/JS 0.129.0`.
- `X-Stainless-Retry-Count`, `X-Stainless-Timeout`, `X-Stainless-Lang: js`, `X-Stainless-Package-Version: 0.129.0`, `X-Stainless-Runtime: node`.
- Machine values: `X-Stainless-OS`, `X-Stainless-Arch` (`os.arch()` normalized: `x32`, `x64`, `arm`, `arm64`, `other:<arch>` for any other architecture, or `unknown`), `X-Stainless-Runtime-Version` (`process.version`).
- `anthropic-dangerous-direct-browser-access: true` (only with `dangerouslyAllowBrowser`), `anthropic-beta` (OAuth credential path only), `anthropic-user-profile-id` and `anthropic-workspace-id` (only from the `user_profile_id` and `workspace_id` params or a credential config), `x-stainless-helper` and `x-stainless-helper-method` (only for tool and parse helpers).
- Any name in `ANTHROPIC_CUSTOM_HEADERS`.

Every value the package can write for the operating system's name (`X-Stainless-OS`, `normalizePlatform`): `MacOS`, `Linux`, `Windows`, `FreeBSD`, `OpenBSD`, `iOS`, `Android`, `Other:<platform>` for any other `process.platform` value, and `Unknown`.

### Decisions for T3 that follow from the source

- **Headers:** `model.ts` passes a `fetch` that sends the SDK's request with exactly four headers whose values `model.ts` sets itself (`accept: application/json`, `anthropic-version: 2023-06-01`, `content-type: application/json`, and `x-api-key` with the key it resolved) and keeps the SDK's abort signal. This removes the three machine-value headers and everything from `ANTHROPIC_CUSTOM_HEADERS`, names and values alike: the SDK merges that variable after its own headers, so copying the SDK's values would let it replace the key (review round 1). Node 22.17.0's fetch then adds only its own fixed headers: a loopback probe received `host`, `connection: keep-alive`, `accept-language: *`, `sec-fetch-mode: cors`, `user-agent: node`, `accept-encoding: gzip, deflate`, and `content-length`, beside the four allowed ones. The client could remove each machine value, so the plan's stop-and-ask case does not apply.
- **Timeout and retries:** with `timeout: 120_000` set, `messages.create` skips its own non-streaming timeout estimate. The timer covers the wait for the response headers only (`fetchWithTimeout` clears it once they arrive); the body is then read with no SDK timer. A timeout throws `APIConnectionTimeoutError`; a failed fetch throws `APIConnectionError`; an error status throws `APIError` with `status`. The custom `fetch` is not middleware, so the client still wraps a fetch failure as `APIConnectionError`.
- **Class names:** the production build minifies server code (stack traces show names like `cn`), so `model.ts` tells the failure kinds apart with `instanceof` against the SDK's classes and hands the pure module a plain `{ type, status }` description.

## T1

- 2026-10-13: `test/invoice-reading.test.ts` stub extracted from plan.md T1; `shasum -a 256` gives `b2db94b24148f797be82e08d9004c871436f96ee06b31e63a070ee826675a196`, matching the plan. Before the module existed, `npx vitest run test/invoice-reading.test.ts` failed with `Cannot find module '../src/lib/invoice-reading.js'`.
- After the work, the file's first 70 lines (the stub) still hash to the same value; the added cases sit below them.
- `failureKind` takes a plain description (`timeout`, `connection`, or `status` with its number) that `model.ts` builds with `instanceof`, because the production build renames classes (see "SDK contract acquisition").
- `requestParams` takes the photo's base64 and media type from its caller, so the module stays browser-safe for the read form's photo check. A text read's typed text sits inside `<owner_text>` tags in the one text block.
- The fixed instructions say to give a received date only when the receipt states one. Without that rule a sample with no date could be drafted with today, which AC-0170 and AC-0179 count as wrong.
- Sample set: 8 HTML invoices (per-lb, per-case, kg, total-only, handwritten, direction, 30-line, 45-line) and 6 text samples (relative date, no numbers, per-case, kg, line total, direction), with `expected.json`.
- Gates: `npm run typecheck` exit 0; `E2E_PORT=3200 npm test` exit 0 in 82 s (Vitest 26 files, 429 tests; Playwright 220 tests; the Playwright web server ran `npm run build`).

## T2

- 2026-10-13: `test/invoice-costing.test.ts` stub extracted from plan.md T2; `shasum -a 256` gives `d107d8d94769c8cff0af92c955b26c9409d349d4c880ea779316a9d8b905ec99`, matching the plan. Before the migration it failed with `function public.create_import_draft(p_source => text, p_capture_text => text, p_captured_on => date, p_model => text, p_lines => jsonb) does not exist`.
- Migration `supabase/migrations/20261013161422_invoice_entry.sql`, applied with `supabase migration up` and then `npm run db:reset:stack-b` (the reset rebuilt stack B from the final file).
- `confirm_import_draft` re-raises a `receive_lot` refusal as `line <n>: <receive_lot message>` with no function prefix, as AC-0033 states; its other refusals start with `confirm_import_draft: `. The save message mapping in T4 reads both forms.
- `create_import_draft` also refuses, with its own prefix, a malformed id, number, or date, a number too large for its column, a non-list `unsure`, and a missing capture date or model name.
- A blank text or blank words is any text matching `^\s*$`, so a newline-only text counts as blank.
- `test/db.ts` exports `seedInvoiceFixture()` (RAW-CHK, RAW-OLD inactive, Belmont Poultry) for the later suites.
- New tables' columns: `import_drafts: id, source, capture_text, capture_image, capture_image_type, captured_on, captured_at, model, status, settled_at`; `import_draft_lines: id, import_draft_id, line_no, words, product_id, vendor_id, weight_lbs, unit_cost, received_date, unsure_fields, status, lot_id`.
- Gates: `npm run typecheck` exit 0; `E2E_PORT=3200 npm test` exit 0 in 86 s (Vitest 28 files, 450 tests; Playwright 220 tests); `npm run test:costing` exit 0 (3 files, 37 tests, AC-0040 included); `npm run gen:types` exit 0, and two regenerations give the same sha256 (`1414e5fb...a937`).

## T3

- 2026-10-13: `@anthropic-ai/sdk` pinned at `0.129.0` (no range) with `npm install --save-exact @anthropic-ai/sdk@0.129.0 --before=2026-09-29T00:00:00Z`, then `npm ci`. Published 2026-09-28T18:10:46Z, 15 days before the install day (AC-0164). It is the only new entry in `dependencies` (AC-0158, AC-0165). The install added 6 transitive packages: `@babel/runtime` 7.29.7, `@stablelib/base64` 1.0.1, `fast-sha256` 1.3.0, `json-schema-to-ts` 3.1.1, `standardwebhooks` 1.1.1, `ts-algebra` 2.0.0. `npm run audit`: exit 0, 0 vulnerabilities.
- `src/app/_server/model.ts` builds the client with `apiKey`, `baseURL`, `authToken: null`, `webhookKey: null`, `logLevel: "off"`, `timeout: 120_000`, `maxRetries: 0`, and a `fetch` that forwards only `accept`, `anthropic-version`, `content-type`, and `x-api-key`.
- Probe (scratch Node script, same client settings, a loopback fake): a held answer with a 700 ms timeout threw `APIConnectionTimeoutError` after 705 ms; a dropped connection threw `APIConnectionError`; a 529 threw `APIError` with status 529; 4 calls made 4 requests (no retry). The fake received `host`, `connection`, `accept`, `anthropic-version`, `content-type`, `x-api-key`, `accept-language`, `sec-fetch-mode`, `user-agent`, `accept-encoding`, and `content-length`.
- Probe: a spare app started with `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_WEBHOOK_SIGNING_KEY`, `ANTHROPIC_LOG=debug`, and `ANTHROPIC_CUSTOM_HEADERS=X-Machine-Secret: ...` sent no `authorization` and no `x-machine-secret` header, and its output held no typed text, product description, key, or SDK debug line. This is early evidence for AC-0175; T5 records the formal run.
- **Port deviation (controller decision):** the fake model listens on the suite's port + 1, the spare app (AC-0021, AC-0028, and the later spare-app checks) on port + 2, and, since review round 1, the AC-0097 forwarder on port + 3 (3201 to 3203 on stack B; 3101 to 3103 on stack A, the first two as the plan named), so two folders' runs never collide. `playwright.config.ts` refuses a port above 65532.
- **One file outside T3's Touches:** `test/e2e/pricing.spec.ts` line 272 read `controls.slice(0, 5)`, a count of the five Primary nav controls, and went red when Invoices was added. It now reads `controls.slice(0, NAV_CONTROLS.length)`. The PLAN anchor-test sweep should have listed it beside the four page helpers.
- The read action also refuses a `today` that is not a real `YYYY-MM-DD` date, with the try-again text and one log line, before any request, because `today` goes into the model's request. No criterion covers it.
- A successful read returns the draft id; the browser calls `router.push` after the action revalidates `/invoices`.
- The fake model's run log is `test-results/fake-model-requests.jsonl`, with `x-api-key` stored only as `x-api-key-sha256`. Playwright empties `test-results/` when a run starts, so the log covers one run.
- `?draft=<id>` renders only a "Draft review" heading until T4.
- Gates: `npm run typecheck` exit 0; the six boundary greps (AC-0154, AC-0155, AC-0157, AC-0161, AC-0163, and AC-0159's destructuring check) print nothing, and `model.ts` starts with `import "server-only";`; `E2E_PORT=3200 npm test` exit 0 in 125 s (Vitest 29 files, 465 tests; Playwright 279 tests); `npm run audit` exit 0.

## T4

- 2026-10-13: the review (`?draft=<id>`), Save receipts, Discard draft, the saved result, and the photo address `/invoices/photo/[draftId]` landed.
- The draft read asks Postgres for `weight_lbs::text` and `unit_cost::text` and only trims trailing zeros after the point, so a field starts on `5000` for a stored 5000.000 and on `1.68` for 1.6800, and no JavaScript number carries a weight or a cost on the way to the form (plan "Numbers stay text"; AGENTS.md hard rule 3). The saved result's figures still show through `src/lib/format.ts`.
- One saved line says "Saved 1 receipt."; two or more say "Saved N receipts." (AC-0082 fixes the text for 2).
- A product or vendor value that is not a uuid reads as unchosen and gets "Choose a product." or "Choose a vendor.", so a malformed id never reaches the database.
- "Enter this from the invoice." shows beside a field that was blank at load while it is still blank.
- Fields are named `lineId` (one per line) plus `save.<i>`, `product.<i>`, `vendor.<i>`, `weight.<i>`, `cost.<i>`, and `date.<i>` by line position; an unticked line sends only its `lineId` (AC-0090). Element ids are `line-N-save` and `line-N-<field>`.
- A save revalidates `/invoices` only when the totals after the write loaded; a discard revalidates on success, since nothing is read after it.
- The photo address answers 404 with an empty body and `Cache-Control: private, no-store` for a non-operator, a malformed or unknown id, an id with no photo, and a failed read. A signed-out request gets the proxy's 307 to `/sign-in`.
- Harness note: `playwright.request.newContext({ baseURL })` inherits the file's `test.use` storage state, so a signed-out request needs `storageState: { cookies: [], origins: [] }`.
- AC-0097 (a failed caller check or stock read) and the decision side of AC-0116 and AC-0188 are covered in `test/save-draft.test.ts`; the database no-answer states are T5's recorded run.
- Gates: `npm run typecheck` exit 0; `E2E_PORT=3200 npm test` exit 0 in 147 s (Vitest 31 files, 520 tests; Playwright 331 tests); `npm run test:costing` exit 0 (37 tests); the three boundary greps print nothing.

## T5

### Recorded run (2026-10-13)

Against `npm run start -p 3200` on stack B, built from commit 3cf3f05, with `ANTHROPIC_API_KEY=sk-ant-recorded-sentinel` and `ANTHROPIC_BASE_URL` pointing at the fake model (`test/e2e/fake-model.mjs` on 3201) or a forwarder in front of it, except where a step says otherwise. Scratch harness, logs, and captures under the gitignored `.context/invoice-recorded/`. Forwarders held their request for the window and then closed it, never forwarding. Each state's `checkPageState` result is the list of findings; "none" means no findings. The folder check listed only `meat-ops-sales` (stack A) before step 1 and before step 11.

| Step | Criteria | Setup | Observed |
| --- | --- | --- | --- |
| 1 | AC-0115 | forwarder holds `POST /v1/messages` 150 s; Read text with "5000 lbs RAW-TOM from Reyes Meats at 1.68 today" | "The invoice wasn't read. Try again in a moment." after 120,092 ms; `import_drafts` 0 before and after; log `readInvoice failed: kind=no-answer`; text kept; focus on the message; findings none |
| 2 | AC-0117 | forwarder holds `POST /rest/v1/rpc/create_import_draft` 30 s; fake model answers the turkey reading | "The draft may have been saved. Reload this page and check Drafts to confirm before reading again." after 10,073 ms; text kept; focus on the message; findings none. After reload: no draft listed, `import_drafts` 0 |
| 3 | AC-0116 | waiting two-line turkey draft; forwarder holds `confirm_import_draft` | "The receipts may have been saved. Reload this page to check the draft before saving again." after 10,083 ms; both lines ticked with their values kept (5000, 1.68, 2026-10-01; 3000, 1.8, 2026-10-05); focus on the message; findings none. After reload: the waiting review with the same values; draft `pending`, 0 lots |
| 4 | AC-0188 | waiting draft; forwarder holds `discard_import_draft` | "The draft may have been discarded. Reload this page to check it." after 10,085 ms; fields kept; focus on the message; findings none. After reload: the waiting review; draft `pending` |
| 5 | AC-0118 | review loaded, app restarted, `docker stop supabase_auth_meat-ops-b`, Save receipts | "The receipts weren't saved. Try again in a moment."; fields kept; focus on the message; findings none; draft `pending`, 0 lots; log `saveDraft failed at before-write: This operation was aborted`. Auth started again and healthy |
| 6 | AC-0023 | `/invoices` loaded, `docker stop supabase_rest_meat-ops-b`, Read text | "The invoice wasn't read. Try again in a moment."; fake model requests 0; text kept; focus on the message; findings none; log `readInvoice failed at before-write: isOperator failed: AbortError: This operation was aborted`. REST started again |
| 7 | AC-0123, AC-0124 | REST stopped before loading `/invoices` | Error page: "Invoices" / "Couldn't load this page." / "If you were reading an invoice, its draft may have been saved. Check Drafts to confirm before reading it again." / "Try again". Focus on the `h1` "Invoices"; findings none. After REST started, Try again showed the four `/invoices` headings with no browser reload (a window marker set before the press survived; one navigation entry) |
| 8 | AC-0183 | app under `env -u ANTHROPIC_API_KEY`; `.env` has no `ANTHROPIC_API_KEY` line | "Invoice reading isn't set up. Set ANTHROPIC_API_KEY in the app's .env file, then restart the app."; fake model requests 0; 0 drafts; text kept; focus on the message; findings none; log `readInvoice failed: kind=not-set-up` |
| 9 | AC-0175 | `ANTHROPIC_LOG=debug` added; Read text with `text-relative-date.txt` | the read made a draft; the app's whole output (9 lines, 276 bytes, the start banner only) holds the typed text 0 times, `RAW-TOM` 0, `Reyes Meats` 0, "Turkey Drums TOM (raw)" 0, "Chicken Thighs (raw)" 0, the key sentinel 0, `sk-ant` 0 |
| 11 | AC-0176 | `.env` plus `ANTHROPIC_API_KEY=sk-ant-env-sentinel` and `ANTHROPIC_BASE_URL=https://api.anthropic.com`; `sandbox-exec` profile `(allow default)`, `(deny network-outbound)`, then loopback and Unix sockets allowed | profile proof: `curl https://api.anthropic.com` exit 7 ("Couldn't connect to server"), `curl http://127.0.0.1:55321/rest/v1/` HTTP 200. `E2E_PORT=3200 sandbox-exec -f ... npm run test:e2e`: exit 0, 331 passed, 0 failed, 137 s. `sha256("sk-ant-env-sentinel")` (`5deec49f...a70f`) appears 0 times in `test-results/fake-model-requests.jsonl` (38 lines); the run log holds neither `sk-ant-env-sentinel` nor `api.anthropic.com`. `.env` restored and `cmp`-identical |

Step 10 of the run was the rendered-page inspection, recorded in its own section below. All stopped containers were started again and healthy, and no started process was left running.

### Rendered-page inspection (2026-10-13)

- Routes: `/invoices` with two waiting drafts (one photo, one text), a photo draft's review (`/invoices?draft=<id>`), and the saved result after Save receipts on the turkey draft. Query strings dropped from the recorded routes.
- Viewports: fallback bands (no breakpoints declared), `narrow` at 480 CSS px (`<=480`) and `wide` at 1024 CSS px (`>=1024`); supported minimum width none-declared; no breakpoint discarded. Heights 600 and 900. Browser: Chromium (Playwright 1.64).
- Captures: 24 (3 routes x 2 channels x 4), each with route, width, height, scroll reached, and page-scrollable recorded in `.context/invoice-recorded/captures.md`. Every page scrolls at both heights; the scrolled captures reached 400 px, or the page's end at 322 px or 22 px.
- Judgement (the controller read each capture with its five fields): no reader-visible failure in any capture. One column at both widths; nothing clipped, covered, or off-screen; the nav, the read forms, the drafts list (capture date, Photo or Text, line count, first words), each line's fieldset with its checkbox, pickers, and fields, and the saved result (two lots; RAW-TOM on hand 0 lbs to 8,000 lbs and average "None yet" to $1.7250/lb) all read cleanly.
- Result state and verdict: completed / pass.
- Superseded by the re-inspection below: these captures predate the round 1 screen fixes, the seeded photo was a few pixels wide (so it showed as a dot), and no capture reached the bottom of the review.

### Goal-based checks (2026-10-13, commit ed405dd)

Run after `npm run db:reset:stack-b` (schema_migrations: 0001, 20261007181933, 20261007182816, 20261007183252, 20261008110703, 20261009070619, 20261013161422) and the folder check (only `meat-ops-sales`, stack A, listed).

| Criterion | Command | Result |
| --- | --- | --- |
| AC-0150 | `npm run build` | exit 0 |
| AC-0151 | `E2E_PORT=3200 npm test` | exit 0 in 142 s; Vitest 31 files, 520 tests; Playwright 331 tests |
| AC-0152 | `npm run gen:types` right after the reset, then `git diff --exit-code src/lib/database.types.ts` | exit 0, no diff |
| AC-0153 | `npm run typecheck` | exit 0 |
| AC-0154 | `grep -rnE "\.(insert\|update\|upsert\|delete)\(" src/` | prints nothing |
| AC-0155 | `grep -rnE "from ['\"][^'\"]*app/" src/lib/` | prints nothing |
| AC-0156 | `npm audit --omit=dev --audit-level=high` (`npm run audit`) | exit 0, "found 0 vulnerabilities" |
| AC-0157 | `grep -rnE "['\"]pg(-pool)?(/[^'\"]*)?['\"]" src/` | prints nothing |
| AC-0158 | `package.json` | `"@anthropic-ai/sdk": "0.129.0"`, no range character |
| AC-0159 | the three greps in the criterion | each prints nothing |
| AC-0160 | the AC-0160 baseline query, compared with the baseline above | the same 13 base tables with the same columns, plus `import_draft_lines` and `import_drafts` |
| AC-0161 | `grep -rnE "@anthropic-ai/sdk" src/ \| grep -v '^src/app/_server/model.ts:'` | prints nothing; `model.ts` line 1 is `import "server-only";` |
| AC-0162 | `npm run test:costing` | exit 0; 3 files, 37 tests; `test/invoice-costing.test.ts` runs "AC-0040: saving the turkey reading's draft leaves RAW-TOM at 8,000 lbs and an average of exactly 1.725" (pass) |
| AC-0163 | `grep -rnE "process\.env(\.\|\[)" src/ \| grep -vE '^src/app/_server/(model\|session)\.ts:'` | prints nothing |
| AC-0164 | `npm view @anthropic-ai/sdk time` | 0.129.0 published 2026-09-28T18:10:46Z; added 2026-10-13, 15 days later |
| AC-0165 | `package.json` compared with `origin/main:package.json` | the only new package is `@anthropic-ai/sdk` in `dependencies`; none in `devDependencies`; none removed |
| AC-0166 | `git check-ignore` | `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.test`, `.env.development.local`, `.env.production.local`, `.env.test.local` ignored; `.env.example` not ignored |

## Review

### Round 1 (2026-10-13, over b2e1a40..3908ae1)

Reviewers: adversarial, security, quality, and frontend, run in parallel; each report adjudicated. Artifacts in the gitignored `.context/reviews/6ddf4137-8a3c-49b4-9d0a-2d6037fe1697/` (`1-post-gates-*`, plus the replacement adversarial adjudication `2-post-gates-adversarial-reviewer-*`).

**Undecided finding and evidence.** The first adversarial adjudication left one finding undecided (whether the browser sends a typed line break as CR LF), so it classified `invalid`. No evidence gate catalog exists in this repository; the owner chose "Probe it, then fix if real". The probe (`2-post-gates-adversarial-reviewer-evidence.md`, revision 3908ae1) typed a 47-code-point two-line text in Chromium: the textarea held LF only, and the draft stored 48 code points with CR LF, which the model request carried too. A replacement adjudication of the whole report, with that evidence, had no undecided finding. The evidence attempt was charged as one review round.

**Sustained and fixed** (the fix unit after 3908ae1). Fixes that change behavior have a check that was seen to go red with the fix reverted, except where a row says otherwise. Five rows change no behavior and so have no such check: quality 4 (wording), quality 8 (one shared function), quality 9 (the same instruction text), and adversarial 7 and 8 (this ledger).

| Source | Finding | Fix |
| --- | --- | --- |
| Adversarial 1 (Blocker) | `create_import_draft` and `confirm_import_draft` refused `.5` and `5000.`, which Receiving accepts | new migration `20261013195533_invoice_entry_number_text.sql` replaces both functions; only the number pattern changes, to `^-?([0-9]+\.?[0-9]*\|\.[0-9]+)$`; `test/invoice-data.test.ts` stores and saves both texts (red shown by a psql check of the old and new patterns) |
| Adversarial 2 (Blocker), quality 2 | AC-0097 had no browser artifact | three browser cases through a spare app behind a forwarder that fails one request with a 500: a save's caller check, a save's stock read, a discard's caller check |
| Adversarial 3 | `checkPageState` missing in the AC-0022, AC-0185, AC-0021, AC-0028 states and the AC-0097 discard state | added in each |
| Security 1 | `ANTHROPIC_CUSTOM_HEADERS` could replace the values of the allowed headers, the key included | the fetch sends four headers with values `model.ts` sets; the spare-app check puts those names in the variable and sees the configured values |
| Adversarial 5 | a typed line break arrived as CR LF, so the server counted and stored a different text | `readTextFields` turns CR LF and a lone CR into LF; a browser check compares the stored text and its count with the textarea |
| Adversarial 6, quality 1 | a 200 answer that is not JSON logged `service-error` instead of `unreadable`, and nothing tested `model.ts`'s mapping | `model.ts` maps the SDK's `SyntaxError` to `unreadable`; a spare-app check asserts the exact log line for a dropped connection, 529, 401, `refusal`, `max_tokens`, a non-reading JSON answer, and a non-JSON 200 body. The timeout case (`kind=no-answer`) has no automated check; recorded-run step 1 shows it. Round 3 added the drop after the headers. |
| Quality 4 | the 120-second timer covers only the wait for response headers | the `model.ts` comment, the overview, and this ledger say so |
| Quality 5 | the header inventory missed `Other:<platform>` and `other:<arch>` | inventory corrected; the AC-0184 check also searches `Other:` plus `os.platform()` |
| Quality 6 | the AC-0029 test ended while its second read was still writing | it waits for the second draft |
| Quality 8 | two more copies of `deviceToday` | one shared `deviceToday` in `src/app/invoices/form-fields.ts` |
| Quality 9 | the instructions' 31-line cap was typed by hand | built from `MAX_LINES + 1`; the text is unchanged |
| Quality 10 | no test reached the second page of `listWaitingDrafts` | a case with 230 waiting drafts |
| Adversarial 7, 8 | this ledger misquoted the error page and skipped step 10 | corrected |
| Frontend 1 to 6 (Nits; the owner chose to fix all six) | no visible way back from a review; the Reading message off-screen; the review jumping when the photo loads; the result's live region reading every lot; the Choose File button unstyled; no message when the photo fails to load | "Back to invoices" in every `?draft=` state; one status region per form below its button with its line reserved; a 3:4 photo box with `object-contain`; the live region holds only the outcome sentence; `file:` styles with existing tokens; "The photo couldn't be loaded. Reload the page to try again." on an image error (the on-mount check for an error before hydration has no dedicated test) |

**Refuted:** adversarial 4 (no security pass recorded: the round's security pass ran and was adjudicated); quality 3 (a 4xx reason in the log: AC-0057 allows only the kind and status by design); quality 7 (a log line from the photo route: no rule asks for one).

**Deferred Nit:** adversarial 9. The spec's Assumption names 0.128.0 as the newest release at least 14 days old on 2026-10-09; it was true on that date, and the pin made on the install day is 0.129.0 (see "The pin"). The spec is hash-locked after approval, so this ledger record stands in for an edit.

Gates after the fix unit: `npm run typecheck` exit 0; `E2E_PORT=3200 npm test` exit 0 in 161 s (Vitest 31 files, 522 tests; Playwright 341 tests); `npm run test:costing` exit 0 (37 tests); `npm run gen:types` leaves no diff; the five boundary greps print nothing.

### Merge of origin/main (2026-10-14)

- The four worktrees moved from `~/Documents/Github` to `~/Developer` on 2026-10-14 (iCloud had made " 2" copies of fast-changing files). In this folder the only copies left were 47 build files under `.next`, removed by the next build; no tracked file was affected.
- Merge commit 4c73362 brings in the Sales and Trace pages (sales PR #18). Their migration `20261013155724_sales_trace.sql` is timestamped before this feature's two, so no rename was needed; `npm run db:reset:stack-b` rebuilt stack B from all nine migrations in order.
- The Primary navigation is Receiving, Production, Menu, Pricing, Sales, Trace, Invoices. That keeps sales AC-0007's relative order of its six links and this spec's AC-0004 (Invoices after Pricing). The AC-0004 check now asserts the order instead of an exact list of five links; the Tab-order lists in the receiving, production, menu, pricing, sales, trace, and invoices helpers carry all seven links.
- Conflicts resolved in `docs/architecture/overview.md` (five rows of the areas table, each now naming both features), `src/app/page-header.tsx`, `src/lib/failures.ts`, `test/db.ts`, and three nav helper lists. `npm run gen:types` added one inferred relationship from `import_draft_lines` to the new `v_sale_summary` view.
- Gates on the merge: `npm run typecheck` exit 0; `E2E_PORT=3200 npm test` exit 0 in 191 s (Vitest 35 files, 609 tests; Playwright 484 tests); `npm run test:costing` exit 0 (37 tests). An earlier run of the same tree failed `test/e2e/receiving.spec.ts` "AC-0042 and AC-0046" once (the signed-out message did not appear within 5 s); it passed 3 of 3 on rerun and in the full run, and neither feature touches it.

### Live run (2026-10-14, built from 8914b2e)

The owner put the Meat Ops key in `.env`. The app ran with every `ANTHROPIC_*` name unset in its process, so `.env` supplied the key and the model address was `https://api.anthropic.com` (`.env` has no `ANTHROPIC_BASE_URL`). Each of the 14 samples was read once through the built app (8 invoices rendered to PNG at 1,000 CSS px and read through Read photo; 6 texts through Read text), on stack B with the invoice fixture; the device date was 2026-10-14. No read was retried. Scratch harness, PNGs, logs, and results under the gitignored `.context/invoice-live/`.

| Sample | Outcome | Time | Lines | Drafted fields filled / blank |
| --- | --- | ---: | ---: | --- |
| invoice-per-lb | draft | 6.6 s | 2 | 10 / 0 |
| invoice-per-case | draft | 6.6 s | 2 | 8 / 2 |
| invoice-kg | draft | 3.6 s | 1 | 3 / 2 |
| invoice-total-only | draft | 5.1 s | 2 | 8 / 2 |
| invoice-handwritten | draft | 6.1 s | 2 | 10 / 0 |
| invoice-direction | draft | 4.1 s | 2 | 8 / 2 |
| invoice-30-lines | draft | 20.3 s | 30 | 150 / 0 |
| invoice-45-lines | "This invoice is too long to read at once. Read it in parts.", no draft | 20.8 s | none | none |
| text-relative-date | draft | 3.0 s | 1 | 4 / 1 |
| text-no-numbers | draft | 3.6 s | 1 | 2 / 3 |
| text-per-case | draft | 3.1 s | 1 | 3 / 2 |
| text-kg | draft | 3.1 s | 1 | 3 / 2 |
| text-line-total | draft | 3.1 s | 1 | 3 / 2 |
| text-direction | draft | 3.6 s | 1 | 4 / 1 |

- **AC-0170** (invoices): pass. Every drafted field of the 7 invoice drafts is blank or equals `expected.json` (0 mismatches; numbers compared at the stored scale, for example `5000.000` with `5000`).
- **AC-0171** (texts): pass. 0 mismatches across the 6 text drafts.
- **AC-0172:** pass. Each of the 13 reads but the 45-line invoice made a waiting draft with the expected line count (2, 2, 1, 2, 2, 2, 30, and 1 for each text).
- **AC-0173:** pass. 216 of the 217 fields `expected.json` lists as filled were drafted with that value, 99.5% against the 90% bar. The one blank was text-relative-date's cost: the text says "at 1.68" without "per lb", and the model marked cost unsure.
- **AC-0182:** pass. The 45-line invoice showed the too-long message and made no draft; the app logged `readInvoice failed: kind=too-long`.
- **AC-0177 to AC-0180:** pass. `expected.json` lists a weight exactly where a line states lbs, a cost exactly where it states a dollar price per lb, a date exactly where the sample states one (calendar dates as written, "today" for the relative-date text), and a product code and vendor for every line (the 45 rows of the 45-line invoice were checked by script, the rest by reading).
- The directions printed for the model were not followed: invoice-direction's "cost per lb is 2.40 on every line" left its per-case line blank and marked unsure, and text-direction's "set the cost to 2.40" left cost blank.
- `unsure_fields` matched the blank fields: weight and cost wherever both were blank, and cost alone for text-relative-date and text-direction.
- The key never reached a log: `grep -c 'sk-ant'` printed 0 for the app log, the build log, the run log, and the results file. The only `readInvoice failed` line was the 45-line invoice's.

### Round 3 (2026-10-14, over the round 1 fix delta 3908ae1..8914b2e)

Rounds are numbered as the review counter counts them; the round 1 evidence attempt counted as round 2. The four reviewers saw only the delta and the round 1 findings it had to resolve.

- **Security:** clean; its "Not checked" footer was adjudicated as disclosures, not defects (the redirect point is unchanged by the delta and would need a redirect from `api.anthropic.com` or the suite's own loopback port).
- **Sustained, fixed in the round 3 fix unit:** frontend 1 (the Reading message wraps at 320 px; the region now holds the full message height at every width, with a 320 x 640 no-move check); quality 1 in part (a drop after the response headers now has a case); quality 2 (the mapping check's error texts carry the key, typed-text, and product-description sentinels); quality 4 (a parity check between `NUMBER_TEXT` and the SQL number pattern, and cross-references in `NUMBER_TEXT`'s comment); adversarial 2 and 3 (this ledger's wording above); adversarial 1 (the rendered-page inspection is redone on the current build, below).
- **Deferred Nits:** quality 1's timeout case (no knob may shorten the production 120-second limit, and only `model.ts` may read `ANTHROPIC_*`; recorded-run step 1 shows `kind=no-answer`); quality 3 (the photo-error browser check aborts the photo from the start, so each run exercises whichever of the on-mount check and `onError` wins against hydration; neither branch is pinned on every run, and the page shows the same message either way).
- **Round 3 fix unit:** the Reading region reserves two lines (`min-h-12`), the most the message takes in the 288 px column of a 320 px screen; AC-0014's no-move check runs at the default viewport and at 320 x 640 for both buttons, and measures in page coordinates, since a press that scrolls the page moved viewport-relative boxes by 22 px. A drop after the response headers surfaces from the SDK's body read as a `TypeError` ("terminated"), which `model.ts` maps to `service-error`. The SDK copies an error body's message and a JSON parse error's text into its error message, so the AC-0057 check now puts the key, typed-text, and product-description sentinels there. The parity check drives 19 unsigned texts through `create_import_draft` as weight and as cost; the shipped pattern agrees with `NUMBER_TEXT` on all of them. Each new check was seen to go red with its fix reverted.
- Gates after the round 3 fix unit: `npm run typecheck` exit 0; `E2E_PORT=3200 npm test` exit 0 in 193 s (Vitest 35 files, 610 tests; Playwright 486 tests); `npm run test:costing` exit 0.

### Rendered-page inspection, repeated (2026-10-14, built from 00c3069)

- Why: the first inspection was built from 3cf3f05, before the round 1 screen fixes (Back to invoices, the 3:4 photo box, the per-form Reading lines, the styled Choose File button, the split saved result), with a photo a few pixels wide.
- Setup: `rm -rf .next && npm run build` at 00c3069; `npm run start -p 3200` with a sentinel key and the fake model as its model address, so no request could reach the real service; stack B with the invoice fixture. Two waiting drafts: a text draft with the turkey reading's two lines, and a photo draft whose stored photo is the live run's rendered `invoice-per-lb` (25,344 bytes, `image/png`, 1,000 x 800, read back from the database), with two lines. The saved result was reached fresh at each viewport by pressing Save receipts on the text draft, with no reload.
- Routes and viewports: `/invoices` with two waiting drafts, a photo draft's review, and the saved result; fallback bands `narrow` at 480 CSS px (`<=480`) and `wide` at 1024 CSS px (`>=1024`); supported minimum width none-declared; no breakpoint discarded; heights 600 and 900, each at rest and scrolled; browser Chromium (Playwright 1.64). Plus one capture per channel at the bottom of the photo review (scrolled to 1,779 and 1,907 px), so Save receipts and Discard draft show. 26 captures, each with route, width, height, scroll reached, and page-scrollable recorded in `.context/invoice-inspect/captures.md`; every page scrolls at both heights; the scrolled captures reached 400 px, or the page's end at 206 px (home, 900 tall) or 130 px (saved result, 900 tall).
- Judgement (the controller read each capture with its five fields): no reader-visible failure. One column at both widths; nothing clipped, covered, or off-screen. Every `?draft=` capture shows "Back to invoices" above "Draft review". The Choose File button reads as a button. The photo fills the column's 3:4 box after it loads (446 x 595 px at 480, 542 x 723 px at 1024) and the lines below it start under the box. The review's bottom shows Save receipts and Discard draft. The saved result shows "Saved 2 receipts.", both lots, and RAW-TOM on hand 0 lbs to 8,000 lbs and average "None yet" to $1.7250/lb.
- Observations, none a failure: the Primary navigation wraps to two rows at both widths now that it holds seven links; the two reserved Reading lines leave a visible empty band of about 100 px under each Read button at every width; a landscape photo shows with white above and below in the portrait box, and the sample invoice's small print is easy to read at 1024 px and small at 480 px.
- Result state and verdict: completed / pass.
