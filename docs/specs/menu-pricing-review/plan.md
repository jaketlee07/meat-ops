# Plan: menu-pricing-review

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** `supabase/migrations/20261009070619_menu_pricing.sql` §2 (the view's current text, its header-comment style, and the `security_invoker` rule); `20261018224140_alerts_corrections.sql` (a later migration that replaces an object without editing the file that made it). Tests: `test/pricing.test.ts` (the view's rows and options) and the `the detail` block of `test/e2e/pricing.spec.ts` (`fixture502`, `opensDetail`, `figures`, `checkPageState`). Uncertainty: none; no new module or seam

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/menu-pricing-review/notes/verification-ledger.md`. A genuine
> artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

Three small changes, each with its own check. T1 adds one migration that
replaces `v_product_pricing` with a middle subquery, so the two rounded figures
are worked out once and the three flags read them. A rolled-back probe then
compares the migrated view with the menu-pricing one over a fixture that reaches
every flag value. T2 adds one browser test on the 502 detail with two long
one-word names, and proves it red by taking `min-w-0` off each side of the
Figure row in turn. T3 renames one test. No app code changes. The riskiest part
is T1: a replaced view drops `security_invoker` unless the statement restates
it, and the existing `test/pricing.test.ts` check and the T1 probe both catch
that.

## Constraints

- `AGENTS.md` hard rules: 2 (the view keeps its grants), 4 (no em dashes in the migration comment or commit messages), 5 (commit format), 6 (`npm test` after the migration; a red costing test stops the work), and 7 (local stack only).
- `CREATE OR REPLACE VIEW` clears `security_invoker`, so the statement says `with (security_invoker = true)` again (the menu-pricing migration's header).
- [SYSTEM-SPEC §11](../../../SYSTEM-SPEC.md#11-non-negotiable-boundaries-seed-these-into-project-rules): the math stays in Postgres.

## Construction tests

**Integration tests:** none beyond per-task tests.
**End-to-end:** the AC-0001 test (T2), run by `npm test` against the built app.
**Manual verification:** the AC-0002 red runs (T2) and the AC-0005 and AC-0006 probe (T1), in the verification ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Database schema: the new migration | T1 | The AC-0004 query prints `1|1`; the probe finds no differing row or catalog fact | The file is in the merged tree |
| Execution record: `notes/verification-ledger.md` | T1, T2, T3 | The probe, the red runs, the greps, and the gate results | The ledger holds each |
| Intent and lifecycle closeout | none | none | close-work |

## Design (LLD)

### Design decisions

- **A middle subquery, not a helper function.** The view gains a layer `m` over its existing subquery `s`. `m` adds `suggested_list_price` and `margin_at_list_pct`, and the outer select lists every column in the menu-pricing order and derives `price_action`, `needs_new_price`, and `below_target` from `m`. A SQL helper would need EXECUTE and schema USAGE for every role that reads the view (the menu-pricing header gives the same reason). Traces to: AC-0004, AC-0006.
- **`below_target` is `coalesce(margin_at_list_pct < target_margin_pct, false)`.** `margin_at_list_pct` is null whenever the raw input has no cost or there is no list price, and a null target makes the comparison null, so the menu-pricing guards are already in the column. `needs_new_price` keeps its `has_cost and (...)` guard, because a null suggested price would make its inequality null rather than false. Traces to: AC-0005.
- **`price_what_if` is left alone.** It already rounds each figure once, and its repeat of the view's rule is the menu-pricing migration's recorded choice. Traces to: the spec's Ask first.

### Data & schema

The new file comes from `supabase migration new pricing_view_once`. Its header
comment says the view works out the suggested list price and the margin at the
list price once, and that the columns, values, grants, and option stay as the
menu-pricing migration made them. The statement, as probe #1 ran it:

```sql
create or replace view public.v_product_pricing
with (security_invoker = true) as
select
    m.product_id, m.code, m.description, m.species, m.shrink_pct,
    m.raw_cost_per_lb, m.post_shrink_cost_per_lb, m.processing_fees_per_lb,
    m.margin_per_lb, m.cost_per_lb, m.final_price_per_lb,
    m.target_margin_pct,
    m.list_price_per_lb,
    m.has_cost,
    m.suggested_list_price,
    m.margin_at_list_pct,
    case when m.has_cost then
        case when m.list_price_per_lb is null then 'set'
             when m.list_price_per_lb < m.suggested_list_price then 'raise'
             when m.list_price_per_lb > m.suggested_list_price then 'lower'
        end
    end as price_action,
    coalesce(m.has_cost and (
        m.list_price_per_lb is null
        or m.list_price_per_lb <> m.suggested_list_price
    ), false) as needs_new_price,
    coalesce(m.margin_at_list_pct < m.target_margin_pct, false) as below_target
from (
    select
        s.*,
        case when s.has_cost then round(s.final_price_per_lb, 2) end as suggested_list_price,
        case when s.has_cost and s.list_price_per_lb is not null
             then round((s.list_price_per_lb - s.cost_per_lb) / s.list_price_per_lb, 4)
        end as margin_at_list_pct
    from (
        -- the menu-pricing view's subquery s, unchanged
    ) s
) m;
```

The outer select names every column, so the view's column order does not rest
on `s.*`. Traces to: AC-0004 to AC-0006.

### Behavior & rules

- **The AC-0001 state.** `fixture502(0.2, 3.29)` gives a detail with no Apply button and no alert, so the walk is `detailControls({ remove: true })`. The test then sets RAW-TOM's `products.description` and the `freezing` fee type's `fee_types.name` (one of 502's three processing fees) through `query` from `test/db.ts`. Each is a lowercase word of about 60 letters. `resetTestData` restores both before the next test.
- **The width of a word.** At 320 x 640, a `Range` over the word inside its `dd` or `dt` text node returns one rect per line it takes. The test sums the rect widths and expects more than 320 for each word, before it calls `checkPageState`. Without `min-w-0` the word takes one line wider than 320, so this precondition still holds and the red comes from the page-state check. Traces to: AC-0001, AC-0002.
- **The title.** `menu-pricing-review AC-0001: a raw input and a fee name, each one word wider than the phone, wrap inside it`. The prefix keeps it apart from the menu-pricing criteria the other titles name. Traces to: the spec's Always do.

## Tasks

### T1: The pricing view states each rounding once and returns the same rows

**Depends on:** none

**Touches:** `supabase/migrations/*_pricing_view_once.sql`, `docs/specs/menu-pricing-review/notes/verification-ledger.md`

**Tests:** no stub (goal-based check, recorded in the ledger)
- AC-0004: on the migrated stack, this prints `1|1`. Under the menu-pricing view it prints `4|2` (probed 2026-10-20).
  ```bash
  docker exec supabase_db_meat-ops psql -U postgres -tAc "select regexp_count(d, 'round\((\w+\.)?final_price_per_lb, 2\)'), regexp_count(d, '/ (\w+\.)?list_price_per_lb\)') from (select pg_get_viewdef('public.v_product_pricing') d) v"
  ```
- AC-0005 and AC-0006: one `psql` session on stack A, `\set ON_ERROR_STOP on`, inside `begin` and `rollback`. It writes the probe #1 fixture: 4 raw products (received at 1.68, received at 1.6802, never received, received then voided), 16 finished products F01 to F16 (F14 inactive; F11 and F12 at 10% shrink, the rest at 502's 23%), and a $0.45/lb processing fee and a $0.05/lb margin fee on each. Stock goes through `receive_lot` and `void_receipt`. It copies both views' rows and their `pg_class` rows (`relacl`, `reloptions`, and the `pg_attribute` names and `format_type` in `attnum` order) into temp tables. Then it runs the menu-pricing `create or replace view public.v_product_pricing` statement, cut from `20261009070619_menu_pricing.sql` by a script, and compares with `except all` in both directions, over every row the views return. The ledger records each view's row count, how many of those rows are the fixture's (15), the `price_action`, `needs_new_price`, and `below_target` values the fixture's rows reached, the three difference counts (each 0), and the product count before the probe and after the rollback (the same).
- Interface: `shasum src/lib/database.types.ts` is the same before and after `npm run gen:types`.
- AC-0007: `npm test` passes, with `test/pricing.test.ts` unchanged.

**Approach:**
- Write the migration, then `supabase migration up`.
- Keep the probe scripts in the session scratch; they are not committed.

**Done when:** the T1 Tests hold and the ledger records them.

### T2: The Figure wrap test passes, and fails without either `min-w-0`

**Depends on:** none

**Touches:** `test/e2e/pricing.spec.ts`, `docs/specs/menu-pricing-review/notes/verification-ledger.md`, and `src/app/pricing/figure.tsx` (edited and undone for M1 and M2; no committed change)

**Tests:** no stub (E2E, proven red by manual QA in the ledger)
- AC-0001: the new test in `the detail` block, as Behavior & rules describes, passes under `npm test`.
- AC-0002: two runs, each with one change made alone and undone after: M1 takes `min-w-0` off the `dt` in `src/app/pricing/figure.tsx`, and M2 takes it off the `dd`. Each runs `npm run test:e2e -- test/e2e/pricing.spec.ts -g "menu-pricing-review AC-0001"`, which must fail at `page checks at 320 x 640` with `scroll width <n> is over 320`. After each undo, `git diff --exit-code src/app/pricing/figure.tsx` passes and the same command passes. The ledger records each failing message and each green run.

**Approach:**
- Add the test after the AC-0080 and AC-0082 test, reusing the block's helpers.

**Done when:** the T2 Tests hold and the ledger records M1 and M2.

### T3: The Back test's title names no criterion

**Depends on:** T2 (the same file)

**Touches:** `test/e2e/pricing.spec.ts`, `docs/specs/menu-pricing-review/notes/verification-ledger.md`

**Tests:** no stub (goal-based check)
- AC-0003: T3 is a commit of its own, after T2's. On it, `git diff HEAD~1 -- test/e2e/pricing.spec.ts` removes exactly one line, `  test("AC-0124: after Back, the fields match the URL", async ({ page }) => {`, and adds exactly one, the same line without `AC-0124: `. The old title names only the Back test at base `fb6584b`, so this places the new title on that test. Then `grep -c 'test("after Back, the fields match the URL"' test/e2e/pricing.spec.ts` prints 1.

**Approach:**
- Drop `AC-0124: ` from the title.

**Done when:** the T3 Tests hold and the ledger records the grep and the diff.

## Rollout

- **Delivery:** one PR. The migration only replaces a view, so rolling back is a later migration that puts back the menu-pricing text.
- **Deployment sequencing:** the app reads the same columns before and after, so the hosted apply can run before or after the app ships. The hosted rollout intent applies it in file order with the rest.

## Risks

- A full `npm test` adds catalog bloat on stack A (the `local-stack-catalog-bloat` intent). If a run is slower than the last, check `pg_stat_sys_tables` before blaming the change.
- Each `test:e2e` run builds the app, so T2's two red and two green runs take four builds.

## Changelog

- 2026-10-20: initial plan
- 2026-10-20: round 1. The T1 fixture gains F15 and F16 to reach every input pairing the spec's AC-0005 lists, and its recorded counts hold whatever stack A already holds. T2 lists the file its red runs edit. T3 checks only the Back title.
