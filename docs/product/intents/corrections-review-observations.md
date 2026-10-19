# Corrections screens: observations review set aside

- **Status:** Draft


## Outcome

The owner has decided, for each of five observations on the Correct and Reverse screens, whether it needs a change, and any change ships with browser checks.

## Boundary

- The rendered-page inspection on 2026-10-18 (T9 in the corrections verification ledger) flagged three things for review, and no reviewer took them up. At 375 px, the correction dialog's title wraps in the middle of the lot number ("Correct receipt L-20261005-" and then the rest).
- At 375 px wide in an 800 px tall window, the reversal dialog's content is 823 px tall, so Reverse batch sits below the fold until the dialog scrolls. Shorter windows need more scrolling.
- The "Receipt corrected" and "Batch reversed" panels appear inside the list item, below the receipt's or batch's own rows. In a long list, a result can land far below the fold. Focus moves to the panel's message only when the action fails.
- Review round 3 (frontend) found no visible edge between a result panel and the next list item: on `/receiving`, the "Batches restated" table runs straight into the next receipt's "Lot number" facts with the same spacing. It was refuted because no spec line asks for an edge, and the "Receipt saved" panel has the same shape.
- Review round 3 (quality) found that `/production` reads a reversal preview at render for every listed batch that is not reversed (`getReversalPreview` in `src/app/production/page.tsx`, at least four requests each, up to 10 batches per product), and one failed preview read sends the whole page to the error view. It was refuted because no rule sets a request budget, and the ledger records the design under T8.
- Any change keeps the corrections spec's page-state checks (AC-0170 to AC-0182): 320 px reflow, 44 px targets, and focus outlines.

## Owner

- jaketlee07

## Unresolved questions

- Which of the three layout observations read as problems on the owner's phone?
- Should a failed preview read fail only that batch's Reverse confirmation, or should the preview load only when Reverse is pressed?

## Projection

- A direct-light change for any layout fix the owner picks, checked by the browser suite and a fresh rendered-page inspection. A small spec if the preview read moves to when Reverse is pressed, since that changes when the confirmation's figures are read.


## Source

- Mode: repo-origin
- Locator: docs/specs/corrections/notes/verification-ledger.md
- Revision: 747d3aa
- Authority: repo-origin
