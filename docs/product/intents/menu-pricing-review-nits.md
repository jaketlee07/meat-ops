# Menu-pricing review refinements

- **Status:** Draft


## Outcome

Every menu-pricing behavior a test claims to pin can fail when it breaks, and the pricing view states each price rule once.

## Boundary

- A pricing page state whose raw input value and fee name each run wider than 320 px with no spaces passes the 320 px scroll-width check, so removing `min-w-0` from the Figure row in src/app/pricing/figure.tsx turns a test red.
- The Back test in test/e2e/pricing.spec.ts reads as construction coverage, not as an AC-0124 contract test; AC-0124 is closed by the Show prices test.
- The pricing view computes the suggested list price and the margin at list price once and derives the price action, needs-new-price, and below-target flags from them, through a new migration (supabase/migrations/20261009070619_menu_pricing.sql lines 55 to 74 repeat both), with the rounding-edge test in test/pricing.test.ts still green.

## Owner

- jaketlee07

## Unresolved questions

- Is the view refactor worth a migration of its own, or does it ride the next change to v_product_pricing?

## Projection

- A direct-light change for the two tests; the view refactor rides the next migration that touches v_product_pricing, or a small spec.


## Source

- Mode: repo-origin
- Locator: docs/specs/menu-pricing/notes/verification-ledger.md
- Revision: 1f93cdf
- Authority: repo-origin
