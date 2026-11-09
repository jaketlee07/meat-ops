# Plan: polish-forms-alerts

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the form column (`src/app/form-column-grid.ts`) and the three floor forms (`src/app/receiving/receipt-form.tsx`, `src/app/production/production-form.tsx`, `src/app/sales/sale-form.tsx`) with their suites `test/e2e/look-pages.spec.ts` and `test/e2e/look-floor-pages.spec.ts`; the shared before-and-after table `src/app/before-after.tsx` and its `result-snug` and `result-tight` variants in `src/app/globals.css`; the shell's banner in `src/app/page-header.tsx`; `/alerts`' `src/app/alerts/digest-section.tsx` with `test/e2e/alerts-page.ts`; the read forms and draft review on `/invoices` (`src/app/invoices/read-forms.tsx`, `src/app/invoices/draft-review.tsx`, the `line-pair` variant) and `test/e2e/look-menu-invoices-ask-alerts.spec.ts`; the Trace finders (`src/app/trace/find-forms.tsx`); the page-state check `checkPageState` in `test/e2e/a11y.ts` and `withTextSize` and `expectNoCap` in `test/e2e/look-checks.ts`; a held server action through `page.route` on the `next-action` header, as `test/e2e/alerts.spec.ts` line 659 does. Uncertainty: the exact inner width of each form at each size, which T1 measures before it sets the pair thresholds.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/polish-forms-alerts/notes/verification-ledger.md`. A genuine
> artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

The label style and the form parts come first, because the pickers, the saved results, and spec 2b's search and filters build on them. The pickers follow, then the saved results and Receiving's layout. The banner and digest, the waiting buttons, and the Ask, Trace, and Invoices space are independent of the forms. A last task records what only a person or a diff read can check.

The riskiest part is fitting two fields in the 280 px form column. A date box with the calendar icon in its right padding is wider than half the column, about 118 px (see the date-box Design decision). So only the three number pairs share a line; Customer and Sale date keep their own lines, as the owner chose on 2026-11-09 once a phone's half-line was found to cut "Fulton Market Deli".

## Constraints

- The brief's Constraints and the intent's Guardrail: no costing outside the engine, 44 px controls, the focus outline, the contrast and axe checks, and each floor form's fields, Tab order, and presses.
- Spec 1a's criteria stay met. `BeforeAfter` is shared with the Correct dialog's panel, the Reverse dialog's panel, and Invoices' saved result, so a change to it shows there too and must keep those suites green.
- The look E shell and its tests: `<main>`'s first child stays the title-and-banner `div`; a page's own status stays out of `main > div > [role=status]`.
- `AGENTS.md`: no em dashes, `type(scope): description` commits, `npm ci --ignore-scripts`, and the folder check before any test run or stack stop.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T7's owner check that each date box's icon opens the browser's date picker, the owner comparison with the comparison page, and the test-diff read.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Overview `src/app` row: the screens | T1 to T6 | The row names the label style, the pairs, the dropdown and date icons, the photo picker, the quiet banner, the digest list, Ask's full width, the Trace and Invoices cards, the Receiving result's place, and the waiting buttons; the sentence on the Receiving limit is gone. | `close-work` reads the row whole against the code. |
| `globals.css` variant comments and the overview's look notes | T1, T2, T4 | Each new or changed variant's comment names its threshold and use. | `close-work` reads both. |
| Overview `test/e2e/` and `test/` rows | T1, T2 | The `test/e2e/` row lists `test/e2e/look-polish-forms.spec.ts`; the `test/` row states the photo field's `look-tidy.test.ts` exception as it now stands. | `close-work` reads both rows whole. |
| Intent `look-production-sales-trace-review-nits.md` | T2, T3, T4, T5, T7 | AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, and AC-0024 pass, and the ledger names the gaps they close. | The intent is Fulfilled. |
| Decision record: the banner and the Receiving limit | T3, T4 | The overview row states both as current behavior. | `close-work` reads the row. |
| Design reference: the comparison page | T7 | The AC-0029 ledger entries name revision 1794121141-4df1. | The brief still links the page. |

## Design (LLD)

### Design decisions

- **One source for form parts.** A new `src/app/form-parts.ts` holds the label classes (`block text-sm font-medium text-ink-secondary`) and the field box classes each form repeats today, and every form and dialog in AC-0001 imports them. Spec 2b's search and filters take the same parts. Traces to: AC-0001.
- **Field pairs.** Each pair sits in a two-column grid that applies only above a container width set in rem on the form, so a larger text size stacks the pair. The pairs apply from about 14rem of form: the 280 px column leaves about 15.5rem at the default text size and about 12.4rem at 20 px, where a pair's half could not hold 12,345.678. The DOM order of the fields does not change. T1 measures each form's inner width at each size before it fixes the threshold. Traces to: AC-0002, AC-0004, AC-0028.
- **Dropdowns.** Each `select` takes `appearance-none` and room on its right, inside a `relative` wrapper that also holds a chevron `LineIcon`, `aria-hidden` and `pointer-events-none`. Traces to: AC-0006.
- **Date boxes.** Each date box takes the same wrapper with a calendar `LineIcon`, 12 px of left padding, and 40 px of right padding for the icon. Its `::-webkit-calendar-picker-indicator` is made transparent and stretched over that right padding, so a press on the icon still opens the browser's picker. With this setup the spec's probe Assumption gives the 156 px a date box needs, and every date box is at least that wide wherever it shows: each sits on its own line except the draft review's Received date, which shares a `line-pair` row with Weight and Cost per lb, about 163 px a third at 32rem, more at the threshold T2 sets. Traces to: AC-0007, AC-0008.
- **Photo picker.** The file input stays in the form, named by its "Invoice photo" label, but is hidden and out of the Tab order. A visible "Choose photo" button opens it, and a text beside it shows "No photo chosen" or the chosen file's name. The button's `aria-describedby` lists the label, that text, and the error, so the focused control is the visible one that `checkPageState` scores and a screen reader hears the field's name and state. A refused photo focuses the button. Traces to: AC-0009, AC-0010, AC-0011, AC-0034.
- **Quiet banner.** The "Urgent alerts" region keeps its role, name, text, and link, and changes only its classes: a surface fill, a `--color-card-border` edge, an `aria-hidden` dot filled with `--color-error`, and the sentence at weight 400 in `--color-ink`. The failure message keeps its words and its `--color-error` text. Traces to: AC-0012, AC-0013, AC-0014.
- **Digest list.** The written paragraphs render as a `ul` with one `li` each, an `aria-hidden` dot filled with `--color-status-nocost` before each, and the footer `p` after the list. The stored text and the model's request stay as they are. Traces to: AC-0022, AC-0023.
- **Saved results.** `BeforeAfter`'s After column drops to weight 500, and below a new container width, under `result-tight`, each row stacks: its label on one line, then Before and After each on their own line. Every value stays `whitespace-nowrap`. Traces to: AC-0015, AC-0016, AC-0017.
- **Receiving's result.** `#product-region` stops being `display: contents` and becomes one grid item in a right-hand area that spans the result's row, so the left column's rows hold only the form and the result. The DOM order stays form, result, region. Traces to: AC-0018.
- **Waiting buttons.** The six buttons swap `disabled={pending}` for `aria-disabled`, with the color-only fade the overview's waiting-control rule names. A press ref and the pending state make a second press do nothing, as the draft review's Save receipts does, and each Cancel returns early while its dialog's request waits, as `src/app/sales/void-dialog.tsx` does. Traces to: AC-0019, AC-0020, AC-0033.
- **Vendor picker.** The `line-pair` threshold rises, and the pair splits its line evenly, so the Vendor picker is wide enough for "Heartland Wholesale Meats Inc" wherever it shares a line, and takes the full line where it does not. Traces to: AC-0021.
- **Ask, Trace, and Invoices.** `/ask` passes `fullWidth`. The Trace finders' and Invoices' read cards take their own heights (`items-start`); their buttons lose `mt-auto` and their forms `flex-1`; Invoices' status line loses its reserved height, so a read in flight grows its card (owner, 2026-11-09); and an empty message element takes no place in its form's gap. Traces to: AC-0025, AC-0026, AC-0027.

### Component / module decomposition

- New: `src/app/form-parts.ts` (the label and field classes), `test/e2e/look-polish-forms.spec.ts` (the browser suite), and the verification ledger.
- Changed: listed in each task's Touches.

### Quality attributes (NFRs)

- Accessibility: every dot and icon is `aria-hidden`, so no meaning rests on color alone; every control keeps its role, name, 44 px size, and focus ring; the photo picker's focused control is the visible button; every waiting button stays focusable.

## Tasks

### T1: One label style, field pairs, and the form parts

**Depends on:** none
**Mode:** manual QA through the browser suite
**Touches:** `src/app/form-parts.ts`, `src/app/globals.css`, `src/app/receiving/receipt-form.tsx`, `src/app/receiving/void-dialog.tsx`, `src/app/receiving/correct-dialog.tsx`, `src/app/production/production-form.tsx`, `src/app/production/reverse-control.tsx`, `src/app/sales/sale-form.tsx`, `src/app/sales/void-dialog.tsx`, `src/app/sign-in/sign-in-form.tsx`, `src/app/pricing/change-form.tsx`, `src/app/pricing/what-if-form.tsx`, `src/app/trace/find-forms.tsx`, `src/app/invoices/read-forms.tsx`, `src/app/invoices/draft-review.tsx`, `src/app/ask/ask-panel.tsx`, `test/e2e/look-polish-forms.spec.ts`, `docs/architecture/overview.md`, `docs/specs/polish-forms-alerts/notes/verification-ledger.md`

**Tests:**
- no stub (manual QA): the checks are computed styles and boxes in a browser.
- New `look-polish-forms.spec.ts`: AC-0001 opens each page, dialog, and panel it lists and reads every `label` whose control is not a checkbox; AC-0002 and AC-0004 at each width and text size they name, typing 12,345.678 into each number box, AC-0004's test first asserting the shared line it measures, and seen red once on a scratch style that narrows one paired box below the value's width, recorded in the ledger and reverted; AC-0028 walks Tab from Product code on each floor form at 390 px and 1280 px. Each is seen failing on today's tree first, except AC-0028, which guards today's order.

**Approach:**
- Measure each form's inner width at 390, 1024, and 1280 px at both text sizes, then set the pair threshold.
- Move every form to the shared parts and pair the neighbors.
- Name the label style and the pairs in the overview's `src/app` row and the new variants in its look notes, and list the new suite in its `test/e2e/` row.

**Done when:** the T1 tests pass and `npm test` passes.

### T2: Dropdowns, date boxes, the photo picker, and the Vendor picker

**Depends on:** T1
**Mode:** manual QA through the browser suite
**Touches:** `src/app/form-parts.ts`, `src/app/globals.css`, `src/app/receiving/receipt-form.tsx`, `src/app/production/production-form.tsx`, `src/app/sales/sale-form.tsx`, `src/app/pricing/what-if-form.tsx`, `src/app/trace/find-forms.tsx`, `src/app/invoices/read-forms.tsx`, `src/app/invoices/draft-review.tsx`, `test/e2e/look-polish-forms.spec.ts`, `test/e2e/invoices.spec.ts`, `test/e2e/invoices-page.ts`, `test/look-tidy.test.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): each check is a computed style, a box, a press, or a request in a browser.
- `look-polish-forms.spec.ts`: AC-0006 and AC-0007 on every dropdown and date box of the AC-0001 pages, reading `appearance`, the icon's `svg` and color, and the icon's box against its control's (inside the control's right edge, and for a date box its left edge at or right of the content box's right edge), and for AC-0007 hiding the icon and comparing the box's screenshot with one taken after an injected rule hides `::-webkit-calendar-picker-indicator`; AC-0034 through Playwright's accessible-description assertion before a photo is chosen, after, and with a refusal showing; AC-0009, AC-0010, and AC-0011 on `/invoices`, AC-0010 through Playwright's `filechooser` event for a mouse press, Space, and Enter, and AC-0011 by choosing a photo through that chooser and reading the image the fake model receives; AC-0021 with a vendor named "Heartland Wholesale Meats Inc", at the narrowest width found by stepping down 1 px at a time as the Product picker's narrowest-width test does, measuring the shown text with a canvas in the picker's computed font against its content box: its client width less its left and right padding, with the chevron's left edge at or right of the shown text's end. Each is seen failing on today's tree first.
- These existing checks read the "Choose photo" button instead of the file input (AC-0031): `invoices.spec.ts`'s "the photo field's selector button looks like a button and the field stays 44 px tall"; the photo field's stop in `FORM_CONTROLS` in `invoices-page.ts`; the focus and description that `invoices.spec.ts`'s refused-photo test ("... is refused beside the Invoice photo field, and nothing is sent") reads; the step in `invoices.spec.ts`'s keyboard-only test that focuses the photo field before pressing Tab; and `look-tidy.test.ts`'s `file:rounded-md` exception for `read-forms.tsx`, which goes or names the new button's class.

**Approach:**
- Add the chevron and calendar wrappers to the form parts and use them on every dropdown and date box; replace the photo field's visible input with the button and file name; widen the Vendor picker's pair.
- Name each in the overview's `src/app` row, and state the photo field's `look-tidy.test.ts` exception as it now stands in its `test/` row.

**Done when:** the T2 tests pass and `npm test` passes.

### T3: The quiet banner, the digest list, and the Alerts block test

**Depends on:** none
**Mode:** manual QA through the browser suite, and a goal-based check of a test's strength
**Touches:** `src/app/page-header.tsx`, `src/app/alerts/digest-section.tsx`, `test/e2e/look-polish-forms.spec.ts`, `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, `test/e2e/look-checks.ts`, `test/e2e/alerts.spec.ts`, `docs/architecture/overview.md`, `docs/specs/polish-forms-alerts/notes/verification-ledger.md`

**Tests:**
- no stub (manual QA): the checks are computed styles, boxes, and list structure in a browser.
- `look-polish-forms.spec.ts`: AC-0012 with an urgent alert and with the alert check failed; AC-0013 and AC-0014 with an urgent alert, at 390 px and 1280 px; AC-0022 and AC-0023 with a three-paragraph digest seeded through `alerts-page.ts`. Each is seen failing on today's tree first.
- `look-menu-invoices-ask-alerts.spec.ts`'s `/alerts` cap test ("/alerts lifts the 34rem cap on every child of main but a dialog") passes 3 to `expectNoCap`, and `expectNoCap`'s comment in `look-checks.ts` says Alerts shows three (AC-0024). A build that leaves Today's digest out of `/alerts` turns that test red, where `expectNoCap(page, 2)` stays green on it; the ledger records both runs, and the build is reverted.
- Any `alerts.spec.ts` check that reads the digest's paragraphs as `p` elements reads the list items instead (AC-0031).

**Approach:**
- Restyle the banner; render the digest as a list; correct the block count.
- Name the quiet banner and the digest list in the overview's `src/app` row.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: Saved results keep their words and figures whole, and Receiving's result sits under its form

**Depends on:** T1
**Mode:** manual QA through the browser suite
**Touches:** `src/app/before-after.tsx`, `src/app/facts.tsx`, `src/app/globals.css`, `src/app/receiving/result-panel.tsx`, `src/app/production/result-panel.tsx`, `src/app/sales/result-panel.tsx`, `src/app/receiving/page.tsx`, `src/app/receiving/receipt-form.tsx`, `src/app/receiving/product-region.tsx`, `test/e2e/look-polish-forms.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are computed styles and boxes in a browser.
- `look-polish-forms.spec.ts`: AC-0015 by walking every text node in each form and saved result and reading its computed weight, skipping only the exempt parts it names; AC-0016 and AC-0017 at each width and text size they name, with a receipt, a batch, and a sale whose figures include 1,234,567.891 lbs and $1,524,148.13, checking each word and each number is one line box and each number's box ends inside the card; AC-0018 with 1 and then 18 finished products made from one raw product. Each is seen failing on today's tree first.
- The existing saved-result checks in `look-floor-pages.spec.ts` and `look-pages.spec.ts`, and the Correct, Reverse, and Invoices suites, pass unchanged.

**Approach:**
- Lower the After column's weight, stack the table's rows where the card is tight, and make the product region one right-hand grid item.
- Name the stacked rows and the Receiving result's place in the overview's `src/app` row, remove its sentence on the Receiving limit, and update the comment in `src/app/receiving/page.tsx`.

**Done when:** the T4 tests pass and `npm test` passes.

### T5: The six waiting buttons stay focusable and fade only their colors

**Depends on:** none
**Mode:** manual QA through the browser suite
**Touches:** `src/app/receiving/receipt-form.tsx`, `src/app/receiving/void-dialog.tsx`, `src/app/receiving/correct-dialog.tsx`, `src/app/production/reverse-control.tsx`, `src/app/sign-in/sign-in-form.tsx`, `test/e2e/look-polish-forms.spec.ts`, `test/e2e/receiving.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): each check holds a server action's request with `page.route` on its `next-action` header and reads the button while it waits.
- `look-polish-forms.spec.ts`: AC-0019 for each of the six buttons, reading the attribute, `aria-disabled`, `document.activeElement`, and computed opacity; AC-0020 by pressing Save, Void receipt, and Sign in twice while the first press is held and counting the action requests; AC-0033 by pressing each dialog's Cancel while its request is held, then, after that request is dropped and answered as a refusal, opening the dialog again and pressing Cancel with nothing waiting, and pressing Cancel in a freshly opened dialog. AC-0019 is seen failing on today's tree first; AC-0020 and AC-0033 guard today's behavior, which `disabled` gives.
- Any existing check that reads one of these buttons' `disabled` attribute, such as `receiving.spec.ts`'s "pressing Save again while a save is pending writes no second lot", reads `aria-disabled` instead if it fails (AC-0031).

**Approach:**
- Swap each button's `disabled` for `aria-disabled` with the press guard and the color-only fade.
- Name the six buttons under the waiting-control rule in the overview's `src/app` row.

**Done when:** the T5 tests pass and `npm test` passes.

### T6: Ask uses the page's width, and the Trace and Invoices cards hold no gaps

**Depends on:** T2
**Mode:** manual QA through the browser suite
**Touches:** `src/app/ask/page.tsx`, `src/app/ask/ask-panel.tsx`, `src/app/trace/find-forms.tsx`, `src/app/invoices/read-forms.tsx`, `test/e2e/look-polish-forms.spec.ts`, `test/e2e/look-menu-invoices-ask-alerts.spec.ts`, `test/e2e/invoices.spec.ts`, `test/e2e/shell.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- no stub (manual QA): the checks are element boxes and computed gaps in a browser.
- `look-polish-forms.spec.ts`: AC-0025 at 1280 px with an answer; AC-0026 and AC-0027 at 1024 px and 1280 px, reading each form's computed `row-gap` and each card's padding and border. Each is seen failing on today's tree first.
- These existing checks change (AC-0031): `look-menu-invoices-ask-alerts.spec.ts`'s `/ask` width test ("at 1280 px with an answer, /ask's form, answer, and examples end within 544 px of <main>'s content") checks the full width instead; `shell.spec.ts`'s desktop content cap test checks `/ask`'s examples section at the full width too and keeps its check of the check step's own 28rem; `look-menu-invoices-ask-alerts.spec.ts`'s read-forms test ("the read forms sit side by side with their tops and their buttons' tops level, above Drafts to confirm") drops the level-button check; and `invoices.spec.ts`'s in-flight test ("while a <source> read is in flight ... the message sits by that Read button, nothing moves, and both buttons are disabled") expects, per source and viewport, the pressed Read button and every box above the reading message to keep its place, the reading card's bottom to sit within 1 px of the message's bottom plus the card's bottom padding and border, and anything below to move by the measured growth of the row or column that holds the reading card: at 1280 px, where the cards share a row, the other card and its button keep their place and Drafts moves down by the row's growth, which a photo read leaves at zero while the Type a receipt card stays the taller; at 320 px, where the cards stack, every box below the reading card, Drafts included, moves down by the card's measured growth. `look-floor-pages.spec.ts`'s Trace finder checks pass unchanged.

**Approach:**
- Pass `fullWidth` on `/ask`; let the four cards take their own heights and drop their reserved space.
- Name each in the overview's `src/app` row.

**Done when:** the T6 tests pass and `npm test` passes.

### T7: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3, T4, T5, T6
**Mode:** visual and manual QA, and the page-state check in the browser suite
**Touches:** `docs/specs/polish-forms-alerts/notes/verification-ledger.md`, `test/e2e/look-polish-forms.spec.ts`

**Tests:**
- no stub (visual and manual QA): the owner's verdicts and a diff read.
- `look-polish-forms.spec.ts`: AC-0032 runs `checkPageState` on each AC-0029 state, on `/sign-in`, and on `/production` and `/sales` each with a saved result showing.
- The ledger records the owner's verdict on each AC-0029 screen, the owner's AC-0008 check by hand on each date box, the AC-0031 read of `git diff` from the branch point over `test/` with untracked files listed, and the leftovers gaps this spec closes.
- Each T7 record names the commit it read: the branch's last commit that changes a file other than those under `docs/specs/polish-forms-alerts/`, `docs/product/briefs/ui-polish.md`, and `workspace.toml`. A later commit that changes any other file re-opens every T7 record; one that changes only those files re-opens none.

**Approach:**
- Build each AC-0029 screen state on the local stack with made-up data, show each to the owner beside the comparison page, and read the test diff.

**Done when:** the ledger holds every entry above and `npm test` passes (AC-0030).

## Rollout

Big bang, in one PR. Rollback is a revert. No data, schema, or hosted setting changes.

## Risks

- A pair threshold set in rem can land a pair on a line too narrow for its box at some size the criteria do not name. AC-0004 checks every width and text size it names; T1 measures the forms before it sets the threshold.
- Hiding the photo input moves keyboard focus to the "Choose photo" button. A test or a screen reader that expects the input itself to take focus would see a change; the label still names the input, so `getByLabel("Invoice photo")` still finds it for `setInputFiles`.
- Turning `#product-region` into one grid item could move the stock card or Recent receipts at a width the look-pages suite checks. Those checks must pass unchanged.

## Changelog

- 2026-11-09: initial plan, after the owner's answers on the banner, the Receiving limit, the label style, the field pairs, the digest, Ask's width, and the photo picker, and a Chromium probe of date box widths.
- 2026-11-09: after shaping review round 1 and adversarial review round 1: the photo picker's description, the dialogs' Cancel guard, and the `/alerts` block count gained criteria; AC-0031 lists every existing check the photo picker and the read cards change; the owner chose to drop the read cards' reserved line and to keep Customer and Sale date on their own lines; a second date-box probe with the icon in place set the 102 px text room and showed the browser's indicator style cannot be read, so the icon's picker press is a check by hand; T2, T4, and T6 name the test and source files they must edit.
- 2026-11-09: after shaping review round 2 and adversarial review round 2: AC-0007 compares screenshots with and without the browser's indicator; the owner does AC-0008's check in T7; T6's in-flight test states what moves per source and viewport; T1 sees AC-0004 red once; T5's Cancel test reopens the dialog after a refused request.
- 2026-11-09: after shaping review round 3 and adversarial review round 3: T6's in-flight test measures the reading card's growth instead of pinning it; T2 reads each icon's place against its control; the probe results live in the spec's Assumptions, and the plan keeps only the 156 px the date-box design needs; T1, not T2, touches the ledger.
- 2026-11-09: after shaping review round 4: T6's in-flight test moves what sits below by the growth of the row or column holding the reading card; the ledger points to the spec for the owner's decisions and the probe results.
