# Vitest upgrade for dev-tool advisories

- **Status:** Draft


## Outcome

`npm audit` with dev dependencies included reports none of the 6 advisories now in the Vitest 2.1.9 tree (2 critical, 1 high, 3 moderate).

## Boundary

- Upgrade `vitest` (`^2.1.0` in package.json, 2.1.9 installed) far enough to clear the advisories in `tinypool`, `vite`, `vite-node`, `esbuild`, and `@vitest/mocker`.
- Ship it as its own change, not folded into feature work.
- The advisories sit only in test tooling: `npm run audit`, which checks shipped dependencies, passes today and must keep passing.
- `npm test` stays green, golden costing suite included.

## Owner

- jaketlee07

## Unresolved questions

- Which Vitest major clears all 6 advisories, and does it need config or test changes?

## Projection

- A standalone dependency upgrade through work-loop, once scheduled.


## Source

- Mode: repo-origin
- Locator: docs/specs/receiving/notes/verification-ledger.md
- Revision: ea93f59
- Authority: repo-origin
