# Verification ledger: home-screen

This ledger holds what only a person, a probe, or a diff read can check for [`spec.md`](../spec.md). Spec-stage review artifacts sit under the ignored `.context/reviews/32902774-9d4e-40fa-94f6-ed9ccf102bcc/`.

## Owner decisions (2026-11-09)

The owner's 2026-11-09 product decisions are the Product lines in the spec's [Assumptions](../spec.md#assumptions).

## Spec-stage review

| Round | Adversarial | Shaping | Security |
| ---: | --- | --- | --- |
| 1 (at `316e196`) | 16 findings: 13 sustained and accepted, 3 refuted | 20 findings, all accepted | 1 finding, sustained and accepted |
| 2 (delta `316e196..f259c79`) | 6 findings: 3 sustained and accepted, 2 refuted, 1 indeterminate settled by the owner | 10 findings, all accepted | Clean |
| 3 (delta `f259c79..0557b56`) | 6 findings: 5 sustained and accepted, 1 refuted | 5 findings, all accepted | Not run (the delta changes no access) |
| 4 (delta `0557b56..b7f80af`) | Not run (three-round cap) | 3 findings, all accepted | Not run (the delta changes no access) |

- Every round 1 finding is draft-origin: each condition was in the draft before review.
- Round 1 refuted (no change from the finding): adversarial 9 (no rule makes the stock value and the list cover the same products), 10 (no rule moved the install file's start), and 15 (the access fixture already gives the operator a row from each view). The owner then chose on 2026-11-09 to count and list an inactive product's stock and to open the installed app on "Today", and the plan's fixture fallback is gone.
- The owner's three round 1 answers (2026-11-09): sign-in and the installed app both open "Today"; an inactive product's stock is counted and listed; the sections run money, alerts, entries, stock. The first corrected an earlier option that put Receiving one press from "Today" on a phone; it is two.
- Round 2 origins: shaping's 10 findings and adversarial findings 1, 3, and the indeterminate one are prior-round-repair (each sits in text round 1's repairs wrote); adversarial finding 2 is draft-origin (the draft already set stock rows directly, and round 1's repair cited a rule that does not exempt it). The repairs close each class: every existing sign-in landing check is listed, every fixture runs through the operations, and every layout check names its data and its box.
- Round 2 refuted (no change): adversarial 4 (AC-0028 holds in every state, the long-value one included) and 6 (a sum over no finished good is 0, and AC-0010 fails a missing figure).
- Round 2's indeterminate adversarial finding asked how `/` reaches the error view. The diff shows round 1 added the error-view Boundary, so it was in scope, and the owner chose on 2026-11-09 a root error file headed "Today" plus a `/sign-in` error file headed "Sign in".
- The security round 2 adjudication was first issued with "None sustained." under its main heading, which the parser refuses; its reissue in the clean-sentence layout is the one kept, and the first sits beside it as `2-pre-execute-security-reviewer-adjudication.invalid-layout.md`.
- Round 3 origins: every finding is prior-round-repair. AC-0016's lbs values drew a finding in rounds 1, 2, and 3 under three wordings, which the rubric reads as a defect in what the clause asked for; it now names one exact value per figure, all produced through the operations by a rolled-back probe. AC-0033 now names its reads and runs in the browser suite, since committed tests already refuse a read by revoking a grant.
- Round 3 refuted (no change from the finding): adversarial 1 (the AC-0034 run can be served by `npm run dev`; the Testing Strategy now names that server anyway, as the true reason for the recorded run).
- Round 4 origins: all three shaping findings are prior-round-repair. The receipts run's revoke of `lots` also refused the stock value view; a column grant now keeps the view readable, which a rolled-back probe confirmed.
