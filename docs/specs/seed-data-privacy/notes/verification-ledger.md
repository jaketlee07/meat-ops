# Verification ledger: seed-data-privacy

Execution observations for [`../spec.md`](../spec.md) and [`../plan.md`](../plan.md).
Review artifacts sit under the ignored `.context/reviews/67db4740-1cf1-4938-b921-fa8377b7ee9d/`.

## Owner decisions (2026-10-20)

- The local backstop's lines go just above the `# claude-code-runtime` header in this folder's `info/exclude`, so a rewrite of that tool-written block cannot remove them. This settles round-2 security finding 1, which the adjudicator left indeterminate because no source shows whether that block's writer rewrites the lines after it.

## Approval (2026-10-21)

- The owner approved the spec and then the plan in chat on 2026-10-21, after spec-stage review came back clean.
- Work-loop run `67db4740-1cf1-4938-b921-fa8377b7ee9d`. `approve-plan` recorded spec hash `b1a19c47a0b0…` and plan hash `eab26b5016a3…`. The schedule has one wave (T1, T2, T3, T4), run one task at a time.
- Base: `cc15c04` on branch `chore/seed-data-privacy`, on stack A, which only this folder uses.
- The controller made each task's edit itself rather than dispatching the implementer subagent: each is a few comment or config lines whose exact text the plan's Behavior & rules gives.
- Project knowledge: capture at the spec and plan gates was not attempted. It refused with `strict_parse` in the menu-pricing-review run on 2026-10-20, so this run records it as unavailable.

## Spec-stage review

Four rounds, each after the first over the delta since the previous one. Counts are findings that survived adjudication (adversarial, security) or that the shaping reviewer raised.

| Round | Adversarial | Security | Shaping |
| ---: | --- | --- | --- |
| 1 | 4 Nits (1 refuted) | 2 Nits (1 refuted) | 2 Medium, 4 Low |
| 2 | 2 Nits | 1 indeterminate, settled by the owner | 3 Low |
| 3 | 1 Nit | direct clean | 2 Low |
| 4 | direct clean | not re-run (clean in round 3; the delta touched only wording) | Clean |

- Pre-EXECUTE gates not fired: design-intent review (no page changes) and frontend pre-flight (no HTML, CSS, or JS output).

## T1: the ignore rule (commit `17323f8`)

Run in a fresh clone of the branch at `17323f8`, where no entry named `private` existed:

- AC-0001: `git check-ignore -v private` printed `.gitignore:40:/private	private` and exited 0.
- AC-0002: `git check-ignore -v --no-index src/app/private/page.tsx supabase/private/seed.sql` printed nothing and exited 1. Over every tracked file, the `--stdin` sweep matched only `.adapt-install-marker.toml` (`.gitignore` line 54) and `.env.example` (line 36, `!.env.example`), and its count of `/private` lines was `0`.
- A real folder holding `private/catalog.sql`, `private/price-sheets/2026-10.xlsx`, and `private/invoices/2026-10/photo.jpg`, each one made-up line, was absent from `git status --porcelain --untracked-files=all`. `git add --dry-run private/catalog.sql` exited 1. A link named `private` to an empty scratch folder was also absent from that status. The clone, folder, and link were deleted.

## T2: the labels (commit `f1f6e4c`)

- AC-0003: the awk check printed `label 3`, then `first insert 9`, and exited 0.
- AC-0005: the awk check printed `label 7`, then `first export 37`, and exited 0.
- AC-0004: `grep -ci sheet supabase/seed.sql` printed `0`.
- Comments-only rule: after `git fetch origin`, the merge base was `cc15c048e4c9`. Both per-file checks printed nothing (exit 1 from the last `grep`). The two files changed by 8 added and 3 removed lines.

## T3: hard rule 8 (commit `bbbdfd5`)

- AC-0006: the `diff` of the last non-blank `## Hard rules` line against the spec's code block printed nothing and exited 0. The added line holds no em dash.

## T4: the local backstop (untracked)

- Before the change, `grep -cx '/private' .git/info/exclude` printed `0`; after it, `1`.
- The position check printed `8 9` (`/private` at line 8, `# claude-code-runtime` at line 9) and exited 0. A `diff` against a scratch copy of the file from before the change showed only the two inserted lines.
- AC-0007: `git worktree add --detach <scratch>/old cc15c04`, then `git -C <scratch>/old check-ignore -v private` printed `/Users/jakelee/Developer/meat-ops/.git/info/exclude:8:/private	private` and exited 0. `.gitignore` at `cc15c04` has no rule for `private`. `git worktree remove` then left `git worktree list` showing only this folder, as before.

## Gates (2026-10-21, at `bbbdfd5`)

- The `AGENTS.md` folder check listed no folder running tests or the app; this folder has no `supabase/.env`, so it is on stack A.
- `npm run typecheck`: pass.
- `npm test`: pass. Vitest 52 files and 1039 tests; Playwright 667 tests in 12.7 min; 890 s in all.
