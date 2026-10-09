# Verification ledger: menu-pricing

Observations and owner decisions recorded after the spec and plan baselines. The spec and plan stay pinned; this file carries what the work learned.

## Spec gate

- 2026-10-09: the owner approved the spec at commit 3cda228. Pre-EXECUTE review ran four rounds. The security reviewer was clean in round 3 after adjudication. The round-4 contract and adversarial findings (one contract-review concern, three adjudicated nits) were fixed in 3cda228. The owner chose to approve without a further review round over that 22-line change, so `reviewers-clean` was fired on the owner's decision rather than on a clean report. Review artifacts: `.context/reviews/9c4bdfed-250f-4d1d-a62d-38242af39d34/` (gitignored).
- 2026-10-09: the owner approved the plan. `approve-plan` recorded the baseline (spec hash 57817293da1e…, plan hash 9a0b3981f6d2…), the schedule has 7 waves (T1; T2 and T3; then T4 to T8 one per wave), and `plan-locked` moved the run to implementation. The spec is `Implementing`.
- 2026-10-09: project-knowledge capture at the spec and plan gates was not attempted; the store refused captures in the 2026-10-08 sessions (`staged_dual_writer`, legacy knowledge base not migrated). Reusable lessons from this loop go to the session memory instead, as before.

## T1

### AC-0160 baseline (2026-10-09, before the migration)

The local database was at main's migrations (schema_migrations: 0001, 20261007181933, 20261007182816, 20261007183252, 20261008110703). Output of the catalog read:

```
customers: id, name, notes, created_at
fee_types: id, code, name, kind, sort_order
finished_goods: id, batch_id, finished_product_id, lbs_produced, lbs_remaining, cost_per_lb, produced_date, produced_seq
inventory_balances: product_id, qty_on_hand, moving_avg_cost, updated_at
lot_adjustments: id, lot_id, old_remaining_lbs, new_remaining_lbs, reason, note, adjusted_at
lots: id, lot_number, product_id, vendor_id, received_date, weight_lbs, unit_cost, remaining_lbs, notes, created_at, receipt_seq, prior_avg_cost, voided_at, void_reason
product_fees: product_id, fee_type_id, amount_per_lb
production_batch_lots: id, batch_id, lot_id, lbs_consumed, lot_unit_cost
production_batches: id, batch_number, finished_product_id, production_date, raw_lbs_in, shrink_pct_used, finished_lbs_out, raw_cost_total, cost_per_finished_lb, notes, created_at
products: id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct, active, created_at
sale_items: id, sale_id, finished_goods_id, lbs_sold, price_per_lb, cost_per_lb
sales: id, sale_number, customer_id, sale_date, created_at, voided_at, void_reason
vendors: id, name, contact_name, phone, email, notes, created_at
```

### Stub materialized and red (2026-10-09)

- `test/pricing.test.ts` extracted from plan.md T1; `shasum -a 256` gives `4ede6cf9d99f1f23ecd81e0d5462294dc1cc386c0a62aca7b17356c217c98e63`, matching the plan.
- `npx vitest run test/pricing.test.ts` before the migration: 1 failed, with `function public.set_target_margin(p_product_id => uuid, p_target_percent => numeric) does not exist`.

### Migration and gates (2026-10-09)

- Migration `supabase/migrations/20261009070619_menu_pricing.sql` applied with `supabase migration up`. After the view replace, `pg_class` shows `reloptions = {security_invoker=true}` and `relacl = {postgres=arwdDxtm/postgres,authenticated=r/postgres,service_role=r/postgres}` for both `v_product_pricing` and `v_current_menu`, so no re-grant was needed and anon has nothing.
- `test/pricing.test.ts`: 28 tests (the stub plus 27), green. The stub's 38 lines still hash to `4ede6cf9...c98e63`.
- `npm run typecheck`: exit 0. `npm test`: Vitest 18 files, 282 tests passed; Playwright 146 passed (1.4 min); exit 0, 2m13s. `npm run test:costing`: 2 files, 35 tests passed, exit 0. `npm run gen:types`: exit 0; a second regeneration is byte-identical to the file committed to the working tree (the plain `git diff --exit-code` exits 1 only because the regenerated file is not yet committed).
- `list_price_override` remains only in the pinned `spec.md` and `plan.md`, where it describes the old brief.
