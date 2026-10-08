# Spec: receiving

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §2 (deterministic engine), §8 (web app, floor and office), §10 (owner login in scope), §11 (boundaries), §13 item 2; [`docs/costing.md`](../../costing.md) (average rule, void_receipt rule); the access model and the `supabase/migrations/` change guidance in [`docs/architecture/overview.md`](../../architecture/overview.md); foundation-hardening AC-0001, AC-0003, AC-0005, and AC-0052 ([`../foundation-hardening/spec.md`](../foundation-hardening/spec.md)), which hold for every `public` function, including the one this feature adds
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the pages and server actions are consumed only by this app; no published interface)
- **Shape:** ui

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory — it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

The owner logs a raw-meat delivery on the computer that runs the app. The
screens also fit a phone at the dock, which reaches the app once it is hosted
with HTTPS. They sign in, type the raw product's code, pick the vendor, and enter
the weight, the cost per lb, the received date, and an optional note. After
saving, the screen confirms the lot the engine wrote. It shows the product's
pounds on hand and average cost per lb before and after the receipt. It also
shows the suggested price of each finished product made from that raw product,
before and after. If a receipt was typed wrong and nothing has used it yet, the
owner voids it, with a reason, from the product's recent receipts. When a save
fails, the form keeps what was typed; when a void fails, the list stays; either
way the screen says plainly whether it may have gone through. Every number
on screen comes from the database. The app computes no cost, price, average, or
stock.

The screens aim at three ranked goals: hard to mistype first, fast on a phone
second, and numbers that are easy to trust third.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture and app trust boundary | Applicable: the app layer, its routes, its auth flow, and a new database function change the map and the access model | `docs/architecture/overview.md` | jaketlee07 | The areas table has rows for `src/app/` and `test/e2e/`. The access model names `check_operator` for each role. The write path says the app changes the ledger only through `receive_lot` and `void_receipt` with the signed-in user's session. An app section names the only variables the app process holds and the guard that refuses the privileged ones; the auth cookie attributes and the session limits; the 127.0.0.1-only network posture, the AC-0069 Host refusal with the dev-mode exposure accepted beside it, and the accepted shared sign-in limit; the AC-0082 request limit; and that the proxy refreshes sessions but authorizes nothing | close-work confirms each named row and sentence exists and matches the migrations, `supabase/config.toml`, and `src/` |
| Agent guidance and commands | Applicable: `AGENTS.md` says there is no build step, and the dev server, the build, the browser suite, and local env setup are new | `AGENTS.md` "Build and test commands" | jaketlee07 | The section lists `npm run build` with `npm run start` as the command for daily use, `npm run dev` as for development only with its accepted DNS-rebinding exposure, `npm run test:e2e`, the one-time browser install, and which variables the app's env file holds; each command runs | close-work runs each listed command or confirms it ran in the closing gates |
| Display rounding (current product truth) | Applicable: the on-screen formats, missing-value texts, and rounding rule are a product decision that outlives this spec | `docs/costing.md` "Rounding note" | jaketlee07 | The note states the AC-0024 formats, the AC-0067 texts, and the half-away-from-zero rule, and the file's opening names the suites that assert them | close-work finds each AC-0024 example and AC-0067 text in the note and in a passing test |
| Interface compatibility | Applicable: the new function changes the generated types | `src/lib/database.types.ts` | jaketlee07 | AC-0034 passes | `npm run gen:types` leaves no diff on the closing commit |
| User documentation | Not applicable: no user-docs surface exists, the owner is the only user, and the screen labels carry the task | none | — | — | — |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | — | — | — |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the stack is recorded in the architecture overview and the reasons in `plan.md` | none | — | — | — |

## Boundaries

### Always do

- Read every cost, price, stock, and average shown on screen from the database, and change it only for display through the AC-0024 formats and the AC-0067 texts.
- Change the ledger only through `receive_lot` and `void_receipt`, called with the signed-in user's session.
- Confirm a signed-in session inside every server action before it calls the database.
- Follow the change guidance for `supabase/migrations/` in [`docs/architecture/overview.md`](../../architecture/overview.md).
- Run `npm run typecheck`, `npm run build`, and `npm test` after each task; a red result stops the work until it is green.

### Ask first

- Any change to the six operations, the three views, an existing grant or policy, or a number asserted in `test/costing.test.ts`.
- Adding an npm package beyond: `next`, `react`, `react-dom`, `@supabase/ssr`, `tailwindcss`, `@tailwindcss/postcss`, `@types/react`, `@types/react-dom`, `@playwright/test`, `@axe-core/playwright`, and the `@supabase/supabase-js` upgrade that `@supabase/ssr` requires.
- Adding a route beyond `/`, `/sign-in`, and `/receiving`.
- Any write to the hosted Supabase project, or pointing the app at it.
- Any change to `supabase/config.toml` other than the session limits in AC-0062.

### Never do

- Compute a cost, price, shrink, average, margin, or stock figure in TypeScript, including a "before" value derived from an "after" value.
- Build, start, or run the app with a privileged variable (defined under Acceptance Criteria) in its environment.
- Import a Postgres driver under `src/`.
- Read a privileged variable anywhere under `src/`, except in `src/privileged-env.ts`, which only tests whether one is set.
- Commit a new top-level directory, or add a sign-up page, a password reset, a PWA manifest, a service worker, or offline queueing.
- Import anything from `src/app/` into `src/lib/`.
- Edit an existing migration file.

## Testing Strategy

The Vitest suites and the Playwright browser suite run under `npm test` against the local Supabase stack. Goal-based checks run as the commands their criteria name.

- **TDD, no database: display formats (AC-0024)** — each format row is a pure rule with exact examples, including rounding ties and time zones, that a wrong formatter fails. The form rules behind the receiving form's messages are unit-tested the same way, as construction for the browser criteria below.
- **TDD, no database: failure classification, as construction for the recorded run below** — which message a sign-in, save, or void failure produces, what the server log line carries, how the caller check tells an ended session from an auth lookup that got no answer, and when a request gives up are pure rules over error codes, statuses, and a clock. The automated suites share one local stack, so they cannot stop or pause a service mid-run; these rules are proven directly, and the recorded run proves the wiring for every failure it can produce. Stopping a service always fails the calls before a write call first, so the write-call clauses of AC-0072 and AC-0083 rest on these unit rules alone; a test seam for them is queued in `docs/product/intents/receiving-test-refinements.md`.
- **TDD against the local stack: the operator check and the recent-receipts read** — construction for the not-allowed page and the receipts list. The check's answer for an operator and a non-operator, and the read's ordering, count, and status rule, are fixed by users and lots built through the operations. The catalog-driven access suite in `test/access.test.ts` covers the new function for every role, as foundation-hardening requires.
- **Manual QA exercised by an end-to-end (E2E) browser suite: sign-in, receiving, recent receipts, and void (AC-0001, AC-0002, AC-0003, AC-0041, AC-0004, AC-0005, AC-0061, AC-0006, AC-0044, AC-0066, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0042, AC-0046, AC-0020, AC-0047, AC-0048, AC-0049, AC-0021, AC-0022, AC-0050, AC-0051, AC-0023, AC-0052, AC-0053, AC-0043, AC-0067, AC-0069, AC-0071, AC-0081, AC-0073, AC-0076, AC-0077, AC-0078)** — each criterion is a state, a trigger, and an on-screen outcome that only a real browser over the real server and database shows. The suite drives Chromium through Playwright and reads raw tables through `pg` to confirm what was or was not written.
- **E2E accessibility and phone-width checks (AC-0025, AC-0026, AC-0054, AC-0027, AC-0055, AC-0028, AC-0056, AC-0057, AC-0029, AC-0030, AC-0031, AC-0079)** — axe-core, measured element boxes, and computed styles in the same browser suite give a pass or fail bar per page state.
- **Manual QA recorded in the verification ledger (AC-0070, AC-0080, AC-0072, AC-0082, AC-0083, AC-0074, AC-0075, and the `/receiving` error page state)** — these outcomes need a stopped or paused local service. A recorded run against `npm run start` stops or pauses one service at a time: the auth service for a sign-in, and for a save pressed after the app server restarts, so it holds no cached signing key and its caller check must reach the auth server; the REST service for a page load, a save, and a void; then the REST service paused for the timing. It records each message, the log line, the seconds from Save to the message, the page-state checks on the error page, and the recovery after Try again. For each save and void failure it produces, it also records the AC-0081 kept values or the list, and the AC-0057 focus.
- **Goal-based checks (AC-0062, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0059, AC-0039, AC-0060, AC-0068, AC-0040, AC-0063, AC-0064, AC-0065)** — each is settled by one command or one short scripted run: a build, a type regeneration diff, the security advisor, a dependency audit, a test run, a start attempt, an env-file change against a running dev server, a socket listing, a container inspection, or a `grep`.

## Acceptance Criteria

Definitions used by these criteria:

- **Operator, non-operator, signed-out visitor:** the roles in the access model of [`docs/architecture/overview.md`](../../architecture/overview.md). A signed-out visitor holds no session.
- **Active raw product:** a `products` row with `kind = 'raw'` and `active = true`.
- **The page's product list:** the active raw products as of the receiving page's latest server render.
- **Receipt:** one `lots` row of the chosen raw product, void or not. A **non-void receipt** has no `voided_at`.
- **Untouched receipt:** a receipt that `void_receipt` accepts, per the `void_receipt` rule in [`docs/costing.md`](../../costing.md).
- **Finished products made from a raw product:** the rows of `v_product_pricing` whose product has that raw product as its raw input.
- **Page states:** sign-in; sign-in after a wrong password; the non-operator page; the empty receiving form; the form after an AC-0010 refusal of a blank weight; the form after an AC-0019 refusal; the form after an AC-0042 refusal; the form after a save; the open void confirmation; the receipts list after an AC-0052 refusal; the form after an AC-0071 failure; the receipts list after an AC-0073 failure; the form after a save whose receipt was then voided (AC-0076); the `/receiving` error page.
- **Focusable controls of a page state:** every element that receives focus when Tab is pressed repeatedly from the top of the page, until focus leaves the page or returns to the first element reached. An element that keeps focus across several Tab presses counts once and does not end the walk.
- **Ended session:** the browser holds no Supabase auth cookie, or its access token has expired and the auth server refuses its refresh token. A session revoked at the auth server whose access token has not yet expired is not ended for these criteria.
- **Host scope:** every criterion except AC-0069 concerns requests whose `Host` header names `127.0.0.1` or `localhost`.
- **Advisory waivers:** none. Each waiver names an npm advisory ID, the date, and the owner's acceptance. Adding one changes this contract section, so it is an amendment.
- **Privileged variable:** an environment variable whose name contains, ignoring case, `SERVICE_ROLE`, `SECRET`, `JWT`, `DB_URL`, `DATABASE_URL`, or `POSTGRES`. The check names are `SERVICE_ROLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SECRET_KEY`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`, `S3_PROTOCOL_ACCESS_KEY_SECRET`, `DB_URL`, `DATABASE_URL`, and `POSTGRES_URL`.

Sign-in and access

- [x] **AC-0001.** While signed out, a request for `/` or for `/receiving` ends on `/sign-in`, which shows an email field, a password field, and a Sign in button.
- [x] **AC-0002.** Signing in with an operator's email and password ends on `/receiving` with the receiving form shown.
- [x] **AC-0003.** Signing in with a wrong password stays on `/sign-in` and shows "Email or password is incorrect."
- [x] **AC-0041.** After a sign-in with a wrong password, the browser holds no Supabase auth cookie.
- [x] **AC-0004.** Signed in as a non-operator, `/receiving` shows "This account isn't allowed to use Meat Ops." and a Sign out button, and shows no receiving form.
- [x] **AC-0005.** Choosing Sign out ends on `/sign-in`, and a following request for `/receiving` ends on `/sign-in`.
- [x] **AC-0061.** After Sign out, the auth server refuses the refresh token the browser held before signing out.
- [x] **AC-0062.** The running local auth server is configured to end a session after 12 hours without activity and 168 hours after sign-in, as its container configuration shows after a stack restart.
- [x] **AC-0006.** Every Supabase auth cookie the app sets, at sign-in and when the proxy refreshes an expired access token, is `HttpOnly` and `SameSite=Lax`.
- [x] **AC-0044.** A save or void action request replayed with no session, or with a non-operator's session, writes no lot and no void mark.
- [x] **AC-0066.** A save or void action request replayed with no session returns the AC-0042 or AC-0043 message, and one replayed with a non-operator's session returns a message containing "This account isn't allowed to use Meat Ops."
- [x] **AC-0069.** While the app runs under `npm run start`, a request for any path is refused before any page renders or server action runs, so a sign-in action posted that way creates no auth session, when its `Host` header names a host other than `127.0.0.1` or `localhost`, with or without a port (status 421), when it is an HTTP/1.0 request with no `Host` header (status 421), or when it is an HTTP/1.1 request with no `Host` header (Node's status 400).
- [x] **AC-0070.** When a sign-in fails for any reason other than bad credentials, including the auth server's rate limit, an error status, or no answer at all, `/sign-in` shows "Couldn't sign in right now. Wait a few minutes and try again."
- [x] **AC-0080.** Each AC-0070 failure writes one server log line that holds the auth error's code and status, or "no answer" when the auth server sent none, and holds neither the email nor the password.

Receiving form

- [x] **AC-0007.** Typing the code of a product in the page's product list into the product field shows that product's description and species, and its current pounds on hand and average cost per lb.
- [x] **AC-0008.** The vendor field lists every vendor by name, in alphabetical order ignoring case.
- [x] **AC-0009.** The received date starts at today's date on the device.
- [x] **AC-0010.** Each input in this table is refused with its message shown beside its field. Within one field, the first matching row wins.

  | Field | Input | Message |
  | --- | --- | --- |
  | Product code | blank | Enter a product code. |
  | Product code | not the code of an active raw product, including a finished product's code and an inactive raw product's code | No active raw product has code `<code>`. |
  | Vendor | none chosen | Choose a vendor. |
  | Weight | blank, or anything other than digits with at most one decimal point | Enter the weight in lbs, like 5000 or 32.5. |
  | Weight | more than 3 decimal places | Use at most 3 decimal places for weight. |
  | Weight | a value equal to 0, such as 0, 0.0, or 000 | Weight must be above 0. |
  | Cost per lb | blank, or anything other than digits with at most one decimal point | Enter the cost per lb, like 1.68. |
  | Cost per lb | more than 4 decimal places | Use at most 4 decimal places for cost. |
  | Received date | blank | Enter the received date. |
  | Received date | a date after today on the device | The received date can't be after today. |
  | Notes | longer than 500 characters, counted as JavaScript string length | Keep notes to 500 characters or fewer. |

- [x] **AC-0011.** A form with weight 0.001, cost per lb 0, today's date, and a 500-character note saves one lot, and so does a form with weight 32.125 and cost per lb 1.6855.
- [x] **AC-0012.** After a save, the screen shows a "Receipt saved" heading with the lot number, product code and description, vendor name, received date, weight, and cost per lb of the lot the engine wrote, in the AC-0024 formats.
- [x] **AC-0013.** Given RAW-TOM holds one receipt of 5,000 lbs at 1.68, saving 3,000 lbs at 1.80 shows on hand before 5,000 lbs and after 8,000 lbs, and average cost before $1.6800/lb and after $1.7250/lb.
- [x] **AC-0014.** Given RAW-TOM has no receipts, saving 5,000 lbs at 1.68 shows on hand before 0 lbs and after 5,000 lbs, and average cost before "None yet" and after $1.6800/lb.
- [x] **AC-0015.** In the AC-0013 case, the result lists 502 Smoked Turkey Drums Tom with suggested price before $2.68/lb and after $2.74/lb; in the AC-0014 case, its price before is "No price yet" and after is $2.68/lb.
- [x] **AC-0016.** Saving a receipt for an active raw product that no finished product in `v_product_pricing` is made from shows "No finished products are made from this raw product."
- [x] **AC-0017.** After a save, the product, vendor, and date keep their values, and weight, cost per lb, and notes are empty.
- [x] **AC-0018.** While a save has not returned, pressing Save again writes no second lot.
- [x] **AC-0019.** When the database refuses a save that passed the AC-0010 checks, such as for a product made inactive after the page loaded, the form shows a message that starts "The receipt wasn't saved."
- [x] **AC-0042.** When the session has ended after the receiving form loaded, Save shows "You're signed out. Sign in again to save this receipt."
- [x] **AC-0046.** Every refused save, whether refused by an AC-0010 rule, by the database as in AC-0019, or for an ended session as in AC-0042, keeps every field's value and writes no lot.
- [x] **AC-0071.** If the connection to the app drops while a save is in flight, the form shows "The receipt may not have been saved. Reload this page and check Recent receipts before saving again."
- [x] **AC-0072.** When a call that a save makes before its write call fails, or a REST call among them gets no answer within the AC-0082 limit, the form shows a message that starts "The receipt wasn't saved." Those calls include the caller check's auth lookup, unless the auth server ends the session (AC-0042), the operator check, and the reads before the write. When the write call itself fails with no answer from the engine, the form shows the AC-0071 message. A failure after the engine returns the written lot is a save, which AC-0012 and AC-0017 govern.
- [x] **AC-0081.** After an AC-0071 or AC-0072 failure, every field keeps its value.
- [x] **AC-0082.** The app abandons each request it sends to the database's REST service once 10 seconds pass after sending it with no response, and does not send it again. With the local REST service paused, so it accepts each request and never answers, the AC-0072 message appears 10 to 15 seconds after Save is pressed.
- [x] **AC-0078.** On a page whose product list holds at least one product, typing the code of an active raw product that is not in the page's product list and pressing Save writes one lot of it, without a reload.

Recent receipts and void

- [x] **AC-0020.** With a product chosen, the screen lists up to 10 of its receipts, last entered first.
- [x] **AC-0047.** Each listed receipt shows its lot number, received date, vendor, weight, cost per lb, and remaining lbs.
- [x] **AC-0048.** When the product has more than 10 receipts, the list says "Showing the 10 most recent of N receipts.", where N is the product's receipt count.
- [x] **AC-0049.** When the product has no receipts, the screen shows "No receipts for this product yet."
- [x] **AC-0021.** In the list, every untouched receipt has a Void button, every void receipt shows "Void: " and its reason, and every other receipt shows "In use". The check fixture holds an untouched receipt, one that production drew from, one adjusted down and back to its full weight, and a void one.
- [x] **AC-0022.** Void opens a confirmation that names the lot number, weight, and vendor, and asks for a reason.
- [x] **AC-0050.** Cancel closes the confirmation and changes nothing.
- [x] **AC-0051.** Confirming with a blank or spaces-only reason shows "Enter a reason for the void." and changes nothing.
- [x] **AC-0023.** Given RAW-TOM holds 1,000 lbs at 1.68 and then 500 lbs at 1.80, voiding the second with a reason shows it as "Void: " and that reason, on hand 1,000 lbs, and average cost $1.6800/lb.
- [x] **AC-0052.** When the database refuses a void, such as for a lot production drew from after the list loaded, the screen shows a message that starts "The receipt wasn't voided." and the lot is unchanged.
- [x] **AC-0053.** Given RAW-TOM holds one receipt of 5,000 lbs at 1.68 and no other receipt, voiding it shows on hand 0 lbs, average cost "None yet", and 502's suggested price "No price yet".
- [x] **AC-0043.** When the session has ended after the list loaded, confirming a void shows "You're signed out. Sign in again to void this receipt." and the lot is unchanged.
- [x] **AC-0073.** If the connection to the app drops while a void is in flight, the list stays on screen and shows "The receipt may not have been voided. Reload this page to see whether it was."
- [x] **AC-0083.** When a call that a void makes before its write call fails, or a REST call among them gets no answer within the AC-0082 limit, the list stays and shows a message that starts "The receipt wasn't voided." Those calls include the caller check's auth lookup, unless the auth server ends the session (AC-0043), and the operator check. When the write call itself fails with no answer from the engine, the list stays and shows the AC-0073 message. A failure after `void_receipt` returns is not a void failure: the receipt is void, and the list shows it as void once the page renders again (AC-0023). The AC-0051, AC-0052, AC-0043, and AC-0066 outcomes keep their own messages.
- [x] **AC-0076.** After the receipt shown in the "Receipt saved" panel is voided from this page's Recent receipts list, the panel says "This receipt was voided." and no longer shows its before-and-after totals.
- [x] **AC-0077.** After an AC-0052 refusal, the message also says "Reload to see the latest stock."
- [x] **AC-0079.** The void confirmation's accessible description contains the lot number, weight, and vendor it names.

Error page

- [x] **AC-0074.** After a `/receiving` load fails because the database is unreachable, pressing Try again once the database is reachable again shows the receiving page without a browser reload.
- [x] **AC-0075.** When the `/receiving` error page appears, keyboard focus is on its heading.

Display

- [x] **AC-0024.** Numbers and dates on screen use these formats, rounding half away from zero from the decimal value the database returns:

  | Kind | Format | Examples |
  | --- | --- | --- |
  | Weight | thousands separators, 0 to 3 decimals with trailing zeros dropped, then " lbs" | 5000 → 5,000 lbs; 32.5 → 32.5 lbs; 1234.5678 → 1,234.568 lbs |
  | Cost per lb (lot cost, average) | "$", 4 decimals, "/lb" | 1.725 → $1.7250/lb; 1.68 → $1.6800/lb |
  | Price per lb (suggested price) | "$", 2 decimals, "/lb" | 2.6818 → $2.68/lb; 2.685 → $2.69/lb; 1.005 → $1.01/lb |
  | Date | month abbreviation, day, year | 2026-10-07 → Oct 7, 2026, in the UTC, America/Chicago, and Pacific/Auckland time zones |

- [x] **AC-0067.** Missing values show as text: on hand with no `inventory_balances` row shows "0 lbs"; the average of a raw product with no non-void receipt shows "None yet"; and the suggested price of a finished product whose raw product has no non-void receipt shows "No price yet".

Accessibility and phone width

- [x] **AC-0025.** axe-core reports zero violations for the WCAG tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` in each page state.
- [x] **AC-0026.** At a 320 × 640 CSS px viewport, in each page state, the page's scroll width is at most 320 CSS px.
- [x] **AC-0054.** At a 320 × 640 CSS px viewport, in each page state, every focusable control is at least 44 CSS px tall and 44 CSS px wide.
- [x] **AC-0027.** A receipt can be completed and saved with the keyboard alone.
- [x] **AC-0055.** After a save, keyboard focus is on the "Receipt saved" heading.
- [x] **AC-0028.** After an AC-0010 refusal, keyboard focus is on the first field with an error.
- [x] **AC-0056.** After an AC-0010 refusal, the `aria-describedby` of every field with an error points to that field's message.
- [x] **AC-0057.** After an AC-0019, AC-0042, AC-0043, or AC-0052 refusal, or an AC-0071, AC-0072, AC-0073, or AC-0083 failure, keyboard focus is on the message that states it.
- [x] **AC-0029.** The accessible name of the weight field contains "lbs" and that of the cost field contains "per lb".
- [x] **AC-0030.** In each page state, every focusable control, when focused from the keyboard, has a computed outline style other than `none` and an outline width of at least 2 CSS px.
- [x] **AC-0031.** In each page state, every focusable control, when focused from the keyboard, has a contrast ratio of at least 3:1 between its computed outline color and the background color behind it.

Database and build

- [x] **AC-0033.** `supabase db advisors --local --type security --fail-on warn` exits 0 after all migrations apply.
- [x] **AC-0034.** Running `npm run gen:types` leaves `src/lib/database.types.ts` with no diff.
- [x] **AC-0035.** `npm run build` exits 0.
- [x] **AC-0036.** `npm test` runs the Vitest suites and then the Playwright suite, and exits 0.
- [x] **AC-0037.** `npm run typecheck` exits 0.
- [x] **AC-0038.** `grep -rnE "\.(insert|update|upsert|delete)\(" src/` prints nothing.
- [x] **AC-0059.** `grep -rnE "['\"]pg(-pool)?(/[^'\"]*)?['\"]" src/` prints nothing.
- [x] **AC-0039.** No code under `src/` or in `next.config.ts` reads a privileged variable, except `src/privileged-env.ts`, which reads no environment value at all. Each of these prints nothing:
  - `grep -rniE "env(\.|\[['\"])[a-z0-9_]*(service_role|secret|jwt|db_url|database_url|postgres)" src/ next.config.ts | grep -v '^src/privileged-env.ts:'`
  - `grep -rnE "\}\s*=\s*process\.env" src/ next.config.ts`
  - `grep -nE "process\.env(\.|\[)" src/privileged-env.ts`
- [x] **AC-0060.** For each check name of a privileged variable, running `npm run build`, `npm run start`, and `npm run dev`, each with only that variable added to the environment, exits non-zero and prints the variable's name and not its value.
- [x] **AC-0068.** While `npm run dev` runs, once it logs that it reloaded `.env.local` after a check-name variable was written there, the next GET for `/sign-in`, the next GET for `/receiving`, and the next POST to `/receiving` each answer with HTTP status 500 and a body that does not contain the variable's value.
- [x] **AC-0040.** `grep -rnE "from ['\"][^'\"]*app/" src/lib/` prints nothing.
- [x] **AC-0063.** For each of `npm run start` and `npm run dev`, at least one process it starts listens on TCP, and every TCP listening socket held by any process it starts is bound to 127.0.0.1.
- [x] **AC-0064.** `grep -nE "allowedOrigins|allowedDevOrigins" next.config.ts` prints nothing.
- [x] **AC-0065.** `npm audit --omit=dev --audit-level=high` exits 0, or every high or critical advisory it reports appears in the Advisory waivers list above.

## Retired identifiers

- `AC-0032`
- `AC-0058`

## Follow-ons

- jaketlee07: [`docs/product/intents/app-https-hosting.md`](../../product/intents/app-https-hosting.md), host the app over HTTPS so receiving works from a phone at the dock.
- jaketlee07: [`docs/product/intents/receiving-test-refinements.md`](../../product/intents/receiving-test-refinements.md), a test seam for the save action's remaining branches and opacity-aware focus-ring scoring.

## Assumptions

- Technical: no web framework is installed; `package.json` holds only `@supabase/supabase-js`, `pg`, `typescript`, `vitest`, and their types (source: `package.json`)
- Technical: current stable versions are next 16.4.0, react 19.3.0, tailwindcss 4.3.3, @supabase/ssr 0.12.7, @playwright/test 1.64.0; next needs Node 20.9 or later and the machine runs Node 22.17.0 (source: `npm view <pkg> version`, `node --version`, 2026-10-07)
- Technical: @supabase/ssr 0.12.7 requires @supabase/supabase-js 2.114.0 or later, and the repository has 2.110.1 installed (source: npm ERESOLVE probe in scratch, 2026-10-07; `node_modules/@supabase/supabase-js/package.json`)
- Technical: the local stack is up at 127.0.0.1 with all four migrations applied (source: `supabase status`, `supabase migration list --local`, 2026-10-07)
- Technical: `receive_lot` and `void_receipt` check the caller first and refuse a non-operator with SQLSTATE 42501; `private.is_operator()` is executable by `authenticated` but the `private` schema is not exposed through the Data API (source: `supabase/migrations/20261007181933_engine_hardening.sql`, `docs/architecture/overview.md`)
- Technical: `v_product_pricing` lists only active finished products and has no raw-product column (source: `supabase/migrations/0001_init.sql` view definition)
- Technical: Intl.NumberFormat in Node 22 rounds 2.685 to 2.69 and 1.005 to 1.01, where `Number.prototype.toFixed` gives 1.00 for the second (source: node probe, 2026-10-07)
- Technical: `supabase status -o env` prints these secret-bearing names: `SERVICE_ROLE_KEY`, `SECRET_KEY`, `JWT_SECRET`, `S3_PROTOCOL_ACCESS_KEY_SECRET`, `DB_URL`; the gitignored repository-root `.env` held `DATABASE_URL`, which nothing in the repository reads; Next.js loads `.env` files into the server's environment and `next dev` reloads them when they change (source: `supabase status -o env` key names, 2026-10-08; `.env` key names; `grep -rln DATABASE_URL` over the repository returned nothing; Next.js 16.4.0 `environment-variables.md`; scratch `next dev` probe logging "Reload env: .env.local", 2026-10-08)
- Technical: a check at the top of `next.config.ts` that calls `process.exit(1)` stops `next build`, `next start`, and `next dev` with exit code 1, for a variable inherited from the shell and for one in `.env`, and prints only the variable's name; a per-request check in `proxy.ts` answers HTTP 500 after `next dev` reloads a privileged variable from `.env.local`, without the value in the body or the log (source: scratch probes, 2026-10-08)
- Product: sign-in is part of this feature: email and password, sign-out, a "not allowed" page for a signed-in non-operator, no sign-up, no password reset (source: user confirmation 2026-10-07)
- Product: the vendor is picked from existing vendors only; a new vendor is added in Supabase Studio (source: user confirmation 2026-10-07)
- Product: the screen lists the product's 10 most recently entered receipts, and each untouched one can be voided with a reason (source: user confirmation 2026-10-07 and 2026-10-08)
- Product: after a product's only receipt is voided, the average shows "None yet" and prices "No price yet" (source: user confirmation 2026-10-08)
- Product: the result shows each finished product's suggested price before and after, as in the build plan's Phase 2 ("the recomputed menu price from v_product_pricing") (source: user instruction 2026-10-07 to use Phase 2 of `git show 2e320a5:docs/build-plan.md` as input)
- Product: cost per lb and average show 4 decimals, suggested prices 2 decimals (source: user confirmation 2026-10-07)
- Product: the received date defaults to today on the device and a date after today is refused; past dates are allowed (source: user confirmation 2026-10-07)
- Product: the engine assigns the lot number; notes are optional; the app runs only against the local stack; hosting, the installable app, and offline queueing are out of scope; the screens work at phone width and on a desktop (source: user confirmation 2026-10-07)
- Product: design goals in order are hard to mistype, fast on a phone, and numbers easy to trust; plain, high-contrast, no decoration; experience-design pack not installed, so design intent is grounded only in these goals (source: user confirmation 2026-10-07; skill roster)
- Product: the app listens only on 127.0.0.1 in this local-only scope; phone use waits for the hosted rollout with HTTPS; the auth server's limit of 30 sign-ins per 5 minutes is charged to the app server's address, and that shared limit is accepted while only this machine reaches sign-in (source: user confirmation 2026-10-08)
- Product: a session ends after 12 hours without activity and 7 days after sign-in; signing out ends this device's session on the auth server; an access token stays valid at the database for up to 3600 seconds after sign-out, accepted as a residual (source: user confirmation 2026-10-08; `supabase/config.toml` `jwt_expiry = 3600`)
- Process: shipped dependencies are audited with `npm audit --omit=dev --audit-level=high` before merge; a high or critical advisory with no fix blocks shipping until the owner records a waiver in the Advisory waivers list; no secret scanner runs, accepted as a gap (source: user confirmation 2026-10-08)
- Technical: the `DATABASE_URL` line was removed from the local `.env` with the owner's approval, so the app's guard admits that file (source: user confirmation 2026-10-08)
- Product: after the post-build review the owner chose to fix nearly every finding in this spec: a Host-header check against DNS rebinding; a failed or unreachable save or void keeps the form and says honestly whether the receipt may be saved; a 10-second limit on server database calls; a distinct sign-in message for failures other than bad credentials; the result panel and stock after a void; the void dialog's description (source: user confirmation 2026-10-08; `docs/specs/receiving/notes/verification-ledger.md`, "Post-gates review, round 1")
- Technical: Node 22.17.0's HTTP server, which `next start` builds with default options, answers an HTTP/1.1 request with no `Host` header with 400 before any handler runs, and passes an HTTP/1.0 request with no `Host` to the handler (scratch probe 2026-10-08: a plain `http.createServer` returned 400 with its handler not called, then 200 with it called)
- Technical: the local auth server signs access tokens with ES256 (its key list, read 2026-10-08), so `getClaims` checks a token inside the app server with a signing key it caches for 10 minutes, and reaches the auth server only to fetch that key or to refresh an expired token (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`, `JWKS_TTL`)
- Product: under `npm run dev`, Next.js answers its own dev-tool addresses before the proxy runs, so AC-0069 covers `npm run start`, the command for daily use, and the dev-mode exposure to a DNS-rebinding page is accepted (source: user confirmation 2026-10-08)
- Process: the write-call clauses of AC-0072 and AC-0083 rest on unit rules alone, and their end-to-end test waits in `docs/product/intents/receiving-test-refinements.md` (source: user confirmation 2026-10-08)
- Process: the browser flow is checked by a Playwright suite that runs under `npm test` (source: user confirmation 2026-10-07)
- Process: the owner approves the spec and the plan in chat, and the agent records the Approved status (source: foundation-hardening spec Assumptions; user confirmation 2026-10-07)
