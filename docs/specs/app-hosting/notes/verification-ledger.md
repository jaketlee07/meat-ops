# Verification ledger: app-hosting

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts sit under the ignored `.context/reviews/dc02f06e-d303-4031-ac54-db279a0df45f/`.

## Owner decisions (2026-10-27)

- Round-1 adversarial finding 1 (the desktop install check could pass with no install file) came back indeterminate: the adjudicator could not read the page title or Chrome's install behavior. The page title is "Meat Ops" on every page (`src/app/layout.tsx`, the only metadata export). The owner ruled that the check starts the install from `/production` and the installed app must then launch on `/receiving` with the MO icon, which only a working install file produces (AC-0011 and AC-0015).
- Round-1 adversarial finding 2 (this spec narrows the receiving Host check): the owner chose to state the narrowing in this spec's "Constrained by" line and in the overview, and not to annotate the shipped receiving spec.

## Spec-stage review

| Round | Adversarial | Security | Shaping |
| ---: | --- | --- | --- |
| 1 | 2 Concerns, 7 Nits, 1 indeterminate settled by the owner | 1 Concern, 5 Nits | 3 Medium, 4 Low |
| 2 | 8 Nits | 2 Nits | 1 Medium, 4 Low |
| 3 | 4 Nits | 1 Nit | 2 Low |
| 4 | 1 Nit | 1 Nit | 1 Low |
| 5 | Clean | Clean (footer adjudicated) | 1 Low |
| 6 | Clean | Clean (footer adjudicated) | Clean |

## Paused for the Next.js security upgrade (2026-10-27)

- `npm run audit` reports Next.js 16.0.0 to 16.4.0 critical (GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr) and high (GHSA-p3m5-59mp-jv5r), each first patched in 16.4.1. A scratch `next build` stopped once with `SecurityFatalError` to recommend the upgrade, and a rerun of the same build finished.
- The owner chose to upgrade Next.js on its own branch first. The run stays in `SPEC-PLAN-DRAFTING` with the round-3 repairs applied. On resume: rebase onto the upgrade's merge, move the Never-do pin from `8d3f847` to that merge commit, fire `spec-ready`, and review the delta in round 4.
- 2026-10-28: resumed. The upgrade merged as PR #39 (`d96a997`), and this folder fast-forwarded to it, reinstalled with `npm ci --ignore-scripts`, and rebuilt on Next.js 16.4.2. The spec's and plan's `git diff` pins and the installed-version Assumption moved to `d96a997` and 16.4.2. The round-3 text for the round-4 change list was rebuilt from the round-3 repair command, and every line round 3 added is in it.

## Approval (2026-10-28)

- The owner approved the spec and then the plan in chat on 2026-10-28, after spec-stage round 6 came back clean from all three reviewers.
- Work-loop run `dc02f06e-d303-4031-ac54-db279a0df45f`. `approve-plan` recorded spec hash `5ed313131caf…` and plan hash `6d877eb35af3…`. The schedule runs T1, then T2 and T3, then T4, T5, and T6, one task at a time.
- Base: `d96a997` on branch `feat/app-hosting` in the main folder, on stack A.
- Project knowledge: capture at the spec and plan gates was not attempted; it refused with `strict_parse` in earlier runs, so this run records it as unavailable.

