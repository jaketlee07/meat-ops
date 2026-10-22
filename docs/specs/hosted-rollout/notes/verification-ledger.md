# Verification ledger: hosted-rollout

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts sit under the ignored `.context/reviews/`: the first run's under
`4b1db886-2ed7-43ae-a17d-5bf637a7f11a/`, the current run's under
`58dd94a2-6c14-4bfc-8315-556211f7cb93/`. Entries name "the hosted project", "the
anon key", and "the developer's account"; ids are written `<developer id>`.
Times are America/Chicago.

## Approval (2026-10-21)

- The developer approved the spec and then the plan in chat on 2026-10-21, after spec-stage review came back clean.
- Work-loop run `58dd94a2-6c14-4bfc-8315-556211f7cb93`. `approve-plan` recorded spec hash `9c5b841a6959…` and plan hash `e9bba3d5011a…`. The schedule has five waves (T1 and T2, then T3, T4, T5, T6), run one task at a time.
- The first run, `4b1db886-2ed7-43ae-a17d-5bf637a7f11a`, recorded each spec-stage findings round with `review record`, which the pre-EXECUTE protocol does not call for and which spent 4 of the 5 review retries the code-review stage needs. With the developer's approval, both state files were reset and this run started on the same reviewed text.
- Base: `ea12ae0` on branch `chore/hosted-rollout`, on stack A, which only this folder uses. The spec and plan were committed as `6378482`.
- The controller runs each task itself rather than dispatching the implementer subagent: every task is a sequence of developer-approved hosted steps and read-only checks that the controller must hold approvals for in chat.
- Project knowledge: capture at the spec and plan gates was not attempted. It refused with `strict_parse` on 2026-10-20, so this run records it as unavailable.
- The developer gave a standing approval for this build to run the local Realtime slot fix before each full `npm test`, logged below each time.

## Spec-stage review

Six rounds, each after the first over the delta since the previous one. Counts are findings that survived adjudication (adversarial, security) or that the shaping reviewer raised.

| Round | Adversarial | Security | Shaping |
| ---: | --- | --- | --- |
| 1 | 12 sustained, 1 indeterminate settled by the developer | 5 sustained, 1 indeterminate settled by the developer | 11 |
| 2 | 11 | 2 | 4 |
| 3 | 8 | 4 | 4 |
| 4 | 4 | 4 | 4 |
| 5 | 1 Nit | 1 Nit | 2 |
| 6 | direct clean | clean (adjudicated: a Not checked footer only) | Clean |

- Pre-EXECUTE gates not fired: design-intent review (no page changes) and frontend pre-flight (no HTML, CSS, or JS output).

## T1: the local reference

- 13:18: the Realtime slot fix ran on stack A (standing approval): `pg_class` dead rows 406,374 before and 0 after; the slot was 82,615 transactions behind before and 1 after.
- The folder check listed no folder running tests or the app.
- `npm test` passed at `6378482`: Vitest 52 files and 1,039 tests, then the browser suite's 667 tests, exit 0, 670 seconds.
- `supabase migration list --local` shows exactly the 15 versions of the files in `supabase/migrations/`.
- The local dump (`supabase db dump --local -s public,private`) is 3,276 lines, sha256 `0e8dd1a26e0693d6e9a6026257f99f364cbbb3d740fab40379c5be0626e0fa75`. The object lists from stack A hold 23 tables and views, 3 sequences, and 20 functions in `public`. Both are kept in the session scratchpad, with copies for the reviewers in the ignored `.context/evidence/hosted-rollout/`.

## T2: sign-in settings

- The chat carries no clock times, so this ledger places each approval in the order of events rather than at a time.
- The controller named both sign-in settings in chat and asked the developer to make them. The developer made them in the dashboard, and that action is the approval of both writes, as the developer confirmed in chat. The developer reported them done before the AC-0001 check below.
- AC-0001, first check, 13:37:10 (18:37:10 UTC): `GET /auth/v1/settings` with the anon key returned `"disable_signup": true` (email provider on, mailer autoconfirm off). AC-0008 compares the developer's account's `created_at` against this time.
- AC-0002: the developer read the minimum password length in the dashboard as 12 and reported it in chat after the first AC-0001 check above and before approving the CLI login role, which came before `supabase link` at 13:47:48. So the reading falls between 13:37:10 and 13:47:48.

## T3: the engine on the hosted project

- The developer approved the CLI's temporary login role in chat before `supabase link` ran at 13:47:48. The link made no role (a read-only `pg_roles` read found no `cli_login%` role after it); the dry run printed "Initialising login role...".
- `supabase db push --dry-run` listed all 15 files in file order, `0001_init.sql` through `20261021005125_pricing_view_once.sql`. The developer saw the list and then approved the push in chat, before the two reads below.
- AC-0003, 18:59:29 UTC: `to_regclass('public.lots')` was null, so no table `public.lots` existed. AC-0004, 18:59:30 UTC: `to_regclass('private.operators')` was null. These two reads were the only hosted commands before the push.
- `supabase db push --yes` ran from 18:59:38 to 18:59:42 UTC (13:59 local), exit 0, and applied the 15 files in order. Its two notices were "extension \"pgcrypto\" already exists, skipping" (0001) and "function public.reset_test_data() does not exist, skipping" (access lockdown).
- AC-0005: a prefixed read of `supabase_migrations.schema_migrations` returned 15 versions, the same set as the 15 file versions.
- AC-0006: the hosted dump (`supabase db dump -s public,private`, 3,314 lines, sha256 `0fbe42b2069a44e69c184a23332984970bf49c8b419f394f57bbf6e9293b83d8`, made with the CLI's `postgres:17.6.1.141` image) has 446 paragraphs; the local reference has 443. The plan's comparison removed 3 hosted paragraphs (the `rls_auto_enable()` definition, its owner line, and its 3 grant lines) and printed `443 446 3 True`.
- AC-0007: no function named `reset_test_data` in any schema.
- AC-0018: `anon` and `authenticated` are not superusers, do not bypass row level security, and are members of no role.
- `public.products` holds 0 rows, so the alerts migration's baseline step had no list price to record.
- `supabase unlink` finished, and a fixed-string search of `supabase/.temp/` for the project reference matched no file.

## T4: the developer's account

- The developer approved making the developer's account in chat, then made it in the dashboard (Add user, Create new user, auto-confirmed) with the developer's personal email, and confirmed that order in chat. Supabase records the account as created at 19:03:22 UTC (14:03:22).
- AC-0008, 19:03:34 UTC: `auth.users` held exactly 1 user, created 19:03:22 UTC (later than the first AC-0001 check at 18:37:10 UTC), `last_sign_in_at` null, email confirmed; `auth.sessions` and `auth.refresh_tokens` held no row for it.
- AC-0009: after the AC-0008 read, the developer confirmed in chat that the account's password has at least 12 characters.
- The developer then approved the allowlist insert in chat. `insert into private.operators(user_id) values ('<developer id>')` ran through `execute_sql` at 19:14:43 UTC.
- AC-0010, first read: `auth.users` holds 1 user and `private.operators` holds 1 row, whose `user_id` is that user's id.

## T5: the access check

- AC-0001, second check, 19:15:07 UTC: `GET /auth/v1/settings` with the anon key returned `"disable_signup": true`.
- AC-0021: a read-only catalog query listed 23 tables and views, 3 sequences, and 21 functions in the hosted `public` schema. With `rls_auto_enable()` removed, the 46 names equal the 46 that T1 listed on stack A.
- AC-0011: `GET /rest/v1/<name>?select=*&limit=1` with the anon key, for each of the 23 tables and views, answered HTTP 401 with code `42501` and no rows, 23 of 23.
- AC-0012: across the 26 tables, views, and sequences in `public`, `anon` holds no table, column, or sequence privilege; of the 21 functions it may execute only `rls_auto_enable()`; it has no `USAGE` on schema `private`. A second read at 20:26:04 UTC, after review round 2, added `MAINTAIN` (a Postgres 17 table privilege the first read left out) and counted every access-list entry naming `anon` through `aclexplode`: 26 objects checked, none with any privilege for `anon`, no access-list entry naming `anon`, `rls_auto_enable()` the only function it may execute, and no `USAGE` on `private`.
- AC-0013: `POST /rest/v1/rpc/rls_auto_enable` with the anon key answered HTTP 400, code `0A000`, "cannot display a value of type event_trigger".
- AC-0014: the GraphQL introspection request answered `{"errors": [{"message": "pg_graphql extension is not enabled."}]}` with no schema data.
- AC-0015: a read-only query confirmed the made-up `sub` `00000000-0000-4000-8000-000000000001` is not in `private.operators`. Each of the 20 functions below, called in its own read-only batch as `authenticated` with that `sub`, failed with `42501` "<name>: not allowed (caller is not an operator)": adjust_lot, apply_alert_price, check_operator, confirm_import_draft, correct_receipt, create_import_draft, discard_import_draft, dismiss_alert, finish_digest, price_what_if, produce_batch, receive_lot, record_sale, refresh_alerts, reverse_batch, set_list_price, set_target_margin, start_digest, void_receipt, void_sale. Eighteen raised it from `private.assert_caller`; `check_operator` and `price_what_if` raised it from their own operator check.
- AC-0019: `public.check_operator()` returned without error in a read-only batch as `authenticated` with the `sub` of the one `private.operators` row.
- AC-0020: the 18 tables in the hosted `public` schema hold 0 rows in total.
- AC-0010, second read: `auth.users` holds 1 user, `private.operators` holds 1 row, and its `user_id` is that user's id.

## T6: documentation and clean-up

- AC-0022, 19:17:34 UTC: the one hosted role whose name starts with `cli_login`, `cli_login_postgres`, has `rolcanlogin` true and a `rolvaliduntil` of 19:05:02 UTC, earlier than the read, so it can no longer sign in.
- The eight sentence edits in T6 are made in `SYSTEM-SPEC.md` (§3, the MVP-users sentence, and §10), `AGENTS.md` (the project overview's users and meaning sentences, and hard rule 7), and `docs/architecture/overview.md` (the opening paragraph and the hosted-approval sentence). The overview gains "The hosted project" after "Create the owner account", and "Insertion order and the hosted check" no longer says "(the hosted follow-on)".
- `grep -n -E "only user|One person for the|beyond the single owner|signed-in owner reaches"` over the three files prints nothing; the new text of edits 1, 2, 3, 4, and 6 each contains "business owner" and "developer"; `AGENTS.md` holds edit 8's sentence once; hard rule 7 ends "without the developer's approval."; the overview's hosted-approval sentence names the developer; "hosted follow-on" no longer appears in the overview, which has one `## The hosted project` heading; no added line holds an em dash.
- AC-0016: a fixed-string search of `supabase/.temp/` for the project reference matched no file.
- `lint-spec-status.py --root .` exits 0.

## Final gates

- 14:19: the Realtime slot fix ran on stack A (standing approval): `pg_class` dead rows 101,550 before and 0 after; the slot was 12,466 transactions behind before and 1 after. The folder check listed no folder running tests or the app.
- `npm test` passed at `4dbbace`: Vitest 52 files and 1,039 tests, then the browser suite's 667 tests, exit 0, 667 seconds. `npm run typecheck` exits 0. The repository has no lint command.
- After the round-1 review fixes: the folder check listed no folder running tests or the app; 15:04, the Realtime slot fix ran again (101,550 dead `pg_class` rows to 0; the slot 11,777 transactions behind to 0); `npm run typecheck` exited 0; `npm test` passed at `f545fb3`: Vitest 52 files and 1,039 tests, then the browser suite's 667 tests, exit 0, 700 seconds.
- After the round-2 review fixes: the folder check listed no folder running tests or the app; 15:32, the Realtime slot fix ran again (101,550 dead `pg_class` rows to 0; the slot 11,008 transactions behind to 3); `npm run typecheck` exited 0; `npm test` passed at `2bd1a35`: Vitest 52 files and 1,039 tests, then the browser suite's 667 tests, exit 0, 700 seconds.
- After the round-3 review fixes, at `6bd0255` (two documentation lines no test reads): before the first run, the folder check listed no folder running tests or the app, and the 15:50 slot fix took `pg_class` dead rows from 101,550 to 0 and the slot from 10,585 transactions behind to 0. That `npm test` passed Vitest's 1,039 tests, but 9 of the browser suite's 667 failed and the run took 7,249 seconds, most as timeouts in `alerts.spec.ts`, `ask.spec.ts`, and `invoices.spec.ts`. After a folder check that listed no folder, `npm run test:e2e -- --last-failed` ran 11 tests: the 2 `auth.setup.ts` sign-in setup steps, which passed, and the 9 failed tests, of which 7 passed and 2 failed in different places than before (`alerts.spec.ts` AC-0090 "no answer within 60 seconds" and `invoices.spec.ts` AC-0081). At 17:57, just after the failing run ended, the Mac was overloaded: 1-minute load average 32, about 115 MB of memory free, heavy swapping, and Docker's VM near 400% CPU. With the developer's go-ahead to try again, the folder check listed no folder, the 18:02 slot fix found 0 dead rows and the slot 195 transactions behind and left 0 and 0, and `npm run typecheck` exited 0; `npm test` then passed at `6bd0255`: Vitest 52 files and 1,039 tests, then the browser suite's 667 tests, exit 0, 674 seconds.
- After the round-4 review fixes, at `c550ff0` (ledger and overview text only): before the first run, the folder check listed no folder running tests or the app, and the 18:22 slot fix took `pg_class` dead rows from 101,550 to 0 and the slot from 10,651 transactions behind to 0. That `npm test` passed Vitest's 1,039 tests, but 16 of the browser suite's 667 failed and the run took 5,883 seconds, most as timeouts in `invoices.spec.ts` and `ask.spec.ts`. At 20:03, after it ended, a `next-server` started by that run from this folder was still listening on 127.0.0.1:3102 (the browser suite's spare-app port) at about 97% CPU; it did not exit on SIGTERM and was stopped with SIGKILL, after which no process listened on ports 3100 to 3103. Free memory was about 84 MB and the 1-minute load average 12. Then the folder check listed no folder, the 20:04 slot fix took 45,164 dead rows to 0 and the slot from 4,900 transactions behind to 3, and `npm run typecheck` exited 0; `npm test` passed at `c550ff0`: Vitest 52 files and 1,039 tests, then the browser suite's 667 tests, exit 0, 673 seconds, and left no `next-server` or fake-model process running.

## Queries behind the checks

Each SQL batch ran through the Supabase MCP connection's `execute_sql`; ids are masked as `<developer id>`. Every count is an exact `count(*)`, not a statistics estimate.

- AC-0003 and AC-0004: `set transaction read only; select to_regclass('public.lots')::text as lots_table, now() as checked_at;` and the same with `private.operators`.
- AC-0005: `set transaction read only; select string_agg(version, ',' order by version) as versions, count(*) as n from supabase_migrations.schema_migrations;`
- AC-0007, AC-0018, and the products count, in one batch: `set transaction read only; select (select count(*) from pg_proc where proname = 'reset_test_data') as reset_test_data_functions, (select count(*) from public.products) as products, (select json_agg(json_build_object('role', r.rolname, 'super', r.rolsuper, 'bypassrls', r.rolbypassrls, 'member_of', (select count(*) from pg_auth_members m where m.member = r.oid)) order by r.rolname) from pg_roles r where r.rolname in ('anon', 'authenticated')) as api_roles;` The `pg_proc` count spans every schema.
- AC-0008: `set transaction read only; select (select count(*) from auth.users) as users, u.id, u.created_at, u.created_at > timestamptz '2026-10-21 18:37:10+00' as created_after_signup_off, u.last_sign_in_at, u.email_confirmed_at is not null as confirmed, (select count(*) from auth.sessions s where s.user_id = u.id) as sessions, (select count(*) from auth.refresh_tokens r where r.user_id::uuid = u.id) as refresh_tokens, now() as checked_at from auth.users u;`
- AC-0010, first read: `set transaction read only; select (select count(*) from auth.users) as users, (select count(*) from private.operators) as operators, (select count(*) from private.operators o join auth.users u on u.id = o.user_id) as operators_matching_a_user, (select bool_and(o.user_id = '<developer id>') from private.operators o) as only_developer;`
- AC-0010, second read, and AC-0020, in one batch: `set transaction read only; select` the sum of `(select count(*) from public.<table>)` over the 18 tables `alert_digests`, `alerts`, `customers`, `fee_types`, `finished_goods`, `import_draft_lines`, `import_drafts`, `inventory_balances`, `lot_adjustments`, `lots`, `product_fees`, `production_batch_lots`, `production_batches`, `products`, `receipt_corrections`, `sale_items`, `sales`, and `vendors`, with `(select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p'))` as the catalog's table count (18), `(select count(*) from auth.users)`, `(select count(*) from private.operators)`, and `(select bool_and(o.user_id = u.id) from private.operators o cross join auth.users u)`.
- AC-0011: `curl -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>" "<project URL>/rest/v1/<name>?select=*&limit=1"` for each table and view.
- AC-0012: one read-only batch over every `pg_class` row in `public` of kind `r`, `p`, `v`, `m`, or `S`, true when `anon` holds any of `has_table_privilege` `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`, or `has_any_column_privilege` `SELECT`, `INSERT`, `UPDATE`, `REFERENCES` (sequences: `has_sequence_privilege` `USAGE`, `SELECT`, `UPDATE`); `has_function_privilege('anon', oid, 'EXECUTE')` over every `public` function; and `has_schema_privilege('anon', 'private', 'USAGE')`. It returned 26 objects checked, 0 with a privilege, 21 functions checked, `rls_auto_enable()` the only one executable, and `false`. The second read added `has_table_privilege('anon', oid, 'MAINTAIN')` and `(select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace, aclexplode(coalesce(c.relacl, acldefault((case when c.relkind = 'S' then 's' else 'r' end)::"char", c.relowner))) a where n.nspname = 'public' and c.relkind in ('r','p','v','m','S') and a.grantee = 'anon'::regrole)`; a re-check uses this second form.
- AC-0013: `curl -X POST -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>" -H 'content-type: application/json' -d '{}' "<project URL>/rest/v1/rpc/rls_auto_enable"`.
- AC-0014: `curl -X POST` with the same headers and `-d '{"query":"{ __schema { queryType { fields { name } } mutationType { fields { name } } } }"}'` to `<project URL>/graphql/v1`.
- AC-0015: for each function, `set transaction read only; set local role authenticated; set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}'; select public.<name>(<values>);`, with the values the plan's Design gives per argument type; the made-up `sub` was first read as absent inside the batch that began `set transaction read only;` and built the 20 call texts, with `(select count(*) from private.operators where user_id = '00000000-0000-4000-8000-000000000001')`.
- AC-0019: `set transaction read only; set local role authenticated; set local request.jwt.claims = '{"sub":"<developer id>","role":"authenticated"}'; select public.check_operator();`
- AC-0021: `set transaction read only;` then the relation (`relkind` `r`, `p`, `v`, `m`), sequence (`S`), and function (`proname` with `pg_get_function_identity_arguments`) names in `public`, aggregated; stack A answered the same query through `docker exec ... psql`.
- AC-0022: `set transaction read only; select rolname, rolcanlogin, rolvaliduntil, rolvaliduntil < now() as expired, now() as checked_at from pg_roles where rolname like 'cli_login%' order by 1;`

## Facts for close-work

- The app stays on the local stack: at the end of the work, `.env`'s `SUPABASE_URL` host is `127.0.0.1`.
- Loading real data is a later job, and the business owner's account is made at hand-over with the overview's "Create the owner account" steps and the re-checks in "The hosted project".
- The developer chose on 2026-10-21 that a migration merged to `main` reaches the hosted project before the app points at it or any real data goes in.
- Corrections to the plan (kept here because the plan is locked): the overview's "Re-check after a push" set replaces T6 Approach's "the T5 checks run again", and the Design's AC-0012 privilege list gains `MAINTAIN`, as the second AC-0012 read above shows.
- Correction to the spec's Assumptions (kept here because the spec is locked): on stack A the browser suite reorders the grant lines of four objects, not three: `production_batch_lots`, `receipt_corrections`, `sale_items`, and `v_sale_summary`.
