# Plan: seed-data-privacy

- **Spec:** [`spec.md`](spec.md)
- **Status:** Done <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** none, non-structural. The ignore rule follows the `.gitignore` "local env files" block (a comment that says why, then a root-anchored pattern, as `/node_modules` and `/coverage` are). The rule joins the `AGENTS.md` Hard rules list. Uncertainty: none; no module, seam, or test changes

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/seed-data-privacy/notes/verification-ledger.md`. A genuine
> artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

Four small text changes, each with its own check. T1 adds one root-anchored
rule to `.gitignore` and checks it from a fresh clone, so only the committed
rule counts. T2 adds the made-up label to `supabase/seed.sql` and `test/db.ts`
and rewords the seed comments that point at a sheet. A diff check shows only
comment lines moved. T3 adds hard rule 8 to `AGENTS.md`. T4 adds the same
pattern to this folder's local `info/exclude`, so older branches and a revert
still ignore the folder here. No app, database, or test behavior changes, so the
existing suites are the regression gate. The riskiest part is the pattern's
shape: an unanchored pattern would also ignore any later folder named `private`
deeper in the tree, and a trailing slash would let a link named `private`
through. AC-0001 and AC-0002 catch both.

## Constraints

- `AGENTS.md` hard rules: 4 (no em dashes in comments or commit messages), 5 (commit format), and 7 (nothing writes to the hosted project).
- `docs/architecture/overview.md`, area table: `supabase/seed.sql` stays loadable after `supabase db reset`. Only comment lines change, so its statements stay as they are.
- The spec's Never do: comment lines only in the two data files, no tracked file under `private`, and no local git change beyond the AC-0007 lines.

## Construction tests

**Integration tests:** none beyond per-task tests.
**Regression gates:** after T1 to T4, `npm run typecheck` and `npm test` pass, run once from this folder after the `AGENTS.md` folder check.
**Manual verification:** the T1 to T4 checks, in the verification ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Repository ignore rule: `.gitignore` | T1 | The AC-0001 and AC-0002 checks from a fresh clone | The rule is in the merged tree |
| Demo and test data labels | T2 | The AC-0003, AC-0004, and AC-0005 checks and the comments-only diff | Both labels are in the merged tree |
| Agent guidance: `AGENTS.md` hard rule 8 | T3 | The AC-0006 comparison | Rule 8 is in the merged tree |
| Local backstop: `info/exclude` | T4 | The T4 AC-0007 check | The ledger holds the result |
| Execution record: `notes/verification-ledger.md` | T1, T2, T3, T4 | The checks and the gate results | The ledger holds each |
| Intent and lifecycle closeout | none | none | close-work |

## Design (LLD)

### Design decisions

- **A root-anchored pattern with no trailing slash, `/private`.** The leading slash ties it to the repository root, so `src/app/private/` stays trackable. With no trailing slash it matches the root entry whatever it is: a folder, a link to a folder kept elsewhere, or a file. Git never looks inside an ignored folder, so one match on the entry covers everything under it. Probes #3 and #4 ran this shape. Traces to: AC-0001, AC-0002.
- **The block sits in the project's own part of `.gitignore`.** It goes right after the "local env files" block, above the "agent bundle (merged from .gitignore.upstream)" block, so a later re-merge of that block cannot drop it. Traces to: AC-0001.
- **The local backstop adds to the shared rule; it does not replace it.** `info/exclude` is never committed, so it protects only this folder and its worktrees. The shared rule protects every clone of a commit that has it. Together they cover a checkout of an older branch here. Its lines sit above the tool-written `# claude-code-runtime` block, which has no end marker, so a rewrite of that block cannot remove them (owner ruling, 2026-10-20, in the ledger). Traces to: AC-0007.
- **No other guard.** The owner accepted on 2026-10-20 that rule 8 alone covers a forced add and real data typed into a commit, pull request, or issue (spec Assumptions). Traces to: the spec's Ask first.
- **The label is one exact line near the top.** Each file says it once, where a reader starts, as AC-0003 and AC-0005 place it. Traces to: AC-0003, AC-0005.

### Behavior & rules

- **The `.gitignore` block.** Inserted after the `!.env.example` line, before `# vercel`:

  ```gitignore
  # Real business files: the catalog, price sheets, and invoices. Git never
  # tracks them, whether private is a folder or a link (AGENTS.md hard rule 8).
  /private
  ```

- **The seed comments.** The opening banner of `supabase/seed.sql` becomes:

  ```sql
  -- ============================================================
  -- Demo seed.
  -- Every name, price, and figure in this file is made up.
  -- The demo product's final price is $2.68/lb, invariant 2 (the pricing
  -- tie-out) in docs/costing.md.
  -- ============================================================
  ```

  The fee comment becomes `-- Fee types (per-lb processing and margin fees)`, so
  it no longer points at a sheet's columns. The comment above the first
  `receive_lot` call loses its `(ties to the sheet)` ending and reads
  `-- Receive raw at $1.68/lb -> pricing view should read $2.68 final`.
- **The test file label.** `// Every name, price, and figure in this file is made up.` and then a `//` line go right after the imports in `test/db.ts`, above the existing `// Direct Postgres access ...` comment.
- **The local backstop.** Two lines inserted just above the `# claude-code-runtime` line of `$(git rev-parse --git-common-dir)/info/exclude`: `# Real business files (AGENTS.md hard rule 8), on every branch in this folder.` and `/private`.

## Tasks

### T1: Git ignores the root entry `private` and nothing else

**Depends on:** none

**Touches:** `.gitignore`, `docs/specs/seed-data-privacy/notes/verification-ledger.md`

**Tests:** no stub (goal-based check, recorded in the ledger)
- AC-0001 and AC-0002 run in a fresh clone made after the T1 commit: `git clone -q --no-local --branch chore/seed-data-privacy <this folder> <scratch>/clone`, then from inside it:
  ```bash
  git check-ignore -v private
  git check-ignore -v --no-index src/app/private/page.tsx supabase/private/seed.sql
  git ls-files -z | git check-ignore -v --no-index -z --stdin | tr '\0' '\n' | grep -cx '/private'
  ```
  The first prints one line whose source is `.gitignore` and whose pattern is `/private`, and exits 0. The second prints nothing and exits 1. The third prints `0`, and the ledger records the full `--stdin` output beside it. `grep -c` exits 1 on a count of 0, so this command runs on its own, outside any `&&` chain.
- In the same clone, a real folder holding `private/catalog.sql`, `private/price-sheets/2026-10.xlsx`, and `private/invoices/2026-10/photo.jpg`, each one made-up line, is absent from `git status --porcelain --untracked-files=all`, and `git add --dry-run private/catalog.sql` exits 1. The folder is then replaced by a link named `private` to an empty scratch folder, which is also absent from that status. Both are deleted after.

**Approach:**
- Insert the block from Behavior & rules.
- Delete the scratch clone after the checks.

**Done when:** the T1 Tests hold and the ledger records them.

### T2: The demo seed and the test data say they are made up

**Depends on:** none

**Touches:** `supabase/seed.sql`, `test/db.ts`, `docs/specs/seed-data-privacy/notes/verification-ledger.md`

**Tests:** no stub (goal-based check, recorded in the ledger)
- AC-0003 and AC-0005: each command prints the label's line number, then the first statement's line number, and exits 0 only when the label comes first.
  ```bash
  awk -v want='-- Every name, price, and figure in this file is made up.' '$0 == want { print "label " NR; found = 1 } /^insert/ { print "first insert " NR; exit } END { exit !found }' supabase/seed.sql
  awk -v want='// Every name, price, and figure in this file is made up.' '$0 == want { print "label " NR; found = 1 } /^export/ { print "first export " NR; exit } END { exit !found }' test/db.ts
  ```
- AC-0004: `grep -ci sheet supabase/seed.sql` prints `0`. It prints `2` at base `cc15c04`. It runs on its own, outside any `&&` chain.
- The spec's comments-only rule: after `git fetch origin`, these print nothing. Each reads one file's added or removed lines since the merge base, skips the file-name headers, and drops lines that are wholly a comment in that file's own marker.
  ```bash
  B="$(git merge-base origin/main HEAD)"
  git diff -U0 "$B" -- supabase/seed.sql | grep -E '^[+-]' | grep -vE '^(\+\+\+ b/|--- a/)' | grep -vE '^[+-][[:space:]]*--'
  git diff -U0 "$B" -- test/db.ts | grep -E '^[+-]' | grep -vE '^(\+\+\+ b/|--- a/)' | grep -vE '^[+-][[:space:]]*//'
  ```

**Approach:**
- Rewrite the seed's opening banner, its fee comment, and its first `receive_lot` comment, and add the test file label, as Behavior & rules gives them.

**Done when:** the T2 Tests hold and the ledger records them.

### T3: `AGENTS.md` carries hard rule 8

**Depends on:** none

**Touches:** `AGENTS.md`, `docs/specs/seed-data-privacy/notes/verification-ledger.md`

**Tests:** no stub (goal-based check, recorded in the ledger)
- AC-0006: this prints nothing and exits 0. The first command prints the last non-blank line of the `## Hard rules` section; the second prints the line inside the spec's AC-0006 code block.
  ```bash
  diff <(awk '/^## Hard rules/ { s = 1; next } /^## / { s = 0 } s && NF { last = $0 } END { print last }' AGENTS.md) <(sed -n '/^  ```markdown$/,/^  ```$/p' docs/specs/seed-data-privacy/spec.md | sed '1d;$d;s/^  //')
  ```

**Approach:**
- Add the line after rule 7, with no blank line between them.

**Done when:** the T3 Tests hold and the ledger records them.

### T4: This folder ignores `private` on commits without the shared rule

**Depends on:** none

**Touches:** the `info/exclude` file in this folder's git directory (untracked), `docs/specs/seed-data-privacy/notes/verification-ledger.md`

**Tests:** no stub (goal-based check, recorded in the ledger)
- Before the change, `grep -cx '/private' "$(git rev-parse --git-common-dir)/info/exclude"` prints `0`; after it, `1`. Each runs on its own, outside any `&&` chain.
- After the change, this prints both line numbers and exits 0 only when `/private` comes before the `# claude-code-runtime` line:
  ```bash
  awk '/^\/private$/ { p = NR } /^# claude-code-runtime/ { c = NR } END { print p, c; exit !(p && c && p < c) }' "$(git rev-parse --git-common-dir)/info/exclude"
  ```
- AC-0007: `git worktree add --detach <scratch>/old cc15c04` (a commit on `main` whose `.gitignore` has no rule matching `private`), then `git -C <scratch>/old check-ignore -v private` prints one line whose source ends in `info/exclude` and whose pattern is `/private`, and exits 0. Then `git worktree remove <scratch>/old`, and `git worktree list` shows only this folder and any worktrees it showed before.

**Approach:**
- Insert the two lines from Behavior & rules.

**Done when:** the T4 Tests hold and the ledger records them.

## Rollout

- **Delivery:** one PR.
- **Reverting:** once `private` holds real files, a revert must keep the `/private` rule, or wait until `private` is empty or moved out of the repository. In this folder the local backstop still ignores it; in any other clone nothing would.
- **Owner step after merge:** the owner creates `private` (a folder, or a link to a backed-up folder) and keeps real files there. Loading them into the hosted project stays with the hosted rollout intent.

## Risks

- Checking out an older branch or commit, or reverting this change, leaves `private` ignored only through the local backstop, which exists in this folder alone.
- `git add -f` and real data typed into a tracked file, commit message, pull request, or issue have no guard beyond hard rule 8; the owner accepted this on 2026-10-20.
- `npm test` adds catalog bloat on stack A (the `local-stack-catalog-bloat` intent). If a run is slower than the last, check `pg_stat_sys_tables` before blaming the change.

## Probe #1 (2026-10-20)

A throwaway clone of this branch at `cc15c04`, with a `/private/` rule appended
to its `.gitignore`. `git check-ignore -v` attributed `private/catalog.sql` and
`private/invoices/2026-10/photo.jpg` to that rule and exited 0. It ignored
neither `src/app/private/page.tsx` nor `supabase/private/seed.sql` (exit 1).
Over every tracked file, it named only `.adapt-install-marker.toml` and
`.env.example` (the `!.env.example` exception), never the new rule. A probe file
in `private/` stayed out of `git status`, and `git add --dry-run` refused it
with exit 1. Nothing from the probe was kept.

## Probe #2 (2026-10-20)

A second throwaway clone at `cc15c04`, with the T2 and T3 text applied by a
script. Each T2 and T3 command gave its expected result: the seed label before
the first `insert`, the test label before the first `export`, an empty
comments-only diff, and an empty AC-0006 `diff`. The same comments-only command
printed both lines of a one-letter change to a vendor name. It also showed that
the seed holds two lines naming a sheet, which T2 rewords. Nothing from the
probe was kept.

## Probe #3 (2026-10-20)

A throwaway repository. With `/private/`, a link named `private` showed in
`git status` as `?? private`, and `git check-ignore private` exited 1. With
`/private`, the same link was ignored, `git check-ignore -v private` named the
rule, a real folder's files were ignored, and `src/app/private/page.tsx` was
not. With `/private` only in the repository's `info/exclude`, a worktree
detached at an older commit ignored `private/c.sql` and `git check-ignore -v`
named that `info/exclude` file. Nothing from the probe was kept.

## Probe #4 (2026-10-20)

A throwaway clone of this branch at `cc15c04`, with the T1 block inserted after
`!.env.example`. `git check-ignore -v private` printed `.gitignore:40:/private`
and exited 0. It ignored neither `src/app/private/page.tsx` nor
`supabase/private/seed.sql` (exit 1), and the sweep over every tracked file
counted 0 lines for `/private`. A real folder holding a catalog, a price sheet,
and an invoice photo stayed out of `git status`, `git add --dry-run` refused the
catalog with exit 1, and a link named `private` also stayed out. Nothing from
the probe was kept.

## Changelog

- 2026-10-20: initial plan
- 2026-10-20: round 1. The pattern drops its trailing slash so a link named `private` is ignored, and moves above the agent bundle block. T4 adds the local backstop the owner chose. T2 also rewords the fee comment and points the banner at invariant 2. The comments-only diff starts at the merge base. Rollout and Risks name reverts and older checkouts.
- 2026-10-20: round 2. The comments-only check runs per file, with each file's own comment marker. AC-0007's worktree sits at `cc15c04`. The backstop lines go above the `# claude-code-runtime` block, as the owner ruled. Probe #4 records the `/private` run in a clone of this tree.
- 2026-10-21: round 3. The durable-output map points at the T4 check instead of naming a commit.
