# Spec: look-menu-invoices-ask-alerts

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints in the brief [`docs/product/briefs/ui-redesign.md`](../../product/briefs/ui-redesign.md), including its rule that every table or card layout picks its look from the room its own section has; the shell, tokens, shared parts, and container variants that specs 1, 2, and 3a built (`src/app/page-header.tsx`, `src/app/globals.css`, `src/app/facts.tsx`, `src/app/before-after.tsx`); the menu, invoice-entry, ask-your-data, and alerts specs (what each page shows and does); the screen rules in the `src/app` row of [`docs/architecture/overview.md`](../../architecture/overview.md), including its rule that a waiting control stays focusable and fades its colors, never its opacity; [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
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

The business owner checks what can be sold on `/menu`, turns invoices into receipts on `/invoices`, asks questions on `/ask`, and works through alerts on `/alerts`, all in look E. This spec is 3b, the last of the brief's specs.

Success for the owner:

- On a desktop, Menu reads as one compact table when its list has room, and as cards on a phone.
- Invoices puts its two read forms side by side on a desktop and lists the drafts to confirm as a table when the list has room. A draft's review keeps the invoice photo in view beside its lines, and saved receipts sit two to a row when they have room.
- Ask keeps its 544 px column, as white cards.
- Alerts shows the digest as a card and the alert cards two to a row when the list has room.
- Save receipts and Discard draft stay focusable while a save or discard runs, like the app's other waiting buttons.

What each screen does, and every figure, word, and control name it shows, stays the same. The drawn reference is the spec 3b rows of boards on the [UI directions canvas](https://claude.ai/artifact/4EaCu25FA6HoBaDA4PKAnX) at revision 1793945225-763f.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/look-menu-invoices-ask-alerts/`. At closeout, the overview, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture: the four pages | The overview's `src/app` row describes `/menu`, `/invoices`, `/ask`, and `/alerts`, the pages that pass `fullWidth`, and the waiting-control rule. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names Menu's table, Invoices' side-by-side forms, drafts table, draft review, and saved receipts, Ask's 544 px column, and Alerts' two-to-a-row cards, and says the draft review's buttons follow the waiting-control rule; its sentence on faded colors names the test that checks the draft review's. | `close-work` reads the row whole against the code. |
| Current architecture: the look's switches | The look notes list each container variant in `globals.css`. | `docs/architecture/overview.md`, the `src/app` row's notes; `src/app/globals.css` | `work-loop` implementer | The notes name each new variant and the section whose width it reads. | `close-work` reads both. |
| Current architecture: the test suites | The overview's `test/e2e/` row lists each suite. | `docs/architecture/overview.md`, the `test/e2e/` row | `work-loop` implementer | The row lists this spec's new browser suite and any shared helper module it adds. | `close-work` reads the row whole. |
| Backlog | The owner chose on 2026-11-06 to leave the other buttons that fade by opacity while they wait for the spec 3a leftovers: Receiving's Save button, its Void dialog's two buttons, its Correct dialog's close button, the Reverse dialog's Cancel button, and Sign in. | `docs/product/intents/look-production-sales-trace-review-nits.md` | `new-spec` author | The intent's Outcome covers the waiting buttons, and its Boundary's "Waiting buttons" bullet names the six. | `close-work` confirms the intent still names them or a later delivery fulfilled them. |
| Design reference | The canvas boards are the drawn reference for AC-0017. | The UI directions canvas, linked in the brief's Design artifacts section | Owner | The AC-0017 entries in the verification ledger | `close-work` confirms that the brief still links the canvas. |
| Delivery coordination | This spec is a child of the brief. | The brief's Spec map; this spec's `workspace.toml` entry | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide. | None | None | None | None |
| Release history | None. The app has no version. | None | None | None | None |

## Boundaries

### Always do

- Keep every figure, word, control name, role, and Tab order these pages show today, except where an acceptance criterion below changes one.
- Take every color from a token defined in `src/app/globals.css`, and every radius and font size from a theme token: Tailwind's built-in scale or a token defined in `src/app/globals.css`. Never use an arbitrary value for any of them.
- Draw every icon through the shared icon component.
- Run `npm test` in full before handing a task back, and stop any app or test server you started by its PID.

### Ask first

- Any change to what the spec 3b canvas boards draw.
- Changing an expectation in an existing browser test.
- Any change to how a draft is read, saved, or discarded, or to what an alert's buttons do, beyond what AC-0010 and AC-0020 state.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Change anything under `src/lib/` or `supabase/`, change a server action, or write a new query.
- Load a font, image, script, or style from another host, or load any web font.
- Add any canvas control or figure that the brief's Non-goals section names.
- Change the six waiting buttons outside these four pages that fade by opacity; the spec 3a leftovers intent names them.

## Testing Strategy

- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0016, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, and AC-0025)**: in a new `test/e2e/look-menu-invoices-ask-alerts.spec.ts`. Each is a layout, focus, or request behavior the owner sees in a browser. A criterion that names 17 px taken on the right narrows the page's layout width by 17 px, as an always-visible scrollbar does. A width-bound criterion is checked at each width it names; a criterion about the room a list has is checked at the default text size at the widths it names and, where it names one, with the root text size set to 20 px.
- **Goal-based check over the source (AC-0014)**: a Vitest search in the existing `test/look-tidy.test.ts`.
- **Goal-based check over the whole suite (AC-0015)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0017, AC-0018, AC-0019)**: the owner's comparison with the canvas boards, a read of the shared parts' markup diff, and a read of the branch's test diff.

## Acceptance Criteria

### Width

- [ ] **AC-0001.** At 1024 CSS px and wider, the content of `/menu`, `/invoices` (its read forms and a draft's review), and `/alerts` fills the width beside the side menu: no child of `<main>` other than a `<dialog>` has a computed max-width. On `/ask` at 1280 px with an answer shown, the question form, the answer, and the "Questions Ask can answer" section each end no more than 544 px right of the left edge of `<main>`'s content box.

- [ ] **AC-0025.** At 1024 px at the default text size with 17 px of the page's width taken on the right, `/menu` with the six products AC-0002 names reads as AC-0002 states, a draft's review keeps its capture section to the left of the Lines form as AC-0006 states, and each alerts section with the alerts AC-0011 names keeps its first two cards side by side.

### Menu

- [ ] **AC-0002.** With six products, at least one sellable now and one not, at 1024 px, 1280 px, and 1440 px at the default text size, each product's heading and its four figures (its list price, Finished on hand, Raw on hand, and whether it is sellable now) sit on one line under one header line that names them (Product, List price, Finished on hand, Raw on hand, Status) in that order, with "Sellable only" ticked and not. No figure's text runs past its cell.
- [ ] **AC-0003.** With the six products AC-0002 names, at 390 px at the default text size, each product is a card showing, from top to bottom, its heading, its list price, Finished on hand and Raw on hand each beside a visible label, and whether it is sellable now. At 1280 px with the browser's text size at 20 px, no figure's text runs past its cell, and where a product is a card each label shows beside its value.

### Invoices

- [ ] **AC-0004.** At 1024 px and 1280 px, the "Read an invoice" form sits to the left of the "Type a receipt" form with their tops level and the tops of their Read photo and Read text buttons level, and "Drafts to confirm" sits below both.
- [ ] **AC-0023.** At 390 px, "Read an invoice" sits above "Type a receipt", which sits above "Drafts to confirm".
- [ ] **AC-0005.** With three drafts waiting, at 1024 px, 1280 px, and 1440 px at the default text size, each draft's capture date, source, line count, and first words sit on one line under one header line that names them (Captured, From, Lines, First words) in that order, and no text runs past its cell. At 390 px, each draft is a card with its capture date, then its source and line count, then its first words, each on its own line. At 1280 px with the browser's text size at 20 px, no draft's text runs past its row or card.
- [ ] **AC-0022.** With three drafts waiting, at 390 px, 1024 px, 1280 px, and 1440 px at the default text size and at 1280 px with the browser's text size at 20 px, each draft is one link to its review, and the link's text content equals its capture date, its source, a comma and a space, its line count, and its first words, run together in that order.
- [ ] **AC-0006.** On the review of a draft read from a photo and on the review of a typed draft, at 1024 px, 1280 px, and 1440 px at the default text size and at 1280 px with the browser's text size at 20 px, the "Invoice photo" or "You typed" section sits to the left of the Lines form with their tops level. At 390 px, and at 1024 px with the browser's text size at 20 px, it sits above the Lines form.
- [ ] **AC-0007.** On the review of a three-line draft read from a photo, at 1280 px by 720 px at the default text size, after the page scrolls until Save receipts is in view, the whole "Invoice photo" section is inside the viewport.
- [ ] **AC-0008.** On a draft's review at 1280 px and 1440 px at the default text size, each line's Product and Vendor sit side by side with tops level, and its Weight (lbs), Cost per lb, and Received date sit side by side with tops level. At 390 px and 1024 px at the default text size, each of a line's fields sits below the one before it, in today's order. At every size AC-0006 names, every field's control ends inside its line, and every field's label sits above its control.
- [ ] **AC-0009.** After a draft's three lines are saved, two of them for one raw product and one for another, at 1280 px and 1440 px at the default text size, the first two saved lots sit side by side with tops level and the third sits below the first, and the two before-and-after tables sit side by side with tops level; at 390 px and 1024 px, each lot and each table sits below the one before.
- [ ] **AC-0021.** After the save AC-0009 names, with every line's weight six digits and three decimals and every cost $10 or more, at 1024 px, 1280 px, and 1440 px at the default text size and at 1280 px with the browser's text size at 20 px, every before-and-after table ends at or left of its card's right edge less the card's right padding, no figure in it runs past its cell, and no number in its Before or After cells splits across lines (a unit may drop under its number; a row label may wrap).
- [ ] **AC-0010.** On a draft's review, while a save or a discard is running, Save receipts and Discard draft each have no `disabled` attribute, have `aria-disabled="true"`, and have a computed opacity of 1; Save receipts' fill and Discard draft's text and border take their colors at 60% alpha; and the button pressed from the keyboard keeps focus.
- [ ] **AC-0020.** On a draft's review, a second press of Save receipts or Discard draft while a save or a discard is running sends no request: counted from the first press until one second after the first press's outcome shows, the page sends exactly one action request. After a save the page refuses before sending (a ticked line with its weight blank), neither button has `aria-disabled`, and one press of Save receipts after the weight is filled sends exactly one action request and shows the saved receipts.

### Alerts

- [ ] **AC-0011.** With two urgent and three other alerts open, at 1024 px, 1280 px, and 1440 px at the default text size and at 1280 px with the browser's text size at 20 px, in each section the second card sits to the right of the first with tops level, and in "Other alerts" the third card sits below the first. At 390 px, and at 1024 px with the browser's text size at 20 px, each card sits below the one before.
- [ ] **AC-0012.** At 1280 px and 1440 px at the default text size, in a card whose alert offers a reprice, the Dismiss button sits to the right of the reprice button with tops level. At 390 px, each of an alert's buttons spans its card's inner width.
- [ ] **AC-0024.** With the alerts AC-0011 names, at 390 px, 1024 px, 1280 px, and 1440 px at the default text size and at 1280 px with the browser's text size at 20 px, every alert's buttons and link sit inside its card.
- [ ] **AC-0013.** At 1280 px and 1440 px at the default text size, every paragraph in Today's digest is at most 45rem wide.

### Code

- [ ] **AC-0014.** No file under `src/app/menu/`, `src/app/invoices/`, `src/app/ask/`, or `src/app/alerts/` holds a radius class, with or without a variant prefix, other than one naming the `control`, `card`, or `mark` radius token (with or without a side or corner), `rounded-full`, or `rounded-none`. The one exception is the photo field's file-selector button in `src/app/invoices/read-forms.tsx`, whose 6 px corner `test/e2e/invoices.spec.ts` pins.

### Look and regressions

- [ ] **AC-0015.** `npm test` passes.
- [ ] **AC-0016.** The page-state check in `test/e2e/a11y.ts` passes at 390 px and 1280 px on each of these states: `/menu` with six products; `/invoices` with three drafts waiting; the review of a draft read from a photo; a draft just saved; `/ask` with an answer shown; and `/alerts` with two urgent and three other alerts and a written digest.
- [ ] **AC-0017.** The verification ledger records the owner's "match" verdict for each of the ten spec 3b boards on the canvas at revision 1793945225-763f, each compared whole with the built screen set to the board's state; a "no match" on any fails this criterion. The states: `/menu` with six products at 390 px (S3b-Menu-Phone) and 1280 px (S3b-Menu-Desktop); `/invoices` with three drafts at 390 px (S3b-Invoices-Phone) and 1280 px (S3b-Invoices-Desktop); at 1280 px, the review of a three-line draft read from a photo (S3b-Draft-Desktop) and the same draft just saved with two lines (S3b-Draft-Saved-Desktop); `/ask` with an answer at 390 px (S3b-Ask-Phone) and 1280 px (S3b-Ask-Desktop); `/alerts` with a written digest and two urgent and three other alerts at 390 px (S3b-Alerts-Phone) and 1280 px (S3b-Alerts-Desktop). Six differences do not count: the names, numbers, dates, and how many rows or cards are listed are the test data's; the drawn photo stands in for the test data's photo; the photo field's file-selector button keeps the look `test/e2e/invoices.spec.ts` pins; the read forms and the Ask form keep the empty space their tests hold for a status line; a drawn text color shown as its nearest `globals.css` color token; and focus outlines.
- [ ] **AC-0018.** Read from the branch point with `main`, `src/app/facts.tsx` and `src/app/before-after.tsx` for the same props render the same elements in the same nesting, with the same attributes other than `class` and the same text. A prop or `look` value added on this branch only chooses classes.
- [ ] **AC-0019.** Read from the branch point with `main`, tracked and untracked, no expectation in an existing browser test file changes. A test added to an existing file, and a helper moved out of a test file into a shared module with its checks unchanged, are not changed expectations.

## Follow-ons

None. The spec 3a leftovers intent, `docs/product/intents/look-production-sales-trace-review-nits.md`, stays a separate delivery by the owner's choice on 2026-11-05.

## Assumptions

- Technical: `/menu`, `/invoices`, `/ask`, and `/alerts` do not pass `fullWidth`, so from 1024 px each direct child of `<main>` after the title is capped at 544 px (source: `src/app/{menu,invoices,ask,alerts}/page.tsx`, `src/app/page-header.tsx`, 2026-11-06)
- Technical: beside the side menu, `<main>`'s content box is 728 px at 1024 px, 984 px at 1280 px, and 1144 px at 1440 px at the default text size, and 654 px at 1024 px and 910 px at 1280 px with a 20 px root text size; a `position: sticky` column inside `<main>` stays in the viewport after the page scrolls (source: probe `0-probe-shell.spec.ts` and its log in `.context/reviews/6afa7cfb-24e3-4db2-a2ef-b7d90a66b760/`, 2026-11-06)
- Technical: the four pages still use `rounded-md` controls and cards with a field-colored border; the other five pages use the `control` and `card` radius tokens and white cards (source: a search of `src/app`, 2026-11-06)
- Technical: the `/invoices` saved result shows `Facts` and `BeforeAfter` and is not a `result` container, so its tables do not tighten (source: `src/app/invoices/saved-result.tsx`; the overview's `src/app` row)
- Technical: the browser suites find these parts by name: Menu's list items and level-2 product headings and "Sellable only"; Ask's "Answer" and "Questions Ask can answer" regions and `#ask-message`; Alerts' "Today's digest", "Urgent", and "Other alerts" regions, each alert as a named group, and the message regions in `<main>`; Invoices' "Read an invoice", "Type a receipt", "Drafts to confirm", "Draft review", and "Saved receipts" regions, the "Draft result" status, and each "Line n" group; `shell.spec.ts` checks the 544 px cap on `/ask`'s examples section as a direct child of `<main>` (source: `test/e2e/menu-page.ts`, `ask-page.ts`, `alerts-page.ts`, `invoices-page.ts`, `shell.spec.ts`)
- Technical: on a draft's review, Save receipts and Discard draft take the `disabled` attribute and fade by opacity while a save or discard runs; outside these pages, six buttons do the same: Receiving's Save button, its Void dialog's two buttons, its Correct dialog's close button, the Reverse dialog's Cancel button, and Sign in (source: a search of `src/app` for `disabled={`, 2026-11-06)
- Technical: the suites also find parts by position: the invoice photo's box is the image's parent with a 3:4 shape; the answer's paragraphs keep their order and count; an alert's first paragraph is its sentence and its reprice button is its only button without an `aria-label`; the saved result's list items are exactly the saved lots; each Menu card's first two `dd`s are Finished on hand and Raw on hand; a line's "Invoice says: " text starts an element's text; the photo field's file-selector button has a 1 px border, a 6 px corner, and weight 500; and the read forms and the Ask form keep a status line inside the form (source: `test/e2e/invoices.spec.ts`, `ask-page.ts`, `alerts-page.ts`, `menu.spec.ts`, `invoices-page.ts`, 2026-11-06)
- Process: the experience-design pack is not installed, so the canvas boards stand in as the design reference (source: the installed skills list)
- Product: spec 3b covers Menu, Invoices, Ask, and Alerts only; the spec 3a leftovers stay a separate small spec (source: user confirmation 2026-11-05)
- Product: on a desktop, Menu reads as a table when it has room, Alerts sets its cards two to a row when there is room, Invoices puts its read forms side by side and a draft's photo beside its lines, and Ask keeps its narrow column (source: user confirmation 2026-11-05)
- Product: the ten spec 3b boards are approved as drawn (source: user confirmation 2026-11-06)
- Product: Save receipts and Discard draft follow the waiting-control rule; the other buttons that fade by opacity go to the spec 3a leftovers intent (source: user confirmation 2026-11-06)
- Product: the photo field's file-selector button keeps its tested look, and the forms keep their status-line space (source: user confirmation 2026-11-06)
