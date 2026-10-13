# Spec: parallel-builds

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the firewall block and the network check from [local-ports](../local-ports/spec.md), which every stack relies on unchanged; the test harness's localhost guard (`assertLocalUrl` and `resolveStackEnv` in `test/env.ts`, from [foundation-hardening](../foundation-hardening/spec.md)); `AGENTS.md` "Build and test commands" (the `.env` command, and stopping the app before a test run) and its hard rule that nothing writes to the hosted project without the owner's approval
- **Brief:** none
- **Discovery:** none
- **Contract:** none (test-harness settings and maintainer steps; no published interface)
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

Each git worktree folder of Meat Ops runs `npm test` against its own local
Supabase stack, so two folders can test at the same time and neither run
touches the other's data.

There are two stacks. Stack A is the main stack that `supabase/config.toml`
sets up, and a folder uses it by default. Stack B is a test-only stack with its
own project id, `meat-ops-b`, its own ports (API 55321, Postgres 55322, shadow
database 55320), and only the four services the tests use: the database, auth,
REST, and the API gateway. A folder uses stack B when its gitignored
`supabase/.env` is a copy of the tracked `supabase/stack-b.env`. Every Supabase
CLI command run in that folder then reaches stack B, and so does the tests' own
`supabase status` lookup.

A folder that names its own stack but reaches another stops before it writes.
The tests refuse when the stack the run uses is not the one the folder's
`supabase/.env` names. The stack B reset, `npm run db:reset:stack-b`, refuses
unless the folder's `supabase/.env` is an exact copy of the template, then
resets with exactly that file's settings, so no extra line, shell variable, or
other env file can point it at stack A.

The browser suite serves the app on `127.0.0.1` at the port in `E2E_PORT`, or
3100 when it is unset. A folder whose `supabase/.env` names its own stack must
set `E2E_PORT`, and stack B folders use 3200. So two folders on different
stacks share a browser port only when someone sets one by hand to the other's
port.

Stack B's ports have the same protection as stack A's. The firewall block on
Docker's port forwarder covers every port Docker publishes, and the network
check confirms it for the folder's own stack before any test runs. Setting up a
folder on stack B leaves `git status` clean. `AGENTS.md` gives the steps to set
up a folder on either stack and to stop stack B. Only one folder per stack runs
tests at a time, and nothing enforces that.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Agent guidance and commands | The owner asked for the setup and stop steps in `AGENTS.md` | `AGENTS.md`, "Build and test commands": the `E2E_PORT` line in the command list and a new part on running two folders' tests at once | jaketlee07 | The AC-0009, AC-0010, AC-0011, and AC-0016 to AC-0019 runs in the ledger | The steps cover `npm ci`, the `.env`, the reset to the branch's migrations for each stack (`npm run db:reset:stack-b` for stack B), `E2E_PORT=3200` for stack B, and stopping stack B |
| Current architecture | The overview describes one stack: its port list, its loopback residual, and its Areas table | `docs/architecture/overview.md`: the first paragraph and the loopback bullet of `Keep the local stack on this Mac`, the `supabase/config.toml` row, and the `test/` row | jaketlee07 | Diff of the four passages | The port paragraph names stack B's ports; the loopback bullet says the residual covers stack B's published ports too; the config row names `supabase/stack-b.env`; the `test/` row names every suite this change adds |
| Execution record | Setup runs, snapshots, run times, and listings need a home outside the contract | `docs/specs/parallel-builds/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every AC observation |
| Lifecycle closeout | Delivered work is recorded when it ships | `docs/lifecycle/parallel-builds.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | The Supabase CLI reads `supabase/.env` and lets `SUPABASE_*` names replace `config.toml` values; it also rewrites `supabase/.temp/cli-latest`; Playwright checks its port only before launch | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Check `E2E_PORT` at Playwright config load, before the web server command is built, and put only the checked number into that command.
- Keep the browser suite's app on `127.0.0.1`.
- Before a test run, reset, or stop on a stack, confirm no test process from another folder runs on that same stack; other worktrees share stack A.
- Start stack B only from a stack B folder, reset it only with `npm run db:reset:stack-b`, and stop it only with `--project-id meat-ops-b`.
- Take the AC-0006 auth snapshots while no app or test process runs in any folder other than the one under test.
- Keep every refusal message free of keys and connection strings; name only the file, the variable, the ports, and what to do.

### Ask first

- Any `supabase db reset` on stack A outside T5's verification runs; the owner approved resets during those runs on 2026-10-12.
- Any change to `supabase/config.toml`, the macOS firewall, or Docker Desktop settings.
- A third stack, or a guard against two test runs on one stack.
- Any way to skip or bypass the network check, the localhost guard, or the own-stack check.

### Never do

- Run `sudo`, or any command that changes a macOS setting.
- Add a dependency, a new top-level directory, or code under `src/`.
- Change `test/network.ts` or the localhost guard (`assertLocalUrl` and `resolveStackEnv`) in `test/env.ts`; stack B passes both unchanged.
- Stop or remove stack A, or run `supabase stop --all`.
- Commit a folder's `supabase/.env` or `.env`.

## Testing Strategy

- **TDD, plus one real run each (AC-0001, AC-0002, AC-0014, AC-0015)**: reading `E2E_PORT` and comparing `supabase/.env` with the resolved stack are pure functions from text to a port, a pass, or a refusal, so unit tests cover each accepted and refused form. One real run of each kind, recorded in the ledger, shows the app listening where the port says and each refusal coming before the app build and before any test, which only the real runners show.
- **Manual QA on the real stacks, recorded in the ledger (AC-0003, AC-0004, AC-0005, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0016, AC-0017, AC-0018, AC-0019)**: two new worktrees at the commit under verification, one set up for each stack by following `AGENTS.md` word for word, with `docker ps`, `docker volume ls`, `lsof`, the network check run with a logging runner, database queries, and `git status` read at the points each criterion names. Only the real stacks show which containers run, which ports they use, and which stack each command reaches. One created file and one changed file under `supabase/.temp/` stand for every file there because the ignore rule names the whole directory and `git ls-files supabase/.temp` prints nothing.
- **Manual QA on both stacks (AC-0006, AC-0007)**: auth snapshots around a full run on each stack while the other stack sits idle, and one pair of runs whose browser apps listen at the same moment. Only real runs show where their writes land.

Stub tally: T1 and T2 are covered by validated stubs; T3, T4, and T5 record `no stub (mode)`; none is uncovered.

## Acceptance Criteria

Definitions used by these criteria:

- **Stack A**: the local Supabase stack whose project id is the `project_id` in `supabase/config.toml`, `meat-ops`.
- **Stack B**: the local Supabase stack whose project id is `meat-ops-b`.
- **Names its own stack**: a folder whose `supabase/.env` has a line that sets `SUPABASE_PROJECT_ID`.
- **Stack B folder**: a git worktree folder of this repository whose `supabase/.env` is byte-identical to its `supabase/stack-b.env`. A **stack A folder** is one that does not name its own stack.
- **The block**: as the local-ports spec defines it: the macOS firewall on, the program serving every published stack port blocked, and automatic allow of downloaded signed software off.
- **Auth snapshot** of a stack: the pair `max(updated_at)` over `auth.users` and `max(created_at)` over `auth.sessions`, read from that stack's database.
- **The stack B reset step**: `npm run db:reset:stack-b`, the `AGENTS.md` stack B step that resets stack B.

- [ ] **AC-0001.** When no other program listens on the port it would use, the browser suite's app listens on `127.0.0.1`: at the port `E2E_PORT` names when it holds a whole number from 1 to 65535 written in digits with no leading zero, and at 3100 when `E2E_PORT` is unset in a stack A folder.
- [ ] **AC-0002.** If `E2E_PORT` is set to any other value, the empty string included, `npm run test:e2e` exits non-zero before the app builds, with a message that names `E2E_PORT` and the values it accepts.
- [ ] **AC-0003.** While stack B runs, having been started from a stack B folder, and no `supabase db diff` runs, the containers labelled `com.supabase.cli.project=meat-ops-b` are exactly `supabase_db_meat-ops-b`, `supabase_auth_meat-ops-b`, `supabase_rest_meat-ops-b`, and `supabase_kong_meat-ops-b`.
- [ ] **AC-0004.** While stack B runs and no `supabase db diff` runs, the host ports its containers publish are exactly 55321 and 55322.
- [ ] **AC-0005.** With the block on, stack B running, and no `supabase db diff` running, the network check for a stack B folder examines exactly ports 55321 and 55322 and passes.
- [ ] **AC-0006.** A full `npm test` run in a folder on one stack changes that stack's auth snapshot and leaves the other stack's auth snapshot unchanged, both for a stack B folder run (with `E2E_PORT=3200`) and for a stack A folder run.
- [ ] **AC-0007.** When `E2E_PORT=3200 npm test` in a stack B folder and `npm test` in a stack A folder run so that at one moment `lsof -nP -iTCP -sTCP:LISTEN` lists both `127.0.0.1:3100` and `127.0.0.1:3200`, both pass with the block on.
- [ ] **AC-0008.** In a stack B folder that has run the `AGENTS.md` stack B steps and a full `E2E_PORT=3200 npm test`, `git status --porcelain` prints nothing, both as the run leaves it and after a file under `supabase/.temp/` is created or changed.
- [ ] **AC-0009.** Running the `AGENTS.md` stack B steps in order, word for word, in a new git worktree of this repository at the commit under verification, with no stack B container or volume present, ends with `E2E_PORT=3200 npm test` passing, and no other command runs in that folder first.
- [ ] **AC-0010.** Running the `AGENTS.md` stack A steps in order, word for word, in a new git worktree of this repository at the commit under verification, with stack A running, ends with `npm test` passing, and no other command runs in that folder first.
- [ ] **AC-0011.** After the `AGENTS.md` step that stops stack B, `docker ps -a` and `docker volume ls` list nothing labelled `com.supabase.cli.project=meat-ops-b`.
- [ ] **AC-0012.** With stack A running, every stack A container that runs before the `AGENTS.md` step that stops stack B still runs after it.
- [ ] **AC-0013.** In a stack B folder, while `supabase db diff` runs, its shadow database listens on port 55320.
- [ ] **AC-0014.** In a folder that names its own stack, with `E2E_PORT` unset, `npm run test:e2e` exits non-zero before the app builds, with a message that names `E2E_PORT`.
- [ ] **AC-0015.** In a folder that names its own stack, if its `supabase/.env` does not set both `SUPABASE_API_PORT` and `SUPABASE_DB_PORT` as plain digits, or the port of the `API_URL` or `DB_URL` the run uses differs from those, whether the run takes them from `supabase status` or from its environment, `npm test` and `npm run test:e2e` each exit non-zero before any test runs, before global setup writes, and before the app builds, with a message that names `supabase/.env`.
- [ ] **AC-0016.** With stack A running, in a folder that is not a stack B folder, the stack B reset step exits non-zero and leaves stack A's tables as they were.
- [ ] **AC-0017.** When a folder's stack runs and holds a table that no migration in the folder creates, that folder's `AGENTS.md` steps up to and including its reset leave no such table, and `supabase_migrations.schema_migrations` then lists exactly the folder's `supabase/migrations/` files; this holds for a stack A folder and for a stack B folder.
- [ ] **AC-0018.** After a folder's `AGENTS.md` steps, its `.env` holds exactly two lines, `SUPABASE_URL` and `SUPABASE_ANON_KEY`, whose values equal `API_URL` and `ANON_KEY` from `supabase status -o env` in that folder.
- [ ] **AC-0019.** While stack A and stack B both run, in a stack B folder whose environment sets `SUPABASE_PROJECT_ID=meat-ops`, the stack B reset step resets stack B and leaves stack A's tables as they were.

## Follow-ons

None.

## Assumptions

- Technical: the Supabase CLI is v2.95.4; it loads a folder's `supabase/.env` and lets `SUPABASE_*` names replace `config.toml` values for every command run there: with `SUPABASE_PROJECT_ID=probe-zz` in that file, `supabase status` looked for `supabase_db_probe-zz` (source: probe 2026-10-12)
- Technical: with `SUPABASE_API_PORT`, `SUPABASE_DB_PORT`, and `SUPABASE_DB_SHADOW_PORT` set and the studio, inbucket, storage, realtime, analytics, and edge runtime services set to `false`, in a file with comment and blank lines, `supabase start` ran only the db, auth, rest, and kong containers and published only the API and Postgres ports; `supabase status -o env` reported the new ports; `supabase db diff` opened its shadow database on the new shadow port; `supabase db reset` applied all six migrations; and `supabase stop --project-id <id> --no-backup` removed that stack's containers and volumes while stack A's 12 containers kept running (source: throwaway stack `probe-b`, 2026-10-12)
- Technical: with only `SUPABASE_PROJECT_ID=meat-ops` in the environment and the stack B ports in `supabase/.env`, `supabase status -o env` printed stack B's API and Postgres URLs while stack B was stopped and stack A ran, so a port check alone cannot tell which project `supabase db reset` acts on (source: probe 2026-10-12)
- Technical: a variable already in the environment wins over the same name in `supabase/.env`, so a run can make the CLI report stack A while the file names stack B (source: probe 2026-10-12: with `SUPABASE_PROJECT_ID=from-env` in the environment and `from-file` in `supabase/.env`, `supabase status` looked for `supabase_db_from-env`)
- Technical: the tests use only the database, auth, and REST through the API gateway (source: `grep` over `test/` and `src/` for storage, realtime, functions, mail, `/auth/v1`, and `/rest/v1`, 2026-10-12)
- Technical: the network check finds the stack from the database port the tests resolve, and passed for the probe stack's port 55322 with the block on, because the block is on the program `com.docker.backend`, which serves every Docker port (source: `localStackRefusal` run against ports 55322 and 54322, 2026-10-12; `docs/architecture/overview.md` `Keep the local stack on this Mac`)
- Technical: `supabase/.temp/cli-latest` is tracked, and a CLI run rewrites it when the newest-version cache changes (v2.117.0 to v2.120.0 after `supabase --version`), so a CLI run can leave a tracked change (source: `git diff` 2026-10-12)
- Technical: `.gitignore`'s `.env` rule ignores `supabase/.env`, and Next.js reads env files only from the repository root (source: `git check-ignore -v supabase/.env`, 2026-10-12)
- Technical: `supabase/config.toml` reads `OPENAI_API_KEY` through `env()`, so a stack A folder may keep a `supabase/.env` for that alone; only a `SUPABASE_PROJECT_ID` line marks a folder that names its own stack (source: `supabase/config.toml` `[studio]`)
- Technical: the browser suite's port is the constant `3100` in `playwright.config.ts`, which goes into a `sh -c` command string (source: `playwright.config.ts`)
- Technical: Playwright 1.64 refuses a port that answers when its web server starts, then waits until anything answers on that port, so a second app that binds the port during the build is taken as its own (source: `_startProcess` and the availability wait in `node_modules/playwright/lib/runner/index.js`)
- Technical: the app accepts any port on `127.0.0.1` or `localhost` (source: the `LOCAL_HOST` pattern in `src/proxy.ts`)
- Technical: no program listened on ports 55320, 55321, 55322, or 3200 (source: `lsof`, 2026-10-12)
- Technical: stack A holds only the three test users and this branch's six migrations, and `meat-ops-sales` and `meat-ops-invoice` have the same six migration files (source: `auth.users` count, `supabase_migrations.schema_migrations`, and `ls` of each worktree, 2026-10-12)
- Product: stack B's settings live in a tracked template, `supabase/stack-b.env`, that a stack B folder copies to its gitignored `supabase/.env` (source: user confirmation 2026-10-12)
- Product: `supabase/.temp/` is ignored and no longer tracked, so no CLI run leaves a tracked change in any folder (source: user confirmation 2026-10-12)
- Product: two stacks, one test run per stack at a time, and no guard that enforces it (source: user confirmation 2026-10-12)
- Product: the variable is `E2E_PORT`, 3100 when unset; stack B is `meat-ops-b` with API 55321, Postgres 55322, and shadow database 55320; stack B folders use `E2E_PORT=3200` (source: user confirmation 2026-10-12)
- Product: a folder that names its own stack but reaches another stack refuses in the tests and before the stack B reset (source: user confirmation 2026-10-12)
- Product: a folder that names its own stack must set `E2E_PORT`; a by-hand port equal to another folder's stays possible (source: user confirmation 2026-10-12)
- Product: the stack B reset is a script that refuses unless the folder's `supabase/.env` is an exact copy of `supabase/stack-b.env` and passes that file's `SUPABASE_*` settings to `supabase db reset` directly (source: user confirmation 2026-10-12)
- Technical: the reset script's shell form works as designed: a stand-in for `supabase` under `/bin/sh` received `meat-ops-b` and the template's ports for an exact copy with `SUPABASE_PROJECT_ID=meat-ops` exported, and was not run for a copy with an extra `SUPABASE_PROJECT_ID=meat-ops` line (exit 1) or with no file (exit 2) (source: probe 2026-10-12)
- Technical: `supabase stop --project-id <id>` acts on `<id>` even when `SUPABASE_PROJECT_ID` in the environment names another project (source: probe 2026-10-12 with two labelled dummy containers: only the flag's was removed)
- Product: the owner approved `supabase db reset` on stack A whenever T5's verification runs need it, re-runs at a new commit included (source: user confirmation 2026-10-12)
- Process: full mode, because stack B adds ports Docker publishes on every interface and `E2E_PORT` reaches a shell command; the owner approves the spec, then the plan, in chat after review (source: `docs/specs/local-ports/spec.md` Assumptions)
