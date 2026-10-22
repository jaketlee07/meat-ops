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

Primary user: the business owner, who owns and operates the processing business:
non-technical, working partly at a desk and partly on the plant floor. The MVP
has one other user, the developer, who holds an account to help resolve issues.

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
- products: id, code (unique, the owner's own code), description, brand, species, kind (one of: raw, finished), pack_style, lbs_per_pack, raw_product_id (fk products, set only on finished products, the raw input it is made from), shrink_pct (set only on finished products, fraction between 0 and 1), target_margin_pct (finished only, optional, a fraction from 0 up to but not including 1: the share of the selling price the owner wants as margin; with a target the suggested price is cost per lb divided by one minus the target, rounded up to the cent, and the margin fees stop counting for that product; with no target the product keeps the sheet price), list_price_per_lb (finished only, optional, the price the owner charges, in dollars and cents; it changes only when the owner sets it), active, created_at
- fee_types: id, code, name, kind (one of: processing, margin), sort_order
- product_fees: product_id (fk products), fee_type_id (fk fee_types), amount_per_lb. Composite key of the two ids. Holds the per-lb processing fees for each finished product.

Note on the finished-product recipe: for the MVP each finished product is made from
exactly one raw product (a one-to-one recipe via raw_product_id). Multi-ingredient
blends are a later extension via a separate components table.

Note on margin: margin evolves from the spreadsheet's flat per-lb "profit" fee to a
target_margin_pct per finished product, so margin holds as costs move. A product
with no target keeps the sheet price: cost plus its per-lb margin fees. The flat
processing fees (cutting, freezing, overhead, and so on) remain per-lb.

### Inventory and cost state

- inventory_balances: product_id (pk, fk products, raw products only), qty_on_hand (lbs), moving_avg_cost (per lb), updated_at. This is the authoritative rolling average used for forward pricing. It is the stock-on-hand average: the value of the lbs still on hand divided by those lbs, rounded to 4 decimals. When no lbs are on hand it is the zero-stock average that docs/costing.md gives.
- lots: id, lot_number (unique, human readable), product_id (fk products, a raw product), vendor_id (fk vendors), received_date, weight_lbs (as received), unit_cost (per lb, the true price paid), remaining_lbs (depletes as production consumes it), notes, created_at, receipt_seq (insertion order, breaks ties between lots with the same received_date), prior_avg_cost (the product's moving_avg_cost just before this lot was received), voided_at and void_reason (both set or both empty), corrected_unit_cost and corrected_weight_lbs (the values of the latest correction, empty on a lot never corrected), and current_unit_cost and current_weight_lbs (generated: the corrected value, or the recorded one when there is none). A lot is both the cost record and the traceability anchor. vendor_id is required. unit_cost, weight_lbs, product_id, vendor_id, received_date, lot_number, and prior_avg_cost are immutable once written; a database trigger refuses any change to them. Remaining lbs run from 0 to current_weight_lbs. Every reader that costs or weighs a lot reads the current columns.

### Production

- production_batches: id, batch_number (unique), finished_product_id (fk products), production_date, raw_lbs_in, shrink_pct_used, finished_lbs_out, raw_cost_total, cost_per_finished_lb, notes, created_at, stock_seq (the stock-change order number, from the sequence private.stock_change_seq that lot_adjustments shares, taken while the operation holds the raw product's stock row), reversed_at and reversal_reason (both set or both empty; a reversed batch stays in the table). A lot's used lbs count only batches that are not reversed.
- production_batch_lots: id, batch_id (fk production_batches), lot_id (fk lots), lbs_consumed, lot_unit_cost (the lot's current cost; it follows a receipt correction). Records which raw lots fed a batch. This is the trace link and the specific-identification cost.
- finished_goods: id, batch_id (fk production_batches), finished_product_id (fk products), lbs_produced, lbs_remaining, cost_per_lb (production cost, raw plus processing), produced_date, produced_seq (insertion order, breaks ties between lots with the same produced_date). Each batch yields one finished lot.

### Sales

- customers: id, name, notes, created_at
- sales: id, sale_number (unique), customer_id (fk customers, optional), sale_date, created_at, voided_at and void_reason (both set or both empty)
- sale_items: id, sale_id (fk sales), finished_goods_id (fk finished_goods, the exact finished lot sold), lbs_sold, price_per_lb, cost_per_lb (its finished lot's cost; it follows a receipt correction). The link to a finished lot is what makes every sale traceable.

### Corrections

- lot_adjustments: id, lot_id (fk lots), old_remaining_lbs, new_remaining_lbs, reason (one of: count, waste, spoilage, other), note, adjusted_at, stock_seq (the stock-change order number production_batches also takes). One row per adjust_lot call. A voided receipt or sale stays in its table, marked with a reason and a time; nothing is deleted.
- receipt_corrections: id, lot_id (fk lots), old_unit_cost, new_unit_cost, old_weight_lbs, new_weight_lbs, reason, corrected_at, correction_seq (orders corrections; the latest has the highest number). One row per correct_receipt call. The lot keeps what was first entered.

### AI-support state (new for this scope)

- alerts: id, type (one of: margin_below_target, low_stock, cost_anomaly, yield_anomaly, price_stale), severity (high, medium, low), product_id (fk products: the finished product of a margin, price, or yield alert, the raw product of a cost or low-stock alert), lot_id (fk lots, a cost alert only), batch_id (fk production_batches, a yield alert only), facts (jsonb: the figures the alert was saved with, rounded when stored), status (open, dismissed, actioned, cleared), created_at, updated_at, closed_at (when it left open), ended_at (when its episode ended: a watch found the condition gone, or the owner repriced from it). The alert's sentence and next step are worded from facts when a page shows it. Alerts persist so the owner can see, act on, or dismiss them. Only the watch writes them, and the owner's dismiss and reprice presses.
- alert_digests: digest_date (primary key, the app's today), status (writing, written, failed), paragraphs (1 to 6 of 1 to 800 characters, when written), failure_kind (when failed), model, claimed_at, finished_at. One row is one day's claim, so the page asks the model at most once a day on its own.
- private.list_price_changes (not in the Data API): seq, product_id (fk products), old_price, new_price, cost_per_lb (the product's cost per lb at that moment, empty when it had none), changed_at, baseline (true for the row the migration wrote for a list price that already existed). A trigger on products writes one row for every list-price change, whoever makes it.
- import_drafts: id, source (photo or text), capture_text (the typed text, for a text draft), capture_image and capture_image_type (the photo and its media type, for a photo draft), captured_on (the capture date: the device's today sent with the read), captured_at, model (the model that read it), status (pending, confirmed, discarded), settled_at (set once the draft is confirmed or discarded). A discard clears the photo, its type, and the text. Staging for AI-parsed input before it is written.
- import_draft_lines: id, import_draft_id (fk import_drafts), line_no (1 to 30), words (the invoice's own words for the line; cleared on a discard), the drafted fields matching a receive action (product_id, vendor_id, weight_lbs, unit_cost, received_date, each empty when the reading gave no usable value or was unsure), unsure_fields (which of product, vendor, weight, cost, date the reader was unsure of), status (pending, saved, skipped), lot_id (the lot a saved line made). On confirm, each ticked line becomes a lot via the normal receive operation.

### Derived reads (views)

Views are read-only shapes the app and the AI read from. They never contain logic
the app is allowed to bypass.

- v_product_pricing: per finished product, the full cost build-up: raw moving-average cost, post-shrink cost, processing fees, target margin, resulting cost per lb, and suggested price per lb, plus the list price, whether the raw input has a cost, the suggested list price, the margin at the list price, the price action (set, raise, or lower), and whether the product needs a new price or is below its target. The pricing page and the AI advisor read this. The what-if function price_what_if works out the same cost, price, and margin for a typed raw cost.
- v_current_menu: per finished product, its suggested price, its list price, and whether it is sellable now (has finished stock, or has raw available to make it). The menu reads this.
- v_sale_traceability: per sale line, the full chain: sale, customer name (empty when the sale has no customer), sale line id, finished product, lbs sold and price per lb on the line, batch, production date, raw lot, raw product, vendor, received date, lbs drawn from that lot, and that lot's current cost. Void sales do not appear. It also carries the sale, the customer, the raw product's code, and the keys that put batches and lots in the order they were drawn. Both forward trace (sale to origin) and reverse trace (lot to every sale) read this.
- v_sale_summary: one row per sale, void or not, with its finished product, customer name (empty when the sale has no customer), total lbs sold, price per lb, and the void time and reason. The sales page reads it.

## 5. The deterministic engine (behavioral contracts, no code)

Eight operations are the only way inventory and cost change: receive raw, produce a
batch, record a sale, void a receipt, void a sale, adjust a lot, correct a receipt, and
reverse a batch.
The app and the AI call these; nothing writes to lots, inventory_balances, production,
finished goods, sales, lot_adjustments, or receipt_corrections directly. Each operation checks that the caller is the
owner, refuses invalid arguments before it takes any lock, and changes nothing when
it refuses. Receive raw, produce a batch, void a receipt, adjust a lot, correct a receipt, and reverse a batch lock the raw
product, so they queue one behind another on that product. Correct a receipt also locks the
finished products made from the lot, after the raw product. Reverse a batch locks the batch's
finished product after the raw product, before it locks the batch. Record a sale and void a
sale lock the finished product they draw from, so they queue one behind another on that
product. Producing a batch and recording a sale on one finished product lock different
things and do not queue on each other. After it has its lock, an operation reads stock
or lot state and refuses a call that no longer fits (a shortfall, or a lot already void).

### Receive raw

Input: raw product, vendor, weight in lbs, unit cost per lb, received date.
Behavior: creates a new lot at the given true cost, then rolls the product's moving
average forward using a weighted average of existing on-hand value and the new
receipt. Guarantees: the new lot's unit_cost is permanent and is never overwritten
by later, pricier receipts; on-hand quantity equals the sum of remaining lot lbs. The
new lot records the average from just before it arrived (its prior_avg_cost).

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

### Void a receipt

Input: lot, void reason (at least one non-space character).
Behavior: marks a receipt that nothing has touched as void, with the reason and a
time, and takes its lbs out of stock. The lot stays in the table with 0 lbs
remaining. It is refused when a batch that is not reversed has consumed from the lot, when
the lot has an adjustment, or when it is already void. When the void leaves a raw product
with no lbs on hand, the average is recomputed as the zero-stock average that
docs/costing.md gives, as if the voided receipts had never been entered.
Otherwise the average is the stock-on-hand average of the lots still held.

### Void a sale

Input: sale, void reason (at least one non-space character).
Behavior: marks the sale void, with the reason and a time, and returns each sale
line's lbs to the finished lot it came from. The sale leaves v_sale_traceability.
It is refused when the sale is already void.

### Adjust a lot

Input: lot, new remaining lbs, reason (count, waste, spoilage, or other), optional note.
Behavior: sets the lot's remaining lbs to the counted value and records an
adjustment row with the old lbs, the new lbs, and the reason. The new value runs from
0 up to the lot's current weight minus the lbs batches that are not reversed have consumed
from it. The
lot's unit cost does not change, and the product's average moves to the stock-on-hand
average. It is refused on a void lot.

### Correct a receipt

Input: lot, new cost per lb, new weight in lbs, reason (at least one non-space character).
Behavior: records a correction row with the old and new cost and weight, and makes the
new values the lot's current cost and weight. The lot keeps what was first entered, and
its lot number, vendor, and received date never change. The weight change moves the lot's
remaining lbs by the same amount. A cost change restates every batch made from the lot,
keeping the processing fees the batch was costed with: the batch's raw cost total and cost
per finished lb, its finished lot's cost, and the cost on each sale line from that finished
lot. The product's average moves to the stock-on-hand average at current cost, and at
0 lbs on hand it is recomputed as the zero-stock average that docs/costing.md gives. It is refused on a void lot, when neither the cost nor the
weight changes, when the new weight is below what production used and adjustments
removed, and for a bad cost, weight, or reason. A correction is undone by correcting back.

### Reverse a batch

Input: batch, reason (at least one non-space character).
Behavior: in one step, voids every non-void sale with a line on the batch's finished lot
as Void a sale does, with the reason "Reversed with batch <number>: <reason>" and the
batch's reversal time; takes the batch's finished lot to 0 lbs; returns each consumption
row's lbs to the lot it came from; and marks the batch reversed with the reason and a
time. The consumption rows stay as the record, and the raw product's average moves to
the stock-on-hand average. It is refused when the batch is already reversed, when the
batch does not exist, and for a blank reason. A reversal cannot be undone.

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
the app's typed reads, and filling in the parameters. It does not generate arbitrary
queries. Every answer is grounded in a query defined by the builder, so answers cannot
drift or fabricate.
The query catalog is an explicit, enumerable list; unknown questions are declined or
clarified rather than guessed. The catalog's questions are listed in
`docs/architecture/overview.md` (AI connection).

### Watch (alerts)

The system watches its own data and raises alerts, learning normal ranges from
history rather than relying only on hardcoded thresholds. Five rules run in
Postgres (`refresh_alerts`) every time a header page renders, which includes the
page a save returns to. Each compares exact values and stores its figures rounded. "Recent" is the 14
days ending today, and the app passes today in its own time zone.
- Margin below target (urgent, severity high): an active finished product whose margin at its list price is below its target margin.
- Cost anomaly (urgent, high): a recent, non-void receipt, read at its current cost (a corrected receipt's corrected cost), of an active raw product that has at least 3 earlier receipts and a usual cost above 0. The usual cost is the median cost per lb of the latest 10 earlier receipts. It alerts when the cost differs from the usual by at least the larger of 10% and 3 times the usual swing (the median of each receipt's distance from the usual cost, as a share of it).
- Yield anomaly (medium): a recent batch that is not reversed, of an active finished product whose measured shrink (1 minus finished lbs over raw lbs) differs from the usual shrink by at least the larger of 3 points and 3 times the median distance of the reference batches from it. A batch is measured unless its finished lbs equal what the batch's shrink used gives. The usual shrink is the median of the latest 10 earlier measured batches that are not reversed when there are at least 3, otherwise the batch's own set shrink with a 3 point band.
- Low stock (medium): an active raw product with less than 7 days left, which is its on-hand lbs over its daily use, the lbs drawn by batches that are not reversed in the last 28 days divided by 28. The alert suggests ordering 14 days of use, rounded up to a whole lb.
- Price stale (low): an active finished product with a list price, needing a new price but not below target, whose cost per lb has moved 5% or more since its last list-price change recorded (a recorded cost above 0).
An alert is open until the owner dismisses it or reprices from it, or a watch finds
its condition gone and clears it. A dismissed alert stays dismissed until its
problem clears; if the problem returns, a new alert opens.
Delivery: urgent alerts (margin and cost) surface immediately in a banner on every
page and wait on `/alerts`; the rest wait on `/alerts`. The first visit to `/alerts`
each day asks the model to write a plain-language digest of the open alerts from
the alerts' own sentences and figures; its text is shown only when every number in
it comes from those sentences and every alert's product code is in it. A number
is a run of any Unicode number characters (digits 0 to 9, full-width digits,
fractions, superscripts) with any "," or "." between two of them. A digest
paragraph may hold only plain characters: printable ASCII, curly single and
double quotes, the en dash, the em dash, the ellipsis, and a letter or number
character the alerts' own text holds, never an invisible formatting character.
One paragraph that holds any other character refuses the whole digest, so while an
alert is open on a product whose code holds a character a digest may not copy (a
symbol such as "°" or "®", a non-breaking space, or a combining mark), no
digest can be written. The checks
do not catch a sign or unit the model adds, a figure written in words, or a letter
beside a digit; the alert list under the digest always shows the engine's own
figures. Every alert carries
a next step: a one-press list price for the two price alerts, and a
sentence and a link for the other three. Nothing changes a price but the owner's
press.

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

The owner's login is in scope for this part. The owner signs in with an email and a
password of at least 12 characters. The owner's account is created by hand and added
to an allowlist; public sign-up is off. A signed-in user who is not on the allowlist
reads nothing and calls no operation. The business owner and the developer are the MVP's two users.

### Three AI moments

- Margin advisor with what-if: the money moment. Target margin per product, a pushed reprice suggestion when cost moves, one-tap apply, and a hypothetical-cost projection.
- Ask your data: typed queries over the views and the app's typed reads, answered in plain language.
- Invoice-photo entry: snap an invoice, confirm the drafted lots. Directly answers the "I don't want another spreadsheet" objection.

### Explicitly out of MVP (state as roadmap)

Market price feed, users and roles beyond the business owner and the developer, voice, customer-quote documents,
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
- Never write to lots, inventory_balances, production, finished goods, sales, lot_adjustments, or receipt_corrections except through the operations in section 5.
- Never change a lot's unit cost after it is recorded. A correction adds a current cost beside it.
- Never let the AI answer with a fabricated or freely generated query; answers come only from the typed query catalog over the views and the app's typed reads.
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

Each feature becomes its own per-feature spec. The numbers name the features, and
other documents cite them, so they stay fixed even where the build order differs.

1. Foundation: the schema and the six operations, with the seven invariants as automated tests. (Largely already built and verified.)
2. Receiving: log a raw purchase, see on-hand and average update.
3. Production: convert raw to finished with shrink and FIFO, show consumed lots and batch cost.
4. Menu and pricing with the margin advisor: availability-aware menu, cost build-up, target margin, reprice suggestions, what-if.
5. Sales and traceability: record sales, forward and reverse trace.
6. Ask your data: the typed query catalog and the plain-language answer surface.
7. Alerts: the watch layer and the daily digest.
8. Invoice-photo and conversational entry: the import-draft flow with confirmation.

Build in this order, which follows the real dependencies. Each step starts only
when every feature in the step before it is complete and its gate green.

1. Features 1, 2, 3, and 4, one at a time in that order.
2. Features 5 (Sales) and 8 (Invoice-photo entry), built at the same time. Neither depends on the other.
3. Feature 7 (Alerts).
4. Feature 6 (Ask your data). It needs the sales data from feature 5 and the AI connection that feature 8 sets up.

## 14. Glossary

- Lot: one incoming purchase of a raw product, with its own true cost and vendor. The unit of traceability.
- Shrink: weight lost in processing, as a fraction. Raw weight times one minus shrink equals finished weight.
- Moving average cost: the weighted-average cost of a raw product across all receipts still on hand. Used for forward pricing.
- FIFO: first in, first out. Production consumes the oldest raw lots first.
- Post-shrink cost: raw cost adjusted upward because fewer finished pounds carry the same raw dollars.
- Specific identification: costing a batch from the actual lots it consumed, not the average.
- Target margin: the margin percent the pricing advisor holds a product to as costs move.
- Forward trace: from a sale back to its raw lots and vendor. Reverse trace: from a lot forward to every sale it reached.
