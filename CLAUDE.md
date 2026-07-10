# Meat Ops

Inventory, costing, and lot traceability for a meat processor.
Postgres schema is built and verified. This app layers on top of it.

## Commands
- Dev: npm run dev
- Test: npm test
- Costing golden tests: npm run test:costing
- Types: npm run typecheck
- Regenerate DB types: npm run gen:types
- Migrate: supabase db push

## Architecture
- Costing logic lives ONLY in the Postgres functions: receive_lot, produce_batch, record_sale.
- TypeScript never recomputes cost. It calls RPCs and reads views. There is no cost or inventory math in the app.
- Reads go through views: v_product_pricing, v_current_menu, v_sale_traceability.
- Two accountings on purpose: lots hold true cost and origin (traceability). inventory_balances holds the moving average (pricing). Keep them separate. Do not merge them into one number.

## Hard rules (do not violate)
- Never UPDATE lots.unit_cost after insert. Rising costs create NEW lots, they never overwrite old ones. A hook enforces this.
- Never write cost or inventory math in TypeScript.
- Never write directly to lots, inventory_balances, production_batches, finished_goods, or sale_items. Go through the Postgres functions.
- Every table needs an RLS policy before it ships. No table goes live open.
- Round every number that reaches the screen. The DB is exact numeric, JS float math is not.
- No em dashes in any copy, comments, or commit messages.

## Conventions
- TypeScript strict. No default exports.
- Generated DB types live in src/lib/database.types.ts. Regenerate after every migration.
- Supabase client and typed wrappers live in src/lib/.
- Commit format: feat/fix/chore(scope): description

## Definition of done (every phase)
- npm run test:costing is green. A red golden test is a hard stop.
- npm run typecheck passes.
- Commit at the green gate.

## Reference docs (read the one relevant to the task)
- docs/costing.md   the cost build-up and the seven golden invariants
- docs/build-plan.md the phased plan
- docs/rls.md       the RLS policy plan (Phase 6)

## Workflow
- Plan mode first on every phase. Show the plan before writing code.
- After any change to a migration, a Postgres function, or a data-layer wrapper, run the costing-verifier subagent before committing.
- One phase per session where possible. Clear context between phases.
