# Plan: receiving

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:**
  - **Area rules and access model:** `docs/architecture/overview.md`.
  - **Typed reads** follow `src/lib/views.ts`, and **operation wrappers** follow `src/lib/rpc.ts`.
  - **Tests** follow `test/costing.test.ts` and `test/access.test.ts`, with setup in `test/db.ts`, `test/users.ts`, and `test/global-setup.ts`.
  - **A new function with revoke-then-grant** follows `supabase/migrations/20261007183252_corrections.sql`.
  - **Named deviation:** the repository has no web app, so the app layer follows the Next.js 16.4.0 docs shipped in `node_modules/next/dist/docs/` (read 2026-10-07) and the `@supabase/ssr` 0.12.7 README, type declarations, and `dist/main/cookies.js`.
  - **Scratch probes, 2026-10-07 and 2026-10-08:**
    - Turbopack does not resolve a `.js` specifier to a `.ts` file ("Module not found: Can't resolve '../lib/views.js'"); extensionless imports build and run.
    - `next build` sets `isolatedModules` and `jsx: react-jsx` but adds neither `dom` libs nor `next-env.d.ts` when `lib` and `include` exist.
    - A check at the top of `next.config.ts` that calls `process.exit(1)` stops `next build`, `next start`, and `next dev` with exit code 1, for a variable inherited from the shell and for one loaded from `.env`, and prints only the name. An `instrumentation.ts` `register()` that only throws leaves `next start` running with HTTP 500 on every request.
    - `next dev` reloads `.env.local` when it changes ("Reload env: .env.local"); a per-request check in `proxy.ts` then answers HTTP 500 with "Server misconfigured.", and the value appears in neither the body nor the log.
    - Importing `vitest` outside its runner throws "Vitest failed to access its internal state".
    - Next.js aliases `server-only` internally, so `import "server-only"` needs no package.
  - **Named uncertainty:** the local auth limit of 30 sign-ins per 5 minutes per IP (comment in `test/access.test.ts`) now covers two suites.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/receiving/notes/verification-ledger.md`. A genuine artifact error
> follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material.

## Approach

The work lands as twelve dependency-ordered layers, and each leaves `npm test` green. Layers 1 to 7 are T1 to T7. Layers 8 to 11 are the amendment's T9 to T12, and the docs layer, T8, runs last.

1. Add the app toolchain and the privileged-variable guard. This includes the `@supabase/supabase-js` upgrade that `@supabase/ssr` requires, and the existing suites must stay green across it.
2. Add `public.check_operator()` in a new migration, with an `isOperator` wrapper, so the app can tell a non-operator apart from an empty catalog.
3. Add the pure display formats and form rules in `src/lib/`, test-first.
4. Add the receiving reads in `src/lib/`, test-first against the local stack.
5. Add sign-in, sign-out, the session proxy, and the not-allowed page. Wire the Playwright suite into `npm test`.
6. Add the receiving form, the save action, and the before-and-after result.
7. Add the recent receipts list and the void flow.
8. Refuse every request with a foreign or missing `Host` in the proxy (T9).
9. Add failure classification, the sign-in mapping, the session outcome, and the request limit in `src/lib/`, test-first (T10).
10. Make failed saves, voids, and sign-ins keep their screens and say what happened (T11).
11. Keep the receiving screen current across midnight, new products, and voids (T12).
12. Bring the architecture overview, `AGENTS.md`, and the costing reference up to date, and run the goal-based checks and the recorded run (T8).

The riskiest part is the session path in layer 5. A cookie the proxy refreshes but a server action cannot see would sign the owner out mid-entry. A client built in the wrong place would make the engine run as `anon`. The browser suite catches both, because every receiving criterion signs in and saves through the real server.

Migrations are created with `supabase migration new <name>` and applied with `supabase migration up`.

## Constraints

- `SYSTEM-SPEC.md` §2 and §11: the app computes no cost, price, shrink, average, or margin, and writes the ledger only through operations.
- `AGENTS.md` hard rules 2, 3, 4, 6, and 7.
- The access model in `docs/architecture/overview.md`: `service_role` holds no EXECUTE on any `public` function, and a non-operator gets SQLSTATE `42501`.
- No ADR or RFC governs this area.

## Construction tests

**Integration tests:** the Vitest suites run against the local stack. The Playwright suite drives a production build (`next build` then `next start`) against the same stack. The two never overlap, because the `test` script runs Vitest first and Playwright second.

**Browser suite setup**
- **Localhost guard:** `playwright.config.ts` resolves the stack through `resolveStackEnv()`, so the localhost guard (foundation-hardening AC-0042) runs before the server starts.
- **Server environment:** the runner keeps the admin values its global setup and `pg` checks need. The web server command runs through `env -u` for every privileged variable, and `webServer.env` adds `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The app's own guard (AC-0060) makes a leak fail the whole suite.
- **Serial runs:** the config sets one worker and no parallelism, because every spec resets the one shared database (the reason `vitest.config.ts` runs single-fork).
- **Data:** each spec resets master data through `test/db.ts` before each test. It builds ledger state only through operations as the operator (`callAsOperator`), and checks what was written by reading raw tables through `pg`.
- **Sign-in reuse:** a setup project signs in once per role and saves storage state under `test/e2e/.auth/`, which is gitignored. Only the sign-in criteria sign in through the form. The sign-out test uses `scope: "local"` so the saved sessions survive.

**Per-state checks:** one helper in `test/e2e/` performs, on the current page state:
- the AC-0025 axe scan;
- the AC-0026 and AC-0054 measurements at 320 × 640;
- the AC-0030 and AC-0031 focus checks.

It collects the focusable controls by pressing Tab per the spec's definition. Repeat presses that keep focus on one element are skipped, and the walk fails the test after 200 presses, which catches a focus trap. For each control it reads the computed outline style, width, and color, and computes the contrast against the computed background color of the nearest ancestor that has one. Each task calls the helper for the page states it adds.

**Stub validation:** each `ts` stub block below is copied byte-exact to scratch beside copies of `src/lib/` and `test/`.
- **Compile:** it must type-check against placeholder declarations of the planned surface.
- **Red, with the placeholders removed:** each must fail because the implementation is absent, and for no other reason.
- **T10 block (amendment, 2026-10-08, after the round-1 repairs):** compile exited 0 against placeholder declarations of `RpcError` and the `src/lib/failures.ts` surface, `sessionOutcome` and the staged `voidFailureMessage` included; with the placeholder removed it failed with "Failed to load url ../src/lib/failures.js".
- **Results for the T2 to T4 blocks (2026-10-08):** compile exited 0. `format`, `receipt-input`, and `receiving-data` failed with "Failed to load url ../src/lib/<module>.js". `operator-check` signed in, then failed with "isOperator is not a function".
- **Isolation downgrade:** the runs had no network deny and no timeout wrapper. They reached only the local stack, through the localhost guard, and their only write was global setup's idempotent upsert of the test users.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Current architecture / `docs/architecture/overview.md` | T2, T8 | T2: access-model row for `check_operator`. T8: areas rows for `src/app/` and `test/e2e/`, the write-path sentence, and the app trust-boundary section, including the Host check (T9) and the database-call time limit (T10, T11) | Rows match `src/`, `test/e2e/`, `supabase/config.toml`, and the T2 migration |
| Agent guidance / `AGENTS.md` | T1, T8 | Commands added in T1 run in the T1 gate; T8 writes them into "Build and test commands" | Each listed command ran in the closing gates |
| Display rounding / `docs/costing.md` | T3, T6, T7, T8 | `test/format.test.ts` for the AC-0024 examples; `test/e2e/receiving.spec.ts` for the AC-0067 texts | Each AC-0024 example and AC-0067 text appears in the note and in its suite, and the file's opening names both suites |
| Interface compatibility / `src/lib/database.types.ts` | T2 | AC-0034 | `npm run gen:types` leaves no diff |

The cookie rules, the privileged-variable guard, and the route list go to the architecture overview. Component layout, tokens, and state handling are mechanically inferable from `src/app/`.

## Design (LLD)

### Design decisions

- **Server-only Supabase access.** Every database call runs on the server, in a page, a server action, or the proxy, through `createServerClient` from `@supabase/ssr`.
  - There is no browser client, so the auth cookies can be `httpOnly: true, sameSite: "lax"`.
  - One exported cookie-options constant in `src/app/_server/session.ts` feeds every `createServerClient` call, the proxy's included. Each call merges its own `cookieOptions` over the package default `httpOnly: false`.
  - The env names `SUPABASE_URL` and `SUPABASE_ANON_KEY` carry no `NEXT_PUBLIC_` prefix, so neither reaches a client bundle.
  - Rejected: a browser client, because it needs script-readable cookies.

  Traces to AC-0006, AC-0039.
- **Privileged-variable guard.** `src/privileged-env.ts` holds the spec's name rule and lists the names in `process.env` that match it. It never reads a value. Two callers use it:
  - **At build, start, and dev boot:** the top of `next.config.ts` prints the names and calls `process.exit(1)`. Next.js loads the config after the `.env` files for all three commands. Throwing is not enough, because a thrown instrumentation hook leaves the server answering HTTP 500.
  - **Per request:** `src/proxy.ts` checks before anything else and answers HTTP 500 "Server misconfigured." when a name matches. This covers a variable that `next dev` reloads from an env file after start.

  Traces to AC-0060, AC-0068.
- **Session refresh in `src/proxy.ts`** (the Next.js 16 replacement for `middleware.ts`, Node runtime).
  - It builds a client over the request and response cookies and calls `auth.getClaims()`.
  - A `GET` or `HEAD` with no claims to a path other than `/sign-in` is redirected to `/sign-in`. Any other method passes through, so a server action answers for itself.
  - The matcher skips `_next/static`, `_next/image`, and `favicon.ico`.
  - The proxy is only an optimistic check and authorizes nothing. Every page and every server action creates its own client and calls `getClaims()` again, because a server action is a public POST endpoint.

  Traces to AC-0001, AC-0005, AC-0042, AC-0043, AC-0044, AC-0066.
- **Session limits and sign-out.**
  - `supabase/config.toml` sets `[auth.sessions] inactivity_timeout = "12h"` and `timebox = "168h"`, which takes effect after `supabase stop` and `supabase start`.
  - Sign-out calls `auth.signOut({ scope: "local" })`. That revokes this device's session and its refresh token on the auth server, and leaves other sessions alone, such as the browser suite's saved states.
  - An access token already issued stays valid at the database until it expires (3600 s), an accepted residual.

  Traces to AC-0061, AC-0062.
- **Network posture.**
  - The `dev` and `start` scripts pass `-H 127.0.0.1`.
  - `next.config.ts` leaves `serverActions.allowedOrigins` and `allowedDevOrigins` unset, so only same-origin requests reach a server action.

  Traces to AC-0063, AC-0064.
- **`public.check_operator()` returns `void` and raises SQLSTATE `42501` unless `private.is_operator()` is true.**
  - It is `SECURITY INVOKER` with `set search_path = ''`, because `authenticated` already executes `private.is_operator()`.
  - Its privileges are revoked from `public`, `anon`, `authenticated`, and `service_role`, then EXECUTE is granted to `authenticated`.
  - `isOperator(client)` in `src/lib/rpc.ts` maps no error to `true` and `42501` to `false`, and throws on anything else.
  - Rejected: probing with a deliberately invalid `receive_lot` call, because it ties the not-allowed page to the engine's check order.

  Traces to AC-0004, AC-0033.
- **Product choice lives in the URL.** An exact code match in the form calls `router.replace("/receiving?product=<code>")` inside a transition. The server renders that product's stock, the current suggested price of each finished product made from it, and its recent receipts, while the client form keeps its field values. After a save or a void, `revalidatePath` re-renders the region from the database, so it is where AC-0053 is observed. Traces to AC-0007, AC-0017, AC-0020, AC-0053.
- **"Before" is read, never derived.** The save action reads the stock and finished prices, calls `receive_lot`, then reads them again. Traces to AC-0013, AC-0014, AC-0015.
- **One rule module serves the client and the server.** `parseReceiptForm` runs in the browser for instant messages and again in the save action.
  - The browser passes the page's product list, read from its latest `products` prop. A code missing from that list skips the browser's code rule and is sent marked for a current check.
  - For a code the page knew, the server passes every raw code, so a product made inactive after page load reaches `receive_lot` and its refusal (AC-0019). For a marked code it passes the active raw codes read at save time, so an inactive code still gets the AC-0010 field message and a newly active one saves (AC-0078). The mark only picks which message a refused code gets; the engine refuses an inactive product either way.
  - The server copy takes the device date from a hidden `today` field. The future-date rule exists to catch typos, and the engine accepts any date.

  Traces to AC-0010, AC-0011, AC-0019, AC-0078.
- **Every action argument is caller-controlled input.** That covers the form fields, the hidden `today`, and the lot id bound to the void action. Authorization and lot-state checks stay in the engine. Traces to AC-0044.
- **Each action settles who is calling before any rule that reads through RLS.** The order is:
  1. `getClaims()`. With no claims and no error, or with an auth error whose status is 4xx other than 429, the session has ended and the action returns the signed-out message. Any other auth error is a failed lookup, which takes the AC-0072 or AC-0083 path.
  2. `isOperator`. If it is false, the action returns "This account isn't allowed to use Meat Ops."
  3. Only then does the save action read the raw codes and run `parseReceiptForm`.

  A non-operator never sees a field error built from rows RLS hid. Traces to AC-0042, AC-0043, AC-0066.
- **Receipt status mirrors the `void_receipt` rule from columns the operator can read:** void when `voided_at` is set; untouched when `remaining_lbs` equals `weight_lbs` and the lot has no `lot_adjustments` rows; in use otherwise. The engine stays authoritative, and a refusal shows "The receipt wasn't voided." Traces to AC-0021, AC-0052.
- **Missing values are keyed on database state.**
  - No `inventory_balances` row shows "0 lbs" on hand.
  - A raw product whose receipts are all void, or that has none, shows "None yet" and "No price yet". This comes from a non-void receipt count read alongside the stock.

  Traces to AC-0014, AC-0053, AC-0067.
- **Formatting uses `Intl.NumberFormat("en-US")`** with fixed fraction digits and the default `halfExpand` rounding. A date-only string is parsed as UTC midnight and formatted with `timeZone: "UTC"`, so the device zone never shifts the day. Traces to AC-0024.
- **New app code imports `src/lib/` without file extensions.** `src/lib/`'s own `.js` specifiers are type-only and erased, so they stay as they are.

### Component / module decomposition

```
src/privileged-env.ts                privileged-variable name rule (names only, never values)
next.config.ts                       boot check (build, start, dev): print names, exit 1
src/proxy.ts                         Host check, per-request privileged check, session refresh, signed-out GET redirect
src/app/layout.tsx, globals.css      root layout, Tailwind import, design tokens
src/app/page.tsx                     redirect("/receiving")
src/app/_server/session.ts           cookie options, createSessionClient(); import "server-only"
src/app/_server/caller.ts            shared caller check for saveReceipt and voidReceipt
src/app/sign-in/page.tsx             server page
src/app/sign-in/sign-in-form.tsx     client form (useActionState)
src/app/sign-in/actions.ts           signIn, signOut
src/app/receiving/page.tsx           getClaims, isOperator, reads, NotAllowed or the screen
src/app/receiving/actions.ts         saveReceipt, voidReceipt
src/app/receiving/receipt-form.tsx   client: code lookup, fields, Save, result panel, focus
src/app/receiving/recent-receipts.tsx list, status cells
src/app/receiving/void-dialog.tsx    client: native <dialog>, reason, Cancel, Void
src/app/receiving/error.tsx          "Couldn't load this page." with Try again (retry), heading focused
src/lib/format.ts                    AC-0024 formatters (pure)
src/lib/receipt-input.ts             parseReceiptForm, parseVoidReason (pure)
src/lib/receiving.ts                 listActiveRawProducts, listRawProducts, listVendors, getStock,
                                     listFinishedPrices, listRecentReceipts
src/lib/rpc.ts                       + isOperator, RpcError
src/lib/failures.ts                  failure messages, sign-in mapping, log line, session outcome, withTimeout (pure)
test/e2e/*.spec.ts                   Playwright suite (Vitest includes only test/**/*.test.ts)
```

### State & control flow

Page contract for `/receiving`, from `frontend-engineering` create mode:

- **Who and why:** the owner, on a phone at the dock or at a desk, logs one delivery.
- **Primary action:** Save. The expected result is the "Receipt saved" panel with before and after values, and the next action is the next receipt. Save writes one lot, and an error writes nothing.
- **First screen:** the product code field, vendor, weight, cost, date, and Save, in one column at 320 px.
- **Product proof and measurement event:** none; this is an internal tool with no analytics.

State matrix (the applicable subset of the 18 states):

| State | Treatment | AC |
| --- | --- | --- |
| first-run | No product chosen: "Type a product code to start." With no active raw products or no vendors, the screen says which is missing and that it is added in Supabase Studio, and Save carries `aria-disabled="true"` | AC-0007 |
| loading | While the product changes, the stock and receipts region has `aria-busy="true"` | AC-0007 |
| content | Stock line, form, recent receipts | AC-0007, AC-0020 |
| no-results | Unknown code message | AC-0010 |
| empty | "No receipts for this product yet." | AC-0049 |
| disabled | Save disabled while saving | AC-0018 |
| success | "Receipt saved" panel, focus on its heading, `role="status"` region | AC-0012, AC-0055 |
| error | Field messages, or a focused form banner for a refusal or a failure, with prior values kept | AC-0010, AC-0019, AC-0042, AC-0046, AC-0057, AC-0071, AC-0072, AC-0073, AC-0081, AC-0083 |
| partial / large-data-set | "Showing the 10 most recent of N receipts." | AC-0048 |
| permission/denied | Not-allowed page with Sign out | AC-0004 |
| destructive-confirmation | Void dialog; Cancel is first in tab order and takes initial focus | AC-0022, AC-0050 |
| high-zoom | 320 px reflow | AC-0026 |
| keyboard-only | Full keyboard path, visible focus | AC-0027, AC-0030 |
| offline, blocked, long-content, reduced-motion | Not applicable: offline queueing is out of scope; a dropped connection or an unreachable database shows the AC-0071, AC-0072, AC-0073, or AC-0083 message with the form or list kept, and a failed page load shows the error page; nothing blocks; notes are capped at 500 characters and wrap; the UI has no animation | — |

### Quality attributes (NFRs)

- **Aesthetic reference:** Stripe Dashboard forms. That means a light surface, high contrast, tabular figures, and no gradients or illustration. XD genre routing: skipped (experience-design pack absent).
- **Tokens** (`src/app/globals.css`, Tailwind v4 `@theme`):
  - surface `#ffffff`
  - text `#111827`
  - secondary text `#4b5563`
  - primary `#1d4ed8`, with white text on it
  - error `#b91c1c`
  - success `#15803d`
  - input border `#6b7280`
  - focus ring 2 px solid primary, offset 2 px
  - minimum control size 44 px
  - system font stack, with `font-variant-numeric: tabular-nums` and right alignment on number columns

  Traces to AC-0025, AC-0026, AC-0030, AC-0031, AC-0054.
- **Accessibility:**
  - Every field has a visible `<label>`.
  - Each error has an id that its field's `aria-describedby` names.
  - The result panel sits in a `role="status"` region.
  - The void confirmation is a native `<dialog>` opened with `showModal()`.

  Traces to AC-0025, AC-0027, AC-0028, AC-0029, AC-0056.

### Failure, edge cases & resilience

- **Refused save:** the action returns `{ fieldErrors }` for rule failures. For an engine refusal it returns `{ message }`, which starts "The receipt wasn't saved." and adds a plain reason:
  - SQLSTATE `42501` reads "This account isn't allowed to use Meat Ops."
  - An inactive product reads "This product is no longer active."
  - Any other refusal adds the engine's text without its function-name prefix.
- **Void refusal:** the same mapping, with "The receipt wasn't voided."
- **Signed-out action:** an action that finds no claims calls nothing. It returns the AC-0042 or AC-0043 message, and the form keeps its values.
- **Error identity (amendment, 2026-10-08).** The `src/lib/rpc.ts` wrappers throw an `RpcError` that keeps PostgREST's error code beside the existing message text. An engine refusal carries a SQLSTATE (`42501`, `P0001`, and so on). A transport failure carries none.
  - `src/lib/failures.ts` holds the pure mapping from an error and its stage to the owner's message. The stage is the call that failed: any call before the write call, or the write call. A save failure before the write reads "The receipt wasn't saved.", and a write with no engine answer reads the AC-0071 message. A void maps the same way to "The receipt wasn't voided." and the AC-0073 message. An engine refusal keeps the AC-0019 and AC-0052 mapping, and a refused void adds "Reload to see the latest stock."
  - A read after the engine returned the lot is not a failure. The panel shows the saved lot and says its totals could not be loaded, and the read's error is logged.
  - `sessionOutcome` tells signed in, an ended session, and a failed auth lookup apart, for the caller check above.
  - The same module holds the sign-in mapping (`invalid_credentials` alone reads as a wrong password) and the server log line, which carries only the auth error's code and status.
  - `src/app/receiving/refusal.ts` gives way to this module.
- **Time limit.** Every server-side Supabase client, the proxy's included, fetches through `withTimeout(fetch, DB_CALL_TIMEOUT_MS)`, with the limit set to 10,000 ms.
  - `withTimeout` aborts through its own `AbortController`, so the fetch rejects with an `AbortError`. postgrest-js never retries an aborted request (`fetchWithRetry` in `node_modules/@supabase/postgrest-js/dist/index.mjs`), so each REST request gives up 10 seconds after it is sent (AC-0082).
  - postgrest-js still retries a read that fails fast, such as a refused connection, up to three times after waits of 1, 2, and 4 seconds.
  - auth-js retries a failed token refresh for up to 30 seconds, so the limit bounds each auth request but not a refresh as a whole.
- **Thrown actions.** The receiving form and the void dialog catch a rejected action call, such as a dropped connection or a server error. They answer with the AC-0071 or AC-0073 message instead of letting the error boundary unmount them.
- **Caller check.** One helper in `src/app/_server/caller.ts` runs the read-only client, `getClaims` with `sessionOutcome`, and `isOperator` for `saveReceipt` and `voidReceipt`, so a new receiving action cannot skip a step or the read-only flag. `signIn` and `signOut` keep their own cookie-writing client, and the page keeps its own read-write client.
- **Host check.** `src/proxy.ts` matches every path. Before anything else it answers 421 "Misdirected request." when the `Host` header is missing or its hostname is not `127.0.0.1` or `localhost`. It then returns at once for `/_next/static/`, `/_next/image`, and `/favicon.ico`, with no session work. Under `npm run dev`, Next answers its dev-tool addresses before the proxy runs; the owner accepted that exposure (spec Assumptions).
- **Error page.** `src/app/receiving/error.tsx` calls `retry`, which re-fetches, not `reset`, and focuses its heading on mount. `/sign-in` renders no server call that can fail, so it needs no error page of its own.

## Tasks

### T1: The app builds, refuses privileged variables, and the existing suites stay green

**Depends on:** none
**Touches:** package.json, package-lock.json, tsconfig.json, vitest.config.ts, next.config.ts, postcss.config.mjs, playwright.config.ts, .gitignore, src/privileged-env.ts, src/app/layout.tsx, src/app/globals.css, src/app/page.tsx, test/db.ts

**Tests:** no stub (goal-based).
- `npm run typecheck` exits 0, with `next-env.d.ts`, `dom`, and `dom.iterable` added by hand.
- AC-0035: `npm run build` exits 0.
- AC-0060: for each check name, run `npm run build`, `npm run start` (over a clean build), and `npm run dev`, each with only that variable added, set to a marker value. Observe a non-zero exit, the name in the output, and no marker anywhere in the output.
- AC-0039: the three greps print nothing.
- AC-0063: for each of `npm run start` and `npm run dev`, collect the process tree from the npm pid with `pgrep -P`, repeated down the tree. Then run `lsof -a -nP -iTCP -sTCP:LISTEN -p <every pid in the tree>`. The listing must be non-empty, and every address in it must be `127.0.0.1`.
- AC-0064: the grep prints nothing.
- `npm test` runs the existing Vitest suites green after the `@supabase/supabase-js` upgrade, with the count unchanged.
- `npx playwright test --list` loads the config.

**Approach:**
- Install `next@16.4.0`, `react@19.3.0`, `react-dom@19.3.0`, `@supabase/ssr@0.12.7`, and `@supabase/supabase-js` at the newest 2.x (2.114.0 or later; see the spec's Assumptions).
- Install as dev dependencies: `tailwindcss@4.3.3`, `@tailwindcss/postcss@4.3.3`, `@types/react`, `@types/react-dom`, `@playwright/test@1.64.0`, and `@axe-core/playwright`.
- Add the scripts `dev` and `start` (both with `-H 127.0.0.1`), `build`, `test:e2e`, and `audit` (`npm audit --omit=dev --audit-level=high`). `test` stays Vitest-only until T5.
- Narrow Vitest to `test/**/*.test.ts`.
- In `test/db.ts`, load Vitest's `expect` lazily inside the helpers that use it. Every export stays in `test/db.ts`, so existing imports and T4's stub keep resolving.
- Write `playwright.config.ts` per the browser suite setup.
- Gitignore `playwright-report/`, `test-results/`, and `test/e2e/.auth/`.
- `src/app/page.tsx` redirects to `/receiving`.

**Done when:** each check in Tests passes.

### T2: The operator check answers true for an operator and false for a non-operator

**Depends on:** none
**Touches:** supabase/migrations/*_operator_check.sql, src/lib/rpc.ts, src/lib/database.types.ts, test/access.test.ts, test/operator-check.test.ts, docs/architecture/overview.md

**Tests:**
- `isOperator` is true for an operator and false for a non-operator, the check behind AC-0004, in `test/operator-check.test.ts`. stub: true

```ts
import { describe, expect, it } from "vitest";
import { isOperator } from "../src/lib/rpc.js";
import { signInNonOperator, signInOperator } from "./users.js";

// STUB: AC-0004
describe("AC-0004: the operator check behind the not-allowed page", () => {
  it("is true for an operator and false for a non-operator", async () => {
    const operator = await signInOperator();
    const nonOperator = await signInNonOperator();
    expect(await isOperator(operator)).toBe(true);
    expect(await isOperator(nonOperator)).toBe(false);
  });
});
```

- The catalog-driven access suite turns red on the new function before its fixture call exists ("fixture has valid arguments for check_operator"), and green once `validArgs` and the exercised set include it.
- AC-0033 and AC-0034 commands.

**Approach:**
- Write the migration per the design decision.
- Run `supabase migration up` and `npm run gen:types`.
- Add `isOperator`.
- Add `check_operator: {}` to the access fixture's `validArgs`, and call it in the operator fixture so it counts as exercised.
- Add `check_operator` to the access model in `docs/architecture/overview.md` in the same task as its grant, so the migration rule the spec's Always-do cites names it from the start.

**Done when:** each check in Tests passes and `npm test` is green.

### T3: Display formats and form rules pass their examples

**Depends on:** none
**Touches:** src/lib/format.ts, src/lib/receipt-input.ts, test/format.test.ts, test/receipt-input.test.ts

**Tests:**
- Display formats (AC-0024), in `test/format.test.ts`. stub: true

```ts
import { afterEach, describe, expect, it } from "vitest";
import { formatCostPerLb, formatDate, formatPricePerLb, formatWeight } from "../src/lib/format.js";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

// STUB: AC-0024
describe("AC-0024: display formats", () => {
  it("formats weight with separators and up to 3 decimals", () => {
    expect(formatWeight(5000)).toBe("5,000 lbs");
    expect(formatWeight(32.5)).toBe("32.5 lbs");
    expect(formatWeight(1234.5678)).toBe("1,234.568 lbs");
  });

  it("formats cost per lb with 4 decimals", () => {
    expect(formatCostPerLb(1.725)).toBe("$1.7250/lb");
    expect(formatCostPerLb(1.68)).toBe("$1.6800/lb");
  });

  it("formats price per lb with 2 decimals, rounding half away from zero", () => {
    expect(formatPricePerLb(2.6818)).toBe("$2.68/lb");
    expect(formatPricePerLb(2.685)).toBe("$2.69/lb");
    expect(formatPricePerLb(1.005)).toBe("$1.01/lb");
  });

  it("formats a date-only value the same in every time zone", () => {
    for (const tz of ["UTC", "America/Chicago", "Pacific/Auckland"]) {
      process.env.TZ = tz;
      expect(formatDate("2026-10-07")).toBe("Oct 7, 2026");
    }
  });
});
```

- The missing-value rows of AC-0024 are display choices keyed on database state, so the browser suite asserts them in T6 and T7 (AC-0014, AC-0015, AC-0053).
- Form rules (the rules behind AC-0010, AC-0011, and AC-0051), in `test/receipt-input.test.ts`. stub: true

```ts
import { describe, expect, it } from "vitest";
import { parseReceiptForm, parseVoidReason, type ReceiptFields } from "../src/lib/receipt-input.js";

const CODES: ReadonlySet<string> = new Set(["RAW-TOM"]);
const VALID: ReceiptFields = {
  productCode: "RAW-TOM",
  vendorId: "11111111-1111-1111-1111-111111111111",
  weight: "5000",
  cost: "1.68",
  receivedDate: "2026-10-07",
  notes: "",
  today: "2026-10-07",
};

// STUB: AC-0010
describe("AC-0010: receipt form rules", () => {
  it.each<[keyof ReceiptFields, string, string]>([
    ["productCode", "", "Enter a product code."],
    ["productCode", "502", "No active raw product has code 502."],
    ["vendorId", "", "Choose a vendor."],
    ["weight", "", "Enter the weight in lbs, like 5000 or 32.5."],
    ["weight", "5,000", "Enter the weight in lbs, like 5000 or 32.5."],
    ["weight", "-5", "Enter the weight in lbs, like 5000 or 32.5."],
    ["weight", "1.2345", "Use at most 3 decimal places for weight."],
    ["weight", "0.0000", "Use at most 3 decimal places for weight."],
    ["weight", "0", "Weight must be above 0."],
    ["weight", "0.0", "Weight must be above 0."],
    ["weight", "000", "Weight must be above 0."],
    ["cost", "", "Enter the cost per lb, like 1.68."],
    ["cost", "-1", "Enter the cost per lb, like 1.68."],
    ["cost", "1.68555", "Use at most 4 decimal places for cost."],
    ["receivedDate", "", "Enter the received date."],
    ["receivedDate", "2026-10-08", "The received date can't be after today."],
    ["notes", "x".repeat(501), "Keep notes to 500 characters or fewer."],
  ])("refuses %s = %j with its message", (field, input, message) => {
    expect(parseReceiptForm({ ...VALID, [field]: input }, CODES)).toEqual({
      ok: false,
      errors: { [field]: message },
    });
  });
});

// STUB: AC-0011
describe("AC-0011: boundary values save", () => {
  it("accepts the smallest weight, a zero cost, today, and a 500-character note", () => {
    expect(
      parseReceiptForm({ ...VALID, weight: "0.001", cost: "0", notes: "n".repeat(500) }, CODES),
    ).toEqual({
      ok: true,
      value: {
        productCode: "RAW-TOM",
        vendorId: VALID.vendorId,
        weightLbs: 0.001,
        unitCost: 0,
        receivedDate: "2026-10-07",
        notes: "n".repeat(500),
      },
    });
  });

  it("accepts 3 weight decimals and 4 cost decimals", () => {
    expect(parseReceiptForm({ ...VALID, weight: "32.125", cost: "1.6855" }, CODES)).toEqual({
      ok: true,
      value: {
        productCode: "RAW-TOM",
        vendorId: VALID.vendorId,
        weightLbs: 32.125,
        unitCost: 1.6855,
        receivedDate: "2026-10-07",
      },
    });
  });
});

// STUB: AC-0051
describe("AC-0051: void reason rule", () => {
  it("refuses a blank or spaces-only reason and keeps a real one", () => {
    expect(parseVoidReason("")).toEqual({ ok: false, error: "Enter a reason for the void." });
    expect(parseVoidReason("   ")).toEqual({ ok: false, error: "Enter a reason for the void." });
    expect(parseVoidReason("entered twice")).toEqual({ ok: true, value: "entered twice" });
  });
});
```

**Approach:**
- Write the formatters and parsers per the design decisions.
- Blank notes become `undefined`.
- A product code is trimmed before lookup.

**Done when:** both suites are green and `npm test` is green.

### T4: The recent-receipts read orders, counts, and labels receipts

**Depends on:** T1 (the lazy `expect` in `test/db.ts`)
**Touches:** src/lib/receiving.ts, test/receiving-data.test.ts

**Tests:**
- Ordering and the cap of 10 (AC-0020), the receipt count (AC-0048), and status per fixture (AC-0021), in `test/receiving-data.test.ts`. The suite runs `assertLedgerInvariants` after each test, like the other suites that change lots. stub: true

```ts
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listRecentReceipts } from "../src/lib/receiving.js";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  adjustCall,
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  idOf,
  PROD_502_ID,
  produceCall,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
  voidReceiptCall,
} from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

async function receive(lbs: number, date: string): Promise<string> {
  const outcome = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, lbs, 1.68, date));
  expect(outcome.ok).toBe(true);
  return idOf(outcome);
}

// Entered out of date order, so entry order and date order disagree.
const ENTRY_DAYS = [21, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

// STUB: AC-0020
describe("AC-0020: recent receipts, last entered first", () => {
  it("returns the 10 most recently entered receipts, newest entry first", async () => {
    for (const day of ENTRY_DAYS) await receive(100, `2026-05-${day}`);
    const { receipts } = await listRecentReceipts(operator, RAW_TOM_ID);
    expect(receipts.map((r) => r.receivedDate)).toEqual(
      [20, 19, 18, 17, 16, 15, 14, 13, 12, 11].map((day) => `2026-05-${day}`),
    );
  });
});

// STUB: AC-0048
describe("AC-0048: receipt count", () => {
  it("counts every receipt of the product", async () => {
    for (const day of ENTRY_DAYS) await receive(100, `2026-05-${day}`);
    const { total } = await listRecentReceipts(operator, RAW_TOM_ID);
    expect(total).toBe(12);
  });
});

// STUB: AC-0021
describe("AC-0021: receipt status", () => {
  it("labels untouched, in-use, and void receipts", async () => {
    const consumed = await receive(1000, "2026-05-01");
    const adjusted = await receive(1000, "2026-05-02");
    const voided = await receive(1000, "2026-05-03");
    const untouched = await receive(1000, "2026-05-04");
    expect((await callAsOperator(produceCall(PROD_502_ID, 500))).ok).toBe(true);
    expect((await callAsOperator(adjustCall(adjusted, 900))).ok).toBe(true);
    expect((await callAsOperator(adjustCall(adjusted, 1000))).ok).toBe(true);
    expect((await callAsOperator(voidReceiptCall(voided))).ok).toBe(true);

    const { receipts } = await listRecentReceipts(operator, RAW_TOM_ID);
    const statusOf = (id: string) => receipts.find((r) => r.id === id)?.status;
    expect(statusOf(untouched)).toBe("untouched");
    expect(statusOf(consumed)).toBe("in-use");
    expect(statusOf(adjusted)).toBe("in-use");
    expect(statusOf(voided)).toBe("void");
  });
});
```

**Approach:**
- `listRecentReceipts` selects lots with `vendors(name)` and `lot_adjustments(count)`, ordered by `receipt_seq desc`, limit 10, with `count: "exact"`.
- The other reads follow `src/lib/views.ts`: each throws on error and returns rows.
- `listVendors` sorts with `localeCompare(…, "en", { sensitivity: "base" })`.
- `listFinishedPrices` reads the ids of the raw product's active finished products from `products`, then their rows from `v_product_pricing`.
- `getStock` returns the balance row, or `null` when there is none, plus the product's non-void receipt count.

**Done when:** the suite is green and `npm test` is green.

### T5: Sign-in, sign-out, the session proxy, and the not-allowed page meet their criteria in a browser

**Depends on:** T1, T2
**Touches:** src/proxy.ts, src/app/_server/session.ts, src/app/sign-in/*, src/app/receiving/page.tsx, src/app/receiving/error.tsx, test/e2e/*, playwright.config.ts, package.json, supabase/config.toml

**Tests:** no stub (manual QA exercised by E2E, and one goal-based check).
- `test/e2e/auth.spec.ts` covers AC-0001, AC-0003, AC-0041, AC-0005, AC-0061, AC-0006, and the AC-0004 message and Sign out button.
- **AC-0061:** reads the refresh token from the session cookie before Sign out. After Sign out, it posts that token to the auth server's refresh-token grant and expects a refusal.
- **AC-0062 (goal-based):** after the stack restart, `docker inspect` of the `supabase_auth_meat-ops` container shows the session timebox and inactivity settings set to 168h and 12h. If the CLI passes neither setting to the container, stop and surface it, because then the config does not reach the server.
- **AC-0006:** reads `context.cookies()` after sign-in, and again after one request through the proxy with an expired access token. The test sets the session cookie's `expires_at` in the past so the proxy refreshes it. Every cookie whose name starts with `sb-` and contains `-auth-token` has `httpOnly: true` and `sameSite: "Lax"`.
- **AC-0041:** asserts that no such cookie exists.
- **AC-0068 (goal-based):** a scripted run starts `npm run dev`, confirms `/sign-in` answers 200, and writes `POSTGRES_URL=<marker>` into `.env.local`. It waits for the reload log line, then sends a GET to `/sign-in`, a GET to `/receiving`, and a POST to `/receiving`. Each must answer 500 with a body without the marker. The POST works without a captured action id, because the proxy's privileged check runs before routing. The run then removes `.env.local`, or restores it if one existed before.
- The per-state helper (AC-0025, AC-0026, AC-0054, AC-0030, AC-0031) runs on the sign-in, failed sign-in, and non-operator states.
- AC-0036: the `test` script becomes `vitest run && playwright test`.

**Approach:**
- Write the proxy, the session client, and the actions per the design decisions. The proxy's privileged check comes first.
- The receiving page shows a placeholder heading until T6.
- Create the operator and non-operator storage states in a Playwright setup project.

**Done when:** `npm test` is green with the auth spec included.

### T6: A receipt saves and shows its before-and-after result in a browser

**Depends on:** T3, T4, T5
**Touches:** src/app/receiving/*, src/lib/receiving.ts, test/e2e/receiving.spec.ts, test/e2e/auth.spec.ts

**Tests:** no stub (manual QA exercised by E2E).
- `test/e2e/receiving.spec.ts` covers AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0042, AC-0046, AC-0027, AC-0055, AC-0028, AC-0056, AC-0029, the AC-0019 and AC-0042 members of AC-0057, and the on-hand and first-receipt rows of AC-0067.
- `test/e2e/auth.spec.ts` gains the form assertions of AC-0002 ("receiving form shown") and AC-0004 ("no receiving form"). Both locate the form by its accessible name.
- The per-state helper (AC-0025, AC-0026, AC-0054, AC-0030, AC-0031) runs on the empty form, the form after a refused blank weight, the form after an AC-0019 refusal, the form after an AC-0042 refusal, and the form after a save.
- Mechanisms the criteria need:
  - **AC-0008:** inserts vendors `acme`, `Reyes Meats`, and `Bayside` through `pg` and reads the option order.
  - **AC-0016:** inserts a second raw product with no finished product.
  - **AC-0018:** delays the action response with `page.route`, presses Save twice before it returns, then counts `lots` rows through `pg`.
  - **AC-0019:** sets the product inactive through `pg` after the page loads.
  - **AC-0042 and AC-0046, ended session:** both cases of the spec's definition run after the form loads, each asserting the message, kept field values, and no new lot through `pg`.
    - The first case clears the context's cookies.
    - The second uses a session of its own, so the saved operator session that later tests reuse survives. The test signs the operator (never the password operator) in through the auth API for a fresh session. It loads that session's cookies into a new browser context, never saving them under `test/e2e/.auth/`, and opens the form there. It revokes that session at the auth server with its access token (`POST /auth/v1/logout?scope=local`), then sets that context's session cookie `expires_at` in the past. The proxy's refresh is then refused before the action runs.
  - **AC-0009:** compares the date field with the browser's local date from `page.evaluate`.
  - **AC-0044 and AC-0066, save half:** a save action request captured from an operator session is replayed with Playwright's `request` context, once with no cookies and once with the non-operator's storage state. `pg` shows no new lot, and each response body contains its message.

**Approach:**
- Build the components in the decomposition.
- Follow the `frontend-engineering` craft rules and the tokens.
- The save action calls `revalidatePath("/receiving")` after a write.

**Done when:** `npm test` is green with the receiving spec included.

### T7: Recent receipts list and void flow meet their criteria in a browser

**Depends on:** T6
**Touches:** src/app/receiving/*, test/e2e/receiving.spec.ts, test/e2e/auth.spec.ts

**Tests:** no stub (manual QA exercised by E2E).
- `test/e2e/receiving.spec.ts` covers AC-0020, AC-0047, AC-0048, AC-0049, AC-0021, AC-0022, AC-0050, AC-0051, AC-0023, AC-0052, AC-0053, AC-0043, the AC-0043 and AC-0052 members of AC-0057, and the all-void rows of AC-0067. AC-0053 reads the price in the product region, which re-renders from the database after the void.
- **AC-0044 and AC-0066, void half:** in `test/e2e/auth.spec.ts`, a void action request captured from an operator session is replayed the same two ways. `pg` shows no new void mark, and each response body contains its message.
- The AC-0021 fixture is the one from T4.
- The AC-0052 refusal runs `produce_batch` through `callAsOperator` after the list renders and before Void is confirmed.
- **AC-0043:** both ended-session cases from T6 run after the list loads, the second again on a session of its own. Each asserts the message and no new void mark through `pg`.
- The per-state helper (AC-0025, AC-0026, AC-0054, AC-0030, AC-0031) runs on the open void confirmation and on the receipts list after an AC-0052 refusal.

**Approach:**
- Build the recent receipts list and the void dialog.
- `voidReceipt` takes the bound lot id and the reason as caller input, and calls `revalidatePath("/receiving")`.

**Done when:** `npm test` is green with every browser criterion covered.

### T9: A request with a foreign or missing Host is refused before anything runs

**Depends on:** none
**Touches:** src/proxy.ts, test/e2e/auth.spec.ts

**Tests:** no stub (manual QA exercised by E2E).
- **AC-0069**, in `test/e2e/auth.spec.ts`, with raw requests from `node:http` to the `npm run start` test server:
  - `Host: rebind.example:3100` gets 421 for `/`, `/sign-in`, `/_next/static/x.js`, `/_next/image`, and `/favicon.ico`.
  - An HTTP/1.1 request with no `Host` header (`setHost: false`) gets Node's 400, and an HTTP/1.0 request with no `Host` header, written to a raw `net` socket, gets 421. Neither renders a page.
  - A sign-in action POST with the operator's valid credentials and `Host: rebind.example:3100`, sent to `/sign-in` and to `/favicon.ico`, creates no new `auth.sessions` row for the operator, checked through `pg` before and after. The action id comes from a sign-in request captured the way the AC-0066 replay tests capture theirs.
  - `/sign-in` with `Host: 127.0.0.1:3100` and with `Host: localhost:3100` is not refused.

**Approach:**
- The proxy's matcher covers every path.
- The proxy checks `Host` first, then the privileged variables, then returns at once for `/_next/static/`, `/_next/image`, and `/favicon.ico`, with no session work.
- The server's own options stay as Next sets them, so Node keeps refusing an HTTP/1.1 request with no `Host`.

**Done when:** `npm test` is green with the new tests included.

### T10: Failure messages, the sign-in mapping, the session outcome, and the request limit pass their examples

**Depends on:** none
**Touches:** src/lib/rpc.ts, src/lib/failures.ts, src/lib/receiving.ts, test/failures.test.ts, test/receiving-data-extra.test.ts

**Tests:**
- Failure classification, construction for AC-0070, AC-0080, AC-0072, AC-0082, AC-0083, and AC-0077, in `test/failures.test.ts`. stub: true

```ts
import { describe, expect, it } from "vitest";
import {
  DB_CALL_TIMEOUT_MS,
  authFailureLogLine,
  saveFailureMessage,
  sessionOutcome,
  signInFailureMessage,
  voidFailureMessage,
  withTimeout,
} from "../src/lib/failures.js";
import { RpcError } from "../src/lib/rpc.js";

const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";
const SAVE_UNKNOWN =
  "The receipt may not have been saved. Reload this page and check Recent receipts before saving again.";
const VOID_UNKNOWN = "The receipt may not have been voided. Reload this page to see whether it was.";
const noAnswer = (wrapper: string) => new RpcError(`${wrapper} failed: TypeError: fetch failed`, "");

// STUB: AC-0072
describe("AC-0072: save failure messages", () => {
  it("says the receipt wasn't saved when a call before the write failed", () => {
    expect(saveFailureMessage(new Error("getStock failed: TypeError: fetch failed"), "before-write")).toMatch(
      /^The receipt wasn't saved\./,
    );
  });

  it("says the receipt may not have been saved when the write got no engine answer", () => {
    expect(saveFailureMessage(noAnswer("receiveLot"), "write")).toBe(SAVE_UNKNOWN);
  });

  it("keeps an engine refusal as wasn't saved", () => {
    const inactive = new RpcError(
      "receiveLot failed: receive_lot: product 6f1c2a9e-0b7d-4c2e-9a51-3d8e7f40b2c6 is inactive",
      "P0001",
    );
    const outsider = new RpcError("receiveLot failed: receive_lot: not allowed (caller is not an operator)", "42501");
    expect(saveFailureMessage(inactive, "write")).toBe("The receipt wasn't saved. This product is no longer active.");
    expect(saveFailureMessage(outsider, "write")).toBe(`The receipt wasn't saved. ${NOT_ALLOWED}`);
  });
});

// STUB: AC-0083
describe("AC-0083 and AC-0077: void failure messages", () => {
  it("says the receipt wasn't voided when a call before the write failed", () => {
    expect(voidFailureMessage(new Error("isOperator failed: TypeError: fetch failed"), "before-write")).toMatch(
      /^The receipt wasn't voided\./,
    );
  });

  it("says the receipt may not have been voided when the write got no engine answer", () => {
    expect(voidFailureMessage(noAnswer("voidReceipt"), "write")).toBe(VOID_UNKNOWN);
  });

  it("adds the reload hint to an engine refusal", () => {
    const consumed = new RpcError(
      "voidReceipt failed: void_receipt: invalid, lot 0c4b7e2d-5a19-4f63-b8e0-91d2a6c3f57e has been consumed",
      "P0001",
    );
    expect(voidFailureMessage(consumed, "write")).toMatch(
      /^The receipt wasn't voided\. .*Reload to see the latest stock\.$/,
    );
  });
});

// STUB: AC-0082
describe("AC-0082: the request limit", () => {
  it("is 10 seconds", () => {
    expect(DB_CALL_TIMEOUT_MS).toBe(10_000);
  });

  it("aborts a request that never answers with an AbortError, which postgrest-js does not retry", async () => {
    const never: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    await expect(withTimeout(never, 50)("http://127.0.0.1/rest/v1/lots")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

// STUB: AC-0070
describe("AC-0070: sign-in failure messages", () => {
  it("keeps the wrong-password message for bad credentials only", () => {
    const later = "Couldn't sign in right now. Wait a few minutes and try again.";
    expect(signInFailureMessage({ code: "invalid_credentials", status: 400 })).toBe("Email or password is incorrect.");
    expect(signInFailureMessage({ code: "over_request_rate_limit", status: 429 })).toBe(later);
    expect(signInFailureMessage({ code: "unexpected_failure", status: 500 })).toBe(later);
    expect(signInFailureMessage({ status: 0 })).toBe(later);
  });
});

// STUB: AC-0080
describe("AC-0080: the sign-in failure log line", () => {
  it("holds the code and status and nothing else from the error", () => {
    const error = { code: "over_request_rate_limit", status: 429, message: "limit hit for owner@example.com" };
    const line = authFailureLogLine(error);
    expect(line).toContain("over_request_rate_limit");
    expect(line).toContain("429");
    expect(line).not.toContain("owner@example.com");
  });

  it("says no answer when the auth server sent no code or status", () => {
    expect(authFailureLogLine({ status: 0 })).toContain("no answer");
  });
});

// STUB: AC-0042
describe("caller check: an ended session or a failed lookup", () => {
  it("reads claims as signed in", () => {
    expect(sessionOutcome({ claims: { sub: "user" }, error: null })).toBe("signed-in");
  });

  it("reads no claims with no error, or an auth refusal, as an ended session", () => {
    expect(sessionOutcome({ claims: null, error: null })).toBe("ended");
    expect(sessionOutcome({ claims: null, error: { code: "session_not_found", status: 403 } })).toBe("ended");
  });

  it("reads no answer, a rate limit, or a server error as a failed lookup", () => {
    expect(sessionOutcome({ claims: null, error: { status: 0 } })).toBe("failed");
    expect(sessionOutcome({ claims: null, error: { status: 429 } })).toBe("failed");
    expect(sessionOutcome({ claims: null, error: { status: 503 } })).toBe("failed");
  });
});
```

- `listRawProducts`, which reads every raw product, moves next to the other typed reads and gains a local-stack case in `test/receiving-data-extra.test.ts`: an inactive raw product is included.

**Approach:**
- `RpcError` keeps each wrapper's existing message text, so the foundation suites' message checks still hold, and adds `code`.
- `src/lib/failures.ts` is pure: no imports from `src/app/`, no environment reads.
- `withTimeout` aborts through its own `AbortController`, combined with any signal the caller passed, so the fetch rejects with an `AbortError`.

**Done when:** the suite is green and `npm test` is green.

### T11: Failed saves, voids, and sign-ins keep their screens and say what happened

**Depends on:** T9, T10
**Touches:** src/app/_server/*, src/app/receiving/*, src/app/sign-in/*, src/proxy.ts, test/e2e/*

**Tests:** no stub (manual QA exercised by E2E).
- **AC-0071 and AC-0081:** `page.route` aborts the save action's request. The message reads as specified, every field keeps its value, and focus is on the message (AC-0057). The per-state helper runs on this page state.
- **AC-0073:** `page.route` aborts the void action's request. The list stays, the message reads as specified, and focus is on it. The per-state helper runs on this page state.
- **AC-0077:** the AC-0052 test asserts the reload hint, not the pre-refusal stock value.
- **AC-0066:** both replay assertions check the action's full refusal text ("The receipt wasn't saved." or "The receipt wasn't voided." followed by the not-allowed sentence), not the bare sentence the not-allowed page also renders.
- **AC-0005:** a second test signs out from the operator's receiving page.
- The AC-0042, AC-0043, and AC-0044 tests pass through the shared caller check.

**Approach:**
- `saveReceipt` and `voidReceipt` use the shared caller check. `signIn` and `signOut` keep their own cookie-writing client.
- Every server-side Supabase client, the proxy's included, fetches through `withTimeout`.
- `saveReceipt` maps failures with `saveFailureMessage` by stage. It logs a failed read after the write with its message only and still shows the saved lot.
- `voidReceipt` maps failures with `voidFailureMessage` by stage.
- `signIn` uses `signInFailureMessage` and logs `authFailureLogLine`.
- The form and the dialog catch rejected action calls.
- `src/app/receiving/error.tsx` calls `retry` and focuses its heading.
- `refusal.ts` is removed.

**Done when:** `npm test` is green.

### T12: The receiving screen stays current and correct across time, products, and voids

**Depends on:** T11
**Touches:** src/app/receiving/*, test/e2e/*, test/format-extra.test.ts

**Tests:** no stub (manual QA exercised by E2E), plus one Vitest case.
- **AC-0010 and AC-0011 across midnight:** with Playwright's clock set to 23:59 local, the form loads. The clock then moves past midnight, and a receipt dated the new day saves.
- **AC-0009:** the browser clock is pinned to a moment when the device date and the UTC date differ, so a UTC-based default fails at any hour.
- **AC-0078:** after the page loads, one inactive raw product is set active and one new raw product is inserted, both through `pg`. Typing each code and pressing Save writes one lot.
- **AC-0010 and AC-0019 stay green:** the RAW-OLD case still shows the field message, and the made-inactive-after-load case still shows the engine refusal.
- **AC-0007 after a save:** a product set active after page load shows its description once a save has re-rendered the page.
- **AC-0076:** a receipt is saved through the form, then voided from the list on the same page. The panel says "This receipt was voided." and shows no totals. The per-state helper runs on this page state.
- **AC-0079:** the open dialog's accessible description contains the lot number, weight, and vendor.
- **AC-0026 with long numbers:** the after-save state runs the per-state helper with on-hand above 100,000 lbs with decimals.
- **`test/e2e/a11y.ts`:** the Tab walk ends only when focus leaves the page or returns to the first element reached.
- **Vitest:** `test/format-extra.test.ts` gains a case that fails for a date formatter built in the host's zone, whatever that zone is.

**Approach:**
- `submit()` reads the device date when Save is pressed, for the rule, the hidden field, and `max`.
- The form reads the page's product list from its latest `products` prop.
- A code missing from that list skips the browser's code rule and is sent marked for the server's current check.
- The first-run notice adds "then reload this page".
- The panel marks its lot voided when the re-rendered list shows that lot as void.
- Result-panel cells may wrap between a number and its unit.
- The dialog sets `aria-describedby` on its lot sentence.

**Done when:** `npm test` is green.

### T8: Durable docs match the code, and the goal-based checks and the recorded run pass

**Depends on:** T7, T9, T11, T12
**Touches:** docs/architecture/overview.md, AGENTS.md, docs/costing.md, .env.example, test/e2e/checks/ac0068-env-reload.sh, docs/specs/receiving/notes/verification-ledger.md

**Tests:** no stub (goal-based and manual).
- Commands for AC-0033, AC-0034, AC-0035, AC-0037, AC-0038, AC-0059, AC-0039, AC-0060, AC-0068, AC-0040, AC-0063, AC-0064, and AC-0065 (`npm run audit`), each recorded in the ledger. A high or critical advisory with no fix stops the task until the owner records a waiver.
- `test/e2e/checks/ac0068-env-reload.sh` exits non-zero unless all three responses are 500 and the marker appears in no body and not in the dev log.
- **Recorded run (AC-0070, AC-0080, AC-0072, AC-0081, AC-0082, AC-0083, AC-0074, AC-0075, and the error page state)**, against `npm run start`, one local service at a time:
  1. Stop the auth container and sign in. Record the message and the server log line.
  2. With the auth container started, load `/receiving` and fill a form. Restart the app server, so it holds no cached signing key and its caller check must reach the auth server. Stop the auth container and press Save. Record the message, the kept values, and where focus lands, then start the container.
  3. Stop the REST container and load `/receiving`. Record the error page, focus on its heading, and the per-state checks from `test/e2e/a11y.ts`. Start the container, press Try again, and record the page shown.
  4. With a form filled, stop the REST container and press Save. Record the message, the kept values, and where focus lands, then start the container.
  5. With the list shown, stop the REST container and confirm a void. Record the message, the list, and where focus lands, then start the container.
  6. Pause the REST container and press Save. Record the seconds from Save to the message, then unpause the container.
  - The write-call clauses of AC-0072 and AC-0083 rest on T10 alone, because stopping a service fails the calls before the write first.
- Foundation-hardening AC-0049 still holds for `AGENTS.md`: every cited path exists.

**Approach:**
- Write the durable outputs named in the spec. The overview's trust-boundary section gains the AC-0069 Host refusal, the accepted dev-mode exposure, and the AC-0082 request limit.
- The `docs/costing.md` Rounding note states the AC-0024 formats, with "trailing zeros dropped" for weight, and the AC-0067 texts. Its opening names `test/format.test.ts` and `test/e2e/receiving.spec.ts`.
- `AGENTS.md` names `npm run build` then `npm run start` as the command for daily use, and `npm run dev` as for development only, with its accepted DNS-rebinding exposure.
- The overview's caller-check sentence names `saveReceipt` and `voidReceipt`.
- `.env.example` names only `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- The ledger names every file a task changed outside its Touches, and records that T2, T3, and T4 ran no build.

**Done when:** each check in Tests passes and `npm test` is green.

## Rollout

Local only. The app runs with `npm run dev` or `npm run build && npm run start` against the local stack, on 127.0.0.1. The one migration is additive: one function and its grants. The `[auth.sessions]` limits change the local auth config and take effect after a stack restart. Rolling back means dropping the function, restoring the config, and reverting the app code. Hosting the database is the [hosted rollout intent](../../product/intents/hosted-supabase-rollout.md), and hosting the app is the [app HTTPS hosting intent](../../product/intents/app-https-hosting.md).

## Risks

- **Auth rate limit.** The local auth server allows 30 sign-ins per 5 minutes per IP, and two `npm test` runs within that window come closer to it now. Storage states keep the browser suite to a handful of form sign-ins. If runs still trip the limit, raising `[auth.rate_limit] sign_in_sign_ups` in `supabase/config.toml` for the local stack is an ask-first change.
- **Build lock.** `next build` inside the Playwright web server can collide with a running `next dev`, because Next.js 16 holds a lockfile per project. The fix is to stop the dev server before `npm test`, and `AGENTS.md` says so.
- **Supabase-js upgrade.** The existing suites run on the new client before any app code depends on it.

## Changelog

- 2026-10-07: initial plan.
- 2026-10-08: round-1 review repairs. The web server runs without privileged variables, enforced by a startup guard. Browser tests run one at a time. Storage states have an ignored home. The form assertions move to T6. The per-state helper owns the focus checks. The receipts list orders by entry, and session-ended actions keep the form.
- 2026-10-08: round-2 review repairs:
  - Privileged variables are matched by a name rule in one module, checked at start and on every request.
  - Each action settles the caller before running form rules.
  - The socket check walks the process tree.
  - The focus walk survives multi-stop controls.
  - The product region shows current finished prices.
  - The access-model row moves to T2.
- 2026-10-08: round-3 review repairs:
  - The boot guard moves to `next.config.ts`, which covers build, start, and dev (scratch probe).
  - The AC-0039 source checks follow the name rule.
  - AC-0068 covers GET and POST.
  - Both ended-session cases are exercised.
- 2026-10-08: controlled amendment after the post-build review (owner decisions recorded in the ledger). T1 to T7 are complete and unchanged. New tasks:
  - T9: the Host check.
  - T10: failure classification and the time limit, test-first.
  - T11: failed actions and sign-ins keep their screens.
  - T12: the date across midnight, new products, the panel after a void, the dialog description, and long numbers.
  - T8 now runs last and also fixes the AC-0068 script, `.env.example`, and the ledger records.
- 2026-10-08: amendment review round 1 repairs:
  - The proxy matches every path, and a missing `Host` is refused too; dev mode is an accepted exposure.
  - Save and void failures are keyed on the call that failed, and a read after the write stays a save.
  - The caller check tells an ended session from a failed auth lookup, and it serves only `saveReceipt` and `voidReceipt`.
  - The request limit is stated per REST request and the proxy's client is under it (T11).
  - Codes missing from the page's product list get a current server check, so AC-0010, AC-0019, and AC-0078 all hold.
  - The root error page is dropped; the recorded run covers the failure criteria the shared suite cannot.
- 2026-10-08: amendment review round 2 repairs:
  - A Host-less HTTP/1.1 request gets Node's 400, and a Host-less HTTP/1.0 request gets 421.
  - The recorded run adds a save with the auth service stopped and records focus after each failure; the write-call clauses rest on T10, with a seam queued in the test-refinements intent.
  - `AGENTS.md` names `npm run start` for daily use and `npm run dev` for development only.
  - The failure log line says "no answer" when the auth server sent no code or status.
- 2026-10-08: amendment review round 3 repairs:
  - The recorded auth-stopped save restarts the app server first, because `getClaims` checks ES256 tokens with a signing key it caches for 10 minutes.
  - The product-list definition rests on the latest server render alone.
  - AC-0072 and AC-0083 name the calls before the write as examples, and bound only REST calls by time.
