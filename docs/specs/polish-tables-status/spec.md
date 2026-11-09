# Spec: polish-tables-status

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints in the brief [`docs/product/briefs/ui-polish.md`](../../product/briefs/ui-polish.md), including the intent's Guardrail it points to; the screen rules in the `src/app` row of [`docs/architecture/overview.md`](../../architecture/overview.md); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** docs/product/briefs/ui-polish.md
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

The business owner, and anyone they show a screen to, reads Meat Ops' lists and statuses at a glance. This is spec 1a of the brief: the tables and statuses outside the form column, plus two look E leftovers (stock tiles and the sale trace).

Success for the business owner:

- A status reads as a small colored tag, the same way on every page: Sellable now, Not sellable now, In use, Voided, and Reversed. "No list price yet" reads as quiet gray text.
- A void or reversal shows its reason in quiet gray text instead of a bold red note several lines long.
- Recent receipts and Recent sales keep lot numbers, sale numbers, and dates whole, and a receipt's Void and Correct sit side by side.
- Recent sales lists the same 10 sales as today, in sale-date order.
- Pricing shows its advice in a calm box with a secondary button, and Menu's "Sellable only" control reads as a switch.
- Stock figures and a sale trace's facts fit their space at the widths and text sizes the criteria name.

The design reference is the comparison page named in the brief's Design artifacts.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/polish-tables-status/`. At closeout, the overview, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture: the screens | The overview's `src/app` row describes Recent receipts, Recent sales, Recent batches, Menu's switch, the Pricing list's advice, the stock tiles, and a sale trace. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names the status tags, a row's side-by-side Void and Correct, Recent sales' order, the Pricing advice box, the Menu switch, the stock tiles, and the sale trace's columns. | `close-work` reads the row whole against the code. |
| Current architecture: the look's tokens | The tag colors and the switch draw on tokens in `src/app/globals.css`. | `src/app/globals.css` token comments; the overview's look notes | `work-loop` implementer | Each new token's comment names its use. | `close-work` reads both. |
| Current architecture: the test suites | The overview's `test/e2e/` row lists each browser suite. | `docs/architecture/overview.md`, the `test/e2e/` row | `work-loop` implementer | The row lists this spec's new browser suite. | `close-work` reads the row whole. |
| Backlog | This spec delivers two of the gaps in `docs/product/intents/look-production-sales-trace-review-nits.md`; spec 1b delivers the rest. | That intent and its `workspace.toml` entry | `close-work` | The verification ledger names the two gaps this spec closes. | The intent stays in `backlog.open` until spec 1b ships too. |
| Design reference | The comparison page is the reference for AC-0016. | The brief's Design artifacts section | Owner | The AC-0016 entries in the verification ledger | `close-work` confirms that the brief still links the page. |
| Delivery coordination | This spec is a child of the brief. | The brief's Spec map; this spec's `workspace.toml` entry | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide. | None | None | None | None |
| Release history | None. The app has no version. | None | None | None | None |

## Boundaries

### Always do

- Keep every figure, control name, role, and Tab order these pages show today, except where an acceptance criterion below changes one.
- Keep Void, Correct, and Reverse one press each from their row, as today.
- Take every color from a token defined in `src/app/globals.css`, every radius from a theme token or `rounded-full`, and every font size from a theme token. Never use an arbitrary value for any of them.
- Run `npm test` in full before handing a task back, and stop any app or test server you started by its PID.

### Ask first

- Changing an expectation in an existing browser test beyond what AC-0018 allows.
- Any change to which sales, receipts, or batches a recent list shows, or to how many.
- Any change to the form column's field layout, its label style, or the results under the form, which spec 1b owns.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Change anything under `supabase/`, change a server action, or write a new database query.
- Load a font, image, script, or style from another host, or load any web font.
- Add a figure, control, or page that the brief's Non-goals name or that specs 1b, 2a, or 2b own.

## Testing Strategy

- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, and AC-0024)**: in a new `test/e2e/look-polish-tables.spec.ts`. Each is a style, layout, or order the owner sees in a browser, read from computed styles, element boxes, and row text at each width and text size the criterion names.
- **Goal-based check over the whole suite (AC-0017)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0016, AC-0018)**: the owner's comparison with the comparison page, and a read of the branch's test diff.

## Acceptance Criteria

### Status tags

- [x] **AC-0001.** Each of these status words shows inside a tag, a rounded element whose fill differs from the surface behind it: "Sellable now" and "Not sellable now" on `/menu`; "In use" in Recent receipts; "Voided" in Recent receipts and Recent sales; and "Reversed" in Recent batches.
- [x] **AC-0002.** Each tag shows its status color as a dot before its word: `--color-status-priced` for "Sellable now", and `--color-status-nocost` for "Not sellable now", "In use", "Voided", and "Reversed".
- [x] **AC-0023.** "No list price yet" shows as text in `--color-ink-secondary`, outside any tag, wherever it appears: the Menu list, the Pricing list, the "Product details" panel, and the "New sale" form's product facts.
- [x] **AC-0024.** In the Menu list, the Pricing list, and the "Product details" panel, "No list price yet" renders at font weight 400.
- [x] **AC-0003.** Each tag's word has a contrast ratio of at least 4.5:1 against the tag's fill.

### Voids and reversals

- [x] **AC-0004.** A voided receipt, a voided sale, and a reversed batch each show their reason as text in `--color-ink-secondary` at font weight 400, and no text in Recent receipts, Recent sales, or Recent batches starts with "Void:" or "Reversed:".
- [x] **AC-0005.** At 1280 px and 1440 px at the default text size, where the overview's `src/app` row makes Recent receipts, Recent sales, and Recent batches tables, a receipt or sale voided with the reason "Entered twice by mistake", or a batch reversed with it, has a row no taller than the same list's tallest row that is neither voided nor reversed, plus one line of the reason's text (its computed line height).

### Recent receipts and Recent sales

- [x] **AC-0006.** At 1280 px and 1440 px at the default text size, every lot number and Received date in Recent receipts, and every sale number and sale date in Recent sales, shows whole on one line: its text lies on a single line and does not run past its cell.
- [x] **AC-0007.** At 1280 px and 1440 px at the default text size, a recent receipt that offers both Void and Correct shows them side by side with their tops level, and one that shows "In use" and Correct shows them side by side with the visible tag's vertical middle within 1 px of Correct's.
- [x] **AC-0008.** No row's own Void button in Recent receipts or Recent sales, the button named "Void lot <number>" or "Void sale <number>", takes `--color-error` for its text, its border, or its fill.
- [x] **AC-0009.** Recent sales orders the sales it shows by sale date, newest first, and by entry time, newest first, within one sale date.
- [x] **AC-0020.** With 11 sales on record, Recent sales shows the 10 most recently entered, as today: the sale entered first does not show, even when its sale date is the newest.

### Pricing and Menu

- [x] **AC-0010.** With at least one product in "Needs a new price", each advice row's apply button in the Pricing list takes `--color-primary` for its text and its border and `--color-surface` for its fill.
- [x] **AC-0011.** With at least one product in "Needs a new price", each advice sentence in the Pricing list, and in that product's "Product details" panel, renders at font weight 400 inside a box filled with `--color-advice-fill`.
- [x] **AC-0012.** On `/menu` at 390 px and 1280 px, the "Sellable only" control keeps its checkbox role and its name, and shows as a switch: a track holding a round knob, the knob at the track's left when off and at its right when on, and the track filled with `--color-primary` when on.
- [x] **AC-0021.** On `/menu` at 390 px and 1280 px, in both states of the "Sellable only" switch, the track's edge and the knob each have a contrast ratio of at least 3:1 against what sits behind them.

### Weight

- [x] **AC-0013.** At 1280 px at the default text size, with no panel, dialog, or refusal open, no text renders at a font weight above 500 in Recent receipts, Recent batches, Recent sales, the Menu list, the Pricing list and its tiles, Drafts to confirm on `/invoices`, a trace result on `/trace` (a lot trace, a sale trace, or a raw lot list), the "Stock and prices" card on `/receiving`, or the "Product and raw stock" card on `/production`, except text in an element with the heading role, each list's header line, each table row's first column, the values in the stock tiles and the Pricing tiles, buttons, and tags.

### Stock tiles and the sale trace

- [x] **AC-0014.** In the "Stock and prices" card on `/receiving` and the "Product and raw stock" card on `/production`, at 390 px, 1024 px, and 1280 px, at the default text size and with the browser's text size at 20 px, with on-hand stock of 12,345.678 lbs and of 1,234,567.891 lbs and an average cost of $1.7520/lb, no number in a stock tile (a value's text before its first space) splits across lines and no value runs past its tile.
- [x] **AC-0022.** In the same two cards at 390 px, 1024 px, and 1280 px at the default text size, an on-hand value of 12,345.678 lbs stays on one line with its unit.
- [x] **AC-0015.** On `/trace` showing a sale trace, at 1280 px and 1920 px at the default text size, in the sale's card, each batch card, and each raw lot block, every label sits directly above its value: the label's bottom is at or above the value's top, and their left edges are within 1 px.

### Look and regressions

- [x] **AC-0016.** The verification ledger records the owner's "match" verdict for each of these screens built from this branch at 1280 px, each compared with these "Change" blocks of the comparison page at revision 1794121141-4df1: `/receiving` with a product chosen and three recent receipts, one void and one in use, and `/sales` with three recent sales, one void, each with "Status, IDs, and dates"; `/menu` with "Status, IDs, and dates"; each "Status, IDs, and dates" comparison leaves out that block's "dimmed row" and its "No list price yet" tag, which the owner's 2026-11-08 choices replaced with an undimmed row and quiet gray text; and `/pricing` with at least one product in "Needs a new price", with "Advice and main buttons". A "no match" on any fails this criterion. The test data's names, numbers, and dates do not count as differences.
- [x] **AC-0017.** `npm test` passes.
- [x] **AC-0018.** Read from the branch point with `main`, tracked and untracked, the only changed expectations in existing browser test files are those that read a void's "Void: <reason>" text or a reversal's "Reversed: <reason>" text, which AC-0004 changes; those that read Recent sales' order, which AC-0009 changes; and, as the owner approved on 2026-11-08, the receipt table's header names, column checks, and one-top checks in `test/e2e/look-pages.spec.ts` and the Recent sales table's header names, one-line, and column checks that `test/e2e/look-floor-pages.spec.ts` makes through `expectTable` in `test/e2e/look-checks.ts`, which the date stacked over the lot or sale number in AC-0006's columns changes. The values, names, and orders the changed lines assert are otherwise unchanged. A test added to an existing file is not a changed expectation. A change the owner approves under Ask first, recorded in the verification ledger with its date, joins this list.
- [x] **AC-0019.** The browser suite's page-state check (`checkPageState`) reports no violation on each screen state AC-0016 names, on `/production` with a product chosen and a reversed batch, and on `/trace` showing a sale trace.

## Follow-ons

None. Specs 1b, 2a, and 2b of the brief cover the rest of its scope.

## Assumptions

- Technical: the status colors are tokens in `src/app/globals.css` (`--color-status-needs`, `--color-status-priced`, `--color-status-nocost`), and look E keeps their meanings (source: `src/app/globals.css`; `docs/product/intents/ui-redesign.md`)
- Technical: Receiving's "In use" is already a gray rounded mark on `--color-mark-fill` (source: `src/app/receiving/recent-receipts.tsx`)
- Technical: the status words render in `menu-list.tsx`, `pricing-list.tsx`, `pricing-detail.tsx`, `sale-form.tsx`, `recent-receipts.tsx`, and `recent-sales.tsx`, and existing browser specs read the void notes' "Void: <reason>" text (source: grep of `src/app` and `test/e2e`, 2026-11-08)
- Technical: `listRecentSales` takes the 10 latest sales by entry time (`created_at`) (source: `src/lib/sales.ts`)
- Process: the experience-design skills (`creative-direction`, `design-review`) are not installed and no aesthetic direction doc exists, so the comparison page and look E stand in as the design reference (source: the installed skills list and a repository search, 2026-11-08)
- Process: on 2026-11-08 the owner accepted the comparison page at revision 1794121141-4df1 unchanged, so AC-0016 compares with that revision; the business owner gives no input to this work (source: user confirmation 2026-11-08; the brief's Assumptions and risks and Design artifacts; the intent's Outcome section)
- Product: Recent sales keeps the 10 latest-entered sales and lists them by sale date, newest first (source: user confirmation 2026-11-08)
- Product: a receipt's Void and Correct sit side by side as smaller, quieter buttons, with no extra press, in place of the comparison page's "More" button (source: user confirmation 2026-11-08)
- Product: Menu's "Sellable only" filter stays a checkbox drawn as a switch, in place of the comparison page's "All | Sellable" tabs (source: user confirmation 2026-11-08)
- Product: a sale trace lays its facts out in columns, as a lot's card does (source: user confirmation 2026-11-08)
- Product: the tags reuse look E's status colors, with a gray "Voided" tag and the reason in small gray text (source: user confirmation 2026-11-08)
- Product: "No list price yet" is quiet gray text, not a tag, because it fills a price column (source: user confirmation 2026-11-08)
- Product: Recent receipts and Recent sales stack the date over the lot or sale number in one cell, and the shipped receipt and sale table tests change their header-name, column, one-line, and one-top checks to match (source: user confirmation 2026-11-08)
- Product: a voided receipt or sale keeps its row undimmed, marked only by the gray "Voided" tag and the gray reason (source: user confirmation 2026-11-08)
