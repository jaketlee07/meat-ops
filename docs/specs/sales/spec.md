# Spec: sales

- **Status:** Draft <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §2 (deterministic engine), §4 (customers, sales, sale_items, `v_sale_traceability`), §5 "Record a sale" and "Void a sale", §6 invariant 7, §10 (the selling narrative's trace and reverse trace), §11 (boundaries), §12 (verification), §13 item 5; [`docs/costing.md`](../../costing.md) (invariant 7, the `void_sale` rule, the Rounding note); the access model, the write path, the `supabase/migrations/` change guidance, and the app trust boundary in [`docs/architecture/overview.md`](../../architecture/overview.md)
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the views, the pages, and the server actions are consumed only by this app; no published interface)
- **Shape:** mixed

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory — it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

The owner records each sale on `/sales` and answers any trace question on
`/trace`.

On `/sales` the owner types a finished product's code. The screen shows its
description, its list price, and its finished pounds on hand, and fills the
price per lb with the list price. The owner keeps that price or types a deal
price, enters the pounds sold, picks a customer or "No customer", and sets the
sale date. One sale is one product: an order of three products is three sales.
The engine draws finished lots oldest first. The screen then shows the sale the
engine wrote, each finished lot it drew from, and the product's finished pounds
on hand before and after. The 10 most recent sales are listed, each linking to
its trace. A sale entered by mistake is voided there with a reason, which puts
its pounds back in stock and takes it out of every trace.

On `/trace` the owner finds a sale by its number and sees where it came from:
each finished lot it drew from, with its batch and production date, and each raw
lot behind that batch, with its vendor, received date, the pounds the batch drew
from it, and its cost. For a recall, the owner finds a raw lot by its raw
product's code and, if they know it, its received date. The lot's page shows its
vendor, received date, and raw pounds still on hand; every customer who bought
from it; every sale made from it; and the finished stock made from it that is
still on hand. Each raw lot on a sale's trace links to the lot's page, and each
sale on a lot's page links back to the sale's trace.

Every pound, price, cost, and date figure on these pages comes from the
database, a sale's total pounds included. The app computes no stock, total,
cost, price, or margin.

The pages keep the floor screens' goals: hard to mistype first, fast on a phone
second, and numbers that are easy to trust third.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Costing truth and display formats | Applicable: a sale's price per lb joins the price format, "No customer" joins the missing-value texts, and a new view sums a sale's pounds, so the file's statements on formats and on where the math lives change | `docs/costing.md` | jaketlee07 | The Rounding note's price row covers a sale's price per lb; its missing-value list has "No customer" for a sale with no customer; the sentence on where the math lives names `v_sale_summary`; the file's opening names `test/e2e/sales.spec.ts` and `test/e2e/trace.spec.ts` among the suites that check the missing-value texts | close-work finds each named statement in the file and the "No customer" text in a passing browser test |
| Master brief (current product truth) | Applicable: the brief lists the derived views and the columns of `v_sale_traceability` | `SYSTEM-SPEC.md` §4 "Derived reads (views)" | jaketlee07 | The `v_sale_traceability` entry names the sale, the customer, the raw product's code, and the draw-order keys it now carries; a `v_sale_summary` entry says it gives one row per sale, void or not, with its product, customer, total pounds, price per lb, and void marks, and that the sales page reads it | close-work finds both entries and finds them matching the migration |
| Current architecture and app trust boundary | Applicable: two routes, two server actions, new `src/lib/` modules, a new view, and two more ledger operations called from the app change the areas map, the access model, the write path, and the failure notes | `docs/architecture/overview.md` | jaketlee07 | The `src/app/` row names `/sales` with its form, result, recent sales, and void, and `/trace` with its sale trace, lot finder, and lot trace; it names `saveSale` and `voidSale`, says `_server/caller.ts` settles the caller for both, and says where their decisions live. The `src/lib/` row names the sales reads, the trace reads, and the sale and lot-finder form rules. The `test/` and `test/e2e/` rows name the new suites. The access model counts four views. The write path says the app changes the ledger only through `receive_lot`, `void_receipt`, `produce_batch`, `record_sale`, and `void_sale`. The failure notes cover a sale save and a sale void | close-work confirms each named row and sentence exists and matches `src/`, `supabase/`, and `test/` |
| Interface compatibility | Applicable: the migration adds a view and view columns, so the generated types change | `src/lib/database.types.ts` | jaketlee07 | AC-0172 passes | `npm run gen:types` leaves no diff on the closing commit |
| Agent guidance and commands | Not applicable: no command, variable, or setup step changes | none | n/a | n/a | n/a |
| User documentation | Not applicable: no user-docs surface exists, the owner is the only user, and the screen labels carry the task | none | n/a | n/a | n/a |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions and the reasons in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

### Always do

- Read every pound, price, cost, and date figure of a sale, a sale line, a finished lot, a batch, or a raw lot from the database, a sale's total pounds and a product's finished pounds on hand included.
- Show every weight, price, cost, and date through `src/lib/format.ts` and the formats in the `docs/costing.md` Rounding note. Form fields keep what the owner typed or picked; the price per lb field's starting value is the stored list price written with 2 decimals; message text shows as written, the engine's reason in AC-0056 included.
- Change the ledger from these pages only through `record_sale` and `void_sale`, called with the signed-in user's session.
- Settle the caller inside every server action before it reads or writes anything else, through `src/app/_server/caller.ts`.
- In the migration, create or replace every view `with (security_invoker = true)`, keep every column `v_sale_traceability` already has, and follow the `supabase/migrations/` change guidance in `docs/architecture/overview.md` for the view it adds.
- Run `npm run typecheck`, `npm run build`, and `npm test` after each task; a red result stops the work until it is green.

### Ask first

- Any change to the six operations, to `v_product_pricing` or `v_current_menu`, or to a table, a grant, or a policy other than the new view's grants. The one exception is the browser test for AC-0047 and AC-0048, which revokes and then restores the operator's SELECT on `sale_items` on the local stack.
- Any change to a number already asserted in `test/costing.test.ts` or `test/pricing.test.ts`.
- Adding any npm package.
- Adding a route beyond `/`, `/sign-in`, `/receiving`, `/production`, `/menu`, `/pricing`, `/sales`, and `/trace`.
- Changing what the receiving, production, menu, or pricing page shows or does, beyond the AC-0007 navigation links.
- Any write to the hosted Supabase project, or pointing the app at it.

### Never do

- Compute a stock, total, cost, price, shrink, average, or margin figure in TypeScript. That includes adding up a sale's lines, predicting which finished lots a sale will draw, working out a "before" value from an "after" value, and filling the price per lb with anything but the stored list price.
- Change a list price, a target margin, a customer, or a vendor from these pages.
- Add a table, a table column, or a database function.
- Call an AI model or add an AI client library.
- Import a Postgres driver under `src/`, or import anything from `src/app/` into `src/lib/`.
- Edit an existing migration file.
- Commit a new top-level directory, or add a PWA manifest, a service worker, or offline queueing.
- Read a privileged variable anywhere under `src/`, except in `src/privileged-env.ts`. "Privileged variable" is defined in the receiving spec's Acceptance Criteria definitions ([`../receiving/spec.md`](../receiving/spec.md)).

## Testing Strategy

The Vitest suites and the Playwright browser suite run under `npm test` against the local Supabase stack. Goal-based checks run as the commands their criteria name. Each criterion is listed once, under the check that closes it.

- **TDD against the local stack: the sale views (AC-0010, AC-0011, AC-0012, AC-0015)**: each is an exact row, a row count, or a role's read over fixtures built through the operations, so a wrong view fails it.
- **TDD against the local stack, through the existing catalog sweep (AC-0013, AC-0014)**: `test/access.test.ts` reads every relation in `public` from the catalog, so it reaches the new view with no new list entry and must stay green.
- **TDD, no database: the sale and lot-finder form rules, the sale and void messages, and the save and void actions' decisions**: pure rules over typed text, error codes, and fake database calls, as construction for the browser and recorded criteria below. The engine's exact shortfall text, fed from a real refusal in the reads suite, pins the message rule to the engine's wording.
- **TDD against the local stack: the sales and trace reads**: the product list, the customer list, the recent sales with their choice, order, and count, a sale's lines in draw order, the lot finder's choice and order, and a lot's sales and stock, as construction for the page criteria below.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0040, AC-0041, AC-0042, AC-0043, AC-0044, AC-0045, AC-0046, AC-0047, AC-0048, AC-0050, AC-0051, AC-0052, AC-0055, AC-0056, AC-0058, AC-0059, AC-0070, AC-0071, AC-0072, AC-0073, AC-0074, AC-0075, AC-0076, AC-0077, AC-0078, AC-0079, AC-0080, AC-0081, AC-0082, AC-0083, AC-0084, AC-0085, AC-0086, AC-0089, AC-0090, AC-0091, AC-0092, AC-0093, AC-0095, AC-0096, AC-0097, AC-0098, AC-0099, AC-0100, AC-0101, AC-0102, AC-0110, AC-0111, AC-0112, AC-0113, AC-0114, AC-0115, AC-0116, AC-0117, AC-0118, AC-0119, AC-0120, AC-0121, AC-0122, AC-0123, AC-0124, AC-0125, AC-0126, AC-0127, AC-0128, AC-0129, AC-0130, AC-0131, AC-0132, AC-0134, AC-0135)**: each criterion is a state, a trigger, and an on-screen or returned outcome that only a real browser over the real server and database shows. The suite drives Chromium through Playwright, replays action requests through Playwright's request API, and reads and seeds raw tables through `pg`. For AC-0047 and AC-0048 the test withdraws the operator's read of `sale_items` on the local stack just before saving, and restores it whether or not the test passes.
- **E2E accessibility and phone-width checks (AC-0150, AC-0151, AC-0152, AC-0153, AC-0154, AC-0155, AC-0156, AC-0157, AC-0158, AC-0159, AC-0160, AC-0161, AC-0162, AC-0163)**: axe-core, measured element boxes, focus reads, and computed styles in the same browser suite give a pass or fail bar for each page state. The recorded run applies the same page-state checks to the two error pages, and the focus check of AC-0157 and AC-0159 to the recorded failures.
- **Manual QA recorded in the verification ledger (AC-0053, AC-0054, AC-0057, AC-0087, AC-0088, AC-0140, AC-0141)**: a recorded run against `npm run start`.
  - With the local REST service stopped before a page load, it records the `/sales` and `/trace` error pages, their text, their focus, their page-state checks, and the recovery after Try again.
  - With the REST service stopped after `/sales` loads, it records the AC-0053 message after Save sale and the AC-0087 message after confirming a void, with every field's value and the focused element after each.
  - With the app pointed at a throwaway forwarder between the app and the REST service, it records three cases. When the forwarder holds a save's `record_sale` call past the 10-second limit, it records the AC-0054 message, every field's value, the focused element, and whether a sale was written. When it holds a void's `void_sale` call past the limit, it records the AC-0088 message and the focused element. When it holds a save's `record_sale` call while a `pg` session removes the operator's allowlist row, then lets it through, it records the AC-0057 message, every field's value, the focused element, and that no sale was written; the row is restored afterwards.
- **Goal-based checks (AC-0016, AC-0017, AC-0170, AC-0171, AC-0172, AC-0173, AC-0174, AC-0175, AC-0176, AC-0177, AC-0178, AC-0179)**: each is settled by one command or one set of commands: a build, a test run, a type regeneration diff, a typecheck, a `grep`, a catalog read compared before and after, or a dependency audit.
- **Stub tally:** T1, T2, T3, and T4 are covered by validated stubs (`stub: true`); T5, T6, and T7 record `no stub (mode)`; none is uncovered.

## Acceptance Criteria

Definitions used by these criteria:

- **Operator, non-operator, signed-out visitor, active finished product, host scope:** as defined in the production spec's Acceptance Criteria definitions ([`../production/spec.md`](../production/spec.md)).
- **Ended session, focusable controls of a page state, non-void receipt:** as defined in the receiving spec ([`../receiving/spec.md`](../receiving/spec.md)). A **void receipt** is a `lots` row with a `voided_at`.
- **Sale:** one `sales` row. A **void sale** has a `voided_at`. A **sale line** is one `sale_items` row. A sale's **lbs** is the sum of its lines' `lbs_sold`, and its **price per lb** is its lines' `price_per_lb`, as the sale summary view gives them.
- **Finished lot:** one `finished_goods` row; each is made by one batch. A product's **finished lbs on hand** is the menu view's `finished_lbs_available`.
- **Sale summary view, trace view, menu view:** `v_sale_summary`, `v_sale_traceability`, and `v_current_menu`.
- **Entry order:** for sales, the order they were entered (`created_at`); for finished lots, `produced_seq`; for receipts, `receipt_seq`.
- **Draw order:** for finished lots, production date first, then entry order, as `record_sale` draws them; for raw lots, received date first, then entry order, as in `docs/costing.md` invariant 5.
- **The page's product list:** the active finished products as of the sales page's latest server render, with their list prices and finished lbs on hand.
- **Customer list:** every `customers` row.
- **A lot's sales:** the lines of non-void sales whose finished lot was made by a batch that drew from the lot. **A lot's finished stock:** the finished lots with lbs remaining above 0 that were made by a batch that drew from the lot.
- **The sale fixture:** RAW-TOM Turkey Drums TOM (raw) and 502 Smoked Turkey Drums Tom as in `test/db.ts`, with 502's shrink of 0.23, and with the vendors Reyes Meats and Valley Poultry and the customer Fulton Market Deli. RAW-TOM has lot A, 5,000 lbs at 1.68 from Reyes Meats, received 2026-10-01, entered first, and lot B, 3,000 lbs at 1.80 from Valley Poultry, received 2026-10-05, entered second. Batch 1 of 502, dated 2026-10-06 with 6,000 raw lbs, draws lot A's 5,000 lbs and then 1,000 lbs of lot B and makes 4,620 finished lbs. Batch 2 of 502, dated 2026-10-07 with 1,000 raw lbs, draws 1,000 lbs of lot B and makes 770 finished lbs. "With a 3.29 list price" sets 502's list price to 3.29; with none named, 502 has no list price.
- **The 5,000-lb sale:** in the sale fixture with a 3.29 list price, a sale of 502 of 5,000 lbs at 3.29 to Fulton Market Deli dated 2026-10-08. It draws batch 1's 4,620 lbs and then 380 lbs of batch 2.
- **Save refusals:** an AC-0029 or AC-0030 refusal, and the outcomes of AC-0050, AC-0051, AC-0052, AC-0056, and AC-0057. **Save failures:** the outcomes of AC-0053, AC-0054, and AC-0055.
- **Void refusals:** the outcomes of AC-0080, AC-0084, and AC-0085. **Void failures:** the outcomes of AC-0086, AC-0087, and AC-0088.
- **Page states:** the empty sales form; the form with a product chosen that has a list price; the form with a product chosen that has none; the form with no active finished product; the form after an AC-0029 refusal; the form after a save; the form after an AC-0047 save; the form after an AC-0050 refusal; the form after an AC-0055 failure; the recent sales list with no sale; the open void confirmation; the list after an AC-0080 refusal; the list after an AC-0084 refusal; the form after a void of the sale in the "Sale saved" panel; the empty trace page; the trace page after an AC-0092 refusal; the trace page after an AC-0119 refusal; a sale's trace; a void sale's trace; an AC-0093 page; a lot list; a lot list with more than 10 receipts; an AC-0116 page; an AC-0117 page; a lot's trace with sales and finished stock; a lot's trace with neither; a lot's trace with more than 1,000 sales; a void receipt's trace; an AC-0134 page; the non-operator page at `/sales` and at `/trace`; the `/sales` and `/trace` error pages.
- **Advisory waivers:** none. Each waiver names an npm advisory ID, the date, and the owner's acceptance. Adding one changes this contract section, so it is an amendment.

Access and navigation

- [ ] **AC-0001.** While signed out, a request for `/sales` or for `/trace` ends on `/sign-in`.
- [ ] **AC-0002.** Signed in as a non-operator, `/sales` and `/trace` each show "This account isn't allowed to use Meat Ops." and a Sign out button, and show no form, sale, or lot.
- [ ] **AC-0003.** A save or void action request replayed with no session, or with a non-operator's session, writes no sale and no void mark and changes no finished lot.
- [ ] **AC-0004.** A save action request replayed with no session returns "You're signed out. Sign in again to save this sale."
- [ ] **AC-0005.** A void action request replayed with no session returns "You're signed out. Sign in again to void this sale."
- [ ] **AC-0006.** A save or void action request replayed with a non-operator's session returns a message containing "This account isn't allowed to use Meat Ops."
- [ ] **AC-0007.** `/receiving`, `/production`, `/menu`, `/pricing`, `/sales`, and `/trace` each show a navigation region named "Primary" that holds a link named "Receiving" to `/receiving`, "Production" to `/production`, "Menu" to `/menu`, "Pricing" to `/pricing`, "Sales" to `/sales`, and "Trace" to `/trace`, with these six in this order relative to each other. A link another feature adds elsewhere in that region does not break this criterion.
- [ ] **AC-0008.** In the AC-0007 navigation, the only link with an `aria-current` attribute is the link to the page being shown, and its value is `page`.
- [ ] **AC-0009.** The responses to page requests for `/sales` and `/trace`, signed in or not, each carry `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.

Sale views

- [ ] **AC-0010.** After the 5,000-lb sale, the sale summary view gives that sale one row with lbs 5000.000, price per lb 3.2900, finished product code 502, and customer Fulton Market Deli.
- [ ] **AC-0011.** After the 5,000-lb sale is voided with the reason "wrong customer", its sale summary row carries that reason and a void time, and still gives lbs 5000.000 and price per lb 3.2900.
- [ ] **AC-0012.** The sale summary view has exactly one row per sale. The check fixture holds a sale with one line, the 5,000-lb sale with two lines, a sale with no customer, and a void sale.
- [ ] **AC-0013.** A non-operator reads 0 rows from the sale summary view and from the trace view, in a fixture where an operator reads at least one row from each.
- [ ] **AC-0014.** The `anon` role is refused a read of the sale summary view and of the trace view.
- [ ] **AC-0015.** The `service_role` role reads at least one row from the sale summary view and from the trace view after the 5,000-lb sale.
- [ ] **AC-0016.** Compared with the local database built from `main`'s migrations, every base table and view in `public` after this branch's migrations keeps every column it had, with the same name, type, and position.
- [ ] **AC-0017.** Compared with the local database built from `main`'s migrations, the only relation in `public` that this branch adds is the view `v_sale_summary`, the only relation that gains columns is the view `v_sale_traceability`, and `public` has the same functions.

Sale form

- [ ] **AC-0020.** Typing the code of a product in the page's product list shows its description, its list price or "No list price yet", and its finished lbs on hand. In the sale fixture with a 3.29 list price, typing 502 shows Smoked Turkey Drums Tom, list price $3.29/lb, and finished on hand 5,390 lbs.
- [ ] **AC-0021.** Typing the code of a product in the page's product list that has a list price sets the price per lb field to that list price written with 2 decimals: 3.29 for a stored 3.29, and 3.50 for a stored 3.5.
- [ ] **AC-0022.** Typing the code of a product in the page's product list that has no list price empties the price per lb field.
- [ ] **AC-0023.** After the owner types a price per lb, changing the product code to a different product in the page's product list sets the price per lb field from that product's list price, per AC-0021 and AC-0022.
- [ ] **AC-0024.** In the sale fixture with a 3.29 list price, typing 502, changing the price per lb to 3.10, and saving a sale of 100 lbs writes a sale whose lines all carry a price per lb of 3.10.
- [ ] **AC-0025.** The customer field starts at "No customer" and lists "No customer" first, then every customer in the customer list by name, in alphabetical order ignoring case.
- [ ] **AC-0026.** The sale date starts at today's date on the device.
- [ ] **AC-0027.** When there is no active finished product, `/sales` says "No active finished products yet. Add one in Supabase Studio, then reload this page."
- [ ] **AC-0028.** A save with "No customer" chosen writes a sale with no customer.
- [ ] **AC-0029.** Each input in this table is refused with its message shown beside its field, and no sale is written. Within one field, the first matching row wins.

  | Field | Input | Message |
  | --- | --- | --- |
  | Product code | blank | Enter a product code. |
  | Product code | not the code of an active finished product, including a raw product's code and an inactive finished product's code | No active finished product has code `<code>`. |
  | Lbs | blank, or anything other than digits with at most one decimal point | Enter the lbs sold, like 500 or 32.5. |
  | Lbs | more than 3 decimal places | Use at most 3 decimal places for weight. |
  | Lbs | a value equal to 0, such as 0, 0.0, or 000 | Lbs must be above 0. |
  | Price per lb | blank, or anything other than digits with at most one decimal point | Enter the price per lb, like 3.29. |
  | Price per lb | more than 2 decimal places | Use at most 2 decimal places for a price. |
  | Price per lb | 100000000 or more | Price must be below 100,000,000. |
  | Sale date | blank, or not a calendar date written YYYY-MM-DD, such as 2026-02-30 | Enter the sale date. |
  | Sale date | a date after today on the device | The sale date can't be after today. |

- [ ] **AC-0030.** A save action request replayed with a customer id that is not the id of a customer in the customer list writes no sale and returns "Choose a customer from the list." as the customer field's message.
- [ ] **AC-0031.** A save action request replayed with a sale date or a `today` value that is not a calendar date written YYYY-MM-DD writes no sale.
- [ ] **AC-0032.** In the sale fixture, a form with lbs 0.001, price per lb 0, and today's date saves one sale, and so does a form with lbs 1540 and price per lb 99999999.99.
- [ ] **AC-0033.** Typing the code of an active finished product that is not in the page's product list, on a page whose list holds at least one product, typing a price per lb, and saving writes one sale of it without a reload.
- [ ] **AC-0034.** While a save has not returned, pressing Save sale again writes no second sale.

Sale result

- [ ] **AC-0040.** After a save, the screen shows a "Sale saved" heading with the sale number, product code and description, customer name or "No customer", and sale date of the sale the engine wrote, and also its lbs and price per lb unless the save is an AC-0047 save.
- [ ] **AC-0041.** Entering the 5,000-lb sale on `/sales` with the price per lb as filled shows lbs 5,000 lbs, price per lb $3.29/lb, customer Fulton Market Deli, and sale date Oct 8, 2026, then the finished lots drawn: batch 1, made Oct 6, 2026, 4,620 lbs, and then batch 2, made Oct 7, 2026, 380 lbs.
- [ ] **AC-0042.** Each finished lot drawn shows its batch number, its production date, and the lbs the sale drew from it.
- [ ] **AC-0043.** The finished lots drawn are listed in draw order. The check fixture holds a batch dated 2026-10-07 entered first, then a batch dated 2026-10-06, then a second batch dated 2026-10-06; a sale that draws from all three lists the first 2026-10-06 batch, then the second, then the 2026-10-07 batch.
- [ ] **AC-0044.** In the AC-0041 case, the result shows 502's finished lbs on hand before 5,390 lbs and after 390 lbs.
- [ ] **AC-0045.** The result has a link named "Trace this sale" to `/trace?sale=<sale number>`.
- [ ] **AC-0046.** After a save, the customer and sale date keep their values, and the product code, lbs, and price per lb are empty.
- [ ] **AC-0047.** When a read that the save makes after the engine returns its sale fails, the result shows the "Sale saved" heading with the sale number and sale date the engine returned. Those reads are the sale's summary, its finished lots drawn, and the product's finished lbs on hand after.
- [ ] **AC-0048.** In the AC-0047 case, the result shows no finished lots drawn and no before-and-after stock, and in their place says "The sale was saved, but its details couldn't be loaded. Reload this page to see them."

Refused and failed saves

- [ ] **AC-0050.** In the sale fixture, a sale of 502 dated 2026-10-06 of 5,000 lbs is refused with "The sale wasn't saved. Only 4,620 lbs of finished stock made on or before Oct 6, 2026 is on hand, and this sale needs 5,000 lbs."
- [ ] **AC-0051.** When a product in the page's product list is made inactive after the page loaded, saving a sale of it shows "The sale wasn't saved. This product is no longer active."
- [ ] **AC-0052.** When the session has ended after the sales form loaded, saving shows "You're signed out. Sign in again to save this sale."
- [ ] **AC-0053.** When a call that a save makes before its write call fails, the form shows "The sale wasn't saved. Try again in a moment." Those calls are the caller check's auth lookup, unless the auth server ends the session (AC-0052), the operator check, and the reads before the write.
- [ ] **AC-0054.** When the save's write call gets no answer from the engine, the form shows "The sale may not have been saved. Reload this page and check Recent sales before saving again."
- [ ] **AC-0055.** When the connection to the app drops while a save is in flight, the form shows the AC-0054 message.
- [ ] **AC-0056.** When the engine refuses a save for a reason other than those of AC-0050, AC-0051, and AC-0057, the form shows "The sale wasn't saved." followed by the engine's reason, which is the refusal text after its `record_sale: ` prefix. Lbs typed as 400 nines, which pass the AC-0029 rules, show "The sale wasn't saved. invalid lbs, must be above 0".
- [ ] **AC-0057.** When the engine refuses a save because the caller is not an operator, the form shows "The sale wasn't saved. This account isn't allowed to use Meat Ops."
- [ ] **AC-0058.** Every save refusal writes no sale and changes no finished lot.
- [ ] **AC-0059.** After a save refusal or a save failure, every field keeps its value.

Recent sales and void

- [ ] **AC-0070.** `/sales` lists the 10 last-entered sales of every product, chosen by entry order and not by sale date, or all of them when there are 10 or fewer. The check fixture holds 12 sales, and the last one entered has an earlier sale date than every other sale.
- [ ] **AC-0071.** The listed sales run last entered first. The check fixture holds sales whose sale dates are not in the order they were entered.
- [ ] **AC-0072.** Each listed sale shows its sale number, sale date, customer name or "No customer", product code, lbs, and price per lb.
- [ ] **AC-0073.** Each listed sale number is a link to `/trace?sale=<sale number>`.
- [ ] **AC-0074.** When there are more than 10 sales, the list says "Showing the 10 most recent of N sales.", where N is the number of sales, void ones included.
- [ ] **AC-0075.** When there is no sale, the list says "No sales yet."
- [ ] **AC-0076.** After a save whose result shows its finished lots drawn, the saved sale is the first in the list.
- [ ] **AC-0077.** In the list, every sale that is not void has a Void button, and every void sale shows "Void: " and its reason. The check fixture holds a void sale and a sale that is not void.
- [ ] **AC-0078.** Void opens a confirmation that names the sale number, product code, lbs, and customer name or "No customer", and asks for a reason.
- [ ] **AC-0079.** The void confirmation's accessible description contains the sale number, lbs, and customer it names.
- [ ] **AC-0080.** Confirming with a blank or spaces-only reason shows "Enter a reason for the void." and changes nothing.
- [ ] **AC-0081.** Cancel closes the confirmation and changes nothing.
- [ ] **AC-0082.** In the AC-0041 case, voiding the sale with a reason shows it in the list as "Void: " and that reason, and typing 502 then shows finished lbs on hand of 5,390 lbs.
- [ ] **AC-0083.** After the sale shown in the "Sale saved" panel is voided from this page's list, the panel says "This sale was voided." and no longer shows its before-and-after stock.
- [ ] **AC-0084.** When the engine refuses a void, such as for a sale voided elsewhere after the list loaded, the list shows a message that starts "The sale wasn't voided." and the sale is unchanged.
- [ ] **AC-0085.** When the session has ended after the list loaded, confirming a void shows "You're signed out. Sign in again to void this sale." and the sale is unchanged.
- [ ] **AC-0086.** When the connection to the app drops while a void is in flight, the list stays on screen and shows "The sale may not have been voided. Reload this page to see whether it was."
- [ ] **AC-0087.** When a call that a void makes before its write call fails, the list stays on screen and shows "The sale wasn't voided. Try again in a moment." Those calls are the caller check's auth lookup, unless the auth server ends the session (AC-0085), and the operator check.
- [ ] **AC-0088.** When the void's write call gets no answer from the engine, the list stays on screen and shows the AC-0086 message.
- [ ] **AC-0089.** Every void refusal changes no sale and no finished lot.

Find a sale

- [ ] **AC-0090.** `/trace` shows a "Find a sale" section with a "Sale number" field and a "Show sale" button, and a "Find a raw lot" section with a "Raw product code" field, a "Received date" field, and a "Show lots" button.
- [ ] **AC-0091.** Show sale with the number of a sale, typed with or without spaces before and after it, shows that sale's trace.
- [ ] **AC-0092.** Show sale with a blank or spaces-only sale number shows "Enter a sale number." beside the field.
- [ ] **AC-0093.** A trace requested for a number that is not the number of a sale says "No sale has number <number>.", with the number shown as literal text: `<b>9</b>` shows as those eight characters and adds no element to the page.

A sale's trace

- [ ] **AC-0095.** A sale's trace shows the sale number as its heading, then the sale date, the customer name or "No customer", the product code and description, the lbs, and the price per lb.
- [ ] **AC-0096.** Under a "Where it came from" heading, each finished lot the sale drew from shows its batch number, its production date, and the lbs the sale drew from it.
- [ ] **AC-0097.** Under each finished lot, each raw lot its batch drew from shows its lot number, raw product code and description, vendor, received date, the lbs the batch drew from it, and its cost per lb.
- [ ] **AC-0098.** The trace of the 5,000-lb sale shows batch 1, made Oct 6, 2026, with 4,620 lbs sold, over lot A (RAW-TOM Turkey Drums TOM (raw), Reyes Meats, received Oct 1, 2026, 5,000 lbs drawn, $1.6800/lb) and then lot B (Valley Poultry, received Oct 5, 2026, 1,000 lbs drawn, $1.8000/lb); then batch 2, made Oct 7, 2026, with 380 lbs sold, over lot B (1,000 lbs drawn, $1.8000/lb).
- [ ] **AC-0099.** The finished lots on a sale's trace are listed in draw order, in the AC-0043 fixture.
- [ ] **AC-0100.** The raw lots under each finished lot are listed in draw order. The check fixture holds a lot received 2026-10-05 and entered first, and a lot received 2026-10-01 and entered second, and a sale from a batch that drew from both lists the 2026-10-01 lot first.
- [ ] **AC-0101.** Each raw lot's lot number on a sale's trace is a link to `/trace?lot=<lot number>`.
- [ ] **AC-0102.** A void sale's trace shows its AC-0095 heading and facts and "This sale was voided: <reason>.", and shows no finished lot and no raw lot.

Find a raw lot

- [ ] **AC-0110.** Show lots with a raw product's code and a blank received date lists the first 10 of that product's non-void receipts in this order, or all of them when it has 10 or fewer: received date newest first, then last entered first. The check fixture holds 12 receipts whose received dates are not in the order they were entered, two of them received on the same date.
- [ ] **AC-0111.** When the AC-0110 list leaves receipts out, it says "Showing the 10 most recent of N receipts.", where N is the product's number of non-void receipts.
- [ ] **AC-0112.** Show lots with a raw product's code and a received date lists every non-void receipt of that product received on that date, last entered first.
- [ ] **AC-0113.** Each listed receipt shows its lot number as a link to `/trace?lot=<lot number>`, its received date, its vendor, and its weight.
- [ ] **AC-0114.** A void receipt is not listed, with or without a received date.
- [ ] **AC-0115.** The receipts of an inactive raw product are listed as AC-0110 and AC-0112 describe.
- [ ] **AC-0116.** Show lots with a code that is not the code of a raw product, including a finished product's code, says "No raw product has code <code>.", with the code shown as literal text: `<b>9</b>` shows as those eight characters and adds no element to the page.
- [ ] **AC-0117.** Show lots for a raw product with no non-void receipt and a blank received date says "No receipts of <code> yet."
- [ ] **AC-0118.** Show lots with a received date on which the raw product has no non-void receipt says "No receipt of <code> was received on <date>.", with the date in the Rounding note's date format.
- [ ] **AC-0119.** Each input in this table is refused with its message shown beside its field, and no receipt is listed. Within one field, the first matching row wins.

  | Field | Input | Message |
  | --- | --- | --- |
  | Raw product code | blank | Enter a raw product code. |
  | Received date | not blank, and not a calendar date written YYYY-MM-DD, such as 2026-02-30 | Enter the received date, or leave it blank. |

A lot's trace

- [ ] **AC-0120.** A lot's trace shows the lot number as its heading, then the raw product code and description, the vendor, the received date, the weight received, the cost per lb, and the raw lbs still on hand from the lot.
- [ ] **AC-0121.** After the 5,000-lb sale, lot B's trace shows RAW-TOM Turkey Drums TOM (raw), Valley Poultry, received Oct 5, 2026, weight 3,000 lbs, $1.8000/lb, and raw on hand 1,000 lbs.
- [ ] **AC-0122.** Under a "Customers" heading, a lot's trace lists each customer with at least one of the lot's sales, once, by name in alphabetical order ignoring case, then "No customer" when any of the lot's sales has none. The check fixture holds two sales to one customer, one sale to a second customer, one sale with no customer, and a void sale to a third customer, who is not listed.
- [ ] **AC-0123.** Under a "Sales from this lot" heading, each of the lot's sales shows its sale number as a link to `/trace?sale=<sale number>`, its sale date, its customer name or "No customer", its product code, the batch number of its finished lot, and the lbs it drew from that finished lot.
- [ ] **AC-0124.** The lot's sales are listed by sale date newest first, then last entered first, and a sale's lines in draw order. The check fixture holds sales whose sale dates are not in the order they were entered, and the 5,000-lb sale.
- [ ] **AC-0125.** After the 5,000-lb sale, lot B's trace lists that sale twice, with batch 1 and 4,620 lbs and then with batch 2 and 380 lbs, and lot A's trace lists it once, with batch 1 and 4,620 lbs.
- [ ] **AC-0126.** A void sale's lines are not listed on a lot's trace.
- [ ] **AC-0127.** When the lot has no sales, its trace says "No sale was made from this lot." in place of the "Customers" and "Sales from this lot" sections.
- [ ] **AC-0128.** Under a "Finished stock on hand from this lot" heading, each finished lot in the lot's finished stock shows its batch number, product code and description, production date, and finished lbs on hand.
- [ ] **AC-0129.** The lot's finished stock is listed in draw order. In the sale fixture with no sale, lot B's trace lists batch 1 with 4,620 lbs and then batch 2 with 770 lbs, and lot A's trace lists batch 1 only.
- [ ] **AC-0130.** After the 5,000-lb sale, lot B's finished stock lists batch 2 with 390 lbs and no other finished lot.
- [ ] **AC-0131.** When the lot has no finished stock, its trace says "No finished stock from this lot is on hand." After the 5,000-lb sale, lot A's trace says so.
- [ ] **AC-0132.** A void receipt's trace shows its AC-0120 heading and facts and "This receipt was voided: <reason>."
- [ ] **AC-0135.** A lot's trace lists every one of the lot's sales under "Sales from this lot" and every customer with one of them under "Customers", also when the lot has more than 1,000 sales. The check fixture holds 1,001 sale lines from one lot, and the first one entered is the only sale to its customer.
- [ ] **AC-0134.** A trace requested for a lot number that is not the lot number of a receipt says "No receipt has lot number <number>.", with the number shown as literal text: `<b>9</b>` shows as those eight characters and adds no element to the page.

Error pages

- [ ] **AC-0140.** After a `/sales` or `/trace` load fails because the database is unreachable, pressing Try again once the database is reachable again shows that page without a browser reload.
- [ ] **AC-0141.** When the `/sales` or `/trace` error page appears, keyboard focus is on its heading.

Accessibility and phone width

- [ ] **AC-0150.** axe-core reports zero violations for the WCAG tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` in each page state.
- [ ] **AC-0151.** At a 320 × 640 CSS px viewport, in each page state, the page's scroll width is at most 320 CSS px.
- [ ] **AC-0152.** At a 320 × 640 CSS px viewport, in each page state, every focusable control is at least 44 CSS px tall and 44 CSS px wide.
- [ ] **AC-0153.** Each of these can be completed with the keyboard alone: saving a sale, voiding a sale, Show sale, Show lots, and following a lot or sale link on a trace.
- [ ] **AC-0154.** After a save, keyboard focus is on the "Sale saved" heading.
- [ ] **AC-0155.** After an AC-0029, AC-0092, or AC-0119 refusal, keyboard focus is on the first field with an error.
- [ ] **AC-0156.** After an AC-0029, AC-0092, or AC-0119 refusal, the `aria-describedby` of every field with an error points to that field's message.
- [ ] **AC-0157.** After a save refusal other than an AC-0029 refusal, or after a save failure, keyboard focus is on the message that states it.
- [ ] **AC-0158.** After a void, keyboard focus is on the "Recent sales" heading.
- [ ] **AC-0159.** After a void refusal or a void failure, keyboard focus is on the message that states it.
- [ ] **AC-0160.** After Cancel in the void confirmation, keyboard focus is on the Void button that opened it.
- [ ] **AC-0161.** The accessible name of the lbs field contains "lbs", and the accessible name of the price per lb field contains "per lb".
- [ ] **AC-0162.** In each page state, every focusable control, when focused from the keyboard, has a computed outline style other than `none` and an outline width of at least 2 CSS px.
- [ ] **AC-0163.** In each page state, every focusable control, when focused from the keyboard, has a contrast ratio of at least 3:1 between its computed outline color and the background color behind it.

Build and repository checks

- [ ] **AC-0170.** `npm run build` exits 0.
- [ ] **AC-0171.** `npm test` runs the Vitest suites and then the Playwright suite, and exits 0.
- [ ] **AC-0172.** Running `npm run gen:types` leaves `src/lib/database.types.ts` with no diff.
- [ ] **AC-0173.** `npm run typecheck` exits 0.
- [ ] **AC-0174.** `grep -rnE "\.(insert|update|upsert|delete)\(" src/` prints nothing.
- [ ] **AC-0175.** `grep -rnE "from ['\"][^'\"]*app/" src/lib/` prints nothing.
- [ ] **AC-0176.** `npm audit --omit=dev --audit-level=high` exits 0, or every high or critical advisory it reports appears in the Advisory waivers list above.
- [ ] **AC-0177.** `grep -rnE "['\"]pg(-pool)?(/[^'\"]*)?['\"]" src/` prints nothing.
- [ ] **AC-0178.** No code under `src/` reads a privileged variable, except `src/privileged-env.ts`, which reads no environment value at all. Each of these prints nothing:
  - `grep -rniE "env(\.|\[['\"])[a-z0-9_]*(service_role|secret|jwt|db_url|database_url|postgres)" src/ | grep -v '^src/privileged-env.ts:'`
  - `grep -rnE "\}\s*=\s*process\.env" src/`
  - `grep -nE "process\.env(\.|\[)" src/privileged-env.ts`
- [ ] **AC-0179.** `grep -rniE "anthropic|openai|@ai-sdk|langchain" package.json src/` prints nothing.

## Follow-ons

- jaketlee07: [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §13 item 6 (Ask your data), plain-language answers over sales, including a sale's margin from its cost snapshot.
- jaketlee07: [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §10 roadmap, recall-notice drafting from a lot's trace.

## Assumptions

- Technical: `record_sale` sells one finished product per call. It checks the caller, refuses lbs that are null, NaN, or not above 0, a price per lb that is null, NaN, or below 0, a null sale date, a product that is not finished, and an inactive product. It locks the product row, draws finished lots produced on or before the sale date in draw order, writes one sale line per lot drawn with that lot's cost as a snapshot, and returns only the `sales` row (source: `supabase/migrations/20261007181933_engine_hardening.sql`, `record_sale`)
- Technical: the engine names a sale `S-YYYYMMDD-xxxxxx` from the sale date when no number is given, and does not check the customer id itself; an unknown id fails the `sales` foreign key (source: `record_sale`; `supabase/migrations/0001_init.sql`, `sales`)
- Technical: a sale bigger than the finished stock on hand from lots made on or before the sale date is refused with `record_sale: shortfall, only <available> lbs finished available on or before <date>, need <needed>` (source: rolled-back probes 2026-10-09: `only 0 lbs finished available on or before 2026-01-01, need 999999`, and over the sale fixture `only 4620.000 lbs finished available on or before 2026-10-06, need 5000`)
- Technical: an inactive product is refused with text ending "is inactive", which `src/lib/failures.ts` already turns into "This product is no longer active." (source: `record_sale`; `src/lib/failures.ts` `refusalReason`)
- Technical: `void_sale` checks the caller, refuses a blank reason, an unknown sale, and a sale already void, locks the finished product, returns each line's lbs to its finished lot, and marks the sale void with the reason and a time (source: `supabase/migrations/20261007183252_corrections.sql`, `void_sale`)
- Technical: `v_sale_traceability` gives one row per sale line per raw lot behind it, keeps sales with no customer, and leaves out void sales; it carries no sale id, customer id, raw product code, or draw-order key (source: `corrections.sql`, the trace view)
- Technical: PostgREST aggregates are off, so a sale's total lbs needs a database view rather than a sum in the app (source: `pg_roles` read 2026-10-09: the `authenticator` settings hold no `pgrst.db_aggregates_enabled`)
- Technical: appending columns to `v_sale_traceability` with `CREATE OR REPLACE VIEW ... with (security_invoker = true)` keeps it running as the caller, and a grouped view gives a two-line sale's lbs exactly (source: rolled-back probe 2026-10-09: `reloptions` read `{security_invoker=true}` on both views, and a 1,100.25-lb sale over two finished lots summed to 1100.250)
- Technical: an operator can read `sales`, `sale_items`, `customers`, `lots`, `finished_goods`, `production_batches`, and `production_batch_lots`; the app writes no table directly (source: `supabase/migrations/20261007182816_access_lockdown.sql`; AC-0154 of the menu-pricing spec)
- Technical: `test/access.test.ts` reads every relation in `public` from the catalog and checks that `anon` is refused it, a non-operator reads 0 rows, and the operator reads at least one row, so a new view joins that sweep without a new list entry (source: `test/access.test.ts` `loadCatalog` and its AC-0001, AC-0002, and AC-0004 tests)
- Technical: the browser helpers list the Primary navigation links in Tab order (`FORM_CONTROLS` in `test/e2e/receiving-page.ts` and `test/e2e/production-page.ts`, `MENU_CONTROLS` in `test/e2e/menu-page.ts`, and the pricing helpers), so adding two links changes those lists (source: `test/e2e/*-page.ts`)
- Technical: the caller check, the session client with its 10-second request limit, the failure texts, the display formats, the not-allowed page, the error view, the Primary navigation, the framing headers for every path, the void dialog pattern, and the browser-suite helpers exist from the earlier features and are reused (source: `src/app/_server/`, `src/lib/failures.ts`, `src/lib/format.ts`, `src/app/page-header.tsx`, `next.config.ts`, `src/app/receiving/void-dialog.tsx`, `test/e2e/a11y.ts`)
- Technical: the seed holds one customer, Fulton Market Deli, one sale, and 502 with no list price, and the suites build their own fixtures with one vendor, Reyes Meats (source: read-only probe 2026-10-09; `supabase/seed.sql`; `test/db.ts`)
- Product: a sale's price per lb starts at the product's list price, and the owner can type a different price before saving; a product with no list price starts the field empty. This answers the menu-pricing spec's third Follow-on (source: user confirmation 2026-10-09)
- Product: the customer is picked from the customer list or "No customer"; a new customer is added in Supabase Studio, as vendors are (source: user confirmation 2026-10-09)
- Product: a sale entered by mistake is voided with a reason from the recent sales list, like a receipt (source: user confirmation 2026-10-09)
- Product: for a recall, the owner finds a raw lot by its raw product's code and an optional received date; the lot's page lists every customer and sale from it and the finished stock from it still on hand (source: user confirmation 2026-10-09)
- Product: one product per sale; the product is chosen by typing its code; lbs are above 0 with at most 3 decimals; the price per lb is 0 or above with at most 2 decimals, so a free sample is still traced; the sale date starts at today and can't be after today; the engine names the sale; `/sales` lists the 10 most recent sales of every product; "Sales" and "Trace" join the Primary navigation and `/` still opens Receiving; there is no dollar total, margin, or customer document per sale (source: user confirmation 2026-10-09)
- Product: a sale can be voided, so a save has no check step, and the `/sales` error page carries no "may have been saved" line; the "may not have been saved" message points to Recent sales instead (source: the receiving spec's accepted window for a voidable record, `docs/architecture/overview.md` "Failures")
- Product: after a save, the customer and sale date keep their values for the next product of the same order, and the product code, lbs, and price per lb are emptied (source: this spec, following the production form's reset; open to the owner at approval)
- Product: design goals in order are hard to mistype, fast on a phone, and numbers easy to trust; plain, high contrast, no decoration; the experience-design pack is not installed, so design intent for these surfaces is grounded only in these goals (source: production and menu-pricing spec Assumptions; skill roster, 2026-10-09)
- Process: SYSTEM-SPEC §13 builds Invoice-photo entry (item 8) at the same time as Sales; whichever merges second rebases onto the other, because both change the Primary navigation, the browser helpers' Tab-order lists, and the generated types (source: `SYSTEM-SPEC.md` §13 build order; user confirmation 2026-10-09)
- Process: this spec keeps its own Advisory waivers list, as the earlier specs do (source: production spec Assumptions)
- Process: shipped dependencies are audited with `npm audit --omit=dev --audit-level=high` before merge (source: receiving spec Assumptions)
- Process: the owner approves the spec and the plan in chat, and the agent records the Approved status; the build starts in a later session in this worktree (source: receiving spec Assumptions; the owner's request, 2026-10-09)
