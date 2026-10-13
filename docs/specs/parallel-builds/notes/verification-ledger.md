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

## Post-build review, round 1 (2026-10-13)

- Raw and adjudication artifacts: `1-post-gates-*` under the ignored `.context/reviews/bf4fca51-2642-4478-a3bb-9539c0a570e6/`.
- Sustained and fixed in `b1f54d9` and `6ab6efa`: a `port` query parameter on `DB_URL`, which pg obeys, slipped past the own-stack check (security and adversarial); the stack choice text in `AGENTS.md` lacked a concrete check before a reset or stop, the shell-variable exception, the browser-suite scope of `E2E_PORT`, and the reset when a folder moves back to stack A; and the overview's settings row did not say how to restart stack B.
- Undecided in two adjudications, settled by a read-only probe and the owner: the CLI 2.95.4 reads `  SUPABASE_PROJECT_ID=x`, `SUPABASE_PROJECT_ID: x`, and `SUPABASE_PROJECT_ID = x` (each made `supabase status` look for `supabase_db_x`). The owner chose to read lines as the CLI does. With either fix reverted, its new unit test failed; restored, all 8 own-stack tests passed.
- Refuted by adjudication: an automated test for the reset script (AC-0016 and AC-0019 are manual QA by the Testing Strategy), a printed reason from the reset script, an action clause in the own-stack messages, and a narrower AC-0014 matcher.

## T5 re-run at 6ab6efa (2026-10-13)

Every T5 Test ran again at `6ab6efa`, in new worktrees `wt-b2` and `wt-a2`, following the revised `AGENTS.md` steps word for word, check command included. Times are UTC.

- Start state at 05:26:18Z: no `meat-ops-b` container or volume; the check listed no folder.
- Stack B steps 1 to 6, each exit 0. `supabase start` gave exactly the four containers on 55321 and 55322 (AC-0003, AC-0004); the step 4 check listed nothing; `db:reset:stack-b` applied 6 migrations; `.env` held 2 lines equal to `supabase status` with URL `http://127.0.0.1:55321` (AC-0018); `E2E_PORT=3200 npm test` exit 0 in 91 s, Vitest 25 files and 408 tests, Playwright 220 passed (AC-0009), with only `node 127.0.0.1:3200` seen listening on 3200, 14 polls (AC-0001).
- AC-0006, stack B run: stack A's snapshot read `2026-10-13 05:24:27.815818+00 |` before and after; stack B's went from empty to `2026-10-13 05:28:26.626235+00 | 2026-10-13 05:27:23.16768+00`.
- AC-0005: the logged network check ran `lsof` for 55322 and 55321 only and returned `null`. AC-0008: `git status --porcelain` empty after the run, after creating `supabase/.temp/new-file`, and after changing `cli-latest`. AC-0013: `com.docker.backend` listened on `*:55320` during `supabase db diff` ("No schema changes found"). AC-0017, stack B: steps 3 and 4 exit 0, probe table gone, migrations match.
- AC-0014: exit 1 with the own-stack port message and no build output.
- AC-0015, stack A's snapshot unchanged across all three cases, each refused before any test ("no tests") and with no build output: the CLI reporting stack A (message ends "from supabase status"); stack A's four values in the environment ("from the API_URL and DB_URL in the environment"); and stack B's values with `DB_URL` ending `?port=54322` ("would use API port 55321 and Postgres port 54322").
- AC-0019: `SUPABASE_PROJECT_ID=meat-ops npm run db:reset:stack-b` exit 0; probe table gone from stack B, still on stack A.
- Stack A steps 1 to 5, each exit 0. The step 3 check listed one folder, `/Users/jakelee/Documents/mobilizeNow/mobilize`, another project's `next dev`, which led to the `AGENTS.md` wording fix below; no `meat-ops` worktree was listed. The reset removed the probe table and the migrations match (AC-0017); `.env` matched with URL `http://127.0.0.1:54321` (AC-0018); `npm test` exit 0 in 114 s, Vitest 25 files and 408 tests, Playwright 220 passed (AC-0010).
- AC-0006, stack A run: stack B's snapshot read empty before and after; stack A's went from empty to `2026-10-13 05:31:47.044394+00 | 2026-10-13 05:30:26.007777+00`.
- AC-0016 in `wt-a2` with stack A running and the probe table on it: no `supabase/.env` gave exit 2, and the template plus `SUPABASE_PROJECT_ID=meat-ops` gave exit 1; the table survived both and was then dropped. AC-0002: `E2E_PORT=abc` exit 1 with the bad-port message and no build output.
- AC-0007: B started 05:31:49Z and A 05:31:51Z; both listeners were up together on 13 polls, first at 05:32:15Z; B exit 0 in 87 s and A exit 0 in 104 s, each Vitest 408 tests and Playwright 220 passed.
- Stop: the check listed no folder; `supabase stop --project-id meat-ops-b --no-backup` exit 0; stack A's 12 containers were the same before and after (AC-0012); no `meat-ops-b` container or volume remained (AC-0011). Both worktrees were removed.
- After the re-run, `AGENTS.md` says a listed folder outside `git worktree list` belongs to another project. The change is to one explanatory sentence; no step's command changed.

## Post-build review, round 2 (2026-10-13)

- Artifacts: `2-post-gates-*` under the same ignored review folder.
- Sustained and fixed in `5504512` and `5db4963`: the check's folder rule counted any worktree with a `supabase/.env` as stack B, though a stack A folder may keep one for Studio's key (all three reviewers); the check was not named before test runs; and AC-0010 needed a word-for-word run at the shipped `AGENTS.md` text.
- Settled by read-only probes and the owner's choice to fail closed: the CLI 2.95.4 also reads a setting after a quoted value on the same line (`OPENAI_API_KEY="k" SUPABASE_PROJECT_ID=x`) and bare-CR line ends (each made `supabase status` look for `supabase_db_x`); and pg reads `...:54322/postgres?p%6Frt=55322&x=%zz` as port 54322 while WHATWG `URL` reads the parameter as 55322. The own-stack check now counts any non-comment line where `SUPABASE_PROJECT_ID` meets `=` or `:`, splits lines at a bare CR, and refuses a `DB_URL` that pg would re-encode. With these fixes reverted, the 2 new tests failed; restored, all 10 own-stack tests passed.

## T5 run at 5db4963 (2026-10-13)

Every T5 Test ran again at `5db4963` in new worktrees `wt-b3` and `wt-a3`, following the shipped `AGENTS.md` steps word for word, check included. Times are UTC. The check listed only folders under `/Users/jakelee/mobilize-wt/`, another project's worktrees, which the steps say use neither stack; no `meat-ops` worktree was ever listed.

- Start, 05:59:11Z: no `meat-ops-b` container or volume.
- Stack B steps 1 to 6, each exit 0: the four containers on 55321 and 55322 (AC-0003, AC-0004); `db:reset:stack-b` applied 6 migrations; `.env` matched `supabase status` with URL `http://127.0.0.1:55321` (AC-0018); `E2E_PORT=3200 npm test` exit 0 in 90 s, Vitest 25 files and 410 tests, Playwright 220 passed (AC-0009); only `node 127.0.0.1:3200` listened on 3200, 14 polls (AC-0001).
- AC-0006, stack B run: stack A's snapshot `2026-10-13 05:58:42.308933+00 |` before and after; stack B's from empty to `2026-10-13 06:01:18.92531+00 | 2026-10-13 06:00:16.318214+00`.
- AC-0005: `lsof` for 55322 and 55321 only, result `null`. AC-0008: `git status --porcelain` empty after the run, a created file, and a changed file under `supabase/.temp/`. AC-0013: `com.docker.backend` on `*:55320` during `supabase db diff`. AC-0017, stack B: steps 3 and 4 exit 0, probe gone, migrations match. AC-0014: exit 1 with the own-stack port message, no build output.
- AC-0015, stack A's snapshot unchanged across four cases, each refused before any test and with no build output: the CLI reporting stack A ("from supabase status"); stack A's four values in the environment ("from the API_URL and DB_URL in the environment"); stack B's values with `?port=54322` ("would use API port 55321 and Postgres port 54322"); and stack B's values with `?p%6Frt=54322&x=%zz` ("DB_URL has a space or a stray %").
- AC-0019: exit 0; probe gone from stack B, still on stack A.
- Stack A steps 1 to 5, each exit 0: the reset removed the probe and the migrations match (AC-0017); `.env` matched with URL `http://127.0.0.1:54321` (AC-0018); `npm test` exit 0 in 92 s, Vitest 410 tests, Playwright 220 passed (AC-0010). AC-0006, stack A run: stack B's snapshot empty before and after; stack A's from empty to `2026-10-13 06:04:12.984673+00 | 2026-10-13 06:03:06.300124+00`.
- AC-0016 with stack A running and the probe on it: exit 2 with no `supabase/.env`, exit 1 with the template plus `SUPABASE_PROJECT_ID=meat-ops`; the probe survived both. AC-0002: exit 1 with the bad-port message, no build output.
- AC-0007: B started 06:04:15Z and A 06:04:17Z; both listeners up together on 13 polls, first at 06:04:41Z; B exit 0 in 89 s, A exit 0 in 111 s, each Vitest 410 tests and Playwright 220 passed.
- Stop: `supabase stop --project-id meat-ops-b --no-backup` exit 0; stack A's 12 containers unchanged (AC-0012); no `meat-ops-b` container or volume left (AC-0011). Both worktrees removed.

## Post-build review, round 3 (2026-10-13)

- Artifacts: `3-post-gates-*` under the same ignored review folder. quality-engineer returned Clean. security-reviewer and adversarial-reviewer each returned one Nit; the owner chose to record both as known gaps rather than change code again, so neither was dispatched for adjudication.
- Deferred Nit, security (`test/env.ts:154`): hand-made `supabase/.env` content still steers the CLI past the own-stack check. Read-only probes on 2026-10-13 showed the CLI 2.95.4 setting the project from a carriage return inside the name (`SUPABASE_PROJECT_ID\r=x`), from a setting after a quoted value that closes on a line starting with `#`, and from `supabase/.env.local`, none of which the check reads. The `AGENTS.md` steps create none of them.
- Deferred Nit, adversarial (`AGENTS.md:144`): the check treats a listed folder from another project as using neither stack, but the `mobilize` worktrees' `supabase/config.toml` sets stack A's ports, 54321 and 54322. At 06:16Z no process other than Docker held a connection to either port, and `mobilize` had no Supabase containers.
