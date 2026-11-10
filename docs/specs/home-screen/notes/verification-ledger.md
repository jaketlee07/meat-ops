# Verification ledger: home-screen

This ledger holds what only a person, a probe, or a diff read can check for [`spec.md`](../spec.md). Spec-stage review artifacts sit under the ignored `.context/reviews/32902774-9d4e-40fa-94f6-ed9ccf102bcc/`.

## Owner decisions (2026-11-09)

The owner's 2026-11-09 product decisions are the Product lines in the spec's [Assumptions](../spec.md#assumptions).

## Spec-stage review

| Round | Adversarial | Shaping | Security |
| ---: | --- | --- | --- |
| 1 (at `316e196`) | 16 findings: 13 sustained and accepted, 3 refuted | 20 findings, all accepted | 1 finding, sustained and accepted |

- Every round 1 finding is draft-origin: each condition was in the draft before review.
- Round 1 refuted (no change from the finding): adversarial 9 (no rule makes the stock value and the list cover the same products), 10 (no rule moved the install file's start), and 15 (the access fixture already gives the operator a row from each view). The owner then chose on 2026-11-09 to count and list an inactive product's stock and to open the installed app on "Today", and the plan's fixture fallback is gone.
- The owner's three round 1 answers (2026-11-09): sign-in and the installed app both open "Today"; an inactive product's stock is counted and listed; the sections run money, alerts, entries, stock. The first corrected an earlier option that put Receiving one press from "Today" on a phone; it is two.
