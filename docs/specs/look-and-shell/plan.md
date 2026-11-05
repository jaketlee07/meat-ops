# Plan: look-and-shell

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the screen rules in the `src/app` and `test/e2e/` rows of `docs/architecture/overview.md`; the native-dialog pattern in `src/app/receiving/void-dialog.tsx` and its Escape and focus-return test in `test/e2e/correct.spec.ts`; the page-state check in `test/e2e/a11y.ts` with its fixture tests in `test/e2e/focus-ring.spec.ts`; the header in `src/app/page-header.tsx` and the 12 places the nine pages render it. No precedent exists for a layout that changes at a viewport width. This plan defines one, the `desk` variant at `(min-width: 1024px)`.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/<feature>/notes/verification-ledger.md` (or the adopter's
> equivalent). A genuine artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round. Treating them as
> contract is how a review spends a round on prose no gate consumes; the
> measured share is over half the plan's lines. `Grounding` stays *recorded*,
> because a per-task resolution that nobody wrote is not grounding; what it stops
> being is a claim a reviewer holds the plan to.

## Approach

The colors land first, so every later task builds on the new tokens and the blue-gray page. The shell comes next, in one task, because the side menu, the top bar, and the phone menu replace the old header together: dropping the old links at phone width without the menu would strand the page. Each of the nine pages swaps its outer `<main>` and `<PageHeader>` for `<PageShell>`, and the page's own content moves inside unchanged. The test helpers' phone Tab-order lists change in the same task, through one shared list of the header's stops. The page-state check then gains a desktop walk, the three views with no menu become lone cards, and a last task records what only a person can check.

The riskiest part is the test churn: about 175 page-state checks assert the exact phone Tab order. A shared header-stops list keeps that to one line per helper.

## Constraints

- The brief's Constraints, which the spec cites: the 3:1 focus outline on navy, 44 px controls, and made-up data only on canvas boards.
- The alerts spec's AC-0005, AC-0006, and AC-0010 to AC-0017 keep holding. The side menu's Alerts link keeps the accessible name "Alerts", and the banner keeps its region name and words.
- `AGENTS.md`: no em dashes, `type(scope): description` commits, every install with `npm ci --ignore-scripts`, and the folder check before any test run or stack stop.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T5's recorded run of the error view, the owner's comparison with the canvas, and the read of the test diff.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Overview `src/app` row: the shell | T2, T4 | The row's diff names `PageShell`, `phone-menu.tsx`, the counts, and `lone-card.tsx`. | `close-work` reads the row whole against the code. |
| Overview look sentence and `globals.css` comment | T1 | `grep -n "Stripe\|light surface" docs/architecture/overview.md src/app/globals.css` prints nothing. Both name look E, and the overview gives the system-font reason. | `close-work` reads both. |
| Overview `test/e2e/` row | T2, T3 | The row lists `shell.spec.ts` and the desktop walk. | `close-work` reads the row whole. |
| Design reference: the canvas | T5 | The AC-0022 ledger entries name revision 1793808116-460d. | The brief's Design artifacts section still links the canvas. |
| Brief Spec map and `workspace.toml` entry | lifecycle | The Spec map row and the `[ini-001.work]` entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |

## Design (LLD)

### Design decisions

- **Keep the file `src/app/page-header.tsx`** and replace its `PageHeader` export with `PageShell({ title, current, children })`. The overview, the brief, and `alerts/page.tsx` (which imports `WATCH_FAILED`) name that file. Traces to: AC-0001 to AC-0005.
- **Render the Primary navigation twice**: once in the side menu and once inside the phone menu's `<dialog>`. CSS hides the side menu under 1024 px, and a closed dialog is not rendered, so assistive technology never meets two at once. One `PrimaryNav` function draws both. A probe on 2026-11-04 found one visible Primary navigation at 1280 px and none at 320 px until the dialog opened. Traces to: AC-0003, AC-0007, AC-0008.
- **Render the title twice**: as the top bar's `<h1>` (hidden at `desk`) and at the top of `<main>` (shown only at `desk`). The probe counted one level-1 heading at 320 px and one at 1280 px. Traces to: AC-0005.
- **Use a native `<dialog>` opened with `showModal()`** for the phone menu, as the void and correct confirmations do. The browser traps focus in it, closes it on Escape, and returns focus to the opener. The probe confirmed focus on "Close menu" when it opens and on the menu button after Escape. Traces to: AC-0008 to AC-0011.
- **One width, one unit**: `globals.css` declares `@custom-variant desk (@media (min-width: 1024px));`, every class that swaps the side menu and the top bar uses `desk:`, and the phone menu's close trigger watches the same query string. A rem breakpoint would follow the browser's default font size while the close trigger stayed at 1024 px. Traces to: AC-0001, AC-0014.
- **Close the phone menu on three more events**: a click on any link inside it, so choosing the page already showing also closes it (AC-0012); a click on the dialog element itself outside the panel's box, which is where a tap on the dimmed page lands (AC-0010); and the `desk` query starting to match (AC-0014). A probe on 2026-11-04 showed why the last one is needed: a modal dialog whose top bar is hidden keeps the page inert with a 0×0 box.
- **Switch the focus outline color through an inherited custom property**: `:focus-visible` draws `var(--focus-ring)`, which is `--color-primary` at the root and `--color-on-bar` inside every navy surface. The probe read `rgb(255, 255, 255)` on a control inside the dialog. Traces to: AC-0016, AC-0017.
- **Give the two top-bar controls ids**, `menu-button` and `alerts-link`. The page-state check labels a control by its id first, so the header's phone stops read `button #menu-button` and `a #alerts-link` whatever the urgent count. Without the id, the badge's digits join the link's text in the label. Traces to: AC-0007, AC-0024.
- **`<main>` changes only at `desk` width**: under 1024 px, `<main>` keeps today's classes, `mx-auto w-full max-w-xl p-4`, so a page's own content sits exactly where and as wide as it does today. At `desk` width, `<main>` fills the area beside the side menu: its first child is a full-width `div` holding the desktop title and the banner's `role="status"` container, as S1-Desktop draws them, and each later child is capped at 34rem (544 px), today's 36rem column less its two 1rem paddings, and sits on the left. The page's own content stays `<main>`'s direct children with its structure unchanged, and the shell's `div` takes the old header's place, so the banner's container stays the one match for `main > div > [role=status]`, which `alerts.spec.ts` and `trace.spec.ts` select, and a page's own status, such as `/receiving`'s "Receipt result", stays a direct child of `<main>`. The shell adds no other status. Traces to: AC-0022, AC-0023, AC-0024.
- **The system font stays.** `next/font/google` would download Plus Jakarta Sans during every build and fail the build offline, and `npm test` builds the app each run. The overview carries this reason.

### Component / module decomposition

- `src/app/globals.css`: the `desk` variant, and new tokens `--color-page` (#f3f6fa), `--color-bar` (#0f276c), `--color-on-bar` (#ffffff), `--color-card-border` (#e2e8f0), `--color-badge` (#dc2626), `--color-error-wash` (#fef2f2), and `--color-error-edge` (#fecaca). The body background becomes `--color-page`. An `on-bar` utility sets the navy background, white text, and `--focus-ring: var(--color-on-bar)`.
- `src/app/page-header.tsx` (server): `PageShell` runs the watch as `PageHeader` does today, then renders the side menu, the top bar, and `<main>` in the shape the design decisions give. Its helpers are `PrimaryNav`, `AlertsLink` (the top bar's bell link), `SignOutButton`, and `Brand` (the white "MO" tile with blue letters, and "Meat Ops").
- `src/app/phone-menu.tsx` (client): the "Open menu" button and the `<dialog>`. It takes the brand, the navigation, and Sign out as `children` from the server, so the dialog's Sign out keeps the `signOut` server action.
- `src/app/lone-card.tsx`: its own mark (a blue "MO" tile with white letters, as S1-SignIn draws it) and "Meat Ops", above one white card that is the view's `<main>`. `sign-in/page.tsx`, `not-allowed.tsx`, and `page-error.tsx` use it.
- The nine `page.tsx` files: each `<main className="mx-auto w-full max-w-xl p-4"><PageHeader … />…</main>` becomes `<PageShell …>…</PageShell>`, in 12 places.

### State & control flow

- The phone menu is closed or open. "Open menu" opens it. "Close menu", Escape, a tap outside the panel, a click on any link inside it, or the window reaching 1024 px closes it. Navigating to another page renders a new shell with the menu closed.
- The urgent count is N = `watch.urgent` when the watch ran and its status is `ok`, and 0 otherwise. On `/alerts` the watch does not run in the header, so N is 0. N drives the badges and the top bar link's name. Traces to: AC-0019, AC-0020.

### Behavior & rules

- The badge is `<span aria-hidden="true">N</span>`, drawn only when N ≥ 1, so the side menu's and the phone menu's Alerts links keep the name "Alerts". The top bar link's `aria-label` is `Alerts, N urgent` when N ≥ 1 and `Alerts` otherwise.
- The urgent banner keeps its markup, region name, and words. It becomes a light red card (`--color-error-wash` with a `--color-error-edge` border). Its link stays "See alerts".

### Quality attributes (NFRs)

- **Contrast**, computed on 2026-11-04: white on navy is 13.75:1; white at 85% on navy, the side menu's link text, is at least 9.66:1; white on the badge red is 4.83:1; the error red on the banner's light red is 5.91:1, and the blue link on it 6.13:1; the success green on the page color is 4.63:1, the tightest pair. axe in the page-state check enforces the text pairs, and the ring scorer enforces the 3:1 outlines. Traces to: AC-0015 to AC-0018.
- **Targets**: every shell control is at least 44×44 px, from `--spacing-control`. The page-state check enforces it at both widths.
- **No network**: no web font, no icon package, and every icon is inline SVG.

## Tasks

### T1: The page is #F3F6FA, and the look's description names look E

**Depends on:** none
**Touches:** `src/app/globals.css`, `docs/architecture/overview.md`, `test/e2e/shell.spec.ts`

**Tests:**
- `shell.spec.ts` reads `document.body`'s computed background color, expecting `rgb(243, 246, 250)`, on `/sign-in` (signed out), on each of the nine header pages (operator session), and on `/receiving` as a non-operator, which shows the not-allowed view. AC-0006.
- The whole existing suite stays green: axe re-checks every text pair on the new background.

**Approach:**
- Add the tokens, the `on-bar` utility, and the `desk` variant, set the body background, and route `:focus-visible` through `--focus-ring`.
- Rewrite the `globals.css` top comment and the overview's "Keep the screens' look" sentence to name look E, the canvas, and the system-font reason.

**Done when:** the T1 tests pass, `npm test` passes, and the durable-output map's grep for T1 prints nothing.

### T2: The shell replaces the header on every header page

**Depends on:** T1
**Touches:** `src/app/page-header.tsx`, `src/app/phone-menu.tsx`, `src/app/{receiving,production,menu,pricing,sales,trace,invoices,ask,alerts}/page.tsx`, `test/e2e/shell-page.ts`, `test/e2e/{receiving,production,menu,sales,trace,invoices,ask,alerts}-page.ts`, `test/e2e/shell.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- New `test/e2e/shell-page.ts` exports `HEADER_STOPS = ["button #menu-button", "a #alerts-link"]`. Each helper's phone Tab-order list swaps its ten header entries for `...HEADER_STOPS`, and `withSeeAlerts` in `alerts-page.ts` inserts "a See alerts" after the last header stop instead of after Sign out. The existing page suites then prove AC-0007 on every header page.
- `shell.spec.ts`, operator session, `resetTestData()` before each test:
  - On each header page, at 1023×720 and at 1024×720: AC-0001, AC-0002 (side menu and top bar), AC-0003, AC-0004.
  - On each header page, at 320×640 and at 1280×720: AC-0005.
  - On `/receiving` at 320×640: AC-0002 (open phone menu), AC-0008, AC-0009, AC-0010 and AC-0011 (one test per way of closing), and AC-0015 (`checkPageState` with the menu open). AC-0012 runs once per link.
  - AC-0013 signs in through the form in a fresh context (`signInThroughForm` from `states.ts`), because Sign out revokes the session and the saved operator session must survive for later tests. After Sign out it requests `/receiving` and expects `/sign-in`.
  - AC-0014 opens the phone menu at 1023×720, widens to 1024×720, expects the dialog closed, then clicks the side menu's Production link and expects `/production`.
  - AC-0016 and AC-0017 focus a control on each named surface and read its computed `outlineColor`: each shell surface at its width; and a control in `/receiving`'s own content, the banner's See alerts, `/sign-in`, the not-allowed view, and the receiving Void confirmation.
  - AC-0019 and AC-0020 use the alerts suite's fixtures: `marginCase()` for one urgent alert, the two-alert setup of the alerts banner tests for two, no fixture for none, `withWatchRefused()` for a failed watch, and `marginCase()` on `/alerts`.
  - With `marginCase()`, the side menu's `/alerts` link at 1280×720 and the open phone menu's at 320×640 each have the exact accessible name "Alerts", as the alerts spec's Primary-navigation criterion requires while a badge shows.

**Approach:**
- Build `PageShell` and `PhoneMenu` as the design describes, and swap the 12 call sites.
- Update the overview's `src/app` row for the shell, and its `test/e2e/` row for `shell.spec.ts`.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: The page-state check also walks at desktop width

**Depends on:** T2
**Touches:** `test/e2e/a11y.ts`, `test/e2e/focus-ring.spec.ts`, `test/e2e/shell.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `focus-ring.spec.ts`: a fixture control shown only at 1024 px and up, with a #1D4ED8 ring on #0F276C, fails the desktop walk with "outline contrast is 2.05:1, under 3:1", and the phone walk never reaches it. This proves the walk runs at the desktop size.
- `shell.spec.ts`: AC-0018 on `/receiving` after `marginCase()`. `checkPageState` passes, and the desktop walk's first ten labels are the nine links in AC-0003 order and "button Sign out". The Alerts link's label includes its badge digit.

**Approach:**
- Move the scroll-width, walk, and control rules after the axe scan into one function of a viewport size. `checkPageState` keeps calling it at 320×640, and a new export `checkDesktopWalk(page)` calls it at 1280×720 and returns the labels.
- Add the desktop walk to the overview's `test/e2e/` row.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: `/sign-in`, the not-allowed view, and the error view are lone cards

**Depends on:** T1
**Touches:** `src/app/lone-card.tsx`, `src/app/sign-in/page.tsx`, `src/app/sign-in/sign-in-form.tsx`, `src/app/not-allowed.tsx`, `src/app/page-error.tsx`, `test/e2e/shell.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `shell.spec.ts`: AC-0021 on `/sign-in` (signed out) and on `/receiving` as a non-operator. The card is `main`, its computed background is `rgb(255, 255, 255)`, it holds the level-1 heading and every button and input on the page, and "Meat Ops" and the "MO" mark show before it.
- The existing `SIGN_IN_CONTROLS` in `auth.spec.ts` and the not-allowed lists (`["button Sign out"]`) stay unchanged and green.

**Approach:**
- Build `LoneCard` and use it in the three views. Restyle the sign-in form's labels, fields, and button as S1-SignIn draws them, and give the error message the light red box S1-Error draws. The error view keeps its focus on the heading, its `role="alert"` message, and Try again's `aria-disabled` fade.
- Name `lone-card.tsx` in the overview's `src/app` row.

**Done when:** the T4 tests pass and `npm test` passes.

### T5: The recorded checks are in the verification ledger

**Depends on:** T2, T3, T4
**Touches:** `docs/specs/look-and-shell/notes/verification-ledger.md`

**Tests:**
- AC-0006, AC-0017, and AC-0021 for the error view: a recorded run makes `/receiving` fail to load, the way the receiving-refinements T4 run did, by stopping stack A's REST service for a short time. It reads the body background; the card's background and contents, with "Meat Ops" and the "MO" mark before it; and Try again's focused outline color. Stopping the service needs the owner's yes at the time, after the folder check shows no other stack A folder running.
- AC-0022: the built app on `127.0.0.1` with the made-up test data, each of the five screens set to the state AC-0022 names. The owner gives a verdict on each, and the ledger records it.
- AC-0023: `npm test` on the branch head after T1 to T4, its pass count and run time in the ledger.
- AC-0024: `git diff "$(git merge-base main HEAD)" -- test/e2e` read in full, plus every file `git ls-files --others --exclude-standard -- test/e2e` lists, read in full. The first compares the branch point with the working folder for tracked files; the second shows new files not yet added, such as `shell-page.ts` with its `HEADER_STOPS` value. Together they read every `test/e2e` change the branch ships, committed or not. The ledger lists each changed expectation in an existing test file and the header stop it replaces.

**Approach:**
- Script the error-view run in the ignored `.context/recorded-run/` and stop every process it starts by PID.

**Done when:** the ledger records the owner's "match" for each of the five AC-0022 screens, the error-view run's three readings each meeting the criterion it reads (AC-0006, AC-0017, AC-0021), the AC-0023 pass, and the AC-0024 list with no expectation outside the header stops.

## Rollout

Big bang, in one PR: every page changes look when it merges. Rollback is a revert. No data, schema, or hosted setting changes. The mixed look between specs is the brief's accepted risk: until specs 2 and 3 ship, each page's own content keeps its old layout inside the new shell.

## Risks

- A page helper whose header list is built differently from the six that list the stops would fail its suite with a Tab-order diff. `invoices-page.ts` builds its navigation list by slicing up to "button Sign out", so its slice changes with the swap.
- The error-view recorded run stops a stack A service that other worktrees share. The folder check and the owner's yes come first.

## Changelog

- 2026-11-04: initial plan, after the owner's four choices and a throwaway probe of the shell's Tab order, dialog focus, and ring color.
- 2026-11-04: round 1 review repairs. The phone menu also closes on a tap outside and at 1024 px, the button is "Open menu", the lone card draws its own mark, the sign-in form joins T4, and T5 names the board states and a branch-point diff.
- 2026-11-04: round 2 review repairs. AC-0022 compares each whole screen with three named exceptions, a Boundary rules out any web font, one `desk` variant sets the 1024 px switch, `<main>` keeps today's shape, and T5's diff reads uncommitted work too (the owner's choice).
- 2026-11-04: round 3 review repairs. The desktop title and banner span `<main>`'s full width as S1-Desktop draws them (the owner's choice) while page content keeps its width, T1 declares the `desk` variant, T5 also reads untracked test files, and two repeated statements are cut.
- 2026-11-04: round 4 check repair. `<main>` keeps today's centered column under 1024 px, and at desktop width page content is capped at 34rem, today's 544 px, instead of 36rem.
