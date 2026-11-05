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

### AC-0017: the whole suite

`npm test` on `3f63c31` (code as of `db3d64c`): Vitest 54 files, 1046 passed in 42.2 s; Playwright 786 passed in 10.5 min. The folder check listed no folder, and the slot fix ran first.

### AC-0019: the shared parts' markup

`git diff 2d9f923 -- src/app/facts.tsx src/app/before-after.tsx`, read in full. `BeforeAfter` changed only `className` values. `Facts` gained `inline` and `tiles`, which only choose class strings; called with `rows` alone, as on `main`, it renders the same `dl`, `div`, `dt`, and `dd` in the same nesting, with the same `key`s and text and no attribute other than `class` changed.

### AC-0020: the test diff

`git diff 2d9f923 -- test/e2e`, read in full; `git ls-files --others --exclude-standard -- test/e2e` lists nothing. New files: `test/e2e/look-pages.spec.ts` and `test/look-source.test.ts`. Changed expectations in existing test files, each scoping a read on `/pricing?product=<code>` to the "Product details" region, with no asserted value, name, count, or order changed:

- `test/e2e/pricing-page.ts`, `detail()`: `main`, `heading`, the five controls, and the four message locators read inside the region.
- `test/e2e/pricing.spec.ts`: the `figures()` helper (`dt` and `dd`), the AC-0080/AC-0082 order check (`dt, p`), and the `const main` locators of the two AC-0083 tests read inside the region.

## Post-gates review round 1 (2026-11-05)

- Reviewers: adversarial-reviewer, quality-engineer, and frontend-reviewer in parallel. Named skips: `experience-reviewer` is not installed; `security-reviewer` did not fire (no auth, input, secret, or data-flow change).
- A controller probe at 1280 px on a build of `db3d64c` confirmed the two worst findings: after a correction, the "Receipt corrected" panel sat in the 96 px actions column and its tables ran past the section (right edges 1372 to 1428 px against the section's 1252 px); "1,234.567 lbs" read `scrollWidth` 92 in a 72 px cell.
- Adjudicated: 25 sustained (2 Blockers, 4 Concerns, 19 Nits), 8 refuted (among them the shared parts on the page background before spec 3, which the brief accepts). Recorded as round 1, retry 1.
- Fix commits `737d605` and `da7ca0b`: the correction panel and refusals take a full row from 1280 px; every receipt value the form accepts fits its cell (tested with 100,000.125 lbs, $12.3456/lb, and a 36-letter vendor); `Facts` takes one `look` prop and the receipts own their column rules; the advice block and its button take `look: "row" | "stacked"`; the list owns its top spacing beside the panel; the unknown-code view lifts the cap; `pricing.spec.ts` line 827 checks the whole page again; desktop walks at 1280 px, stronger AC-0003, AC-0004, AC-0005, and AC-0006 checks, and a saved-result column test; the source search covers every text file type under `src/app`. Deferred Nit: renaming `detail(page).main` (quality-engineer finding 14), to keep existing-test churn down.
- The new long-value, corrected-panel, column-alignment, and accent-edge tests failed against `65735c4`; the top-alignment test failed with the list's own margin rule removed. The lot column was widened after a recapture showed lot numbers on three lines; the screenshots now match the signed-off look.
- `npm test` on `da7ca0b`: Vitest 1046 passed in 44.7 s; Playwright 790 passed in 10.6 min.
