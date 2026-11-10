# Spec: home-screen

- **Status:** Draft <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints in the brief [`docs/product/briefs/ui-polish.md`](../../product/briefs/ui-polish.md), including the intent's Guardrail it points to; the screen rules in the `src/app` row, the `supabase/migrations/` row, and the Access model in [`docs/architecture/overview.md`](../../architecture/overview.md); [`docs/costing.md`](../../costing.md); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** docs/product/briefs/ui-polish.md
- **Discovery:** none
- **Contract:** none (two database views read only by this app; no published interface)
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

Right after signing in, the business owner sees where the business stands today on one page, the home screen named "Today". This is spec 2a of the brief.

Success for the business owner:

- Signing in opens "Today", and the side menu lists it first; floor staff reach Receiving in one press.
- "Today" shows the open alerts, low stock among them, so the owner needs no other page to learn what needs attention.
- It lists today's receipts, batches, and sales across every product, so no product page has to be opened to piece the day together.
- It shows how much of each product is on hand.
- It shows today's sales total and the value of the stock on hand at cost, computed in the database.

The intent's Input measure falls from at least three pages to one. The design reference is the comparison page named in the brief's Design artifacts.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/home-screen/`. At closeout, the overview, SYSTEM-SPEC, the costing reference, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current product truth: the views | SYSTEM-SPEC's data model lists every view. | `SYSTEM-SPEC.md`, the views list | `work-loop` implementer | The list names the daily sales view and the stock value view with their columns. | `close-work` reads the list against the migration. |
| Current product truth: the money figures | The costing reference defines every figure the engine computes. | `docs/costing.md`, a section on today's sales and stock value | `work-loop` implementer | The section defines both figures and gives AC-0011's and AC-0012's worked examples. | `close-work` reads it against the views. |
| Current architecture: the screens | The overview's `src/app` row describes each page, the side menu, the banner, and where sign-in lands. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names "Today" at `/`, its four sections, the menu's first item, sign-in landing there, and the banner's absence there. | `close-work` reads the row whole against the code. |
| Current architecture: the database and access | The `supabase/migrations/` row and the Access model list each view and who reads it. | `docs/architecture/overview.md`, the `supabase/migrations/` row and the Access model | `work-loop` implementer | Both name the two views, `security_invoker`, and their grants. | `close-work` reads both against the migration. |
| Current architecture: the test suites | The overview's `test/` and `test/e2e/` rows list each suite. | `docs/architecture/overview.md`, the `test/` and `test/e2e/` rows | `work-loop` implementer | The rows list this spec's new Vitest and browser suites. | `close-work` reads both rows whole. |
| Decision record | The owner's 2026-11-09 calls settle the brief's three 2a questions. | This spec's Assumptions; the overview's `src/app` row as current behavior | Owner | The Assumptions entries; the overview row | `close-work` confirms the overview states them as current behavior. |
| Design reference | The comparison page is the reference for AC-0017. | The brief's Design artifacts section | Owner | The AC-0017 entry in the verification ledger | `close-work` confirms that the brief still links the page. |
| Delivery coordination | This spec is a child of the brief. | The brief's Spec map; this spec's `workspace.toml` entry | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide. | None | None | None | None |
| Release history | None. The app has no version. | None | None | None | None |

## Boundaries

### Always do

- Keep every figure, control name, role, and Tab order the existing pages show, except where an acceptance criterion below changes one.
- Show every figure through `src/lib/format.ts`, and take every money total from the database.
- Give each new view `security_invoker = true` and the same grants the existing views have, so row-level security decides what each caller reads.
- Take every color from a token defined in `src/app/globals.css`, every radius from a theme token or `rounded-full`, and every font size from a theme token. Never use an arbitrary value for any of them.
- Run `npm test` in full before handing a task back, and stop any app or test server you started by its PID.

### Ask first

- Changing an expectation in an existing test beyond what AC-0019 allows.
- Any change to an existing table, function, operation, or view, or to the alert rules.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Compute a cost, price, average, margin, or money total in `src/`.
- Write to the hosted project.
- Add search or filters, which spec 2b owns, or any figure, control, or page the brief's Non-goals name.

## Testing Strategy

- **TDD against the local stack in Vitest (AC-0011, AC-0012, AC-0015)**: in a new `test/home-figures.test.ts` and the existing `test/access.test.ts`. Each is a value the database returns or refuses, checked against worked examples and roles.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0013, AC-0014, AC-0016, AC-0020, and AC-0021)**: in a new `test/e2e/home.spec.ts`. Each is a page, list, figure, or layout the owner sees, read from the page's roles, text, element boxes, and the database rows the test seeded.
- **Goal-based check over the whole suite (AC-0018)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0017, AC-0019)**: the owner's comparison with the comparison page, and a read of the branch's test diff.

## Acceptance Criteria

### Getting to "Today"

- [ ] **AC-0001.** Signing in as an operator ends on `/`, which shows a page whose level-1 heading is "Today".
- [ ] **AC-0002.** On each page with the side menu or the phone menu, each menu's first item is a link named "Today" to `/`, before "Receiving", and on `/` that link carries `aria-current="page"`.
- [ ] **AC-0003.** A signed-in non-operator who opens `/` sees the not-allowed page and none of the sections named below.

### Open alerts

- [ ] **AC-0004.** With open alerts, the "Open alerts" section lists each open alert's title in the order `/alerts` lists them, and holds a link named "See alerts" to `/alerts`.
- [ ] **AC-0005.** With no open alerts, the "Open alerts" section reads "No open alerts."
- [ ] **AC-0021.** When the alert check fails, the "Open alerts" section reads "Alerts couldn't be checked." in place of its list.
- [ ] **AC-0006.** While an alert is urgent, the region named "Urgent alerts" is absent from `/` and `/alerts`, and present on each of the other eight pages the side menu lists, and the side menu's Alerts link shows the urgent count on `/` as on those pages.

### Today's entries

- [ ] **AC-0007.** For the app's today, the "Today's entries" section lists, across all products, each receipt received that day with its lot number, product, and weight, each batch produced that day with its batch number, product, and finished lbs, and each sale dated that day with its sale number, customer, and lbs, each value as Recent receipts, Recent batches, or Recent sales shows it. It lists no receipt, batch, or sale dated another day.
- [ ] **AC-0008.** In those lists, a voided receipt and a voided sale show the "Voided" tag, and a reversed batch shows the "Reversed" tag, as Recent receipts, Recent sales, and Recent batches show them.
- [ ] **AC-0009.** Each of the three lists names how many entries it holds, and a list with none reads "None today."

### Stock on hand

- [ ] **AC-0010.** The "Stock on hand" section lists every active product with its lbs on hand: a raw product's equals its `inventory_balances.qty_on_hand`, or 0 with no balance row, and a finished product's equals the sum of `lbs_remaining` over its finished goods.

### Money figures

- [ ] **AC-0011.** For a date, the daily sales view's total equals the sum of `lbs_sold × price_per_lb` over the sale items of that date's sales that are not voided, unrounded: with sales on that date of 100 lbs at $3.2900/lb and 50 lbs at $3.5000/lb, and a voided sale on it of 10 lbs at $3.0000/lb, the total is 504.
- [ ] **AC-0012.** The stock value view's raw value equals the sum of `remaining_lbs × current_unit_cost` over every lot, its finished value equals the sum of `lbs_remaining × cost_per_lb` over every finished good, and its total equals the two added, unrounded: with lots holding 600 lbs at $1.6800/lb and 400 lbs at $1.8000/lb, and finished goods holding 200 lbs at $2.6318/lb, they are 1,728, 526.36, and 2,254.36.
- [ ] **AC-0013.** With no sale dated the app's today, the home screen's sales figure reads "$0.00"; with no lot and no finished good, each stock value figure reads "$0.00".
- [ ] **AC-0014.** The home screen shows today's sales total and the stock value's raw, finished, and total figures as the views return them, each through `src/lib/format.ts` at 2 decimals: with AC-0011's sales dated today and AC-0012's stock, "$504.00", "$1,728.00", "$526.36", and "$2,254.36".
- [ ] **AC-0015.** Both new views are among the relations `test/access.test.ts` reads, and its checks for `anon`, a signed-in non-operator, and an operator pass, the overview's Access model being the rule they check.

### Layout

- [ ] **AC-0016.** At 390 px, 1024 px, and 1280 px, at the default text size and with the browser's text size at 20 px, every figure on `/` (a value's text before its first space) stays on one line inside its box, and the page does not scroll sideways.

### Look and regressions

- [ ] **AC-0017.** The verification ledger records the owner's "match" verdict for `/` built from this branch at 1280 px, with made-up data in every section, compared with the comparison page at revision 1794121141-4df1, its "First screen and alerts" block (the MarketMan dashboard and the line on a "Today" home page). A "no match" fails this criterion. The test data's names, numbers, and dates do not count as differences.
- [ ] **AC-0018.** `npm test` passes.
- [ ] **AC-0019.** Read from the branch point with `main`, tracked and untracked, the only changed expectations in existing test files are those that read where signing in lands (and a helper that waits for that page), what `/` shows when signed in, the two menus' items, links, and Tab stops (the added "Today" link), and the urgent banner on `/`. The values, names, and orders the changed lines assert are otherwise unchanged. A test added to an existing file is not a changed expectation. A change the owner approves under Ask first, recorded in the verification ledger with its date, joins this list.
- [ ] **AC-0020.** The browser suite's page-state check (`checkPageState`) reports no violation on `/` with every section filled, with every section empty, and with an urgent alert open.

## Follow-ons

None. Spec 2b of the brief covers search and filters.

## Assumptions

- Technical: `/` redirects to `/receiving`, and signing in lands on `/receiving`; `test/e2e/auth.spec.ts` checks both (source: `src/app/page.tsx`; `src/app/sign-in/actions.ts`, 2026-11-09)
- Technical: low stock is one of the five alert types (`low_stock`, medium), raised for an active raw product with under 7 days left at its 28-day use, so the open alerts carry it (source: `SYSTEM-SPEC.md`; `supabase/migrations/20261016204845_alerts.sql`)
- Technical: an operator reads every table and view, so today's receipts, batches, and sales and each product's lbs on hand can be read in `src/lib/` without a new view (source: the overview's Access model)
- Technical: a money total must come from the database, so the two money figures need new views with RLS and grants through `supabase/migrations/` (source: `SYSTEM-SPEC.md` §11; `AGENTS.md` hard rules 2, 3, and 7)
- Technical: a void sets a lot's `remaining_lbs` to 0, so summing remaining lbs times cost counts only stock on the shelf; finished goods carry their own `cost_per_lb` and `lbs_remaining` (source: `supabase/migrations/20261007183252_corrections.sql`; `supabase/migrations/0001_init.sql`)
- Technical: the app's today is the app server's local date, and the app passes it to the database where a date matters (source: `src/lib/app-today.ts`; `SYSTEM-SPEC.md`)
- Technical: `test/access.test.ts` reads every relation in `public`, views included, so new views join its checks (source: `test/access.test.ts`)
- Process: the experience-design skills (`creative-direction`, `design-review`) are not installed, so the comparison page and look E stand in as the design reference (source: the installed skills list, 2026-11-09)
- Process: the business owner gives no input to this work; the owner (the developer) makes every product call (source: the intent's Outcome section)
- Product: signing in lands on "Today" at `/` (source: user confirmation 2026-11-09)
- Product: "Today" shows four sections: the open alerts, today's entries, stock on hand, and the money figures (source: user confirmation 2026-11-09)
- Product: the urgent banner shows on every page but "Today", which lists the open alerts itself (source: user confirmation 2026-11-09)
- Product: the side menu's first item is "Today" (source: user confirmation 2026-11-09)
- Product: today's sales total is lbs times price per lb over today's sales, voids left out; stock value counts raw lbs on hand at each lot's current cost plus finished lbs on hand at each batch's cost per lb (source: user confirmation 2026-11-09)
