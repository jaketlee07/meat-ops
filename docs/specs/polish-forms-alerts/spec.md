# Spec: polish-forms-alerts

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints in the brief [`docs/product/briefs/ui-polish.md`](../../product/briefs/ui-polish.md), including the intent's Guardrail it points to; the screen rules in the `src/app` row of [`docs/architecture/overview.md`](../../architecture/overview.md), including its waiting-control rule; [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
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

The business owner, and anyone they show a screen to, sees forms, alerts, and pages that look finished and calm. This is spec 1b of the brief: the forms and the form column, the urgent banner, Alerts' daily digest, and the blank space on Trace, Invoices, and Ask, plus the look E leftovers that sit in forms.

Success for the business owner:

- Every form names its fields in one quiet label style, and related number fields share a line where they fit.
- Dropdowns, date boxes, and the invoice photo picker look like the rest of the app, not like the browser's defaults.
- The urgent banner is one quiet line, and the red badge on the Alerts links still marks urgent alerts.
- Alerts' daily digest reads as a short list, one line per paragraph.
- The saved result under a form keeps its words and figures whole at 20 px text, and on Receiving it sits right under the form however many products the stock card lists.
- Ask uses the page's width, and the Trace and Invoices cards hold no empty gaps.
- Floor entry stays as quick as today: Receiving, Production, and Sales keep their fields, Tab order, and presses.

The design reference is the comparison page named in the brief's Design artifacts.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/polish-forms-alerts/`. At closeout, the overview, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture: the screens | The overview's `src/app` row describes each form, the form column, the urgent banner, `/alerts`, `/ask`, `/trace`, and `/invoices`. Its sentence that the Receiving result starts under the "Stock and prices" card once the card is taller no longer holds. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names the one label style, the field pairs, the dropdown and date icons, the photo picker, the quiet banner, the digest list, Ask's full width, the Trace and Invoices cards, the Receiving result's place, and the six waiting buttons under the waiting-control rule. | `close-work` reads the row whole against the code. |
| Current architecture: the look's variants | Any new container variant lives in `src/app/globals.css`. | `src/app/globals.css` comments; the overview's look notes | `work-loop` implementer | Each new variant's comment names its threshold and use. | `close-work` reads both. |
| Current architecture: the test suites | The overview's `test/e2e/` row lists each browser suite, and its `test/` row names `look-tidy.test.ts`'s `file:rounded-md` exception for the photo field. | `docs/architecture/overview.md`, the `test/e2e/` and `test/` rows | `work-loop` implementer | The `test/e2e/` row lists this spec's new browser suite, and the `test/` row states the photo field's exception as it now stands. | `close-work` reads both rows whole. |
| Backlog | This spec delivers the rest of the gaps in `docs/product/intents/look-production-sales-trace-review-nits.md`; spec 1a delivered the others. | That intent and its `workspace.toml` entry | `close-work` | The verification ledger names the gaps this spec closes. | The intent is Fulfilled and leaves `backlog.open`. |
| Decision record: the brief's two 1b questions | The owner settled both on 2026-11-09: the banner becomes a slim, quiet bar, and the Receiving limit is fixed. | This spec's Assumptions; the overview's `src/app` row as current behavior | Owner | The Assumptions entries; the overview row | `close-work` confirms that the overview states both as current behavior. |
| Design reference | The comparison page is the reference for AC-0029. | The brief's Design artifacts section | Owner | The AC-0029 entries in the verification ledger | `close-work` confirms that the brief still links the page. |
| Delivery coordination | This spec is a child of the brief. | The brief's Spec map; this spec's `workspace.toml` entry | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide. | None | None | None | None |
| Release history | None. The app has no version. | None | None | None | None |

## Boundaries

### Always do

- Keep every figure, control name, role, and Tab order these pages show today, except where an acceptance criterion below changes one.
- Take every color from a token defined in `src/app/globals.css`, every radius from a theme token or `rounded-full`, and every font size from a theme token. Never use an arbitrary value for any of them.
- Run `npm test` in full before handing a task back, and stop any app or test server you started by its PID.

### Ask first

- Changing an expectation in an existing test beyond what AC-0031 allows.
- Any change that moves a result spec 1a's criteria check: its status tags, recent lists, row actions, Pricing advice, Menu switch, stock tiles, or sale trace.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Change anything under `supabase/` or `src/lib/`, change what a server action does, or write a new database query.
- Load a font, image, script, or style from another host, or load any web font.
- Add a figure, control, or page that the brief's Non-goals name or that specs 2a or 2b own.

## Testing Strategy

- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0004, AC-0006, AC-0007, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0025, AC-0026, AC-0027, AC-0028, AC-0032, AC-0033, and AC-0034)**: in a new `test/e2e/look-polish-forms.spec.ts`. Each is a style, layout, or behavior the owner sees in a browser, read from computed styles, element boxes, screenshots, accessible names and descriptions, the page's text, and the requests the page sends, at each width and text size the criterion names.
- **Goal-based check of a test's strength (AC-0024)**: a deliberately broken build that leaves Today's digest out of `/alerts` turns the `/alerts` AC-0001 test red, where today's `expectNoCap(page, 2)` stays green on it; the verification ledger records both runs, and the build is reverted.
- **Goal-based check over the whole suite (AC-0030)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0008, AC-0029, AC-0031)**: the owner's check by hand that each date box's icon opens the browser's date picker, which no browser test can see; the owner's comparison with the comparison page; and a read of the branch's test diff.

## Acceptance Criteria

### One label style

- [x] **AC-0001.** Every `label` element that names a text box, a dropdown, a date box, a text area, or the photo picker renders at 14 px at the default text size, at font weight 500, in `--color-ink-secondary`, on each of these: `/sign-in`; `/receiving` with its form, its Void dialog, and its Correct dialog; `/production` with its form and its Reverse dialog; `/sales` with its form and its Void dialog; `/pricing` with its "Product details" panel's target margin and list price forms and its what-if form; both finders on `/trace`; both read forms and a draft's review on `/invoices`; and `/ask`.

### Fields side by side

- [x] **AC-0002.** At 390 px, 1024 px, and 1280 px at the default text size, each of these pairs shares a line, the second field right of the first and the tops of their boxes within 1 px: Weight (lbs) and Cost per lb ($) on `/receiving`; Raw lbs and Finished lbs (optional) on `/production`; and Weight sold (lbs) and Price per lb ($) on `/sales`.
- [x] **AC-0004.** At 390 px, 1024 px, and 1280 px, at the default text size and with the browser's text size at 20 px, each number box that shares a line with another field holds the typed value 12,345.678 whole: the box's scroll width is no more than its client width.

### Dropdowns, date boxes, and the photo picker

- [x] **AC-0006.** Every dropdown on a page or dialog that AC-0001 names draws no arrow of the browser's own (its computed `appearance` is `none`) and shows a chevron drawn by `LineIcon` in `--color-ink-secondary` inside its right edge.
- [x] **AC-0007.** Every date box on a page or dialog that AC-0001 names shows a calendar icon drawn by `LineIcon` in `--color-ink-secondary` inside its right edge and right of its content box, and the browser's own calendar icon is not visible anywhere in the box: with the `LineIcon` hidden, a screenshot of the date box is identical to one taken after a rule that hides `::-webkit-calendar-picker-indicator` is added to the page.
- [x] **AC-0008.** The verification ledger records the owner's check by hand at 1280 px that a mouse press at the center of the calendar icon of each date box AC-0007 covers opens the browser's own date picker.
- [x] **AC-0009.** On `/invoices`, the photo field shows "Invoice photo" above a button named "Choose photo", and beside the button "No photo chosen" before a photo is chosen and that file's name after; the browser's own file input is not visible.
- [x] **AC-0034.** The "Choose photo" button's accessible description holds "Invoice photo", then the status text beside it ("No photo chosen" or the chosen file's name), then the photo field's error message whenever one shows.
- [x] **AC-0010.** A mouse press on "Choose photo", and Space or Enter while it has keyboard focus, each open the browser's file chooser.
- [x] **AC-0011.** A photo chosen through that file chooser is the photo that Read photo sends to the model.

### The urgent banner

- [x] **AC-0012.** With at least one urgent alert, and with the alert check failed, the region named "Urgent alerts" is filled with `--color-surface` and edged with `--color-card-border`, and neither its fill nor its edge takes `--color-error-wash` or `--color-error-edge`.
- [x] **AC-0013.** With at least one urgent alert, the region's sentence ("1 urgent alert needs you." or "<n> urgent alerts need you.") renders at font weight 400 in `--color-ink`, after a dot filled with `--color-error`, and its "See alerts" link stays.
- [x] **AC-0014.** With at least one urgent alert, at 390 px and 1280 px at the default text size, the region is one line: its height is no more than 44 px plus its top and bottom border widths.

### Weight in the form column

- [x] **AC-0015.** At 1280 px at the default text size, with a saved receipt, batch, and sale showing on their pages, no text renders at a font weight above 500 in the form or in the saved result under it on `/receiving`, `/production`, and `/sales`, except text in an element with the heading role, buttons, and the before-and-after table's header row.

### Saved results

- [x] **AC-0016.** In the saved result on `/receiving`, `/production`, and `/sales`, at 1024 px, 1280 px, and 1440 px, at the default text size and with the browser's text size at 20 px, with a weight of 1,234,567.891 lbs and a money figure of $1,524,148.13 among the result's figures, no word in the before-and-after table's row labels or header line splits across lines.
- [x] **AC-0017.** In the same results, widths, text sizes, and figures, no number (a value's text before its first space) splits across lines or runs past the result's card.
- [x] **AC-0018.** On `/receiving` at 1024 px and 1280 px, at the default text size and with the browser's text size at 20 px, with 18 finished products made from the chosen raw product, the saved result's top sits the same distance below the form's bottom, within 1 px, as it does with one finished product made from it.

### Waiting buttons

- [x] **AC-0019.** Each of these buttons, while it waits on its request, has no `disabled` attribute, has `aria-disabled="true"`, keeps keyboard focus when it had it, and renders at opacity 1: Save on `/receiving`; Cancel and Void receipt in the receipt Void dialog; Cancel in the Correct dialog; Cancel in the Reverse dialog; and Sign in.
- [x] **AC-0020.** A second press on Save on `/receiving`, on Void receipt in the receipt Void dialog, or on Sign in, while the first press waits, sends no second request.
- [x] **AC-0033.** While its request waits, a press on Cancel in the receipt Void dialog, the Correct dialog, or the Reverse dialog leaves that dialog open; with no request waiting, Cancel closes it.

### Vendor picker

- [x] **AC-0021.** On a draft's review on `/invoices` at the default text size, at 1178 px, at 1280 px, and at the narrowest viewport width where Vendor sits beside Product, the closed Vendor picker shows "Choose a vendor" whole, and shows a vendor named "Heartland Wholesale Meats Inc" whole once it is chosen: the text's width fits inside the picker's content box, left of its chevron.

### Alerts

- [x] **AC-0022.** On `/alerts` with a written digest of three paragraphs, the digest shows as a list of three items holding the three paragraphs in order, and the digest's footer follows the list, outside it.
- [x] **AC-0023.** Each digest item shows a dot filled with `--color-status-nocost` before its text.
- [x] **AC-0024.** The `/alerts` AC-0001 test in `test/e2e/look-menu-invoices-ask-alerts.spec.ts` requires the three children `/alerts` shows in `<main>` (its title, Today's digest, and the alert lists), so it fails on a build that shows only two of them.

### Ask, Trace, and Invoices

- [x] **AC-0025.** On `/ask` at 1280 px with an answer, the question card, the answer card, and the "Questions Ask can answer" section each span `<main>`'s content box: their left and right edges are within 1 px of its edges.
- [x] **AC-0026.** On `/trace` and `/invoices` at 1024 px and 1280 px at the default text size, with no message showing, in each of the Find a sale, Find a raw lot, Read photo, and Read text cards, the button's top is within 1 px of the field above it plus its form's row gap.
- [x] **AC-0027.** In the same cards, widths, and state, the card's bottom edge is within 1 px of the button's bottom plus the card's bottom padding and border.

### Floor entry

- [x] **AC-0028.** On `/receiving`, `/production`, and `/sales` at 390 px and 1280 px, pressing Tab from the Product code field reaches the form's other fields in this order, as it does today: Vendor, Weight (lbs), Cost per lb ($), Received date, and Notes (optional) on `/receiving`; Raw lbs, Finished lbs (optional), Production date, and Notes (optional) on `/production`; Weight sold (lbs), Price per lb ($), Customer, and Sale date on `/sales`.

### Look and regressions

- [x] **AC-0029.** The verification ledger records the owner's "match" verdict for each of these screens built from this branch at 1280 px, each compared with the named parts of the comparison page at revision 1794121141-4df1: `/receiving` with a product chosen, with the "Forms" Change block, leaving out its "Vendor beside Received date"; `/receiving` with an urgent alert, with the "First screen and alerts" Change block's first line; `/alerts` with a written digest, with the "Also fix" line on the daily digest, leaving out its one line per alert and its colored dot; `/invoices`, with the "Forms" Change block's line on the invoice photo picker; `/trace` and `/invoices`, with the "Also fix" line on blank gaps; and `/ask` with an answer, with that line's "Ask uses half the width". A "no match" on any fails this criterion. The test data's names, numbers, and dates do not count as differences.
- [x] **AC-0030.** `npm test` passes.
- [x] **AC-0031.** Read from the branch point with `main`, tracked and untracked, the only changed expectations in existing test files are those that read: `/ask`'s 544 px column, which AC-0025 changes; the read forms' level button tops, which AC-0026 and AC-0027 change; the read forms' check that nothing moves while a read is in flight, which AC-0027 changes; the photo field's file-selector button, its Tab stop, the field focus and description a refused photo sets, and the `file:rounded-md` exception in `test/look-tidy.test.ts`, which AC-0009 and AC-0034 change; the `/alerts` block count, which AC-0024 changes; the digest's paragraphs as paragraphs, which AC-0022 changes; and a waiting button's `disabled` attribute, which AC-0019 changes. The values, names, and orders the changed lines assert are otherwise unchanged. A test added to an existing file is not a changed expectation. A change the owner approves under Ask first, recorded in the verification ledger with its date, joins this list.
- [x] **AC-0032.** The browser suite's page-state check (`checkPageState`) reports no violation on each screen state AC-0029 names, on `/sign-in`, and on `/production` and `/sales` each with a saved result showing.

## Follow-ons

None. Specs 2a and 2b of the brief cover the rest of its scope.

## Assumptions

- Technical: two label styles exist: `text-sm font-semibold text-ink-secondary` on Receiving, Production, Sign in, Pricing's forms, and a draft's review, and `text-base font-medium` on Sales, Trace, Invoices' read forms, Ask, and the Void, Correct, and Reverse dialogs (source: grep of every `<label` in `src/app`, 2026-11-09)
- Technical: the form column is 340 px wide from 1024 px and 280 px from 1280 px (source: `src/app/form-column-grid.ts`)
- Technical: Chromium shows the date 11/09/2026 whole once a date box's content box is 102 px wide at 16 px text (a 156 px box with 12 px left padding and 40 px right padding for the icon) and cuts its year at 98 px; a date box's scroll width does not show that cut; `getComputedStyle` does not report the styled `::-webkit-calendar-picker-indicator` (it reads opacity 1 when CSS sets 0); `elementFromPoint` at the icon's center returns the date box when the icon takes no pointer events; hiding the indicator with an injected rule leaves a correctly styled date box's screenshot identical and changes one that still draws it; and a text box's scroll width shows a cut value (100 against 76) (source: three throwaway Chromium probes, 2026-11-09)
- Technical: the urgent banner is the "Urgent alerts" region in `src/app/page-header.tsx`, filled with `--color-error-wash` and edged with `--color-error-edge`, with semibold red text and a "See alerts" link, shown while any alert is urgent or the alert check fails (source: `src/app/page-header.tsx`)
- Technical: the model writes the daily digest as 1 to 6 paragraphs of up to 800 characters, and the day stores them; a paragraph is not one alert (source: `src/lib/digest.ts`)
- Technical: the six waiting buttons that take the `disabled` attribute are Save on `/receiving`, Cancel and Void receipt in the receipt Void dialog, Cancel in the Correct dialog, Cancel in the Reverse dialog, and Sign in (source: grep of `disabled={` in `src/app`, 2026-11-09)
- Technical: the Vendor picker on a draft's review and Receiving's layout have not changed since the leftovers intent measured them (source: `git log` of `src/app/invoices/draft-review.tsx` since `0da70e6`, and of `src/app/receiving/page.tsx`, `src/app/form-column-grid.ts`, and `src/app/before-after.tsx` since `a31fafc`, 2026-11-09)
- Technical: `checkPageState` scores the focused element itself: it must be at least 44 px square and draw an outline of the overview's focus ring (source: `test/e2e/a11y.ts`)
- Process: the experience-design skills (`creative-direction`, `design-review`) are not installed and no aesthetic direction doc exists, so the comparison page and look E stand in as the design reference (source: the installed skills list, 2026-11-09)
- Process: the comparison page's Change and "Also fix" lines for this spec are: one label style; Weight beside Cost per lb and Vendor beside Received date; styled dropdowns, date boxes, and photo picker; a slim, quiet alert bar with the badge kept; each digest alert on its own line with a colored dot; no blank gaps in the Trace and Invoices cards; and Ask at more than half the width (source: Artifact read of the comparison page at revision 1794121141-4df1, 2026-11-09)
- Process: the business owner gives no input to this work; the owner (the developer) makes every product call (source: the intent's Outcome section)
- Product: the urgent banner becomes a slim, quiet bar: one 44 px line on a white card, a small red dot, regular-weight text, and the same "See alerts" link; the red badge stays (source: user confirmation 2026-11-09)
- Product: Receiving's saved result always starts right under the form, however many finished products the "Stock and prices" card lists, which retires the limit accepted on 2026-11-05 (source: user confirmation 2026-11-09)
- Product: every form uses one label style: 14 px, `--color-ink-secondary`, weight 500 (source: user confirmation 2026-11-09)
- Product: only neighboring number fields share a line: Weight and Cost per lb, Raw lbs and Finished lbs, and Weight sold and Price per lb. Vendor keeps its own line, so Tab order stays as it is. Customer and Sale date keep their own lines too, since a phone's half-line cuts "Fulton Market Deli" and the desktop form column has no room for both (source: user confirmation 2026-11-09)
- Product: the digest shows each paragraph as its own list item with a small gray dot; what the model writes and what the day stores stay as they are (source: user confirmation 2026-11-09)
- Product: Ask uses the full content width, as Menu, Invoices, and Alerts do (source: user confirmation 2026-11-09)
- Product: the photo picker shows a "Choose photo" button and the chosen file's name, or "No photo chosen", under its "Invoice photo" label (source: user confirmation 2026-11-09)
- Product: the Trace and Invoices cards hold no reserved empty space; while a read runs, its card grows to hold the reading message and the space above it, so on a phone a photo read moves the Type a receipt card down, and the Drafts list moves down whenever the cards' row or column grows; this replaces look E's reserved status lines and level buttons (source: user confirmation 2026-11-09)
