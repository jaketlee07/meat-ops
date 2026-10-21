# Spec: hosted-rollout

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the intent [`docs/product/intents/hosted-supabase-rollout.md`](../../product/intents/hosted-supabase-rollout.md) (its Outcome and Boundary); the `AGENTS.md` hard rules, 2, 7, and 8 above all; the access model and the owner-account steps in [`docs/architecture/overview.md`](../../architecture/overview.md); the users in [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §3
- **Brief:** none
- **Discovery:** none
- **Contract:** none (no published interface changes)
- **Shape:** integration

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory: it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

This spec delivers the outcome and boundary of the
[hosted Supabase rollout intent](../../product/intents/hosted-supabase-rollout.md):
the hosted Supabase project runs the hardened engine and is safe to hold real
business data. Two people appear below. The business owner is the app's daily
user. The developer, jaketlee07, owns this repository, helps resolve issues, and
approves every write to the hosted project. The rollout stops at the passing
access check: the app keeps using the local stack, no data moves, and the
business owner's account waits for hand-over.

- **Sign-in is closed.** Public sign-up is off, and a password needs at least
  12 characters. An account signs in with its password or a link emailed to its
  address, with no MFA.
- **The same engine.** Every migration in `supabase/migrations/` is applied to
  the hosted project by `supabase db push`. Its `public` and `private` layout
  then matches the local stack's, apart from one function Supabase adds to new
  projects, `public.rls_auto_enable()`.
- **One allowed user now, two after hand-over.** The developer makes the
  developer's account in the dashboard. It is checked as new and never used
  before its id joins `private.operators`, and it is the only account and the
  only operator. The business owner's account goes through the same steps at
  hand-over.
- **Proof that outsiders get nothing.** Read-only checks show that the anon key
  reads no table or view, and runs no function except Supabase's
  `rls_auto_enable()`, which does nothing outside a schema change. A signed-in
  non-operator, simulated inside a read-only transaction, is refused by every
  function, while the developer's id gets past the caller check.
  `reset_test_data` is absent. Every `public` table holds 0 rows, so a
  non-operator's reads prove nothing there; the layout match and the API roles'
  settings carry that proof, because the local suite shows the same layout gives
  a non-operator 0 rows.
- **What stays out of git.** The repository is public, so the hosted project's
  publishable keys, account ids, and passwords stay out of every tracked file,
  commit message, and pull request. The project reference is already public in
  the tracked `.mcp.json`, and the developer's personal email is public as the
  author of most of the repository's commits; the developer accepts both.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture and maintainer procedure | Applicable: later migrations must reach the hosted project the same way, its settings and accepted risks need one home, and the overview still calls this work "the hosted follow-on" | `docs/architecture/overview.md`: a new section "The hosted project" after "Create the owner account", and the "Insertion order and the hosted check" section without "(the hosted follow-on)" | work-loop | The overview diff | close-work finds the section in the merged tree, the section names each risk accepted in the sign-in assumption and in the assumption where the developer accepts what the overview records, and no "hosted follow-on" remains in the overview |
| Users, the hosted-write approver, and the meaning of "the owner" | Applicable: the master brief, the agent guidance, and the overview each say the app has one user, and the repository's approvals of the work, decisions about it, and recorded acceptances say "the owner", which needs one stated meaning now that two people use the app | `SYSTEM-SPEC.md` §3, its "The owner is the only user in the MVP." sentence, and its §10 "multi-user and roles beyond the single owner"; the `AGENTS.md` project overview, where one added sentence says "the owner" means the developer wherever the repository asks for, requires, or records an approval of the work or a decision about it, or an accepted risk, and hard rule 7; the `docs/architecture/overview.md` opening paragraph and its "A hosted project needs the owner's approval" sentence | work-loop | The diff of each sentence | close-work finds the business owner and the developer named in each user passage, the meaning sentence in `AGENTS.md`, and the developer named as the approver in hard rule 7 and the overview |
| Execution record | Applicable: every check result and every write approval needs a home outside the contract | `docs/specs/hosted-rollout/notes/verification-ledger.md` | work-loop | Ledger entries, with keys and ids masked | The ledger holds every check the Testing Strategy routes to it and every approval the Always-do list names |
| Intent closeout | Applicable: this spec delivers a backlog intent | `docs/product/intents/hosted-supabase-rollout.md`, `workspace.toml` `[backlog]` | close-work | none | close-work marks the intent Fulfilled and its entry leaves `open` |
| Work that waits on this rollout | Applicable: `docs/product/intents/app-https-hosting.md` asks whether app hosting ships with this rollout and owns the hosted session limits, which this rollout leaves at Supabase's values; `docs/product/intents/alerts-review-observations.md` asks whether this rollout confirms list-price baseline rows; the seed-data-privacy spec names this intent as the owner of loading real data; the business owner's account waits for hand-over | those files, and a new intent for the hand-over account that the developer approves | close-work | Ledger facts: the app stays local, the hosted project held no product when the alerts migration ran, loading real data is a later job, and the hand-over account follows the overview's steps | close-work answers each one with the developer and queues the hand-over intent |
| Lifecycle closeout | Applicable: delivered work is recorded when it ships | `docs/lifecycle/hosted-rollout.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Applicable when the build teaches something that would change a future approach | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |
| Costing truth | Not applicable: no rule or golden number in `docs/costing.md` changes | none | n/a | n/a | n/a |
| User documentation and release history | Not applicable: no page, label, message, or command of the app changes, and the app stays on the local stack | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the developer's decisions are in Assumptions and the overview section | none | n/a | n/a | n/a |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Follow the `AGENTS.md` hard rules.
- Name each write to the hosted project in chat and wait for the developer's approval before it happens. The writes are the two sign-in settings and the developer's account, which the developer makes in the dashboard; the CLI's temporary login role, approved before the first CLI command that connects to the hosted project; the migration push, approved after the dry run; and the one allowlist insert. The ledger records each approval and its time.
- Through the Supabase MCP connection, call only `execute_sql`, `get_publishable_keys`, `get_project_url`, and `search_docs`, and begin every `execute_sql` batch with `set transaction read only`, except the allowlist insert.
- Keep the hosted project's publishable keys and account ids out of tracked files, commit messages, and pull request text, comments, and reviews, and outside the session scratchpad write them to no file. Commit messages and pull request text on this branch carry no link to any agent session.

### Ask first

- Any write to the hosted project that the Always-do list does not name, such as another setting, deleting a user or a login role, resetting the database password, a plan change, or a restore.
- Acting on a layout difference that AC-0006 finds beyond `rls_auto_enable`, or on any failed access check.
- Pointing the app at the hosted project.
- Changing any `SYSTEM-SPEC.md` or `AGENTS.md` text other than the sentences that say who uses the app, who approves a hosted write, or what "the owner" means.

### Never do

- In this spec's pull request, no added, changed, or removed tracked file outside `docs/specs/hosted-rollout/`, `docs/architecture/overview.md`, `SYSTEM-SPEC.md`, and `AGENTS.md`, so no new migration, dependency, module, script, or test.
- No migration reaches the hosted project except through `supabase db push` with no flag other than `--dry-run` and the global `--yes`. No `supabase config push`, no `supabase db reset --linked`, and no MCP `apply_migration`.
- The agent never sees, types, or stores a password: not the developer's, not the business owner's, and not the database password.
- No real business data, seed data, or test data is written to the hosted project.
- No force-push of this branch.

## Testing Strategy

- **Goal-based checks against the hosted project, recorded in the verification ledger (AC-0001, AC-0003, AC-0004, AC-0005, AC-0007, AC-0008, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0018, AC-0020, AC-0021, AC-0022).** Each is a read-only SQL query through the Supabase MCP connection, an HTTP request with the anon key, or a CLI command, so its output settles it. The ledger records each command and its result with keys and ids masked.
- **Goal-based layout comparison, recorded in the verification ledger (AC-0006).** `supabase db dump` of `public` and `private` from the hosted project and from local stack A at the same commit, compared paragraph by paragraph. The local reference is stack A after `npm test` passes on it at that commit, so it is the layout the suite exercised. The order of entries in an access list carries no meaning, and the browser suite's revoke and re-grant changes it on stack A, so the comparison ignores the order of lines inside a paragraph made only of `GRANT`, `REVOKE`, and `ALTER DEFAULT PRIVILEGES` statements.
- **Simulated callers, goal-based (AC-0015, AC-0019).** The plan's probe #4 shows the same simulation on the local stack refuses every `public` function with `42501` and lets an allowlisted user past the caller check. The read-only transaction makes any write a function attempts fail with `25006`, which the check counts as a failure.
- **Manual QA by the developer, recorded in the verification ledger (AC-0002, AC-0009).** Only the developer sees the dashboard's password setting and the developer's own password. The ledger records what the developer reports and when.
- **Goal-based repository checks (AC-0016, AC-0017).** Fixed-string searches. AC-0016 searches `supabase/.temp/`, recorded in the verification ledger. AC-0017 runs before every push and every post, so nothing that fails it ever reaches GitHub; the completion handoff lists each run with the commit it searched, for a push, or the text it searched, for a post, and its match counts.
- **The existing suites, run by `npm test` on stack A.** No app, database, or test code changes, so no new test is added.

## Acceptance Criteria

### Sign-in settings

- [ ] **AC-0001.** `GET /auth/v1/settings` on the hosted project, sent with its anon key, returns `"disable_signup": true` both before the developer's account is made and when the access check runs.
- [ ] **AC-0002.** The developer reads the hosted dashboard's minimum password length as 12, and the ledger records the reading and its time.

### Before the push

- [ ] **AC-0003.** After the dry run, a read-only query on the hosted project shows either no table `public.lots` or no row of it with a null `vendor_id`, and the only hosted commands between this query and `supabase db push` are the AC-0003 and AC-0004 queries.
- [ ] **AC-0004.** After the dry run, a read-only query on the hosted project shows either no table `private.operators` or no row in it, and the only hosted commands between this query and `supabase db push` are the AC-0003 and AC-0004 queries.

### The engine

- [ ] **AC-0005.** After the push, the set of versions in the hosted `supabase_migrations.schema_migrations` equals the set of leading versions of the file names in `supabase/migrations/` at the pushed commit.
- [ ] **AC-0006.** Split at blank lines into paragraphs, with the lines of each paragraph that holds only `GRANT`, `REVOKE`, and `ALTER DEFAULT PRIVILEGES` statements put in sorted order, the output of `supabase db dump -s public,private` from the hosted project equals, paragraph for paragraph and in order, the same dump from local stack A at the pushed commit, once every hosted paragraph containing `rls_auto_enable` is removed.
- [ ] **AC-0007.** A read-only query on the hosted project finds no function named `reset_test_data` in any schema.
- [ ] **AC-0018.** A read-only query on the hosted project shows that the roles `anon` and `authenticated` are not superusers, do not bypass row level security, and are members of no role.

### The developer's account

- [ ] **AC-0008.** Before the allowlist insert, a read-only query shows that `auth.users` holds exactly one user, that its `created_at` is later than the first AC-0001 check, that its `last_sign_in_at` is null, and that `auth.sessions` holds no row for it.
- [ ] **AC-0009.** The developer confirms in chat that the developer's account password has at least 12 characters, and the ledger records the confirmation.
- [ ] **AC-0010.** When the access check runs, `auth.users` holds exactly one user, and `private.operators` holds exactly one row, whose `user_id` is that user's id.

### The access check

- [ ] **AC-0011.** With the anon key, `GET /rest/v1/<name>?select=*&limit=1` for every table and view the hosted catalog lists in `public` answers with error code `42501` and no rows.
- [ ] **AC-0012.** A read-only catalog query on the hosted project shows that `anon` holds no privilege on any table, view, sequence, or column in `public`, no `USAGE` on schema `private`, and no `EXECUTE` on any function in `public` other than `rls_auto_enable()`.
- [ ] **AC-0013.** With the anon key, `POST /rest/v1/rpc/rls_auto_enable` answers with a status outside 200 to 299.
- [ ] **AC-0014.** With the anon key, a GraphQL introspection request to `/graphql/v1` returns no field whose name contains a `public` table or view name together with `collection`, and no field named after a `public` function. An error answer with no schema data meets this.
- [ ] **AC-0015.** Every function the hosted catalog lists in `public`, other than `rls_auto_enable()`, fails with SQLSTATE `42501` when called in a read-only transaction as role `authenticated`, with request claims carrying `"role":"authenticated"` and a `sub` that is not in `private.operators`.
- [ ] **AC-0019.** When the access check runs, `public.check_operator()` returns without error when called in a read-only transaction as role `authenticated`, with request claims carrying `"role":"authenticated"` and the `sub` of the one `private.operators` row.
- [ ] **AC-0020.** When the access check runs, every table the hosted catalog lists in `public` holds 0 rows.
- [ ] **AC-0021.** Each hosted list that AC-0011, AC-0012, AC-0015, and AC-0020 run over (the `public` tables and views, sequences, and functions) holds exactly the names of the matching list on local stack A, apart from `rls_auto_enable()`.

### Clean-up

- [ ] **AC-0016.** When the work ends, no file under `supabase/.temp/` in this folder contains the hosted project's reference.
- [ ] **AC-0022.** When the work ends, a read-only query shows that no hosted role whose name starts with `cli_login` can still log in: each has `rolcanlogin` false or a `rolvaliduntil` earlier than the query's time.
- [ ] **AC-0017.** Before each `git push` of this branch, with no commit made between the search and the push, a search finds no hosted publishable key, no developer's account id, and no link to any agent session in the file content or message of any commit in `main..HEAD`; before the agent posts or edits a pull request title, body, comment, or review, a search finds none of the three in that text.

## Follow-ons

None. Loading real data and the business owner's hand-over account are routed through the "Work that waits on this rollout" row in Durable Outputs.

## Assumptions

- Technical: the hosted project `meat-ops` is on the free plan, runs Postgres 17.6, and was paused until the developer resumed it on 2026-10-21; it was healthy at 10:04 (source: `supabase projects list -o json`).
- Technical: free projects pause after about 7 days of low activity and can be resumed for 90 days (source: https://supabase.com/docs/guides/platform/free-project-pausing).
- Technical: the hosted project is empty: no migration history, no table or view in `public`, no `private` schema, and no user or session in `auth` (source: plan.md probe #1).
- Technical: the hosted project has `public.rls_auto_enable()`, an event-trigger function run by the trigger `ensure_rls` that turns on row level security for each new table in `public`; `PUBLIC`, `anon`, `authenticated`, and `service_role` hold EXECUTE on it, and its definition has no blank or whitespace-only line. The local stack does not have it, and has no `reset_test_data` in any schema (source: plan.md probes #1 and #5).
- Technical: the hosted project has no `pg_graphql` or `pg_net`, and no migration uses either; the only extension a migration names is `pgcrypto`, which the hosted project has (source: plan.md probe #1; a search of `supabase/migrations/`).
- Technical: sign-up is open on the hosted project; its public settings address shows sign-up but no password length; and a sign-in request without the anon key is refused with "No API key found in request" (source: `GET /auth/v1/settings` and a keyless `POST /auth/v1/token`, 2026-10-21).
- Technical: the Supabase MCP connection runs as `postgres`, holds `set transaction read only` for the rest of a batch, can act as `authenticated` with request claims, and reports a refusal's SQLSTATE (source: plan.md probe #2).
- Technical: without a database password, the CLI connects through a temporary `cli_login_postgres` role that Supabase makes; with one, it signs in as `postgres` (source: https://supabase.com/docs/guides/troubleshooting/permission-denied-when-deleting-the-cli_login_postgres-role-808bae).
- Technical: every function, table, index, sequence, and view in the local `public` and `private` schemas is owned by `postgres`; `supabase db dump` keeps owners and grants, drops event triggers and comment lines, gives the same bytes on two runs, and writes one paragraph per grant set; on stack A the browser suite has moved `authenticated` after `service_role` in three objects' grant lines (source: plan.md probes #3 and #5).
- Technical: `anon` and `authenticated` are not superusers, do not bypass row level security, and are members of no role, on both the hosted project and stack A (source: plan.md probe #5).
- Technical: the hosted project's reference is in the tracked `.mcp.json` on public `main` since commit f46070d (2026-09-22); neither publishable key appears in any tracked file, commit message, or commit in the history (source: `git log -- .mcp.json`; `git grep -F`, `git log --all --format=%B`, and `git log --all -S` for each key, 2026-10-21).
- Technical: the repository is public on GitHub, and the developer's personal email is the author address on most of its commits (source: `gh repo view`; `git log --format=%ae`, 2026-10-21).
- Product: an account signs in with its password or a link emailed to its address, with no MFA; the developer accepts that a leaked password, or control of the account's mailbox, alone gives full access (source: user confirmation 2026-10-21).
- Product: the rollout stops at the passing access check; the app stays on the local stack, and loading real data is a later job (source: user confirmation 2026-10-21).
- Product: the app has two allowed users: the business owner, who uses it daily, and the developer, who helps resolve issues. The developer's account is made in this rollout with the developer's personal email; the business owner's account is made at hand-over (source: user confirmation 2026-10-21).
- Product: `rls_auto_enable()` stays as Supabase made it, and the checks allow exactly that one function by name (source: user confirmation 2026-10-21).
- Product: the non-operator proof is the layout match plus a simulated non-operator in a read-only transaction, with no throwaway account (source: user confirmation 2026-10-21).
- Product: the agent checks sign-up through the public settings address, and the developer reads the password minimum in the dashboard (source: user confirmation 2026-10-21).
- Product: the developer accepts, and the overview records, that the project reference and the developer's email are public; that the agent's MCP connection can write and only its read-only batch rule keeps checks from writing; and that the database password, the developer's Supabase login, the admin key, and a database that accepts connections from the internet each reach the hosted data outside the app (source: user confirmation 2026-10-21).
- Product: the developer gives the approval `AGENTS.md` hard rule 7 requires for hosted writes, and this work rewords rule 7 and the overview's hosted-approval sentence to name the developer; wherever the repository asks for, requires, or records an approval of the work or a decision about it, or an accepted risk, "the owner" means the developer, and every other sentence keeps its meaning; the intent's "owner" is its Owner field, jaketlee07 (source: user confirmation 2026-10-21).
- Product: the AC-0017 searches run before every push and every post rather than after, the branch is never force-pushed, and commits and pull request text on this branch carry no link to any agent session (source: user confirmation 2026-10-21).
- Technical: outside the developer's account, the session link shows only a sign-in page, so the commits on `main` that carry it expose no transcript; no tracked file holds a session link (source: the developer's private-window check and an unauthenticated GET that answered 403; `git grep -F` at HEAD, 2026-10-21).
- Process: the developer approves the spec and then the plan in chat, and approves each hosted write in chat as it comes (source: `AGENTS.md` hard rule 7; menu-pricing-review precedent).
