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
