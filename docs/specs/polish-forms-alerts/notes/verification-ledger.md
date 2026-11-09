# Verification ledger: polish-forms-alerts

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/66ead429-0279-4602-ad5e-19d0896a98a3/`.

## Owner decisions (2026-11-09)

The owner's 2026-11-09 decisions are the Product lines in the spec's [Assumptions](../spec.md#assumptions).

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 (at `4e7e5d3`) | 16 findings: 10 sustained and accepted, 5 refuted, 1 indeterminate | 12 findings, all accepted |
| 2 (delta `4e7e5d3..dfee0d9`) | 6 findings: 4 sustained and accepted, 2 refuted | 8 findings, all accepted |
| 3 (delta `dfee0d9..a102622`) | 2 findings: 2 sustained and accepted | 4 findings, all accepted |
| 4 (delta `a102622..78c70f3`) | Not run (three-round cap) | 3 findings, all accepted |

- Round 1's indeterminate adversarial finding asked how much room a date box's text keeps once the calendar icon is in place. The throwaway Chromium probes that the spec's probe Assumption records answered it, and the owner chose on 2026-11-09 to proceed to round 2 with them as the evidence.
- Round 1 refuted (no change): finding 5 (keyboard presses fall under AC-0020's unqualified "second press"), 11 (the digest's 45rem width is held by the overview and AC-0029), 13 (the Always-do bullet keeps every role, the empty live regions included), 14 (keeping or removing the shell's unused cap is a build-time choice), and 16 (Receiving and Sales show money at two decimals in their price lines).
- Round 2 refuted (no change): finding 3 (a dialog reopened after a refused request gives AC-0033's Cancel a press with nothing waiting, which the plan now names) and 6 (AC-0031 already covers the keyboard-only test's photo focus step, which T2 now names too). A third throwaway probe, recorded in the spec's probe Assumption, grounds AC-0007's screenshot comparison and AC-0004's scroll-width check.
