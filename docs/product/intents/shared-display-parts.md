# Shared display parts for Receiving and Production

- **Status:** Draft


## Outcome

`Facts`, the `stock-view` helpers, and `BeforeAfter` live in one shared home that Receiving and Production both import, and no file under `src/app/production/` imports from `src/app/receiving/`.

## Boundary

- Move `Facts` (`src/app/receiving/facts.tsx`), `stock-view` (`src/app/receiving/stock-view.ts`), and `BeforeAfter` (exported from `src/app/receiving/result-panel.tsx`).
- Six Production files import them from `../receiving/` today: `check-step.tsx`, `product-region.tsx`, `recent-batches.tsx`, `result-panel.tsx`, `result-view.ts`, and `save-batch.ts`.
- A move only: what both pages show stays the same, and `npm test` stays green, golden costing suite included.
- Ship it as its own change, not folded into feature work.

## Owner

- jaketlee07

## Unresolved questions

- Where does the shared home live: a folder such as `src/app/_shared/`, or beside `page-header.tsx` in `src/app/`?
- Does `stock-view.ts` move whole, or only the parts Production uses (`stockView`, `showAverage`, `showOnHand`), leaving Receiving's price helpers in place?

## Projection

- A small refactor through work-loop, once scheduled.


## Source

- Mode: repo-origin
- Locator: docs/specs/production/notes/verification-ledger.md
- Revision: 3be979d
- Authority: repo-origin
