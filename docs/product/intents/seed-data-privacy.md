# Seed data privacy

- **Status:** Draft


## Outcome

Real business names, prices, and customers never become public through this repository.

## Boundary

- Decide whether supabase/seed.sql and test/db.ts hold real business data.
- Keep the real catalog out of git, or make the repository private.
- Tests and the demo seed use clearly synthetic data.

## Owner

- jaketlee07

## Unresolved questions

- Are the seeded vendor, customer, brand, and fee figures real?
- Private repository, or a gitignored private seed loaded separately?

## Projection

- An owner decision, then a small spec or direct change before the real catalog is loaded.


## Source

- Mode: repo-origin
- Locator: docs/specs/foundation-hardening/spec.md
- Revision: adcb0a0
- Authority: repo-origin
