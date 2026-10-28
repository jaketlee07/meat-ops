# Verification ledger: next-security-upgrade

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts sit under the ignored `.context/reviews/c9c476fa-6878-4a72-abf1-5879309958e8/`.

## Spec-stage review

| Round | Adversarial | Security | Shaping |
| ---: | --- | --- | --- |
| 1 | 1 Blocker, 2 Concerns, 6 Nits | 2 Concerns, 2 Nits (1 refuted) | 1 High, 2 Medium, 5 Low |
| 2 | 3 Nits, 1 indeterminate settled by the owner | 2 Nits (1 refuted) | 4 Low |
| 3 | 2 Nits | Clean (footer adjudicated) | 2 Low, 2 advisory |
| 4 | 1 indeterminate settled by the owner | 1 indeterminate settled by the owner | Clean |
| 5 | 1 Nit (1 refuted) | Clean (footer adjudicated) | 1 Low, 2 advisory |
| 6 | 2 Concerns, 1 Nit, 1 indeterminate settled by the owner | 2 Nits | 1 Medium, 1 advisory |
| 7 | 1 Nit (changelog label) | Clean (footer adjudicated) | Clean |
| 8 | Clean | not rerun (changelog-only delta) | not rerun (changelog-only delta) |

## Owner decisions

- 2026-10-28: round-2 adversarial finding 1 (how the main folder, on `feat/app-hosting` with no upstream and no commits of its own, picks up the fix) came back indeterminate because the folder's branch is outside the repository text. The owner chose to fast-forward `feat/app-hosting` to the merge.
- 2026-10-28: round-4 adversarial and security finding 1 (the install-script check named only the lower-case `npm_config_ignore_scripts` spelling) came back indeterminate, because npm's config loader is outside the repository. Probe: with npm 11.4.2 in this folder, `npm config get ignore-scripts` prints `true`, and prints `false` with `NPM_CONFIG_IGNORE_SCRIPTS=false`, `npm_config_ignore_scripts=false`, or `Npm_Config_Ignore_Scripts=false` set. The owner chose to require the install command line to be exactly `npm ci`.
- 2026-10-28: rounds 4 to 6 kept finding new gaps in the install-script guard (a lower-case-only name check, then a check and install in separate shells, then a folder clause and a working-directory prefix), most of them from the previous round's repair. Probe: with npm 11.4.2 in this folder, `NPM_CONFIG_IGNORE_SCRIPTS=false npm config get ignore-scripts --ignore-scripts` prints `true`, so a command-line flag outranks an environment override. The owner replaced the guard: every install, in any folder, runs as `npm ci --ignore-scripts`, after a `cd` to the folder when needed. This also settles round-6 adversarial finding 2 (indeterminate: whether a `cd` prefix still counts as the exact line).

## Approval (2026-10-28)

- The owner approved the spec and then the plan in chat on 2026-10-28, after spec-stage review came back clean.
- Work-loop run `c9c476fa-6878-4a72-abf1-5879309958e8`. `approve-plan` recorded spec hash `00f40a76fde5…` and plan hash `5353a8a47178…`. The schedule runs T1 then T2.
- Base: `8d3f847` on branch `chore/next-security-upgrade`, in the worktree `~/Developer/meat-ops-next-upgrade`, on stack A, which no other folder is testing.
- The controller does each task itself rather than dispatching the implementer subagent: T1 is one resolve command and its checks, and T2 runs the gates.
- Project knowledge: capture at the spec and plan gates was not attempted; it refused with `strict_parse` in earlier runs, so this run records it as unavailable.

