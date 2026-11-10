# Plan: home-screen

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the views and grants of `v_sale_summary` in `supabase/migrations/20261013155724_sales_trace.sql`, with `test/access.test.ts`, which reads every relation in `public`; the page pattern of `src/app/alerts/page.tsx` (claims, `isOperator`, `runWatch`, `PageShell`); the shell, menus, and banner in `src/app/page-header.tsx`, with `test/e2e/shell.spec.ts` and `test/e2e/shell-page.ts`; the sign-in action `src/app/sign-in/actions.ts`, with `test/e2e/auth.spec.ts` and the helper `signInThroughForm` in `test/e2e/states.ts`; the Recent lists `src/app/receiving/recent-receipts.tsx`, `src/app/production/recent-batches.tsx`, and `src/app/sales/recent-sales.tsx`, with the shared `StatusTag`, `Facts`, and `formatMoney`.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/home-screen/notes/verification-ledger.md`. A genuine
> artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

The two views come first, because the page's money figures read them and their math is golden-tested on its own. The page and its reads follow. Then sign-in, the menus, and the banner move to it, which is the step that changes existing tests. A last task records what only a person or a diff read can check.

The riskiest part is the stock value view's access. An aggregate with no `GROUP BY` returns one row even when row-level security hides every row under it, and the access suite requires that a signed-in non-operator reads 0 rows from every view. A rolled-back probe on stack A on 2026-11-09 settled the shape (see the view Design decision). Because T1 changes what each role can read, `security-reviewer` joins the post-gates review.

## Constraints

- The brief's Constraints and the intent's Guardrail: no costing outside the engine, 44 px controls, the focus outline, the contrast and axe checks, and the floor forms' fields, Tab order, and presses.
- Specs 1a and 1b's criteria stay met: the status tags, the table parts, the label style, and the quiet banner on every page that shows it.
- The look E shell and its tests: `<main>`'s first child stays the title-and-banner `div`; a page's own status stays out of `main > div > [role=status]`.
- `AGENTS.md`: hard rules 2, 3, 6, and 7; no em dashes; `type(scope): description` commits; `npm ci --ignore-scripts`; the folder check before any test run, reset, or stack stop.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T4's owner comparison with the comparison page and the test-diff read.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| `SYSTEM-SPEC.md` views list | T1 | It names `v_daily_sales` and `v_stock_value` with their columns. | `close-work` reads the list against the migration. |
| `docs/costing.md` section on today's sales and stock value | T1 | It defines both figures, the voids and reversals they leave out, and AC-0011's and AC-0012's examples. | `close-work` reads it against the views. |
| Overview `supabase/migrations/` row and Access model | T1 | Both name the two views, `security_invoker`, and their grants. | `close-work` reads both against the migration. |
| Overview `src/app` row | T2, T3 | It names "Today" at `/`, its four sections, the menus' first item, sign-in landing there, and the banner's absence there. | `close-work` reads the row whole against the code. |
| Overview `test/` and `test/e2e/` rows | T1, T2 | They list `test/home-figures.test.ts` and `test/e2e/home.spec.ts`. | `close-work` reads both rows whole. |
| Design reference: the comparison page | T4 | The AC-0017 ledger entry names revision 1794121141-4df1. | The brief still links the page. |

## Design (LLD)

### Design decisions

- **Two views.** `v_daily_sales` holds one row per `sale_date` with `sales_total`, the sum of `lbs_sold * price_per_lb` over the items of that date's sales whose `voided_at` is null. `v_stock_value` holds `raw_value`, `finished_value`, and `total_value`, each a `coalesce(sum(...), 0)` over a `union all` of every lot's `remaining_lbs * current_unit_cost` and every finished good's `lbs_remaining * cost_per_lb`, ending in `having count(*) > 0`. A void sets a lot's `remaining_lbs` to 0 and a reversal sets its finished goods' `lbs_remaining` to 0, so neither needs its own filter. Both views are `security_invoker = true`. The migration revokes all on each from `public`, `anon`, `authenticated`, and `service_role`, then grants select to `authenticated` and `service_role`, as `v_sale_summary` does.
- **The probe behind the view shape.** On 2026-11-09, inside one rolled-back transaction on stack A, one made-up receipt (5,000 lbs at $1.68) and one batch (2,000 lbs) then the two views gave: `postgres` one stock row (raw 5040.0000000, finished 4052.9720000, type `numeric`); a signed-in non-operator 0 rows from each view; an operator one stock row; `service_role` one stock row. Without the revoke, `anon` passed the view and was refused only at `lots`, which is why the migration revokes first. The transaction left no view and no row.
- **No row means zero.** The page reads today's `v_daily_sales` row with `.eq("sale_date", today).maybeSingle()` and the one `v_stock_value` row with `.maybeSingle()`. A missing row shows `formatMoney(0)`, "$0.00". No total is added in `src/`.
- **Money on screen.** Each total goes through `formatMoney`, as Production's raw cost total does. Intl rounds a number from its shortest decimal form, so a total of 15 significant digits or fewer shows as its exact decimal rounded half away from zero (a 2026-11-09 Node 22 probe: `1.005` and `"1.005"` both show "$1.01").
- **Today's reads.** `src/lib/home.ts` reads today's lots by `received_date`, batches by `production_date`, and `v_sale_summary` by `sale_date`, each with `count: "exact"`, newest first, using the app's today from `appToday`. Each row keeps the fields its Recent list shows and goes through the same formats and tags. Stock on hand reads active raw products with their `inventory_balances` row, and active finished products' `finished_lbs_available` from `v_current_menu`, which sums `lbs_remaining` in the database.
- **The watch.** `runWatch` is wrapped in React's `cache`, so the page and the shell share one run per request. The page runs it before reading the open alerts, as `/alerts` does. The shell keeps the badge on `/` and drops the banner for `current === "today"`. A failed watch shows `WATCH_FAILED` in the Open alerts section.
- **The page.** `src/app/page.tsx` replaces its redirect with the `/alerts` pattern: claims, then `isOperator`, then the reads, then `PageShell` with `title="Today"`, `current="today"`, and `fullWidth`. The sections run in this order: the money figures as a row of figure tiles, then Open alerts, Today's entries, and Stock on hand. From 1024 px the figure tiles share one row and Open alerts sits beside Stock on hand, with Today's entries below at full width. Below 1024 px every section takes its own line. Each list uses 1a's table parts and `StatusTag`.
- **The menus.** `PageName` gains `today`, and `PAGES` gains a first entry, `{ name: "today", label: "Today", href: "/" }`, with a line icon in the same stroke style as the others.
- **Sign-in.** `signIn` ends with `redirect("/")`, and `signInThroughForm` waits for `/` and the "Today" heading.

### Component / module decomposition

- New: the migration (from `supabase migration new home_figures`), `src/lib/home.ts`, `test/home-figures.test.ts`, `test/e2e/home.spec.ts` with a page object `test/e2e/home-page.ts`, and the verification ledger.
- Changed: listed in each task's Touches.

### Quality attributes (NFRs)

- Accessibility: each section is a `section` named by its heading; each count and figure is text, not color alone; every link keeps its 44 px target and focus ring.
- Access: the views run as the caller, so row-level security decides each role's rows, and only `authenticated` and `service_role` hold a grant.

## Tasks

### T1: The daily sales and stock value views

**Depends on:** none
**Mode:** TDD against the local stack
**Touches:** `supabase/migrations/<timestamp>_home_figures.sql`, `src/lib/database.types.ts`, `test/home-figures.test.ts`, `SYSTEM-SPEC.md`, `docs/costing.md`, `docs/architecture/overview.md`

**Tests:**
- New `test/home-figures.test.ts`, run with the reset and seed helpers the existing Vitest suites share: AC-0011 with its three sales seeded through `record_sale` and `void_sale` on one date, plus a sale on another date that its row leaves out; AC-0012 with its lots and finished goods set as `postgres`, plus a voided lot and a reversed batch that add nothing. Each compares the view's value as text.
- `test/access.test.ts` unchanged: its fixture gives the operator at least one row from each new view (AC-0015). If it does not, the fixture gains the rows it needs, and that change is recorded for AC-0019.
- Each new test is seen red once against the migration before the views exist, recorded in the ledger.

**Approach:**
- Write the migration, apply it with `supabase migration up`, and run `npm run gen:types`.
- Write the views into the SYSTEM-SPEC views list, the costing reference, and the overview's `supabase/migrations/` row, Access model, and `test/` row.

**Done when:** the T1 tests pass, `npm run test:costing` passes, and `npm test` passes.

### T2: The "Today" page and its reads

**Depends on:** T1
**Mode:** manual QA through the browser suite
**Touches:** `src/lib/home.ts`, `src/app/page.tsx`, `src/app/home/` (the section parts), `src/app/page-header.tsx`, `test/e2e/home.spec.ts`, `test/e2e/home-page.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are the rendered page's roles, text, and boxes.
- New `home.spec.ts`, opening `/` directly with the saved operator session: AC-0003 with the non-operator session; AC-0004 against the order `/alerts` shows for the same alerts; AC-0005, AC-0009, and AC-0013 on an emptied stack; AC-0021 inside `withWatchRefused` from `test/e2e/alerts-page.ts`; AC-0007 and AC-0008 with entries on the app's today and the day before, one of each voided or reversed; AC-0010 against `inventory_balances` and `finished_goods` read with `query`; AC-0014 with AC-0011's sales dated today and AC-0012's stock set as `postgres`; AC-0016 at each width and text size it names.

**Approach:**
- Build the reads, then the page, then the section parts, reusing each Recent list's formats and tags.
- Add `today` to `PageName` and drop the banner for it in `PageShell`.
- Write "Today" at `/` and its sections into the overview's `src/app` row, and list the new suite in its `test/e2e/` row.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: Sign-in lands on "Today", the menus list it first, and the banner leaves it

**Depends on:** T2
**Mode:** manual QA through the browser suite
**Touches:** `src/app/sign-in/actions.ts`, `src/app/page-header.tsx`, `test/e2e/states.ts`, `test/e2e/auth.spec.ts`, `test/e2e/shell.spec.ts`, `test/e2e/shell-page.ts`, `test/e2e/production.spec.ts`, `test/e2e/home.spec.ts`, any other existing e2e file whose assertion reads the sign-in landing, the menus' items, or their Tab stops, and `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are URLs, links, and regions in a browser.
- `home.spec.ts`: AC-0001 through the sign-in form; AC-0002 at 390 px with the phone menu open and at 1280 px; AC-0006 with one urgent alert open, on `/`, `/alerts`, and each of the other eight pages.
- `auth.spec.ts`' landing check, `signInThroughForm`, `shell.spec.ts`' `TITLES` and Tab lists, and `production.spec.ts`' menu-order rows change only as AC-0019 allows; the T4 diff read checks each.

**Approach:**
- Point sign-in at `/`, add the "Today" entry and icon to `PAGES`, then run the browser suite and change each failing existing check that AC-0019 names.
- Write the sign-in landing and the menus' first item into the overview's `src/app` row.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3
**Mode:** visual and manual QA, and the page-state check in the browser suite
**Touches:** `docs/specs/home-screen/notes/verification-ledger.md`, `test/e2e/home.spec.ts`

**Tests:**
- no stub (visual and manual QA): the owner's verdict and a diff read.
- `home.spec.ts`: AC-0020 runs `checkPageState` on `/` in each state it names.
- The ledger records the owner's AC-0017 verdict, the AC-0019 read of `git diff` from the branch point over `test/` with untracked files listed, and the red runs T1 saw.
- Each T4 record names the commit it read: the branch's last commit that changes a file other than those under `docs/specs/home-screen/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. A later commit that changes any other file re-opens every T4 record; one that changes only those files re-opens none.

**Approach:**
- Build `/` on the local stack with made-up data in every section, show it to the owner beside the comparison page, and read the test diff.

**Done when:** the ledger holds every entry above and `npm test` passes (AC-0018).

## Rollout

One PR. Rollback is a revert of the app and a new migration that drops the two views. The views change no table and no stored value. The hosted project gets the migration before any hosted app build that reads it; each step needs the developer's approval, and neither is part of this spec.

## Risks

- An existing browser test that walks the side menu's Tab order or counts its links fails once "Today" joins it. T3 changes only those AC-0019 names, and the T4 diff read checks each change.
- `/` is now a page that reads the database on every sign-in. A failed read throws to the error boundary, as every other page's does.
- The access suite's fixture may give the operator no row from `v_daily_sales`. T1's second test bullet covers that.

## Changelog

- 2026-11-09: initial plan, after the owner's answers on the sign-in landing, the four sections, the banner, the menu item, and the money figures, a rolled-back view probe on stack A, and a Node probe of Intl's rounding.
