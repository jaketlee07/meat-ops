# Verification ledger: home-screen

This ledger holds what only a person, a probe, or a diff read can check for [`spec.md`](../spec.md). Spec-stage review artifacts sit under the ignored `.context/reviews/32902774-9d4e-40fa-94f6-ed9ccf102bcc/`.

## Owner decisions (2026-11-09)

The owner's 2026-11-09 product decisions made before approval are the Product lines in the spec's [Assumptions](../spec.md#assumptions). The two made during post-gates review (the deadlock probe and the screen-reader urgent count) are recorded under Post-gates review below, and the overview's `src/app` row states the resulting behavior; the approved spec stays unchanged in substance.

## Spec-stage review

| Round | Adversarial | Shaping | Security |
| ---: | --- | --- | --- |
| 1 (at `316e196`) | 16 findings: 13 sustained and accepted, 3 refuted | 20 findings, all accepted | 1 finding, sustained and accepted |
| 2 (delta `316e196..f259c79`) | 6 findings: 3 sustained and accepted, 2 refuted, 1 indeterminate settled by the owner | 10 findings, all accepted | Clean |
| 3 (delta `f259c79..0557b56`) | 6 findings: 5 sustained and accepted, 1 refuted | 5 findings, all accepted | Not run (the delta changes no access) |
| 4 (delta `0557b56..b7f80af`) | Not run (three-round cap) | 3 findings, all accepted | Not run (the delta changes no access) |
| 5 (delta `b7f80af..849a685`) | Not run (three-round cap) | 2 findings, all accepted | Not run (the delta changes no access) |
| 6 (delta `849a685..a4329e0`) | Not run (three-round cap) | 2 findings, all accepted | Not run (the delta changes no access) |
| 7 (delta `a4329e0..63984f2`) | Not run (three-round cap) | 3 findings, answered by a change of mechanism | Not run (the delta changes no access) |
| 8 (delta `63984f2..0c088a2`) | Not run (three-round cap) | 2 findings, answered by the owner's call | Not run (the delta changes no access) |
| 9 (delta `0c088a2..1772a08`) | Not run (three-round cap) | 4 findings, all accepted | Not run (the delta changes no access) |
| 10 (delta `1772a08..fd984b1`) | Not run (three-round cap) | 2 Low findings, all accepted | Not run (the delta changes no access) |
| 11 (delta `fd984b1..cfbc843`) | Not run (three-round cap) | 2 Low findings, all accepted | Not run (the delta changes no access) |
| 12 (delta `cfbc843..92d575d`) | Not run (three-round cap) | Clean | Not run (the delta changes no access) |

- Every round 1 finding is draft-origin: each condition was in the draft before review.
- Round 1 refuted (no change from the finding): adversarial 9 (no rule makes the stock value and the list cover the same products), 10 (no rule moved the install file's start), and 15 (the access fixture already gives the operator a row from each view). The owner then chose on 2026-11-09 to count and list an inactive product's stock and to open the installed app on "Today", and the plan's fixture fallback is gone.
- The owner's three round 1 answers (2026-11-09): sign-in and the installed app both open "Today"; an inactive product's stock is counted and listed; the sections run money, alerts, entries, stock. The first corrected an earlier option that put Receiving one press from "Today" on a phone; it is two.
- Round 2 origins: shaping's 10 findings and adversarial findings 1, 3, and the indeterminate one are prior-round-repair (each sits in text round 1's repairs wrote); adversarial finding 2 is draft-origin (the draft already set stock rows directly, and round 1's repair cited a rule that does not exempt it). The repairs close each class: every existing sign-in landing check is listed, every fixture runs through the operations, and every layout check names its data and its box.
- Round 2 refuted (no change): adversarial 4 (AC-0028 holds in every state, the long-value one included) and 6 (a sum over no finished good is 0, and AC-0010 fails a missing figure).
- Round 2's indeterminate adversarial finding asked how `/` reaches the error view. The diff shows round 1 added the error-view Boundary, so it was in scope, and the owner chose on 2026-11-09 a root error file headed "Today" plus a `/sign-in` error file headed "Sign in".
- The security round 2 adjudication was first issued with "None sustained." under its main heading, which the parser refuses; its reissue in the clean-sentence layout is the one kept, and the first sits beside it as `2-pre-execute-security-reviewer-adjudication.invalid-layout.md`.
- Round 3 origins: every finding is prior-round-repair. AC-0016's lbs values drew a finding in rounds 1, 2, and 3 under three wordings, which the rubric reads as a defect in what the clause asked for; it now names one exact value per figure, all produced through the operations by a rolled-back probe. AC-0033 now names its reads and runs in the browser suite, since committed tests already refuse a read by revoking a grant.
- Round 3 refuted (no change from the finding): adversarial 1 (the AC-0034 run can be served by `npm run dev`; the Testing Strategy now names that server anyway, as the true reason for the recorded run).
- Round 4 origins: all three shaping findings are prior-round-repair. The receipts run's revoke of `lots` also refused the stock value view; round 4 answered with a column grant, which round 5 then showed could not isolate the receipts read from `v_alerts`.
- Round 5 origins: both shaping findings are prior-round-repair, from round 4's evidence gap and Fix wording. `v_alerts` reads the same `lots` and `production_batches` columns as the receipts and batches reads, so no grant can fail one of them alone on a loaded page; the repair closes the class by checking each read alone in Vitest (AC-0033) and the error view once in the browser (AC-0035).
- Round 6 origins: both shaping findings are prior-round-repair. One browser run could not show the page passes every read's error through, so AC-0035 runs once per view that only one read uses, and T4 reads the page code for the receipts and batches reads.
- Round 7 origins: all three shaping findings are prior-round-repair, and rounds 3 to 7 each found the read-failure checks short by one more case. The class is closed by a different mechanism instead of more runs: each read throws when refused (AC-0033), a source check finds no failure handler behind `/` (AC-0036), and one browser run shows the error view (AC-0035). The five per-view runs and T4's code read are gone, which makes round 7's findings 1 and 2 moot; finding 3 is answered by AC-0036's place in the Testing Strategy.
- Round 8 origins: both shaping findings are prior-round-repair. AC-0036's list of handler texts missed React's error-boundary methods and an imported boundary, the blocklist shape that diverges. The owner chose on 2026-11-09 to pin where the reads live instead: one awaited `Promise.all` in `page.tsx` with no handler there, and section parts that read nothing. AC-0036 is now a goal-based source read with its own Testing Strategy line.
- Round 9 origins: all four shaping findings are prior-round-repair. A helper wrapped around a read inside the `Promise.all` could still swallow its error, so AC-0036 now allows only bare calls of the reads as the array's elements, an allowlist rather than a list of handler spellings. The Next.js boundary fact now cites the bundled 16.4.2 docs.
- Deletion pass over what review added (AC-0021 to AC-0036): AC-0022, AC-0023, AC-0025, AC-0026, AC-0027, AC-0028, and AC-0031 split a draft criterion one check each; AC-0024 holds the views' grants to hard rule 2; AC-0021, AC-0032, AC-0033, and AC-0035 add failure and empty states the draft lacked; AC-0029, AC-0030, AC-0034, and AC-0036 carry the owner's 2026-11-09 calls. None contradicts a brief Non-goal, every one traces to a task, and none is cut.
- Pre-EXECUTE gates: the adversarial gate ran its three rounds; the security gate ran two rounds and ended clean; the shaping review ran twelve rounds and ended clean. `creative-direction` and `design-review` are not installed (named skip); the comparison page and look E stand in, through AC-0017.

## Approval (2026-11-09)

- The owner approved the spec and the plan on 2026-11-09 at `43514e7`.
- For this build the owner approved stopping the app server that runs from this folder (PIDs 74009 and 74031) and starting it again from the final build when the work is done; running the stack A slot fix when catalog bloat slows the tests; and committing each task on `feat/home-screen`, then pushing and opening one PR.

## T1

- Red run, before the migration existed: `npx vitest run test/home-figures.test.ts` on the local stack failed 6 of 6 tests (AC-0011, AC-0012 twice, AC-0015, AC-0024, and the stock-on-hand check), each because `public.v_daily_sales`, `public.v_stock_value`, or `public.v_stock_on_hand` does not exist. It ran on the working tree over commit `f754448`.

## T2

- Red runs for AC-0036, before the page was restored from its scratch copy: `npx vitest run test/home-reads.test.ts -t "src/app/page.tsx awaits"` failed on a scratch `src/app/page.tsx` that awaits `getTodaySales` on its own line before the `Promise.all` (the checker reported "the elements are not the seven reads, once each" and "getTodaySales is called outside the Promise.all elements"), and failed on a scratch `page.tsx` that wraps `getStockValue` as `keepGoing(getStockValue(supabase))` with `keepGoing` imported from another file (it reported "an element is not a bare call of a read: keepGoing(getStockValue(supabase))"). Neither scratch file held `catch`, `allSettled`, `.then(`, or `use(`. The real `page.tsx` was put back and the suite passes. Each ran on the working tree over commit `47efdb2`.

## T4

Each record below read commit `2c49cb9`, the branch's last commit that changes a file other than those under `docs/specs/home-screen/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. The first set of records read `8d3794b`; the post-gates repairs in `1129b30` and `2c49cb9` re-opened them, and these replace them.

- AC-0017 (2026-11-10): the owner's verdict is "match", the second after a first "match" at `8d3794b` on 2026-11-09. The owner compared `/` at 1280 px, built from `2c49cb9` and seeded on stack A with made-up data in every section through the operations, with the comparison page at revision 1794121141-4df1, its "First screen and alerts" block (version 2 of the private comparison page `https://claude.ai/artifact/96dPaKWRtszS4RMPjdGaCz`). The screen showed $504.00, $2,804.00, $415.82, and $3,219.82 in the four tiles, one margin alert with the screen-reader line "1 urgent alert." and no visible change, four receipts (one voided), two batches (one reversed), three sales (one voided), and three products on hand.
- AC-0019 (2026-11-10): `git diff 2912d09..2c49cb9 -- test/` with no untracked test files. Four existing files changed, each asserted line on AC-0019's list: `test/e2e/auth.spec.ts` (the sign-in landing check and the operator sign-out test's check right after sign-in read `/` and the "Today" heading; AC-0001), `test/e2e/hosting.spec.ts` (the Secure-cookie test's landing reads `/`, AC-0001; the install file's `start_url` is `/`, AC-0029), `test/e2e/states.ts` (`signInThroughForm` waits for `/`, AC-0001), and `test/e2e/shell.spec.ts` (the menus' link lists and Tab lists gain "Today" first, and the desktop walk reads 11 stops instead of 10; AC-0002). The other changed lines are four test titles (two in `auth.spec.ts`, two in `shell.spec.ts`), which assert nothing. `test/e2e/home.spec.ts`, `test/e2e/home-page.ts`, `test/home-figures.test.ts`, and `test/home-reads.test.ts` are new files.
- AC-0034 (2026-11-10): `/sign-in` served by `npm run dev` from the working tree over `091b9d3`, whose `src/` matches `2c49cb9`, with a scratch `throw` in `src/app/sign-in/page.tsx`, loaded in Chromium at 1280 px. It showed a level-1 heading "Sign in", one "Try again" button, no Email field, and the text "Sign in Couldn't load this page. Try again". The dev server was stopped by its PIDs and the throw removed right after the run.

## Post-gates review

Post-gates artifacts sit under the same ignored folder. `experience-reviewer` is not installed (named skip).

| Round | Adversarial | Quality | Security | Frontend |
| ---: | --- | --- | --- | --- |
| 1 (at `fcd3cff`) | 8 findings: 2 Concerns and 4 Nits sustained, 2 refuted | 12 findings: 3 Concerns and 6 Nits sustained, 2 refuted, 1 indeterminate | Clean (its Not checked footer adjudicated clean) | 6 findings: 2 Nits sustained, 4 refuted |
| 2 (delta `fcd3cff..1129b30`) | 5 findings: 1 Blocker, 1 Concern, and 3 Nits sustained | 3 findings: 1 Concern and 2 Nits sustained | Not run (the delta changes no access) | 3 Nits: 1 sustained, 2 refuted |
| 3 (delta `1129b30..2c49cb9`) | 2 Nits, both sustained | 1 Nit, deferred unadjudicated (no mutation intended) | Not run (the delta changes no access) | Clean |

- Round 1 refuted (no change): adversarial 2 and 3 (test strength is the quality lens's call; quality sustained both as its 1 and 3); quality 7 (`numberOf` cannot reach a missing row) and 9 (AC-0035 does not ask for the retry press); frontend 2 (AC-0035 and the owner's error-view call define the view), 3 and 4 (a wrapped value left-aligns by the overview's convention), and 6 (one column is the entries grid's designed response to its width).
- Round 1's indeterminate quality finding asked whether an app read can still run when `test/e2e/home.spec.ts` truncates `products` outside `resetTestData`'s 40P01 retry. No evidence gate catalog exists, so it went to the owner, who chose on 2026-11-09 to probe it and to route both truncates through a retry if any read can overlap. The throwaway probe against the built app found that "Today" sends 20 menu-link prefetch requests in its first 3 seconds; they add about 3 database transactions above the idle drift of 5 per 3 seconds, while one real render of `/receiving` takes 13. Reads can overlap in that window, so both truncates retry on 40P01.
- The owner chose on 2026-11-09 that a screen-reader-only line in "Open alerts" carries the urgent count on "Today", with no visible change, for frontend finding 1.
- The costing reference's stock value paragraph now says a voided sale returns its lbs to stock and the view has no row when the caller sees no lot and no finished good (adversarial finding 4).
- Round 1 fixes, each check seen red on a scratch break and then restored (2026-11-10, working tree over `fcd3cff`): the views rounded to cents failed 4 of `test/home-figures.test.ts`'s tests ("504.00" against "504.0000000"); `v_stock_value` reading `unit_cost` failed the corrected-cost case (raw "1908.0000000" against "2016.0000000"); `src/lib/home.ts` reading `weight_lbs` failed AC-0007 ("800 lbs" against "760.5 lbs"); a `page.tsx` importing a read from another module, and one awaiting the `Promise.all` in a nested function, each failed its own AC-0036 branch. The views were restored from the migration's text with `security_invoker` and their grants intact.
- Round 2 origins: every finding is prior-round-repair except the Blocker, which the pinned T4 rule (plan.md, T4's Tests) raises for any later commit that changes a file outside `docs/specs/home-screen/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`: 1129b30 re-opens the AC-0017, AC-0019, and AC-0034 records, which are re-recorded once the review rounds close, against the branch's last commit that changes a file outside those three paths.
- Round 2 refuted (no change): frontend 2 and 3 (test strength is the quality lens's call; quality sustained the same gap as its finding 1).
- Round 2's three judges first stopped on a network error before reporting; they were dispatched again over the unchanged commit, and only their second reports are kept.
- The overview's Open alerts clause states the screen-reader line and the failure line's error style. The owner's urgent-count decision is recorded here, not in the spec, so the approved spec keeps its baseline.
- Round 2 fixes: with `src/app/page.tsx` passing the watch's `open` count in place of `urgent` (working tree over `1129b30`, 2026-11-10), `npm run -s test:e2e -- test/e2e/home.spec.ts` failed 1 of 30 ("an open alert that is not urgent is listed with no urgent-alert line" found an urgent-alert line); the page was restored. The implementer stopped on a connection error after that run; its full `npm test` finished on its own and passed (Vitest 57 files and 1083 tests, Playwright 1172 tests), and `npm run typecheck` passed after it.
- Round 3 origins: both adversarial Nits are prior-round-repair (round 2's Assumptions line moved the approved spec off its baseline, and round 2's ledger note restated the T4 rule as "code commit"). The spec is restored to its approved text and the ledger states the pinned rule; neither change touches a file outside the three paths, so the T4 records are not re-opened.
- Deferred Nit (quality round 3, `test/e2e/home.spec.ts:191`): the open-but-not-urgent test's second list check repeats the first and does not show that the listed alert is the non-urgent one. Left as it is; the test's other assertion already fails a page that counts open alerts.
- Round 4 (delta `2c49cb9..091b9d3`, adversarial only): 1 Nit, deferred unadjudicated (no mutation intended): the owner-decisions pointer near the top of this ledger says the overview states the resulting behavior of both post-gates decisions, but only the urgent count is app behavior; the probe's 40P01 retry lives in `test/e2e/home-page.ts`.

## Review close and ship (2026-11-10)

- Every warranted reviewer finished with no Blocker or Concern open: security clean in round 1, frontend clean in round 3, quality with one deferred Nit in round 3, and adversarial with one deferred Nit in round 4. `experience-reviewer` is a named skip.
- The review verdict is READY_WITH_RESIDUAL_RISK: 31 sustained findings across the rounds, 29 resolved and 2 deferred Nits, plus two accepted blind spots (Chromium-only rendering, and no run in a real screen reader). The `review-verdict.v1` record is in the pull request.
- The spec is Shipped with all 36 criteria checked, the plan is Done, the brief's Spec map lists `home-screen` as Shipped, and `workspace.toml` moves it to `[ini-002.work].shipped`.

