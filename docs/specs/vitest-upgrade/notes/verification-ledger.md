# Verification ledger: vitest-upgrade

Execution observations, newest last. Each entry names the task, the command,
and the observed result. All work ran on 2026-10-13 on this Mac (Node 22.17.0,
npm 11.4.2), in the `meat-ops` folder on stack A.

## Gates before EXECUTE

- Pre-EXECUTE reviews closed after seven rounds. Raw and adjudication artifacts are under the ignored `.context/reviews/b99cbaf0-c982-49cb-8025-b10212f9bcbf/`, with round dispositions in `dispositions.md` there.
  - adversarial-reviewer: 5, 2, 3, 4, 3 findings in rounds 1 to 5; byte-exact Clean in round 6.
  - security-reviewer: 4, 3, 2, 2 findings in rounds 1 to 4; Clean in rounds 5 and 6 (each footer adjudicated clean).
  - shaping-reviewer: 7, 4, 4, 4, 1, 2, 1 findings in rounds 1 to 7, all advisory from round 5 on; the round-7 wording point was applied as a nonmaterial correction to working material.
- Owner decisions on 2026-10-13: Vitest 5.0.3 under `--before=2026-10-06`; no `vite` line; full mode; a zero-advisory audit; install scripts off repo-wide through `.npmrc` (in place of an extracted-file scan the reviews kept widening); a CSS check that isolates the package change; GitHub Dependabot alerts turned on for the repository (`gh api -X PUT repos/jaketlee07/meat-ops/vulnerability-alerts`, 204).
- The owner approved the spec, then the plan, in chat; `approve-plan` recorded the baseline, `schedule` set two waves (T1, then T2), and `plan check-current` passed after `plan-locked`.
- Tasks ran in-session, not through the `implementer` subagent: both share stack A's test runs and a strict check-then-install order, and T1 changes four small files.
- Owner-approved cleanup outside the diff: three untracked duplicates in `src/app/` (`before-after 2.tsx`, `facts 2.tsx`, `stock-view 2.ts`), each byte-identical to its tracked file, were deleted.

## T1

- Before the first stack A run, the `AGENTS.md` check listed only `/Users/jakelee/mobilize-wt/ios-people`, another project on neither stack; `meat-ops-invoice` and `meat-ops-sales` name no own stack; stack A held this branch's six migrations.
- Base evidence at `67271dd` (Vitest 2.1.9): `npm ls --package-lock-only --omit=dev --all` saved (95 lines); `npx vitest run --reporter=json` exit 0 in 41 s, 25 files, 410 tests, 410 passed, 0 failed, 0 pending.
- `.npmrc` added with `ignore-scripts=true` and the comment the spec's Durable Outputs row requires.
- Resolution: `npm uninstall vitest --package-lock-only`, then `npm install --package-lock-only --save-dev vitest@^5 --before=2026-10-06`, both exit 0. The lockfile resolves Vitest 5.0.3, Vite 8.3.2, rolldown 1.2.12, and is byte-identical to the pre-approval probe's lockfile.
- AC-0001, on the lockfile with Vitest 2.1.9 still installed: `npm audit --package-lock-only --json` exit 0, `metadata.vulnerabilities` all 0, `total` 0.
- AC-0003, same point: 56 new lockfile entries, each published before 2026-10-06T00:00:00Z per `npm view <name> time`; the newest are 2026-10-05 (`magic-string` 1.4.3, `postcss` 8.5.29); 0 on or after the cutoff.
- AC-0011, working tree before the first `npm ci`: `.npmrc` has one effective line, `ignore-scripts=true`; `npm config get ignore-scripts` printed `true`; no `npm_config_` variable in the environment.
- `npm ci` exit 0: 183 packages added, 0 vulnerabilities; Vitest 5.0.3 and Vite 8.3.2 installed; `esbuild`, `tinypool`, and `vite-node` absent from `node_modules`.
- `vitest.config.ts`: `poolOptions` deleted; the comment states both rules and their reasons.
- AC-0002: `git diff 67271dd -- package.json` shows one changed line, `"vitest": "^2.1.0"` to `"vitest": "^5.0.3"`.
- AC-0004: the new `npm ls --package-lock-only --omit=dev --all` matches the base's below the first line (95 lines, `diff` exit 0).
- AC-0006: `npm run typecheck` exit 0.
- Committed as `e4a727b`. AC-0011 on `git show HEAD:.npmrc`: one effective line, `ignore-scripts=true`.
- AC-0012: two copies from `git archive HEAD`, one with `package.json` and `package-lock.json` from `67271dd`. In each, `.npmrc` present, `npm config get ignore-scripts` printed `true`, no `.next`; `npm ci` exit 0; `npm run build` exit 0. Each wrote one CSS file, `chunks/0ob97dshv6eat.css`, sha256 `231258fcd821d73f5c0b258622c08ee998d789a222c7c6bcf7d345023448f6b5`.

## Wave 1 gates

- `npm run typecheck` exit 0; `npm test` exit 0 in 169 s at `e4a727b`: Vitest 5.0.3, 25 files and 410 tests passed; Playwright 220 passed. The `[WebServer] … failed at write` lines in the log are the browser suite's refusal cases.

## T2

- Before each stack A run, the `AGENTS.md` check listed only `/Users/jakelee/mobilize-wt/ios-people`, another project on neither stack.
- AC-0007: `npx vitest run --reporter=json` exit 0 in 52 s. Keyed by path from the repository root, the base report and this one list the same 25 files, and each file has the same passed count (410 in all, 0 differences); `test/costing.test.ts` 7 and 7, `test/pricing.test.ts` 29 and 29. No `.vitest` folder was written.
- AC-0009: `API_URL=http://10.255.255.1:54321 npx vitest run` exit 1. The output names `Error: API_URL host is not local (expected 127.0.0.1 or localhost). Refusing to run.` at `test/global-setup.ts:16:15`, and has no test result line and no `Test Files` summary.
- AC-0010: the overview's two lines, pasted as written, from the repository root: exit 0, `Test Files 1 passed (1)`, `Tests 39 passed (39)`; `npx vitest list --filesOnly` with the same config lists only `test/network.test.ts`.

## Wave 2 gates and AC-0008

- macOS firewall on (`socketfilterfw --getglobalstate`: enabled); the run's own network check passed before any test.
- `npm run typecheck` exit 0; `npm test` exit 0 in 201 s at `e4a727b`: Vitest 5.0.3, 25 files and 410 tests passed; Playwright 220 passed. This run is AC-0008's observation.
