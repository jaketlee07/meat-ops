# Spec: menu-pricing

- **Status:** Draft <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §2 (deterministic engine), §4 (products, `v_product_pricing`, `v_current_menu`), §7 "Advise" (pricing advisor), §10 (margin advisor with what-if), §11 (boundaries), §12 (verification), §13 item 4; [`docs/costing.md`](../../costing.md) (the cost build-up, invariant 2, the average rule, the Rounding note); the access model, the write path, the `supabase/migrations/` change guidance, and the app trust boundary in [`docs/architecture/overview.md`](../../architecture/overview.md)
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the views, the new database functions, the pages, and the server actions are consumed only by this app; no published interface)
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

The owner sets a target margin for each finished product, and the database
holds a suggested price that keeps that margin as raw costs move. Margin means
share of the selling price, and the suggested price rounds up to the cent so it
never falls below the target: a 20% target on a cost of $2.6318/lb suggests
$3.29/lb. A product with no target keeps the sheet price, which is cost plus
its per-lb margin fees. Each product also has a list price, the price the owner
actually charges. It changes only when the owner sets it.

On `/pricing` the owner sees every finished product's cost per lb, list price,
suggested price, margin at the list price, and target. Products whose list
price differs from the suggested price come first, below-target ones at the
top; products with no raw cost yet come last. Each product that needs a new
price shows a plain sentence built from the database's numbers and one button
that sets the list price to the suggested price. A product's detail shows its
full cost build-up and lets the owner set its target and type a list price. A
what-if section takes a raw product and a raw cost per lb and shows, for every
finished product made from it, the cost per lb, suggested price, and margin at
today's list price. Nothing in the what-if is saved.

On `/menu` the owner sees every active finished product with its list price,
its finished and raw pounds on hand, and whether it can be sold now. A
"Sellable only" switch hides the rest.

Every cost, price, and margin on these pages comes from the database. The app
formats numbers and chooses which words to show; it computes no cost, price,
margin, or what-if figure. Receiving's suggested price reads the same database
value, so it follows the target too.

The pages keep the floor screens' look and goals: hard to mistype first, fast on
a phone second, and numbers that are easy to trust third.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Costing truth | Applicable: the target-margin price rule, its round-up to the cent, the margin at list price, the price actions, the what-if rule, and the margin and fee display formats are costing rules that outlive this spec | `docs/costing.md` | jaketlee07 | A "Target margin and list price" section states the rules and the AC-0010, AC-0014, AC-0019, and AC-0020 numbers. The cost build-up formula names both price rules. The sentence on where the math lives names the pricing view and `price_what_if`. The Rounding note has a Margin row with the AC-0140 examples and a fee row with the AC-0081 example; its price row covers list prices; its cost-per-lb row covers cost after shrink and a product's cost per lb; its missing-value list has "No list price yet", "No target", and "None yet" for cost per lb, cost after shrink, and margin at list price; its opening sentence on what the pricing view returns and which values tests compare exactly covers the pricing tests' exact values. The file's opening names `test/pricing.test.ts`, `test/pricing-rules.test.ts`, and `test/e2e/pricing.spec.ts` | close-work finds each named number in the file and in a passing test, and finds no claim that the margin fees always count |
| Master brief (current product truth) | Applicable: the brief names `list_price_override`, a price that follows the suggestion unless overridden; this feature stores a list price that moves only on the owner's action, and keeps the sheet price for products with no target | `SYSTEM-SPEC.md` §4 (products fields, "Note on margin", `v_product_pricing`, `v_current_menu`) | jaketlee07 | §4 names `list_price_per_lb` and `target_margin_pct` with these meanings and no longer names `list_price_override` | close-work finds no `list_price_override` in `SYSTEM-SPEC.md` and finds both column names in §4 |
| Current architecture and app trust boundary | Applicable: two routes, three server actions, new `src/lib/` modules, and the new database functions change the areas map, the access model, and the write path | `docs/architecture/overview.md` | jaketlee07 | The `src/app/` row names `/menu` and `/pricing` and their actions; the `src/lib/` row names the pricing reads and form rules; the `test/` and `test/e2e/` rows name the new suites; the access model names `set_target_margin`, `set_list_price`, and `price_what_if`, who may run each, and that `price_what_if` runs as the caller under the tables' RLS; a write-path paragraph says the app changes master data only through `set_target_margin` and `set_list_price`; the views paragraph says a replaced view must set `security_invoker` again; the app trust boundary names the AC-0006 framing headers, and the areas row for `src/proxy.ts`, `src/privileged-env.ts`, and `next.config.ts` names them too | close-work confirms each named row and sentence exists and matches `src/`, `supabase/`, and `test/` |
| Agent guidance and commands | Applicable: `npm run test:costing` also runs the pricing golden cases | `AGENTS.md` (Build and test commands), `package.json` | jaketlee07 | AC-0161 passes and the `AGENTS.md` comment for `test:costing` names both suites | close-work finds the comment and the script agree |
| Interface compatibility | Applicable: the migration adds columns and functions, so the generated types change | `src/lib/database.types.ts` | jaketlee07 | AC-0152 passes | `npm run gen:types` leaves no diff on the closing commit |
| User documentation | Not applicable: no user-docs surface exists, the owner is the only user, and the screen labels carry the task | none | n/a | n/a | n/a |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions and the reasons in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

### Always do

- Compute every cost, suggested price, margin, price action, below-target flag, and what-if figure in Postgres, in a view or a database function.
- Show every price, cost, weight, percent, and fee through `src/lib/format.ts` and the formats in the `docs/costing.md` Rounding note and AC-0140. Form fields keep what the owner typed, and message text shows as written, the refusal text in AC-0118 included.
- Change a target margin or a list price only through `set_target_margin` and `set_list_price`, called with the signed-in user's session.
- Settle the caller inside every server action before it reads or writes anything else, through `src/app/_server/caller.ts`.
- In the migration, set `security_invoker` on every view it replaces, and follow the `supabase/migrations/` change guidance in `docs/architecture/overview.md` for every function it adds.
- Run `npm run typecheck`, `npm run build`, and `npm test` after each task; a red result stops the work until it is green.

### Ask first

- Any change to the six operations, to `v_sale_traceability`, or to a grant or policy other than the new functions' EXECUTE grants.
- Any change to a number already asserted in `test/costing.test.ts`. Adding the new pricing cases is not a change.
- Adding any npm package.
- Adding a route beyond `/`, `/sign-in`, `/receiving`, `/production`, `/menu`, and `/pricing`.
- Changing what the receiving or production page shows or does, beyond the AC-0004 navigation links, the AC-0006 framing headers, and the AC-0073 suggested price.
- Any write to the hosted Supabase project, or pointing the app at it.

### Never do

- Compute a cost, price, shrink, average, margin, or what-if figure in TypeScript. That includes rounding a price to the cent, deciding whether a list price differs from the suggested price, which way it differs, whether a product is below target, or whether its raw input has a cost.
- Change a list price or a target margin without the owner's press of a button: no automatic repricing, no change on page load, and no "apply all".
- Call an AI model or add an AI client library.
- Add a table, or a `products` column other than `target_margin_pct` and `list_price_per_lb`.
- Import a Postgres driver under `src/`, or import anything from `src/app/` into `src/lib/`.
- Edit an existing migration file.
- Commit a new top-level directory, or add a PWA manifest, a service worker, or offline queueing.
- Read a privileged variable anywhere under `src/`, except in `src/privileged-env.ts`. "Privileged variable" is defined in the receiving spec's Acceptance Criteria definitions ([`../receiving/spec.md`](../receiving/spec.md)).

## Testing Strategy

The Vitest suites and the Playwright browser suite run under `npm test` against the local Supabase stack. Goal-based checks run as the commands their criteria name. Each criterion is listed once, under the check that closes it.

- **TDD against the local stack: the pricing rules and the new functions (AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0028)**: each is an exact number, an exact refusal, or a catalog fact over fixtures built through the operations and the new functions, so a wrong rule fails it. They are golden costing cases, run by `npm run test:costing` as well as `npm test`: a red one stops the work.
- **TDD, no database: the margin format and the failed caller check (AC-0140, AC-0144)**: each is a pure rule with exact examples; AC-0144 drives the change actions' decisions with a caller check that reports a failure, and `src/app/_server/caller.ts`'s mapping of those answers to a failure is the receiving spec's. The form rules, the advice sentences, the button names, and the change actions' decisions are unit-tested the same way, as construction for the browser and recorded criteria below.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0040, AC-0041, AC-0042, AC-0043, AC-0044, AC-0045, AC-0046, AC-0047, AC-0048, AC-0049, AC-0050, AC-0051, AC-0060, AC-0061, AC-0062, AC-0063, AC-0077, AC-0078, AC-0064, AC-0065, AC-0066, AC-0067, AC-0068, AC-0069, AC-0070, AC-0071, AC-0072, AC-0073, AC-0074, AC-0075, AC-0076, AC-0080, AC-0081, AC-0082, AC-0083, AC-0084, AC-0085, AC-0090, AC-0091, AC-0092, AC-0093, AC-0094, AC-0100, AC-0101, AC-0102, AC-0109, AC-0110, AC-0111, AC-0112, AC-0115, AC-0116, AC-0118, AC-0120, AC-0121, AC-0122, AC-0123, AC-0124, AC-0125, AC-0129, AC-0143, AC-0133, AC-0134, AC-0135, AC-0136, AC-0137, AC-0138)**: each criterion is a state, a trigger, and an on-screen or returned outcome that only a real browser over the real server and database shows. The suite drives Chromium through Playwright, replays action requests through Playwright's request API, and reads and seeds raw tables through `pg`.
- **E2E accessibility and phone-width checks (AC-0130, AC-0131, AC-0132, AC-0139, AC-0141)**: axe-core, measured element boxes, and computed styles in the same browser suite give a pass or fail bar for each page state. The recorded run applies the same checks to the two error pages.
- **Manual QA recorded in the verification ledger (AC-0113, AC-0114, AC-0117, AC-0119, AC-0126, AC-0127, AC-0128, AC-0142)**: a recorded run against `npm run start`.
  - With the local REST service stopped before a page load, it records each error page, its text, its focus, its page-state checks, and the recovery after Try again.
  - With the REST service stopped after a detail loads, it records the AC-0113 message after Save target, every field's value, and the focused element. With the app restarted after a detail loads and the local auth service then stopped, it records the same for the auth-lookup case.
  - With the app pointed at a throwaway forwarder between the app and the REST service, it records two cases. When the forwarder holds a list price save's write call past the 10-second limit, it records the AC-0114 message, every field's value, and the focused element. When the forwarder holds a target save's write call while a `pg` session removes the operator's allowlist row, then lets it through, it records the AC-0117 message, every field's value, the focused element, and that no `products` row changed; the row is restored afterwards.
- **Goal-based checks (AC-0150, AC-0151, AC-0152, AC-0153, AC-0154, AC-0155, AC-0156, AC-0157, AC-0158, AC-0159, AC-0160, AC-0161)**: each is settled by one command or one set of commands: a build, a test run, a type regeneration diff, a typecheck, a `grep`, a catalog read compared before and after, or a dependency audit.

## Acceptance Criteria

Definitions used by these criteria:

- **Operator, non-operator, signed-out visitor, active finished product, raw input, host scope:** as defined in the production spec's Acceptance Criteria definitions ([`../production/spec.md`](../production/spec.md)).
- **Ended session, focusable controls of a page state, non-void receipt:** as defined in the receiving spec ([`../receiving/spec.md`](../receiving/spec.md)). A raw input **has a cost** when it has at least one non-void receipt.
- **Pricing view, menu view:** `v_product_pricing` and `v_current_menu`.
- **Cost per lb:** the pricing view's `cost_per_lb`, the cost build-up in `docs/costing.md`.
- **Target margin:** a finished product's `target_margin_pct`, a fraction from 0 up to but not including 1, shown as a percent. `set_target_margin` takes it as the percent the owner types, such as 22.5 for 0.225.
- **Suggested price:** the pricing view's `final_price_per_lb`. With a target margin it is cost per lb ÷ (1 − target margin), rounded up to the next whole cent; with none it is the sheet price in `docs/costing.md`, rounded to 4 decimals half away from zero.
- **Suggested list price:** when the raw input has a cost, the suggested price rounded to 2 decimals half away from zero; otherwise none. Wherever the pricing pages show a suggested price, they show this value.
- **List price:** a finished product's `list_price_per_lb`, in dollars and cents.
- **Margin at list price:** when the raw input has a cost and the product has a list price, (list price − cost per lb) ÷ list price, rounded to 4 decimals half away from zero; otherwise none.
- **Margin fees per lb:** the pricing view's `margin_per_lb`, the sum of the product's margin-kind fees per lb.
- **Needs a new price:** the raw input has a cost, and the product has no list price or its list price differs from its suggested list price.
- **Price action:** for a product that needs a new price, Set when it has no list price, Raise when its list price is below the suggested list price, and Lower when it is above. A product that does not need a new price has none.
- **Below target:** the raw input has a cost, and the product has a target margin and a list price, and its margin at list price is less than its target margin.
- **What-if:** for a raw product and a raw cost per lb, each active finished product whose raw input is that raw product, with its cost per lb, suggested price, and margin at list price worked out by the rules above with that raw cost in place of the raw average cost. The given raw cost counts as a cost, so a what-if gives a suggested list price and a margin at list price even for a raw product with no non-void receipt.
- **Code order:** ascending by product code as the database sorts text: "1000" before "502", and "502" before "A1".
- **Fee-type order:** ascending `fee_types.sort_order`.
- **Finished lbs on hand, raw lbs on hand, sellable:** the menu view's `finished_lbs_available`, `raw_lbs_available`, and `sellable`.
- **Change actions:** the server actions that save a target margin, remove a target margin, and save a list price, whether the price was typed or comes from an AC-0066 button.
- **Change refusals:** the outcomes of AC-0109, AC-0110, AC-0116, AC-0117, and AC-0118.
- **The 502 fixture:** RAW-TOM Turkey Drums TOM (raw) and 502 Smoked Turkey Drums Tom as in the `docs/costing.md` reference product and `test/db.ts`: shrink 0.23; processing fees Direct cost of material 0.05, Cost of freezing 0.03, and Belmont overhead 0.37 per lb; margin fee Profit 0.05 per lb. RAW-TOM has one receipt of 5,000 lbs at 1.68, received 2026-10-01. "With a 20% target" sets 502's target margin to 0.2, and "a 2.68 list price" sets its list price to 2.68; with neither named, 502 has no target margin and no list price.
- **Page states:** the menu with products; the menu with "Sellable only" on; the menu with "Sellable only" on and nothing sellable; the menu with no active finished product; the pricing list with all three groups; the pricing list after a list price save; the pricing list after a change refusal; the pricing list with no active finished product; the what-if results; the what-if form after an AC-0123 refusal; the what-if for an AC-0125 code; a product's pricing detail with a target margin; a detail with no target margin; a detail after an AC-0091 refusal; a detail after an AC-0101 refusal; a detail after a target save; a detail after a target removal; a detail after a list price save; a detail after an AC-0116 refusal; a detail after an AC-0115 failure; the not-active-product detail; the non-operator page at `/menu` and at `/pricing`; the `/menu` and `/pricing` error pages.
- **Advisory waivers:** none. Each waiver names an npm advisory ID, the date, and the owner's acceptance. Adding one changes this contract section, so it is an amendment.

Access and navigation

- [ ] **AC-0001.** While signed out, a request for `/menu` or for `/pricing` ends on `/sign-in`.
- [ ] **AC-0002.** Signed in as a non-operator, `/menu` and `/pricing` each show "This account isn't allowed to use Meat Ops." and a Sign out button, and show no product.
- [ ] **AC-0003.** A change action request replayed with no session, or with a non-operator's session, changes no `products` row.
- [ ] **AC-0004.** `/receiving`, `/production`, `/menu`, and `/pricing` each show a navigation region named "Primary" with a link named "Receiving" to `/receiving`, "Production" to `/production`, "Menu" to `/menu`, and "Pricing" to `/pricing`.
- [ ] **AC-0005.** In the AC-0004 navigation, the only link with an `aria-current` attribute is the link to the page being shown, and its value is `page`.
- [ ] **AC-0006.** The responses to page requests for `/sign-in`, `/receiving`, `/production`, `/menu`, and `/pricing`, signed in or not, each carry `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.

Pricing rules

- [ ] **AC-0010.** In the 502 fixture with a 20% target, the pricing view gives 502 a cost per lb of 2.6318, a suggested price of 3.29, and a suggested list price of 3.29.
- [ ] **AC-0011.** In the 502 fixture with a target margin of 0, 502's suggested price is 2.64.
- [ ] **AC-0012.** In the 502 fixture with a 20% target, 502's suggested price is 3.29 with a profit fee of 0.05 per lb and also with a profit fee of 0.50 per lb.
- [ ] **AC-0013.** In the 502 fixture with a target margin of 0.225, 502's suggested price is 3.40.
- [ ] **AC-0019.** In the 502 fixture with a 20% target, with RAW-TOM's only receipt at 1.6632 per lb in place of 1.68, 502's cost per lb is 2.6100, its suggested price is 3.27, and its margin at a 3.27 list price is 0.2018.
- [ ] **AC-0014.** In the 502 fixture, 502's margin at list price is 0.0180 with a 2.68 list price, 0.2001 with a 3.29 list price, 0.2481 with a 3.50 list price, and −0.0527 with a 2.50 list price.
- [ ] **AC-0015.** In the 502 fixture with a 20% target, 502's price action is Set with no list price, Raise with a 2.68 list price, Lower with a 3.50 list price, and none with a 3.29 list price.
- [ ] **AC-0016.** In the 502 fixture, 502 is below target with a 20% target and a 2.68 list price, and is not below target with a 20% target and a 3.50 list price, nor with no target and a 2.68 list price.
- [ ] **AC-0017.** In the 502 fixture with a 20% target and a 2.68 list price, after its only receipt is voided, the pricing view gives 502 no suggested list price, no margin at list price, and no price action, and 502 is not below target.
- [ ] **AC-0018.** A non-operator reads 0 rows from the pricing view and 0 rows from the menu view, in a fixture where an operator reads at least one row from each.
- [ ] **AC-0027.** The `service_role` role reads at least one row from the pricing view and from the menu view in the 502 fixture.

What-if rules

- [ ] **AC-0020.** In the 502 fixture with a 20% target and a 3.29 list price, a what-if for RAW-TOM at 2.00 gives 502 a cost per lb of 3.0474, a suggested price of 3.81, and a margin at list price of 0.0737.
- [ ] **AC-0021.** In the 502 fixture with no target, a what-if for RAW-TOM at 2.00 gives 502 a suggested price of 3.0974.
- [ ] **AC-0022.** In a fixture holding two RAW-TOM receipts (5,000 lbs at 1.68 and 3,000 lbs at 1.80) and two active finished products made from RAW-TOM, one with a 20% target and a 3.29 list price and one with no target and no list price, a what-if for RAW-TOM at its raw average cost gives each product the cost per lb, suggested price, and margin at list price the pricing view gives it.
- [ ] **AC-0023.** A what-if returns exactly the active finished products whose raw input is the given raw product. The check fixture holds a second active finished product made from RAW-TOM, an inactive finished product made from RAW-TOM, and an active finished product made from another raw product.
- [ ] **AC-0026.** A what-if returns its products in code order. The check fixture enters products made from RAW-TOM out of code order.
- [ ] **AC-0028.** In the 502 fixture with a 20% target and a 3.29 list price, after RAW-TOM's only receipt is voided, a what-if for RAW-TOM at 2.00 gives 502 a cost per lb of 3.0474, a suggested price of 3.81, a suggested list price of 3.81, and a margin at list price of 0.0737.
- [ ] **AC-0024.** A what-if called by an operator changes no table.
- [ ] **AC-0025.** A what-if is refused with SQLSTATE `42501` for a non-operator, and refused for a raw cost that is below 0, null, NaN, or infinite, and each refusal changes no table.

Target margin and list price operations

- [ ] **AC-0030.** An operator's `set_target_margin` call for 502 with 22.5 stores a target margin of 0.2250, with 0 stores 0, and with no value removes the target margin.
- [ ] **AC-0031.** `set_target_margin` is refused, and changes no table, for each of: a target below 0, a target of 100 or more, a target with more than 2 decimal places, a NaN or infinite target, a raw product, an inactive finished product, an id that names no product, and a non-operator caller, the last with SQLSTATE `42501`.
- [ ] **AC-0032.** An operator's `set_list_price` call for 502 with 3.29 stores a list price of 3.29.
- [ ] **AC-0033.** `set_list_price` is refused, and changes no table, for each of: a price of 0 or below, a price with more than 2 decimal places, a price of 100,000,000 or more, a null, NaN, or infinite price, a raw product, an inactive finished product, an id that names no product, and a non-operator caller, the last with SQLSTATE `42501`.
- [ ] **AC-0034.** A successful `set_target_margin` or `set_list_price` call changes only the named product's target margin or list price, respectively: every other column of that row, every other row, and every other table are unchanged.
- [ ] **AC-0035.** The `anon` and `service_role` roles cannot execute `set_target_margin`, `set_list_price`, or `price_what_if`.
- [ ] **AC-0036.** An update that gives a raw product a target margin or a list price is refused, run as `postgres`.
- [ ] **AC-0037.** An update that sets a finished product's target margin below 0, to 1 or more, or to NaN, or its list price to 0 or below or to NaN, is refused, run as `postgres`.
- [ ] **AC-0038.** Every function the migration adds sets `search_path` to an empty value.

Menu

- [ ] **AC-0040.** `/menu` lists each active finished product once, with its code, description, list price, finished lbs on hand, raw lbs on hand, and "Sellable now" when it is sellable or "Not sellable now" when it is not.
- [ ] **AC-0051.** `/menu` lists its products in code order. The check fixture enters products out of code order.
- [ ] **AC-0041.** In the 502 fixture with a 3.29 list price, after a batch of 502 with 2,000 raw lbs, `/menu` shows 502 with list price $3.29/lb, finished on hand 1,540 lbs, raw on hand 3,000 lbs, and "Sellable now".
- [ ] **AC-0042.** A product with no list price shows "No list price yet" in place of its list price.
- [ ] **AC-0043.** A product shows "Sellable now" when its finished lbs on hand or its raw lbs on hand is above 0, and "Not sellable now" when both are 0. The check fixture holds one product with only finished stock, one with only raw stock, and one with neither.
- [ ] **AC-0044.** In the 502 fixture, after RAW-TOM's lot is adjusted to 0 lbs, a reload of `/menu` shows 502 as "Not sellable now".
- [ ] **AC-0045.** An inactive finished product does not appear on `/menu`.
- [ ] **AC-0046.** On each load of `/menu`, the "Sellable only" switch is off and every active finished product is listed.
- [ ] **AC-0047.** With "Sellable only" on, `/menu` lists exactly the sellable products. The check fixture holds one sellable and one unsellable product.
- [ ] **AC-0048.** Turning "Sellable only" off again lists every active finished product.
- [ ] **AC-0049.** With "Sellable only" on and no product sellable, `/menu` says "No product can be sold right now."
- [ ] **AC-0050.** When there is no active finished product, `/menu` says "No active finished products yet. Add one in Supabase Studio, then reload this page."

Pricing list

- [ ] **AC-0060.** `/pricing` lists each active finished product once, with its code, description, cost per lb, list price, suggested price, margin at list price, and target margin.
- [ ] **AC-0061.** In the 502 fixture with a 20% target and a 2.68 list price, `/pricing` shows 502 with cost per lb $2.6318/lb, list price $2.68/lb, suggested price $3.29/lb, margin at list price 1.8%, and target margin 20%.
- [ ] **AC-0062.** A product with no list price shows "No list price yet" as its list price.
- [ ] **AC-0074.** A product with no target margin shows "No target" as its target margin.
- [ ] **AC-0075.** A product whose raw input has no cost shows "None yet" as its cost per lb and "No price yet" as its suggested price.
- [ ] **AC-0076.** A product with no list price, or whose raw input has no cost, shows "None yet" as its margin at list price.
- [ ] **AC-0063.** The products that need a new price are listed under a heading "Needs a new price", the products whose raw input has no cost under a heading "No cost yet", and every other product under a heading "Priced".
- [ ] **AC-0077.** The group headings appear in this order: "Needs a new price", "Priced", "No cost yet".
- [ ] **AC-0078.** A group heading appears only when the group has a product. In the AC-0069 state, neither "Needs a new price" nor "No cost yet" appears.
- [ ] **AC-0064.** Under "Needs a new price", the below-target products come first, then the rest, each group in code order; under "Priced" and under "No cost yet", products are in code order. The check fixture holds four products that need a new price, two of them below target and, of the other two, one with a Lower action and one with a Set action, and two products in each other group, all entered out of that order.
- [ ] **AC-0065.** Each product that needs a new price shows the advice for its case, where C is its cost per lb, S its suggested list price, T its target margin, L its list price, M its margin at list price, and F its margin fees per lb, each in its display format:

  | Target margin | List price | Advice |
  | --- | --- | --- |
  | set | set | Cost is C. S holds your T target margin. At your list price of L, the margin is M. |
  | set | none | Cost is C. S holds your T target margin. This product has no list price yet. |
  | none | set | Cost is C. With no target margin, the suggested price is cost plus F in margin fees. At your list price of L, the margin is M. |
  | none | none | Cost is C. With no target margin, the suggested price is cost plus F in margin fees. This product has no list price yet. |

  In the AC-0061 case the advice reads "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. At your list price of $2.68/lb, the margin is 1.8%." In the 502 fixture the advice reads "Cost is $2.6318/lb. With no target margin, the suggested price is cost plus $0.0500/lb in margin fees. This product has no list price yet."
- [ ] **AC-0066.** Each product that needs a new price shows one button, named "Set list price to S" for Set, "Raise list price to S" for Raise, and "Lower list price to S" for Lower, with S as in AC-0065. A product that does not need a new price shows no such button.
- [ ] **AC-0067.** Pressing an AC-0066 button stores the price the button names as the product's list price, also when the product's cost per lb has changed since the page loaded.
- [ ] **AC-0068.** After an AC-0066 button's save, the page says "List price for <code> saved: <price>.", with the list price the database stored in the suggested price format.
- [ ] **AC-0069.** In the AC-0061 case, pressing "Raise list price to $3.29/lb" shows 502 under "Priced" with list price $3.29/lb and margin at list price 20.01%.
- [ ] **AC-0070.** Each listed product's code and description form a link to that product's pricing detail.
- [ ] **AC-0071.** When there is no active finished product, `/pricing` says "No active finished products yet. Add one in Supabase Studio, then reload this page." and shows no what-if section.
- [ ] **AC-0072.** In the 502 fixture with a 20% target and a 2.68 list price, after a second RAW-TOM receipt of 3,000 lbs at 1.80 and a load of `/pricing` and of `/menu`, 502's stored list price is 2.68.
- [ ] **AC-0073.** In the 502 fixture with a 20% target, choosing RAW-TOM on `/receiving` shows 502's suggested price as $3.29/lb.

Pricing detail

- [ ] **AC-0080.** A product's pricing detail shows its code and description as its heading, then its cost build-up in this order: raw input code and description, raw average cost, shrink, cost after shrink, each processing fee by name in fee-type order, cost per lb; then, with a target margin, target margin and suggested price, or, with none, each margin fee by name in fee-type order, suggested price, and "No target margin. The suggested price is cost per lb plus the margin fees."; then list price and margin at list price.
- [ ] **AC-0081.** In the AC-0061 case, 502's detail shows RAW-TOM Turkey Drums TOM (raw), raw average cost $1.6800/lb, shrink 23%, cost after shrink $2.1818/lb, Direct cost of material $0.0500/lb, Cost of freezing $0.0300/lb, Belmont overhead $0.3700/lb, cost per lb $2.6318/lb, target margin 20%, suggested price $3.29/lb, list price $2.68/lb, and margin at list price 1.8%.
- [ ] **AC-0082.** In the 502 fixture, 502's detail shows Profit $0.0500/lb and suggested price $2.68/lb.
- [ ] **AC-0083.** When a product's raw input has no cost, its detail shows raw average cost, cost after shrink, and cost per lb as "None yet", and suggested price as "No price yet".
- [ ] **AC-0084.** A detail of a product that needs a new price shows that product's AC-0065 advice and AC-0066 button.
- [ ] **AC-0085.** A detail requested for a code that is not the code of an active finished product, including an unknown code, a raw product's code, and an inactive finished product's code, says "No active finished product has code <code>.", with the code shown as literal text: `<b>9</b>` shows as those eight characters and adds no element to the page.

Target margin

- [ ] **AC-0090.** A detail's "Target margin %" field starts with the stored target margin written as a percent with trailing zeros dropped, such as 20 for 0.2000 and 22.5 for 0.2250, or empty when there is none.
- [ ] **AC-0091.** Each target margin input in this table is refused with its message beside the field, and nothing is saved. The first matching row wins.

  | Input | Message |
  | --- | --- |
  | blank, or anything other than digits with at most one decimal point | Enter a target margin, like 20 or 22.5. |
  | more than 2 decimal places | Use at most 2 decimal places for a target margin. |
  | 100 or more | A target margin must be below 100. |

- [ ] **AC-0092.** In the 502 fixture, saving a target margin of 22.5 for 502 shows "Target margin for 502 saved: 22.5%.", and the detail shows target margin 22.5% and suggested price $3.40/lb.
- [ ] **AC-0093.** A detail shows a "Remove target margin" button when the product has a target margin, and no such button when it has none.
- [ ] **AC-0094.** In the 502 fixture with a 20% target, pressing "Remove target margin" shows "Target margin for 502 removed.", and the detail shows Profit $0.0500/lb and suggested price $2.68/lb.

List price

- [ ] **AC-0100.** A detail's "List price per lb" field starts with the stored list price written with 2 decimals, such as 3.29 for 3.29 and 3.50 for 3.5, or empty when there is none.
- [ ] **AC-0101.** Each list price input in this table is refused with its message beside the field, and nothing is saved. The first matching row wins.

  | Input | Message |
  | --- | --- |
  | blank, or anything other than digits with at most one decimal point | Enter the price per lb, like 3.29. |
  | more than 2 decimal places | Use at most 2 decimal places for a price. |
  | a value equal to 0 | Price must be above 0. |
  | 100000000 or more | Price must be below 100,000,000. |

- [ ] **AC-0102.** In the 502 fixture, saving a list price of 3.50 for 502 shows "List price for 502 saved: $3.50/lb.", and the detail shows list price $3.50/lb and margin at list price 24.81%.

Refused and failed changes

- [ ] **AC-0109.** A change action request replayed with a non-operator's session returns "The change wasn't saved. This account isn't allowed to use Meat Ops."
- [ ] **AC-0110.** When the session has ended after the page loaded, a change action shows "You're signed out. Sign in again to save this change."
- [ ] **AC-0113.** When a change action's caller check fails before its write call because its auth lookup or its operator check gets no answer, the action shows "The change wasn't saved. Try again in a moment."
- [ ] **AC-0144.** When a change action's caller check fails before its write call because its auth lookup is answered with status 5xx or 429, or its operator check is answered with an error code other than `42501`, which `src/app/_server/caller.ts` reports as a failed check, the action returns "The change wasn't saved. Try again in a moment."
- [ ] **AC-0114.** When a change action's write call gets no answer from the database, it shows "The change may not have been saved. Reload this page to check it."
- [ ] **AC-0115.** When the connection to the app drops while a change is in flight, the page shows the AC-0114 message.
- [ ] **AC-0116.** When the product was made inactive after the page loaded, a change action shows "The change wasn't saved. This product is no longer active."
- [ ] **AC-0117.** When a change action's write call is refused because the caller is not an operator, it shows "The change wasn't saved. This account isn't allowed to use Meat Ops."
- [ ] **AC-0118.** When a change action's write call is refused for a reason other than those of AC-0116 and AC-0117, the action returns "The change wasn't saved." followed by the refusal text after its `set_target_margin: ` or `set_list_price: ` prefix. A replayed list price save whose product id is `00000000-0000-0000-0000-000000000000` returns "The change wasn't saved. product 00000000-0000-0000-0000-000000000000 not found".
- [ ] **AC-0111.** After an AC-0091, AC-0101, AC-0110, AC-0115, or AC-0116 outcome, every field keeps its value.
- [ ] **AC-0119.** After an AC-0113, AC-0114, or AC-0117 outcome, every field keeps its value.
- [ ] **AC-0112.** An AC-0091, AC-0101, AC-0110, AC-0116, or AC-0118 outcome changes no `products` row.
- [ ] **AC-0128.** An AC-0117 outcome changes no `products` row.

What-if

- [ ] **AC-0120.** The pricing list has a section headed "What if raw cost changes?" with a "Raw product" picker, a "Raw cost per lb" field, and a "Show prices" button. The picker lists each active raw product that is the raw input of at least one active finished product, as its code and description.
- [ ] **AC-0129.** The "Raw product" picker lists its raw products in code order. The check fixture enters raw products out of code order.
- [ ] **AC-0121.** In the 502 fixture with a 20% target and a 3.29 list price, showing prices for RAW-TOM at 2.00 lists 502 with cost per lb $3.0474/lb, suggested price $3.81/lb, and margin at today's list price 7.37%.
- [ ] **AC-0122.** In a what-if, a product with no list price shows "None yet" for margin at today's list price.
- [ ] **AC-0123.** Each what-if input in this table is refused with its message beside its field, and no results show. Within one field, the first matching row wins.

  | Field | Input | Message |
  | --- | --- | --- |
  | Raw product | none chosen | Choose a raw product. |
  | Raw cost per lb | blank, or anything other than digits with at most one decimal point | Enter the cost per lb, like 1.68. |
  | Raw cost per lb | more than 4 decimal places | Use at most 4 decimal places for cost. |

- [ ] **AC-0143.** In the AC-0028 case, showing prices for RAW-TOM at 2.00 lists 502 with cost per lb $3.0474/lb, suggested price $3.81/lb, and margin at today's list price 7.37%.
- [ ] **AC-0124.** After Show prices, the raw product and the raw cost per lb keep their values.
- [ ] **AC-0125.** A what-if requested for a code that is not the code of an active raw input of an active finished product, including an unknown code and a finished product's code, says "No active finished product is made from <code>.", with the code shown as literal text: `<b>9</b>` shows as those eight characters and adds no element to the page.

Error pages

- [ ] **AC-0126.** After a `/menu` or `/pricing` load fails because the database is unreachable, pressing Try again once the database is reachable again shows that page without a browser reload.
- [ ] **AC-0127.** When the `/menu` or `/pricing` error page appears, keyboard focus is on its heading.

Accessibility and phone width

- [ ] **AC-0130.** axe-core reports zero violations for the WCAG tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` in each page state.
- [ ] **AC-0131.** At a 320 × 640 CSS px viewport, in each page state, the page's scroll width is at most 320 CSS px.
- [ ] **AC-0132.** At a 320 × 640 CSS px viewport, in each page state, every focusable control is at least 44 CSS px tall and 44 CSS px wide.
- [ ] **AC-0133.** Each of these can be completed with the keyboard alone: an AC-0066 button, Save target, Remove target margin, Save price, Show prices, and the "Sellable only" switch.
- [ ] **AC-0134.** After a change action's save, keyboard focus is on the message that states it.
- [ ] **AC-0135.** After an AC-0091, AC-0101, or AC-0123 refusal, keyboard focus is on the first field with an error.
- [ ] **AC-0136.** After an AC-0091, AC-0101, or AC-0123 refusal, the `aria-describedby` of every field with an error points to that field's message.
- [ ] **AC-0137.** After an AC-0110, AC-0115, or AC-0116 outcome, keyboard focus is on the message that states it.
- [ ] **AC-0142.** After an AC-0113, AC-0114, or AC-0117 outcome, keyboard focus is on the message that states it.
- [ ] **AC-0138.** The accessible name of the target margin field contains "%", and the accessible names of the list price field and the raw cost field each contain "per lb".
- [ ] **AC-0139.** In each page state, every focusable control, when focused from the keyboard, has a computed outline style other than `none` and an outline width of at least 2 CSS px.
- [ ] **AC-0141.** In each page state, every focusable control, when focused from the keyboard, has a contrast ratio of at least 3:1 between its computed outline color and the background color behind it.

Display

- [ ] **AC-0140.** A margin shows as the stored fraction written as a percent, with 0 to 2 decimals, trailing zeros dropped, then "%": 0.2 → 20%, 0.018 → 1.8%, 0.2001 → 20.01%, 0.2481 → 24.81%, −0.0527 → -5.27%, 0 → 0%.

Build and repository checks

- [ ] **AC-0150.** `npm run build` exits 0.
- [ ] **AC-0151.** `npm test` runs the Vitest suites and then the Playwright suite, and exits 0.
- [ ] **AC-0152.** Running `npm run gen:types` leaves `src/lib/database.types.ts` with no diff.
- [ ] **AC-0153.** `npm run typecheck` exits 0.
- [ ] **AC-0154.** `grep -rnE "\.(insert|update|upsert|delete)\(" src/` prints nothing.
- [ ] **AC-0155.** `grep -rnE "from ['\"][^'\"]*app/" src/lib/` prints nothing.
- [ ] **AC-0156.** `npm audit --omit=dev --audit-level=high` exits 0, or every high or critical advisory it reports appears in the Advisory waivers list above.
- [ ] **AC-0157.** `grep -rnE "['\"]pg(-pool)?(/[^'\"]*)?['\"]" src/` prints nothing.
- [ ] **AC-0158.** No code under `src/` reads a privileged variable, except `src/privileged-env.ts`, which reads no environment value at all. Each of these prints nothing:
  - `grep -rniE "env(\.|\[['\"])[a-z0-9_]*(service_role|secret|jwt|db_url|database_url|postgres)" src/ | grep -v '^src/privileged-env.ts:'`
  - `grep -rnE "\}\s*=\s*process\.env" src/`
  - `grep -nE "process\.env(\.|\[)" src/privileged-env.ts`
- [ ] **AC-0159.** `grep -rniE "anthropic|openai|@ai-sdk|langchain" package.json src/` prints nothing.
- [ ] **AC-0160.** Compared with the local database built from `main`'s migrations, the database after this branch's migrations has the same base tables in `public` with the same columns, except that `products` also has `target_margin_pct` and `list_price_per_lb`.
- [ ] **AC-0161.** `npm run test:costing` runs `test/costing.test.ts` and `test/pricing.test.ts` and exits 0.

## Follow-ons

- jaketlee07: [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §13 item 7 (Alerts), the pushed margin-below-target and price-stale alerts and the daily digest. Price stale needs the date and cost of the last list-price change, which this feature does not store.
- jaketlee07: [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §13 item 6 (Ask your data), AI wording over the pricing view's numbers.
- jaketlee07: [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §13 item 5 (Sales), whether a sale's price starts at the list price.

## Assumptions

- Technical: `v_product_pricing.final_price_per_lb` is the sheet price, cost per lb plus margin-kind fees, and `products` has no target or list-price column (source: `supabase/migrations/0001_init.sql`, products table and views)
- Technical: Receiving's suggested price reads `final_price_per_lb` and shows "No price yet" when the raw product has no non-void receipt; its browser checks assert $2.68/lb and $2.74/lb for 502, which has no target (source: `src/lib/receiving.ts` `listFinishedPrices`, `src/app/receiving/stock-view.ts`, `test/e2e/receiving.spec.ts`)
- Technical: the golden test asserts that 502's `final_price_per_lb` displays as 2.68, and `npm run test:costing` runs only `test/costing.test.ts` (source: `test/costing.test.ts` invariant 2; `package.json`)
- Technical: Postgres `round(numeric, n)` rounds half away from zero, as the screen's formats do, and `ceil(x * 100) / 100` rounds up to the cent (source: local-stack probes 2026-10-08 and 2026-10-09)
- Technical: the example numbers hold in Postgres: 2.6318 ÷ 0.8 rounds up to 3.29, ÷ 0.775 to 3.40, ÷ 1 to 2.64; a 1.6632 receipt gives cost 2.6100, suggested 3.27, and margin 0.2018 at 3.27; margin at 2.68 is 0.0180; a RAW-TOM what-if at 2.00 gives cost 3.0474 and suggested 3.81 at 20%, and margin 0.0737 at 3.29 (source: local-stack probes 2026-10-08 and 2026-10-09)
- Technical: the views can gain columns in place with `v_current_menu` depending on `v_product_pricing`, but `CREATE OR REPLACE VIEW` clears `security_invoker`, so the migration sets it again (source: local-stack probe inside a rolled-back transaction, 2026-10-08)
- Technical: the database sorts product codes with the `en_US.UTF-8` collation, which puts "1000" before "502" before "A1" (source: local-stack probe 2026-10-09)
- Technical: an operator can read `product_fees` and `fee_types` and update `products`; no operation writes `products` today (source: `supabase/migrations/20261007182816_access_lockdown.sql`)
- Technical: `test/access.test.ts` sweeps every `public` function from the catalog and needs valid arguments and an operator call for each, and the receiving and production browser suites compare each page's Tab-order list with `FORM_CONTROLS`, which starts with the navigation links (source: `test/access.test.ts`, `test/e2e/receiving-page.ts`, `test/e2e/production-page.ts`)
- Technical: the shrink percent format can show a margin, including a negative one (source: `src/lib/format.ts` `formatShrink`)
- Technical: the caller check, the session client with its 10-second request limit, the failure texts, the display formats, the not-allowed page, the error view, the Primary navigation, and the browser-suite helpers exist from receiving and production and are reused (source: `src/app/_server/`, `src/lib/failures.ts`, `src/lib/format.ts`, `src/app/page-header.tsx`, `test/e2e/a11y.ts`)
- Product: once a product has a target margin, its suggested price is cost per lb ÷ (1 − target), and its margin-kind fees stop counting; a product with no target keeps the sheet price (source: user confirmation 2026-10-08)
- Product: with a target, the suggested price rounds up to the next whole cent, so a product at its suggested price is never below target (source: user confirmation 2026-10-09)
- Product: margin means share of the selling price (source: user confirmation 2026-10-08)
- Product: the list price is stored and changes only when the owner presses an AC-0066 button or saves a typed price; a product has no list price until the owner sets one (source: user confirmation 2026-10-08)
- Product: Receiving's suggested price follows the target margin, because all pages read one suggested price (source: user confirmation 2026-10-08)
- Product: products whose raw input has no cost appear on `/pricing` under their own "No cost yet" heading, after the others (source: user confirmation 2026-10-09)
- Product: two pages, `/menu` and `/pricing`, joined to the Primary navigation; `/` still opens Receiving; the menu starts with every product shown and a "Sellable only" switch hides the rest; pricing flags products whose list price differs from the suggestion, below-target first; suggestions go both ways; the advice is fixed text over database numbers with no AI call; Receiving shows no reprice prompt; the what-if saves nothing; all new math lives in the database; there is no price-history table (source: user confirmation 2026-10-08)
- Product: the owner sets a target margin and a list price on the pricing detail, and can remove a target margin there (source: user confirmation 2026-10-08, "You set each product's target margin and list price on Pricing")
- Product: design goals in order are hard to mistype, fast on a phone, and numbers easy to trust; plain, high contrast, no decoration; the experience-design pack is not installed, so design intent for these surfaces is grounded only in these goals (source: production spec Assumptions; skill roster, 2026-10-08)
- Product: a what-if counts the typed raw cost as the cost, so it shows full prices for a raw product not yet received (source: user confirmation 2026-10-09)
- Product: every page refuses to load inside another page's frame (source: user confirmation 2026-10-09)
- Technical: `next.config.ts` holds no `headers()` today, and neither it nor `src/proxy.ts` sets `frame-ancestors` or `X-Frame-Options` (source: `next.config.ts`, `src/proxy.ts`)
- Process: `npm run test:costing` runs the pricing golden cases too (source: user confirmation 2026-10-09)
- Process: the work is built in three dependency-ordered parts, the database, then Menu, then Pricing, and one review at the end takes them in that order (source: user confirmation 2026-10-08; the work-loop reaches its review state only after the last task)
- Process: this spec keeps its own Advisory waivers list, as receiving and production do (source: production spec Assumptions)
- Process: shipped dependencies are audited with `npm audit --omit=dev --audit-level=high` before merge (source: receiving spec Assumptions)
- Process: the owner approves the spec and the plan in chat, and the agent records the Approved status (source: receiving spec Assumptions)
