# Verification ledger: look-pricing-receiving

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/70ba4557-71e1-46c4-ad4d-7f3af4085d26/`.

## Owner decisions (2026-11-05)

The spec's Assumptions record each of these as a Product line:

- The stock card sits below the "New receipt" form on a phone, so the form does not move when the card loads.
- Beside the details panel the page shows the tiles and the list and no what-if section; Tab reaches the panel first; on a phone the details show alone.
- The boards were redrawn to today's words, published as canvas revision 1793856599-9c48.
- Both pages show cards below 1280 px and tables from 1280 px up.

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 | 4 Blockers and 7 Concerns sustained, 4 Nits; 1 indeterminate settled by the owner | 10 findings, 4 advisory |
| 2 | 2 Concerns and 4 Nits, all accepted without dispute | 4 Low, 2 advisory |
| 3 | 1 Nit on plan Design (working material), repaired | Clean |

- Named skips at the pre-EXECUTE gate: `frontend-engineering` (installed in the user's skills) is not loaded, because it excludes edits to an existing surface that already has a grounded aesthetic reference, and the canvas boards and spec 1's tokens are that reference (AC-0018). `creative-direction` and `design-review` are not installed. The security-reviewer did not fire: no auth, session, input, or file or network control changes, and no server action changes.

## Approval (2026-11-05)

- The owner approved the spec and the plan in chat on 2026-11-05, including the 1280 px table width, and chose to start building. The owner also approved the stack A Realtime slot fix before each full test run for this build.
- Work-loop run `2883dc24-d404-4724-8f6f-4e41bff3ec8b`. `approve-plan` recorded spec hash `c9af1376cffd…` and plan hash `557bee333542…`. The schedule runs T1, then T2 and T3 (one at a time), then T4, T5, and T6.
- Base: `2d9f923` on branch `feat/look-pricing-receiving` in the main folder, on stack A.
- Project knowledge: capture at the spec and plan gates was not attempted; it refused with `strict_parse` in earlier runs, so this run records it as unavailable.

## T1 (2026-11-05)

- Commit `7aca3f1`. `test/look-source.test.ts` failed 3 of 3 on the tree before the change and passed 3 of 3 after it. `npm test`: Vitest 1046 passed in 41.5 s; Playwright 752 passed in 10.3 min.
- Bookkeeping: the cohort's wave pointer advanced to wave 2 before the engine's `wave-passed` fired, so `wave-passed` was fired with `--wave-index 1` to match the pointer. Wave 1 (T1) passed its gates; no wave was skipped, and wave 2 (T2, T3) is next.

## T2 (2026-11-05)

- Commit `4fc407b`. A script that blanks every `className` value finds `facts.tsx` and `before-after.tsx` otherwise identical to `8b32b12`: only classes changed. `npm test`: Vitest 1046 passed in 48 s; Playwright 752 passed in 10.3 min.
- A first version with 10 px of outer table padding failed two 320 px sideways-scroll checks (`correct.spec.ts:213`, `receiving.spec.ts:458`); the committed version keeps the original side padding, so the table's header tint sits flush with the text where the board insets it by 10 px.

## T3 (2026-11-05)

- Commit `8be3ec0`. `look-pages.spec.ts` gained 12 tests; with the source changes stashed, 6 failed (AC-0001, AC-0002 full and emptied-group states, AC-0003) and 6 passed by design (AC-0002 with no product and AC-0004, which pin behavior that must not change below 1280 px). All 12 pass on the change. `npm test`: Vitest 1046 passed; Playwright 762 passed in 10.1 min; no reruns.
- The table look uses one `minmax(0, ...)` column template on the header line and every row, a subgrid `dl`, and `display: contents` on each figure's wrapper, so each value is a grid cell; `figure.tsx` is unchanged. The board's 12 px tile and phone-button radii use Tailwind's `rounded-xl`.

## T4 (2026-11-05)

- Commit `5affd74`. With `src/app` stashed, 12 of the 13 new tests failed; AC-0021 passed, because the old details page had no what-if either, so it guards against a regression. All pass on the change. `npm test`: Vitest 1046 passed in 45.9 s; Playwright 775 passed in 10.8 min.
- AC-0020 changes in existing test files, scope only: `detail()` in `test/e2e/pricing-page.ts` reads inside the "Product details" region; in `test/e2e/pricing.spec.ts` the `figures()` helper, the order check (`dt, p`), and two `const main` locators read inside the same region. No asserted value, name, count, or order changed.
- The panel keeps the advice stacked at 1280 px through descendant classes in `pricing-detail.tsx`, because `price-advice-block.tsx` (which holds the list row's 1280 px styling) is not in T4's Touches. The board's bold "Cost per lb" and "Suggested price" build-up rows are not bold: `Figure` takes no weight option. Both are noted for the review and the owner's comparison.

## T5 and the screenshot polish (2026-11-05)

- T5 commit `f728ae8`. Its 13 new tests were written after the code and passed on their first run; they were not seen failing first. `npm test`: Vitest 1046 passed; Playwright 786 passed in 10.5 min. A first full run failed `receiving.spec.ts:458` (sideways scroll at 320 px from the result card's padding); the committed version uses smaller phone padding.
- Screenshots of the five AC-0018 states (`.context/recorded-run/s2-captures.spec.ts`, run with `PLAYWRIGHT_FORCE_ASYNC_LOADER=1` after `npm run build`) showed four gaps against the boards: mid-word breaks and misaligned columns in the 1280 px receipts table, plain rows where the stock card draws two tinted tiles, the details view's list starting 24 px below the panel, and the build-up's "Cost per lb" and "Suggested price" rows not bold.
- Polish commit `db3d64c` closes all four within the plan's Touches: a shared receipts column template with fixed number columns and no mid-word breaks, a `tiles` option on `Facts` and a `--color-tint` token, the list's top margin dropped beside the panel while its message regions are empty, and a `strong` option on `Figure`. `Facts` and `Figure` options only choose classes. `npm test`: Vitest 1046 passed in 43 s; Playwright 786 passed in 10.5 min.

## T6: recorded checks (2026-11-05)

### AC-0018: the owner's comparison with the boards

The owner compared each built screen with its board on the UI directions canvas and answered "All five match" in chat on 2026-11-05. The boards are at revision 1793856599-9c48. The as-built screenshots sit in the canvas row "Spec 2 as built" (canvas version 1793865441-ab08). They were captured from a build of `db3d64c` by `.context/recorded-run/s2-captures.spec.ts`, on test data only.

| Board | Built state | Verdict |
| --- | --- | --- |
| S2-Pricing-Phone | `/pricing` at 390 px, products in all three groups | match |
| S2-Receiving-Phone | `/receiving?product=RAW-TOM` at 390 px, three receipts, one void | match |
| S2-BeforeAfter | the "Receipt saved" result card alone at 390 px | match |
| S2-Pricing-Desktop | `/pricing?product=NB` at 1280 px, a product that needs a new price | match |
| S2-Receiving-Desktop | `/receiving?product=RAW-TOM` at 1280 px, three receipts, one void | match |

Shown to the owner before the verdict: real lot numbers are longer than the boards', so desktop receipt rows wrap and Void and Correct stack; the before-and-after header tint runs edge to edge, because a 10 px inset scrolled sideways at 320 px; the test data shows an urgent-alerts banner the boards do not draw.

Re-verdict on the final build (2026-11-05): the review fixes changed S2-Receiving-Desktop (rebalanced receipt columns; lot numbers wrap once, at the second hyphen) and S2-Pricing-Desktop (the open row's edge drawn as an inset shadow). The owner compared both, retaken from a build of `21a6886` (canvas version 1793893414-5cb6, boards titled "As built (after review fixes)"), and answered "Both match". The three phone and result boards are unchanged by the fixes: the Pricing phone capture is byte-identical, and the Receiving phone and result changes apply only from 1280 px.

### AC-0017: the whole suite

`npm test` on `21a6886`, the last code commit: Vitest 54 files, 1047 passed in 54.6 s; Playwright 794 passed in 10.6 min. The folder check listed no folder, and the slot fix ran first.

### AC-0019: the shared parts' markup

`git diff 2d9f923 21a6886 -- src/app/facts.tsx src/app/before-after.tsx`, read in full. `BeforeAfter` changed only `className` values. `Facts` gained one `look` prop ("list", the default, "tiles", or "cells") that picks class strings from four lookup tables; called with `rows` alone, as on `main`, it renders the same `dl`, `div`, `dt`, and `dd` in the same nesting, with the same `key`s and text and no attribute other than `class` changed.

### AC-0020: the test diff

`git diff 2d9f923 21a6886 -- test/e2e`, read in full; `git ls-files --others --exclude-standard -- test` lists nothing. New files: `test/e2e/look-pages.spec.ts` and `test/look-source.test.ts`. Changed lines in existing test files:

- `test/e2e/pricing-page.ts`, `detail()`: `main`, `heading`, the five controls, and the four message locators read inside the "Product details" region.
- `test/e2e/pricing.spec.ts`: the `figures()` helper (`dt` and `dd`), the AC-0080/AC-0082 order check (`dt, p`), and the `const main` locators of the two AC-0083 tests read inside the same region.
- `test/e2e/pricing.spec.ts` line 827, the unknown-code loop: `detail(page).target` is written out as `page.getByRole("textbox", { name: "Target margin %" })`, the same page-wide locator `main` used, so it asserts what `main` asserted.

No asserted value, name, count, or order changed.

## Post-gates review round 1 (2026-11-05)

- Reviewers: adversarial-reviewer, quality-engineer, and frontend-reviewer in parallel. Named skips: `experience-reviewer` is not installed; `security-reviewer` did not fire (no auth, input, secret, or data-flow change).
- A controller probe at 1280 px on a build of `db3d64c` confirmed the two worst findings: after a correction, the "Receipt corrected" panel sat in the 96 px actions column and its tables ran past the section (right edges 1372 to 1428 px against the section's 1252 px); "1,234.567 lbs" read `scrollWidth` 92 in a 72 px cell.
- Adjudicated: 25 sustained (2 Blockers, 4 Concerns, 19 Nits), 8 refuted (among them the shared parts on the page background before spec 3, which the brief accepts). Recorded as round 1, retry 1.
- Fix commits `737d605` and `da7ca0b`: the correction panel and refusals take a full row from 1280 px; every receipt value the form accepts fits its cell (tested with 100,000.125 lbs, $12.3456/lb, and a 36-letter vendor); `Facts` takes one `look` prop and the receipts own their column rules; the advice block and its button take `look: "row" | "stacked"`; the list owns its top spacing beside the panel; the unknown-code view lifts the cap; `pricing.spec.ts` line 827 checks the whole page again; desktop walks at 1280 px, stronger AC-0003, AC-0004, AC-0005, and AC-0006 checks, and a saved-result column test; the source search covers every text file type under `src/app`. Deferred Nit: renaming `detail(page).main` (quality-engineer finding 14), to keep existing-test churn down.
- The new long-value, corrected-panel, column-alignment, and accent-edge tests failed against `65735c4`; the top-alignment test failed with the list's own margin rule removed. The lot column was widened after a recapture showed lot numbers on three lines; the screenshots now match the signed-off look.
- `npm test` on `da7ca0b`: Vitest 1046 passed in 44.7 s; Playwright 790 passed in 10.6 min.

## Post-gates review round 2 (2026-11-05)

- Delta review of `737d605` and `da7ca0b`. Adjudicated: adversarial 1 Blocker, 2 Concerns, 1 Nit; quality-engineer 5 Nits; frontend-reviewer 1 Nit and 1 indeterminate.
- Owner ruling on the indeterminate (frontend finding 1), 2026-11-05: with a larger browser text size, Recent receipts stay as cards until their section is wide enough for the table, so Void and Correct stay usable; at the default text size the table shows from 1280 px as signed off. Evidence shown to the owner: a probe on a build of `da7ca0b` with a 20 px root font at 1280 px put Correct at 1281 to 1391 px and Void at 1309 to 1391 px, past the section's 1245 px edge, which clips; at 16 px both sat inside (section edge 1252 px, buttons end 1235 px); at 1440 px and 20 px both sat inside.
- The adversarial Blocker reopens AC-0018 for S2-Receiving-Desktop and S2-Pricing-Desktop: the fix commits changed the receipts columns and the open row's edge after the owner's verdict, so the owner compares those two screens again on the final build.
- Deferred Nit (frontend finding 2): at 1280 px the Vendor column is about 54 px wide, so a vendor word of eight or more letters breaks inside the word; the other columns hold the lot number, a six-digit weight, and the buttons, so no track can give up width without breaking AC-0012's fixture.

## Post-gates review round 2 fixes (2026-11-05)

- Fix commit `21a6886`: a `receipt-table` variant in `globals.css` needs both the 1280 px width and a Recent receipts section at least 38rem wide, so a larger text size keeps the receipts as cards (at 1440 px with 20 px text they are cards too); a `receipt-message` variant states the full-row condition once; the AC-0012 tops check covers every row; the one-piece check covers Weight, Cost per lb, and Remaining; three tests renamed without AC ids; AC-0001 covers `/pricing?product=` with an unknown code; the source search must read `globals.css` and a `.ts` file.
- The text-size test failed against `da7ca0b`'s source; the refusal full-row test failed with the message-row classes removed. `npm test` on `21a6886`: Vitest 1047 passed; Playwright 794 passed in 10.6 min.

## Post-gates review round 3 and the AC-0012 amendment (2026-11-05)

- Delta review of `21a6886` and the ledger rewrite. Adjudicated: adversarial 1 Blocker (AC-0012 still promised the table at every width from 1280 px, while `21a6886` shows cards at a larger text size, as the owner ruled) and 1 Nit (the overview row's wording); quality-engineer 1 Concern (the 20 px text step's label check passes for visually hidden labels) and 3 Nits (a row-height check that cannot fail, the `VALUE_CLASS` comment, the `receipt-message` variant's comment and name). Recorded as round 3, retry 3.
- Deferred Nit (frontend round 3, not adjudicated, Nit-only): with an always-visible scrollbar the 1280 px receipts section clears the 38rem table threshold by 1 to 3 px; the table still shows.
- Owner approval of the amendment, 2026-11-05, in chat, of this exact text. AC-0012: "At 1280 px and wider, at the browser's default text size, each recent receipt's six figures (Lot number, Received, Vendor, Weight, Cost per lb, Remaining) sit on one line, under one header line that names them in that order. No figure's text runs past its cell." New AC-0022: "With the browser's text size at 20 px, Recent receipts show as cards, each label beside its value, at 1280 px and 1440 px, and as the table at 1920 px; at each of these widths every Void and Correct button sits inside the Recent receipts section." Plus one new task for the round 3 test and comment fixes. The owner asked to be consulted again only if the spec check changes this wording.
- Amendment review round 1 (adversarial and shaping, delta scope): AC-0012 and AC-0022 matched the owner-approved text word for word. Repairs: T6 now depends on T7 and runs its checks after it; T7's 1920 px step checks the table rows; T7 proves the signed-off look unchanged by a full read of its `src/app` diff from `21a6886`; the overview rows name T7 and the `receipt-table` variant. The shaping reviewer asked to split AC-0022; the owner approved the split on 2026-11-05: AC-0022 "With the browser's text size at 20 px, Recent receipts show as cards, each label beside its value, at 1280 px and 1440 px, and as the table at 1920 px." and AC-0023 "With the browser's text size at 20 px, at 1280 px, 1440 px, and 1920 px, every Void and Correct button sits inside the Recent receipts section."
- Amendment reviews rounds 2 to 4 (adversarial and shaping, delta scope) moved T7's AC-0018 proof from a stylesheet comparison to a full read of the `src/app` diff from `21a6886`, and made T6 name which verdicts stand at `21a6886`; round 4 was Clean from both. The spec and plan were re-approved on the owner's 2026-11-05 approval of the wording, which the reviews did not change after the split. `approve-plan` recorded spec hash `9676849bb1df…` and plan hash `b6a06cbc4213…`; the schedule runs T7, then T6.

## T7 and the T6 recheck (2026-11-05)

- T7 commit `c4da51b`. The larger-text-size test, titled for AC-0022, AC-0023, and AC-0012, failed with the cells look's `sr-only` rule moved back to `wide:` ("label 0 is not hidden", 1 px wide at 1280 px and 20 px text) and passes on the change. The AC-0012 tests drop the value-height comparison. `npm test` on `c4da51b`: Vitest 54 files, 1047 passed; Playwright 794 passed in 10.9 min.
- AC-0018 at the head: `git diff 21a6886 c4da51b -- src/app`, read in full, changes only the comment above `VALUE_CLASS` in `facts.tsx`, the comment above the message-row variant in `globals.css`, and that variant's name (`receipt-message` to `status-has-message`) in its one definition and its one use in `recent-receipts.tsx`. So the AC-0018 verdicts standing at `21a6886` (the owner's two desktop verdicts on a build of `21a6886` and the three phone and result verdicts from `db3d64c`) hold at `c4da51b`.
- AC-0017 at the head: the `c4da51b` run above.
- AC-0019 at the head: `git diff 2d9f923 c4da51b -- src/app/facts.tsx src/app/before-after.tsx` differs from the T6 read at `21a6886` only in the comment above `VALUE_CLASS`; `Facts` with `rows` alone still renders `main`'s elements, nesting, attributes other than `class`, and text.
- AC-0020 at the head: since `21a6886` no existing test file changed (only `test/e2e/look-pages.spec.ts`), and `git ls-files --others --exclude-standard -- test` lists nothing, so the T6 AC-0020 record holds at `c4da51b`.

## Ship (2026-11-05)

- Post-gates review round 4 (delta of the amendment and T7): quality-engineer Clean; adversarial-reviewer and frontend-reviewer each one Nit, deferred with its citation (the owner-decision list at line 13 above, which the later sections supersede, and the wording of the comment above `VALUE_CLASS`). No Blocker or Concern remains after four rounds (retry 3 of 5 recorded).
- Gates on the final code `c4da51b`: `npm test` passed (Vitest 1047, Playwright 794); `npm run typecheck` passes; `npm run audit` finds 0 vulnerabilities; `package.json`, `package-lock.json`, and `supabase/` are unchanged from `2d9f923`.
- All 23 criteria are checked; the spec is Shipped and the plan Done. The branch changes 1,317 lines added and 215 removed under `src/` and `test/`, below the 2,000-line review-shape threshold.

## Close-out (2026-11-05)

- PR #47 merged as `b5e7695` on 2026-11-05. The owner confirmed the lasting facts are in the overview, `globals.css`, and code comments, and chose `cool-30-days` (review on 2026-12-05). The tokens-and-icons intent is Fulfilled.
- Set aside by the review and queued by the owner into one Draft intent, `docs/product/intents/look-pricing-receiving-review-nits.md`: between 1024 and 1279 px the Pricing cards span the full content width (post-gates round 1 frontend finding 7, refuted only because no criterion covers that band); the 1280 px receipts table's Vendor column (about 54 px) and its 1 to 3 px scrollbar margin (deferred Nits, rounds 2 and 3); the details view's two reads run one after the other (round 1 frontend finding 6, refuted for lack of a latency rule); the `detail(page).main` helper name, the `VALUE_CLASS` comment wording, and the "In use" pill's borrowed card-border fill (round 1 and 4 Nits, round 1 frontend finding 5). The owner added: "ensure everything is dynamic".
- Not queued: the shared table's header band on the pages spec 3 restyles (the brief accepts the mixed look until spec 3), and the ledger's own superseded decision line, which goes with this folder.
