# Plan: home-screen

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the views and grants of `v_sale_summary` in `supabase/migrations/20261013155724_sales_trace.sql`, with `test/access.test.ts`, which reads every relation in `public`, and `test/sales.test.ts`, which reads its views as `service_role`; the page pattern of `src/app/alerts/page.tsx` (claims, `isOperator`, `runWatch`, `PageShell`); the shell, menus, and banner in `src/app/page-header.tsx`, with `test/e2e/shell.spec.ts` and `test/e2e/shell-page.ts`; the sign-in action `src/app/sign-in/actions.ts`, with `test/e2e/auth.spec.ts`, `test/e2e/auth.setup.ts`, and `signInThroughForm` in `test/e2e/states.ts`; the install file `src/app/manifest.ts`, with `test/e2e/hosting.spec.ts`; the Recent lists `src/app/receiving/recent-receipts.tsx`, `src/app/production/recent-batches.tsx`, and `src/app/sales/recent-sales.tsx`, with the shared `StatusTag`, `Facts`, and `formatMoney`; the container variants in `src/app/globals.css` (`alert-pair`, `sale-table`) and the stock tiles that wrap with no breakpoint.

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

The three views come first, because the page's money figures and stock list read them and their math and access are tested on their own. The page and its reads follow. Then sign-in, the install file, the menus, and the banner move to it, which is the step that changes existing tests. A last task records what only a person or a diff read can check.

The riskiest part is the stock value view's access. An aggregate with no `GROUP BY` returns one row even when row-level security hides every row under it, and a signed-in non-operator must read no row from it. The probe the spec's Assumptions record settled the shape. Because T1 changes what each role can read, `security-reviewer` joins the post-gates review.

## Constraints

The spec's `Constrained by` line names the rules. One more holds for the build: `<main>`'s first child stays the shell's title-and-banner `div`, and a page's own status stays out of `main > div > [role=status]`, as the look E shell tests read.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T4's owner comparison with the comparison page and the test-diff read.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| `SYSTEM-SPEC.md` views list | T1 | It names `v_daily_sales`, `v_stock_value`, and `v_stock_on_hand` with their columns. | `close-work` reads the list against the migration. |
| `docs/costing.md` | T1, T2 | As the spec's Durable Outputs costing row states, with `test/home-figures.test.ts` as the views' suite and `test/e2e/home.spec.ts` among the missing-value suites. | `close-work` reads it against the views. |
| Overview `supabase/migrations/` row and Access model | T1 | Both name the three views, `security_invoker`, and their grants. | `close-work` reads both against the migration. |
| Overview `src/app` row | T2, T3 | It names "Today" at `/`, its sections in order, the menus' first item, sign-in and the install file opening there, the banner's absence there, and the error views of `/` and `/sign-in`. | `close-work` reads the row whole against the code. |
| Overview `test/` and `test/e2e/` rows | T1, T2 | They list `test/home-figures.test.ts`, `test/home-reads.test.ts`, and `test/e2e/home.spec.ts`, and the `test/e2e/` row's sentence on recorded runs names `home.spec.ts`'s refused-read check and which error views still rest on recorded runs. | `close-work` reads both rows whole. |
| Design reference: the comparison page | T4 | The AC-0017 ledger entry names revision 1794121141-4df1. | The brief still links the page. |

## Design (LLD)

### Design decisions

- **Three views.** `v_daily_sales` gives one row per `sale_date` with `sales_total` over the date's sales that are not voided; a date whose sales are all voided has no row. `v_stock_value` gives one row of `raw_value`, `finished_value`, and `total_value` over every lot and every finished good, ending in `having count(*) > 0` so that a caller whose rows RLS hides gets no row. `v_stock_on_hand` gives one row per product with its code, description, kind, `active`, and `lbs_on_hand`: a raw product's from its balance row, a finished product's summed over its finished goods in the database. A void or a reversal already zeroes what it takes off the shelf, so no view filters for them. Each view is `security_invoker`, and the migration revokes all on it from `public`, `anon`, `authenticated`, and `service_role` before granting select to `authenticated` and `service_role`, as `v_sale_summary` does.
- **No row means zero.** A missing `v_daily_sales` row for today, or a missing `v_stock_value` row, shows `formatMoney(0)`. No total is added in `src/`.
- **Money on screen.** Each total goes through `formatMoney`, as Production's raw cost total does, and rounds as the costing reference's Rounding note states.
- **Today's reads.** `src/lib/home.ts` reads today's lots by `received_date`, batches by `production_date`, and `v_sale_summary` by `sale_date`, using the app's today from `appToday`. Each read joins its product's code and description, counts exactly, and lists newest first. Each row keeps the fields its Recent list shows and goes through the same formats and tags. Stock on hand reads `v_stock_on_hand` filtered to active products and products with stock.
- **The watch.** `runWatch` is wrapped in React's `cache`, so the page and the shell share one run per request. The page runs it before reading the open alerts, as `/alerts` does. For `current === "today"` the shell renders no "Urgent alerts" region in any watch state and keeps the three badges.
- **The page.** `src/app/page.tsx` follows the `/alerts` pattern: claims, then `isOperator`, then the reads, then `PageShell` titled "Today" with `fullWidth`. The sections run in the spec's order, and the page's source follows the reading order. Each layout picks its look from its own container's width and the text size, through container variants in `globals.css`, as `alert-pair` and `sale-table` do: the four tiles wrap as the stock tiles do, and Today's entries and Stock on hand share a row only when their shared container fits both.
- **The menus.** `PageName` gains `today`, and the page list gains a first entry for "Today" at `/`, with a line icon in the same stroke style as the others.
- **Sign-in and the install file.** Sign-in ends on `/`. `signInThroughForm` waits for `/` and any level-1 heading, so the non-operator's not-allowed page passes it as well as "Today". The install file's start address is `/`.

### Component / module decomposition

- New: the migration (from `supabase migration new home_figures`), `src/lib/home.ts`, the section parts under `src/app/home/`, the error files `src/app/error.tsx` and `src/app/sign-in/error.tsx`, `test/home-figures.test.ts`, `test/home-reads.test.ts`, `test/e2e/home.spec.ts` with a page object `test/e2e/home-page.ts`, and the verification ledger.
- Changed: listed in each task's Touches.

### Quality attributes (NFRs)

- Accessibility: each section is a `section` named by its heading; each count and figure is text, not color alone; every link keeps its 44 px target and focus ring.
- Access: the views run as the caller, so row-level security decides each role's rows, and only `authenticated` and `service_role` hold a grant.

## Tasks

### T1: The daily sales, stock value, and stock on hand views

**Depends on:** none
**Mode:** TDD against the local stack
**Touches:** `supabase/migrations/<timestamp>_home_figures.sql`, `src/lib/database.types.ts`, `test/home-figures.test.ts`, `SYSTEM-SPEC.md`, `docs/costing.md`, `docs/architecture/overview.md`

**Tests:**
- New `test/home-figures.test.ts`, run with the reset helper and the operation calls the existing Vitest suites share, and writing no row to a table `test/db.ts`'s opening comment protects: AC-0011 with its sales through `record_sale` and `void_sale`, plus a sale on another date and a date whose only sale is voided, which have no row on AC-0011's date; AC-0012 through `receive_lot`, `produce_batch`, and AC-0011's sales, plus a receipt voided through `void_receipt` and a batch reversed through `reverse_batch`, which add nothing. Each compares the view's value as text.
- The same file: AC-0015 reads each of the three views as `anon`, a non-operator, an operator, and `service_role`, as `test/sales.test.ts` reads its views; AC-0024 reads each view's privileges for `anon`, `public`, `authenticated`, and `service_role` from the catalog.
- `test/access.test.ts` stays unchanged: its fixture's receipt, batch, and sale give the operator a row from each new view.
- Each new test is seen red once before the migration exists, recorded in the ledger.

**Approach:**
- Write the migration, apply it with `supabase migration up`, and run `npm run gen:types`.
- Write the views into the SYSTEM-SPEC views list, the costing reference's opening lists and new section, and the overview's `supabase/migrations/` row, Access model, and `test/` row.

**Done when:** the T1 tests pass, `npm run test:costing` passes, and `npm test` passes.

### T2: The "Today" page and its reads

**Depends on:** T1
**Mode:** manual QA through the browser suite, and TDD against the local stack for AC-0033
**Touches:** `src/lib/home.ts`, `test/home-reads.test.ts`, `src/app/page.tsx`, `src/app/error.tsx`, `src/app/sign-in/error.tsx`, `src/app/home/`, `src/app/page-header.tsx`, `src/app/globals.css`, `test/e2e/home.spec.ts`, `test/e2e/home-page.ts`, `docs/costing.md`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are the rendered page's roles, text, and boxes.
- New `home.spec.ts`, opening `/` directly with the saved sessions and seeding every receipt, batch, and sale, for any product, through the operations (the existing seed helpers or direct operation calls), never by a write to a table `test/db.ts`'s opening comment protects: AC-0003 with the non-operator's; AC-0030 reading the four sections' source order and boxes at each width and text size it names; AC-0014 with AC-0012's receipts, batch, and sales dated today; AC-0013 and AC-0027 on an emptied stack, AC-0013 also with only a voided sale today; AC-0004 against the order `/alerts` shows for the same alerts; AC-0026 with and without open alerts; AC-0005; AC-0021 and AC-0022 inside `withWatchRefused` from `test/e2e/alerts-page.ts`; AC-0007 and AC-0008 with entries on the app's today and the day before, receipts of two raw products (the second added as master data, as `test/e2e/ask-page.ts` adds one), and one of each voided or reversed; AC-0009 and AC-0031 with two receipts, no batch, and one sale; AC-0010 against `inventory_balances` and `finished_goods` read with `query`, with one inactive product holding stock and one holding none (a product's `active` flag is master data); AC-0032 on an emptied stack; AC-0016 and AC-0028 at each width and text size they name, with AC-0016's long values; AC-0035 with select on `v_daily_sales` revoked from `authenticated` while `/` loads, and the grant restored in a `finally` and in `afterEach`, as `revokeSaleItemsRead` and `restoreSaleItemsRead` do. With AC-0033 (each read throws) and AC-0036 (nothing behind `/` handles a failure), that one run stands for every read.
- New `test/home-reads.test.ts`: AC-0033 calls each read alone as the operator while select on its relation (`v_daily_sales`, `v_stock_value`, `v_stock_on_hand`, `lots`, `production_batches`, `v_sale_summary`, `v_alerts`) is revoked from `authenticated`, expects it to throw, and restores the grant in a `finally`. A read called alone fails alone, though `v_alerts` also reads `lots` and `production_batches`. The same file holds AC-0036, reading the files it names as `test/look-tidy.test.ts` reads app source.

**Approach:**
- Build the reads, then the page and its section parts, reusing each Recent list's formats and tags, then the two error files, each rendering `PageError` as the other pages' `error.tsx` files do.
- Add `today` to `PageName` and drop the banner region for it in `PageShell`.
- Write "Today" at `/`, its sections, and the error views of `/` and `/sign-in` into the overview's `src/app` row; list `test/home-reads.test.ts` in its `test/` row; list the new suite in its `test/e2e/` row and rewrite that row's sentence on recorded runs to say `home.spec.ts` fails a read on `/` by a grant and checks its error view, while the other pages' error views rest on the 2026-11-04 recorded run and `/sign-in`'s on the AC-0034 run; and turn the Rounding note's "Raw cost total" row into one for every money total, with "$0.00" for a missing row in its "Where the database has nothing to show" list and `test/e2e/home.spec.ts` in the opening's list of suites that check those texts.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: Sign-in and the install file open "Today", the menus list it first, and the banner leaves it

**Depends on:** T2
**Mode:** manual QA through the browser suite
**Touches:** `src/app/sign-in/actions.ts`, `src/app/manifest.ts`, `src/app/page-header.tsx`, `test/e2e/states.ts`, `test/e2e/auth.spec.ts`, `test/e2e/hosting.spec.ts`, `test/e2e/shell.spec.ts`, `test/e2e/shell-page.ts`, `test/e2e/production.spec.ts`, `test/e2e/home.spec.ts`, the other existing e2e files AC-0019's last item covers, and `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are URLs, links, regions, and a served file in a browser.
- `home.spec.ts`: AC-0001 through the sign-in form; AC-0002 and AC-0025 at 390 px with the phone menu open and at 1280 px; AC-0006 with one urgent alert open, on `/`, `/alerts`, and each other page the menus list; AC-0023 at 390 px and 1280 px.
- `hosting.spec.ts`' install file check reads AC-0029.
- Each existing check AC-0019 lists changes only as it allows; the T4 diff read checks each.

**Approach:**
- Point sign-in and the install file at `/`, add the "Today" entry and icon to the page list, then run the browser suite and change each failing existing check that AC-0019 lists.
- Write the sign-in landing, the install file's start, and the menus' first item into the overview's `src/app` row.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3
**Mode:** visual and manual QA, and the page-state check in the browser suite
**Touches:** `docs/specs/home-screen/notes/verification-ledger.md`, `test/e2e/home.spec.ts`

**Tests:**
- no stub (visual and manual QA): the owner's verdict and a diff read.
- `home.spec.ts`: AC-0020 runs `checkPageState` on `/` in each state it names.
- The ledger records the owner's AC-0017 verdict, the AC-0019 read of `git diff` from the branch point over `test/` with untracked files listed, the red runs T1 saw, and a recorded run of AC-0034: `/sign-in` served by `npm run dev` with a scratch throw in its page, the throw removed right after the run.
- Each T4 record names the commit it read: the branch's last commit that changes a file other than those under `docs/specs/home-screen/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. A later commit that changes any other file re-opens every T4 record; one that changes only those files re-opens none.

**Approach:**
- Build `/` on the local stack with made-up data in every section, show it to the owner beside the comparison page, and read the test diff.

**Done when:** the ledger holds every entry above and `npm test` passes (AC-0018).

## Rollout

One PR. Rollback is a revert of the app and a new migration that drops the three views. The views change no table and no stored value. The hosted project gets the migration before any hosted app build that reads it; each step needs the developer's approval, and neither is part of this spec.

## Risks

- An existing browser test that walks a menu's Tab order or counts its links fails once "Today" joins it. T3 changes only what AC-0019 lists, and the T4 diff read checks each change.

## Changelog

- 2026-11-09: initial plan, after the owner's answers on the sign-in landing, the four sections, the banner, the menu item, and the money figures, a rolled-back view probe on stack A, and a Node probe of Intl's rounding.
- 2026-11-09: after spec-stage review round 1 (adversarial, shaping, and security): a third view for per-product lbs; the owner's calls on the install file's start, inactive products' stock, and the section order; layouts that follow their own container's width; a sign-in wait that holds for both roles; the probe results moved to the spec's Assumptions; and catalog and `service_role` checks for the views.
- 2026-11-09: after spec-stage review round 2 (adversarial and shaping; security clean): every test fixture through the operations, with one worked example the operations produce; every existing sign-in landing check in AC-0019's list; named data and boxes for the layout checks; and, on the owner's call, error files for `/` and `/sign-in`, checked by recorded runs.
- 2026-11-09: after spec-stage review round 3 (adversarial and shaping): AC-0016 names one exact value per figure; AC-0033 names its reads and runs in the browser suite; fixtures may use any product through the operations; the durable-output map follows the spec's rows.
- 2026-11-09: after shaping review rounds 4 to 7: refusing a table on a loaded `/` fails more than one read, since `v_alerts` reads `lots` and `production_batches`, so AC-0033 checks each read alone in Vitest, AC-0036 checks that nothing behind `/` handles a failure, and AC-0035 checks the error view once in the browser; the overview's sentence on recorded runs names what each error view rests on.
