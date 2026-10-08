# Verification ledger: receiving

Execution observations, newest last. Each entry names the task, the command, and the observed result.

## Gates before EXECUTE (2026-10-08)

- Pre-EXECUTE reviews closed clean after five rounds: adversarial (direct clean, round 5), security (adjudicated clean, round 5), shaping (Clean, round 4; the spec is unchanged since). Raw and adjudication artifacts are under the ignored `.context/reviews/8bd1023d-4bec-4e12-a2b5-8d29179b0f2c/`.
- Owner approved the spec, then the plan, in chat on 2026-10-08; `approve-plan` recorded the baseline and `plan check-current --require-schedule` passed after `plan-locked`.
- project-knowledge unavailable: `--capture --producer-profile work-loop --semantic-gate plan-locked` refused with `staged_dual_writer` (the legacy knowledge base is not migrated). No fallback file was created. The spec-approved gate had no reusable spec-authoring practice to admit.

## T1 (2026-10-08)

- Executed by the `implementer` subagent in the primary working tree; controller reran every check.
- Baseline before install: `npm test` 107 passed (5 files). After: 107 passed (5 files).
- `npm run typecheck` exit 0; `npm run build` exit 0 (routes `/`, `/_not-found`).
- AC-0060: 27 of 27 runs (9 check names x build, start, dev) exited 1, printed the name, and printed no marker (scratch `ac0060.mjs`).
- AC-0063: `npm run start` and `npm run dev` process trees each held one listener, on `127.0.0.1` (scratch `ac0063.mjs`).
- AC-0064 grep and the three AC-0039 greps print nothing.
- `npx playwright test --list` loads the config (the localhost guard fires on a non-local `API_URL`); with no spec yet it exits 1 "No tests found". T5 adds the first spec.
- Deviation: `test:e2e` is `PLAYWRIGHT_FORCE_ASYNC_LOADER=1 playwright test`. On Node 22.17 with Playwright 1.64 the default synchronous module hooks fail to load `@supabase/supabase-js` ("Unexpected module status 3"); the variable is read in `node_modules/playwright/lib/common/index.js`. T5's `test` script calls `npm run test:e2e` after Vitest.
- Deviation: `next.config.ts` sets `agentRules: false`, a Next.js 16.4 option, because `next dev` otherwise appends a managed block to `AGENTS.md`.
- Controller fix: `npm update source-map-js` moved only `source-map-js` 1.2.1 to 1.2.2 (GHSA-68fv-2mgg-jv7q, high, via `@tailwindcss/postcss`); `npm run audit` now reports 0 vulnerabilities in shipped dependencies.
- Observed, out of scope: `npm audit` including dev dependencies reports 2 critical, 1 high, and 3 moderate advisories, all in the `vitest` 2.1.9 tree already on `main` (`tinypool`, `vite`, `vite-node`, `esbuild`, `@vitest/mocker`); fixing them needs a major Vitest upgrade.
