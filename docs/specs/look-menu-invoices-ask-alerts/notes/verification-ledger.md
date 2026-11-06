# Verification ledger: look-menu-invoices-ask-alerts

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/6afa7cfb-24e3-4db2-a2ef-b7d90a66b760/`.

## Owner decisions (2026-11-05 and 2026-11-06)

The spec's Assumptions record each of these as a Product line:

- Spec 3b covers Menu, Invoices, Ask, and Alerts only; the spec 3a leftovers intent stays a separate small spec.
- On a desktop, Menu reads as a table when it has room, Alerts sets its cards two to a row, Invoices puts its read forms side by side and a draft's photo beside its lines, and Ask keeps its 544 px column.
- The ten spec 3b boards are approved as drawn (canvas revision 1793945225-763f, after the Alerts boards' urgent and other cards were swapped to match the app's rule).
- Save receipts and Discard draft follow the overview's waiting-control rule; the six other buttons that fade by opacity go to `docs/product/intents/look-production-sales-trace-review-nits.md`.
- The photo field's file-selector button keeps its tested look, and the forms keep their status-line space.

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 | 3 Blockers, 6 Concerns, 3 Nits, all accepted | 1 High, 4 Medium, 3 Low, all accepted |
| 2 | 1 Concern and 2 Nits, accepted | 2 Low, accepted |
| 3 | Clean | Clean |

- Two read-only probes informed the plan: `0-probe-shell.spec.ts` (content widths beside the side menu, and a sticky column inside `<main>`) and a throwaway page showing a `<fieldset>` as a size container and a sticky column inside a size container, both in the suite's Chromium.
- Named skips: `creative-direction` and `design-review` are not installed. The security-reviewer did not fire: no auth, session, input, file, or network control changes, and no server action changes.

## Approval (2026-11-06)

- The owner approved the spec and the plan in chat on 2026-11-06, kept AC-0025, and approved the stack A slot fix before each full test run for this build.
- Work-loop run `1f080e1d-0bbe-4bfd-9914-5317f17e399b`. `approve-plan` recorded spec hash `f73c89872d97…` and plan hash `3e8d63a8f2eb…`. The schedule runs T1 to T7 in order.
- Base: `3703c8d` on branch `feat/look-menu-invoices-ask-alerts` in the main folder, on stack A.

## T1 (2026-11-06)

- Commit `9900584`. `/menu` passes `fullWidth`; its list's section is the size container `menu`, and the `menu-table` variant (`@container menu (min-width: 42rem)`) switches it to one white-card table: tracks `minmax(0,1fr) 8rem 7.5rem 6.5rem 8rem`, 0.75rem gaps, 1rem padding, so 35rem of fixed width and 7rem for the product at the threshold. At 1024 px with 17 px taken the section is 44.44rem (AC-0025). `Facts` supplies the `dl`, so its two `dd`s stay Finished on hand then Raw on hand.
- The layout checks moved from `look-floor-pages.spec.ts` to `test/e2e/look-checks.ts`: every removed line is in the new file once its added `export ` is stripped (`comm`, 0 lines differ); the spec file gained one import and no test changed.
- Seen failing first (`src/app` stashed, log `.context/s3b-t1-red.log`): 11 of the 13 new tests (AC-0001, AC-0002, AC-0003, AC-0025); the two AC-0016 page-state tests passed on the old page, as expected.
- `npm test` at `9900584` after the slot fix (log `.context/s3b-t1-npmtest.log`): Vitest 55 files, 1050 passed; Playwright 897 passed in 11.7 min; no flake.

## T2 (2026-11-06)

- Commit `c0c28ca`. `/invoices` passes `fullWidth` in both views. The read forms are white cards in `grid desk:grid-cols-2`, their buttons pushed to the card bottom; the photo field's `file:` classes and each form's reserved `min-h-12` status line are unchanged. "Drafts to confirm" is the size container `drafts`; the `draft-table` variant (`@container drafts (min-width: 34rem)`) makes each draft's link a grid row `7.5rem 4rem 5rem minmax(0,1fr)` (20.75rem fixed with gaps and padding, 13.25rem for the first words at the threshold); the comma between source and line count stays in the DOM, `sr-only` in the table look. The overview's `fullWidth` sentence now lists `/trace` too.
- Seen failing first against the old `src/app`: AC-0001, AC-0004, AC-0005 at every size, and AC-0016 at 1280 px. AC-0023 and AC-0016 at 390 px pass on the old page, as unchanged behavior should. AC-0022 checks text the old page already had, so it guards against a table look that drops the comma rather than showing a change.
- `npm test` after the slot fix (log `.context/s3b-t2-npmtest.log`): Vitest 55 files, 1050 passed; Playwright 914 passed in 11.9 min; no flake. The overview edit landed during that run, and `test/network.test.ts` (39 tests, the suite that reads the docs) passed on a rerun at `c0c28ca`. No existing test file changed.
