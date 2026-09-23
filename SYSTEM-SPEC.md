---
title: System Specification
product: Meat Ops (working name: LotLedger / Cleaver)
status: master brief (feeds per-feature specs)
audience: any LLM or engineer building this system
---

# System Specification

This document describes what the system does and why. It is implementation
agnostic and contains no code. Schemas are described as field lists and behavioral
contracts. A builder should read this end to end, then generate per-feature specs
from the Feature Breakdown section.

## 1. Purpose

A meat processor buys raw meat in bulk at prices that change day to day, processes
it (which loses weight to shrinkage), prices the finished products, and sells them.
Today this runs on a large, fragile Excel workbook. The owner is not technical.

This system replaces that workbook with a trustworthy operations tool that does
three things the spreadsheet cannot: it keeps true, order-correct costs as prices
move, it traces any sale back to the exact raw lot and vendor it came from, and it
puts an AI layer on top that answers questions, warns about margin erosion, and
advises on pricing and purchasing.

## 2. Core architectural principle (read this first)

All cost and inventory math is deterministic and lives in the database. The AI
never computes a price, a cost, an average, or a margin. The AI is the interface
and the advisor: it reads numbers the deterministic engine produced, interprets
them, and drafts actions for the human to approve. Every figure the AI shows is the
real figure from the engine.

This principle is non-negotiable because the entire value proposition is
trustworthy costing and traceability. It shapes every AI feature below:
- Questions are answered by running predefined, typed queries, never freeform generated queries against the data.
- AI-extracted data (for example from an invoice photo) is always a draft the human confirms before it is written.
- Recommendations (repricing, purchasing) are suggestions the human applies with one tap. The system never mutates prices or inventory on its own.

## 3. Users and primary jobs

Primary user: the owner/operator of the processing business. One person for the
MVP, non-technical, works partly at a desk and partly on the plant floor.

Primary jobs to be done:
- Log incoming raw purchases quickly, including from the floor or dock.
- Convert raw into finished product and know the true cost of what was made.
- Price finished products to hold a target margin as raw costs move.
- Sell finished product and answer any traceability question instantly.
- Get warned before losing money, and get advice on when and what to buy.

## 4. Domain model (schema)

Fields are listed plainly. Primary keys are ids unless noted. "fk" means foreign
key. Money is stored as exact decimals, never floating point. Weights are in pounds.

### Reference and catalog

- vendors: id, name, contact_name, phone, email, notes, created_at
- products: id, code (unique, the owner's own code), description, brand, species, kind (one of: raw, finished), pack_style, lbs_per_pack, raw_product_id (fk products, set only on finished products, the raw input it is made from), shrink_pct (set only on finished products, fraction between 0 and 1), target_margin_pct (finished only, the margin the advisor holds to), list_price_override (finished only, optional manual price when the owner deviates from the suggested price), active, created_at
- fee_types: id, code, name, kind (one of: processing, margin), sort_order
- product_fees: product_id (fk products), fee_type_id (fk fee_types), amount_per_lb. Composite key of the two ids. Holds the per-lb processing fees for each finished product.

Note on the finished-product recipe: for the MVP each finished product is made from
exactly one raw product (a one-to-one recipe via raw_product_id). Multi-ingredient
blends are a later extension via a separate components table.

Note on margin: margin evolves from the spreadsheet's flat per-lb "profit" fee to a
target_margin_pct per finished product, so margin holds as costs move. The flat
processing fees (cutting, freezing, overhead, and so on) remain per-lb.

### Inventory and cost state

- inventory_balances: product_id (pk, fk products, raw products only), qty_on_hand (lbs), moving_avg_cost (per lb), updated_at. This is the authoritative rolling average used for forward pricing.
- lots: id, lot_number (unique, human readable), product_id (fk products, a raw product), vendor_id (fk vendors), received_date, weight_lbs (as received), unit_cost (per lb, the true price paid), remaining_lbs (depletes as production consumes it), notes, created_at. A lot is both the cost record and the traceability anchor. unit_cost is immutable once written.

### Production

- production_batches: id, batch_number (unique), finished_product_id (fk products), production_date, raw_lbs_in, shrink_pct_used, finished_lbs_out, raw_cost_total, cost_per_finished_lb, notes, created_at
- production_batch_lots: id, batch_id (fk production_batches), lot_id (fk lots), lbs_consumed, lot_unit_cost (snapshot at consumption). Records which raw lots fed a batch. This is the trace link and the specific-identification cost.
- finished_goods: id, batch_id (fk production_batches), finished_product_id (fk products), lbs_produced, lbs_remaining, cost_per_lb (production cost, raw plus processing), produced_date. Each batch yields one finished lot.

### Sales

- customers: id, name, notes, created_at
- sales: id, sale_number (unique), customer_id (fk customers, optional), sale_date, created_at
- sale_items: id, sale_id (fk sales), finished_goods_id (fk finished_goods, the exact finished lot sold), lbs_sold, price_per_lb, cost_per_lb (snapshot for margin reporting). The link to a finished lot is what makes every sale traceable.

### AI-support state (new for this scope)

- alerts: id, type (one of: margin_below_target, low_stock, cost_anomaly, yield_anomaly, price_stale), severity (low, medium, high), subject (a reference to the product, lot, or batch it concerns), message (plain language), suggested_action (what to do, for example a reprice value), status (open, dismissed, actioned), created_at. Alerts persist so the owner can see, act on, or dismiss them.
- import_drafts: id, source (photo or text), captured_at, raw_capture (the original image or text), status (pending, confirmed, discarded). Staging for AI-parsed input before it is written.
- import_draft_lines: id, import_draft_id (fk import_drafts), parsed fields matching a receive action (product guess, vendor guess, weight, unit_cost, date), confidence, resolved (whether the human accepted or corrected it). On confirm, each accepted line becomes a lot via the normal receive operation.

### Derived reads (views)

Views are read-only shapes the app and the AI read from. They never contain logic
the app is allowed to bypass.

- v_product_pricing: per finished product, the full cost build-up: raw moving-average cost, post-shrink cost, processing fees, target margin, resulting cost per lb, and suggested price per lb. The AI advisor reads this.
- v_current_menu: per finished product, its suggested price and whether it is sellable now (has finished stock, or has raw available to make it). The menu reads this.
- v_sale_traceability: per sale line, the full chain: sale, finished product, batch, production date, raw lot, raw product, vendor, received date, lbs drawn from that lot, and that lot's cost. Both forward trace (sale to origin) and reverse trace (lot to every sale) read this.

## 5. The deterministic engine (behavioral contracts, no code)

Three operations are the only way inventory and cost change. The app and the AI
call these; nothing writes to lots, inventory_balances, production, finished goods,
or sales directly.

### Receive raw

Input: raw product, vendor, weight in lbs, unit cost per lb, received date.
Behavior: creates a new lot at the given true cost, then rolls the product's moving
average forward using a weighted average of existing on-hand value and the new
receipt. Guarantees: the new lot's unit_cost is permanent and is never overwritten
by later, pricier receipts; on-hand quantity equals the sum of remaining lot lbs.

### Produce a batch

Input: finished product, raw lbs to consume, optional measured finished lbs out,
production date.
Behavior: consumes raw lots oldest-first (FIFO), records exactly which lots and how
many lbs from each, applies shrink to compute finished lbs out (raw lbs times one
minus shrink, unless a measured yield is given), sums the true cost of the lots
consumed, and produces finished goods costed at that raw cost plus per-lb processing
fees, divided across the finished weight. Guarantees: batch cost uses the actual
lots consumed (specific identification), not the moving average; shrink is baked into
cost by dividing true raw cost by the smaller finished weight.

### Record a sale

Input: finished product, lbs, price per lb, optional customer, sale date.
Behavior: depletes finished goods oldest-first, recording one sale line per finished
lot consumed, each carrying a cost snapshot. Guarantees: every sale line resolves,
through its finished lot and batch, to one or more raw lots with a vendor and dates.

## 6. Costing guarantees (the invariants)

These are the correctness contract of the whole system. They are stated as fixed,
checkable guarantees and must remain true through every change. A builder should
turn each into an automated test that runs as a hard gate.

1. Moving average: receiving 5,000 lbs at 1.68 then 3,000 lbs at 1.80 yields a moving average of exactly 1.725 per lb.
2. Pricing build-up: with a raw cost of 1.68 at 23 percent shrink and processing fees of 0.05, 0.03, and 0.37 per lb, the finished cost is 2.6318 per lb before margin.
3. Shrinkage yield: 2,000 lbs of raw at 23 percent shrink yields 1,540 lbs finished.
4. Lot cost immutability: a lot's unit cost is never changed after it is recorded. Rising costs create new lots.
5. FIFO specific identification: production consumes raw lots oldest-first and costs a batch from the actual lots consumed, not the average.
6. Conservation: on-hand quantity always equals the sum of remaining lot lbs, and finished remaining never exceeds finished produced.
7. Traceability: every sale traces to at least one raw lot with a vendor and a received date, and any lot traces forward to every sale it touched.

## 7. The AI layer

The AI operates in three modes over the deterministic engine: answer, watch, and
advise. All three obey the core principle in section 2.

### Answer (ask your data)

The owner asks questions in plain language ("how much raw turkey do I have," "what
is my margin on smoked necks," "what did I pay for the lot behind that sale"). The
system answers by selecting from a fixed catalog of typed queries over the views and
filling in the parameters. It does not generate arbitrary queries. Every answer is
grounded in a query defined by the builder, so answers cannot drift or fabricate.
The query catalog is an explicit, enumerable list; unknown questions are declined or
clarified rather than guessed.

### Watch (alerts)

The system watches its own data and raises alerts, learning normal ranges from
history rather than relying only on hardcoded thresholds:
- Margin below target: a product's suggested price at its current list yields less than its target margin.
- Low stock: raw availability is low against recent consumption rate.
- Cost anomaly: a receipt priced far outside the product's historical range.
- Yield anomaly: a batch yield far off the product's usual shrink.
- Price stale: a list price that has not moved while its cost has drifted.
Delivery: urgent alerts surface immediately; the rest roll into a plain-language
daily digest. Every alert carries a next step (for example a reprice value or a
draft purchase), so an alert is actionable, not just informational.

### Advise (pricing and purchasing)

- Pricing advisor: holds each product's target margin against its live cost, and when cost moves it proposes a new price with the reasoning shown, applied by the owner with one tap. Includes a what-if mode: given a hypothetical raw cost, show every resulting price and margin. The engine computes the numbers; the AI frames and explains them.
- Purchasing advisor: because shrink means the cheapest raw is not the cheapest finished product, the advisor ranks vendors and raw options on true post-shrink finished cost, using the owner's own lot history. It can flag reorder timing from consumption rate. A market price feed (industry poultry pricing) is a later enhancement that would let it advise against market, not just against the owner's own history.

### Input assistance (data entry)

- Conversational entry: the owner types or speaks a receipt or production event in natural language; the AI parses it into a draft action shown for confirmation.
- Document ingestion: the owner photographs a vendor invoice or price sheet; the AI extracts line items into import drafts for one-tap confirmation. Extraction is always a draft; nothing is written until the human confirms.

## 8. Interaction and platform

Platform: a web application, installable as a PWA so it feels app-like on a phone or
tablet without an app store. One codebase serves the office (pricing, advisor,
analytics, trace) and the floor (receiving, production).

Interaction model: adaptive. The owner can drive by structured forms, by asking in
natural language, and by responding to pushed alert cards. Forms give structure when
he wants it; chat and voice remove friction; cards bring the system to him.

## 9. Offline behavior

The ledger math is order-dependent (moving average and FIFO both depend on
sequence), so the device must never compute the ledger. The offline model is
capture-and-queue, not offline-first: when connectivity drops, the two floor screens
(receiving and production) store the raw input locally and queue it; on reconnect the
queued events replay through the same server operations, in order, and the average
and FIFO run exactly once, server-authoritative. Queued operations carry an
idempotency key so a replay can never double-apply. The office features assume
connectivity. For the MVP, the app is a PWA but the offline queue is roadmap unless
the owner's floor has a real connectivity dead zone.

## 10. MVP scope

The MVP exists to sell the idea, so it is narrow and solid rather than broad. It has
two parts.

### Credibility spine (must be flawless)

Receive, produce, price, sell, and trace, as polished screens, seeded with the
owner's real products and real prices so the first thing he sees is his own catalog
and prices he recognizes. If this is trustworthy, the AI on top is believed.

### Three AI moments

- Margin advisor with what-if: the money moment. Target margin per product, a pushed reprice suggestion when cost moves, one-tap apply, and a hypothetical-cost projection.
- Ask your data: typed queries over the views, answered in plain language.
- Invoice-photo entry: snap an invoice, confirm the drafted lots. Directly answers the "I don't want another spreadsheet" objection.

### Explicitly out of MVP (state as roadmap)

Market price feed, authentication and multi-user, voice, customer-quote documents,
usage forecasting, recall-notice drafting, and the full offline sync engine. Two
worth naming aloud as near-term roadmap: recall-notice drafting (the reverse trace
already exists) and market-based pricing.

### Selling narrative (acceptance in spirit)

The demo should run: open on the owner's real menu; a delivery arrives, photograph
the invoice, lots created and the average moves; the system pushes a margin alert
with a one-tap reprice; ask it a question aloud and get a real number; then a
customer complaint, trace a sale to its vendor and date in one click and reverse it
to every affected customer. Close: this is your spreadsheet, except it watches your
margins, warns you before you lose money, and traces a recall in seconds.

## 11. Non-negotiable boundaries (seed these into project rules)

- Never compute cost, price, shrink, average, or margin outside the deterministic engine.
- Never write to lots, inventory_balances, production, finished goods, or sales except through the three operations.
- Never change a lot's unit cost after it is recorded.
- Never let the AI answer with a fabricated or freely generated query; answers come only from the typed query catalog over the views.
- Never write AI-extracted data without human confirmation.
- Never auto-apply a price or purchase; the human approves every action.
- Never let a device compute the ledger offline; capture and replay server-side.

## 12. Verification philosophy

Correctness is proven, not asserted. The seven invariants in section 6 are automated
tests that run against the real engine and act as a hard gate on every change. UI
behavior is verified in a real browser. AI features are verified two ways: that the
numbers they surface match the engine exactly, and that they degrade safely (decline
or ask rather than guess) when a question falls outside the query catalog or an
extraction is low confidence.

## 13. Feature breakdown (units of work to spec and build)

Build in this order. Each becomes its own per-feature spec. Each depends on the
previous being complete and its gate green.

1. Foundation: the schema and the three operations, with the seven invariants as automated tests. (Largely already built and verified.)
2. Receiving: log a raw purchase, see on-hand and average update.
3. Production: convert raw to finished with shrink and FIFO, show consumed lots and batch cost.
4. Menu and pricing with the margin advisor: availability-aware menu, cost build-up, target margin, reprice suggestions, what-if.
5. Sales and traceability: record sales, forward and reverse trace.
6. Ask your data: the typed query catalog and the plain-language answer surface.
7. Alerts: the watch layer and the daily digest.
8. Invoice-photo and conversational entry: the import-draft flow with confirmation.

## 14. Glossary

- Lot: one incoming purchase of a raw product, with its own true cost and vendor. The unit of traceability.
- Shrink: weight lost in processing, as a fraction. Raw weight times one minus shrink equals finished weight.
- Moving average cost: the weighted-average cost of a raw product across all receipts still on hand. Used for forward pricing.
- FIFO: first in, first out. Production consumes the oldest raw lots first.
- Post-shrink cost: raw cost adjusted upward because fewer finished pounds carry the same raw dollars.
- Specific identification: costing a batch from the actual lots it consumed, not the average.
- Target margin: the margin percent the pricing advisor holds a product to as costs move.
- Forward trace: from a sale back to its raw lots and vendor. Reverse trace: from a lot forward to every sale it reached.
