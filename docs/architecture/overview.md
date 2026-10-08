# Architecture Overview

Meat Ops keeps the business's costs, stock, and trace records in one Postgres
database. Only the signed-in owner reaches it, and only six database functions
change the ledger. The brief is [`SYSTEM-SPEC.md`](../../SYSTEM-SPEC.md). The
costing math and its golden numbers are in [`docs/costing.md`](../costing.md).

## Areas and change guidance

| Area | Responsibility | Change guidance |
| --- | --- | --- |
| `supabase/migrations/` | The schema, the six operations, the access rules, and the auth settings that go with them. `0001_init.sql` is the original schema. Later files harden it. | Add a new file for every change. Never edit `0001_init.sql`. Revoke the default privileges on each new table, view, and function, then grant back only what the access model below names. |
| `supabase/config.toml` | Local stack settings: sign-up off, 12-character minimum password. | Restart the local stack after a change (`supabase stop`, `supabase start`). |
| `supabase/seed.sql` | Demo catalog and data, loaded through psql as `postgres`. | Keep it loadable after `supabase db reset`. |
| `src/lib/` | Typed wrappers over the operations (`rpc.ts`), typed view reads (`views.ts`), and the client (`supabase.ts`). `database.types.ts` is generated. | No cost, price, shrink, average, or margin math here. Run `npm run gen:types` after a migration change. |
| `test/` | The suites run against the local stack: `costing.test.ts` (golden numbers), `engine.test.ts`, `corrections.test.ts`, `access.test.ts`, `env.test.ts`. `db.ts`, `users.ts`, `env.ts`, and `global-setup.ts` are the harness. | Run `npm test`. A red costing test stops the work. |
| `tools/hooks/` | Hook scripts from the agent bundle: a session-start knowledge print, a pre-pull-request check, and a per-prompt work-loop reminder. | Change only when the workflow changes. |
| `docs/specs/` | One folder per feature, each with a spec and a plan. | Follow the spec; update it when the work changes the contract. |

## Access model

Two groups of tables sit in `public`.

- **Ledger tables:** `lots`, `inventory_balances`, `production_batches`, `production_batch_lots`, `finished_goods`, `sales`, `sale_items`, `lot_adjustments`.
- **Master-data tables:** `vendors`, `customers`, `products`, `fee_types`, `product_fees`.

Every `public` table has row level security on. The three views
(`v_product_pricing`, `v_current_menu`, `v_sale_traceability`) run as the
caller, so they obey the same rules.

The operator allowlist is the table `private.operators`. It holds one row per
allowed user id. The `private` schema is not exposed through the Data API, so
no client can read or change the list.

| Role | Reads | Writes | Operations |
| --- | --- | --- | --- |
| `anon` (public key, no login) | Nothing. Tables and views are absent from the GraphQL schema and refused over REST. | Nothing. | Refused, `check_operator` included. |
| Non-operator (signed in, not on the allowlist) | 0 rows from every table and view. | Nothing. | Each call fails with SQLSTATE `42501` and writes no rows. `check_operator` fails the same way. |
| Operator (signed in, on the allowlist) | Every table and view. | Insert and update on master-data tables. No delete. No direct ledger write. | All six. `check_operator` succeeds. |
| `service_role` (admin key) | Every table and view. | Insert and update on master-data tables. No delete. No direct ledger write. | None. It holds no EXECUTE on any `public` function, `check_operator` included. |
| `postgres` (direct database session) | Everything. | Everything, including the seed script. | Allowed. A session with no JWT claims passes the caller check only for `postgres` and `supabase_admin`. |

`public.check_operator()` is not an operation and writes nothing. It returns
nothing for an operator and raises SQLSTATE `42501` for any other caller, so the
app can tell a signed-in user who is not on the allowlist from an operator whose
catalog is empty. It runs as the caller, asks `private.is_operator()` and nothing
else, and only `authenticated` can execute it. A `postgres` session has no JWT
user, so it gets the same `42501`.

The `service_role` master-data exception exists so admin tooling can load and
fix catalog data. It never deletes, and it never writes to a ledger table.

## Write path

The ledger changes only through six functions, `receive_lot`, `produce_batch`,
`record_sale`, `void_receipt`, `void_sale`, and `adjust_lot`. They run as
`SECURITY DEFINER`, so signed-in users need no write grant on any ledger table.
Running them as the caller instead would require ledger write policies, and those
would let the owner's session change ledger rows directly, outside the
operations. Each one:

1. Checks the caller first. A JWT must carry the `authenticated` role, and `private.is_operator()` must find its `sub` on `private.operators`. The table policies use the same function.
2. Validates its arguments and raises an error instead of writing a wrong row. This comes before any lock, except that a void or adjustment first looks up the lot or sale it names, to learn which row to lock. Checks that depend on stock or lot state, such as a shortfall or the adjustment cap, come after the lock.
3. Takes one row lock before it reads stock. `receive_lot`, `produce_batch`, `void_receipt`, and `adjust_lot` lock the raw product's `inventory_balances` row. `record_sale` and `void_sale` lock the finished product's `products` row (`FOR NO KEY UPDATE`, so the foreign-key checks in `produce_batch` do not wait on it). Calls that share a lock take turns. `produce_batch` and `record_sale` on one finished product share no lock and do not queue on each other; `record_sale` reads only finished lots that already exist, and each lot it draws from is row-locked.
4. Writes the rows. `produce_batch` and `record_sale` then check that the pounds they recorded equal the pounds asked for, and raise a shortfall if not.

`receive_lot`, `produce_batch`, `void_receipt`, and `adjust_lot` then rebuild the
raw product's stock and stock-on-hand average from its lots (`private.refresh_balance`).
`record_sale` and `void_sale` move only finished-lot pounds and do not call it.

A trigger on `lots` refuses any change to a lot's cost, weight, product, vendor,
received date, lot number, or prior average, for every role. The operations
change only a lot's remaining lbs and its void marks.

### Insertion order and the hosted check

Lots and finished lots carry an insertion number, `receipt_seq` and
`produced_seq`. First-in first-out orders by date, then by that number. The
engine migration numbers rows that already exist by the old keys (lots by
received date, `created_at`, id; finished lots by produced date, id) before
identity takes over, and the sequence continues above the highest number given.

After the migrations reach a database that already holds lots (the hosted
follow-on), run this read-only query. It must return no rows. Each row it
returns is a pair of same-day lots of one product whose insertion numbers
disagree with their `created_at` order:

```sql
select a.product_id, a.received_date, a.id as lower_number, b.id as higher_number
from public.lots a
join public.lots b
  on b.product_id = a.product_id
 and b.received_date = a.received_date
 and b.receipt_seq > a.receipt_seq
 and b.created_at < a.created_at;
```

Finished lots have no timestamp, and their old order broke ties by id, so the
query covers lots only.

## Create the owner account

Public sign-up is off, so the owner account is made by hand. Until step 3, the
owner is locked out, which is the safe state.

1. In Supabase Studio, open Authentication, then Users, and add a user with the owner's email and a password of at least 12 characters.
2. Confirm the account is new. Run `select id, created_at, last_sign_in_at from auth.users where email = '<owner email>';` and `select count(*) from auth.sessions where user_id = '<id>';`. The user was created minutes ago, `last_sign_in_at` is empty, and the session count is 0. Stop if either differs, because the account is not the one you just made.
3. Insert the id: `insert into private.operators(user_id) values ('<id>');`

Run the steps against the local stack first. A hosted project needs the owner's
approval before anything writes to it.
