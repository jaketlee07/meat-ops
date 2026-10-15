# Invoice reading test gaps

- **Status:** Draft


## Outcome

The invoice browser tests pin two failure paths on every run: a model answer that never starts, and a draft photo that fails to load.

## Boundary

- The AC-0057 test in `test/e2e/invoices.spec.ts` ("each model failure logs its own kind") drives no answer that waits past the 120-second limit, so no automated test shows the no-answer message for a timeout. A recorded run on 2026-10-13 showed it once, after 120,092 ms, with the log line `readInvoice failed: kind=no-answer`. Two rules stand in the way of a fast test: nothing may shorten the production 120-second limit, and only `src/app/_server/model.ts` may read `ANTHROPIC_*` variables.
- The test "a photo that cannot be loaded is replaced by a message to reload, and the lines stay" blocks the photo from the start. So each run checks whichever handler runs first, the on-mount check or `onError`, depending on when the page's script takes over. Neither path is pinned on every run. The page shows the same message either way.

## Owner

- jaketlee07

## Unresolved questions

- Whether a test-only way to shorten the wait is worth its cost under the two rules above, or whether the recorded run stays the proof for the timeout case.

## Projection

- A direct-light test change: one photo case that fails before the page's script takes over and one that fails after, plus either a test seam for the timeout or a comment that the recorded run covers it.


## Source

- Mode: repo-origin
- Locator: docs/specs/invoice-entry/notes/verification-ledger.md
- Revision: 00c3069
- Authority: repo-origin
