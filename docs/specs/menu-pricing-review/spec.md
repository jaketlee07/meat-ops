# Spec: menu-pricing-review

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the intent [`docs/product/intents/menu-pricing-review-nits.md`](../../product/intents/menu-pricing-review-nits.md) (its Outcome and Boundary); the menu-pricing spec [`../menu-pricing/spec.md`](../menu-pricing/spec.md) (AC-0124, and the `v_product_pricing` columns its migration defines); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the views keep their columns; no published interface changes)
- **Shape:** mixed

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory: it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

This spec delivers the outcome and boundary of the
[menu-pricing review intent](../../product/intents/menu-pricing-review-nits.md):
every menu-pricing behavior a test claims to pin can fail when it breaks, and
the pricing view states each price rule once. The owner sees no change on any
page.

- **The Figure wrap fix has a test.** A detail figure whose label or value is one
  word wider than a phone screen wraps inside the screen. A browser test shows
  it, and the test goes red if either side of the Figure row loses `min-w-0`.
- **The Back test reads as construction coverage.** Its title names no
  criterion. AC-0124 is named only by the Show prices test, which closes it.
- **The pricing view rounds once.** `v_product_pricing` works out the suggested
  list price and the margin at the list price once each. The price action, the
  needs-new-price flag, and the below-target flag read those two columns. A new
  migration makes the change, and the view returns the same rows as before.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Database schema | Applicable: the view's definition changes | a new file under `supabase/migrations/` | work-loop | The file replaces `v_product_pricing` and says why in its header comment | close-work finds the file in the merged tree and `supabase migration up` applies it on a reset stack |
| Execution record | Applicable: the probes, the red runs, gate results, and review rounds need a home outside the contract | `docs/specs/menu-pricing-review/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every observation the Testing Strategy routes to it |
| Intent closeout | Applicable: this spec delivers a backlog intent | `docs/product/intents/menu-pricing-review-nits.md`, `workspace.toml` `[backlog]` | close-work | none | close-work marks the intent Fulfilled and its entry leaves `open` |
| Lifecycle closeout | Applicable: delivered work is recorded when it ships | `docs/lifecycle/menu-pricing-review.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Applicable when the build teaches something that would change a future approach | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |
| Shipped menu-pricing text | Not applicable: the menu-pricing spec and migration stay as shipped. The intent's Source names that spec's ledger, and close-work records the intent Fulfilled | none | n/a | n/a | n/a |
| Interface compatibility | Not applicable: AC-0006 holds every view column, so `src/lib/database.types.ts` does not move | none | n/a | n/a | n/a |
| Hosted rollout | Not applicable: the Boundary of `docs/product/intents/hosted-supabase-rollout.md` applies every migration the hosted project lacks, in file order, and this file needs no quiet window (Assumptions, probe #3) | none | n/a | n/a | n/a |
| Master brief, costing truth, and architecture | Not applicable: no table, rule, golden number, module, or area changes in `SYSTEM-SPEC.md`, `docs/costing.md`, or `docs/architecture/overview.md` | none | n/a | n/a | n/a |
| User documentation, agent guidance, and release history | Not applicable: no page, label, message, command, or setup step changes, and nothing is released | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decision is in Assumptions and the reasons in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Follow the `AGENTS.md` hard rules.
- Name each test only after the criteria its own assertions check.
- Write each test fixture inside the test, master data through `pg` and stock through the operations, as `test/e2e/pricing.spec.ts` does, on data that `resetTestData` restores before the next test.

### Ask first

- Committing a change to any file under `src/`. The AC-0002 runs edit `src/app/pricing/figure.tsx` in the working tree and undo each edit; approving this spec approves those edits.
- Changing `price_what_if`, the definition of any view other than `v_product_pricing`, or any table's definition.
- Changing an existing test's steps or assertions, or any title other than the one AC-0003 names.

### Never do

- No new dependency, no new top-level directory, and no new module or helper file.
- No edit to an existing migration file.

## Testing Strategy

- **Manual QA, exercised by an E2E test in the browser suite (AC-0001).** Wrapping and scroll width exist only in a real browser's layout. A new test in `test/e2e/pricing.spec.ts` opens the detail over the built app and the local database and runs the page-state checks in `test/e2e/a11y.ts`.
- **Manual QA of the test, recorded in the verification ledger (AC-0002).** A test can only be shown to fail by changing the code under it. Each change is made alone in the working tree, the AC-0001 test is run red, and the change is undone. The ledger records each change, the failing assertion, and the green run after it is undone.
- **Goal-based checks (AC-0003, AC-0004).** A test title is text, so a goal-based check over `test/e2e/pricing.spec.ts` settles AC-0003. The database runs the stored definition, not the migration file, so a query over `pg_get_viewdef` on the migrated local stack settles AC-0004. The plan gives both commands.
- **Goal-based check, recorded in the verification ledger (AC-0005, AC-0006).** The comparison needs the menu-pricing definition beside the new one, and it proves a one-time rewrite. After it, the existing suites in `test/pricing.test.ts` keep checking the view's rows and options. So one `psql` transaction on the migrated local stack writes the AC-0005 data, reads both views and their catalog rows, puts back the menu-pricing definition of `v_product_pricing`, reads them again, compares, and rolls back. The ledger records the row counts and the differences found.
- **Goal-based check, run by the existing Vitest test (AC-0007).** `npm test` runs the rounding-edge test against the migrated view.

## Acceptance Criteria

### The Figure wrap fix

- [x] **AC-0001.** The 502 detail passes the page-state checks in `test/e2e/a11y.ts` at 320 px wide in this state: a 20% target margin and a 3.29 list price over RAW-TOM's one receipt at 1.68, RAW-TOM's description set to one word, and one of 502's processing fees named with one word, where each word's text, added up across the lines it takes, is wider than 320 px.
- [x] **AC-0002.** The AC-0001 test is red at its page-state check, reporting a scroll width over 320, against each of these changes made alone in `src/app/pricing/figure.tsx`: `min-w-0` removed from the Figure's label (`dt`), and `min-w-0` removed from its value (`dd`).

### The Back test

- [x] **AC-0003.** In `test/e2e/pricing.spec.ts`, the what-if test that goes Back twice and checks both fields against the URL has the title `after Back, the fields match the URL`, which names no criterion.

### The pricing view

- [x] **AC-0004.** After every migration applies, the stored definition of `v_product_pricing` (`pg_get_viewdef`) holds the expression that rounds the final price to 2 decimals once, and the expression that divides by the list price once.
- [x] **AC-0005.** On the migrated local stack, `v_product_pricing` and `v_current_menu` return the same rows as they do under the menu-pricing definition of `v_product_pricing`, over data whose finished products include:
  - over a raw input with a cost, each pairing of a target margin present or absent with a list price present or absent
  - one with no target margin whose list price equals its suggested list price while its 4-decimal final price does not
  - one over a raw input with no receipt, and one over a raw input whose only receipt is voided, each with a target margin and a list price
  - one inactive product
  - the rounding edge: 502's 23% shrink and $0.45/lb of processing fees, over a raw input received at 1.6802, with a 20% target margin and a 3.29 list price

  Together those products give `price_action` each of null, `set`, `raise`, and `lower`, and give `needs_new_price` and `below_target` each of true and false.
- [x] **AC-0006.** For both `v_product_pricing` and `v_current_menu`, the column names, types, and order, the grants, and the options (`security_invoker=true`) are the same on the migrated local stack as under the menu-pricing definition of `v_product_pricing`.
- [x] **AC-0007.** The rounding-edge test in `test/pricing.test.ts` (`the below-target check compares the rounded margin, so 0.19997 shown as 0.2000 is not below target`) passes against the migrated view, with its text unchanged.

## Follow-ons

None.

## Assumptions

- Technical: `v_product_pricing` is last defined in `supabase/migrations/20261009070619_menu_pricing.sql`. The alerts migrations only read it, and `20261007182816_access_lockdown.sql` sets its option before menu-pricing replaces it (source: `grep` of `supabase/migrations` for the view's name).
- Technical: a view that reads `suggested_list_price` and `margin_at_list_pct` from a middle subquery returns the same rows as the menu-pricing view. It keeps both views' columns, types, grants, and options. Over 15 active finished products and 1 inactive one, built to the AC-0005 list, the differing rows were 0 for each view (source: probe #1, local stack A, one transaction rolled back, 2026-10-20).
- Technical: `test/pricing.test.ts` already fails if either view loses `security_invoker=true`, and it holds the rounding-edge test (source: `test/pricing.test.ts`).
- Technical: in a flex row like the Figure's, a word wider than 320 px makes the page's scroll width exceed 320 when `min-w-0` is removed from either side, and wraps inside 320 with it. A 39-letter word gave 320 with both, 344 without it on the label, and 321 without it on the value (source: probe #2, Chromium 156 under Playwright, a bare `page.setContent` page, 2026-10-20).
- Technical: the detail shows RAW-TOM's code and description as the Raw input value, and each processing fee's name as a label (source: `src/app/pricing/pricing-detail.tsx`).
- Technical: replacing the view takes an `AccessExclusiveLock` on `v_product_pricing` only, plus `AccessShareLock` on the five tables it reads. No operation takes a table lock that conflicts, so the hosted apply needs no quiet window (source: probe #3, rolled back, 2026-10-20; `grep` of `supabase/migrations` for `lock table`).
- Technical: `price_what_if` writes each rounding once, and the menu-pricing migration's header says it repeats the view's rule on purpose. It stays as it is (source: `20261009070619_menu_pricing.sql`).
- Product: the view cleanup ships now, in its own migration, in this spec with the two test changes. This answers the intent's open question (source: user confirmation 2026-10-20).
- Process: this folder is the only one on stack A, so the gates run with plain `npm test`. The owner approves the spec and then the plan in chat (source: `git worktree list` and the folder's missing `supabase/.env`; receiving-refinements precedent).
