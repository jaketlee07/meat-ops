# Verification ledger: menu-pricing-review

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts and probe evidence sit under the ignored `.context/reviews/1dc7d451-7a63-40e0-b24c-c6d5b21cf37e/`.

## Approval (2026-10-20)

- The owner chose in chat on 2026-10-20 to ship the view cleanup now, in its own migration, in this spec with the two test changes. This answers the intent's open question.
- The owner approved the spec and the plan in chat on 2026-10-20, after spec-stage review came back clean.
- Work-loop run `1dc7d451-7a63-40e0-b24c-c6d5b21cf37e`. `approve-plan` recorded spec hash `75dbe9a0297f…` and plan hash `f6fc5d558711…`. The schedule has wave 1 (T1, T2) and wave 2 (T3), run one task at a time.
- Base: `fb6584b` on branch `fix/menu-pricing-review`, on stack A, which only this folder uses. Stack A was reset to its migrations at the start of the session.

## Spec-stage review

Four rounds, each after the first over the delta since the previous one:

| Round | Adversarial, adjudicated | Shaping |
| ---: | --- | ---: |
| 1 | 1 Concern and 1 Nit sustained | 2 Concerns, 6 Nits |
| 2 | direct clean | 1 Nit |
| 3 | direct clean | 1 Nit |
| 4 | direct clean | Clean |

- The new-spec item-alignment lint reports 4 references it cannot resolve. Each is a menu-pricing criterion (AC-0080, AC-0082, AC-0124) that this spec cites, which the lint reads as this spec's.
- Pre-EXECUTE gates not fired: security-reviewer (the view keeps its grants and `security_invoker`, and no control changes), design-intent review (no page changes), frontend pre-flight (the only HTML/CSS/JS output is a test).
- project-knowledge unavailable: the work-loop capture at `spec-approved` refused twice with `strict_parse`, and earlier builds record the store refusing captures. No fallback file was created. Reusable lessons go to the session memory.

## T1: the pricing view states each rounding once

- Migration `supabase/migrations/20261021005125_pricing_view_once.sql`, applied to stack A with `supabase migration up`. Its subquery `s` is cut from `20261009070619_menu_pricing.sql` by a script and only re-indented.
- AC-0004: the `pg_get_viewdef` count query prints `1|1` on the migrated stack. It printed `4|2` under the menu-pricing view before the migration.
- AC-0005 and AC-0006: the probe ran on the migrated stack on 2026-10-20, in one transaction rolled back. It wrote the fixture (4 raw products, F01 to F16 finished), copied both views' rows and catalog rows, ran the menu-pricing view statement, and compared in both directions.
  - Rows: `v_product_pricing` 15 under each definition, and `v_current_menu` 15 under each. All 15 are the fixture's; the stack held no other product.
  - The fixture's rows reached `price_action` null (F01, F06, F07, F11, F12, F13, F16), `set` (F03, F15), `raise` (F02, F05, F08, F09), and `lower` (F04, F10). `needs_new_price` was true on 8 rows and false on 7. `below_target` was true on F02 and F08 and false on the other 13.
  - Rows differing: pricing view 0, menu view 0. Catalog facts differing (columns and types in order, grants, options): 0.
  - Products: 0 before the probe and 0 after the rollback. The view count query still printed `1|1` after it.
- Interface: `src/lib/database.types.ts` has sha256 `c3c62b67…` before and after `npm run gen:types`.
- T1 implemented by the controller, not the implementer subagent: the migration was written while the plan's probe statement was already in hand.

## T2: the Figure wrap test

- The test `menu-pricing-review AC-0001: a raw input and a fee name, each one word wider than the phone, wrap inside it` sits in the `the detail` block of `test/e2e/pricing.spec.ts`. RAW-TOM's description is `tomatoes` 8 times (64 letters), and the `freezing` fee's name is `freezingcharge` 5 times (70 letters).
- At 320 px it checks each word's summed line widths against 320 before the page-state checks. After them, it checks that the element holding each word does not overflow its own box (`scrollWidth` and `scrollHeight` against `clientWidth` and `clientHeight`), so a clipped word fails too. That last check came from post-gates review round 1. Its place after `checkPageState` keeps the AC-0002 runs red at the page-state check.
- Each run below is `npm run test:e2e -- test/e2e/pricing.spec.ts -g "menu-pricing-review AC-0001"`, run by the controller on 2026-10-20 against the test as it is now, with the folder check empty before them. Each change was made alone in `src/app/pricing/figure.tsx` and undone with `git checkout`, and `git diff --exit-code src/app/pricing/figure.tsx` exited 0 after each undo. Each green run took 9 to 11 seconds, build included, with 3 passed (the two sign-in setups and the test).
  - Green before any change: passed.
  - AC-0002, M1, `min-w-0` removed from the `dt`: failed at `page checks at 320 x 640` with `scroll width 562 is over 320`. Green after the undo: passed.
  - AC-0002, M2, `min-w-0` removed from the `dd`: failed at the same check with `scroll width 560 is over 320`. Green after the undo: passed.
  - M3, the `dd`'s `break-words` replaced by `truncate`: failed at `words cut off by their box`, after the page-state checks passed. Green after the undo: passed.
  - M4, the `dt`'s `break-words` replaced by `truncate`: failed at the same check. Green after the undo: passed.
  - M5, the `dd`'s `break-words` replaced by `overflow-hidden`: failed at the same check. Green after the undo: passed.
- Before the clip check, a check that each word takes more than one line rect stayed green under M3 and M4. In Chromium 156 a `truncate`d word reports two rects (527 and 189 px wide), so a rect count cannot tell wrapping from clipping (a bare `page.setContent` probe, 2026-10-20). The element's overflow can: its scroll width was 288 when wrapped and 608 when truncated, against a 288 px box.
- `npm run typecheck` passed.

## T3: the Back test's title

- Commit `acfca2b` holds only the rename. On it, `git diff HEAD~1 -- test/e2e/pricing.spec.ts` removed one line, `  test("AC-0124: after Back, the fields match the URL", async ({ page }) => {`, and added one, the same line without `AC-0124: `. `grep -c 'test("after Back, the fields match the URL"' test/e2e/pricing.spec.ts` printed 1.
- T3 implemented by the controller, not the implementer subagent: a one-line rename.

## Gates (2026-10-20, at `acfca2b`)

- Wave 1 (T1, T2): `npm run typecheck` passed; `npm run test:costing` passed, 3 files and 37 tests, in 5 seconds.
- Wave 2 (T3), the final gates: `npm run typecheck` passed. `npm test` passed in 749 seconds: Vitest 52 files and 1039 tests, then the browser suite 667 passed in 11.3 minutes. The folder check was empty before the run, and `pg_class` held 3916 dead rows with the Realtime slot 1035 transactions behind.
- AC-0007: in that run `test/pricing.test.ts` passed. Alone, `npx vitest run test/pricing.test.ts -t "the below-target check compares the rounded margin"` passed. `git diff fb6584b -- test/pricing.test.ts` is empty.
- After the post-gates round 1 fix, at `0482ea5`: `npm run typecheck` passed, and `npm test` passed in 995 seconds: Vitest 52 files and 1039 tests, then the browser suite 667 passed in 14.0 minutes. The folder check was empty before the run. `pg_class` held 107293 dead rows before it and 208843 after, with the Realtime slot 12522 transactions behind before it, which accounts for the slower run (the `local-stack-catalog-bloat` intent).

## Post-gates review

- Round 1 (adversarial-reviewer and quality-engineer, in parallel, over `fb6584b..8594ab1`). Adjudicated: 3 Nits sustained, 2 findings refuted.
  - Sustained and fixed in `0482ea5`: the wrap test's title said each word wraps while its assertions showed only that it fits, so a clipped word passed (fixed with the box-overflow check in T2 above); its comment gave `min-w-0` sole credit for the wrap (reworded); and this ledger did not record a green run after each undo (T2 above now lists one after each).
  - Refuted: the quality-engineer's Concern on the same clipping gap, as outside what AC-0001 and AC-0002 require (the Nit above closed it anyway); and a Nit asking the stored T1 probe output to carry its own AC-0004 count, as outside any rule.
- Not dispatched: security-reviewer (no security boundary, data flow, or control changes; the view keeps its grants and `security_invoker`, which `test/pricing.test.ts` checks), frontend-reviewer (no HTML, CSS, or JS output changes; the diff is a migration and tests), experience-reviewer (nothing a reader sees changes).
