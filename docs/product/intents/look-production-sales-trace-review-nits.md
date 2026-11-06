# Look E spec 3a leftovers: figures and labels that fit their space, and Receiving's result under a tall stock card

- **Status:** Draft


## Outcome

On Production, Receiving, Sales, and Trace every figure stays whole and every label sits near its value at any screen width and text size, and the owner decides whether Receiving's saved result must stay near its form when the raw product has many finished products. Every waiting button outside spec 3b's four pages stays focusable and fades only its colors, as the overview's rule says.

## Boundary

- Stock tiles: at 1024 px with 20 px text, Raw on hand and Average cost on `/production` and `/receiving` split inside the number with ordinary five-digit stock ("12,345." then "678 lbs"; "$1.7520" then "/lb"); on `/receiving` also at 1280 px with 20 px text, and with seven-digit stock on a 390 px phone with 20 px text. No value runs past its tile, and at the default text size a five-digit value stays on one line.
- Sale trace: on a desktop the sale's card runs the full content width, so each label sits at its left edge and its value at its right, about 650 to 850 px apart at 1280 px and 1,300 to 1,500 px apart at 1920 px. The batch cards and raw lot blocks below it spread the same way.
- Saved result, in the 280 px form column at 1280 and 1440 px with 20 px text: the before-and-after table's row labels and header break inside words ("Aver" "age" "cost", "Raw stoc" "k"), and the facts list above it splits a seven-figure cost ("$1,524,148.1" then "3"). The table's Before and After numbers stay whole, as spec 3a's AC-0033 requires.
- Receiving's result: the saved result starts right under the form only while the form is taller than the "Stock and prices" card, which lists every finished product made from the raw product. Six fit at every size measured. With ten, the result starts level with the card's bottom, 42 px below the form at 1024 px and 321 px at 1280 px with 20 px text; with eighteen, 402 px and 1,009 px. The owner accepted this for now on 2026-11-05, to revisit at the next change to Receiving.
- Waiting buttons: six buttons take the `disabled` attribute and fade by opacity while they wait, against the overview's rule that a waiting control stays focusable and fades only its colors: Receiving's Save button (`src/app/receiving/receipt-form.tsx`), its Void dialog's two buttons (`void-dialog.tsx`), its Correct dialog's button that closes it without saving (`correct-dialog.tsx`), the Reverse dialog's Cancel button (`src/app/production/reverse-control.tsx`), and Sign in (`src/app/sign-in/sign-in-form.tsx`). The owner chose on 2026-11-06 to fix them here, while spec 3b fixes the draft review's Save receipts and Discard draft.
- A probe on main at `a31fafc` measured the first three on 2026-11-05; spec 3a's frontend reviews had listed them as not checked. The owner queued the first four items (stock tiles, sale trace, saved result, Receiving's result) at spec 3a's close-out on 2026-11-05 (PR #49), and the waiting buttons while shaping spec 3b on 2026-11-06.
- What each screen does, and every figure, word, and control name, stays the same. Each layout keeps picking its look from its own section's width and the text size.

## Owner

- jaketlee07

## Unresolved questions

- Does the accepted Receiving limit stand, or should the saved result stay right under the form however long the stock card grows?
- On a desktop, should the sale trace's cards be capped in width, lay their facts out in columns as a lot's card does, or sit side by side?

## Projection

- A small spec of its own after spec 3b of `docs/product/briefs/ui-redesign.md`, or folded into spec 3b where that spec changes the shared parts (`Facts`, its tiles look, `BeforeAfter`) anyway.


## Source

- Mode: repo-origin
- Locator: docs/specs/look-production-sales-trace/notes/verification-ledger.md
- Revision: aadb360
- Authority: repo-origin
