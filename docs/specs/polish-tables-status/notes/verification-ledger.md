# Verification ledger: polish-tables-status

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/3ccd507e-876a-4bdb-88ac-ff1452d4608c/`, and the brief's re-review rounds under `.context/reviews/d5521056-36b1-4767-9f0c-2f00ba260239/`.

## Owner decisions (2026-11-08)

The spec's Assumptions record each of these as a Product or Process line:

- The owner accepted the comparison page at revision 1794121141-4df1 unchanged; the business owner gives no input to this work.
- Recent sales keeps the 10 latest-entered sales and lists them by sale date.
- A receipt's Void and Correct sit side by side, with no "More" button.
- Recent receipts and Recent sales stack the date over the lot or sale number, and the shipped receipt and sale table tests change their header-name, column, one-line, and one-top checks to match.
- "No list price yet" is quiet gray text, not a tag; a voided row is not dimmed.
- Menu's "Sellable only" filter stays a checkbox drawn as a switch.
- The sale trace restyles `Facts`' `card` and `plain` looks in place.

## Spec-stage review

| Round | Adversarial | Shaping |
| ---: | --- | --- |
| 1 | 16 sustained, all accepted | Findings, accepted |
| 2 | 3 sustained, accepted | Findings, accepted |
| 3 | 2 sustained, settled by owner rulings | Findings, accepted |
| 4 to 8 | Not run (three-round cap) | Rounds 4 to 7 Findings, accepted; round 8 Clean |

- Pre-EXECUTE gates: no adversarial or security gate fires, since the spec is unchanged since its review and makes no structural or security-boundary change. `creative-direction` and `design-review` are not installed (named skip). `frontend-engineering` is loaded but its pre-flight does not apply: the pages are existing surfaces with a grounded aesthetic reference (look E's tokens and the comparison page); its craft rules on tokens, focus, motion, and contrast go into each implementer brief.

## Approval (2026-11-08)

- The owner approved the spec and the plan on 2026-11-08 (PR #57, merged as `3c70d69`) and chose to start building.
- Work-loop run `367f4c59-c167-4a1f-900c-43bbdbe960dd`. `approve-plan` recorded spec hash `89e087a3e0d1…` and plan hash `ebc87b94a035…`. The schedule runs T1, T3, T2, T4, then T5.
- Base: `3c70d69` on branch `feat/polish-tables-status` in the main folder, on stack A.
- On 2026-11-08 the owner approved, for this build, stopping the app server that had run from this folder since 2026-11-07 17:36 (PID 70046) and starting it again when the build is done; running the stack A slot fix before each full test run; and committing each task on this branch, then opening one PR.
