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
