# Plan: app-hosting

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** `docs/architecture/overview.md` (the areas table row for `src/proxy.ts`, `src/privileged-env.ts`, `next.config.ts`, and "App trust boundary"); analogous implementation: `src/privileged-env.ts`, a pure rule file at `src/` that `src/proxy.ts` and `next.config.ts` import, with the framing headers in `next.config.ts` beside it; tests: the Vitest table style of `test/env.test.ts`, the raw-`Host` requests of `test/e2e/auth.spec.ts` ("a request with a foreign or missing Host"), and the spare app of `startSpare` in `test/e2e/invoices-page.ts`. Deviation: the icons are route handlers at fixed paths rather than Next.js's `icon` and `apple-icon` files (reason in Design). Uncertainty: none after the probes in the spec's Assumptions

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/app-hosting/notes/verification-ledger.md`. A genuine artifact
> error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

Five small app changes, then the docs and the manual check. T1 moves the
proxy's Host rule into a pure file that also accepts `APP_HOST`, proven by a
Vitest table, gives the browser suite's app `APP_HOST=meat-ops.example`, and
adds `test/e2e/hosting.spec.ts`, which also starts a spare app from the same
build with `APP_HOST` unset, empty, and mixed-case. T2 adds `secure: true` to
the one cookie-options constant. T3 adds the install file and three icon routes
and lets the proxy pass them to a signed-out browser. T4 adds the HTTPS header
beside the framing headers. T5 updates the overview, `AGENTS.md`, and the
intent. T6 runs the structural checks and the developer's install and launch in Chrome.
The riskiest part is the Host rule: a looser match would let a look-alike name
through, so the table holds one case per looser rule, and five looser rules
were each seen to fail it before approval.

## Constraints

- `AGENTS.md` hard rules 4 (no em dashes), 5 (commit format), 6 (`npm test` after a change under `src/lib/`), 7 (no hosted write), and 8 (no real business data).
- The receiving spec's criteria for the cookie attributes, the privileged guard, and loopback-only listening stay green. Its Host check holds unchanged with `APP_HOST` unset or empty, and this spec's AC-0002 and AC-0003 narrow it while `APP_HOST` is set. Its tests are the regression gate.
- `docs/architecture/overview.md`: the proxy authorizes nothing apart from the Host check, and every page and server action settles its caller.
- The spec's Never do.

## Construction tests

**Integration tests:** none beyond per-task tests.
**Regression gates:** after each task, `npm run typecheck` and that task's own tests; after T4 and again after T5, the full `npm test`, each run after the `AGENTS.md` folder check.
**Manual verification:** T6's install and launch in the developer's Chrome (AC-0011, AC-0015) and the Never-do checks, in the verification ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Current architecture: `docs/architecture/overview.md` | T5 | The diff of the named rows and bullets | Each named row and bullet is in the merged tree and matches `src/` |
| Maintainer procedure: `AGENTS.md` | T5 | The added `APP_HOST` sentence | The sentence is in the merged tree |
| Intent refresh: `docs/product/intents/app-https-hosting.md`, `workspace.toml` | T5 | The diff | The intent stays open with the refresh in the merged tree |
| Execution record: `notes/verification-ledger.md` | T1 to T6 | Ruling, gate, mutation, and manual-check entries | The ledger holds each |
| Lifecycle closeout and reusable learning | none | none | close-work and the work-loop capture gates |

## Design (LLD)

### Design decisions

- **The Host rule is a pure function in `src/allowed-host.ts`.** `isAllowedHost(host, appHost)` returns true for a local name (the existing pattern: `127.0.0.1` or `localhost`, any letter case, optional port) or for a host equal to a non-empty `appHost` when both are lowercased, and false otherwise, `null` included. The proxy calls it with the raw `host` header and `process.env.APP_HOST` on every request. It lives beside `src/privileged-env.ts` because `src/proxy.ts` imports `server-only` code that Vitest cannot load. Exact equality, not a pattern, so `APP_HOST` needs no escaping and a look-alike cannot match. Traces to: AC-0002, AC-0004, AC-0005, AC-0012.
- **`APP_HOST` is read per request.** The probe built the app without it and started it with it, and the name was served, so a host may set it at run time only. The spare apps keep that true: they share the suite's build and change only `APP_HOST`. An empty value counts as unset, so a blank line in a host's settings cannot make an empty `Host` match. Traces to: AC-0002, AC-0005.
- **Local names stay allowed when `APP_HOST` is set.** The Host check exists to stop a web page that rebinds a name to the machine it runs on. A hosted server runs no browser, and its front end routes only its own name to the app, so local names cost nothing there and keep one rule for every setting. Traces to: AC-0012.
- **Cross-origin posts stay with Next.js.** Next.js compares a server action's `Origin` with its `Host` and refuses a mismatch unless `serverActions.allowedOrigins` admits it; `next.config.ts` sets no `allowedOrigins`. AC-0014 pins that refusal for the hosted name, so a framework change that loosened it turns a test red. Traces to: AC-0003, AC-0014.
- **`secure: true` joins `SESSION_COOKIE_OPTIONS`.** Every cookie write already passes that constant (the proxy, `createSessionClient`, and the sign-out clearing in `src/app/sign-in/actions.ts`), so one line covers all three. Traces to: AC-0001.
- **The HTTPS header joins the framing headers in `next.config.ts`.** `Strict-Transport-Security: max-age=31536000` for `/:path*`. Next.js applies config headers to the proxy's refusals and redirects too (probe), so one entry covers every response. No `includeSubDomains` or `preload`: the hosted name may sit under a domain the app does not own. Traces to: AC-0006.
- **The install file is `src/app/manifest.ts`.** Next.js serves it at `/manifest.webmanifest` and links it from every page's head. No service worker: Chrome offers install without one, and offline stays on the roadmap. Traces to: AC-0007, AC-0009.
- **Three icon routes share one drawing, at fixed paths.** `src/app/app-icon.tsx` returns a `next/og` `ImageResponse` of a given size: a `#1d4ed8` square with white bold "MO" centered. `src/app/icon-192.png/route.tsx`, `src/app/icon-512.png/route.tsx`, and `src/app/apple-touch-icon.png/route.tsx` (180 pixels) each call it, with `dynamic = "force-static"` so the build draws them once. The root layout's `metadata.icons.apple` links `/apple-touch-icon.png`. Next.js's own `icon` and `apple-icon` files would serve their images at paths it chooses and add `<link rel="icon">` tags of its own, while AC-0007 pins two fixed icon paths and the proxy passes an exact list of paths; route handlers keep both under this plan's control, and their folder names avoid those file conventions. Traces to: AC-0008, AC-0010, AC-0013.
- **The proxy passes the install file and the three icons without session work.** The early return for build output and the favicon gains these four exact paths, after the Host check and the privileged-variable check, so a signed-out browser gets them and a foreign `Host` is still refused. The proxy authorizes nothing, so this exempts nothing that guards data. Traces to: AC-0007, AC-0008, AC-0013.

### Interfaces & contracts

- **`APP_HOST`.** Optional. One host name, compared whole and ignoring letter case, with no scheme, path, or wildcard. A port only when the host's front end sends one. Unset on this Mac. Not a privileged name, so the receiving guard passes it. Traces to: AC-0002, AC-0005.

### Quality attributes (NFRs)

- **A table no listed looser rule passes.** Before approval, the T1 stub ran red against each of five looser rules and green against an exact one: a suffix match (`endsWith`), a port-blind compare, a regular expression built from `APP_HOST` without escaping, a compare that lowercases only the header, and one with no empty-`APP_HOST` guard. T1 repeats those runs against the real file. Traces to: AC-0002, AC-0004, AC-0005.

## Tasks

### T1: The app answers `APP_HOST`, and look-alikes and cross-origin sign-ins are refused

**Depends on:** none
**Touches:** `src/allowed-host.ts`, `src/proxy.ts`, `test/allowed-host.test.ts`, `playwright.config.ts`, `test/e2e/hosting.spec.ts`, `test/e2e/raw-http.ts`, `test/e2e/auth.spec.ts`, `docs/specs/app-hosting/notes/verification-ledger.md`

**Tests:**
- `test/allowed-host.test.ts`, a new file with no database. stub: true. Test functions and ACs: "AC-0002: serves the APP_HOST name, ignoring letter case on both sides" (AC-0002), "AC-0004: refuses look-alikes of the APP_HOST name and other names" (AC-0004), "AC-0005: with APP_HOST unset or empty, refuses the hosted name, other names, and an empty Host" (AC-0005), "AC-0012: serves 127.0.0.1 and localhost in every APP_HOST setting" (AC-0012). sha256 `0b32bbde498f3076ad733ee9e425e661ccd376f5b330643aae45c99999b935d4`.

```ts
import { describe, expect, it } from "vitest";
import { isAllowedHost } from "../src/allowed-host.js";

const APP = "meat-ops.example";
const LOCAL = ["127.0.0.1", "localhost", "127.0.0.1:3000", "LOCALHOST:3100"];

describe("The Host the app answers", () => {
  // STUB: AC-0002
  it("AC-0002: serves the APP_HOST name, ignoring letter case on both sides", () => {
    for (const host of [APP, "MEAT-OPS.Example"]) expect(isAllowedHost(host, APP), host).toBe(true);
    expect(isAllowedHost(APP, "Meat-Ops.Example"), "a mixed-case APP_HOST").toBe(true);
  });

  // STUB: AC-0004
  it("AC-0004: refuses look-alikes of the APP_HOST name and other names", () => {
    const refused = [`${APP}:443`, `x${APP}`, `sub.${APP}`, `${APP}.rebind.example`, "meat-opsxexample", "rebind.example:3100", "", null];
    for (const host of refused) expect(isAllowedHost(host, APP), String(host)).toBe(false);
  });

  // STUB: AC-0005
  it("AC-0005: with APP_HOST unset or empty, refuses the hosted name, other names, and an empty Host", () => {
    for (const appHost of [undefined, ""]) {
      for (const host of [APP, "rebind.example:3100", "", null]) {
        expect(isAllowedHost(host, appHost), `${String(host)} with ${String(appHost)}`).toBe(false);
      }
    }
  });

  // STUB: AC-0012
  it("AC-0012: serves 127.0.0.1 and localhost in every APP_HOST setting", () => {
    for (const appHost of [undefined, "", APP]) {
      for (const host of LOCAL) expect(isAllowedHost(host, appHost), `${host} with ${String(appHost)}`).toBe(true);
    }
  });
});
```

Stub validation, 2026-10-27, in a disposable `git archive HEAD` copy with `node_modules` cloned in: `tsc --noEmit` passed. Against a placeholder `src/allowed-host.ts` holding today's local-only rule, Vitest ran it red: 1 failed, 3 passed, the AC-0002 test failing. Against an exact rule it passed 4 of 4; against each looser rule in the Design's NFR it failed one test (AC-0004 for the suffix, port-blind, and unescaped-pattern rules, AC-0002 for the header-only lowercase, AC-0005 for the missing guard). Isolation: `sandbox-exec` denying network except localhost, file reads limited to the copy, the Node install, the temp folder, `/`, `/System`, `/usr`, `/private/etc`, `/dev`, the time-zone data, and Vitest's settings folder, and writes limited to the copy and the temp folder; `perl -e 'alarm 120'`; a scratch config with no global setup and its cache in the copy, loaded with `--configLoader runner`. No harness side effect. The copy was deleted.

- `test/e2e/hosting.spec.ts`, no stub (manual QA exercised by E2E), against the suite's app (`APP_HOST=meat-ops.example`) unless named: AC-0002 by raw GETs of `/sign-in` with `Host: meat-ops.example` and `Host: MEAT-OPS.Example`, and by a spare app with `APP_HOST=Meat-Ops.Example` sent `Host: meat-ops.example`; AC-0004 by a raw GET per listed `Host`; AC-0005 by a spare app with `APP_HOST` unset and one with it empty, each sent the listed `Host` values (the empty one over a raw socket, since Node's own client replaces an empty `Host`) and an HTTP/1.0 request with no `Host` (`rawHttp10`); AC-0012 by local-name GETs to the suite's app and to both spare apps. Before the unset run, the test fails unless `process.env.APP_HOST` is undefined in the runner and none of `.env.production.local`, `.env.local`, `.env.production`, and `.env` in the repository root contains the text `APP_HOST`; a missing file passes, any other read error fails, and a failure says only that the runner sets `APP_HOST` or which file names it, never a value or a file's contents. AC-0017 by a raw GET of `/receiving` with `Host: meat-ops.example` and no cookie, read without following the redirect, whose reply carries its `Location` header.
- `test/e2e/hosting.spec.ts`, no stub (manual QA exercised by E2E): AC-0003 and AC-0014 capture the form's sign-in POST (aborted before the server sees it, as the foreign-Host sign-in test in `test/e2e/auth.spec.ts` does) and replay it with `Host: meat-ops.example`, once per `Origin` the criteria name, reading the operator's `auth.sessions` count through `pg` before and after each. The replay that AC-0003 uses returns every `Set-Cookie` line of its reply, for T2's AC-0016 test.
- Spare apps come from `startSpare` and `ports(baseURL).spare` in `test/e2e/invoices-page.ts`, one at a time, each stopped in a `finally`. Each gets the suite app's other settings through `startSpare`'s `env` argument: `TZ` (`APP_TIME_ZONE`), `ANTHROPIC_API_KEY` (`ANTHROPIC_TEST_KEY`), `ANTHROPIC_AUTH_TOKEN` (`ANTHROPIC_TEST_AUTH_TOKEN`), and `ANTHROPIC_BASE_URL` (the fake model's address), plus its `APP_HOST` value or none.
- `rawRequest`, `rawHttp10`, and their reply type move unchanged from `test/e2e/auth.spec.ts` to `test/e2e/raw-http.ts`, beside a new raw-socket HTTP/1.1 request whose method, `Host` line, other headers, and body the caller writes and whose reply, a type of its own, also carries the response headers; the AC-0003 replay and AC-0017 use it; both spec files import them, and the tests under "a request with a foreign or missing Host" in `test/e2e/auth.spec.ts` stay green with `APP_HOST` set.
- Mutation runs, recorded in the ledger: each of these looser rules, put in the real `src/allowed-host.ts`, turns the Vitest table red: a suffix match (`endsWith`), a port-blind compare, a regular expression built from `APP_HOST` without escaping, a compare that lowercases only the header, and a compare with no empty-`APP_HOST` guard.

**Approach:**
- Materialize the stub unchanged, check its sha256, run it red against the current proxy rule copied into `src/allowed-host.ts`, then write the rule and call it from `src/proxy.ts` in place of the inline pattern.
- Add `APP_HOST: "meat-ops.example"` to the app server's `env` in `playwright.config.ts`, beside `SUPABASE_URL`.

**Done when:** the T1 Vitest file, the AC-0002, AC-0003, AC-0004, AC-0005, AC-0012, AC-0014, and AC-0017 browser tests, and the foreign-or-missing-Host tests in `test/e2e/auth.spec.ts` pass, and the ledger records the mutation runs red.

### T2: Every auth cookie is Secure

**Depends on:** T1
**Touches:** `src/app/_server/session.ts`, `test/e2e/hosting.spec.ts`, `docs/specs/app-hosting/notes/verification-ledger.md`

**Tests:**
- `test/e2e/hosting.spec.ts`, no stub (manual QA exercised by E2E): AC-0001 signs in through the form in a fresh context, checks `secure: true` on every auth cookie (`isAuthCookie` from `test/e2e/session.ts`), expires the stored access token with `withExpiredAccessToken`, loads `/receiving`, and checks `secure: true` on every refreshed auth cookie and that the refresh token changed.
- `test/e2e/hosting.spec.ts`, no stub (manual QA exercised by E2E): AC-0016 replays the sign-in as T1's AC-0003 test does and checks that the reply sets at least one auth cookie and that each `Set-Cookie` line carries `HttpOnly`, `SameSite=Lax`, and `Secure`, names and the `SameSite` value compared ignoring letter case.
- Red against the change: the AC-0001 and AC-0016 tests fail with `secure: true` removed, recorded in the ledger.

**Approach:**
- Add `secure: true` to `SESSION_COOKIE_OPTIONS`, and say in its comment why plain-http loopback still works.

**Done when:** the AC-0001 and AC-0016 tests and the sign-in cookie test in `test/e2e/auth.spec.ts` ("sign-in ends on the receiving form, with HttpOnly SameSite=Lax cookies") pass, and the ledger records the red run.

### T3: The app installs: the install file, the icons, and their links

**Depends on:** T1
**Touches:** `src/app/manifest.ts`, `src/app/app-icon.tsx`, `src/app/icon-192.png/route.tsx`, `src/app/icon-512.png/route.tsx`, `src/app/apple-touch-icon.png/route.tsx`, `src/app/layout.tsx`, `src/proxy.ts`, `test/e2e/hosting.spec.ts`, `test/e2e/auth.spec.ts`, `docs/specs/app-hosting/notes/verification-ledger.md`

**Tests:**
- `test/e2e/hosting.spec.ts`, no stub (manual QA exercised by E2E), all fetched signed out with `maxRedirects: 0` except the `/receiving` load named below: AC-0007 compares the parsed body with the object in the spec; AC-0008 reads each listed icon's width and height from the PNG header (bytes 16 to 23, after the 8-byte signature); AC-0009 and AC-0010 read the `link` elements from `document.head` on `/sign-in` signed out and on `/receiving` with the operator's saved session; AC-0013 fetches the apple-touch-icon's URL from that link.
- Content pin, not a criterion: the 512-pixel icon's corner pixel is `#1d4ed8`, read by drawing the fetched PNG on a canvas in a blank page.
- The foreign-Host test's `PATHS` in `test/e2e/auth.spec.ts` gains `/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png`, and `/apple-touch-icon.png`, so the receiving Host check covers the new early-return paths.
- Red against the change: with the proxy's four new paths removed, the AC-0007 test gets the redirect to `/sign-in`; recorded in the ledger.

**Approach:**
- Write the install file, the shared drawing, the three routes, and the layout's `icons.apple` entry as the design says, then add the four exact paths to the proxy's early return.

**Done when:** the AC-0007, AC-0008, AC-0009, AC-0010, and AC-0013 tests and the foreign-Host test in `test/e2e/auth.spec.ts` pass, `npm run build` lists the four paths, and the ledger records the red run.

### T4: Every response asks for HTTPS

**Depends on:** T3
**Touches:** `next.config.ts`, `test/e2e/hosting.spec.ts`, `docs/specs/app-hosting/notes/verification-ledger.md`

**Tests:**
- `test/e2e/hosting.spec.ts`, no stub (manual QA exercised by E2E): AC-0006 reads the header from each listed response; the redirect with `maxRedirects: 0`, the refusal with a raw `Host: rebind.example:3100` request, and `/receiving` with the operator's saved session.
- Red against the change: with the header line removed, the AC-0006 test fails; recorded in the ledger.

**Approach:**
- Add the header entry after `X-Frame-Options` in the `/:path*` block, with a comment that browsers ignore it on plain http.

**Done when:** the AC-0006 test and the framing tests in `test/e2e/menu.spec.ts` pass, and `npm test` passes after the folder check; the ledger records the run.

### T5: The docs tell the hosting-ready story

**Depends on:** T1, T2, T3, T4
**Touches:** `docs/architecture/overview.md`, `AGENTS.md`, `docs/product/intents/app-https-hosting.md`, `workspace.toml`, `docs/specs/app-hosting/notes/verification-ledger.md`

**Tests:**
- no stub (goal-based): `git diff d96a997 -- docs/architecture/overview.md AGENTS.md docs/product/intents/app-https-hosting.md workspace.toml | perl -CSD -ne 'print if /^\+.*\x{2014}/'` prints nothing (the pattern names the em dash by its code point); each Durable Outputs row's destination holds its update, read against `src/`.

**Approach:**
- Overview: the areas table rows for `src/proxy.ts` (add `src/allowed-host.ts` and the HTTPS header), `src/app/` (the install file and icons), `test/` (`allowed-host.test.ts`), and `test/e2e/` (`hosting.spec.ts`, `raw-http.ts`); App trust boundary: Variables (`APP_HOST`), Framing (the HTTPS header), Cookies (`Secure`, replacing the sentence that hands it to the intent), Network (the shared sign-in limit accepted on any host, and why: counting by the phone's address needs a secret key), Host check (`APP_HOST`, and local names in every setting).
- `AGENTS.md`: one sentence after the `ANTHROPIC_API_KEY` sentence naming the optional `APP_HOST` and that it stays unset on this Mac.
- Intent: record what this spec delivered; answer "Does the hosted Supabase plan support the session time limits?" (Pro only); keep "Where is the app hosted?" open; keep the Boundary bullet on the 12-hour and 7-day limits as it is; list the online step's remaining work as the spec's Follow-ons gives it. Update the `workspace.toml` summary to match.

**Done when:** the T5 checks pass and `npm test` passes after the folder check; the ledger records both.

### T6: The real app installs, and the structural rules hold

**Depends on:** T5
**Touches:** `docs/specs/app-hosting/notes/verification-ledger.md`

**Tests:**
- no stub (manual QA): AC-0011 and AC-0015, by the developer in their own Chrome, with the app built and started by `npm run build` and `npm run start` in this folder and their own operator account signed in, starting the install on `/production`, closing the app window, and launching the installed app from the operating system; the ledger records what Chrome offered, which page the launched window opened, and the icon the app list showed.
- no stub (goal-based): the Never-do commands in the spec's Testing Strategy, each printing nothing.

**Approach:**
- Stop any app this folder runs first. After the check, the developer may uninstall the trial app, and the app is stopped by PID.

**Done when:** the ledger records the AC-0011 and AC-0015 results and each Never-do command's empty output.

## Rollout

- **Delivery:** none. Nothing deploys. On this Mac `APP_HOST` stays unset, so the app answers exactly the names it answered before, and the only changes a local user sees are the install offer and the icons.
- **Infrastructure and external systems:** none. The online step belongs to the intent, as the spec's Follow-ons list it.
- **Rollback:** revert the PR. No data, schema, or setting changes.

## Risks

- The suite signs in three more times: through the form for AC-0001, and by replaying the captured sign-in for AC-0003 and AC-0016. The local auth server allows 30 sign-ins per 5 minutes, shared with the Vitest suites, so a slow run near the limit could see a refused sign-in; a rerun clears it.
- Each spare app starts in a few seconds; one that outlives a run holds `ports(baseURL).spare`, a known leftover (`docs/product/intents/hosted-rollout-review-nits.md`). Check the port before a rerun and stop it by PID.
- `next/og` draws text with its bundled font; if "MO" renders differently than expected, only the content pin changes, not a criterion.

## Changelog

- 2026-10-27: initial plan.
- 2026-10-27: round-1 review repairs: spare apps for unset, empty, and mixed-case `APP_HOST`; cross-origin sign-in refusal (AC-0014); split local-name (AC-0012) and apple-icon (AC-0013) criteria; stub widened to five looser rules; the install check starts on `/production`; ledger in every task's Touches.
- 2026-10-27: round-2 review repairs: hosted-name cookie attributes (AC-0016); the installed app's icon split out (AC-0015) and AC-0011 checked at launch; HTTP/1.0 no-Host case in AC-0005; spare apps get the suite app's other settings; the unset check uses Next.js's own env loader and reports yes or no only; the five looser rules named in T1's Tests.
- 2026-10-27: round-3 review repairs: the signed-out redirect at the hosted name (AC-0017); AC-0016 needs at least one cookie, compares ignoring letter case, and moves to T2 after `secure: true`; the unset check reads only whether Next's production env files contain the name, with no import outside `package.json`, and fails closed.
- 2026-10-28: resumed on the Next.js 16.4.2 upgrade's merge: the `git diff` pins move from `8d3f847` to `d96a997`.
- 2026-10-28: round-4 review repairs: a runner-side `APP_HOST` failure reports no value; AC-0017's request returns the reply's headers through its own reply type; the Testing Strategy no longer repeats the env-file list; Risks counts three added sign-ins.
- 2026-10-28: round-5 review repairs: the spec's limit on what the unset check's failure says matches the plan's; the new raw-socket request takes a method, headers, and a body, and the AC-0003 replay uses it.
