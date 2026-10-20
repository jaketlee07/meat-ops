# Spec: zero-stock-average

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the intent [`docs/product/intents/zero-stock-average-recompute.md`](../../product/intents/zero-stock-average-recompute.md) (its Outcome, as the corrections spec widens it, and its Boundary); the corrections spec [`../corrections/spec.md`](../corrections/spec.md) (its definitions and its operations `correct_receipt` and `reverse_batch`), which reaches `main` before this build starts; [`docs/costing.md`](../../costing.md) (the stock-on-hand average, the zero-stock rule, the seven invariants, the Rounding note); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §4, §5, §6, and §11; foundation-hardening AC-0029 and AC-0053 ([`../foundation-hardening/spec.md`](../foundation-hardening/spec.md)); `AGENTS.md` "Run two folders' tests at once"
- **Brief:** none
- **Discovery:** none
- **Contract:** none (database functions and columns consumed only by this app; no published interface)
- **Shape:** data

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory: it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

This spec delivers the outcome and boundary of the
[zero-stock average intent](../../product/intents/zero-stock-average-recompute.md).

When a raw product has 0 lbs on hand, its average is the average cost of the
lbs taken by the last production batch or adjustment that lowered the
product's stock:

- A void receipt and a reversed batch never count.
- Each lb is priced at its lot's current cost.
- The order in which receipts are voided or corrected never changes it.

After voids alone, that is the average the product would have if the voided
receipts had never been entered. A reversal or a weight correction does not
re-run the draws of the batches made after it.

One rule sets the average after every operation that leaves 0 lbs on hand. A
batch or an adjustment that leaves 0 lbs gives the average the product had just
before it, as it always has. A void or a correction that leaves 0 lbs gives the
recomputed average.

To find the last change, each production batch and each adjustment carries an
order number from one sequence, taken while the operation holds the raw
product's stock row. Two changes in one transaction, or two saves at the same
moment, keep the order in which they ran. Rows that exist before the numbers
are added are numbered by the time they were made, with ties broken by a fixed
rule that the architecture overview gives. The migration then refreshes every
raw product's balance, so a balance already at 0 lbs holds its zero-stock
average from the start.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Costing truth | Applicable: the zero-stock rule, the `void_receipt` section, and the `correct_receipt` section's zero-stock sentence change, and the known limit ends | `docs/costing.md` | jaketlee07 | The zero-stock rule states the recompute and its order numbers. The `void_receipt` section has no three steps, no prior-average rule, and no known limit, and its examples give the averages of AC-0002 to AC-0007. The `correct_receipt` section's zero-stock sentence points at the zero-stock rule | close-work finds each statement, and each figure the sections state as an expected result is asserted by a passing test |
| Master brief (current product truth) | Applicable: §4 gains two columns, §4's balance entry and §5's void and correction contracts change | `SYSTEM-SPEC.md` §4, §5 | jaketlee07 | §4's `production_batches` and `lot_adjustments` entries name the order number. §4's `inventory_balances` entry says that with no lbs on hand the average is the zero-stock average `docs/costing.md` gives, in place of "keeps its last value". §5's "Void a receipt" and "Correct a receipt" say a zero-stock average is recomputed as `docs/costing.md` gives it, with no known limit | close-work finds each entry matching the migration |
| Current architecture | Applicable: a new order number joins the insertion numbers, and existing rows are numbered by the migration | `docs/architecture/overview.md` "Insertion order and the hosted check" | jaketlee07 | The section names the stock-change order number, what it orders, and the keys and tie rule that number existing rows | close-work confirms the section matches the migration |
| Shipped ledger criteria | Applicable: two foundation criteria and two corrections criteria state zero-stock values that this spec replaces | `docs/specs/foundation-hardening/spec.md` AC-0029 and AC-0053; `docs/specs/corrections/spec.md` AC-0025 and AC-0066, each through an owner-approved amendment note | jaketlee07 | AC-0029's note names AC-0001 here for a correction that leaves 0 lbs. AC-0053's note names AC-0001 to AC-0007 here. AC-0025's note names AC-0011 here. AC-0066's note names AC-0001 here | close-work finds the four notes |
| Interface compatibility | Applicable: two new columns change the generated types | `src/lib/database.types.ts` | jaketlee07 | `npm run gen:types` output | `npm run gen:types` leaves no diff on the closing commit |
| Execution record | Applicable: the backfill probe, gate results, and review rounds need a home outside the contract | `docs/specs/zero-stock-average/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every AC observation the Testing Strategy routes to it |
| Intent closeout | Applicable: this spec delivers a backlog intent | `docs/product/intents/zero-stock-average-recompute.md`, `workspace.toml` `[backlog]` | close-work | none | close-work marks the intent Fulfilled and its entry leaves `open` |
| Lifecycle closeout | Applicable: delivered work is recorded when it ships | `docs/lifecycle/zero-stock-average.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Applicable when the build teaches something that would change a future approach | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |
| User documentation | Not applicable: no user-docs surface exists, and no page or label changes | none | n/a | n/a | n/a |
| Agent guidance and commands | Not applicable: no command, variable, or setup step changes | none | n/a | n/a | n/a |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions and the reasons in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Start the build only after the corrections branch merges into `main`, on this branch rebased onto that `main`.
- Before each test run, a reset, or a stop, follow "Run two folders' tests at once" in `AGENTS.md` for stack B.
- In the migration, revoke the default privileges on the new sequence and on every function it creates before any grant, and keep the signature of every public function it replaces.
- Run every test, reset, and probe of this work on stack B, the stack `supabase/stack-b.env` names.
- Run `npm run typecheck`, `npm run build`, and `npm test` with the `E2E_PORT` that "Run two folders' tests at once" in `AGENTS.md` gives a stack B folder, after each task; a red result stops the work until it is green.

### Ask first

- Any change to a number already asserted in `test/costing.test.ts`, `test/engine.test.ts`, `test/pricing.test.ts`, `test/corrections.test.ts`, `test/receipt-corrections.test.ts`, or `test/batch-reversal.test.ts`, except the changes this item lists. In `test/corrections.test.ts`, the cases "a void lot followed by a lot adjusted to zero still returns to 1.8000" and "two void lots before a lot adjusted to zero, voided %s, end at 1.8000" expect 2.0000. The last expectation of "the search after the last lot production drew from skips an earlier void lot" goes from 2.5000 to 3.0000. The case for the corrections spec's AC-0025 expects 1.9000, and the case for its AC-0066 expects 2.0000.
- Any change to an operation's refusals, locks, or written rows other than the average it leaves and the order number it writes.
- Any change under `src/` other than the regenerated `src/lib/database.types.ts`.
- Any `supabase db reset`, or any test run, on stack A.
- Any write to the hosted Supabase project, or pointing the app at it.

### Never do

- Read `lots.prior_avg_cost` to set an average.
- Compute a cost or an average in TypeScript.
- Change or drop `lots.prior_avg_cost` or any column `lots_guard` freezes.
- Edit an existing migration file.
- Add a table, a public function, an npm package, a new top-level directory, or a table column other than the order number on `production_batches` and on `lot_adjustments`.

## Testing Strategy

- **TDD against the local stack: the zero-stock rule, its order, and the catalog (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0019, AC-0020, AC-0021)**: AC-0002 to AC-0013 and AC-0019 are exact averages over fixtures built through the operations, `correct_receipt` and `reverse_batch` included, so a wrong engine fails them. AC-0001 is a check that runs after every test of each suite that registers the stock-on-hand average check, and a test writes a violating balance row through `pg` inside a transaction it rolls back and sees the check report it. AC-0008 runs both changes in one transaction through the operator transaction helper in `test/db.ts`. AC-0014 reads the catalog with `has_sequence_privilege`, AC-0020 with `pg_proc`, and AC-0021 with `has_function_privilege`.
- **Goal-based check recorded in the verification ledger (AC-0015, AC-0017, AC-0018)**: only a database migrated in two steps shows what the migration does to rows and balances that already exist, so a probe migrates a database to the migration before this spec's, makes the probe history, applies the rest, and records the numbers and the average.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0016)**: a Playwright test in `test/e2e/receiving.spec.ts`, run by `npm test` against the built app, voids through the page and reads the stock region.

The golden costing suites, `test/costing.test.ts` and `test/pricing.test.ts`, run unchanged in every `npm test`.

## Acceptance Criteria

Definitions used by these criteria:

- **Non-void receipt:** as defined in the receiving spec ([`../receiving/spec.md`](../receiving/spec.md)). A **void receipt** is a `lots` row with a `voided_at`.
- **Current cost, correction, reversed batch,** and to **correct** a lot "to C per lb": as defined in the corrections spec ([`../corrections/spec.md`](../corrections/spec.md)).
- **RAW-TOM, 502:** the raw product and the finished product that `test/db.ts` seeds; 502 is made from RAW-TOM.
- **Stock-lowering change** of a raw product: a `production_batches` row that is not reversed and has a `production_batch_lots` row on one of the product's lots, or a `lot_adjustments` row on one of its lots whose new remaining lbs are below its old remaining lbs.
- **Lbs a change took:** for a batch, the `lbs_consumed` of each of its `production_batch_lots` rows, from that row's lot; for an adjustment, its old remaining lbs minus its new remaining lbs, from its lot.
- **Last stock-lowering change** of a raw product: the one whose operation ran last among the operations that wrote its stock-lowering changes.
- **Zero-stock average** of a raw product: the sum, over the lbs its last stock-lowering change took, of those lbs times the current cost of their lot, divided by the total of those lbs, rounded to 4 decimals; 0 when the product has no stock-lowering change.
- **The zero-stock start:** RAW-TOM receives 1,000 lbs at 1.80 received 2026-05-10, and a batch of 502 uses all 1,000 raw lbs on 2026-05-11, so RAW-TOM has 0 lbs on hand at an average of 1.8000.
- Every lot that a criterion below receives is a RAW-TOM receipt of 1,000 lbs; AC-0011's lots are the sale fixture's.
- **The probe history,** each step in its own transaction: receive a lot at 1.80 received 2026-05-10 and produce 1,000 raw lbs of 502 on 2026-05-10; receive a lot at 2.50 received 2026-05-11 and adjust it to 0 lbs; receive a lot at 1.80 received 2026-05-12 and produce 1,000 raw lbs on 2026-05-12; receive lots at 18.00 received 2026-05-13 and 2.00 received 2026-05-14, adjust the 2.00 lot to 0 lbs, and void the 18.00 lot. It holds two batches and two adjustments, made batch first and alternating, and the last change is the adjustment of the 2.00 lot.

The rule

- [x] **AC-0001.** After every operation, each raw product whose `inventory_balances` row has 0 lbs on hand has a `moving_avg_cost` equal to its zero-stock average.

Voids

- [x] **AC-0002.** From the zero-stock start, receiving a lot at 18.00 received 2026-05-12 and voiding it leaves an average of 1.8000.
- [x] **AC-0003.** From the zero-stock start, receiving lots at 18.00 received 2026-05-12 and 2026-05-13 and voiding both, in each order, leaves an average of 1.8000.
- [x] **AC-0004.** From the zero-stock start, receiving a lot at 18.00 received 2026-05-12 and a lot at 2.00 received 2026-05-13, adjusting the 2.00 lot to 0 lbs, and voiding the 18.00 lot leaves an average of 2.0000.
- [x] **AC-0005.** From the zero-stock start, receiving lots at 18.00 and 20.00 received 2026-05-12 and a lot at 2.00 received 2026-05-13, adjusting the 2.00 lot to 0 lbs as waste, and voiding the 18.00 and 20.00 lots, in each order, leaves an average of 2.0000.
- [x] **AC-0006.** From the zero-stock start, receiving a lot at 18.00 received 2026-05-14, then a lot at 20.00 received 2026-05-12, and voiding both, in each order, leaves an average of 1.8000.
- [x] **AC-0007.** From the zero-stock start, receiving a lot at 18.00 received 2026-05-13, then a lot at 2.00 received 2026-05-12, producing 1,000 raw lbs of 502 on 2026-05-12, and voiding the 18.00 lot leaves an average of 2.0000.

Order

- [x] **AC-0008.** With RAW-TOM holding only a lot X at 2.00 received 2026-05-10, a lot Y at 3.00 received 2026-05-11, and a lot V at 18.00 received 2026-05-20, one transaction makes two changes: a batch of 1,000 raw lbs of 502 produced 2026-05-15 and an adjustment of Y to 0 lbs. Voiding V afterwards leaves the average at the cost of the lbs the second change took: 3.0000 when the adjustment runs second and 2.0000 when the batch runs second.

Reversed batches and corrections

- [x] **AC-0009.** From the zero-stock start, receiving a lot at 2.00 received 2026-05-12, producing 1,000 raw lbs of 502 on 2026-05-12, reversing that batch, and voiding the 2.00 lot leaves an average of 1.8000.
- [x] **AC-0010.** From the zero-stock start, correcting the 1.80 lot to 1.90 per lb leaves an average of 1.9000.
- [x] **AC-0011.** In the corrections spec's sale fixture after lot B is corrected to 2,000 lbs, correcting lot B to 1.90 per lb leaves RAW-TOM's average at 1.9000.
- [x] **AC-0012.** From the zero-stock start, receiving a lot at 18.00 received 2026-05-12, correcting the 1.80 lot to 1.90 per lb, and voiding the 18.00 lot leaves an average of 1.9000.
- [x] **AC-0019.** With RAW-TOM holding only a lot P at 1.00 received 2026-05-12 and a lot Q at 2.00 received 2026-05-13, producing 1,500 raw lbs of 502 on 2026-05-13 and then correcting Q to 500 lbs leaves 0 lbs on hand at an average of 1.3333.

No lot left

- [x] **AC-0013.** With RAW-TOM holding only one lot, at 1.68, voiding it leaves an average of 0.0000.

Access

- [x] **AC-0014.** The `anon`, `authenticated`, and `service_role` roles hold no `USAGE`, `SELECT`, or `UPDATE` privilege on the sequence that numbers stock-lowering changes.
- [x] **AC-0020.** `void_receipt` and `private.refresh_balance` are each SECURITY DEFINER with `proconfig` exactly `{search_path=""}`.
- [x] **AC-0021.** `authenticated` holds EXECUTE on `void_receipt`, `anon` and `service_role` hold none on it, and none of the three roles holds EXECUTE on `private.refresh_balance`.

Existing rows

- [x] **AC-0015.** On a database migrated to the migration before this spec's and holding the probe history, applying this spec's migration gives its two batches and two adjustments order numbers that rise in the order they were made.
- [x] **AC-0017.** After the AC-0015 migration, RAW-TOM's average is 2.0000.
- [x] **AC-0018.** After the AC-0015 migration, receiving a lot at 3.00 received 2026-05-15, producing 1,000 raw lbs of 502 on 2026-05-15, receiving a lot at 4.00 received 2026-05-16, and adjusting it to 0 lbs gives that batch and that adjustment order numbers above all four of the probe history's, the batch's below the adjustment's.

The page

- [x] **AC-0016.** On `/receiving`, with the AC-0004 history made through the operations up to its void, voiding the 18.00 receipt through Recent receipts shows RAW-TOM with 0 lbs on hand and an average cost of "$2.0000/lb".

## Follow-ons

None.

## Assumptions

- Technical: on `main`, the three zero-stock steps live only in `void_receipt` in `supabase/migrations/20261007183252_corrections.sql`; the corrections branch redefines `private.refresh_balance` in `supabase/migrations/20261018053447_receipt_corrections.sql` and `void_receipt` last in `supabase/migrations/20261018205556_batch_reversal.sql`, and keeps the steps (source: grep on `main` and on `feat/corrections`, 2026-10-18; the `void_receipt` file rechecked on `main` 2026-10-20)
- Technical: only `produce_batch` and `adjust_lot` lower a non-void lot's remaining lbs, and `void_receipt` empties only the lot it voids; on the corrections branch, `correct_receipt` moves remaining lbs by a weight change and `reverse_batch` returns lbs (source: grep for `update public.lots` over `supabase/migrations/`; corrections spec Objective)
- Technical: `produce_batch` and `adjust_lot` each lock the raw product's `inventory_balances` row before they insert their `production_batches` or `lot_adjustments` row, so a number drawn on insert follows the order the operations ran (source: `20261007181933_engine_hardening.sql` `produce_batch`; `20261007183252_corrections.sql` `adjust_lot`)
- Technical: `production_batches.created_at` and `lot_adjustments.adjusted_at` default to `now()`, the transaction's start time, so two changes in one transaction share it (source: `0001_init.sql`; `20261007183252_corrections.sql`)
- Technical: no database function calls `produce_batch` or `adjust_lot` from inside another operation (source: grep over `supabase/migrations/`, 2026-10-18)
- Technical: when a batch or an adjustment leaves 0 lbs on hand, the average it keeps already equals the average current cost of the lbs it took, because it took every lb on hand; the zero-stock average gives the same value, and `test/engine.test.ts` AC-0029 pins one case (source: `private.refresh_balance`; the corrections spec's stock-on-hand average over current cost)
- Technical: under the rule, the cases the Ask-first exception lists are the only asserted values that change (source: `test/corrections.test.ts` AC-0053 block; corrections spec AC-0025 and AC-0066, worked by hand 2026-10-18)
- Technical: the engine migration numbered existing lots and finished lots by their old keys before identity took over, and the overview's "Insertion order and the hosted check" section records it (source: `20261007181933_engine_hardening.sql`; `docs/architecture/overview.md`)
- Product: when the last change was an adjustment to 0 lbs, the average is that lot's cost (source: user confirmation 2026-10-18)
- Product: batches and adjustments get an order number from one sequence, taken under the product's stock lock, and rows that already exist are numbered (source: user confirmation 2026-10-18)
- Product: a reversed batch counts as never entered, and a corrected receipt counts as entered with its current cost and weight, so a cost correction while stock is 0 moves the average (source: user confirmation 2026-10-18)
- Product: one rule sets the average whenever an operation leaves 0 lbs on hand; batches and adjustments give the same averages as before (source: user confirmation 2026-10-18)
- Product: the expected values the Ask-first exception lists change in the tests, and the four shipped criteria take amendment notes (source: user confirmation 2026-10-18)
- Product: when no non-void lot is left, the average is 0, the value before any receipt; the screens show "None yet" there from the has-cost fact (source: derived from the owner's never-entered rule and the `inventory_balances.moving_avg_cost` default in `0001_init.sql`; user confirmation 2026-10-18)
- Process: this spec is written against the approved corrections spec and built after that branch merges into `main` (source: user confirmation 2026-10-18)
- Process: full mode, because the change alters the schema and a stored value; the owner approves the spec, then the plan, in chat after review, and approval can come before the corrections merge; if the merged corrections text differs from its approved spec where this spec cites it, this spec is amended before the build (source: work-loop risk triggers; user confirmation 2026-10-18)
