# Plan: next-security-upgrade

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** none, non-structural. As in `docs/specs/vitest-upgrade/plan.md`, the tree is resolved with a cutoff and checked from the lockfile before anything installs it; the gates are the `AGENTS.md` commands and the receiving spec's check scripts. Uncertainty: none after the scratch resolves in the spec's Assumptions

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/next-security-upgrade/notes/verification-ledger.md`. A genuine
> artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

Two tasks. T1 resolves the new tree with npm's 7-day cutoff, writing only
`package.json` and `package-lock.json`, and checks it from those files before
anything installs it. T2 installs with `npm ci --ignore-scripts`, builds from an empty `.next`,
and runs the full gates
and the receiving spec's three check scripts. No source, test, or config file
changes. The riskiest part is a behavior change inside a patch release that only
the suites or the check scripts would catch; the scratch resolves showed no other
package moves.

## Constraints

- `AGENTS.md` hard rules 5 (commit format) and 6 (`npm test` after the change), and "Build and test commands" (`npm run audit` before merge; stop the app before a build or a test run; the folder check before a test run).
- The spec's Never do.

## Construction tests

**Integration tests:** none beyond per-task tests.
**Regression gates:** T2's build, `npm test`, `npm run typecheck`, and the three check scripts, after the folder check.
**Manual verification:** none beyond the ledger's command records.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Dependency manifest and lockfile | T1 | The AC-0001 to AC-0004 and AC-0008 checks | `next` at 16.4.2 in the merged lockfile |
| Execution record: `notes/verification-ledger.md` | T1, T2 | Command and gate entries | The ledger holds each |
| Lifecycle closeout and reusable learning | none | none | close-work and the work-loop capture gates |

## Tasks

### T1: The tree resolves to Next.js 16.4.2 under the cutoff, checked before install

**Depends on:** none
**Touches:** `package.json`, `package-lock.json`, `docs/specs/next-security-upgrade/notes/verification-ledger.md`

**Tests:**
- no stub (goal-based), all on the working files the resolve writes, before anything installs them: AC-0001 by `git diff 8d3f847 -- package.json`.
- AC-0002 by a Python script that loads `git show 8d3f847:package-lock.json` and the working lockfile, flattens each `packages` entry to dotted field paths, and prints every top-level field that differs, every `packages` key on one side only, every field path present in only one of two matching entries (the missing side shown as absent), and every field path whose value differs with its old and new value; the ledger holds that output beside AC-0002's list.
- AC-0003 by `npm view <name> time --json` for each of the ten packages, reading the `16.4.2` publish time.
- AC-0004 by `npm run audit` (exit status) and AC-0008 by `npm audit --omit=dev --json` (a report with a `vulnerabilities` object, a missing one counting as a failure, and no key in it equal to `next` or starting with `@next/`), both reading the lockfile.

**Approach:**
- Run `npm install --package-lock-only "next@^16.4.2" --before=2026-10-20`, then the checks.

**Done when:** each T1 check gives the result its criterion names, recorded in the ledger.

### T2: The installed tree builds and passes every gate and check script

**Depends on:** T1
**Touches:** `docs/specs/next-security-upgrade/notes/verification-ledger.md`

**Tests:**
- no stub (goal-based): `npm ci --ignore-scripts` exits 0 and `node_modules/next/package.json` then reads version 16.4.2, both recorded in the ledger before any later T2 command runs.
- AC-0005 by `rm -rf .next && npm run build`; AC-0006 by `npm test`; AC-0007 by `npm run typecheck`; AC-0009, AC-0010, and AC-0011 by the three commands those criteria name, each run with no other app in this folder.

**Approach:**
- Run the folder check, start stack A with `supabase start` if it is down, and make the `.env` with the `AGENTS.md` command if it is missing; then `npm ci --ignore-scripts` and the gates in the order listed, so the build `npm test` makes is the last one before the check scripts rebuild.

**Done when:** each T2 command gives the result its criterion names, and the ledger records each with its count where it has one and its run time.

## Rollout

- **Delivery:** a merge to `main`. Each folder that runs the app stops it, brings in the merge, runs `npm ci --ignore-scripts`, rebuilds with `rm -rf .next && npm run build`, and starts it again, the stop-and-rebuild order `AGENTS.md` gives, so no running server or old `.next` keeps 16.4.0. This Mac's main folder is on `feat/app-hosting` with no commits of its own, so it brings in the merge with `git fetch origin && git merge --ff-only origin/main` rather than a pull.
- **Infrastructure and external systems:** none.
- **Rollback:** revert the PR, then the same stop, `npm ci --ignore-scripts`, rebuild, and start. A rollback below 16.4.1 brings the flaws back, so it needs the owner's approval.

## Risks

- A patch release can still change behavior a browser test or a check script depends on. A red result stops the work, and any code change it seems to call for is an Ask-first item.
- The check scripts use ports 3000 (`ac0060`), 3101 (`ac0068`), and 3105 and 3106 (`ac0063`); a leftover server on one of them can make a script fail, so check those ports first and stop a leftover by PID.

## Changelog

- 2026-10-27: initial plan.
- 2026-10-27: round-1 review repairs: AC-0002 lists every changed lockfile field and its check compares field by field; the lockfile is checked before `npm ci`, which needs npm's effective `ignore-scripts` to print `true`; the audit split into AC-0004 and AC-0008; the receiving spec's three check scripts run on 16.4.2 (AC-0009 to AC-0011); the rollout rebuilds and restarts each running app.
- 2026-10-28: round-2 review repairs: the install-script rule also bars an override on the install command; AC-0008 matches keys by the `@next/` prefix; the field comparison prints one-sided fields; the main folder fast-forwards to the merge; the check scripts' ports corrected.
- 2026-10-28: round-3 review repairs: AC-0008 needs a report with a `vulnerabilities` object; T2 records the `npm ci` command line; the follow-on leaves the app-hosting pin to that spec; the `ac0060` port note states the bind-first order for `npm run start`.
- 2026-10-28: round-4 owner ruling: the install command line is exactly `npm ci`.
- 2026-10-28: round-5 repair: the Never do names the one exact line that checks the setting and installs in the same shell.
- 2026-10-28: round-6 owner ruling: every install, in any folder, is `npm ci --ignore-scripts`.
- 2026-10-28: round-6 review repairs: T2's install must exit 0 and leave `next` 16.4.2 installed before the gates run; the round-5 Assumption crediting the owner is replaced by the recorded ruling.
