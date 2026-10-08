# Costing reference and golden invariants

This is the source of truth for the costing math. The tests in
`test/costing.test.ts`, `test/engine.test.ts`, and `test/corrections.test.ts`
encode every costing number below. The display formats in the Rounding note are
asserted by `test/format.test.ts`, and its missing-value texts by
`test/e2e/receiving.spec.ts`. If a change turns any of these red, the change is
wrong, not the test.

The math lives only in the Postgres functions `receive_lot`, `produce_batch`,
`record_sale`, `void_receipt`, `void_sale`, and `adjust_lot`. Nothing in
TypeScript computes a cost, an average, or a price.

## Cost build-up per finished lb

Costing is raw cost, adjusted for shrink, plus processing fees, plus margin.

```
post_shrink_cost = raw_cost_per_lb / (1 - shrink_pct)
cost_per_lb      = post_shrink_cost + sum(processing fees)
final_price      = cost_per_lb + sum(margin fees)
```

Processing fees are costs (cutting, defrosting, process, direct material, labor,
freezing, seasoning, overhead). Margin fees are added to reach price (profit,
broker commission). They are separated by fee_types.kind.

## Reference product: Smoked Turkey Drums Tom (code 502)

- Raw input: Turkey Drums TOM, shrink 23 percent (0.2300)
- Processing fees per lb: direct material 0.05, freezing 0.03, overhead 0.37 (total 0.45)
- Margin fees per lb: profit 0.05

## The average cost of a raw product

`inventory_balances.moving_avg_cost` is the stock-on-hand average. It is the
value of the lbs still on hand divided by those lbs, rounded to 4 decimals:

```
moving_avg_cost = sum(remaining_lbs * unit_cost) / sum(remaining_lbs)
```

Every operation recomputes it from the lots, so it always matches the stock that
is actually on the shelf. Consuming the cheap lot first makes the average rise
to the cost of the lots that remain.

### The zero-stock rule

When an operation leaves a raw product with 0 lbs on hand, the average has
nothing to divide, so it keeps the value it had before that operation.

Example: receive 1,000 lbs at 2.00 and produce 1,000 raw lbs. Stock is 0 and
the average stays 2.0000. Receive 1,000 lbs at 2.40 and produce all of it: stock
is 0 and the average is 2.4000.

One operation breaks the rule on purpose: a void that leaves 0 lbs on hand. A
voided receipt never happened, so the average goes back to a value from before
the voided receipts. The void_receipt rules below say which value, and when that value
can still carry a voided cost.

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

4. Lot cost is immutable
   lots.unit_cost is never updated after insert. A database trigger on lots
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
   lots.remaining_lbs. Finished lbs_remaining never exceeds lbs_produced. Each
   non-void lot's remaining lbs equals its received weight minus the lbs
   production consumed minus the lbs removed by adjustments, and never exceeds
   received weight minus consumed lbs. No void lot has a consumption row or an
   adjustment row. The test suites run this check after every test.

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

Voids a lot that nothing has touched: no production consumed from it, no
adjustment row, and remaining lbs equal to the received weight. A void lot has
0 lbs remaining and stays in the table.

Example: receive 1,000 lbs at 1.68 and 500 lbs at 1.80. Stock is 1,500 lbs at
an average of 1.72. Void the second lot: stock is 1,000 lbs and the average is
1.68.

When the void leaves 0 lbs on hand, the average is set by the first of these
three steps that finds a lot. FIFO order means received date, then entry order.
The prior average of a lot is the average just before it was entered.

1. The prior average of the first void lot, in FIFO order, among the void lots
   that come after the last non-void lot. When no lot is non-void, this covers
   all the product's lots.
2. The prior average of the first void lot, in FIFO order, among the void lots
   that come after the last lot production drew from. When production has drawn
   from none of the product's lots, this covers all its void lots.
3. The prior average of the lot being voided.

Example: stock is 0 lbs at an average of 1.8000. Receive 1,000 lbs at 18.00; the
average is 18. Void that lot and the average returns to 1.8000. Receive two lots
of 1,000 lbs at 18.00 and void both, in either order, and the average is 1.8000.
Receive lots at 18.00 and 20.00, then a lot at 2.00 that is adjusted to 0 as
waste, and void the first two in either order: the average is 1.8000.

Known limit, accepted by the owner on 2026-10-07: a lot's prior average is
fixed when it is entered, so it can include other lots that are voided later.
When lots are entered out of date order, or a void lot's prior average was
taken while another lot that is now void was on hand, the average after the
last void can carry a voided receipt's cost, and can depend on the order of the
voids. It stays that way while stock is 0, until a receipt or an upward
adjustment brings stock above 0 and the stock-on-hand average takes over. The
[zero-stock average intent](product/intents/zero-stock-average-recompute.md)
replaces these steps with a recompute from the non-void lots alone.

### void_sale

Voids a sale. Each of its lines returns its lbs to the finished lot it came
from. The sale leaves v_sale_traceability. A sale that is already void is
refused.

### adjust_lot

Sets a lot's remaining lbs to a counted value. The value runs from 0 up to the
received weight minus the lbs production consumed from the lot. The reason is
one of count, waste, spoilage, or other. The call records one adjustment row with
the old lbs, the new lbs, and the reason, and it leaves unit_cost unchanged. A
void lot cannot be adjusted.

Example: a 1,000 lb lot has 600 lbs consumed, so the cap is 400 lbs. Setting it
to 250 lbs with reason waste leaves 250 lbs on hand at the same 1.68 average.
Setting 401 lbs is refused.

The average after an adjustment is the stock-on-hand average. Receive 1,000 lbs
at 1.68 and 1,000 lbs at 1.80, then adjust the second lot to 250 lbs. Stock is
1,250 lbs and the average is 1.704:
(1000 * 1.68 + 250 * 1.80) / 1250 = 1.704

## Rounding note

v_product_pricing returns full-precision numeric. The 2.68 figure is a display
rounding. Tests assert on Number(value).toFixed(2) for prices, and on exact
equality only for values that are exact by construction (1.725, 1540).

The screen rounds only for display, half away from zero, from the decimal value
the database returns:

| Kind | Format | Examples |
| --- | --- | --- |
| Weight | thousands separators, 0 to 3 decimals with trailing zeros dropped, then " lbs" | 5000 → 5,000 lbs; 32.5 → 32.5 lbs; 1234.5678 → 1,234.568 lbs |
| Cost per lb (lot cost, average) | "$", 4 decimals, "/lb" | 1.725 → $1.7250/lb; 1.68 → $1.6800/lb |
| Suggested price per lb | "$", 2 decimals, "/lb" | 2.6818 → $2.68/lb; 2.685 → $2.69/lb; 1.005 → $1.01/lb |
| Date | month abbreviation, day, year, in any time zone | 2026-10-07 → Oct 7, 2026 |

Where the database has nothing to show, the screen uses text:

- On hand with no `inventory_balances` row shows "0 lbs".
- The average of a raw product with no non-void receipt shows "None yet". A void
  that leaves no live receipt can leave a stored average of 0, which is not shown.
- The suggested price of a finished product whose raw product has no non-void
  receipt shows "No price yet".
