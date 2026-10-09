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

## T2

- 2026-10-09: `/menu`, the Menu and Pricing header links, the `frame-ancestors 'none'` and `X-Frame-Options: DENY` headers (`next.config.ts` `headers()`), and `test/e2e/menu.spec.ts` landed. The seeded 502 is active after `resetTestData`, so tests that need only their own products retire it through `retire502` in `test/e2e/menu-page.ts`.
- The framing headers also appear on the proxy's redirect response for a signed-out request (checked with `maxRedirects: 0`), not only on the final page.
- Next.js prefetches linked pages (`/receiving?_rsc=...`) on the menu page; AC-0046 to AC-0048 therefore assert the switch sends no request to `/menu` and no non-GET request, rather than no request at all.
- A native checkbox is 24 px wide by default, under the 44 px control bar (AC-0132); the switch sets `h-control w-control` so the box itself is 44 px.
- `/pricing` does not exist until T6, so the Pricing link 404s for now.

## T3

- 2026-10-09: `test/pricing-rules.test.ts` stub extracted from plan.md T3; `shasum -a 256` gives `b957b28c4d7f3f9d7c7f896f8ac502c89b4d956bc8644eada7c5f7c9adefc03d`, matching the plan. `npx vitest run test/pricing-rules.test.ts` before the modules: 1 file failed, 0 tests, `Failed to load url ../src/lib/price-advice.js ... Does the file exist?`.
- After the work, the stub's first 56 lines still hash to the same value; the added cases sit below them, with their imports.
- `formatMargin` calls `formatShrink` (both use one private decimal-point move, `movedPercent`); `percentText` uses the same move. The list price field's starting value is `priceFieldText` (Intl, 2 decimals, no grouping).
- `parseWhatIf` takes `rawCodes` for the T6 call shape but does not use it: AC-0125 answers an unknown code on the results side, so only "none chosen" is refused here.
- Gates: `npm run typecheck` exit 0; `npx vitest run` 19 files, 332 tests passed (75 s); `npm run test:costing` 2 files, 35 tests passed (18 s). Playwright not run.

## T4

- 2026-10-09: `test/pricing-data.test.ts` stub extracted from plan.md T4; `shasum -a 256` gives `399e6a4d4beaa52b06149505209e195b6bffa592b45897c606bb1d83892c1fa5`, matching the plan. `npx vitest run test/pricing-data.test.ts` before the module: 1 file failed, 0 tests, `Failed to load url ../src/lib/pricing.js ... Does the file exist?`. The stub's first 31 lines still hash to the same value; the added cases sit below them.
- `getPricingDetail` reads fees from `fee_types` with an inner embed of `product_fees` filtered by product, so PostgREST orders them by `sort_order` in the database. A fee a product has no row for is not listed.
- `listWhatIfRawProducts` is two reads (active finished products' `raw_product_id`, then active raw products `in` that list, `.order("code")`). The raw `RAW-OLD` that is inactive is left out even when an active finished product uses it.
- `setTargetMargin` passes `null` through a cast, because the generated type of `p_target_percent` omits null. A test shows null removes the target.
- Tests beyond the plan list: an empty picker when no finished product is active, and null removing a target.

## T5

- 2026-10-09: `test/save-change.test.ts` stub extracted from plan.md T5; `shasum -a 256` gives `6dec9c24eaa5d539390e8703c3a38297a918dc5315e468fb43f5575984a0e5d1`, matching the plan. `npx vitest run test/save-change.test.ts` before the module: 1 file failed, 0 tests, `Failed to load url ../src/app/pricing/save-change.js ... Does the file exist?`. The stub's first 17 lines still hash to the same value; the added imports and cases sit below them.
- States: `idle`, `invalid { fieldError }` (the form rule's message, one value field), `refused { message }` (caller or database refusal), `saved { message, product }`. The change actions take `(formData)` like `saveBatch`, with fields `productId` and `value`.
- `npm run build` passed, but no page imports `src/app/pricing/actions.ts` yet, so the build does not yet compile the actions under Turbopack. T6 must re-run the build once the forms import them.
- Gates: `npm run typecheck` exit 0; `npx vitest run` 21 files, 353 tests passed (115 s); `npm run test:costing` 2 files, 35 tests passed (23 s); `npm run build` exit 0. Playwright not run.
