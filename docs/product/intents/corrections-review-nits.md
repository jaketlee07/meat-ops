# Corrections review leftovers

- **Status:** Draft


## Outcome

A Correct press on `/receiving` right after a correction is saved opens with the receipt's corrected cost and weight, and a test fails if the dialog's "result not handled yet" flag is never cleared.

## Boundary

- After a successful correction, `CorrectDialog` clears `sentRef` as soon as the action returns, but the receipt list's revalidated `costText` and `weightText` commit later, with the router's transition. A press on Correct between those two commits opens the dialog with the cost and weight from before the correction, and saving them with a reason would correct the receipt back. The window is at most the time between two commits, and it was found by reading the installed Next 16.4.0 and React 19.3.0 sources, not reproduced. Review round 6 (2026-10-19) sustained it twice as a nit (adversarial and frontend), and the owner deferred it.
- A fix must open with the corrected cost (4 decimals), the corrected weight (3 decimals), and an empty reason in that window, keep the sent values for a press while the save still waits (the round 3 and round 4 tests in `test/e2e/correct.spec.ts`), and keep the reset after a refusal.
- No test presses Correct again after a sent correction's result is handled, so deleting either `sentRef.current = false` in `src/app/receiving/correct-dialog.tsx` leaves the suite green. Add one press after a returned result and one after a thrown one (for example a dropped connection), each expecting the current cost and weight and an empty reason. Review round 6 sustained it as a nit (quality), and the owner deferred it.
- Rounds 3 to 6 each found a new edge in this dialog's pending handling, so design the fix as one state model for "sent, waiting, result handled, list refreshed" before writing code.

## Owner

- jaketlee07

## Unresolved questions

- Should the reopened dialog take its figures from the corrected result, or wait for the refreshed list before it opens?

## Projection

- A small spec through new-spec, since it changes how a shipped dialog behaves and needs browser tests.


## Source

- Mode: repo-origin
- Locator: docs/specs/corrections/notes/verification-ledger.md
- Revision: 6a7c855
- Authority: repo-origin
