# Plan: hosted-rollout

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** `docs/architecture/overview.md` ("Access model", "Create the owner account", "Insertion order and the hosted check") and the foundation-hardening plan's Rollout, which first set this sequence; the local proof of the same access model is `test/access.test.ts` (AC-0001 to AC-0011 there). Deviation: the hosted check cannot reuse that suite, because the suite refuses any host but `127.0.0.1` or `localhost` (`test/env.ts`) and writes test rows; this plan proves the hosted side read-only instead.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/hosted-rollout/notes/verification-ledger.md`. A genuine artifact
> error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

The rollout is a short sequence of developer-approved steps against the hosted
project, each followed by a read-only check, plus the documentation edits in T6. No
app, database, or test code changes. First the local reference: `npm test`
passes on stack A at this commit, then its layout and object lists are taken.
Then the developer closes sign-up and sets the 12-character minimum in the
dashboard. Then, after the developer approves the CLI's temporary login role,
this folder is linked and `supabase db push --dry-run` lists the files. After
the developer approves the push, two reads confirm no lot lacks a vendor and no
operator exists, and `supabase db push` applies every file. The hosted layout is
dumped and compared with the local one, and the folder is unlinked. Then the
developer makes the developer's account, a read-only query shows it is new and
alone, and after the developer approves, its id goes into `private.operators`.
Last, the access check runs, the overview, `SYSTEM-SPEC.md`, and `AGENTS.md` are
updated, and the clean-up checks run.

The riskiest part is the push: it is the one large, hard-to-undo write. The
hosted project is empty and has no operator, so a failure loses nothing and no
operation can run during the zero-stock-average file. A file that fails rolls
back alone and stops the push; the work then stops for the developer.

## Constraints

- The [hosted Supabase rollout intent](../../product/intents/hosted-supabase-rollout.md): its Boundary sets the order (settings, null-vendor check, migrations, account, allowlist, read-only check) and requires approval for every hosted write.
- `AGENTS.md` hard rules: 2 (RLS and grants, which the layout match carries over), 4 (no em dashes in docs or commit messages), 5 (commit format), 7 (no hosted write without approval), and 8 (no real business data in git or GitHub).
- `docs/architecture/overview.md` "Create the owner account": each account is made by hand and checked as new before its id joins the allowlist.
- `SYSTEM-SPEC.md` §3 names the app's users.
- The AGENTS.md folder check runs before every `npm test`.
- The spec's Always-do keeps any agent session link out of this branch's commits and pull request text.

## Construction tests

Most construction tests live under **Tasks** below. This section lists only
what spans tasks.

**Integration tests:** none beyond per-task tests.
**Manual verification:** the developer's two dashboard steps (T2, T4), each recorded in the ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Current architecture and maintainer procedure, `docs/architecture/overview.md` | T6 | The overview diff | As the spec's matching Durable Outputs row says |
| Users, the hosted-write approver, and the meaning of "the owner", `SYSTEM-SPEC.md`, `AGENTS.md`, and `docs/architecture/overview.md` | T6 | The diff of the eight sentence edits | As the spec's matching Durable Outputs row says |
| Execution record, `docs/specs/hosted-rollout/notes/verification-ledger.md` | T1 to T6 | Ledger entries | Every check the Testing Strategy routes to the ledger, and every approval, has an entry |
| Work that waits on this rollout | T3, T6 | Ledger facts: the hosted project held no product when the alerts migration ran; the app stays local; loading real data is a later job; the hand-over account follows the overview's steps | close-work answers the two intents' questions, the loading owner, and the hand-over intent with the developer |
| Intent closeout, lifecycle closeout, reusable learning | none (close-work and the work-loop gates) | none | As the spec's Durable Outputs table says |

## Design (LLD)

### Design decisions

- **Compare whole layouts, not a hand-picked list of catalog facts.** A query that lists chosen access facts can miss a kind of fact, and each review would find a new one. `supabase db dump` writes every owner, grant, policy, function body, and view option, so comparing the two dumps covers them all. Grant lines inside one object's paragraph are compared as a set, because the browser suite's revoke and re-grant moves a role to the end of an object's access list without changing what it grants (probe #5). Traces to AC-0006.
- **Read the API roles' settings directly.** The dump covers `public` and `private` only, not role attributes or memberships, so AC-0018 reads them. Traces to AC-0018.
- **Simulate callers in a read-only transaction instead of making a throwaway account.** It needs no extra hosted write and no shared password, and the read-only transaction turns any attempted write into error `25006`. One call set refuses a made-up non-operator; one call admits the developer's id, so a refusal cannot come from a caller check that refuses everyone. The trade-off is that the simulation skips the auth server's own token path; the developer accepted that. Traces to AC-0015 and AC-0019.
- **`supabase db push`, not MCP `apply_migration`.** The push records each file under its own version, so the hosted history matches the file names (AC-0005) and later pushes see the same history. `apply_migration` records a new timestamp per call.
- **The CLI's temporary login role, not the database password.** No one types or shares the password. The developer approves the role before the first CLI command that connects, and AC-0022 reads its state at the end.
- **Unlink right after the hosted dump.** Every later hosted step uses the MCP connection or HTTP, so the link is not needed past T3, and an unlinked folder cannot run a `--linked` command by mistake. Traces to AC-0016.
- **AC-0017 runs before anything goes up.** Right before each `git push`, with no commit in between, `git grep -F <value> $(git rev-list main..HEAD)` and `git log main..HEAD --format=%B` search every branch commit, and before each `gh pr create`, `gh pr edit`, comment, or review, the text file to be posted is searched with `grep -F`. The values are both publishable keys, the developer's id, and the address prefix of an agent session link, each read from the scratch files so no tracked file holds a searched value. Nothing is pushed or posted until every search prints nothing, and the branch is never force-pushed, so nothing that fails reaches GitHub. The completion handoff lists every run with the commit or text it searched and its match counts. A push or post after the scratch files are deleted first restores every searched value into the session scratchpad: both keys through `get_publishable_keys`, the developer's id through a read-only `execute_sql`, and the session-link address prefix, which the agent knows from its own attribution settings, and the reply that reports that push or post lists its run.

### Behavior & rules

- **Layout comparison (AC-0006).** Run in scratch, never tracked:

  ```python
  import re, sys
  def paragraphs(path):
      out = []
      for p in re.split(r"\n\s*\n", open(path).read()):
          if not p.strip():
              continue
          lines = p.split("\n")
          if all(re.match(r"(GRANT|REVOKE|ALTER DEFAULT PRIVILEGES) ", l) for l in lines):
              lines = sorted(lines)
          out.append("\n".join(lines))
      return out
  local, hosted = paragraphs(sys.argv[1]), paragraphs(sys.argv[2])
  kept = [p for p in hosted if "rls_auto_enable" not in p]
  print(len(local), len(hosted), len(hosted) - len(kept), kept == local)
  ```

  It passes when the last value is `True`. The hosted `rls_auto_enable()` definition has no blank or whitespace-only line (probe #5), so it is one paragraph and the filter drops it whole.
- **Object lists (AC-0021).** One read-only query, run on the hosted project and on stack A, lists the `public` tables and views (`pg_class` kinds `r`, `p`, `v`, `m`), sequences (kind `S`), and functions by name. The two outputs must match once `rls_auto_enable` is removed; the ledger records each count.
- **Simulated calls (AC-0015, AC-0019).** One read-only query on the hosted catalog writes one call per `public` function except `rls_auto_enable()`, with a fixed value for each argument type: `uuid` `'00000000-0000-4000-8000-000000000002'`, `numeric` `1`, `text` `'x'`, `date` `current_date`, `jsonb` `'[]'`, `bytea` `null`, `boolean` `false`, `text[]` `array['x']`. Any other type stops the check. Each call goes in its own batch: `set transaction read only; set local role authenticated; set local request.jwt.claims = '{"sub":"<id>","role":"authenticated"}'; select public.<name>(<values>);`. For AC-0015 `<id>` is `00000000-0000-4000-8000-000000000001`, which a read-only query first shows is not in `private.operators`; for AC-0019 it is the one operator row's `user_id`, and the call is `select public.check_operator();`. The batch's error text carries the SQLSTATE (probe #2).
- **Anon checks (AC-0011 to AC-0014).** Each `GET` sends `apikey` and `Authorization: Bearer` with the anon key. AC-0012 returns one row per object with its flags, from `has_table_privilege` for `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, and `TRIGGER`, `has_any_column_privilege`, `has_sequence_privilege` for `USAGE`, `SELECT`, and `UPDATE`, `has_function_privilege` for `EXECUTE`, and `has_schema_privilege` for `private` `USAGE`.
- **Role checks (AC-0018, AC-0022).** `pg_roles` for `rolsuper`, `rolbypassrls`, `rolcanlogin`, and `rolvaliduntil`, and `pg_auth_members` for memberships.
- **Ledger masking.** Entries name "the hosted project", "the anon key", and "the developer's account", and write ids as `<developer id>`. Times are America/Chicago.

### Failure, edge cases & resilience

- An AC-0003 or AC-0004 read fails or errors: the push does not run, and its approval lapses until the developer approves again.
- A migration fails during the push: the file rolls back, the push stops, and the work stops for the developer. The hosted project holds no data, so no fix is urgent.
- AC-0006 finds a difference beyond `rls_auto_enable`, or a T5 check fails: stop and show the developer the result (Ask first).
- AC-0008 fails (a second user, an old `created_at`, a sign-in, or a session): stop. The account is not the one the developer just made. Deleting or remaking a user is an Ask-first write.
- The login role fails to sign in (Supabase documents a pooler credential-cache failure): stop and show the developer the CLI's error; the fixes it lists change hosted settings, so each is Ask first.
- AC-0022 finds a login role that can still log in: wait for its `rolvaliduntil` to pass, or ask the developer to approve its removal through the Management API endpoint the Supabase docs name.
- The hosted project pauses again (about 7 days of low use): the developer resumes it, and the work picks up at the step it stopped on.

### Dependencies & integration

- Supabase CLI 2.95.4: `link`, `db push`, `db dump`, `unlink`.
- The Supabase MCP connection for this project: `execute_sql`, `get_publishable_keys`, `get_project_url`, `search_docs`. It runs as `postgres` (probe #2).
- `curl` for the auth settings, REST, RPC, and GraphQL requests.
- The Supabase dashboard, used only by the developer.

## Tasks

### T1: The local reference layout is tested and taken

**Depends on:** none

**Touches:** `docs/specs/hosted-rollout/notes/verification-ledger.md`

**Mode:** goal-based check.

**Tests:**
- `npm test` passes on stack A at this branch's commit, after the AGENTS.md folder check lists no other stack A folder. This is the reference AC-0006 relies on.
- `supabase migration list --local` shows exactly the versions of the files in `supabase/migrations/`.
- The local dump (`supabase db dump --local -s public,private`) and the Design's object lists from stack A are written to scratch, and the dump's sha256 and each list's count go in the ledger.

**Approach:**
- Run the folder check, then `npm test`, then the migration list, the dump, and the lists.

**Done when:** the three Tests results are in the ledger.

### T2: Sign-up is off and the password minimum is 12

**Depends on:** none

**Touches:** `docs/specs/hosted-rollout/notes/verification-ledger.md`

**Mode:** visual / manual QA by the developer, then a goal-based check.

**Tests:**
- AC-0001 (first check): its time is recorded, because AC-0008 compares against it.
- AC-0002.

**Approach:**
- The developer, in the dashboard's Authentication settings, turns off new-user sign-up and sets the email provider's minimum password length to 12, then reports the minimum it shows.
- The agent sends the `GET /auth/v1/settings` request.

**Done when:** both Tests results and the developer's approval are in the ledger.

### T3: The hosted project runs every migration, with the local layout

**Depends on:** T1, T2

**Touches:** `docs/specs/hosted-rollout/notes/verification-ledger.md`

**Mode:** infra/deploy: approval, dry-run preview, approval, preflight reads, apply, read-only smoke.

**Tests:**
- The developer's approval of the login role is in the ledger before `supabase link` runs.
- `supabase db push --dry-run` lists every file in `supabase/migrations/`, and the developer sees that list before approving the push.
- AC-0003 and AC-0004, read after that approval, with `supabase db push` the next hosted command.
- AC-0005, through a prefixed `execute_sql` read.
- AC-0006, with the hosted dump from `supabase db dump -s public,private` and the comparison in Design.
- AC-0007 and AC-0018.
- A read-only count of `public.products` is 0, for the alerts intent's baseline question.

**Approach:**
- Ask the developer to approve the login role, then `supabase link --project-ref <ref>`, leaving any password prompt empty.
- The dry run. Ask the developer to approve the push, naming the files.
- The two preflight reads; on a pass, `supabase db push --yes`, then the history read, the hosted dump, the comparison, and the reads.
- `supabase unlink`.

**Done when:** every Tests result is in the ledger and the folder is unlinked.

### T4: The developer's account is the one operator

**Depends on:** T3

**Touches:** `docs/specs/hosted-rollout/notes/verification-ledger.md`

**Mode:** visual / manual QA by the developer, then goal-based checks.

**Tests:**
- AC-0008, before the insert.
- AC-0009.
- AC-0010, read right after the insert; T5 reads it again.

**Approach:**
- Ask the developer to approve the account, naming it. The developer, on the dashboard's Authentication users page, adds a user with the developer's personal email and a password of at least 12 characters, confirmed at creation so no email is needed.
- The agent runs the AC-0008 query. On a pass, it asks the developer to approve the insert, naming the statement.
- `insert into private.operators(user_id) values ('<developer id>');` through `execute_sql`.

**Done when:** the three Tests results and both approvals are in the ledger.

### T5: The anon key and a non-operator reach nothing

**Depends on:** T4

**Touches:** `docs/specs/hosted-rollout/notes/verification-ledger.md`

**Mode:** goal-based checks.

**Tests:**
- AC-0001 (second check) and AC-0010 (second read).
- AC-0011, AC-0012, AC-0013, and AC-0014, as Design's anon checks describe.
- AC-0015 and AC-0019, as Design's simulated calls describe. The ledger lists each function with its SQLSTATE.
- AC-0020 and AC-0021.

**Approach:**
- Read the object lists from the hosted catalog, compare them with T1's, then run each check.

**Done when:** every Tests result is in the ledger.

### T6: The docs tell the hosted story, and nothing secret is tracked

**Depends on:** T5

**Touches:** `docs/architecture/overview.md`, `SYSTEM-SPEC.md`, `AGENTS.md`, `docs/specs/hosted-rollout/notes/verification-ledger.md`

**Mode:** goal-based checks.

**Tests:**
- AC-0016: `grep -rlF <ref> supabase/.temp` prints nothing.
- AC-0022.
- AC-0017, run before every push and every post as the Design's AC-0017 rule says.
- `grep -n "hosted follow-on" docs/architecture/overview.md` prints nothing, and the overview has a `## The hosted project` heading.
- `grep -n -E "only user|One person for the|beyond the single owner|signed-in owner reaches" SYSTEM-SPEC.md AGENTS.md docs/architecture/overview.md` prints nothing; the new text of each numbered user edit (1, 2, 3, 4, and 6) contains both "business owner" and "developer"; `AGENTS.md` holds edit 8's sentence; hard rule 7 ends "without the developer's approval."; and the overview's hosted-approval sentence names the developer.
- `python '<work-loop skill dir>/scripts/lint-spec-status.py' --root .` exits 0.

**Approach:**
- Add "The hosted project" after "Create the owner account". It says: the hosted project holds every migration, applied with `supabase db push` from a folder linked only for that push; a later migration reaches it the same way after the developer approves, and the T5 checks run again; sign-up stays off with a 12-character minimum; an account signs in with its password or an emailed link, with no MFA, so a leaked password, or control of the account's mailbox, alone gives full access, accepted on 2026-10-21; the app has two allowed users, the business owner and the developer, and each account is made with the steps in "Create the owner account"; Supabase's `rls_auto_enable()` is the one function the anon key may run, and it acts only during a schema change; the non-operator proof is simulated, so it skips the auth server's token path; the session limits are Supabase's own until the HTTPS hosting intent sets them; the project reference and the developer's email are public; the agent's MCP connection can write, and only its read-only batch rule keeps checks from writing; the database password, the developer's Supabase login, and the admin key each reach the data outside the app, and the hosted database accepts connections from the internet, so "Postgres itself answers only this Mac" describes the local stack only; the CLI login role's end state from AC-0022; the free plan pauses the project after about 7 days of low use, and a pause can be resumed for 90 days; no real data is loaded yet.
- Remove "(the hosted follow-on)" from "Insertion order and the hosted check".
- Make these eight sentence edits, each quoted from the current text (line breaks aside):
  1. `SYSTEM-SPEC.md` §3: "Primary user: the owner/operator of the processing business. One person for the MVP, non-technical, works partly at a desk and partly on the plant floor." becomes "Primary user: the business owner, who owns and operates the processing business: non-technical, working partly at a desk and partly on the plant floor. The MVP has one other user, the developer, who holds an account to help resolve issues."
  2. `SYSTEM-SPEC.md`: "The owner is the only user in the MVP." becomes "The business owner and the developer are the MVP's two users."
  3. `SYSTEM-SPEC.md` §10: "multi-user and roles beyond the single owner" becomes "users and roles beyond the business owner and the developer".
  4. `AGENTS.md` project overview: "The owner is its only user." becomes "The business owner uses it, and the developer, jaketlee07, holds an account to help resolve issues."
  5. `AGENTS.md` hard rule 7: "without the owner's approval." becomes "without the developer's approval."
  6. `docs/architecture/overview.md` opening: "Only the signed-in owner reaches it" becomes "Only the signed-in business owner and developer reach it".
  7. `docs/architecture/overview.md` "Create the owner account": "A hosted project needs the owner's approval before anything writes to it." becomes "A hosted project needs the developer's approval before anything writes to it (`AGENTS.md` hard rule 7)."
  8. `AGENTS.md` project overview: after edit 4's sentence, add this sentence: Wherever this repository asks for, requires, or records an approval of the work or a decision about it, or an accepted risk, "the owner" means the developer.
- After the completion handoff, delete the scratch env file and dumps.

**Done when:** the AC-0016, AC-0022, documentation, and lint results are in the ledger, and the completion handoff lists every AC-0017 run.

## Rollout

- **Delivery:** one developer-paced session. The migrations and the developer's account are lasting changes to the hosted project; a bad migration is fixed forward with a new file, as the overview's Areas table says.
- **Infrastructure:** no new service. The hosted project's two sign-in settings change, and Supabase makes a temporary login role whose end state AC-0022 reads.
- **External-system integration:** the hosted Supabase project must be running (not paused) for T2 to T6.
- **Deployment sequencing:** T1 and T2, then T3, T4, T5, and T6, in that order. Sign-up closes before the developer's account exists, and the allowlist insert waits for the AC-0008 check.

## Risks

- `npm test` on stack A can be slow when the Realtime slot holds back catalog cleanup; the known fix needs the developer's approval each build.
- The dashboard's labels may differ from the names in T2 and T4; the developer reads the settings by their meaning.
- A layout difference from a Supabase platform change other than `rls_auto_enable` would stop T3 for the developer.

## Probe #1 (2026-10-21)

Read-only, through the MCP connection and the CLI. The hosted project had no
migration history, no `supabase_migrations` or `private` schema, no table or
view in `public`, and no user or session in `auth`. Its one `public` function was
`rls_auto_enable()` (returns `event_trigger`, `SECURITY DEFINER`, owner
`postgres`, EXECUTE for `PUBLIC`, `anon`, `authenticated`, `service_role`), run by
the event trigger `ensure_rls` on each new `public` table. Its extensions were
`pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, and `uuid-ossp`; local
stack A also has `pg_graphql` and `pg_net`. Default privileges in `public` matched
the local stack's.

## Probe #2 (2026-10-21)

Through the MCP connection: `set transaction read only; set local role
authenticated; set local request.jwt.claims = '{"sub":"<made-up id>",...}';
select current_user, session_user, auth.uid(), current_setting('transaction_read_only')`
returned `authenticated`, `postgres`, the made-up id, and `on`. A read-only
`raise exception ... using errcode = '42501'` came back as `ERROR:  42501: ...`,
so the SQLSTATE is in the error text.

## Probe #3 (2026-10-21)

On local stack A: two runs of `supabase db dump --local -s public,private` gave
identical files (3,276 lines, 99 grant or revoke lines, 55 owner lines). Split at
blank lines, it has 443 paragraphs, and no grant or revoke paragraph names more
than one object. Every function, table, index, sequence, and view in `public` and
`private` is owned by `postgres`. The dump script deletes every line that starts
with `--`, so pg_dump's version comments do not reach the output.

## Probe #4 (2026-10-21)

On local stack A, Design's simulated calls, each in its own read-only
transaction, gave SQLSTATE `42501` for all 20 `public` functions. In one
transaction that was rolled back, a made-up user added to `private.operators`
passed `check_operator()`, and its `receive_lot` call failed on the made-up
product instead (not `42501`). Afterwards no row of the probe remained.

## Probe #5 (2026-10-21)

Read-only follow-up reads. The hosted `rls_auto_enable()` source has no blank
line (`position(E'\n\n' in prosrc)` is 0). On the hosted project and on stack A,
`anon` and `authenticated` are not superusers, do not bypass row level security,
cannot log in, and are members of no role; `authenticator` can log in and is a
member of `anon`, `authenticated`, and `service_role`. On stack A, the access
lists of `production_batch_lots`, `receipt_corrections`, and `v_sale_summary`
put `service_role` before `authenticated`, and the dump writes their grant lines
in that order. In a rolled-back transaction on stack A, `grant select ... to
authenticated, service_role` on a new table gave the access list
`authenticated` then `service_role`, and a revoke and re-grant of
`authenticated` moved it to the end. Stack A runs Postgres 17.6. A second read found no blank or whitespace-only
line (`~ E'\n[[:space:]]*\n'`) in the hosted `rls_auto_enable()` source or its
full definition, and stack A has no `reset_test_data` in any schema.

## Changelog

- 2026-10-21: initial plan.
- 2026-10-21: after review round 1 and the developer's decisions: the developer's account replaces the owner account in this rollout; grant lines compare as a set; added the role, positive-caller, empty-table, and object-list checks and the login-role end check; approval of the login role moved before the link; the AC-0005 read uses a prefixed query; the documentation edits gained `SYSTEM-SPEC.md` and `AGENTS.md`.
- 2026-10-21: after review round 2 and the developer's approver decision: the developer is named as the hosted-write approver in hard rule 7 and the overview; the user-count edits grew to seven sentences with exact text; AC-0017 covers every branch commit and its final run follows the last change; the comparison also sorts default-privilege lines; a failed preflight read stops the push; the account creation has its own approval; the push runs with the global `--yes`.
- 2026-10-21: after review round 3 and the developer's choices: one `AGENTS.md` sentence says what "the owner" means in approvals and recorded acceptances; AC-0017 runs before every push and post, with no pull request comment, and the branch is never force-pushed; the comparison's sorted paragraphs match AC-0006; the account uses the developer's personal email; no session link on this branch.
- 2026-10-21: after review round 4 and the developer's choices: the meaning sentence covers asking for, requiring, or recording an approval, a decision, or an accepted risk, and leaves other sentences as they are; AC-0017 also looks for a session link and is tied to the push it guards; the mailbox risk has one home, in the sign-in assumption; the account email is the developer's personal email.
- 2026-10-21: after review round 5: AC-0017 and the Always-do name any agent session link; the recovery step restores the session-link prefix too; the meaning sentence covers an approval of the work or a decision about it, so the app's own presses keep their meaning. The work-loop run was reset to restore the review-round budget, with every reviewed text and report kept.
