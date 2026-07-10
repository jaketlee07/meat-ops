# Costing reference and golden invariants

This is the source of truth for the costing math. The tests in
`test/costing.test.ts` encode every number below. If a change turns any of these
red, the change is wrong, not the test.

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

## The seven invariants

1. Moving average
   Receive 5,000 lbs at 1.68, then 3,000 lbs at 1.80.
   inventory_balances.moving_avg_cost equals 1.725 exactly.
   ((5000 * 1.68) + (3000 * 1.80)) / 8000 = 1.725

2. Pricing tie-out
   With a single lot at 1.68 and the fees above, v_product_pricing returns:
   post_shrink 1.68 / 0.77 = 2.1818
   cost_per_lb 2.1818 + 0.45 = 2.6318
   final_price 2.6318 + 0.05 = 2.6818, which displays as 2.68.
   Assert on the rounded display value 2.68, not raw float equality.

3. Shrinkage yield
   produce_batch with 2,000 lbs raw at 23 percent yields 1,540 lbs finished.
   2000 * (1 - 0.23) = 1540

4. Lot cost is immutable
   lots.unit_cost is never updated after insert. Verify no code path issues
   UPDATE lots ... SET unit_cost. A PreToolUse hook blocks this at authoring time.

5. FIFO and specific identification
   produce_batch consumes raw lots oldest received_date first. Batch cost uses
   the actual lots consumed, not the moving average. With the two lots above,
   a 2,000 lb batch draws entirely from the 1.68 lot, so raw_cost_total is 3,360
   and cost_per_finished_lb is 3360 / 1540 + 0.45 = 2.6318.

6. Conservation
   For every raw product, inventory_balances.qty_on_hand equals the sum of
   lots.remaining_lbs. Finished lbs_remaining never exceeds lbs_produced.
   Run this check after every test.

7. Traceability
   Every sale_item resolves through v_sale_traceability to at least one raw lot
   with a vendor and a received_date. Reverse: given a lot, every sale that
   touched it is reachable.

## Rounding note

v_product_pricing returns full-precision numeric. The 2.68 and 2.74 figures are
display roundings. Tests assert on Number(value).toFixed(2) for prices, and on
exact equality only for values that are exact by construction (1.725, 1540).
