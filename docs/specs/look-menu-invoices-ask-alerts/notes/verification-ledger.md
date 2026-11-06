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

## T3 (2026-11-06)

- Commit `ef9eac6`. Four new containers and variants in `src/app/globals.css`: `review` (the editing view; `review-split` at 43rem, a 20rem capture column, a 1rem gap, and a 22rem lines column; only a photo is sticky), `line` (each fieldset; `line-pair` at 32rem, three 9.5rem fields with two 0.75rem gaps and 2.125rem of padding and border, so the date field keeps its text and picker), `lines` (the Lines form; `lines-row` at 20rem puts Save receipts and Discard draft side by side), and `saved` (Saved receipts; `saved-pair` at 50rem, two 24.5rem cards and a 1rem gap). Saved receipts' `ul` holds exactly the lots and the tables sit in their own grid; it is not a `result` container. `src/app/invoices/page.tsx` changed only the Back link's radius to `rounded-control`. The plan's design said "about 30rem" for the line rows and named three containers; both are working material, and the built values are above.
- The press guard: one `pressRef` for both buttons, set on press before `dispatch` and cleared by a `release` callback that `run` calls in a `finally`, so it clears on every outcome, including `checkSave`'s refusal. The buttons carry `aria-disabled` while `pending` and no `disabled`; Save receipts fades its fill and Discard draft its text and border at 60% alpha.
- Seen failing first (`src/app` stashed, log `.context/s3b-t3-red.log`): 22 of the 41 new tests (AC-0006 side by side, AC-0007, AC-0008 rows, AC-0009 pairs, AC-0021, AC-0010, AC-0020's second-press tests, AC-0025); the stacked, refused-save, and page-state tests pass on the old page. With the two `if (pressRef.current) return;` lines removed (log `.context/s3b-t3-noguard.log`), both second-press tests fail on the count, 4 requests where 1 is expected. AC-0001 for a draft's review is T2's test.
- `npm test` after the slot fix (log `.context/s3b-t3-npmtest.log`): Vitest 55 files, 1050 passed; Playwright 951 passed in 12.3 min; no flake; no file edited during the run. No existing test file changed.

## T4 (2026-11-06)

- Commit `f71fb88`. `/ask` keeps the 544 px cap (no `fullWidth`). The question form, the answer, and "Questions Ask can answer" are white cards; fields, buttons, the choice buttons, Look it up again, and the answer link use `rounded-control`; the primary buttons are `font-bold` like the other pages'. The message and choices area has no card, the examples section stays a direct child of `<main>`, and no `rounded-md` remains in `src/app/ask/`.
- AC-0001 for `/ask` and AC-0016 for `/ask` with an answer passed before the restyle too: the cap already held and the page was already accessible. The card look itself is the owner's comparison in AC-0017.
- `npm test` after the slot fix (log `.context/s3b-t4-npmtest.log`): Vitest 55 files, 1050 passed; Playwright 954 passed in 12.3 min; no flake. No existing test file changed.

## T5 (2026-11-06)

- Commit `27853c7`. `/alerts` passes `fullWidth`; Today's digest is one white card whose paragraphs, footer, and status line are at most 45rem wide, and Try again is its own width from `desk`. Each section is the size container `alerts`: the `alert-pair` variant (44rem: two cards of at least 21.5rem and a 1rem gap) sets its list in a grid of two columns, never more. Each card is the size container `alert`: the `alert-row` variant (24rem inside: a reprice button of about 17rem, a 0.75rem gap, and Dismiss at about 6rem) sets the reprice form, the link, and the Dismiss form in a row at their own widths. The sentence stays the card's first `p`, the reprice button its only button without an `aria-label`, and DOM and Tab order are unchanged.
- Seen failing first (`src/app` stashed, log `.context/s3b-t5-red.log`): AC-0001, AC-0011 paired at every size, AC-0012 side by side, and AC-0025. The stacked cases, AC-0012 at 390 px, AC-0024, and AC-0013 pass on the old page, which was one column with spanning buttons and short paragraphs. The two AC-0016 tests failed there on the test's own first Tab list, since corrected.
- `npm test` after the slot fix (log `.context/s3b-t5-npmtest.log`): Vitest 55 files, 1050 passed; Playwright 975 passed in 12.7 min; no flake; no file edited during the run. No existing test file changed.

## T6 (2026-11-06)

- Commit `29fe060`. `test/look-tidy.test.ts` gains the AC-0014 test: every class under the four page folders that starts `rounded` after its variant prefixes is stripped must match `rounded(-side or corner)?-(control|card|mark)`, `rounded-full`, or `rounded-none`; the only exception is `file:rounded-md` in `src/app/invoices/read-forms.tsx`. The four existing tests in the file are unchanged.
- Seen failing: a `rounded-md` class and, separately, a `desk:rounded-lg` class added to `src/app/menu/error.tsx` each failed the test naming that class; `git diff --stat src` was empty after both.
- `npm test` after the slot fix (log `.context/s3b-t6-npmtest.log`): Vitest 55 files, 1051 passed; Playwright 975 passed in 12.6 min; no flake.

## T7 captures and the T8 amendment (2026-11-06)

- The ten AC-0017 states were captured at `10cb96b` (code as at `29fe060`) with `.context/recorded-run/s3b-captures.spec.ts` through the suite's own web servers (a fresh build and the fake model) and placed on the canvas beside the boards (version 1793954751-bfb1, row "Spec 3b as built" at y 29000).
- The owner answered on 2026-11-06 "Match; fix the 3 first": the layouts match, and three style details must match the boards before the verdict is recorded: the "Drafts to confirm" heading sits outside its card; a line's "Line n" legend sits on its card's top border; each saved lot card starts with a rule above "Lot number". The checkboxes' 44 px boxes and the links' indents stay as the app has them.
- Controlled amendment on the owner's approval: a new task T8 fixes the three details with pins in the suite; T7 runs after T8 and its records name a commit at or after T8's last commit. The spec is unchanged.
- Amendment reviews: round 1 (shaping 2 findings, adversarial 1 Blocker, 3 Concerns, 1 Nit) and round 2 (shaping 1 Medium and 1 Low, adversarial 1 Concern and 1 Nit), all accepted; reports `amend1-*` and `amend2-*` in the spec-stage review folder. The lot-card pin measures the facts list's own top border (`facts.tsx` puts `border-y` on the `dl`), and a probe showed the legend pin fails on a default legend and passes on a floated one.
- The owner chose on 2026-11-06 that on a phone "Drafts to confirm" keeps its heading above separate draft cards, like Menu's phone layout, and accepted that difference from S3b-Invoices-Phone; on a desktop the heading moves inside the table's card. The round 2 Nits (a repeated card-look list, T6's test file) were wording corrections, applied without another round.
- The owner's 2026-11-06 answer "Match; fix the 3 first" approved adding T8, its review, the fix, and a retake; the amended plan is approved on that answer.

## T8 (2026-11-06)

- Commit `1535da4`. In the table look the "Drafts to confirm" heading sits inside the one white card (same id, level, and text; the section's name unchanged); in the card look it stays above the separate draft cards. Each line's legend is `float-left` inside its card, still the fieldset's `legend`, and the "Invoice says" paragraph clears it. Each saved lot card's `li` takes the `dl`'s top border off with `[&>dl]:border-t-0`; `facts.tsx` is unchanged. The overview's drafts sentence says the table card holds the heading.
- The three pins (titled AC-0017) each failed against `29fe060`'s three source files: no white card held the heading and the three links; each legend's top equalled its fieldset's top (744 against a 744.5 minimum at 390 px, 220 against 220.5 at 1280 px); the lot card's `dl` had a 1 px top border. All four tests pass after the change. No existing test changed.
- `npm test` after the slot fix (log `.context/s3b-t8-npmtest.log`): Vitest 55 files, 1051 passed; Playwright 979 passed in 14.0 min; no flake. `npm run typecheck` passes.

## T7 (2026-11-06)

- AC-0017: the ten states were captured again at `6a2c4be` (code as at T8's `1535da4`) with `.context/recorded-run/s3b-captures.spec.ts` and placed on the canvas (version 1793979411-f405, row "Spec 3b as built"). The owner compared each with its board at revision 1793945225-763f on 2026-11-06 and answered "All ten match" for S3b-Menu-Phone, S3b-Menu-Desktop, S3b-Invoices-Phone, S3b-Invoices-Desktop, S3b-Draft-Desktop, S3b-Draft-Saved-Desktop, S3b-Ask-Phone, S3b-Ask-Desktop, S3b-Alerts-Phone, and S3b-Alerts-Desktop. The phone drafts' separate cards are the owner's accepted difference recorded above.
- AC-0015: `npm test` at `1535da4`, T8's last commit: Vitest 55 files, 1051 passed; Playwright 979 passed in 14.0 min (log `.context/s3b-t8-npmtest.log`). The commits after it change only this ledger.
- AC-0018: `git diff 3703c8d -- src/app/facts.tsx src/app/before-after.tsx` at `1535da4` is empty; neither file changed on this branch.
- AC-0019: `git diff 3703c8d -- test` read in full at `1535da4`, and `git ls-files --others --exclude-standard -- test` lists nothing. Changed expectations in existing test files: none. `test/e2e/look-floor-pages.spec.ts` lost the checks moved to `test/e2e/look-checks.ts` (every removed line is in the new file once its `export ` is stripped) and gained one import; `test/look-tidy.test.ts` gained the AC-0014 test and lost no line. Everything else is the new `test/e2e/look-menu-invoices-ask-alerts.spec.ts` and `test/e2e/look-checks.ts`.

## Post-gates review round 1 and the T9 amendment (2026-11-06)

- Round 1 reviewed `git diff 3703c8d db21250` (adversarial, quality, frontend); reports and adjudications sit under `.context/reviews/1f080e1d-0bbe-4bfd-9914-5317f17e399b/` as `1-post-gates-*`. Sustained: adversarial 8 (1 Blocker, 2 Concerns), quality 10 (1 Concern), frontend 4 (1 Concern); refuted: adversarial 1 (the phone drafts difference already lives in the overview and this ledger). Recorded as review round 1, retry 1, 22 fingerprints.
- The twelve distinct issues: (1) the draft review's press guard clears in `run`'s `finally` before the outcome renders, so a press in that span sends a second action (Blocker; all three reviewers); (2) the Invoices AC-0016 test at 1280 px runs no `checkPageState`; (3) the AC-0014 search misses `name-[...]:` and `*:` prefixes and has no positive control; (4) no AC-0020 case presses before the waiting render; (5) Menu's switch loses the top of its focus ring in the table look; (6) at 1280 px the Product picker cuts the chosen name; (7) the `line-pair` and `alert-pair` comments state wrong arithmetic, which the T3 and T5 entries above repeat; (8) AC-0010 reads Discard draft's rest state and never checks it; (9) the suite repeats checks, a title literal, and an import; (10) `look-checks.ts`'s comments overstate who uses it; (11) the overview's `test/e2e/` row, look-note variant list, and `test/` row are stale; (12) the ledger's T3 and T5 figures (see 7).
- The owner approved on 2026-11-06 a plan amendment adding task T9 that fixes all twelve, the Product picker taking the wider column; T7 reruns after T9, with the ten captures retaken for the owner's re-check.
- Probe for the T9 amendment (2026-11-06, `2-probe-press-span.spec.ts` and its log in the post-gates review folder, a build of `1535da4` through the suite's web servers): with a held save released, Save receipts pressed from inside the page every 10 ms reached the span after `run`'s `finally` on 3 of 3 runs (1, 2, and 2 refused second saves logged), and pressed on every task on 3 of 3 runs (642, 693, and 715 refused second saves). In none of the six runs did the draft result show within 15 s; the cause was not probed.
- T9 amendment reviews: round 1 (shaping 7, adversarial 8), round 2 (shaping 5, adversarial 3), and round 3 (both Clean); reports `amend1-*` to `amend3-*` in the post-gates review folder. The owner's 2026-11-06 answer "Add task 9, fix all 12" approved the amendment, its review, the fixes, and the retake; the amended plan is approved on that answer.

## T9 (2026-11-06)

- Commit `94ff670`. `save()` and `discard()` return while `pressRef.current || pending`, so a press is refused from the first press until the outcome renders. Product takes the wider track where `line-pair` applies (`minmax(0,2fr) minmax(0,1fr)`; a 3fr/2fr try failed the narrowest paired case, 300 px against 306.5). Menu's switch label has `menu-table:py-1.5`, so its focus ring sits inside the card's padding box. The `line-pair` and `alert-pair` comments, `look-checks.ts`'s comments, and the overview's `src/app`, `test/e2e/`, look-note, and `test/` rows are corrected.
- Corrections to the T3 and T5 entries above: a container query reads the fieldset's content box, so `line-pair`'s 32rem holds three fields of about 10.2rem ((32 - 1.5) / 3) with no padding term, and each line's fieldset content box is 22.4rem at 1024 px and 38.4rem at 1280 px without a scrollbar, the Lines form being 24.5rem and 40.5rem (the "23.4rem at 1024 px" in the old `globals.css` comment was the 17 px scrollbar figure, not a figure the T3 entry stated); `alert-pair`'s cards sit in `gap-3`, 0.75rem, so each is at least 21.625rem. T3's guard, which released only in `finally`, is superseded by T9's.
- Red evidence (logs `.context/s3b-t9-red-A.log` to `-E.log`, each wrong build restored): the press train, pressing Save receipts then Discard draft in one task every 10 ms, failed 10 of 10 runs (5 after a save, 5 after a discard) on each of `1535da4`'s guard, a `pending` check in `save()` only, and one in `discard()` only, with more than one request and no outcome within 5 s; it ended on the 10 ms cadence. The same-task cases failed (2 requests where 1 is expected) on a build that checks `pending` with no ref. The Menu ring pin failed at `1535da4` with the ring's top 4 px outside the padding box at 1024, 1280, and 1440 px; the Product pin failed at `1535da4` (301 px against a needed 306.5 at 1280 px, 250 against 306.5 at the narrowest paired width). The old AC-0014 regex fails the new samples (`aria-[current=page]:rounded-lg` not flagged).
- Earlier tests changed, each on T9's closed list: the AC-0016 `checkPageState` call, the AC-0010 Discard draft rest assertion, T6's AC-0014 test rewritten, `MARGIN_TITLE` in the Alerts AC-0016 test, and the white-card and uncounted no-cap checks moved into one helper each with their checks unchanged.
- `npm test` after the slot fix (log `.context/s3b-t9-npmtest.log`): Vitest 55 files, 1052 passed; Playwright 988 passed in 15.5 min; no flake; no file edited during the run.
- Observed, not asserted: at the narrowest paired width the Vendor picker is about 167 px wide, so a long vendor name could be cut in its closed picker.

## T7 after T9 (2026-11-06)

- AC-0017: the ten states were captured again at `c40200c` (code as at T9's `94ff670`) and placed on the canvas (version 1793985434-91ef, row "Spec 3b as built"). The visible changes were the wider Product picker on a draft's review and the taller "Sellable only" row in Menu's table look. The owner compared each with its board at revision 1793945225-763f on 2026-11-06 and answered "All ten still match" for the ten boards the T7 entry above lists.
- AC-0015: `npm test` at `94ff670`, T9's last commit: Vitest 55 files, 1052 passed; Playwright 988 passed in 15.5 min (log `.context/s3b-t9-npmtest.log`). The commits after it change only this ledger.
- AC-0018: `git diff 3703c8d -- src/app/facts.tsx src/app/before-after.tsx` at `94ff670` is empty.
- AC-0019: `git diff 3703c8d -- test` read in full at `94ff670`, and `git ls-files --others --exclude-standard -- test` lists nothing. Changed expectations in existing browser test files: none. `test/e2e/look-floor-pages.spec.ts` lost the checks moved to `test/e2e/look-checks.ts` and gained one import; in the module, `expectNoCap` now reads the widths through `childWidthCaps(page, 3)`, whose `toBeGreaterThanOrEqual(3)` is the same check as the moved `toBeGreaterThan(2)` for a count of children, and the module's comments were reworded in T9. Everything else is the new `test/e2e/look-menu-invoices-ask-alerts.spec.ts` and `test/e2e/look-checks.ts`; `test/look-tidy.test.ts` (Vitest) gained the AC-0014 test, rewritten in T9.

## Post-gates review round 2 and its fixes (2026-11-06)

- Round 2 reviewed the delta `git diff db21250 e7476f2` (reports and adjudications `2-post-gates-*` in the post-gates review folder): frontend Clean; adversarial 2 Nits and quality 5 Nits, all sustained, none refuted. Recorded as review round 2, retry 2, 7 fingerprints. Every round 1 finding is resolved.
- Fixed in `aec94b4`, inside T9's Touches: the AC-0014 search keeps a quote inside square brackets as part of its class and pins the quoted-bracket form and the leading and trailing important mark (seen failing first against the head's matcher, and with the mark strip removed; the installed Tailwind 4.3.3 accepts a trailing `!`); the AC-0017 drafts-heading walk reads the card style through `cardStyle` and compares values by key; `expectNoCap(page, minChildren = 3)` states its minimum, with Menu and Alerts passing 2; the press train's comment names `pending` and the train keeps only its 10 ms cadence; the overview's `test/e2e/` row says which `look-checks.ts` checks each suite imports. The adversarial Nit on this ledger's T3 correction is fixed in the T9 entry above.
- `npm test` at `aec94b4` after the slot fix (log `.context/s3b-r2fix-npmtest.log`): Vitest 55 files, 1052 passed; Playwright 988 passed in 13.8 min; no flake.
