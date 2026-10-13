# Verification ledger: parallel-builds

Execution observations, newest last. Each entry names the task, the command, and
the observed result. Times are UTC; the work ran on the evening of 2026-10-12 in
Chicago, which is 2026-10-13 UTC.

## Gates before EXECUTE (2026-10-12)

- Pre-EXECUTE reviews closed after four rounds. Raw and adjudication artifacts are under the ignored `.context/reviews/bf4fca51-2642-4478-a3bb-9539c0a570e6/`, with the round dispositions in `dispositions.md` there.
  - shaping-reviewer: 14, 7, and 2 findings in rounds 1 to 3; Clean in round 4.
  - adversarial-reviewer: round 1 sustained 7 (1 Blocker); round 2 sustained 2 (1 Blocker) and left 1 undecided; round 3 sustained 3 (1 advisory, 2 Nits); round 4 returned Clean.
  - security-reviewer: round 1 sustained 2 Nits and left the Playwright start race undecided; round 2 left the reset target undecided; round 3 sustained 1 Concern; round 4 returned 1 Nit, deferred below.
- Undecided items went to the owner, who chose: refuse in the steps and the tests when a folder reaches another stack; require `E2E_PORT` on an own stack; pin the stack B reset to its file (then to an exact copy of the template, after round 3); and allow stack A resets during T5. The facts behind the undecided items were checked first: Playwright's `_startProcess` takes any answer on its port after launch, and `supabase status` prints the file's ports under a shell project id.
- Deferred Nit from security round 4: the reset's project pin depends on T3 comparing the template's lines byte for byte. T3's test splits on `\n` only and compares raw lines with no trimming or unquoting, so a trailing space, a CR, or quotes turn it red.
- Owner approved the spec, then the plan, in chat on 2026-10-12; `approve-plan` recorded the baseline, `schedule` set three waves (T1, T3, T4; then T2; then T5), and `plan check-current` passed after `plan-locked`.
- Tasks ran in-session, not through the `implementer` subagent: T1 and T2 edit the same two files, and each of T1 to T4 is under 60 lines.

## T1 (2026-10-13)

- Stub materialized byte-identical at `test/e2e-port.test.ts` (sha256 ac64fa66…2d1a58, checked before any edit); observed red: `TypeError: e2ePort is not a function`. The file then grew to 4 tests, all passing.

## T3 (2026-10-13)

- `test/stack-b.test.ts`: 3 tests pass. Mutation check: with `SUPABASE_DB_PORT=54322` in `supabase/stack-b.env`, 2 of 3 failed (the exact-lines test and the port test); restored, 3 of 3 passed.
- `package.json` gained `db:reset:stack-b`; T5 runs it.

## T4 (2026-10-13)

- `git ls-files supabase/.temp` prints nothing. The plan's `git check-ignore -q` with two paths is refused by git ("--quiet is only valid with a single pathname"), so each path was checked alone: `supabase/.temp/cli-latest` and `supabase/.temp/any-new-file` each exit 0, both matched by `.gitignore:109:supabase/.temp/`.

## Wave gates (2026-10-13)

- Wave 1 (T1, T3, T4): `npm run typecheck` exit 0; `npm test` exit 0 in 129 s, Vitest 24 files and 400 tests, Playwright 220 passed.
- Wave 2 (T2): `npm run typecheck` exit 0; `npm test` exit 0 in 144 s, Vitest 25 files and 407 tests, Playwright 220 passed.

## T2 (2026-10-13)

- Stub materialized byte-identical at `test/own-stack.test.ts` (sha256 aabcdb6f…0f1bb5); observed red: `TypeError: ownStackRefusal is not a function`. The file then grew to 7 tests.
- A build-out case found that a file with Windows line ends was not read at all, so a CRLF stack B file would have passed as a stack A folder. `settingsOf` now splits on `\r?\n`, as the CLI's loader does, and the test covers both stacks for that file.
- Deviation within the plan's Interfaces: the wrong-stack message's source comes from `stackEnvIsSet()`, read at each run gate before `resolveStackEnv()`, which caches its result in the environment.

## T5: stack B worktree (2026-10-13)

Worktree `wt-b`, detached at `f80666a`, created by `git worktree add` with no `meat-ops-b` container or volume present. No other command ran in it before the steps.

- Steps 1 to 5, word for word, each exit 0. `npm ci` at 04:53:38Z. After `supabase start`, `docker ps --filter label=com.supabase.cli.project=meat-ops-b` listed exactly `supabase_auth_meat-ops-b` (9999/tcp), `supabase_db_meat-ops-b` (0.0.0.0:55322->5432/tcp, [::]:55322->5432/tcp), `supabase_kong_meat-ops-b` (0.0.0.0:55321->8000/tcp, [::]:55321->8000/tcp), and `supabase_rest_meat-ops-b` (3000/tcp) (AC-0003, AC-0004). `npm run db:reset:stack-b` applied all 6 migrations.
- AC-0018: `.env` has 2 lines, `SUPABASE_ANON_KEY` and `SUPABASE_URL`; the URL is `http://127.0.0.1:55321`, and both equal `API_URL` and `ANON_KEY` from `supabase status -o env` in the folder.
- Step 6, `E2E_PORT=3200 npm test`, 04:54:37Z to 04:56:01Z: exit 0 in 84 s, Vitest 25 files and 407 tests, Playwright 220 passed (AC-0009). A 5-second poll saw only `node 127.0.0.1:3200` listening on 3200, 13 times (AC-0001).
- AC-0006, stack B run: stack A's auth snapshot read `2026-10-13 04:53:01.931687+00 | 2026-10-13 04:51:26.105452+00` before and after. Stack B's read empty before and `2026-10-13 04:55:59.705652+00 | 2026-10-13 04:54:59.670506+00` after.
- AC-0005: `localStackRefusal` for port 55322 with a logging runner ran `lsof` for 55322 and 55321 only, read `com.docker.backend` as blocked, and returned `null`.
- AC-0008: `git status --porcelain` printed nothing after the run, after `touch supabase/.temp/new-file`, and after `printf v0.0.0 > supabase/.temp/cli-latest`.
- AC-0013: while `supabase db diff` ran, `lsof` saw `com.docker.backend` listening on `*:55320`, and nothing on 54320; the diff exited 0 with "No schema changes found".
- AC-0017, stack B: after `create table public.parallel_builds_probe(id int)` on stack B, step 3 (`supabase start`, already running, exit 0) and step 4 (`npm run db:reset:stack-b`, exit 0) left no such table, and `supabase_migrations.schema_migrations` listed exactly the 6 files in `supabase/migrations/`.
- AC-0014: `npm run test:e2e` with `E2E_PORT` unset exited 1 with "This folder's supabase/.env names its own Supabase stack, so set E2E_PORT to that stack's browser port (3200 for stack B)." and no build output.
- AC-0015: stack A's snapshot read the same before and after both cases.
  - With `SUPABASE_PROJECT_ID=meat-ops SUPABASE_API_PORT=54321 SUPABASE_DB_PORT=54322` in the environment, `npm test` and `E2E_PORT=3200 npm run test:e2e` each exited 1 with "...but this run would use API port 54321 and Postgres port 54322, from supabase status, so it could reach another folder's stack. Refusing to run." Vitest reported "no tests"; Playwright printed no build output.
  - With stack A's `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`, and `DB_URL` in the environment, both commands exited 1 with the same message ending "from the API_URL and DB_URL in the environment, so it could reach another folder's stack. Refusing to run."
- AC-0019: with both stacks running and the probe table on both, `SUPABASE_PROJECT_ID=meat-ops npm run db:reset:stack-b` exited 0; the table was gone from stack B and still on stack A.

## T5: stack A worktree (2026-10-13)

Worktree `wt-a`, detached at `f80666a`. No other command ran in it before the steps, and no vitest, playwright, or `next` process ran from any folder.

- Steps 1 to 4, word for word, each exit 0; `npm ci` at 04:57:48Z. Before the reset, stack A held the probe table left by AC-0019; after `supabase db reset`, it was gone and `schema_migrations` listed exactly the 6 files (AC-0017, stack A).
- AC-0018: `.env` has 2 lines; the URL is `http://127.0.0.1:54321`, and both equal `supabase status -o env` in the folder.
- Step 5, `npm test`, 04:58:40Z to 05:00:09Z: exit 0 in 89 s, Vitest 25 files and 407 tests, Playwright 220 passed (AC-0010).
- AC-0006, stack A run: stack B's auth snapshot read empty before and after, since AC-0019's reset had cleared it. Stack A's read empty before, after its reset, and `2026-10-13 05:00:08.28215+00 | 2026-10-13 04:59:05.620962+00` after.
- AC-0016, with stack A running and the probe table on it, `npm run db:reset:stack-b` in `wt-a` ran no reset and left the table: with no `supabase/.env`, exit 2; with the template followed by `SUPABASE_PROJECT_ID=meat-ops`, exit 1. The file was then removed and the table dropped.
- AC-0002: `E2E_PORT=abc npm run test:e2e` exited 1 with "E2E_PORT must be a whole number from 1 to 65535 with no leading zero, or unset for port 3100." and no build output.

## T5: both stacks at once (2026-10-13)

- No vitest, playwright, or `next` process ran from any other folder. `E2E_PORT=3200 npm test` in `wt-b` started at 05:00:36Z and `npm test` in `wt-a` at 05:00:38Z.
- AC-0007: a 5-second `lsof -nP -iTCP -sTCP:LISTEN` poll listed both `127.0.0.1:3100` and `127.0.0.1:3200` 14 times, first at 05:01:07Z. Stack B's run exited 0 at 05:02:17Z after 101 s, and stack A's exited 0 at 05:02:39Z after 121 s; each had Vitest 25 files and 407 tests and Playwright 220 passed. Neither came near the web server's 240-second start limit.

## T5: stop stack B (2026-10-13)

- AC-0012: `docker ps --filter label=com.supabase.cli.project=meat-ops` listed the same 12 names before and after `supabase stop --project-id meat-ops-b --no-backup`, run from the `meat-ops` folder (exit 0).
- AC-0011: afterwards, `docker ps -a` and `docker volume ls` filtered on `label=com.supabase.cli.project=meat-ops-b` each listed nothing.
- Both scratch worktrees were removed with `git worktree remove`.
