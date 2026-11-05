# Look E spec 2 leftovers: layouts that fit their space, and four code tidy-ups

- **Status:** Draft


## Outcome

Pricing and Receiving lay out to the space and text size they actually have: between 1024 and 1279 px the Pricing cards keep each label near its value, and the receipts table gives the Vendor column room for whole words with room to spare for an always-visible scrollbar. Four small code tidy-ups land with it. The owner's words on 2026-11-05: "ensure everything is dynamic".

## Boundary

- Between 1024 and 1279 px, `/pricing` shows its cards across the full content width (728 to 983 px), so a label can sit far from its value; beside the details panel the same cards are 352 to 607 px wide.
- At 1280 px and the default text size the receipts table's Vendor column is about 54 px wide, so a vendor word of eight or more letters breaks inside the word; with an always-visible scrollbar the Recent receipts section clears the `receipt-table` threshold (38rem, in `src/app/globals.css`) by only 1 to 3 px.
- `/pricing?product=<code>` waits for `getPricingDetail` before it starts `listPricing`; the two reads can run together.
- The `detail(page).main` helper in `test/e2e/pricing-page.ts` returns the "Product details" region, not `<main>`; the comment above `VALUE_CLASS` in `src/app/facts.tsx` says "below the table" where it means "where the section is not a table"; the "In use" pill in `src/app/receiving/recent-receipts.tsx` uses the card-border token as its fill.
- Spec 2's review set these aside (PR #47); the owner queued all of them at its close-out on 2026-11-05.
- The owner settled "dynamic" on 2026-11-05: every table or card layout picks its look from the room its own section has (its width and the text size), not the screen width alone, on Pricing and Receiving and on every page spec 3 builds.
- What each screen does, and every word and control name, stays the same. At the default text size Recent receipts still read as a table from 1280 px, and with a 20 px text size they stay cards at 1280 and 1440 px with every Void and Correct inside the section.

## Owner

- jaketlee07

## Unresolved questions

- Between 1024 and 1279 px, should the Pricing cards be capped in width, sit two to a row, or switch to the table look when the list has room?

## Projection

- Built in spec 3a (`look-production-sales-trace`) of `docs/product/briefs/ui-redesign.md`, by the owner's choice on 2026-11-05.


## Source

- Mode: repo-origin
- Locator: docs/specs/look-pricing-receiving/notes/verification-ledger.md
- Revision: 706bf95
- Authority: repo-origin
