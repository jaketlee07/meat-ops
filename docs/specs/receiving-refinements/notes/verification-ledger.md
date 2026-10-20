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
