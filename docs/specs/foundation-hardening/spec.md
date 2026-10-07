# Spec: foundation-hardening

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §2 (deterministic engine), §6 (costing invariants), and §11 (boundaries). This spec departs from the brief by owner decision on 2026-10-07 and amends it; the Master brief row of Durable Outputs lists the amended sections.
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the operations and views are consumed only by `src/lib/` in this repository; no published interface)
- **Shape:** data

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round.

## Objective

The owner of a meat processing business trusts this database to hold the
business's true costs, stock, and trace records. The costing engine is reachable
only through the owner's own login. It refuses any change that would make a
cost, a stock count, or a trace record wrong, including entries that arrive at
the same moment. The owner can void a receipt nothing has touched yet, void a
wrong sale, and set a lot's remaining pounds to a counted value, without breaking
the books. Pricing reads the true average cost of the meat still on hand. The
test suite proves each of these through the same signed-in path the app uses, so
the Receiving screen (SYSTEM-SPEC §13 feature 2) builds on a foundation that
cannot be bypassed.

Terms used below:

- **Operator:** a signed-in user whose id is on the operator allowlist. The owner is the only operator.
- **Operator allowlist:** the list of user ids allowed in. It lives in a schema the Data API does not expose.
- **Ledger tables:** `lots`, `inventory_balances`, `production_batches`, `production_batch_lots`, `finished_goods`, `sales`, `sale_items`, `lot_adjustments`.
- **Master-data tables:** `vendors`, `customers`, `products`, `fee_types`, `product_fees`.
- **Operations:** `receive_lot`, `produce_batch`, `record_sale`, `void_receipt`, `void_sale`, `adjust_lot`.
- **Stock-on-hand average:** for one raw product, the sum of `remaining_lbs × unit_cost` over its lots divided by the sum of their `remaining_lbs`, rounded to 4 decimals.
- **Consumed lbs of a lot:** the sum of `lbs_consumed` over the lot's `production_batch_lots` rows.
- **Void reason:** text with at least one non-space character.
- **Prior average of a lot:** the raw product's `moving_avg_cost` just before that lot was received.
- **Roles:** `anon` (public key, no login), non-operator (signed in, not on the allowlist), operator, `service_role` (admin key), `postgres` (direct database session).

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Costing reference (current product truth) | Applicable: the average rule, the zero-stock rule, the corrections, and the golden numbers are the costing contract the tests encode | `docs/costing.md` (restored from commit `2e320a5`, updated; the 2.74 example is dropped) | jaketlee07 | Each figure the file states as an expected result is asserted by `test/costing.test.ts`, `test/engine.test.ts`, or `test/corrections.test.ts`; inputs and derivation steps are exempt | close-work finds each expected-result figure in a passing assertion in one of those three files |
| Master brief (current product truth) | Applicable: SYSTEM-SPEC contradicts this spec in five places until amended | `SYSTEM-SPEC.md` §4, §5, §10, §11, §13 item 1 | jaketlee07 | §4 lists the new fields and `lot_adjustments`; §5 and §11 name the six operations and §5 describes each; §11's list of tables written only through the operations includes `lot_adjustments`; §4's `v_sale_traceability` entry names the customer and sale-line columns and excludes void sales; §10 lists the owner login as in scope; §13 item 1 names six operations | close-work confirms those sections and no others changed |
| Architecture and access model | Applicable: who can read, who can write, and how the owner account is created are not inferable from one file | `docs/architecture/overview.md` (template replaced) | jaketlee07 | Overview names the allowlist, the write path per role, the `service_role` master-data exception (insert and update, no delete), and the owner-account steps, which set a password of at least 12 characters and confirm the allowlisted id is the account just created for the owner, with no earlier sessions | close-work confirms the steps match the allowlist table in the migrations |
| Agent guidance and project rules | Applicable: `AGENTS.md` is an unfilled template and the project's rules exist nowhere | `AGENTS.md` | jaketlee07 | AC-0047, AC-0048, AC-0049 pass; a "Hard rules" section states each rule in the closed list below | close-work confirms each listed rule is present |
| Interface compatibility | Applicable: new operations and view columns change the generated types | `src/lib/database.types.ts`, `src/lib/rpc.ts`, `src/lib/views.ts` | jaketlee07 | AC-0046 passes | `npm run typecheck` passes on the closing commit |
| Release history | Not applicable: nothing is released; `docs/product/changelog.md` has no versioned artifact | none | — | — | — |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; each decision lives in the file that owns its rule | none | — | — | — |

Hard rules carried into `AGENTS.md` (closed list):

1. Follow every boundary in SYSTEM-SPEC §11, as amended by this spec; link it rather than restating it.
2. Every `public` table has RLS and explicit grants before it ships.
3. Round every number that reaches the screen; the database is exact and JavaScript numbers are not.
4. No em dashes in copy, comments, or commit messages.
5. Commit messages use `type(scope): description`.
6. After any change to a migration, a database function, or `src/lib/`, run `npm test`; a red costing test stops the work.
7. Schema changes go through `supabase/migrations/` and the local stack; nothing writes to the hosted project without the owner's approval.

## Boundaries

### Always do

- Put every schema and function change in a new file under `supabase/migrations/`.
- In every migration, revoke `anon`, `authenticated`, `service_role`, and `PUBLIC` access on each new table, view, and function, then grant back only what the access model in `plan.md` names.
- Run `npm run typecheck` and `npm test` after each task; a red test stops the work until it is green.
- Regenerate `src/lib/database.types.ts` with `npm run gen:types` after each migration change.

### Ask first

- Changing any numeric expectation asserted in `test/costing.test.ts`, or a golden case in AC-0028, AC-0029, or AC-0053.
- Any write to the hosted Supabase project: `supabase db push`, an MCP write tool, or a dashboard setting.
- Editing `SYSTEM-SPEC.md` beyond the sections the Master brief row of Durable Outputs lists.

### Never do

- Add an npm dependency, a new top-level directory, or an application framework.
- Compute cost, price, shrink, average, or margin in TypeScript.
- Write to a ledger table from `src/` or `test/` except through an operation. Exceptions: test setup may truncate tables and insert master data and allowlist rows, and a test may attempt a direct write that a criterion requires to be refused.
- Edit `supabase/migrations/0001_init.sql`.

## Testing Strategy

Every TDD test runs under `npm test` against the local Supabase stack. The
channel depends on the role a test needs:

- Role-named access checks use supabase-js (REST) and `fetch` (GraphQL) with that role's key or session.
- Operation and view behavior uses a supabase-js client signed in as an operator.
- Calls that must overlap, calls that must share one transaction, and inputs JSON cannot carry (NaN) use `pg` sessions that take the `authenticated` role with the operator's JWT claims, so they pass the same caller check as the app.
- The `postgres` role uses a plain `pg` session.
- Raw-table reads for assertions use `pg`.

Groups:

- **TDD: access control (AC-0001, AC-0002, AC-0003, AC-0052, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0055, AC-0009, AC-0010, AC-0011)** — the access model is a rule per role and per object, so a test per role over the full catalog catches one missed grant.
- **TDD: engine correctness (AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0054, AC-0032, AC-0033)** — each rule is an invariant with a fixed input that a wrong engine fails.
- **TDD: corrections and trace (AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0039, AC-0053, AC-0040, AC-0041)** — each correction has an exact before and after state of stock, average, and trace.
- **TDD: test-harness safety (AC-0042)** — a unit test of the URL guard, with no database contact.
- **Goal-based: build and guidance checks (AC-0043, AC-0044, AC-0045, AC-0046, AC-0047, AC-0048, AC-0049, AC-0050, AC-0051)** — each is settled by one command: a grep, a JSON read, a catalog query, a psql load, the Supabase security advisor, or a type regeneration diff.

## Acceptance Criteria

Access

- [x] **AC-0001.** With only the anon key, every `public` table and view is unreadable through both REST (permission error) and GraphQL (no field or type for it), and every `public` function returns a permission error through REST. The object list comes from the database catalog at test time.
- [x] **AC-0002.** Signed in as a non-operator, every `public` table and view returns a permission error or 0 rows, while each returns at least 1 row to `postgres`.
- [x] **AC-0003.** Signed in as a non-operator, every `public` function listed from the catalog at test time returns SQLSTATE `42501` and writes no rows; each operation is called with arguments that succeed for an operator in the same state.
- [x] **AC-0052.** `service_role` holds no EXECUTE privilege on any `public` function listed from the catalog at test time.
- [x] **AC-0004.** While every `public` table and view returns at least 1 row to `postgres`, an operator reads at least 1 row from each.
- [x] **AC-0005.** Each operation succeeds for an operator when called with arguments valid in the current state.
- [x] **AC-0006.** A direct insert, update, or delete on any ledger table is refused for each of anon, non-operator, operator, and `service_role`, and the table is unchanged afterwards.
- [x] **AC-0007.** A direct insert, update, or delete on any master-data table is refused or changes no rows for anon and for a non-operator, and the table is unchanged afterwards.
- [x] **AC-0008.** An operator can insert and update rows in every master-data table.
- [x] **AC-0055.** With the `service_role` key, an insert and an update on each master-data table succeed, and a `pg` read sees the change.
- [x] **AC-0009.** A direct delete on any master-data table is refused for the operator and for `service_role`, and the row still exists afterwards.
- [x] **AC-0010.** A sign-up request to the local auth server with a new email is refused and creates no user.
- [x] **AC-0011.** An operator's request to set an 11-character password is refused, and a request to set a 12-character password succeeds.

Engine

- [x] **AC-0012.** In a default session of each role (anon, non-operator, operator, `service_role`, `postgres`), an `UPDATE` that changes any of `unit_cost`, `weight_lbs`, `product_id`, `vendor_id`, `received_date`, `lot_number`, or `prior_avg_cost` on an existing lot is refused, and the lot is unchanged. Disabling the trigger is outside this claim.
- [x] **AC-0013.** Two `produce_batch` calls started together that draw on the same raw product, including two different finished products made from it, where each call fits the raw on hand alone but both together do not: exactly one succeeds, the other fails with a shortfall error, and `qty_on_hand` never goes below 0.
- [x] **AC-0014.** Two `record_sale` calls started together for the same finished product, where each fits the finished stock alone but both together do not: exactly one succeeds and the other fails with a shortfall error.
- [x] **AC-0015.** For every unordered pair, including a pair of the same operation, drawn from {`receive_lot`, `produce_batch`, `void_receipt`, `adjust_lot`} acting on one raw product and its lots, and from {`produce_batch`, `record_sale`, `void_sale`} acting on one finished product and its sales, when both calls start together and each would succeed alone, the invariants in AC-0028, AC-0030, AC-0031, AC-0054, AC-0032, and AC-0033 hold afterwards.
- [x] **AC-0016.** When two calls start together and the first to finish removes the other's precondition (two `void_sale` calls on one sale; two `void_receipt` calls on one lot; `void_receipt` and `adjust_lot` on one lot; `void_receipt` and a `produce_batch` that can draw only from that lot; `produce_batch` and an `adjust_lot` on a lot the batch draws from, whose new value fits the lot's cap only before that consumption), exactly one call succeeds.
- [x] **AC-0017.** Every successful `produce_batch` records consumed lot lbs summing to exactly its `raw_lbs_in`, and every successful `record_sale` records sale lines summing to exactly its requested lbs.
- [x] **AC-0018.** Each of `receive_lot` (weight), `produce_batch` (raw lbs in), and `record_sale` (lbs) refuses a NULL, NaN, zero, or negative quantity and writes no rows. The same call with a positive quantity succeeds.
- [x] **AC-0019.** Each of `receive_lot` (unit cost) and `record_sale` (price per lb) refuses a NULL, NaN, or negative amount and writes no rows. The same call with an amount of exactly 0 succeeds.
- [x] **AC-0020.** `produce_batch` with a NULL measured yield records `raw_lbs_in × (1 − shrink_pct)`, rounded to 3 decimals, as finished lbs.
- [x] **AC-0021.** `produce_batch` with a measured yield above 0 and at most `raw_lbs_in` records that yield as finished lbs, and one that is NaN, 0 or below, or above `raw_lbs_in` is refused.
- [x] **AC-0022.** `receive_lot` with a NULL or unknown vendor is refused and writes no rows.
- [x] **AC-0023.** `receive_lot`, `produce_batch`, and `record_sale` each refuse an inactive product.
- [x] **AC-0024.** `produce_batch` refuses a finished product whose raw input is inactive.
- [x] **AC-0025.** `receive_lot` refuses a product that is not raw, and `produce_batch` and `record_sale` each refuse a product that is not finished.
- [x] **AC-0026.** `produce_batch` consumes only lots received on or before its production date, and `record_sale` consumes only finished goods produced on or before its sale date; each fails with a shortfall when those are not enough.
- [x] **AC-0027.** Lots that share a received date are consumed in the order they were received, and finished goods that share a produced date are sold in the order they were produced, including two lots received in one transaction and two batches produced in one transaction.
- [x] **AC-0028.** After any operation that leaves a raw product with more than 0 lbs on hand, its `moving_avg_cost` equals its stock-on-hand average. Golden case: receive 5,000 lbs at 1.68 and 3,000 lbs at 1.80, produce 5,000 raw lbs, and the average is 1.8000.
- [x] **AC-0029.** When an operation other than `void_receipt` leaves a raw product with 0 lbs on hand, its `moving_avg_cost` keeps the value it had before that operation. Golden case: receive 1,000 lbs at 2.00, produce 1,000 raw lbs, and the average stays 2.0000.
- [x] **AC-0030.** After any operation, each raw product's `qty_on_hand` equals the sum of its lots' `remaining_lbs`.
- [x] **AC-0031.** After any operation, each non-void lot's remaining lbs equals its received weight minus its consumed lbs minus the sum of old lbs minus new lbs over its adjustment rows.
- [x] **AC-0054.** After any operation, each non-void lot's remaining lbs is at most its received weight minus its consumed lbs.
- [x] **AC-0032.** After any operation, each finished lot's remaining lbs equals its produced lbs minus the lbs on non-void sale lines drawn from it.
- [x] **AC-0033.** After any operation, no void lot has a consumption row or an adjustment row.

Corrections and trace

- [x] **AC-0034.** `void_receipt` with a void reason, on a lot with no consumption, no adjustment row, and remaining lbs equal to its received weight, leaves the lot marked void with that reason and a timestamp, its remaining lbs at 0, and its product's `qty_on_hand` lower by the lot's weight.
- [x] **AC-0035.** `void_receipt` on a lot with any consumption, with any adjustment row, with remaining lbs different from its received weight, or already void, or with a NULL reason or one that has no non-space character, is refused and changes nothing.
- [x] **AC-0036.** `void_sale` with a void reason leaves the sale marked void with that reason and a timestamp, each of its lines' lbs back on the finished lot the line came from, and the sale absent from `v_sale_traceability`.
- [x] **AC-0037.** `void_sale` on a sale already void, or with a NULL reason or one that has no non-space character, is refused and changes nothing.
- [x] **AC-0038.** `adjust_lot` on a non-void lot with a new remaining lbs from 0 up to the lot's received weight minus its consumed lbs sets the lot's remaining lbs to that value, records one adjustment row with the old lbs, new lbs, and reason, and leaves `unit_cost` unchanged.
- [x] **AC-0039.** `adjust_lot` with a new remaining lbs that is NULL, NaN, below 0, or above the lot's received weight minus its consumed lbs, on a void lot, or with a reason other than `count`, `waste`, `spoilage`, or `other`, is refused and changes nothing.
- [x] **AC-0053.** When `void_receipt` leaves a raw product with 0 lbs on hand, its `moving_avg_cost` becomes the prior average of the first lot, in FIFO order, among the product's void lots that come after its last non-void lot in FIFO order (among all its lots when none is non-void). Golden cases: with 0 lbs on hand at an average of 1.8000, receive 1,000 lbs at 18.00, void it, and the average is 1.8000; receive two lots of 1,000 lbs at 18.00, void both in either order, and the average is 1.8000.
- [x] **AC-0040.** For a batch that draws from two lots and a sale that draws from two finished lots, a trace read filtered by either lot's number returns that sale and its customer name.
- [x] **AC-0041.** The count of distinct sale lines in `v_sale_traceability` equals the count of sale lines on non-void sales, including a sale that draws from two finished lots and a sale with no customer.

Test-harness safety

- [x] **AC-0042.** The test environment resolver throws before returning any connection detail when the host the database driver or the API client would connect to is anything other than `127.0.0.1` or `localhost`, including a URL whose query string overrides the host or whose host is empty.

Build and guidance

- [x] **AC-0043.** None of `test/costing.test.ts`, `test/engine.test.ts`, or `test/corrections.test.ts` contains `serviceRoleKey`, `SERVICE_ROLE_KEY`, `createTypedClient`, or `createClient`.
- [x] **AC-0044.** After all migrations apply, no function named `reset_test_data` exists in the database.
- [x] **AC-0045.** After all migrations apply onto a freshly reset database (`supabase db reset`), loading `supabase/seed.sql` through psql as `postgres` with `ON_ERROR_STOP=1` succeeds.
- [x] **AC-0046.** Running `npm run gen:types` leaves `src/lib/database.types.ts` with no diff.
- [x] **AC-0047.** `AGENTS.md` contains none of the six bundle placeholders `<project-name>`, `<one-line description of what it does and for whom>`, `<install command>`, `<test command>`, `<lint command>`, `<build command>`.
- [x] **AC-0048.** `AGENTS.md` links both `SYSTEM-SPEC.md` and `docs/costing.md` as Markdown link targets.
- [x] **AC-0049.** Every Markdown link target, every backticked repository-relative path (one containing `/` or ending in `.md`, `.ts`, `.sql`, `.toml`, or `.json`), and every bare token starting with `docs/`, `src/`, `test/`, `supabase/`, or `.claude/` in `AGENTS.md`, `test/*.ts` comments, `.claude/agents/costing-verifier.md`, and `.claude/skills/verify-costing/SKILL.md` exists. Module import specifiers are not citations, and `CONTRIBUTING.md` and `AGENTS.local.md`, which the bundle text names only as optional files, are exempt.
- [x] **AC-0050.** No path or file content under `.claude/` contains `guard-lot-cost`, and every `supabase` command in the `permissions.allow` list of `.claude/settings.json` is an exact command with no wildcard.
- [x] **AC-0051.** `supabase db advisors --local --type security --fail-on warn` exits 0.

## Follow-ons

- jaketlee07: hosted Supabase project. Turn off public sign-up, set the minimum password length to 12, decide MFA for the owner, and apply every migration the hosted project lacks, in file order. Create the owner account with a password of at least 12 characters and confirm it is new, with no earlier sessions, before inserting its id into the allowlist. Then run a read-only check that the anon key and a signed-in non-operator reach nothing, and that `reset_test_data` is absent. No real business data goes into the hosted project before that check passes.
- jaketlee07: public repository and seed data. Decide whether `supabase/seed.sql` holds real business names and prices before loading the real catalog.
- jaketlee07: zero-stock average after voids. Replace the AC-0053 rule with a recompute of the average from the non-void lots alone, so a voided receipt can never set the zero-stock average and void order never matters (owner decision 2026-10-07; see the known limit in `docs/costing.md`).
- jaketlee07: corrections beyond this spec. A receipt whose cost or weight is found wrong after production used it cannot be corrected, and a production batch cannot be reversed. Both need their own spec.

## Assumptions

- Technical: local stack is Postgres 17.6 and supabase-js 2.110.1, which supports admin user creation and password sign-in (source: probe `select current_setting('server_version')`; `node_modules/@supabase/supabase-js/package.json`)
- Technical: Supabase default privileges grant `anon`, `authenticated`, and `service_role` full rights on new tables and EXECUTE on new functions in `public` (source: probe of `pg_default_acl`, 2026-10-07)
- Technical: public sign-up is on, email confirmation is off, and the minimum password length is 6 in local config (source: `supabase/config.toml` `[auth] enable_signup`, `minimum_password_length`, `[auth.email] enable_signup`, `enable_confirmations`)
- Technical: the GraphQL endpoint is live for the anon key and exposes `public` tables (source: probe `POST /graphql/v1` with the anon key, 2026-10-07, returned a field error naming type `lots`)
- Technical: only migration 0001 is applied locally, and the hosted project's state is unknown, so changes ship as new migrations (source: probe `supabase_migrations.schema_migrations`, 2026-10-07)
- Technical: `supabase/seed.sql` runs through psql as `postgres` with no login (source: `supabase/config.toml` `[db.seed]` comment)
- Technical: the lot-cost hook blocks writing a test that contains the literal unit-cost update, and denies every tool call when the shell is not at the repository root (source: hook probes, 2026-10-07)
- Product: the owner is identified by an operator allowlist checked by every rule and operation, with public sign-up off; the owner account is created by hand (source: user confirmation 2026-10-07)
- Product: average cost is the stock-on-hand average; at zero stock it keeps its last value, except after a void that leaves zero stock (source: user confirmation 2026-10-07)
- Product: voids mark rows void with a reason and time and never delete them; a receipt can be voided only while nothing has consumed or adjusted it (source: user confirmation 2026-10-07)
- Product: an adjustment sets remaining lbs between 0 and the received weight minus consumed lbs, with reason count, waste, spoilage, or other (source: user confirmation 2026-10-07)
- Product: the owner inserts and updates master data directly; nothing is deleted; products are deactivated instead (source: user confirmation 2026-10-07)
- Product: `service_role` has no direct write access to ledger tables and no EXECUTE on operations; it may insert and update master data but never delete (source: user confirmation 2026-10-07)
- Product: owner passwords need at least 12 characters, locally and in the hosted project; MFA is decided in the hosted follow-on (source: user confirmation 2026-10-07)
- Process: the lot-cost hook is removed because the database trigger is the guard; `docs/costing.md` is restored as the costing reference; SYSTEM-SPEC is amended in this work in the sections the Master brief row lists (source: user confirmation 2026-10-07)
- Product: when `void_receipt` leaves zero stock, the average becomes what it would be had the voided receipts never been entered, whatever order they were voided in (source: user confirmation 2026-10-07)
- Process: the owner approves the spec and the plan in chat, and the agent records the Approved status (source: user confirmation 2026-10-07)
