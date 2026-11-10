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

