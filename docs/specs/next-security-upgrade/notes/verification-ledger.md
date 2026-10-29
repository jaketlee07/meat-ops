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

## T1: the resolved tree (2026-10-28)

- Resolve: `npm install --package-lock-only "next@^16.4.2" --before=2026-10-20` exited 0 and wrote only `package.json` and `package-lock.json`.
- AC-0001: `git diff 8d3f847 -- package.json` shows one changed line, `"next": "^16.4.0"` to `"next": "^16.4.2"`.
- AC-0002: the field-by-field comparison with `8d3f847`'s lockfile (flattened field paths, one-sided keys and fields shown as absent) printed no top-level difference, no key or field on one side only, and exactly these changes: the root `dependencies.next` to `^16.4.2`; `version` (to 16.4.2), `resolved` (the registry.npmjs.org 16.4.2 tarball), and `integrity` of `node_modules/next` and the nine `node_modules/@next/*` entries; and in `node_modules/next`, `dependencies.@next/env` and the eight `optionalDependencies.@next/swc-*` to `16.4.2` and `optionalDependencies.sharp` to `^0.35.5`.
- AC-0003: `npm view <name> time --json` gives 16.4.2 these publish times, all before 2026-10-20T00:00:00Z: `next` 2026-10-15T20:57:24Z; `@next/env` 20:43:21Z; `@next/swc-darwin-arm64` 20:48:42Z; `@next/swc-darwin-x64` 20:42:24Z; `@next/swc-linux-arm64-gnu` 20:43:24Z; `@next/swc-linux-arm64-musl` 20:42:06Z; `@next/swc-linux-x64-gnu` 20:43:14Z; `@next/swc-linux-x64-musl` 20:44:02Z; `@next/swc-win32-arm64-msvc` 20:42:42Z; `@next/swc-win32-x64-msvc` 20:43:02Z (all on 2026-10-15).
- AC-0004: `npm run audit` exited 0.
- AC-0008: `npm audit --omit=dev --json` printed a report whose `vulnerabilities` object is empty, so it holds no `next` or `@next/` key.

## T2: the installed tree (2026-10-28)

- Install: `npm ci --ignore-scripts` exited 0 (added 190 packages; it took 15 minutes on a slow network), and `node_modules/next/package.json` then read version 16.4.2. Its closing audit summary, which counts dev packages, named one high advisory, in `vite`, a dev-only package outside this spec; `npm run audit` (shipped packages only) stays clean.
- Pre-checks before the gates: the `AGENTS.md` folder check listed no folder; `pg_class` held about 20,000 dead rows and the Realtime slot was about 2,800 transactions behind, so no slot fix was needed.
- AC-0005: `rm -rf .next && npm run build` exited 0 on the first run, and its output named Next.js 16.4.2.
- AC-0006: the first `npm test`, started 16:28 local, ran while the Mac slept with its lid closed on battery until 21:38 (`pmset -g log`). Its Vitest part passed (52 files, 1,039 tests); its browser part had 192 passed and 345 failed before it was stopped by PID, with `refresh_token_already_used` and `refresh_token_not_found` in the app log once the saved sessions outlived the 3,600-second access token. The rerun under `caffeinate -dimsu` with the lid open passed: Vitest 52 files and 1,039 tests, then the browser suite 667 passed in 10.3 minutes.
- AC-0007: `npm run typecheck` exited 0.
- Before the check scripts, ports 3000, 3101, 3105, and 3106 had no listener; the owner stopped another project's dev server that held port 3000.
- AC-0009: `node test/e2e/checks/ac0060-privileged-guard.mjs "$PWD"` exited 0 (`total=27 failed=0`).
- AC-0010: `node test/e2e/checks/ac0063-loopback-only.mjs "$PWD"` exited 0; `npm run start` (port 3105) and `npm run dev` (port 3106) each had one listener, on 127.0.0.1.
- AC-0011: `sh test/e2e/checks/ac0068-env-reload.sh` exited 0; after the reload, GET `/sign-in`, GET `/receiving`, and POST `/receiving` each answered 500 "Server misconfigured." with the marker in no body and not in the dev log, and `.env.local` was removed.

## Post-gates review round 1 repairs (2026-10-28)

- Run times for the T2 commands, all on Node v22.17.0 with the tree at `629f54c`: AC-0005 `npm run build` 8.5 s; AC-0006 the passing `npm test` rerun 11 min 12 s in all (its Vitest part 52 s, its browser part 10.3 min); AC-0009 the privileged-guard check 13.5 s. AC-0007 `npm run typecheck`, AC-0010 the loopback-only check, and AC-0011 the env-reload check were not timed on their first runs, so each ran again at `ed4d5c1` (whose only change from `629f54c` is this ledger) and passed: typecheck 3.3 s, loopback-only 4.8 s (both cases PASS), env-reload 4.3 s (PASS, `.env.local` removed).
- Folder checks: the `AGENTS.md` folder check listed no folder before the first `npm test`, again before the `npm test` rerun (after the stopped run's server and fake model were stopped by PID), again before the three check scripts, and again before these timing reruns.

