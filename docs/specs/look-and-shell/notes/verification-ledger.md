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
- T3: the implementer's targeted run (`focus-ring.spec.ts` and `shell.spec.ts`) passed 72 of 72 (1.0 min). Its full run stopped in Vitest: `test/invoice-data.test.ts` AC-0031 timed out at 5000 ms, alone too and with T3's changes stashed. Stack A had 481,455 dead `pg_class` rows and its Realtime slot was 184,287 transactions behind, the catalog bloat `docs/product/intents/local-stack-catalog-bloat.md` records.
- Owner decision, in chat on 2026-11-04: a standing approval for this build to run the stack A slot fix before every full run, after the folder check (end the Realtime slot's backend as the local admin, then vacuum `pg_class`). Run 1, 22:15:56 to 22:16:00 UTC: dead `pg_class` rows 481,455 to 0; slot age 192,235 to 3.
- T3, after slot fix run 1: `npm test` passed, Vitest 53 files and 1043 of 1043 (41 s) and Playwright 745 of 745 (10.1 min), on T1 to T4 with T3 uncommitted. No test or app process was left running.

## T5 recorded checks (2026-11-04)

- Owner decision, in chat on 2026-11-04: yes to stopping stack A's REST service briefly for the error-view run, after the folder check showed no other folder running tests or the app.
- Recorded run `.context/recorded-run/look-shell.spec.ts` (ignored), against the built app on `127.0.0.1:3300` with test data only: 1 passed (14.6 s). REST was stopped at 22:35:11 UTC for 11.0 s and started again; the app (PID 39421) was stopped and the data reset afterwards.
- Error view of `/receiving` at 390 px, heading "Receiving": body background `rgb(243, 246, 250)` (AC-0006); `main` background `rgb(255, 255, 255)`, holding the level-1 heading and the only control, Try again, with "Meat Ops" and the "MO" mark before it (AC-0021); Try again's focused outline `rgb(29, 78, 216)` (AC-0017). Each meets its criterion.
- AC-0022: the run captured the five screens, each in its board's drawn state (S1-SignIn with "operator@example.test" typed; S1-NotAllowed; S1-Error; S1-PhoneMenu and S1-Desktop with two open urgent alerts). They sit on the canvas under the spec 1 boards as the "Spec 1 as built" row (canvas version 1793831810-a1da). The owner's verdict, in chat on 2026-11-04: match for all five.
- AC-0023: `npm test` on T1 to T4 with T3 (the T3 run above): Vitest 1043 of 1043, Playwright 745 of 745.
- AC-0024: `git diff 9e3c158 -- test/e2e` read in full, and `git ls-files --others --exclude-standard -- test/e2e` listed nothing. Changed expectations in existing test files, each a header stop: the ten header entries became `...HEADER_STOPS` in the lists of `menu-page.ts`, `receiving-page.ts`, `production-page.ts`, `sales-page.ts`, `trace-page.ts`, and `invoices-page.ts`; `withSeeAlerts` in `alerts-page.ts` inserts after the last header stop; `invoices-page.ts`'s `NAV_CONTROLS` slices through the header stops. Everything else in existing files is an import or a comment. `a11y.ts` gained `checkDesktopWalk` with `checkPageState` unchanged, and `focus-ring.spec.ts` gained one test.

