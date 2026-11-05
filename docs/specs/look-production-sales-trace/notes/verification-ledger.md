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
