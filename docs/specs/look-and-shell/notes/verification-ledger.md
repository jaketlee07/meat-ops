# Verification ledger: look-and-shell

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Spec-stage review artifacts sit under the ignored `.context/reviews/d3d80c73-0ac5-45ef-a5f3-98fe10511a4e/`.

## Owner decisions (2026-11-04)

The spec's Assumptions record each of these as a Product line. Two shaped the review rather than the product:

- Round 2 adversarial finding 3 (T5's diff read only committed work) came back indeterminate. The owner chose that the AC-0024 read covers committed and uncommitted changes from the branch point.
- After round 3, the owner chose one more short check round on the round 3 repairs, then approved after round 4 with its two repairs applied and not re-reviewed.

## Spec-stage review

| Round | Adversarial (after adjudication) | Shaping |
| ---: | --- | --- |
| 1 | 4 Concerns and 6 Nits sustained, 7 refuted | 5 gating findings, 2 advisory |
| 2 | 2 Concerns and 3 Nits sustained, 1 indeterminate settled by the owner | 4 Low |
| 3 | 3 Nits sustained | 2 Low, 1 Nit |
| 4 | 2 Nits sustained | 1 Low, advisory (working material) |

- Round 4's three points were all about one plan Design bullet, how wide page content sits beside the side menu. The repair keeps today's centered `max-w-xl` column under 1024 px and caps page content at 34rem, today's 544 px, at desktop width. It changed only that bullet and the plan Changelog, and no reviewer read it.
- Named skips at the pre-EXECUTE gate: the `frontend-engineering` pack is not installed, so the frontend pre-flight is skipped; `creative-direction` and `design-review` are not installed, so the design-intent pass is skipped and the canvas boards stand in (AC-0022). The security-reviewer did not fire: no auth, session, input, or file or network control changes; the phone menu's Sign out calls the existing `signOut` action.

## Approval (2026-11-04)

- The owner approved the spec and the plan in chat on 2026-11-04 and chose to start building.
- Work-loop run `a3e57000-f8a3-4291-8b94-cdc6743c87d1`. `approve-plan` recorded spec hash `e0f95049dae3…` and plan hash `7c8e4e08f224…`. The schedule runs T1, then T2 and T4 (their Touches overlap, so one at a time), then T3, then T5.
- Base: `9e3c158` on branch `feat/look-and-shell` in the main folder, on stack A.
- Project knowledge: capture at the spec and plan gates was not attempted; it refused with `strict_parse` in earlier runs, so this run records it as unavailable.

## Build (2026-11-04)

- T1 (`70c43be`): `npm test` passed, Vitest 1043 of 1043 and Playwright 697 of 697 (9.8 min). The not-allowed AC-0006 test also checks the "Not allowed" heading; `shell.spec.ts` alone then passed 13 of 13.
- T2 (`84e8dc3`): `npm test` passed, Vitest 1043 of 1043 and Playwright 741 of 741 (14.8 min). Existing test files changed only the header's phone Tab stops (`...HEADER_STOPS`), `invoices-page.ts`'s `NAV_CONTROLS` slice, `withSeeAlerts`'s insertion point, and their imports and comments. Four waiting shells the implementer left (each polled a condition that matched itself or never changed) were stopped by PID.
- T4: `npm test` gave Vitest 1043 of 1043 and Playwright 742 of 743 (17.6 min). The one failure was `receiving.spec.ts:315` (axe `document-title` on the refused blank-weight form), a page T4 does not touch; it passed when re-run alone. The same failure is already recorded as a symptom in `docs/product/intents/local-stack-catalog-bloat.md` (2026-10-20). The final gates re-run the full suite.

