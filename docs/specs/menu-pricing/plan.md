# Plan: menu-pricing

- **Spec:** [`spec.md`](spec.md)
- **Status:** Drafting <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:**
  - **Area rules and access model:** `docs/architecture/overview.md`.
  - **Analogous implementations:** the production page, `src/app/production/` (`page.tsx`, `actions.ts`, `save-batch.ts`, `error.tsx`), over `src/lib/production.ts`, `src/lib/batch-input.ts`, `src/lib/failures.ts`, and `src/lib/format.ts`; for database functions, `receive_lot` and `private.assert_caller` in `supabase/migrations/20261007181933_engine_hardening.sql` and `20261008110703_operator_check.sql`.
  - **Their tests:** `test/production-rules.test.ts`, `test/production-data.test.ts`, `test/save-batch.test.ts`, `test/engine.test.ts`, `test/access.test.ts`, and the browser suite `test/e2e/production.spec.ts` with `test/e2e/production-page.ts`, `test/e2e/a11y.ts`, and `test/e2e/states.ts`. Fixtures come from `test/db.ts` (`resetTestData`, `callAsOperator`, `OpCall`, `tableFingerprints`) and `test/users.ts`.
  - **Named deviations:** this is the first migration since the engine hardening that adds functions outside the six operations, and the first that writes master data through a function. The two writes stay `SECURITY DEFINER` with `private.assert_caller`, as the operations do, so refusals carry the same codes the app already maps. The read-only `price_what_if` runs as the caller, as `check_operator` does, so the tables' RLS still applies behind its operator check. The price rule is written twice in the migration, once in the pricing view and once in `price_what_if`, because a shared helper would need EXECUTE and schema USAGE for `service_role` to keep the access model's "reads every view" true; AC-0022 holds the two equal.
  - **Read-only probes on the local stack, 2026-10-08 and 2026-10-09:** `round` is half away from zero (`round(2.685, 2)` = 2.69). `ceil(x * 100) / 100` rounds up to the cent but carries 16 decimals (`3.2900000000000000`), so the rule wraps it in `round(…, 2)` to read `3.29`. The spec's numbers: 2.6318 ÷ 0.8 rounds up to 3.29, ÷ 0.775 to 3.40, ÷ 1 to 2.64; a 1.6632 receipt gives cost 2.6100, 3.27 at 20%, and margin 0.2018 at 3.27; margins 0.0180, 0.2001, 0.2481, −0.0527 at 2.68, 3.29, 3.50, 2.50; a RAW-TOM what-if at 2.00 gives 3.0474, 3.81 at 20%, 3.0974 with no target, and margin 0.0737 at 3.29; at the 1.725 average, cost 2.6903, 3.37 at 20%, and margin 0.1823 at 3.29. The database collation is `en_US.UTF-8` (codes sort "1000", "50", "502", "A1", "a2", "RAW-TOM"). `authenticated` has USAGE on `private` and EXECUTE on `private.is_operator()`; `private.assert_caller` has no grant beyond `postgres`.
  - **Disconfirming probe, 2026-10-08,** in a rolled-back transaction: adding the two `products` columns and appending columns to `v_product_pricing` worked with `v_current_menu` depending on it, and `v_current_menu` still answered. `pg_class.reloptions` for `v_product_pricing` was empty afterwards: `CREATE OR REPLACE VIEW` cleared `security_invoker`. The migration therefore sets it on both views, and AC-0018 proves it.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/menu-pricing/notes/verification-ledger.md`. A genuine artifact
> error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material.

## Approach

The work lands as three dependency-ordered layers on `feat/menu-pricing`, in the
order the owner asked for. Each layer is its own commits and leaves `npm test`
green.

1. **Database (T1).** One migration adds `target_margin_pct` and `list_price_per_lb` to `products`, rebuilds the pricing and menu views with the new columns, and adds `set_target_margin`, `set_list_price`, and `price_what_if`. The golden pricing cases go in `test/pricing.test.ts` first, `test/access.test.ts` sweeps the three new functions, and `npm run test:costing` runs both golden files. `docs/costing.md` and `SYSTEM-SPEC.md` §4 change with it, so the rule and its numbers land together.
2. **Menu (T2).** The Primary navigation gains Menu and Pricing, the floor pages' Tab-order lists in the browser helpers gain the two links, and `/menu` renders the menu view with its switch and error page.
3. **Pricing (T3 to T8).** Pure rules, then the reads, then the change actions' decisions, then the list with Apply and the what-if, then the detail with its forms, then the docs, the goal-based checks, and the recorded run.

The estimate is about 3,500 reviewable lines, so the shape is MIXED: the layers
are the decomposition. One review unit at the end reviews the three layers in
order, each named by its commit range, so a database finding is read before the
pages built on it.

The riskiest part is the migration: a replaced view that loses
`security_invoker` silently opens every row to a non-operator. AC-0018 tests it
directly, and `test/access.test.ts` keeps running.

## Constraints

- `SYSTEM-SPEC.md` §2 and §11: the app computes no cost, price, or margin, never auto-applies a price, and changes the ledger only through operations. This feature writes no ledger row.
- `AGENTS.md` hard rules 2, 3, 4, 6, and 7.
- The access model, write path, and app trust boundary in `docs/architecture/overview.md`: every server action settles the caller through `src/app/_server/caller.ts`; every server-side client uses the 10-second request limit in `src/app/_server/session.ts`; each new function revokes its default privileges and grants EXECUTE to `authenticated` only; `service_role` keeps reading every view (AC-0027).
- No ADR or RFC governs this area.

## Construction tests

**Integration tests:** none beyond per-task tests. `test/global-setup.ts` and the per-test `assertLedgerInvariants` hook keep the costing invariants checked after every Vitest test that touches the database; `test/costing.test.ts` keeps invariant 2 at 2.68 with no target.

**Manual verification:** the T8 recorded run.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Costing truth, `docs/costing.md` | T1 (rules section, numbers, build-up formula, where-the-math-lives sentence), T3 (Rounding note: Margin row, fee row, price row's list prices, cost-per-lb row's reach, missing-value texts, suite names) | `test/pricing.test.ts` cases for AC-0010, AC-0014, AC-0019, AC-0020; `test/pricing-rules.test.ts` for AC-0140 and the fee format | close-work finds each named number in the file and in a passing test |
| Master brief, `SYSTEM-SPEC.md` §4 | T1 | The edited §4 lines | close-work finds no `list_price_override` and finds both new column names |
| Current architecture and app trust boundary, `docs/architecture/overview.md` | T8 | The edited rows and sentences named in the spec's Durable Outputs row | close-work reads each named row against `src/`, `supabase/`, and `test/` |
| Agent guidance and commands, `AGENTS.md` and `package.json` | T1 | The `test:costing` script and its `AGENTS.md` comment | AC-0161 output in the ledger |
| Interface compatibility, `src/lib/database.types.ts` | T1 (regenerated), T8 (AC-0152) | AC-0152 output in the ledger | `npm run gen:types` leaves no diff |

Every design fact below shows in code and tests or is delivery residue, except
three that belong in durable owners: the price rule and its round-up
(`docs/costing.md`, T1), the `security_invoker` rule for a replaced view, and
the what-if running as the caller (`docs/architecture/overview.md`, T8).

## Design (LLD)

### Design decisions

- **One rule, written in two places side by side.** The pricing view and `price_what_if` each compute post-shrink cost, cost per lb, suggested price, suggested list price, and margin at list price with the same expressions, written next to each other in the migration. AC-0022 holds them equal over a fixture with a target and a no-target product. A shared private helper was rejected: the views call it as their reader, so `service_role` would need EXECUTE on it and USAGE on `private`, a grant change for a two-expression saving. The view keeps the sheet expression of `0001_init.sql` for a product with no target, so invariant 2 stays at 2.6818. Traces to: AC-0010 to AC-0017, AC-0019 to AC-0022, AC-0027.
- **With a target, the suggested price is `round(ceil(cost_per_lb / (1 - target) * 100) / 100, 2)`,** where `cost_per_lb` is the view's 4-decimal value. Rounding up keeps the margin at the suggested price at or above the target; the screen shows that cost, so the owner can redo the division from what is shown. The suggested list price is `round(final_price_per_lb, 2)` for both rules, an identity for a target product, so the list, the button, and Receiving's display all show one number. Traces to: AC-0010, AC-0011, AC-0013, AC-0019, AC-0073, AC-0081.
- **Existing columns keep their names, types, and order;** new ones are appended, because `CREATE OR REPLACE VIEW` allows only that and Receiving reads `final_price_per_lb`. Appended to the pricing view: `target_margin_pct`, `list_price_per_lb`, `has_cost` (a non-void receipt exists for the raw input), `suggested_list_price`, `margin_at_list_pct`, `price_action` (`'set' | 'raise' | 'lower'` or null), `needs_new_price` (`price_action is not null`), `below_target`. All but the first three are null or false when `has_cost` is false. Appended to the menu view: `list_price_per_lb`. Both views are re-created `with (security_invoker = true)`. Traces to: AC-0018, AC-0040, AC-0060.
- **Writes through `SECURITY DEFINER` functions with `private.assert_caller` first,** as the six operations do, rather than through the operator's table UPDATE grant: the refusals then carry SQLSTATE 42501 and a `<function>: ` prefix the app already maps, and AC-0154 keeps `.update(` out of `src/`. `set_target_margin(p_product_id, p_target_percent)` takes the percent the owner typed and stores it ÷ 100, so no TypeScript divides; null removes the target. `set_list_price(p_product_id, p_price_per_lb)`. Each validates its value before any lock, then locks the product row `FOR NO KEY UPDATE`, checks it is an active finished product, and returns the `products` row. Refusal texts after the prefix: `product <id> not found`, `product <id> is not a finished product`, `product <id> is inactive`, and one text per value rule (`target must be from 0 up to but not including 100`, `target has more than 2 decimal places`, `price must be above 0`, `price must be below 100000000`, `price has more than 2 decimal places`, `<value> must be a finite number`). The inactive text ends in "is inactive", which `failures.ts` already turns into "This product is no longer active." Traces to: AC-0030 to AC-0035, AC-0116 to AC-0118.
- **`price_what_if(p_raw_product_id, p_raw_cost_per_lb)`** is `SECURITY INVOKER`, `STABLE`, and refuses a caller for whom `private.is_operator()` is not true with SQLSTATE 42501, as `check_operator` does; `private.assert_caller` grants no EXECUTE to `authenticated`. It reads under the tables' RLS and writes nothing. It refuses a null, NaN, infinite, or negative cost. It treats the given cost as a cost, so its rows carry a suggested list price and a margin whether or not the raw product has a receipt. It returns one row per active finished product made from the raw product, in code order. Traces to: AC-0020 to AC-0028.
- **Every new function sets `search_path = ''` and schema-qualifies every name,** as the six operations do. Traces to: AC-0038.
- **The value limits hold for every writer:** a check constraint `kind = 'finished' or (target_margin_pct is null and list_price_per_lb is null)`, plus column checks `target_margin_pct >= 0 and target_margin_pct < 1` and `list_price_per_lb > 0 and list_price_per_lb <> 'NaN'`, so Studio and the table grants cannot store a value that would make the views divide by zero or show NaN. Postgres ranks NaN above every number, so `> 0` alone admits it; the target's `< 1` already refuses it. Traces to: AC-0036, AC-0037, AC-0160.
- **Framing is refused for every page** through a `headers()` entry in `next.config.ts` for `/:path*` that sets `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`. The one-press Apply and Remove buttons are the reason; every page gets it because the rule costs nothing extra. Traces to: AC-0006.
- **The database decides every comparison the screen shows:** price action, below-target, and has-cost come from the view. TypeScript maps each code to its words and orders rows only by those columns and by code. Traces to: AC-0062 to AC-0066, AC-0074 to AC-0076, the Never-do on TypeScript comparisons.
- **The menu reuses `getMenu` in `src/lib/views.ts`,** with `.order("code")` added; nothing else calls it. `getPricing` stays as the golden tests use it. The pricing pages' reads live in a new `src/lib/pricing.ts`, because they need the fee names, the raw input, the three-group order, and the what-if, which no existing read carries. Traces to: AC-0040, AC-0051.
- **The change actions share one decision module.** `src/app/pricing/save-change.ts` exports `decideChange(request, deps)`, where `deps` carries `caller()` and `write(client)`, as `save-batch.ts` does. The three server actions in `actions.ts` differ only in the form rule and the write they pass. Traces to: AC-0110, AC-0113 to AC-0118.
- **Apply sends the price the button names,** from a hidden field holding the view's `suggested_list_price`. The action runs it through the same list-price rule as a typed price. Traces to: AC-0067.
- **The what-if is a GET form** (`/pricing?raw=<code>&cost=<text>`): it writes nothing, the result reloads as shown, and it needs no server action. Traces to: AC-0120 to AC-0125.
- **The detail is `/pricing?product=<code>`,** on the production page's `?product=` pattern. Traces to: AC-0070, AC-0080 to AC-0085.
- **The "Sellable only" switch is a client checkbox** that filters the server-rendered list without a request, so it always starts off. Traces to: AC-0046 to AC-0049.

### Data & schema

- `products.target_margin_pct numeric(5,4)` and `products.list_price_per_lb numeric(10,2)`, both nullable, both covered by the existing table grants and RLS policies.
- No new table, index, or trigger. The `lots_guard` trigger is untouched.
- The migration is created with `supabase migration new menu_pricing` and applied with `supabase migration up`.

### Interfaces & contracts

- `src/lib/rpc.ts`: `setTargetMargin(client, productId, targetPercent | null)` and `setListPrice(client, productId, pricePerLb)`, thin wrappers that throw `RpcError` like the others.
- `src/lib/pricing.ts`: `listPricing(client)` (the list rows, ordered by `needs_new_price desc, has_cost desc, below_target desc, code`, for AC-0063, AC-0064, and AC-0077), `getPricingDetail(client, code)` (one row plus its fees by name in `fee_types.sort_order`, and its raw input's code and description), `listWhatIfRawProducts(client)`, and `runWhatIf(client, rawProductId, rawCostPerLb)`. Each returns numbers as the database delivered them.
- `src/lib/views.ts`: `getMenu` ordered by code.
- `test/db.ts`: `OperationName` gains `set_target_margin`, `set_list_price`, and `price_what_if`; `PARAM_TYPES` gains `p_target_percent`, `p_raw_product_id`, and `p_raw_cost_per_lb`.

### Component / module decomposition

- `src/lib/price-input.ts`: `parseTargetMargin(text)`, `parseListPrice(text)`, and `parseWhatIf({ rawCode, cost }, rawCodes)`, pure, on the `number-text.ts` rules; run in the browser for instant messages and again in the action.
- `src/lib/price-advice.ts`: `priceAdvice(row)` and `priceButtonName(action, suggestedListPrice)`, pure, through `format.ts`.
- `src/lib/format.ts`: `formatMargin` and `percentText` (the stored fraction as percent text without "%", for the field's starting value), both moving the decimal point in the number's text as `formatShrink` does.
- `src/lib/failures.ts`: the change texts and `changeFailureMessage(error, stage)` (T3); `ReceivingAction` widened to name the three change actions (T5).
- `src/app/page-header.tsx`: `PageName` and `PAGES` gain `menu` and `pricing`.
- `src/app/menu/`: `page.tsx` (server: caller, `getMenu`), `menu-list.tsx` (client: switch and rows), `error.tsx` on `page-error.tsx`.
- `src/app/pricing/`: `page.tsx` (server: caller, then the list or the `?product=` detail, and the what-if), `pricing-list.tsx`, `price-advice-block.tsx` (advice and Apply, used by the list and the detail), `pricing-detail.tsx`, `target-form.tsx`, `list-price-form.tsx`, `what-if.tsx`, `form-fields.ts`, `save-change.ts`, `actions.ts`, `error.tsx`.

### State & control flow

Page contracts, from `frontend-engineering` create mode:

| Field | `/menu` | `/pricing` (list, detail, what-if) |
| --- | --- | --- |
| target user | The owner, at a desk or on the floor | The owner, mostly at a desk |
| primary job | See what can be sold now and at what price | Keep list prices on target as costs move |
| primary action | The "Sellable only" switch | An Apply button; on a detail, Save target and Save price; Show prices in the what-if |
| expected result | The list narrows to sellable products | The stored list price or target, confirmed in a focused message, with the product's numbers re-read from the database |
| next action | Quote or sell (outside this feature) | The next product under "Needs a new price" |
| first-screen content at 320 px | Heading, navigation, switch, first product card | Heading, navigation, the "Needs a new price" heading and its first card |
| product proof | none: an internal tool | none: an internal tool |
| read/write consequence | Read only | Each change writes one `products` column and nothing else; a refusal writes nothing; the what-if writes nothing |
| critical states | first-run, empty, content, error page, permission/denied | first-run, content, no-results, success, error, permission/denied |
| responsive behavior | One column of cards at every width; figures wrap under their labels | The same; the what-if form stacks its fields |
| a11y requirements | WCAG 2.2 AA; the switch is a native checkbox with a visible label | WCAG 2.2 AA; focus moves to the message after a change and to the first field with an error after a refusal |
| measurement event | none: no analytics | none: no analytics |

State matrix (the applicable subset of the 18 states):

| State | Treatment | AC |
| --- | --- | --- |
| first-run | No active finished product: the AC-0050 text on `/menu`, and the same sentence on `/pricing` with no what-if form | AC-0050 |
| content | Product cards; on `/pricing`, the three headed groups and the what-if form | AC-0040, AC-0060, AC-0063 |
| empty | "Sellable only" with nothing sellable: AC-0049; a what-if raw product with no finished product: AC-0125 | AC-0049, AC-0125 |
| no-results | Detail for an unknown code | AC-0085 |
| loading | Pending change buttons carry `aria-disabled="true"` and a "Saving…" status | AC-0067 |
| success | `role="status"` message, focused | AC-0068, AC-0092, AC-0094, AC-0102, AC-0134 |
| error | Field messages with `aria-describedby`, or a focused message for a change refusal or failure, every value kept | AC-0091, AC-0101, AC-0110, AC-0113 to AC-0119, AC-0111, AC-0123, AC-0135 to AC-0137, AC-0142 |
| permission/denied | Not-allowed page with Sign out | AC-0002 |
| high-zoom | 320 px reflow; cards, not tables | AC-0131 |
| keyboard-only | Full keyboard path, visible focus | AC-0133, AC-0139 |
| partial, large-data-set, offline, blocked, long-content, reduced-motion, destructive-confirmation, disabled | Not applicable: every list shows every active product (the owner's catalog is small); a price change is reversible, so it has no check step; descriptions wrap; there is no animation | n/a |

A change action moves through idle, invalid, pending, saved, and refused or
failed. On success the action revalidates `/pricing` and returns the stored row,
and the page shows the AC-0068, AC-0092, AC-0094, or AC-0102 message from it.

### Behavior & rules

- A change action settles the caller, runs its form rule, then calls its one write. There is no read before the write.
- `changeFailureMessage` reads the stage and the code like `saveFailureMessage`: before-write gives "try again"; no code gives the may-not-have-been text; 42501 gives not-allowed; "is inactive" gives the inactive text; any other engine text follows "The change wasn't saved." with its prefix removed.
- The list puts `needs_new_price` rows under "Needs a new price", below-target first and then by code whatever their action; rows with `has_cost` false under "No cost yet"; and the rest under "Priced", each in code order. A group with no rows prints no heading.
- The pricing pages show `suggested_list_price` wherever they show a suggested price, and `margin_per_lb` as F in the advice.

### Failure, edge cases & resilience

- Setting a target or a price is idempotent, so a change whose write got no answer is safe to repeat; the message says to reload and check rather than warning against a second save.
- A stale page applies the price it showed (AC-0067); the re-render after the save shows the current cost, margin, and any new action.
- The 10-second request limit and the proxy's handling of an ended session on a POST are inherited unchanged.

### Quality attributes (NFRs)

- **Aesthetic reference:** Stripe Dashboard (professional SaaS: a light surface, high contrast, tabular figures, no gradients or illustration), as on receiving and production. XD genre routing: skipped (experience-design pack absent). Seed tokens: the existing tokens in `src/app/globals.css`; the pages add none.
- **Accessibility:** every field has a visible `<label>`; error ids are named by `aria-describedby`; messages sit in `role="status"` or `role="alert"` regions; product groups are headed lists of cards, so 320 px needs no horizontal scroll.
- `checkPageState` in `test/e2e/a11y.ts` runs in every page state the spec lists.

## Tasks

Stub validation, 2026-10-09 (after review round 2). Each `stub: true` block below
was extracted from this file into a `git archive` copy of `HEAD` in scratch,
outside the repository, and its sha256 recorded from that extraction (the code
lines plus one terminal newline); the extraction reproduced all four recorded
digests.

- **Compile:** against placeholder declarations of the new modules and the T1 `test/db.ts` names, `tsc --noEmit` under the repository's compiler options exited 0 for all four.
- **Red, with the placeholders removed:** `vitest run` over the four files exited 1. T3, T4, and T5 failed to load their missing modules (`../src/lib/price-advice.js`, `../src/lib/pricing.js`, `../src/app/pricing/save-change.js`). T1, with the `test/db.ts` names added, failed its assertion with `function public.set_target_margin(...) does not exist` from the local stack.
- **Isolation:** the run went through `sandbox-exec` with network denied except to `localhost`, file writes denied except under the scratch directory, the session's temporary directory, and `/private/var/folders`, and a 120-second `alarm`. The stack details came from `supabase status -o env` outside the sandbox and were passed in the environment, so no Docker or CLI call ran inside it. Vitest's results-cache write under `node_modules/.vite` was refused by the sandbox after the run.
- **Declared test-harness side effects,** all on the local stack through `localhost`: global setup's idempotent creation of the test users and their allowlist rows; `resetTestData`'s truncate and reseed of the local database; and the T1 stub's committed `receive_lot` call. These are the side effects `npm test` has on every run.
- The scratch copy was removed.

### T1: The migration's pricing rules and operations pass the golden pricing cases

**Depends on:** none

**Touches:** `supabase/migrations/*_menu_pricing.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/pricing.test.ts`, `test/access.test.ts`, `package.json`, `AGENTS.md`, `docs/costing.md`, `SYSTEM-SPEC.md`

**Tests:**
- `test/pricing.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0010: a 20% target gives 502 a suggested price of 3.29" (AC-0010). sha256 `4ede6cf9d99f1f23ecd81e0d5462294dc1cc386c0a62aca7b17356c217c98e63`.

```ts
import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  PROD_502_ID,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  VENDOR_ID,
} from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0010
it("AC-0010: a 20% target gives 502 a suggested price of 3.29", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).ok).toBe(true);
  const target = await callAsOperator({
    fn: "set_target_margin",
    args: { p_product_id: PROD_502_ID, p_target_percent: 20 },
  });
  expect(target.error).toBeUndefined();
  const rows = await query(
    `select cost_per_lb::text, final_price_per_lb::text, suggested_list_price::text
     from public.v_product_pricing where product_id = $1`,
    [PROD_502_ID],
  );
  expect(rows).toEqual([{ cost_per_lb: "2.6318", final_price_per_lb: "3.29", suggested_list_price: "3.29" }]);
});
```

- The same file then grows, in EXECUTE, with fixtures built through `receiveCall`, `produceCall`, `voidReceiptCall`, the new calls, and `query` for fee and product rows: one test per criterion: AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0028, AC-0160.
  - Refusals compare `tableFingerprints` before and after (AC-0025, AC-0031, AC-0033). NaN goes through `callAsOperator`, as the engine tests do; infinity is sent as `'Infinity'`.
  - AC-0034 compares every table's fingerprint except `products`, and the 502 row column by column.
  - AC-0018 reads both views as the non-operator through `signInNonOperator` after the operator reads a row from each; AC-0027 reads both as `service_role` through a service-role client.
  - AC-0035 checks `has_function_privilege` for `anon` and `service_role` on the three functions; AC-0038 reads `pg_proc.proconfig` for each function the migration adds.
  - AC-0036 and AC-0037 run each update through `query` as `postgres` and expect a check-constraint refusal; AC-0037 includes `'NaN'` for both columns.
  - AC-0160 reads `information_schema.columns` for `public.products` and `pg_tables` for `public`.
- `test/access.test.ts` gains a `validArgs` entry and an operator fixture call for each of `set_target_margin`, `set_list_price`, and `price_what_if`, so its catalog sweep refuses each for a non-operator with 42501 and no table change and accepts it for the operator. No function leaves the sweep.
- `test/costing.test.ts`, `test/engine.test.ts`, and `test/receiving-data*.test.ts` stay unchanged and green.

**Approach:**
- Extend `OperationName` and `PARAM_TYPES` in `test/db.ts`.
- Write the migration in the order: columns and checks, the two views `with (security_invoker = true)` with the rule written side by side, the three functions with their revoke-then-grant lines. Apply with `supabase migration up`, then `npm run gen:types`.
- Set `test:costing` to `vitest run test/costing.test.ts test/pricing.test.ts` and its `AGENTS.md` comment to "the golden costing and pricing suites only".
- In `docs/costing.md`, add the "Target margin and list price" section with the rules, the round-up, and the AC-0010, AC-0014, AC-0019, and AC-0020 numbers; make the build-up formula name both price rules; add the pricing view and `price_what_if` to the sentence on where the math lives; and name `test/pricing.test.ts` in the opening. In `SYSTEM-SPEC.md` §4, replace `list_price_override` with `list_price_per_lb` and its meaning, state that a target margin replaces the margin fees for that product, and extend the two view descriptions.

**Done when:** the T1 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T2: `/menu` shows the menu view, and every page links to Menu and Pricing

**Depends on:** T1

**Touches:** `src/lib/views.ts`, `src/app/page-header.tsx`, `src/app/menu/*`, `next.config.ts`, `test/e2e/menu.spec.ts`, `test/e2e/menu-page.ts`, `test/e2e/receiving-page.ts`, `test/e2e/production-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/menu.spec.ts`, signed in as the operator, with fixtures written through `pg` like `test/e2e/production-page.ts`:
  - access and navigation: AC-0001 and AC-0002 for `/menu`; AC-0004 and AC-0005 on `/receiving`, `/production`, and `/menu` (and on `/pricing` in T6); AC-0006 through Playwright's request API, signed out and as the operator, for `/sign-in`, `/receiving`, `/production`, and `/menu`;
  - the menu: AC-0040, AC-0051, AC-0041, AC-0042, AC-0043, AC-0044 (the adjustment made through `adjust_lot` as the operator), AC-0045, AC-0046, AC-0047, AC-0048, AC-0049, AC-0050;
  - keyboard: AC-0133 for the "Sellable only" switch;
  - `checkPageState` with no findings in the menu with products, with "Sellable only" on, with "Sellable only" on and nothing sellable, with no active finished product, and on the non-operator page: AC-0130, AC-0131, AC-0132, AC-0139, AC-0141 for those states.
- `FORM_CONTROLS` in `test/e2e/receiving-page.ts` and `test/e2e/production-page.ts` gain "a Menu" and "a Pricing" after "a Production" and before "button Sign out", so `test/e2e/receiving.spec.ts` and `test/e2e/production.spec.ts` stay green with the wider navigation.

**Approach:**
- Order `getMenu`, widen the header, add the framing headers, and build the page and switch on the production page's patterns.

**Done when:** `npm test` exits 0 with the new and existing browser tests green.

### T3: Price form rules, the margin and fee formats, the advice, and the change messages pass their tables

**Depends on:** T1

**Touches:** `src/lib/price-input.ts`, `src/lib/price-advice.ts`, `src/lib/format.ts`, `src/lib/failures.ts`, `test/pricing-rules.test.ts`, `docs/costing.md`

**Tests:**
- `test/pricing-rules.test.ts`, a new file, no database. stub: true. Test functions and ACs: "AC-0140: a margin shows as a percent" (AC-0140), "AC-0091: a target margin of 100 is refused" (AC-0091), "AC-0065: the advice for a product with a target and a list price" (AC-0065), "AC-0116: an inactive product's refusal says so" (AC-0116). sha256 `b957b28c4d7f3f9d7c7f896f8ac502c89b4d956bc8644eada7c5f7c9adefc03d`.

```ts
import { describe, expect, it } from "vitest";
import { changeFailureMessage } from "../src/lib/failures.js";
import { formatMargin } from "../src/lib/format.js";
import { priceAdvice, priceButtonName } from "../src/lib/price-advice.js";
import { parseTargetMargin } from "../src/lib/price-input.js";
import { RpcError } from "../src/lib/rpc.js";

describe("margin format", () => {
  // STUB: AC-0140
  it("AC-0140: a margin shows as a percent", () => {
    expect([0.2, 0.018, 0.2001, 0.2481, -0.0527, 0].map((fraction) => formatMargin(fraction))).toEqual([
      "20%",
      "1.8%",
      "20.01%",
      "24.81%",
      "-5.27%",
      "0%",
    ]);
  });
});

describe("price form rules", () => {
  // STUB: AC-0091
  it("AC-0091: a target margin of 100 is refused", () => {
    expect(parseTargetMargin("100")).toEqual({ ok: false, error: "A target margin must be below 100." });
  });
});

describe("price advice", () => {
  // STUB: AC-0065
  it("AC-0065: the advice for a product with a target and a list price", () => {
    const row = {
      costPerLb: 2.6318,
      suggestedListPrice: 3.29,
      targetMarginPct: 0.2,
      listPricePerLb: 2.68,
      marginAtListPct: 0.018,
      marginFeesPerLb: 0.05,
    };
    expect(priceAdvice(row)).toBe(
      "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. At your list price of $2.68/lb, the margin is 1.8%.",
    );
    expect(priceButtonName("raise", 3.29)).toBe("Raise list price to $3.29/lb");
  });
});

describe("change messages", () => {
  // STUB: AC-0116
  it("AC-0116: an inactive product's refusal says so", () => {
    const error = new RpcError(
      "setListPrice failed: set_list_price: product 33333333-3333-3333-3333-333333333333 is inactive",
      "P0001",
    );
    expect(changeFailureMessage(error, "write")).toBe("The change wasn't saved. This product is no longer active.");
  });
});
```

- The same file then grows, in EXECUTE: one case per row of AC-0091, AC-0101, and AC-0123 with first-row-wins order; the AC-0090 and AC-0100 starting values through `percentText` and the stored price; the other three AC-0065 advice rows, including the no-target 502 example, and the AC-0066 Set and Lower names; a fee of 0.05 showing as $0.0500/lb; and `changeFailureMessage` giving the AC-0113 text for a before-write error, the AC-0114 text for a write error with no code, the AC-0117 text for a 42501, and the AC-0118 text for another engine refusal.
- `test/format.test.ts`, `test/production-rules.test.ts`, and `test/failures*.test.ts` stay unchanged and green.

**Approach:**
- Write the parsers on the shape of `parseBatchForm`; `formatMargin` shares `formatShrink`'s decimal-point move; a fee uses `formatCostPerLb`; add the texts and `changeFailureMessage` beside `batchSaveFailureMessage`.
- In the `docs/costing.md` Rounding note, add the Margin row and a fee row, extend the price row to list prices and the cost-per-lb row to cost after shrink and a product's cost per lb, add "No list price yet" and "No target" to the missing-value texts, and name `test/pricing-rules.test.ts` in the file's opening.

**Done when:** the T3 tests are green.

### T4: The pricing reads return the screen's rows in the screen's order

**Depends on:** T1, T2, T3

**Touches:** `src/lib/pricing.ts`, `src/lib/rpc.ts`, `test/pricing-data.test.ts`

**Tests:**
- `test/pricing-data.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0080: the detail lists the processing fees by name in fee-type order" (AC-0080). sha256 `399e6a4d4beaa52b06149505209e195b6bffa592b45897c606bb1d83892c1fa5`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { getPricingDetail } from "../src/lib/pricing.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { assertLedgerInvariants, closePool, resetTestData } from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0080
it("AC-0080: the detail lists the processing fees by name in fee-type order", async () => {
  const detail = await getPricingDetail(operator, "502");
  expect(detail?.processingFees.map((fee) => fee.name)).toEqual([
    "Direct cost of material",
    "Cost of freezing",
    "Belmont overhead",
  ]);
  expect(detail?.marginFees.map((fee) => fee.name)).toEqual(["Profit"]);
});
```

- The same file then grows, in EXECUTE:
  - `listPricing` returns the AC-0064 fixture in group and code order, and each row's numbers equal the pricing view's;
  - `getPricingDetail` returns null for an unknown code, a raw product's code, and an inactive product's code (construction for AC-0085), and the raw input's code and description;
  - `listWhatIfRawProducts` returns only active raw products feeding an active finished product, in code order (construction for AC-0120 and AC-0129);
  - `runWhatIf` returns the AC-0020 numbers;
  - `setTargetMargin` and `setListPrice` throw an `RpcError` whose `changeFailureMessage` is the AC-0116 text for a product made inactive, and the AC-0118 text for the AC-0118 product id, pinning the T3 rule to the functions' wording.

**Approach:**
- Write the reads like `src/lib/production.ts`: throw on error and return rows as delivered; order through `.order()` on view columns only.

**Done when:** the T4 tests are green, with `assertLedgerInvariants` passing after each test.

### T5: The change actions' decisions return the right state for every branch

**Depends on:** T3, T4

**Touches:** `src/app/pricing/save-change.ts`, `src/app/pricing/actions.ts`, `src/app/pricing/form-fields.ts`, `src/lib/failures.ts`, `test/save-change.test.ts`

**Tests:**
- `test/save-change.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0117: a refusal from the write because the caller is not an operator" (AC-0117). sha256 `6dec9c24eaa5d539390e8703c3a38297a918dc5315e468fb43f5575984a0e5d1`.

```ts
import { expect, it } from "vitest";
import { decideChange, type ChangeDeps } from "../src/app/pricing/save-change.js";
import { RpcError } from "../src/lib/rpc.js";

// STUB: AC-0117
it("AC-0117: a refusal from the write because the caller is not an operator", async () => {
  const deps: ChangeDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    write: async () => {
      throw new RpcError("setListPrice failed: set_list_price: not allowed (caller is not an operator)", "42501");
    },
  };
  expect(await decideChange({ kind: "list-price", productId: "33333333-3333-3333-3333-333333333333", value: "3.29" }, deps)).toEqual({
    status: "refused",
    message: "The change wasn't saved. This account isn't allowed to use Meat Ops.",
  });
});
```

- The same file then grows, in EXECUTE, with each call passed in as a fake: the caller check ends, refuses, or fails, and no write is called (AC-0110, AC-0113, and AC-0003's shape); a form-rule refusal returns field errors and no write is called (AC-0112's shape); the write throws with no code (AC-0114); the write throws another engine refusal (AC-0118); the write returns and the state carries the stored row for the AC-0068, AC-0092, AC-0094, and AC-0102 messages.

**Approach:**
- `decideChange` holds the branch logic and logs one `actionFailureLogLine` per failure, with `ReceivingAction` widened to name the three change actions. `actions.ts` passes `checkCaller`, the T3 rule, and the T4 write, and revalidates `/pricing` after a write that returned.

**Done when:** the T5 tests are green and `npm run typecheck` exits 0.

### T6: The pricing list, Apply, the what-if, and Receiving's price work in the browser

**Depends on:** T5

**Touches:** `src/app/pricing/*.tsx`, `src/app/pricing/page.tsx`, `test/e2e/pricing.spec.ts`, `test/e2e/pricing-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/pricing.spec.ts`, signed in as the operator, with fixtures written through `pg`:
  - access and navigation: AC-0001 and AC-0002 for `/pricing`; AC-0004 and AC-0005 on `/pricing`; AC-0006 for `/pricing`; AC-0003 with replayed Apply requests with no session and with a non-operator session, checked through `pg`;
  - the list: AC-0060, AC-0061, AC-0062, AC-0074, AC-0075, AC-0076, AC-0063, AC-0077, AC-0078, AC-0064 (with a Lower and a Set row among the products that are not below target), AC-0065 (all four rows), AC-0066, AC-0067 (a new RAW-TOM receipt written through `pg` after the page loads and before the press), AC-0068, AC-0069, AC-0070, AC-0071, AC-0072 (the stored price read through `pg` after both loads);
  - Receiving: AC-0073, through the receiving page helpers;
  - an Apply on a product made inactive through `pg` after the load, showing the AC-0116 message on the list (page state "the pricing list after a change refusal");
  - AC-0118 with a replayed list price save for the AC-0118 product id, and AC-0112 for it through `pg`; AC-0109 with a replayed Apply request under a non-operator's session;
  - the what-if: AC-0120, AC-0129, AC-0121, AC-0143, AC-0122, AC-0123 (each row), AC-0124, AC-0125 (including the `<b>9</b>` code, checked by its text and by the absence of a `b` element);
  - keyboard and focus: AC-0133 for an AC-0066 button and Show prices, AC-0134 after Apply, AC-0135 and AC-0136 after an AC-0123 refusal;
  - `checkPageState` with no findings in the pricing list with all three groups, after a list price save, after a change refusal, with no active finished product, the what-if results, after an AC-0123 refusal, for an AC-0125 code, and on the non-operator page: AC-0130, AC-0131, AC-0132, AC-0139, AC-0141 for those states.

**Approach:**
- Build the page, list, advice block, and what-if on the production page's patterns and the design above.

**Done when:** `npm test` exits 0.

### T7: A product's detail shows its build-up and saves its target and list price

**Depends on:** T6

**Touches:** `src/app/pricing/*.tsx`, `test/e2e/pricing.spec.ts`, `test/e2e/pricing-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/pricing.spec.ts`:
  - the detail: AC-0080, AC-0081, AC-0082, AC-0083, AC-0084, AC-0085 (including the `<b>9</b>` code, checked by its text and by the absence of a `b` element);
  - the target: AC-0090, AC-0091 (each row), AC-0092, AC-0093, AC-0094;
  - the list price: AC-0100, AC-0101 (each row), AC-0102;
  - AC-0003 with replayed target-save, target-removal, and list-price-save requests with no session and with a non-operator session, checked through `pg`;
  - refusals and failures: AC-0110 (the session ended through the receiving tests' helper), AC-0116 (the product made inactive through `pg` after the load), and AC-0115 (a request-dropping helper in `test/e2e/pricing-page.ts` like production's); AC-0111 after each and after the AC-0091 and AC-0101 refusals; AC-0112 for the AC-0091, AC-0101, AC-0110, and AC-0116 cases through `pg`;
  - keyboard and focus: AC-0133 for Save target, Remove target margin, and Save price; AC-0134, AC-0135, AC-0136, AC-0137, AC-0138;
  - `checkPageState` with no findings in a detail with a target, with none, after each field refusal, after a target save, after a target removal, after a list price save, after an AC-0116 refusal, after an AC-0115 failure, and on the not-active-product detail: AC-0130, AC-0131, AC-0132, AC-0139, AC-0141 for those states.

**Approach:**
- Build the detail and the two forms; both forms post to the T5 actions.

**Done when:** `npm test` exits 0.

### T8: The docs match the code, the goal-based checks pass, and the stopped-service run is recorded

**Depends on:** T1, T2, T3, T4, T5, T6, T7

**Touches:** `docs/architecture/overview.md`, `docs/specs/menu-pricing/notes/verification-ledger.md`

**Tests:** no stub (mode): goal-based checks and a recorded manual run.
- The recorded run in the verification ledger, against `npm run start`:
  - with the local REST service stopped before a load of `/menu` and of `/pricing`: each error page, its text, its focus, and `checkPageState` on it (AC-0127, and AC-0130, AC-0131, AC-0132, AC-0139, AC-0141 for those states); then Try again after the restart (AC-0126);
  - with the REST service stopped after a detail loads: the AC-0113 message on Save target, every field's value (AC-0119), and the focused element (AC-0142);
  - with the app restarted after a detail loads and the local auth service then stopped, so the caller check's signing-key fetch gets no answer: the AC-0113 message on Save target, every field's value, and the focused element; the auth service is started again afterwards;
  - with the app's `SUPABASE_URL` pointed at a throwaway forwarder in scratch (not committed) in front of the local REST service, restored afterwards:
    - the forwarder holds a `set_list_price` call past the 10-second limit: the AC-0114 message, every field's value (AC-0119), and the focused element (AC-0142);
    - the forwarder holds a `set_target_margin` call while a `pg` session deletes the operator's `private.operators` row, then lets it through: the AC-0117 message, every field's value (AC-0119), the focused element (AC-0142), and a `pg` read showing no `products` row changed (AC-0128); the row is inserted back afterwards.
- Rendered-page inspection, per `frontend-engineering` GATES step 5, of `/menu`, `/pricing`, `/pricing?product=502`, and `/pricing?raw=RAW-TOM&cost=2.00` over the seeded fixture, at the narrow and wide fallback channels, each at the four required captures, with the five fields and the observations recorded in the ledger for the `frontend-reviewer`.
- The commands of AC-0150, AC-0151, AC-0152, AC-0153, AC-0154, AC-0155, AC-0156, AC-0157, AC-0158, AC-0159, and AC-0161, each with its exit code recorded in the ledger.

**Approach:**
- Edit the overview rows and sentences named in the spec's Durable Outputs row.

**Done when:** every check above is recorded as passing in the ledger.

## Rollout

- **Delivery:** one branch, `feat/menu-pricing`, merged after review. The migration only adds nullable columns with checks, two views' columns, and functions; reverting the code leaves them unused and harmless.
- **Infrastructure and external systems:** none. The app runs only against the local stack; the hosted project gets this migration only through the hosted rollout intent, with the owner's approval.
- **Deployment sequencing:** the migration before the code that reads it; `supabase migration up` runs first in T1.

## Risks

- **A replaced view loses `security_invoker`** (probe above). AC-0018 and `test/access.test.ts` catch it.
- **The price rule has two written copies.** AC-0022 turns red if they drift.
- **Receiving's prices move for a product with a target.** That is the owner's decision; Receiving's tests use 502 with no target and stay green, and AC-0073 checks the target case.
- **Shared modules and helpers.** `format.ts`, `failures.ts`, `views.ts`, `page-header.tsx`, and the floor pages' `FORM_CONTROLS` serve the floor pages too; their suites run in every gate.
- **The function texts are matched by wording.** A T4 test against real refusals turns red first if a function's text changes.
- **The framing headers apply to every page,** the floor pages included. Nothing in the app frames itself, and the browser suites run every page in the gate.

## Changelog

- 2026-10-09: initial plan.
- 2026-10-09: review round 1. The suggested price rounds up to the cent with a target (owner decision); products with no cost get a "No cost yet" group (owner decision); `test:costing` runs the pricing golden cases (owner decision). T1 now extends the access suite, T2 the floor pages' Tab-order lists, and T5 lists `failures.ts`; T4 depends on T3. The price rule is written in the view and in `price_what_if` rather than a shared helper, so `service_role` keeps reading the views; `price_what_if` runs as the caller. New criteria cover the round-up case, `service_role` view reads, what-if order, value limits for every writer, `search_path`, menu and picker order, the missing-value texts one by one, the stored list price after a receipt, Receiving's target price, the recorded not-allowed write, and the migration and `test:costing` greps. The T3 and T5 stub digests are recomputed and every stub is revalidated.
- 2026-10-09: review round 2. Every page refuses framing (owner decision); a what-if counts the typed cost as a cost (owner decision). The list price check refuses NaN; the view gains `needs_new_price` so the list orders below-target rows first whatever their action; the URL codes shown back are pinned as literal text; the caller check's non-operator and auth-lookup messages get criteria; the heading order and empty-heading rule split out; AC-0160 reads the catalog instead of grepping; the stub validation records its sandbox and the harness side effects.
