# Spec: corrections

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §2 (deterministic engine), §4 (lots, production, sales, corrections), §5 (the engine's operations), §6 invariants 4, 6, and 7, §11 (boundaries); [`docs/costing.md`](../../costing.md) (the average rule, the zero-stock rule, the void_receipt and adjust_lot rules, the seven invariants, the Rounding note); the sale rules in [`../sales/spec.md`](../sales/spec.md) (a sale is undone only by a void with a reason); the alert rules in [`../alerts/spec.md`](../alerts/spec.md) (on `main` once Alerts merges); the access model, the write path, the `supabase/migrations/` change guidance, and the app trust boundary in [`docs/architecture/overview.md`](../../architecture/overview.md); the intent [`docs/product/intents/corrections-consumed-receipts.md`](../../product/intents/corrections-consumed-receipts.md)
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the two operations, the table, and the server actions are consumed only by this app; no published interface)
- **Shape:** mixed

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

The owner fixes two kinds of mistake after production has used the stock:
a receipt entered at the wrong cost or weight, and a batch that should never
have been entered.

**Correct a receipt.** On `/receiving`, every receipt in Recent receipts that is
not void has a Correct button. The owner types the right cost per lb, the right
weight, or both, and a reason. The receipt keeps what was first entered, and a
correction record holds the new values. From then on the engine uses the
corrected cost and weight everywhere:

- The receipt's lbs on hand move by the weight change.
- The raw product's stock and average move to the corrected values.
- Every batch made from the receipt is re-costed, keeping the processing fees
  it was costed with. Its finished stock takes the new cost, and so does every
  sale line from that stock, so margins on past sales come out right.

A correction is undone by correcting back, which restores every figure. When
the raw product has 0 lbs on hand, the average keeps its value, as the
zero-stock rule in [`docs/costing.md`](../../costing.md) says.

**Reverse a batch.** On `/production`, every batch in Recent batches has a
Reverse button until it is reversed. The confirmation lists the raw lbs that go
back to each lot and every sale that drew from the batch's finished stock. On
confirm, one step does all of this, or none of it:

- Each of those sales is voided as the Sales page voids a sale: its lbs go back
  to stock and it leaves every trace.
- The batch's finished stock leaves stock.
- Its raw lbs go back to the lots they came from.
- The batch is marked reversed with the reason.

The result lists each voided sale so the owner can record it again. A reversed
batch stays in the list, marked "Reversed".

The receipt's lot number, vendor, and received date never change, so every
trace still reaches the same vendor and date. Alerts read corrected costs and
leave reversed batches out. Every figure on these screens comes from the
database, and the app computes none.

The pages keep the floor screens' goals: hard to mistype first, fast on a phone
second, and numbers that are easy to trust third.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Costing truth | Applicable: a lot gains a current cost and weight, two operations join the engine, two shipped rules change, and invariant 6's statement changes | `docs/costing.md` | jaketlee07 | The opening names the new test suites and both operations among the places the math lives. Invariant 4 says the recorded cost and weight never change. Invariant 6 counts current weight and only batches that are not reversed. A `correct_receipt` section gives the restatement rule, the fee kept, the weight rule, and the zero-stock rule. A `reverse_batch` section says what a reversal returns and voids. The `void_receipt` and `adjust_lot` sections use current weight and leave reversed batches out. The cost chain is stated once. The known limit also names a corrected receipt's cost carried by a later lot's prior average. The "Not available" note names the "Batch reversed" panel and the suite that asserts it | close-work finds each statement, and each figure the new sections state as an expected result is asserted by a passing test |
| Master brief (current product truth) | Applicable: §4 gains columns and a table, §5's count of operations and two contracts change, §7's rule inputs change, and §11 names the operations | `SYSTEM-SPEC.md` §4, §5, §7, §11 | jaketlee07 | §4 lists the four `lots` columns, the two `production_batches` marks, and `receipt_corrections`. §4 says `production_batch_lots.lot_unit_cost` and `sale_items.cost_per_lb` follow a receipt correction. §5 says eight operations, with "Correct a receipt" and "Reverse a batch" contracts and the updated void and adjust contracts. §7's cost rule reads current cost and its yield and stock rules leave reversed batches out. §11 says the operations in §5 | close-work finds each entry matching the migration |
| Current architecture and app trust boundary | Applicable: two operations, a table, two server actions, and two dialogs change the areas map, the access model, the write path, and the failure notes | `docs/architecture/overview.md` | jaketlee07 | The `src/app/` row names Correct on `/receiving` and Reverse on `/production` with their actions. The ledger table list holds `receipt_corrections`. The access model and write path count eight operations and give the two new operations' locks. The app's ledger calls add `correct_receipt` and `reverse_batch`. The failure notes cover a correction and a reversal, and the note "For a batch, which cannot be undone" is replaced by one that says a batch can be reversed, which voids its sales | close-work confirms each named row and sentence matches `src/`, `supabase/`, and `test/` |
| The Alerts contract | Applicable: the cost alert's next step changes text, and the rules read corrected costs and skip reversed batches | `docs/specs/alerts/spec.md` AC-0102 and its rule definitions, through an owner-approved amendment note | jaketlee07 | AC-0102's next step reads "Check it against the invoice. If the cost is wrong, correct the receipt on Receiving.", and the Cost, Yield, and Stock rule definitions say "current cost" and "batches that are not reversed", each with a note citing this spec; the Alerts suite asserts the new sentence | close-work finds the amended text, the note, and the sentence in a passing Alerts test |
| Shipped ledger criteria | Applicable: foundation criteria and a definition state the average, conservation, the void rule, and the adjustment cap over the recorded cost and weight and every consumption row, which a correction and a reversal change | `docs/specs/foundation-hardening/spec.md` AC-0028 and its stock-on-hand average definition, AC-0031, AC-0032, AC-0033, AC-0035, AC-0038, AC-0039, and AC-0054, through an owner-approved amendment note | jaketlee07 | Each carries a note naming the criteria here that state it for current cost, current weight, and reversed batches: AC-0079 for AC-0028 and its definition, AC-0070 for AC-0031, AC-0068 for AC-0032, AC-0071 for AC-0033, AC-0060 and AC-0061 for AC-0035, AC-0062, AC-0063, and AC-0069 for AC-0038 and AC-0039, and AC-0069 for AC-0054 | close-work finds the nine notes |
| Production's check step | Applicable: the step's warning that a batch can't be undone stops being true | `docs/specs/production/spec.md` AC-0014, through an owner-approved amendment note | jaketlee07 | AC-0014 carries a note that AC-0151 here replaces its sentence | close-work finds the note |
| Backlog | Applicable: this spec delivers a backlog intent | `workspace.toml` `[backlog]`, through close-work | jaketlee07 | The `corrections-consumed-receipts.md` entry leaves `open` when close-work runs | close-work moves it |
| Zero-stock average intent | Applicable: the owner chose to keep the stored average on a zero-stock correction, and to accept a later void bringing back a corrected cost, until that intent replaces both | `docs/product/intents/zero-stock-average-recompute.md` | jaketlee07 | Its Outcome also covers a cost correction that leaves 0 lbs on hand and a void whose zero-stock value carries a corrected receipt's cost | close-work finds the sentences |
| Interface compatibility | Applicable: new columns, a table, and two functions change the generated types | `src/lib/database.types.ts` | jaketlee07 | AC-0192 passes | `npm run gen:types` leaves no diff on the closing commit |
| Agent guidance and commands | Not applicable: no command, variable, or setup step changes | none | n/a | n/a | n/a |
| User documentation | Not applicable: no user-docs surface exists, the owner is the only user, and the screen labels carry the task | none | n/a | n/a | n/a |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions and the reasons in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

### Always do

- Read every weight, cost, price, stock, and date figure from the database, every "before" figure included, read before the write.
- Show every weight, cost, price, and date through `src/lib/format.ts` and the formats in the `docs/costing.md` Rounding note. Form fields keep what the owner typed; the correction's starting values are the receipt's current cost and weight as the database writes them as text, with 4 and 3 decimals.
- Change the ledger from `/receiving` and `/production` only through `receive_lot`, `void_receipt`, `correct_receipt`, `produce_batch`, and `reverse_batch`, called with the signed-in user's session.
- Settle the caller inside every server action before it reads or writes anything else, through `src/app/_server/caller.ts`.
- In the migrations, revoke the default privileges on the new table, its identity sequence, and the two new functions before granting, turn on row level security on the new table, keep every replaced function's signature, and replace `v_sale_traceability` `with (security_invoker = true)` keeping every column in name, type, and order.
- Before each test run, follow "Run two folders' tests at once" in `AGENTS.md` for the stack this folder uses.
- Run `npm run typecheck`, `npm run build`, and `npm test` after each task; a red result stops the work until it is green.
- Start the build only after Alerts merges into `main`, on a branch rebased onto that `main`.

### Ask first

- Any change to `receive_lot`, `record_sale`, `void_sale`, `set_target_margin`, `set_list_price`, `price_what_if`, `check_operator`, `v_product_pricing`, `v_current_menu`, or `v_sale_summary`, or to the columns `lots_guard` freezes.
- Any change to an operation, view, or alert function beyond what the Acceptance Criteria require.
- Any change to a number already asserted in `test/costing.test.ts`, `test/engine.test.ts`, `test/corrections.test.ts`, or `test/pricing.test.ts`.
- Adding any npm package.
- Adding a route or a navigation link.
- Changing what `/menu`, `/pricing`, `/sales`, `/trace`, `/alerts`, or `/invoices` shows or does, beyond the current cost and weight of AC-0160, AC-0161, and AC-0162, the alert outcomes of AC-0080 to AC-0085 and AC-0087, and the cost alert's next step that the Alerts Durable Outputs row gives.
- Any write to the hosted Supabase project, or pointing the app at it.

### Never do

- Compute a stock, cost, price, average, margin, or "before" figure in TypeScript, or predict which sales a reversal voids beyond listing what the database holds.
- Change a lot's recorded cost, weight, product, vendor, received date, lot number, or prior average, or delete any ledger row.
- Write a ledger table, `receipt_corrections` included, except through an operation. The one exception is the check tests of AC-0068 to AC-0079, which each write one violating row through `pg` inside a transaction they roll back.
- Add a table other than `receipt_corrections`, or a table column other than the four on `lots` and the two on `production_batches` that this spec names.
- Add a call to an AI model or an AI client library.
- Import a Postgres driver under `src/`, or import anything from `src/app/` into `src/lib/`.
- Edit an existing migration file.
- Commit a new top-level directory, or add a PWA manifest, a service worker, or offline queueing.
- Read a privileged variable anywhere under `src/`, except in `src/privileged-env.ts`. "Privileged variable" is defined in the receiving spec ([`../receiving/spec.md`](../receiving/spec.md)).

## Testing Strategy

The Vitest suites and the Playwright browser suite run under `npm test` against the local Supabase stack. Goal-based checks run as the commands their criteria name. Each criterion is listed once, under the check that closes it.

- **TDD against the local stack: the two operations, the changed operations, the trace view, the access rules, the catalog, and the queueing (AC-0001, AC-0002, AC-0003, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0039, AC-0040, AC-0041, AC-0042, AC-0043, AC-0044, AC-0045, AC-0046, AC-0047, AC-0048, AC-0049, AC-0050, AC-0051, AC-0052, AC-0053, AC-0054, AC-0055, AC-0060, AC-0061, AC-0062, AC-0063, AC-0064, AC-0065, AC-0066, AC-0067, AC-0202, AC-0204)**: each is an exact row, figure, refusal, lock wait, or catalog fact over fixtures built through the operations, so a wrong engine fails it. A refusal's "changes nothing" compares `tableFingerprints()` before and after. Queueing uses the `raceCalls` harness in `test/db.ts`. AC-0039 and AC-0055 hold the stock row or the product row from their own `pg` session and read the waiting backend's relation locks from `pg_locks`. AC-0002 is read from the catalog with `has_function_privilege`.
- **TDD against the local stack, through the invariant checks (AC-0068, AC-0069, AC-0070, AC-0071, AC-0072, AC-0073, AC-0074, AC-0075, AC-0076, AC-0077, AC-0078, AC-0079)**: `assertLedgerInvariants` in `test/db.ts` runs after every test of each suite that registers it: every Vitest suite that calls `correct_receipt` or `reverse_batch`, `test/access.test.ts` included, and the suites that register it today (`test/costing.test.ts`, `test/corrections.test.ts`, `test/engine.test.ts`, `test/pricing.test.ts`, `test/pricing-data.test.ts`, `test/production-data.test.ts`, `test/receiving-data.test.ts`, `test/receiving-data-extra.test.ts`, `test/sales.test.ts`, `test/sales-data.test.ts`). `assertAverageIsStockOnHand` runs after every test of `test/receipt-corrections.test.ts`, `test/batch-reversal.test.ts`, `test/engine.test.ts`, and `test/corrections.test.ts`. For each check, a test writes a violating row through `pg` inside a transaction it rolls back and sees that check report it.
- **TDD against the local stack: the alert outcomes (AC-0080, AC-0081, AC-0082, AC-0083, AC-0084, AC-0085)**: exact alert rows and statuses over the Alerts spec's fixtures, with the watch's today passed in.
- **TDD, no database: the correction and reversal form rules, their messages, and the two actions' decisions**: pure rules over typed text, error codes, and fake database calls, as construction for the browser and recorded criteria below. The engine's exact refusal texts, fed from real refusals in the operation suites, pin the message rules to the engine's wording.
- **TDD against the local stack: the reads behind the dialogs and panels**: a receipt's current and recorded values with its latest correction reason, the batches made from a lot in draw order, a batch's lots and finished lbs, and the sales a reversal would void, as construction for the page criteria below.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0004, AC-0005, AC-0006, AC-0007, AC-0087, AC-0090, AC-0091, AC-0092, AC-0093, AC-0094, AC-0095, AC-0096, AC-0097, AC-0098, AC-0099, AC-0100, AC-0101, AC-0102, AC-0103, AC-0104, AC-0105, AC-0106, AC-0107, AC-0108, AC-0111, AC-0112, AC-0113, AC-0114, AC-0115, AC-0116, AC-0117, AC-0118, AC-0130, AC-0131, AC-0132, AC-0133, AC-0134, AC-0135, AC-0136, AC-0137, AC-0138, AC-0139, AC-0140, AC-0141, AC-0142, AC-0145, AC-0146, AC-0147, AC-0148, AC-0149, AC-0150, AC-0151, AC-0160, AC-0161, AC-0162)**: each criterion is a state, a trigger, and an on-screen or returned outcome that only a real browser over the real server and database shows. The suite drives Chromium through Playwright, replays action requests through Playwright's request API, and seeds and reads raw tables through `pg`. AC-0116 and AC-0149 abort the action request in flight through Playwright's request routing. AC-0117 and AC-0150 hold a `pg` row lock on the raw product's `inventory_balances` row while confirming, so the call ends with the local stack's 8-second statement timeout, then release it.
- **E2E accessibility and phone-width checks (AC-0170, AC-0171, AC-0172, AC-0173, AC-0174, AC-0175, AC-0176, AC-0177, AC-0178, AC-0179, AC-0180, AC-0181, AC-0182)**: axe-core, measured element boxes, focus reads, and computed styles in the same browser suite give a pass or fail bar for each page state. The recorded run applies the focus check of AC-0177 to the recorded failures.
- **Manual QA recorded in the verification ledger (AC-0109, AC-0110, AC-0143, AC-0144)**: a recorded run against `npm run start`. With the REST service stopped after the page loads, it records the AC-0109 and AC-0143 messages. With the app pointed at a throwaway forwarder between the app and the REST service that holds the `correct_receipt` or `reverse_batch` call past the 10-second limit, it records the AC-0110 and AC-0144 messages, the focused element, and whether the write happened.
- **Goal-based checks (AC-0189, AC-0190, AC-0191, AC-0192, AC-0193, AC-0194, AC-0195, AC-0196, AC-0197, AC-0198, AC-0199, AC-0200, AC-0201, AC-0203)**: each is settled by one command or one set of commands: a build, a test run, a type regeneration diff, a typecheck, a `grep`, a `git diff`, a catalog read compared before and after, or a dependency audit.

## Acceptance Criteria

Definitions used by these criteria:

- **Operator, non-operator, signed-out visitor, active finished product:** as defined in the production spec ([`../production/spec.md`](../production/spec.md)).
- **Ended session, focusable controls of a page state, non-void receipt, untouched receipt:** as defined in the receiving spec ([`../receiving/spec.md`](../receiving/spec.md)). A **void receipt** is a `lots` row with a `voided_at`. An **in-use receipt** is a non-void receipt that is not untouched.
- **Sale, void sale, sale line, finished lot, finished lbs on hand, sale summary view, trace view, menu view, entry order, draw order, the sale fixture, the 5,000-lb sale:** as defined in the sales spec ([`../sales/spec.md`](../sales/spec.md)). In the sale fixture, **lot A** and **lot B** are its two RAW-TOM receipts and **batch 1** and **batch 2** its two batches of 502. 502's processing fees are 0.05, 0.03, and 0.37 per lb, as `test/db.ts` seeds them. In it, batch 1 has a raw cost total of 10200.0000 and a cost per finished lb of 2.6578, batch 2 has 1800.0000 and 2.7877, and RAW-TOM has 1,000 lbs on hand at an average of 1.8000. After the 5,000-lb sale, its line from batch 1 holds 4,620 lbs at a cost of 2.6578, its line from batch 2 holds 380 lbs at 2.7877, and batch 2's finished lot has 390 lbs remaining.
- **Recorded cost and weight:** a lot's `unit_cost` and `weight_lbs`, as received. **Current cost and weight:** its `current_unit_cost` and `current_weight_lbs`, which are the values of its latest correction, or its recorded values when it has none.
- **Correction:** one `receipt_corrections` row. A **corrected receipt** has at least one. To **correct** a lot "to C per lb and W lbs" is to call `correct_receipt` with that lot, cost C, weight W, and a reason; "to C per lb" alone keeps its current weight, and "to W lbs" alone keeps its current cost.
- **Reversed batch:** a `production_batches` row with a `reversed_at`. A batch's **finished lot** is the finished lot it made. **Batches made from a lot** are the batches with a `production_batch_lots` row on that lot.
- **A lot's used lbs:** the sum of `lbs_consumed` over its `production_batch_lots` rows whose batch is not reversed. **Lbs removed by adjustments:** the sum of old minus new remaining lbs over its `lot_adjustments` rows.
- **Changes nothing:** every `public` table has the same row count and content before and after, as `tableFingerprints()` in `test/db.ts` compares them.
- **The cost fixture, the yield fixture, the stock fixture, watch, cleared:** as defined in the Alerts spec ([`../alerts/spec.md`](../alerts/spec.md)).
- **Page states:** on `/receiving`, the list with a Correct button on an untouched and on an in-use receipt; the list with a corrected receipt; the open correction; the correction after an AC-0102, AC-0103, AC-0104, or AC-0105 refusal; the "Receipt corrected" panel with batches restated; the panel with "No batch cost changed."; the list after an AC-0107 or AC-0117 refusal; the "Receipt saved" panel after AC-0101. On `/production`, the list with a Reverse button; the list with a reversed batch; the open reversal with sales to void; the open reversal with none; the reversal after an AC-0139 refusal; the "Batch reversed" panel with sales voided; the panel with "No sale was voided."; the list after an AC-0140 or AC-0150 refusal; the batch result panel after AC-0142.
- **Advisory waivers:** none. Each waiver names an npm advisory ID, the date, and the owner's acceptance. Adding one changes this contract section, so it is an amendment.

Access

- [x] **AC-0001.** Called by a non-operator, `correct_receipt` and `reverse_batch` each fail with SQLSTATE `42501` and change nothing, with arguments an operator's call would accept and with each argument and lot or batch state that AC-0023, AC-0024, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0048, and AC-0049 refuse from an operator.
- [x] **AC-0002.** The `anon` and `service_role` roles hold no EXECUTE on `correct_receipt` or on `reverse_batch`.
- [x] **AC-0003.** A non-operator reads 0 rows from `receipt_corrections` and `anon` is refused a read of it, in a fixture where an operator reads at least one row.
- [x] **AC-0004.** A correct or reverse action request replayed with no session, or with a non-operator's session, changes nothing.
- [x] **AC-0005.** A correct action request replayed with no session returns "You're signed out. Sign in again to correct this receipt."
- [x] **AC-0006.** A reverse action request replayed with no session returns "You're signed out. Sign in again to reverse this batch."
- [x] **AC-0007.** A correct or reverse action request replayed with a non-operator's session returns a message containing "This account isn't allowed to use Meat Ops."

Correcting a receipt

- [x] **AC-0010.** In the sale fixture with the 5,000-lb sale, correcting lot A to 1.86 per lb with the reason "invoice price" writes one correction holding lot A, old cost 1.6800, new cost 1.8600, old weight 5000.000, new weight 5000.000, that reason, and a time.
- [x] **AC-0011.** After the AC-0010 correction, lot A's recorded cost is 1.6800 and its current cost is 1.8600.
- [x] **AC-0012.** After the AC-0010 correction, batch 1's raw cost total is 11100.0000 and its cost per finished lb is 2.8526, and batch 2 keeps 1800.0000 and 2.7877.
- [x] **AC-0013.** After the AC-0010 correction, batch 1's finished lot and the 5,000-lb sale's line from batch 1 each have a cost per lb of 2.8526, and its line from batch 2 keeps 2.7877.
- [x] **AC-0014.** After the AC-0010 correction, every `production_batch_lots` row on lot A has a lot cost of 1.8600.
- [x] **AC-0015.** After the AC-0010 correction, RAW-TOM has 1,000 lbs on hand at an average of 1.8000.
- [x] **AC-0016.** In the sale fixture with the 5,000-lb sale, correcting lot B to 1.90 per lb makes batch 1's cost per finished lb 2.6794 and batch 2's 2.9175.
- [x] **AC-0017.** After the AC-0016 correction, RAW-TOM's average is 1.9000.
- [x] **AC-0018.** A restated batch keeps the processing fees it was costed with: in the sale fixture with 502's overhead fee changed from 0.37 to 0.50 after both batches, correcting lot A to 1.86 per lb makes batch 1's cost per finished lb 2.8526.
- [x] **AC-0019.** Correcting lot A back to 1.68 per lb after the AC-0010 correction returns every batch's raw cost total and cost per finished lb, every finished lot's and sale line's cost per lb, every `production_batch_lots` lot cost, and RAW-TOM's on hand and average to their values before AC-0010.
- [x] **AC-0020.** In the sale fixture, correcting lot B to 3,100 lbs gives lot B 1,100 lbs remaining and RAW-TOM 1,100 lbs on hand.
- [x] **AC-0021.** In the sale fixture with the 5,000-lb sale, correcting lot B to 3,100 lbs changes no batch, finished lot, sale line, or `production_batch_lots` row.
- [x] **AC-0022.** In the sale fixture, correcting lot B to 2,000 lbs gives it 0 lbs remaining and leaves RAW-TOM at 0 lbs on hand with an average of 1.8000.
- [x] **AC-0023.** In the sale fixture, correcting lot B to 1,999.999 lbs is refused and changes nothing.
- [x] **AC-0024.** In the sale fixture with lot B adjusted to 900 lbs, the smallest weight it can be corrected to is 2,100 lbs: 2,099.999 lbs is refused and changes nothing, and 2,100 lbs leaves it 0 lbs remaining.
- [x] **AC-0025.** In the sale fixture after lot B is corrected to 2,000 lbs, correcting lot B to 1.90 per lb leaves RAW-TOM's average at 1.8000.
- [x] **AC-0026.** A correction whose cost, rounded to 4 decimals, and weight, rounded to 3, both equal the lot's current ones is refused and changes nothing.
- [x] **AC-0027.** A correction of a void receipt is refused and changes nothing.
- [x] **AC-0028.** A correction whose reason is null, empty, or only spaces, tabs, and line breaks is refused and changes nothing.
- [x] **AC-0029.** A correction whose cost is null, NaN, or below 0, or whose weight is null, NaN, or not above 0, is refused and changes nothing.
- [x] **AC-0030.** A correction of a lot id that does not exist is refused and changes nothing.
- [x] **AC-0031.** A cost of 0 is accepted: in the sale fixture, correcting lot B to 0 per lb makes batch 1's cost per finished lb 2.2682 and batch 2's 0.4500.
- [x] **AC-0032.** A lot corrected twice holds two corrections, and its current cost and weight are the second's.
- [x] **AC-0033.** In the sale fixture with a third RAW-TOM receipt, lot C, of 1,000 lbs at 2.00 received 2026-10-07, correcting lot C to 2.20 per lb moves RAW-TOM's average from 1.9000 to 2.0000.
- [x] **AC-0034.** A receipt of an inactive raw product can be corrected: in the sale fixture with RAW-TOM made inactive, correcting lot B to 1.90 per lb makes batch 2's cost per finished lb 2.9175.
- [x] **AC-0035.** With a correction of lot B to 1.90 per lb holding its transaction open, a 100-lb sale of 502 dated 2026-10-08 waits on a lock; once the correction commits, the sale's line carries a cost per lb of 2.9175. The fixture is the sale fixture with the 5,000-lb sale.
- [x] **AC-0036.** With that 100-lb sale holding its transaction open, the correction of lot B to 1.90 per lb waits on a lock; once both commit, the sale's line carries a cost per lb of 2.9175.
- [x] **AC-0037.** In the sale fixture, with a correction of lot B to 1.90 per lb holding its transaction open, a batch of 500 raw lbs of 502 produced 2026-10-08 waits on a lock; once the correction commits, the batch's `production_batch_lots` row carries a lot cost of 1.9000.
- [x] **AC-0038.** For each pair of calls on one raw product and its finished product, where one is `correct_receipt` or `reverse_batch`, the other is `receive_lot`, `produce_batch`, `void_receipt`, `adjust_lot`, `record_sale`, `void_sale`, `correct_receipt`, or `reverse_batch`, and each would succeed alone, starting the second call while the first call's transaction is still open, in each order, leaves AC-0068 to AC-0079 holding once both finish.
- [x] **AC-0039.** `correct_receipt` and `reverse_batch` each take the raw product's stock row before they lock or write any other row: in the sale fixture with the 5,000-lb sale, while a `pg` session holds RAW-TOM's `inventory_balances` row `FOR UPDATE`, a correction of lot B to 1.90 per lb and a reversal of batch 2 each wait on that row, and while each waits, `pg_locks` shows its backend holding a `RowShareLock` or `RowExclusiveLock` relation lock on no table or index other than `inventory_balances` and its primary key.
- [x] **AC-0055.** `correct_receipt` and `reverse_batch` each take the finished product's `products` row before they lock or write any `production_batches`, `finished_goods`, `sales`, or `sale_items` row: in the sale fixture with the 5,000-lb sale, while a `pg` session holds 502's `products` row `FOR NO KEY UPDATE`, a correction of lot B to 1.90 per lb and a reversal of batch 2 each wait on that row, and while each waits, `pg_locks` shows its backend holding no `RowShareLock` or `RowExclusiveLock` relation lock on `production_batches`, `finished_goods`, `sales`, or `sale_items`.

Reversing a batch

- [x] **AC-0040.** In the sale fixture, reversing batch 2 with the reason "entered twice" marks it reversed with that reason and a time.
- [x] **AC-0041.** After the AC-0040 reversal, lot B has 2,000 lbs remaining.
- [x] **AC-0042.** After the AC-0040 reversal, batch 2's finished lot has 0 lbs remaining and 502 has 4,620 finished lbs on hand.
- [x] **AC-0043.** In the sale fixture, reversing batch 1 leaves lot A with 5,000 lbs and lot B with 2,000 lbs remaining.
- [x] **AC-0052.** After the AC-0043 reversal, RAW-TOM's average is 1.7143.
- [x] **AC-0044.** In the sale fixture with the 5,000-lb sale, reversing batch 2 with the reason "entered twice" voids that sale with the reason "Reversed with batch <batch 2's number>: entered twice" and the batch's reversal time.
- [x] **AC-0045.** After the AC-0044 reversal, batch 1's finished lot has 4,620 lbs remaining, batch 2's has 0, and 502 has 4,620 finished lbs on hand.
- [x] **AC-0046.** A sale that was already void when a batch it drew from is reversed keeps its own void reason and time.
- [x] **AC-0047.** A sale with no line on the reversed batch's finished lot is not voided: in the sale fixture with a 1,000-lb sale of 502 dated 2026-10-06, reversing batch 2 leaves that sale not void.
- [x] **AC-0048.** Reversing a reversed batch is refused and changes nothing.
- [x] **AC-0049.** A reversal whose reason is null, empty, or only spaces, tabs, and line breaks, or whose batch id does not exist, is refused and changes nothing.
- [x] **AC-0050.** In the sale fixture, with a 4,700-lb sale of 502 dated 2026-10-08 holding its transaction open, reversing batch 2 waits on a lock; once the sale commits, the reversal voids it.
- [x] **AC-0051.** In the sale fixture, with the reversal of batch 2 holding its transaction open, a 4,700-lb sale of 502 dated 2026-10-08 waits on a lock; once the reversal commits, the sale is refused for a shortfall.
- [x] **AC-0053.** In the sale fixture, with the reversal of batch 2 holding its transaction open, a batch of 1,500 raw lbs of 502 produced 2026-10-08 waits on a lock; once the reversal commits, that batch is written and draws 1,500 lbs from lot B.
- [x] **AC-0054.** A batch of an inactive finished product can be reversed: in the sale fixture with 502 made inactive, reversing batch 2 marks it reversed and leaves lot B with 2,000 lbs remaining.

Operations that change with corrections and reversals

- [x] **AC-0060.** A receipt whose only `production_batch_lots` rows belong to reversed batches can be voided: with RAW-TOM's only receipt of 1,000 lbs at 1.68 received 2026-10-01, a batch of 1,000 raw lbs produced 2026-10-02 and then reversed, voiding that receipt marks it void with 0 lbs remaining.
- [x] **AC-0061.** An untouched receipt corrected to 1,100 lbs from 1,000 can be voided, which leaves it 0 lbs remaining.
- [x] **AC-0062.** In the sale fixture after the AC-0040 reversal, `adjust_lot` accepts lot B at 2,000 lbs and refuses 2,000.001 lbs.
- [x] **AC-0063.** In the sale fixture with lot B corrected to 3,100 lbs, `adjust_lot` accepts lot B at 1,100 lbs and refuses 1,100.001 lbs.
- [x] **AC-0064.** In the sale fixture with lot B corrected to 1.90 per lb, a batch of 500 raw lbs of 502 produced 2026-10-08 has a raw cost total of 950.0000 and its `production_batch_lots` row a lot cost of 1.9000.
- [x] **AC-0065.** In the sale fixture with lot B corrected to 1.90 per lb and the 5,000-lb sale, the trace view gives 1.9000 as the raw lot cost per lb on every row for lot B.
- [x] **AC-0066.** With RAW-TOM at 0 lbs on hand and an average of 1.8000, receive lot L1 of 1,000 lbs at 18.00 received 2026-10-02, L2 of 1,000 lbs at 20.00 received 2026-10-03, and L3 of 1,000 lbs at 2.00 received 2026-10-04; produce 2,500 raw lbs of 502 on 2026-10-05 and reverse that batch; adjust L3 to 0 lbs as waste; then void L1 and then L2. RAW-TOM's average is 1.8000.
- [x] **AC-0067.** In the sale fixture, `void_receipt` refuses lot B, which batch 1 still uses, after batch 2 is reversed.

Invariants

- [x] **AC-0068.** Each finished lot of a batch that is not reversed has remaining lbs equal to its produced lbs minus the lbs on lines of non-void sales drawn from it.
- [x] **AC-0069.** Each non-void lot's remaining lbs is at most its current weight minus its used lbs.
- [x] **AC-0070.** Each non-void lot's remaining lbs equals its current weight minus its used lbs minus its lbs removed by adjustments.
- [x] **AC-0071.** No void lot has an adjustment row, or a `production_batch_lots` row whose batch is not reversed.
- [x] **AC-0072.** Each reversed batch's finished lot has 0 lbs remaining.
- [x] **AC-0073.** No reversed batch's finished lot has a line of a non-void sale.
- [x] **AC-0074.** Each `production_batch_lots` row's lot cost equals its lot's current cost.
- [x] **AC-0075.** Each finished lot's cost per lb equals its batch's cost per finished lb.
- [x] **AC-0076.** Each sale line's cost per lb equals its finished lot's cost per lb.
- [x] **AC-0077.** Each batch's raw cost total equals the sum of lbs consumed times lot cost over its `production_batch_lots` rows, rounded to 4 decimals.
- [x] **AC-0078.** Each lot's current cost and weight equal its latest correction's new cost and weight, or its recorded cost and weight when it has no correction.
- [x] **AC-0079.** Each raw product with lbs on hand has an average equal to the sum of its lots' remaining lbs times current cost, divided by its lbs on hand, rounded to 4 decimals.

Alerts

- [x] **AC-0080.** In the cost fixture with a fifth receipt at 1.90 and its open cost alert, correcting that lot to 1.66 per lb and running a watch marks the alert cleared.
- [x] **AC-0081.** In the cost fixture with a fifth receipt at 1.90 and its open cost alert, correcting each of the four earlier receipts to 1.90 per lb and running a watch marks the alert cleared.
- [x] **AC-0082.** In the cost fixture with a fifth receipt at 1.66, correcting that lot to 1.90 per lb and running a watch opens a cost alert for it whose figures give a cost of 1.9000 and a usual cost of 1.6600.
- [x] **AC-0083.** In the yield fixture with a batch of 700 finished lbs and its open yield alert, reversing that batch and running a watch marks the alert cleared.
- [x] **AC-0084.** In the yield fixture with three earlier batches of 750 finished lbs, reversing one of them before the watch leaves a fourth batch of 790 finished lbs with no yield alert.
- [x] **AC-0085.** In the stock fixture with its open low-stock alert, reversing the 2,100-lb batch produced 2026-10-13, then adjusting the 6,000-lb receipt to 800 lbs as waste, and running a watch marks the alert cleared.
- [x] **AC-0087.** In the cost fixture with a fifth receipt at 1.90 whose cost alert is the only open urgent alert, correcting that lot to 1.66 per lb on `/receiving` shows the "Receipt corrected" panel with no urgent banner, without a reload.

Correct on `/receiving`

- [x] **AC-0090.** In Recent receipts, each non-void receipt shows a button named "Correct", and a void receipt shows none.
- [x] **AC-0091.** Each listed receipt shows its current weight and current cost per lb: after the AC-0010 correction, lot A shows "$1.8600/lb".
- [x] **AC-0092.** A corrected receipt also shows "Received as <recorded weight> at <recorded cost per lb>.", such as "Received as 5,000 lbs at $1.6800/lb."
- [x] **AC-0093.** A corrected receipt also shows "Corrected: <its latest correction's reason>".
- [x] **AC-0094.** Pressing Correct opens a confirmation named "Correct receipt <lot number>" whose cost per lb field holds the receipt's current cost with 4 decimals, such as "1.6800", whose weight field holds its current weight with 3 decimals, such as "5000.000", and whose reason field is empty.
- [x] **AC-0095.** The confirmation's accessible description contains the lot number, the vendor, and the current weight in the AC-0091 format.
- [x] **AC-0096.** In the sale fixture with the 5,000-lb sale, confirming lot B at 1.90 per lb and 3,000 lbs with a reason shows a "Receipt corrected" heading with lot B's number, and before-and-after rows of cost per lb $1.8000/lb to $1.9000/lb, weight 3,000 lbs to 3,000 lbs, remaining 1,000 lbs to 1,000 lbs, on hand 1,000 lbs to 1,000 lbs, and average cost $1.8000/lb to $1.9000/lb.
- [x] **AC-0097.** In the AC-0096 case, the panel lists under "Batches restated", in draw order, batch 1 with 502, Oct 6, 2026, and cost per finished lb $2.6578/lb to $2.6794/lb, then batch 2 with 502, Oct 7, 2026, and $2.7877/lb to $2.9175/lb.
- [x] **AC-0118.** In the AC-0096 case with batch 2 reversed before the correction, the "Batches restated" list shows batch 2 marked "Reversed".
- [x] **AC-0098.** In the AC-0096 case, the panel lists 502 Smoked Turkey Drums Tom with suggested price before $2.84/lb and after $2.97/lb.
- [x] **AC-0099.** When a correction changes only the weight, or no batch is made from the receipt, the panel says "No batch cost changed." in place of the "Batches restated" list.
- [x] **AC-0100.** After a correction, Recent receipts shows the receipt's new values, without a reload.
- [x] **AC-0101.** After the receipt shown in the "Receipt saved" panel is corrected from this page's Recent receipts, that panel says "This receipt was corrected." and no longer shows its before-and-after totals.
- [x] **AC-0102.** Confirming a cost or weight that matches a Weight or Cost per lb row of the receiving spec's AC-0010 table shows that row's message beside the field and changes nothing.
- [x] **AC-0103.** Confirming with a blank or spaces-only reason shows "Enter a reason for the correction." beside the reason field and changes nothing.
- [x] **AC-0104.** Confirming the cost and weight the receipt already has, whether the page or the database finds them unchanged, shows "Change the cost or the weight to correct this receipt." and changes nothing.
- [x] **AC-0105.** In the sale fixture, confirming lot B at 1,999.999 lbs shows "The weight can't be less than 2,000 lbs. Production used or adjustments removed that much of this receipt." beside the weight field and changes nothing.
- [x] **AC-0106.** After an AC-0102, AC-0103, AC-0104, or AC-0105 refusal, the confirmation stays open with every field as the owner typed it.
- [x] **AC-0107.** When the receipt was voided after the list loaded, confirming a correction closes the confirmation and shows, in Recent receipts, a message that starts "The receipt wasn't corrected." and contains "Reload to see the latest stock.", and changes nothing.
- [x] **AC-0108.** When the session has ended after the list loaded, confirming a correction closes the confirmation, shows "You're signed out. Sign in again to correct this receipt." in Recent receipts, and changes nothing.
- [x] **AC-0109.** When a call the correction makes before its write call fails or gets no answer within the 10-second limit, Recent receipts shows a message that starts "The receipt wasn't corrected." and nothing changes.
- [x] **AC-0110.** When the `correct_receipt` call gets no answer within the 10-second limit, Recent receipts shows "The receipt may not have been corrected. Reload this page to see whether it was."
- [x] **AC-0116.** When the connection to the app drops while a correction is in flight, Recent receipts shows the AC-0110 message.
- [x] **AC-0111.** When `correct_receipt` returns and a read after it fails, the page shows the "Receipt corrected" heading with the lot number and "The new figures couldn't be loaded. Reload to see them." in place of the rows.
- [x] **AC-0112.** While a correction has not returned, pressing Save correction again writes no second correction.
- [x] **AC-0113.** Cancel closes the confirmation and changes nothing.
- [x] **AC-0114.** An untouched receipt shows both Void and Correct, and an in-use receipt shows "In use" and Correct.
- [x] **AC-0115.** A receipt whose only batch is reversed, and an untouched receipt whose weight was corrected, each show a Void button.
- [x] **AC-0117.** When `correct_receipt` is refused for a reason AC-0104, AC-0105, and AC-0107 do not name, such as the statement timeout that a lock held for more than 8 seconds on the raw product's stock row causes, confirming closes the confirmation, shows in Recent receipts a message that starts "The receipt wasn't corrected.", and changes nothing.

Reverse on `/production`

- [x] **AC-0130.** In Recent batches, each batch that is not reversed shows a button named "Reverse".
- [x] **AC-0131.** A reversed batch shows "Reversed: <reason>" and no Reverse button.
- [x] **AC-0132.** Pressing Reverse opens a confirmation named "Reverse batch <batch number>" that lists each lot the batch drew from, with its lot number and the lbs that go back to it, and the batch's finished lbs, as lbs that leave stock.
- [x] **AC-0133.** The confirmation lists under "Sales to be voided" each non-void sale with a line on the batch's finished lot, with its sale number, sale date, customer or "No customer", and lbs, or says "No sale drew from this batch."
- [x] **AC-0134.** The confirmation's accessible description contains the batch number, its production date, and its finished lbs.
- [x] **AC-0135.** In the sale fixture with the 5,000-lb sale, confirming the reversal of batch 2 with the reason "entered twice" shows a "Batch reversed" heading with batch 2's number, and before-and-after rows of RAW-TOM on hand 1,000 lbs to 2,000 lbs, average cost $1.8000/lb to $1.8000/lb, and 502 finished lbs on hand 390 lbs to 4,620 lbs.
- [x] **AC-0136.** In the AC-0135 case, the panel lists under "Sales voided" the 5,000-lb sale with its sale number, Oct 8, 2026, Fulton Market Deli, 5,000 lbs, and $3.29/lb, and says "Record these sales again on Sales."
- [x] **AC-0137.** When the reversal voids no sale, the panel says "No sale was voided." in place of the "Sales voided" list.
- [x] **AC-0138.** After a reversal, Recent batches shows the batch as reversed, without a reload.
- [x] **AC-0139.** Confirming with a blank or spaces-only reason shows "Enter a reason for the reversal." beside the reason field, keeps the confirmation open, and changes nothing.
- [x] **AC-0140.** When the batch was reversed after the list loaded, confirming closes the confirmation and shows, in Recent batches, a message that starts "The batch wasn't reversed." and contains "Reload to see the latest stock.", and changes nothing.
- [x] **AC-0141.** When the session has ended after the list loaded, confirming a reversal closes the confirmation, shows "You're signed out. Sign in again to reverse this batch." in Recent batches, and changes nothing.
- [x] **AC-0142.** After the batch shown in the batch result panel is reversed from this page's Recent batches, that panel says "This batch was reversed." and no longer shows its lots used, finished stock, or raw stock.
- [x] **AC-0143.** When a call the reversal makes before its write call fails or gets no answer within the 10-second limit, Recent batches shows a message that starts "The batch wasn't reversed." and nothing changes.
- [x] **AC-0144.** When the `reverse_batch` call gets no answer within the 10-second limit, Recent batches shows "The batch may not have been reversed. Reload this page to see whether it was."
- [x] **AC-0149.** When the connection to the app drops while a reversal is in flight, Recent batches shows the AC-0144 message.
- [x] **AC-0145.** When `reverse_batch` returns and a read after it fails, the page shows the "Batch reversed" heading with the batch number and "The new figures couldn't be loaded. Reload to see them." in place of the rows.
- [x] **AC-0146.** In the sale fixture, a 4,700-lb sale of 502 written through `pg` after `/production` loads, then the reversal of batch 2 confirmed on the page, lists that sale under "Sales voided".
- [x] **AC-0147.** Cancel closes the confirmation and changes nothing.
- [x] **AC-0148.** When 502 is made inactive after `/production` loads, the "Batch reversed" panel shows its finished lbs on hand after as "Not available".
- [x] **AC-0150.** When `reverse_batch` is refused for a reason AC-0140 does not name, such as the statement timeout that a lock held for more than 8 seconds on the raw product's stock row causes, confirming closes the confirmation, shows in Recent batches a message that starts "The batch wasn't reversed.", and changes nothing.
- [x] **AC-0151.** The check step says "Check it before you save. Reversing a batch later voids every sale made from it." and does not say "A batch can't be undone."

Current values on other pages

- [x] **AC-0160.** After the AC-0010 correction, lot A's cost per lb shows as $1.8600/lb on lot A's trace page and under batch 1 on the 5,000-lb sale's trace page.
- [x] **AC-0161.** After lot B is corrected to 3,100 lbs, lot B's trace page shows its weight received as 3,100 lbs.
- [x] **AC-0162.** After lot B is corrected to 3,100 lbs, the lot finder's list for RAW-TOM shows lot B's weight as 3,100 lbs.

Accessibility and phone width

- [x] **AC-0170.** axe-core reports zero violations for the WCAG tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` in each page state.
- [x] **AC-0171.** At a 320 × 640 CSS px viewport, in each page state, the page's scroll width is at most 320 CSS px.
- [x] **AC-0172.** At a 320 × 640 CSS px viewport, in each page state, every focusable control is at least 44 CSS px tall and 44 CSS px wide.
- [x] **AC-0173.** Correcting a receipt and reversing a batch can each be completed with the keyboard alone.
- [x] **AC-0174.** After a correction, keyboard focus is on the "Receipt corrected" heading, and after a reversal, on the "Batch reversed" heading.
- [x] **AC-0175.** After an AC-0102, AC-0103, AC-0105, or AC-0139 refusal, keyboard focus is on the first field with an error.
- [x] **AC-0176.** After an AC-0104 refusal, keyboard focus is on the message that states it.
- [x] **AC-0177.** After an AC-0107, AC-0108, AC-0109, AC-0110, AC-0116, AC-0117, AC-0140, AC-0141, AC-0143, AC-0144, AC-0149, or AC-0150 outcome, keyboard focus is on the message that states it.
- [x] **AC-0178.** After Cancel in either confirmation, keyboard focus is on the button that opened it.
- [x] **AC-0179.** The accessible name of the correction's cost field contains "per lb", and that of its weight field contains "lbs".
- [x] **AC-0180.** In each page state, every focusable control, when focused from the keyboard, has a computed outline style other than `none` and an outline width of at least 2 CSS px.
- [x] **AC-0181.** In each page state, every focusable control, when focused from the keyboard, has a contrast ratio of at least 3:1 between its computed outline color and the background color behind it.
- [x] **AC-0182.** After an AC-0102, AC-0103, AC-0105, or AC-0139 refusal, the `aria-describedby` of every field with an error points to that field's message.

Build and repository checks

- [x] **AC-0189.** `git diff <merge base with main> -- test/costing.test.ts test/engine.test.ts test/corrections.test.ts test/pricing.test.ts` prints nothing.
- [x] **AC-0190.** `npm run build` exits 0.
- [x] **AC-0191.** `npm test` runs the Vitest suites and then the Playwright suite, and exits 0.
- [x] **AC-0192.** Running `npm run gen:types` leaves `src/lib/database.types.ts` with no diff.
- [x] **AC-0193.** `npm run typecheck` exits 0.
- [x] **AC-0194.** `grep -rnE "\.(insert|update|upsert|delete)\(" src/` prints nothing.
- [x] **AC-0195.** `grep -rnE "from ['\"][^'\"]*app/" src/lib/` prints nothing.
- [x] **AC-0196.** `npm audit --omit=dev --audit-level=high` exits 0, or every high or critical advisory it reports appears in the Advisory waivers list above.
- [x] **AC-0197.** `grep -rnE "['\"]pg(-pool)?(/[^'\"]*)?['\"]" src/` prints nothing.
- [x] **AC-0198.** No code under `src/` reads a privileged variable, except `src/privileged-env.ts`, which reads no environment value at all. Each of these prints nothing:
  - `grep -rniE "env(\.|\[['\"])[a-z0-9_]*(service_role|secret|jwt|db_url|database_url|postgres)" src/ | grep -v '^src/privileged-env.ts:'`
  - `grep -rnE "\}\s*=\s*process\.env" src/`
  - `grep -nE "process\.env(\.|\[)" src/privileged-env.ts`
- [x] **AC-0199.** `git diff <merge base with main> -- package.json src/ | grep -iE '^\+.*(anthropic|openai|@ai-sdk|langchain)'` prints nothing.
- [x] **AC-0200.** Compared with the local database built from the merge base with `main`, every base table and view in `public` keeps every column it had, with the same name, type, and position.
- [x] **AC-0201.** Compared with the local database built from the merge base with `main`, the only table or view in `public` this branch adds is the table `receipt_corrections`, the only tables that gain columns are `lots` (`corrected_unit_cost`, `corrected_weight_lbs`, `current_unit_cost`, `current_weight_lbs`) and `production_batches` (`reversed_at`, `reversal_reason`), and the only functions it adds in `public` are `correct_receipt` and `reverse_batch`.
- [x] **AC-0202.** `correct_receipt` and `reverse_batch` are SECURITY DEFINER, and each has `proconfig` exactly `{search_path=""}`, as a `pg_proc` read shows.
- [x] **AC-0203.** Every function this branch replaces keeps the security mode, `proconfig`, and EXECUTE grants it had on the local database built from the merge base with `main`, as two `pg_proc` and `has_function_privilege` reads compared show.
- [x] **AC-0204.** `anon`, `authenticated`, and `service_role` each hold no privilege on the identity sequence of `receipt_corrections`.

## Follow-ons

- jaketlee07: [`docs/product/intents/zero-stock-average-recompute.md`](../../product/intents/zero-stock-average-recompute.md), whose recompute also replaces the kept average after a cost correction that leaves 0 lbs on hand, and a void's zero-stock value that carries a corrected receipt's cost.

## Assumptions

- Technical: lots keep their recorded cost and weight frozen by `lots_guard`, in every role; nullable `corrected_unit_cost` and `corrected_weight_lbs` columns with stored generated `current_unit_cost` and `current_weight_lbs` columns work on Postgres 17.6, a generated column refuses a direct write, and a check on the current weight refuses remaining lbs above it (source: rolled-back probe on stack A, 2026-10-14)
- Technical: a batch's processing fees come back exactly as its cost per finished lb minus round(sum of lbs consumed times lot cost ÷ finished lbs out, 4), because `product_fees.amount_per_lb` is `numeric(10,4)`; in the sale fixture the fee as used is 0.4500 for both batches (source: `supabase/migrations/0001_init.sql`; rolled-back probe 2026-10-14)
- Technical: over the sale fixture, the engine gives batch 1 10200.0000 and 2.6578 and batch 2 1800.0000 and 2.7877; restated with lot A at 1.86, batch 1 is 11100.0000 and 2.8526; with lot B at 1.90, 2.6794 and 2.9175; with lot B at 0, 2.2682 and 0.4500; back at the recorded cost, every figure returns (source: rolled-back probes 2026-10-14)
- Technical: `record_sale` copies the finished lot's cost into each sale line, and nothing else writes that column (source: `supabase/migrations/20261007181933_engine_hardening.sql`)
- Technical: `void_receipt`, `adjust_lot`, `refresh_balance`, `produce_batch`, the trace view, and the per-test conservation and average checks read `lots.unit_cost` or `weight_lbs` and count every `production_batch_lots` row (source: `supabase/migrations/20261007183252_corrections.sql`, `20261013155724_sales_trace.sql`, `20261007181933_engine_hardening.sql`; `test/db.ts`)
- Technical: a backend waiting on a raw product's `inventory_balances` row holds a `RowShareLock` relation lock only on `inventory_balances` and its primary key, and only `AccessShareLock` on tables it has just read (source: rolled-back probe on stack A, 2026-10-15)
- Technical: `now()` is one value for every statement of a transaction, so the sales a reversal voids share the batch's reversal time (source: rolled-back probe 2026-10-14)
- Technical: Recent receipts and Recent batches each list the 10 most recent per product (source: `RECENT_RECEIPT_LIMIT` in `src/lib/receiving.ts`, `RECENT_BATCH_LIMIT` in `src/lib/production.ts`)
- Technical: `test/access.test.ts` sweeps every `public` table and function from the catalog, so the new table joins its read checks and each new function needs a `validArgs` entry (source: `test/access.test.ts`)
- Technical: stack A runs Postgres 17.6, and this folder uses stack A (source: `select version()` on stack A, 2026-10-14; no `supabase/.env`)
- Technical: business accounting systems pass a cost change on an inbound receipt to the outbound entries it fed, consumption and cost of goods sold included (source: [Microsoft Learn, Design Details: Cost Adjustment](https://learn.microsoft.com/uk-ua/dynamics365/business-central/design-details-cost-adjustment))
- Product: correcting a used receipt's cost restates every batch, finished lot, and sale line made from it (source: user confirmation 2026-10-14)
- Product: reversing a batch voids every non-void sale with a line on its finished lot, in the same step, as `void_sale` voids a sale; then the owner re-enters the batch and records those sales again (source: user confirmation 2026-10-14)
- Product: Correct sits on each non-void receipt in Recent receipts and Reverse on each batch in Recent batches, so only the 10 most recent per product can be reached (source: user confirmation 2026-10-14)
- Product: a cost correction that leaves the raw product at 0 lbs on hand keeps the stored average until the next receipt, as the zero-stock rule does; the zero-stock intent's recompute replaces this later (source: user confirmation 2026-10-14)
- Product: Correct changes only cost per lb and weight; vendor, received date, product, and lot number stay as received (source: user confirmation 2026-10-14)
- Product: a void that leaves 0 lbs on hand can bring back a corrected receipt's cost through a later lot's prior average, as when a lot typed at 18.00 and corrected to 1.80 was on hand when the next lot arrived; this is accepted as part of the zero-stock known limit, which the zero-stock intent's recompute replaces (source: user confirmation 2026-10-15)
- Product: every page that shows a lot's weight or cost per lb shows its current values, the Trace lot finder included (source: user confirmation 2026-10-15)
- Product: a cost alert's next step tells the owner to correct the receipt on Receiving, in place of voiding it before production uses it (source: user confirmation 2026-10-14, with the build order)
- Product: Production's check step carries AC-0151's sentence in place of "A batch can't be undone." (source: user confirmation 2026-10-15)
- Product: Correct appears on every non-void receipt, untouched ones included, which keep Void too (source: user confirmation 2026-10-14)
- Product: a weight correction moves the lot's remaining lbs by the same amount and is refused when that would go below 0; a correction is undone by correcting back (source: user confirmation 2026-10-14)
- Product: a reversed batch stays in Recent batches marked "Reversed" with its reason; a reversal cannot be undone, and later batches are not re-run first-in, first-out, so the next batch draws the returned lbs first (source: user confirmation 2026-10-14)
- Product: a sale voided by a reversal has the reason "Reversed with batch <number>: <reason>", and the result lists each such sale's date, customer, lbs, and price per lb so the owner can record it again (source: user confirmation 2026-10-14)
- Product: design goals in order are hard to mistype, fast on a phone, and numbers easy to trust; plain, high contrast, no decoration; the experience-design pack is not installed, so design intent for these surfaces is grounded only in these goals (source: production, menu-pricing, and sales spec Assumptions; skill roster, 2026-10-14)
- Process: `SYSTEM-SPEC.md` §5's "six operations" becomes eight, and §11's boundary names the operations in §5 (source: user confirmation 2026-10-14)
- Process: one spec covers both correcting a receipt and reversing a batch, as the owner asked (source: the owner's request, 2026-10-14)
- Process: the build starts after Alerts merges into `main`; Alerts' build starts after Sales and Invoice entry merge (source: user confirmation 2026-10-14; commit `895d232` on `feat/alerts`)
- Process: this spec keeps its own Advisory waivers list, and shipped dependencies are audited with `npm audit --omit=dev --audit-level=high` before merge (source: receiving and sales spec Assumptions)
- Process: the owner approves the spec and the plan in chat, and the agent records the Approved status; the build starts in a later session in this worktree (source: the owner's request, 2026-10-14)
