# Plan: look-production-sales-trace

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** spec 2's built Receiving page (`src/app/receiving/`: `page.tsx`'s `MAIN_GRID` through `PageShell`'s `fullWidth` and `mainClassName`, `#product-region` as `display: contents`, `recent-receipts.tsx`'s table look and `status-has-message` full-row rule) and its suite `test/e2e/look-pages.spec.ts`; the `receipt-table` container variant in `src/app/globals.css`, whose 20 px text test shows a rem container threshold moving with the text size; the three pages in `src/app/production/`, `src/app/sales/`, and `src/app/trace/` with their helpers `test/e2e/production-page.ts`, `sales-page.ts`, and `trace-page.ts`.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/<feature>/notes/verification-ledger.md` (or the adopter's
> equivalent). A genuine artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round. Treating them as
> contract is how a review spends a round on prose no gate consumes; the
> measured share is over half the plan's lines. `Grounding` stays *recorded*,
> because a per-task resolution that nobody wrote is not grounding; what it stops
> being is a claim a reviewer holds the plan to.

## Approach

The Pricing and Receiving leftovers come first, because they set the "table when it has room" pattern on code that already has tests. Production follows, built like Receiving, then Sales and Trace, each reusing what the one before it built. A last task records what only a person or a diff read can check.

The riskiest part is keeping the existing Production, Sales, and Trace suites green while the layout changes. The design keeps every element they find (each named status, region, dialog, `#product-region`, `#product-facts`, `[data-result-focus]`, each figure's `dt` and `dd`) and moves only how they are laid out.

## Constraints

- The brief's Constraints: 44 px controls, the 3:1 focus outline, made-up data only on canvas boards, and every table or card layout picking its look from its own section's room.
- The look-and-shell shell and its tests: `<main>`'s first child stays the title-and-banner `div`; a page's own status stays out of `main > div > [role=status]`.
- `AGENTS.md`: no em dashes, `type(scope): description` commits, `npm ci --ignore-scripts`, and the folder check before any test run or stack stop.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T5's owner comparison with the canvas and its two diff reads.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Overview `src/app` row: the three pages | T2, T3, T4, T6 | The row names the three pages' desktop layouts, Production's stock tiles, and the lists that read as tables when they have room. | `close-work` reads the row whole against the code. |
| Overview look notes: the table switches | T1, T6 | The notes say each list picks its table look from its own section's width in rem, and that the Pricing list does the same. | `close-work` reads them. |
| Overview `test/` row | T1 | The row lists `look-tidy.test.ts`. | `close-work` reads the row whole. |
| Overview `test/e2e/` row | T2 | The row lists `look-floor-pages.spec.ts`. | `close-work` reads the row whole. |
| Intent `look-pricing-receiving-review-nits.md` | T1, T5, T6 | AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, and AC-0031 pass, the ledger records the `VALUE_CLASS` comment read, and the intent records the owner's 2026-11-05 Pricing answer. | `close-work` marks it Fulfilled and reconcile shows no finding. |
| Design reference: the canvas | T5 | The AC-0024 ledger entries name revisions 1793899703-bb47 and 1793856599-9c48. | The brief still links the canvas. |

## Design (LLD)

### Design decisions

- **Table when it has room.** Each list that can read as a table makes its section a named size container. Its header line and rows switch to the table look through Tailwind's container variants (or a named custom variant in `globals.css`) at a width in rem: the row's fixed columns, gaps, and padding plus room for its flexible column. A rem width moves with the text size, so a larger text size keeps the cards until the row fits, as Receiving's `receipt-table` already shows. Unlike `receipt-table`, these lists have no 1280 px screen gate. In the table look each label is hidden visually and stays in the page; the header line is `aria-hidden="true"`. `Facts` places its pairs on the row's columns either through a new `look` per table variant or through the list's own classes from outside (as the Pricing list does); either keeps AC-0025, since a new look only chooses classes. Traces to: AC-0005, AC-0006, AC-0010, AC-0011, AC-0014, AC-0015, AC-0016, AC-0017, AC-0029, and AC-0030.
- **Production and Sales are built like Receiving.** Each page passes `fullWidth` and a grid through `mainClassName`: the title-and-banner `div` across the top, the form and the saved result in a 340 px left column, and the right column holding Production's "Product and raw stock" card and Recent batches, or Sales's Recent sales. Production's `#product-region` is `display: contents` from `desk` up, as on Receiving. No wrapping `div` is added, so no status lands in `main > div > [role=status]`. DOM order, and so Tab order, does not change. Traces to: AC-0001, AC-0002, and AC-0003, AC-0008, AC-0009.
- **Production's stock tiles.** `product-region.tsx` renders Product, Raw input, and Shrink as today's list and Raw on hand and Raw average cost through `Facts`'s "tiles" look, in today's order. Traces to: AC-0004.
- **Full-row messages.** A batch's "Batch reversed" panel and reverse refusal, and a sale's void refusal, take their row's full width in the table look through the same kind of rule as Receiving's `status-has-message`. Traces to: AC-0007, AC-0012, AC-0027.
- **Dialogs and status lines.** The check step and the Reverse batch and Void this sale? dialogs take Receiving's dialog classes, and the "Batch reversed" panel takes the "Receipt corrected" panel's. The "Reversed: ..." and "Void: ..." lines use the error color token. Traces to: AC-0024.
- **Trace.** From `desk` up the two find forms sit side by side on one grid row; the result below spans the content, with the Customers card beside "Sales from this lot" where both fit. The existing Trace and reverse suites find these parts by position, so the DOM keeps: each list's `ul` as its `h3`'s next sibling (a list's header line follows the `ul` in the DOM and is placed above it with `order`), the lot facts' `dl` and the sale trace's `ul` as direct children of their section, with no wrapping `div`. The board's lot card is drawn on the lot heading and the facts `dl` together: the heading carries the card's top edge and the `dl` its bottom edge. Each lot trace list's container is the wrapper `div` that already holds its `h3` and `ul` (and its header line), never the shared section, so Customers is outside Sales's container. The raw lot list is its section's only content, so its section is its container. Customers sits beside "Sales from this lot" when the lot result's own width (a container on the section's list row) has room for the Customers column and Sales's table together, as at 1280 px and 1440 px at the default text size, and above it otherwise. "Sales from this lot", "Finished stock on hand from this lot", and the raw lot list each follow the table-when-room pattern; the sale trace's "Where it came from" keeps its batch cards. Traces to: AC-0013, AC-0014, AC-0015, AC-0016, and AC-0028.
- **Pricing.** The Pricing list's table classes move from `wide:` to a container on the list, at a rem width that keeps the 1280 px details view (its list column about 608 px) a table and the 1024 px details view (about 352 px) cards. The advice block and the one-press button move their row placement (`col-span-full`, the row layout, the button's width) from `wide:` to the same container switch. Traces to: AC-0017 and AC-0031.
- **Receiving's Vendor column.** From 1280 px the receipt form's column narrows, or the receipt tracks rebalance, so a ten-letter vendor word fits whole and the section clears the `receipt-table` threshold with an always-visible scrollbar. The owner compares the result with S2-Receiving-Desktop again. Traces to: AC-0018, AC-0019.

### Component / module decomposition

- `src/app/globals.css`: any named container variants.
- `src/app/production/`: `page.tsx` (`fullWidth`, grid), `production-form.tsx`, `check-step.tsx`, `result-panel.tsx`, `product-region.tsx` (tiles), `recent-batches.tsx` (table look, full-row panel), `reverse-control.tsx` (dialog and panel classes).
- `src/app/sales/`: `page.tsx`, `sale-form.tsx`, `result-panel.tsx`, `recent-sales.tsx`, `void-dialog.tsx`, `voided-sales.tsx`.
- `src/app/trace/`: `page.tsx`, `find-forms.tsx`, `sale-trace.tsx`, `lot-list.tsx`, `lot-trace.tsx`.
- `src/app/pricing/`: `page.tsx` (both reads at once), `pricing-list.tsx` (container table look), `price-advice-block.tsx` and `apply-button.tsx` (row placement on the container switch). `src/app/receiving/`: `page.tsx` and `recent-receipts.tsx` (Vendor room, the "In use" fill). `src/app/facts.tsx`: the `VALUE_CLASS` comment, and any new `look` the tables use.

### Quality attributes (NFRs)

- **Contrast**: every text pair uses existing tokens; axe in the page-state check enforces them.
- **Targets**: every control stays at least 44 px from `--spacing-control`.

## Tasks

### T1: Pricing and Receiving fit their space, and the four tidy-ups land

**Depends on:** none
**Mode:** manual QA through the browser suite, and goal-based Vitest source checks
**Touches:** `src/app/globals.css`, `src/app/facts.tsx`, `src/app/pricing/page.tsx`, `src/app/pricing/pricing-list.tsx`, `src/app/pricing/price-advice-block.tsx`, `src/app/pricing/apply-button.tsx`, `test/look-tidy.test.ts`, `src/app/receiving/page.tsx`, `src/app/receiving/recent-receipts.tsx`, `test/e2e/look-pages.spec.ts`, `test/e2e/pricing-page.ts`, `test/e2e/pricing.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-pages.spec.ts`: AC-0017's widths, with the existing table and card helpers; AC-0018 with a receipt from a vendor named "Wholesale Provisions Company" (a `vendors` row the test adds), checking each word's text stays on one line; AC-0019 with the root's right padding set to 33 px at 1280 px, checking the header line is visible; it is seen failing on today's tree first. The AC-0017 checks replace the existing Pricing cards expectations at 1279 and 1024 px on `/pricing` and beside the panel at 1279 px (AC-0026).
- `look-pages.spec.ts`: AC-0031 at 1024 and 1279 px on `/pricing`, with a state that puts at least two products in "Needs a new price", checking each advice block and its button sit below that product's figures and span its row; AC-0017's 20 px step beside the panel at 1279 px.
- New Vitest `test/look-tidy.test.ts`: AC-0020 fails while `page.tsx` awaits `getPricingDetail` before it calls `listPricing`; AC-0021 fails while `detail()` returns a property named `main`; AC-0022 fails while the "In use" mark's fill token appears in any `border-` or `divide-` class under `src/app` or in a border rule in `src/app/globals.css`. Each is seen failing on today's tree first.
- The comment above `VALUE_CLASS` in `src/app/facts.tsx` no longer says "below the table", and says that the list classes apply where the section is not a table; T5 records the read.
- The existing Pricing, Receiving, correct, and alerts suites pass, with only the AC-0021 rename changing lines in `pricing.spec.ts`.

**Approach:**
- Move the Pricing table look onto a container; narrow or rebalance Receiving's columns from 1280 px; start both detail reads together; rename `detail()`'s region property; give "In use" its own fill token; reword the `VALUE_CLASS` comment.
- Describe the Pricing table switch and the container rule in the overview's look notes, and list `look-tidy.test.ts` in its `test/` row.

**Done when:** the T1 tests pass and `npm test` passes.

### T2: Production is built like Receiving

**Depends on:** T1
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/facts.tsx`, `test/e2e/shell.spec.ts`, `src/app/production/page.tsx`, `src/app/production/production-form.tsx`, `src/app/production/check-step.tsx`, `src/app/production/result-panel.tsx`, `src/app/production/product-region.tsx`, `src/app/production/recent-batches.tsx`, `src/app/production/reverse-control.tsx`, `test/e2e/look-floor-pages.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- New `test/e2e/look-floor-pages.spec.ts`, operator session, `resetTestData()` before each test, building states with `seed502Fixture`, `fillBatch`, and `saveThrough` from `test/e2e/production-page.ts` (three batches, one reversed through the page): AC-0001 for `/production`, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0027, and AC-0029 at the widths each names. The AC-0006 and AC-0029 steps that name 20 px set the root text size with `document.documentElement.style.fontSize`. Each 1280 px state also runs `checkPageState` and `checkDesktopWalk` and asserts the control list the existing Production tests define.
- The existing `production.spec.ts` and `reverse.spec.ts` pass unchanged. In `test/e2e/shell.spec.ts` the content-cap test's 544 px form check moves to a page that keeps the cap, and its check-step width check stays on `/production` (AC-0026).

**Approach:**
- Pass `fullWidth` and a grid from `/production`, make `#product-region` `display: contents` from `desk` up, split the stock facts into the tiles look, and give Recent batches its container table look and full-row panel rule. Restyle the form, check step, result, and reverse dialog as Receiving's are.
- Describe Production's layout in the overview's `src/app` row and list `look-floor-pages.spec.ts` in its `test/e2e/` row.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: Sales is built like Receiving

**Depends on:** T2
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/facts.tsx`, `src/app/sales/page.tsx`, `src/app/sales/sale-form.tsx`, `src/app/sales/result-panel.tsx`, `src/app/sales/recent-sales.tsx`, `src/app/sales/void-dialog.tsx`, `src/app/sales/voided-sales.tsx`, `test/e2e/look-floor-pages.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-floor-pages.spec.ts`, with states built from the helpers in `test/e2e/sales-page.ts` (three sales, one void through the page): AC-0001 for `/sales`, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, and AC-0030 at the widths each names, with `checkPageState` and `checkDesktopWalk` at 1280 px.
- The existing `sales.spec.ts` passes unchanged.

**Approach:**
- Pass `fullWidth` and a grid from `/sales`; give Recent sales its container table look and full-row refusal rule; restyle the form, result, and void dialog.
- Describe Sales's layout in the overview's `src/app` row.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: Trace sets its forms side by side and its lists as tables when they have room

**Depends on:** T3
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/facts.tsx`, `src/app/trace/page.tsx`, `src/app/trace/find-forms.tsx`, `src/app/trace/sale-trace.tsx`, `src/app/trace/lot-list.tsx`, `src/app/trace/lot-trace.tsx`, `test/e2e/look-floor-pages.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-floor-pages.spec.ts`, with states built from the helpers in `test/e2e/trace-page.ts` (`twoLotSale`, `threeBatchSale`, `receiveOn`): AC-0001 for `/trace`, AC-0013, AC-0014, AC-0015, AC-0016, and AC-0028 at the widths each names, with `checkPageState` and `checkDesktopWalk` at 1280 px.
- The existing `trace.spec.ts` and `reverse.spec.ts` pass unchanged, including their position-based lookups and the check that no status sits outside `main > div > [role=status]`.

**Approach:**
- Set the find forms side by side from `desk` up; give the three lists their container table looks; restyle the sale trace's batch cards.
- Describe Trace's layout in the overview's `src/app` row.

**Done when:** the T4 tests pass and `npm test` passes.

### T5: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3, T4, T6
**Mode:** visual and manual QA
**Touches:** `docs/specs/look-production-sales-trace/notes/verification-ledger.md`

**Tests:**
- AC-0024: the built app on `127.0.0.1` with the test data, captured at the head after T6, each screen in the state AC-0024 names, compared by the owner with its board, and the four dialogs and panel compared with Receiving's; the ledger records each verdict.
- AC-0023: `npm test` on the branch head after T1 to T4 and T6, its pass counts and run time in the ledger.
- AC-0020, AC-0021, and AC-0022: the T1 Vitest checks pass at the head. The ledger records the read of the comment above `VALUE_CLASS`.
- AC-0025: `git diff "$(git merge-base main HEAD)" -- src/app/facts.tsx src/app/before-after.tsx` read in full; the ledger records the result.
- AC-0026: `git diff "$(git merge-base main HEAD)" -- test/e2e` read in full, plus every file `git ls-files --others --exclude-standard -- test` lists; the ledger lists each changed expectation in an existing test file.

**Approach:**
- Reuse `.context/recorded-run/s2-captures.spec.ts`'s pattern for the screenshots, run with `PLAYWRIGHT_FORCE_ASYNC_LOADER=1` after `npm run build`, and stop every process it starts by its PID.

**Done when:** the ledger records the owner's "match" for each of the seven boards and the dialog comparison, the AC-0023 pass, the `VALUE_CLASS` comment read, the AC-0025 read, and the AC-0026 list, and each of these records names the commit it read, at or after T6's last commit.

### T6: The round 1 review fixes land, and the saved result stays under the form

**Depends on:** T1, T2, T3, T4
**Mode:** manual QA through the browser suite, and goal-based checks of the shared module, the test helpers, and the ledger map
**Touches:** `src/app/before-after.tsx`, `src/app/globals.css`, `src/app/facts.tsx`, `src/app/form-column-grid.ts`, `src/app/production/page.tsx`, `src/app/production/result-panel.tsx`, `src/app/production/recent-batches.tsx`, `src/app/production/reverse-control.tsx`, `src/app/sales/page.tsx`, `src/app/sales/result-panel.tsx`, `src/app/sales/recent-sales.tsx`, `src/app/receiving/page.tsx`, `src/app/receiving/result-panel.tsx`, `src/app/receiving/correct-dialog.tsx`, `src/app/receiving/recent-receipts.tsx`, `test/e2e/production-page.ts`, `test/e2e/sales-page.ts`, `test/e2e/trace-page.ts`, `test/e2e/receiving-page.ts`, `src/app/trace/lot-list.tsx`, `src/app/trace/lot-trace.tsx`, `src/app/trace/sale-trace.tsx`, `test/e2e/look-floor-pages.spec.ts`, `docs/architecture/overview.md`, `docs/product/intents/look-pricing-receiving-review-nits.md`

**Tests:**
- In `test/e2e/look-floor-pages.spec.ts`: AC-0032 with ten recent rows built through each page's helpers and a result saved through the page, finding each page's own form by role and name ("New batch", "New sale", "New receipt") and measuring its Save button, its bottom edge, and the saved result's top, with 1rem read at each size; AC-0033 with a result saved through each page, at the four sizes it names, against each result card's right edge less its computed right padding; AC-0034 with one batch reversed through `/production` and one receipt corrected through `/receiving`, at the three sizes it names, against each batch's or receipt's right edge less its computed right padding. Each AC-0033 and AC-0034 state shows every before-and-after table its card or panel can hold, with every Before and After weight and cost at the long-figure lengths the list-table bullet below gives its weight and cost columns: the stock the saved result, the reversed batch, and the corrected receipt act on is built that large, and the receipt correction changes the cost of a lot a batch drew from, so the "Cost per finished lb" table shows. In those tables, every cell's text, row labels included, stays inside its cell, and the no-split half of the fit check covers the Before and After cells; a row label may wrap.
- A helper in `test/e2e/production-page.ts`, `sales-page.ts`, `trace-page.ts`, or `receiving-page.ts` may gain a parameter for a long figure; every existing caller keeps its values.
- Each table check on Recent batches, Recent sales, and Trace's three lists also runs on rows with long figures: every weight column (Raw lbs in, Finished lbs out, Lbs, Lbs drawn, Lbs on hand, Weight) holds a six-digit weight with three decimals, such as 123,456.789 lbs, and Cost per finished lb and Price per lb hold $10 or more. The check fails when a number's text runs past its cell or splits across lines, as Receiving's long-row test in `look-pages.spec.ts` does, while a unit that drops under its number passes. Recent sales' sale-number check measures the number's cell, not its link.
- The sale trace's heading meets its facts list as the lot trace's does, and the sale trace's batch-card test fails when a batch loses its card. Production's reverse-refusal test checks that the refusal ends inside its batch, as the Sales copy does.

**Approach:**
- On Production and Receiving, the grid row below the result's own row takes a long list's extra height, so the result starts under the form at any list length. The three pages take the shared form-column grid (columns, gap, and the `wide` step) from `src/app/form-column-grid.ts`, and each page names its own rows and areas there or beside it; the `batch-table` and `sale-table` comments point at that module.
- Commit `e7912b3`'s saved-result table steps belong to this task. The steps answer only to the card that holds the table: each saved-result card and each "Batch reversed" and "Receipt corrected" panel names one shared container, and the two steps are named custom variants on it in `globals.css` like the others, so a list section's container never reaches a `BeforeAfter`. `before-after.tsx` and `facts.tsx` change class strings and comments only (AC-0025).
- The control's own "Reversed:" line in `reverse-control.tsx` takes the same table alignment as the list's line.
- In `look-floor-pages.spec.ts`, each assertion shape the Production, Sales, and Trace tests share (the AC-0001 cap check, the card check, the row-and-column check, the fit check, and button containment) lives in one helper; per-test setup stays inline.
- In `facts.tsx`, each distinct class string is written once, and every look still only chooses classes. The trace card's two halves (the heading's top half and the facts list's bottom half) and the gap the heading cancels come from one source.
- Each use of the header-after-the-list `order` trick names the suite lookup it serves (`trace.spec.ts`'s `h3 + ul > li`), or is dropped where it serves none.
- The overview and the `globals.css` comments state the widths the code produces at the default text size (Recent batches shows its table from about 1260 px with the 340 px column; Customers sits beside "Sales from this lot" from about 1144 px). The intent records the owner's 2026-11-05 Pricing answer and drops that question.

**Done when:** the T6 tests pass; `/production`, `/sales`, and `/receiving` take the form-column grid from `src/app/form-column-grid.ts`; in `look-floor-pages.spec.ts` the AC-0001 cap check, the card check, the row-and-column check, the fit check, and button containment (Production and Sales only) each live in one helper that every test checking that shape calls; the T6 ledger entry lists each of the 15 sustained round 1 findings with the commit and the file and line that resolve it; and `npm test` passes.

## Rollout

Big bang, in one PR. Rollback is a revert. No data, schema, or hosted setting changes. Until spec 3b ships, Menu, Invoices, Ask, and Alerts keep their own content in the old layout inside the shell, which the brief accepts.

## Risks

- A list's table threshold set too low clips or wraps figures at the narrowest width that shows the table; each table criterion's fit check at its narrowest named width catches it.
- Changing Receiving's column widths reopens the owner's sign-off for S2-Receiving-Desktop; AC-0024 includes it.

## Changelog

- 2026-11-05: initial plan, after the owner's split of spec 3, the "size to its space" rule, the result under the form, Production's tiles, and the Pricing table rule.
- 2026-11-05: after the round 1 reviews: shell.spec.ts's content-cap test moves its form check (AC-0026); the Pricing advice row follows the container switch (AC-0031); the Trace DOM keeps the positions its suites read; the Trace and Pricing 20 px cases stop forcing a look; button containment is its own criterion per page; AC-0020 to AC-0022 are Vitest checks; the dialogs join the owner's comparison.
- 2026-11-05: after the round 2 reviews: T1's AC-0019 test takes 33 px; AC-0031 builds a state with advice; the comment read names its defect; AC-0022's search covers globals.css border rules; each Trace list's container is its own wrapper, the lot card is drawn on the heading and the facts list together; the overview's test/ row names look-tidy.test.ts.
- 2026-11-05: controlled amendment after the post-gates round 1 reviews, on the owner's approval: new task T6 owns commit `e7912b3`'s saved-result table steps and every sustained round 1 finding, and keeps the saved result under the form on Production and Receiving at any list length; T5 runs after T6.
