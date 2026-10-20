# A revoked session's unexpired access token

- **Status:** Draft


## Outcome

A write sent after the owner's session is revoked at the auth server is always refused, as receiving AC-0043 and AC-0057 say, and the test that claims it never passes by chance.

## Boundary

- On 2026-10-18, one full `npm test` run on `feat/corrections` failed `test/e2e/receiving.spec.ts` "AC-0043 and AC-0057: an expired access token refreshes and voids, and a revoked session is refused": after the logout returned 204, the second void was written ("Void: wrong price"), although the app logged two refused refreshes (`refresh_token_not_found`). The same test passed 30 of 30 repeats alone and in every other full run that day. That branch changes neither `src/proxy.ts`, `src/app/_server/caller.ts`, nor `voidReceipt`.
- Likely cause, not yet proven: `checkCaller` verifies the access token locally with `getClaims`, which cannot see a revoked session until the token expires, and the browser may have held the refreshed, unexpired session cookie beside the test's aged one. Prove or rule out each part before changing code.
- The alerts build on stack B saw the same class twice on 2026-10-16, each passing on the rerun: `receiving.spec.ts` "AC-0042 and AC-0046: an expired access token refreshes and saves, and a revoked session keeps the form" failed once in a full run, and the void test above failed once in a partial run. So the save path needs the same proof as the void path.
- Decide whether writes need a server-side session check (for example `getUser`) or a shorter access token lifetime, and make the test fail when a revoked session's write succeeds.

## Owner

- jaketlee07

## Unresolved questions

- Is a revoked session's token accepted until it expires an accepted limit, or must every write check the session at the auth server?

## Projection

- A small spec through new-spec once scheduled; it touches the access model, so full mode.


## Source

- Mode: repo-origin
- Locator: docs/specs/corrections/notes/verification-ledger.md
- Revision: a12256f
- Authority: repo-origin
