# Host the app over HTTPS

- **Status:** Draft


## Outcome

The owner logs receipts and batches from a phone on the floor over an encrypted connection, and can install the app on that phone.

## Boundary

- Host the Next.js app so a phone reaches it over HTTPS, with every auth cookie marked Secure.
- Keep the app environment free of privileged variables, as the receiving spec's guard enforces.
- Revisit the shared sign-in rate limit, which the local-only scope accepted.
- Make the app installable on a phone (a web app manifest), as `SYSTEM-SPEC.md` §8 asks; installing needs HTTPS, and the offline queue stays roadmap (§9).
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
- Revision: 683782e
- Authority: repo-origin
