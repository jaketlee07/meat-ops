---
name: verify-costing
description: Reset the seed, run the costing functions, and assert the seven golden invariants in docs/costing.md. Reports a pass/fail table. Invoke after any risky change to the schema, a Postgres function, or the data layer.
---

# Verify costing

Confirm the costing math still ties out to docs/costing.md.

Steps:
1. Read docs/costing.md so the expected numbers are in context.
2. Reset the test database to the seed state (npm run db:reset:test, or apply
   supabase/seed.sql to the test database).
3. Run `npm run test:costing`.
4. Report a table with one row per invariant (1 through 7): name, expected,
   actual, pass or fail.
5. If any invariant fails, stop and state clearly that costing is broken and
   which invariant regressed. Do not proceed with other work until it is green.

The seven invariants: moving average (1.725), pricing tie-out (2.68), shrinkage
yield (1540), lot cost immutability, FIFO specific identification, conservation,
and traceability. Full detail and formulas are in docs/costing.md.
