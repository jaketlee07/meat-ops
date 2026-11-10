# Look E leftovers: figures, labels, and pickers that fit their space, waiting buttons, and Receiving's result under a tall stock card

- **Status:** Fulfilled


## Outcome

On Production, Receiving, Sales, and Trace every figure stays whole and every label sits near its value at any screen width and text size, and the owner decides whether Receiving's saved result must stay near its form when the raw product has many finished products. Every waiting button outside spec 3b's four pages stays focusable and fades only its colors, as the overview's rule says. On a draft's review in `/invoices`, the closed Vendor picker shows its placeholder and a vendor's name whole, and the Alerts width test counts every block `/alerts` shows.

## Boundary

- Saved result, in the 280 px form column at 1280 and 1440 px with 20 px text: the before-and-after table's row labels and header break inside words ("Aver" "age" "cost", "Raw stoc" "k"), and the facts list above it splits a seven-figure cost ("$1,524,148.1" then "3"). The table's Before and After numbers stay whole, as spec 3a's AC-0033 requires.
- Receiving's result: the saved result starts right under the form only while the form is taller than the "Stock and prices" card, which lists every finished product made from the raw product. Six fit at every size measured. With ten, the result starts level with the card's bottom, 42 px below the form at 1024 px and 321 px at 1280 px with 20 px text; with eighteen, 402 px and 1,009 px. The owner accepted this for now on 2026-11-05, to revisit at the next change to Receiving.
- Waiting buttons: six buttons take the `disabled` attribute and fade by opacity while they wait, against the overview's rule that a waiting control stays focusable and fades only its colors: Receiving's Save button (`src/app/receiving/receipt-form.tsx`), its Void dialog's two buttons (`void-dialog.tsx`), its Correct dialog's button that closes it without saving (`correct-dialog.tsx`), the Reverse dialog's Cancel button (`src/app/production/reverse-control.tsx`), and Sign in (`src/app/sign-in/sign-in-form.tsx`). The owner chose on 2026-11-06 to fix them here, while spec 3b fixes the draft review's Save receipts and Discard draft.
- Vendor picker: on a draft's review, Product sits beside Vendor from 1178 px wide at the default text size and takes two thirds of the line. The closed Vendor picker is 167 px wide at 1178 px and 201 px at 1280 px. At 1178 px it cuts its own "Choose a vendor" by about 2 px and any vendor name over about 15 characters (a made-up "Heartland Wholesale Meats Inc" shows as "Heartland Whole"); at 1280 px it cuts names over about 18 characters. Under 1178 px the fields stack and the picker runs the line's full width. No test checks the Vendor picker's width.
- Alerts width test: `/alerts` shows three blocks in `<main>` (the title, Today's digest, and the alert lists), but its AC-0001 test in `test/e2e/look-menu-invoices-ask-alerts.spec.ts` calls `expectNoCap(page, 2)`, and the comment on `expectNoCap` in `test/e2e/look-checks.ts` says Menu and Alerts show two. Menu shows two.
- A probe on main at `a31fafc` measured the saved result, the stock tiles, and the sale trace on 2026-11-05; spec 3a's frontend reviews had listed them as not checked. A probe on main at `0da70e6` measured the Vendor picker and the Alerts blocks on 2026-11-06; spec 3b's reviews had listed them as not checked. The owner queued the first four items (stock tiles, sale trace, saved result, Receiving's result) at spec 3a's close-out on 2026-11-05 (PR #49), the waiting buttons while shaping spec 3b on 2026-11-06, and the Vendor picker and the Alerts width test at spec 3b's close-out on 2026-11-06 (PR #51).
- Spec 1a of the UI polish brief (`docs/specs/polish-tables-status/`, PR #58) closed the stock tiles and sale trace gaps on 2026-11-09, and spec 1b (`docs/specs/polish-forms-alerts/`, PR #62) closed the rest the same day: the saved result, Receiving's result, the waiting buttons, the Vendor picker, and the Alerts width test.
- What each screen does, and every figure, word, and control name, stays the same. Each layout keeps picking its look from its own section's width and the text size.

## Owner

- jaketlee07

## Unresolved questions

- Does the accepted Receiving limit stand, or should the saved result stay right under the form however long the stock card grows?

## Projection

- A small spec of its own.


## Source

- Mode: repo-origin
- Locator: docs/specs/look-production-sales-trace/notes/verification-ledger.md
- Revision: aadb360
- Authority: repo-origin
