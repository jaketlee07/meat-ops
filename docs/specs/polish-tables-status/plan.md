# Plan: polish-tables-status

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the look E pages and their suites: Receiving's Recent receipts (`src/app/receiving/recent-receipts.tsx`, its `receipt-table` variant and its "In use" mark) and `test/e2e/look-pages.spec.ts`; Recent sales and Recent batches (`src/app/sales/recent-sales.tsx`, `src/app/production/recent-batches.tsx`, `src/app/production/reverse-control.tsx`) and `test/e2e/look-floor-pages.spec.ts` with `expectTable` in `test/e2e/look-checks.ts`; the shared label-and-value list `src/app/facts.tsx`, whose `look` prop only chooses classes; the lot card's three-column facts in `src/app/trace/lot-trace.tsx` (`card-cols`, the `lot-wide` variant). Uncertainty: whether Recent receipts still reads as a table at 1280 px with 33 px taken (see Risks).

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/polish-tables-status/notes/verification-ledger.md`. A genuine
> artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

Status tags come first, because three later tasks place them. Recent receipts and Recent sales follow, since their rows take the tags and need the width the tags and side-by-side buttons claim. The stock tiles and the sale trace are independent of both. The weight pass runs after the pages it reads have their new markup, and a last task records what only a person or a diff read can check.

The riskiest part is the width of Recent receipts at 1280 px. A read-only probe of the running app on 2026-11-08 measured the section at 688 px, today's columns at 92, 56, 114, 88, 88, 88, and 92 px with 6 px gaps and 16 px side padding, a lot number at 126 px and a date at 88 px on one line at 14 px text, and the Void button at 67 px. Separate one-line columns plus side-by-side buttons would leave Vendor about 93 px short. Stacking the date over the lot number in one cell, sizing the three figure columns to their content, and slimming the buttons fits the row in about 644 px.

## Constraints

- The brief's Constraints and the intent's Guardrail: no costing outside the engine, 44 px controls, the focus outline, and the contrast and axe checks.
- Spec 1b owns the form column's field layout, its label style, and the results under the form; this plan changes none of them. The `list` look of `Facts` and `BeforeAfter`, which the saved results use, keep their classes.
- The look E shell and its tests: `<main>`'s first child stays the title-and-banner `div`; a page's own status stays out of `main > div > [role=status]`.
- `AGENTS.md`: no em dashes, `type(scope): description` commits, `npm ci --ignore-scripts`, and the folder check before any test run or stack stop.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T5's owner comparison with the comparison page and its test-diff read.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Overview `src/app` row: the screens | T1, T2, T3, T4, T6 | The row names the status tags, "No list price yet" as quiet text, the stacked first cell, side-by-side Void and Correct, Recent sales' order, the Pricing advice box, the Menu switch, the stock tiles, and the sale trace's columns. | `close-work` reads the row whole against the code. |
| `globals.css` token comments and the overview's look notes | T1, T3, T4, T6 | Each new token's and variant's comment names its use; the look notes name the tag, the switch, the new `quiet` look, and the restyled `card` and `plain` looks. | `close-work` reads both. |
| Overview `test/e2e/` row | T1, T6 | The row lists `test/e2e/look-polish-tables.spec.ts`. | `close-work` reads the row whole. |
| Intent `look-production-sales-trace-review-nits.md` | T3, T5 | AC-0014 and AC-0015 pass, and the ledger names the two gaps they close. | The intent stays open until spec 1b ships. |
| Design reference: the comparison page | T5 | The AC-0016 ledger entries name revision 1794121141-4df1. | The brief still links the page. |

## Design (LLD)

### Design decisions

- **One status tag.** A new `src/app/status-tag.tsx` renders a `rounded-full` pill on `--color-mark-fill` with the word in `--color-ink`, and a small dot before the word, `aria-hidden`, colored by a `tone` prop: `priced` or `nocost`, mapped to the two status tokens. Ink on `--color-mark-fill` is about 14:1, so AC-0003 holds for every tone. The word stays the text the tests find, inside the element the suites already read (Menu's status `p`, the receipt's actions cell). Traces to: AC-0001, AC-0002, AC-0003.
- **"No list price yet" as quiet text.** Where it appears, the word keeps its element and takes `text-ink-secondary`, and `font-normal` outside the New sale form, whose weights spec 1b sets. Traces to: AC-0023, AC-0024.
- **Voids and reversals.** "Voided" and "Reversed" become tags in the row's actions column, and the reason becomes its own line in `--color-ink-secondary` at weight 400. In the table look the reason spans the row below its figures through a variant like `status-has-message`; in the card look it follows the figures. `reverse-control.tsx`'s own "Reversed: <reason>" line, drawn when the list re-render is skipped, takes the same tag and reason line. Traces to: AC-0004, AC-0005.
- **Two-line first cell.** In Recent receipts the first column shows the Received date with the lot number under it in `text-sm` secondary ink; in Recent sales, the sale date with the sale number under it. Each line is `whitespace-nowrap`. The header line names the first column "Received" or "Sale date", and the three figure columns size to their content. The shipped table tests change their header names and column checks to match, as the owner approved on 2026-11-08. Traces to: AC-0006, AC-0018.
- **Quiet, side-by-side actions.** Void and Correct sit in one flex row with a 6 px gap, each an outlined button in `--color-ink` on `--color-surface` with a `--color-field-border` border, 44 px tall, `px-3`. The Void confirmation dialogs keep their red confirm buttons. Traces to: AC-0007, AC-0008.
- **Recent sales order.** A pure function in a new `src/app/sales/recent-order.ts` orders the rows `listRecentSales` returns, by `saleDate` then `createdAt`, both newest first. `src/lib/sales.ts` and its query stay as they are, so the same 10 sales show. Traces to: AC-0009, AC-0020.
- **Pricing advice and button.** `price-advice-block.tsx`'s row and stacked looks put the sentence at weight 400 in a box filled with `--color-advice-fill`, text in `--color-advice-text` (about 7:1); `apply-button.tsx`'s row look becomes an outlined button with `--color-primary` text and border. Traces to: AC-0010, AC-0011.
- **Menu switch.** The native checkbox keeps its element, role, and label, styled with `appearance-none` as a `rounded-full` track with a `before:` knob that moves right and a `checked:` primary fill. Off, the track is `--color-surface` with a `--color-field-border` edge and the knob is `--color-field-border` (about 4.8:1 on white); on, the track is `--color-primary` and the knob `--color-surface` (about 6.7:1). Traces to: AC-0012, AC-0021.
- **Weight.** Cells, card values, and advice that are bold today drop to 400 or 500 on the surfaces AC-0013 lists. The stock cards' non-tile facts take a new `Facts` look, `quiet`, that only chooses classes; the `list` look stays as it is, so 1b's saved results and the open panels and dialogs keep their weight. Traces to: AC-0013.
- **Stock tiles.** The `tiles` look adds `whitespace-nowrap` to each value, and the two tiles stack where the card is too narrow for both, through a container variant set in rem. The look still only chooses classes. Traces to: AC-0014, AC-0022.
- **Sale trace columns.** The sale trace is the only user of `Facts`' `card` and `plain` looks (a `grep` of `src/app`, 2026-11-08), so the owner ruled on 2026-11-08 that both are restyled in place, still only choosing classes: each pair a column with its label above its value, the pairs in a grid inside a container variant like `lot-wide`. `card` keeps its white bottom half (`CARD_BOTTOM`) for the sale's facts; `plain` draws no card edge for the facts inside each batch card and raw lot block. The lot card keeps `card-cols`. Traces to: AC-0015.

### Component / module decomposition

- New: `src/app/status-tag.tsx` (the tag), `src/app/sales/recent-order.ts` (the order), `test/e2e/look-polish-tables.spec.ts` (the browser suite), and the verification ledger.
- Changed: listed in each task's Touches.

### Quality attributes (NFRs)

- Accessibility: every tag keeps its word, so color is never the only signal; the dot is `aria-hidden`; the switch keeps its checkbox semantics and focus ring; every new text-on-fill pair clears 4.5:1, and the switch's edge and knob clear 3:1.

## Tasks

### T1: Every status reads as a tag, and voids and reversals show a quiet reason

**Depends on:** none
**Mode:** manual QA through the browser suite
**Touches:** `src/app/status-tag.tsx`, `src/app/globals.css`, `src/app/menu/menu-list.tsx`, `src/app/pricing/pricing-list.tsx`, `src/app/pricing/pricing-detail.tsx`, `src/app/sales/sale-form.tsx`, `src/app/receiving/recent-receipts.tsx`, `src/app/sales/recent-sales.tsx`, `src/app/production/recent-batches.tsx`, `src/app/production/reverse-control.tsx`, `test/e2e/look-polish-tables.spec.ts`, `test/e2e/receiving.spec.ts`, `test/e2e/correct.spec.ts`, `test/e2e/look-pages.spec.ts`, `test/e2e/look-floor-pages.spec.ts`, `test/e2e/reverse.spec.ts`, `test/e2e/sales.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are computed styles and boxes in a browser.
- New `look-polish-tables.spec.ts`: AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0023, and AC-0024, each seen failing on today's tree first. The state is a product with no list price, a raw product with one untouched, one in-use, and one voided receipt, three sales with one voided, and two batches with one reversed, built through the existing page helpers (`receiving-page.ts`, `sales-page.ts`, `production-page.ts`). Every void and reversal in this state uses the reason "Entered twice by mistake". The page is reloaded after the reversal, so AC-0005 is measured with no panel or refusal open. AC-0003 computes the contrast ratio from each tag's computed text and fill colors.
- The existing assertions on "Void: <reason>" and "Reversed: <reason>" text move to the "Voided" or "Reversed" tag plus the reason's own text, and nothing else in those lines changes (AC-0018): `receiving.spec.ts` lines 713, 719, 723, 801, 846, 900, 945, and 1021; `correct.spec.ts` line 108; `look-pages.spec.ts` line 554; `look-floor-pages.spec.ts` line 325; `reverse.spec.ts` lines 89, 195, 298, and 399; `sales.spec.ts` lines 887, 900, 1050, 1134, and 1215.

**Approach:**
- Add the tag and its dot tokens; place it on each status word; quiet "No list price yet"; move each reason to its own secondary line, in the list and in `reverse-control.tsx`.
- Describe the tag in the overview's `src/app` row and look notes, and list the new browser suite in its `test/e2e/` row.

**Done when:** the T1 tests pass and `npm test` passes.

### T2: Recent receipts and Recent sales keep IDs whole, sit actions side by side, and list sales by date

**Depends on:** T1
**Mode:** manual QA through the browser suite
**Touches:** `src/app/receiving/recent-receipts.tsx`, `src/app/sales/recent-sales.tsx`, `src/app/sales/page.tsx`, `src/app/sales/recent-order.ts`, `src/app/globals.css`, `test/e2e/look-polish-tables.spec.ts`, `test/e2e/look-pages.spec.ts`, `test/e2e/look-floor-pages.spec.ts`, `test/e2e/look-checks.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the order is read from the rendered list.
- `look-polish-tables.spec.ts`: AC-0006, AC-0007, and AC-0008 at 1280 px and 1440 px, with the lot numbers and sale numbers the app makes, AC-0006's one-line check comparing each value's height with one line box and its scroll width with its client width; AC-0009 with three sales entered out of sale-date order, two of them on one date; AC-0020 with 11 sales, the first entered carrying the newest sale date.
- The receipt table checks in `look-pages.spec.ts` (the header names and columns around line 640, and the one-top checks at lines 650 and 802) and the Recent sales table checks that `look-floor-pages.spec.ts` line 392 makes through `expectTable` read the stacked first cell's header names and columns (AC-0018, owner-approved 2026-11-08); every other list's `expectTable` call keeps its checks.
- The existing look-pages tests that take 33 px off the page at 1280 px and that check a ten-letter vendor word still pass.

**Approach:**
- Stack each first cell, rebalance the receipt and sale columns, restyle Void and Correct, and order the 10 sales before they render.
- Name the stacked cell, the side-by-side actions, and the sales order in the overview's `src/app` row.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: Stock tiles and the sale trace fit their space

**Depends on:** none
**Mode:** manual QA through the browser suite
**Touches:** `src/app/facts.tsx`, `src/app/globals.css`, `src/app/receiving/product-region.tsx`, `src/app/production/product-region.tsx`, `src/app/trace/sale-trace.tsx`, `test/e2e/look-polish-tables.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are element boxes in a browser.
- `look-polish-tables.spec.ts`: AC-0014 at each width and text size it names, with receipts that bring on-hand stock to 12,345.678 lbs and to 1,234,567.891 lbs at $1.7520/lb, checking each number's text is one line box and each value's box ends inside its tile; AC-0015 at 1280 px and 1920 px with a sale drawn from two batches. Each is seen failing on today's tree first. AC-0022 guards the new tiles at the default text size and is exempt from the red-first step, since today's tiles already keep a five-digit value on one line.

**Approach:**
- Keep tile values whole and let the tiles stack when narrow; restyle the `card` and `plain` looks to give the sale trace its columns.
- Name both in the overview's `src/app` row and the restyled looks in its look notes.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: Pricing's advice is calm, Menu's filter is a switch, and table text drops its bold

**Depends on:** T1, T2, T3
**Mode:** manual QA through the browser suite
**Touches:** `src/app/pricing/price-advice-block.tsx`, `src/app/pricing/apply-button.tsx`, `src/app/pricing/pricing-list.tsx`, `src/app/pricing/pricing-detail.tsx`, `src/app/menu/menu-list.tsx`, `src/app/facts.tsx`, `src/app/production/recent-batches.tsx`, `src/app/production/product-region.tsx`, `src/app/receiving/recent-receipts.tsx`, `src/app/receiving/product-region.tsx`, `src/app/sales/recent-sales.tsx`, `src/app/invoices/drafts-list.tsx`, `src/app/trace/lot-trace.tsx`, `src/app/trace/lot-list.tsx`, `src/app/trace/sale-trace.tsx`, `src/app/globals.css`, `test/e2e/look-polish-tables.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are computed styles in a browser.
- `look-polish-tables.spec.ts`: AC-0010 and AC-0011 on `/pricing` with a product in "Needs a new price", in the list and in that product's details panel; AC-0012 and AC-0021 at 390 px and 1280 px in both states, reading the knob's box against the track's and computing each contrast from computed colors; AC-0013 by walking every text node in each surface it lists, with no panel, dialog, or refusal open, and reading its computed weight, skipping only the exempt parts it names. Each is seen failing on today's tree first.
- The existing Menu, Pricing, and Alerts suites pass unchanged.

**Approach:**
- Restyle the advice and its button, style the checkbox as a switch, add the `quiet` look for the stock cards, and lower the weight of cells and card values.
- Name the switch and the advice box in the overview's `src/app` row and the `quiet` look in its look notes.

**Done when:** the T4 tests pass and `npm test` passes.

### T5: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3, T4, T6
**Mode:** visual and manual QA, and the page-state check in the browser suite
**Touches:** `docs/specs/polish-tables-status/notes/verification-ledger.md`, `test/e2e/look-polish-tables.spec.ts`

**Tests:**
- no stub (visual and manual QA): the owner's verdicts and a diff read.
- `look-polish-tables.spec.ts`: AC-0019 runs `checkPageState` on each AC-0016 state, on `/production` with a product chosen and a reversed batch, and on `/trace` showing a sale trace.
- The ledger records the owner's verdict on each of the four AC-0016 screens, the AC-0018 read of `git diff` from the branch point over `test/e2e/` with untracked files listed, and the two leftovers gaps AC-0014 and AC-0015 close.
- Each T5 record names the commit it read: the branch's last commit that changes a file other than those under `docs/specs/polish-tables-status/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. A later commit that changes any other file re-opens every T5 record; one that changes only those files re-opens none.

**Approach:**
- Build the four AC-0016 screen states on the local stack with made-up data, show each to the owner beside the comparison page, and read the test diff.

**Done when:** the ledger holds every entry above and `npm test` passes (AC-0017).

### T6: Post-gates review round 1 fixes

**Depends on:** T1, T2, T3, T4
**Mode:** manual QA through the browser suite
**Touches:** `src/app/sales/recent-sales.tsx`, `src/app/pricing/pricing-list.tsx`, `src/app/receiving/recent-receipts.tsx`, `src/app/production/recent-batches.tsx`, `src/app/production/reverse-control.tsx`, `src/app/status-tag.tsx`, `src/app/menu/menu-list.tsx`, `src/app/facts.tsx`, `src/app/globals.css`, `docs/architecture/overview.md`, `test/e2e/look-polish-tables.spec.ts`, `test/e2e/sales.spec.ts`, `test/e2e/look-floor-pages.spec.ts`, `docs/specs/polish-tables-status/notes/verification-ledger.md`

**Tests:**
- no stub (manual QA): each check is a press, a box, or a computed style in a browser.
- `look-polish-tables.spec.ts`, each new check seen failing on the tree before T6 first:
  - a pointer click on each sale number in Recent sales at 1280 px and 1440 px opens `/trace?sale=<number>`;
  - AC-0007's "In use" case measures the visible tag's own box against Correct's, in place of its wrapper's top; this check is exempt from the red-first step, since the tag does not move and the suite already compares the visible tag's middle, and it guards the amended AC-0007;
  - AC-0013's walk exempts only the value inside a stock tile or a Pricing tile, so a tile label above 500 fails it;
  - with a vendor name that wraps at 1280 px, each receipt's lot number sits directly under its date;
  - under `forcedColors: "active"`, the switch's knob shows its own outline at the track's left when off and at its right when on;
  - with the browser's text size at 24 px, the switch's knob stays inside its track in both states.
- `sales.spec.ts`'s two void-note absence checks, at lines 1052 and 1191, read the "Voided" tag or the reason's own text (AC-0018's void-text clause).

**Approach:**
- Let the sale number link take a pointer press in the table without changing the DOM order, the Tab order, or the stacked first cell; bring the Pricing tile labels to weight 500; keep each lot number under its date when the vendor wraps; draw the switch's knob outline under forced colors with a token color and size the switch on the track's px basis; give the four reason lines one shared class source in `status-tag.tsx`.
- Correct the overview's `src/app` and `test/e2e/` rows, the `Facts` and `globals.css` comments, two test comments, and the ledger's T1 line, and record the round's dispositions in the ledger.
- In `look-polish-tables.spec.ts`: name the quiet-look checks in the AC-0008 test's title, decide "outside any tag" with the suite's computed fill-and-radius test, use `withTextSize` from `look-checks.ts` in place of `setRootSize`, and make the suite's header comment name every area it checks. Sharing the contrast math with `a11y.ts` is declined, since `a11y.ts` is outside every task's Touches.

**Done when:** the T6 tests pass and `npm test` passes.

## Rollout

Big bang, in one PR. Rollback is a revert. No data, schema, or hosted setting changes.

## Risks

- Recent receipts may no longer read as a table at 1280 px with 33 px taken, which an existing look-pages test checks. If the rebalanced row does not fit, changing that expectation is an Ask first under the spec's Boundaries.
- A tag in Menu's 8rem Status column may not fit "Not sellable now"; the Menu suite's no-spill check catches it, and widening the column moves the Menu table's switch point, which is an Ask first.

## Changelog

- 2026-11-08: initial plan, after the owner's answers on Recent sales' order, side-by-side actions, the sale trace's columns, and the tag colors, and a width probe of Recent receipts at 1280 px and 1440 px.
- 2026-11-08: after shaping review round 1: AC-0020 (which 10 sales), AC-0021 (the switch's 3:1 edges), and AC-0022 (five digits on one line) join T2, T4, and T3; AC-0019 adds `/production`; the owner kept the switch over tabs.
- 2026-11-08: after shaping review round 2: AC-0005 measures an "Entered twice by mistake" reason against one line, AC-0019 adds `/trace`, and AC-0016 drops the "Row buttons" block.
- 2026-11-08: after adversarial review round 1: the owner approved the stacked first cell and its table-test changes, and chose quiet gray text for "No list price yet" (AC-0023); AC-0009 moves to the browser suite; T1 adds `sales.spec.ts` and `reverse-control.tsx`; T3 keeps `Facts` classes-only with a `stacked` look; T4 adds a `quiet` look, the panel's advice, and both product cards; every task records its stub disposition.
- 2026-11-08: after adversarial review round 2 and shaping round 5: AC-0018 adds the receipt one-top checks; the sale trace takes two looks so its card keeps its bottom half; AC-0024 sets "No list price yet" to weight 400 outside the New sale form, whose weights stay with spec 1b; AC-0016 leaves out the comparison page's dimmed row and "No list price yet" tag.
- 2026-11-08: after adversarial review round 3: the owner confirmed an undimmed voided row and that the stacked-cell test approval covers the one-line and one-top checks, and ruled that the sale trace restyles `card` and `plain` in place (its only user, checked with `grep`) instead of adding two looks.
- 2026-11-08: the owner accepted the comparison page at revision 1794121141-4df1 unchanged, with no business owner input, so AC-0016 keeps that revision and the spec no longer waits on a reaction.
- 2026-11-09: amendment after post-gates review round 1: AC-0007 measures the "In use" tag's middle against Correct's (owner decision 2026-11-09); T6 holds the round's fixes; T5 depends on T6, so its records read a commit at or after T6's last.
