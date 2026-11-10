# Estimated row counts for signed-in non-operators

- **Status:** Draft


## Outcome

A signed-in user who is not on the operator allowlist learns nothing about how many rows any table or view holds: an exact, planned, or estimated count gives 0 or is refused, as their row reads already do.

## Boundary

- PostgREST can answer a count from the query planner's statistics (`Prefer: count=planned` or `count=estimated`) instead of from the rows row-level security lets the caller see. A signed-in non-operator could then read a rough row count for `lots`, `products`, `sales`, and every other table under row-level security, though each of their row reads gives 0 rows.
- Spec 2a's security reviewer listed it on 2026-11-10 as not checked and older than that spec; no one has probed it. The three views spec 2a added read the same tables and add no new source of estimates.
- The Access model in `docs/architecture/overview.md` (a non-operator reads 0 rows from every table and view) stays; this extends it to counts. `test/access.test.ts` reads every relation as `anon`, a non-operator, and an operator, and a count check would join it there.
- The owner queued it at spec 2a's close-out on 2026-11-10.

## Owner

- jaketlee07

## Unresolved questions

- Does a planned or estimated count for a non-operator actually return more than 0 on the local stack and on the hosted project?
- Is the fix a PostgREST or Supabase setting, a change to what the caller's role can read of the planner's statistics, or an accepted limit recorded in the Access model?

## Projection

- A small security spec: probe the three count modes as anon, a non-operator, and an operator on stack A, then close the gap with a check in test/access.test.ts.


## Source

- Mode: repo-origin
- Locator: docs/specs/home-screen/notes/verification-ledger.md
- Revision: c72a00e
- Authority: repo-origin
