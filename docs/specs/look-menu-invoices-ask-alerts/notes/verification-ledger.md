# Verification ledger: look-menu-invoices-ask-alerts

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/6afa7cfb-24e3-4db2-a2ef-b7d90a66b760/`.

## Owner decisions (2026-11-05 and 2026-11-06)

The spec's Assumptions record each of these as a Product line:

- Spec 3b covers Menu, Invoices, Ask, and Alerts only; the spec 3a leftovers intent stays a separate small spec.
- On a desktop, Menu reads as a table when it has room, Alerts sets its cards two to a row, Invoices puts its read forms side by side and a draft's photo beside its lines, and Ask keeps its 544 px column.
- The ten spec 3b boards are approved as drawn (canvas revision 1793945225-763f, after the Alerts boards' urgent and other cards were swapped to match the app's rule).
- Save receipts and Discard draft follow the overview's waiting-control rule; the six other buttons that fade by opacity go to `docs/product/intents/look-production-sales-trace-review-nits.md`.
- The photo field's file-selector button keeps its tested look, and the forms keep their status-line space.

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 | 3 Blockers, 6 Concerns, 3 Nits, all accepted | 1 High, 4 Medium, 3 Low, all accepted |
| 2 | 1 Concern and 2 Nits, accepted | 2 Low, accepted |
| 3 | Clean | Clean |

- Two read-only probes informed the plan: `0-probe-shell.spec.ts` (content widths beside the side menu, and a sticky column inside `<main>`) and a throwaway page showing a `<fieldset>` as a size container and a sticky column inside a size container, both in the suite's Chromium.
- Named skips: `creative-direction` and `design-review` are not installed. The security-reviewer did not fire: no auth, session, input, file, or network control changes, and no server action changes.

## Approval (2026-11-06)

- The owner approved the spec and the plan in chat on 2026-11-06, kept AC-0025, and approved the stack A slot fix before each full test run for this build.
- Work-loop run `1f080e1d-0bbe-4bfd-9914-5317f17e399b`. `approve-plan` recorded spec hash `f73c89872d97…` and plan hash `3e8d63a8f2eb…`. The schedule runs T1 to T7 in order.
- Base: `3703c8d` on branch `feat/look-menu-invoices-ask-alerts` in the main folder, on stack A.
