# Spec: next-security-upgrade

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the owner's decision of 2026-10-27 to upgrade Next.js on its own branch before the app-hosting spec continues (Assumptions); `AGENTS.md` hard rules and "Build and test commands" (`npm run audit` before merge; stop the app before a build or a test run); the repository `.npmrc`, which keeps `ignore-scripts=true`; the privileged-variable guard, loopback-only listening, and env-reload criteria of [`docs/specs/receiving/spec.md`](../receiving/spec.md), whose check scripts under `test/e2e/checks/` this spec runs again
- **Brief:** none
- **Discovery:** none
- **Contract:** none (no published interface changes)
- **Shape:** integration

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory: it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

Meat Ops runs on Next.js 16.4.2, which fixes three published flaws in 16.4.0:
two critical ones that let an outsider run code on the server
(GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr) and a high one that can crash the
app through server actions (GHSA-p3m5-59mp-jv5r). Only `next` and its nine
`@next/*` packages move, every new version waited at least 7 days after release,
and the app, its tests, its build, and the receiving spec's framework-dependent
guards behave as before.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Dependency manifest and lockfile | Applicable: the upgrade is the change | `package.json`, `package-lock.json` | work-loop | The AC-0001 to AC-0004 and AC-0008 checks | close-work finds `next` at 16.4.2 in the merged lockfile |
| Execution record | Applicable: the checks and gate results need a home outside the contract | `docs/specs/next-security-upgrade/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every check the Testing Strategy routes to it |
| Lifecycle closeout | Applicable: delivered work is recorded when it ships | `docs/lifecycle/next-security-upgrade.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Applicable when the build teaches something that would change a future approach | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |
| Current architecture and agent guidance | Not applicable: neither `docs/architecture/overview.md` nor `AGENTS.md` names a Next.js patch version, and no rule or command changes | none | n/a | n/a | n/a |
| User documentation and release history | Not applicable: no page, label, message, or command changes | none | n/a | n/a | n/a |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Follow the `AGENTS.md` hard rules, and run its folder check before every test run and every build.
- Resolve the new tree with npm's `--before=2026-10-20` cutoff.

### Ask first

- Any change to source, tests, config, or docs outside this spec's folder, `package.json`, and `package-lock.json`, including a code change a failing test seems to call for.
- Picking any `next` version other than 16.4.2.
- Any command that runs a package's install script.

### Never do

- No change to `.npmrc`.
- No `npm install` without `--package-lock-only`, in any folder.
- No `npm ci`, in any folder, other than the npm command `npm ci --ignore-scripts` exactly, with nothing else added to it; a `cd` to the folder before it is allowed.

## Testing Strategy

- **Goal-based checks of the resolved tree, recorded in the verification ledger (AC-0001, AC-0002, AC-0003, AC-0004, AC-0008).** Each is settled from the working `package.json` and `package-lock.json` and from the registry, before anything installs it.
- **Goal-based checks of the installed tree by exit status, recorded in the verification ledger (AC-0005, AC-0006, AC-0007, AC-0009, AC-0010, AC-0011).** No app code changes, so the existing build, suites, typecheck, and the receiving spec's three check scripts are the regression proof that the app and its framework-dependent guards behave as before on 16.4.2.

## Acceptance Criteria

### The resolved tree

- [ ] **AC-0001.** `git diff 8d3f847 -- package.json` shows exactly one changed line: `next` moves from `"^16.4.0"` to `"^16.4.2"`.
- [ ] **AC-0002.** Compared field by field with commit `8d3f847`'s lockfile, `package-lock.json` has the same top-level fields and the same `packages` keys, and the only fields that differ are these: the root entry's `dependencies.next`, now `"^16.4.2"`; the `version`, `resolved`, and `integrity` of `node_modules/next` and of the nine `node_modules/@next/*` entries, each `version` now `16.4.2`; and, in `node_modules/next`, `dependencies.@next/env` and the eight `optionalDependencies.@next/swc-*` values, now `"16.4.2"`, and `optionalDependencies.sharp`, now `"^0.35.5"`.
- [ ] **AC-0003.** For `next` and each of the nine `@next/*` packages, `npm view <name> time --json` gives version 16.4.2 a publish time before `2026-10-20T00:00:00Z`.
- [ ] **AC-0004.** `npm run audit` exits 0.
- [ ] **AC-0008.** `npm audit --omit=dev --json` prints a report whose `vulnerabilities` object has no key that is `next` or starts with `@next/`.

### The installed tree

- [ ] **AC-0005.** With `.next` deleted, the first `npm run build` exits 0.
- [ ] **AC-0006.** `npm test` passes.
- [ ] **AC-0007.** `npm run typecheck` exits 0.
- [ ] **AC-0009.** `node test/e2e/checks/ac0060-privileged-guard.mjs "$PWD"`, the receiving spec's privileged-guard check, exits 0.
- [ ] **AC-0010.** `node test/e2e/checks/ac0063-loopback-only.mjs "$PWD"`, the receiving spec's loopback-only check, exits 0.
- [ ] **AC-0011.** `sh test/e2e/checks/ac0068-env-reload.sh`, the receiving spec's env-reload check, exits 0.

## Follow-ons

- jaketlee07: branch `feat/app-hosting`, whose app-hosting spec is paused until this upgrade merges; that spec decides what its references to `8d3f847` become when it resumes.

## Assumptions

- Product: the owner chose to upgrade Next.js on its own branch first, and to use 16.4.2, which meets the 7-day waiting rule (source: user confirmation 2026-10-27).
- Technical: GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr (critical) and GHSA-p3m5-59mp-jv5r (high) cover Next.js 16.0.0 to 16.4.0 and are first patched in 16.4.1 (source: `gh api /advisories/<id>`, 2026-10-27).
- Technical: Next.js 16.4.1 was published 2026-10-14, 16.4.2 on 2026-10-15, and 16.4.3 on 2026-10-23 (source: `npm view next time`).
- Technical: `npm install --package-lock-only "next@^16.4.2" --before=2026-10-20` changes exactly the lockfile fields AC-0002 lists and nothing else, and leaves `npm audit --omit=dev` with 0 vulnerabilities (source: two scratch resolves of `package.json`, `package-lock.json`, and `.npmrc`, the second compared field by field, 2026-10-27, both deleted).
- Technical: npm 11.4.2 reads an `npm_config_` variable in any letter case, and a `--ignore-scripts` flag on the command outranks it: `npm config get ignore-scripts` prints `false` with `NPM_CONFIG_IGNORE_SCRIPTS=false` set and `true` with that variable and the flag together. The lockfile holds an install script (`fsevents`) (source: probes with npm 11.4.2 in this folder, 2026-10-28, in the verification ledger's Owner decisions; `package-lock.json`).
- Technical: on 16.4.0, a `next build` run by an agent stopped once with `SecurityFatalError` after finishing the build, and the same build run again exited 0 (source: scratch builds, 2026-10-27).
- Technical: the three receiving check scripts exit 0 only when every case passes. `ac0063` starts servers on ports 3105 and 3106 and `ac0068` on 3101; `ac0060` runs `npm run start` and `npm run dev` on the default port 3000, and a `npm run start` case binds that port before the guard in `next.config.ts` runs, so a busy port 3000 fails it (source: `test/e2e/checks/`; `node_modules/next/dist/server/lib/start-server.js`).
- Product: this Mac's main folder, on `feat/app-hosting` with no commits of its own, takes the fix by fast-forwarding that branch to the merge (source: user confirmation 2026-10-28).
- Process: every install runs as `npm ci --ignore-scripts`, in any folder (source: user confirmation 2026-10-28).
- Process: the 7-day `--before` cutoff follows the vitest-upgrade precedent. This folder uses stack A (no `supabase/.env`), and no other folder runs tests or the app while this one does. The owner approves the spec and then the plan in chat (source: `docs/specs/vitest-upgrade/spec.md`; `AGENTS.md`).
