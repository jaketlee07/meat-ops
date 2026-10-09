# Local stack reachable from the network

- **Status:** Draft


## Outcome

Only this machine can reach the local Supabase stack's API, database, Studio, and mail ports, or the owner has accepted the exposure on record.

## Boundary

- Docker publishes ports 54321 (API and auth), 54322 (Postgres), 54323 (Studio), and 54324 (mail) on every interface, and the macOS firewall is off (seen 2026-10-08 with `lsof` and `socketfilterfw`).
- A device on the same network can sign in to Postgres with the local stack's well-known password or open Studio, which has no login locally, and so read data or add itself to `private.operators`.
- The overview's sentences that no client can change the operator list and that only this machine reaches sign-in match whichever choice is made.

## Owner

- jaketlee07

## Unresolved questions

- Can the Supabase CLI publish its ports on 127.0.0.1 only, or does this need a Docker or macOS firewall setting?
- Does the local stack hold real business data today?

## Projection

- A small change through work-loop, or a recorded risk acceptance, once scheduled.


## Source

- Mode: repo-origin
- Locator: docs/specs/production/notes/verification-ledger.md
- Revision: 3be979d
- Authority: repo-origin
