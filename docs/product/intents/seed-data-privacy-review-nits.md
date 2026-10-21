# Seed-data privacy: two review points set aside at build

- **Status:** Draft


## Outcome

`.gitignore` still ignores `/private` after the next agent-bundle install, and the owner has decided whether hard rule 8 also says agents do not read `private/` unless the owner asks.

## Boundary

- Reinstall: the `/private` rule sits above the `.gitignore` block that the agent-bundle installer writes, marked "merged from .gitignore.upstream", which has no end marker. No review could show whether a reinstall rewrites only that block or the whole file. The shaping reviewer listed it as an unverified gap in all four seed-data-privacy spec rounds. If the rule is dropped, this folder's `.git/info/exclude` backstop still ignores `private`, but other clones would not.
- Agent sessions: an agent session that opens a file in `private/` keeps its contents in the session transcript, and commits here link their session in a `Claude-Session` trailer. Hard rule 8 covers git and GitHub only. The security reviewer listed this as not checked in seed-data-privacy spec rounds 1 and 2.

## Owner

- jaketlee07

## Unresolved questions

- Should hard rule 8 say agents do not read `private/` unless the owner asks?

## Projection

- A one-time check of `.gitignore` after the next agent-bundle install, and, if the owner wants it, one sentence added to hard rule 8 in `AGENTS.md`.


## Source

- Mode: repo-origin
- Locator: docs/specs/seed-data-privacy/plan.md
- Revision: 3e91040
- Authority: repo-origin
