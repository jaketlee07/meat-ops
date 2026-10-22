# Hosted project: load the business's real data

- **Status:** Draft


## Outcome

The hosted project holds the business's real catalog, the app reads it there, and no real business data enters git.

## Boundary

- Waits on the business owner. The developer does not have the real data yet, and this Mac has no `private/` folder. When the data arrives, it goes in the gitignored `private/` folder at the repository root until it is loaded (`AGENTS.md` hard rule 8).
- Waits on `hosted-hardening-check.md`, which must finish before any real data goes in.
- Every migration merged to `main` reaches the hosted project first, with the lag check and the re-checks in `docs/architecture/overview.md` "The hosted project".
- The app stays on the local stack until this work points `.env`'s `SUPABASE_URL` and `SUPABASE_ANON_KEY` at the hosted project.
- Each load is a hosted write and needs the developer's approval (`AGENTS.md` hard rule 7).
- The seed-data-privacy spec left when and how real data reaches the hosted project to the hosted rollout, which shipped without loading any; this intent now owns it.

## Owner

- jaketlee07

## Unresolved questions

- In what form does the business owner hand over the data?
- Is the data entered through the app's own pages or loaded by a one-time import?

## Projection

- A spec through new-spec once the data is in hand and the hardening check is done.


## Source

- Mode: repo-origin
- Locator: docs/specs/hosted-rollout/notes/verification-ledger.md
- Revision: 027d4a3
- Authority: repo-origin
