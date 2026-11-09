# UI polish spec 1a leftovers: Recent receipts' vendor column, Menu's card price, and the switch test

- **Status:** Draft


## Outcome

Recent receipts keeps every vendor word whole and each lot number right under its date at every width where it reads as a table, Menu's product cards read as light as its table, and the Menu switch test fails for any knob drawn past the track's edge, whatever moves it.

## Boundary

- Narrow Vendor column: at 1280 px, Recent receipts' Vendor column is about 71 px wide and holds a ten-letter word. With 33 px of the window taken (a 17 px scrollbar and 16 px to spare, a case look E's test still keeps as a table), it is about 38 px, so a word such as "Wholesale" breaks inside itself. The table still switches on at 40.5rem (`receipt-table` in `src/app/globals.css`). Spec 1a's round 1 review raised this, and its adjudication refuted it only because no spec rule covers it.
- Three-line vendor: the vendor cell spans the date's line and the lot number's line, so a vendor that wraps to two lines leaves the lot number right under its date (spec 1a's test uses "Reyes Meats"). A vendor that wraps to three or more lines is taller than both lines, and spec 1a's T6 implementer reported that it still leaves a small gap. No one has measured it.
- Menu card price: below Menu's `menu-table` width (42rem), each product is a card whose list price is `text-xl font-bold`. From 42rem, the table shows it at `font-medium` (`src/app/menu/menu-list.tsx`). Spec 1a lightened only the table, since its AC-0013 is checked at 1280 px.
- Switch test: in `test/e2e/look-polish-tables.spec.ts`, the switch check reads the knob's top from its `top` and `margin-top` only, while its left also counts translate and transform. So a knob pushed past the track's bottom by a vertical translate passes, and a centred knob drawn with `top-1/2 -translate-y-1/2` reads as 20 px down and fails. Today's knob is centred with top and bottom 0 and auto margins, which the check reads correctly.
- The owner queued all four at spec 1a's close-out on 2026-11-09. Spec 1a is shipped, so under the UI polish brief's Boundary-change rule these gaps stay out of that intent's Boundary.
- What each screen does, and every figure, word, and control name, stays the same. Each layout keeps picking its look from its own section's width and the text size.

## Owner

- jaketlee07

## Unresolved questions

- Should the Vendor column hold a ten-letter word with 33 px taken at 1280 px, by moving the receipt table's switch point or narrowing another column, or is a broken word there an accepted limit?
- Should Menu's card price drop to medium weight like the table's, or keep its weight because the price is the card's main figure?

## Projection

- A small spec of its own, with the switch test fix riding along.


## Source

- Mode: repo-origin
- Locator: docs/specs/polish-tables-status/notes/verification-ledger.md
- Revision: 87e8f26
- Authority: repo-origin
