# Receiving refinements: two review nits deferred at build

- **Status:** Draft


## Outcome

A browser test runs the page-state checks while a red-faded control is focused and `aria-disabled`, and the receiving-refinements ledger states Playwright's route release only for the case it observed; or the owner records either as accepted.

## Boundary

- The red fade `aria-disabled:bg-error/60` (Void sale in `src/app/sales/void-dialog.tsx`, Reverse batch in `src/app/production/reverse-control.tsx`) is never scored by the drawn-ring check while faded and focused, and neither is any faded control inside a dialog. The held-void test near line 1205 of `test/e2e/sales.spec.ts` has Void sale focused and `aria-disabled` but does not call `checkPageState`. Frontend review round 1 deferred it because the receiving-refinements spec's AC-0011 names its seven states; the AC-0010 counts and pairing check covered the class when that build shipped.
- The ledger's T4 run-2 section says that in Playwright 1.64 `page.unroute` continues any request its route still holds. That holds when `page.unroute` removes the page's only route, as the T4 script did; with another route left, the held request stays held. Adversarial review round 3 deferred it after two earlier wording rounds on the same line.

## Owner

- jaketlee07

## Unresolved questions

- Should the held-dialog tests run the full page-state checks, or only the ring check on the faded button?

## Projection

- A direct-light change: a `checkPageState` call in each held-dialog test, checked by the browser suite, and a one-line ledger correction.


## Source

- Mode: repo-origin
- Locator: docs/specs/receiving-refinements/notes/verification-ledger.md
- Revision: 9f75450
- Authority: repo-origin
