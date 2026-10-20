# Ask key-scan browser test can time out

- **Status:** Draft


## Outcome

The Ask browser test "AC-0067: no response in the page states reached carries the key, and no static file does" in `test/e2e/ask.spec.ts` passes every run, so a failure there points at a leaked key, not a stalled step.

## Boundary

- On stack B on 2026-10-18, in the full `E2E_PORT=3200 npm test` run after `main` was merged into the zero-stock-average spec branch, the test failed with `Test timeout of 30000ms exceeded`, and 608 other browser tests passed. Run alone afterwards, it passed 3 of 3, each in under 1 second. It passed in all 7 later full runs of the zero-stock-average build.
- The test keeps every response body as a `response.body()` promise and waits for all of them with `Promise.all` after its last `page.goto("/ask")`. The error names only the timeout, so which step stalled is not known.
- The test guards ask-your-data AC-0067: the API key is in no response the browser receives and in no file under `.next/static`. A fix keeps both checks and changes only the test or its helpers.

## Owner

- jaketlee07

## Unresolved questions

- Which step stalls: a response body that never settles, or a page step that waits on the fake model service?

## Projection

- A direct-light test fix, proven by repeated isolated runs of the test and a full `npm test`.


## Source

- Mode: repo-origin
- Locator: docs/specs/zero-stock-average/notes/verification-ledger.md
- Revision: 1404481
- Authority: repo-origin
