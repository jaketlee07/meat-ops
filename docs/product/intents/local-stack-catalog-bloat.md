# Local stack: catalog bloat from the Realtime slot

- **Status:** Draft


## Outcome

A full `npm test` run on stack A leaves no catalog bloat that needs a by-hand fix, so run time and the Vitest time limits hold run over run; or the owner records the by-hand fix as the accepted remedy.

## Boundary

- Stack A's Realtime replication slot (`cainophile_*`) holds `catalog_xmin` back, so the dead `pg_class` rows from each test run's truncates are never vacuumed. On 2026-10-20 there were 261k dead rows after two full runs and 453k after five, and later each full run added about 100k, with the slot about 10k transactions behind.
- Symptoms on 2026-10-20: a full run took 16 to 24 minutes instead of about 11; `test/invoice-data.test.ts` AC-0031 timed out at 5000 ms on three runs in a row; and one `test/e2e/receiving.spec.ts:315` run failed axe's `document-title` check, which did not recur in five later runs. On 2026-10-18 the same bloat showed as an alerts deadlock.
- Sightings on 2026-10-29, in the app-hosting build: `pg_class` held 457,791 dead rows, with the slot 48,270 transactions behind. In one full run `test/e2e/invoices.spec.ts` AC-0075 timed out at 30 s, and it passed 3 of 3 alone. In the next, `test/invoice-data.test.ts` AC-0031 timed out at 5000 ms, with Vitest taking 403 s instead of about 52. Every later full run, after the by-hand fix below, passed in about 10 minutes.
- Sighting on 2026-11-09, in the polish-tables-status build: `test/e2e/invoices.spec.ts` AC-0075 timed out at 30 s in a full run at `ff66c6f`, with Playwright taking 16.7 min, and it passed alone on its rerun. The by-hand fix ran just before that run (139,743 dead `pg_class` rows to 0), and another project's tests were running on this Mac at the same time (`docs/specs/polish-tables-status/notes/verification-ledger.md`).
- Today's remedy is by hand, with the owner's approval: end the slot's backend as `supabase_admin` (Realtime recreates the slot at once), then vacuum the catalog tables. Stack B runs with Realtime turned off (`supabase/stack-b.env`).

## Owner

- jaketlee07

## Unresolved questions

- Does anything on stack A use Realtime, or can it run with Realtime off as stack B does?
- If Realtime stays on, should the suite's global setup report the dead-row count so a slow run names its cause?

## Projection

- A direct-light config change if Realtime can be off on stack A, checked by two full runs with no dead-row growth; otherwise a small spec.


## Source

- Mode: repo-origin
- Locator: docs/specs/receiving-refinements/notes/verification-ledger.md
- Revision: 2ce27e2
- Authority: repo-origin
