# Receiving test-tool refinements

- **Status:** Draft


## Outcome

Every receiving branch that a test claims to cover can fail when the branch breaks.

## Boundary

- Give the save action's decisions a test seam, so the 'saved, but totals could not be loaded' branch and the engine not-allowed refusal each have a test that fails when the branch changes.
- Through the same seam, a save or void whose write call gets no engine answer has a test that fails when the action labels that failure as an earlier call (the write-call clauses of receiving AC-0072 and AC-0083).
- Score the focus ring in test/e2e/a11y.ts as drawn, opacity included, or fail when it cannot; then the first-run Save ring reaches 3:1 or that test stops running the contrast check.

## Owner

- jaketlee07

## Unresolved questions

- Does the seam move the action's decisions into src/lib, or into a testable module under src/app?

## Projection

- A small spec through new-spec, or a direct-light change, once scheduled.


## Source

- Mode: repo-origin
- Locator: docs/specs/receiving/notes/verification-ledger.md
- Revision: 8b4eb5d
- Authority: repo-origin
