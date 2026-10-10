# Plan: invoice-entry

- **Spec:** [`spec.md`](spec.md)
- **Status:** Approved <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:**
  - **Area rules and access model:** `docs/architecture/overview.md`.
  - **Analogous implementations:** the production page, `src/app/production/` (`page.tsx`, `actions.ts`, `save-batch.ts`, `error.tsx`), and the pricing page, `src/app/pricing/` (`actions.ts`, `save-change.ts`), over `src/lib/receiving.ts`, `src/lib/receipt-input.ts`, `src/lib/failures.ts`, `src/lib/format.ts`, and `src/lib/rpc.ts`; for database functions, `receive_lot` and `private.assert_caller` in `supabase/migrations/20261007181933_engine_hardening.sql`, and `set_list_price` with its revoke-then-grant lines in `supabase/migrations/20261009070619_menu_pricing.sql`; for table policies, `supabase/migrations/20261007182816_access_lockdown.sql`.
  - **Their tests:** `test/save-batch.test.ts`, `test/save-change.test.ts`, `test/pricing.test.ts`, `test/engine.test.ts`, `test/access.test.ts`, and the browser suites `test/e2e/production.spec.ts` and `test/e2e/pricing.spec.ts` with their page helpers, `test/e2e/a11y.ts`, `test/e2e/session.ts`, and `test/e2e/states.ts`. Fixtures come from `test/db.ts` (`resetTestData`, `callAsOperator`, `OpCall`, `PARAM_TYPES`, `tableFingerprints`, `raceCalls`) and `test/users.ts`.
  - **Named deviations:** this is the first feature with an outbound call, a third environment variable, a file upload, a GET route handler, and a second Playwright web server. The model call lives in one server-only module, `src/app/_server/model.ts`, the only file that imports the SDK or reads `ANTHROPIC_*`. Every rule about the model's request and answer lives in a pure module, `src/lib/invoice-reading.ts`, so Vitest tests it without the SDK or `server-only`. `confirm_import_draft` is the first function that calls an operation; it calls `receive_lot` once per line inside its own transaction, so the ledger still changes only through the operation.
  - **Read-only probes, 2026-10-09:** the local REST gateway passed 3 MB and 12 MB request bodies to PostgREST (`PGRST202`, not `413`), so a photo can travel as a `bytea` argument in hex, about 8.4 MB for a 4 MB photo. `@anthropic-ai/sdk` depends on `standardwebhooks` and `json-schema-to-ts`; 0.128.0 (2026-09-22) is the newest release at least 14 days old on 2026-10-09. Next.js's server-action body limit is 1 MB unless `experimental.serverActions.bodySizeLimit` raises it (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`).
  - **Uncertainty:** whether the pinned SDK types `output_config.format` and `output_config.effort` on `messages.create`. The EXECUTE contract-acquisition gate settles it against the installed package before T3's code is written (see Dependencies & integration).

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/invoice-entry/notes/verification-ledger.md`. A genuine artifact
> error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material.

## Approach

The work lands as five dependency-ordered layers on `feat/invoice-entry`. Each
layer is its own commits and leaves `npm test` green.

1. **Reading rules (T1).** A pure module turns a model answer into draft lines, checks a photo's bytes and a typed text, resolves the model address, builds the request, and names each failure. A set of sample invoices and texts with their printed values is added for the T5 live run.
2. **Database (T2).** One migration adds `import_drafts`, `import_draft_lines`, their policies and grants, and `create_import_draft`, `confirm_import_draft`, and `discard_import_draft`. The golden case AC-0040 joins `npm run test:costing`.
3. **Reading in the app (T3).** The SDK is installed and pinned, `src/app/_server/model.ts` calls it, a fake model service joins the browser suite, and `/invoices` reads a photo or text into a waiting draft. The Primary navigation gains Invoices.
4. **Review, save, and discard (T4).** The draft review, the photo address, and the save and discard actions.
5. **Docs, checks, and recorded runs (T5).** The architecture overview, `AGENTS.md`, `SYSTEM-SPEC.md` §4, the goal-based checks, the stopped-service and held-call runs, and the live run with the real key.

The estimate is about 4,500 reviewable lines, so the shape is MIXED and the layers
are the decomposition. One review unit at the end reviews the five layers in
order, each named by its commit range, so a database finding is read before the
pages built on it.

The riskiest part is the trust boundary around the model: the key, the address
it goes to, what the request holds, and what the answer can do. AC-0071 to
AC-0075 test the request from the fake model's side, AC-0050 to AC-0056 test the
answer's checks, and AC-0159, AC-0161, and AC-0163 pin where the key is read.

## Constraints

- `SYSTEM-SPEC.md` §2 and §11: the AI never computes a cost, extracted data is written to the ledger only after the owner confirms it, and the ledger changes only through the six operations.
- `AGENTS.md` hard rules 2, 3, 4, 6, and 7.
- The access model, write path, and app trust boundary in `docs/architecture/overview.md`: every server action and the photo route settle the caller through `src/app/_server/caller.ts`; every server-side Supabase client uses the 10-second request limit in `src/app/_server/session.ts`; each new table and function revokes its default privileges and grants back only what the access model names.
- Sales is built in parallel in `../meat-ops-sales` against the same local stack. Before each test run, check that no Vitest or Playwright process from the Sales worktree is running, then run `supabase db reset` from this worktree, as the owner's turn-taking decision allows.
- No ADR or RFC governs this area.

## Construction tests

**Integration tests:** none beyond per-task tests. `assertLedgerInvariants` keeps the costing invariants checked after every Vitest test that touches the database, and `test/access.test.ts` sweeps the three new functions.

**Manual verification:** the T5 recorded runs.

## Durable-output map

Each row's evidence and closeout condition are the spec's Durable Outputs row of the same role; this map only names the tasks.

| Durable output (spec row) | Tasks |
| --- | --- |
| Master brief, `SYSTEM-SPEC.md` §4 | T2 |
| Current architecture, app trust boundary, and AI connection, `docs/architecture/overview.md` | T5 |
| Agent guidance, commands, and environment files: `AGENTS.md`, `package.json`, `.env.example`, `.gitignore` | T2 (`test:costing` and its comment), T5 (the rest) |
| Interface compatibility, `src/lib/database.types.ts` | T2 (regenerated), T5 (AC-0152) |
| Dependency record, `package.json` and `package-lock.json` | T3 (the pin), T5 (AC-0156, AC-0158, AC-0164, AC-0165) |

Every design fact below shows in code and tests or is delivery residue, except
three that belong in durable owners: the AI connection rules (model, key, data
sent, no tools, retention) and the model address rule (`docs/architecture/overview.md`,
T5), and the import tables' fields (`SYSTEM-SPEC.md` §4, T2).

## Design (LLD)

### Design decisions

- **The model sees only data and fixed instructions, and answers only in a schema.** The request's `system` field is the fixed instructions text and nothing else, so it is byte-identical on every read; one user turn carries the photo first when there is one, then one text block holding the device's today, the catalog as JSON (`[{code, description}]` and `[name]`), and, for a text read, the typed text inside a block marked as the owner's text. The instructions say to treat everything in the photo and the owner's text as data, never as directions, and to list at most 31 lines, so an invoice over 30 lines answers quickly and gets the too-long message. No tools, no `thinking` setting (Opus 5.5 always thinks), `output_config: { effort: "medium", format: { type: "json_schema", schema } }`, `max_tokens: 16000`. The instructions' rules are proved by the live run, whose sample set carries directions to the reader. Traces to: AC-0029, AC-0071 to AC-0073, AC-0170 to AC-0173.
- **The schema narrows, and the server decides.** The answer schema is `{ lines: [{ words, product_code, vendor_name, weight_lbs, cost_per_lb, received_date, unsure }] }`, every object `additionalProperties: false`. `product_code` is `anyOf [{ enum: <codes> }, { type: "null" }]`, `vendor_name` the same over the names (just `{ type: "null" }` for an empty list), the three values are strings or null, and `unsure` is an array of `enum ["product", "vendor", "weight", "cost", "date"]`. Structured output enforces no length or range, so `draftLines` re-checks every value and blanks what fails. Traces to: AC-0050 to AC-0054, AC-0062.
- **Numbers stay text until Postgres.** The reading's weight and cost are strings; `draftLines` keeps the owner-visible text; `create_import_draft` and `confirm_import_draft` take them as JSON strings and cast to `numeric`, so no JavaScript number carries a weight or a cost on this path. Traces to: AC-0030, AC-0032, AC-0040, AGENTS.md hard rule 3.
- **Usable means Receiving's own rule.** `draftLines` calls `parseReceiptForm`'s weight, cost, and date rules through small exported helpers in `src/lib/receipt-input.ts` (extracted, behavior unchanged), so a drafted value that would be refused on `/receiving` is never drafted. A product must match a catalog code exactly, and a vendor a catalog name exactly. Traces to: AC-0050, AC-0052, AC-0083.
- **An unsure value is not drafted.** A field in the reading's `unsure` list is blank and stored in `unsure_fields`; a blank field is never filled with a guess. Traces to: AC-0051, AC-0078.
- **The key and the address are read in one place, at call time.** `model.ts` reads `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL` when a read runs; Next.js has already filled each from `.env` only if the process had none, so a value the shell or the test suite sets wins. It resolves the address with `modelAddress` and constructs the client with every setting explicit: `apiKey`, `baseURL`, `authToken: null`, `timeout: 120_000`, `maxRetries: 0`, and the log level and any other option the installed SDK would otherwise read from the environment (see Dependencies & integration), so the SDK takes nothing from `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_LOG`, or a saved profile. A missing key is the not-set-up failure and a refused address the address-refused failure; the read action settles the caller first, then runs the photo or text checks, then checks both through `modelReady()`, then reads the catalog, so the spec's read outcome order holds. Traces to: AC-0021, AC-0027, AC-0028, AC-0056, AC-0074, AC-0115, AC-0159, AC-0161, AC-0163, AC-0175.
- **One read, one request.** `maxRetries: 0`; the owner presses Read again after "Try again in a moment." Traces to: AC-0027.
- **Failure kinds are AC-0057's closed set.** `FailureKind` is exactly not-set-up, address-refused, key-refused, declined, too-long, no-answer, unreadable, and service-error. `failureKind(error)` reads only `status` and the SDK error class name: no status (timeout) is no-answer; a dropped connection is service-error; 401 and 403 are key-refused; any other error status is service-error. `parseAnswer(message)` applies the spec's read outcome order: stop reason `refusal` is declined, `max_tokens` is too-long, an answer not matching the schema is unreadable, more than 30 lines is too-long, and the reading otherwise. Each kind maps to one message, and the log line holds the kind and the status only. Traces to: AC-0017 to AC-0021, AC-0028, AC-0057, AC-0062, AC-0115.
- **The browser checks, then shrinks, the photo.** The read form reads the chosen file's first 12 bytes with `photoMediaType` and refuses anything but JPEG, PNG, or WebP with the AC-0012 message. It then decodes the file with `createImageBitmap`, draws it on a canvas whose long edge is at most 2,576 px, and sends `canvas.toBlob("image/jpeg", 0.9)`. Re-encoding drops every EXIF and XMP block, location included, and keeps most photos well under 4 MB. Traces to: AC-0008, AC-0012, AC-0013.
- **The server trusts bytes, not names.** `photoMediaType(bytes)` reads the first 12 bytes; the request's claimed type and file name are ignored. Traces to: AC-0012, AC-0055, AC-0070.
- **A draft is created only from a usable reading.** No line, more than 30 lines, a cut-off answer, or a failure creates no draft, so a waiting draft always has 1 to 30 lines. Thirty lines keeps a full answer inside 16,000 output tokens and a 120-second wait; the live run's 30-line and 45-line samples exercise both. Traces to: AC-0016, AC-0017, AC-0031, AC-0172, AC-0182.
- **Save is all or nothing, and the draft id is the idempotency key.** `confirm_import_draft` locks the draft row (`FOR UPDATE`) first, refuses a draft that is not pending, then calls `receive_lot` for each given line in (product id, line number) order, so lines of one product enter in line order and two saves never lock products in opposite orders. Any refusal rolls back every lot. A second save of the same draft waits on the row lock and is refused as not pending. Traces to: AC-0032, AC-0033, AC-0036, AC-0046, AC-0116.
- **A line's refusal names its line.** Each `receive_lot` call sits in its own `begin … exception when others` block that re-raises `line <n>: <message>` with the original SQLSTATE; the outer transaction still rolls back. Traces to: AC-0033, AC-0085.
- **The photo is served by its own route,** `/invoices/photo/[draftId]`, a GET route handler that settles the caller, reads `capture_image` through the session client, and answers the bytes with the stored type, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`; any other caller or id gets 404 with an empty body. The proxy already sends a signed-out GET to `/sign-in`. A data URL in the page was rejected: it would put the photo in the HTML and again in the React payload. Traces to: AC-0079, AC-0081, AC-0099.
- **The review is `/invoices?draft=<id>`,** on the production and pricing pages' query-parameter pattern. A malformed id is not sent to the database; it gets the AC-0094 text. Traces to: AC-0076 to AC-0080, AC-0093, AC-0094.
- **The save result reuses Receiving's stock view.** The save action reads each touched raw product's stock before and after with `getStock`, and the result shows them through `stockView` and Receiving's before-and-after display. Traces to: AC-0082.
- **The fake model is a plain Node HTTP server** (`test/e2e/fake-model.mjs`, no dependency) that Playwright starts as a second web server on `127.0.0.1:3101`. `POST /v1/messages` records the request (headers and body) and answers from a queue; `POST /__fake/answers` sets the queue (a reading, a status with a body, a stop reason, a drop, or a hold), `GET /__fake/requests` returns the record, and `POST /__fake/reset` clears both. It also appends every request's headers and body, one JSON line each, to a run log under `test-results/` that no reset clears, so AC-0176 can be read after the run ends; the log holds the `x-api-key` value only as its SHA-256, so no key reaches the disk, and AC-0176 compares hashes. Traces to: AC-0011 to AC-0027, AC-0070 to AC-0075.

### Data & schema

- `public.import_drafts`: `id uuid pk default gen_random_uuid()`, `source text not null check (source in ('photo','text'))`, `capture_text text`, `capture_image bytea`, `capture_image_type text`, `captured_on date not null`, `captured_at timestamptz not null default now()`, `model text not null check (btrim(model) <> '')`, `status text not null default 'pending' check (status in ('pending','confirmed','discarded'))`, `settled_at timestamptz`. Checks: a discarded draft holds no `capture_text`, `capture_image`, or `capture_image_type`; any other text draft holds `capture_text` and no image; any other photo draft holds `capture_image` and `capture_image_type` and no text; `capture_image_type in ('image/jpeg','image/png','image/webp')`; `octet_length(capture_image) <= 4194304`; `char_length(capture_text) between 1 and 2000`; `(status = 'pending') = (settled_at is null)`.
- `public.import_draft_lines`: `id uuid pk`, `import_draft_id uuid not null references import_drafts`, `line_no int not null check (line_no between 1 and 30)`, `unique (import_draft_id, line_no)`, `words text check (words is null or (btrim(words) <> '' and char_length(words) <= 200))`, null only after a discard, `product_id uuid references products`, `vendor_id uuid references vendors`, `weight_lbs numeric(14,3) check (weight_lbs > 0)`, `unit_cost numeric(12,4) check (unit_cost >= 0)`, `received_date date`, `unsure_fields text[] not null default '{}' check (unsure_fields <@ array['product','vendor','weight','cost','date'])`, `status text not null default 'pending' check (status in ('pending','saved','skipped'))`, `lot_id uuid unique references lots`, check `(status = 'saved') = (lot_id is not null)`.
- RLS on both; `revoke all … from public, anon, authenticated, service_role`; `grant select … to authenticated, service_role`; one `operators_select` policy per table `for select to authenticated using (private.is_operator())`, as in the access lockdown migration. No insert, update, or delete grant to any role.
- `test/db.ts`'s truncate list gains `import_draft_lines, import_drafts`.
- `SYSTEM-SPEC.md` §4 lists these fields in place of `raw_capture`, `confidence`, and `resolved`.

### Interfaces & contracts

- `create_import_draft(p_source text, p_captured_on date, p_model text, p_lines jsonb, p_capture_text text default null, p_capture_image bytea default null, p_capture_image_type text default null) returns public.import_drafts`, so a call by name may leave out the arguments its source does not use. Each element of `p_lines`: `{ words, product_id, vendor_id, weight_lbs, unit_cost, received_date, unsure }`, values strings or null, `unsure` an array of field names. Refusal texts after the `create_import_draft: ` prefix name the rule, such as `line 3 weight has more than 3 decimal places`.
- `confirm_import_draft(p_draft_id uuid, p_lines jsonb) returns setof public.lots`. Each element: `{ line_id, product_id, vendor_id, weight_lbs, unit_cost, received_date }`, all required. Refusals: `draft <id> not found`, `draft <id> is already saved or discarded`, `no line to save`, `line <id> is not in this draft`, `line <id> is given twice`, `line <n> is missing <field>`, and the re-raised `line <n>: <receive_lot message>`.
- `discard_import_draft(p_draft_id uuid) returns public.import_drafts`; it clears the draft's photo, photo type, and typed text, and every line's words. `create_import_draft` refuses a line with no words. Refusals: `draft <id> not found`, `draft <id> is already saved or discarded`.
- All three: `SECURITY DEFINER`, `set search_path = ''`, `private.assert_caller` first, value checks before the lock, revoke from `public, anon, authenticated, service_role`, grant EXECUTE to `authenticated`.
- `src/lib/rpc.ts`: `createImportDraft`, `confirmImportDraft`, `discardImportDraft`, thin wrappers that throw `RpcError` like the others. The photo goes as `'\\x' + hex`.
- `src/lib/invoices.ts`: `listWaitingDrafts(client)` (newest first, with line count and first line's words), `getDraft(client, id)` (the draft without its photo, its lines in order, and for a saved draft its lots' numbers), and `getDraftPhoto(client, id)`.
- `src/lib/invoice-reading.ts`: types `Catalog`, `ReadingLine`, `DraftLine`, `FailureKind`; `draftLines(reading, catalog, today)`, `photoMediaType(bytes)`, `checkReceiptText(text)`, `modelAddress(baseUrl)`, `INSTRUCTIONS`, `answerSchema(catalog)`, `requestParams(input, catalog, today)`, `parseAnswer(message)`, `failureKind(error)`, `readFailureMessage(kind)`, `readFailureLogLine(kind, status)`.
- `src/lib/failures.ts`: the save and discard texts and `draftSaveFailureMessage(error, stage)` and `draftDiscardFailureMessage(error, stage)`, where a save's stock read before the write call is the before-write stage; `LoggedAction` gains `readInvoice`, `saveDraft`, and `discardDraft`.
- `test/db.ts`: `OperationName` gains the three functions; `PARAM_TYPES` gains `p_source`, `p_capture_text`, `p_capture_image` (`bytea`), `p_capture_image_type`, `p_captured_on`, `p_model`, `p_lines` (`jsonb`), and `p_draft_id`.

### Component / module decomposition

- `src/app/_server/model.ts`: `import "server-only"`; `readReceipt(input, catalog, today)` returns a reading or a failure kind with its status. The only importer of the SDK.
- `src/app/invoices/`: `page.tsx` (server: caller, then the home or the `?draft=` review), `read-forms.tsx` (client: photo shrink, both forms, the in-flight state), `drafts-list.tsx`, `draft-review.tsx` (client: the line fieldsets, Save receipts, Discard draft), `saved-result.tsx`, `read-invoice.ts` and `save-draft.ts` (decisions, every outside call an argument, as `save-batch.ts`), `actions.ts` (`readPhoto`, `readText`, `saveDraft`, `discardDraft`, wiring the real calls), `form-fields.ts`, `error.tsx` on `page-error.tsx`, and `photo/[draftId]/route.ts`.
- `src/app/page-header.tsx`: `PageName` and `PAGES` gain `invoices`, after `pricing`.
- `next.config.ts`: `experimental.serverActions.bodySizeLimit: "5mb"`.
- `test/e2e/fake-model.mjs`, `test/e2e/invoices.spec.ts`, `test/e2e/invoices-page.ts` (fixtures, the fake model's control calls, `FORM_CONTROLS`, a JPEG size reader for AC-0013).
- `playwright.config.ts`: `webServer` becomes a list with the fake model first; the app gets `ANTHROPIC_API_KEY` (a sentinel), `ANTHROPIC_BASE_URL=http://127.0.0.1:3101`, and `ANTHROPIC_AUTH_TOKEN` (a second sentinel).

### State & control flow

Page contract, from `frontend-engineering` create mode:

| Field | `/invoices` (home, review, result) |
| --- | --- |
| target user | The owner, on the dock with a phone or at a desk |
| primary job | Turn an invoice or a spoken-style note into saved receipts without retyping it |
| primary action | Read photo (home); Save receipts (review) |
| expected result | A waiting draft opens with its lines filled where sure; after Save, the new lots and the raw products' stock and average |
| next action | Check each line against the photo; then the next invoice |
| first-screen content at 320 px | Heading, navigation, the "Read an invoice" section with the photo field and Read photo |
| product proof | none: an internal tool |
| read/write consequence | A read writes one draft and no ledger row; Save writes every ticked line as a lot or nothing; Discard writes the draft's status only |
| critical states | first-run, content, loading, error, success, permission/denied, blocked, keyboard-only |
| responsive behavior | One column at every width; each line's fields stack; the photo scales to the column width |
| a11y requirements | WCAG 2.2 AA; status region for the in-flight read; focus to the first field with an error, or to the message after a save, discard, or failure |
| measurement event | none: no analytics |

State matrix (the applicable subset of the 18 states):

| State | Treatment | AC |
| --- | --- | --- |
| first-run | No waiting draft: "No drafts waiting." under Drafts to confirm | AC-0025 |
| content | The two read sections and the drafts list; a review with its lines | AC-0010, AC-0025, AC-0076 |
| loading | A read in flight: the status text and both Read buttons disabled; no skeleton, because the next screen is a navigation | AC-0014 |
| error | Read failures and save failures as messages beside the form, fields kept; the `/invoices` error page | AC-0016 to AC-0024, AC-0089, AC-0115 to AC-0118, AC-0123 |
| success | "Saved N receipts." with the lots and stock; "Draft discarded." | AC-0082, AC-0092, AC-0100 |
| permission/denied | The not-allowed page; the photo address answers 404 | AC-0002, AC-0099 |
| blocked | The two not-set-up messages and the key-refused message name the fix | AC-0020, AC-0021, AC-0028 |
| no-results | A reading with no line; an unknown draft id; a settled draft's review | AC-0016, AC-0093, AC-0094, AC-0105 |
| disabled | Read buttons while a read is in flight | AC-0014 |
| keyboard-only | Every action by keyboard | AC-0133 |

Not applicable: empty (first-run covers it), partial and large-data-set (at most 30 lines, and only waiting drafts are listed), offline (capture-and-queue is out of scope by SYSTEM-SPEC §9), destructive-confirmation (Discard touches no ledger row, and a new read replaces a discarded draft), long-content (30 lines is one scrolling column), high-zoom and reduced-motion (no motion; reflow follows from one column).

### Behavior & rules

- The home's read sections and the review's lines are separate forms; each Read button submits only its own field plus the hidden `today`.
- A successful read revalidates `/invoices` and navigates to `/invoices?draft=<id>`.
- On the review, an unticked line sends only its id; `save-draft.ts` runs the field rules on ticked lines only, then calls `confirmImportDraft` with the ticked lines' values as typed.
- After Save or Discard, `/invoices` is revalidated only when the follow-up reads succeeded, as Receiving does.

### Failure, edge cases & resilience

- A read whose draft write gets no answer may have created the draft: the message says to reload and check Drafts to confirm, which lists it if it exists (AC-0117).
- A save whose write gets no answer may have saved: the reload shows "This draft was saved." with its lot numbers, or the waiting review (AC-0116, AC-0093).
- A double press of Save is refused by the row lock and the pending check, never saved twice (AC-0036).
- The model service's 120-second limit and the database's 10-second limit are separate: the read action reads the catalog, calls the model, then writes the draft.
- The model's answer can never reach the ledger: it fills draft fields only, and Save sends the fields as the page holds them.

### Quality attributes (NFRs)

- **Aesthetic reference:** Stripe Dashboard (professional SaaS: a light surface, high contrast, tabular figures, no gradients or illustration), as on the other pages. XD genre routing: skipped (experience-design pack absent). Seed tokens: the existing tokens in `src/app/globals.css`; the page adds none.
- **Accessibility:** every field has a visible `<label>`; each line is a `<fieldset>` whose `<legend>` is "Line N"; error ids are named by `aria-describedby`; the in-flight text sits in a `role="status"` region present from page load; messages sit in `role="status"` or `role="alert"` regions.
- **Security posture:** see the design decisions on the model, the key, the photo, and the photo route; the spec-stage security review covers them.
- `checkPageState` in `test/e2e/a11y.ts` runs in every page state the spec lists.

### Dependencies & integration

- `@anthropic-ai/sdk`, pinned exactly (no `^`) to the newest release at least 14 days old on the install day that types `output_config.format` and `output_config.effort` on `messages.create`. Discovery predicate: in the installed package, the `MessageCreateParams` type has `output_config` with `format` and `effort`, and `Anthropic`'s constructor options have `apiKey`, `baseURL`, `authToken`, `timeout`, and `maxRetries`. The ledger also records every environment variable the installed client reads (such as `ANTHROPIC_LOG`), found by searching its source, and `model.ts` passes an explicit value for each; and every header the client adds to a request and every value it can write for the operating system's name (the spec's header inventory). A header that carries a value from this machine is removed through the client's header options; if the installed client cannot remove one, stop and ask the owner. If no release at least 14 days old types them, stop and ask the owner. Proof obligation: AC-0073, AC-0074, and AC-0184 against the fake model, and AC-0170 against the real service.
- The Claude Messages API at `https://api.anthropic.com/v1/messages`, reached only from `model.ts`.

## Tasks

Each `stub: true` block's validation is recorded under "Stub validation" at the
end of this section.

### T1: The reading rules and the photo, text, and address checks pass their tables

**Depends on:** none

**Touches:** `src/lib/invoice-reading.ts`, `src/lib/receipt-input.ts`, `test/invoice-reading.test.ts`, `test/fixtures/invoices/*`

**Tests:**
- `test/invoice-reading.test.ts`, a new file, no database. stub: true. Test functions and ACs: "AC-0050: a reading value that is not usable leaves its drafted field blank" (AC-0050), "AC-0055: the photo rule names the media type from the bytes" (AC-0055), "AC-0056: the model address rule allows only the API and the loopback" (AC-0056). sha256 `b2db94b24148f797be82e08d9004c871436f96ee06b31e63a070ee826675a196`.

```ts
import { expect, it } from "vitest";
import { draftLines, modelAddress, photoMediaType, type Catalog, type ReadingLine } from "../src/lib/invoice-reading.js";

const RAW_TOM = "22222222-2222-2222-2222-222222222222";
const REYES = "11111111-1111-1111-1111-111111111111";
const CATALOG: Catalog = {
  products: [{ id: RAW_TOM, code: "RAW-TOM", description: "Turkey Drums TOM (raw)" }],
  vendors: [{ id: REYES, name: "Reyes Meats" }],
};
const TODAY = "2026-10-09";
const USABLE: ReadingLine = {
  words: "TKY DRUMS 40#",
  product_code: "RAW-TOM",
  vendor_name: "Reyes Meats",
  weight_lbs: "5000",
  cost_per_lb: "1.68",
  received_date: "2026-10-01",
  unsure: [],
};

// STUB: AC-0050
it("AC-0050: a reading value that is not usable leaves its drafted field blank", () => {
  expect(draftLines([USABLE], CATALOG, TODAY)).toEqual([
    {
      words: "TKY DRUMS 40#",
      productId: RAW_TOM,
      vendorId: REYES,
      weightLbs: "5000",
      unitCost: "1.68",
      receivedDate: "2026-10-01",
      unsure: [],
    },
  ]);
  const unusable: ReadonlyArray<[ReadingLine, "productId" | "vendorId" | "weightLbs" | "unitCost" | "receivedDate"]> = [
    [{ ...USABLE, product_code: "RAW-OLD" }, "productId"],
    [{ ...USABLE, vendor_name: "reyes meats" }, "vendorId"],
    [{ ...USABLE, weight_lbs: "5,000" }, "weightLbs"],
    [{ ...USABLE, cost_per_lb: "$1.68" }, "unitCost"],
    [{ ...USABLE, received_date: "2026-10-10" }, "receivedDate"],
  ];
  for (const [reading, drafted] of unusable) {
    const [line] = draftLines([reading], CATALOG, TODAY);
    expect(line?.[drafted], JSON.stringify(reading)).toBeNull();
  }
});

// STUB: AC-0055
it("AC-0055: the photo rule names the media type from the bytes", () => {
  expect(photoMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  expect(photoMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  expect(photoMediaType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  expect(photoMediaType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
});

// STUB: AC-0056
it("AC-0056: the model address rule allows only the API and the loopback", () => {
  expect(modelAddress(undefined)).toBe("https://api.anthropic.com");
  expect(modelAddress("")).toBe("https://api.anthropic.com");
  expect(modelAddress("http://127.0.0.1:4010")).toBe("http://127.0.0.1:4010");
  expect(modelAddress("http://localhost:4010/")).toBe("http://localhost:4010/");
  const refused = [
    "https://example.com",
    "http://127.0.0.1",
    "http://127.0.0.1:4010/v1",
    "http://user@127.0.0.1:4010",
    "https://api.anthropic.com.example.com",
    "http://10.0.0.5:4010",
  ];
  for (const value of refused) expect(modelAddress(value), value).toBeNull();
});
```

- The same file then grows, in EXECUTE, to every value AC-0050, AC-0052, and AC-0056 list, and one test per criterion for AC-0051, AC-0053, AC-0054, AC-0057, and AC-0062. AC-0057's check passes an error whose message holds a sentinel key, a typed text, and "Turkey Drums TOM (raw)", and asserts the line equals the expected text exactly. AC-0062 parses a JSON answer with an extra property, a missing property, and a wrong type.
- `requestParams` gets construction tests for the T3 browser criteria: the photo block comes first, the catalog lists only the given products and vendors, and the settings equal AC-0073's.
- `test/receipt-input.test.ts` and `test/receipt-input-extra.test.ts` stay unchanged and green after the rule helpers are extracted.

**Approach:**
- Extract the weight, cost, and date rules from `parseReceiptForm` into exported helpers with unchanged messages; `parseReceiptForm` calls them.
- Write `invoice-reading.ts` on those helpers and `number-text.ts`; no number is parsed with `Number` on this path.
- Add `test/fixtures/invoices/`: the sample set the spec defines, as HTML invoices and plain-text samples over RAW-TOM, RAW-CHK, Reyes Meats, and Belmont Poultry, with `expected.json` listing, for each sample in line order, every line's printed values, its expected product code and vendor name, and its expected drafted fields under AC-0177 to AC-0180. The sample set is committed in T1, before any live run.

**Done when:** the T1 tests are green and `npm test` exits 0.

### T2: The import tables and the three functions pass their database cases

**Depends on:** none

**Touches:** `supabase/migrations/*_invoice_entry.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/invoice-costing.test.ts`, `test/invoice-data.test.ts`, `test/access.test.ts`, `package.json`, `AGENTS.md`, `SYSTEM-SPEC.md`

**Tests:**
- `test/invoice-costing.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0040: saving the turkey reading's draft leaves RAW-TOM at 8,000 lbs and an average of exactly 1.725" (AC-0040). sha256 `d107d8d94769c8cff0af92c955b26c9409d349d4c880ea779316a9d8b905ec99`.

```ts
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  idOf,
  query,
  RAW_TOM_ID,
  resetTestData,
  VENDOR_ID,
} from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

const turkey = (weight: string, cost: string, date: string) => ({
  product_id: RAW_TOM_ID,
  vendor_id: VENDOR_ID,
  weight_lbs: weight,
  unit_cost: cost,
  received_date: date,
});

// STUB: AC-0040
it("AC-0040: saving the turkey reading's draft leaves RAW-TOM at 8,000 lbs and an average of exactly 1.725", async () => {
  const created = await callAsOperator({
    fn: "create_import_draft",
    args: {
      p_source: "text",
      p_capture_text: "5000 lbs RAW-TOM from Reyes Meats at 1.68 on Oct 1, 3000 at 1.80 on Oct 5",
      p_captured_on: "2026-10-09",
      p_model: "claude-opus-5-5",
      p_lines: JSON.stringify([
        { words: "TKY DRUMS 40#", unsure: [], ...turkey("5000", "1.68", "2026-10-01") },
        { words: "TKY DRUMS 40#", unsure: [], ...turkey("3000", "1.80", "2026-10-05") },
      ]),
    },
  });
  expect(created.error).toBeUndefined();
  const lines = await query<{ id: string }>(
    "select id from public.import_draft_lines where import_draft_id = $1 order by line_no",
    [idOf(created)],
  );
  const saved = await callAsOperator({
    fn: "confirm_import_draft",
    args: {
      p_draft_id: idOf(created),
      p_lines: JSON.stringify([
        { line_id: lines[0]?.id, ...turkey("5000", "1.68", "2026-10-01") },
        { line_id: lines[1]?.id, ...turkey("3000", "1.80", "2026-10-05") },
      ]),
    },
  });
  expect(saved.error).toBeUndefined();
  expect(
    await query(
      "select qty_on_hand::text, moving_avg_cost::text from public.inventory_balances where product_id = $1",
      [RAW_TOM_ID],
    ),
  ).toEqual([{ qty_on_hand: "8000.000", moving_avg_cost: "1.7250" }]);
  expect(
    await query("select unit_cost::text from public.lots where product_id = $1 order by receipt_seq", [RAW_TOM_ID]),
  ).toEqual([{ unit_cost: "1.6800" }, { unit_cost: "1.8000" }]);
});
```

- `test/invoice-data.test.ts`, a new file, grows in EXECUTE with one test per criterion: AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0039, AC-0041, AC-0042, AC-0043, AC-0044, AC-0046, AC-0047, AC-0101, AC-0102, AC-0103, AC-0106.
  - Refusals compare `tableFingerprints` before and after (AC-0031, AC-0033, AC-0034, AC-0035); AC-0033 makes RAW-TOM inactive through `query` before the second line's call.
  - AC-0036 runs two `confirm_import_draft` calls through `raceCalls`.
  - AC-0037 and AC-0038 read as the non-operator and as `service_role` after the operator reads a row; AC-0039 tries each write as each role; AC-0041 checks `has_function_privilege`; AC-0042 reads `pg_proc.proconfig`.
  - AC-0044 reads the saved lot through `listRecentReceipts` as the operator; AC-0103 voids it with `voidReceiptCall`; AC-0102 reads the draft row and every line.
- `test/access.test.ts` gains a `validArgs` entry and an operator fixture call for each of the three functions.
- `test/costing.test.ts`, `test/engine.test.ts`, `test/pricing.test.ts`, and the receiving suites stay unchanged and green.

**Approach:**
- Before writing the migration, run `supabase db reset` from this worktree (so the database holds `main`'s migrations, not the Sales worktree's), then record in the verification ledger the base tables in `public` and their columns from `information_schema`, for AC-0160.
- Extend `OperationName`, `PARAM_TYPES`, and the truncate list in `test/db.ts`.
- Write the migration in the order: tables and checks, RLS and grants and policies, the three functions with their revoke-then-grant lines. Create it with `supabase migration new invoice_entry`, apply with `supabase migration up`, then `npm run gen:types`.
- Set `test:costing` to `vitest run test/costing.test.ts test/pricing.test.ts test/invoice-costing.test.ts` and its `AGENTS.md` comment to "the golden costing, pricing, and invoice-save suites only".
- Edit `SYSTEM-SPEC.md` §4's two import-table lines to the built fields.

**Done when:** the T2 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T3: A photo or a typed text read on `/invoices` creates a waiting draft, and the request holds only what the spec allows

**Depends on:** T1, T2

**Touches:** `package.json`, `package-lock.json`, `src/app/_server/model.ts`, `src/app/invoices/*` (except `draft-review.tsx`, `saved-result.tsx`, `save-draft.ts`, and `photo/`), `src/app/page-header.tsx`, `src/lib/invoices.ts`, `src/lib/rpc.ts`, `src/lib/failures.ts`, `next.config.ts`, `playwright.config.ts`, `test/read-invoice.test.ts`, `test/e2e/fake-model.mjs`, `test/e2e/invoices.spec.ts`, `test/e2e/invoices-page.ts`, `test/e2e/receiving-page.ts`, `test/e2e/production-page.ts`, `test/e2e/menu-page.ts`, `test/e2e/pricing-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/invoices.spec.ts`, signed in as the operator, with fixtures written through `pg` and answers set on the fake model:
  - access and navigation: AC-0001, AC-0002, AC-0004 (on all five pages), AC-0005, AC-0006, and AC-0003, AC-0007, and AC-0190 for the read action;
  - reading: AC-0010, AC-0012 (the browser rows by choosing files, including a GIF the browser can decode; the 4 MB row by a replayed request), AC-0013, AC-0008 (the stored photo read through `pg`), AC-0014 (the fake model holds the answer until the test releases it), AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0022, AC-0024, AC-0025, AC-0026 (ledger fingerprints before and after a read), AC-0027;
  - AC-0011 and AC-0015 check the new draft's rows through `pg` and that the page reaches its `?draft=` address; T4 adds their on-screen review checks;
  - AC-0021 and AC-0028 against a second `next start` on port 3102 over the same build, spawned by the spec. For AC-0021 it gets `ANTHROPIC_API_KEY=` (empty, which `.env` cannot fill) and `ANTHROPIC_BASE_URL` set to the fake model; for AC-0028 it gets a sentinel key and `ANTHROPIC_BASE_URL=https://example.com`. Each case reuses the operator's saved session, and the fake model's record shows no request;
  - the request: AC-0070, AC-0071, AC-0072, AC-0073, AC-0029, AC-0074, AC-0184 (ignoring case and spaces, against `os.hostname()`, `os.type()`, `os.platform()`, the product names macOS, Windows, and Linux, `os.arch()`, `process.version` with and without its `v`, and every operating-system value the header inventory lists), and AC-0075, read from `GET /__fake/requests`;
  - AC-0185: the fake model holds the turkey reading while the test makes RAW-TOM inactive through `pg`, then releases it; AC-0075 also scans every file under `.next/static`;
  - display: AC-0098 for the drafts list's dates;
  - `checkPageState` with no findings in the home states the spec lists: AC-0130, AC-0131, AC-0132, AC-0139, AC-0141 for those states; AC-0133 for Read photo and Read text; AC-0135, AC-0136, and AC-0137 for the read refusals and failures.
- `test/read-invoice.test.ts`, no database, drives `read-invoice.ts` with every outside call as an argument: each caller status, including a check that fails with a coded answer (AC-0186), a failed catalog read (AC-0009), each failure kind, a refused and an unanswered draft write, and a successful read. Construction for the criteria above.
- `FORM_CONTROLS` in the four floor and office page helpers gains "a Invoices" after "a Pricing", so their suites stay green.

**Approach:**
- Install the SDK with `npm install --save-exact`, after settling the Dependencies & integration discovery predicate; record the version and its publish date in the ledger.
- Write `model.ts`, then `read-invoice.ts` and the two read actions, then the page, then the fake model and the Playwright wiring.

**Done when:** the T3 tests are green, `npm test` exits 0, and the ledger records the SDK pin.

### T4: A draft's review saves its ticked lines as lots or discards the draft

**Depends on:** T3

**Touches:** `src/app/invoices/draft-review.tsx`, `src/app/invoices/saved-result.tsx`, `src/app/invoices/save-draft.ts`, `src/app/invoices/actions.ts`, `src/app/invoices/page.tsx`, `src/app/invoices/photo/[draftId]/route.ts`, `src/lib/invoices.ts`, `src/lib/rpc.ts`, `src/lib/failures.ts`, `test/save-draft.test.ts`, `test/invoices-data.test.ts`, `test/e2e/invoices.spec.ts`, `test/e2e/invoices-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/invoices.spec.ts` gains:
  - the review: AC-0011 and AC-0015 on screen, AC-0076, AC-0077, AC-0078, AC-0079, AC-0080, AC-0093, AC-0105, and AC-0094;
  - the photo address: AC-0081, AC-0099, through Playwright's request API as each role;
  - saving and discarding: AC-0187, AC-0189, AC-0082, AC-0107, AC-0100, AC-0098 (the saved result's weights, costs, and dates), AC-0104, AC-0083, AC-0084, AC-0085, AC-0086, AC-0087, AC-0088, AC-0089, AC-0090, AC-0091, AC-0092, AC-0095, AC-0096, AC-0097, AC-0059, and AC-0003 for the save and discard actions;
  - `checkPageState` in every review, result, and refusal state the spec lists; AC-0133 for Save receipts, Discard draft, a draft link, and a line checkbox; AC-0134, AC-0135, AC-0136, AC-0137, and AC-0138.
- `test/save-draft.test.ts`, no database, drives `save-draft.ts` and the discard decision with every outside call as an argument; `test/invoices-data.test.ts`, against the local stack, covers `listWaitingDrafts`, `getDraft`, and `getDraftPhoto`. Construction for the criteria above, including the AC-0059 and AC-0085 message mapping.

**Approach:**
- Reads first, then the decisions and actions, then the review and result components, then the route handler.

**Done when:** the T4 tests are green and `npm test` exits 0.

### T5: The docs match the code, the goal-based checks pass, and the recorded runs are in the ledger

**Depends on:** T4

**Touches:** `docs/architecture/overview.md`, `AGENTS.md`, `.env.example`, `.gitignore`, `docs/specs/invoice-entry/notes/verification-ledger.md`

**Tests:** no stub (mode): goal-based checks and manual QA recorded in the verification ledger.
- AC-0150, AC-0151, AC-0152, AC-0153, AC-0154, AC-0155, AC-0156, AC-0157, AC-0158, AC-0159, AC-0160, AC-0161, AC-0162, AC-0163, AC-0164, AC-0165, and AC-0166, each as its command, output in the ledger; AC-0160 compares against the T2 baseline, and AC-0152 runs right after a `supabase db reset` from this worktree.
- The recorded run against `npm run start`, per the spec's Testing Strategy, for AC-0023, AC-0115, AC-0116, AC-0117, AC-0118, AC-0188, AC-0123, AC-0124, AC-0175, AC-0176, and AC-0183 (with `ANTHROPIC_API_KEY` in neither the app's process nor `.env`), with throwaway forwarders and the AC-0176 sandbox profile in scratch.
- The live run for AC-0170, AC-0171, AC-0172, AC-0173, AC-0177, AC-0178, AC-0179, AC-0180, and AC-0182, once the owner has put the Meat Ops key in `.env`: a scratch Playwright script renders each sample invoice to a PNG, reads it through the built app's Read photo, reads each sample text through Read text, and prints each draft's lines from `pg` beside `expected.json`. The ledger records every line, the filled and blank counts, and each bar's result.
- Rendered-page inspection, per `frontend-engineering` GATES step 5, of `/invoices` with waiting drafts, a photo draft's review, and the saved result over the seeded fixture, at the narrow and wide fallback channels, each at the four required captures, with the five fields and the observations recorded in the ledger for the `frontend-reviewer`.

**Approach:**
- Write the overview's rows and "AI connection" section, the `AGENTS.md` environment paragraph with a `.env` command that keeps an existing `ANTHROPIC_API_KEY`, the `.env.example` line for the optional key, and a `.gitignore` rule for every `.env` file Next.js reads except `.env.example`; then run the checks and the recorded runs.

**Done when:** every T5 entry is recorded in the ledger with a pass, and `npm test` exits 0.

### Stub validation

Run 2026-10-09. Each `stub: true` block was extracted from this file into a `git
archive` copy of `HEAD` in the session's scratch directory, outside the
repository, and its sha256 recorded from that extraction (the code lines plus one
terminal newline).

- **Compile:** with placeholder declarations of `src/lib/invoice-reading.ts` (the `Catalog`, `ReadingLine`, and `DraftLine` types and the three functions) and the T2 `test/db.ts` names (`OperationName` and `PARAM_TYPES` entries), `tsc --noEmit -p tsconfig.json` over the scratch copy exited 0.
- **Red, with the placeholder module removed and the `test/db.ts` names kept:** `vitest run` over the two files exited 1. `test/invoice-reading.test.ts` failed to load `../src/lib/invoice-reading.js`. `test/invoice-costing.test.ts` failed its first assertion with `function public.create_import_draft(p_source => text, p_capture_text => text, p_captured_on => date, p_model => text, p_lines => jsonb) does not exist` from the local stack.
- **Isolation:** the run went through `sandbox-exec` with: outbound network denied except to `localhost` and Unix sockets (a `curl` to `https://api.anthropic.com` under the same profile failed to connect); file-content reads denied except for the repository, the Node 22.17.0 install under `~/.nvm/versions/node/v22.17.0`, the scratch directory, this user's temporary directory (`os.tmpdir()`), `/private/var/db/timezone`, `/System`, `/usr`, `/private/etc`, and `/dev` (a read of `~/.zshrc` was refused); file writes denied except under the scratch directory and the temporary directory (a write into the repository was refused); and a 120-second `alarm`. Vitest ran as `node node_modules/vitest/vitest.mjs`, not through `npx`. The stack details came from `supabase status -o env` outside the sandbox and were passed in the environment, so no Docker or CLI call ran inside it. Vitest's cache write under `node_modules/.vite` was refused.
- **Declared test-harness side effects,** all on the local stack through `localhost`: global setup's idempotent creation of the test users and their allowlist rows, and `resetTestData`'s truncate and reseed of the local database. These are the side effects `npm test` has on every run. No test in the Sales worktree was running.
- The scratch copy was removed.

## Rollout

- **Delivery:** local only. Merging enables `/invoices`; without `ANTHROPIC_API_KEY` in `.env`, a read says reading isn't set up and nothing else changes.
- **Infrastructure:** none. The owner makes a Meat Ops key with a monthly spend limit in the Anthropic Console and adds it to `.env`.
- **External-system integration:** the Claude Messages API. Anthropic keeps API prompts and outputs up to 30 days and does not train on them.
- **Deployment sequencing:** the migration applies before the app that calls the functions; the hosted rollout stays with the hosted-supabase-rollout intent.

## Risks

- **Parallel Sales build.** Both branches add a migration, a Primary navigation link, `FORM_CONTROLS` entries, `test/db.ts` and `test/access.test.ts` entries, and overview rows. Whichever merges second rebases, renames its migration to a timestamp after the other's so `supabase migration up` stays in order, regenerates the types, and keeps both links.
- **Shared local stack.** A test run in one worktree wipes the other's data and schema. Take turns, with `supabase db reset` before each run.
- **Model behavior.** Opus 5.5 may compute a per-lb cost or convert a weight despite the instructions; AC-0170 catches it, and the fix is instruction wording within the same rules.
- **SDK surface.** The pinned release may not type `output_config`; the discovery predicate stops the work before code is written on a guess.
- **Large uploads.** The 5 MB action limit applies to every server action; the app listens only on `127.0.0.1`, so only this machine can send one.

## Changelog

- 2026-10-09: initial plan
- 2026-10-09: after review round 1: test servers get their key and model address only from the suite; the caller-check failure, the auth-stop save, and the held-call states move to the recorded run with their kept values, focus, and page checks; a read holds at most 30 lines and waits 120 seconds; discard clears the photo and text; the browser checks a photo's bytes before shrinking it; the request's system text is fixed; every `.env` file is ignored.
- 2026-10-09: after review round 2: failure kinds match AC-0057; the instructions cap a reading at 31 lines; discard clears line words; the fake model keeps a whole-run request log; the request's machine-value headers need the owner's approval; the durable-output map points at the spec's rows; resets check for an applied Sales migration first.
- 2026-10-09: after review round 3: the answer schema may carry the catalog's codes and names; machine-value headers are removed outright (AC-0184); the fake model's run log stores the key only as a hash; the read outcome order runs from the press to the draft write, with a refused draft write (AC-0185); the timing bar is dropped; relative dates stay as words in `expected.json`; the reset rule follows the turn-taking decision.
- 2026-10-09: after review round 4: caller-first restored in every action, with the read, save, and discard outcome orders stated in the spec; the header check compares every spelling the installed client writes; the AC-0183 step stays on the fake model; relative dates compare the same way in every live-run check.
- 2026-10-09: after review round 5: the discard order gains its non-operator, no-answer, and other-refusal outcomes (AC-0187 to AC-0189); a save's failed stock read before the write is AC-0097's before-write case; the header inventory is defined in the spec, and AC-0184 also checks the operating system's product name.
