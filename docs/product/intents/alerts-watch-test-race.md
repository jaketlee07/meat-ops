# Alerts browser test races the watch

- **Status:** Draft


## Outcome

The alerts browser test "AC-0003, AC-0118, AC-0120, AC-0122" in `test/e2e/alerts.spec.ts` passes every run, because the page's background watch can no longer open an alert between the test's reset steps.

## Boundary

- During the corrections build on stack A on 2026-10-18, the test failed with `duplicate key value violates unique constraint "alerts_one_live"` in its own reset query: the page's background watch inserted a new open alert between the test's price restore and its reopen.
- It failed 5 of 6 isolated runs while stack A's catalog held about 275,000 to 353,000 dead rows. Later that day, at normal load, it failed once in a full run, and the whole alerts file then passed 58 of 58.
- It first failed in the build's first task, before the branch changed the watch or that test file, so the race is on `main`.
- A fix changes only the test or its helpers, unless the owner approves a change to the watch (`refresh_alerts`, which takes the `meat-ops:refresh_alerts` advisory lock).

## Owner

- jaketlee07

## Unresolved questions

- Should the test hold the watch's advisory lock through its reset, or wait for the page's watch to finish first?

## Projection

- A direct-light test fix, proven by repeated isolated runs of the test and a full `npm test`.


## Source

- Mode: repo-origin
- Locator: docs/specs/corrections/notes/verification-ledger.md
- Revision: 3339c70
- Authority: repo-origin
