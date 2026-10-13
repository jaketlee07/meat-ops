# Run npm ci after a lockfile change

- **Status:** Draft


## Outcome

A folder that takes a change to `package-lock.json` from `main` runs its next tests on the locked versions, not on what it installed before.

## Boundary

- vitest-upgrade (PR #16) changed the lockfile. `meat-ops-invoice` and `meat-ops-sales`, which share stack A, keep Vitest 2.1.9 and its advisories until they run `npm ci` after merging `main`.
- Nothing warns: on the old runner the new `vitest.config.ts` still type-checks, and both suites stay green.
- `AGENTS.md` runs `npm ci` only in its folder set-up steps for each stack.
- `package.json` scripts cannot host a check: `.npmrc` sets `ignore-scripts=true`, which skips `pre` and `post` scripts.

## Owner

- jaketlee07

## Unresolved questions

- One `AGENTS.md` sentence, or a check before a test run that refuses when the installed packages differ from the lockfile?

## Projection

- One `AGENTS.md` sentence for the written route, or a direct-light change for a check.


## Source

- Mode: repo-origin
- Locator: docs/specs/vitest-upgrade/notes/verification-ledger.md
- Revision: 079586f
- Authority: repo-origin
