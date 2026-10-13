# Plan: parallel-builds

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** `AGENTS.md` "Build and test commands" (the `.env` command, the stop-before-test rule) and `docs/architecture/overview.md` `Keep the local stack on this Mac`; the harness pieces this change extends, `resolveStackEnv` in `test/env.ts` with its tests in `test/env.test.ts`, and the two run gates that call it before any test, `playwright.config.ts` at config load and `test/global-setup.ts` for both runners; `localStackRefusal` in `test/network.ts`, which keys on the resolved database port and is unchanged. Deviation: none; the new port reader and own-stack check sit beside `resolveStackEnv` and run at those two gates, as `localStackRefusal` does.

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

Four small changes, then one task that writes the steps and proves them on the
real stacks.

1. `test/env.ts` gains `e2ePort(value, ownStack)`, and `playwright.config.ts`
   takes its port from it instead of the constant.
2. `test/env.ts` gains the own-stack check, which compares a folder's
   `supabase/.env` with the stack the run uses. The two run gates run it right
   after `resolveStackEnv()`.
3. A tracked `supabase/stack-b.env` holds stack B's settings as `SUPABASE_*`
   overrides, a new Vitest file checks them against `supabase/config.toml`,
   and `package.json` gains `db:reset:stack-b`, the stack B reset.
4. `.gitignore` ignores `supabase/.temp/`, and `supabase/.temp/cli-latest`
   leaves the index.
5. T5 writes the `AGENTS.md` steps and the overview passages, commits, and then
   follows the steps word for word in two new worktrees, one per stack,
   recording each criterion's observation in the ledger. When a run shows a
   step or a timeout is wrong, T5 fixes the file it names and runs the affected
   steps again at the new commit.

The riskiest part is T5's pair of runs at once: two Next builds and two stacks
on one Mac may run slower than the web server's 240-second start limit.

## Constraints

- The localhost guard (`assertLocalUrl` and `resolveStackEnv` in `test/env.ts`) and the network check in `test/network.ts` are unchanged and still run before any build or test; the port check runs before them at config load, and the own-stack check right after `resolveStackEnv()` at the two run gates.
- `AGENTS.md` build commands: run `npm test` after the change, with `npm run dev`/`npm run start` stopped; there is no lint command.
- `AGENTS.md` hard rule 4: no em dashes in copy, comments, or commit messages. This plan's template quote blocks are not copy.
- Other worktrees share stack A: no test run, reset, or stop on stack A starts while a test process from another folder runs on it (spec Always do). The owner approved `supabase db reset` on stack A whenever T5's runs need it, re-runs at a new commit included.
- `psql` is not installed on the host; queries go through `docker exec supabase_db_<project id> psql -U postgres`.

## Construction tests

**Integration tests:** none beyond per-task tests.
**Manual verification:** T5, recorded in the ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Agent guidance, `AGENTS.md` "Build and test commands" | T5 | Diff; T5's runs follow it word for word | The ledger entries for AC-0009, AC-0010, AC-0011, and AC-0016 to AC-0019 name the steps run |
| Current architecture, the overview's port paragraph, loopback bullet, `supabase/config.toml` row, and `test/` row | T5 | Diff of the four passages | Each names stack B's part; the `test/` row names `e2e-port.test.ts`, `own-stack.test.ts`, and `stack-b.test.ts` |
| Execution record, `notes/verification-ledger.md` | T1, T2, T3, T5 | Ledger entries | Every AC observation is there |
| Lifecycle closeout | close-work | none | close-work records the spec as delivered |
| Reusable learning | work-loop capture gates | Capture receipt | Captured or recorded unavailable |

## Design (LLD)

### Design decisions

- **Switch stacks with the CLI's own env file.** The Supabase CLI loads `supabase/.env` for every command and lets `SUPABASE_*` names replace `config.toml` values (spec Assumptions). One gitignored file therefore moves a folder's `supabase start`, `db reset`, `status`, and `stop`, and the tests' `supabase status` lookup, to stack B, with no second config. `--workdir` and a copied `config.toml` were the alternatives; both need every command to change. Traces to: AC-0003, AC-0004, AC-0006, AC-0009.
- **Leave services off in the settings, not on the command line.** `*_ENABLED=false` holds for every `supabase start` and `db reset` in the folder; `supabase start -x` would hold only for the command that names it. Studio's pg-meta and analytics' vector follow their parent service. Traces to: AC-0003, AC-0004.
- **Fail closed when a folder reaches the wrong stack.** A folder names its own stack when its `supabase/.env` sets `SUPABASE_PROJECT_ID`; a file that holds only other keys, such as `OPENAI_API_KEY` for Studio, does not. For such a folder, the own-stack check reads `SUPABASE_API_PORT` and `SUPABASE_DB_PORT` from the file and refuses unless both are plain digits equal to the ports of the `API_URL` and `DB_URL` the run uses, which `resolveStackEnv` takes from the environment when all four of its values are set there and from `supabase status` otherwise. That catches a CLI that ignores the file, a variable in the environment that overrides it, and another stack's values carried in the shell. Traces to: AC-0015.
- **Pin the stack B reset to the file.** A port check cannot tell which project `supabase db reset` acts on, because a project id set elsewhere leaves `supabase status` printing the file's ports (spec Assumptions). So `npm run db:reset:stack-b` runs `cmp -s supabase/.env supabase/stack-b.env && env $(grep -E '^SUPABASE_[A-Z0-9_]+=[A-Za-z0-9._-]*$' supabase/.env) supabase db reset`. `cmp` refuses a missing file and any file that is not an exact copy of the template, which is the spec's stack B folder test; T3's test pins the template to one project line, `meat-ops-b`. `env` then hands each of the template's `SUPABASE_*` lines to the CLI as an environment variable, which beats both the shell and any env file. Traces to: AC-0016, AC-0019.
- **Make a folder on its own stack say its browser port.** Playwright refuses a port that answers before launch, then takes anything that answers during the build as its own server (spec Assumptions). So `e2ePort` refuses an unset `E2E_PORT` in a folder that names its own stack, and two folders on different stacks share a port only when one sets the other's port by hand. Traces to: AC-0014.
- **Accept only canonical port digits.** The port goes into a `sh -c` string, so `e2ePort` accepts only `^[1-9][0-9]*$` up to 65535 and returns a number; no other character can reach the command. Traces to: AC-0001, AC-0002.
- **Stop stack B with its project id and no backup.** `supabase stop --project-id meat-ops-b --no-backup` works from any folder, even after the stack B folder is gone, and leaves nothing behind. Stack B is test-only, and a later setup rebuilds it from that folder's migrations. Traces to: AC-0011, AC-0012.
- **Leave the network check alone.** It finds the stack from the database port the localhost guard resolved, then checks every port that stack's containers publish, so a stack B folder's run checks 55321 and 55322 with no change. Traces to: AC-0005.

### Interfaces & contracts

`E2E_PORT` (environment, read at Playwright config load) and `supabase/.env` (read by the CLI, and by the own-stack check from the folder the run starts in) are the only new inputs. The template's non-comment, non-blank lines are exactly:

```
SUPABASE_PROJECT_ID=meat-ops-b
SUPABASE_API_PORT=55321
SUPABASE_DB_PORT=55322
SUPABASE_DB_SHADOW_PORT=55320
SUPABASE_STUDIO_ENABLED=false
SUPABASE_INBUCKET_ENABLED=false
SUPABASE_STORAGE_ENABLED=false
SUPABASE_REALTIME_ENABLED=false
SUPABASE_ANALYTICS_ENABLED=false
SUPABASE_EDGE_RUNTIME_ENABLED=false
```

Refusal messages, each ending `Refusing to run.`:

- Bad port: `E2E_PORT must be a whole number from 1 to 65535 with no leading zero, or unset for port 3100.`
- Port missing on an own stack: `This folder's supabase/.env names its own Supabase stack, so set E2E_PORT to that stack's browser port (3200 for stack B).`
- Ports missing or unreadable: `This folder's supabase/.env names its own Supabase stack but does not set SUPABASE_API_PORT and SUPABASE_DB_PORT as plain numbers, so the run cannot confirm which stack it reaches.`
- Wrong stack: `This folder's supabase/.env names a Supabase stack on API port <a> and Postgres port <b>, but this run would use API port <c> and Postgres port <d>, from <source>, so it could reach another folder's stack.` `<source>` is `supabase status` or `the API_URL and DB_URL in the environment`.

Traces to: AC-0002, AC-0014, AC-0015.

### Failure, edge cases & resilience

- A folder with no `supabase/.env` is a stack A folder by definition; `AGENTS.md` says how to move a folder back.
- Two runs on the same port: Playwright stops a run whose port already answers at launch. A second app that binds the port during the first run's build is taken as the first run's server. Folders on different stacks reach that only through a by-hand port equal to the other's (owner-accepted, spec Assumptions); two folders on one stack are outside the one-run-per-stack rule.
- Stack B not started: `supabase status` fails, `resolveStackEnv` refuses with "Start the local stack first", and `npm run db:reset:stack-b` reaches `supabase db reset`, which fails because the stack is not running.

## Tasks

### T1: The browser suite takes its port from `E2E_PORT`, proven by unit tests

**Depends on:** none
**Touches:** test/env.ts, test/e2e-port.test.ts, playwright.config.ts

**Tests:**
- `test/e2e-port.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0001: uses the port E2E_PORT names, and 3100 when it is unset in a folder on stack A" (AC-0001). sha256 `ac64fa662135fee82df6d7ebbde83482aabef4787bb88160969f1bc70e2d1a58` over the code lines plus one terminal newline. Stub validation, 2026-10-12, in a `git archive HEAD` copy in scratch, outside the repository:
  - **Compile:** with placeholder `e2ePort` and `ownStackRefusal` appended to the copy's `test/env.ts`, `tsc --noEmit -p tsconfig.json` exited 0.
  - **Red:** `vitest run` over the stub alone, with a config that has no global setup, exited 1 both ways. With the placeholder returning 0: `AssertionError: expected +0 to be 3200`. With the placeholder removed: `TypeError: e2ePort is not a function`.
  - **Isolation:** the run went through `sandbox-exec` with all network denied; file-content reads denied except for the repository (its `node_modules` is symlinked into the copy), the scratch copy, the Node 22.17.0 install under `~/.nvm/versions/node/v22.17.0`, this user's `os.tmpdir()`, `/private/var/db/timezone`, `/private/var/db/dyld`, `/private/preboot`, `/Library/Preferences`, the root directory entry, `/System`, `/usr`, `/private/etc`, and `/dev`; file writes denied except under the scratch copy, `os.tmpdir()`, `/dev/null`, and `/dev/tty`; and a 120-second `alarm`. Under the same profile, reading `~/.zshrc`, writing into the repository, and connecting to `127.0.0.1:54321` were each refused. Vitest ran as `node node_modules/vitest/vitest.mjs`. The stub touches no database, so there are no test-harness side effects. The scratch copy was removed.
- Build-out in the same file: accepted `"1"`, `"65535"`, `"3200"` with either `ownStack` value; refused `""`, `"0"`, `"65536"`, `"03200"`, `"3200.0"`, `"+3200"`, `"-1"`, `" 3200"`, `"1e3"`, `"abc"`, `"3200; true"`, each with a message matching `/E2E_PORT/` and `/1 to 65535/` (AC-0002); unset with `ownStack` true refused with a message matching `/E2E_PORT/` (AC-0014).

```ts
import { describe, expect, it } from "vitest";
import { e2ePort } from "./env.js";

describe("Browser suite port", () => {
  // STUB: AC-0001
  it("AC-0001: uses the port E2E_PORT names, and 3100 when it is unset in a folder on stack A", () => {
    expect(e2ePort("3200", true)).toBe(3200);
    expect(e2ePort(undefined, false)).toBe(3100);
  });
});
```

**Approach:**
- Add `e2ePort(value: string | undefined, ownStack: boolean): number` to `test/env.ts` per Design decisions; it reads no environment or file itself.
- In `playwright.config.ts`, replace `const PORT = 3100;` with a call that passes `process.env.E2E_PORT` and whether the folder names its own stack (T2's file reader; until T2 lands, `false`).

**Done when:** every T1 test passes in `npm test`.

### T2: A folder that names its own stack refuses to run against any other, proven by unit tests

**Depends on:** T1
**Touches:** test/env.ts, test/own-stack.test.ts, playwright.config.ts, test/global-setup.ts

**Tests:**
- `test/own-stack.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0015: refuses when supabase status reports a stack other than the one supabase/.env names" (AC-0015). sha256 `aabcdb6f7c18aad6c203c99b2225a33a546af4f69d78eb9f128bf38e1a0f1bb5`. Stub validation, 2026-10-12, in the same scratch copy and under the same compile step, sandbox profile, and isolation proof as T1's: with the placeholder returning `null`, `TypeError: .toMatch() expects to receive a string, but got object`; with the placeholder removed, `TypeError: ownStackRefusal is not a function`; both exited 1.
- Build-out in the same file: `null` for no file, for a file with only `OPENAI_API_KEY`, and for a stack B file whose ports match; a refusal matching `/supabase\/\.env/` when the API port differs, when the Postgres port differs, when either port line is missing, when a value is quoted or not plain digits, and when comment and blank lines surround a mismatch.

```ts
import { describe, expect, it } from "vitest";
import { ownStackRefusal } from "./env.js";

const STACK_B_FILE = "SUPABASE_PROJECT_ID=meat-ops-b\nSUPABASE_API_PORT=55321\nSUPABASE_DB_PORT=55322\n";
const STACK_A = { apiUrl: "http://127.0.0.1:54321", dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" };
const STACK_B = { apiUrl: "http://127.0.0.1:55321", dbUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres" };

describe("Own-stack check", () => {
  // STUB: AC-0015
  it("AC-0015: refuses when supabase status reports a stack other than the one supabase/.env names", () => {
    expect(ownStackRefusal(STACK_B_FILE, STACK_A)).toMatch(/supabase\/\.env/);
    expect(ownStackRefusal(STACK_B_FILE, STACK_B)).toBeNull();
  });
});
```

**Approach:**
- Add to `test/env.ts` a reader for `<process.cwd()>/supabase/.env` that returns `null` when the file does not exist and throws on any other read error, a `namesOwnStack(text)` predicate, and `ownStackRefusal(text, env)` per Design decisions and the messages in Interfaces & contracts.
- Call `ownStackRefusal` right after `resolveStackEnv()` in `playwright.config.ts` and `test/global-setup.ts`, throwing its message, and pass `namesOwnStack` of the same text to `e2ePort`.

**Done when:** every T2 test passes in `npm test`.

### T3: Stack B's settings exist once and cannot collide with stack A's

**Depends on:** none
**Touches:** supabase/stack-b.env, test/stack-b.test.ts, package.json

**Tests:**
- no stub (goal-based): `test/stack-b.test.ts` reads `supabase/stack-b.env` and `supabase/config.toml`. It fails unless the template's non-comment, non-blank lines are exactly the ten in Interfaces & contracts; `SUPABASE_PROJECT_ID` differs from `config.toml`'s top-level `project_id`; and none of the three port values equals any port number `config.toml` assigns on an uncommented line (`port`, `shadow_port`, `inspector_port`, and any other key ending in `port`). Mutation check, recorded in the ledger: setting `SUPABASE_DB_PORT=54322` in the template turns the test red, and restoring it turns it green.

**Approach:**
- Write the template with a short header comment: what stack B is, the `cp` line, and a pointer to `AGENTS.md`.
- Read `config.toml`'s top-level `project_id` only from lines before the first `[` section header.
- Add the `db:reset:stack-b` script from Design decisions to `package.json`; T5's runs prove it (AC-0016, AC-0019).

**Done when:** `test/stack-b.test.ts` passes in `npm test` and its mutation check is in the ledger.

### T4: No Supabase CLI run leaves a tracked or untracked file under `supabase/.temp/`

**Depends on:** none
**Touches:** .gitignore, supabase/.temp/cli-latest

**Tests:**
- no stub (goal-based): `git ls-files supabase/.temp` prints nothing, and `git check-ignore -q supabase/.temp/cli-latest supabase/.temp/any-new-file` exits 0.

**Approach:**
- Add `supabase/.temp/` beside the existing `supabase/.branches/` rule, and `git rm --cached supabase/.temp/cli-latest`.

**Done when:** the T4 test holds on the branch.

### T5: The steps exist, and following them puts each folder on its own stack, side by side, with stack B stopping cleanly

**Depends on:** T1, T2, T3, T4
**Touches:** AGENTS.md, docs/architecture/overview.md, playwright.config.ts, package.json, docs/specs/parallel-builds/notes/verification-ledger.md

**Tests:**
- no stub (manual QA), stack B setup: with T1 to T5's files committed and no `meat-ops-b` container or volume, `git worktree add --detach <scratch>/wt-b HEAD`, then the stack B steps word for word in it. After `supabase start`, `docker ps --filter label=com.supabase.cli.project=meat-ops-b --format '{{.Names}} {{.Ports}}'` gives the four names and the two ports (AC-0003, AC-0004). After the `.env` step, compare `.env` with `supabase status -o env` (AC-0018). Read both stacks' auth snapshots before and after its `npm test` step; during the run, `lsof -nP -iTCP:3200 -sTCP:LISTEN` lists only `127.0.0.1:3200` (AC-0001, AC-0006, AC-0009).
- no stub (manual QA), stack B checks after that run: `localStackRefusal` for port 55322 with `realRunner` wrapped to log each command shows `lsof` for exactly 55321 and 55322 and returns `null` (AC-0005); `git status --porcelain` prints nothing, then nothing again after `touch supabase/.temp/new-file` and after `printf v0.0.0 > supabase/.temp/cli-latest` (AC-0008); `lsof -nP -iTCP:55320 -sTCP:LISTEN` lists a listener while `supabase db diff` runs (AC-0013); after `create table public.parallel_builds_probe(id int)` on stack B, the stack B steps from `supabase start` through `npm run db:reset:stack-b` leave no such table, and `schema_migrations` matches `supabase/migrations/` (AC-0017).
- no stub (manual QA), refusals in `wt-b`: `npm run test:e2e` with `E2E_PORT` unset exits non-zero with the own-stack port message (AC-0014). Then two wrong-stack cases, each with stack A's auth snapshot read before and after: `SUPABASE_PROJECT_ID=meat-ops SUPABASE_API_PORT=54321 SUPABASE_DB_PORT=54322` in the environment, which makes `supabase status` report stack A; and stack A's `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and `DB_URL` from `supabase status -o env` in the `meat-ops` folder in the environment. In each, `npm test` and `E2E_PORT=3200 npm run test:e2e` exit non-zero with the wrong-stack message, and stack A's snapshot is unchanged (AC-0015). The ledger records each exit code and message, and that no `next build` output appeared.
- no stub (manual QA), pinned reset in `wt-b`: with both stacks running and `public.parallel_builds_probe` created on both, `SUPABASE_PROJECT_ID=meat-ops npm run db:reset:stack-b` exits 0, the table is gone from stack B and still on stack A (AC-0019). Stack A's table stays for the next Test.
- no stub (manual QA), stack A: with stack A's probe table in place, `git worktree add --detach <scratch>/wt-a HEAD`, then the stack A steps word for word in it with no other command first. After its reset, the probe table is gone and `schema_migrations` matches (AC-0017); after its `.env` step, `.env` is compared as above (AC-0018); both stacks' auth snapshots are read before and after its `npm test` step (AC-0006, AC-0010).
- no stub (manual QA), stack A checks after that run: with the probe table created on stack A again, `npm run db:reset:stack-b` in `wt-a` exits non-zero and the table is still there, first with no `supabase/.env` and then with one that holds the template followed by `SUPABASE_PROJECT_ID=meat-ops` (AC-0016); that file is then removed and the table dropped. `E2E_PORT=abc npm run test:e2e` in `wt-a` exits non-zero with the bad-port message and no `next build` output (AC-0002).
- no stub (manual QA), together: `E2E_PORT=3200 npm test` in `wt-b` and `npm test` in `wt-a`, with `lsof -nP -iTCP -sTCP:LISTEN` polled every 5 seconds; the ledger records one poll that lists both `127.0.0.1:3100` and `127.0.0.1:3200`, and each run's exit code (AC-0007).
- no stub (manual QA), stop: with stack A running, `docker ps --filter label=com.supabase.cli.project=meat-ops --format '{{.Names}}'` before and after the stop step lists the same names (AC-0012); after it, `docker ps -a` and `docker volume ls`, each filtered on `label=com.supabase.cli.project=meat-ops-b`, list nothing (AC-0011).

**Approach:**
- In `AGENTS.md` "Build and test commands", add `E2E_PORT=3200 npm test` to the command list as the stack B form, and a new part after the `.env` paragraph. It says what stacks A and B are, how a folder picks one, that one folder per stack runs tests at a time, and that both stacks rely on the overview's block. Its numbered stack A steps are `npm ci`, `supabase start`, `supabase db reset` (after confirming no other folder on stack A is running tests or the app; it deletes every row on stack A for every folder on it), the `.env` command, and `npm test`. Its numbered stack B steps are `npm ci`, `cp supabase/stack-b.env supabase/.env`, `supabase start`, `npm run db:reset:stack-b` with what its non-zero exit means, the `.env` command, and `E2E_PORT=3200 npm test`. Then the stop command `supabase stop --project-id meat-ops-b --no-backup`, with a warning never to use `--all`, and how to move a folder back to stack A.
- In the overview, add stack B's ports to the first paragraph of `Keep the local stack on this Mac`, say in its loopback bullet that the residual covers stack B's published ports too, name `supabase/stack-b.env` in the `supabase/config.toml` row, and add the three new test files to the `test/` row.
- Commit, then run the Tests above in order. Before each run, reset, or stop, confirm with `ps` and `lsof -a -d cwd` that no vitest, playwright, or `next` process from another folder uses the same stack.
- Read auth snapshots with `docker exec supabase_db_<project id> psql -U postgres -tAc "select (select max(updated_at) from auth.users), (select max(created_at) from auth.sessions)"`.
- If a run shows a step, a passage, or the web server's start limit is wrong, fix that file, commit, and repeat the affected Tests from a new worktree at the new commit.
- Remove both scratch worktrees with `git worktree remove` after the stop step.

**Done when:** every T5 observation above is in the ledger at the final commit and each matches its criterion.

## Rollout

- **Delivery:** one PR. Rollback is a revert; a stack B left running is removed with the stop step.
- **Other worktrees:** after they merge `main`, git removes their unchanged `supabase/.temp/cli-latest`, and the CLI writes it again as an ignored file. Where the CLI has rewritten it, git refuses the merge; `git checkout -- supabase/.temp/cli-latest` first clears it. They stay on stack A until they copy the template.

## Risks

- Two Next builds and two stacks at once may push a run past the web server's 240-second start limit; T5's together run shows it.

## Changelog

- 2026-10-12: initial plan.
- 2026-10-12: after round 1 review, added the own-stack check (T2) and the `E2E_PORT` requirement on an own stack, per the owner's decisions; merged the docs task into the verification task so it can fix what its runs find; scoped the no-concurrent-run rule to one stack.
- 2026-10-12: after round 2 review, pinned the stack B reset to its file (`db:reset:stack-b`, AC-0019) per the owner's decision; ordered T5 so the stack A worktree runs nothing before its steps; compared the own-stack check with the stack the run uses.
- 2026-10-12: after round 3 review, the stack B reset refuses unless `supabase/.env` is an exact copy of the template (`cmp`), so no extra project line can steer it; the wrong-stack message names where the run's ports came from; T5 may fix `package.json`.
