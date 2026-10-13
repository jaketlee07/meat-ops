# Plan: vitest-upgrade

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** `AGENTS.md` "Build and test commands" and "Run two folders' tests at once"; the runner config `vitest.config.ts`; the run gates in `test/global-setup.ts`, which the runner must still stop on; the module-level pg pool in `test/db.ts`, which each test file ends after its last test and which is why files cannot share a process. Deviation: none; the change is to a manifest, its lockfile, `vitest.config.ts`, and a new repository `.npmrc`.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/<feature>/notes/verification-ledger.md` (or the adopter's
> equivalent). A genuine artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round. Treating them as
> contract is how a review spends a round on prose no gate consumes — the
> measured share is over half the plan's lines. `Grounding` stays *recorded*,
> because a per-task resolution that nobody wrote is not grounding; what it stops
> being is a claim a reviewer holds the plan to.

## Approach

Two tasks. T1 records the base's evidence, swaps the runner, and fixes the
config. T2 proves the new runner on stack A.

1. T1 first saves what only the base can show: its shipped-tree listing and a
   Vitest JSON report from a run on stack A. Then it turns install scripts off
   in `.npmrc`, resolves the new tree in the lockfile alone, audits that
   lockfile and checks its publish dates, and only then runs `npm ci`. It drops
   `poolOptions` from `vitest.config.ts`, commits, and compares two cold builds
   of the committed files, one per lockfile.
2. T2 runs the full suite, the guard refusal, and the overview's network-only
   command on the upgraded runner, and compares the JSON report with the base's.

The riskiest part is resolution: npm 11.4.2 fails when it upgrades Vitest in
place over the 2.1.9 lockfile, so T1 removes Vitest from the lockfile first.

## Constraints

- `AGENTS.md` "Run two folders' tests at once": before each test run on stack A, the check lists no other stack A folder running tests. `meat-ops-invoice` and `meat-ops-sales` share stack A.
- `AGENTS.md` "Build and test commands": stop `npm run dev` and `npm run start` before `npm test` or `npm run build`.
- `AGENTS.md` hard rules 4 and 5: no em dashes in comments or commit messages; commits read `type(scope): description`. This plan's template quote block is not copy.
- The run gates in `test/global-setup.ts` and the checks they call stay unchanged (spec Never do).

## Construction tests

**Integration tests:** none beyond per-task tests.
**Manual verification:** T2, recorded in the ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Maintainer constraint, `vitest.config.ts` comment | T1 | Diff of the comment | The comment states both rules and their reasons |
| Maintainer constraint, `.npmrc` comment | T1 | Diff of the file | The comment meets the spec's Durable Outputs `.npmrc` closeout condition |
| Execution record, `notes/verification-ledger.md` | T1, T2 | Ledger entries for every AC | Every AC has an observation |
| Intent closeout | none | none | close-work |
| Lifecycle closeout | none | none | close-work |
| Reusable learning | none | DECIDE scratch notes | Capture receipt or recorded unavailable |

## Design (LLD)

### Design decisions

- **Vitest 5.0.3.** Every Vitest 5 release clears the base's advisories. 5.0.4
  and several of its parts came out inside the owner's 7-day cutoff, so
  `--before=2026-10-06` resolves 5.0.3. Vitest 4.1.11 also clears them, but npm
  11.4.2 cannot resolve it over this lockfile. Traces to: AC-0001, AC-0003.
- **Isolation stays on.** Dropping `poolOptions` leaves `fileParallelism:
  false` and `pool: "forks"`, so files run one at a time and each in a fresh
  forked process. Vitest 2's `singleFork` re-ran source modules per file;
  Vitest 5's `isolate: false` does not, and the shared pool in `test/db.ts` then
  ends under the next file (101 failures in the probe). Traces to: AC-0006,
  AC-0007.
- **No `vite` line.** npm installs a required peer, and only Yarn needs the
  line. Traces to: AC-0002.
- **Check, then install, with install scripts off.** The audit and the publish
  dates are read from the resolved lockfile alone, before anything installs.
  The repository's `.npmrc` turns install scripts off for every package, so no
  package's install code runs, including a `node-gyp rebuild` that npm adds for
  a package with a `binding.gyp`. Nothing in the tree needs one: `fsevents`, the
  only package flagged, ships its built binary. Traces to: AC-0001, AC-0003,
  AC-0011.
- **Cold builds of the same files.** Tailwind builds its CSS from every text
  file git does not ignore, and Turbopack keeps a build cache in `.next/cache`.
  So the CSS check builds two fresh copies of the files under verification
  with no `.next`, one per lockfile, and the lockfile and its `package.json`
  are the only difference between them. The base's files would not do: Next's
  build type-checks `vitest.config.ts`, and its `poolOptions` fails under
  Vitest 5. Traces to: AC-0012.

### Dependencies & integration

- Vite 8.3.2 arrives as Vitest's peer; it bundles with rolldown 1.2.12, whose
  darwin-arm64 binary comes from an optional dependency. Vite's own `postcss`
  and `lightningcss` nest under `node_modules/vite/node_modules/`, so the
  top-level copies Tailwind uses stay as they are. Traces to: AC-0004,
  AC-0012.
- Tailwind's build does load one changed package: `@jridgewell/sourcemap-codec`
  moves from 1.5.5 to 1.6.0, the one copy that `magic-string` 0.30.21 resolves.
  It is a new lockfile entry, so the cutoff covers it, and the built CSS proves
  it changes no output. Traces to: AC-0003, AC-0012.
- Node 22.17.0 meets Vitest 5's floor of 22.12. Traces to: AC-0008.
- Playwright does not load Vitest, and the helpers it shares with Vitest
  (`test/env.ts`, `test/network.ts`) import nothing from it. Traces to: AC-0008.

### Failure, edge cases & resilience

- If the lock-only commands produce versions other than the probe's, AC-0001,
  AC-0003, AC-0004, and AC-0012 decide; the probe's resolution is not
  itself a criterion.
- If global setup throws, the run must end before any file runs; AC-0009 proves
  this on the real runner with the guard's own refusal.

## Tasks

### T1: Install scripts are off, the lockfile resolves Vitest 5.0.3 under the cutoff with a clean audit, the config typechecks, and the built CSS matches the base's

**Depends on:** none

**Touches:** .npmrc, package.json, package-lock.json, vitest.config.ts, docs/specs/vitest-upgrade/notes/verification-ledger.md

**Tests:** no stub (goal-based check)
- Base evidence, taken before any edit and kept in session scratch: `npm ls --package-lock-only --omit=dev --all`, and a stack A run of `npx vitest run --reporter=json --outputFile=<scratch>/base.json`.
- AC-0001 and AC-0003, on the resolved lockfile with nothing installed: `metadata.vulnerabilities.total` in `npm audit --package-lock-only --json`; and a scratch script that lists the new lockfile entries against `git show 67271dd:package-lock.json` and reads each one's publish time with `npm view <name> time`.
- AC-0011: the line check on the working-tree `.npmrc` before the first `npm ci` on the resolved tree, and on `git show HEAD:.npmrc` after T1's commit. Before each `npm ci` T1 runs, in this folder and in both AC-0012 copies, `npm config get ignore-scripts` there prints `true`.
- AC-0002: `git diff 67271dd -- package.json`.
- AC-0004: `diff` of the base listing and the new one, first lines dropped.
- AC-0006: `npm run typecheck` exit code.
- AC-0012, after T1's commit: two scratch copies from `git archive HEAD`, one with `package.json` and `package-lock.json` replaced by the base's (`git show 67271dd:<file>`); in each, `npm ci`, then `npm run build` with no `.next`, its exit code, and the sha256 of each `.css` file under `.next/static/`.

**Approach:**
- Add `.npmrc` with `ignore-scripts=true` and the comment the spec's Durable Outputs `.npmrc` row requires.
- `npm uninstall vitest --package-lock-only`, then `npm install --package-lock-only --save-dev vitest@^5 --before=2026-10-06`.
- Check AC-0001, AC-0003, and AC-0011; then `npm ci`.
- In `vitest.config.ts`, delete `poolOptions` and rewrite the comment to say files run one at a time because they share one database, each in its own process because `test/db.ts` ends its pool after each file.
- Each scratch build copy gets this folder's `.env`, which the copy deletes after its build.

**Done when:** each T1 `Tests` line has its observation in the ledger.

### T2: On stack A, the upgraded runner passes the base's tests, stops at the guard, and runs the network-only command

**Depends on:** T1

**Touches:** docs/specs/vitest-upgrade/notes/verification-ledger.md

**Tests:** no stub (manual QA)
- AC-0007: `npx vitest run --reporter=json --outputFile=<scratch>/after.json`, compared with `base.json`: the two sets of file paths, relative to the repository root, and each file's count of `assertionResults` with status `passed`.
- AC-0008: `npm test`, its exit code, and the Vitest and Playwright totals.
- AC-0009: `API_URL=http://10.255.255.1:54321 npx vitest run`, its exit code, and its output.
- AC-0010: the two lines from the overview's `Could not read something` bullet, pasted as written and run from the repository root.

**Approach:**
- Run the `AGENTS.md` check before each stack A run, and stop any app in this folder first.

**Done when:** each T2 `Tests` line has its observation in the ledger.

## Rollout

- **Delivery:** one PR. The change is dev-only: the shipped tree is unchanged, and the build's one changed package leaves the built CSS byte-identical. Rollback is a revert and `npm ci`.
- **Deployment sequencing:** `meat-ops-invoice` and `meat-ops-sales` keep Vitest 2.1.9, and install scripts on, until they take this change from `main` and run `npm ci` there.

## Risks

- npm's resolver may still fail or pick different versions; AC-0001 and AC-0003 catch a flagged tree or a package newer than the cutoff before anything installs, and AC-0004 and AC-0012 catch a change to what ships or to the built CSS.
- A later package that needs an install script fails to install or run until the owner allows it.
- A Vitest 5 behavior change that the probe did not exercise could show only on the browser suite's run order or timing; T2's full `npm test` is the check.

## Changelog

- 2026-10-13: initial plan
- 2026-10-13: after review rounds 6 and 7, the `.npmrc` comment's content lives only in the spec's Durable Outputs closeout condition, and the plan cites it
- 2026-10-13: after review round 5, the `npm config get ignore-scripts` check covers every `npm ci` T1 runs, both AC-0012 copies included, and the `.npmrc` comment's content is stated the same way in all four places
- 2026-10-13: after review round 4, AC-0011 reads the `.npmrc` text instead of npm's merged config, and the Never-do requires `npm config get ignore-scripts` to print `true` wherever the resolved tree installs
- 2026-10-13: after review round 3 and the owner's answer, `.npmrc` turns install scripts off repo-wide in place of the extracted-file scan, and the CSS check builds the files under verification once per lockfile
- 2026-10-13: after review round 2 and the owner's answers, the audit and publish dates are checked on the lockfile before anything installs, install code is also checked in the extracted files, the CSS check compares cold builds of the base's files, and AC-0005 is retired as implied by AC-0001
- 2026-10-13: after review round 1 and the owner's answers, the audit bar is zero advisories, the lockfile is checked for install code before `npm ci`, and the built CSS must match the base's; the Tailwind toolchain note names its one changed package
