# Spec: home-screen

- **Status:** Draft <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints and Non-goals in the brief [`docs/product/briefs/ui-polish.md`](../../product/briefs/ui-polish.md), including the intent's Guardrail and Limits they point to; the screen rules in the `src/app` row, the `supabase/migrations/` row, and the Access model in [`docs/architecture/overview.md`](../../architecture/overview.md); [`docs/costing.md`](../../costing.md); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** docs/product/briefs/ui-polish.md
- **Discovery:** none
- **Contract:** none (three database views read only by this app; no published interface)
- **Shape:** mixed

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory: it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

Right after signing in, or on opening the installed app, the business owner sees where the business stands today on one page, the home screen named "Today". This is spec 2a of the brief, and it answers the intent's Input measure.

Success for the business owner:

- Signing in and the installed app open "Today", and both menus list it first. The decision record in Assumptions gives the presses from "Today" to Receiving and the owner's reading of the Guardrail.
- "Today" shows the money figures first: today's sales and the stock value at cost, computed in the database.
- It shows the open alerts, low stock among them, so the owner needs no other page to learn what needs attention.
- It lists today's receipts, batches, and sales across every product, so no product page has to be opened to piece the day together.
- It shows how much of each product is on hand.

The design reference is the comparison page named in the brief's Design artifacts.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/home-screen/`. At closeout, the overview, SYSTEM-SPEC, the costing reference, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current product truth: the views | SYSTEM-SPEC's data model lists every view. | `SYSTEM-SPEC.md`, the views list | `work-loop` implementer | The list names the daily sales, stock value, and stock on hand views with their columns. | `close-work` reads the list against the migration. |
| Current product truth: the money figures | The costing reference defines every figure the engine computes and lists the views and suites that hold its math. | `docs/costing.md`: its opening lists of views and suites, a section on today's sales and stock value, and the Rounding note | `work-loop` implementer | The opening lists name the daily sales and stock value views and their suite; the section defines both figures and gives AC-0011's and AC-0012's examples; the Rounding note's "Raw cost total" row becomes a row for every money total, the home screen's included, and its "Where the database has nothing to show" list gives "$0.00" for a money figure with no row, with `test/e2e/home.spec.ts` in the opening's list of suites that check those texts. | `close-work` reads it against the views. |
| Current architecture: the screens | The overview's `src/app` row describes each page, the menus, the banner, the install file, and where sign-in lands. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names "Today" at `/`, its four sections in order, the menus' first item, sign-in and the install file opening there, the banner's absence there, and the error views of `/` and `/sign-in`. | `close-work` reads the row whole against the code. |
| Current architecture: the database and access | The `supabase/migrations/` row and the Access model list each view and who reads it. | `docs/architecture/overview.md`, the `supabase/migrations/` row and the Access model | `work-loop` implementer | Both name the three views, `security_invoker`, and their grants. | `close-work` reads both against the migration. |
| Current architecture: the test suites | The overview's `test/` and `test/e2e/` rows list each suite. | `docs/architecture/overview.md`, the `test/` and `test/e2e/` rows | `work-loop` implementer | The rows list this spec's new Vitest and browser suites, and the `test/e2e/` row's sentence on recorded runs names the browser suite's refused-read check of `/`'s error view and which error views still rest on recorded runs. | `close-work` reads both rows whole. |
| Decision record | The owner's 2026-11-09 calls settle the brief's three 2a questions and the install file's start. | This spec's Assumptions; the overview's `src/app` row as current behavior | Owner | The Assumptions entries; the overview row | `close-work` confirms the overview states them as current behavior. |
| Design reference | The comparison page is the reference for AC-0017. | The brief's Design artifacts section | Owner | The AC-0017 entry in the verification ledger | `close-work` confirms that the brief still links the page. |
| Delivery coordination | This spec is a child of the brief. | The brief's Spec map; this spec's `workspace.toml` entry | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide. | None | None | None | None |
| Release history | None. The app has no version. | None | None | None | None |

## Boundaries

The owners the `Constrained by` line names state the rules this work follows. The lines below are this spec's own limits.

### Always do

- Keep every figure, control name, role, and Tab order the existing pages show, except where an acceptance criterion below changes one.
- Stop any app or test server you start by its own PID.

### Ask first

- Changing an expectation in an existing test beyond what AC-0019 allows.
- Any change to an existing table, function, operation, or view, or to the alert rules.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Add a page or route other than `/`, or a folder under `src/` other than `src/app/home/`.
- Add search or filters, which spec 2b owns, or anything the brief's Non-goals name.

## Testing Strategy

- **TDD against the local stack in Vitest (AC-0011, AC-0012, AC-0015, AC-0024, AC-0033)**: each is a value, a read, a refusal, or a privilege the database returns, checked against worked examples, each role, and the catalog.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0013, AC-0014, AC-0016, AC-0020, AC-0021, AC-0022, AC-0023, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0035)**: each is a page, list, figure, layout, or served file the owner meets, read from the page's roles, text, element boxes, and the rows the test seeded.
- **Goal-based check over the whole suite (AC-0018)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0017, AC-0019, AC-0034)**: the owner's comparison with the comparison page, a read of the branch's test diff, and a recorded run of the sign-in error view. `/sign-in` is built ahead of time and reads no data, so only a scratch throw in its code, served by `npm run dev`, makes it fail.

## Acceptance Criteria

### Getting to "Today"

- [ ] **AC-0001.** Signing in as an operator ends on `/`, which shows a page whose level-1 heading is "Today".
- [ ] **AC-0029.** The install file at `/manifest.webmanifest` sets `start_url` to `/`.
- [ ] **AC-0002.** In the side menu and in the phone menu, the first item is a link named "Today" to `/`, before "Receiving".
- [ ] **AC-0025.** On `/`, the "Today" link in each menu carries `aria-current="page"`.
- [ ] **AC-0003.** A signed-in non-operator who opens `/` sees the not-allowed page and none of the sections named below.

### The sections

- [ ] **AC-0030.** With every section filled, at 390 px, 1024 px, and 1280 px, at the default text size and with the browser's text size at 20 px, the page's sections run in this order, both in the page's source and on screen: "Sales and stock value", "Open alerts", "Today's entries", "Stock on hand". On screen, each section starts below the one before it, or on the same row to its right.

### Sales and stock value

- [ ] **AC-0011.** For a date, the daily sales view's total equals the sum of `lbs_sold × price_per_lb` over the sale items of that date's sales that are not voided, unrounded: with sales on that date of 100 lbs at $3.2900/lb and 50 lbs at $3.5000/lb, and a sale of 10 lbs at $3.0000/lb that is then voided, the total is 504.
- [ ] **AC-0012.** The stock value view's raw value equals the sum of `remaining_lbs × current_unit_cost` over every lot, its finished value equals the sum of `lbs_remaining × cost_per_lb` over every finished good, and its total equals the two added, unrounded: after receipts of 1,000 lbs at $1.6800/lb and then 500 lbs at $1.8000/lb of the made-up raw product RAW-TOM, a batch of its finished product 502 from 400 raw lbs (308 finished lbs at $2.6318/lb), and AC-0011's sales of 502, they are 1,908, 415.8244, and 2,323.8244.
- [ ] **AC-0014.** With AC-0012's receipts, batch, and sales, all dated the app's today, the "Sales and stock value" section shows four tiles: "Today's sales" with "$504.00", "Raw stock at cost" with "$1,908.00", "Finished stock at cost" with "$415.82", and "All stock at cost" with "$2,323.82", each figure inside the tile its label names.
- [ ] **AC-0013.** With no sale dated the app's today, or only voided ones, the "Today's sales" tile reads "$0.00".
- [ ] **AC-0027.** With no lot and no finished good, each of the three stock tiles reads "$0.00".
- [ ] **AC-0015.** For each of the three new views (daily sales, stock value, and stock on hand), `anon`'s read is refused, a signed-in non-operator reads no row, and an operator and `service_role` each read at least one row once the stack holds a product, a lot, and a sale that is not voided.
- [ ] **AC-0024.** In the catalog, neither `anon` nor `public` holds any privilege on the three new views, and `authenticated` and `service_role` each hold SELECT and no other privilege on them.

### Open alerts

- [ ] **AC-0004.** With open alerts, the "Open alerts" section lists each open alert's title in the order `/alerts` lists them.
- [ ] **AC-0026.** The "Open alerts" section holds a link named "See alerts" to `/alerts`, with open alerts and with none.
- [ ] **AC-0005.** With no open alerts, the "Open alerts" section reads "No open alerts."
- [ ] **AC-0021.** When the watch (the alert check each page load runs) fails, the "Open alerts" section reads "Alerts couldn't be checked." in place of its list.
- [ ] **AC-0006.** While an alert is urgent, the region named "Urgent alerts" is absent from `/` and `/alerts` and present on every other page the menus list.
- [ ] **AC-0022.** When the watch fails, the region named "Urgent alerts" is absent from `/`.
- [ ] **AC-0023.** While an alert is urgent, on `/` each of the three Alerts links (the side menu's, the phone menu's, and the top bar's) shows the urgent count.

### Today's entries

- [ ] **AC-0007.** For the app's today, the "Today's entries" section holds three lists, "Receipts", "Batches", and "Sales", across all products. Each receipt received that day shows its lot number, its product's code and description, and the weight Recent receipts shows for it. Each batch produced that day shows its batch number, its product's code and description, and the finished lbs Recent batches shows for it. Each sale dated that day shows its sale number, its product's code and description, and the customer and lbs Recent sales shows for it. No list holds an entry dated another day.
- [ ] **AC-0008.** In those lists, a voided receipt and a voided sale show the "Voided" tag, and a reversed batch shows the "Reversed" tag, as Recent receipts, Recent sales, and Recent batches show them.
- [ ] **AC-0009.** Each list's heading reads its name and its entry count, as "Receipts (2)", "Batches (0)", and "Sales (1)".
- [ ] **AC-0031.** A list with no entry reads "None today."

### Stock on hand

- [ ] **AC-0010.** The "Stock on hand" section lists every active product, and every inactive product whose lbs on hand are above 0, each with its code, description, and lbs on hand. A raw product's lbs on hand equal its `inventory_balances.qty_on_hand`, or 0 with no balance row. A finished product's equal the sum of `lbs_remaining` over its finished goods.
- [ ] **AC-0032.** With no product to list, the "Stock on hand" section reads "No stock on hand."

### Layout

- [ ] **AC-0016.** With the long values set, at 390 px, 1024 px, and 1280 px, at the default text size and with the browser's text size at 20 px, each money figure, each lbs figure, and each lot, batch, and sale number on `/` stays on one line inside the element that holds that one value: its tile, its table cell, or its line in a card, in whichever look its list takes at that width. The long values, all dated the app's today: receipts of 1,800,000 lbs and then 1,234,567.891 lbs of RAW-TOM at $1.6800/lb; a batch of 502 from the 1,800,000 raw lbs with a measured 1,386,000.123 finished lbs; and a sale of 1,000,000.123 lbs of 502 at $3.5000/lb. They leave RAW-TOM 1,234,567.891 lbs on hand and put the four money tiles at "$3,500,000.43", "$2,074,074.06", "$1,015,874.80", and "$3,089,948.86".
- [ ] **AC-0028.** With AC-0016's long values set, at the widths and text sizes AC-0016 names, `/` does not scroll sideways.

### Look and regressions

- [ ] **AC-0017.** The verification ledger records the owner's "match" verdict for `/` built from this branch at 1280 px, with made-up data in every section, compared with the comparison page at revision 1794121141-4df1, its "First screen and alerts" block (the MarketMan dashboard and the line on a "Today" home page). A "no match" fails this criterion. The test data's names, numbers, and dates do not count as differences, nor does anything the brief's Non-goals or the intent's Limits leave out.
- [ ] **AC-0018.** `npm test` passes.
- [ ] **AC-0019.** Read from the branch point with `main`, tracked and untracked, the only changed expectations in existing test files are these, each moved by the criterion named. The values, names, and orders the changed lines assert are otherwise unchanged. A test added to an existing file is not a changed expectation. A change the owner approves under Ask first, recorded in the verification ledger with its date, joins this list.
  - `test/e2e/auth.spec.ts`'s check that signing in ends on `/receiving` with the receiving form shown, and its operator sign-out test's check of the receiving form right after sign-in (AC-0001).
  - `test/e2e/hosting.spec.ts`'s Secure-cookie test's check that sign-in ends on `/receiving` (AC-0001).
  - `signInThroughForm` in `test/e2e/states.ts`, which waits for `/receiving` (AC-0001).
  - `test/e2e/hosting.spec.ts`'s install file with `start_url` `/receiving` (AC-0029).
  - `test/e2e/shell.spec.ts`'s page titles, links, and Tab lists, `test/e2e/shell-page.ts`'s stop lists, `test/e2e/production.spec.ts`'s menu-order rows, and any other existing check of the menus' items, links, or Tab stops that the added "Today" link moves (AC-0002).
- [ ] **AC-0020.** The browser suite's page-state check (`checkPageState`) reports no violation on `/` with every section filled, with every section in its empty state (AC-0005, AC-0013, AC-0027, AC-0031, AC-0032), and with an urgent alert open.
- [ ] **AC-0033.** Each of `/`'s reads (the daily sales, stock value, and stock on hand views, today's receipts, batches, and sales, and the open alerts) throws when the database refuses it, and returns no empty list, zero, or missing row in its place.
- [ ] **AC-0035.** When a read on `/` fails, `/` shows the error view headed "Today" with its "Try again" button, and no money tile. A failed watch is AC-0021's and AC-0022's case.
- [ ] **AC-0034.** When `/sign-in` fails to load, it shows the error view headed "Sign in" with its "Try again" button.

## Follow-ons

None. Spec 2b of the brief covers search and filters.

## Assumptions

- Technical: four existing checks read the page sign-in lands on: two in `test/e2e/auth.spec.ts`, one in `test/e2e/hosting.spec.ts`, and `signInThroughForm` in `test/e2e/states.ts`, which signs in both the operator and the non-operator. No existing test opens `/` signed in or reads the banner there (source: a search of `test/e2e/` for `signInThroughForm`, `goto("/")`, and `/receiving` checks, 2026-11-09)
- Technical: test setup never writes the tables `test/db.ts`'s opening comment protects; their rows come through the operations (source: `test/db.ts`; `SYSTEM-SPEC.md` §11)
- Technical: AC-0016's long values come through the operations: a rolled-back probe on stack A (2026-11-09) gave 502 a cost of $2.6318/lb and 386,000 lbs left, RAW-TOM 1,234,567.891 lbs on hand, and the totals 3500000.4305, 2074074.05688, and 1015874.8, and left no row
- Technical: `v_alerts` and `v_stock_value` read `lots`, and `v_alerts` reads `production_batches`, so refusing a table on a loaded `/` fails more than one read; a read called alone fails alone, and Vitest runs one file at a time (source: `supabase/migrations/20261016204845_alerts.sql`; `vitest.config.ts`)
- Technical: committed tests may refuse a read by revoking a grant and restoring it, as `revokeSaleItemsRead` (`test/e2e/sales-page.ts`) and `withWatchRefused` (`test/e2e/alerts-page.ts`) do; `/sign-in` is prerendered (source: those files; `.next/prerender-manifest.json`)
- Technical: through the operations, RAW-TOM and 502 give AC-0012's figures: a rolled-back probe on stack A (2026-11-09) gave 308 finished lbs at $2.6318/lb from 400 raw lbs, a daily total of 504, raw value 1908.0000000, and finished value 415.8244000, and left no row
- Technical: low stock is one of the five alert types (`low_stock`, medium), raised for an active raw product with under 7 days left at its 28-day use, so the open alerts carry it (source: `SYSTEM-SPEC.md`; `supabase/migrations/20261016204845_alerts.sql`)
- Technical: an operator reads every table and view, so today's receipts, batches, and sales can be read in `src/lib/` without a new view (source: the overview's Access model)
- Technical: a home-screen figure comes from an existing view or a new one, and every public relation carries explicit grants, so the money figures and the per-product lbs need new views through `supabase/migrations/` (source: the brief's Non-goals; `SYSTEM-SPEC.md` §11; `AGENTS.md` hard rules 2 and 7)
- Technical: a void sets a lot's `remaining_lbs` to 0, and a reversal sets its batch's finished goods' `lbs_remaining` to 0, so summing what remains counts only stock on the shelf (source: `supabase/migrations/20261007183252_corrections.sql`; `supabase/migrations/20261018205556_batch_reversal.sql`)
- Technical: the app's today is the app server's local date (source: `src/lib/app-today.ts`)
- Technical: `test/access.test.ts` reads every relation in `public` as `anon`, a non-operator, and an operator, and never as `service_role`; its fixture records a receipt, a batch, and a sale that is not voided (source: `test/access.test.ts`)
- Technical: a rolled-back probe on stack A (2026-11-09) gave the stock value view, built with `having count(*) > 0`, one row to `postgres`, an operator, and `service_role`, exact `numeric` values, and no row to a signed-in non-operator; without a revoke, `anon` passed the view and was refused only at `lots`. The transaction left no view and no row (source: the probe, run with `docker exec supabase_db_meat-ops psql`)
- Technical: Intl formats a number from its shortest decimal form, so `formatMoney(1.005)` and the text "1.005" both show "$1.01" (source: a Node 22 probe, 2026-11-09)
- Process: the experience-design skills (`creative-direction`, `design-review`) are not installed, so the comparison page and look E stand in as the design reference (source: the installed skills list, 2026-11-09)
- Process: the business owner gives no input to this work; the owner (the developer) makes every product call (source: the intent's Outcome section)
- Product: signing in and the installed app open "Today" at `/`. The owner reads the Guardrail's press count from the floor form, whose fields and presses are unchanged; reaching Receiving from "Today" takes one press from 1024 px up and two on a phone. This supersedes the app-hosting spec's `/receiving` start address (source: user confirmation 2026-11-09)
- Product: "Today" shows four sections in this order: the money figures, the open alerts, today's entries, and stock on hand (source: user confirmation 2026-11-09)
- Product: the urgent banner does not show on "Today", which lists the open alerts itself; `/alerts` shows none (source: user confirmation 2026-11-09; `src/app/page-header.tsx`)
- Product: both menus' first item is "Today" (source: user confirmation 2026-11-09)
- Product: a failed load of `/` shows the error view headed "Today" from a root error file, and `/sign-in`, which that file would otherwise cover, gets its own, headed "Sign in" (source: user confirmation 2026-11-09)
- Product: today's sales total is lbs times price per lb over today's sales, voids left out; stock value counts raw lbs on hand at each lot's current cost plus finished lbs on hand at each batch's cost per lb, over every product, active or not; Stock on hand lists every active product and any inactive one that still holds stock (source: user confirmation 2026-11-09)
