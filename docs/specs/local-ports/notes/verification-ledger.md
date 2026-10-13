# Verification ledger: local-ports

Execution observations, newest last. Each entry names the task, the command, and the observed result. No global IPv6 address or prefix of the Mac is recorded here.

## Gates before EXECUTE (2026-10-09)

- Pre-EXECUTE reviews closed after six rounds. Raw and adjudication artifacts are under the ignored `.context/reviews/b255718d-6ae7-44cb-a90c-c0d659d0b99d/`.
  - adversarial-reviewer: round 1 sustained 1 Blocker and 5 smaller findings, with 2 left undecided until the owner steered; rounds 2 to 5 sustained 6, 5, 1, and 3 advisory findings or Nits; round 6 returned Clean.
  - security-reviewer: rounds 1 to 5 sustained 5, 5, 3, 3, and 3 advisory findings or Nits; round 6 returned 2 Nits, deferred below.
  - shaping-reviewer: 10, 5, 5, 3, 3, 2, and 1 findings in rounds 1 to 7 (the last two on Assumptions and one Testing Strategy line); Clean in round 8 on commit `87d6c98`.
- Deferred Nits from security round 6:
  - A failed-block exit entry records that `supabase stop` ran, not whether it succeeded; a stop that errors before pruning could leave a container that the next Docker launch restarts (`spec.md` Boundaries, `plan.md` T3). On a failed block, T3 also records `docker ps -a --filter label=com.supabase.cli.project=meat-ops` after the stop.
  - T4's Approach no longer repeats the block read-back between `supabase stop --no-backup` and `supabase start`. T4's pinned Tests require it there, and `supabase start` does not run unless all three reads show the block.
- Owner decisions in chat on 2026-10-09 are recorded in the spec's Assumptions. The owner turned the block on in their own Terminal before approval; the reads afterwards were `Firewall is enabled. (State = 1)`, `Incoming connection to /Applications/Docker.app/Contents/MacOS/com.docker.backend is blocked.`, and `Automatically allow downloaded signed software DISABLED.` Loopback still reached 54321 to 54324 and 54327; this Mac's own Wi-Fi address also still reached them, so a probe from this Mac proves nothing for other devices.
- Owner approved the spec, then the plan, in chat on 2026-10-09; `approve-plan` recorded the baseline, `schedule` set four sequential waves (T1 to T4), and `plan check-current` passed after `plan-locked`.

## T1 (2026-10-09)

- Executed by the `implementer` subagent; controller reran every gate.
- Stub materialized byte-identical at `test/network.test.ts` (sha256 b9e12c0a…441f60, checked before any edit); observed red: "Failed to load url ./network.js". The file then grew to 30 cases.
- Deviations within Behavior & rules: `--getallowsigned` must print exactly the built-in line, then the downloaded line; empty `lsof -Fp` output gives the "Found no program serving port" refusal, as a `null` result does.
- Six stray Finder-style copies in the ignored `.next/` build folder (`routes.d 3.ts` and five others) broke `npm run typecheck` with duplicate identifiers. They were deleted; the build regenerates `.next`.
- Controller gates: `npm run typecheck` exit 0; `npx vitest run test/network.test.ts` exit 0, 30 passed in 1.1 s.

## T2 (2026-10-09)

- Executed by the controller. `test/global-setup.ts` and `playwright.config.ts` call `localStackRefusal` right after `resolveStackEnv()`, with the port from `DB_URL` and `realRunner`, and throw its message. The overview gains `Keep the local stack on this Mac`; its `private.operators` paragraph, Network bullet, and `test/` row point to it; `AGENTS.md` "Build and test commands" links to it.
- Controller gates, block on: `npm run typecheck` exit 0; `npm test` exit 0 in 218 s, Vitest 384 passed (22 files), Playwright 220 passed (AC-0006). No vitest or playwright process from another worktree was running.
- AC-0009: `nc -z -G 2 127.0.0.1 <port>` succeeded for every published stack port: 54321, 54322, 54323, 54324, and 54327.

## T3, first window (2026-10-12, stopped at state 1)

- State 1: the owner ran `--unblockapp` on `com.docker.backend` in their own Terminal. Reads: `Firewall is enabled. (State = 1)`, `Incoming connection to /Applications/Docker.app/Contents/MacOS/com.docker.backend is permitted.`, `Automatically allow downloaded signed software DISABLED.`
- AC-0002: `npm test` exit 1 and `npm run test:e2e` exit 1, each with "The macOS firewall lets other devices reach /Applications/Docker.app/Contents/MacOS/com.docker.backend, which serves the local Supabase stack's port 54322. Refusing to run. See "Keep the local stack on this Mac" in docs/architecture/overview.md." No test ran, and `npm run test:e2e` printed no build output. No vitest or playwright process from another worktree was running.
- AC-0010 control, not met: on the owner's phone, Studio at `http://192.168.1.80:54323` stayed loading, and `http://192.168.1.80:54321` ended with Safari's "the server stopped responding". A 2-minute `netstat` watch on the Mac saw no connection from another device to 54321, 54323, or 54324. Per the plan, T3 stopped; state 2, state 3, and both cellular attempts did not run.
- Exit: the owner ran `--blockapp` in their own Terminal; read back at 14:53 CDT: `Firewall is enabled. (State = 1)`, `... com.docker.backend is blocked.`, `Automatically allow downloaded signed software DISABLED.` Nothing else ran during the window.
- Diagnosis after the stop: the phone's Wi-Fi address was `192.168.1.73` and its IPv6 addresses share the Mac's home prefix, so it was on the same network. The Mac pinged it (2 of 4 replies). A throwaway page with no data behind it, served by Python on port 8765 for at most 5 minutes, loaded on the phone at 15:04:31, then was stopped. Why the first unblock did not let the phone reach Docker's ports is unknown; the retry below worked. Starting that page made macOS add an allow entry for Xcode's `Python.app`; the owner can remove it with `socketfilterfw --remove`.

## T3, second window (2026-10-12, completed)

- State 1: the owner ran `--unblockapp` again; the block read `... com.docker.backend is permitted.` from 15:09:31.
- AC-0010: on the same Wi-Fi, the phone loaded `http://192.168.1.80:54321`, Studio at `http://192.168.1.80:54323`, and Studio at a global IPv6 address of the Mac. The Mac's `netstat` showed established connections from `192.168.1.73` to 54321 and 54323 and over IPv6.
- AC-0002 again: `npm test` exit 1 and `npm run test:e2e` exit 1, each with the "lets other devices reach ... com.docker.backend ... port 54322" refusal. No vitest or playwright process from another worktree was running before these runs, nor before the state 2 runs, the `npm test` after the window, or the `npm test` after the T4 rebuild.
- Cellular attempt with Docker unblocked: with Wi-Fi off, the phone opened Studio at the Mac's global IPv6 address and showed Studio's dark page; the Mac saw connections from an IPv6 prefix outside the home network. The home gateway passes unsolicited inbound IPv6, so before the block the stack was reachable from the internet, not only the home Wi-Fi.
- State 2: the owner ran `--setglobalstate off`; read `Firewall is disabled. (State = 0)`.
- AC-0001: `npm test` exit 1 and `npm run test:e2e` exit 1, each with "The macOS firewall is off, so other devices can reach the local Supabase stack. Refusing to run. See "Keep the local stack on this Mac" in docs/architecture/overview.md." No test ran, and no build output appeared.
- State 3 and exit: the owner ran `--setglobalstate on` and `--blockapp`, and closed the earlier Safari tabs. Read back at 15:15:19 and again at 15:17:49: `Firewall is enabled. (State = 1)`, `... com.docker.backend is blocked.`, `Automatically allow downloaded signed software DISABLED.` No connection from another device was open at 15:15:19. Nothing else ran during either opening.
- AC-0007: on the same Wi-Fi, `http://192.168.1.80:54323/?after` failed to load.
- AC-0011: on the same Wi-Fi, Studio at the global IPv6 address with `?after` failed to load.
- Cellular attempt with the block on: with Wi-Fi off, the same IPv6 address with `?after2` failed to load. A 7-minute `netstat` watch from 15:15 saw no established connection from another device; the phone's cellular attempts reached only `SYN_RCVD` (15:17:14 to 15:18:01), and the remaining entries were state 1 connections closing. No failed block occurred.
- After the window: `npm test` exit 0 in 230 s, Vitest 384 passed (22 files), Playwright 220 passed.
- The recorded `socketfilterfw` lines match T1's fixtures, so the fixtures and parsers did not change.

## T4 (2026-10-12)

- Preconditions: AC-0010 recorded both loads, AC-0007 and AC-0011 each recorded a failed load, and no phone load succeeded with the block on. The stack held only the six migrations in `supabase/migrations/`; neither `meat-ops-sales` nor `meat-ops-invoice` had added one; no vitest or playwright process was running. The owner gave the go-ahead in chat.
- Rebuild from the `meat-ops` worktree, started 2026-10-12T20:43:44Z: `supabase stop --no-backup` exit 0, leaving 0 stack containers and 0 stack volumes.
- AC-0012 read-back just before `supabase start` (15:43:48 CDT): `Firewall is enabled. (State = 1)`, `Incoming connection to /Applications/Docker.app/Contents/MacOS/com.docker.backend is blocked.`, `Automatically allow downloaded signed software DISABLED.` Then `supabase start` exit 0.
- Seed: `docker exec -i supabase_db_meat-ops psql -U postgres -v ON_ERROR_STOP=1 < supabase/seed.sql` exit 0.
- AC-0012: `docker volume ls --filter label=com.supabase.cli.project=meat-ops` lists `supabase_db_meat-ops` (created 2026-10-12T20:43:48Z) and `supabase_storage_meat-ops` (created 20:44:05Z), both after the start time.
- AC-0015: `supabase_migrations.schema_migrations` lists exactly the 6 files in `supabase/migrations/`.
- AC-0014: `supabase/snippets/` holds 0 files in `meat-ops`; `meat-ops-invoice` and `meat-ops-sales` have no such folder.
- The app's `.env` values for `SUPABASE_URL` and `SUPABASE_ANON_KEY` still match the rebuilt stack's.
- `npm test` exit 0 in 89 s, Vitest 384 passed (22 files), Playwright 220 passed.
- The local owner account, if one was made, is gone; re-create it with the overview's three steps. The other worktrees' next test run recreates their test users.

## Review fixes (2026-10-12)

- Post-gates review round 1: adversarial-reviewer, security-reviewer, and quality-engineer each returned no Blocker. Two adjudications held one question each for the owner; the owner decided both in chat.
- Firewall side effect: the controller started the T3 diagnosis page, which made macOS add an allow entry for Xcode's `Python.app` without a prompt, because built-in signed software is allowed automatically. That changed the application firewall from the agent session, against the spec's Never do. The owner chose to remove it and ran `--remove` in their own Terminal; read back at 19:50 CDT, the app list holds no `Python.app` entry, `com.docker.backend` is blocked, and automatic allow for downloaded signed software is off. The `/usr/bin/python3` entry was already listed on 2026-10-09, before any change in this work. Built-in signed automatic allow stays on.
- The owner kept the check's own unit tests behind the shared global setup; the overview says how to run them while the check refuses.
- `test/network.ts`: the program lookup now refuses unless its output is exactly the requested pid's line followed by `ftxt` and absolute-path pairs; the non-macOS message names the check once.
- `test/network.test.ts`: six new cases (a second permitted program on one port, a program missing from the firewall's list, the database port used to find the stack, a pid line without its prefix, an unpublished entry other than `<port>/tcp`, and a program lookup for another pid or with an extra line); labels now name the criterion or rule each case checks. 36 cases.
- Mutation proof: each of seven rule breaks in `test/network.ts` (first pid only, no `<port>/tcp` check, no pid-line check, a fixed database port, an ignored pid line, ignored extra lookup lines, a missing automatic-allow read treated as a pass) turned `npx vitest run test/network.test.ts` red; the file was restored byte for byte.
- `--getappblocked` for a program not in the firewall's list prints `Incoming connection to <path> is permitted.` (recorded with `/usr/bin/true`), so a lost Docker entry gives the refusal that names the program and port.
- The overview lists every refusal kind with its next step.
- Gates: `npm run typecheck` exit 0; `npm test` exit 0 in 97 s, Vitest 390 passed (22 files), Playwright 220 passed; no test process from another worktree was running.
