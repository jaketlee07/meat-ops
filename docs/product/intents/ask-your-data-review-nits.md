# Ask your data review leftovers

- **Status:** Draft


## Outcome

The AC-0080 lookup test checks only counts it measures, and the owner has decided whether the space between Ask and its outcome stays.

## Boundary

- In `test/ask-actions.test.ts`, the test "AC-0080: a lookup whose read throws gives lookup-failed with the choice, logged as lookUpAnswer" swaps in a `readAnswer` that throws but does not count, then expects `calls` to equal `none`. One read did run, so that check passes whatever the code does. Review round 2 found it and set it aside, because the test was outside that round's changes.
- On `/ask`, the status line keeps two lines of space (`min-h-12`), and the message region stays empty until an outcome. Together they leave about 90 px between Ask and the outcome, and on load between Ask and "Questions Ask can answer". The rendered-page inspection on 2026-10-18 flagged it for review. No reviewer settled it, because the experience-reviewer agent is not installed.
- A spacing change keeps the status region in the page from load, so the in-flight text is still announced (AC-0012).

## Owner

- jaketlee07

## Unresolved questions

- Does the space under Ask read as a gap worth closing?

## Projection

- A direct-light change: count the read in the AC-0080 test and expect 1, plus either no layout change or a small one checked by the browser suite and a fresh rendered-page inspection.


## Source

- Mode: repo-origin
- Locator: docs/specs/ask-your-data/notes/verification-ledger.md
- Revision: 3e7209e
- Authority: repo-origin
