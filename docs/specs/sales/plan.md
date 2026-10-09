# Plan: sales

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:**
  - **Area rules and access model:** `docs/architecture/overview.md`.
  - **Analogous implementations:** the production page, `src/app/production/` (`page.tsx`, `actions.ts`, `save-batch.ts`, `recent-batches.tsx`, `error.tsx`), over `src/lib/production.ts`, `src/lib/batch-input.ts`, `src/lib/failures.ts`, and `src/lib/format.ts`; the receipt void, `src/app/receiving/void-dialog.tsx` and `voidReceipt` in `src/app/receiving/actions.ts`; the pricing page's URL-driven views (`?product=`, `?raw=&cost=`) in `src/app/pricing/page.tsx` and `what-if-form.tsx`; for a replaced view, `supabase/migrations/20261009070619_menu_pricing.sql`.
  - **Their tests:** `test/production-rules.test.ts`, `test/production-data.test.ts`, `test/save-batch.test.ts`, `test/corrections.test.ts` (the trace view), `test/access.test.ts`, and the browser suites `test/e2e/production.spec.ts`, `test/e2e/receiving.spec.ts` (void), and `test/e2e/pricing.spec.ts` (URL-driven views, literal text), with their page helpers, `test/e2e/a11y.ts`, and `test/e2e/states.ts`. Fixtures come from `test/db.ts` (`resetTestData`, `callAsClient`, `callAsOperator`, `OpCall`, `tableFingerprints`, `assertLedgerInvariants`) and `test/users.ts`.
  - **Named deviations:** the sale void dialog is a sales copy of the receipt dialog's pattern rather than a shared component, because sharing it changes the receiving page (an Ask-first change) and `docs/product/intents/shared-display-parts.md` owns moving shared parts. `/trace` has no server action, like `/menu`: it reads only, through URL parameters, as the pricing what-if does.
  - **Read-only probes on the local stack, 2026-10-09:** `record_sale`'s shortfall text is `record_sale: shortfall, only <n> lbs finished available on or before <date>, need <n>`; the seed holds one customer and one sale; the `authenticator` role's settings hold no `pgrst.db_aggregates_enabled`, so PostgREST aggregates are off.
  - **Disconfirming probes, 2026-10-09,** each in a rolled-back transaction: `CREATE OR REPLACE VIEW public.v_sale_traceability with (security_invoker = true)` appending all six columns (`sale_id`, `sale_created_at`, `customer_id`, `raw_code`, `produced_seq`, `receipt_seq`) succeeded, and `reloptions` read `{security_invoker=true}` on both views. Over the spec's sale fixture, batch 1 and batch 2 made 4,620.000 and 770.000 finished lbs; a 5,000-lb sale dated 2026-10-06 was refused with `record_sale: shortfall, only 4620.000 lbs finished available on or before 2026-10-06, need 5000`; the 5,000-lb sale gave one `v_sale_summary` row with `lbs_sold` 5000.000 and `price_per_lb` 3.2900; and its trace rows in draw order were batch 1 over lot A (5,000.000 lbs drawn) and lot B (1,000.000), then batch 2 over lot B, with 4,620.000 and 380.000 lbs sold. Nothing was kept.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/sales/notes/verification-ledger.md`. A genuine artifact error
> follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material.

## Approach

The work lands as three dependency-ordered layers on `feat/sales`, then a
closing task. Each layer is its own commits and leaves `npm test` green.

1. **Database (T1).** One migration adds `v_sale_summary` and appends six columns to `v_sale_traceability`. The view tests go in `test/sales.test.ts` first. `SYSTEM-SPEC.md` §4 and the `docs/costing.md` sentence on where the math lives change with it.
2. **Sales (T2 to T5).** Pure rules and messages, then the reads, then the save and void decisions, then `/sales` with the two new navigation links.
3. **Trace (T6).** `/trace` with its sale lookup, its lot finder, and the two trace views.
4. **Closing (T7).** The docs, the goal-based checks, the recorded run, and the rendered-page inspection.

The estimate is about 4,000 reviewable lines, so the shape is MIXED: the
layers are the decomposition. One review unit at the end reviews the layers in
order, each named by its commit range, so a database finding is read before the
pages built on it.

The riskiest part is the trace view's replacement: dropping `security_invoker`
would open every sale to a non-operator, and moving an existing column would
break `test/costing.test.ts` and `test/corrections.test.ts`. AC-0013, AC-0016,
and those suites catch both.

## Constraints

- `SYSTEM-SPEC.md` §2 and §11: the app computes no stock, total, cost, or price, and changes the ledger only through operations: here `record_sale` and `void_sale`.
- `AGENTS.md` hard rules 2, 3, 4, 6, and 7.
- The access model, write path, and app trust boundary in `docs/architecture/overview.md`: every server action settles the caller through `src/app/_server/caller.ts`; every server-side client uses the 10-second request limit in `src/app/_server/session.ts`; the new view revokes its default privileges and grants SELECT to `authenticated` and `service_role` only.
- No ADR or RFC governs this area.

## Construction tests

**Integration tests:** none beyond per-task tests. `test/global-setup.ts` and the per-test `assertLedgerInvariants` hook keep the costing invariants checked after every Vitest test that touches the database; `test/costing.test.ts` invariant 7 and `test/corrections.test.ts` keep reading the trace view by its existing columns.

**Manual verification:** the T7 recorded run.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Costing truth and display formats, `docs/costing.md` | T1 (the sentence on where the math lives), T7 (the Rounding note's price row and "No customer", the browser suites' names) | AC-0010 in `test/sales.test.ts`; AC-0025 and AC-0072 in the browser suite | close-work finds each statement and the "No customer" text in a passing test |
| Master brief, `SYSTEM-SPEC.md` §4 | T1 | The edited view entries | close-work finds both entries matching the migration |
| Current architecture and app trust boundary, `docs/architecture/overview.md` | T7 | The edited rows and sentences named in the spec's Durable Outputs row | close-work reads each named row against `src/`, `supabase/`, and `test/` |
| Interface compatibility, `src/lib/database.types.ts` | T1 (regenerated), T7 (AC-0172) | AC-0172 output in the ledger | `npm run gen:types` leaves no diff |

Every design fact below shows in code and tests or is delivery residue, except
three that belong in durable owners: what `v_sale_summary` gives and why it
exists (`SYSTEM-SPEC.md` §4, T1), the two ledger operations the app now calls
(`docs/architecture/overview.md` write path, T7), and the accepted window where
a sale page render fails after a save (`docs/architecture/overview.md`
failure notes, T7).

## Design (LLD)

### Design decisions

- **A view sums a sale, so the app never adds.** `v_sale_summary` gives one row per sale, void or not: `sale_id`, `sale_number`, `sale_date`, `created_at`, `customer_id`, `customer`, `finished_product_id`, `finished_code`, `finished_product`, `lbs_sold` (sum of the lines), `price_per_lb` (`min` of the lines' price; `record_sale` writes one price on every line), `voided_at`, and `void_reason`. It inner-joins the lines, so a sale with no line, which `record_sale` cannot write, has no row. The recent sales list, a trace's heading facts, and the "Sale saved" panel all read it. Traces to: AC-0010, AC-0011, and AC-0012, AC-0040, AC-0070, AC-0071, AC-0072, AC-0073, and AC-0074, AC-0095, AC-0102.
- **The trace view gains the keys the pages need, appended.** `v_sale_traceability` keeps its 16 columns in name, type, and order, and appends `sale_id`, `sale_created_at`, `customer_id`, `raw_code`, `produced_seq`, and `receipt_seq`, because `CREATE OR REPLACE VIEW` allows only appending and three suites read the old columns. Both views are created `with (security_invoker = true)`. The forward trace orders by `production_date, produced_seq, received_date, receipt_seq`; a lot's sales show in the order `sale_date desc, sale_created_at desc, production_date, produced_seq, sale_item_id`, applied to the complete set that the decision "A lot's trace reads every one of its trace rows, or none" builds. The void filter stays, so a void sale has no trace rows and its trace page reads the summary view for its heading. Traces to: AC-0013, AC-0016, AC-0017, AC-0096, AC-0097, AC-0098, AC-0099, and AC-0100, AC-0122, AC-0123, AC-0124, AC-0125, and AC-0126.
- **The price field fills from the page's product list.** The page reads the menu view (`product_id`, `code`, `description`, `list_price_per_lb`, `finished_lbs_available`) once per render. The client form sets the price field to `priceFieldText(list_price_per_lb)` (the existing 2-decimal text the pricing detail uses) or to empty whenever the code field comes to name a different product of that list, and leaves it alone otherwise. A typed code not in the list leaves the price field as it is. Traces to: AC-0020, AC-0021, AC-0022, AC-0023, and AC-0024, AC-0033.
- **Save settles a code missing from the page's list the way production does.** When Save sale is pressed with a code the page's list lacks, the form re-requests `/sales?product=<code>` and, once that render returns, runs the form rules over the fresh active list (`awaiting` in `src/app/production/production-form.tsx`). An inactive or unknown code is then refused beside its field, and an active product added after the page loaded saves without a reload. The fresh render fills nothing: the price field changes only when the owner edits the code field, so a typed price survives. Traces to: AC-0029, AC-0033.
- **The save action checks the code against every finished product,** active or not, as `saveBatch` does, so a product made inactive after the page loaded reaches `record_sale` and is refused there with its own reason. It checks the customer id against the customer list it reads before the write. Traces to: AC-0029, AC-0030, AC-0033, AC-0051.
- **Before and after are two reads of the menu view's `finished_lbs_available`,** one before `record_sale` and one after it. The menu view keeps only active products, so a product made inactive since the page loaded has no row: the read before returns null rather than failing, the write still runs, and the engine's refusal is what the owner sees. Traces to: AC-0044, AC-0051.
- **The result's finished lots come from the trace view,** read by `sale_id` in draw order and grouped by `sale_item_id` in first-seen order. The same read builds a sale's trace. Grouping is not arithmetic: each line's `lbs_sold` is shown as the database gave it. Traces to: AC-0041, AC-0042, and AC-0043, AC-0096, AC-0097, AC-0098, and AC-0099.
- **A lot's trace reads every one of its trace rows, or none.** PostgREST stops a read at `max_rows` rows (`supabase/config.toml`) without an error. So `getLotTrace` reads the lot's rows in `.range()` pages ordered by the unique `sale_item_id`, with an exact count on every page, starting each page at the number of rows already received. Every page carries the same filters, so an unchanged lot reports the same count on every page. It keeps the set only when every page reported that same count and it holds exactly that many distinct lines. Otherwise it repeats the whole read once: a repeat that meets both rules returns its set, and a repeat that fails either throws, so the page shows its error view rather than a partial list. A void or a new sale in another tab between two pages changes the count, which is the case this guards. It then orders the complete set for the screen as the trace-view decision says, and both the sales list and the customers come from it. The paging loop takes the page read as an argument, so a unit test can make the count change. Traces to: AC-0135.
- **A lot's customers are the distinct `customer_id`s among its trace rows,** sorted by name with `localeCompare(…, "en", { sensitivity: "base" })` as `listVendors` does, with "No customer" last when any row has none. Traces to: AC-0122.
- **A lot's finished stock is two reads:** the batch ids from `production_batch_lots` for the lot, then the `finished_goods` of those batches with `lbs_remaining > 0`, ordered `produced_date, produced_seq`, with the batch number and product code and description. Traces to: AC-0128, AC-0129, AC-0130, and AC-0131.
- **The lot finder reads `lots` of the raw product** with `voided_at is null`: with no date, ordered `received_date desc, receipt_seq desc`, limit 10, with an exact count; with a date, `received_date = <date>` ordered `receipt_seq desc`. The raw product is found by code among every raw product, active or not. Traces to: AC-0110, AC-0111, AC-0112, AC-0113, AC-0114, AC-0115, AC-0116, AC-0117, and AC-0118.
- **`/trace` is URL-driven:** `/trace?sale=<number>`, `/trace?raw=<code>&received=<date>`, and `/trace?lot=<number>`. The two find forms run their rules in the browser and push the URL, as the what-if form does; the server runs the same rules on the parameters and renders the same messages for a typed URL. Each lookup value is shown back as literal text. Traces to: AC-0090, AC-0091, AC-0092, and AC-0093, AC-0101, AC-0110, AC-0113, AC-0116, AC-0119, AC-0123, AC-0134.
- **The save and void decisions take every database call as an argument,** as `save-batch.ts` does, so Vitest can fail any one of them. `decideSaleSave` settles the caller, runs `readBefore` (product list, customer list, form rules, stock before), the write, and `readAfter` (summary, finished lots, stock after); a write that returned is a save even if `readAfter` fails. `decideSaleVoid` settles the caller, runs the reason rule, then the write. Traces to: AC-0047, AC-0048, AC-0050, AC-0051, AC-0052, AC-0053, AC-0054, AC-0055, AC-0056, AC-0057, AC-0058, and AC-0059, AC-0080, AC-0084, AC-0085, AC-0086, AC-0087, and AC-0088.
- **No check step.** A sale can be voided, so Save sale writes at once; a pending save disables the button with `aria-disabled` and a "Saving…" status, as production's confirm does. Traces to: AC-0034.
- **After a save, the form keeps the customer and the sale date** and empties the code, lbs, and price, so the next product of the same order starts from the customer already chosen. Traces to: AC-0046.

### Data & schema

- One migration, created with `supabase migration new sales_trace` and applied with `supabase migration up`: `create or replace view public.v_sale_traceability with (security_invoker = true)` with the six appended columns, then `create view public.v_sale_summary with (security_invoker = true)`, then for the new view `revoke all … from public, anon, authenticated, service_role` and `grant select … to authenticated, service_role`. The trace view keeps its grants, because `CREATE OR REPLACE VIEW` keeps them.
- No table, column, index, function, trigger, or policy changes.

### Interfaces & contracts

- `src/lib/sale-input.ts`: `SaleFields { productCode, lbs, pricePerLb, customerId, saleDate, today }`, `SaleField`, `SaleInput { productCode, lbs, pricePerLb, customerId?, saleDate }`, `parseSaleForm(fields, finishedCodes, customerIds): SaleParse`, `parseSaleNumber(text)`, and `parseLotFinder({ rawCode, received })`. An empty `customerId` means "No customer". The void reason reuses `parseVoidReason` from `receipt-input.ts`; the calendar-date rule is exported from `batch-input.ts` and reused.
- `src/lib/failures.ts`: `NOT_SAVED_SALE`, `SALE_SAVE_UNKNOWN`, `NOT_VOIDED_SALE`, `SALE_VOID_UNKNOWN`, `saleSaveFailureMessage(error, stage)` with the finished-stock shortfall rule, and `saleVoidFailureMessage(error, stage)`; `LoggedAction` gains `saveSale` and `voidSale`.
- `src/lib/sales.ts`: `listSaleProducts(client)` (the menu view rows in code order), `listCustomers(client)`, `getFinishedOnHand(client, productId)`, `listRecentSales(client)` returning `{ sales, total }`, and `getSaleSummary(client, saleId)`.
- `src/lib/trace.ts`: `getSaleTrace(client, saleNumber)` returning the summary plus `lots: { saleItemId, batchNumber, productionDate, lbsSold, rawLots: { lotNumber, rawCode, rawProduct, vendor, receivedDate, lbsDrawn, costPerLb }[] }[]`, or null; `listSaleLots(client, saleId)` (the same `lots` for the "Sale saved" panel); `findLots(client, rawCode, received?)` returning `{ rawProduct, lots, total }` or null; and `getLotTrace(client, lotNumber)` returning the lot, its customers, its sales, and its finished stock, or null. `getTrace` and `getTraceByLot` in `src/lib/views.ts` stay as they are for `test/costing.test.ts` and `test/corrections.test.ts`; `trace.ts` reads the view itself because it needs an order, the summary view, and complete paging, which those two do not give.
- `test/db.ts`: `PARAM_TYPES` gains `p_customer_id` and `p_sale_number`, so sale calls with a customer go through a pg operator session too.

### Component / module decomposition

- `src/app/page-header.tsx`: `PageName` and `PAGES` gain `sales` and `trace`.
- `src/app/sales/`: `page.tsx` (server: caller, then product list, customers, recent sales), `sale-form.tsx` (client: fields, the product facts, the price fill), `result-panel.tsx`, `recent-sales.tsx`, `void-dialog.tsx`, `form-fields.ts`, `save-sale.ts` (`decideSaleSave`, `decideSaleVoid`), `actions.ts` (`saveSale`, `voidSale`), `error.tsx` on `page-error.tsx`.
- `src/app/trace/`: `page.tsx` (server: caller, then the lookup the URL names), `find-forms.tsx` (client), `sale-trace.tsx`, `lot-list.tsx`, `lot-trace.tsx`, `error.tsx`.

### State & control flow

Page contracts, from `frontend-engineering` create mode:

| Field | `/sales` | `/trace` |
| --- | --- | --- |
| target user | The owner, at the counter, the dock, or a desk | The owner, at a desk or on the phone with a customer or vendor |
| primary job | Record what was sold, to whom, at what price | Answer "where did this come from" and "who got this lot" |
| primary action | Save sale | Show sale; Show lots, then a lot link |
| expected result | The written sale with its finished lots and the stock before and after, in a focused panel | The sale's chain to raw lots and vendors, or the lot's customers, sales, and stock on hand |
| next action | The next product of the same order, or Trace this sale | Follow a lot or sale link; call the customers listed |
| first-screen content at 320 px | Heading, navigation, product code, lbs, price per lb | Heading, navigation, the Sale number field and Show sale |
| product proof | none: an internal tool | none: an internal tool |
| read/write consequence | Save writes one sale through `record_sale`; Void marks it through `void_sale`; a refusal writes nothing | Read only |
| critical states | first-run, content, empty, success, error, permission/denied, destructive-confirmation | first-run, content, no-results, empty, error, permission/denied |
| responsive behavior | One column; figures wrap under their labels; the list is cards, not a table | One column; each finished lot is a card with its raw lots stacked inside |
| a11y requirements | WCAG 2.2 AA; focus to the "Sale saved" heading after a save, to the first field with an error after a refusal, to the message after a failure, into the void dialog on open and back on close | WCAG 2.2 AA; focus to the first field with an error after a refusal |
| measurement event | none: no analytics | none: no analytics |

State matrix (the applicable subset of the 18 states):

| State | Treatment | AC |
| --- | --- | --- |
| first-run | No active finished product: the AC-0027 text; no sale: "No sales yet." | AC-0027, AC-0075 |
| content | The form with the product facts; the recent sales; a sale's trace; a lot list; a lot's trace | AC-0020, AC-0070, AC-0095, AC-0110, AC-0120 |
| empty | A lot with no sales or no finished stock; a raw product with no receipt | AC-0117, AC-0118, AC-0127, AC-0131 |
| no-results | An unknown sale number, raw code, or lot number | AC-0093, AC-0116, AC-0134 |
| partial | More than 10 sales or receipts: the count line | AC-0074, AC-0111 |
| loading | A pending save or void: `aria-disabled="true"` and a "Saving…" or "Voiding…" status | AC-0034 |
| success | "Sale saved" panel, focused; a voided row and the panel's voided line | AC-0040, AC-0082, AC-0083, AC-0154 |
| error | Field messages with `aria-describedby`; a focused message for a refusal or failure, every value kept; the error page with Try again | AC-0029, AC-0050, AC-0051, AC-0052, AC-0053, AC-0054, AC-0055, AC-0056, AC-0057, AC-0058, and AC-0059, AC-0084, AC-0085, AC-0086, AC-0087, and AC-0088, AC-0140 |
| destructive-confirmation | The void dialog: names the sale, asks for a reason, Cancel first | AC-0078, AC-0079, AC-0080, and AC-0081 |
| permission/denied | Not-allowed page with Sign out | AC-0002 |
| high-zoom | 320 px reflow; cards, not tables | AC-0151 |
| keyboard-only | Full keyboard path, visible focus | AC-0153, AC-0162 |
| large-data-set | A lot's sales and customers can pass the API's `max_rows` cap, so its trace reads every row by key and lists them all. The recent sales and the no-date lot list are capped at 10 with a count. The other unpaged reads stay far under the cap: a sale's trace holds one row per line per raw lot of one sale; a dated lot list holds one raw product's receipts of one day; the customer list, the page's product list, the save action's read of every finished product, active or not, and a lot's finished stock follow the owner's catalog and batches, which run to tens of rows | AC-0135, AC-0074, AC-0111 |
| offline, blocked, long-content, reduced-motion, disabled | Not applicable: the office pages assume a connection (`SYSTEM-SPEC.md` §9); nothing blocks a sale but the engine's refusals, which are errors; descriptions wrap; there is no animation; no control is shown disabled except while pending | n/a |

A save moves through idle, invalid, pending, saved, and refused or failed. On
success the action revalidates `/sales` only when `readAfter` succeeded, as
`saveBatch` does, so a failed read keeps the form and the panel.

### Behavior & rules

- `saleSaveFailureMessage` reads the stage and the code like `batchSaveFailureMessage`: before-write gives "try again"; no code gives the may-not-have-been text; 42501 gives not-allowed; the finished-stock shortfall text gives the AC-0050 sentence (finished stock made on or before the date that is still on hand), its numbers through `formatWeight` and its date through `formatDate`; "is inactive" gives the inactive text; any other engine text follows "The sale wasn't saved." with its prefix removed.
- `saleVoidFailureMessage` reads like `voidFailureMessage`, with the sale texts.
- The form rules mirror `parseBatchForm`: first matching row wins per field, `NUMBER_TEXT` and `decimalPlaces` from `number-text.ts`, and an invalid `today` refuses the date.

### Failure, edge cases & resilience

- A save whose write got no answer may have written a sale; the message sends the owner to Recent sales, where a duplicate can be voided. The error page carries no extra line (spec Assumptions).
- A stale page fills the list price it loaded; the owner sees the price before saving, and the sale stores what was saved.
- Two tabs voiding one sale: `void_sale` refuses the second with "already void", which shows as an AC-0084 message.
- The 10-second request limit and the proxy's handling of an ended session on a POST are inherited unchanged.

### Quality attributes (NFRs)

- **Aesthetic reference:** Stripe Dashboard (professional SaaS: a light surface, high contrast, tabular figures, no gradients or illustration), as on the earlier pages. XD genre routing: skipped (experience-design pack absent). Seed tokens: the existing tokens in `src/app/globals.css`; the pages add none.
- **Accessibility:** every field has a visible `<label>`; error ids are named by `aria-describedby`; messages sit in `role="status"` or `role="alert"` regions present before they are filled; the void dialog is a native `<dialog>` with Cancel first, as on receiving.
- `checkPageState` in `test/e2e/a11y.ts` runs in every page state the spec lists.

## Tasks

Stub validation, 2026-10-09, rerun after review round 1 with the same results. Each `stub: true` block below was extracted from
this file into a `git archive` copy of `HEAD` in the session's scratch directory,
outside the repository, and its sha256 recorded from that extraction (the code
lines plus one terminal newline).

- **Compile:** against placeholder declarations of `src/lib/sale-input.ts`, `saleSaveFailureMessage` in `src/lib/failures.ts`, `src/lib/trace.ts`, and `src/app/sales/save-sale.ts`, shaped as Interfaces & contracts names them, `tsc --noEmit -p tsconfig.json` exited 0 for all four.
- **Red, with the placeholders removed:** `vitest run` over the four files exited 1. T1 failed its assertion with `relation "public.v_sale_summary" does not exist` from the local stack, after its fixture calls succeeded. T2, T3, and T4 failed to load their missing modules (`../src/lib/sale-input.js`, `../src/lib/trace.js`, `../src/app/sales/save-sale.js`).
- **Isolation:** the run went through `sandbox-exec` with: network denied except to `localhost`; file-content reads denied except for the root directory's own listing (Node reads `/` at startup), the repository, the Node 22.17.0 install under `~/.nvm/versions/node/v22.17.0`, the scratch directory, this user's process temporary directory (`os.tmpdir()`), the timezone data in `/private/var/db/timezone`, and the system paths `/System`, `/usr`, `/private/etc`, and `/dev` (reads of `~/.zshrc` and of `/private/var/db/dslocal`, a write into the repository, and a request to an outside host were each refused under the same profile); file writes denied except under the scratch directory, that temporary directory, and `/dev`; and a 120-second `alarm`. Vitest ran as `node node_modules/vitest/vitest.mjs`, not through `npx`. The stack details came from `supabase status -o env` outside the sandbox and were passed in the environment, so no Docker or CLI call ran inside it. Vitest's cache write under `node_modules/.vite` was refused by the sandbox after the run.
- **Declared test-harness side effects,** all on the local stack through `localhost`: global setup's idempotent creation of the test users and their allowlist rows; `resetTestData`'s truncate and reseed of the local database; and the T1 and T3 stubs' committed fixture calls. These are the side effects `npm test` has on every run.
- The scratch copy was removed.

### T1: The migration's views give each sale its total and keep the trace columns

**Depends on:** none

**Touches:** `supabase/migrations/*_sales_trace.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/sales.test.ts`, `docs/costing.md`, `SYSTEM-SPEC.md`

**Tests:**
- `test/sales.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0010: the sale summary gives the 5,000-lb sale its total lbs and price" (AC-0010). sha256 `ebf6034df99a36806cf810c18a474a94a06325885c701aeb783cb5e98ddcb3ef`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsClient,
  closePool,
  CUSTOMER_ID,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
} from "./db.js";
import { signInOperator } from "./users.js";

const VALLEY_ID = "55555555-5555-5555-5555-555555555555";
let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0010
it("AC-0010: the sale summary gives the 5,000-lb sale its total lbs and price", async () => {
  await query("insert into vendors(id, name) values ($1, 'Valley Poultry')", [VALLEY_ID]);
  for (const call of [
    receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"),
    receiveCall(RAW_TOM_ID, VALLEY_ID, 3000, 1.8, "2026-10-05"),
    produceCall(PROD_502_ID, 6000, null, "2026-10-06"),
    produceCall(PROD_502_ID, 1000, null, "2026-10-07"),
    {
      fn: "record_sale" as const,
      args: {
        p_finished_product_id: PROD_502_ID,
        p_lbs: 5000,
        p_price_per_lb: 3.29,
        p_customer_id: CUSTOMER_ID,
        p_sale_date: "2026-10-08",
        p_sale_number: "S-5000",
      },
    },
  ]) {
    expect((await callAsClient(operator, call)).ok).toBe(true);
  }
  const rows = await query(
    `select lbs_sold::text, price_per_lb::text, finished_code, customer
     from public.v_sale_summary where sale_number = 'S-5000'`,
  );
  expect(rows).toEqual([
    { lbs_sold: "5000.000", price_per_lb: "3.2900", finished_code: "502", customer: "Fulton Market Deli" },
  ]);
});
```

- The same file then grows, in EXECUTE, with a `saleFixture()` helper in `test/db.ts` building the sale fixture and the 5,000-lb sale: AC-0011 (voided through `voidSaleCall`), AC-0012 (row count against `select count(*) from sales`), AC-0015 (both views read through a service-role client).
- `test/access.test.ts` stays unchanged and green: its catalog sweep reaches `v_sale_summary` for AC-0013 and AC-0014, and its fixture already holds a sale. If the sweep's operator read of the new view finds no row, the fixture gains the reads it needs and nothing leaves the sweep.
- `test/costing.test.ts`, `test/corrections.test.ts`, and `test/engine.test.ts` stay unchanged and green.

**Approach:**
- Write the migration as the Data & schema section says; apply it; run `npm run gen:types`.
- In `SYSTEM-SPEC.md` §4, extend the `v_sale_traceability` entry and add `v_sale_summary`. In `docs/costing.md`, add `v_sale_summary` to the sentence on where the math lives.

**Done when:** the T1 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T2: Sale and lot-finder form rules and the sale messages pass their tables

**Depends on:** none

**Touches:** `src/lib/sale-input.ts`, `src/lib/batch-input.ts`, `src/lib/failures.ts`, `test/sales-rules.test.ts`

**Tests:**
- `test/sales-rules.test.ts`, a new file, no database. stub: true. Test functions and ACs: "AC-0029: a price per lb of 100,000,000 is refused" (AC-0029), "AC-0050: a shortfall names the finished stock, the date, and the lbs needed" (AC-0050). sha256 `d32a663048a6e04894b7b8c3cbd4ed1095e8c5a1d9dcfd0e4995f9216c3d4ba4`.

```ts
import { describe, expect, it } from "vitest";
import { saleSaveFailureMessage } from "../src/lib/failures.js";
import { RpcError } from "../src/lib/rpc.js";
import { parseSaleForm } from "../src/lib/sale-input.js";

const fields = {
  productCode: "502",
  lbs: "100",
  pricePerLb: "3.29",
  customerId: "",
  saleDate: "2026-10-08",
  today: "2026-10-09",
};

describe("sale form rules", () => {
  // STUB: AC-0029
  it("AC-0029: a price per lb of 100,000,000 is refused", () => {
    expect(parseSaleForm({ ...fields, pricePerLb: "100000000" }, new Set(["502"]), new Set())).toEqual({
      ok: false,
      errors: { pricePerLb: "Price must be below 100,000,000." },
    });
  });
});

describe("sale messages", () => {
  // STUB: AC-0050
  it("AC-0050: a shortfall names the finished stock, the date, and the lbs needed", () => {
    const error = new RpcError(
      "recordSale failed: record_sale: shortfall, only 4620.000 lbs finished available on or before 2026-10-06, need 5000",
      "P0001",
    );
    expect(saleSaveFailureMessage(error, "write")).toBe(
      "The sale wasn't saved. Only 4,620 lbs of finished stock made on or before Oct 6, 2026 is on hand, and this sale needs 5,000 lbs.",
    );
  });
});
```

- The same file then grows, in EXECUTE: one case per row of AC-0029 and AC-0119 with first-row-wins order; the AC-0030 customer rule; the AC-0031 date rule; the AC-0032 accepted inputs (lbs 0.001 at price 0, lbs 1540 at 99999999.99); `parseSaleNumber` for AC-0091 and AC-0092; and `saleSaveFailureMessage` and `saleVoidFailureMessage` giving the AC-0053, AC-0054, AC-0056, AC-0057, AC-0051, AC-0084, AC-0087, and AC-0088 texts from errors shaped as the wrappers throw them.
- `test/production-rules.test.ts`, `test/receipt-input*.test.ts`, and `test/failures*.test.ts` stay unchanged and green.

**Approach:**
- Write `parseSaleForm` on the shape of `parseBatchForm`, export `isCalendarDate` from `batch-input.ts` for it, and add the sale texts and the two message functions beside `batchSaveFailureMessage`.

**Done when:** the T2 tests are green.

### T3: The sales and trace reads return the screens' rows in the screens' order

**Depends on:** T1, T2

**Touches:** `src/lib/sales.ts`, `src/lib/trace.ts`, `test/sales-data.test.ts`

**Tests:**
- `test/sales-data.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0098: a sale's trace lists its finished lots and their raw lots in draw order" (AC-0098). sha256 `670c2cd7c79bb6a67c5e09b24f3456fd1b082af855a6628616a1a4e311366d52`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import { getSaleTrace } from "../src/lib/trace.js";
import {
  assertLedgerInvariants,
  callAsClient,
  closePool,
  CUSTOMER_ID,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
} from "./db.js";
import { signInOperator } from "./users.js";

const VALLEY_ID = "55555555-5555-5555-5555-555555555555";
let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0098
it("AC-0098: a sale's trace lists its finished lots and their raw lots in draw order", async () => {
  await query("insert into vendors(id, name) values ($1, 'Valley Poultry')", [VALLEY_ID]);
  for (const call of [
    receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"),
    receiveCall(RAW_TOM_ID, VALLEY_ID, 3000, 1.8, "2026-10-05"),
    produceCall(PROD_502_ID, 6000, null, "2026-10-06"),
    produceCall(PROD_502_ID, 1000, null, "2026-10-07"),
    {
      fn: "record_sale" as const,
      args: {
        p_finished_product_id: PROD_502_ID,
        p_lbs: 5000,
        p_price_per_lb: 3.29,
        p_customer_id: CUSTOMER_ID,
        p_sale_date: "2026-10-08",
        p_sale_number: "S-5000",
      },
    },
  ]) {
    expect((await callAsClient(operator, call)).ok).toBe(true);
  }
  const trace = await getSaleTrace(operator, "S-5000");
  expect(trace?.lots.map((lot) => [lot.productionDate, lot.lbsSold])).toEqual([
    ["2026-10-06", 4620],
    ["2026-10-07", 380],
  ]);
  expect(trace?.lots.map((lot) => lot.rawLots.map((raw) => [raw.vendor, raw.lbsDrawn]))).toEqual([
    [
      ["Reyes Meats", 5000],
      ["Valley Poultry", 1000],
    ],
    [["Valley Poultry", 1000]],
  ]);
});
```

- The same file then grows, in EXECUTE, with fixtures from T1's `saleFixture()`:
  - `listSaleProducts` returns the menu view's active finished products in code order with list price and finished on hand; `listCustomers` sorts names ignoring case (construction for AC-0020 and AC-0025);
  - `listRecentSales` returns the 12-sale fixture's last 10 by entry order with a total of 12, void sales included (construction for AC-0070, AC-0071, AC-0074);
  - `getSaleTrace` returns the AC-0043 and AC-0100 orders, the summary for a void sale with no lots, and null for an unknown number;
  - `findLots` returns the AC-0110 choice and order with its total, the AC-0112 date filter, no void receipt, an inactive raw product's receipts, and null for a finished product's code;
  - `getLotTrace` returns the AC-0122 customers, the AC-0124 order, the AC-0125 lines, the AC-0129 and AC-0130 finished stock, and null for an unknown lot number;
  - `getLotTrace` returns every sale line, each once by `sale_item_id`, and the oldest line's customer for the AC-0135 fixture: one more one-pound sale from one batch than `max_rows`, read from `supabase/config.toml`, each written by its own `callAsOperator` call with a caller-given sale number, the first to a customer with no other sale (construction for AC-0135);
  - the paging loop, given a page read whose count changes on the second page, reads once more and then throws (construction for AC-0135);
  - a real `record_sale` shortfall refusal, caught from `recordSale` and fed to `saleSaveFailureMessage`, gives the AC-0050 sentence, pinning the T2 rule to the engine's wording.

**Approach:**
- Write the reads like `src/lib/production.ts`: throw on error and return numbers as delivered; order through `.order()` on view or table columns, except a lot's trace, which reads by `sale_item_id` and orders the complete set as the Design says; group trace rows by `sale_item_id` in first-seen order.

**Done when:** the T3 tests are green, with `assertLedgerInvariants` passing after each test.

### T4: The save and void decisions return the right state for every branch

**Depends on:** T2, T3

**Touches:** `src/app/sales/save-sale.ts`, `src/app/sales/actions.ts`, `src/app/sales/form-fields.ts`, `src/lib/failures.ts`, `test/save-sale.test.ts`

**Tests:**
- `test/save-sale.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0053: a read before the write fails, so nothing is written" (AC-0053). sha256 `0daf82fd80d36ed5b0ca540802f0d0cee81bad9c6215d4a8ec0aa38f14445dd4`.

```ts
import { expect, it } from "vitest";
import { decideSaleSave, type SaleSaveDeps } from "../src/app/sales/save-sale.js";

const fields = {
  productCode: "502",
  lbs: "100",
  pricePerLb: "3.29",
  customerId: "",
  saleDate: "2026-10-08",
  today: "2026-10-09",
};

async function unreachable(): Promise<never> {
  throw new Error("unreachable");
}

// STUB: AC-0053
it("AC-0053: a read before the write fails, so nothing is written", async () => {
  let wrote = false;
  const deps: SaleSaveDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => {
      throw new Error("listSaleProducts failed: fetch failed");
    },
    write: async () => {
      wrote = true;
      return unreachable();
    },
    readAfter: unreachable,
  };
  expect(await decideSaleSave(fields, deps)).toEqual({
    status: "refused",
    message: "The sale wasn't saved. Try again in a moment.",
  });
  expect(wrote).toBe(false);
});
```

- The same file then grows, in EXECUTE, with each call passed in as a fake: the caller check ends, refuses, or fails, and no write is called (AC-0052, and AC-0004 and AC-0006's shape); a form-rule or customer refusal returns field errors and no write is called (AC-0029, AC-0030); the write throws with no code (AC-0054), with 42501 (AC-0057), with the shortfall (AC-0050), and with another engine refusal (AC-0056); the write returns and `readAfter` fails (AC-0047, AC-0048's shape); the write returns and the state carries the summary, the lots, and the stock before and after. `decideSaleVoid` gets the same set for AC-0005, AC-0080, AC-0084, AC-0085, AC-0087, and AC-0088.

**Approach:**
- `decideSaleSave` and `decideSaleVoid` hold the branch logic and log one `actionFailureLogLine` per failure. `actions.ts` passes `checkCaller`, the T2 rules, the T3 reads, and `recordSale` or `voidSale` from `src/lib/rpc.ts`, catches everything so no action rejects, and revalidates `/sales` after a save whose `readAfter` succeeded and after a void that returned.

**Done when:** the T4 tests are green and `npm run typecheck` exits 0.

### T5: `/sales` records, shows, lists, and voids sales in the browser, and every page links to Sales and Trace

**Depends on:** T4

**Touches:** `src/app/page-header.tsx`, `src/app/sales/*`, `src/app/trace/page.tsx` (a heading-only page so the new link resolves until T6), `test/e2e/sales.spec.ts`, `test/e2e/sales-page.ts`, `test/e2e/receiving-page.ts`, `test/e2e/production-page.ts`, `test/e2e/menu-page.ts`, `test/e2e/pricing.spec.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/sales.spec.ts`, signed in as the operator, with fixtures written through `pg` like `test/e2e/production-page.ts`:
  - access and navigation: AC-0001 and AC-0002 for `/sales`; AC-0003, AC-0004, AC-0005, and AC-0006 with replayed save and void requests, checked through `pg`; AC-0007 and AC-0008 on all six pages; AC-0009 for `/sales` and `/trace` through Playwright's request API, signed out and as the operator;
  - the form: AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033, and AC-0034, with AC-0029 row by row, AC-0030 and AC-0031 as replayed requests, AC-0033 with a product inserted through `pg` after the load, and AC-0034 with the save held by a request-routing helper;
  - the result: AC-0040, AC-0041, AC-0042, AC-0043, AC-0044, AC-0045, AC-0046, AC-0047, and AC-0048, with AC-0047 and AC-0048 revoking the operator's SELECT on `sale_items` through `pg` just before Save sale and restoring it in a `finally`;
  - refusals and failures: AC-0050, AC-0051 (inactive through `pg` after the load), AC-0052 (the session ended through the receiving tests' helper), AC-0055 (a request-dropping helper like production's), AC-0056 (lbs of 400 nines), AC-0058 through `pg`, AC-0059 after each;
  - recent sales and void: AC-0070, AC-0071, AC-0072, AC-0073, AC-0074, AC-0075, AC-0076, AC-0077, AC-0078, AC-0079, AC-0080, AC-0081, AC-0082, AC-0083, AC-0084, AC-0085, and AC-0086 and AC-0089, with AC-0084 voiding the sale through a pg operator call after the list loads, AC-0085 with an ended session, and AC-0086 with the request-dropping helper;
  - keyboard and focus: AC-0153 for a save and a void, AC-0154, AC-0155 and AC-0156 after an AC-0029 refusal, AC-0157, AC-0158, AC-0159 after AC-0084, AC-0085, and AC-0086, AC-0160, AC-0161;
  - `checkPageState` with no findings in every `/sales` page state the spec lists except the error page: AC-0150, AC-0151, AC-0152, AC-0162, AC-0163 for those states.
- `FORM_CONTROLS` in `test/e2e/receiving-page.ts` and `test/e2e/production-page.ts` and `MENU_CONTROLS` in `test/e2e/menu-page.ts` (which `NAV_CONTROLS` in `test/e2e/pricing-page.ts` aliases) gain "a Sales" and "a Trace", in that order, after "a Pricing", and the navigation slice at `test/e2e/pricing.spec.ts` that compares the first five controls with `NAV_CONTROLS` compares `NAV_CONTROLS.length` controls instead, so the four earlier browser suites stay green with the wider navigation.

**Approach:**
- Widen the header, build the page, form, panel, list, and dialog on the production and receiving patterns and the design above, and give `/trace` a heading-only page until T6.

**Done when:** `npm test` exits 0.

### T6: `/trace` finds sales and lots and shows both traces in the browser

**Depends on:** T3, T5

**Touches:** `src/app/trace/*`, `test/e2e/trace.spec.ts`, `test/e2e/trace-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/trace.spec.ts`, signed in as the operator, with fixtures written through `pg`:
  - access: AC-0001 and AC-0002 for `/trace`;
  - find a sale: AC-0090, AC-0091, AC-0092, AC-0093 (including the `<b>9</b>` number, checked by its text and by the absence of a `b` element);
  - a sale's trace: AC-0095, AC-0096, AC-0097, AC-0098, AC-0099, AC-0100, AC-0101, and AC-0102;
  - find a raw lot: AC-0110, AC-0111, AC-0112, AC-0113, AC-0114, AC-0115, AC-0116, AC-0117, AC-0118, and AC-0119, with AC-0115 on a raw product made inactive through `pg` and AC-0116 including the `<b>9</b>` code;
  - a lot's trace: AC-0120, AC-0121, AC-0122, AC-0123, AC-0124, AC-0125, AC-0126, AC-0127, AC-0128, AC-0129, AC-0130, AC-0131, and AC-0132 and AC-0134 (including the `<b>9</b>` number);
  - AC-0135 over the T3 fixture, checking the count of listed sales against the fixture's count and the oldest line's customer;
  - keyboard and focus: AC-0153 for Show sale, Show lots, and following a lot and a sale link; AC-0155 and AC-0156 after AC-0092 and AC-0119 refusals;
  - `checkPageState` with no findings in every `/trace` page state the spec lists except the error page: AC-0150, AC-0151, AC-0152, AC-0162, AC-0163 for those states.

**Approach:**
- Build the page, the two find forms, and the three result views on the pricing what-if's URL pattern and the design above.

**Done when:** `npm test` exits 0.

### T7: The docs match the code, the goal-based checks pass, and the stopped-service run is recorded

**Depends on:** T1, T2, T3, T4, T5, T6

**Touches:** `docs/architecture/overview.md`, `docs/costing.md`, `docs/specs/sales/notes/verification-ledger.md`

**Tests:** no stub (mode): goal-based checks and a recorded manual run.
- Before the recorded run and the checks below, `origin` is fetched, `feat/sales` is rebased onto the fetched `origin/main`, the rebased branch's migrations are applied to the local stack with `supabase migration up` after the Risks stack check passes, and `npm test` exits 0 on the rebased branch, so every result recorded describes the code that merges.
- The recorded run in the verification ledger, against `npm run start`:
  - with the local REST service stopped before a load of `/sales` and of `/trace`: each error page, its text, its focus (AC-0141), and `checkPageState` on it (AC-0150, AC-0151, AC-0152, AC-0162, AC-0163 for those states); then Try again after the restart (AC-0140);
  - with the REST service stopped after `/sales` loads: the AC-0053 message after Save sale and the AC-0087 message after confirming a void, every field's value (AC-0059), and the focused element (AC-0157, AC-0159);
  - with the app's `SUPABASE_URL` pointed at a throwaway forwarder in scratch (not committed) in front of the local REST service, restored afterwards:
    - the forwarder holds a `record_sale` call past the 10-second limit: the AC-0054 message, every field's value, the focused element, and a `pg` read of whether a sale was written;
    - the forwarder holds a `void_sale` call past the limit: the AC-0088 message and the focused element;
    - the forwarder holds a `record_sale` call while a `pg` session deletes the operator's `private.operators` row, then lets it through: the AC-0057 message, every field's value, the focused element, and `pg` reads showing no sale written and every finished lot's `lbs_remaining` unchanged (AC-0058); the row is inserted back afterwards.
- Rendered-page inspection, per `frontend-engineering` GATES step 5, of `/sales`, `/sales` after a save, `/trace?sale=<the 5,000-lb sale>`, `/trace?raw=RAW-TOM`, and `/trace?lot=<lot B>` over the sale fixture, at the narrow and wide fallback channels, each at the four required captures, with the five fields and the observations recorded in the ledger for the `frontend-reviewer`.
- The commands of AC-0170, AC-0171, AC-0172, AC-0173, AC-0174, AC-0175, AC-0176, AC-0177, AC-0178, and AC-0179, each with its exit code recorded in the ledger, and AC-0016 and AC-0017 as two catalog reads compared: the columns of every base table and view in `public` and the list of `public` functions, from `information_schema` and `pg_proc`, first with the local database built from the then-current `main` migrations, then with it built from this branch's.

**Approach:**
- For the AC-0016 and AC-0017 baseline, extract `origin/main`'s `supabase/` into scratch with `git archive`, run `supabase db reset --workdir <scratch>`, read the catalog, then run `supabase db reset` in this worktree and read it again; the stack check in Risks runs first.
- Edit the overview rows and sentences named in the spec's Durable Outputs row; in `docs/costing.md`, extend the Rounding note's price row to a sale's price per lb, add "No customer" to the missing-value texts, and name `test/e2e/sales.spec.ts` and `test/e2e/trace.spec.ts` in the file's opening.

**Done when:** every check above is recorded as passing in the ledger.

## Rollout

- **Delivery:** one branch, `feat/sales`, merged after review. The migration adds a view and appends view columns; reverting the code leaves them unused and harmless.
- **Infrastructure and external systems:** none. The app runs only against the local stack; the hosted project gets this migration only through the hosted rollout intent, with the owner's approval.
- **Deployment sequencing:** the migration before the code that reads it; `supabase migration up` runs first in T1.

## Risks

- **The trace view is replaced.** A missing `security_invoker` opens sales to a non-operator, and a moved column breaks the suites that read it. AC-0013, AC-0016, `test/costing.test.ts`, and `test/corrections.test.ts` catch each.
- **Three worktrees share one local stack.** `meat-ops`, `meat-ops-invoice`, and this one all use the `meat-ops` containers. A test run in one truncates the data another run is using, and `npm run gen:types` and the AC-0016 and AC-0017 catalog reads see whatever migrations are applied. Before each `npm test`, before `npm run gen:types`, and before T7's checks, confirm no other worktree's test run is active and that `supabase_migrations.schema_migrations` holds only `main`'s migrations and this branch's. When either check fails, stop and ask the owner before running anything: never run `supabase db reset` over another worktree's applied migration without the owner's go-ahead, and after any reset tell the owner which worktree needs `supabase migration up` again.
- **Parallel navigation change.** Invoice-photo entry may also add a Primary link. AC-0007 holds the six links in relative order, so it stays true; whichever branch merges second rebases and widens the browser helpers' Tab-order lists with the other branch's link.
- **Shared modules and helpers.** `format.ts`, `failures.ts`, `batch-input.ts`, `page-header.tsx`, and the four earlier pages' control lists serve the earlier pages too; their suites run in every gate.
- **The engine's texts are matched by wording.** A T3 test against a real shortfall refusal turns red first if `record_sale`'s text changes.

## Changelog

- 2026-10-09: initial plan.
- 2026-10-09: review round 1. A lot's trace reads every row past the API's 1,000-row cap (new AC-0135). AC-0040 leaves out lbs and price after a save whose reads after the write failed. The shortfall message says the stock is on hand, not made. AC-0007 holds the links in relative order, so a parallel feature's link does not break it. T5 also updates the pricing suite's navigation slice. Save settles a code missing from the page's list by re-rendering, as production does, and the stock read before the write tolerates an inactive product. T7 builds its catalog baseline from the then-current `main`. The stack check names what to do when it fails, and the AC-0057 recorded case also reads the finished lots. The T2 stub is revalidated.
- 2026-10-09: review round 2. A lot's trace reads its rows by the unique `sale_item_id` and fails closed when page counts disagree. The AC-0135 fixture writes each sale in its own transaction with a given number and is sized from `max_rows`, and its page state leaves the page-state list, whose Tab walk stops at 200 controls. T7 rebases onto `origin/main` and reruns `npm test` before its checks. The large-data-set row names every unpaged read. The spec's recorded AC-0057 case also records every finished lot's lbs remaining unchanged (AC-0058).
- 2026-10-09: review round 3. A lot's trace pages with `.range()` on the unique `sale_item_id`, so an unchanged lot reports one count on every page, and a repeat read that meets the rules returns its set. T7 fetches `origin`, rebases onto it, and applies the rebased migrations before `npm test`. The large-data-set row names the save action's read of every finished product.
