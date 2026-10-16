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
