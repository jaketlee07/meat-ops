# Verification ledger: polish-tables-status

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/3ccd507e-876a-4bdb-88ac-ff1452d4608c/`, and the brief's re-review rounds under `.context/reviews/d5521056-36b1-4767-9f0c-2f00ba260239/`.

## Owner decisions (2026-11-08)

The spec's Assumptions record each of these as a Product or Process line:

- The owner accepted the comparison page at revision 1794121141-4df1 unchanged; the business owner gives no input to this work.
- Recent sales keeps the 10 latest-entered sales and lists them by sale date.
- A receipt's Void and Correct sit side by side, with no "More" button.
- Recent receipts and Recent sales stack the date over the lot or sale number, and the shipped receipt and sale table tests change their header-name, column, one-line, and one-top checks to match.
- "No list price yet" is quiet gray text, not a tag; a voided row is not dimmed.
- Menu's "Sellable only" filter stays a checkbox drawn as a switch.
- The sale trace restyles `Facts`' `card` and `plain` looks in place.

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 | 16 sustained, all accepted | Findings, accepted |
| 2 | 3 sustained, accepted | Findings, accepted |
| 3 | 2 sustained, settled by owner rulings | Findings, accepted |
| 4 to 8 | Not run (three-round cap) | Rounds 4 to 7 Findings, accepted; round 8 Clean |

- Pre-EXECUTE gates: no adversarial or security gate fires, since the spec is unchanged since its review and makes no structural or security-boundary change. `creative-direction` and `design-review` are not installed (named skip). `frontend-engineering` is loaded but its pre-flight does not apply: the pages are existing surfaces with a grounded aesthetic reference (look E's tokens and the comparison page); its craft rules on tokens, focus, motion, and contrast go into each implementer brief.

## Approval (2026-11-08)

- The owner approved the spec and the plan on 2026-11-08 (PR #57, merged as `3c70d69`) and chose to start building.
- Work-loop run `367f4c59-c167-4a1f-900c-43bbdbe960dd`. `approve-plan` recorded spec hash `89e087a3e0d1…` and plan hash `ebc87b94a035…`. The schedule runs T1, T3, T2, T4, then T5.
- Base: `3c70d69` on branch `feat/polish-tables-status` in the main folder, on stack A.
- On 2026-11-08 the owner approved, for this build, stopping the app server that had run from this folder since 2026-11-07 17:36 (PID 70046) and starting it again when the build is done; running the stack A slot fix before each full test run; and committing each task on this branch, then opening one PR.

## T1 (2026-11-08)

- `src/app/status-tag.tsx` draws each tag: a `rounded-full` pill on `--color-mark-fill` with the word in `--color-ink` (14.39:1) and an `aria-hidden` dot in `--color-status-priced` or `--color-status-nocost`. Menu's two statuses, Recent receipts' "In use" and "Voided", Recent sales' "Voided", and Recent batches' and `reverse-control.tsx`'s "Reversed" use it. Each reason is its own `text-sm` line in `--color-ink-secondary` at weight 400; no line starts "Void:" or "Reversed:". "No list price yet" is `text-ink-secondary` (and weight 400 in the Menu list, the Pricing list, and the Product details panel) through position-based variants on the `dl`, since `src/app/pricing/figure.tsx` is outside T1's Touches; the owner kept that on 2026-11-08 and AC-0023 and AC-0024 guard it. No new token.
- The new `test/e2e/look-polish-tables.spec.ts` (21 tests, AC-0001 to AC-0005, AC-0023, AC-0024) failed in full on the old tree, except AC-0005 for Recent receipts (its plain rows were already tall from the 44 px buttons and a wrapped "In use" and Correct) and AC-0024 for the Pricing list and the panel (already weight 400). AC-0005 at the default size: a voided sale or reversed batch row was 109 px against an 81 px limit on the old tree, and within its limit (the tallest plain row plus one 20 px reason line) after the change.
- Changed lines in existing browser test files, all reading void or reversal text (AC-0018): each "Void: <reason>" or "Reversed: <reason>" assertion became the "Voided" or "Reversed" tag plus the reason's own text, and each `/^Void: /` absence check in `receiving.spec.ts` and `correct.spec.ts` became a "Voided" absence check (the two in `sales.spec.ts`, at lines 1052 and 1191, moved in T6), at `receiving.spec.ts` 713, 719, 723, 801, 846, 900, 945, 1021; `correct.spec.ts` 108; `look-pages.spec.ts` 554; `look-floor-pages.spec.ts` 325; `reverse.spec.ts` 89, 195, 298, 399 (the reason matched as a `p`, since the open confirmation's reason field holds the same words); `sales.spec.ts` 887, 900, 1050, 1134, 1215.
- Bundled fix (owner-approved 2026-11-08): `test/look-tidy.test.ts`'s AC-0022 check found the "In use" mark's fill by reading a `p` in `recent-receipts.tsx`; it now confirms "In use" is a `StatusTag` and reads the fill token from `status-tag.tsx`. What it asserts is unchanged.
- Slot fix before the full run: 0 dead `pg_class` rows after (slot age 13,694 before).
- `npm test`: Vitest 55 files, 1052 passed in 134 s; Playwright 1007 passed in 14.3 min.

## T3 (2026-11-08)

- `Facts`' `tiles` look is a flex wrap: each value is `whitespace-nowrap`, and the second tile drops under the first only when both values do not fit side by side. The plan's design named a container variant for the stacking; a 26rem `tile-pair` variant failed `look-floor-pages.spec.ts` AC-0004's "two tiles side by side" checks at 390x844 and 1280x720, since one fixed width cannot tell small stock that fits side by side from 12,345.678 lbs that must stay on one line, so the wrap replaces it (the plan's Design is working material; its Touches, Tests, and Done when hold). With 12,345.678 lbs and 1,234,567.891 lbs, the tiles stack at 390 px with 20 px text on Receiving and at 1280 px on Production; small stock stays side by side at every AC-0014 size with default text.
- The sale trace's `card` and `plain` looks, restyled in place and still classes-only: each pair a column, label above value, two pairs to a row, and every pair in its own column from the new `sale-cols` variant (`@container tracesale (min-width: 40rem)`, about 936 px of window at the default text size). `card` keeps `CARD_BOTTOM`; `plain` draws no card edge; `list`, `cells`, and `card-cols` keep their classes.
- On the old tree, all four AC-0014 tests failed (a tile number split at 20 px text at 390 and 1024 px, and at 1280 px) and both AC-0015 tests failed (each label sat beside its value, 24 px short of above it). AC-0022, exempt from red-first, passed on the old tree for "Stock and prices" and failed for "Product and raw stock" at 1280 px.
- Slot fix before the full run: 175,500 dead `pg_class` rows and slot age 19,878 before, 0 and 8 after.
- `npm test`: Vitest 55 files, 1052 passed in 52 s; Playwright 1015 passed in 13.3 min. No existing test file changed.

## T2 (2026-11-08)

- Recent receipts' table tracks are `9rem minmax(0,1fr) 5.4rem 5.15rem 5.4rem 9.8rem`: the Received date over the lot number in the first column, then Vendor, Weight, Cost per lb, Remaining, and the actions. Recent sales' are `9rem minmax(0,1fr) 4rem 5.5rem 5.25rem 5rem`: the sale date over the sale number link, then Customer, Product, Lbs, Price per lb, and the actions. The `receipt-table` (40.5rem) and `sale-table` (40rem) thresholds are unchanged. At 1280 px the receipt section is 688 px and the Vendor column about 71 px (about 38 px with 33 px taken); at 1440 px 848 px and about 231 px. A lot number is 135 to 140 px and a sale number about 139 px wide.
- Void and Correct sit in one row with a 6 px gap, outlined in `--color-ink` on `--color-surface` with a `--color-field-border` border, `px-3 text-sm`. The trigger buttons live in `receiving/void-dialog.tsx`, `receiving/correct-dialog.tsx`, and `sales/void-dialog.tsx`, outside T2's Touches, so the rows restyle them with child-selector classes; those files keep their own `border-error text-error` classes, which the row's classes override.
- `src/app/sales/recent-order.ts` orders the 10 rows `listRecentSales` returns by sale date, then entry time, both newest first; `src/lib/sales.ts` is unchanged.
- On the old tree, AC-0006 (a lot number on two lines), AC-0007 (Void and Correct tops 52 px apart), AC-0008 (Void in `--color-error`), and AC-0009 (entry order) failed at each size; AC-0020 passed, as expected, since the query is unchanged and the test guards that.
- Changed lines in existing browser test files (AC-0018): `look-pages.spec.ts` the receipt table's header names (Received, Vendor, Weight, Cost per lb, Remaining), its column checks (the lot number in the first column), and its one-top checks at about lines 650 and 802 (the lot number under the date); `look-floor-pages.spec.ts` the Recent sales list's header names (no "Sale number" column), its one-line and column checks through a new optional `stacked` field of `expectTable` in `look-checks.ts`, whose path without it is unchanged for every other caller.
- Bundled fix (owner-approved 2026-11-08, AC-0018's order clause): `sales.spec.ts`'s AC-0070 test now expects the 10 last entered by sale date (the last entered, dated Oct 6, at the bottom, and a newly saved Oct 8 sale seventh), and its AC-0071 test, retitled to the sale-date rule, expects Oct 11, Oct 9, Oct 7. Which sales show and the counts are unchanged.
- Slot fix before the full run: 214,397 dead `pg_class` rows and slot age 22,659 before, 0 and 3 after.
- `npm test`: Vitest 55 files, 1052 passed; Playwright 1022 passed and 1 failed in 13.4 min (`receiving.spec.ts:1001`, the known expired-token flake, which T2 does not touch; it passed alone on its rerun, 3 passed with its setup).

## T4 (2026-11-08)

- Pricing: each advice sentence is weight 400 in its `--color-advice-fill` box with `--color-advice-text` (6.84:1) in the list's row look at every width and in the panel's stacked look. The row look's apply button is outlined: `--color-primary` text and border on `--color-surface` (6.70:1); while it waits, its border and text fade to 60% (no opacity fade, which spec 1b's waiting-button gap removes elsewhere). The panel's stacked button stays solid primary.
- Menu's "Sellable only" checkbox is drawn as a switch with `appearance-none`: a 72 x 44 px `rounded-full` track with a 2 px edge and a 32 px `::before` knob, 4 px from the left when off and 28 px further right when on, moving only under `motion-safe:`. Off, the edge and the knob are `--color-field-border` on white (4.83:1); on, the track is `--color-primary` (6.70:1 against the surface) and the knob `--color-surface` (6.70:1 against the track). The input keeps the 44 px box `checkPageState` and the focus-ring test read.
- Weight: a new classes-only `Facts` look, `quiet`, gives the stock cards' non-tile facts weight 400 values; `list` keeps its classes. The lot card's (`card-cols`) and the sale trace's values are weight 500, and the Menu table's price cell is `menu-table:font-medium`. On the old tree the AC-0013 walk found values above 500 on six of its twelve surfaces: "Stock and prices" (the suggested prices, 600), "Product and raw stock" (Product, Raw input, Shrink, 600), the Menu list (the price, 600), the Pricing list (the advice, 600), a lot trace (the lot card's six values, 600), and a sale trace (the sale card's five values, 600). The other six (Recent receipts, Recent batches, Recent sales, the Pricing tiles, Drafts to confirm, a raw lot list) already passed after T1 and T2.
- On the old tree, AC-0010 (a solid primary button), AC-0011 (weight 600), and AC-0012 with AC-0021 (no knob) failed at each size. No existing test file changed.
- Slot fix before the full run: 187,854 dead `pg_class` rows and slot age 19,676 before, 0 and 6 after.
- `npm test`: Vitest 55 files, 1052 passed in 53 s; Playwright 1040 passed in 13.5 min. The apply button's waiting style changed after that run (from a whole-button `opacity-60` to its border and text at 60%); typecheck and `pricing.spec.ts` with `look-polish-tables.spec.ts` (105 passed) were rerun on it, and T5's full run reads the final head.

## Menu's Status column (2026-11-08)

- The T5 captures showed "Not sellable now" wrapping onto two lines in Menu's 8rem Status column at 1280 px. The owner approved a 9rem column on 2026-11-08, the Ask first the plan's Risks name; the Product column gives up the 1rem and `menu-table` still switches at 42rem. Commit `6a063e7`. A new test ("Menu's status tags stay on one line where the list is a table, at 1280 px with default and 20 px text") failed at 8rem on FIN-C's "Not sellable now" and passes at 9rem; the Menu, look, and polish suites passed with it (189 passed).

## T5 (2026-11-08)

- AC-0019: `checkPageState` reports no violation on `/receiving` with RAW-TOM chosen and three recent receipts (one void, one in use), `/sales` with three recent sales (one void), `/menu` with a sellable, a not-sellable, and a no-list-price product, `/pricing` with 502 in "Needs a new price", `/production?product=502` with a reversed batch (loaded fresh, no panel open), and `/trace` showing a sale drawn from two batches, all at 1280 px (six tests in `test/e2e/look-polish-tables.spec.ts`, commit `257cfd2`).
- AC-0016: four screens built from this branch at 1280 x 800 with made-up data (the Menu capture retaken after `6a063e7`) were placed beside the comparison's own Meat Ops screens and its "Change" text on a check page (artifact `FjDNxQQ6dVDb4gVr9g96To`, version 1794186094-85a6), each compared with the comparison page at revision 1794121141-4df1: `/receiving` and `/sales` and `/menu` with "Status, IDs, and dates" (leaving out its dimmed row and its "No list price yet" tag) and `/pricing` with "Advice and main buttons". The owner answered "Match" for all four on 2026-11-08.
- AC-0018: `git diff 3c70d69 -- test/` read in full, with no untracked file under `test/`. The changed expectations in existing browser test files are the void and reversal text lines (T1), the receipt table's header names, column, and one-top checks in `look-pages.spec.ts` and the Recent sales list's header names, one-line, and column checks through `expectTable`'s new `stacked` path in `look-checks.ts` and `look-floor-pages.spec.ts` (T2, owner-approved), and `sales.spec.ts`'s two order tests (T2's bundled fix, AC-0018's order clause). `test/look-tidy.test.ts` (Vitest, T1's bundled fix) reads the In use mark's fill from `status-tag.tsx`. Everything else is the new `look-polish-tables.spec.ts`.
- The two leftovers gaps this spec closes in `docs/product/intents/look-production-sales-trace-review-nits.md`: stock tiles that split figures at 20 px text (AC-0014, AC-0022) and sale trace labels far from their values on a desktop (AC-0015). That intent stays in `[backlog].open` until spec 1b ships its other gaps.
- AC-0017: `npm test` at `257cfd2` passed: Vitest 55 files, 1052 passed; Playwright 1047 passed in 13.6 min. Slot fix before it: 188,724 dead `pg_class` rows and slot age 30,553 before, 0 after. The commits after it change only this ledger.

## Post-gates review round 1 (2026-11-09)

- Round 1 reviewed `git diff 3c70d69 22c2835` (adversarial, quality, frontend, with the 42-capture set at 390 and 1280 px, 600 and 900 px tall); reports and adjudications sit under `.context/reviews/367f4c59-c167-4a1f-900c-43bbdbe960dd/` as `1-post-gates-*`. Sustained: frontend 4 (1 Blocker: Recent sales' facts list covers the sale number link in the table, so a pointer press cannot reach it), adversarial 7 (2 Blockers: the same link; the Pricing tiles' labels render at weight 600 while AC-0013's walk skips them), quality 10 (1 Blocker: the same walk), 21 fingerprints in all. Refuted: adversarial 1 (the vendor column with 33 px taken), quality 1 (AC-0009's order test).
- AC-0007 amendment (owner decision 2026-11-09): the "In use" tag stays vertically centered beside Correct, as the owner approved the screen, and AC-0007 is amended so that pair's middles, not tops, are level; Void and Correct keep their tops level. The test measures the tag itself.
- Amendment review (adversarial, delta scope; reports `1-pre-execute` to `4-pre-execute` in the run's review folder): round 1 sustained 5 (T6's red-first rule could not hold for AC-0007; T5's records named no commit and bound to T6 rather than the shipped code; the durable-output map left out T6; four quality Nits had no disposition), round 2 sustained 1 Nit and round 3 sustained 1 Nit (T5's re-open rule), round 4 was Clean. The owner approved the amended spec and plan on 2026-11-09. `approve-plan` recorded spec hash `f56faf35b1ef…` and plan hash `87cca72787b6…`; the schedule runs T6, then T5.

## T6 (2026-11-09)

- Each sustained round 1 finding and where it is resolved (IDs are the main-loop numbers in each `1-post-gates-*-adjudication.md`):
  - Recent sales' sale number link (frontend 1, adversarial 1, quality 2; Blocker): the `h3` takes `sale-table:relative`, so it paints above the facts `dl`; DOM order, Tab order, and the stacked first cell are unchanged. New test: a pointer click on each sale number opens its trace at 1280 and 1440 px.
  - The Pricing tile labels at weight 600 and the walk that skipped them (adversarial 2, quality 1; Blocker): the labels are `font-medium` (500), and the AC-0013 walk exempts only each tile's value.
  - AC-0007's "In use" case (adversarial 3; Concern): amended by the owner; the test measures the visible tag's middle against Correct's.
  - `sales.spec.ts`'s two void-note absence checks (adversarial 4, quality 3): both read the "Voided" tag.
  - The overview's "Reversed: ..." wording (adversarial 5): the row names the "Reversed" tag.
  - A wrapped vendor pushing the lot number down (frontend 2): the vendor's cell spans both rows of the first column (a vendor of three or more lines still leaves a small gap). New test at 1280 px.
  - The switch under forced colors (frontend 3): the knob draws a `--color-field-border` outline under `forced-colors:` only. New test.
  - The switch at larger text (frontend 4): the track width, knob, offset, and travel are px (72, 32, 4, 28) to match the 44 px `h-control`. New test at a 24 px root.
  - The overview's `test/e2e/` row and the suite header (adversarial 6, quality 9), the two stale test comments (adversarial 7), the AC-0008 title (quality 4), `expectQuiet`'s tag test (quality 5), `setRootSize` (quality 6, now `withTextSize`; sharing the contrast math with `a11y.ts` declined, outside every Touches), the `Facts` comments and the overview's weights (quality 7), the `globals.css` comments (quality 8), and the repeated reason-line classes (quality 10, now `REASON_LINE` in `status-tag.tsx`).
- On the tree before T6, the new click test failed at both widths (the `dl` intercepted it), the Pricing tiles walk failed on the three labels at 600, the forced-colors test failed (no knob outline), the 24 px test failed (a 48 px knob in a 40 px inside), and the lot-number test failed (a 23 px gap); the AC-0007 change is exempt from red-first.
- Slot fix before the full run: 178,290 dead `pg_class` rows and slot age 25,165 before, 0 after.
- `npm test` on the tree committed as T6: Vitest 55 files, 1052 passed in 58 s; Playwright 1052 passed in 13.6 min.

## T5 after T6 (2026-11-09)

Every record below reads commit `510f7d8`, the branch's last commit that changes a file other than those under `docs/specs/polish-tables-status/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`.

- AC-0016: the four screens were retaken from `510f7d8` at 1280 x 800 with made-up data (Pricing is a 1280 x 1097 full-page capture) and placed on the check page (artifact `FjDNxQQ6dVDb4gVr9g96To`, version 1794208724-1be9) beside the comparison's own Meat Ops screens and its "Change" text, each compared with the comparison page at revision 1794121141-4df1: `/receiving`, `/sales`, and `/menu` with "Status, IDs, and dates" (leaving out its dimmed row and its "No list price yet" tag) and `/pricing` with "Advice and main buttons". The owner answered "All four still match" on 2026-11-09.
- AC-0018: `git diff 3c70d69 510f7d8 -- test/` read in full, with no untracked file under `test/`. The changed expectations in existing browser test files are the T1 and T2 lines the earlier T5 entry lists, plus T6's two `sales.spec.ts` void-note absence checks (lines 1052 and 1191), which now read the "Voided" tag (AC-0018's void-text clause); T6 otherwise changed two comments in `sales.spec.ts` and `look-floor-pages.spec.ts`. Everything else is the new `look-polish-tables.spec.ts` and `test/look-tidy.test.ts`'s bundled fix.
- AC-0019: the six `checkPageState` tests in `look-polish-tables.spec.ts` (commit `257cfd2`) are unchanged by T6 and pass at `510f7d8` in the run below.
- The two leftovers gaps this spec closes are unchanged: stock tiles that split figures at 20 px text (AC-0014, AC-0022) and sale trace labels far from their values on a desktop (AC-0015).
- AC-0017: `npm test` at `510f7d8` passed: Vitest 55 files, 1052 passed in 65 s; Playwright 1052 passed in 14.2 min. Slot fix before it: 138,960 dead `pg_class` rows and slot age 15,955 before, 0 after.

## Post-gates review round 2 (2026-11-09)

- Round 2 reviewed the fix delta `git diff 22c2835 b6eaf59` (adversarial, quality, frontend, with 34 captures of the changed screens); reports and adjudications sit under `.context/reviews/367f4c59-c167-4a1f-900c-43bbdbe960dd/` as `2-post-gates-*`. Frontend was Clean. Sustained: adversarial 3 (1 Concern: the overview's `src/app` row still levelled the "In use" tag's top with Correct's; 2 Nits: the T6 entry's mixed finding numbers, and the overview's `look-checks.ts` importer list missing `look-polish-tables.spec.ts`), quality 4 Nits (`expectQuiet` missed a tag drawn with `rounded-control` or `rounded-mark`; the vendor-wrap test picked cells by position; the 24 px switch test did not measure the knob's top and bottom; the same overview sentence and no forced-colors outline in the row). 7 fingerprints.
- Resolved: the overview row states Void and Correct with level tops and the "In use" tag's middle level with Correct's, names the knob's forced-colors outline, and lists `look-polish-tables.spec.ts` as a `withTextSize` importer; the T6 entry cites every finding by its adjudication's main-loop number; `expectQuiet` counts any filled element with a rounded corner between the word and its row (the nearest `li` or `dl`); the vendor-wrap test finds Lot number, Received, and Vendor by their labels through `factValue`; the knob check also measures the knob's top and bottom. A deliberately broken build (a `rounded-control` `bg-mark-fill` chip around Menu's "No list price yet", and the knob moved to 20 px from the track's top) failed the AC-0023 Menu test ("outside any tag") and the 24 px switch test ("knob not past the bottom edge"), and was reverted; the changed tests pass on the real code (9 passed).

## T5 after round 2 (2026-11-09)

Every record below reads commit `ff66c6f`, now the branch's last commit that changes a file other than those under `docs/specs/polish-tables-status/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. It changes no file under `src/` since `510f7d8` (`git diff --stat 510f7d8 ff66c6f -- src` is empty).

- AC-0016: the owner confirmed on 2026-11-09 that the four "still match" verdicts stand for `ff66c6f`, whose screens are the same build as the check page's version 1794208724-1be9.
- AC-0018: `git diff 3c70d69 ff66c6f -- test/` read in full, with no untracked file under `test/`; the changed expectations in existing browser test files are those the "T5 after T6" entry lists, since round 2 changed only `look-polish-tables.spec.ts`.
- AC-0019: the six `checkPageState` tests are unchanged and pass in the run below.
- AC-0017: `npm test` at `ff66c6f`: Vitest 55 files, 1052 passed in 99 s; Playwright 1051 passed and 1 failed in 16.7 min (`invoices.spec.ts:785`, AC-0075, a 30 s timeout in a file this branch does not touch, while another project's tests also ran on this Mac); it passed alone on its rerun (3 passed with its setup). Slot fix before it: 139,743 dead `pg_class` rows and slot age 14,536 before, 0 after.
