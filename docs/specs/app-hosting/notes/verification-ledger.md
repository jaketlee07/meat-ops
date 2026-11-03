# Verification ledger: app-hosting

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts sit under the ignored `.context/reviews/dc02f06e-d303-4031-ac54-db279a0df45f/`.

## Owner decisions (2026-10-27)

- Round-1 adversarial finding 1 (the desktop install check could pass with no install file) came back indeterminate: the adjudicator could not read the page title or Chrome's install behavior. The page title is "Meat Ops" on every page (`src/app/layout.tsx`, the only metadata export). The owner ruled that the check starts the install from `/production` and the installed app must then launch on `/receiving` with the MO icon, which only a working install file produces (AC-0011 and AC-0015).
- Round-1 adversarial finding 2 (this spec narrows the receiving Host check): the owner chose to state the narrowing in this spec's "Constrained by" line and in the overview, and not to annotate the shipped receiving spec.

## Spec-stage review

| Round | Adversarial | Security | Shaping |
| ---: | --- | --- | --- |
| 1 | 2 Concerns, 7 Nits, 1 indeterminate settled by the owner | 1 Concern, 5 Nits | 3 Medium, 4 Low |
| 2 | 8 Nits | 2 Nits | 1 Medium, 4 Low |
| 3 | 4 Nits | 1 Nit | 2 Low |
| 4 | 1 Nit | 1 Nit | 1 Low |
| 5 | Clean | Clean (footer adjudicated) | 1 Low |
| 6 | Clean | Clean (footer adjudicated) | Clean |

## Paused for the Next.js security upgrade (2026-10-27)

- `npm run audit` reports Next.js 16.0.0 to 16.4.0 critical (GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr) and high (GHSA-p3m5-59mp-jv5r), each first patched in 16.4.1. A scratch `next build` stopped once with `SecurityFatalError` to recommend the upgrade, and a rerun of the same build finished.
- The owner chose to upgrade Next.js on its own branch first. The run stays in `SPEC-PLAN-DRAFTING` with the round-3 repairs applied. On resume: rebase onto the upgrade's merge, move the Never-do pin from `8d3f847` to that merge commit, fire `spec-ready`, and review the delta in round 4.
- 2026-10-28: resumed. The upgrade merged as PR #39 (`d96a997`), and this folder fast-forwarded to it, reinstalled with `npm ci --ignore-scripts`, and rebuilt on Next.js 16.4.2. The spec's and plan's `git diff` pins and the installed-version Assumption moved to `d96a997` and 16.4.2. The round-3 text for the round-4 change list was rebuilt from the round-3 repair command, and every line round 3 added is in it.

## Approval (2026-10-28)

- The owner approved the spec and then the plan in chat on 2026-10-28, after spec-stage round 6 came back clean from all three reviewers.
- Work-loop run `dc02f06e-d303-4031-ac54-db279a0df45f`. `approve-plan` recorded spec hash `5ed313131caf…` and plan hash `6d877eb35af3…`. The schedule runs T1, then T2 and T3, then T4, T5, and T6, one task at a time.
- Base: `d96a997` on branch `feat/app-hosting` in the main folder, on stack A.
- Project knowledge: capture at the spec and plan gates was not attempted; it refused with `strict_parse` in earlier runs, so this run records it as unavailable.


## T1

- 2026-10-28: `test/allowed-host.test.ts` was copied from the plan's stub, and `shasum -a 256` printed `0b32bbde498f3076ad733ee9e425e661ccd376f5b330643aae45c99999b935d4`, the expected hash.
- The Docker daemon was not running, so `supabase status` failed and the repository's Vitest global setup could not start. The Vitest runs below used a scratch config outside the repository, with no global setup and only this file included. The table needs no database.
- Red run: with `src/allowed-host.ts` holding today's local-only rule, Vitest ran 1 failed and 3 passed. The AC-0002 test failed.
- Exact rule: 4 of 4 passed.
- Mutation runs, each put into the real `src/allowed-host.ts` on the final `return` line, run once, then the exact rule restored (the file matched the saved exact copy afterward, and the file passed 4 of 4 again):
  - Suffix match (`endsWith`): 1 failed, 3 passed. The AC-0004 test failed.
  - Port-blind compare (the header cut at the first colon): 1 failed, 3 passed. The AC-0004 test failed.
  - Regular expression built from `APP_HOST` without escaping: 1 failed, 3 passed. The AC-0004 test failed.
  - Compare that lowercases only the header: 1 failed, 3 passed. The AC-0002 test failed.
  - Compare with no empty-`APP_HOST` guard: 1 failed, 3 passed. The AC-0005 test failed.
- `npm run typecheck` passed. The browser tests were not run in the implementer's session, because stack A was down.
- 2026-10-29, after Docker and stack A were started again (no reset): `npx playwright test test/e2e/hosting.spec.ts test/e2e/auth.spec.ts` passed 24 of 24 in 13 s, including the AC-0002, AC-0003, AC-0004, AC-0005, AC-0012, AC-0014, and AC-0017 tests and the foreign-or-missing-Host tests in `auth.spec.ts`. The folder check listed no other folder. `npm test` then passed: Vitest 53 files and 1,043 tests, `test/allowed-host.test.ts` among them under the repository's own config, then the browser suite 675 passed, 584 s in all.


## T2

- 2026-10-29: red run. With `secure: true` removed from `SESSION_COOKIE_OPTIONS`, `npx playwright test test/e2e/hosting.spec.ts test/e2e/auth.spec.ts` ran 2 failed and 24 passed in 11.3 s. The AC-0001 test failed (the sign-in cookie `sb-127-auth-token` had `secure` false) and the AC-0016 test failed (its `Set-Cookie` line had no `Secure`). The `auth.spec.ts` sign-in cookie test still passed.
- Green run. With `secure: true` restored, the same command passed 26 of 26 in about 12 s, the AC-0001 and AC-0016 tests and the `auth.spec.ts` "sign-in ends on the receiving form, with HttpOnly SameSite=Lax cookies" test among them. `npm run typecheck` passed. The folder check listed no other folder. The full `npm test` was left to the controller.
- 2026-10-29: `npm test` passed after the folder check listed no other folder: Vitest 53 files and 1,043 tests, then the browser suite 677 passed, 744 s in all. `npm run typecheck` passed.

## T3

- 2026-10-29: red run. With the four new paths removed from the proxy's early return and the app rebuilt, `npx playwright test test/e2e/hosting.spec.ts test/e2e/auth.spec.ts` ran 4 failed and 28 passed in 14.3 s. The AC-0007 test got status 307 (the redirect to `/sign-in`) instead of 200. The AC-0008, AC-0013, and corner-pixel tests failed the same way. The foreign-Host test still passed, because the Host check runs before the early return.
- Green run. With the paths restored and the app rebuilt, the same command passed 32 of 32 in about 12 s, including the AC-0007, AC-0008, AC-0009, AC-0010, and AC-0013 tests, the corner-pixel pin, and the foreign-Host test with the four new paths. `npm run typecheck` passed.
- `npm run build` lists `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, and `/manifest.webmanifest` as static routes. `git diff d96a997 -- package.json package-lock.json` printed nothing. The folder check listed no other folder.
- 2026-10-29: `npm test` passed after the folder check listed no other folder: Vitest 53 files and 1,043 tests, then the browser suite 683 passed, 990 s in all. `npm run typecheck` passed.

## T4

- 2026-10-29: red run. With the `Strict-Transport-Security` line removed from `next.config.ts` and the app rebuilt by the Playwright run, `npx playwright test test/e2e/hosting.spec.ts -g "AC-0006"` ran 2 failed in 6.6 s. The signed-out test failed on `/sign-in` (header undefined, not `max-age=31536000`), and the signed-in `/receiving` test failed the same way.
- Green run. With the line restored, `npx playwright test test/e2e/hosting.spec.ts test/e2e/menu.spec.ts test/e2e/auth.spec.ts` passed 58 of 58 in 26.3 s, the two AC-0006 tests and the framing tests in `menu.spec.ts` among them. `npm run typecheck` passed. The folder check listed no other folder. The full `npm test` was left to the controller.
- 2026-10-29, controller check of the red run: with the `Strict-Transport-Security` line removed, `npx playwright test test/e2e/hosting.spec.ts -g "AC-0006"` failed both AC-0006 tests (`header on /sign-in` received undefined); the line was restored.
- `npm test`, first run: Vitest 53 files and 1,043 tests passed; the browser suite had 684 passed and 1 failed in 1,289 s, `test/e2e/invoices.spec.ts` AC-0075 timing out at 30 s. That test alone then passed 3 of 3 (`--repeat-each=3`). Second run: Vitest had 1 failed, `test/invoice-data.test.ts` AC-0031 timing out at 5,000 ms, with Vitest taking 403 s instead of about 52.
- Cause, read from the stack: `pg_class` held 457,791 dead rows, and the Realtime slot `cainophile_*` held its catalog 48,270 transactions back, the slowdown the overview's "Local stack notes" describe, with its fix. The owner approved, for this build, clearing it before each full run after the folder check: terminate the slot's backend as `supabase_admin`, then `vacuum pg_class`. Run 1: dead rows 457,704 to 0, slot lag 48,450 to 0.
- `npm test`, third run, after that fix: Vitest 53 files and 1,043 tests, then the browser suite 685 passed, 603 s in all. `npm run typecheck` passed.

## T5

- 2026-10-29: the overview's areas table rows for `src/proxy.ts`, `src/app/`, `test/`, and `test/e2e/`, and its Variables, Framing, Cookies, Network, and Host check bullets, now describe `src/allowed-host.ts`, `APP_HOST`, the HTTPS header, Secure cookies, the install file and icons, and the shared sign-in limit accepted on any host. `AGENTS.md` names the optional `APP_HOST` after the `ANTHROPIC_API_KEY` sentence. The intent answers the session-limit question (Pro plan only), keeps "Where is the app hosted?" open and its Boundary unchanged, and lists the online step's remaining work; its `workspace.toml` summary matches.
- `git diff d96a997 -- docs/architecture/overview.md AGENTS.md docs/product/intents/app-https-hosting.md workspace.toml | perl -CSD -ne 'print if /^\+.*\x{2014}/'` printed nothing. `workspace_status.py reconcile` reported only the 2 findings that predate this spec (`invalid_entry` on `pushed-alert-cards.md`, `unsatisfied_dependency` on `hosted-hardening-check.md`).
- Slot fix run 2, after the folder check: dead rows 101,550 to 0, slot lag 10,229 to 1. `npm test` then passed: Vitest 53 files and 1,043 tests, then the browser suite 685 passed, 604 s in all.

## T6

- 2026-11-01: the app was built with `npm run build` (the route list showed `/apple-touch-icon.png`, `/icon-192.png`, `/icon-512.png`, and `/manifest.webmanifest`) and started with `npm run start` on `127.0.0.1:3000`, the only listener on that port.
- No personal operator account exists on the local stack, so the developer signed in as the local test operator `operator@meat-ops.test`. A first attempt in the developer's Chrome did not sign in; the same account then signed in through the form in that Chrome and in a test Chromium at `127.0.0.1:3000` and `localhost:3000`, each landing on `/receiving` with a `Secure` auth cookie.
- AC-0011 and AC-0015: the developer started the install from `/production` in their desktop Chrome, closed the app window, and launched the installed app from the operating system. They reported that Chrome offered an install, the launched app opened in its own window on `/receiving`, and its icon in the app list was the white "MO" letters on blue.
- Never-do checks, each printing nothing: `git diff d96a997 -- package.json package-lock.json`; `git diff --stat d96a997 -- supabase/`; `git diff d96a997 -- src next.config.ts | grep -E '^\+.*(NEXT_PUBLIC_|createBrowserClient)'`.
- The app was then stopped by PID.

## Final gates (2026-11-01)

- `npm run audit` found 0 vulnerabilities, and `npm run typecheck` passed, at `87a2ac5`. The last `npm test` (T5, 604 s, all passing) ran at `f0a7b78`; the only later change is this ledger.

## Post-gates review round 1 (2026-11-01)

| Adversarial | Security | Quality |
| --- | --- | --- |
| 1 Nit sustained, 1 refuted, 1 indeterminate settled by probe | Clean (footer adjudicated) | 5 Nits sustained (2 lowered from Concerns), 1 refuted |

- Adversarial finding 1 (the developer's first failed sign-in might come from pre-change, non-Secure auth cookies) was indeterminate. Probe, on the current build at `127.0.0.1:3105` with the local test operator in a test Chromium, stopped by PID afterward: a profile holding a valid non-Secure auth cookie kept its session on `/receiving`; one holding a non-Secure cookie whose access token had expired was refreshed and left with a Secure cookie; one holding a stale non-Secure cookie signed in through the form on the first attempt, landing on `/receiving` with a Secure cookie. So pre-change cookies do not block a session or a sign-in, and the finding falls on reachability.
- Adversarial finding 2: the overview's Host check now says the `Host` must equal `APP_HOST` as a whole, ignoring letter case, so a port matches only when `APP_HOST` names it.
- Security footer: two online-step items had no owner, the front end's `X-Forwarded-Host` and cookie protection against a sibling subdomain or a first plain-http visit (`__Host-` prefix, `includeSubDomains`, preload). The intent's online-step bullet now names both.
- Quality findings 1, 2, 4, 5, and 6 are repaired in the tests. AC-0014's control replay adds a sign-in, so the suite now signs in four more times than before this spec (AC-0001 through the form; the AC-0003, AC-0014 control, and AC-0016 replays), one more than the plan's Risks counts; the plan stays as approved.
- Repair checks: the new `test/e2e/auth.spec.ts` test "AC-0069: look-alikes of the local names are refused" (Hosts `xlocalhost`, `localhost.rebind.example`, `127.0.0.1.rebind.example`) went red with `LOCAL_HOST`'s leading `^` dropped (failing on `xlocalhost`) and with its trailing `$` dropped (failing on `localhost.rebind.example`); `src/allowed-host.ts` matched its saved copy byte for byte afterward. The AC-0014 test passed when run alone with `-g "AC-0014"`. `npx playwright test test/e2e/hosting.spec.ts test/e2e/auth.spec.ts` passed 35 of 35 in 11.1 s, and `npm run typecheck` passed.
- Slot fix run 3, after the folder check: dead rows 174 to 0, slot lag 1,530 to 0. `npm test` then passed: Vitest 53 files and 1,043 tests, then the browser suite 686 passed, 606 s in all.

## Post-gates review round 2 (2026-11-01)

| Adversarial | Security | Quality |
| --- | --- | --- |
| 1 Nit sustained | Clean (footer adjudicated) | Clean |

- Adversarial finding 1: the intent's online-step text now gives one sentence per decision and says in plain words what `X-Forwarded-Host`, the `__Host-` prefix, and `includeSubDomains` with preload guard.
- Security footer, test-strength note left as it is: AC-0014's foreign-Origin replays assert only that the session count stays put, so if the Origin refusal ever broke while the control replay had used the last sign-in the 30-per-5-minutes limit allows, the test could still pass. While the Origin refusal works, the test passes for the right reason.
- Post-gates round 3 (adversarial, delta only): 1 Concern, that the reworded intent said `includeSubDomains` and preload make browsers use HTTPS for every name under the domain from the first visit. Repaired without a separate adjudication, since the fix only narrows the claim: the text now says those options reach sibling names only when the base domain sends the header, and the first visit only after that domain joins the browsers' preload list (RFC 6797, section 6.1.2; the preload list is opt-in by the base domain).
- Post-gates round 4 (adversarial, delta only): 1 Concern and 1 Nit on the same sentence, each a new defect in the previous repair's explanation of the cookie settings. Repaired by cutting the explanation: the intent now names the two decisions and what each is for, and leaves how each setting works to the online step.
- Post-gates round 5 (adversarial, delta only): 1 Nit, that the cut also dropped the plain-word gloss for `X-Forwarded-Host`. Repaired by restoring the gloss rounds 3 and 4 had already read without a finding.

## Post-gates review rounds 3 to 6 (2026-11-02)

| Round | Adversarial | Security | Quality |
| ---: | --- | --- | --- |
| 3 | 1 Concern (intent wording) | not rerun (one-sentence docs delta) | not rerun (one-sentence docs delta) |
| 4 | 1 Concern, 1 Nit (same sentence) | not rerun | not rerun |
| 5 | 1 Nit (same sentence) | not rerun | not rerun |
| 6 | Clean | not rerun | not rerun |

- The spec is Shipped with all 17 criteria checked, and the plan is Done.

