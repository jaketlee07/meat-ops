---
name: verify-costing
description: Run the golden costing suite and the full suite against the local Supabase stack, and report the seven golden invariants in docs/costing.md as a pass/fail table. Invoke after any risky change to a migration, a Postgres function, or src/lib/.
---

# Verify costing

Confirm the costing math still ties out to docs/costing.md.

Steps:
1. Read docs/costing.md so the expected numbers are in context.
2. Check the local stack is running with `supabase status`. If it is not, run
   `supabase start`. The suites reset their own master data and refuse any host
   except 127.0.0.1 or localhost, so no manual reset is needed.
3. Run `npm run test:costing` (the golden suite, test/costing.test.ts), then
   `npm test` (also test/engine.test.ts, test/corrections.test.ts,
   test/access.test.ts, and test/env.test.ts).
4. Report a table with one row per invariant (1 through 7): name, expected,
   actual, pass or fail.
5. If any invariant fails, stop and state clearly that costing is broken and
   which invariant regressed. Do not proceed with other work until it is green.

The seven invariants: moving average (the stock-on-hand average, 1.725 after the
two golden receipts), pricing tie-out (2.68), shrinkage yield (1540), lot cost
immutability (a database trigger), FIFO specific identification, conservation,
and traceability. Full detail and formulas, including the zero-stock rule and the
void and adjustment rules, are in docs/costing.md.
