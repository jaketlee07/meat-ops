# Architecture Overview

Meat Ops keeps the business's costs, stock, and trace records in one Postgres
database. Only the signed-in owner reaches it, and only eight database functions
change the ledger. A Next.js app on the same machine is the owner's screen. The
brief is [`SYSTEM-SPEC.md`](../../SYSTEM-SPEC.md). The costing math and its
golden numbers are in [`docs/costing.md`](../costing.md).

## Areas and change guidance

| Area | Responsibility | Change guidance |
| --- | --- | --- |
| `supabase/migrations/` | The schema, the eight operations (the six originals, `correct_receipt`, and `reverse_batch`) and the table `receipt_corrections`, the two price-setting functions and the what-if, the three import-draft functions (`create_import_draft`, `confirm_import_draft`, `discard_import_draft`), the alerts (the watch `refresh_alerts`, `dismiss_alert`, `apply_alert_price`, `start_digest`, `finish_digest`, the `v_alerts` view, and the private list-price history with its trigger on `products`), the access rules, and the auth settings that go with them. `0001_init.sql` is the original schema. Later files harden it. | Add a new file for every change. Never edit `0001_init.sql`. Revoke the default privileges on each new table, view, and function, then grant back only what the access model below names. Once any receipt has been corrected or any batch reversed, fix a bad release forward: a build from before corrections reads each lot's recorded cost and weight and shows no reversed mark, while restated batch, finished-lot, and sale-line costs keep no earlier value outside `receipt_corrections`. |
| `supabase/config.toml`, `supabase/stack-b.env` | Local stack settings: sign-up off, 12-character minimum password, and sessions that end after 12 hours without activity or 168 hours after sign-in. `stack-b.env` gives stack B, the second test stack in `AGENTS.md`, its own project id and ports and leaves off the services the tests do not use. | Restart stack A after a change (`supabase stop`, `supabase start` in a stack A folder). Stack B reads both files, so also stop it with the stack B stop command in `AGENTS.md`, copy the template again into each stack B folder, and set it up with the stack B steps; never stop stack B with a plain `supabase stop`. Keep `test/stack-b.test.ts` passing, so stack B never shares a project id or port with stack A. Keep `npm run db:reset:stack-b` gated on an exact copy and passing the file's settings to the CLI directly: a shell `SUPABASE_*` variable beats `supabase/.env`, and `supabase status` prints the configured ports, not the running stack's, so a status check cannot tell which project a reset reaches. |
| `supabase/seed.sql` | Demo catalog and data, loaded through psql as `postgres`. | Keep it loadable after `supabase db reset`. |
| `src/lib/` | Typed wrappers over the operations (`rpc.ts`), typed reads (`views.ts`, which holds the `getMenu` read, `receiving.ts`, the receipt and lot-figure reads in `receiving.ts` (including the corrected and recorded figures and the batches made from a lot), the production reads in `production.ts` (including `getReversalPreview` and `listSalesVoidedBy`), the pricing list, detail, and what-if reads in `pricing.ts`, the sales reads in `sales.ts`, and the sale and lot trace reads in `trace.ts`), the client (`supabase.ts`), display formats (`format.ts`), the receiving, batch, price, and sale and lot-finder form rules (`receipt-input.ts`, `batch-input.ts`, `price-input.ts`, `sale-input.ts`) with their shared number-text rules (`number-text.ts`), the pricing advice sentences and button names (`price-advice.ts`), the invoice reads (`invoices.ts`: the catalog a read sends, the waiting drafts, a draft, and its photo), the invoice reading rules (`invoice-reading.ts`: the model's request and answer schema, the checks on its answer, the photo, text, and model address rules, and the read failure texts), the alert reads (`alerts.ts`: the open alerts and a day's digest), the alert sentences and the digest facts (`alert-text.ts`), the digest request and the checks on its answer (`digest.ts`), the Ask rules (`ask.ts`: the eight catalog queries, the question rule, the model's request and answer schema, the checks on its answer, and the Ask texts), the correction and reversal form rules (`correction-input.ts`: the cost, weight, and reason rules, the unchanged-figures rule, and the reversal's reason rule), the Ask answers (`ask-answers.ts`: each query's shared read and its fixed sentence), the app's today (`app-today.ts`), and the failure messages and request limit (`failures.ts`). `database.types.ts` is generated. | No cost, price, shrink, average, or margin math here. Nothing here imports from `src/app/`. Run `npm run gen:types` after a migration change. |
| `src/app/` | The Next.js 16 App Router app: `/sign-in`; `/receiving` with its form, before-and-after result, recent receipts, void, and Correct (a confirmation with the cost, weight, and reason fields, then the "Receipt corrected" panel with the receipt, stock, suggested price, and "Batches restated" tables); `/production` with its form, check step, batch result, recent batches, and Reverse (a confirmation that lists the raw lbs that go back, the finished lbs that leave stock, and the sales to be voided, then the "Batch reversed" panel); `/menu` with its "Sellable only" switch; `/pricing` with its list, one-press repricing, what-if, and per-product detail; `/sales` with its form, sale result, recent sales, and void; `/trace` with its sale lookup and sale trace, its raw lot finder, and its lot trace; `/invoices` with its two read forms (Read photo, Read text), Drafts to confirm, a draft's review (`?draft=<id>`) with Save receipts and Discard draft, the saved result, and the photo address `/invoices/photo/[draftId]` (a GET route handler that serves a draft's stored photo to an operator and answers 404 to anyone else); `/ask` with its question field, the product choices, Look it up again, and the answer; and `/alerts` with Today's digest, the Urgent and Other alerts lists, and each alert's reprice or link and Dismiss. All nine pages share the header with the Primary navigation (`page-header.tsx`), which also runs the watch and shows the urgent banner (the region named "Urgent alerts") or the watch failure line, the not-allowed view (`not-allowed.tsx`), and the error view (`page-error.tsx`). `/receiving`, `/production`, `/sales`, `/trace`, and the `/invoices` saved result share the label-and-value list (`facts.tsx`); `/receiving`, `/production`, `/sales`, and the `/invoices` saved result share the before-and-after table (`before-after.tsx`); `/receiving`, `/production`, and the `/invoices` saved result share the stock display rules (`stock-view.ts`, which also holds the price rules only `/receiving` uses). Server actions live beside each page; `/pricing` has `saveTargetMargin`, `removeTargetMargin`, and `saveListPrice`, `/receiving` has `saveReceipt`, `voidReceipt`, and `correctReceipt`, `/production` has `saveBatch` and `reverseBatch`, `/sales` has `saveSale` and `voidSale`, `/invoices` has `readPhoto`, `readText`, `saveDraft`, and `discardDraft`, `/ask` has `askQuestion` and `lookUpAnswer`, and `/alerts` has `applyAlertPrice`, `dismissAlert`, and `writeDigest`. `/trace` has no server action: it only reads, through its URL (`?sale=`, `?lot=`, or `?raw=&received=`). `_server/session.ts` builds the per-request Supabase client, `_server/caller.ts` settles the caller for `saveReceipt`, `voidReceipt`, `correctReceipt`, `saveBatch`, `reverseBatch`, the three pricing actions, `saveSale`, `voidSale`, the four invoice actions, the photo address, the two ask actions, and the three alert actions, `_server/watch.ts` runs the watch once for each request (`refresh_alerts` with the app's today, shared by the header and `/alerts`, never throwing), and `_server/model.ts` is the only code that calls the model service, through `readReceipt`, `writeDigest`, and the ask call `askModel` (see [AI connection](#ai-connection)). `saveReceipt`'s and `voidReceipt`'s decisions live in `receiving/save-receipt.ts`, wired to the real calls in `receiving/actions.ts`, which also runs the receipt form rules, the recheck product-list choice, and the product lookup inside its `readBefore` call; `correctReceipt`'s decisions live in `receiving/correct-receipt.ts` and `reverseBatch`'s in `production/reverse-batch.ts`, each with the caller check and every database call as an argument. `saveBatch`'s decisions live in `production/save-batch.ts`: its branches take every database call as an argument, so the Vitest suite can fail any one of them. The pricing actions' decisions live in `pricing/save-change.ts` the same way, with the caller check and the database call as arguments; `saveSale`'s and `voidSale`'s live in `sales/save-sale.ts`, wired to the real calls in `sales/actions.ts`; the invoice actions' decisions live in `invoices/read-invoice.ts` (with the model call as an argument too) and `invoices/save-draft.ts`; the alert actions' decisions live in `alerts/decide.ts`, with every database and model call as an argument; and the ask actions' decisions live in `ask/ask-question.ts` the same way, wired to the real calls in `ask/actions.ts`. `production/actions.ts` wires the real calls, and also runs the form rules and the product lookup inside its `readBefore` call. | Every stock, cost, price, shrink, and batch figure comes from the database and shows through `src/lib/format.ts`. The only exception is the production check step's repeat of the owner's own entries. `saveReceipt`, `voidReceipt`, `correctReceipt`, `saveBatch`, `reverseBatch`, the pricing actions, `saveSale`, `voidSale`, the invoice actions, the alert actions, the ask actions, and the photo address settle the caller through `_server/caller.ts` (`getClaims`, then `isOperator`) before anything else; `signIn` and `signOut` keep their own cookie-writing client. Import `src/lib/` without file extensions; Turbopack does not map `.js` to `.ts`. Keep the screens' look: a light surface, high contrast, tabular figures, no gradients or illustration (tokens in `globals.css`). On the floor screens, hard to mistype comes first, fast on a phone second, and numbers easy to trust third. Correct and Reverse sit only in Recent receipts and Recent batches, which list the 10 most recent per product, so an older receipt or batch can't be corrected or reversed from the app; the owner accepted that on 2026-10-14. On the first `/alerts` visit of a day the alert cards move down when the digest arrives, because no space is held for it; the owner accepted that on 2026-10-17. |
| `src/proxy.ts`, `src/privileged-env.ts`, `next.config.ts` | The Host check, session refresh, the signed-out redirect, the privileged-variable guard, the framing headers (`Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY` on every page, set in `next.config.ts`), and the 5 MB server-action body limit (`next.config.ts`). See the app trust boundary below. | Change with the security review that guards the app. |
| `test/` | The Vitest suites run against the local stack: `costing.test.ts` (golden numbers), `engine.test.ts`, `corrections.test.ts`, `access.test.ts`, `env.test.ts`, `network.test.ts`, the stack choice suites (`e2e-port`, `own-stack`, `stack-b`), the receiving suites (`operator-check`, `format`, `receipt-input`, `receiving-data`, `failures`, `save-receipt`), the production suites (`production-rules`, `production-data`, `save-batch`), the corrections suites (`receipt-corrections.test.ts` for `correct_receipt`, `batch-reversal.test.ts` for `reverse_batch`, `alerts-corrections.test.ts` for the alerts after a correction or a reversal, `correction-rules.test.ts`, `corrections-data.test.ts` for the reads, and `save-correction.test.ts` for the two actions' decisions), the pricing suites (`pricing.test.ts` for the golden pricing numbers, `pricing-rules.test.ts`, `pricing-data.test.ts`, and `save-change.test.ts`), the sales suites (`sales.test.ts` for the two sale views, `sales-rules.test.ts`, `sales-data.test.ts`, and `save-sale.test.ts`), and the invoice suites (`invoice-costing.test.ts` for the golden invoice save, `invoice-data.test.ts` for the import tables and functions, `invoice-reading.test.ts`, `read-invoice.test.ts`, `save-draft.test.ts`, and `invoices-data.test.ts`), and the alert suites (`price-history.test.ts` for the history trigger, `alerts-watch.test.ts` for the five rules and the lifecycle, `alerts-data.test.ts` for reprice, dismiss, and the digest claim, `alert-text.test.ts`, `digest-characters.test.ts` for the plain digest characters and number tokens, and `alert-actions.test.ts`; `alert-fixtures.ts` builds the five-alert fixture), and the ask suites (`ask-rules.test.ts`, `ask-answers.test.ts` for each answer over real fixtures, and `ask-actions.test.ts`). `fixtures/invoices/` holds the sample invoices and texts with `expected.json` for the live reading run, and `fixtures/questions/questions.json` holds the question set with each question's expected outcome for the live Ask run. `db.ts`, `users.ts`, `env.ts`, `network.ts`, and `global-setup.ts` are the harness. | Run `npm test`. A red costing test stops the work. |
| `test/e2e/` | The Playwright browser suite, run by `npm test` after Vitest: `receiving.spec.ts`, `correct.spec.ts` (Correct on `/receiving`), `production.spec.ts`, `reverse.spec.ts` (Reverse on `/production`), `menu.spec.ts`, `pricing.spec.ts`, `sales.spec.ts`, `trace.spec.ts`, `invoices.spec.ts`, `ask.spec.ts`, `alerts.spec.ts`, and `auth.spec.ts`, with page helpers beside them. The app runs under a fixed time zone (`app-time.ts`), so the suite knows the app's today. `fake-model.mjs` is the fake model service: Playwright starts it on `127.0.0.1` at the suite's port plus 1 and gives the app its address and a test key, so `npm test` never calls the real model. A setup project saves each role's session under the gitignored `.auth/`. `a11y.ts` checks each page state for axe violations, 320 px width, 44 px targets, and focus outlines. It scores each focus ring as drawn, with the control's opacity applied. A filter or blend mode on the control or any ancestor, or an ancestor with opacity under 1, fails as a ring that cannot be scored. Clipping and masks stay outside the check, a limit the owner accepted on 2026-10-20. `focus-ring.spec.ts` tests the scorer on fixture pages. `checks/` holds the scripts for the guard, loopback, and env-reload criteria. | Run it through `npm run test:e2e`, which sets the module loader Playwright needs on Node 22. Tests run one at a time because they share one database. |
| `tools/hooks/` | Hook scripts from the agent bundle: a session-start knowledge print, a pre-pull-request check, and a per-prompt work-loop reminder. | Change only when the workflow changes. |
| `docs/specs/` | One folder per feature, each with a spec and a plan. | Follow the spec; update it when the work changes the contract. |

## Access model

Four groups of tables sit in `public`.

- **Ledger tables:** `lots`, `inventory_balances`, `production_batches`, `production_batch_lots`, `finished_goods`, `sales`, `sale_items`, `lot_adjustments`, `receipt_corrections`.
- **Master-data tables:** `vendors`, `customers`, `products`, `fee_types`, `product_fees`.
- **Import tables:** `import_drafts` and `import_draft_lines`, the invoice drafts that wait for the owner's Save receipts or Discard draft.
- **Alert tables:** `alerts`, the open and closed alerts, and `alert_digests`, one row for each day's digest claim.

Every `public` table has row level security on. The five views
(`v_product_pricing`, `v_current_menu`, `v_sale_traceability`, `v_sale_summary`, `v_alerts`)
run as the caller, so they obey the same rules. `CREATE OR REPLACE VIEW` clears a view's
`security_invoker` setting, so a migration that replaces a view must set it
again.

The operator allowlist is the table `private.operators`. It holds one row per
allowed user id. The `private` schema is not exposed through the Data API, so
no Data API client can read or change the list. The list-price history, `private.list_price_changes`, sits beside it with no grant to `anon`, `authenticated`, or `service_role`, so only the database reads it. Postgres itself answers only
this Mac under the firewall block, apart from the loopback path noted in
[Keep the local stack on this Mac](#keep-the-local-stack-on-this-mac).

| Role | Reads | Writes | Operations |
| --- | --- | --- | --- |
| `anon` (public key, no login) | Nothing. Tables and views are absent from the GraphQL schema and refused over REST. | Nothing. | Refused, `check_operator`, `set_target_margin`, `set_list_price`, `price_what_if`, the three import-draft functions, and the five alert functions included. |
| Non-operator (signed in, not on the allowlist) | 0 rows from every table and view. | Nothing. | Each call fails with SQLSTATE `42501` and writes no rows. `check_operator`, `set_target_margin`, `set_list_price`, `price_what_if`, the three import-draft functions, and the five alert functions fail the same way. |
| Operator (signed in, on the allowlist) | Every table and view. | Insert and update on master-data tables. No delete. No direct ledger, import-table, or alert-table write. | All eight, `set_target_margin`, `set_list_price`, `price_what_if`, `check_operator`, `create_import_draft`, `confirm_import_draft`, `discard_import_draft`, `refresh_alerts`, `dismiss_alert`, `apply_alert_price`, `start_digest`, and `finish_digest`. |
| `service_role` (admin key) | Every table and view in `public`, the alert tables and `v_alerts` included, but not `private`. | Insert and update on master-data tables. No delete. No direct ledger, import-table, or alert-table write. | None. It holds no EXECUTE on any `public` function, `check_operator`, the three pricing functions, the three import-draft functions, and the five alert functions included, though it still reads both pricing views and the import tables. |
| `postgres` (direct database session) | Everything. | Everything, including the seed script. | Allowed. A session with no JWT claims passes the caller check only for `postgres` and `supabase_admin`. |

`public.check_operator()` is not an operation and writes nothing. It returns
nothing for an operator and raises SQLSTATE `42501` for any other caller, so the
app can tell a signed-in user who is not on the allowlist from an operator whose
catalog is empty. It runs as the caller, asks `private.is_operator()` and nothing
else, and only `authenticated` can execute it. A `postgres` session has no JWT
user, so it gets the same `42501`. The app asks this function rather than
probing an operation with a call meant to fail, because a probe would tie the
not-allowed page to the order of the engine's checks.

`set_target_margin` and `set_list_price` change one column of `products` each (the target margin and the list price). They run as `SECURITY DEFINER`, settle the caller with `private.assert_caller`, and only an operator may run them. `price_what_if` writes nothing. It runs as `SECURITY INVOKER` under the tables' RLS and checks the operator itself, so a non-operator gets `42501`. `anon` and `service_role` execute none of the three.

The import tables change only through `create_import_draft`, `confirm_import_draft`, and `discard_import_draft`. Each runs as `SECURITY DEFINER`, sets an empty `search_path`, settles the caller with `private.assert_caller` first, and only `authenticated` holds EXECUTE on it, so only an operator gets past the check. No role holds insert, update, or delete on either table, and each has one `operators_select` policy. `create_import_draft` stores a waiting draft and its lines; `discard_import_draft` settles a waiting draft and clears its photo, its typed text, and every line's words; `confirm_import_draft` is in the write path below. Table checks keep a saved line tied to its lot and a settled draft to its settle time, for every role.

The alert tables change only through five functions. Each runs as `SECURITY DEFINER`, sets an empty `search_path`, settles the caller with `private.assert_caller` first, and only `authenticated` holds EXECUTE on it. No role holds insert, update, or delete on `alerts` or `alert_digests`, and each has one `operators_select` policy, so a non-operator reads 0 rows from both and from `v_alerts`. `refresh_alerts(p_today)` is the watch: it opens, updates, and ends alerts and returns the open and urgent counts. `dismiss_alert` and `apply_alert_price` close one alert, and `start_digest` and `finish_digest` claim and settle a day's digest. Three private objects back them: `private.digest_paragraphs_ok`, which the digest table's check calls, `private.record_list_price_change`, the history trigger's function, and `private.baseline_list_prices`, which the migration runs once. None of the three grants anything to an API role.

`receipt_corrections` is a ledger table. It keeps one row for each `correct_receipt` call: the lot, the old and new cost and weight, the reason, the time, and `correction_seq`, an identity number that orders corrections (the latest has the highest). No role holds insert, update, or delete on it, and it has one `operators_select` policy, so a non-operator reads 0 rows and `anon` is refused a read. `anon`, `authenticated`, and `service_role` hold no privilege on its identity sequence. `correct_receipt(p_lot_id, p_unit_cost, p_weight_lbs, p_reason)` and `reverse_batch(p_batch_id, p_reason)` run as `SECURITY DEFINER`, set an empty `search_path`, settle the caller with `private.assert_caller` first, and only `authenticated` holds EXECUTE on each, so `anon`, `service_role`, and a non-operator get no write. The replaced functions (`private.refresh_balance`, `produce_batch`, `void_receipt`, `adjust_lot`, `refresh_alerts`, and the view `v_sale_traceability`, which keeps `security_invoker=true`) keep the security mode, `search_path`, and grants they had.

The `service_role` master-data exception exists so admin tooling can load and
fix catalog data. It never deletes, and it never writes to a ledger table.

## Write path

The ledger changes only through eight functions, `receive_lot`, `produce_batch`,
`record_sale`, `void_receipt`, `void_sale`, `adjust_lot`, `correct_receipt`, and
`reverse_batch`. They run as
`SECURITY DEFINER`, so signed-in users need no write grant on any ledger table.
Running them as the caller instead would require ledger write policies, and those
would let the owner's session change ledger rows directly, outside the
operations. Each one:

1. Checks the caller first. A JWT must carry the `authenticated` role, and `private.is_operator()` must find its `sub` on `private.operators`. The table policies use the same function.
2. Validates its arguments and raises an error instead of writing a wrong row. This comes before any lock, except that a void or adjustment first looks up the lot or sale it names, to learn which row to lock. Checks that depend on stock or lot state, such as a shortfall or the adjustment cap, come after the lock.
3. Takes one row lock before it reads stock. `receive_lot`, `produce_batch`, `void_receipt`, `adjust_lot`, `correct_receipt`, and `reverse_batch` lock the raw product's `inventory_balances` row. `record_sale` and `void_sale` lock the finished product's `products` row (`FOR NO KEY UPDATE`, so the foreign-key checks in `produce_batch` do not wait on it). Calls that share a lock take turns. `produce_batch` and `record_sale` on one finished product share no lock and do not queue on each other; `record_sale` reads only finished lots that already exist, and each lot it draws from is row-locked. After the balance row, `correct_receipt` locks the lot and then the finished products made from it (`FOR NO KEY UPDATE`, in id order), and `reverse_batch` locks the finished product, the batch, and then the sales made from it, in id order, so a correction or a reversal queues behind `record_sale` and `void_sale` on the same product.
4. Writes the rows. `produce_batch` and `record_sale` then check that the pounds they recorded equal the pounds asked for, and raise a shortfall if not.

`receive_lot`, `produce_batch`, `void_receipt`, `adjust_lot`, `correct_receipt`, and `reverse_batch` then rebuild the
raw product's stock and stock-on-hand average from its lots (`private.refresh_balance`). At 0 lbs on hand the refresh
sets the zero-stock average that `docs/costing.md` gives instead.
`record_sale` and `void_sale` move only finished-lot pounds and do not call it.

A trigger on `lots` refuses any change to a lot's recorded cost and weight, product, vendor,
received date, lot number, or prior average, for every role. A lot also holds its current cost and weight (`current_unit_cost` and `current_weight_lbs`, which equal the recorded ones until a correction). The operations
change only a lot's remaining lbs, its void marks, and, for `correct_receipt`, the two corrected columns.

The app changes the ledger only through `receive_lot`, `void_receipt`,
`correct_receipt`, `produce_batch`, `reverse_batch`, `record_sale`, and `void_sale`, called from server actions with
the signed-in user's session.
It changes master data only through `set_target_margin` and `set_list_price`,
which set a finished product's target margin and list price and nothing else.
It changes alerts and digests only through `refresh_alerts`, `dismiss_alert`,
`apply_alert_price`, `start_digest`, and `finish_digest`.

`apply_alert_price` locks the alert, refuses one that is not an open margin or
price alert, and sets the list price by calling `set_list_price`, so a reprice
from an alert is the same write as one from `/pricing`. Only the owner's press of
a reprice button calls it. `dismiss_alert` and `apply_alert_price` take the
watch's advisory lock after their caller check, so a watch never ends an alert
the owner is acting on. The watch itself writes during page renders: it is
idempotent, and a second watch waits for the first.

A trigger on `products` (`private.record_list_price_change`) records every change
of a list price in `private.list_price_changes`, with the old and new price and the
product's cost per lb at that moment, whoever makes it: the app, Studio, or the
admin key. `set_list_price` itself is unchanged.

A confirmed invoice draft saves through `confirm_import_draft`. It locks the
draft row, refuses a draft that is not waiting, and calls `receive_lot` once per
ticked line in (product id, line number) order, all inside one transaction, so
either every ticked line becomes a lot or none does, and a second save of the
same draft waits on the lock and is refused. The ledger still changes only
through `receive_lot`. A refusal names its line (`line N: ...`). Only the
owner's press of Save receipts calls it; the model's answer fills draft fields
and nothing else.

## App trust boundary

- **Variables.** The app process holds `SUPABASE_URL` and `SUPABASE_ANON_KEY`, so row-level security applies to every call. It may also hold `ANTHROPIC_API_KEY`, the optional key for invoice reading, the daily digest, and Ask, and, in the test suites only, `ANTHROPIC_BASE_URL`. Only `src/app/_server/model.ts` reads either, when a read runs, and neither has a `NEXT_PUBLIC_` name. The model address is `https://api.anthropic.com` when `ANTHROPIC_BASE_URL` is unset or empty, and otherwise only `http://127.0.0.1:<port>` or `http://localhost:<port>` with an optional trailing `/`; any other value turns reading, the digest, and Ask off with a message that names the variable, and no request is sent. A privileged variable is one whose name contains `SERVICE_ROLE`, `SECRET`, `JWT`, `DB_URL`, `DATABASE_URL`, or `POSTGRES`. `next.config.ts` refuses to build, start, or run when one is set, printing names only. `src/proxy.ts` answers 500 on every request if one appears later, because `next dev` reloads env files.
- **Framing.** Every page response carries `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`, set for all paths in `next.config.ts`, so no page loads inside another page's frame. The proxy's redirect for a signed-out request carries them too.
- **Cookies.** The Supabase auth cookies are `HttpOnly` and `SameSite=Lax`, set from one constant in `src/app/_server/session.ts`. There is no browser client. They carry no `Secure` flag on plain-http localhost; the [app HTTPS hosting intent](../product/intents/app-https-hosting.md) owns that.
- **Sessions.** A session ends after 12 hours without activity or 168 hours after sign-in. Sign-out ends this device's session on the auth server. An access token already issued stays valid at the database for up to 3600 seconds, an accepted residual.
- **Network.** `npm run dev` and `npm run start` listen on `127.0.0.1` only, and `next.config.ts` widens no server-action or dev origin. It raises the server-action body limit from 1 MB to 5 MB, for every action, so a 4 MB invoice photo fits; only this machine can send one. The app's only outbound calls are an invoice read's single request, a digest's single request, and an Ask press's single request to the model address. The auth server's limit of 30 sign-ins per 5 minutes is charged to the app's address, accepted while only this machine reaches sign-in, which the firewall block in [Keep the local stack on this Mac](#keep-the-local-stack-on-this-mac) provides.
- **Host check.** `src/proxy.ts` runs on every path and answers 421 to a request whose `Host` is missing or names anything other than `127.0.0.1` or `localhost`, so a web page that rebinds its DNS name to this machine cannot drive sign-in. Node itself answers 400 to an HTTP/1.1 request with no `Host`. Under `npm run dev`, Next.js answers its own dev-tool addresses before the proxy runs; the owner accepted that exposure, and `npm run start` is the command for daily use.
- **Failures.** Every server-side Supabase client, the proxy's included, gives up on a request whose response headers have not arrived 10 seconds after sending it, and postgrest-js does not resend an aborted request. postgrest-js does resend a read up to three times after a refused connection or a 503 or 520 answer, each time with a new 10 seconds. auth-js retries a failed token refresh for up to about 30 seconds, and the proxy and the page or action each run that retry, so with the auth server unreachable and the access token within 90 seconds of expiry, a page load, a Save, or a Sign out can wait about a minute. A Sign out that the auth server does not confirm still removes this browser's auth cookies. A page render that fails right after a save whose totals loaded can still show the error page in place of "Receipt saved"; the receipt is saved, and the owner accepted that narrow window. A sale can be voided too, so the same window is accepted for a sale, and the sales error page has no extra line; a sale save whose write call got no answer sends the owner to Recent sales, where a duplicate can be voided. The production error page says a batch may have been saved and to check Recent batches before saving it again; a saved batch can be reversed, which voids its sales, and a reversal is not undone. A correction or reversal that fails before its write call says the receipt wasn't corrected or the batch wasn't reversed; a write call with no answer says it may not have been, and to reload the page to see whether it was. A failure of the reads after the write says the new figures couldn't be loaded and to reload. Each message holds keyboard focus. A save or void that fails before its write call says the receipt, batch, or sale wasn't saved or the receipt or sale wasn't voided; a write call with no answer says it may not have been. The caller check tells an ended session from an auth lookup that got no answer. A failed sign-in other than bad credentials logs only the auth error's code and status.
- **Apart from the Host check, the proxy authorizes nothing.** It refreshes the session and sends a signed-out page load to `/sign-in`. On a POST it leaves an ended session's cookies alone, so the server action answers "signed out" with the form intact. Every page and every server action settles the caller itself.

### Insertion order and the hosted check

Lots and finished lots carry an insertion number, `receipt_seq` and
`produced_seq`. First-in first-out orders by date, then by that number. The
engine migration numbers rows that already exist by the old keys (lots by
received date, `created_at`, id; finished lots by produced date, id) before
identity takes over, and the sequence continues above the highest number given.

Production batches and lot adjustments share a third number, `stock_seq`, from
the sequence `private.stock_change_seq`. It orders the changes that lower a raw
product's stock, and the zero-stock average in `docs/costing.md` reads the
highest. Each operation takes it on insert while it holds the product's
`inventory_balances` row, so it follows the order the operations ran, inside one
transaction too. The zero-stock-average migration numbers rows that already
exist by the time they were made (`production_batches.created_at`,
`lot_adjustments.adjusted_at`). At equal times, which only one transaction
gives, a batch comes before an adjustment, then batches follow their finished
lot's `produced_seq` and adjustments their id. The sequence continues above the
highest number given.

After the migrations reach a database that already holds lots (the hosted
follow-on), run this read-only query. It must return no rows. Each row it
returns is a pair of same-day lots of one product whose insertion numbers
disagree with their `created_at` order:

```sql
select a.product_id, a.received_date, a.id as lower_number, b.id as higher_number
from public.lots a
join public.lots b
  on b.product_id = a.product_id
 and b.received_date = a.received_date
 and b.receipt_seq > a.receipt_seq
 and b.created_at < a.created_at;
```

Finished lots have no timestamp, and their old order broke ties by id, so the
query covers lots only.

## AI connection

Invoice reading on `/invoices` is the first feature that calls a model, the daily
digest on `/alerts` is the second, and Ask your data on `/ask` is the third. Each later AI feature lists, in its
own spec, the fields it sends.

- **Model.** Claude Opus 5.5 (`claude-opus-5-5`) through the official `@anthropic-ai/sdk`, pinned to an exact release. One read sends one request with effort `medium`, at most 16,000 output tokens, and an answer schema (structured output). It waits at most 120 seconds for the answer to start (the SDK's timer covers the response headers) and never retries.
- **Key.** `ANTHROPIC_API_KEY`, a key made for Meat Ops with a monthly spend limit. The app takes it from its own process, or from the gitignored `.env` when the process has none: Next.js fills a name from `.env` only when the process has no value, so a process value wins, an empty one included. Without a key, a read says invoice reading isn't set up, an Ask press says Ask isn't set up, and neither sends anything. The key goes only in the `x-api-key` header, and is never written to the database, a log, or a response. Every `.env` file Next.js reads is gitignored. No tool scans commits for a key that got in anyway; the owner accepted that gap.
- **Client settings.** `model.ts` passes every client setting itself (key, address, no auth token, no webhook key, logging off, the timeout, no retries), so the SDK takes nothing from the environment or a saved login profile. Its `fetch` sends only the `accept`, `anthropic-version`, `content-type`, and `x-api-key` headers, with values `model.ts` sets itself (the key it resolved for the read, `application/json`, `2023-06-01`, `application/json`), so nothing in `ANTHROPIC_CUSTOM_HEADERS` reaches the request and the SDK's operating-system, architecture, and runtime-version headers are dropped.
- **What a read sends.** The fixed instructions, in `system`. In the one user message: the photo as the server action received it, or the typed text as written; the device's date; the active raw products' codes and descriptions; and the vendors' names. The answer schema lists the same codes and names as its allowed values. Nothing else from the database, the session, or this machine is sent.
- **Daily digest.** `writeDigest` in `model.ts` builds its client the same way and sends one request: effort `low`, at most 16,000 output tokens, and the digest answer schema (`paragraphs`, an array of strings). It waits at most 60 seconds for the whole answer, by an abort signal as well as the SDK timeout, and never retries. The fixed instructions go in `system`; the one user message is the digest facts, which are the open alerts' own titles, sentences, and next steps (product codes and descriptions, vendor names, lot and batch numbers, and figures) and nothing else from the database, the session, or this machine. The model never decides what is an alert and never computes a figure. Its answer is stored and shown only when it passes the checks in `SYSTEM-SPEC.md` §7 "Watch (alerts)" and the paragraph limits of AC-0091 in the alerts spec; otherwise the page says the digest wasn't written and offers Try again. Digest text shows as literal text. The page sends the request on its own once a day at most: `start_digest` claims the day's row, and after any failure only the owner's Try again press sends another.
- **Ask your data.** `askModel` in `model.ts` builds its client the same way. One press of Ask sends one request: effort `low`, at most 16,000 output tokens, and the ask answer schema (`query`, `product_code`, `candidates`, `number`). It waits at most 60 seconds for the whole answer, by an abort signal as well as the SDK timeout, and never retries. The fixed instructions go in `system`; the one user message is the question as typed (each CR LF or lone CR sent as LF) and the active raw and finished products' codes and descriptions; the schema lists the eight query ids and the same codes as its allowed values. Nothing else from the database, the session, or this machine is sent. The catalog's eight queries, by id: `raw_stock`, `finished_stock`, `product_margin`, `pricing_attention`, `sellable_now`, `recent_receipts`, `sale_lots`, and `lot_sales` (`src/lib/ask.ts`). The model only chooses a query and its product or number; Meat Ops answers with a fixed sentence from the read another page already uses, and shows a number the model copied only when the question holds it exactly, as literal text. A product button or Look it up again sends no request. Nothing is stored: no question or answer goes to the database, a file, a log line, a cookie, or browser storage, so a reload clears the answer. The API documents no limit on how many product codes an answer schema may list. The live run on 2026-10-18 checked 305 active products; a larger catalog is untested. If the API refuses the schema, Ask shows "The question wasn't answered. Try again in a moment." The owner accepted that gap.
- **No tools.** The model gets no tools and no beta feature. Its answer can only fill draft fields: every value is checked against Receiving's own weight, cost, and date rules and the catalog before it fills one, a value the model marks unsure stays blank, and invoice text shows as literal text. No cost is computed anywhere, by the model or the app. The ledger changes only when the owner presses Save receipts.
- **Retention.** Anthropic's terms govern what it keeps of a request: [data input controls and audit](https://www.anthropic.com/uk-government-internal-ai-safety-policy-response/data-input-controls-and-audit).

## Local stack notes

- On the local stack, the `authenticated` role has an 8-second statement
  timeout, shorter than the app's 10-second request limit. A call held up inside
  the database ends with a coded refusal (SQLSTATE `57014`), not with no answer.
  To show a write call that gets no answer, put a throwaway forwarder between
  the app and the REST service and hold the call there.
- If the Vitest suites slow down run after run, check
  `pg_replication_slots.catalog_xmin` and the dead rows in `pg_class`. A Realtime
  slot that holds the catalog horizon back keeps vacuum from clearing the rows
  test truncates leave. With the owner's approval, end the slot's backend as
  `supabase_admin` (Realtime makes a new slot at once), then run
  `vacuum pg_class`.

## Keep the local stack on this Mac

The Supabase CLI publishes the local stack's ports on every network interface,
IPv4 and IPv6: 54321 (API and auth), 54322 (Postgres, with the well-known local
password), 54323 (Studio, with no login), 54324 (mail), and 54327 (analytics).
Stack B, the second test stack in `AGENTS.md`, publishes 55321 (API and auth)
and 55322 (Postgres).
Neither the CLI nor Docker Desktop has a setting that limits them. So the macOS
firewall blocks incoming connections to Docker's port forwarder,
`com.docker.backend`. Connections from this Mac to `127.0.0.1` or `localhost`
are not filtered, so the app, the tests, and Studio in this Mac's browser keep
working.

Set it up once, in your own Terminal. The first `sudo` asks for the Mac's
password.

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add /Applications/Docker.app/Contents/MacOS/com.docker.backend
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --blockapp /Applications/Docker.app/Contents/MacOS/com.docker.backend
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setallowsignedapp off
```

- The block covers every port Docker publishes on this Mac, other projects' containers included.
- Only another device can prove the block works. With the block on, this Mac still reaches the stack at its own Wi-Fi address, so a test from this Mac proves nothing.
- The last command makes the Mac ask before any downloaded app accepts outside connections. If it asks about Docker, after an update for example, answer **Deny**. Loopback, the app, and the tests keep working.
- `npm test` and `npm run test:e2e` check the block before any test runs. Each refusal says what is wrong:
  - **The firewall is off:** run the first setup command.
  - **Other devices can reach a program** (the message names it and the port): run `--add` and `--blockapp` with the path it names. A Docker update that drops the block entry shows up this way, because the firewall reports a program missing from its list as permitted.
  - **Automatic allow is on:** run the last setup command.
  - **Not a Mac:** the check knows only the macOS firewall.
  - **No published port, or no program serving one:** start the stack with `supabase start`, or let a restart finish.
  - **Could not read something:** a tool failed, timed out, or printed new wording, often after a macOS or Docker update. The commands and their exact expected output are in `test/network.ts`; run the one the message names by hand and compare. If only the wording changed, update `test/network.ts` and `test/network.test.ts`. That test file runs behind the same check, so while the check refuses, run only that file, with a config outside the repository that has no global setup:

    ```bash
    printf 'export default { test: { include: ["test/network.test.ts"] } };\n' > "${TMPDIR:-/tmp}/network-only.vitest.config.mjs"
    npx vitest run --root . --config "${TMPDIR:-/tmp}/network-only.vitest.config.mjs"
    ```

    It reaches no stack. Never run another suite without the check.
- The check runs only when tests run, so a firewall turned off between test runs is caught at the next run. The owner accepted that gap.
- The block leaves loopback open by design, so a web page open in this Mac's browser could still reach Studio and the API, stack B's included, through `127.0.0.1`. That path stays open until [its follow-on intent](../product/intents/local-stack-loopback-web-pages.md) closes.

To undo the block:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp /Applications/Docker.app/Contents/MacOS/com.docker.backend
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setallowsignedapp on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

## Create the owner account

Public sign-up is off, so the owner account is made by hand. Until step 3, the
owner is locked out, which is the safe state.

1. In Supabase Studio, open Authentication, then Users, and add a user with the owner's email and a password of at least 12 characters.
2. Confirm the account is new. Run `select id, created_at, last_sign_in_at from auth.users where email = '<owner email>';` and `select count(*) from auth.sessions where user_id = '<id>';`. The user was created minutes ago, `last_sign_in_at` is empty, and the session count is 0. Stop if either differs, because the account is not the one you just made.
3. Insert the id: `insert into private.operators(user_id) values ('<id>');`

Run the steps against the local stack first. A hosted project needs the owner's
approval before anything writes to it.
