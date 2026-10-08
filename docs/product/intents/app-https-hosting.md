# Host the app over HTTPS

- **Status:** Draft


## Outcome

The owner logs receipts from a phone at the dock over an encrypted connection.

## Boundary

- Host the Next.js app so a phone reaches it over HTTPS, with every auth cookie marked Secure.
- Keep the app environment free of privileged variables, as the receiving spec's guard enforces.
- Revisit the shared sign-in rate limit, which the local-only scope accepted.
- Before the app is reachable from another machine, the hosted auth server ends a session after 12 hours without activity and 7 days after sign-in, the limits the receiving spec set locally.

## Owner

- jaketlee07

## Unresolved questions

- Where is the app hosted?
- Does app hosting ship with the hosted Supabase rollout or after it?
- Does the hosted Supabase plan support the session time limits?

## Projection

- A spec through new-spec once the owner schedules app hosting.


## Source

- Mode: repo-origin
- Locator: docs/specs/receiving/spec.md
- Revision: feat/receiving draft, 2026-10-08
- Authority: repo-origin
