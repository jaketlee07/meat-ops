# Spec: vitest-upgrade

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`docs/product/intents/vitest-advisory-upgrade.md`](../../product/intents/vitest-advisory-upgrade.md) (the outcome and its boundary); the test harness's run gates in `test/global-setup.ts`, which run the localhost guard from [foundation-hardening](../foundation-hardening/spec.md), the own-stack check from [parallel-builds](../parallel-builds/spec.md), and the network check from [local-ports](../local-ports/spec.md) before any test; `AGENTS.md` "Build and test commands" (stop the app before a test run or a build) and "Run two folders' tests at once" (one folder per stack runs tests at a time)
- **Brief:** none
- **Discovery:** none
- **Contract:** none (a dev-only test runner upgrade; no published interface)
- **Shape:** integration

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory — it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

This spec delivers the outcome and boundary of the
[Vitest advisory intent](../../product/intents/vitest-advisory-upgrade.md).
It adds these choices to them:

- The suites run on Vitest 5.0.3, resolved under npm's `--before=2026-10-06`
  cutoff, so every package the upgrade adds or changes had been public for at
  least a week.
- The audit with dev dependencies included reports no advisory at all, not only
  none of the intent's six.
- No package's install code runs in this repository: its npm config turns
  install scripts off.
- The tree the app ships is the same package for package, and the upgrade
  alone leaves the CSS the app's build writes the same byte for byte.
- Test files still run one at a time, each in its own process, so no file sees
  another file's database connections.
- The run gates in `test/global-setup.ts` still stop a run before any test.
- The network-only command in `docs/architecture/overview.md` still runs the
  network tests alone.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Maintainer constraint | Vitest's own migration guide suggests the one setting (`isolate: false`) that breaks these suites; the next person to touch the config needs the reason at the setting | The comment in `vitest.config.ts` | jaketlee07 | Diff of the comment | The comment says test files run one at a time, each in its own process, and why both hold |
| Maintainer constraint | Install scripts are off for every package in this repository; the next person who adds a package that needs one needs the reason at the setting | The comment in `.npmrc` | jaketlee07 | Diff of the file | The comment says no package's install code runs, that `pre` and `post` scripts around `npm run` are skipped too, and that the owner allows one package's install script with `npm rebuild <package> --ignore-scripts=false`, run again after each `npm ci` |
| Execution record | Audit output, lockfile checks, build digests, run counts, and the refusal run need a home outside the contract | `docs/specs/vitest-upgrade/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every AC observation |
| Intent closeout | The intent and its backlog entry close when this ships | `docs/product/intents/vitest-advisory-upgrade.md`, `workspace.toml` `[backlog]` | close-work | none | close-work records the intent as delivered by this spec |
| Lifecycle closeout | Delivered work is recorded when it ships | `docs/lifecycle/vitest-upgrade.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Vitest 4 and later share modules across files under `isolate: false`; npm 11.4.2 cannot resolve Vitest 4.1.11; `npm install --before` holds every new package to a cutoff date | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |

The architecture overview needs no change: its `test/` row and its
network-only command name no Vitest version or setting this upgrade changes.
Vitest's Node floor needs no document either: its `engines` field makes
`npm ci` warn `EBADENGINE` on a Node older than 22.12.

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Resolve the new tree with npm's `--before=2026-10-06` cutoff.
- Keep test files running one at a time (`fileParallelism: false`).

### Ask first

- Any change under `test/` or `src/`.
- Any `supabase db reset` on stack A.
- Any Vitest setting beyond dropping `poolOptions`, such as `clearMocks: false`.
- Any change to an acceptance criterion or to the cutoff, including one AC-0001 needs because no tree that meets the other criteria clears the audit; the tree changes only after the spec amendment.
- Any install that runs a package's install scripts.

### Never do

- Add a new top-level directory.
- Turn off test-file isolation (`isolate: false`).
- Change, skip, or bypass the localhost guard, the own-stack check, or the network check.
- Install with `--force` or `--legacy-peer-deps`.
- Run `npm ci`, or `npm install` without `--package-lock-only`, on the resolved tree before AC-0001, AC-0003, and AC-0011 hold, or where `npm config get ignore-scripts` prints anything but `true`.

## Testing Strategy

- **Goal-based check (AC-0001, AC-0002, AC-0003, AC-0004, AC-0006, AC-0011,
  AC-0012)**: the audit, the manifest diff, the publish dates of new lockfile
  entries, the shipped-tree listing, `npm run typecheck`, the lines of
  `.npmrc`, and the digests of the built CSS each answer from command output or
  exit codes, recorded in the ledger. No logic changes, so
  there is nothing for a unit test to pin.
- **Manual QA on the real runner and stack A, recorded in the ledger (AC-0007,
  AC-0008, AC-0009, AC-0010)**: only a real run shows which tests the new runner
  collects and passes, whether a refusal in global setup still stops it, and
  whether the overview's command still works. The golden costing suites,
  `test/costing.test.ts` and `test/pricing.test.ts`, are two of the files
  AC-0007 compares.

Stub tally: no stubs; both tasks record `no stub (goal-based check)` or
`no stub (manual QA)`.

## Acceptance Criteria

Definitions used by these criteria:

- **The base**: commit `67271dd` on `main`, where `package.json` names `vitest` `^2.1.0` and the lockfile resolves 2.1.9.
- **New lockfile entry**: a `packages` key in `package-lock.json` that the base's lockfile lacks, or whose `version` differs from the base's.
- **Stack A**: as `AGENTS.md` defines it, the local stack of project `meat-ops`.
- **CSS digests** of a lockfile: the set of sha256 digests of the `.css` files under `.next/static/` in a fresh copy of the files under verification (`git archive HEAD`) with that lockfile and its `package.json` in place and no `.next` folder, after `npm ci` and an `npm run build` that exits 0. The base's lockfile and `package.json` are the ones at the base.

- [ ] **AC-0001.** `npm audit --package-lock-only --json`, with dev dependencies included, completes with a report whose `metadata.vulnerabilities.total` is 0.
- [ ] **AC-0002.** The only difference between the base's `package.json` and the one under verification is the value of `devDependencies.vitest`, which reads `^5.0.3`.
- [ ] **AC-0003.** Every new lockfile entry has a version whose publish time in `npm view <name> time` is before 2026-10-06T00:00:00Z.
- [ ] **AC-0004.** `npm ls --package-lock-only --omit=dev --all` prints the same lines below its first line at the base and under verification.
- [ ] **AC-0006.** `npm run typecheck` exits 0.
- [ ] **AC-0007.** On stack A, Vitest's JSON report under verification and the base's JSON report from a stack A run list the same test files, keyed by path from the repository root, each with the same number of passed tests.
- [ ] **AC-0008.** On stack A, with the block that `docs/architecture/overview.md` `Keep the local stack on this Mac` describes on, `npm test` exits 0.
- [ ] **AC-0009.** With `API_URL=http://10.255.255.1:54321` in its environment, `npx vitest run` stops at the guard's `API_URL host is not local` refusal with a non-zero exit, before any test runs.
- [ ] **AC-0010.** The network-only command in `docs/architecture/overview.md` (`Keep the local stack on this Mac`, the `Could not read something` bullet), run as written from the repository root, exits 0 after running only `test/network.test.ts`.
- [ ] **AC-0011.** The `.npmrc` at the repository root has exactly one line that is neither blank nor a comment (starting with `#` or `;`), and that line is `ignore-scripts=true`.
- [ ] **AC-0012.** The CSS digests of the lockfile under verification equal the CSS digests of the base's lockfile.

## Retired identifiers

- AC-0005

## Follow-ons

None.

## Assumptions

- Technical: at the base, `npm audit` flags six packages (`vitest`, `@vitest/mocker`, `tinypool`, `vite`, `vite-node`, `esbuild`), 2 critical, 1 high, and 3 moderate by package, under eight advisory ids (GHSA-5xrq-8626-4rwp, GHSA-82fw-gwwq-j7x9, GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr, GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff, GHSA-67mh-4wv8-2f99); `npm run audit` finds 0 (source: probe 2026-10-13)
- Technical: `npm uninstall vitest --package-lock-only` then `npm install --package-lock-only --save-dev vitest@^5 --before=2026-10-06` resolves Vitest 5.0.3 and Vite 8.3.2, writes `^5.0.3`, and leaves `npm audit` and `npm run audit` at 0; a direct install over the 2.1.9 lockfile fails with an npm resolver error (source: scratch probes 2026-10-13)
- Technical: that resolution changes 11 lockfile entries, removes 69, and adds 45, none outside the dev tree; `npm ls --package-lock-only --omit=dev --all` prints the same tree before and after; no new or changed entry has an install script (source: lockfile diff 2026-10-13)
- Technical: the resolution moves `@jridgewell/sourcemap-codec` from 1.5.5 to 1.6.0, and Tailwind's build loads it through `magic-string` 0.30.21; Tailwind scans every text file git does not ignore, so docs can change the CSS (source: lockfile diff 2026-10-13; `src/app/globals.css`)
- Technical: a cold build of the base's files with the resolved lockfile fails Next's type check on `vitest.config.ts` `poolOptions` (TS2769, exit 1); cold builds of the base's files with the planned `vitest.config.ts`, one per lockfile, both exit 0 and write one CSS file with sha256 `231258fcd821d73f5c0b258622c08ee998d789a222c7c6bcf7d345023448f6b5` (source: probes 2026-10-13)
- Technical: `npm audit --package-lock-only` reports total 0 on the resolved lockfile with nothing installed; the base lockfile flags `hasInstallScript` on `esbuild` 0.21.5 and `fsevents` 2.3.3, and the resolved lockfile on `fsevents` 2.3.3 alone, which ships a built `fsevents.node` and no `binding.gyp` or install script; npm 11.4.2 runs `node-gyp rebuild` for an extracted package with a `binding.gyp` and no install script (source: probes 2026-10-13; `npm pack fsevents@2.3.3 --dry-run`; `@npmcli/arborist` 9.1.2 `lib/arborist/rebuild.js`)
- Technical: with `ignore-scripts=true` in the repository's `.npmrc`, `npm ci`, `npm run typecheck`, and a Vitest run all work on the resolved tree, `fsevents.node` and rolldown's darwin-arm64 binary in place; a dependency's install script and a `pretest` script do not run, and `npm rebuild <package> --ignore-scripts=false` runs that package's install script; `npm config get` ignores `--location` and prints the value merged from every config layer, environment included (source: probes 2026-10-13; npm 11.4.2 `lib/commands/config.js`)
- Technical: Vitest 5 needs Node 22.12 or later and Vite 6.4 or later as a peer that npm installs; this Mac runs Node 22.17.0, and no `.nvmrc`, `engines` field, or CI file pins Node (source: <https://github.com/vitest-dev/vitest/blob/v5.0.3/docs/guide/migration/index.md>, `npm view vitest@5.0.3 engines`, `node -v`)
- Technical: Vitest 4 removed `poolOptions`; under Vitest 5, `npm run typecheck` fails on it (TS2769) and the runner ignores it with a warning (source: <https://github.com/vitest-dev/vitest/blob/v4.1.11/docs/guide/migration.md> "Pool Rework"; probe 2026-10-13)
- Technical: with `poolOptions` dropped and `fileParallelism: false` and `pool: "forks"` kept, the typecheck passes and Vitest 5.0.3 passes 410 tests in 25 files in 32 s, the base's count and time (source: probes 2026-10-13)
- Technical: the guide's replacement for `singleFork`, `maxWorkers: 1, isolate: false`, fails 101 of 410 tests with "Cannot use a pool after calling end on the pool": `test/db.ts` ends its module-level pool after each file (source: probe 2026-10-13)
- Technical: under Vitest 5 with a non-local `API_URL`, the run stops at `test/global-setup.ts:16` with exit 1 and no test run; the overview's network-only command runs 39 tests in `test/network.test.ts` alone (source: probes 2026-10-13)
- Technical: the suites use no API that Vitest 3, 4, or 5 removed or changed in a way that fails them: no options object as a third argument, no `test.sequential`, no `toThrow("")`, no worker ids, no reporter files, no `vitest/*` import besides `vitest/config`; one spy, restored after each test (source: `grep` over `test/` 2026-10-13)
- Technical: npm 11.4.2 cannot resolve Vitest 4.1.11 over this lockfile (`Cannot read properties of null (reading 'edgesOut')`) (source: probe 2026-10-13)
- Technical: stack A holds this branch's six migrations, and the other worktrees on stack A have the same six files (source: `supabase_migrations.schema_migrations` and `ls`, 2026-10-13)
- Product: Vitest 5.0.3 under an npm `--before=2026-10-06` cutoff, so every new package had been public at least 7 days (source: user confirmation 2026-10-13)
- Product: `package.json` changes only the `vitest` line; npm installs Vite as Vitest's peer (source: user confirmation 2026-10-13)
- Product: the dev-inclusive audit must report zero advisories of any level; install scripts are off for every package in this repository through its `.npmrc`; the CSS check isolates the package change by building the same files once per lockfile (source: user confirmation 2026-10-13)
- Process: GitHub Dependabot alerts for this repository are on, so advisories in the lockfile, test tools included, surface between upgrades; turned on outside this spec's diff (source: user confirmation 2026-10-13; `gh api repos/jaketlee07/meat-ops/vulnerability-alerts` returned 204)
- Process: full mode, because the upgrade adds 45 test-tool packages, some with native code, and Vitest 5 is new territory; the owner approves the spec, then the plan, in chat after review (source: user confirmation 2026-10-13)
