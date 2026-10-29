# Vite upgrade for a dev-tool advisory

- **Status:** Draft


## Outcome

`npm audit` with dev dependencies included reports no advisory in `vite`, while `npm run audit` and `npm test` still pass.

## Boundary

- `vite` 8.3.2 comes in through `vitest` 5.0.3 and `@vitest/mocker`; `package.json` does not name it. `npm audit` reports one high advisory for vite 8.3.0 to 8.3.2, made of 6 GitHub advisories: GHSA-698v-4r3x-3vcv, GHSA-r825-w8mm-5pxw, GHSA-587h-7wmj-h5pm, GHSA-9jrq-w75r-8gcw, GHSA-rq7h-c2jc-7f22, and GHSA-vfpm-58rq-9qcg.
- Test tooling only: `npm run audit`, which checks shipped dependencies, passes today and must keep passing.
- Ship it as its own change, resolved with a 7-day publish cutoff and installed with `npm ci --ignore-scripts`.
- `npm test` stays green, golden costing suite included.

## Owner

- jaketlee07

## Unresolved questions

- Does a lockfile-only move to vite 8.3.3 or later (8.3.3 was published 2026-10-06) clear all 6 inside Vitest 5.0.3's range, or does Vitest need to move too?

## Projection

- A small dependency change through work-loop, like vitest-upgrade (PR #16).


## Source

- Mode: repo-origin
- Locator: docs/specs/next-security-upgrade/notes/verification-ledger.md
- Revision: ed4d5c1
- Authority: repo-origin
