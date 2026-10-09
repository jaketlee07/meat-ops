# Verification ledger: production

Execution observations, newest last. Each entry names the task, the command, and the observed result.

## Gates before EXECUTE (2026-10-08)

- Pre-EXECUTE reviews closed after five rounds on spec sha256 30c59fa5aec2b69b52ad901cead8dbb691e831dee6e21f7884723566b1bf1b2e and plan sha256 bcacb3a6297960bc110de1a94c78854d42bfb6cd9e2afb9aff9d6a9aac43ae86. Raw and adjudication artifacts, and each round's delta, are under the ignored `.context/reviews/0927fde7-d027-491c-8717-36db3bdd3993/`.
  - adversarial-reviewer: 10, 8, 5, and 3 sustained findings in rounds 1 to 4 (2 refuted in round 1; one round-3 item was an owner decision); round 5 returned 2 Nits, deferred below.
  - security-reviewer: 2 Nits sustained in round 1; adjudicated clean in rounds 2 to 5. Round 5's one finding was refuted as outside the spec and plan (see the network note below).
  - shaping-reviewer: 11, 8, 4, and 3 findings in rounds 1 to 4; Clean in round 5.
- Deferred Nits from adversarial round 5, carried into T6:
  - The AC-0035 forwarder case does not say what the forwarder does with the held call after the 10-second limit (`spec.md` Testing Strategy, `plan.md` T6). In T6 the forwarder never sends a held `produce_batch` call on, so the "no batch was written" count reads the app's only path to the engine.
  - T6's title and Approach step 6 still say "the stopped-service run"; T6's Tests also include the two forwarder cases.
- Probes behind the plan, all on the local stack, 2026-10-08: the PostgREST read shapes; the golden numbers in a rolled-back transaction; the invalid-yield refusal and the shrink stored on a measured batch in a rolled-back transaction; an operator `produce_batch` call against a locked balance row ending after 8.1 seconds with code 57014 and no write. The one batch the read-shape probe wrote (300 raw lbs of 502) is local test data that `npm test` resets.
- Stub validation for T1 to T3 is recorded in the plan's Tasks section.
- Observed, out of scope: the local Supabase stack's Docker ports 54321 to 54324 listen on every interface (`lsof`), and the macOS firewall is off (`socketfilterfw --getglobalstate`). Another device on the same network can reach the local database and Studio. Raised to the owner on 2026-10-08.
- Owner approved the spec, then the plan, in chat on 2026-10-08; `approve-plan` recorded the baseline, `schedule` set six sequential waves (T1 to T6), and `plan check-current --require-schedule` passed after `plan-locked`.
- project-knowledge unavailable: `--capture --producer-profile work-loop --semantic-gate plan-locked --artifact docs/specs/production/plan.md` refused with `staged_dual_writer` (the legacy knowledge base is not migrated). No fallback file was created.

## T1 (2026-10-08)

- Executed by the `implementer` subagent in the primary working tree; controller reran every gate.
- Stub materialized byte-identical at `test/production-rules.test.ts` (sha256 3b4c2046…fb9fb4, matching the plan block); observed red before implementation: "Failed to load url ../src/lib/batch-input.js". The file then grew to 42 cases.
- Controller fix: the implementer's value imports between `src/lib/` modules used `.js` specifiers (`./format.js`, `./number-text.js`), which Turbopack cannot resolve from app code; they are extensionless now, like the app's imports.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 106 s, Vitest 234 passed (15 files), Playwright 76 passed.
- Deviation: an invalid `today` reports under the production date field ("Enter the production date."), because the error map has no `today` field.

## T2 (2026-10-08)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/production-data.test.ts` (sha256 da6de01c…dfbd28 checked before any edit); observed red: "Failed to load url ../src/lib/production.js". The file then grew to 7 cases.
- Read shapes chosen in `src/lib/production.ts`: `listLotsUsed` gives `{ lotNumber, receivedDate, vendorName, lbsDrawn, costPerLb }` in draw order; `getFinishedLot` gives `{ lbsProduced, costPerLb }`; `listRecentBatches` gives `{ batches: { id, batchNumber, productionDate, rawLbsIn, finishedLbsOut, costPerFinishedLb }[], total }`; the product rows carry `shrinkPct` and `raw` as nullable, because the generated types are.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 140 s, Vitest 241 passed (16 files), Playwright 76 passed.

## T3 (2026-10-08)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/save-batch.test.ts` (sha256 9e8ae099…60dd34); observed red: "Failed to load url ../src/app/production/save-batch.js". The file then grew to 11 cases.
- Deviation: `readAfter` takes the read-before result as a third argument, because the batch row does not carry the raw input's id.
- Controller fix: `saveBatch` called `revalidatePath` inside its catch-all, so a throw there after a written batch would have read "The batch wasn't saved."; it now runs after the try, so a written batch never reports as unsaved.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 129 s, Vitest 252 passed (17 files), Playwright 76 passed.

## T4 (2026-10-08)

- Executed by the `implementer` subagent; controller reran every gate.
- Built: the shared header (`src/app/page-header.tsx`, with the Primary navigation) and not-allowed view (`src/app/not-allowed.tsx`), with receiving moved onto both; `/production` with its page, form, check step (native dialog), result panel, and product region; `test/e2e/production.spec.ts` and `test/e2e/production-page.ts`.
- Deviations: two files outside T4's Touches changed, each a direct consequence of the task: `test/e2e/receiving-page.ts` (its tab-walk control list gains the two navigation links) and `src/app/receiving/result-panel.tsx` (`BeforeAfter` is exported so the production result reuses it; nothing on screen changes). The form calls `saveBatch` directly inside a try/catch rather than through `useActionState`, so a rejected call becomes the AC-0035 text. The AC-0010 calendar-date row has no browser case, because a date input cannot hold 2026-02-30 (Playwright's `fill` throws "Malformed value"); the rule is unit-tested in `test/production-rules.test.ts`, and T5 replays a malformed date to the action for AC-0069.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 217 s, Vitest 252 passed (17 files), Playwright 121 passed; no em dashes under `src/` or `test/`; the AC-0064 grep prints nothing.

## T5 (2026-10-08)

- Executed by the `implementer` subagent; controller reran every gate.
- Built: recent batches in the product region (`src/app/production/recent-batches.tsx`), the shared error view `src/app/page-error.tsx` with receiving's and production's error pages on it, and the browser cases for recent batches, refusals, the connection drop, replays, and the reads-after state. The AC-0029/AC-0073 case revokes `authenticated`'s SELECT on `production_batch_lots` after the check step opens and grants exactly that back in `finally` and `afterEach`.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 215 s, Vitest 252 passed (17 files), Playwright 135 passed. After the run, `has_table_privilege('authenticated', 'public.production_batch_lots', 'select')` is true and `'insert'` is false.

## T6 (2026-10-08)

- Docs: `docs/architecture/overview.md` (the `src/lib/` and `src/app/` rows, the `test/` and `test/e2e/` rows, the write path, and the failure notes) and `docs/costing.md` (the suites named in its opening, the rounding sentence covering the check step, the cost-per-lb row's reach to batches, and the Shrink and Raw cost total rows).
- Recorded run, 2026-10-08, against `npm run start` builds of the closing tree: app A on 127.0.0.1:3200 talking to the local stack, and app B on 127.0.0.1:3201 with `SUPABASE_URL` set in its process environment to a throwaway forwarder on 127.0.0.1:54400 in scratch (not committed; `.env` unchanged). Driven by a scratch Playwright spec with the operator's saved session; the 502 fixture was reset before each case. 4 of 4 cases passed in 43 s.
  - REST stopped (`docker stop supabase_rest_meat-ops`) before a page load: the `/production` error page showed "Production", "Couldn't load this page.", and "If you were saving a batch, it may have been saved. Check Recent batches before saving it again." (AC-0077); focus was on the heading (AC-0044); `checkPageState` passed with one control, "button Try again" (AC-0048, AC-0049, AC-0050, AC-0057, AC-0058 for that state). After `docker start`, Try again showed the production form with the same document, no browser reload (AC-0043).
  - REST stopped after a page load, save confirmed: "The batch wasn't saved. Try again in a moment." after 10.5 s (AC-0034), focus on `#batch-message` (AC-0055), every field kept (code 502, raw 2000, finished blank, date 2026-10-06, notes) (AC-0037), 0 batches written.
  - Forwarder dropping the `produce_batch` call: "The batch may not have been saved. Reload this page and check Recent batches before saving again." after 10.5 s (AC-0035), focus on the message, every field kept, 0 batches written; the forwarder never sent the call on (round-5 deferred Nit).
  - Forwarder holding the `produce_batch` call while a `pg` postgres session deleted the operator's `private.operators` row, then releasing it: "The batch wasn't saved. This account isn't allowed to use Meat Ops." (AC-0080), focus on the message, every field kept, 0 batches written (AC-0036's not-allowed case); the row was inserted back and confirmed present.
  - After the run: the REST container is running, the operator row exists, and nothing listens on 3200, 3201, or 54400.
- Goal-based checks on the closing tree: AC-0060 `npm run build` exit 0; AC-0061 `npm test` exit 0 in 207 s, Vitest 252 passed (17 files), Playwright 135 passed; AC-0062 `npm run gen:types` then `git diff --quiet -- src/lib/database.types.ts` exit 0; AC-0063 `npm run typecheck` exit 0; AC-0064, AC-0065, AC-0078, and the three AC-0079 greps each print nothing; AC-0066 `npm audit --omit=dev --audit-level=high` exit 0, "found 0 vulnerabilities".

## Post-gates review, round 1 (2026-10-08)

Reviewed the working tree against HEAD. Raw and adjudication artifacts are under `.context/reviews/0927fde7-d027-491c-8717-36db3bdd3993/` (`1-post-gates-*`). Rendered captures for the frontend review: 32 PNGs of `/production` (product chosen, check step open, after a two-lot save) and `/receiving`, at 480 and 1024 px wide, 600 and 900 px tall, at rest and scrolled; the reviewer inspected all 32 and found no reader-visible failure.

- adversarial-reviewer: 1 Concern sustained (an earlier refusal's field messages, `aria-invalid`, and banner stay after a passing Save opens the check step and after Go back), 3 Nits sustained (the overview's `actions.ts` sentence, the overview's number rule leaving out prices, comments still naming receiving only), 2 refuted.
- security-reviewer: 2 Nits sustained (a write resolving with no row would read "wasn't saved"; two log lines bypass the shared one-line rule).
- frontend-reviewer: the stale-error Blocker (same as the adversarial Concern), 2 Minors sustained (the current-page nav link drops the chosen product's region on both pages, an owner choice; the nav links' 44 px comes from a raw size, not the control token), 2 refuted (page titles, a navigation pending state), 1 indeterminate (a second Escape closing the check step during a save).
- quality-engineer: 5 Nits sustained (the grant restore after a killed run, an owner choice; production importing receiving's display parts; the batch lead sentence spelled three times; stale comments; no same-day tiebreak case), 2 refuted, 1 indeterminate (the same Escape question).
- Escape question settled by probe, 2026-10-08: through the forwarder holding the save, two Escape presses left the check step open with "Saving…" showing (scratch Playwright spec in the suite's Chromium). No change.
- Owner decisions, 2026-10-08: the current-page nav link keeps the product and reloads its region, on both Production and Receiving (approves the receiving form change under Ask first); every `npm test` run re-grants `authenticated`'s SELECT on `production_batch_lots` in `test/global-setup.ts` (approves that grant statement under Ask first).
- Deferred Nit: moving `Facts`, `stock-view`, and `BeforeAfter` out of `src/app/receiving/` into a shared home (quality-engineer; the adversarial adjudication refuted the same point as not required).
- `findings-remain` (seq 26) and `review record` round 1 with 6 fingerprints from the two valid adjudications; the frontend and quality adjudications classified indeterminate on the Escape item, which the probe above settles.

## Fix round 1 (2026-10-08)

- Executed by the `implementer` subagent; controller reran every gate.
- Applied: the passing branch of `evaluate` clears an earlier invalid or refused state before the check step opens, with browser cases for a fixed field and a cleared refusal banner; a write that resolves with no row reads as the AC-0035 text, with a unit case; `logMessage` in `src/lib/failures.ts` carries the one-line, capped rule for every `saveBatch` log line; `NOT_SAVED_BATCH` is exported and used, and the catch-all returns `batchSaveFailureMessage(error, "before-write")`; comments in `format.ts`, `failures.ts`, `caller.ts`, and `form-fields.ts` name their current users; a same-day tiebreak case in `test/production-data.test.ts`; the overview's `src/app/` row names what `actions.ts` runs and covers prices; the nav links size from the control token; both forms request their product region again after the current-page nav link, with a browser case on each page; `test/global-setup.ts` re-grants `authenticated`'s SELECT on `production_batch_lots` when it is missing.
- Mutation check: reversing the `receipt_seq` tiebreak in `listLotsUsed` turned the new same-day case red (1 failed, 7 passed); the code was restored.
- Controller fix: the global-setup grant runs only when the privilege is missing, so a normal run issues no DDL.
- Environment: `npm test` went red at `test/access.test.ts` ("direct writes to ledger tables", 5 s timeout), a file outside the diff. Cause: the local Supabase Realtime replication slot held `catalog_xmin` about 60,000 transactions back, so vacuum could not clear 324,000 dead `pg_class` rows left by repeated test truncates, and each catalog lookup took about 77 ms. With the owner's approval (2026-10-08), the slot's backend was terminated as `supabase_admin` (Realtime created a fresh slot at the current horizon) and `vacuum pg_class` cleared the dead rows; the lookup took 0.75 ms after. The access suite then ran in 1.8 s, down from 10.5 s.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 58 s, Vitest 254 passed (17 files), Playwright 139 passed; no em dashes under `src/`, `test/`, or in the overview.

## Post-gates review, round 2, and fix round 2 (2026-10-08)

- Round 2 over fix round 1: security-reviewer adjudicated clean. quality-engineer, frontend-reviewer, and adversarial-reviewer each sustained the same defect: the current-page nav link re-requested the region only on the first press for a code, because the request key was never cleared, and the browser cases pressed once and asserted only what the page already showed. adversarial-reviewer also sustained that fix round 1 cleared the "may not have been saved" warning on a later passing Save (no owner decision covered it), and three criterion labels that named the wrong production criteria. `findings-remain` (seq 29) and `review record` round 2 with 6 fingerprints.
- Owner decision, 2026-10-08: after a refused or failed save, a later Save that passes the rules clears only the field errors; any message banner, the "may not have been saved" warning included, stays until the next save result replaces it.
- Fix round 2 (controller): both forms clear the request key once the region for the field's code has rendered, so every press asks again and a render still lacking the region cannot loop; `evaluate` clears only an invalid state; the nav cases on both pages press the link twice and seed stock behind the page before each press, so only a fresh render shows the expected figure; a refusal banner and the AC-0035 warning are each checked to stay while the step is open and after Go back; the tiebreak case is labelled AC-0024, the production nav case carries no criterion label, and `format.ts` names each spec's criteria.
- Mutation checks: with the key reset removed from both forms, both nav cases went red at the second press (2 failed); with `evaluate` clearing refused states again, both banner cases went red (2 failed); the code was restored each time.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 68 s, Vitest 254 passed (17 files), Playwright 140 passed.

## Post-gates review, round 3, and fix round 3 (2026-10-08)

- Round 3 over fix round 2: quality-engineer and frontend-reviewer each sustained that a nav press made while the first region request is still loading leaves the region blank for good, because Next drops the pending navigation and the stored request key matches again (quality-engineer also sustained a banner test title that claimed more than it checks). adversarial-reviewer raised whether a Save refused by the browser rules keeps an earlier banner; the adjudication was indeterminate pending the owner.
- Probe before the fix (scratch Playwright spec, held region request): after the second press only 1 request had been made, the region stayed blank, and the URL stayed bare. After the fix: 2 requests, the region showed the fresh 7,800 lbs, and the URL named the product.
- Owner decision, 2026-10-08: an earlier refusal or failure banner also stays beside new field errors after a Save the browser rules refuse; only a save result (refused or saved) changes it.
- Fix round 3 (controller): both forms guard the region request with the URL's own `?product=` (the page's `initialCode`, renamed `urlCode` in fix round 4) instead of a stored key, so a dropped request is asked for again and a render whose URL already names the code cannot loop; the production banner is its own state, set by a refused result and cleared by a saved one; new browser cases on both pages hold the first region request, press again, and check the fresh stock; a new case keeps the AC-0035 warning beside a field error and through the passing Save that follows; the banner test title names only what it checks.
- Mutation checks: with the stored-key guard put back, both held-request cases went red (2 failed); with the banner rendered from the save state again, the new banner case went red (1 failed); the code was restored each time.
- Controller gates: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 75 s, Vitest 254 passed (17 files), Playwright 143 passed.

## Post-gates review, round 4, and fix round 4 (2026-10-08)

- Round 4 over fix round 3: frontend-reviewer sustained that the guard asked again only when the URL had no `?product=`, so a late region answer for another code (type 503, correct to 502 before 503's answer lands) left 502's region blank. quality-engineer raised that no case shows a saved result clearing an earlier banner, and that the prop name `initialCode` hid that it tracks the URL on every render; its adjudication was indeterminate because the controller edited the tree while it ran (on the starting tree both held). adversarial-reviewer sustained that these edits were not yet on record with gates and mutation proof. `findings-remain` (seq 35) and `review record` round 4 with 2 fingerprints.
- Probe before the fix (scratch Playwright spec, held answer for 503): the field read 502, the URL named 503, and the region was blank. After the fix: the region showed 502's 8,000 lbs and the URL named 502; the held nav-press probe still recovered at 7,800 lbs.
- Fix round 4 (controller): both forms ask for the region whenever the field holds a known code the URL's `?product=` does not name (`urlCode === code` returns), so a late answer for another code is asked over; `initialCode` is renamed `urlCode` in both forms and both pages; new browser cases on both pages hold another code's answer, change stock behind the page, release, and check the fresh figure for the field's product; a new production case takes a refusal banner through a later save that succeeds and checks the banner is empty.
- Mutation checks: with the guard returning whenever the URL names any product, both late-answer cases went red (2 failed; a first version of these cases passed against that guard because it read the page before the held answer landed, so stock now changes behind the page first); with `setBanner(null)` removed, the saved-clears-banner case went red (1 failed); the code was restored each time.
- Controller gates on the current tree: `npm run typecheck` exit 0; `npm run build` exit 0; `npm test` exit 0 in 104 s, Vitest 254 passed (17 files), Playwright 146 passed.

## Post-gates review, round 5 (2026-10-08)

- Over fix round 4: adversarial-reviewer, quality-engineer, and frontend-reviewer each returned the exact clean sentinel (structural clean). security-reviewer's last review (round 2, adjudicated clean) covers every security-relevant change; rounds 3 to 5 changed only form state, navigation, and tests. experience-reviewer: named skip (not installed).
- `reviewers-clean` (seq 38) and `review record` round 5, structural clean, from `5-post-gates-adversarial-reviewer-raw.md`. Spec Status Shipped with all 83 live criteria checked; plan Status Done; `lint-spec-status.py` clean; `plan check-current --require-schedule` OK.
- Owner decision, 2026-10-08: the round-4 quality-engineer adjudication, indeterminate because the controller edited the tree while it ran, is accepted as closed. Both of its findings held on the starting tree; fix round 4 fixed both, each fix's case went red when undone, and the round-5 quality-engineer review over the unchanged tree is clean. The controller should have stopped for the owner when that result came back, and did not.
- Deferred Nits: the shared home for `Facts`, `stock-view`, and `BeforeAfter` (post-gates round 1, quality-engineer); T6's title and Approach step 6 still naming "the stopped-service run" (pre-EXECUTE round 5, adversarial-reviewer).

## Completion evidence handoff (2026-10-08)

- Delivery: `docs/specs/production/` (run 0927fde7-d027-491c-8717-36db3bdd3993), branch `feat/production`.
- Accepted outcome and authority: `SYSTEM-SPEC.md` §13 item 3, the spec approved by the owner in chat on 2026-10-08, and the owner decisions recorded above (check step, no low-raw threshold, results after save, recent batches and raw stock, product shrink line, error page batch line, engine reason for unnamed refusals, per-spec waivers, the installable app left out, the recorded forwarder run, the current-page nav link keeping the product on both pages, the test-start grant heal, and banners staying until a save result).
- Implemented scope: `/production` with its form, check step, batch result, recent batches, and error page; the shared header with Primary navigation, not-allowed view, and error view; the production reads, form rules, formats, and save messages in `src/lib/`; the save action with its decisions behind an argument seam. Verification: the T1 to T6 entries and the five review rounds above; closing gates Vitest 254 and Playwright 146; the recorded run of T6.
- Durable outputs: `docs/architecture/overview.md` updated (T6, fix round 1); `docs/costing.md` Rounding note updated (T6); `src/lib/database.types.ts` unchanged (`npm run gen:types` no diff).
- Non-goals and follow-ons: reversing a batch (`docs/product/intents/corrections-consumed-receipts.md`); a low-raw warning (`SYSTEM-SPEC.md` §13 item 7); HTTPS hosting and the installable app (`docs/product/intents/app-https-hosting.md`); the local stack's network exposure (`docs/product/intents/local-stack-network-exposure.md`).
- Unresolved obligations: none in the accepted contract. Dependencies: none.
- Completion-event candidate: the merge of the pull request for `feat/production`.
- Authority facts: source and write authority are the owner's (jaketlee07); nothing here authorizes deletion; `close-work` owns closeout.
