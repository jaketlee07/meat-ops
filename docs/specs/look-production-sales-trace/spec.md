# Spec: look-production-sales-trace

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints in the brief [`docs/product/briefs/ui-redesign.md`](../../product/briefs/ui-redesign.md), including its rule that every table or card layout picks its look from the room its own section has; the shell, tokens, shared parts, and `receipt-table` variant that specs 1 and 2 built (this spec replaces spec 2's criterion that the Pricing list's figures sit on their own lines under 1280 px, for 1024 to 1279 px) (`src/app/page-header.tsx`, `src/app/globals.css`, `src/app/facts.tsx`, `src/app/before-after.tsx`); the production, reversals, sales, and trace specs (what each page shows and does); the screen rules in the `src/app` row of [`docs/architecture/overview.md`](../../architecture/overview.md); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
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

The business owner logs batches on `/production`, sales on `/sales`, and looks lots and sales up on `/trace` in look E, the way spec 2 built `/receiving`. This spec is 3a of the brief's specs. It also delivers the Draft intent [`look-pricing-receiving-review-nits.md`](../../product/intents/look-pricing-receiving-review-nits.md): Pricing and Receiving layouts that fit their space, and four small code tidy-ups.

Success for the owner:

- On a desktop, Production and Sales put the form and its saved result on the left and the product card and recent list on the right. On a phone, everything stacks in the page's own order.
- Production's product card shows Raw on hand and Raw average cost as two tiles, like Receiving's stock card.
- Recent batches, Recent sales, and Trace's lists read as compact tables when their section has room, and as cards when it does not, at any screen width and text size.
- Trace puts its two find forms side by side on a desktop.
- From 1024 px the Pricing list reads as a table whenever the list has room, and as cards when it does not. Receiving's Vendor column holds whole words.

What each screen does, and every figure, word, and control name it shows, stays the same. The drawn reference is the spec 3a row of boards on the [UI directions canvas](https://claude.ai/artifact/4EaCu25FA6HoBaDA4PKAnX) at revision 1793899703-bb47.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/look-production-sales-trace/`. At closeout, the overview, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture: the three pages | The overview's `src/app` row describes `/production`, `/sales`, and `/trace` and the shell's content cap, and names the pages that lift it. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names the three pages' desktop layouts, Production's stock tiles, and which lists read as tables when they have room. | `close-work` reads the row whole against the code. |
| Current architecture: the look's switches | The look notes name the `wide` and `receipt-table` variants. | `docs/architecture/overview.md`, the `src/app` row's notes; `src/app/globals.css` | `work-loop` implementer | The notes say how a list picks its table look from its own section's width and the text size, and that the Pricing list does the same. | `close-work` reads both. |
| Current architecture: the test suites | The overview's `test/` and `test/e2e/` rows list each suite. | `docs/architecture/overview.md`, the `test/` and `test/e2e/` rows | `work-loop` implementer | The rows list this spec's new Vitest suite and browser suite. | `close-work` reads both rows whole. |
| Backlog | This spec delivers the Draft intent `docs/product/intents/look-pricing-receiving-review-nits.md`. | That intent and its `workspace.toml` entry | `close-work` | The intent reads Fulfilled and leaves `backlog.open`. | `workspace_status.py reconcile --root .` shows no finding for it. |
| Design reference | The canvas boards are the drawn reference for AC-0024. | The UI directions canvas, linked in the brief's Design artifacts section | Owner | The AC-0024 entries in the verification ledger | `close-work` confirms that the brief still links the canvas. |
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

- Any change to what the spec 3a canvas boards draw.
- Changing an expectation in an existing browser test beyond what AC-0026 allows.
- Any change to how a product, lot, or sale is chosen or looked up on these pages.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Change anything under `src/lib/` or `supabase/`, change a server action, or write a new query. A page may call an existing `src/lib` read that it does not call today.
- Load a font, image, script, or style from another host, or load any web font.
- Add any canvas control or figure that the brief's Non-goals section names.

## Testing Strategy

- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033, and AC-0034)**: in a new `test/e2e/look-floor-pages.spec.ts`, and for the Pricing and Receiving criteria in `test/e2e/look-pages.spec.ts`. Each is a layout or content the owner sees in a browser. A width-bound criterion is checked at each width it names; a criterion about the room a list has is checked at the default text size at the widths it names and, where it names one, with the root text size set to 20 px.
- **Goal-based check over the source (AC-0020, AC-0021, AC-0022)**: a Vitest search in a new `test/look-tidy.test.ts` decides each; AC-0022's search covers every `border-` and `divide-` class under `src/app` and every border rule in `src/app/globals.css`.
- **Goal-based check over the whole suite (AC-0023)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0024, AC-0025, AC-0026)**: the owner's comparison with the canvas boards, a read of the shared parts' markup diff, and a read of the branch's test diff.

## Acceptance Criteria

### Width

- [ ] **AC-0001.** At 1024 CSS px and wider, the content of `/production`, `/sales`, and `/trace` fills the width beside the side menu: no child of `<main>` other than a `<dialog>` has a computed max-width.

### Production

- [ ] **AC-0002.** With a product chosen, at 1024 px and 1280 px, the page title sits above the "New batch" form and the "Product and raw stock" card, and the form and the "Batch saved" result sit to the left of the "Product and raw stock" card and of Recent batches.
- [ ] **AC-0003.** With a product chosen, at 390 px and 1023 px, `/production` shows from top to bottom the "New batch" form, the "Batch saved" result when a batch was just saved, the "Product and raw stock" card, and Recent batches.
- [ ] **AC-0004.** In the "Product and raw stock" card, Raw on hand and Raw average cost sit side by side as two tiles, each label above its value, at 390 px and 1280 px.
- [ ] **AC-0005.** At 1280 px and 1440 px at the default text size, each recent batch's five figures (Batch number, Production date, Raw lbs in, Finished lbs out, Cost per finished lb) sit on one line, under one header line that names them in that order. No figure's text runs past its cell.
- [ ] **AC-0006.** At 390 px and 1024 px at the default text size, and at 1280 px with the browser's text size at 20 px, each recent batch's five figures each sit on their own line beside a visible label.
- [ ] **AC-0007.** At 1280 px at the default text size, while a batch's "Batch reversed" panel or a reverse refusal shows, it spans the batch's whole row below its figures.
- [ ] **AC-0027.** At 1280 px at the default text size, while a batch's "Batch reversed" panel shows, none of its tables runs past the Recent batches section.
- [ ] **AC-0029.** At 390 px, 1024 px, 1280 px, and 1440 px at the default text size, and at 1280 px with the browser's text size at 20 px, every Reverse batch button sits inside the Recent batches section.

### Sales

- [ ] **AC-0008.** At 1024 px and 1280 px, the page title sits above the "New sale" form, and the form and the "Sale saved" result sit to the left of Recent sales.
- [ ] **AC-0009.** At 390 px and 1023 px, `/sales` shows from top to bottom the "New sale" form, the "Sale saved" result when a sale was just saved, and Recent sales.
- [ ] **AC-0010.** At 1280 px and 1440 px at the default text size, each recent sale's sale number and five figures (Sale date, Customer, Product, Lbs, Price per lb) sit on one line, under one header line that names them in that order. No figure's text runs past its cell.
- [ ] **AC-0011.** At 390 px and 1024 px at the default text size, and at 1280 px with the browser's text size at 20 px, each recent sale's five figures each sit on their own line beside a visible label.
- [ ] **AC-0012.** At 1280 px at the default text size, while a sale's void refusal shows, it spans the sale's whole row below its figures.
- [ ] **AC-0030.** At 390 px, 1024 px, 1280 px, and 1440 px at the default text size, and at 1280 px with the browser's text size at 20 px, every Void sale button sits inside the Recent sales section.

### Trace

- [ ] **AC-0013.** At 1024 px and 1280 px, the "Find a sale" form sits to the left of the "Find a raw lot" form, with their tops level.
- [ ] **AC-0028.** At 390 px, the "Find a sale" form sits above the "Find a raw lot" form.
- [ ] **AC-0014.** At 1280 px and 1440 px at the default text size, "Sales from this lot" reads as a table: each sale's sale number and five figures (Sale date, Customer, Product, Batch number, Lbs drawn) on one line under one header line that names them in that order, with no figure's text past its cell. At 390 px each sale is a card with each label visible beside its value. With the browser's text size at 20 px, at 1280 px and 1440 px, no figure's text runs past its cell, and where a sale is a card each label shows beside its value.
- [ ] **AC-0015.** At 1280 px and 1440 px at the default text size, "Finished stock on hand from this lot" reads as a table: each batch's number and three figures (Product, Made, Lbs on hand) on one line under one header line that names them in that order, with no figure's text past its cell. At 390 px each batch is a card with each label visible beside its value. With the browser's text size at 20 px, at 1280 px and 1440 px, no figure's text runs past its cell, and where a batch is a card each label shows beside its value.
- [ ] **AC-0016.** At 1280 px and 1440 px at the default text size, the raw lot list ("Receipts of" a raw product) reads as a table: each lot's number and three figures (Received, Vendor, Weight) on one line under one header line that names them in that order, with no figure's text past its cell. At 390 px each lot is a card with each label visible beside its value. With the browser's text size at 20 px, at 1280 px and 1440 px, no figure's text runs past its cell, and where a lot is a card each label shows beside its value.

### Pricing and Receiving

- [ ] **AC-0017.** At the default text size, on `/pricing` at 1024 px and 1279 px, and beside the "Product details" panel at 1279 px, each product's five figures sit on one line under its group's header line, with no figure's text past its cell. Beside the panel at 1024 px, each product is a card with each label visible beside its value. Beside the panel at 1279 px with the browser's text size at 20 px, no figure's text runs past its cell, and where a product is a card each label shows beside its value.
- [ ] **AC-0031.** With at least one product in "Needs a new price", where the Pricing list reads as a table at 1024 px and 1279 px at the default text size, each advice block and its one-press button span that product's row below its figures.
- [ ] **AC-0018.** At 1280 px and 1440 px at the default text size, a recent receipt whose vendor is "Wholesale Provisions Company" shows each word of the vendor's name whole on one line.
- [ ] **AC-0019.** At 1280 px at the default text size with 33 px of the page's width taken on the right (an always-visible 17 px scrollbar and 16 px to spare), Recent receipts still read as a table under their header line.

### Saved results and panels

- [ ] **AC-0032.** On `/production`, `/sales`, and `/receiving` with ten recent rows and a result just saved, at 1024 px and 1280 px at the default text size and at 1280 px with the browser's text size at 20 px, the form card ends no more than its own bottom padding and border plus 1 px below its Save button, and the saved result's top sits at or below the form card's bottom and no more than 1rem plus 1 px below it.
- [ ] **AC-0033.** On `/production`, `/sales`, and `/receiving`, each with a result just saved, at 1024 px, 1280 px, and 1440 px at the default text size and at 1280 px with the browser's text size at 20 px, every before-and-after table in the saved result ends at or left of the result card's right edge less its right padding, no figure in it runs past its cell, and no number in its Before or After cells splits across lines (a unit may drop under its number; a row label may wrap).
- [ ] **AC-0034.** At 390 px and 1024 px with the browser's text size at 20 px, and at 1280 px at the default text size, on `/production` while a batch's "Batch reversed" panel shows and on `/receiving` while a receipt's "Receipt corrected" panel shows, every before-and-after table in that panel ends at or left of its batch's or receipt's right edge less that item's right padding, no figure in it runs past its cell, and no number in its Before or After cells splits across lines (a unit may drop under its number; a row label may wrap).

### Code

- [ ] **AC-0020.** `src/app/pricing/page.tsx` starts `getPricingDetail` and `listPricing` for a product's details before it waits on either.
- [ ] **AC-0021.** The property `detail()` in `test/e2e/pricing-page.ts` uses for the "Product details" region is not named `main`.
- [ ] **AC-0022.** The "In use" mark in `src/app/receiving/recent-receipts.tsx` takes its fill from a color token that no `border-` or `divide-` class under `src/app` and no border rule in `src/app/globals.css` uses.

### Look and regressions

- [ ] **AC-0023.** `npm test` passes.
- [ ] **AC-0024.** The verification ledger records the owner's "match" verdict for each of the six spec 3a boards on the canvas at revision 1793899703-bb47, each compared whole with the built screen set to the board's state, and for S2-Receiving-Desktop at revision 1793856599-9c48 compared with Receiving built from this branch; a "no match" on any fails this criterion. The states: `/production` and `/sales` at 390 px and 1280 px with a product chosen, a just-saved result, and three recent rows, one reversed or void (S3-Production-Phone, S3-Production-Desktop, S3-Sales-Phone, S3-Sales-Desktop); `/trace` at 390 px showing a sale trace (S3-Trace-Phone) and at 1280 px showing a lot trace (S3-Trace-Desktop); `/receiving` at 1280 px with a product chosen and three recent receipts, one of them void (S2-Receiving-Desktop). The ledger also records the owner's "match" verdict for the look of Production's check step, the Reverse batch dialog, the "Batch reversed" panel, and the Void this sale? dialog, each built from this branch and compared with Receiving's Void and Correct dialogs and its "Receipt corrected" panel. Three differences do not count: the names, numbers, dates, and how many rows are listed are the test data's; a drawn text color shown as its nearest `globals.css` color token; and focus outlines.
- [ ] **AC-0025.** Read from the branch point with `main`, `src/app/facts.tsx` and `src/app/before-after.tsx` for the same props, render the same elements in the same nesting, with the same attributes other than `class` and the same text. A prop or `look` value added on this branch only chooses classes.
- [ ] **AC-0026.** Read from the branch point with `main`, tracked and untracked, the only changed expectations in existing browser test files are: in `test/e2e/look-pages.spec.ts`, the Pricing list's cards-or-table expectations below 1280 px, which AC-0017 changes; in `test/e2e/shell.spec.ts`, the content-cap test, whose 544 px form check moves from `/production` to a page that keeps the cap while its check-step width check stays on `/production`; and the rename AC-0021 names, with every use of the renamed property. The values, names, and orders the changed lines assert are otherwise unchanged. A test added to an existing file is not a changed expectation.

## Follow-ons

None. Spec 3b of the brief covers Menu, Invoices, Ask, and Alerts.

## Assumptions

- Technical: `/production` shows the "New batch" form with its check step, the "Batch saved" result (Lots used, Finished stock added, and the Raw stock before-and-after table), the "Product and raw stock" card (`#product-region`), and Recent batches with Reverse; `/sales` shows the "New sale" form with its product facts (`#product-facts`), the "Sale saved" result (Finished lots drawn, the Finished stock before-and-after table, Trace this sale), and Recent sales with Void; `/trace` shows "Find a sale" and "Find a raw lot", and a sale trace, a raw lot list, or a lot trace (source: `src/app/production/`, `src/app/sales/`, `src/app/trace/`, 2026-11-05)
- Technical: the browser suites find these parts by name: the "Batch result" and "Sale result" statuses, the "Recent sales" region, the "Find a sale" and "Find a raw lot" regions, `#product-region`, `#product-facts`, `[data-result-focus]`, and the dialogs by name; `trace.spec.ts` expects no status outside `main > div > [role=status]` (source: `test/e2e/production-page.ts`, `sales-page.ts`, `trace-page.ts`, `trace.spec.ts`)
- Technical: Tailwind 4.3 and the suite's Chromium support CSS container queries; `src/app/globals.css` already uses one for `receipt-table` (source: `src/app/globals.css`)
- Technical: at 1280 px the Recent receipts section is about 628 px wide, the table's fixed tracks leave the Vendor column about 54 px, and an always-visible scrollbar leaves the section 1 to 3 px over the table's 38rem threshold (source: spec 2's post-gates review rounds 2 and 3, PR #47)
- Process: the experience-design pack is not installed, so the canvas boards stand in as the design reference (source: the installed skills list)
- Product: spec 3 is split into 3a (Production, Sales, Trace, with the spec 2 leftovers) and 3b (Menu, Invoices, Ask, Alerts) (source: user confirmation 2026-11-05)
- Product: every table or card layout picks its look from the room its own section has, its width and the text size, not the screen width alone (source: user confirmation 2026-11-05)
- Product: on a desktop the saved result stays under the form, as on Receiving (source: user confirmation 2026-11-05)
- Product: Production's Raw on hand and Raw average cost show as two tiles, like Receiving's stock card (source: user confirmation 2026-11-05)
- Product: the Pricing list shows its table whenever the list has room (source: user confirmation 2026-11-05)
- Product: the check step, the Reverse batch and Void this sale? dialogs, and the "Batch reversed" panel follow Receiving's built look; the "Reversed: ..." and "Void: ..." lines use the error color, as on Receiving (source: user confirmation 2026-11-05, with the drawings)
