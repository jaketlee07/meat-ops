# Hosted project: check what the rollout's security review could not reach

- **Status:** Draft


## Outcome

Before any real business data reaches the hosted project, the developer has read each hosted setting below, and each is either set safely or recorded as an accepted risk in `docs/architecture/overview.md` "The hosted project".

## Boundary

- Must finish before any real data goes in; `hosted-real-data-load.md` waits on it. It does not wait on the business owner.
- Storage and Realtime: what the anon key and a signed-in non-operator can reach there. The rollout's access check covered REST, RPC, and GraphQL only.
- Sign-in: whether phone, anonymous, and OAuth sign-in are off; the Site URL and the redirect allow list that emailed sign-in links follow; whether the built-in email sender delivers to addresses outside the Supabase team; CAPTCHA; and the auth rate limits.
- Network: whether SSL is enforced, whether a network restriction is set, and which schemas the hosted Data API exposes. The database accepts connections from the internet, a risk the developer accepted on 2026-10-21.
- People and tokens: who else is a member of the Supabase organization, and where the Supabase CLI keeps its access token on the developer's Mac, whether it expires, and what else can read it. Each is a way in to the data.
- Supabase's own security advisor for the project, read after the settings above.
- Each check is a read. Changing a setting is a hosted write and needs the developer's approval (`AGENTS.md` hard rule 7).

## Owner

- jaketlee07

## Unresolved questions

- Should the database accept connections only from known networks once real data is in?

## Projection

- A direct-light check before real data loads, with its results recorded in the overview.


## Source

- Mode: repo-origin
- Locator: docs/specs/hosted-rollout/spec.md
- Revision: 2656cef
- Authority: repo-origin
