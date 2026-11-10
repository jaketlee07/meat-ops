# Plan: search-filters

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the `?product=` address pattern of `src/app/receiving/page.tsx` and `src/app/production/page.tsx`; Trace's finder forms in `src/app/trace/find-forms.tsx`, which change the address with `scroll: false`, with `test/e2e/trace.spec.ts`; `isCalendarDate` in `src/lib/batch-input.ts`, which Trace's finder also uses for an address date; the shared control and label classes and `IconBox` in `src/app/form-parts.ts`. Deviation: the search forms use next's `Form` (`next/form`), a GET form, instead of Trace's client `onSubmit` with `router.push`, because a search has no client-side check to run before it changes the address.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/search-filters/notes/verification-ledger.md`. A genuine
> artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

The reads come first, because what a search text matches, how each list orders and picks its rows, and the vendor limit are tested on their own against the local stack. Recent sales' new order lands with them. The three Recent lists' search forms and paging follow, then the row actions on found rows, which mostly need tests, since each found row renders through the same row part as the 10 latest. Menu's search is separate and runs in the browser. A last task records what only a person or a diff read can check.

The riskiest part is building a PostgREST filter from text the owner types. The spec's Assumptions record the probes that settled the encoding, and T1's tests run the spec's whole character set and its filter-syntax texts through each read. Because this changes how untrusted input reaches the database, `security-reviewer` joins the post-gates review.

## Constraints

The spec's `Constrained by` line names the rules. No database change is planned; the spec puts any under Ask first.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T5's owner comparison with the comparison page and the test-diff read.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Overview `src/app` row | T1, T2, T3, T4 | As the spec's Durable Outputs screens row states: each list's search, order, "Show 10 more" and the cap, found rows' buttons, and the search controls in the label and date-box lists; the 2026-10-14 and `orderRecentSales` sentences gone. | `close-work` reads the row whole against the code. |
| Overview `src/lib/` row | T1 | It names `src/lib/list-search.ts`, how a search text matches, and the 100-vendor limit. | `close-work` reads the row against the code. |
| Overview `test/` and `test/e2e/` rows | T1, T2 | They list `test/list-search.test.ts` and `test/e2e/list-search.spec.ts`. | `close-work` reads both rows whole. |
| Design reference: the comparison page | T5 | The AC-0042 ledger entry names revision 1794121141-4df1. | The brief still links the page. |

## Design (LLD)

### Design decisions

- **The parser.** `src/lib/list-search.ts` turns the address's `q`, `date`, and `rows` into `{ text, date, rows }` under AC-0015, AC-0016, and AC-0017: `text` with NULs removed, trimmed, cut to at most 100 UTF-16 code units without splitting a surrogate pair, then trimmed again; `date` kept only when `isCalendarDate` passes and its year is at most 9999; `rows` kept only when it matches `^[0-9]+$`; with its leading zeros dropped, more than two digits or a value over 50 gives 50, under 10 gives 10, so no digit string becomes a JavaScript number past 50. Anything else gives 10. With no `q`, `date`, or `rows`, each list reads as it does today.
- **The match value.** The same file escapes the regular-expression specials `\ . ^ $ * + ? ( ) [ ] { } |` for `imatch`. Inside `or()` it then double-quotes the value with `\` and `"` escaped; a single-column filter takes the escaped value unquoted, since quotes are kept as written there. `ilike` is not used, because PostgREST reads `*` in it as a wildcard.
- **The reads.** `listRecentReceipts`, `listRecentBatches`, and `listRecentSales` each gain an optional search argument, and existing callers keep their results.
  - Receipts with a non-empty text read vendors with a single-column `imatch` on `name`, limited to 101 rows. More than 100 returns a too-many result with no lots read. Otherwise the lots read puts `or()` over `lot_number` and `vendor_id.in.(...)`, or `lot_number` alone when no vendor matches. An empty text reads no vendors.
  - Batches embed `production_batches!inner` and filter `production_batches.batch_number` with a single-column `imatch` and `production_batches.production_date` with `eq`.
  - Sales put `or()` over `sale_number`, `customer`, `finished_code`, and `finished_product` on `v_sale_summary`, and `eq` on `sale_date`.
  - Receipts order by `receipt_seq` and batches by `produced_seq`, both identity columns that never tie. Each read counts exactly and reads `range(0, rows - 1)` in one request.
- **Recent sales' order.** `listRecentSales` orders by `sale_date` desc, `created_at` desc, `sale_id` desc, so it picks and shows in one order and ties keep their places. `orderRecentSales` and `src/app/sales/recent-order.ts` go, since the read gives that order. Today's sales on `/` (`src/lib/home.ts`) keep their own order.
- **The form.** One shared part in `src/app/list-search.tsx` renders the named form with next's `Form`. It sends a GET to the page's own address with `scroll={false}`, and carries a hidden `product` input where the page has one. The text box has `maxLength={100}`, and the date box sits in an `IconBox` with the calendar, as the floor forms' date boxes do. Its "Search" button and labels use `LABEL`, `CONTROL`, `DATE_BOX`, and `PAIR` from `form-parts.ts`. A new search drops `rows`, so it opens at 10.
- **Show 10 more.** The same file holds a small client part: a `Link` to the same address with `rows` plus 10, `scroll={false}` and `replace`. It remembers the row count it asked for. Once the list renders past it, it focuses the first added row, which carries `tabIndex={-1}`. The "Showing" line and the link sit under the list; at 50 rows the line takes its cap wording and the link goes.
- **Found rows.** A found row renders through the same row part as the 10 latest, so its figures, tags, buttons, and Reverse confirmation come with it. Each row action's `revalidatePath` re-renders the current address, so the search and `rows` stay. At 50 rows, `/production` builds at most 50 Reverse previews per render.
- **Menu.** `menu-list.tsx` gains the "Search products" box above the switch, inside its section, with `maxLength={100}`. It trims the text and compares lower-cased code and name with `toLowerCase`, which does not follow the browser's language, and `includes`, after the switch's filter. A non-empty trimmed text with nothing shown gives "No products match." in place of the nothing-sellable line.

### Component / module decomposition

- New: `src/lib/list-search.ts`, `src/app/list-search.tsx`, `test/list-search.test.ts`, `test/e2e/list-search.spec.ts` with a page object `test/e2e/list-search-page.ts`, and the verification ledger.
- Removed: `src/app/sales/recent-order.ts`.
- Changed: listed in each task's Touches.

### Quality attributes (NFRs)

- Accessibility: each form is named by its label; the focused first added row is read by a screen reader; every control keeps its 44 px target and focus ring.
- Security: the search text reaches PostgREST only as one escaped value per column, quoted where `or()` parses it, and RLS still decides the rows. The 100-code-unit cut, the 50-row cap, and the 100-vendor limit keep each request under the gateway's 8 KB.

## Tasks

### T1: The search reads match every character as itself, order and pick their rows, and hold the vendor limit

**Depends on:** none
**Mode:** TDD against the local stack, and a pure test of the parser
**Touches:** `src/lib/list-search.ts`, `src/lib/receiving.ts`, `src/lib/production.ts`, `src/lib/sales.ts`, `src/app/sales/page.tsx`, `src/app/sales/recent-order.ts`, `test/list-search.test.ts`, `test/sales-data.test.ts`, `test/e2e/sales.spec.ts`, `test/e2e/look-polish-tables.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- New `test/list-search.test.ts`, seeding through the operations (`receive_lot`, `produce_batch`, `record_sale`) with the reset helper the Vitest suites share. AC-0009 runs every printable ASCII character from `!` to `~` that is not a letter or digit, an accented letter in both cases, and AC-0009's four examples through each of the three reads, as made-up vendor and customer names and lot, batch, and sale numbers.
- The same file: AC-0012 runs AC-0012's two filter-syntax texts, with `lot_number`, `batch_number`, and `sale_number` each in place, through each read, and seeds rows whose search text sits only in each unsearched text AC-0012 names: a receipt's notes, void reason, and correction reason, a batch's notes and reversal reason, and a sale's void reason.
- The same file: the order tests start from the reset helper and seed through the operations. Each first checks that its seed has the property it relies on, and fails naming that property when it does not. The one property that rests on random ids, AC-0046's second pair, instead starts again from the reset helper, up to 20 times, before it fails.
  - AC-0018 seeds 25 receipts for one raw product and 25 batches for one finished product, each later row dated earlier than the one entered before it, so a read that sorts by date lists them in the reverse of entry order.
  - AC-0046 commits each sale through its own `callAsOperator`, so their `created_at` values differ, and seeds only two pairs, read at 10 rows. In the first pair, the sale entered second has the earlier sale date, so `sale_date` must put it below the other. In the second pair, both sales share a sale date and the one entered second has the smaller `sale_id`, so `created_at` must put it above the other.
  - AC-0023 runs its comparison on all three lists: the 20-row read's first 10 rows are the 10-row read's rows, in the same order. Receipts and batches use AC-0018's seed. Sales seed 25 sales through one `inOperatorTransaction`, so they share one `created_at`, with at least 12 on the newest sale date, so the 10th row falls inside that tied group; that run also checks that the tied group comes in descending `sale_id` order, the tie-break the Design names.
- The same file: AC-0029 seeds 100 matching vendors and searches with 100 backslashes, the longest-encoding text AC-0015 keeps, then seeds a 101st to see the read's too-many result; with 101 vendors on file, an empty text and a white-space-only text, each with and without a date, list the receipts AC-0002 and AC-0019 give.
- The same file: the parser's AC-0011, AC-0015, AC-0016, and AC-0017 rules as a pure test, with each value those criteria name, a text of 3 spaces and 100 letters, a text of 99 letters, a space, and a letter, a text with a tab at its start and a no-break space at its end, and an emoji across the cut.
- The checks in `sales-data.test.ts`, `sales.spec.ts`, and `look-polish-tables.spec.ts` that Recent sales picks the 10 last-entered sales change only as AC-0044 allows.
- Each new test is seen red once before its read changes, recorded in the ledger.

**Approach:**
- Write the parser and the match value, then extend each read, then move Recent sales' order into its read and drop `orderRecentSales`.
- Write the reads, the match rule, and the vendor limit into the overview's `src/lib/` row, Recent sales' order into its `src/app` row, and the new suite into its `test/` row.

**Done when:** the T1 tests pass, `npm run test:costing` passes, and `npm test` passes.

### T2: The three Recent lists search, page, and say when nothing matches

**Depends on:** T1
**Mode:** manual QA through the browser suite
**Touches:** `src/app/list-search.tsx`, `src/app/receiving/page.tsx`, `src/app/receiving/product-region.tsx`, `src/app/receiving/recent-receipts.tsx`, `src/app/production/page.tsx`, `src/app/production/product-region.tsx`, `src/app/production/recent-batches.tsx`, `src/app/sales/page.tsx`, `src/app/sales/recent-sales.tsx`, `test/e2e/list-search.spec.ts`, `test/e2e/list-search-page.ts`, `test/e2e/*.spec.ts`, `test/e2e/*-page.ts`, `docs/architecture/overview.md` (each existing e2e file only where a check AC-0044 lists moves)

**Tests:**
- no stub (manual QA): the checks are the rendered pages' roles, text, boxes, address, and focus.
- New `list-search.spec.ts`, seeding through the operations: AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, and AC-0008 with 12 rows per list; AC-0013; AC-0014, AC-0015, AC-0016, and AC-0017 by typing and by opening each crafted address those criteria name; AC-0019, AC-0020, AC-0021, AC-0022, AC-0024, AC-0025, and AC-0026 with 25 rows and with 55 rows, pressing "Show 10 more" until it goes; AC-0027; AC-0047 with 101 matching vendors; AC-0037, AC-0038, AC-0039, AC-0040, and AC-0041 on the three pages, AC-0041 in AC-0047's too-many case too.
- Each existing check AC-0044 lists changes only as it allows, `look-floor-pages.spec.ts`' `/production` and `/sales` page-state lists among them; the T5 diff read checks each.

**Approach:**
- Build the shared form and "Show 10 more", wire them into the three pages and lists, then run the browser suite and change each failing existing check that AC-0044 lists.
- Write the search forms, paging, the cap, and the no-match line into the overview's `src/app` row, add the search controls to its label and date-box lists, and add the new suite to its `test/e2e/` row.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: Correct, Void, and Reverse work on found rows

**Depends on:** T2
**Mode:** manual QA through the browser suite
**Touches:** `test/e2e/list-search.spec.ts`, `test/e2e/list-search-page.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are the dialogs, the saved rows, and the database rows they wrote.
- `list-search.spec.ts`: AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, and AC-0035 each record the oldest of 12 rows while it is among the 10 latest, then add rows, find it by search and by "Show 10 more", compare it with the record, and save its action; AC-0036 checks the address and the row's new state after each save.

**Approach:**
- Write the tests against the T2 build; change app code only where a test shows a found row behaving differently.
- Replace the overview's 2026-10-14 sentence with the found rows' buttons.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: Menu searches as the owner types

**Depends on:** none
**Mode:** manual QA through the browser suite
**Touches:** `src/app/menu/menu-list.tsx`, `test/e2e/list-search.spec.ts`, `test/e2e/list-search-page.ts`, `test/e2e/*.spec.ts`, `test/e2e/*-page.ts`, `docs/architecture/overview.md` (each existing e2e file only where a check AC-0044 lists moves)

**Tests:**
- no stub (manual QA): the checks are the box, the products shown, the lines, and the switch.
- `list-search.spec.ts`: AC-0007, AC-0045, AC-0010, AC-0011 on Menu with a tab at the text's start and a no-break space at its end, AC-0014 on Menu's box, and AC-0028 with the switch on and off; AC-0037, AC-0038, AC-0039, AC-0040, and AC-0041 on `/menu`.
- The `/menu` Tab-order and page-state lists, in `menu.spec.ts`, `look-menu-invoices-ask-alerts.spec.ts`, and any other file that holds one, change only as AC-0044 allows.

**Approach:**
- Add the box and its filter, then run the browser suite.
- Write Menu's search box into the overview's `src/app` row and its label list.

**Done when:** the T4 tests pass and `npm test` passes.

### T5: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3, T4
**Mode:** visual and manual QA
**Touches:** `docs/specs/search-filters/notes/verification-ledger.md`

**Tests:**
- no stub (visual and manual QA): the owner's verdict and a diff read.
- The ledger records the owner's AC-0042 verdict, the AC-0044 read of `git diff` from the branch point over `test/` with untracked files listed, and the red runs T1 saw. The verdict and the diff read each name the commit they read: the branch's last commit that changes a file other than those under `docs/specs/search-filters/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. A later commit that changes any other file re-opens both.

**Approach:**
- Build the four pages on the local stack with made-up data and a search entered, show them to the owner beside the comparison page, and read the test diff.

**Done when:** the ledger holds every entry above and `npm test` passes (AC-0043).

## Rollout

One PR with no migration. Rollback is a revert. A hosted app build serves it only after the developer's approval, which is not part of this spec.

## Risks

- An existing browser test that walks a page's Tab order through its Recent list or Menu fails once the search controls join it. T2 and T4 change only what AC-0044 lists, and the T5 diff read checks each change.
- Recent sales now opens on the newest sale dates, so a back-dated sale entered today can sit below the first 10; search and paging reach it.
- The hosted gateway's address limit is not measured; the 100-vendor limit leaves about 2.5 KB of room under the local 8 KB.

## Changelog

- 2026-11-10: initial plan, after the owner's answers on the lists, the row actions, paging, the search form, and browsing, a probe of PostgREST's `or()`, `ilike`, and `imatch` with made-up names on stack A, and a read-only probe of the batch embed filter.
- 2026-11-10: after spec-stage review round 1 (adversarial, shaping, and security): the owner's calls on Recent sales' order (sale date, then entry), a 50-row cap, a 200-vendor limit, and leaving inactive products out; one read per list with no page loop; a single-column filter for batches and vendors; `isCalendarDate` for the address date; NULs dropped from the address text; unique names for the search date boxes; every moved test file named in Touches; `security-reviewer` in the post-gates review.
- 2026-11-10: after spec-stage review round 2 (adversarial, shaping, and security): the owner's call to lower the vendor limit to 100 after the real receipts request was measured; the too-many state stated whole and limited to a non-empty text; the address text cut in UTF-16 code units and trimmed again; large digit-only row counts named; the Menu filter and the two orders split into their own criteria; every moved test file covered by Touches; identity columns need no tie-break.
- 2026-11-10: after spec-stage review round 3 (adversarial and shaping; security clean): pinned tests for the empty-text receipt search with 101 vendors, the within-date sales order with distinct entry times, and non-space white space; AC-0012 names each list's unsearched text; the too-many state joins the page-state checks.
- 2026-11-10: after spec-stage review round 4 (adversarial and shaping): AC-0046's seed commits each sale in its own transaction and adds an earlier-dated sale entered last, so both of its sort keys can fail.
- 2026-11-10: after spec-stage review round 5 (adversarial and shaping): the order tests state the property each seed must have and check it first, so a read that drops any one sort key fails every run.
- 2026-11-10: after spec-stage review round 6 (adversarial and shaping), on the owner's call to fix and approve: AC-0023's comparison runs on all three lists, AC-0018's seed names its property, and only AC-0046's `sale_id` pair retries, from the reset helper, up to 20 times.
