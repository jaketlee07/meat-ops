# Plan: corrections

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:**
  - **Area rules and access model:** `docs/architecture/overview.md` (areas, access model, write path, failure notes); `docs/costing.md` (the rules this work changes).
  - **Analogous implementations:** the engine's correction operations in `supabase/migrations/20261007183252_corrections.sql` (`void_receipt`, `void_sale`, `adjust_lot`: caller check, argument checks before the lock, lock, then state checks); `produce_batch` and `record_sale` in `supabase/migrations/20261007181933_engine_hardening.sql`; the receipt void in `src/app/receiving/void-dialog.tsx` and `voidReceipt` in `src/app/receiving/actions.ts`; the sale void and its decision module, `src/app/sales/void-dialog.tsx` and `src/app/sales/save-sale.ts`.
  - **Their tests:** `test/corrections.test.ts`, `test/engine.test.ts`, `test/costing.test.ts`, `test/access.test.ts`, `test/save-sale.test.ts`, `test/sales-rules.test.ts`, `test/sales-data.test.ts`, and the browser suites `test/e2e/receiving.spec.ts` (void) and `test/e2e/sales.spec.ts` (void), with `test/e2e/a11y.ts`. Fixtures come from `test/db.ts` (`resetTestData`, `saleFixture`, `callAsClient`, `callAsOperator`, `raceCalls`, `tableFingerprints`, `assertLedgerInvariants`, `assertAverageIsStockOnHand`) and `test/users.ts`.
  - **Named deviations:** the correction and reversal dialogs are new client components on the receipt void dialog's pattern rather than a shared component, because `docs/product/intents/shared-display-parts.md` owns moving shared parts. Each dialog shows its result panel and its messages inside its own list item, so a list re-render after the write keeps them; the receiving and production result panels learn of a correction or reversal from the page's lists, as receiving's panel learns of a void.
  - **Probes on the local stack, 2026-10-14,** each in a rolled-back transaction, recorded in the spec's Assumptions: the generated current columns and the current-weight check; the fee as used and the restated costs over the sale fixture; the sheet price of 502 at averages 1.80 and 1.90 (2.8377 and 2.9675); `now()` held across a transaction.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/corrections/notes/verification-ledger.md`. A genuine artifact error
> follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material.

## Approach

The work lands as dependency-ordered layers on `feat/corrections`, rebased onto
a `main` that holds Alerts. Each layer is its own commits and leaves `npm test`
green.

1. **Engine (T1, T2).** One migration adds the current cost and weight, the corrections table, `correct_receipt`, and the replaced readers; a second adds the reversal marks, `reverse_batch`, and the replaced counters. The operation suites and the invariant checks come first in each.
2. **Alerts (T3).** One migration replaces the alert functions that read a lot's cost or count batches, and the cost alert's next step.
3. **App logic (T4, T5, T6).** Pure form rules and messages, then the reads, then the two actions' decisions.
4. **Pages (T7, T8).** Correct on `/receiving`, then Reverse on `/production`.
5. **Closing (T9).** The docs, the goal-based checks, the recorded run, and the rendered-page inspection.

The estimate is about 6,000 reviewable lines, so the shape is MIXED: the layers
are the decomposition. One review unit at the end reviews the layers in order,
each named by its commit range, so an engine finding is read before the pages
built on it.

The riskiest part is the restatement. A wrong fee, a missed sale line, or a
batch left on the recorded cost would make costs drift silently. The cost-chain
checks in `test/db.ts` run after every test of each suite that registers them,
which includes every suite that calls the two operations and most existing
database suites, so a missed row turns red in the test that caused it.

## Constraints

- `SYSTEM-SPEC.md` §2 and §11: the app computes no stock, cost, or price, and changes the ledger only through operations, here also `correct_receipt` and `reverse_batch`.
- `AGENTS.md` hard rules 1 to 7, the folder check before every test run, and the stack A steps.
- The access model, write path, and app trust boundary in `docs/architecture/overview.md`: every server action settles the caller through `src/app/_server/caller.ts`; every server-side client uses the 10-second request limit in `src/app/_server/session.ts`; each new table and function revokes its default privileges, then grants back only what the access model names.
- The sales spec's rule that a sale is undone only by a void with a reason: `reverse_batch` voids a sale exactly as `void_sale` does.
- No ADR or RFC governs this area.

## Construction tests

**Integration tests:** the registration of the two checks is the spec's Testing Strategy list: `assertLedgerInvariants` in every Vitest suite that calls the two operations, `test/access.test.ts` included, and in the ten suites that register it today; `assertAverageIsStockOnHand` in the two operation suites, `test/engine.test.ts`, and `test/corrections.test.ts`. The T1 and T2 stubs register `assertLedgerInvariants`, and EXECUTE adds `assertAverageIsStockOnHand` to the same `afterEach` in those two suites.

**Manual verification:** the T9 recorded run.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Costing truth, `docs/costing.md` | T1 (current cost and weight, `correct_receipt`, the restatement rule, invariants 4 and 6, the cost chain, the `void_receipt` and `adjust_lot` weight), T2 (`reverse_batch`, used lbs, the void lot rule), T9 (the opening's suite names) | The T1 and T2 suites assert every expected figure the new sections state | close-work finds each statement and each figure in a passing assertion |
| Master brief, `SYSTEM-SPEC.md` §4, §5, §7, §11 | T1 (§4 lots and table, §5 correct, §11), T2 (§4 batch marks, §5 reverse, void and adjust), T3 (§7) | The edited entries | close-work finds each entry matching the migrations |
| Architecture and app trust boundary, `docs/architecture/overview.md` | T9 | The rows and sentences the spec's Durable Outputs row names | close-work reads each against `src/`, `supabase/`, and `test/` |
| The Alerts contract, `docs/specs/alerts/spec.md` | T3 | The amended AC-0102 sentence and rule definitions with their notes | close-work finds the amended text |
| Zero-stock average intent | T1 | Its Outcome sentences | close-work finds them |
| Shipped ledger criteria, `docs/specs/foundation-hardening/spec.md` | T1 (AC-0028 and its definition, AC-0031, AC-0054 notes), T2 (AC-0032, AC-0033, AC-0035, AC-0038, AC-0039 notes) | The nine notes | close-work finds them |
| Production's check step, `docs/specs/production/spec.md` AC-0014 | T8 | The note and AC-0151 in the browser suite | close-work finds the note |
| Backlog, `workspace.toml` | none: close-work moves the entry | n/a | close-work moves it |
| Interface compatibility, `src/lib/database.types.ts` | T1, T2 (regenerated), T9 (AC-0192) | AC-0192 output in the ledger | `npm run gen:types` leaves no diff |

Every design fact below shows in code and tests or is delivery residue, except
four that belong in durable owners: the restatement rule and the fee kept
(`docs/costing.md`, T1), what a reversal returns and voids (`docs/costing.md`,
T2), the two operations' locks (`docs/architecture/overview.md` write path,
T9), and the dialogs' failure texts (`docs/architecture/overview.md` failure
notes, T9).

## Design (LLD)

### Design decisions

- **A lot keeps what was received and gains what is current.** `unit_cost` and `weight_lbs` stay frozen by `lots_guard`. Two nullable columns, `corrected_unit_cost` and `corrected_weight_lbs`, hold the latest correction, and two stored generated columns, `current_unit_cost` and `current_weight_lbs`, give `coalesce(corrected, recorded)`. Every reader that costs or weighs a lot reads the current columns, so no reader can forget a correction. A generated column refuses a direct write, so only `correct_receipt` changes what is current. Rejected: a mutable current column that `receive_lot` fills, which changes `receive_lot` and every insert path; a lookup of the latest correction in every reader, which a forgotten reader silently skips. Traces to: AC-0011, AC-0074, AC-0078, AC-0079.
- **A correction restates forward, in place, with a record.** `receipt_corrections` holds each correction's old and new cost and weight. The lot's consumption rows take the new cost; each batch made from the lot gets a new raw cost total and cost per finished lb; its finished lot and every sale line on that finished lot take that cost. Reversed batches are restated too, so the cost chain holds for every row. The old derived figures are reproducible from the correction rows, so no restatement table is kept. Traces to: AC-0010 to AC-0019, AC-0073 to AC-0077.
- **The fee as used is recovered, not re-read.** For each batch, `fee = cost_per_finished_lb − round(Σ lbs_consumed × lot_unit_cost ÷ finished_lbs_out, 4)`, taken before its rows are restated, and the restated cost is `round(Σ new ÷ finished_lbs_out, 4) + fee`. Fees are `numeric(10,4)`, so this fee equals the sum the batch was costed with, and correcting back returns the exact old cost. Rejected: today's fees, which would fold a fee change into a cost fix (AC-0018). Traces to: AC-0012, AC-0016, AC-0018, AC-0019, AC-0031.
- **A weight correction moves remaining lbs by the same amount.** The floor is `current_weight_lbs − remaining_lbs`, what production used and adjustments removed. The `lots` check becomes `remaining_lbs between 0 and current_weight_lbs`. Traces to: AC-0020 to AC-0024, AC-0063.
- **Zero stock keeps the stored average.** `correct_receipt` calls `private.refresh_balance(product)` with no zero-stock value, so at 0 lbs on hand the stored average stays, as the zero-stock rule says. Traces to: AC-0022, AC-0025.
- **A reversal is a void of the batch.** `production_batches` gains `reversed_at` and `reversal_reason`, both set or both empty. A lot's used lbs count only batches that are not reversed, so `void_receipt`, `adjust_lot`, and `void_receipt`'s second zero-stock step read through that filter, and a lot whose only batch is reversed is untouched again. The consumption rows stay as the record of what was drawn and returned. Rejected: deleting the rows (loses the trace record) and negative rows (breaks `lbs_consumed > 0` and every reader that sums them). Traces to: AC-0040 to AC-0043, AC-0060 to AC-0062, AC-0066, AC-0067, AC-0070 to AC-0072.
- **A reversal voids each sale as `void_sale` does.** Every non-void sale with a line on the batch's finished lot gets each line's lbs back on its finished lot, then `voided_at = now()` and `void_reason = 'Reversed with batch <number>: <reason>'`. Then the finished lot goes to 0 lbs and each consumption row's lbs go back to its lot. `now()` is the transaction's time, so those sales and the batch share one time, which is how the result finds the sales it voided. Traces to: AC-0044 to AC-0047, AC-0073, AC-0136, AC-0146.
- **Locks follow the existing order: raw product, then finished product.** `correct_receipt` locks the raw product's balance row, the lot, and then, in id order, `FOR NO KEY UPDATE` on each finished product made from the lot, so it queues behind and ahead of `record_sale` and `void_sale` on those products. `reverse_batch` locks the raw product's balance row, then its finished product, then the batch. No operation takes them in the other order. Traces to: AC-0035, AC-0036, AC-0050, AC-0051.
- **The read after the write reads one thing the read before does not.** The correction's read after also reads the new correction row, whose reason the panel shows, and the reversal's read after reads the voided sales through `sale_items`; neither read before touches those. So the browser suite reaches AC-0111 by revoking the operator's SELECT on `receipt_corrections` after the page loads, and AC-0145 by revoking it on `sale_items` after the confirmation opens, each restored whether or not the test passes. Traces to: AC-0111, AC-0145.
- **No two operations take the raw and finished locks in opposite orders.** Every operation that takes both takes the raw product's balance row before any other row lock, and the finished product's `products` row before any batch, finished lot, sale, or sale line row, and `record_sale` and `void_sale` take the `products` row first, so no pair can wait on each other. `correct_receipt` takes the finished products `FOR NO KEY UPDATE OF products`, so the subquery that finds them only reads the batches. AC-0039 and AC-0055 check the order directly through the waiting backend's relation locks in `pg_locks`, because a deadlock needs real timing that a test cannot force; AC-0038's sweep checks the invariants after both interleavings `raceCalls` produces for each pair. Traces to: AC-0037, AC-0038, AC-0039, AC-0053, AC-0055.
- **Each dialog owns its result.** The Correct and Reverse controls stay mounted for every non-void receipt and every batch, so a list re-render after the write keeps their state; each shows its result panel and its messages inside its own list item and moves focus to them. Traces to: AC-0096, AC-0107, AC-0135, AC-0140, AC-0174, AC-0177.
- **Before and after are two reads.** The correct and reverse decisions read the figures before the write and again after it; nothing is worked out from the other. The suggested prices reuse `listFinishedPrices`, the stock reuses `getStock`, and the finished lbs reuse `getFinishedOnHand`. Traces to: AC-0096, AC-0097, AC-0098, AC-0135, AC-0148.

### Data & schema

- `supabase/migrations/<ts>_receipt_corrections.sql` (T1), created with `supabase migration new receipt_corrections`:
  - `lots`: `corrected_unit_cost numeric(12,4)` (check `>= 0`), `corrected_weight_lbs numeric(14,3)` (check `> 0`), `current_unit_cost numeric(12,4) generated always as (coalesce(corrected_unit_cost, unit_cost)) stored`, `current_weight_lbs numeric(14,3) generated always as (coalesce(corrected_weight_lbs, weight_lbs)) stored`; drop `lots_check`, add `lots_remaining_range check (remaining_lbs >= 0 and remaining_lbs <= current_weight_lbs)`.
  - `public.receipt_corrections`: `id uuid` key, `lot_id uuid not null references lots`, `old_unit_cost`, `new_unit_cost numeric(12,4) not null`, `old_weight_lbs`, `new_weight_lbs numeric(14,3) not null`, `reason text not null`, `corrected_at timestamptz not null default now()`, `correction_seq bigint generated always as identity` (the latest correction is the highest number, since two in one transaction share a time); index on `lot_id`; `revoke all` from `public, anon, authenticated, service_role` on the table and its identity sequence; row level security on; `operators_select` policy; `grant select` to `authenticated, service_role`.
  - `public.correct_receipt(p_lot_id uuid, p_unit_cost numeric, p_weight_lbs numeric, p_reason text) returns public.lots`, `security definer`, `set search_path = ''`; `revoke all` then `grant execute` to `authenticated`.
  - `create or replace` of `private.refresh_balance` (current cost), `public.produce_batch` (current cost in the consumption row and the total), `public.void_receipt` (remaining against current weight), `public.adjust_lot` (cap from current weight), each with its signature and grants unchanged, and `public.v_sale_traceability` `with (security_invoker = true)` with `l.current_unit_cost` as `raw_lot_cost_per_lb`.
- `supabase/migrations/<ts>_batch_reversal.sql` (T2): `production_batches.reversed_at timestamptz`, `reversal_reason text`, `production_batches_reversal_pair check ((reversed_at is null) = (reversal_reason is null))`; `public.reverse_batch(p_batch_id uuid, p_reason text) returns public.production_batches`, granted as above; `create or replace` of `void_receipt` and `adjust_lot` again, now counting only batches that are not reversed.
- `supabase/migrations/<ts>_alerts_corrections.sql` (T3): `create or replace` of each Alerts function the T3 discovery predicate finds.

### Interfaces & contracts

- Engine refusal texts, which `src/lib/failures.ts` matches: `correct_receipt: invalid reason, give at least one non-space character`; `correct_receipt: invalid unit cost, must be 0 or above`; `correct_receipt: invalid weight, must be above 0`; `correct_receipt: invalid lot <id>, not found`; `correct_receipt: lot <id> is already void`; `correct_receipt: invalid, nothing to correct`; `correct_receipt: invalid weight <w>, must be at least <min> lbs`; `reverse_batch: invalid reason, give at least one non-space character`; `reverse_batch: invalid batch <id>, not found`; `reverse_batch: batch <id> is already reversed`.
- `src/lib/rpc.ts`: `correctReceipt(client, { lotId, unitCost, weightLbs, reason }): Promise<Lot>` and `reverseBatch(client, batchId, reason): Promise<Batch>`.
- `src/lib/correction-input.ts`: `CorrectionFields { cost, weight, reason }`, `CorrectionErrors` (keys `cost`, `weight`, `reason`, `form`), `CorrectionInput { unitCost, weightLbs, reason }`, `parseCorrectionForm(fields, current: { cost, weight }): { ok: true; value: CorrectionInput } | { ok: false; errors: CorrectionErrors }`, and `parseReversalReason(text)`. The cost and weight rows reuse `NUMBER_TEXT` and `decimalPlaces` and the receiving texts; the unchanged rule compares the typed numbers with the current text's numbers.
- `src/lib/failures.ts`: `NOT_CORRECTED`, `CORRECTION_UNKNOWN`, `CORRECTION_SIGNED_OUT`, `NOT_REVERSED`, `REVERSAL_UNKNOWN`, `REVERSAL_SIGNED_OUT`, `correctionFailureMessage(error, stage)` (with the weight-floor text turned into the AC-0105 sentence through `formatWeight`, as a weight-field error, and the nothing-to-correct text turned into the AC-0104 form message), `reversalFailureMessage(error, stage)`; `LoggedAction` gains `correctReceipt` and `reverseBatch`.
- `src/lib/receiving.ts`: `RecentReceipt` gains `costText` and `weightText` (`current_unit_cost::text`, `current_weight_lbs::text`), `recordedWeightLbs`, `recordedUnitCost`, and `correctedReason` (the latest correction's reason, or null); `weightLbs` and `unitCost` become the current values, and the untouched status compares remaining with the current weight. New: `getLotFigures(client, lotId)` (number, cost and weight as text and as numbers, remaining, product id, void time) and `listBatchesMadeFrom(client, lotId)` returning `{ batchId, batchNumber, productCode, productionDate, costPerFinishedLb, reversed }[]` for every batch made from the lot, in draw order. `src/lib/trace.ts`: `findLots` and `getLotTrace` read `current_weight_lbs` and `current_unit_cost`.
- `src/lib/production.ts`: `RecentBatch` gains `reversedAt` and `reversalReason`. New: `getReversalPreview(client, batchId)` returning `{ batchNumber, productionDate, finishedLbs, lots: { lotNumber, lbs }[], sales: SaleSummary[] }`, and `listSalesVoidedBy(client, batchId)` returning the `SaleSummary` rows with a line on the batch's finished lot whose void time equals the batch's reversal time.
- `src/app/receiving/correct-receipt.ts`: `decideCorrection(lotId, fields, deps)` with `CorrectionDeps<C> { caller, readBefore, write, readAfter }` and `CorrectionState` (`invalid` with errors, `refused` with a message, `corrected` with the lot number and details or null). `src/app/production/reverse-batch.ts`: `decideReversal(batchId, reason, deps)` the same way.
- `test/db.ts`: `OperationName` gains `correct_receipt` and `reverse_batch`; `PARAM_TYPES` gains `p_batch_id`; `correctCall(lotId, cost, weight, reason)` and `reverseCall(batchId, reason)`; `ledgerViolations(run)` returns the violation rows over a given querier, and `assertLedgerInvariants` expects it empty.

### Component / module decomposition

- `src/app/receiving/`: `correct-dialog.tsx` (client: the Correct button, the native `<dialog>`, the fields, the messages, and the "Receipt corrected" panel), `correct-receipt.ts`, `actions.ts` (`correctReceipt`), `recent-receipts.tsx` (Correct beside Void or "In use"; the "Received as" and "Corrected:" lines), `page.tsx` and `receipt-form.tsx` (the corrected lots, as `voidedLots` is passed), `result-panel.tsx` (the AC-0101 line).
- `src/app/production/`: `reverse-control.tsx` (client: the Reverse button while not reversed, the dialog, the messages, and the "Batch reversed" panel), `reverse-batch.ts`, `actions.ts` (`reverseBatch`), `recent-batches.tsx`, `page.tsx` and `production-form.tsx` (the reversed batches), `result-panel.tsx` (the AC-0142 line).

### State & control flow

Page contracts, from `frontend-engineering` retrofit mode:

| Field | Correct on `/receiving` | Reverse on `/production` |
| --- | --- | --- |
| target user | The owner, at a desk with the invoice | The owner, at a desk or on the floor |
| primary job | Make a used receipt carry the right cost and weight | Take back a batch that should not exist |
| primary action | Save correction | Reverse batch |
| expected result | The receipt's, the stock's, and each batch's figures before and after, in a focused panel | The stock before and after and the sales voided, in a focused panel |
| next action | Check the restated batches, or correct back | Re-enter the batch, then record the voided sales again on Sales |
| read/write consequence | One `correct_receipt` call; a refusal writes nothing | One `reverse_batch` call; a refusal writes nothing |
| critical states | content, success, error, destructive-confirmation, permission/denied | content, success, error, destructive-confirmation, permission/denied |
| a11y requirements | WCAG 2.2 AA; focus into the dialog on open, to the first field with an error or the form message after a refusal, to the panel heading after a correction, to the list message after a closing refusal or failure, back to Correct after Cancel | the same, with the reason field and the "Batch reversed" heading |

State matrix (the applicable subset of the 18 states):

| State | Treatment | AC |
| --- | --- | --- |
| content | Correct on each non-void receipt; Reverse on each batch not reversed; the corrected and reversed lines | AC-0090, AC-0092, AC-0093, AC-0114, AC-0115, AC-0130, AC-0131 |
| loading | A pending correction or reversal: `aria-disabled="true"` and a "Saving…" or "Reversing…" status | AC-0112 |
| success | The "Receipt corrected" and "Batch reversed" panels, focused; the saved panels' corrected and reversed lines | AC-0096 to AC-0101, AC-0135 to AC-0138, AC-0142, AC-0174 |
| error | Field messages with `aria-describedby`; a focused message for a refusal or failure | AC-0102 to AC-0111, AC-0139 to AC-0145, AC-0175 to AC-0177, AC-0182 |
| destructive-confirmation | Each dialog names its receipt or batch, asks for a reason, Cancel first | AC-0094, AC-0095, AC-0113, AC-0132, AC-0133, AC-0134, AC-0147 |
| permission/denied | The existing not-allowed page; replayed actions refused | AC-0004 to AC-0007 |
| large-data-set | A reversal's sales and a correction's batches follow the owner's batches and sales from one lot or one finished lot, tens of rows, far under `max_rows` | n/a |
| first-run, empty, no-results, partial, offline, blocked, long-content, reduced-motion, high-zoom, keyboard-only, disabled | The pages' existing treatments; 320 px reflow and the keyboard path are checked in every new page state | AC-0170 to AC-0173 |

A correction moves through idle, invalid, pending, corrected, and refused or
failed; a reversal the same with reversed. On success the action revalidates
the page only when `readAfter` succeeded, as `saveBatch` does.

### Behavior & rules

- `correct_receipt`, in order: caller; reason; cost; weight; the lot's product (not found); lock the balance row; lock the lot; void; round the cost to 4 decimals and the weight to 3; nothing to correct; the weight floor; lock the finished products made from the lot; insert the correction; set the corrected columns and move `remaining_lbs` by the weight change; when the cost changed, restate each batch made from the lot as the fee decision says, with its finished lot and that finished lot's sale lines; `private.refresh_balance`.
- `reverse_batch`, in order: caller; reason; the batch (not found) and its raw product, from its consumption rows; lock the balance row; lock the finished product; lock the batch; already reversed; void the sales; zero the finished lot; return the lbs; mark the batch; `private.refresh_balance`.
- `correctionFailureMessage` reads like `voidFailureMessage`: before-write gives "try again"; no code gives the may-not-have-been text; 42501 gives not-allowed; the weight-floor text gives the AC-0105 field error and the nothing-to-correct text the AC-0104 form message, and both keep the confirmation open; any other engine text follows "The receipt wasn't corrected." with "Reload to see the latest stock." `reversalFailureMessage` the same with the batch texts.
- The client runs the form rules for an instant message, and the action runs them again after its read before the write.

### Failure, edge cases & resilience

- A correction whose write got no answer may have happened; the AC-0110 message sends the owner to reload, and correcting again is refused as nothing to correct if it did.
- A reversal whose write got no answer: the AC-0144 message; a second confirm is refused as already reversed.
- A sale written between the page load and the reversal is voided too and listed (AC-0146), because the result reads by the reversal's time, not from the preview.
- Two tabs correcting one receipt queue on its lot; the second sees the first's values as current.

### Quality attributes (NFRs)

- **Aesthetic reference:** Stripe Dashboard (professional SaaS: a light surface, high contrast, tabular figures, no gradients or illustration), as on the earlier pages. XD genre routing: skipped (experience-design pack absent). Seed tokens: the existing tokens in `src/app/globals.css`; the work adds none.
- **Accessibility:** every field has a visible `<label>`; error ids are named by `aria-describedby`; messages sit in `role="status"` or `role="alert"` regions present before they are filled; each dialog is a native `<dialog>` with Cancel first.
- `checkPageState` in `test/e2e/a11y.ts` runs in every page state the spec lists.

## Tasks

Stub validation, 2026-10-15, rerun after review round 1 with the same results; the T5 stub gained the `reversed` field and its digest changed. Each `stub: true` block below was extracted from
this file into a `git archive` copy of `HEAD` in the session's scratch directory,
outside the repository, and its sha256 recorded from that extraction (the code
lines plus one terminal newline).

- **Compile:** with placeholder declarations of `correctCall`, `reverseCall`, the two `OperationName` members, and `p_batch_id` in `test/db.ts`, of `src/lib/correction-input.ts`, of `listBatchesMadeFrom` (with its `reversed` field) in `src/lib/receiving.ts`, and of `src/app/receiving/correct-receipt.ts`, shaped as Interfaces & contracts names them, `tsc --noEmit -p tsconfig.json` exited 0.
- **Red, with the `src/` placeholders removed and the `test/db.ts` ones kept:** `vitest run` over the five files exited 1 in 1.88 s on the rerun (2.46 s on the first run). T1 and T2 failed their first assertion with `Could not find the function public.correct_receipt(p_lot_id, p_reason, p_unit_cost, p_weight_lbs) in the schema cache` and `Could not find the function public.reverse_batch(p_batch_id, p_reason) in the schema cache` from the local stack, after their fixture calls succeeded. T5 failed with `listBatchesMadeFrom is not a function`. T4 and T6 failed to load their missing modules (`../src/lib/correction-input.js`, `../src/app/receiving/correct-receipt.js`).
- **Isolation:** the run went through `sandbox-exec` with: network denied except to `localhost` and the Docker socket `~/.docker/run/docker.sock`, which the harness's firewall check reaches through the `docker` CLI; file-content reads denied except for the root directory's own listing, the repository, the Node 22.17.0 install under `~/.nvm/versions/node/v22.17.0`, the scratch directory, this user's process temporary directory (`os.tmpdir()`), `/Applications/Docker.app` and `~/.docker` for that CLI, Vitest's existing API token file under `~/Library/Application Support/vitest`, the timezone data in `/private/var/db/timezone`, and the system paths `/System`, `/usr`, `/private/etc`, and `/dev` (a read of `~/.zshrc`, a write into the repository, and a request to an outside host were each refused under the same profile); file writes denied except under the scratch directory, that temporary directory, and `/dev`; and a 120-second `alarm`. Vitest ran as `node node_modules/vitest/vitest.mjs run --configLoader runner` with a scratch copy of `vitest.config.ts` as plain ESM whose `cacheDir` is in scratch, because Vitest 5 writes its config bundle under `node_modules`. The stack details came from `supabase status -o env` outside the sandbox and were passed in the environment, so no Supabase CLI call ran inside it.
- **Declared test-harness side effects,** on the local stack through `localhost`: global setup's idempotent creation of the test users and their allowlist rows; `resetTestData`'s truncate and reseed of the local database; and the T1, T2, and T5 stubs' committed fixture calls. These are the side effects `npm test` has on every run. The folder check in `AGENTS.md` listed no other running folder before the run.

### T1: Correcting a receipt restates every figure made from it, and the cost chain holds

**Depends on:** none

**Touches:** `supabase/migrations/*_receipt_corrections.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/receipt-corrections.test.ts`, `test/access.test.ts`, `docs/costing.md`, `SYSTEM-SPEC.md`, `docs/product/intents/zero-stock-average-recompute.md`, `docs/specs/foundation-hardening/spec.md`

**Tests:**
- `test/receipt-corrections.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0012: correcting lot A to 1.86 per lb restates batch 1 and leaves batch 2" (AC-0012). sha256 `07a17a44839cbdee91a990864e0d72a77d050cdbef1ac776e50dacd16c26e667`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsClient,
  closePool,
  correctCall,
  query,
  resetTestData,
  saleFixture,
} from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0012
it("AC-0012: correcting lot A to 1.86 per lb restates batch 1 and leaves batch 2", async () => {
  const fixture = await saleFixture({ sale: true });
  const outcome = await callAsClient(operator, correctCall(fixture.lotAId, 1.86, 5000, "invoice price"));
  expect(outcome.ok, outcome.error).toBe(true);
  const rows = await query<{ raw: string; cost: string }>(
    `select raw_cost_total::text as raw, cost_per_finished_lb::text as cost
     from public.production_batches where id = any($1::uuid[]) order by production_date`,
    [[fixture.batch1Id, fixture.batch2Id]],
  );
  expect(rows).toEqual([
    { raw: "11100.0000", cost: "2.8526" },
    { raw: "1800.0000", cost: "2.7877" },
  ]);
});
```

- The same file grows in EXECUTE with AC-0010, AC-0011, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0061, AC-0063, AC-0064, AC-0065, AC-0204, and the `correct_receipt` half of AC-0001: a non-operator session calls it with valid arguments and with each argument and state of AC-0023, AC-0024, and AC-0026 to AC-0030. EXECUTE adds `assertAverageIsStockOnHand` to this file's `afterEach`. Refusals go through `expectRefused`, which sends a NaN call through a pg operator session and compares `tableFingerprints()` before and after. AC-0035 and AC-0036 use `raceCalls` with the correction and a `saleCall` of 100 lbs dated 2026-10-08, and AC-0037 with a `produceCall` of 500 lbs dated 2026-10-08; each asserts the second call's `waitedOn` is set. AC-0034 sets RAW-TOM inactive through `pg`. AC-0204 reads `has_sequence_privilege`. AC-0018 changes the overhead fee through `pg` as master data before the correction.
- `test/db.ts`: `ledgerViolations` gains the current-weight forms of AC-0069 and AC-0070 and the checks of AC-0074, AC-0075, AC-0076, AC-0077, AC-0078, AC-0079; `assertAverageIsStockOnHand` reads `current_unit_cost`. For each of AC-0069, AC-0070, AC-0074, AC-0075, AC-0076, AC-0077, AC-0078, AC-0079, a test in this file opens a `pg` client, begins, writes one violating row as `postgres` (for example `update production_batch_lots set lot_unit_cost = 9`), asserts `ledgerViolations` on that client names the check, and rolls back.
- `test/access.test.ts`: `validArgs` gains `correct_receipt`, its operator fixture gains one correction, its catalog loop reads `has_function_privilege` for `anon` as well as `service_role`, and it registers `assertLedgerInvariants` (not the average check) after each test, so AC-0001, AC-0002, and AC-0003 come from the catalog sweep for `correct_receipt` and `receipt_corrections`.
- `test/costing.test.ts`, `test/engine.test.ts`, `test/corrections.test.ts`, and `test/pricing.test.ts` stay unchanged and green (AC-0189).

**Approach:**
- Write the migration as Data & schema says, apply it with `supabase migration up` after the Risks stack check, and run `npm run gen:types`.
- In `docs/costing.md`, restate invariant 4 for recorded cost and weight and invariant 6 for current weight, add the `correct_receipt` section with the restatement rule, the fee, the weight rule, the zero-stock line, and the cost chain, extend the known limit to a corrected receipt's cost carried by a later lot's prior average, and move the `void_receipt` and `adjust_lot` sections to current weight. In the foundation-hardening spec, add the owner-approved notes on AC-0028 and its stock-on-hand average definition, AC-0031, and AC-0054. In `SYSTEM-SPEC.md`, add the §4 columns and table, the §5 count and "Correct a receipt" contract, and the §11 wording. In the zero-stock intent, extend its Outcome to a cost correction that leaves 0 lbs on hand and to a void whose zero-stock value carries a corrected receipt's cost. In the `test/db.ts` header, allow the rolled-back violation writes of the check tests.

**Done when:** the T1 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T2: Reversing a batch voids its sales, returns its lbs, and every counter skips reversed batches

**Depends on:** T1

**Touches:** `supabase/migrations/*_batch_reversal.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/batch-reversal.test.ts`, `test/access.test.ts`, `docs/costing.md`, `SYSTEM-SPEC.md`, `docs/specs/foundation-hardening/spec.md`

**Tests:**
- `test/batch-reversal.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0044: reversing batch 2 voids the 5,000-lb sale with the batch's reason and time" (AC-0044). sha256 `451788056d41b02cdecde99dd48664badb261442ca9b8844bbbb80dc4dcb8db9`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsClient,
  closePool,
  query,
  resetTestData,
  reverseCall,
  saleFixture,
} from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0044
it("AC-0044: reversing batch 2 voids the 5,000-lb sale with the batch's reason and time", async () => {
  const fixture = await saleFixture({ sale: true });
  const outcome = await callAsClient(operator, reverseCall(fixture.batch2Id, "entered twice"));
  expect(outcome.ok, outcome.error).toBe(true);
  const batchNumber = (
    await query<{ n: string }>("select batch_number as n from public.production_batches where id = $1", [
      fixture.batch2Id,
    ])
  )[0]?.n;
  const rows = await query<{ reason: string; same_time: boolean }>(
    `select s.void_reason as reason, s.voided_at = b.reversed_at as same_time
     from public.sales s cross join public.production_batches b
     where s.id = $1 and b.id = $2`,
    [fixture.saleId, fixture.batch2Id],
  );
  expect(rows).toEqual([{ reason: `Reversed with batch ${batchNumber}: entered twice`, same_time: true }]);
});
```

- The same file grows in EXECUTE with AC-0040, AC-0041, AC-0042, AC-0043, AC-0045, AC-0046, AC-0047, AC-0048, AC-0049, AC-0050, AC-0051, AC-0052, AC-0053, AC-0054, AC-0055, AC-0060, AC-0062, AC-0066, AC-0067, AC-0202, the `reverse_batch` half of AC-0001 (a non-operator session with valid arguments and each argument and state of AC-0048 and AC-0049), the AC-0038 sweep, one `it.each` case per ordered pair (each pair in both orders) through `raceCalls` over the sale fixture, each ending with `assertLedgerInvariants` and `assertAverageIsStockOnHand`, as `test/engine.test.ts`'s AC-0015 cases do, and AC-0039 and AC-0055, where a `pg` session takes RAW-TOM's `inventory_balances` row `FOR UPDATE` (AC-0039) or 502's `products` row `FOR NO KEY UPDATE` (AC-0055), each operation is started on a second session and seen waiting in `pg_stat_activity`, and a read of `pg_locks` for that backend, filtered to `locktype = 'relation'`, lists its `RowShareLock` and `RowExclusiveLock` relations before the first session rolls back. EXECUTE adds `assertAverageIsStockOnHand` to this file's `afterEach`. AC-0050 and AC-0051 use `raceCalls` with the reversal and a `saleCall` of 4,700 lbs dated 2026-10-08, and AC-0053 with a `produceCall` of 1,500 lbs dated 2026-10-08. AC-0054 sets 502 inactive through `pg`. AC-0202 reads `pg_proc`. AC-0047's 1,000-lb sale is dated 2026-10-06 so it can draw only batch 1.
- `test/db.ts`: `ledgerViolations` counts used lbs through batches that are not reversed (AC-0069, AC-0070, AC-0071), checks finished-lot conservation only for batches that are not reversed (AC-0068), and gains AC-0072 and AC-0073; AC-0068, AC-0071, AC-0072, and AC-0073 each get a rolled-back violation test in this file.
- `test/access.test.ts`: `validArgs` gains `reverse_batch`, so AC-0001 and AC-0002 cover it through the catalog sweep.
**Approach:**
- Write the migration as Data & schema says; apply it; run `npm run gen:types`.
- In `docs/costing.md`, add the `reverse_batch` section and restate the used-lbs and void-lot clauses of invariant 6 and the `void_receipt` steps. In the foundation-hardening spec, add the owner-approved notes on AC-0032, AC-0033, AC-0035, AC-0038, and AC-0039. In `SYSTEM-SPEC.md`, add the §4 batch marks and the §5 "Reverse a batch" contract, and update "Void a receipt" and "Adjust a lot".

**Done when:** the T2 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T3: Alerts read current costs, skip reversed batches, and point a wrong cost to Correct

**Depends on:** T1, T2

**Touches:** `supabase/migrations/*_alerts_corrections.sql`, `test/alerts-corrections.test.ts`, `docs/specs/alerts/spec.md`, `SYSTEM-SPEC.md`, the module that holds the cost alert's next step, and every Alerts test file that holds that sentence

**Tests:** no stub (implementation-discovered): the Alerts functions and fixture helpers exist only once Alerts merges.
- Discovery predicate: on the rebased branch, every function in the Alerts migrations whose body reads `unit_cost`, `weight_lbs`, `production_batch_lots`, or `production_batches`, and every file that holds the text "void the receipt on Receiving before production uses it".
- Constraint: each found function keeps its signature, grants, and every behavior the Alerts suites assert; only lot cost becomes current cost and batch reads gain `reversed_at is null`.
- Required outcome: `test/alerts-corrections.test.ts`, against the local stack, holds AC-0080, AC-0081, AC-0082, AC-0083, AC-0084, AC-0085 over the Alerts fixtures with the watch's today passed in; the Alerts test that asserts AC-0102's next step asserts the amended sentence; the Alerts suites stay green.
- Verification mode: TDD against the local stack, each test written red before its function is replaced.

**Approach:**
- Replace each found function in one migration; change the next-step text where it lives.
- In `docs/specs/alerts/spec.md`, amend AC-0102's next-step sentence and the Cost, Yield, and Stock rule definitions, each with a note citing this spec. In `SYSTEM-SPEC.md` §7, say the cost rule reads current cost and the yield and stock rules leave reversed batches out.

**Done when:** the T3 tests and the Alerts suites are green, and `npm test` exits 0.

### T4: The correction and reversal form rules and messages pass their tables

**Depends on:** T1, T2

**Touches:** `src/lib/correction-input.ts`, `src/lib/failures.ts`, `test/correction-rules.test.ts`

**Tests:**
- `test/correction-rules.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0104: the cost and weight the receipt already has are refused" (AC-0104). sha256 `b04120ad6da619590dce26b9188ab1f67ce8bdbd4ec92e85f53ceee7fdaf6a2e`.

```ts
import { expect, it } from "vitest";
import { parseCorrectionForm } from "../src/lib/correction-input.js";

// STUB: AC-0104
it("AC-0104: the cost and weight the receipt already has are refused", () => {
  expect(
    parseCorrectionForm(
      { cost: "1.68", weight: "5000", reason: "invoice price" },
      { cost: "1.6800", weight: "5000.000" },
    ),
  ).toEqual({ ok: false, errors: { form: "Change the cost or the weight to correct this receipt." } });
});
```

- The same file grows in EXECUTE with: the Weight and Cost per lb rows of the receiving spec's AC-0010 table, first matching row per field (AC-0102 construction); the blank reason for each dialog (AC-0103, AC-0139 construction); `correctionFailureMessage` and `reversalFailureMessage` for each stage and code; the nothing-to-correct text, fed from a real AC-0026 refusal, giving the AC-0104 form message (AC-0104 construction); and the weight-floor sentence fed from the engine text that `test/receipt-corrections.test.ts` records from a real AC-0023 refusal (AC-0105 construction).

**Approach:**
- Write the rules and messages as Interfaces & contracts and Behavior & rules say.

**Done when:** the T4 tests are green and `npm run typecheck` exits 0.

### T5: The reads behind the dialogs and panels return the database's rows in draw order

**Depends on:** T1, T2

**Touches:** `src/lib/receiving.ts`, `src/lib/production.ts`, `src/lib/rpc.ts`, `src/lib/trace.ts`, `test/corrections-data.test.ts`, `test/receiving-data-extra.test.ts`

**Tests:**
- `test/corrections-data.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0097: the batches made from lot B come in draw order with their costs per finished lb" (AC-0097). sha256 `27d7b5a9f27bc0891ab8fac14ac7e9df94de52d90d72289549fe0444e011e6ba`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { listBatchesMadeFrom } from "../src/lib/receiving.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { assertLedgerInvariants, closePool, resetTestData, saleFixture } from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0097
it("AC-0097: the batches made from lot B come in draw order with their costs per finished lb", async () => {
  const fixture = await saleFixture({ sale: true });
  expect(await listBatchesMadeFrom(operator, fixture.lotBId)).toEqual([
    {
      batchId: fixture.batch1Id,
      batchNumber: expect.any(String),
      productCode: "502",
      productionDate: "2026-10-06",
      costPerFinishedLb: 2.6578,
      reversed: false,
    },
    {
      batchId: fixture.batch2Id,
      batchNumber: expect.any(String),
      productCode: "502",
      productionDate: "2026-10-07",
      costPerFinishedLb: 2.7877,
      reversed: false,
    },
  ]);
});
```

- The same file grows in EXECUTE with: `listBatchesMadeFrom` marking a reversed batch (AC-0118 construction); `findLots` and `getLotTrace` giving a corrected lot's current weight and cost (AC-0160, AC-0161, AC-0162 construction); `listRecentReceipts` giving current and recorded values, the cost and weight text, the latest reason, and the untouched status of a reversed-only and a weight-corrected receipt (AC-0115 construction); `getLotFigures`; `listRecentBatches` with the reversal marks; `getReversalPreview` over the sale fixture with the 5,000-lb sale; and `listSalesVoidedBy` listing that sale after a reversal and leaving out a sale voided earlier.

**Approach:**
- Add the reads and the two `rpc.ts` wrappers as Interfaces & contracts says.

**Done when:** the T5 tests are green and `npm test` exits 0.

### T6: The correct and reverse decisions return the right state for every branch

**Depends on:** T4, T5

**Touches:** `src/app/receiving/correct-receipt.ts`, `src/app/production/reverse-batch.ts`, `test/save-correction.test.ts`

**Tests:**
- `test/save-correction.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0109: a read before the write fails, so nothing is written" (AC-0109). sha256 `33a27b6d1012be194334e6b081f6f2d19cf942d00f0b338016c14106f714b65c`.

```ts
import { expect, it } from "vitest";
import { decideCorrection, type CorrectionDeps } from "../src/app/receiving/correct-receipt.js";

async function unreachable(): Promise<never> {
  throw new Error("unreachable");
}

// STUB: AC-0109
it("AC-0109: a read before the write fails, so nothing is written", async () => {
  let wrote = false;
  const deps: CorrectionDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => {
      throw new Error("getLotFigures failed: fetch failed");
    },
    write: async () => {
      wrote = true;
      return unreachable();
    },
    readAfter: unreachable,
  };
  expect(
    await decideCorrection("lot-a", { cost: "1.86", weight: "5000", reason: "invoice price" }, deps),
  ).toEqual({ status: "refused", message: "The receipt wasn't corrected. Try again in a moment." });
  expect(wrote).toBe(false);
});
```

- The same file grows in EXECUTE with every branch of both decisions: ended session (AC-0005, AC-0006 construction), not an operator (AC-0007 construction), invalid fields, the weight-floor refusal as a weight-field error, the database's nothing-to-correct refusal as the AC-0104 form message with the confirmation kept open, a refused write, a write with no answer (AC-0110, AC-0144 construction), a read after the write failing (AC-0111, AC-0145 construction), and success.

**Approach:**
- Write both decisions on `decideSaleSave`'s shape: caller, read before, rules, write, read after; a write that returned is a correction or a reversal even when the read after fails.

**Done when:** the T6 tests are green and `npm run typecheck` exits 0.

### T7: Correct on `/receiving` corrects, shows, and refuses in the browser

**Depends on:** T3, T6

**Touches:** `src/app/receiving/*`, `test/e2e/correct.spec.ts`, `test/e2e/receiving-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/correct.spec.ts`, a new file, holds AC-0090, AC-0091, AC-0092, AC-0093, AC-0094, AC-0095, AC-0096, AC-0097, AC-0098, AC-0099, AC-0100, AC-0101, AC-0102, AC-0103, AC-0104, AC-0105, AC-0106, AC-0107, AC-0108, AC-0111, AC-0112, AC-0113, AC-0114, AC-0115, AC-0116, AC-0117, AC-0118; the replayed correct action requests for AC-0004, AC-0005, AC-0007; AC-0087 over the Alerts cost fixture; and, in each `/receiving` page state the spec lists, `checkPageState` and the focus and keyboard checks for AC-0170, AC-0171, AC-0172, AC-0173, AC-0174, AC-0175, AC-0176, AC-0177, AC-0178, AC-0179, AC-0180, AC-0181, AC-0182. AC-0107 voids the receipt through `pg` after the list loads; AC-0108 clears the session cookies before confirming; AC-0111 revokes the operator's SELECT on `receipt_corrections` after the page loads and restores it in a `finally`; AC-0116 aborts the action request through `page.route`; AC-0117 holds a `pg` lock on RAW-TOM's `inventory_balances` row until the message shows; the database half of AC-0104 holds that lock while the page's call waits, corrects the lot to the typed values through `correct_receipt` in the same `pg` transaction, and commits.
- `test/e2e/receiving.spec.ts` stays green.

**Approach:**
- Build the components as Component / module decomposition says, on the receipt void dialog's pattern.

**Done when:** `npm test` exits 0.

### T8: Reverse on `/production` reverses, shows, and refuses in the browser

**Depends on:** T6

**Touches:** `src/app/production/*`, `test/e2e/reverse.spec.ts`, `test/e2e/production-page.ts`, `test/e2e/production.spec.ts`, `docs/specs/production/spec.md`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/reverse.spec.ts`, a new file, holds AC-0130, AC-0131, AC-0132, AC-0133, AC-0134, AC-0135, AC-0136, AC-0137, AC-0138, AC-0139, AC-0140, AC-0141, AC-0142, AC-0145, AC-0146, AC-0147, AC-0148, AC-0149, AC-0150, AC-0151; the replayed reverse action requests for AC-0004, AC-0006, AC-0007; AC-0160, AC-0161, and AC-0162 on `/trace`; and, in each `/production` page state the spec lists, `checkPageState` and the focus and keyboard checks for AC-0170, AC-0171, AC-0172, AC-0173, AC-0174, AC-0175, AC-0176, AC-0177, AC-0178, AC-0179, AC-0180, AC-0181, AC-0182. AC-0140 reverses the batch through `pg` after the list loads; AC-0145 revokes the operator's SELECT on `sale_items` after the confirmation opens and restores it in a `finally`; AC-0146 writes the sale through a `pg` operator session; AC-0148 sets 502 inactive through `pg`; AC-0149 aborts the action request through `page.route`; AC-0150 holds a `pg` lock on RAW-TOM's `inventory_balances` row until the message shows.
- `test/e2e/production.spec.ts`'s check-step assertion for production AC-0014 changes to AC-0151's sentence; that suite and `test/e2e/trace.spec.ts` stay green otherwise.

**Approach:**
- Build the components as Component / module decomposition says; change the check step's sentence and add the owner-approved note to production AC-0014.

**Done when:** `npm test` exits 0.

### T9: The docs match the code, the goal-based checks pass, and the stopped-service run is recorded

**Depends on:** T1, T2, T3, T4, T5, T6, T7, T8

**Touches:** `docs/architecture/overview.md`, `docs/costing.md`, `docs/specs/corrections/notes/verification-ledger.md`

**Tests:** no stub (mode): goal-based checks and a recorded manual run.
- Before the run and the checks, `origin` is fetched, `feat/corrections` is rebased onto `origin/main`, the rebased migrations are applied after the Risks stack check, and `npm test` exits 0 on the rebased branch.
- The recorded run in the verification ledger, against `npm run start`: with the REST service stopped after the page loads, the AC-0109 and AC-0143 messages and the focused element (AC-0177); with the app's `SUPABASE_URL` pointed at a throwaway forwarder in scratch (not committed) that holds the `correct_receipt` or `reverse_batch` call past the 10-second limit, the AC-0110 and AC-0144 messages, the focused element (AC-0177), and a `pg` read of whether the write happened.
- Rendered-page inspection, per `frontend-engineering` GATES step 5, of `/receiving?product=RAW-TOM` with the open correction and with the "Receipt corrected" panel, and `/production?product=502` with the open reversal and with the "Batch reversed" panel, over the sale fixture with the 5,000-lb sale, at the narrow and wide fallback channels, with the observations recorded in the ledger for the `frontend-reviewer`.
- The commands of AC-0189, AC-0190, AC-0191, AC-0192, AC-0193, AC-0194, AC-0195, AC-0196, AC-0197, AC-0198, AC-0199, each with its exit code recorded, and AC-0200, AC-0201, and AC-0203 as two catalog reads compared: the columns of every base table and view in `public`, the list of `public` functions, and each replaced function's `prosecdef`, `proconfig`, and EXECUTE grants, from `information_schema`, `pg_proc`, and `has_function_privilege`, first with the local database built from the then-current `main` migrations, then from this branch's.

**Approach:**
- For the AC-0200 and AC-0201 baseline, extract `origin/main`'s `supabase/` into scratch with `git archive`, run `supabase db reset --workdir <scratch>`, read the catalog, then `supabase db reset` in this worktree and read again; the Risks stack check runs first.
- Edit the overview rows and sentences named in the spec's Durable Outputs row, name the new suites in the opening of `docs/costing.md`, and update its "Not available" note for the "Batch reversed" panel.

**Done when:** every check above is recorded as passing in the ledger.

## Rollout

- **Delivery:** one branch, `feat/corrections`, merged after review. The migrations add columns, a table, and two functions, and replace four functions, a view, and the alert functions; reverting the code leaves the new columns and functions unused, and the replaced readers read current values that equal the recorded ones on any lot never corrected.
- **Infrastructure and external systems:** none. The app runs only against the local stack; the hosted project gets these migrations only through the hosted rollout intent, with the owner's approval.
- **Deployment sequencing:** each migration before the code that calls it; `supabase migration up` runs first in T1, T2, and T3.

## Risks

- **Stack A is shared.** `meat-ops` and `meat-ops-alerts` also use it, and `meat-ops-invoice` uses stack B. A test run truncates the data another run is using, and `npm run gen:types` and the catalog reads see whatever migrations are applied. Before each `npm test`, each stub run, `npm run gen:types`, and T9's checks, run the folder check in `AGENTS.md` and wait while another stack A folder runs tests, and confirm `supabase_migrations.schema_migrations` holds only `main`'s migrations and this branch's. When the second check fails, stop and ask the owner: never run `supabase db reset` over another worktree's applied migration without the owner's go-ahead, and after any reset tell the owner which worktree needs `supabase migration up` again.
- **Alerts must merge first.** T3's targets do not exist until then, and `main`'s migration timestamps decide the order the local stack applies them. If Alerts has not merged when the build starts, stop and ask the owner.
- **Four shipped functions and the trace view are replaced.** A replaced body that drops a check, or a view without `security_invoker`, would pass silently. `test/corrections.test.ts`, `test/engine.test.ts`, `test/costing.test.ts`, `test/access.test.ts`, and AC-0189, AC-0200, and AC-0201 catch each.
- **The restatement touches four tables in one call.** A missed table shows as a cost-chain violation after the test that caused it, in whichever suite.
- **The engine's texts are matched by wording.** A T1 test against a real weight-floor refusal turns red first if the text changes.

## Changelog

- 2026-10-14: initial plan.
- 2026-10-15: review round 1. The non-operator refusal covers every refused input and state, AC-0002 reads `anon` from the catalog, and new criteria pin the two functions' security mode and search path, the replaced functions' unchanged settings, and the sequence grants (AC-0202 to AC-0204). Two shipped conservation checks are restated for current weight and reversed batches (AC-0068, AC-0069). Raw-product queueing and a deadlock sweep join the engine criteria (AC-0037, AC-0038, AC-0053), as do inactive products (AC-0034, AC-0054). AC-0085's fixture now tells the two stock rules apart. The next-step sentence moves to the Alerts spec. Dropped connections and other refusals get their own browser criteria (AC-0116, AC-0117, AC-0149, AC-0150). "Batches restated" marks reversed batches (AC-0118), and the lot finder shows current weight (AC-0162). Task edges, Touches, and the invariant-hook claim are corrected, and the T5 stub is revalidated.
- 2026-10-15: review round 2. AC-0038 checks the invariants after each interleaving, and AC-0039 checks the lock order directly, since no test can force a deadlock. AC-0001 also covers the weight floor. AC-0177 covers the four new closing outcomes. The database's same-value refusal shows the AC-0104 message. Production's check step says a reversal voids sales (AC-0151, owner-approved). The suites that register each check are named once, the foundation and production notes cover every criterion this changes, and the zero-stock intent gets both sentences.
- 2026-10-15: review round 3. AC-0039 and the new AC-0055 check lock order through the waiting backend's relation locks, on both the raw and the finished side. AC-0038 runs each pair in both orders. The database's nothing-to-correct refusal shows the AC-0104 form message, with a browser path to reach it. The invariant registration names Vitest suites only. AC-0151 also requires the old sentence to be gone.
