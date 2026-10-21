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
- The local dump (`supabase db dump --local -s public,private`) is 3,276 lines, sha256 `0e8dd1a26e0693d6e9a6026257f99f364cbbb3d740fab40379c5be0626e0fa75`. The object lists from stack A hold 23 tables and views, 3 sequences, and 20 functions in `public`. Both are kept in the session scratchpad only.

## T2: sign-in settings

- The developer turned off new-user sign-up and set the email provider's minimum password length to 12 in the dashboard, so the developer's own action is the approval of both writes; reported done at about 13:36.
- AC-0001, first check, 13:37:10 (18:37:10 UTC): `GET /auth/v1/settings` with the anon key returned `"disable_signup": true` (email provider on, mailer autoconfirm off). AC-0008 compares the developer's account's `created_at` against this time.
- AC-0002: the developer read the minimum password length as 12, reported in chat at about 13:38.

## T3: the engine on the hosted project

- The developer approved the CLI's temporary login role in chat at about 13:40, before `supabase link` ran at 13:47:48. The link made no role (a read-only `pg_roles` read found no `cli_login%` role after it); the dry run printed "Initialising login role...".
- `supabase db push --dry-run` listed all 15 files in file order, `0001_init.sql` through `20261021005125_pricing_view_once.sql`. The developer saw the list and approved the push in chat at about 13:50.
- AC-0003, 18:59:29 UTC: `to_regclass('public.lots')` was null, so no table `public.lots` existed. AC-0004, 18:59:30 UTC: `to_regclass('private.operators')` was null. These two reads were the only hosted commands before the push.
- `supabase db push --yes` ran from 18:59:38 to 18:59:42 UTC (13:59 local), exit 0, and applied the 15 files in order. Its two notices were "extension \"pgcrypto\" already exists, skipping" (0001) and "function public.reset_test_data() does not exist, skipping" (access lockdown).
- AC-0005: a prefixed read of `supabase_migrations.schema_migrations` returned 15 versions, the same set as the 15 file versions.
- AC-0006: the hosted dump (`supabase db dump -s public,private`, 3,314 lines, sha256 `0fbe42b2069a44e69c184a23332984970bf49c8b419f394f57bbf6e9293b83d8`, made with the CLI's `postgres:17.6.1.141` image) has 446 paragraphs; the local reference has 443. The plan's comparison removed 3 hosted paragraphs (the `rls_auto_enable()` definition, its owner line, and its 3 grant lines) and printed `443 446 3 True`.
- AC-0007: no function named `reset_test_data` in any schema.
- AC-0018: `anon` and `authenticated` are not superusers, do not bypass row level security, and are members of no role.
- `public.products` holds 0 rows, so the alerts migration's baseline step had no list price to record.
- `supabase unlink` finished, and a fixed-string search of `supabase/.temp/` for the project reference matched no file.

## T4: the developer's account

- The developer approved making the developer's account in chat at about 14:05 and made it in the dashboard (Add user, Create new user, auto-confirmed) with the developer's personal email.
- AC-0008, 19:03:34 UTC: `auth.users` held exactly 1 user, created 19:03:22 UTC (later than the first AC-0001 check at 18:37:10 UTC), `last_sign_in_at` null, email confirmed; `auth.sessions` and `auth.refresh_tokens` held no row for it.
- AC-0009: the developer confirmed in chat at about 14:06 that the account's password has at least 12 characters.
- The developer approved the allowlist insert in chat at about 14:06. `insert into private.operators(user_id) values ('<developer id>')` ran through `execute_sql` at 19:14:43 UTC.
- AC-0010, first read: `auth.users` holds 1 user and `private.operators` holds 1 row, whose `user_id` is that user's id.

## T5: the access check

- AC-0001, second check, 19:15:07 UTC: `GET /auth/v1/settings` with the anon key returned `"disable_signup": true`.
- AC-0021: a read-only catalog query listed 23 tables and views, 3 sequences, and 21 functions in the hosted `public` schema. With `rls_auto_enable()` removed, the 46 names equal the 46 that T1 listed on stack A.
- AC-0011: `GET /rest/v1/<name>?select=*&limit=1` with the anon key, for each of the 23 tables and views, answered HTTP 401 with code `42501` and no rows, 23 of 23.
- AC-0012: across the 26 tables, views, and sequences in `public`, `anon` holds no table, column, or sequence privilege; of the 21 functions it may execute only `rls_auto_enable()`; it has no `USAGE` on schema `private`.
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
