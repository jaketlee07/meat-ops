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
- Machine values: `X-Stainless-OS`, `X-Stainless-Arch` (`os.arch()` normalized: `x32`, `x64`, `arm`, `arm64`, or `unknown`), `X-Stainless-Runtime-Version` (`process.version`).
- `anthropic-dangerous-direct-browser-access: true` (only with `dangerouslyAllowBrowser`), `anthropic-beta` (OAuth credential path only), `anthropic-user-profile-id` and `anthropic-workspace-id` (only from the `user_profile_id` and `workspace_id` params or a credential config), `x-stainless-helper` and `x-stainless-helper-method` (only for tool and parse helpers).
- Any name in `ANTHROPIC_CUSTOM_HEADERS`.

Every value the package can write for the operating system's name (`X-Stainless-OS`, `normalizePlatform`): `MacOS`, `Linux`, `Windows`, `FreeBSD`, `OpenBSD`, `iOS`, `Android`, `Unknown`.

### Decisions for T3 that follow from the source

- **Headers:** `model.ts` passes a `fetch` that forwards the SDK's request with only an allowlist of headers (`accept`, `anthropic-version`, `content-type`, `x-api-key`) and the SDK's abort signal. This removes the three machine-value headers and anything from `ANTHROPIC_CUSTOM_HEADERS` in one place, so no `defaultHeaders` nulls are needed. Node 22.17.0's fetch then adds only its own fixed headers: a loopback probe received `host`, `connection: keep-alive`, `accept-language: *`, `sec-fetch-mode: cors`, `user-agent: node`, `accept-encoding: gzip, deflate`, and `content-length`, beside the four allowed ones. The client could remove each machine value, so the plan's stop-and-ask case does not apply.
- **Timeout and retries:** with `timeout: 120_000` set, `messages.create` skips its own non-streaming timeout estimate. A timeout throws `APIConnectionTimeoutError`; a failed fetch throws `APIConnectionError`; an error status throws `APIError` with `status`. The custom `fetch` is not middleware, so the client still wraps a fetch failure as `APIConnectionError`.
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
- **Port deviation (controller decision):** the fake model listens on the suite's port + 1 and the spare app for AC-0021 and AC-0028 on port + 2 (3201 and 3202 on stack B; 3101 and 3102 on stack A, as the plan named), so two folders' runs never collide. `playwright.config.ts` refuses a port above 65533.
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
