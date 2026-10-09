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

## T6

- 2026-10-09: `/pricing` (list, Apply, what-if), its error page, and `test/e2e/pricing.spec.ts` (25 tests) with `test/e2e/pricing-page.ts` landed. Playwright: 195 passed (2 setup, 193 specs) in 3.7 min.
- Group membership is by the view's flags only; the client list file holds the three predicates and the database's order is kept inside each group. A card's advice and button need `priceAction`, `costPerLb`, and `suggestedListPrice` all present; a row missing one shows no advice rather than a made-up one.
- The message regions are two empty `tabindex="-1"` elements owned by the list (`role="status"` for saved, `role="alert"` for refused), because a saved product moves to another group and unmounts its card. Focus goes to whichever has text.
- Playwright treats `aria-disabled="true"` as not enabled, so the pending-press test forces its second click.
- The what-if picker shows "none chosen" for a URL code it does not list (AC-0125), so the code appears only in the message, as React text.
- Vitest in `npm test` failed once, in `test/access.test.ts` "direct writes to ledger tables are refused for every role" (5 s timeout; the same test fails alone). Cause is the known Realtime slot catalog bloat: `pg_class` has 292,520 dead tuples and slot `cainophile_c7dz1ka3` holds `catalog_xmin` 43,950 transactions back. Not touched by T6. The slot fix needs the owner's approval, so it was not applied. With that test excluded, Vitest ran 352 of 353 green; `npm run test:e2e` (193 specs) and `npm run test:costing` (35 tests) exit 0.

## T7

- 2026-10-09: the detail at `/pricing?product=<code>`, its two forms, and 24 new browser tests landed. Playwright: 213 passed (2 setup, 211 specs) in 1.4 min. Vitest 21 files, 353 tests; `npm run test:costing` 35 tests; `npm run typecheck` exit 0.
- Files: `pricing-detail.tsx` (client; build-up, message regions, field text), `change-form.tsx` (one generic field-and-buttons form used for the target and the price, in place of the planned `target-form.tsx` and `list-price-form.tsx`), `price-advice-block.tsx` (advice and Apply, now used by the list card and the detail). `page.tsx` takes the detail branch right after the operator check and awaits `searchParams` before it.
- The detail keeps both fields' text in the detail component, so a saved field shows the stored value from the action's returned product (22.50 typed shows 22.5) and an Apply on the detail fills the price field. `PricingDetail` is keyed by product id so state never carries over between products.
- Headings: h1 "Pricing" (PageHeader), h2 the product's code and description, then h2 "Target margin" and h2 "List price". A not-active code shows only the sentence under the h1.
- Selectors for T8: fields `#target-margin` (name "Target margin %") and `#list-price` (name "List price per lb"); buttons "Save target", "Remove target margin" (only with a target), "Save price"; field errors `#target-margin-error` and `#list-price-error`; message regions `#change-saved` (`role=status`, `tabindex=-1`) and `#change-refused` (`role=alert`, `tabindex=-1`); each form's "Saving…" status is a bare `role=status` paragraph after its buttons. Tab order: nav, Apply (when shown), `#target-margin`, Save target, Remove target margin, `#list-price`, Save price.
- A press clears the message regions first, so a new outcome with the same text is announced again and takes focus again.
- The browser-side form rule refuses before any request; the server's `invalid` state is handled the same way (field error, focus on the field) but no browser test reaches it.

## T8

### Docs (2026-10-09)

- `docs/architecture/overview.md`: the migrations, `src/lib/`, `src/app/`, proxy, `test/`, and `test/e2e/` rows; the views paragraph (a replaced view sets `security_invoker` again); the access table and a paragraph for `set_target_margin`, `set_list_price` (SECURITY DEFINER, `private.assert_caller`, operator only) and `price_what_if` (SECURITY INVOKER under the tables' RLS, `42501` for a non-operator); the write path (master data only through the two setters); a Framing bullet in the app trust boundary. `docs/costing.md`: the opening names `test/e2e/pricing.spec.ts` beside the missing-value suites. No em dashes in either file.

### Goal-based checks (2026-10-09, closing tree)

- AC-0150 `npm run build`: exit 0 (routes `/menu` and `/pricing` listed as dynamic).
- AC-0151 `npm test` after `supabase db reset`: exit 0, 85 s; Vitest 21 files and 353 tests passed; Playwright 213 passed.
- AC-0152 `npm run gen:types`: exit 0; `git diff --exit-code src/lib/database.types.ts`: exit 0, no diff.
- AC-0153 `npm run typecheck`: exit 0.
- AC-0154, AC-0155, AC-0157, the three AC-0158 greps, AC-0159: each prints nothing (grep exit 1; the AC-0158 first line ends in `grep -v`, whose exit 1 also means no line).
- AC-0156 `npm audit --omit=dev --audit-level=high`: exit 0, "found 0 vulnerabilities".
- AC-0161 `npm run test:costing`: exit 0; ran `test/pricing.test.ts` (28 tests) and `test/costing.test.ts` (7 tests), 35 passed.
- AC-0160: `supabase db reset` exit 0 (all six migrations and the seed re-applied). The catalog read (base tables of `public` with their columns in order, `information_schema.columns` joined to `tables` with `table_type = 'BASE TABLE'`) matches T1's baseline line for line, 13 tables, except `products`, which gains `target_margin_pct, list_price_per_lb` at the end. Nothing else differs (`diff` of the two outputs shows that one line).

### Recorded run (2026-10-09)

Method as in the production ledger: `npm run start -- -p 3200` on a build of the closing tree, the operator signed in through the form, driven by a scratch Playwright spec (scratch directory, not committed). The 502 fixture before the run: RAW-TOM receipt 5,000 lbs at 1.68 received 2026-10-01; 502 with a 20% target and a 2.68 list price (pricing view: cost 2.6318, suggested 3.29). Case 4 ran the app with `SUPABASE_URL` in its process environment set to a throwaway forwarder on 127.0.0.1:54400 in scratch (not committed; `.env` checksum unchanged). The fixture was rebuilt before each case. Every outcome below matched its criterion.

1. REST container stopped before each load (AC-0127, AC-0126; checks AC-0130, AC-0131, AC-0132, AC-0139, AC-0141 for those states):
   - `/menu`: status 500 after 10.6 s; heading "Menu"; text "Couldn't load this page." and button "Try again"; focus on the h1 ("Menu", `tabindex=-1`); `checkPageState` passed, one control, "button Try again".
   - `/pricing`: status 500 after 10.6 s; heading "Pricing"; the same text and button; focus on the h1 ("Pricing"); `checkPageState` passed, one control, "button Try again".
   - After `docker start supabase_rest_meat-ops` and Try again, with a page variable set before the press and still set after (no browser reload): `/menu` shows "Menu", the navigation, the Sellable only switch, and 502 with $2.68/lb, finished 0 lbs, raw 5,000 lbs, "Sellable now"; `/pricing` shows "Needs a new price" with 502 at $2.6318/lb, $2.68/lb, $3.29/lb, 1.8%, 20%, and its advice.
2. REST stopped after `/pricing?product=502` loaded (fields 20 and 2.68; typed 25 and 3.10), Save target: after 10.4 s the message "The change wasn't saved. Try again in a moment." (AC-0113); fields `#target-margin` 25 and `#list-price` 3.10 (AC-0119); focus on `#change-refused` (`role=alert`) (AC-0142).
3. App restarted after the detail loaded, then `docker stop supabase_auth_meat-ops`, typed 25 and 3.10, Save target: after 20.6 s "The change wasn't saved. Try again in a moment." (AC-0113); fields 25 and 3.10; focus on `#change-refused`.
4a. Forwarder dropped the `set_list_price` call (never sent on; its log shows `dropped /rest/v1/rpc/set_list_price`); typed 25 and 3.50, Save price: after 10.4 s "The change may not have been saved. Reload this page to check it." (AC-0114); fields 25 and 3.50 (AC-0119); focus on `#change-refused`. A `pg` read shows 502's row unchanged.
4b. Forwarder held `set_target_margin` (log: `held /rest/v1/rpc/set_target_margin`); typed 25 and 3.10, Save target; a `pg` session then deleted the operator's `private.operators` row (`DELETE 1`) and the forwarder released the call: after 0.8 s "The change wasn't saved. This account isn't allowed to use Meat Ops." (AC-0117); fields 25 and 3.10 (AC-0119); focus on `#change-refused` (AC-0142). A `pg` read of 502's whole row before and after is identical (target 0.2000, list price 2.68), and an md5 of every `products` row is identical (AC-0128).
- Restored and confirmed: the operator row was inserted back (count for the operator's id 1; `private.operators` holds 2 rows, the operator and the password operator); both containers (`supabase_rest_meat-ops`, `supabase_auth_meat-ops`) are running; nothing listens on 3200 or 54400; `.env` is unchanged by checksum. The run's fixture rows are test data that `npm test` resets.

### Rendered-page inspection (2026-10-09, frontend-engineering GATES step 5)

- Setup: the same build on 127.0.0.1:3200, the 502 fixture above, the operator signed in. Channels: narrow 480 px wide and wide 1024 px wide, both "fallback bands, no declared minimum" (the app declares no breakpoints). Images are PNGs in the session scratch directory, not in the repository. Result state: completed. Verdict: pass, no Blocker.
- Per capture, the route (query cut), viewport-width as the page reports it, viewport-height, the scroll offset reached, and page-scrollable. Heights 600 and 900.

| Route (view) | Width x height | At rest | Scrolled |
| --- | --- | --- | --- |
| /menu | 480 x 600 | 480, 600, offset 0, scrollable no | page-scrollable: no |
| /menu | 480 x 900 | 480, 900, offset 0, scrollable no | page-scrollable: no |
| /menu | 1024 x 600 | 1024, 600, offset 0, scrollable no | page-scrollable: no |
| /menu | 1024 x 900 | 1024, 900, offset 0, scrollable no | page-scrollable: no |
| /pricing (list) | 480 x 600 | 480, 600, offset 0, scrollable yes | offset 242 |
| /pricing (list) | 480 x 900 | 480, 900, offset 0, scrollable no | page-scrollable: no |
| /pricing (list) | 1024 x 600 | 1024, 600, offset 0, scrollable yes | offset 194 |
| /pricing (list) | 1024 x 900 | 1024, 900, offset 0, scrollable no | page-scrollable: no |
| /pricing (detail 502) | 480 x 600 | 480, 600, offset 0, scrollable yes | offset 536 |
| /pricing (detail 502) | 480 x 900 | 480, 900, offset 0, scrollable yes | offset 236 |
| /pricing (detail 502) | 1024 x 600 | 1024, 600, offset 0, scrollable yes | offset 488 |
| /pricing (detail 502) | 1024 x 900 | 1024, 900, offset 0, scrollable yes | offset 188 |
| /pricing (what-if results) | 480 x 600 | 480, 600, offset 0, scrollable yes | offset 396 |
| /pricing (what-if results) | 480 x 900 | 480, 900, offset 0, scrollable yes | offset 96 |
| /pricing (what-if results) | 1024 x 600 | 1024, 600, offset 0, scrollable yes | offset 348 |
| /pricing (what-if results) | 1024 x 900 | 1024, 900, offset 0, scrollable yes | offset 48 |

- Every scrolled offset is the page's bottom (document height minus viewport height). The document's scroll width equals the viewport width in every capture (480 or 1024), so nothing runs sideways.
- Observations, from looking at all 26 images: nothing wrong in any capture. No overlap, clipping, or text running out of its card; every label sits left and its value right with space between (the longest, "RAW-TOM Turkey Drums TOM (raw)", fits beside "Raw input" at 480); each button spans its card; no control is off-screen when its section is scrolled to; text and the blue buttons are high contrast. At 1024 the content stays in one 544 px column with white margins, the same as the floor pages. Short-viewport rests cut the page at a section heading (the list at 600 high ends on "What if raw cost changes?"), which scrolling then shows in full.
- Noted, not a failure: with no raw product chosen, the what-if picker shows a blank box with no prompt text (list captures at 480 x 900 and 1024 x 600 scrolled); the "Choose a raw product." refusal covers it.

### Closing gates (after every restore)

- `npm run typecheck`: exit 0. `npm test`: exit 0, 95 s; Vitest 21 files and 353 tests passed; Playwright 213 passed. `npm run test:costing`: exit 0; 2 files, 35 tests passed.

## Local stack maintenance

- 2026-10-09: during T6, `test/access.test.ts`'s direct-write test timed out at 5 s with no code change behind it. `pg_class` held 305,267 dead rows and the Realtime slot `cainophile_c7dz1ka3` held `catalog_xmin` 45,069 transactions back. With the owner's approval that day, its backend was ended as `supabase_admin`, Realtime made a new slot at once (`cainophile_5a6zwnqk`, age 3), and `vacuum pg_class` left 0 dead rows. The full gates then passed: Vitest 21 files and 353 tests, Playwright 195, `test:costing` 35.

## Review round 2 fixes

- Recovery stance for stored data: after a code-only revert, a stored `target_margin_pct` still drives `v_product_pricing.final_price_per_lb`, so Receiving would show the target price, and no screen could show or clear a target; `list_price_per_lb` would be unused. The stance is forward-fix. To return Receiving to sheet prices after a revert, clear every target through Supabase Studio, or run `update public.products set target_margin_pct = null` as postgres, with the owner's approval. Nothing is dropped, so no data is lost.
- Deferred Nit: the pricing view repeats `round(final_price_per_lb, 2)` and the margin expression (`supabase/migrations/20261009070619_menu_pricing.sql` lines 55 to 74). Folding them needs a migration change. The spec forbids editing the existing migration, and a refactor-only migration is not warranted now. The rounding-edge test in `test/pricing.test.ts` (RAW-TOM at 1.6802, 20% target, 3.29 list price: cost 2.6321, suggested 3.30, margin 0.2000, `below_target` false) pins the current behavior.

- 2026-10-09, owner decision on the review's zero-suggestion Nit: a raw product received at 0.00 per lb whose finished product has no fees gets a suggested list price of 0.00 and a Set or Lower button that always refuses: the change action's form rule (`parseListPrice`) answers "Price must be above 0." before any write, so `set_list_price` is never reached. The owner chose to leave it: a zero raw cost with no fees is not a real case for this business, and the refusal message tells the truth. No code changes.
- The plan's `ReceivingAction` (plan Design and T5) is now `LoggedAction` in `src/lib/failures.ts`, because it names every server action whose failures are logged, the pricing change actions included.
