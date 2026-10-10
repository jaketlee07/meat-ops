# Verification ledger: local-ports

Execution observations, newest last. Each entry names the task, the command, and the observed result. No global IPv6 address or prefix of the Mac is recorded here.

## Gates before EXECUTE (2026-10-09)

- Pre-EXECUTE reviews closed after six rounds. Raw and adjudication artifacts are under the ignored `.context/reviews/b255718d-6ae7-44cb-a90c-c0d659d0b99d/`.
  - adversarial-reviewer: round 1 sustained 1 Blocker and 5 smaller findings, with 2 left undecided until the owner steered; rounds 2 to 5 sustained 6, 5, 1, and 3 advisory findings or Nits; round 6 returned `Clean — ready to commit.`
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
