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
