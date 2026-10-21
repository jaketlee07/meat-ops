# Spec: seed-data-privacy

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the intent [`docs/product/intents/seed-data-privacy.md`](../../product/intents/seed-data-privacy.md) (its Outcome and Boundary); the `AGENTS.md` hard rules; the intent [`docs/product/intents/hosted-supabase-rollout.md`](../../product/intents/hosted-supabase-rollout.md), which owns loading real data into the hosted project
- **Brief:** none
- **Discovery:** none
- **Contract:** none (no published interface changes)
- **Shape:** mixed

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
[seed data privacy intent](../../product/intents/seed-data-privacy.md): real
business names, prices, and customers never become public through this public
repository. The demo and test data are made up, so nothing already in git needs
to move.

- **A home for real files that git never tracks.** The owner keeps the real
  catalog, price sheets, and invoices in an entry named `private` at the
  repository root, a folder or a link to one. Git ignores it and everything in
  it, in every clone, and ignores nothing else because of it. In the owner's
  own folder, a local ignore line also covers older branches and commits that
  predate the shared rule.
- **Demo and test data that say they are made up.** `supabase/seed.sql` and
  `test/db.ts` each carry the made-up label near the top, as AC-0003 and AC-0005
  place it. The seed names no pricing sheet. No name, price, or figure changes, so no test or
  golden number moves.
- **A rule every session reads.** `AGENTS.md` carries a hard rule that keeps
  real business data out of git and GitHub, for the owner and for agents alike.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Agent guidance | Applicable: the rule must reach every session that works in the repository | `AGENTS.md`, Hard rules | work-loop | Hard rule 8, checked by AC-0006 | close-work finds rule 8 in the merged tree |
| Repository ignore rules | Applicable: git must ignore the entry in every clone | the repository-root `.gitignore` | work-loop | The new rule, checked by AC-0001 and AC-0002 | close-work finds the rule in the merged tree |
| Local backstop | Applicable: the owner's folder must ignore the entry on commits that predate the shared rule | the `info/exclude` file in this folder's git directory (untracked) | work-loop | The line, checked by AC-0007 and recorded in the ledger | close-work finds the AC-0007 result in the ledger |
| Demo and test data labels | Applicable: the intent asks for clearly made-up data | `supabase/seed.sql`, `test/db.ts` | work-loop | The label lines, checked by AC-0003, AC-0004, and AC-0005 | close-work finds both labels in the merged tree |
| Execution record | Applicable: the checks and gate results need a home outside the contract | `docs/specs/seed-data-privacy/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every check the Testing Strategy routes to it |
| Intent closeout | Applicable: this spec delivers a backlog intent | `docs/product/intents/seed-data-privacy.md`, `workspace.toml` `[backlog]` | close-work | none | close-work marks the intent Fulfilled and its entry leaves `open` |
| Lifecycle closeout | Applicable: delivered work is recorded when it ships | `docs/lifecycle/seed-data-privacy.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Applicable when the build teaches something that would change a future approach | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |
| Loading the real catalog | Not applicable: the hosted rollout intent owns when and how real data reaches the hosted project, and this spec does not change it | none | n/a | n/a | n/a |
| Architecture map | Not applicable: `private` holds no tracked file, so it is not an area of the repository; the rule's one home is `AGENTS.md` | none | n/a | n/a | n/a |
| Master brief and costing truth | Not applicable: no rule, table, or golden number changes in `SYSTEM-SPEC.md` or `docs/costing.md` | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions | none | n/a | n/a | n/a |
| User documentation and release history | Not applicable: no page, label, message, command, or setup step changes, and nothing is released | none | n/a | n/a | n/a |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Follow the `AGENTS.md` hard rules.
- Use only made-up names and figures in every file this work writes, the ledger and every probe file included.
- Delete every probe file, link, and worktree a check makes before that check ends.

### Ask first

- Changing any name, price, or figure in the demo or test data, anywhere in the repository.
- Changing any `AGENTS.md` text other than adding hard rule 8.
- Adding a hook, a script, a test, a CI check, or a Claude Code settings entry.

### Never do

- No new dependency, no new module, and no new tracked file in this spec's PR outside `docs/specs/seed-data-privacy/`.
- No change to `supabase/seed.sql` or `test/db.ts` in which an added or removed line is not wholly a comment (`--` in the seed, `//` in the test file).
- No tracked file under `private`, and no `git add -f` or `git add --force` of an ignored path.
- No change to this folder's git settings or local ignore files other than the lines AC-0007 needs in `info/exclude`.
- No write to the hosted project, no history rewrite, and no force-push.

## Testing Strategy

- **Goal-based checks, recorded in the verification ledger (AC-0001, AC-0002).** An ignore rule is a property of git, so `git check-ignore` settles each one. The check runs against the committed rule, from a fresh clone of the branch, so a rule kept only in this machine's own git settings cannot pass it. The plan gives the commands.
- **Goal-based check, recorded in the verification ledger (AC-0007).** The local backstop matters on commits without the shared rule, so `git check-ignore` runs in a temporary worktree of this folder at a commit that predates the shared rule. The worktree shares this folder's `info/exclude`.
- **Goal-based checks, recorded in the verification ledger (AC-0003, AC-0004, AC-0005, AC-0006).** Each criterion is a literal line in a file, or the absence of a word, so a `grep` or `awk` over the committed file settles it, scoped to the region the criterion names.
- **Goal-based check of the comments-only Never-do rule, recorded in the verification ledger.** A diff of `supabase/seed.sql` and `test/db.ts` from the merge base of this branch and `origin/main` shows that rule holds. No suite loads `supabase/seed.sql`, so this check is what shows the seed still loads.
- **The existing suites, run by `npm test` and `npm run typecheck`.** No app, database, or test behavior changes, so no new test is added. Both read `test/db.ts`, so they show its comment edit broke nothing.

## Acceptance Criteria

### The private folder

- [x] **AC-0001.** In a fresh clone of the branch, where no entry named `private` exists, `git check-ignore -v private` reports the root entry `private` as ignored and attributes it to a rule in the repository-root `.gitignore`.
- [x] **AC-0002.** The rule AC-0001 names ignores no path outside the root entry `private` and what is under it: `git check-ignore -v --no-index` attributes nothing to it for `src/app/private/page.tsx`, for `supabase/private/seed.sql`, or for any file that `git ls-files` lists.
- [x] **AC-0007.** In a temporary worktree of this folder, detached at a commit that predates the shared rule, `git check-ignore -v private` reports the root entry `private` as ignored and attributes it to the `info/exclude` file in this folder's git directory.

### The made-up data

- [x] **AC-0003.** `supabase/seed.sql` holds the line `-- Every name, price, and figure in this file is made up.` before its first line that starts with `insert`.
- [x] **AC-0004.** No line of `supabase/seed.sql` contains the text `sheet`, in any letter case.
- [x] **AC-0005.** `test/db.ts` holds the line `// Every name, price, and figure in this file is made up.` before its first line that starts with `export`.

### The rule

- [x] **AC-0006.** The `## Hard rules` list in `AGENTS.md` ends with this line, exactly:

  ```markdown
  8. Real business data never enters git or GitHub. Keep real vendor, customer, and brand names, real costs, prices, and fees, and real invoices and their photos in the gitignored `private/` folder at the repository root. Never force-add a file from it, and never put real business data in a tracked file, a commit message, a pull request, or an issue. Test and demo data are made up.
  ```

## Follow-ons

None.

## Assumptions

- Product: none of the demo data is real. The vendor, customer, and brand names, the fee names, the prices and fees, and the product details in `supabase/seed.sql`, `test/db.ts`, the tests, and `docs/costing.md` are all made up (source: user confirmation 2026-10-20).
- Product: the real catalog lives in a gitignored `private/` folder, and the repository stays public (source: user confirmation 2026-10-20).
- Product: a one-line label in `supabase/seed.sql` and `test/db.ts` makes the data clearly made up; no name is renamed (source: user confirmation 2026-10-20).
- Product: hard rule 8 is the text AC-0006 gives (source: user confirmation 2026-10-20).
- Product: this folder's local ignore file also covers `private`, as a backstop for older branches, older commits, and a revert. Its lines sit above the tool-written `# claude-code-runtime` block (source: user confirmation 2026-10-20).
- Product: the owner accepts that nothing beyond hard rule 8 stops a forced add from `private`, or real data typed into a tracked file, a commit message, a pull request, or an issue (source: user confirmation 2026-10-20).
- Technical: the repository is public on GitHub (source: `gh repo view`).
- Technical: no path named `private` is tracked, and git does not ignore `private/` yet (source: `git ls-files | grep -i private` printed nothing; `git check-ignore private/catalog.sql` exited 1).
- Technical: `git ls-files -ci --exclude-standard` already lists one tracked file, `.adapt-install-marker.toml`, so AC-0002 reads only lines attributed to the new rule (source: the command's output, 2026-10-20).
- Technical: git matches a pattern that ends in `/` only against folders, so a link named `private` slips past `/private/` but not `/private`. A worktree reads the `info/exclude` file of the folder it was made from (source: plan.md probe #3, 2026-10-20).
- Technical: `supabase db reset` does not load seed files, and `supabase/seed.sql` is loaded by hand through psql, so a file in `private` never loads into a local stack by itself (source: `supabase/config.toml` `[db.seed]`).
- Process: before each test run, the folder check in the `AGENTS.md` section "Run two folders' tests at once" decides which stack this folder may test on. The owner approves the spec and then the plan in chat (source: `AGENTS.md`; menu-pricing-review precedent).
