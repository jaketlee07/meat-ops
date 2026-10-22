# Hosted project: the business owner's account at hand-over

- **Status:** Draft


## Outcome

The business owner signs in to the hosted project with an account they made, its id is in `private.operators`, and the re-checks in `docs/architecture/overview.md` "The hosted project" pass afterward.

## Boundary

- Waits on the business owner. The developer does not have their login: at hand-over the business owner chooses their own email and types their own password of at least 12 characters, so no one else knows it.
- Follow `docs/architecture/overview.md` "Create the owner account" against the hosted project. The account must be new, never signed in, and hold 0 sessions before its id goes into `private.operators`. Adding the user and inserting the id are hosted writes, and each needs the developer's approval (`AGENTS.md` hard rule 7).
- After the insert, the re-checks in "The hosted project" run, as the hosted-rollout ledger's "Facts for close-work" names them.
- The account id, email, and password stay out of every tracked file, commit message, and pull request, and the agent never sees the password.

## Owner

- jaketlee07

## Unresolved questions

- When is hand-over?
- Does the business owner's login need MFA? The developer's account has none, a risk the developer accepted on 2026-10-21.

## Projection

- A direct-light change at hand-over, with the developer approving each hosted write.


## Source

- Mode: repo-origin
- Locator: docs/specs/hosted-rollout/notes/verification-ledger.md
- Revision: 027d4a3
- Authority: repo-origin
