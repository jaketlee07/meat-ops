# UI polish leftovers: Recent receipts' vendor column, Menu's card price, the switch test, the phone saved result, Choose photo while reading, Ask's status space, Today's long lists, Try again, and a repeated check, and an overtaken focus move

- **Status:** Draft


## Outcome

Recent receipts keeps every vendor word whole and each lot number right under its date at every width where it reads as a table, Menu's product cards read as light as its table, and the Menu switch test fails for any knob drawn past the track's edge, whatever moves it. On a phone the saved result under each floor form keeps short values on one line, the photo picker's status never names a file other than the one being read, and the owner decides whether Ask keeps its empty status space.

## Boundary

- Narrow Vendor column: at 1280 px, Recent receipts' Vendor column is about 71 px wide and holds a ten-letter word. With 33 px of the window taken (a 17 px scrollbar and 16 px to spare, a case look E's test still keeps as a table), it is about 38 px, so a word such as "Wholesale" breaks inside itself. The table still switches on at 40.5rem (`receipt-table` in `src/app/globals.css`). Spec 1a's round 1 review raised this, and its adjudication refuted it only because no spec rule covers it.
- Three-line vendor: the vendor cell spans the date's line and the lot number's line, so a vendor that wraps to two lines leaves the lot number right under its date (spec 1a's test uses "Reyes Meats"). A vendor that wraps to three or more lines is taller than both lines, and spec 1a's T6 implementer reported that it still leaves a small gap. No one has measured it.
- Menu card price: below Menu's `menu-table` width (42rem), each product is a card whose list price is `text-xl font-bold`. From 42rem, the table shows it at `font-medium` (`src/app/menu/menu-list.tsx`). Spec 1a lightened only the table, since its AC-0013 is checked at 1280 px.
- Switch test: in `test/e2e/look-polish-tables.spec.ts`, the switch check reads the knob's top from its `top` and `margin-top` only, while its left also counts translate and transform. So a knob pushed past the track's bottom by a vertical translate passes, and a centred knob drawn with `top-1/2 -translate-y-1/2` reads as 20 px down and fails. Today's knob is centred with top and bottom 0 and auto margins, which the check reads correctly.
- Phone saved result (spec 1b): on a 390 px phone the saved result's card is about 21rem, just above `result-stack`'s 20rem in `src/app/globals.css`, so it keeps the three-column before-and-after table, which wraps short values ("No / price / yet" on each of Receiving's 18 finished-product rows; "1,242,568.891 / lbs" on Production). Spec 1b's round 1 frontend review raised it; its adjudication refuted it only because AC-0016 names 1024, 1280, and 1440 px.
- Choose photo while reading (spec 1b): on `/invoices`, "Choose photo" still opens the file chooser while a photo read is in flight, and `#photo-status` then names the newly chosen file while the reading message refers to the earlier one. Spec 1b's AC-0010 requires the button to open the chooser, so a fix decides what it does mid-read.
- Ask's status space (spec 1b): Ask's question card keeps a two-line status space under its Ask button (`src/app/ask/ask-panel.tsx`) for "Looking it up", which shows as empty space at rest.
- Test sightings (spec 1b's build, 2026-11-09, stack A): `test/e2e/look-floor-pages.spec.ts` "AC-0007: at 1280x720 a reverse refusal spans its batch's row below the figures" timed out once at 30 s on the Reverse dialog's "Reverse batch" button ("element is not stable", then detached) in a full run, and "AC-0006: at 1024x768 with 16 px text each batch stays a card, ..." failed once ("label 0 on its value's first line": 10 against 4) in another; each passed alone (`docs/specs/polish-forms-alerts/notes/verification-ledger.md`).
- Today's long lists (spec 2a): `src/lib/home.ts` reads today's receipts, batches, and sales with an exact count but no paging, so on a day with more than 1,000 of one kind the list stops at the database's 1,000-row cap (`max_rows`) while its heading still shows the full count.
- Try again on Today (spec 2a): `test/e2e/home.spec.ts` checks that a refused read shows "Today"'s error view (AC-0035) but never presses "Try again" to see the page come back once the read works.
- Repeated check (spec 2a): `test/e2e/home.spec.ts:191`, in the test of an open alert that is not urgent, counts the Open alerts list a second time instead of naming the alert it shows.
- Overtaken focus move (spec 2b): in `ListEnd` (`src/app/list-search.tsx`), a press of "Show 10 more" or "Clear search" arms a focus move keyed on the address it opens. If a Back, or a Search with both boxes emptied, lands first on that same address, the move still runs, focusing the first added row or the Search box. It needs a second navigation started before the press's page lands (spec 2b's post-gates round 4, frontend finding 1, deferred by the owner).
- The owner queued spec 1a's four at its close-out on 2026-11-09, spec 1b's three and the test sightings at its close-out the same day, spec 2a's three at its close-out on 2026-11-10, and spec 2b's one at its close-out on 2026-11-11. Spec 1a is shipped, so under the UI polish brief's Boundary-change rule these gaps stay out of that intent's Boundary, and the same holds for spec 1b's.
- What each screen does, and every figure, word, and control name, stays the same. Each layout keeps picking its look from its own section's width and the text size.

## Owner

- jaketlee07

## Unresolved questions

- Should the Vendor column hold a ten-letter word with 33 px taken at 1280 px, by moving the receipt table's switch point or narrowing another column, or is a broken word there an accepted limit?
- Should Menu's card price drop to medium weight like the table's, or keep its weight because the price is the card's main figure?
- Should "Choose photo" wait while a photo read is in flight, or stay live and leave the status naming the file a next read would send?
- Should Ask keep its reserved status space, so nothing moves when "Looking it up" appears, or drop it as the read cards did?

## Projection

- A small spec of its own, with the switch test fix riding along; the test sightings join an existing flake intent if a repeat shows a shared cause.


## Source

- Mode: repo-origin
- Locator: docs/specs/polish-tables-status/notes/verification-ledger.md
- Revision: 87e8f26
- Authority: repo-origin
