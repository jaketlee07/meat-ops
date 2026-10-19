# Costing reference and golden invariants

This is the source of truth for the costing math. The tests in
`test/costing.test.ts`, `test/engine.test.ts`, `test/corrections.test.ts`,
`test/pricing.test.ts`, `test/receipt-corrections.test.ts`,
`test/batch-reversal.test.ts`, `test/zero-stock.test.ts`, and
`test/alerts-corrections.test.ts` encode every costing number below. The rules and reads around them are in
`test/correction-rules.test.ts`, `test/corrections-data.test.ts`, and
`test/save-correction.test.ts`, and the two pages' end-to-end checks are in
`test/e2e/correct.spec.ts` and `test/e2e/reverse.spec.ts`. The display formats
in the Rounding note are asserted by `test/format.test.ts`,
`test/production-rules.test.ts`, and `test/pricing-rules.test.ts`, and its
missing-value texts by `test/e2e/receiving.spec.ts`, `test/e2e/production.spec.ts`, `test/e2e/pricing.spec.ts`, `test/e2e/sales.spec.ts`, and `test/e2e/trace.spec.ts`. If a change turns any of these red, the change is
wrong, not the test.

The math lives only in Postgres: the functions `receive_lot`, `produce_batch`,
`record_sale`, `void_receipt`, `void_sale`, `adjust_lot`, `correct_receipt`, and `reverse_batch`, the views
`v_product_pricing` and `v_sale_summary`, and the function `price_what_if`.
Nothing in TypeScript computes a cost, an average, or a price.

## Cost build-up per finished lb

Costing is raw cost, adjusted for shrink, plus processing fees. The price is
then set by one of two rules, depending on whether the product has a target
margin.

```
post_shrink_cost = raw_cost_per_lb / (1 - shrink_pct)
cost_per_lb      = post_shrink_cost + sum(processing fees)
final_price      = cost_per_lb + sum(margin fees)                  with no target margin
final_price      = ceil(cost_per_lb / (1 - target) * 100) / 100    with a target margin
```

Processing fees are costs (cutting, defrosting, process, direct material, labor,
freezing, seasoning, overhead). Margin fees (profit, broker commission) count
only for a product with no target margin. They are separated by fee_types.kind.

## Reference product: Smoked Turkey Drums Tom (code 502)

- Raw input: Turkey Drums TOM, shrink 23 percent (0.2300)
- Processing fees per lb: direct material 0.05, freezing 0.03, overhead 0.37 (total 0.45)
- Margin fees per lb: profit 0.05

## Target margin and list price

A finished product can have two prices the owner sets: a target margin and a
list price. Margin means share of the selling price: a 20% margin on a $3.29
price is $0.658 of it.

- **Target margin** (`target_margin_pct`) is a fraction from 0 up to but not
  including 1. The owner types the percent, such as 22.5, and the database
  stores 0.2250. With a target, the suggested price is
  `cost_per_lb / (1 - target)` rounded up to the next whole cent, using
  `cost_per_lb` rounded to 4 decimals. Rounding up keeps the margin at the
  suggested price at or above the target. The margin fees do not count.
- **No target** keeps the sheet price: `cost_per_lb` plus the margin fees,
  rounded to 4 decimals. Invariant 2 stays at 2.6818.
- **List price** (`list_price_per_lb`) is what the owner charges, in dollars
  and cents. It changes only when the owner sets it.
- **Suggested list price** is the suggested price rounded to the cent, half away
  from zero. It is the number every page shows as the suggested price.
- **Has cost** is true when the product's raw input has at least one non-void
  receipt. With no cost there is no suggested list price, no margin at list
  price, no price action, and the product is not below target.
- **Margin at list price** is `(list - cost_per_lb) / list`, rounded to 4
  decimals, when the product has a cost and a list price.
- **Price action** applies when the product has a cost: Set with no list price,
  Raise when the list price is below the suggested list price, Lower when it is
  above, and none when they are equal. A product with an action needs a new
  price.
- **Below target** means the product has a cost, a target, and a list price, and
  its margin at list price is below the target.
- **The what-if** (`price_what_if`) works out cost per lb, the suggested price,
  the suggested list price, and the margin at list price for each active
  finished product made from a raw product, with a typed raw cost in place of
  the average. The typed cost always counts as a cost, so the what-if prices a
  raw product with no receipt. It saves nothing.

The pricing view and `price_what_if` carry the same expressions, and
`test/pricing.test.ts` holds them equal.

A raw cost of 0.00 with no fees gives a suggested list price of 0.00. The list
price rule takes only a price above 0, so that product's Set or Lower button
always answers "Price must be above 0." and saves nothing. The owner chose on
2026-10-09 to keep this: a zero raw cost with no fees is not a real case for
this business, and the message tells the truth.

Golden numbers, for product 502 with RAW-TOM received as 5,000 lbs at 1.68
(cost per lb 2.6318):

- With a 20% target, the suggested price is 2.6318 / 0.8 = 3.28975, rounded up
  to 3.29. With a target of 0 it is 2.64, and with 22.5% it is 3.40. A profit
  fee of 0.05 or 0.50 changes none of them.
- With no target, margin at list price is 0.0180 at a 2.68 list price, 0.2001 at
  3.29, 0.2481 at 3.50, and -0.0527 at 2.50.
- With a 20% target and RAW-TOM received at 1.6632, cost per lb is 2.6100, the
  suggested price is 3.27, and the margin at a 3.27 list price is 0.2018.
- A what-if for RAW-TOM at 2.00, with a 20% target and a 3.29 list price, gives
  502 a cost per lb of 3.0474, a suggested price of 3.81 (3.0474 / 0.8 =
  3.80925, rounded up), and a margin at list price of 0.0737. With no target the
  suggested price is 3.0974.

## The average cost of a raw product

`inventory_balances.moving_avg_cost` is the stock-on-hand average. It is the
value of the lbs still on hand divided by those lbs, rounded to 4 decimals:

```
moving_avg_cost = sum(remaining_lbs * current_unit_cost) / sum(remaining_lbs)
```

A lot's current cost is its recorded cost until a receipt correction replaces it
(see correct_receipt below). Every operation recomputes the average from the
lots, so it always matches the stock that is actually on the shelf. Consuming the cheap lot first makes the average rise
to the cost of the lots that remain.

### The zero-stock rule

When an operation leaves a raw product with 0 lbs on hand, the average has
nothing to divide. It becomes the zero-stock average: the average current cost
of the lbs that the product's last stock-lowering change took, rounded to 4
decimals.

A stock-lowering change is a production batch that is not reversed and drew from
the product's lots, or an adjustment that lowered one of its lots. Each batch and
each adjustment carries an order number, `stock_seq`, from one sequence,
`private.stock_change_seq`. An operation takes its number while it holds the
product's stock row, so the numbers follow the order the operations ran, inside
one transaction too. The last change is the one with the highest number. With no
such change the average is 0, its value before any receipt.

So the average at 0 lbs is the one the product would have if every void receipt
and every reversed batch had never been entered, and every corrected receipt had
been entered with its current cost and weight. The order in which receipts are
voided or corrected never changes it.

A batch or an adjustment that leaves 0 lbs on hand took every lb on hand, so the
average it leaves is the one the product had just before it. Example: receive
1,000 lbs at 2.00 and produce 1,000 raw lbs. Stock is 0 and the average stays
2.0000. Receive 1,000 lbs at 2.40 and produce all of it: stock is 0 and the
average is 2.4000.

A void or a correction that leaves 0 lbs on hand moves the average to the
zero-stock average. The void_receipt and correct_receipt sections below give
examples.

## The seven invariants

1. Moving average (stock-on-hand average)
   Receive 5,000 lbs at 1.68, then 3,000 lbs at 1.80.
   inventory_balances.moving_avg_cost equals 1.725 exactly.
   ((5000 * 1.68) + (3000 * 1.80)) / 8000 = 1.725
   After production draws 5,000 lbs from the oldest lot, only the 3,000 lbs at
   1.80 remain, and the average is 1.8000.

2. Pricing tie-out
   With a single lot at 1.68 and the fees above, v_product_pricing returns:
   post_shrink 1.68 / 0.77 = 2.1818
   cost_per_lb 2.1818 + 0.45 = 2.6318, which displays as 2.63
   final_price is cost_per_lb plus the 0.05 margin fee, which displays as 2.68.
   Assert on the rounded display value 2.68, not raw float equality.

3. Shrinkage yield
   produce_batch with 2,000 lbs raw at 23 percent yields 1,540 lbs finished.
   2000 * (1 - 0.23) = 1540
   A measured yield above 0 and at most the raw lbs replaces the computed yield.

4. Recorded cost and weight are immutable
   lots.unit_cost and lots.weight_lbs, the cost and weight as received, are never
   updated after insert. A correction writes the lot's corrected_unit_cost and
   corrected_weight_lbs and a receipt_corrections row instead; the generated
   current_unit_cost and current_weight_lbs give the corrected value, or the
   recorded one when the lot has no correction. A database trigger on lots
   (lots_guard, in `supabase/migrations/20261007181933_engine_hardening.sql`)
   refuses any change to unit_cost, weight_lbs, product_id, vendor_id,
   received_date, lot_number, or prior_avg_cost, in every role. Rising costs
   create new lots. `test/engine.test.ts` attempts each column and checks the lot
   is unchanged.

5. FIFO and specific identification
   produce_batch consumes raw lots oldest received_date first, and lots that
   share a date in the order they were received. It draws only on lots received
   on or before the production date. Batch cost uses the actual lots consumed,
   not the moving average. With the two lots above, a 2,000 lb batch draws
   entirely from the 1.68 lot, so raw_cost_total is 3,360 and
   cost_per_finished_lb is 3360 / 1540 + 0.45 = 2.6318.

6. Conservation
   For every raw product, inventory_balances.qty_on_hand equals the sum of
   lots.remaining_lbs. Finished lbs_remaining never exceeds lbs_produced. A
   lot's used lbs are the lbs consumed by batches that are not reversed. Each
   non-void lot's remaining lbs equals its current weight minus its used lbs
   minus the lbs removed by adjustments, and never exceeds current weight minus
   used lbs. Each finished lot of a batch that is not reversed has remaining lbs
   equal to its produced lbs minus the lbs on lines of non-void sales drawn from
   it. A reversed batch's finished lot has 0 lbs remaining and no line of a
   non-void sale. No void lot has an adjustment row, or a consumption row of a
   batch that is not reversed. The test suites run this check after every test.

7. Traceability
   Every sale_item resolves through v_sale_traceability to at least one raw lot
   with a vendor and a received_date. Reverse: given a lot, every sale that
   touched it is reachable. The view lists each sale line once per raw lot behind
   it, includes sales with no customer, and leaves out void sales.

## Voids and adjustments

A void marks a row with a reason and a time. It never deletes the row. A void
reason needs at least one non-space character. Each correction below refuses
bad input and changes nothing when it refuses.

### void_receipt

Voids a lot that nothing has touched: no batch that is not reversed consumed
from it, no adjustment row, and remaining lbs equal to the current weight. A
receipt corrected to a new weight with nothing else done to it is untouched, and
so is a receipt whose only batches were reversed. A void lot has 0 lbs remaining
and stays in the table.

Example: receive 1,000 lbs at 1.68 and 500 lbs at 1.80. Stock is 1,500 lbs at
an average of 1.72. Void the second lot: stock is 1,000 lbs and the average is
1.68.

When the void leaves 0 lbs on hand, the average is the zero-stock average
above. A void lot is never a stock-lowering change, so the average is the one
the product would have if the voided receipts had never been entered.

Examples, each starting from 0 lbs on hand at an average of 1.8000, after a
batch on May 11 drew all of a 1,000-lb lot at 1.80 received May 10. Every lot
is 1,000 lbs.

- Receive a lot at 18.00 on May 12; the average is 18. Void it and the average
  returns to 1.8000.
- Receive two lots at 18.00, on May 12 and May 13, and void both, in either
  order: the average is 1.8000.
- Receive a lot at 18.00 on May 12 and a lot at 2.00 on May 13, adjust the 2.00
  lot to 0, and void the 18.00 lot: the average is 2.0000, the cost of the lbs
  the adjustment took.
- Receive lots at 18.00 and 20.00 on May 12 and a lot at 2.00 on May 13, adjust
  the 2.00 lot to 0 as waste, and void the first two, in either order: the
  average is 2.0000. It is 2.0000 too when a batch of 2,500 raw lbs drew from
  all three lots and was reversed before the adjustment and the voids, since a
  reversed batch counts as never entered.
- Receive a lot at 18.00 received May 14, then a lot at 20.00 received May 12,
  and void both, in either order: the average is 1.8000.
- Receive a lot at 18.00 received May 13, then a lot at 2.00 received May 12,
  produce 1,000 raw lbs on May 12, and void the 18.00 lot: the batch drew the
  2.00 lot, so the average is 2.0000.

Each lot keeps the `prior_avg_cost` it was entered with, frozen as invariant 4
says, and no rule reads it.

### void_sale

Voids a sale. Each of its lines returns its lbs to the finished lot it came
from. The sale leaves v_sale_traceability. A sale that is already void is
refused.

### adjust_lot

Sets a lot's remaining lbs to a counted value. The value runs from 0 up to the
current weight minus the lbs batches that are not reversed consumed from the
lot. The reason is
one of count, waste, spoilage, or other. The call records one adjustment row with
the old lbs, the new lbs, and the reason, and it leaves unit_cost unchanged. A
void lot cannot be adjusted.

Example: a 1,000 lb lot has 600 lbs consumed, so the cap is 400 lbs. Setting it
to 250 lbs with reason waste leaves 250 lbs on hand at the same 1.68 average.
Setting 401 lbs is refused. In the correct_receipt example below, lot B corrected
to 3,100 lbs can be adjusted to 1,100 lbs and not to 1,100.001. In the
reverse_batch example below, after batch 2 is reversed lot B can be adjusted to
2,000 lbs and not to 2,000.001.

The average after an adjustment is the stock-on-hand average. Receive 1,000 lbs
at 1.68 and 1,000 lbs at 1.80, then adjust the second lot to 250 lbs. Stock is
1,250 lbs and the average is 1.704:
(1000 * 1.68 + 250 * 1.80) / 1250 = 1.704

### reverse_batch

Reverses a batch that should not exist, as one step that does all of this or
none of it:

1. Each non-void sale with a line on the batch's finished lot is voided as
   `void_sale` voids it: every line of the sale returns its lbs to the finished
   lot it came from, and the sale gets the reason "Reversed with batch <number>:
   <reason>". The voided sales and the batch share one time, the transaction's.
   A sale that was already void keeps its own reason and time, and a sale with no
   line on the batch's finished lot is not voided.
2. The batch's finished lot goes to 0 lbs remaining.
3. Each consumption row's lbs go back to the lot it came from.
4. The batch is marked reversed with the reason and the time.
5. The raw product's stock and average are recomputed from its lots.

The consumption rows stay as the record of what was drawn and returned, so a
lot's used lbs count only batches that are not reversed. A reversal cannot be
undone: the batch stays in the table marked reversed, and the next batch draws
the returned lbs first. A reversed batch is refused, and so are a blank reason
and a batch that does not exist.

Locks. The call takes the raw product's stock row, then the finished product's
`products` row, then the batch, so it queues behind and ahead of `record_sale`,
`void_sale`, `produce_batch`, and `correct_receipt` on the same products and no
pair can wait on each other. A sale written first is voided by the reversal. A
sale or a batch started during the reversal waits for it.

Example, in the sale fixture of the correct_receipt section, before the 5,000-lb
sale:

- Reverse batch 2: lot B has 2,000 lbs remaining, batch 2's finished lot has 0
  lbs, and 502 has 4,620 finished lbs on hand.
- Reverse batch 1 instead: lot A has 5,000 lbs and lot B 2,000 lbs remaining, and
  the average is (5000 * 1.68 + 2000 * 1.80) / 7000 = 1.7143.

With the 5,000-lb sale, reversing batch 2 voids that sale (its 4,620 lbs return to
batch 1's finished lot, and its 380 lbs to batch 2's, which then goes to 0), so
batch 1's finished lot has 4,620 lbs remaining. A 1,000-lb sale dated Oct 6 can
draw only batch 1 and is not voided. A batch of 1,500 raw lbs produced Oct 8
after the reversal draws 1,500 lbs from lot B.

### correct_receipt

Corrects a receipt's cost per lb, its weight, or both. The lot keeps what was
first entered, and a `receipt_corrections` row holds the old and new values and
the reason. From then on the lot's current cost and weight are the new values,
and every figure made from the lot follows them. A correction is undone by
correcting back, which restores every figure.

The cost chain holds for every row: a lot's current cost is the lot cost on each
of its consumption rows; each batch's raw cost total is the sum of lbs consumed
times lot cost over its consumption rows, rounded to 4 decimals; the batch's cost
per finished lb is its finished lot's cost per lb; and that is the cost on each
sale line from the finished lot. The tests check this chain after every test.

**Restatement rule.** When the cost changes, each batch made from the lot is
restated, whether or not its finished lbs are sold. The batch keeps the
processing fees it was costed with. The fee as used is recovered before the rows
change. First take the raw cost per finished lb: the sum of lbs consumed times
lot cost, divided by the batch's finished lbs out, rounded to 4 decimals. That
sum is not rounded first. The fee as used is the batch's cost per finished lb
minus that raw cost per finished lb. Fees have 4 decimals, so this is exact, and
a fee changed on the product afterwards does not enter. The restated cost per
finished lb is the new raw cost per finished lb, worked out the same way with
the new lot cost, plus that fee.

**Weight rule.** The weight change moves the lot's remaining lbs by the same
amount. The new weight cannot go below the current weight minus the remaining
lbs, which is what production used and adjustments removed, and it must be above
0. A cost of 0 is allowed. A correction whose cost and weight, rounded to 4 and 3
decimals, equal the current ones is refused. A void lot cannot be corrected.

**Zero-stock rule.** The average moves to the stock-on-hand average at current
cost. When the correction leaves 0 lbs on hand, it moves to the zero-stock
average the zero-stock rule above gives, so a cost correction while stock is 0
moves the average.

Example, in the sale fixture: lot A is 5,000 lbs at 1.68 received Oct 1 and lot B
is 3,000 lbs at 1.80 received Oct 5. Batch 1 makes 4,620 finished lbs of 502 from
6,000 raw lbs (5,000 from lot A and 1,000 from lot B), with a raw cost total of
10200.0000 and a cost per finished lb of 2.6578. Batch 2 makes 770 finished lbs
from 1,000 raw lbs of lot B, with 1800.0000 and 2.7877. The fee as used is
0.4500 for both. A 5,000-lb sale then takes 4,620 lbs from batch 1 and 380 from
batch 2, and RAW-TOM has 1,000 lbs on hand at 1.8000.

- Correct lot A to 1.86: batch 1 becomes 11100.0000 and 2.8526, and batch 2 keeps
  1800.0000 and 2.7877. Batch 1's finished lot and its sale line take 2.8526.
  The lbs on hand and the average are unchanged, since lot A is used up.
- Correct lot B to 1.90: batch 1 becomes 2.6794, batch 2 becomes 2.9175, and the
  average becomes 1.9000. Correct lot B to 0: 2.2682 and 0.4500.
- Correct lot A to 1.86, then back to 1.68: every figure returns to its value
  before.
- Correct lot B to 3,100 lbs: it has 1,100 lbs remaining and RAW-TOM 1,100 lbs on
  hand, and no batch, finished lot, or sale line changes. The smallest weight
  lot B can take is 2,000 lbs, which leaves it 0 lbs remaining and the average at
  1.8000. Correcting it to 1,999.999 lbs is refused. After the correction to
  2,000 lbs, correcting lot B to 1.90 moves the average to 1.9000, since batch 2's
  1,000 lbs from lot B now cost 1.90.
- With lot B adjusted to 900 lbs first, the smallest weight is 2,100 lbs.

## Rounding note

v_product_pricing returns numbers the database has already rounded: cost per lb
and the sheet price to 4 decimals, a target price and a suggested list price to
the cent, and a margin at list price to 4 decimals. The pricing tests
(`test/pricing.test.ts`) compare these values exactly, as text. The 2.68 figure
of invariant 2 is a display rounding of 2.6818, which the older tests assert as
Number(value).toFixed(2); they use exact equality only for values that are exact
by construction (1.725, 1540).

The screen rounds only for display, half away from zero, from the decimal value
the database returns. The production check step shows the owner's own entries
through the same formats:

| Kind | Format | Examples |
| --- | --- | --- |
| Weight | thousands separators, 0 to 3 decimals with trailing zeros dropped, then " lbs" | 5000 → 5,000 lbs; 32.5 → 32.5 lbs; 1234.5678 → 1,234.568 lbs |
| Cost per lb (lot cost, average, a batch's cost per finished lb, a finished lot's cost per lb, cost after shrink, a finished product's cost per lb) | "$", 4 decimals, "/lb" | 1.725 → $1.7250/lb; 1.68 → $1.6800/lb; 2.6318 → $2.6318/lb |
| Suggested price per lb, list price per lb, a sale's price per lb | "$", 2 decimals, "/lb" | 2.6818 → $2.68/lb; 2.685 → $2.69/lb; 1.005 → $1.01/lb |
| Fee per lb (a margin fee) | "$", 4 decimals, "/lb" | 0.05 → $0.0500/lb |
| Date | month abbreviation, day, year, in any time zone | 2026-10-07 → Oct 7, 2026 |
| Shrink | the stored fraction written as a percent, 0 to 2 decimals with trailing zeros dropped, then "%" | 0.23 → 23%; 0.235 → 23.5%; 0.2345 → 23.45%; 0 → 0% |
| Margin (at a list price) | the stored fraction written as a percent, 0 to 2 decimals with trailing zeros dropped, then "%" | 0.2 → 20%; 0.018 → 1.8%; 0.2001 → 20.01%; 0.2481 → 24.81%; -0.0527 → -5.27%; 0 → 0% |
| Raw cost total | "$", thousands separators, 2 decimals | 3360 → $3,360.00; 10200 → $10,200.00; 1234.5678 → $1,234.57; 0.005 → $0.01 |
| Days (days left) | 0 to 1 decimals with a trailing zero dropped, then " day" when the rounded value is exactly 1 and " days" otherwise | 5.3333 → 5.3 days; 7 → 7 days; 1 → 1 day; 0 → 0 days; 0.96 → 1 day |
| Change (a cost change or drift) | the absolute value of the fraction written as a percent, 0 to 2 decimals with trailing zeros dropped, then "%"; the words "up", "down", "above", and "below" carry the sign | 0.0962 → 9.62%; -0.1024 → 10.24%; 0.1 → 10%; 0.6667 → 66.67% |

Where the database has nothing to show, the screen uses text:

- On hand with no `inventory_balances` row shows "0 lbs".
- The average of a raw product with no non-void receipt shows "None yet". A void
  that leaves no live receipt can leave a stored average of 0, which is not shown.
- The suggested price of a finished product whose raw product has no non-void
  receipt shows "No price yet".
- The list price of a finished product with none shows "No list price yet".
- A sale with no customer shows "No customer", on the sales page and on a trace.
- A finished product's lbs on hand in the "Sale saved" and "Batch reversed" panels
  shows "Not available" in a column when that column's own read finds no menu row
  for the product, as for a product made inactive. `test/e2e/reverse.spec.ts`
  makes the product inactive before the reversal and asserts "Not available" in
  both the before and the after column of the "Batch reversed" panel; no test
  asserts it for "Sale saved".
- The target margin of a finished product with none shows "No target".
- The raw average cost, cost after shrink, and cost per lb of a finished
  product whose raw product has no non-void receipt show "None yet", whatever
  average a void left stored. Its margin at list price shows "None yet" too, as
  does the margin of a product with no list price.
