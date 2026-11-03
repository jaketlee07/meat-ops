# Spec: app-hosting

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the intent [`docs/product/intents/app-https-hosting.md`](../../product/intents/app-https-hosting.md) (its Outcome and Boundary, narrowed by the owner on 2026-10-27 as Assumptions record); the `AGENTS.md` hard rules; the cookie attributes, privileged-variable guard, and loopback-only listening criteria of the receiving spec, [`docs/specs/receiving/spec.md`](../receiving/spec.md). This spec narrows that spec's Host check: while `APP_HOST` names a host, the app also answers that one name, and with `APP_HOST` unset or empty the receiving Host check holds unchanged. The receiving spec scopes its other criteria to requests whose `Host` is local; for the `APP_HOST` name, this spec's AC-0017 covers the signed-out redirect, and AC-0003, AC-0014, and AC-0016 cover sign-in and its cookies. The receiving spec itself is not annotated (owner's choice, Assumptions)
- **Brief:** none
- **Discovery:** none
- **Contract:** none (no published interface changes)
- **Shape:** mixed

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory: it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

Meat Ops is ready to run on a host that serves it over HTTPS, so the owner can
log receipts and batches from a phone on the floor and install the app on that
phone. Everything here runs and is tested on this Mac, and nothing goes online:
choosing the host and deploying are the next step of the
[app HTTPS hosting intent](../../product/intents/app-https-hosting.md), listed
under Follow-ons.

- **Sign-in cookies stay on HTTPS.** Every Supabase auth cookie carries
  `Secure` beside `HttpOnly` and `SameSite=Lax`, so a phone never sends its
  session over plain http. Chrome treats `127.0.0.1` and `localhost` as secure,
  so local use and the test suites work unchanged.
- **The app answers to its hosted name.** `APP_HOST`, an optional setting in
  the app's environment, names the one host name the app answers besides
  `127.0.0.1` and `localhost`. Left unset, the app answers local names only.
  The name lives outside git, so a business-named domain never enters the
  repository. `APP_HOST` is not a privileged name, so the receiving guard lets
  it through; the overview's "Variables" bullet lists what the app holds.
- **The browser stays on HTTPS.** Every response tells the browser to use HTTPS
  for this site for a year. Browsers ignore that header on plain http, so local
  runs are unaffected.
- **The app installs.** An install file names the app "Meat Ops", opens it on
  `/receiving` as a standalone window, and lists a blue icon with white "MO"
  letters at 192 and 512 pixels. Every page links the install file and a
  180-pixel icon for iPhones. A signed-out phone fetches all of them, since a
  browser asks for them before anyone signs in. There is no offline mode:
  the offline queue stays on the roadmap (`SYSTEM-SPEC.md` §9).

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture | Applicable: the app trust boundary changes (cookies, Host check, HTTPS header, install file) and the shared sign-in limit is now accepted for any host | `docs/architecture/overview.md`: the areas table rows for `src/proxy.ts`, `src/app/`, `test/`, and `test/e2e/`, and the "App trust boundary" bullets for Variables, Framing, Cookies, Network, and Host check | work-loop | The updated rows and bullets in the PR diff | close-work finds each named row and bullet in the merged tree, matching `src/` |
| Maintainer procedure | Applicable: a maintainer must know `APP_HOST` exists and stays unset on this Mac | `AGENTS.md`, "Build and test commands", the paragraph that names the variables the app reads | work-loop | The added sentence in the PR diff | close-work finds it in the merged tree |
| Intent refresh | Applicable: this spec delivers part of the intent, and the rest stays open | `docs/product/intents/app-https-hosting.md` and its `workspace.toml` `[backlog].open` summary | work-loop | The intent names what this spec delivered, answers the session-limit question, keeps its Boundary bullet on the 12-hour and 7-day limits unchanged, and lists the online step's remaining work as Follow-ons gives it | close-work leaves the intent open (not Fulfilled) and finds the refresh in the merged tree |
| Execution record | Applicable: the owner's rulings, the manual install check, and the gate results need a home outside the contract | `docs/specs/app-hosting/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every check the Testing Strategy routes to it |
| Lifecycle closeout | Applicable: delivered work is recorded when it ships | `docs/lifecycle/app-hosting.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Applicable when the build teaches something that would change a future approach | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |
| Master brief | Not applicable: `SYSTEM-SPEC.md` §8 and §9 already describe an installable app with the offline queue on the roadmap | none | n/a | n/a | n/a |
| Costing truth and schema | Not applicable: no migration, function, view, or golden number changes | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions | none | n/a | n/a | n/a |
| User documentation and release history | Not applicable: no page, label, or message changes, and nothing is released or deployed | none | n/a | n/a | n/a |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Follow the `AGENTS.md` hard rules, and run its folder check before every test run.
- Put any made-up host name that has a dot under the reserved `.example` name, such as `meat-ops.example`. A one-label look-alike with no dot, such as `meat-opsxexample`, is allowed.
- Stop every app, server, or helper a check starts by its own PID, and delete every probe file before the check ends.

### Ask first

- Creating an account with any host, deploying anywhere, or changing DNS.
- Adding a service worker, an offline cache, or browser storage.
- Changing the privileged-variable rule, the framing headers, or the server-action body limit.

### Never do

- No change to `package.json` or `package-lock.json`: both stay byte-identical to commit `d96a997`, so no dependency is added and the `dev` and `start` scripts keep `-H 127.0.0.1`.
- No change under `supabase/`.
- No `NEXT_PUBLIC_` variable and no browser-side Supabase client.

## Testing Strategy

- **TDD, no database, as construction for the Host criteria below.** Which `Host` the app answers is a pure rule over the header and `APP_HOST`, so a Vitest table settles it for set, unset, empty, and mixed-case `APP_HOST`, and holds one look-alike per looser rule (a port, a prefix, a subdomain, a suffix, and a name with a dot swapped for a letter).
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0012, AC-0013, AC-0014, AC-0016, AC-0017).** Each is a request and an observable reply, cookie, or page head that only the real built app shows. The suite's app runs with `APP_HOST=meat-ops.example`, and raw requests set the `Host` header to the name under test. For `APP_HOST` unset, empty, and mixed-case, the suite starts a second app from the same build, with the suite app's other settings and that `APP_HOST`, so these runs also show the app reads `APP_HOST` when it starts, not when it is built. Before the unset run, the test confirms that neither the runner's environment nor any env file Next.js reads in production names `APP_HOST`; it reports at most whether the runner sets `APP_HOST` or which file names it, never a value, and fails on a file it cannot read.
- **Manual QA, recorded in the verification ledger (AC-0011, AC-0015).** Chrome's own install offer is browser UI that no page script reaches, and its installability report over the DevTools protocol answers "no errors" even for a page with no install file (Assumptions). So the developer installs the app in their own Chrome, starting from a page other than the start page, launches it, and the ledger records what they saw.
- **Goal-based checks of the Never-do rules, recorded in the verification ledger.** Each prints nothing on a passing branch:
  - `git diff d96a997 -- package.json package-lock.json`
  - `git diff --stat d96a997 -- supabase/`
  - `git diff d96a997 -- src next.config.ts | grep -E '^\+.*(NEXT_PUBLIC_|createBrowserClient)'`
- **The existing suites, run by `npm test` and `npm run typecheck`.** With `APP_HOST` set, they show the receiving spec's Host check still refuses a foreign or missing `Host`, and, for requests to `127.0.0.1`, that its cookie attributes still hold and every page still passes its page-state checks with the new cookie flag.

## Acceptance Criteria

### Sign-in cookies

- [x] **AC-0001.** Every Supabase auth cookie the app sets, at sign-in through the form and when the proxy refreshes an expired access token, carries the `Secure` attribute.

### The hosted name

- [x] **AC-0002.** While `APP_HOST` names a host, a signed-out GET of `/sign-in` whose `Host` header equals that name, ignoring letter case on both sides, returns status 200 and the sign-in form.
- [x] **AC-0003.** While `APP_HOST` names a host, a sign-in posted to `/sign-in` with that name as `Host` and `https://` plus that name as `Origin` creates one new auth session for the operator.
- [x] **AC-0014.** While `APP_HOST` is `meat-ops.example`, a sign-in posted to `/sign-in` with `Host: meat-ops.example` and an `Origin` of `https://rebind.example` or of `https://sub.meat-ops.example` creates no auth session.
- [x] **AC-0016.** While `APP_HOST` names a host, AC-0003's sign-in sets at least one Supabase auth cookie, and each one carries `HttpOnly`, `SameSite=Lax`, and `Secure`, with attribute names and the `SameSite` value matched ignoring letter case.
- [x] **AC-0017.** While `APP_HOST` is `meat-ops.example`, a signed-out GET of `/receiving` with `Host: meat-ops.example` is answered with status 307 and `Location: /sign-in`.
- [x] **AC-0004.** While `APP_HOST` is `meat-ops.example`, a GET of `/sign-in` is refused with status 421 and the body `Misdirected request.` for each of these `Host` values: `meat-ops.example:443`, `xmeat-ops.example`, `sub.meat-ops.example`, `meat-ops.example.rebind.example`, `meat-opsxexample`, and `rebind.example:3100`.
- [x] **AC-0005.** While `APP_HOST` is unset or empty, a GET of `/sign-in` is refused with status 421 and the body `Misdirected request.` for each of these: a `Host` of `meat-ops.example`, of `rebind.example:3100`, or of the empty value, and an HTTP/1.0 request with no `Host`.
- [x] **AC-0012.** With `APP_HOST` unset, empty, or `meat-ops.example`, a signed-out GET of `/sign-in` whose `Host` is `127.0.0.1` or `localhost`, each with and without the app's port, returns status 200 and the sign-in form.

### HTTPS only

- [x] **AC-0006.** Each of these responses carries `Strict-Transport-Security: max-age=31536000`: `/sign-in` signed out; the redirect that a signed-out GET of `/receiving` gets; `/receiving` signed in as an operator; a GET refused for its `Host`; `/manifest.webmanifest`; and each icon the install file lists.

### Install on a phone

- [x] **AC-0007.** A signed-out GET of `/manifest.webmanifest` returns status 200, content type `application/manifest+json`, and a JSON body equal to this object, key order aside:

  ```json
  {
    "name": "Meat Ops",
    "short_name": "Meat Ops",
    "start_url": "/receiving",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#1d4ed8",
    "icons": [
      { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```

- [x] **AC-0008.** Each icon the install file lists, fetched signed out, returns status 200, content type `image/png`, and a PNG whose width and height in pixels match its `sizes` entry.
- [x] **AC-0009.** The page head of `/sign-in` signed out, and of `/receiving` signed in as an operator, holds `<link rel="manifest" href="/manifest.webmanifest">`.
- [x] **AC-0010.** The page head of `/sign-in` signed out, and of `/receiving` signed in as an operator, holds a `rel="apple-touch-icon"` link.
- [x] **AC-0013.** The URL that AC-0010's link names, fetched signed out, returns status 200, content type `image/png`, and a 180 by 180 pixel PNG.
- [x] **AC-0011.** In the developer's desktop Chrome, with the app under `npm run start` at `http://127.0.0.1:3000` and an operator signed in, after an install started from `/production`, launching the installed app from the operating system opens it in its own window on `/receiving`.
- [x] **AC-0015.** The app AC-0011 installed shows the white "MO" letters on blue as its icon in the operating system's app list.

## Follow-ons

- jaketlee07: [`docs/product/intents/app-https-hosting.md`](../../product/intents/app-https-hosting.md), the online step. It chooses the host and deploys with `APP_HOST` set. The host's front end must pass the public name as `Host`. The app must listen where that front end reaches it: `npm run start` binds `127.0.0.1`, so either the front end runs on the same machine, or a reviewed change to the receiving loopback-only criterion comes first. No plain-http request for the hosted name may reach the sign-in form or a server action; the front end redirects it to HTTPS or refuses it first. The app runs with `TZ` set to the business's time zone, because the app's today is the date in its own process's time zone (`src/lib/app-today.ts`). The intent's Boundary bullet on session limits holds before the app is reachable from another machine. The step also decides the hosted model key and installs the app on the business owner's phone over HTTPS.

## Assumptions

- Product: this spec builds and tests every app change on this Mac and stops before anything goes online; the deploy, the hosted session limits, and the hosted model key stay with the intent for a later step (source: user confirmation 2026-10-27).
- Product: every sign-in through the hosted app reaches Supabase from the app server's address, so the auth server's sign-in limit (30 per 5 minutes on the local stack) is shared by every phone. The owner accepts that someone hammering the sign-in page can block sign-in for a few minutes at a time, with password guessing capped at that rate in total (source: user confirmation 2026-10-27).
- Product: the installed app is named "Meat Ops", opens on `/receiving`, and uses a blue `#1d4ed8` icon with white "MO" letters and no business name or logo (source: user confirmation 2026-10-27).
- Product: the developer uses Chrome for the local app, so `Secure` cookies everywhere are safe for local use (source: user confirmation 2026-10-27).
- Product: this spec states its narrowing of the receiving Host check here and in the overview, and the shipped receiving spec is not annotated (source: user confirmation 2026-10-27).
- Product: the desktop install check starts from `/production`, so only a working install file can launch it on `/receiving` with the MO icon (source: user confirmation 2026-10-27).
- Product: the hosted name lives in `APP_HOST`, outside git, so a domain that carries the business's name never enters the repository (source: `AGENTS.md` hard rule 8).
- Technical: Chromium 156, the suite's browser, keeps and sends a `Secure` cookie set by plain-http `127.0.0.1` and `localhost`; Playwright's saved sessions, `addCookies`, and request API keep and send it too (source: two loopback probes with Playwright 1.64, 2026-10-27).
- Technical: the built app's signed-out redirect sends a relative `Location: /sign-in`, with or without `X-Forwarded-Proto: https`, and a signed-out GET of `/manifest.webmanifest` is redirected to `/sign-in` before this change (source: `next start` probe on 127.0.0.1:3311, 2026-10-27). With a trial `APP_HOST` change built in, a signed-out GET of `/receiving` with `Host: meat-ops.example` or `MEAT-OPS.Example` also gets 307 and a relative `Location: /sign-in` (source: scratch build on 127.0.0.1:3314, 2026-10-27).
- Technical: the proxy reads `APP_HOST` when a request arrives, not when the app is built; `next.config.ts` headers reach the proxy's 421 refusals and redirects; Next.js links `app/manifest.ts` from every page's head; and `next/og` draws a PNG icon in a route handler (source: a scratch build of a trial change, built without `APP_HOST` and started with it, 2026-10-27).
- Technical: an HTTP/1.1 or HTTP/1.0 request with an empty `Host` line reaches the proxy, which answers 421 `Misdirected request.`; Node's own 400 is only for an HTTP/1.1 request with no `Host` line (source: raw-socket probe of `next start` on 127.0.0.1:3313, 2026-10-27).
- Technical: in production mode, `next start` fills a name it lacks from `.env.production.local`, `.env.local`, `.env.production`, then `.env`, and a dotenv key appears in its file literally, so a file that does not contain the text `APP_HOST` cannot supply it (source: `loadEnvConfig` and the dotenv parser in `node_modules/@next/env/dist/index.js`).
- Technical: Chromium's DevTools installability report (`Page.getInstallabilityErrors`) returns no errors for a page with no install file, for a missing install file, and for one with no icons, so it proves nothing (source: scratch probe, 2026-10-27).
- Technical: every page's document title is "Meat Ops", set once in the root layout, so Chrome's install of a page with no install file would carry the same name (source: `src/app/layout.tsx`; no page exports its own metadata).
- Technical: Chrome offers "Install app" without a service worker since version 108 on Android and 112 on desktop (source: https://developer.chrome.com/blog/update-install-criteria).
- Technical: hosted Supabase sets session time limits only on the Pro plan (source: https://supabase.com/docs/guides/auth/sessions).
- Technical: Supabase counts sign-ins by the phone's own address only when the app sends `Sb-Forwarded-For` with a secret key, which the receiving guard refuses (source: https://supabase.com/docs/guides/auth/rate-limits).
- Technical: Next.js 16.4.2 is installed and ships `MetadataRoute.Manifest` and `next/og`, so no dependency is added (source: `node_modules/next`).
- Process: this folder uses stack A, since it has no `supabase/.env`. The owner approves the spec and then the plan in chat. Reviews include the security reviewer, because cookies and the Host check guard sign-in (source: `AGENTS.md`; hosted-rollout precedent).
