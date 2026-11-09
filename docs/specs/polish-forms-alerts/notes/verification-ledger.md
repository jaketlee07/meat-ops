# Verification ledger: polish-forms-alerts

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/66ead429-0279-4602-ad5e-19d0896a98a3/`.

## Owner decisions (2026-11-09)

The owner's 2026-11-09 product decisions are the Product lines in the spec's [Assumptions](../spec.md#assumptions).

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 (at `4e7e5d3`) | 16 findings: 10 sustained and accepted, 5 refuted, 1 indeterminate | 12 findings, all accepted |
| 2 (delta `4e7e5d3..dfee0d9`) | 6 findings: 4 sustained and accepted, 2 refuted | 8 findings, all accepted |
| 3 (delta `dfee0d9..a102622`) | 2 findings: 2 sustained and accepted | 4 findings, all accepted |
| 4 (delta `a102622..78c70f3`) | Not run (three-round cap) | 3 findings, all accepted |
| 5 (delta `78c70f3..d700fba`) | Not run (three-round cap) | 2 Low findings on ledger wording, applied as nonmaterial corrections without a further round |

- Round 1's indeterminate adversarial finding asked how much room a date box's text keeps once the calendar icon is in place. The first two of the throwaway Chromium probes that the spec's probe Assumption records answered it, and the owner chose on 2026-11-09 to proceed to round 2 with them as the evidence.
- Round 1 refuted (no change): finding 5 (keyboard presses fall under AC-0020's unqualified "second press"), 11 (the digest's 45rem width is held by the overview and AC-0029), 13 (the Always-do bullet keeps every role, the empty live regions included), 14 (keeping or removing the shell's unused cap is a build-time choice), and 16 (Receiving and Sales show money at two decimals in their price lines).
- Round 2 refuted (no change): finding 3 (a dialog reopened after a refused request gives AC-0033's Cancel a press with nothing waiting, which the plan now names) and 6 (AC-0031 already covers the keyboard-only test's photo focus step, which T2 now names too). A third throwaway probe, recorded in the spec's probe Assumption, grounds AC-0007's screenshot comparison and AC-0004's scroll-width check.
- Adversarial round 3's two repairs (T6's measured growth, T1's ledger Touches) were checked by shaping rounds 4 and 5 only, since the adversarial reviewer's three rounds were used.
- Deletion pass over what review added: AC-0024's rewrite, AC-0021's narrowest width, AC-0033, and AC-0034 conform to the leftovers intent, the waiting-control rule, and accessibility; T1's red run of AC-0004, T5's reopened-dialog press, and T6's per-layout in-flight expectations are needed to verify their criteria. One is a scope call: AC-0008 asks the owner to press each date box's calendar icon by hand at the AC-0029 sitting. Nothing contradicts a non-goal.
- Pre-EXECUTE gates: the adversarial gate ran (three rounds); no security gate fires, since the spec changes no security boundary, data flow, or guarding control. `creative-direction` and `design-review` are not installed (named skip); the comparison page and look E are the design reference.

## Approval (2026-11-09)

- The owner approved the spec and the plan on 2026-11-09 (PR #61, merged as `0966245`) and chose to start building.
- Work-loop run `66ead429-0279-4602-ad5e-19d0896a98a3`. `approve-plan` recorded spec hash `1a26bc4bacca…` and plan hash `c9f613cf758d…`. The schedule's waves are T1, T3, and T5; then T2 and T4; then T6; then T7, run one task at a time.
- Base: `0966245` on branch `feat/polish-forms-alerts` in the main folder, on stack A.
- For this build the owner approved stopping the app server that runs from this folder and starting it again from a fresh build when the work is done; running the stack A slot fix before each full test run; and committing each task on `feat/polish-forms-alerts`, then opening one PR.

## T1 (2026-11-09)

- `src/app/form-parts.ts` holds the label classes (`block text-sm font-medium text-ink-secondary`), the field box classes, and the pair classes; every form and dialog AC-0001 names takes its labels from it. Pricing's list-price and target margin forms and the draft review keep their own box classes, which differ in margin and grid placement. The draft review's "Save this line" row and Menu's switch keep their checkbox labels.
- Each floor form is a size container named `fields`. The `field-pair` variant applies from 14.75rem of it. Its inner width is the same on Receiving, Production, and Sales: 328 px (20.5rem) at 390 px, 306 px (19.13rem) at 1024 px, and 246 px (15.38rem) at 1280 px at the default text size; with 20 px text, 313 px (15.65rem), 298 px (14.9rem), and 238 px (11.9rem). A number box needs 111 px of scroll width at 16 px text and 136 px at 20 px for 12,345.678, so a pair needs about 14.63rem; 14.5rem left a box 1 px short. Pairs share a line at every named width and size except 1280 px with 20 px text, where they stack.
- Each pair's two fields share three subgrid rows, so a label that wraps ("Finished lbs (optional)") keeps both box tops level. The plan's Design did not name this; without it the AC-0002 top check failed on Production at 1280 px and at 390 and 1024 px with 20 px text. The DOM order is unchanged.
- On the old tree 37 of the 43 new tests in `test/e2e/look-polish-forms.spec.ts` failed: all 8 AC-0001 tests, all 9 AC-0002 tests, and 15 of the 18 AC-0004 tests. The 3 AC-0004 tests at 1280 px with 20 px text passed, since that case stacks and a full-width box holds the value. The 6 AC-0028 tests guard today's Tab order and passed.
- AC-0004 seen red: a scratch rule `#cost { width: 4rem; }` in `globals.css` turned all 6 `/receiving` AC-0004 tests red ("scroll width against client width": 111 against 62 at 16 px text, 136 against 78 at 20 px); the rule was removed and the 43 tests passed again.
- No existing test expectation changed.
- Slot fix before the full run: 154,881 dead `pg_class` rows and slot age 34,849 before, 0 and 5 after. The folder check listed only another project's folder.
- `npm test`: Vitest 55 files, 1052 passed; Playwright 1092 passed and 1 failed in 16.0 min. The failure was `look-floor-pages.spec.ts` "AC-0007: at 1280x720 a reverse refusal spans its batch's row below the figures", a 30 s timeout on the Reverse dialog's "Reverse batch" button ("element is not stable", then detached); it passed alone on its rerun. T1 changed only that dialog's label classes, so the next full run watches it.
