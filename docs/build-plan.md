# Build plan: meat processing inventory, costing and traceability

A Claude Code operating plan. The Postgres schema is built and verified, so this
plan is about layering the app on top without ever breaking the costing math.

## Where things stand

Done and validated end to end:

- Full schema: 12 tables, 3 functions (`receive_lot`, `produce_batch`, `record_sale`), 3 views (`v_product_pricing`, `v_current_menu`, `v_sale_traceability`).
- Costing ties out to the source pricing sheet ($1.68 raw at 23% shrink plus fees equals $2.68/lb).
- Moving average, FIFO consumption, and full trace-back all confirmed on seed data.

What remains is the application: a typed data layer, the operator screens, auth,
and RLS. That is what this plan covers.

## Stack

- Next.js (App Router) with TypeScript, strict mode.
- Supabase (Postgres, Auth, RLS) as the backend. The schema functions are the write path; the views are the read path.
- Tailwind for styling, kept minimal for the POC.
- Vitest for the costing test suite. Playwright optional later for the trace-back flow.

The app never recomputes costing in TypeScript. Every write goes through the
Postgres functions so the moving average and shrink logic live in exactly one
place. TypeScript only calls RPCs and reads views.

## The invariants (this is what Claude Code must never break)

These are the business rules that make or break the product. They get encoded as
tests before any UI is written, and a subset gets enforced as guardrails. Every
phase must leave them green.

1. Moving average: after receiving 5,000 lbs at $1.68 then 3,000 lbs at $1.80, the raw average is exactly $1.725/lb.
2. Pricing tie-out: one lot at $1.68, 23% shrink, fees of $0.05 + $0.03 + $0.37 plus $0.05 profit yields a $2.68/lb final price.
3. Shrinkage: 2,000 lbs raw at 23% produces 1,540 lbs finished.
4. Lot cost is immutable: `lots.unit_cost` is never updated after insert. Rising costs create new lots, they do not overwrite old ones.
5. Consumption is FIFO by `received_date`, and raw is drawn from real lots (specific identification), not from the average.
6. Conservation: `inventory_balances.qty_on_hand` equals `sum(lots.remaining_lbs)` per raw product, and finished `lbs_remaining` never exceeds `lbs_produced`.
7. Traceability: every `sale_item` resolves to at least one raw lot with a vendor and received date.

## Claude Code project setup (Phase 0)

Install the native binary and initialize the repo:

```
curl -fsSL https://claude.ai/install.sh | bash
cd meat-ops && claude
```

Then, in the first session:

- Run `/init` to generate a starter `CLAUDE.md`, then `/memory` to refine it toward the version below.
- Connect Supabase over MCP so Claude Code can run migrations and inspect the live DB:
  `claude mcp add --transport stdio supabase --env SUPABASE_ACCESS_TOKEN=... -- npx -y @supabase/mcp-server-supabase`
  (a direct Postgres MCP server also works if you prefer raw SQL access).
- Run `/permissions` to pre-approve routine commands (git status, npm test, type checks) so you are not approving every step.
- Define the subagents and guardrail hook described below.
- Set the model with `/model` (Sonnet 5 for most work) and raise `/effort` to high when working on costing logic or migrations.

### CLAUDE.md (keep it under ~200 lines)

Short, always-true rules. Task-specific detail goes in `docs/` and gets pulled in
per task, not dumped here.

```markdown
# Meat Ops

Inventory, costing, and lot traceability for a meat processor.

## Commands
- Dev: npm run dev
- Test: npm test          (costing golden tests must stay green)
- Types: npm run typecheck
- Migrate: supabase db push

## Architecture
- Costing logic lives ONLY in Postgres functions (receive_lot, produce_batch, record_sale).
- TypeScript never recomputes cost. It calls RPCs and reads views. No cost math in the app.
- Reads go through views: v_product_pricing, v_current_menu, v_sale_traceability.

## Hard rules (do not violate)
- Never UPDATE lots.unit_cost after insert. Rising costs create new lots.
- Never write cost or inventory math in TypeScript.
- Never bypass a Postgres function to write to lots, inventory_balances, finished_goods, or sale_items directly.
- Every table needs an RLS policy before it ships. No table goes live open.
- No em dashes in any copy or comments.

## Conventions
- TypeScript strict, no default exports.
- Generated DB types in src/lib/database.types.ts (regenerate after every migration).
- Commit format: feat/fix/chore(scope): description

## Reference docs (read the relevant one for the task)
- docs/costing.md    the cost build-up and the golden numbers
- docs/schema.md     table and view reference
- docs/rls.md        the RLS policy plan
```

### Guardrail hook

CLAUDE.md rules are followed most of the time, not always. For the one rule that
would corrupt historical cost, add a deterministic `PreToolUse` hook in
`.claude/settings.json` that blocks any Bash or SQL touching `UPDATE lots ... unit_cost`.
A hook that exits non-zero denies the call outright, so this is enforced at 100%,
not "usually." Keep hooks narrow: this one rule, not a wall of them. Everything
else stays in CLAUDE.md and the tests.

### Subagents (`.claude/agents/`)

Define a few specialists so the main session context stays clean:

- `costing-verifier` (read-only tools): runs the golden test suite and reports only failures with their expected-vs-actual numbers. Invoke it after any change to a migration or the data layer.
- `migration-writer`: drafts SQL migrations against the current schema, run in plan mode first so you approve the SQL before it executes.
- `explore` and `plan` are the built-ins: use Explore for "how does X work in this repo" and Plan mode for every phase kickoff so Claude scopes the change before writing code.

### A verify skill (`.claude/skills/verify-costing/SKILL.md`)

Wrap the regression check as an invocable command so you can run `/verify-costing`
after any risky change. It resets the seed, runs the functions, and asserts the
seven invariants above.

## Phased build

Each phase follows the same loop: enter plan mode, let Claude scope it, approve
the plan, implement, run `/verify-costing`, then commit. Run `/clear` between
phases to keep context fresh, and `/context` if a session gets long.

### Phase 1: data layer and golden tests

Goal: a typed, tested bridge to the schema before any UI exists.

- Apply the schema as the initial migration and load the seed.
- Generate DB types from Supabase into `src/lib/database.types.ts`.
- Write thin typed wrappers: `receiveLot`, `produceBatch`, `recordSale` (RPC calls) and `getPricing`, `getMenu`, `getTrace` (view reads).
- Encode invariants 1 through 7 as Vitest tests running against a seeded test database. These are the golden tests. They are the definition of done for every later phase.

Gate: all seven tests green, types compile.

Kickoff prompt: "Plan mode. Set up the Supabase client, generate DB types, and
write typed wrappers over the three RPCs and three views. Then write Vitest tests
encoding the seven invariants in docs/costing.md. Do not write cost math in TS,
only call the functions. Show me the plan before implementing."

### Phase 2: receiving screen

Goal: log an incoming purchase and watch the moving average update live.

- Form: product (raw), vendor, weight, unit cost, received date. Calls `receiveLot`.
- After submit, show the product's new `qty_on_hand` and `moving_avg_cost` from `inventory_balances`, plus the recomputed menu price from `v_product_pricing`, so the operator sees cost move in real time.
- Product code field prefills species and description from the products table (the "1234 is chicken" preset).

Gate: golden tests still green, receiving two lots at different prices shows the blended average.

### Phase 3: production screen

Goal: convert raw to finished with shrink and FIFO cost roll-up.

- Form: finished product, raw lbs in, optional measured finished lbs out. Calls `produceBatch`.
- Show the computed yield (raw times one minus shrink), which raw lots were consumed FIFO, the batch cost per finished lb, and the finished goods created.
- Surface a low-raw warning when a finished product's raw input is below a threshold.

Gate: 2,000 lbs at 23% yields 1,540 finished, cost pulled from the correct lots.

### Phase 4: menu and pricing

Goal: the auto-priced, availability-aware menu.

- Render `v_current_menu`: finished products, live price, sellable flag based on finished stock or available raw.
- A cost build-up view per product (the waterfall: raw, shrink uplift, processing, margin, final) reading `v_product_pricing`.
- Toggle to hide unsellable items, matching "create a menu from current inventory."

Gate: pulling raw stock to zero flips a product to not sellable.

### Phase 5: sales and trace-back (the demo centerpiece)

Goal: sell finished goods and trace any sale to its origin.

- Sale entry: customer, finished product, lbs, price. Calls `recordSale`, depletes finished goods FIFO.
- Trace view: pick a sale, render `v_sale_traceability` as the full chain (sale to finished lot to batch to raw lot to vendor, with dates and per-lot cost).
- Reverse trace: pick a lot, list every sale it touched (the recall query). This is the single most compelling thing to demo.

Gate: a sale resolves to its vendor, received date, and processing date in one view.

### Phase 6: auth, RLS, polish

Goal: make it safe to put in front of the owner.

- Supabase Auth (single operator role is fine for the POC).
- RLS policies on every table per docs/rls.md. Nothing ships open. This is the one Supabase gotcha: tables are unreadable through the client key until policies exist.
- Empty states, input validation, and error surfacing from the function exceptions (for example, "only 6,000 lbs raw available, need 8,000").

Gate: no table readable without a policy, golden tests green.

## Session discipline

- Plan mode first on every phase. Approve the plan before code. This is where Claude scopes the change and you catch a wrong turn cheaply.
- One phase per session where possible. `/clear` between phases. Long sessions drift and Claude deprioritizes early instructions.
- After anything that touches SQL or the data layer, run `/verify-costing` before you commit. Treat a red golden test as a hard stop.
- Commit at every green gate. Small commits make it easy to see where a regression entered.
- Use the `costing-verifier` subagent for test runs so the verbose output stays out of your main context and you get just the pass or fail.

## Testing strategy

The golden tests are the spine. They run the actual Postgres functions on a
seeded database and assert the exact numbers from the pricing sheet. Because the
math lives in the database, these tests cover the real logic, not a TypeScript
reimplementation of it. Add a conservation check that runs after every test
(qty_on_hand equals sum of remaining lot lbs) to catch any accounting drift.

## Risks and gotchas

- RLS lockout: the client key reads nothing until policies exist. Plan for it in Phase 6, do not discover it at demo time.
- Average versus lot cost: keep them separate on purpose. Batch cost uses the real lots consumed. Menu price uses the moving average. Do not let Claude "simplify" these into one number.
- Float drift in the UI: round every displayed number. The database is exact numeric, but JS float math leaks artifacts.
- Context drift in long Claude Code sessions: the fix is `/clear` and short focused sessions, not a longer CLAUDE.md.
- Rounding at the tie-out: the pricing view returns $2.6818 and rounds to $2.68. Assert on the rounded display value, not raw float equality.

## First session, copy-paste kickoff

```
/init
/model sonnet
/permissions            (approve: git, npm test, npm run typecheck, supabase)
Then: connect Supabase via MCP, refine CLAUDE.md to the version in BUILD_PLAN.md,
create the costing-verifier subagent and the UPDATE-lots guardrail hook, and set
up docs/costing.md with the seven invariants. Plan mode, show me the plan first.
```
