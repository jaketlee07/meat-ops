# App hosting: a false pass the AC-0014 test cannot rule out

- **Status:** Draft


## Outcome

The AC-0014 test in `test/e2e/hosting.spec.ts` fails whenever a sign-in with a foreign `Origin` is not refused by the app, even when the auth server's sign-in limit also refuses it.

## Boundary

- The test replays a captured sign-in with the `Origin` `https://rebind.example` and then `https://sub.meat-ops.example`, and checks only that the operator's session count did not change. It discards each replay's reply, so a sign-in refused by the auth server's limit (30 per 5 minutes, charged to the app's address) looks the same as one the app refused.
- The control replay just before them adds one sign-in. If it used the last sign-in the limit allows, and the app's `Origin` refusal had also stopped working, both foreign replays would be refused by the limit and the test would still pass.
- While the `Origin` refusal works, the test passes for the right reason, so the gap can only hide a future regression. The post-gates security review named it on 2026-11-01, and the app-hosting ledger records it.
- Every sign-in a test adds counts against the same limit; the app-hosting build already added four to the suite.

## Owner

- jaketlee07

## Unresolved questions

- What in a replay's reply tells the app's refusal apart from the sign-in limit's?

## Projection

- A direct-light change to `test/e2e/hosting.spec.ts`, proved by a run that fails with the app's `Origin` refusal turned off.


## Source

- Mode: repo-origin
- Locator: docs/specs/app-hosting/notes/verification-ledger.md
- Revision: 813a8e6
- Authority: repo-origin
