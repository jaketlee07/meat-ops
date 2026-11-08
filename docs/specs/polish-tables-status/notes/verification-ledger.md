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
- Changed lines in existing browser test files, all reading void or reversal text (AC-0018): each "Void: <reason>" or "Reversed: <reason>" assertion became the "Voided" or "Reversed" tag plus the reason's own text, and each `/^Void: /` absence check became a "Voided" absence check, at `receiving.spec.ts` 713, 719, 723, 801, 846, 900, 945, 1021; `correct.spec.ts` 108; `look-pages.spec.ts` 554; `look-floor-pages.spec.ts` 325; `reverse.spec.ts` 89, 195, 298, 399 (the reason matched as a `p`, since the open confirmation's reason field holds the same words); `sales.spec.ts` 887, 900, 1050, 1134, 1215.
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
