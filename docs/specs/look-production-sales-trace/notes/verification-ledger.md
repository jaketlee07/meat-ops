# Verification ledger: look-production-sales-trace

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/0a22b27a-51fc-49f0-830d-4f91f292668f/`.

## Owner decisions (2026-11-05)

The spec's Assumptions record each of these as a Product line:

- Spec 3 is split into 3a (Production, Sales, Trace, with the spec 2 leftovers intent) and 3b (Menu, Invoices, Ask, Alerts).
- Every table or card layout picks its look from the room its own section has, its width and the text size.
- On a desktop the saved result stays under the form; Production shows two stock tiles; the Pricing list shows its table whenever it has room.
- The six spec 3a boards (canvas revision 1793899703-bb47) are approved as drawn, with the dialogs and the "Batch reversed" panel following Receiving's built look.

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 | 2 Blockers, 7 Concerns, 4 Nits, all accepted | 8 findings, all accepted |
| 2 | 4 Concerns and 1 Nit, accepted | 4 Low, accepted |
| 3 | 2 Nits on working material, repaired in place | Clean |

- Named skips at the pre-EXECUTE gate: `frontend-engineering` is not loaded (an existing surface with a grounded aesthetic reference, the canvas boards and the look E tokens); `creative-direction` and `design-review` are not installed. The security-reviewer did not fire: no auth, session, input, file, or network control changes, and no server action changes.

## Approval (2026-11-05)

- The owner approved the spec and the plan in chat on 2026-11-05 and chose to start building, and approved the stack A slot fix before each full test run for this build.
- Work-loop run `c3f5e50e-7b0f-434e-8b69-cbdbefb337d0`. `approve-plan` recorded spec hash `5df0f279dbb0…` and plan hash `53f9123a9e3f…`. The schedule runs T1, T2, T3, T4, then T5.
- Base: `9e661f8` on branch `feat/look-production-sales-trace` in the main folder, on stack A.

## T1 (2026-11-05)

- Commit `eca05ca`. The Pricing list is the size container `pricing`, and one custom variant `price-table` (`@container pricing (min-width: 37rem)`) carries its whole table look, the open row's accent edge, and the advice block's and one-press button's row placement. Receiving's form column is 280 px from 1280 px (340 px below), and `receipt-table` rose from 38rem to 40.5rem: at 1280 px the section is 688 px, and 655 px with 33 px taken (7 px over the threshold); "Provisions" is 66 px in an 81 px Vendor cell.
- `test/look-tidy.test.ts` (AC-0020 to AC-0022) failed 3 of 3 on the tree before the change. Of the new browser tests, AC-0017 at 1279 and 1024 px full width and beside the panel at 1279 px, AC-0018 at 1280 px, and AC-0019 failed against the old source; AC-0018 at 1440 px, the 1024 px beside-panel card test, AC-0017's 20 px step, and AC-0031 passed on it (AC-0031 gained a header-visible check afterward).
- Changed lines in existing test files: `pricing-page.ts` `detail()` returns `region`; `pricing.spec.ts` 13 uses of `d.main` became `d.region`; `look-pages.spec.ts` replaced its Pricing cards checks at 1279 and 1024 px (full width) and at 1279 px beside the panel with AC-0017's table checks.
- `npm test`: Vitest 55 files, 1050 passed; Playwright 800 passed in 11.0 min. Other projects' folders showed in the folder check throughout; AGENTS.md says they use neither stack, and the slot fix ran only once the check came back clear.

## T2 (2026-11-05)

- Commit `93e89c7`. `/production` uses Receiving's grid (form column 340 px, 280 px from 1280 px) through `fullWidth` and `mainClassName`, with `#product-region` as `display: contents` from 1024 px. Recent batches is the size container `batches`; the custom variant `batch-table` (`@container batches (min-width: 38rem)`, no screen gate) carries its table look, placed by the row's own classes (`facts.tsx` unchanged); an inner `div` carries the table's card edge, since a container cannot style itself. At 1280 px the section is about 688 px (table), at 1024 px about 372 px (cards), and at 1280 px with 20 px text about 614 px against 760 px (cards). The "Product and raw stock" card is now a section named by its heading, as Receiving's "Stock and prices" card is.
- With the new source stashed, 12 new tests failed (AC-0001 to AC-0005, AC-0007 with AC-0027, and the AC-0007 refusal case); AC-0006 and AC-0029 passed, since the old page was always cards.
- Changed lines in an existing test file: `shell.spec.ts`'s content-cap test now checks the 544 px cap on `/ask`'s examples section and keeps its 448 px check-step check on `/production` (AC-0026).
- `npm test`: Vitest 55 files, 1050 passed; Playwright 820 passed in 11.3 min. A first full run failed `receiving.spec.ts:998` (an expired access token refreshes and voids), which T2 does not touch; it passed alone and in the second full run.

## T3 (2026-11-05)

- Commit `d8fc603`. `/sales` uses the same grid (form and result left, Recent sales right). Recent sales is the size container `sales`; the custom variant `sale-table` (`@container sales (min-width: 40rem)`, no screen gate) carries its table look on the tracks `6rem 5.5rem 1fr 4rem 5.5rem 5.25rem 5.75rem`; the table shows at 1280 and 1440 px, and cards at 1024 px (about 23rem) and at 1280 px with 20 px text (about 34rem). `facts.tsx` is unchanged. The AC-0010 row check compares the values' vertical middles, since the sale-number link is a 44 px target.
- With the new source stashed, AC-0001, AC-0008, AC-0010, and AC-0012 failed; AC-0009, AC-0011, and AC-0030 passed, since they assert layouts the old page already had. No existing test file changed.
- `npm test`: Vitest 55 files, 1050 passed; Playwright 837 passed in 11.8 min.

## T4 (2026-11-05)

- Commit `4d79a7d`. `/trace` lifts the content cap; the two finders sit side by side from 1024 px. Four container variants, in rem with no screen gate: `lot-wide` (the lot section, 53rem: Customers beside Sales and the lot facts in three columns), `tsale-table` (the Sales wrapper, 35rem), `tstock-table` (the Finished stock wrapper, 31rem), `lots-table` (the raw lot list section, 27rem). Each list's `ul` stays its `h3`'s next sibling, with the header line after it in the DOM and above it by `order`; the lot facts `dl` and the sale trace's `ul` stay direct children of their sections; the lot card is drawn on the heading and the `dl`. Each list container holds one inner `div` for the table's card edge, inside which the `h3` and `ul` sit. `Facts` gained the looks `card`, `card-cols`, and `plain`, which only choose classes.
- With the new source stashed, 13 of the 23 new Trace tests failed (AC-0001, AC-0013, the AC-0014 to AC-0016 tables, and the three Customers placements); the AC-0028, 390 px card, 20 px, and sale-trace page-state tests passed, since the old page already met them. No existing test file changed.
- `npm test`: Vitest 55 files, 1050 passed; Playwright 858 passed in 17.6 min. A first full run failed `alerts.spec.ts:182` once (a duplicate key on `alerts_one_live` while seeding), which T4 does not touch; the second full run was clean.

## Saved-result table fix (2026-11-05)

- The T5 captures showed the "Batch saved" card's before-and-after table at 1280 px ending at 544 px against the card's inner edge at 532 px, since the 280 px form column cannot hold cells such as "$1.7829/lb"; Receiving's "Receipt saved" stock table measured the same. Commit `e7912b3` makes each saved-result card an unnamed size container and tightens `before-after.tsx`'s text and cell padding under 18rem and again under 13rem (class strings only, AC-0025). The tables now end 1 px inside the card's inner edge at 1024, 1280, and 1440 px and at 1280 px with a 20 px root font.
- A new test ("the saved results' before-and-after tables stay inside their cards", four sizes) failed on Production and Receiving with the source stashed.
- `npm test`: Vitest 55 files, 1050 passed; Playwright 862 passed in 13.1 min.
- The captures were retaken and placed on the canvas (version 1793913526-bd8f) for the owner's comparison.

## T5 (2026-11-05)

- AC-0024: the owner compared the built screens on the canvas (version 1793913526-bd8f) on 2026-11-05 and answered "All six match" for Production, Sales, and Trace on a phone and a desktop against the S3 boards (revision 1793899703-bb47), and "Both match" for Receiving on a desktop against S2-Receiving-Desktop (revision 1793856599-9c48) and for Production's check step, the Reverse batch dialog, the Void this sale? dialog, and the Batch reversed panel against Receiving's void and Correct dialogs and Receipt corrected panel.
- AC-0023: `npm test` at `e7912b3` passed: Vitest 55 files, 1050 passed; Playwright 862 passed in 13.1 min. The commits after it change only the ledger and one comment in `facts.tsx` (`968135b`; typecheck and `test/look-tidy.test.ts`, 3 passed, rerun on it).
- AC-0020, AC-0021, AC-0022: `test/look-tidy.test.ts` passes at the head. The comment above `VALUE_CLASS` in `src/app/facts.tsx` now reads that every look but "tiles" keeps the value's width up to 60% (for "cells" where the section is not a table), "tiles" sets no cap, and "cells" in a table shrinks to its column; this matches the classes, including T4's "card", "card-cols", and "plain".
- AC-0025: `git diff 9e661f8 -- src/app/facts.tsx src/app/before-after.tsx` read in full. Every changed line is a comment, a `className` string, the `Look` type, or an entry in the four class records; the `Facts` and `BeforeAfter` elements, nesting, other attributes, and text are unchanged. The added looks "card", "card-cols", and "plain" only choose classes.
- AC-0026: `git diff 9e661f8 -- test/e2e` read in full; no untracked file under `test`. Changed expectations in existing files:
  - `look-pages.spec.ts`: "a product stays a card" at 1279x800 and 1024x768 becomes AC-0017's "a product reads as one row under a header line" at those sizes (the 390x844 card test is kept as its own test); "the list beside the panel keeps each product a card" at 1279x800 becomes AC-0017's table at 1279x800, and at 1024x768 stays cards.
  - `shell.spec.ts`: the content-cap test checks the 544 px cap on `/ask`'s examples section and keeps its 448 px check-step check on `/production`.
  - `pricing-page.ts` and `pricing.spec.ts`: `detail().main` is renamed `region` with every use (AC-0021); the asserted values are unchanged.
  - Everything else in `test/e2e` is added tests: `look-floor-pages.spec.ts` (new) and the AC-0017 and AC-0031 tests in `look-pages.spec.ts`.

## Post-gates review round 1 and the task 6 amendment (2026-11-05)

- Round 1 reviewed `git diff 9e661f8 3669082` (adversarial, quality, frontend); reports and adjudications sit under `.context/reviews/c3f5e50e-7b0f-434e-8b69-cbdbefb337d0/`. Sustained: adversarial 5 (1 Concern: commit `e7912b3` changes `src/app/before-after.tsx` and `src/app/receiving/result-panel.tsx`, which no task's Touches names), quality 8 (1 Concern: Recent sales' sale-number fit check measures the link, not its cell), frontend 2. Refuted: adversarial 2, quality 4.
- A probe against a build of `e7912b3` (`1-probe-result-gap.spec.ts` and its log in that folder) measured the gap from the form to the saved result with ten recent rows: Production 1960 px at 1024x768, 16 px at 1280x720, 2065 px at 1280x720 with a 20 px root font; Receiving 2606 px, 37 px, and 3081 px. The grid rows `auto auto 1fr auto` give a long list's extra height to the row above the result.
- The owner approved on 2026-11-05 a plan amendment that adds task T6 for every sustained finding, the code tidy-ups included, and that the result-gap fix covers Receiving as well as Production.
- Amendment reviews rounds 1 to 5 (adversarial and shaping, delta scope; reports `amend1` to `amend5` in the run's review folder) added AC-0032, AC-0033, and AC-0034, gave T6 the files and states its tests need (long figures, a receipt correction that restates a batch, each form found by role and name), and made T5's records name a commit at or after T6's last commit; round 5 was Clean from both. The owner approved the amended spec and plan on 2026-11-05. `approve-plan` recorded spec hash `1bcc66617ea0…` and plan hash `fc39332fa386…`; the schedule runs T6, then T5.
