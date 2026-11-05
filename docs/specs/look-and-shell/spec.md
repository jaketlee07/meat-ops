# Spec: look-and-shell

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints in the brief [`docs/product/briefs/ui-redesign.md`](../../product/briefs/ui-redesign.md); the alerts spec [`../alerts/spec.md`](../alerts/spec.md) (AC-0005, AC-0006, and AC-0010 to AC-0017, the Primary navigation and the urgent banner); the receiving-refinements spec [`../receiving-refinements/spec.md`](../receiving-refinements/spec.md) (AC-0007 and AC-0008, how the page-state check scores a focus ring); the receiving spec [`../receiving/spec.md`](../receiving/spec.md) (AC-0005, what Sign out does); the screen rules in the `src/app` row of [`docs/architecture/overview.md`](../../architecture/overview.md); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** docs/product/briefs/ui-redesign.md
- **Discovery:** none
- **Contract:** none (page markup and styles inside this app; no published interface)
- **Shape:** ui

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

The business owner and the developer move between Meat Ops's nine pages from a navy side menu on a desktop and a navy top bar on a phone, on look E's cool blue-gray background. This spec is the first of the three the brief names: it builds the look's colors, the shell around every page, and the three views that have no menu (`/sign-in`, the not-allowed view, and the error view). Each page's own content keeps its current layout until spec 2 or spec 3 redoes it.

Two terms used below:

- A **header page** is one of these nine pages as an operator sees it once it loads: `/receiving`, `/production`, `/menu`, `/pricing`, `/sales`, `/trace`, `/invoices`, `/ask`, and `/alerts`. The not-allowed view and the error view at those paths are not header pages.
- The **shell** is what surrounds a header page's own content: the side menu, the top bar, the phone menu, the page title, and the urgent banner.

Success for the owner:

- On a desktop, every page link and Sign out sit in one navy column at the left, and the Alerts link shows how many urgent alerts are open.
- On a phone, the page's title and an Alerts link with the same count fill a navy top bar. The other links and Sign out sit one tap away, in a menu that slides in over the page.
- The keyboard focus outline stays easy to see: white on navy, blue on the light parts.
- `/sign-in`, the not-allowed view, and the error view are each one white card under the Meat Ops name.

The screens use the system font. The "Urgent alerts" banner stays and keeps its words.

The look's aim, from the brief: on the floor screens, hard to mistype comes first, fast on a phone second, and numbers easy to trust third. The drawn reference is the spec 1 row of boards on the [UI directions canvas](https://claude.ai/artifact/4EaCu25FA6HoBaDA4PKAnX) at revision 1793808116-460d.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/look-and-shell/`. The owner, the reviewers, and `work-loop` read them there. At closeout, the overview, the code, and the tests below hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture: the shell | The overview's `src/app` row describes the header, the banner, the not-allowed view, and the error view. | `docs/architecture/overview.md`, the `src/app` row's first column | `work-loop` implementer | The row names the side menu, the top bar, the phone menu, the Alerts counts, and the lone-card views. | `close-work` reads the row whole and finds it matches the code. |
| Current architecture: the screens' look and its reasons | The overview's "Keep the screens' look" sentence names "a light surface", and the `globals.css` top comment names Stripe Dashboard forms and "a light surface". | `docs/architecture/overview.md`, the `src/app` row's notes column; `src/app/globals.css`, its top comment | `work-loop` implementer | Both name look E. The overview also says why the screens use the system font: a web font from Google would make every build and test run need the internet. Neither names Stripe or "a light surface". | `close-work` reads both. |
| Current architecture: the browser suite | The overview's `test/e2e/` row lists each suite and what `a11y.ts` checks. | `docs/architecture/overview.md`, the `test/e2e/` row | `work-loop` implementer | The row lists `shell.spec.ts` and the page-state check's desktop walk. | `close-work` reads the row whole. |
| Design reference | The canvas boards are the drawn reference for AC-0022. | The UI directions canvas, already linked in the brief's Design artifacts section | Owner | The AC-0022 entries in the verification ledger | `close-work` confirms that the brief still links the canvas. |
| Delivery coordination | This spec is a child of the brief. | The Spec map in `docs/product/briefs/ui-redesign.md`; this spec's entry in `workspace.toml` | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide; the screens are the interface. | None | None | None | None |
| Release history | None. `docs/product/changelog.md` has no released entries, and the app has no version. | None | None | None | None |

## Boundaries

### Always do

- Keep every page's own content as it is: its text, figures, controls, their roles and names, and their order. Specs 2 and 3 own page content.
- Take every color from a token in `src/app/globals.css`.
- Draw every icon as inline SVG with `aria-hidden="true"`.
- Run `npm test` in full before handing a task back, and stop any app or test server you started by its PID.

### Ask first

- Any change to what the spec 1 canvas boards draw, including the 1024 px width where the side menu takes over from the top bar.
- Changing an expectation in an existing browser test beyond the header's phone Tab stops that AC-0024 allows.
- Any change to a page's own content layout, such as its width, its cards, or its tables.
- Stopping any service of a local Supabase stack, such as the short REST stop that makes the error view show.
- Any change to the install file `src/app/manifest.ts`. Its colors stay as the app-hosting spec set them.

### Never do

- Add a dependency to `package.json`, such as a font package or an icon set.
- Change anything under `src/lib/` or `supabase/`, add a query, or change the watch in `src/app/_server/watch.ts`. The Alerts counts come from the watch the header already runs.
- Load an image, script, or style from a host other than the app itself.
- Add any canvas control or figure that the brief's Non-goals section names.
- Show the signed-in email in the shell.
- Load any web font, including one served by the app itself. Every screen draws the system stack in `--font-sans`.

## Testing Strategy

- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0016, AC-0017, AC-0019, AC-0020, AC-0021)**: in a new `test/e2e/shell.spec.ts` and in the updated page helpers. Each is something the owner sees or does in a browser, at a width the suite sets. For the error view, a recorded run checks AC-0006, AC-0017, and AC-0021 instead, because no committed test can make a page fail to load (see the overview's `test/e2e/` row).
- **Goal-based check through the page-state check (AC-0015, AC-0018)**: in `test/e2e/a11y.ts`. The check already runs axe and scores focus rings and target sizes. It gains a walk at desktop width.
- **Goal-based check over the whole suite (AC-0023)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0022, AC-0024)**: the owner's comparison with the canvas boards, which no machine can judge, and a read of the branch's test diff.

## Acceptance Criteria

### Where the shell shows

- [x] **AC-0001.** On every header page, the side menu shows when the viewport is 1024 CSS px wide or wider, and the top bar shows when it is narrower. Exactly one of the two shows at any width: at 1023 px the top bar shows, and at 1024 px the side menu shows.
- [x] **AC-0002.** The side menu, the top bar, and the open phone menu each have the background color #0F276C.
- [x] **AC-0003.** Top to bottom, the side menu holds the text "Meat Ops", the navigation region named "Primary" with nine links (Receiving, Production, Menu, Pricing, Sales, Trace, Invoices, Ask, and Alerts, in that order), and the Sign out button.
- [x] **AC-0004.** Left to right, the top bar holds a button named "Open menu", the page's title as the level-1 heading, and a link to `/alerts`.
- [x] **AC-0005.** At 320×640 and at 1280×720, every header page shows exactly one level-1 heading. Its text is the page's title: the label of that page's own link in AC-0003.
- [x] **AC-0006.** The page background is #F3F6FA on `/sign-in`, on every header page, on the not-allowed view, and on the error view.

### The phone menu

- [x] **AC-0007.** At 320×640, with no dialog open, Tab on a header page reaches the "Open menu" button first and the top bar's `/alerts` link second. It reaches no link in the Primary navigation and no Sign out button.
- [x] **AC-0008.** Pressing "Open menu" opens a modal dialog named "Menu". It holds a button named "Close menu", then the Primary navigation with the AC-0003 links in the AC-0003 order, then Sign out.
- [x] **AC-0009.** When the phone menu opens, focus is on "Close menu".
- [x] **AC-0010.** Pressing Escape, pressing "Close menu", or tapping the dimmed page outside the phone menu's panel closes the phone menu.
- [x] **AC-0011.** After each way of closing in AC-0010, focus is on the "Open menu" button.
- [x] **AC-0012.** Choosing any of the nine links in the open phone menu, including the link to the page already showing, shows that link's page with the phone menu closed.
- [x] **AC-0013.** Choosing Sign out in the open phone menu meets receiving AC-0005.
- [x] **AC-0014.** With the phone menu open, widening the viewport to 1024 CSS px or more closes the phone menu.
- [x] **AC-0015.** At 320×640 on `/receiving`, the page-state check passes with the phone menu open. Its Tab walk reaches "Close menu", the nine links, and Sign out, in that order, and nothing else.

### Focus outlines

- [x] **AC-0016.** A focused control inside the side menu, the top bar, or the open phone menu draws its focus outline in #FFFFFF.
- [x] **AC-0017.** A focused control outside those three surfaces draws its focus outline in #1D4ED8. The surfaces outside them are a header page's own content, the urgent banner, `/sign-in`, the not-allowed view, the error view, and a page's confirmation dialog.
- [x] **AC-0018.** At 1280×720 on `/receiving` with one open urgent alert, the page-state check passes when its Tab walk also runs at 1280×720. That walk reaches the nine Primary links and Sign out, in the AC-0003 order, before any other control.

### Urgent counts

- [x] **AC-0019.** Each of the three Alerts links in the shell (the side menu's, the open phone menu's, and the top bar's) shows a badge with the number N when N urgent alerts are open, N is 1 or more, the page's watch succeeded, and the page is not `/alerts`. In every other case, no badge shows.
- [x] **AC-0020.** The top bar's `/alerts` link has the accessible name "Alerts, N urgent" when AC-0019 shows a badge with N, and the name "Alerts" in every other case.

### Views with no menu

- [x] **AC-0021.** `/sign-in`, the not-allowed view, and the error view each show the text "Meat Ops" beside the "MO" mark, above one card with the background color #FFFFFF that holds the view's level-1 heading and every control the view has.

### Look and regressions

- [x] **AC-0022.** The verification ledger records the owner's "match" verdict for each of five built screens, each compared whole with its spec 1 board on the canvas at revision 1793808116-460d. A "no match" on any screen fails this criterion. Each screen is set to its board's drawn state: `/sign-in` at 390 px wide with "operator@example.test" typed into Email (S1-SignIn); the not-allowed view at 390 px (S1-NotAllowed); the error view of `/receiving` at 390 px (S1-Error); `/receiving` at 390 px with two open urgent alerts and the phone menu open (S1-PhoneMenu); and `/receiving` at 1280 px with two open urgent alerts (S1-Desktop). Three differences do not count: the page's own content in place of the "[Page content]" box, at that content's current width; a drawn text color shown as its nearest `globals.css` token; and focus outlines, which AC-0016 and AC-0017 own.
- [x] **AC-0023.** `npm test` passes.
- [x] **AC-0024.** Read from the branch point with `main`, the only changed expectations in the existing browser test files are the header's stops in each phone Tab-order list: the "Open menu" button and the top bar's `/alerts` link replace the nine Primary links and Sign out.

## Follow-ons

None. The canvas ideas this spec leaves out are the brief's non-goals, and the brief owns them.

## Assumptions

- Technical: Next.js 16.4.2 App Router, React 19.3, and Tailwind 4.3, with the colors and sizes in the `@theme` block of `src/app/globals.css` (source: `package.json`, `src/app/globals.css`)
- Technical: the nine pages render the header inside their own `<main>`, in 12 places across 9 files (`/pricing` has 3 and `/invoices` has 2), so a side menu beside the page changes each page's outer wrapper (source: grep of `src/app`)
- Technical: `/sign-in`, the not-allowed view, and the error view have no header, and each `error.tsx` is a client component that cannot run the watch (source: `src/app/*/error.tsx`, `src/app/not-allowed.tsx`)
- Technical: the page-state check walks Tab only at its `PHONE` size, 320×640, set by the `setViewportSize(PHONE)` call in `checkPageState`, and the browser suite otherwise runs at 1280×720, so nothing scores a focus ring that shows only at desktop width (source: `test/e2e/a11y.ts`; the Desktop Chrome project in `playwright.config.ts`)
- Technical: about 175 page-state checks assert the exact phone Tab order. Six page helpers list the header's ten stops, nine links and Sign out (menu, production, invoices, receiving, sales, and trace), and the alerts, pricing, and ask helpers reuse the menu helper's list (source: grep of `test/e2e`)
- Technical: the navy #0F276C is the canvas's accent #1D4ED8 at half strength. White on it is 13.75:1, and today's blue outline on it is 2.05:1, under 3:1. The blue outline on #F3F6FA is 6.18:1. Every text color token passes on #F3F6FA; the tightest is the success green at 4.63:1 against the 4.5:1 floor (source: node contrast probe, 2026-11-04)
- Technical: every color class in `src/app` uses a `globals.css` token, so the new page background changes no other color pair (source: grep of `src/app` for Tailwind palette classes, 2026-11-04)
- Technical: `next/font/google` downloads a font during `npm run build` and fails the build when Google Fonts can't be reached, and `npm test` builds the app on every run (source: `node_modules/next/dist/compiled/@next/font/dist/google/loader.js`, the `nextFontError` call after a failed fetch; the `webServer` command in `playwright.config.ts`)
- Technical: the app already opens confirmations as native `<dialog>` elements with `showModal()`. The browser traps focus in them, closes them on Escape, and returns focus to the opener, and the page-state check walks a modal dialog from its top (source: `src/app/receiving/void-dialog.tsx`; the Escape and focus-return test in `test/e2e/correct.spec.ts`; `test/e2e/a11y.ts`)
- Technical: a modal dialog left open while its top bar is hidden at 1024 px keeps the rest of the page inert with a 0×0 box, so the side menu does not respond until Escape (source: throwaway Playwright probe, 2026-11-04)
- Process: the spec moves from Draft through a shaping review and an adversarial review to the owner's approval, as `docs/specs/app-hosting` did (source: `.claude/skills/new-spec/SKILL.md`; `git log` of `docs/specs/app-hosting/spec.md`)
- Process: the experience-design pack is not installed, so no design-review skill grounds design intent. The canvas boards stand in as the reference (source: the installed skills list, 2026-11-04)
- Product: the screens keep the system font (source: user confirmation 2026-11-04)
- Product: the "Urgent alerts" banner stays, and the urgent count also shows on the Alerts links (source: user confirmation 2026-11-04)
- Product: the phone menu button opens a menu that slides in from the left over the page, holding the nine links, the Alerts badge, and Sign out (source: user confirmation 2026-11-04)
- Product: the focus outline is white on navy and stays blue elsewhere (source: user confirmation 2026-11-04)
- Product: the side menu shows at 1024 px wide and up, and the top bar below that (source: user confirmation 2026-11-04)
- Product: the side menu shows Sign out but not the signed-in email (source: user confirmation 2026-11-04)
- Product: the top bar's Alerts link reads out the urgent count (source: user confirmation 2026-11-04)
- Product: a tap on the dimmed page outside the open phone menu closes it, and the menu button is named "Open menu" (source: user confirmation 2026-11-04)
- Product: the install file keeps its blue status-bar color and white splash color until a later change (source: user confirmation 2026-11-04)
- Product: on a desktop, the page title and the urgent banner span the full width beside the side menu, as S1-Desktop draws them, and the page's own content keeps its current width, lined up on the left under them (source: user confirmation 2026-11-04)
