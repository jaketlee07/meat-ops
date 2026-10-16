# Verification ledger: alerts

Observations and owner decisions recorded after the spec and plan baselines. The spec and plan stay pinned; this file carries what the work learned.

## Gates and setup

- 2026-10-13: the owner approved the spec and the plan. `approve-plan` recorded the baseline (spec hash 075d625ea3de…, plan hash e8b8309d8cf7…).
- 2026-10-16: the owner directed a merge of origin/main into `feat/alerts` (merge commit 92bcebd) in place of the rebase the spec's Always do names. It brings Sales and Invoice entry, both shipped and closed on main, so the build's precondition holds. The new migration is timestamped after both features' migrations.
- 2026-10-16: the owner directed this folder onto stack B. Setup steps from AGENTS.md "Set up a folder on stack B": `npm ci`, the copy (`cmp` reports an exact copy), `supabase start`, the folder check (no folder running tests; this folder is the only stack B worktree), `npm run db:reset:stack-b` (applied main's nine migrations), and the `.env` command (`SUPABASE_URL` is `http://127.0.0.1:55321`; the existing `ANTHROPIC_API_KEY` line kept). Tests run as `E2E_PORT=3200 npm test`.
- 2026-10-16: baseline `E2E_PORT=3200 npm test` on the merged code before any alerts change: pass. Vitest 35 files, 611 tests, 19 s; Playwright 486 tests, 3.1 m.
- 2026-10-16: `schedule` persisted 6 waves (T1 and T4; T2; T3; T5; T6; T7), and `plan-locked` moved the run to CODE-IMPLEMENTATION. Tasks run one at a time.
- Project-knowledge capture is not attempted at the gates; the store refused captures in earlier sessions. Reusable lessons go to the session memory.

## T1

### AC-0170 and AC-0171 baseline (2026-10-16, before the alerts migration)

Stack B held main's migrations (0001 to 20261013195533). Base tables and views in `public`, each column as position, name, and type:

```
customers table 1:id:uuid, 2:name:text, 3:notes:text, 4:created_at:timestamp with time zone
fee_types table 1:id:uuid, 2:code:text, 3:name:text, 4:kind:text, 5:sort_order:integer
finished_goods table 1:id:uuid, 2:batch_id:uuid, 3:finished_product_id:uuid, 4:lbs_produced:numeric(14,3), 5:lbs_remaining:numeric(14,3), 6:cost_per_lb:numeric(12,4), 7:produced_date:date, 8:produced_seq:bigint
import_draft_lines table 1:id:uuid, 2:import_draft_id:uuid, 3:line_no:integer, 4:words:text, 5:product_id:uuid, 6:vendor_id:uuid, 7:weight_lbs:numeric(14,3), 8:unit_cost:numeric(12,4), 9:received_date:date, 10:unsure_fields:text[], 11:status:text, 12:lot_id:uuid
import_drafts table 1:id:uuid, 2:source:text, 3:capture_text:text, 4:capture_image:bytea, 5:capture_image_type:text, 6:captured_on:date, 7:captured_at:timestamp with time zone, 8:model:text, 9:status:text, 10:settled_at:timestamp with time zone
inventory_balances table 1:product_id:uuid, 2:qty_on_hand:numeric(14,3), 3:moving_avg_cost:numeric(12,4), 4:updated_at:timestamp with time zone
lot_adjustments table 1:id:uuid, 2:lot_id:uuid, 3:old_remaining_lbs:numeric(14,3), 4:new_remaining_lbs:numeric(14,3), 5:reason:text, 6:note:text, 7:adjusted_at:timestamp with time zone
lots table 1:id:uuid, 2:lot_number:text, 3:product_id:uuid, 4:vendor_id:uuid, 5:received_date:date, 6:weight_lbs:numeric(14,3), 7:unit_cost:numeric(12,4), 8:remaining_lbs:numeric(14,3), 9:notes:text, 10:created_at:timestamp with time zone, 11:receipt_seq:bigint, 12:prior_avg_cost:numeric(12,4), 13:voided_at:timestamp with time zone, 14:void_reason:text
product_fees table 1:product_id:uuid, 2:fee_type_id:uuid, 3:amount_per_lb:numeric(10,4)
production_batch_lots table 1:id:uuid, 2:batch_id:uuid, 3:lot_id:uuid, 4:lbs_consumed:numeric(14,3), 5:lot_unit_cost:numeric(12,4)
production_batches table 1:id:uuid, 2:batch_number:text, 3:finished_product_id:uuid, 4:production_date:date, 5:raw_lbs_in:numeric(14,3), 6:shrink_pct_used:numeric(5,4), 7:finished_lbs_out:numeric(14,3), 8:raw_cost_total:numeric(14,4), 9:cost_per_finished_lb:numeric(12,4), 10:notes:text, 11:created_at:timestamp with time zone
products table 1:id:uuid, 2:code:text, 3:description:text, 4:brand:text, 5:species:text, 6:kind:text, 7:pack_style:text, 8:lbs_per_pack:numeric(10,2), 9:raw_product_id:uuid, 10:shrink_pct:numeric(5,4), 11:active:boolean, 12:created_at:timestamp with time zone, 13:target_margin_pct:numeric(5,4), 14:list_price_per_lb:numeric(10,2)
sale_items table 1:id:uuid, 2:sale_id:uuid, 3:finished_goods_id:uuid, 4:lbs_sold:numeric(14,3), 5:price_per_lb:numeric(12,4), 6:cost_per_lb:numeric(12,4)
sales table 1:id:uuid, 2:sale_number:text, 3:customer_id:uuid, 4:sale_date:date, 5:created_at:timestamp with time zone, 6:voided_at:timestamp with time zone, 7:void_reason:text
v_current_menu view 1:product_id:uuid, 2:code:text, 3:description:text, 4:species:text, 5:final_price_per_lb:numeric, 6:finished_lbs_available:numeric, 7:raw_lbs_available:numeric, 8:sellable:boolean, 9:list_price_per_lb:numeric(10,2)
v_product_pricing view 1:product_id:uuid, 2:code:text, 3:description:text, 4:species:text, 5:shrink_pct:numeric(5,4), 6:raw_cost_per_lb:numeric(12,4), 7:post_shrink_cost_per_lb:numeric, 8:processing_fees_per_lb:numeric, 9:margin_per_lb:numeric, 10:cost_per_lb:numeric, 11:final_price_per_lb:numeric, 12:target_margin_pct:numeric(5,4), 13:list_price_per_lb:numeric(10,2), 14:has_cost:boolean, 15:suggested_list_price:numeric, 16:margin_at_list_pct:numeric, 17:price_action:text, 18:needs_new_price:boolean, 19:below_target:boolean
v_sale_summary view 1:sale_id:uuid, 2:sale_number:text, 3:sale_date:date, 4:created_at:timestamp with time zone, 5:customer_id:uuid, 6:customer:text, 7:finished_product_id:uuid, 8:finished_code:text, 9:finished_product:text, 10:lbs_sold:numeric, 11:price_per_lb:numeric, 12:voided_at:timestamp with time zone, 13:void_reason:text
v_sale_traceability view 1:sale_number:text, 2:sale_date:date, 3:finished_code:text, 4:finished_product:text, 5:lbs_sold:numeric(14,3), 6:price_per_lb:numeric(12,4), 7:batch_number:text, 8:production_date:date, 9:raw_lot:text, 10:raw_product:text, 11:vendor:text, 12:received_date:date, 13:raw_lbs_from_lot:numeric(14,3), 14:raw_lot_cost_per_lb:numeric(12,4), 15:sale_item_id:uuid, 16:customer:text, 17:sale_id:uuid, 18:sale_created_at:timestamp with time zone, 19:customer_id:uuid, 20:raw_code:text, 21:produced_seq:bigint, 22:receipt_seq:bigint
vendors table 1:id:uuid, 2:name:text, 3:contact_name:text, 4:phone:text, 5:email:text, 6:notes:text, 7:created_at:timestamp with time zone
```

Functions in `public`:

```
adjust_lot(p_lot_id uuid, p_new_remaining_lbs numeric, p_reason text, p_note text)
check_operator()
confirm_import_draft(p_draft_id uuid, p_lines jsonb)
create_import_draft(p_source text, p_captured_on date, p_model text, p_lines jsonb, p_capture_text text, p_capture_image bytea, p_capture_image_type text)
discard_import_draft(p_draft_id uuid)
price_what_if(p_raw_product_id uuid, p_raw_cost_per_lb numeric)
produce_batch(p_finished_product_id uuid, p_raw_lbs_in numeric, p_finished_lbs_out numeric, p_production_date date, p_batch_number text, p_notes text)
receive_lot(p_product_id uuid, p_vendor_id uuid, p_weight_lbs numeric, p_unit_cost numeric, p_received date, p_lot_number text, p_notes text)
record_sale(p_finished_product_id uuid, p_lbs numeric, p_price_per_lb numeric, p_customer_id uuid, p_sale_date date, p_sale_number text)
set_list_price(p_product_id uuid, p_price_per_lb numeric)
set_target_margin(p_product_id uuid, p_target_percent numeric)
void_receipt(p_lot_id uuid, p_reason text)
void_sale(p_sale_id uuid, p_reason text)
```

### T1 result (2026-10-16)

- The stub, materialized from plan.md, matched its recorded sha256 (`e6ff4ba5…`) and failed red with `relation "private.list_price_changes" does not exist` at its first history read, after the receipt and both `set_list_price` calls had succeeded (commit 723b6d2).
- Migration `supabase/migrations/20261016204845_alerts.sql` applied on stack B with `supabase migration up`. `src/lib/database.types.ts` is unchanged, because `private` is not in the generated types.
- Deviation from plan Design: two triggers, one for insert (fires when the new list price is not null) and one for update (fires when the list price changes), because a trigger's `WHEN` clause cannot read `OLD` on insert. Both call `private.record_list_price_change()`. Setting a list price back to null records a row whose new price is null.
- Each test was shown able to fail by breaking its behavior on stack B and restoring it: dropping the update trigger failed AC-0067, AC-0068, AC-0184, AC-0069, and AC-0071; removing its `WHEN` clause failed AC-0184; granting `select` to `authenticated` failed AC-0071; granting `execute` to `anon` on the baseline function, or `usage` to `service_role` on the sequence, failed AC-0188.
- Menu-pricing AC-0034 now ends "...are unchanged, apart from the one `private.list_price_changes` row the history trigger adds (alerts spec)." `test/pricing.test.ts` is unchanged.
- Gates: typecheck pass; build pass; `E2E_PORT=3200 npm test` pass (Vitest 36 files, 618 tests, 18 s; Playwright 486, 3.1 m); `npm run test:costing` pass (37 tests); `gen:types` leaves no diff.
- `supabase migration new` waits on a prompt unless stdin is `/dev/null`.

## T4

- The stub matched its recorded sha256 (`339270ed…`) and failed red with `Cannot find module '../src/lib/alert-text.js'` (commit 2cfbcc0). Later tests are appended below the unchanged stub text.
- Modules: `src/lib/alert-text.ts` (`AlertView`, `alertText`, `digestFacts`, `isUrgent`), `src/lib/digest.ts` (`DIGEST_INSTRUCTIONS`, `DIGEST_SCHEMA`, `digestRequest`, `digestVerdict`), `src/lib/app-today.ts` (`appToday`, `dateInAppZone`), and `formatDays` and `formatChange` in `src/lib/format.ts`. `docs/costing.md` has the Days and Change rows.
- `digestRequest` sends the facts as one text block in one user message (`content: [{ type: "text", text: facts }]`), as invoice-reading sends a read. `digestVerdict` trims space, tab, CR, and LF, and counts code points.
- Each non-obvious test was shown able to fail: removing the product-code check failed AC-0093; measuring with `.length` failed AC-0091. AC-0106 gives different dates under three time zones in one file.
- A first full run in T4 had one Playwright failure outside the diff, `receiving.spec.ts:577` (AC-0042 and AC-0046, an expired access token refreshes and saves), which passed on the immediate rerun and in the wave-1 gate run below. Treated as a flake; watched in later runs.

## Wave 1 gates (T1 and T4, 2026-10-16)

- `npm run build` pass; `E2E_PORT=3200 npm test` pass: Vitest 37 files, 633 tests, 17 s; Playwright 486, 3.1 m.

## T2

- The stub matched its recorded sha256 (`5031b3fe…`) and both tests failed red on `function public.refresh_alerts(p_today => date) does not exist` after their receipt, target, and list-price calls succeeded (commit 2d41980). `alerts` joined the truncate list in the green commit, because with it the stub fails earlier on the missing table.
- The migration's second part adds `public.alerts` (RLS, the operator read policy, `select` only) and `public.refresh_alerts(p_today date)`, which returns `(open_count, urgent_count)`. `test/alerts-watch.test.ts` has 52 tests; `test/alert-fixtures.ts` builds the five-alert fixture with or without its first watch.
- Deviations from plan Design: a price alert's `changed_at` fact is the last change's time as UTC ISO text, so the app derives its date in the app's time zone (AC-0106); the cost and yield conditions compare `|x - usual|` with `max(floor × usual, 3 × median deviation)` and so never divide by a usual cost; a yield batch's entry order is `finished_goods.produced_seq`; a cleared alert also gets `closed_at`.
- AC-0036's "an unmeasured fourth opens none" cannot tell an unmeasured batch from a measured one on the spec's numbers, because an unmeasured batch's shrink equals its shrink used. An extra test under AC-0036 sets the product's shrink to 0.10 so that counting unmeasured batches as candidates or references turns red.
- Mutation checks: 33 changes to `refresh_alerts`, each applied with `create or replace` on stack B and restored, turned at least one test red (window edges, the 10-row limits, the bands, the zero guards, `active`, the advisory lock, the lifecycle statements, severity). Three single guards stayed green only because each is written twice; removing both copies turned red.
- AC-0144 timing (run once in T2; T7 reruns it as its goal check): 50 raw and 100 finished products with targets and list prices, 2,000 lots received 2026-09-05 to 2026-10-14, 1,000 batches produced 2026-09-22 to 2026-10-10, built through the operations; warm-up 97.3 ms, five runs 77.1, 107.1, 76.6, 79.5, 79.8 ms, median 79.5 ms against the 1 s bar. No index was added.
- Appending to an applied migration needs `npm run db:reset:stack-b`; `supabase migration up` reports it as up to date.

## Wave 2 gates (T2, 2026-10-16)

- `npm run build` pass; `E2E_PORT=3200 npm test` pass: Vitest 38 files, 685 tests, 20 s; Playwright 486, 3.1 m. `npm run test:costing` pass (37 tests). `npm run gen:types` leaves no diff.

## T3

- The stub matched its recorded sha256 (`a7036f75…`). Because `refresh_alerts` existed by then, its red moved to the next missing function: it failed at `applied.error` with `function public.apply_alert_price(p_alert_id => uuid, p_price_per_lb => numeric) does not exist`, after the receipt, target, list price, and watch calls succeeded (commit c45a219).
- The migration's third part adds `v_alerts`, `alert_digests`, `dismiss_alert`, `apply_alert_price`, `start_digest(p_date, p_automatic)`, `finish_digest`, and the private helper `private.digest_paragraphs_ok(text[])`, which the table's check uses because a check cannot hold a subquery. `test/alerts-data.test.ts` has 15 tests.
- Refusal texts: `dismiss_alert: It is no longer open.`, `apply_alert_price: This alert is no longer open.`, `<function>: alert <id> not found`, `apply_alert_price: alert <id> is not a margin or price alert`; `start_digest` and `finish_digest` refuse a missing argument after the caller check. `dismiss_alert` sets `closed_at`. Both functions take the watch's advisory lock after the caller check; an extra test shows each waits on a running watch.
- `v_alerts` carries every alert column, the product's code and description, the lot's number, received date, `receipt_seq`, and vendor name, and the batch's number, production date, and `produced_seq` (left joins).
- Mutation checks: 21 changes (state, threshold, flag, lock, grant, RLS, `security_invoker`, `search_path`, caller order, and claim-race mutations) each turned a test red on stack B and were restored. A bare insert grant on `alerts` stays refused by RLS; adding a permissive insert policy turns AC-0074 red.
- AC-0188's test listed function names, so it missed `private.digest_paragraphs_ok`. It now takes every private function no earlier migration creates, and every private sequence, from the catalog; granting `execute` on the helper to `anon` turned it red (commit 4dc4f69).

## Wave 3 gates (T3, 2026-10-16)

- After `npm run db:reset:stack-b`: `npm run build` pass; `E2E_PORT=3200 npm test` pass: Vitest 39 files, 700 tests, 21 s; Playwright 486, 3.0 m. `npm run test:costing` pass (37 tests). `npm run gen:types` leaves no diff.

## T5

- Commits dd2edcb (the watch in the header and the urgent banner), 68b4f70 (the alerts page with reprice and dismiss), 410960b and dedd899 (browser coverage). `src/app/_server/watch.ts` runs one cached watch per request with the app's today; `src/app/page-header.tsx` is async, ends the Primary navigation with Alerts, and holds a region named "Urgent alerts" with the banner or the watch failure line (on `/alerts` the page shows the failure line above its first section).
- Deviations from plan Design: the banner region is a `div` with `role="region"` because it has no heading; margin and price alerts show a "Next step" label above their button rather than repeating its text; the alert order is applied in `listOpenAlerts` (SQL orders by creation time and code, then code sorts by type and subject within a run and puts urgent first); the pricing saved-message line is repeated in `src/app/alerts/decide.ts` because `pricing/save-change.ts` is outside T5's Touches; `buildFiveAlertFixture` takes an optional `today` so browser fixtures count dates from the app's today (`TZ=America/Chicago` for the app under Playwright).
- The AC-0182 order check was shown able to fail by disabling the subject order. The AC-0026 cleared case uses the low-stock alert, because voiding the cost lot changes RAW-TOM's cost and rightly reopens a price alert.
- `test/alert-actions.test.ts` drives every branch of the change and dismiss outcome orders (11 tests). The six other page helpers' control lists gained "a Alerts"; three pricing lists gained "a See alerts" where their fixture leaves a margin alert.
- Rendered page, five-alert fixture: at 1280 px a single 36 rem column with the title, the wrapped Primary links (Alerts plain as the current page), Sign out, "Today's digest", "Urgent" (margin, then cost), and "Other alerts" (yield, price, low stock), each a bordered card with a bold title, its sentence, its next step, a full-width blue reprice button or a link, and a full-width Dismiss button; at 320 px the same, with no horizontal scroll. `/receiving` shows the banner in red under Sign out. Figures checked by hand: 14 × 64.2857 − 200 = 700 lbs to order; (2.2688 − 2.0688) ÷ 2.0688 = 9.67%.
- Another token-refresh test in `receiving.spec.ts` (line 973, a revoked session on void) failed once in a partial run inside T5 and passed in every full run. Same class as line 577.

## Wave 4 gates (T5, 2026-10-16)

- `npm run build` pass; `E2E_PORT=3200 npm test` pass: Vitest 40 files, 711 tests, 19 s; Playwright 524, 3.4 m. `npm run test:costing` pass (37 tests). `npm run gen:types` leaves no diff.
