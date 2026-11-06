# Plan: look-menu-invoices-ask-alerts

- **Spec:** [`spec.md`](spec.md)
- **Status:** Approved <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** spec 3a's built pages: `src/app/trace/page.tsx` and `find-forms.tsx` (`fullWidth`, two forms side by side from `desk` with `grid desk:grid-cols-2`), `src/app/production/recent-batches.tsx` and `src/app/sales/recent-sales.tsx` (a named size container, an `aria-hidden` header line, and the row's column rules through a custom variant), and the container variants in `src/app/globals.css`; `src/app/alerts/alert-card.tsx` for a waiting button that stays focusable (`pendingRef`, `aria-disabled`, colors at 60% alpha); the checks in `test/e2e/look-floor-pages.spec.ts` (`expectTable`, `expectNoSpill`, `expectCards`, `measureCells`, `expectButtonsInside`, `expectTablesFit`, `withTextSize`); the page helpers `test/e2e/menu-page.ts`, `invoices-page.ts` (`seedDraft`, `seedLines`, `openReview`, `review`), `ask-page.ts`, and `alerts-page.ts` (`dropActionRequests` shows how a test holds or drops a server action request).

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

Menu comes first, because it is the smallest page that sets this spec's table pattern and starts the new suite. Invoices follows in two tasks, the read forms and drafts list, then a draft's review with its saved receipts and its two buttons. Ask and Alerts come next, then the source check, then a last task that records what only a person or a diff read can check.

The riskiest part is keeping the existing Menu, Invoices, Ask, and Alerts suites green while the layout changes. The design keeps every element they find, by name and by position (the Constraints list the positions), and moves only how they are laid out.

## Constraints

- The brief's Constraints: 44 px controls, the 3:1 focus outline, made-up data only on canvas boards, and every table or card layout picking its look from its own section's room.
- The look-and-shell shell and its tests: `<main>`'s first child stays the title-and-banner `div`; `/ask`'s examples section stays a direct child of `<main>`, where `shell.spec.ts` checks its 544 px cap.
- What the existing suites find by position stays where they find it: the invoice photo's box is the image's parent with a 3:4 shape (`invoices.spec.ts` near line 1250); the answer's paragraphs keep their order and count (`ask-page.ts`'s `shownAnswer`); an alert's first `p` is its sentence and its reprice button is its only `button:not([aria-label])` (`alerts-page.ts` near line 337); the "Saved receipts" region's list items are exactly the lots (`invoices.spec.ts` near line 1391); each Menu card's `dd`s are Finished on hand then Raw on hand, and no others (`menu.spec.ts` near line 147); a line's "Invoice says: " text starts its element's text (`invoices-page.ts`'s `getByText(/^Invoice says: /)`); the photo field's file-selector button keeps its 1 px border, 6 px corner, and weight 500 (`invoices.spec.ts` near line 290); and the read forms and the Ask form keep their reserved status line inside the form (`ask-page.ts`, `invoices-page.ts`, `invoices.spec.ts` near line 318).
- `AGENTS.md`: no em dashes, `type(scope): description` commits, `npm ci --ignore-scripts`, and the folder check before any test run or stack stop.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T7's owner comparison with the canvas and its two diff reads.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Overview `src/app` row: the four pages | T1, T2, T3, T4, T5 | The row names each page's desktop layout, the pages that pass `fullWidth`, and that the draft review's buttons follow the waiting-control rule; its sentence that no test checks the faded colors names the draft review's check as the exception. | `close-work` reads the row whole against the code. |
| Overview look notes and `globals.css`: the switches | T1, T2, T3, T5 | Each new variant has a `globals.css` comment naming the section it reads, and the notes list it. | `close-work` reads both. |
| Overview `test/e2e/` row | T1 | The row lists `look-menu-invoices-ask-alerts.spec.ts` and any shared check module. | `close-work` reads the row whole. |
| Intent `look-production-sales-trace-review-nits.md` | none (written at drafting) | Its Outcome covers the waiting buttons, and its Boundary's "Waiting buttons" bullet names the six. | `close-work` confirms it. |
| Design reference: the canvas | T7 | The AC-0017 ledger entries name revision 1793945225-763f. | The brief still links the canvas. |

## Design (LLD)

### Design decisions

- **Table or pair when it has room.** As in spec 3a, each list that switches makes its section a named size container, and its rows or cards switch through a custom variant in `globals.css` at a width in rem: the row's fixed tracks, gaps, and padding plus its flexible column's minimum. A rem width moves with the text size, so a larger text size keeps the narrow look until the section fits. The widths each switch must clear come from the probe (`0-probe-shell.spec.ts` in this spec's review folder): `<main>`'s content box is 45.5rem at 1024 px, 61.5rem at 1280 px, and 71.5rem at 1440 px at the default text size, and 32.7rem at 1024 px and 45.5rem at 1280 px with 20 px text. Leave room for a 17 px always-visible scrollbar, which takes about 1rem at 1024 px. In a table look each label is hidden visually and stays in the page, and the header line is `aria-hidden="true"`. AC-0025 pins that room at 1024 px. Traces to: AC-0002, AC-0003, AC-0005, AC-0006, AC-0008, AC-0009, AC-0011, AC-0012, and AC-0025.
- **Menu.** `/menu` passes `fullWidth`. The list's section is the container, and an inner wrapper draws the one white card only in the table look; in the card look the switch sits in its own card and each product is its own card, as S3b-Menu-Phone draws. The list keeps its `ul`, `li`, and each product's level-2 heading; the list price and the sellable line stay `p` elements and the `dl` keeps Finished on hand and Raw on hand as its only `dd`s, in that order. In the table look each `li` is a grid row under the header line, the product heading in the first column. Traces to: AC-0001, AC-0002, AC-0003, AC-0025.
- **Invoices' read forms and drafts.** `/invoices` passes `fullWidth`. The two read forms sit in a grid of two from `desk` up, as Trace's finders do, with their buttons pushed to the card's bottom so they line up. Each draft's `li` holds one link; in the table look the link is the grid row and the comma between source and line count stays in the DOM, hidden visually, so the link's text content is unchanged. The photo field's `file:` classes stay as they are. Traces to: AC-0001, AC-0004, AC-0005, AC-0022, AC-0023.
- **A draft's review.** The editing view (capture section and Lines form) is a size container. Where it has room for a 20rem capture column beside a lines column of at least about 22rem, the capture section is the first column and the form is the second. Only a photo is `position: sticky` near the top (a probe on 2026-11-06 showed a sticky column holding inside a size container, and a `<fieldset>` serving as a size container, in the suite's Chromium); a typed capture scrolls with the page, so a long one is never held partly below the fold. The photo's box stays the image's parent with its 3:4 shape. A line's "Invoice says: " stays the start of one `p`'s own text, with the words in a child `span` for their weight. Each line's fieldset is its own container: where it has room, Product and Vendor share a row and Weight, Cost per lb, and Received date share a row. Save receipts and Discard draft sit side by side where the form has room. Traces to: AC-0006, AC-0007, AC-0008, AC-0025.
- **Saved receipts.** The "Saved receipts" section is a size container. Where it has room for two cards whose before-and-after tables hold six-digit weights without tightening (about 50rem), the lot cards and the tables each sit in a grid of two columns, never more. The lots keep their `ul`, whose items are exactly the lots; the tables sit outside it. The `/invoices` saved result stays outside the `result` container, so its tables keep their base size; the overview already says so. Traces to: AC-0009, AC-0021.
- **The draft's buttons.** Save receipts and Discard draft drop the `disabled` attribute for `aria-disabled` while `pending`, and a ref set on press refuses a second press before the next render, as `alert-card.tsx`'s `pendingRef` does. The ref clears when the action settles, whatever its outcome, including `checkSave`'s refusal before anything is sent, so a corrected form can be saved without a reload. Because Next.js queues a second action until the first finishes, a refused press must never reach `dispatch`; counting requests only while the first is held would miss a queued one. Their colors fade at 60% alpha through `aria-disabled:` classes, never `opacity`. The draft's status, focus moves, and outcomes are unchanged. Traces to: AC-0010, AC-0020.
- **Ask.** `/ask` keeps the cap. The form, the answer, and the examples each become a white card; the message and choices area stays card-free text, since it is empty in most states and an empty card would show. The examples section stays a direct child of `<main>`. Traces to: AC-0001.
- **Alerts.** `/alerts` passes `fullWidth`. Today's digest is a white card whose paragraphs are capped at 45rem. Each section's list is a size container whose cards sit in a grid of two columns where it has room (about 44rem, so 1024 px with a scrollbar still pairs them), never more; the board's auto-fill grid would put three in a row at 1440 px. Each card keeps its sentence as its first `p` and its reprice button as its only button without an `aria-label`. Each card is its own container: where it has room (about 24rem) its buttons sit in a row at their own width; otherwise each spans the card. Traces to: AC-0001, AC-0011, AC-0012, AC-0013, AC-0024, AC-0025.

### Component / module decomposition

- `src/app/globals.css`: the new container variants.
- `src/app/menu/`: `page.tsx` (`fullWidth`), `menu-list.tsx`.
- `src/app/invoices/`: `page.tsx` (`fullWidth`, the read-forms grid), `read-forms.tsx`, `drafts-list.tsx`, `draft-review.tsx`, `saved-result.tsx`.
- `src/app/ask/`: `page.tsx`, `ask-panel.tsx`.
- `src/app/alerts/`: `page.tsx` (`fullWidth`, the digest card), `digest-section.tsx`, `alert-list.tsx`, `alert-card.tsx`.
- `test/e2e/look-checks.ts` (new): the layout checks `look-floor-pages.spec.ts` defines today, moved out unchanged so both suites import them. They fit the before-and-after tables and buttons-inside checks here; Menu's rows, the drafts' links, and the alert pairs get checks of their own in the new suite, written for their markup.

### Quality attributes (NFRs)

- **Contrast**: every text pair uses existing tokens; axe in the page-state check enforces them.
- **Targets**: every control stays at least 44 px from `--spacing-control`.

## Tasks

### T1: Menu reads as a table when it has room

**Depends on:** none
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/menu/page.tsx`, `src/app/menu/menu-list.tsx`, `test/e2e/look-checks.ts`, `test/e2e/look-floor-pages.spec.ts`, `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- New `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, operator session, `resetTestData()` before each test: AC-0001 for `/menu`, AC-0002, AC-0003, AC-0016 for `/menu`, and AC-0025's Menu case, at the widths each names. Six products, at least one sellable now and one not, with no list price, no finished stock, and a $10 price among them, come from the test database helpers. AC-0001's check reads each child of `<main>` other than a `<dialog>` for a computed max-width, not `expectNoCap`, which counts children. Menu's row and card checks are written for its markup: the level-2 heading, the list price and sellable `p`s, and the `dl`'s two `dd`s. The 20 px steps set the root text size with `document.documentElement.style.fontSize`; the 17 px step narrows the layout width as spec 3a's AC-0019 test did.
- `look-floor-pages.spec.ts` imports the moved checks and passes with its tests unchanged; the existing `menu.spec.ts` passes unchanged.

**Approach:**
- Move the checks out of `look-floor-pages.spec.ts` into `look-checks.ts` without changing them.
- Pass `fullWidth` from `/menu`; draw the one card around the switch and list in the table look only, and in the card look give the switch and each product their own cards; give the list its container table look.
- Describe Menu in the overview's `src/app` row and list the new suite and module in its `test/e2e/` row.

**Done when:** the T1 tests pass and `npm test` passes.

### T2: Invoices sets its read forms side by side and its drafts as a table when they have room

**Depends on:** T1
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/invoices/page.tsx`, `src/app/invoices/read-forms.tsx`, `src/app/invoices/drafts-list.tsx`, `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-menu-invoices-ask-alerts.spec.ts`, with three drafts seeded through `seedDraft` and `seedLines` from `test/e2e/invoices-page.ts`: AC-0001 for the read forms, AC-0004, AC-0005, AC-0022, AC-0023, and AC-0016 for three drafts waiting. The drafts' row and card checks are written for a row that is one link.
- The existing `invoices.spec.ts` passes unchanged.

**Approach:**
- Pass `fullWidth` from `/invoices`; set the read forms side by side from `desk`; give the drafts list its container table look; restyle the forms as the other pages' forms are.
- Describe the read view in the overview's `src/app` row.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: A draft's review keeps its photo beside its lines, and its buttons stay focusable

**Depends on:** T2
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/invoices/page.tsx`, `src/app/invoices/draft-review.tsx`, `src/app/invoices/saved-result.tsx`, `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-menu-invoices-ask-alerts.spec.ts`, with a three-line photo draft from `seedDraft({ source: "photo", ... })` and a typed draft from `seedDraft`'s default, opened with `openReview` in `test/e2e/invoices-page.ts`: AC-0001 for a draft's review, AC-0006 for both drafts, AC-0007, AC-0008, AC-0009, AC-0010, AC-0020, AC-0021, AC-0016 for the review and a saved draft, and AC-0025's review case. `seedDraft` gives every line RAW-TOM, so AC-0009 and AC-0021 run `seedInvoiceFixture` from `test/db.ts` for RAW-CHK and choose it in one line's Product field before saving; AC-0021 types its weights and costs into the review. AC-0010 holds the save's and the discard's action request with `page.route` on `**/invoices**`, matched as `dropActionRequests` in `alerts-page.ts` matches it, and reads the buttons' attributes, computed opacity, colors, and `document.activeElement` while held. AC-0020 presses again while held, releases, and counts every action request the route sees until one second after the first press's outcome shows; its second case leaves a ticked line's weight blank, presses Save receipts, fills the weight, and counts one request through to the saved receipts.
- The existing `invoices.spec.ts` passes unchanged.

**Approach:**
- Give the editing view, each line, and the saved receipts their containers; make the photo sticky where it sits beside the lines, and let a typed capture scroll with the page.
- Move Save receipts and Discard draft to `aria-disabled` with a press-time ref, and their fades to `aria-disabled:` color classes.
- Describe the review, the saved receipts, and the buttons in the overview's `src/app` row.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: Ask wears white cards in its column

**Depends on:** T3
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/ask/page.tsx`, `src/app/ask/ask-panel.tsx`, `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-menu-invoices-ask-alerts.spec.ts`, with an answer from the suite's fake model service as `ask.spec.ts` gets one: AC-0001 for `/ask` and AC-0016 for `/ask` with an answer.
- The existing `ask.spec.ts` and `shell.spec.ts` pass unchanged.

**Approach:**
- Restyle the form, the answer, and the examples as white cards; leave the message and choices area without a card.
- Describe Ask in the overview's `src/app` row.

**Done when:** the T4 tests pass and `npm test` passes.

### T5: Alerts sets its cards two to a row when they have room

**Depends on:** T4
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/alerts/page.tsx`, `src/app/alerts/digest-section.tsx`, `src/app/alerts/alert-list.tsx`, `src/app/alerts/alert-card.tsx`, `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-menu-invoices-ask-alerts.spec.ts`, with the five-alert fixture (`buildFiveAlertFixture({ today: appDate(), watch: false })` from `test/alert-fixtures.ts`, as `alerts.spec.ts` builds it: margin and cost in "Urgent"; yield, price, and low stock in "Other alerts"), opened with `opens` from `test/e2e/alerts-page.ts` so a written digest shows and no digest request is sent: AC-0001 for `/alerts`, AC-0011, AC-0012, AC-0013, AC-0024, AC-0016 for `/alerts`, and AC-0025's alerts case.
- The existing `alerts.spec.ts` passes unchanged.

**Approach:**
- Pass `fullWidth` from `/alerts`; make the digest a card with capped paragraphs; give each section's list and each card their containers.
- Describe Alerts in the overview's `src/app` row.

**Done when:** the T5 tests pass and `npm test` passes.

### T6: No old radius is left on the four pages

**Depends on:** T5
**Mode:** goal-based check
**Touches:** `test/look-tidy.test.ts`

**Tests:**
- `test/look-tidy.test.ts`: AC-0014, a search of every source file under the four page folders for every class whose name, after its leading variant prefixes (`name:` and `[...]:`) are stripped, starts `rounded`, failing on any that is not one of the allowed names, other than `file:rounded-md` in `src/app/invoices/read-forms.tsx`.

**Approach:**
- Reuse the file's `sourceFiles` walk.

**Done when:** the T6 test passes and `npm test` passes.

### T7: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3, T4, T5, T6
**Mode:** visual and manual QA
**Touches:** `docs/specs/look-menu-invoices-ask-alerts/notes/verification-ledger.md`

**Tests:**
- AC-0017: the built app on `127.0.0.1` with the test data, captured at the head, each screen in the state AC-0017 names, compared by the owner with its board; the ledger records each verdict.
- AC-0015: `npm test` on the branch head, its pass counts and run time in the ledger.
- AC-0018: `git diff "$(git merge-base main HEAD)" -- src/app/facts.tsx src/app/before-after.tsx` read in full; the ledger records the result.
- AC-0019: `git diff "$(git merge-base main HEAD)" -- test/e2e` read in full, plus every file `git ls-files --others --exclude-standard -- test` lists; the ledger lists each changed expectation in an existing test file, or none.

**Approach:**
- Reuse `.context/recorded-run/s3-captures.spec.ts`'s pattern for the screenshots, run with `PLAYWRIGHT_FORCE_ASYNC_LOADER=1` after `npm run build`, and stop every process it starts by its PID.

**Done when:** the ledger records the owner's "match" for each of the ten boards, the AC-0015 pass, the AC-0018 read, and the AC-0019 list, and each of these records names the commit it read, at or after T6's last commit.

## Rollout

Big bang, in one PR. Rollback is a revert. No data, schema, or hosted setting changes. With this spec every page wears look E, so the brief's mixed look ends.

## Risks

- A container threshold set too close to a page's width flips with an always-visible scrollbar, as Receiving's did in spec 2; the design leaves about 1rem of room at 1024 px, and AC-0025 checks it.
- A sticky photo stops sticking if a later change gives an ancestor of `<main>`'s content an `overflow` other than visible; AC-0007 catches it.
- Moving the draft's buttons to `aria-disabled` lets a fast double press through unless the press-time ref refuses it; AC-0020 counts requests.

## Changelog

- 2026-11-06: initial plan, after the owner kept spec 3b to its four pages, chose full width where it helps with Ask kept narrow, approved the ten boards, and chose to bring the draft's buttons in line with the waiting-control rule.
- 2026-11-06: after the round 1 reviews: criteria split one predicate each (AC-0020 to AC-0024), AC-0025 pins the scrollbar room, fixtures named for each state (the five-alert fixture, RAW-CHK, a typed draft), positional locators listed in the Constraints, only a photo is sticky, the draft buttons' ref clears on any outcome, and the radius check covers variant prefixes with the file button's tested corner as its one exception.
- 2026-11-06: after the round 2 reviews: the Approach and Risks lines follow the round 2 design (only a photo is sticky, Menu's single card in the table look only, AC-0020 counts requests), the intent rows say six, and AC-0020 counts until one second after the outcome.
