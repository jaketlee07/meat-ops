# Verification ledger: receiving-refinements

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts sit under the ignored `.context/reviews/1b10bd71-9fab-402c-a99f-0fc179f197a2/`.

## Approval (2026-10-20)

- The owner settled three choices in chat on 2026-10-20, recorded in the spec's Assumptions: faded controls fade fill, text, and border instead of opacity; the scorer refuses the AC-0008 effects and leaves clipping and masks as a known limit; one recorded run may stop stack A's REST service for AC-0012.
- The owner approved the spec and then the plan in chat on 2026-10-20, after spec-stage review came back clean.
- Work-loop run `1b10bd71-9fab-402c-a99f-0fc179f197a2`. `approve-plan` recorded spec hash `87d32808a4c8…` and plan hash `3a62c6c357d0…`. The schedule has wave 1 (T1, T3), wave 2 (T2), and wave 3 (T4), run one task at a time.
- Base: `9b37639` on branch `test/receiving-refinements`, on stack A, which only this folder uses.

## Spec-stage review

Four rounds, each after the first over the delta since the previous one:

| Round | Adversarial, adjudicated | Shaping |
| ---: | --- | ---: |
| 1 | 3 Nits sustained | 11 findings |
| 2 | 1 Blocker and 3 Nits sustained | 11 findings |
| 3 | 1 Nit sustained, 1 refuted | 3 findings |
| 4 | direct clean | Clean |

- After round 3, the owner chose one more delta round over approval with the round-3 repairs unreviewed.
- The new-spec item-alignment lint reports 10 references it cannot resolve. Each is another spec's criterion (receiving, production, invoices, and ask-your-data), which the lint reads as this spec's.
- Pre-EXECUTE gates not fired: security-reviewer (no security control changes; the move keeps the caller check and its outcomes, and receiving AC-0044's replay test covers them), frontend pre-flight (the HTML/CSS change is a class swap that keeps every pixel but the ring, per probe #2; frontend-reviewer reviews the diff after the gates). Design-intent review: named skip, `creative-direction` and `design-review` are not installed.

## Probes before the build (2026-10-20)

- **Probe #1:** `test/e2e/a11y.ts` scored each ring with its alpha times the control's opacity, and flagged any filter, blend mode, or ancestor opacity under 1. One `npm run test:e2e` run at `9b37639` had 646 passed and 9 failed in 11.1 minutes. Every failing ring was a control at opacity 0.6 scoring 2.90:1: Save (receiving first-run, production), Save sale, Ask (2), Look it up again, the Ask product buttons, Read text (4), and Read photo (4). No focused control had an ancestor effect. The probe was reverted with `git checkout test/e2e/a11y.ts`.
- **Probe #2:** a scratch page in Chromium (Playwright 1.64) compared a button at opacity 0.6 with the same button faded by color alpha. Inside the filled button, 8,562 pixels differed by 1 color step and 4 glyph-edge pixels by 18 to 20. Inside the outlined button, 7,963 pixels matched and the rest differed by up to 36 at glyph edges. The ring pixel was `rgb(119, 148, 231)` under opacity and `rgb(29, 78, 216)` under the color fade.

## Project knowledge

- Capture not attempted at the spec and plan gates: the store refused captures in earlier sessions (`staged_dual_writer`). Reusable lessons go to the session memory instead.

## T1 (2026-10-20)

- **Stub:** `test/save-receipt.test.ts` is the plan's T1 block, 143 lines. `shasum -a 256` prints `576ea623265efab28e7576a486e8cd3930208375ddfba706fc985e5d469184dc`, the plan's digest.
- **Red:** before any production code, `npx vitest run test/save-receipt.test.ts` exited 1 with `Error: Cannot find module '../src/app/receiving/save-receipt.js' imported from /Users/jakelee/Developer/meat-ops/test/save-receipt.test.ts` (0 tests ran).
- **Green:** after the build, 4 passed (4), stub unchanged.
- **Reuse search:** `sales/save-sale.ts` (`CallerOutcome`, the decision shape) and `receiving/actions.ts`'s own `caller()` adapter were reused. `logMessage` was not used for the after-write line, because the stub's two-line error must reach the log whole, as at base `9b37639`. Stopped at rung 2.
- **Wiring:** `readBeforeWrite` is the `readBefore` dep. `saveReceipt` revalidates only when the state is `saved` with totals. `voidReceipt` revalidates only on `voided`. The wrapper coerces non-string `lotId` and `reason` to `""` before the decision, as the base did. No outer catch was added.
- **AC-0006 mutations**, each made alone in `src/app/receiving/save-receipt.ts`, run with `npx vitest run test/save-receipt.test.ts`, then undone. After M6, `diff` against a copy of the file made before M1 printed nothing, and `git status` shows no stray change.
  - M1 (after-write catch returns `refused("x")`): 1 failed, 3 passed. AC-0001 test, at `expect(result).toEqual({` (received `{ status: "refused", message: "x" }`).
  - M2 (save write catch passes `"before-write"`): 2 failed. AC-0002 and AC-0003 tests, each at `expect(result).toEqual({` (message "The receipt wasn't saved. Try again in a moment.").
  - M3 (void write catch passes `"before-write"`): 1 failed. AC-0004 test, at `expect(result).toEqual({` (message "The receipt wasn't voided. Try again in a moment.").
  - M4 (only the save log line takes `"before-write"`): 2 failed. AC-0002 and AC-0003 tests, each at `expect(lines).toEqual([` (received "saveReceipt failed at before-write: ...").
  - M5 (only the void log line takes `"before-write"`): 1 failed. AC-0004 test, at `expect(lines).toEqual([` (received "voidReceipt failed at before-write: ...").
  - M6 (after-write log text changed to "reading totals failed"): 1 failed. AC-0001 test, at `expect(lines).toEqual([` (the result assertion above it passed).
- **Overview:** the `src/app/` row names `receiving/save-receipt.ts` for `saveReceipt` and `voidReceipt`; the `test/` row lists `save-receipt` among the receiving suites.
- **Gates:** see the lines below.
  - The `AGENTS.md` folder check listed no folder before the run. `npm run typecheck` exited 0.
  - `npm test` exited 0 in 18 minutes 25 seconds (13:10:25 to 13:28:50): Vitest 52 files and 1038 tests passed; Playwright 655 passed (15.0 minutes). No rerun was needed.

## T3 (2026-10-20)

- **Change:** each `aria-disabled:opacity-60` became color-alpha classes. Every `disabled:opacity-60` is untouched (`receipt-form.tsx` line 385 keeps its first). `globals.css` is untouched.
- **AC-0009:** `grep -rn "aria-disabled:opacity" src` printed nothing (exit 1).
- **AC-0010, first command, verbatim:**
  ```
  bg-primary/60 12
  bg-error/60 2
  text-ink/60 5
  border-field-border/60 5
  ```
  **Second command:** printed nothing.
- **The 18 base strings** (`git grep -n "aria-disabled:opacity-60" 9b37639 -- src`), by `file:line` at `9b37639`:
  - Filled `bg-primary`, replaced by `aria-disabled:bg-primary/60` (11 lines): `alerts/alert-card.tsx:71`, `alerts/digest-section.tsx:108`, `ask/ask-panel.tsx:19`, `invoices/read-forms.tsx:27`, `page-error.tsx:38`, `pricing/apply-button.tsx:54`, `production/check-step.tsx:95`, `production/production-form.tsx:376`, `receiving/correct-dialog.tsx:358`, `receiving/receipt-form.tsx:385` (its `disabled:opacity-60` kept), `sales/sale-form.tsx:348`.
  - Filled `bg-error`, replaced by `aria-disabled:bg-error/60` (2 lines): `production/reverse-control.tsx:309`, `sales/void-dialog.tsx:187`.
  - Outlined, replaced by `aria-disabled:text-ink/60 aria-disabled:border-field-border/60` (4 lines): `alerts/alert-card.tsx:100`, `ask/ask-panel.tsx:21`, `production/check-step.tsx:69`, `sales/void-dialog.tsx:147`.
  - `pricing/change-form.tsx:11` (shared `BUTTON`) lost the fade. The filled button's template gained `aria-disabled:bg-primary/60` (12th `bg-primary/60`). The outlined button's template gained `aria-disabled:text-ink/60 aria-disabled:border-field-border/60` (5th outlined pair).
- **Gates:** the folder check listed no folder. `npm run typecheck` exited 0.
  - `npm test` run 1 (13:30:58 to 13:54:32, 23 min 34 s): exit 1. Vitest 52 files and 1038 tests passed. Playwright 654 passed, 1 failed: `receiving.spec.ts:315` (blank-weight refusal page state), axe `document-title: html`. A page with no title is not a fade effect.
  - Run 2 (13:54:41 to 14:03:03): exit 1. Vitest 1 failed of 1038: `test/invoice-data.test.ts` AC-0031 timed out at 5000 ms. Playwright did not start.
  - Run 3 (14:03:14 to 14:12:20): exit 1, the same single Vitest timeout.
  - `npx vitest run test/invoice-data.test.ts` alone fails the same way (31.9 s), and also with the T3 diff stashed (31.7 s). So the timeout is not from T3.
  - Cause found: the local stack's catalog bloat from the local-stack memory note. `pg_class` holds 452,919 dead rows and the Realtime slot `cainophile_yling60b` is 52,949 transactions behind. The owner-approved fix (end the slot backend, `vacuum pg_class`) was not run, because approval is asked each time.
  - The owner approved the fix in chat on 2026-10-20. The controller ran it after the folder check listed no folder: `pg_terminate_backend` on the slot's backend as `supabase_admin`, and Realtime made a new slot (`cainophile_lzknshe5`, 6 transactions behind). Then it vacuumed `pg_class`, `pg_attribute`, `pg_type`, and `pg_depend`, each left with 0 dead rows.
  - Run 4, by the controller after the fix: `npm run typecheck` exited 0. `npm test` exited 0 in 678 s, with Vitest 52 files and 1038 tests passed and Playwright 655 passed (10.5 minutes), `receiving.spec.ts:315` among them. That test's `document-title` failure was seen once, in run 1 under the bloat, and not again.
- **Wave 1 (T1, T3):** green on run 4.

## T2 (2026-10-20)

- **Stub:** `shasum -a 256 test/e2e/focus-ring.spec.ts` printed `2b2ae1ded6914c1b8e66c59842ce61ea8d1a910199bb93eb7c3ce0e4342774e7`, the plan's digest.
- **Red, against `a11y.ts` before the change:** `npm run test:e2e -- test/e2e/focus-ring.spec.ts` exited 1 with 6 failed (and 2 passed, the setup projects). Each failed on its own `toContain` with `Received string: "the page-state checks passed"`.
- **Green, after the change:** the same command exited 0 with 9 passed: the 6 stub tests, and the construction case "AC-0007: a ring on a button whose fill fades by color is drawn at full strength and passes" (returns `["button Save"]`).
- **Problem texts the scorer emits:** "`<label>` ring cannot be scored: the control has filter `<value>`", "...: the control has mix-blend-mode `<value>`", "...: an ancestor `<tag>` has filter `<value>`", "...: an ancestor `<tag>` has mix-blend-mode `<value>`", and "...: an ancestor `<tag>` has opacity `<value>`". The contrast text "outline contrast is X:1, under 3:1" is unchanged.
- **Gates:** the folder check listed no folder. `npm run typecheck` exited 0. `npm test` exited 0 in 16 minutes (14:28:11 to 14:44:11): Vitest 52 files and 1038 tests passed; Playwright 662 passed (13.6 minutes; 655 at T3 plus the 7 new tests). No rerun was needed. It was slower than the 10.5 to 11 minute runs, with no timeout or failure.
- **AC-0011, the nine tests, each shown passed (checkmark) in the saved output:** `receiving.spec.ts` first-run state; `production.spec.ts` AC-0082 and AC-0083; `sales.spec.ts` form with no active finished product; `ask.spec.ts` ask press in flight (status text, and Look it up again); `invoices.spec.ts` AC-0014 text read, text read at 320 px, photo read, photo read at 320 px.

## Stack A catalog fixes (2026-10-20)

- The owner approved, in chat on 2026-10-20, the Realtime-slot fix before each remaining full `npm test` in this build. Each run of it follows the folder check, ends the slot's backend as `supabase_admin`, and vacuums `pg_class`, `pg_attribute`, `pg_type`, and `pg_depend`.
- Fix 2, after T2's gates: `pg_class` had 202,926 dead rows and the slot was 21,222 transactions behind; after it, 0 dead rows and a new slot 5 behind.

## Wave 2 (T2)

- Green on the implementer's T2 run above: `npm run typecheck` exit 0, and `npm test` exit 0 with 1038 Vitest tests and 662 Playwright tests passed, the nine AC-0011 tests among them.
- The controller checked that the first 55 lines of `test/e2e/focus-ring.spec.ts` still hash to the plan's digest `2b2ae1de…`, and that the one added case is the T2 construction case.

## T4 (2026-10-20)

Recorded by the controller with scripts in the ignored `.context/recorded-run/` (`t4-error-page.spec.ts`, `t4-recovery.spec.ts`), against `npm run build` then `npm run start` at `5df95b1`, on stack A. The folder check listed no folder before each run. Port 3000 was taken by another project's dev server (`~/Developer/mobilize/web`), so the app ran on port 3300; it was stopped by its process group each time.

1. The operator signed in through the form and reached `/receiving`.
2. `supabase_rest_meat-ops` was stopped at 19:49:40 UTC. `/receiving` showed the error page, heading "Receiving", with "Couldn't load this page." The app's log line was `isOperator failed: AbortError: This operation was aborted`.
3. Try again was pressed. Its page request (the one with the `RSC` header) was held with `page.route`. The button read "Trying again…" with `aria-disabled="true"`.
4. `checkPageState` passed in that state with the T2 scorer and returned `["button Trying again…"]` (AC-0012).
5. `supabase_rest_meat-ops` was started again, 12.4 seconds after it stopped, and answered.
- Deviation: releasing the held request failed with Playwright's "Route is already handled!", so the script stopped before its own form check. The service was not stopped again. A second script, `t4-recovery.spec.ts`, stopped nothing, signed in, and loaded `/receiving`, and the form showed at 19:51:46 UTC.

## Post-gates review, round 1 (2026-10-20)

Reviewers on `git diff 43e1ffa..30f9deb`, each report adjudicated except the frontend Nit (artifacts under `.context/reviews/1b10bd71-9fab-402c-a99f-0fc179f197a2/1-post-gates-*`):

- adversarial-reviewer: 4 Nits sustained (a construction-case title claimed full strength, the AC-0001 fixture's lot matched its input, the AC-0008 fixtures faded only the direct parent, the overview row did not say where the receipt form rules run); 1 indeterminate, settled by the owner below.
- quality-engineer: 4 Nits sustained (the same AC-0008 and AC-0001 gaps, a see-through ring could not tell multiplied from replaced alpha, and the decision's comment repeated the wrapper's endpoint sentence); the AC-0008 one was lowered from Concern.
- frontend-reviewer: 1 Nit, deferred and not adjudicated. The red fade (`aria-disabled:bg-error/60`, Void sale and Reverse batch) is never scored while faded and focused, since no test runs the page-state checks in those dialog states. It is outside the accepted contract: AC-0011 names its seven states, and a sales or production test change is not in the plan's Touches. The AC-0010 counts and pairing check cover the class.
- Owner decision, in chat on 2026-10-20: the T4 record settles "confirms the form comes back" with one more short stop of stack A's REST service, watching the held Try again retry bring the form back (below).
- Review state: `findings-remain` (seq 18) and `review record` round 1 with 5 fingerprints: the four sustained quality findings and the adversarial adjudication's digest for its owner-settled indeterminate.

### Round 1 fixes

- `test/e2e/focus-ring.spec.ts`, below the 55 pinned lines (still hashing to the plan's digest): the construction case is retitled to what it asserts; a new AC-0007 case gives a faded control a see-through ring (alpha 0.5 at opacity 0.6) and expects "outline contrast is 1.63:1, under 3:1"; three new AC-0008 cases wrap the button's opaque parent in a `section` carrying a filter, a blend mode, or opacity 0.9.
- `test/save-receipt.test.ts`, below the 143 pinned lines (still hashing to the plan's digest): a new AC-0001 case writes a lot whose vendor, date, weight, and cost differ from the form input, and expects the lot's values.
- `src/app/receiving/save-receipt.ts`: the decision's comment states its own order, as the sibling decisions do; the endpoint sentence stays on the wrapper only. No code changed.
- `docs/architecture/overview.md`: the `src/app/` row says `receiving/actions.ts` runs the receipt form rules, the recheck product-list choice, and the product lookup inside its `readBefore` call.
- Each new case is red against the change it guards, each change made alone and undone (the files compared equal to their copies afterwards). The scorer spec ran alone under `.context/recorded-run/focus-ring.config.ts`, with no app:
  - M7, the ancestor check reads only the direct parent: the three new AC-0008 cases failed, 8 passed.
  - M8, the ancestor check stops at the first opaque background: the same three failed, 8 passed.
  - M9, the ring alpha is replaced by the opacity: only the see-through case failed, 10 passed.
  - M10, the saved lot takes the form input: only the new AC-0001 case failed, 4 passed.
- With the fixes, the scorer spec passed 11 of 11 and `test/save-receipt.test.ts` 5 of 5.
- Gates on `1cc119e`, by the controller: catalog fix 3 first (`pg_class` 101,811 dead rows and the slot 11,179 behind, then 0 and 3). `npm run typecheck` exited 0. `npm test` exited 0 in 666 s, with Vitest 52 files and 1039 tests passed and Playwright 666 passed (10.3 minutes).

### T4 run 2, the owner-approved second stop

- The run-1 error came from the script, not the app. In Playwright 1.64, `page.unroute` continues any request its route still holds, so the explicit `continue()` after it met "Route is already handled!". The script now lets that call fail quietly.

- The same `t4-error-page.spec.ts` ran against the build from that `npm test` on port 3300. `supabase_rest_meat-ops` was stopped at 20:34:42 UTC for 11.7 seconds.
- The steps matched run 1. The error page showed "Receiving" and "Couldn't load this page.", and the Try again request was held. The button read "Trying again…" with `aria-disabled="true"`, and `checkPageState` passed with `["button Trying again…"]` (AC-0012).
- With the REST service started again and the held request let go, the error page's own retry brought the form back: the "Product code" field showed within 15 seconds, with no second press and no reload. The run passed (1 of 1, 14.9 s), and the app was stopped by its process group.

## Post-gates review, round 2 (2026-10-20)

Delta reviewers on `git diff 30f9deb..75951f6` (artifacts `2-post-gates-*`):

- quality-engineer: direct clean.
- adversarial-reviewer: 1 Nit sustained. The T4 run-2 lines blamed Next.js for dropping the held request; the Playwright 1.64 source shows `page.unroute` let it go. The ledger now says so (above), and the script's comment matches.
- Review state: `findings-remain` (seq 21) and `review record` round 2 with 1 fingerprint.
