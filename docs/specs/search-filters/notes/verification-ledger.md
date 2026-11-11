# Verification ledger: search-filters

This ledger holds what only a person, a probe, or a diff read can check for [`spec.md`](../spec.md). Spec-stage review artifacts sit under the ignored `.context/reviews/a5f08fda-ae0d-4d6e-a49d-fb51e365b01a/`. Spec-stage rounds review uncommitted files, so each round names the sha256 prefixes of the spec and plan it read; snapshots sit in the session scratchpad under `search-filters/r<N>/`.

## Spec-stage review

| Round | Adversarial | Shaping | Security |
| --- | --- | --- | --- |
| 1 (spec `54c42a94`, plan `424597c3`) | 20 findings: 18 sustained (17 advisory, 1 Concern) and repaired, 1 refuted, 1 indeterminate | 11 findings, all accepted | 5 findings: 4 sustained as advisory and repaired, 1 refuted |
| 2 (delta; spec `3622da24`, plan `7750e5a7`) | 7 findings: 6 sustained (1 Blocker, 2 Concerns, 3 advisory) and repaired, 1 indeterminate | 5 findings, all accepted | 2 findings, both sustained as advisory and repaired |
| 3 (delta; spec `bcba10dc`, plan `0483a817`) | 5 findings: 5 sustained (2 Concerns, 3 Nits) and repaired | 1 finding, accepted | Clean |
| 4 (delta; spec `55ed73d0`, plan `bc5faa9f`) | 1 finding: sustained (Concern) and repaired | 1 finding, accepted | Not run (the delta changes no security control) |
| 5 (delta; spec `2f5bb851`, plan `ca281edc`) | 2 findings: 1 sustained (Concern) and repaired, 1 refuted | 2 findings, both accepted | Not run (the delta changes no security control) |
| 6 (delta; plan `bac6c93d`, spec unchanged) | 3 findings: 3 sustained (1 Concern, 2 Nits) and repaired, unreviewed on the owner's call | 3 findings, the same three, accepted | Not run (the delta changes no security control) |

### Round 1 dispositions

Every round 1 finding is draft-origin. Finding numbers are the raw reports' own.

- **Owner calls, 2026-11-10.** Recent sales picks, pages, and shows by sale date, then entry (adversarial 1, shaping 2). Each Recent list stops at 50 rows (security 1, adversarial 6; the adjudicator's objection that a cap conflicts with paging through every match falls away, since the cap replaces that promise). A receipt search supports up to 200 matching vendors, measured against the local gateway's 8 KB limit (security 4, adversarial 19). Inactive finished products stay out of Menu's search (shaping 10, adversarial 13). Adversarial 17, left indeterminate because the adjudicator could not read the probe scripts, is treated as sustained at advisory on the owner's direction and fixed: the Assumptions now state only what each probe ran, and `or-imatch-commas.mjs` probed commas, double quotes, and apostrophes inside `or()`.
- **Repairs.** The search date boxes take names no other control on their page has (adversarial 2, shaping 3). Menu's lines are fixed for each mix of text and switch (adversarial 3). The address keys, the cut-and-trim order, the date's written form, and the row count's written form are fixed, with NULs dropped and `isCalendarDate` used (adversarial 4 and 5, shaping 8, security 3). The Tab rule names its stops (adversarial 7, shaping 9). The layout check names the list's section (adversarial 8). Menu's match and its 100-character box have their own mode and tests (adversarial 9 and 10, shaping 6). Paging is checked at the read for a stable order under ties (adversarial 11, shaping 6). AC-0042 names its exclusions (adversarial 12, shaping 4). Touches name every moved test file (adversarial 14). One read per list replaces the page loop (adversarial 15). The plan records its `next/form` deviation (adversarial 16). The label and date-box criterion cites the overview's rules (adversarial 18, shaping 1). The character set and filter-syntax texts sit in the criteria (shaping 5, security 2). Combined criteria are split (shaping 7). Batch and sale numbers can be seeded with any character (shaping 11).
- **Refuted.** Adversarial 20 (no recorded security pass): refuted on authority. The plan names `security-reviewer` in the post-gates review all the same, as this work changes how untrusted input reaches the database. Security 5 (encoding left open): refuted on existing handling; the plan now names each read's encoding anyway.

### Round 2 dispositions

Every round 2 finding is prior-round-repair origin: each sits in text round 1's repairs wrote.

- **Owner call, 2026-11-10.** The vendor limit drops from 200 to 100 (security 1, adversarial 3, shaping 3). `receipts-len.mjs` measured the planned receipts request on the local gateway: at most 196 vendor ids with a one-letter text and 165 with the longest-encoding texts the parser keeps. Round 1's 200 came from a stripped-down request. Adversarial 3 was left indeterminate because the adjudicator could not read the probe; the security adjudication sustained the same defect, and the measurement and the owner's call settle it.
- **Repairs.** T1's Touches name every file whose check the new sales order moves, and AC-0044 covers each such check (adversarial 1). T2's and T4's Touches cover every existing browser test file, since `checkPageState` compares each page's Tab stops and many files run it on these pages (adversarial 2). The too-many state applies only to a non-empty text and states all it shows, in AC-0047, with AC-0019, AC-0020, AC-0022, and AC-0027 excepting it (adversarial 4 and 5, shaping 1). The address text is cut in UTF-16 code units, the box's unit, and trimmed again, with trimming defined (adversarial 6, shaping 2). AC-0012 names a batch's reversal reason (adversarial 7). AC-0017 names `1000000` and a 20-digit value (security 2). "Show 10 more" and "Clear search" have a Tab anchor when the list has no stops (shaping 4). Menu's filter and the two orders have their own criteria, AC-0045 and AC-0046 (shaping 5). Receipts and batches need no tie-break, since their sort keys are identity columns.
- **Advisory notes taken.** Menu lowers case with `toLowerCase`, not the browser's language rules. Copies of all six probe scripts sit in the review run's `evidence/` folder.

### Round 3 dispositions

Every round 3 finding is prior-round-repair origin.

- **Repairs.** AC-0046's Vitest seed adds three sales on one sale date in separate statements, so a read that drops entry time fails, and ties stay with AC-0023 (adversarial 1). T1 runs an empty and a white-space-only receipt search, with and without a date, while 101 vendors exist (adversarial 2). The parser test and Menu's AC-0011 check carry a tab and a no-break space (adversarial 3). AC-0012 names exactly the unsearched text each list's rows carry, and T1 seeds each (adversarial 4). The gateway Assumption names 100 backslashes as the longest kept text (adversarial 5, shaping advisory). AC-0041 covers the too-many state (shaping 1).
- **Trend.** Rounds 1 to 3 found 36, 14, and 6 findings. Round 3's repairs add pinned test cases, one more page-state run (AC-0041), a tie sentence (AC-0046), and wording (AC-0012).

### Round 4 dispositions

Both round 4 findings are prior-round-repair origin, from round 3's AC-0046 seed.

- **Repairs.** AC-0046's seed commits each of its four sales through `callAsOperator`, its own transaction, since `now()` is fixed per transaction and separate statements inside one transaction tie (adversarial 1); round 3's "in separate statements" was wrong on that point. It adds an earlier-dated sale entered last, so a read that drops `sale_date` fails, and checks that the four entry times differ (shaping 1). The tie Assumption names the transaction as what ties entry times.

### Round 5 dispositions

Every round 5 finding is prior-round-repair origin, in the order-test bullet rounds 3 and 4 repaired.

- **Repairs.** Rounds 3 to 5 each found a gap in how T1 seeds the order tests, because the bullet named seed steps. T1 now states the property each seed must have and checks it before the test runs: a pair only `sale_date` decides, a pair only `created_at` decides with the later-entered sale holding the smaller `sale_id`, and at least 12 sales tying on both keys across the 10th row (adversarial 1, shaping 1 and 2).
- **Refuted.** Adversarial 2 ("the three latest entered first" reads two ways): refuted on existing handling, since only one reading fits AC-0046. The rewrite drops the phrase anyway.

### Round 6 dispositions and the owner's call

Every round 6 finding is prior-round-repair origin, in round 5's rewrite of the order-test bullet. Both reviewers found the same three.

- **Repairs.** AC-0023's comparison runs on all three lists, stated as the 20-row read's first 10 rows matching the 10-row read (adversarial 1, shaping 2). AC-0018's seed dates each later row earlier, so a date-sorted read fails (adversarial 3, shaping 1). Only AC-0046's `sale_id` pair retries, from the reset helper, up to 20 times; every other unmet seed property fails at once with its name, and AC-0046 seeds only its four sales and reads 10 rows (adversarial 2, shaping 3). Sale ids come from `gen_random_uuid()` (`supabase/migrations/0001_init.sql`), so that pair holds about half the time per draw.
- **Owner's call, 2026-11-10.** Rounds 4 to 6 found 2, 4, and 3 findings, all in this one plan bullet; the spec's criteria are unchanged since round 4. The owner chose to apply round 6's three fixes and go to approval without a seventh round. The fixes are unreviewed; the post-gates reviews read the real test code.
- **Deletion pass.** Every criterion added during review is an owner call (the 50-row cap, the vendor limit, the sales order, inactive products), a trust-boundary check on address input, or a split of an earlier criterion. None was cut.

## Approval (2026-11-10)

- The owner approved the spec and the plan on 2026-11-10 at `7be828e`.
- For this build the owner approved stopping the app server that runs from this folder (PIDs 91551 and 91574, stopped 2026-11-10) and starting it again from the final build when the work is done; running the stack A slot fix when catalog bloat slows the tests; and committing each task on `feat/search-filters`, then pushing and opening one PR.


## T1

Red runs of the new tests in `test/list-search.test.ts`, before the reads changed. Both ran on `79f13d2` with the new test file and nothing else changed (uncommitted). Command: `npx vitest run test/list-search.test.ts`.

Red run 1: `src/lib/list-search.ts` did not exist. The whole file failed at import with `Error: Cannot find module '../src/lib/list-search.js' imported from test/list-search.test.ts`. This is the red run of the five pure tests, which have no read to change:

- AC-0011: white space at the start and end of the text is ignored, as trim removes it
- AC-0015: NULs go, the text is trimmed, cut to 100 code units without splitting a pair, and trimmed again
- AC-0016: a date counts only as a real yyyy-mm-dd day with a year from 0100 to 9999
- AC-0017: a row count in digits alone counts from 10 to 50; anything else counts as 10
- AC-0009: the match values escape the regular-expression specials, and quote for or()

Red run 2: `src/lib/list-search.ts` written (the five pure tests then passed), the three reads still ignoring a search argument and `listRecentSales` still ordering by `created_at`. 13 of 18 tests failed, each on the line shown:

- AC-0009, Recent receipts: `AssertionError: q!z: expected [ '500 Off Meats', 'AXB Foods', ...(8) ] to deeply equal [ 'Q!Z Foods', 'V-0' ]`
- AC-0009, Recent batches: `AssertionError: q!z: expected [ '500 Off Meats', 'AXB Foods', ...(8) ] to deeply equal [ 'Q!Z Foods' ]`
- AC-0009, Recent sales: `AssertionError: q!z: expected [ '500 Off Meats', 'AXB Foods', ...(8) ] to deeply equal [ 'Q!Z Foods', 'S-0' ]`
- AC-0012, Recent receipts: `AssertionError: x",lot_number.not.is.null,lot_number.eq.": expected [ Array(6) ] to deeply equal [ 'VEND-0', ...(1) ]`
- AC-0012, Recent batches: `AssertionError: x",batch_number.not.is.null,batch_number.eq.": expected [ ...(4) ] to deeply equal [ Array(1) ]`
- AC-0012, Recent sales: `AssertionError: x",sale_number.not.is.null,sale_number.eq.": expected [ 'CUST-0', 'CUST-1', 'PLAIN-0', ...(3) ] to deeply equal [ 'CUST-0', ...(1) ]`
- AC-0018, Recent receipts: `AssertionError: expected [ 'L-20260906-e10845', ...(9) ] to deeply equal [ 'L-20260906-e10845', ...(24) ]`
- AC-0018, Recent batches: `AssertionError: expected [ 'B-20260906-aa514b', ...(9) ] to deeply equal [ 'B-20260906-aa514b', ...(24) ]`
- AC-0023, Recent receipts: `AssertionError: expected [ { ...(14) }, { ...(14) }, ...(8) ] to have a length of 20 but got 10`
- AC-0023, Recent batches: `AssertionError: expected [ { ...(8) }, { ...(8) }, { ...(8) }, ...(7) ] to have a length of 20 but got 10`
- AC-0023, Recent sales: `AssertionError: expected [ { ...(12) }, { ...(12) }, ...(8) ] to have a length of 20 but got 10`
- AC-0046, Recent sales: `AssertionError: expected [ 'P2-B', 'P2-A', 'P1-B', 'P1-A' ] to deeply equal [ 'P2-B', 'P2-A', 'P1-A', 'P1-B' ]` (first attempt held pair 2's `sale_id` property, so no retry was needed)
- AC-0029, 100 vendors, then 101, then an empty text: `AssertionError: expected undefined to be false // Object.is equality` (the read had no `tooManyVendors` field yet; the test was then changed to expect it absent when false, because `receiving-data-extra.test.ts` compares a no-receipt result with `toEqual`, and its `tooMany.tooManyVendors` check still fails on the old read)

The unsearched-text half of each AC-0012 test (notes, void reason, correction reason, reversal reason) runs after the first assertion in the test, so it was not reached in red run 2; it ran green with the reads.

## T4

Red run, 2026-11-10, against `src/app/menu/menu-list.tsx` unchanged from commit `e55439a` (the new `test/e2e/list-search.spec.ts` and `test/e2e/list-search-page.ts` in place; the two `/menu` Tab-order lists already holding the box's stop). `npm run test:e2e -- list-search`: 24 failed, 2 passed (the two sign-in setup tests), 10.2 minutes. The 24 failures, each before the box existed:

- AC-0007: `Expected: 1  Received: 0` counting the "Search products" text box in the switch's section.
- AC-0045, AC-0010 (names, codes, every punctuation character), AC-0011, AC-0028 (no match), and AC-0038 and AC-0039 at 390, 1024, and 1280 px at both text sizes (12 runs): `locator.click: Test timeout of 30000ms exceeded. waiting for getByRole('textbox', { name: 'Search products', exact: true })`.
- AC-0014: `Expected: "100"  Error: element(s) not found` reading the box's `maxlength`.
- AC-0037: the walk read `["button #menu-button", "a #alerts-link", "input"]` and lacked `"input #menu-search"`.
- AC-0040 and AC-0041: the same missing box (`getByRole('textbox', ...)` or the box's id not found).
- AC-0028 (lines with the text empty): failed on a test fault, not the missing box: `getByRole('status')` matched the shell's status region as well as Menu's. The test now reads Menu's own region through `menuStatus`.

## Wave 1 gate (T1 and T4)

- Before the gate, `test/invoice-data.test.ts` timed out in T4's run, a file this work does not touch. The stack A slot fix ran at 2026-11-10T22:01Z under the owner's build approval: dead `pg_class` rows went from 522,934 to 0 and the Realtime slot's age from 70,206 to 2.
- `npm test` passed on T1's commit `e55439a` plus T4's uncommitted work: Vitest 58 files and 1,101 tests in 68 s, then Playwright 1,197 tests in 15.0 min.


## T2

Red run of the Recent lists' new tests in `test/e2e/list-search.spec.ts`, 2026-11-10, on `3f3b1e4` with the new spec and `test/e2e/list-search-page.ts` in place and the app code (`src/app/list-search.tsx`, the three pages, the three lists, and the two `product-region.tsx` files) as `3f3b1e4` has it. The first run, `npm run test:e2e -- list-search`, was stopped by hand after its 51st test; it took about 40 minutes, since a failing test waits out its 30 s and 120 s limits. The rest ran as `npm run test:e2e -- list-search -g "Sales: the sales search form|paging|too many|The Recent lists"`. Together they ran every new Recent-list test, and all of them failed (the two sign-in setup tests passed; Menu's 24 tests are T4's and stayed green):

- AC-0001, AC-0003, AC-0005 on each page: the form named "Search receipts", "Search batches", or "Search sales" did not exist (`getByRole('form', ...)` found `element(s) not found`).
- AC-0002, AC-0004, AC-0006, AC-0008, AC-0013, AC-0014, AC-0015, AC-0016, AC-0027 on each page: the same missing form (`locator.fill`/`locator.click` waiting on the "Search" text box until the test timeout).
- AC-0019 to AC-0026 with 25 rows, with 12 rows, and with 55 rows, and AC-0017's row counts, on each page: `expect(locator).toHaveCount(expected)` on `#recent-receipts-list > li` (and the batches and sales ids) found 0, since the lists had no id and no "Show 10 more".
- AC-0047 and its AC-0041 page-state check: `expect(received).toEqual(expected)` read `[]` for the seeded `LT-003`, `LT-002`, `LT-001` (no list id), and no "Too many vendors match." line.
- AC-0037 on each page and with no stops: no search controls in the Tab order.
- AC-0038, AC-0039 on each page at 390, 1024, and 1280 px at both text sizes (18 runs), AC-0040 on each page, and AC-0041 on each page: `locator.boundingBox` and `page.evaluate` found no search control to read (`getComputedStyle` on `null`).
- Totals: the stopped first run showed 24 failures (Receiving, Production, and the start of Sales); the second run showed 51 failures and 2 passes (the setup tests) in 1.0 h.

- The T2 implementer stopped twice before finishing: once on a network error (ENOTFOUND) during its full browser run, then on its model's usage limit. The controller finished T2 on 2026-11-11 from the implementer's working tree: it pointed the five `/production` page-state checks still listing the form's controls alone (`production.spec.ts` AC-0008, AC-0030, AC-0074, AC-0029, and `reverse.spec.ts` AC-0130) at `FORM_AND_SEARCH`, the AC-0044 move the other Production checks had already taken; gave the "Search" button the secondary look so Save stays each floor page's one blue button; and imported `MAX_ROWS` in place of a repeated 50.
- A browser run on the implementer's tree took 2.8 h with 26 failures, most in files T2 does not touch; the cause of the slowdown was not established. A rerun on 2026-11-11 had 6 failures: the five checks above and one `alerts.spec.ts` seed that hit `alerts_one_live`, a file T2 does not touch, which passed in the next run.
- T2 gate, `npm test` on `3f3b1e4` plus T2's working tree: Vitest 58 files and 1,101 tests in 42 s, then Playwright 1,259 passed and 1 skipped in 12.9 min. The skip is `list-search.spec.ts`' receipt and sale column check, which skips itself for batches.

## T3

First run of the found-row tests in `test/e2e/list-search.spec.ts`, 2026-11-11, on `9b0e1c1` with the new tests and their helpers in `test/e2e/list-search-page.ts` in place (uncommitted) and no app code changed. Command: `npm run test:e2e -- list-search -g "Row actions on found rows"`. All six passed on that first run (8 passed with the two sign-in setup tests, 12.0 s):

- AC-0030, AC-0031, AC-0036: a receipt found by a search shows what it showed among the 10 latest, and its Correct and Void save as they do there, on the same address
- AC-0032, AC-0033, AC-0036: a batch found by a search shows what it showed among the 10 latest, with the same Reverse confirmation, and its Reverse saves as it does there, on the same address
- AC-0034, AC-0035, AC-0036: a sale found by a search shows what it showed among the 10 latest, and its Void saves as it does there, on the same address
- The same three titles with "found by Show 10 more" in place of "found by a search"

So no app code changed for T3: a found row renders through the same row part as the 10 latest.

Since each passed on its first run, a scratch copy of the spec, `test/e2e/scratch-t3.spec.ts`, ran the same six once against one wrong expectation each, then was deleted and never committed. The three found by a search compared the found row 1 with the record of row 2, the void or reversed one. The three found by "Show 10 more" expected the address without its `rows` after the first save. Command: `npm run test:e2e -- scratch-t3 -g "Row actions on found rows"`. All six failed (2 passed, the setup tests; 15.7 s), each on the line shown:

- Receipt, by a search: `expect(received).toEqual(expected)`, with `- "Lot number: LT-002"` and `+ "Lot number: LT-001"` among the 7 lines that differ
- Batch, by a search: `expect(received).toEqual(expected)`, with `- "Batch number: BT-002"` and `+ "Batch number: BT-001"` among the lines that differ
- Sale, by a search: `expect(received).toEqual(expected)`, with the record's lines `- "SL-002"`, `- "Voided"`, and `- "entered twice"` against the found row's `+ "SL-001"`, and the found row's `+ "button \"Void sale SL-001\": Void ..."` that the record lacks
- Receipt, by Show 10 more, after Correct: `Error: the address`, `Expected: "http://127.0.0.1:3100/receiving?product=RAW-TOM"`, `Received: "http://127.0.0.1:3100/receiving?product=RAW-TOM&rows=20"`
- Batch, by Show 10 more, after Reverse: `Error: the address`, `Expected: "http://127.0.0.1:3100/production?product=502"`, `Received: "http://127.0.0.1:3100/production?product=502&rows=20"`
- Sale, by Show 10 more, after Void: `Error: the address`, `Expected: "http://127.0.0.1:3100/sales"`, `Received: "http://127.0.0.1:3100/sales?rows=20"`
- T3 gate, `npm test` on `9b0e1c1` plus T3's working tree, 2026-11-11: Vitest 58 files and 1,101 tests in 40 s, then Playwright 1,265 passed and 1 skipped in 12.7 min. The skip is the same self-skip T2's gate names.

## T5

Both records below read `03caf67`, the branch's last commit that changes a file other than those under `docs/specs/search-filters/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. A later commit that changes any other file re-opens both.

- **AC-0042, 2026-11-11: "match".** The owner compared `/receiving`, `/production`, `/sales`, and `/menu`, built from `03caf67` at 1280 px with made-up data and a search entered on each, with the comparison page at revision 1794121141-4df1, its "Finding things" block. The check page is https://claude.ai/artifact/JYp8gNdHFobLtZvdDLDjFS (version 1794418136-bb4a): the Receiving page searching "north" and with no match, Recent batches searching "B-202610", Recent sales with 20 matches before "Show 10 more", and Menu typing "smoked" at 1280 and 390 px.
- **AC-0044, 2026-11-11: pass.** `git diff 7c6ddcc..03caf67 -- test/`, with no untracked test files. Every changed expectation in an existing file is one of the three moves AC-0044 lists:
  - The "Showing the N most recent of M" lines read "Showing N of M" (`receiving.spec.ts`, `production.spec.ts`, `sales.spec.ts`, `look-polish-tables.spec.ts`), moved by AC-0020.
  - The checks that Recent sales picks the 10 last-entered sales pick by sale date, then entry, moved by AC-0046 and AC-0019: `sales-data.test.ts` (T-12 dated Oct 6 in place of Oct 2, so it stays first, and the asserted first date with it), `sales.spec.ts`' AC-0070 test (voids at indexes 2 and 4 in place of 0 and 4, so one stays outside the 10 and one inside; the expected order, the last row's date, and the saved sale's place), and `look-polish-tables.spec.ts`' AC-0020 test (the dropped sale is the Oct 1 one).
  - The Tab-order and page-state lists of the four pages include the search controls where AC-0037 puts them: after the form, or after the saved result's Trace link on `/sales`, and before the list's own stops (`correct.spec.ts`, `look-floor-pages.spec.ts`, `look-pages.spec.ts`, `production.spec.ts`, `receiving.spec.ts`, `reverse.spec.ts`, `sales.spec.ts`, `menu.spec.ts`, `look-menu-invoices-ask-alerts.spec.ts`, and the page objects' new lists), moved by AC-0037.
- **Red runs:** recorded under T1, T2, T3, and T4 above.
- **AC-0043:** the T3 gate ran `npm test` on the tree `03caf67` holds: Vitest 58 files and 1,101 tests in 40 s, Playwright 1,265 passed and 1 self-skip in 12.7 min.

## Post-gates review

### Owner's call, 2026-11-11: a Save keeps the search

A Save from Receiving's, Production's, or Sales' form under a search keeps the search: the action's `revalidatePath` re-renders the current address with its `q`, `date`, and `rows`, so a saved row that does not match is not listed until "Clear search", while the saved result under the form shows it either way. A Save for a product other than the chosen one moves the address to that product with no search (`router.replace` in `receipt-form.tsx`, `production-form.tsx`, and `sale-form.tsx`). The owner chose to keep this behavior, with no code change, over clearing the search after a Save.


### Round 1 fixes

One line per sustained finding of `.context/reviews/a5f08fda-ae0d-4d6e-a49d-fb51e365b01a/1-post-gates-*-adjudication.md`, 2026-11-11. Where findings overlap, each names the one repair.

Adversarial reviewer:

- 1, AC-0025's scroll check cannot fail: `watchLowestScroll` and `lowestScrollY` in `test/e2e/list-search-page.ts` record the smallest `window.scrollY` from a scroll listener and a capture-phase `focusin` listener, installed before each press. The 25-row test checks both of its presses, and the 55-row test, which names AC-0025, checks each of its four.
- 2, AC-0047's lot number: the AC-0047 test seeds `LT-004-FARM`, a RAW-TOM receipt from Reyes Meats, through `receive_lot` (`receiveNumbered`). "004-farm" lists it, and the too-many "farm" lists no row.
- 3, the chosen product under a search: `seedOtherProductRow` seeds, through the operations, receipt LT-000 of a second raw product (RAW-OTHER) from Beta Meats and batch BT-000 of a second finished product (F-OTHER), each on 2026-09-15. The AC-0002 and AC-0004 test's exact lists leave each out, one check says so by name, and the other product's own list shows it for the same search.
- 4, the Recent batches comment: it says a save or a reversal renders the current address again, search included, so a saved batch is listed first when no search is set or when it matches.
- 5, the `total` comments: see quality 5.

Quality engineer:

- 1, AC-0025: see adversarial 1. The `scrollY` helper's comment now says it reads `window.scrollY`.
- 2, the layout check at 1280 px: the "search that finds rows" step opens its address at the loop's width and height.
- 3, the too-many lot number: see adversarial 2.
- 4, the chosen product: see adversarial 3.
- 5 (finding 6), the `total` comments: in `src/lib/receiving.ts`, `src/lib/production.ts`, and `src/lib/sales.ts` each says `total` counts the rows that match the search, the M in "Showing N of M", and 0 for receipts in the too-many case.
- 6 (finding 7), one decision for "a search is set": `isSearchSet` in `src/lib/list-search.ts`, used by the three lists and by `ListEnd`, which now takes the whole `search`.
- 7 (finding 8), the no-break spaces: the four lines write each as `\u00a0`.
- 8 (finding 9), the copied helpers: `box` from `look-checks.ts` replaces `boxOf`, and the search stops come from `RECEIPT_SEARCH_STOPS`, `BATCH_SEARCH_STOPS`, and `SALE_SEARCH_STOPS`.
- 9 (finding 10), the imports: `BETA`, `GAMMA`, `groupOf`, and `mixedDay` are gone from the spec, and `../db` is imported once.
- 10 (finding 11), the self-skipping test: it is now two tests, "AC-0002: a receipt's vendor name and lot number are searched" and "AC-0006: a sale's product code, product name, customer, and sale number are searched". The suite has no skip.
- 11 (finding 12), the titles: the 12-row test no longer names AC-0021, and its comment says a search that 9 rows match shows all 9 with no line and no link. The Vitest AC-0029 title says an empty or white-space text lists the latest receipts, with and without a date.
- 12 (finding 13), the parser cases in the browser: AC-0016 opens only `2026-02-30`, `0000-01-01`, and `11/10/2026`, and AC-0017 only `1000000`, `99999999999999999999`, `5`, `-5`, `+20`, `20.0`, and `1e21`, checking the cap line on the two that count as 50. The address with `rows=20`, a text, and a date moved to the 55-row test, which names AC-0013.
- 13 (finding 14), the timeout: the file-wide 120 s is gone; the six tests that seed 25 or 55 rows or 101 vendors keep their own 240 s. In the targeted run below the slowest test took 3.7 s.

Frontend reviewer:

- 1, search results not announced: `ListEnd` renders one wrapper in every state, with a `role="status"` region holding the "Showing" lines, the no-match line, and the too-many line. "Show 10 more" and "Clear search" follow the region, outside it, so the Tab order is unchanged. While the region is empty the wrapper carries each list's `collapsed` classes (`-mt-2` with the table variant's `mt-0`), which cancel the section's gap above it. The AC-0027 test checks that the no-match line sits inside the region.
- 2, "Clear search" drops focus: once a press of "Clear search" has cleared the search, `ListEnd` focuses the list's Search text box. The AC-0027 test checks it.
- 3, the clipped focus ring: the three rows' `li` carry `receipt-table:-outline-offset-2`, `batch-table:-outline-offset-2`, and `sale-table:-outline-offset-2`.
- 4 (finding 5), the Recent batches comment: see adversarial 4.

The overview's `src/app` row states that the lines under a Recent list sit in a status region, that "Clear search" moves focus to the Search box, and that a Save keeps the search in the address.

AC-0025 mutation run, 2026-11-11: a scratch edit removed `scroll={false}` from the "Show 10 more" link in `src/app/list-search.tsx`, then `npm run test:e2e -- list-search -g "AC-0025"` ran. 6 failed and 2 passed (the sign-in setup tests) in 19.3 s. Each failure was the new check:

- `Error: the lowest scroll offset from the press to the focus`, `Expected: > 0`, `Received:   0`, at `list-search.spec.ts:622` (Production's and Sales' 25-row test, the first press) and `:629` (Receiving's 25-row test, the second press).
- `Error: the lowest scroll offset from press 1 to the focus` (Production and Sales) and `from press 3` (Receiving), `Expected: > 0`, `Received:   0`, at `list-search.spec.ts:663` (the 55-row test).

The file was then copied back from the copy taken before the edit; `cmp` found no difference, so `git diff` shows none of the scratch change.

Gates, 2026-11-11, on `90dcb5a` plus these fixes, uncommitted:

- `npm run test:e2e -- list-search` first, alone: 94 passed in 1.3 min.
- `npm run typecheck`: pass.
- `npm test`: Vitest 58 files and 1,101 tests in 48 s, then Playwright 1,265 passed, none skipped, in 12.9 min.
- After that gate, two edits changed only text no test reads: the AC-0002 seed comment, and the 55-row paging test's title, which dropped AC-0024 since that test opens with no search (the 25-row test checks AC-0024 with a search and a date). The typecheck passed after both.


### Round 2 fixes

One line per sustained finding of `.context/reviews/a5f08fda-ae0d-4d6e-a49d-fb51e365b01a/2-post-gates-*-adjudication.md`, 2026-11-11. Where findings overlap, each names the one repair.

Adversarial reviewer:

- 1 (finding 2), no check of the status region: `listStatusOf` in `test/e2e/list-search-page.ts` finds a Recent list's region by its role, leaving out the rows' own regions. `keepListStatus` keeps that element on `window`, and `expectKeptListStatus` checks that the region holds one exact line, or none, and is still the kept element. No Tab stop is added. Four tests use them, on each list they cover:
  - The 12-row paging test: "Showing 10 of 12" sits in the region, which stays, empty, once the press shows every row.
  - The AC-0027 test opens a search whose 6 matches all show, so the region is empty. "No ... match." then lands in that same region, and "Showing 10 of 12" does after Clear search.
  - The 55-row test: each "Showing" line and the cap line sit in the one region.
  - The AC-0047 test: the too-many line lands in the region the page had while it was empty.
- 2 (finding 3), the `list-search.tsx` header: it says `SearchForm` receives the parsed search's `text` and `date`, and `ListEnd` the whole search.
- 3 (finding 4), the AC-0016 box check: the test also opens `0099-12-31`, which a date box can hold and the parser refuses, and checks the box shows empty. It then fills the box with that date and checks the box holds it, so the empty value is the page's doing.
- 4 (finding 5), the other-product comment: see quality 4.

Quality engineer:

- 1, the empty status region: see adversarial 1.
- 2, the empty end's room: the `collapsed` classes stay. `endRoom` measures how much taller the list's section is with its end than with the end taken out. Once the press shows every row, the 12-row paging test checks that room is 0 at 1280 px, where the list reads as a table, and at 390 px, where it reads as cards; it checks which of the two it is at each width. The status region stays in the page and in the accessibility tree in every state.
- 3, the modified click on "Clear search": the Link sets the focus flag from `onNavigate`, which Next calls only for a press that navigates in this tab. The AC-0027 focus check passes.
- 4 (finding 5), the other-product comment and the dead check: the comment names only the searches each list's other row matches: for receipts "bETa", "LT-00", 2026-09-15, and "beta" with 2026-09-15; for batches "BT-00", 2026-09-15, and "BT-00" with 2026-09-15. The `not.toContain` after the exact poll is gone, and the poll's message names the other product's row.
- 5 (finding 6), the no-break space: line 189 writes the escape as `\u00a0`.

Frontend reviewer:

- 1, the modified click: see quality 3.
- 2, the repeated line: the `p` in the region is keyed on the parsed address (product, text, date, and rows), so each new address gives the line a new element. The region stays mounted, and the line texts are unchanged. The AC-0027 test searches "zzy" after "zzz" and checks the second "No ... match." is a new element in the same region.

Mutation runs, 2026-11-11. The first two runs each made one scratch edit, and the last two made two, as each line below names. Each run then ran `npm run test:e2e -- list-search -g "AC-0027: a search|with 12 rows|AC-0047: more than|with 55 rows|AC-0016: an address"` (15 tests, the 2 sign-in setup tests among them), then copied the files back; `cmp` found no difference.

- The region rendered only beside a line: 7 failed in 57.7 s, each `Error: the list's status region`: AC-0027 at `list-search.spec.ts:580` and AC-0047 at `:770` with `Received: 0`, and the 12-row test at `:678` with `element(s) not found`.
- The region always there, with the line after it: 10 failed in 1.4 min (AC-0027, the 12-row test, and the 55-row test on each list, and AC-0047), each `Error: the list's status region` with `Received: ""`.
- The line with no key, and the end with no `collapsed` classes: 6 failed in 36.9 s: `the second miss's line is a new element`, `Received: false`, at `:604` (AC-0027), and `at 390 px, the room the empty end takes`, `Received: 8`, at `:686` (the 12-row test).
- Each section's table gap at `space-y-1` in place of `space-y-0`, and `dateOf` in `src/lib/list-search.ts` passing `0099-12-31` through: 6 failed in 42.4 s: `date 0099-12-31`, `Received: "0099-12-31"`, at `:567` (AC-0016), and `at 1280 px, the room the empty end takes`, `Received: 4`, at `:686`.

Gates, 2026-11-11, on `0384302` plus these fixes, uncommitted:

- `npm run typecheck`: pass.
- `npm test`, 15:08 to 15:23: Vitest 58 files and 1,101 tests in 64 s, then Playwright 1,264 passed and 1 failed in 13.6 min. The failure was `look-menu-invoices-ask-alerts.spec.ts:834`, "AC-0021: at 1280x720 with 16 px text", on `/invoices`, which this round does not touch: the draft's "Saved 3 receipts." never showed. In that test the app logged `isOperator failed: An invalid response was received from the upstream server`, and Kong logged `recv() failed (104: Connection reset by peer)` and a 502 for `POST /rest/v1/rpc/check_operator` at 15:19:21.
- That test alone, `npm run test:e2e -- look-menu-invoices-ask-alerts -g "AC-0021: at 1280x720 with 16 px text"`: passed, with the 2 setup tests, in 8.1 s.
- `npm test` again, 15:27 to 15:42: Vitest 58 files and 1,101 tests in 47 s, then Playwright 1,265 passed, none failed or skipped, in 13.9 min.

### Round 3 fixes

One line per sustained finding of `.context/reviews/a5f08fda-ae0d-4d6e-a49d-fb51e365b01a/3-post-gates-*-adjudication.md`, 2026-11-11. Where findings overlap, each names the one repair.

Frontend reviewer:

- 1, an overtaken "Clear search" press stays armed: `ListEnd` in `src/app/list-search.tsx` keeps one armed focus move in a ref, the address key it waits for and what to focus, and only each link's `onNavigate` arms it. `addressKey` builds every key as `JSON.stringify([product, text, date, rows])`: the line key, Clear search's target (the same product with `""`, `null`, and `DEFAULT_ROWS`), and Show 10 more's (the same search at `Math.min(MAX_ROWS, search.rows + STEP)` rows). One effect, on `product` and `search`, takes the move, clears the ref, and runs it only when its key is the key of the page that landed, so the first page to land after a press decides. The row move focuses the row at the count shown at the press, if that row exists; the Clear move focuses the Search box. A new test on each list, "AC-0027: a Clear search press moves focus to the Search box once its page lands, and not when another page lands first", holds the page with no search, presses Search with the boxes unchanged, lets the held request go, then searches with both boxes empty and checks focus stays on the Search button. It then holds a second Clear press for 500 ms, lets it go, and checks focus lands on the Search box. The overview's `src/app` row now says each move runs if the next page to render after the press is the one it opens.

Adversarial reviewer:

- 1, Show 10 more arms from `onClick`: see frontend 1. A new test on each list, "AC-0026: a Cmd or Ctrl press of Show 10 more arms no focus move, so Back to the address it opens leaves focus on the link", searches 25 rows, presses Show 10 more (rows 20), presses Search again with the same boxes (rows 10, a pushed entry), presses Show 10 more with `ControlOrMeta` and closes the tab it opens, then goes back to the rows-20 entry. Row 11 is not focused, and the link is.
- 2, the number-search poll message: see quality 4.
- 3, the round 2 mutation record: its opening line now says the first two runs made one scratch edit each and the last two made two.

Quality engineer:

- 1, `endRoom` and a wrapped status region: before it removes anything, `endRoom` throws "endRoom: the status region's parent does not share a parent with #<list id>, so it is not the whole end under the list" unless the end shares a parent with the list's `ul`.
- 2, `expectKeptListStatus` and a reload: once the line is there, it checks `window.__listStatus` is still set, under "the kept status region is still on window: the page did not reload since keepListStatus", and then keeps its identity check and message.
- 3, `endRoom`'s table flag: `endRoom` returns only the room. The 12-row test reads `headerLineOf`, the list's own `div[aria-hidden='true']` header line just before its `ul`, checks there is one, and checks it is visible at 1280 px and hidden at 390 px.
- 4, the poll message for sales: Recent sales' message is "sales SL-009 to SL-001"; receipts and batches keep "the chosen product's rows, without the other product's row". The asserted rows are unchanged.

Probe, 2026-11-11, a scratch spec deleted after: on each list, the page prefetches the address with no search as `GET <address>?_rsc=<value>` with the headers `RSC: 1` and `Next-Router-Prefetch: 1`. A plain Clear search press then fetches the same address with `RSC: 1`, a different `_rsc` value, and no `Next-Router-Prefetch`. So the prefetch does not serve the page, and the new AC-0027 test holds only that second kind of request. It also checks the prefetch came, that "No ... match." still shows 500 ms after the press, and that the dropped page has not landed 500 ms after its held request goes. The Cmd or Ctrl press opened a new tab each time; the test closes it.

What the tests confirm about `search`: the overtaken press is disarmed only if the effect runs on the page the unchanged Search press lands, whose key equals the page before it. So that page brings a new `search` object. The held press still moves focus after 500 ms of waiting, so nothing gives `ListEnd` a new `search` before its page lands. Mutation 3 below shows the first check fails when the effect runs only on a key change.

Mutation runs, 2026-11-11. Each made one scratch edit to `src/app/list-search.tsx`, ran the tests named, then copied the file back; `cmp` found no difference.

- Show 10 more's `onNavigate` turned back into `onClick`, with the move and its key check unchanged, then `npm run test:e2e -- list-search -g "AC-0026"` (11 tests, the 2 sign-in setup tests among them): 3 failed and 8 passed in 38.6 s. Each failure was the new AC-0026 test: `Error: row 11 is not focused`, `Expected: not focused`, `Received: focused`, at `list-search.spec.ts:750`.
- Clear search's move replaced by the old `clearing` ref, set from `onNavigate`, and the old effect on `[searching, slug]` that clears it only on a render with no search, then `-g "AC-0027"` (8 tests): 3 failed and 5 passed in 33.7 s. Each failure was the new AC-0027 test: `Error: focus stays on the Search button`, `Expected: focused`, `Received: inactive`, at `:667`.
- The effect's dependencies set to `addressKey(product, search.text, search.date, search.rows)` in place of `[product, search]`, then `-g "AC-0027: a Clear search press"` (5 tests): 3 failed and 2 passed in 36.7 s, the same failure at `:667`.

Before the mutation runs, `npm run test:e2e -- list-search -g "AC-0027|AC-0026: a Cmd|with 12 rows|AC-0002, AC-0004"` on the real code: 17 passed in 32.4 s.

Gates, 2026-11-11, on `6857d2d` plus these fixes, uncommitted:

- `npm run typecheck`: pass.
- `npm test`, 16:15 to 16:31: Vitest 58 files and 1,101 tests in 67 s, then Playwright 1,271 passed, none failed or skipped, in 14.4 min. The 6 tests past round 2's 1,265 are the two new tests on each list.
