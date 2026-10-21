# Menu-pricing review: one review nit set aside at build

- **Status:** Draft


## Outcome

The next rolled-back probe that compares a replaced view with its old definition prints, inside its own session and before it puts the old definition back, which definition the stack holds, so its stored output proves it compared against the migrated view; or the owner records the separate count as enough.

## Boundary

- The menu-pricing-review T1 probe compared the migrated `v_product_pricing` with the menu-pricing one and found 0 differing rows. Its stored output (`t1-probe-output.txt` in the ignored `.context/reviews/1dc7d451-7a63-40e0-b24c-c6d5b21cf37e/evidence/` folder, on this Mac only) holds no `pg_get_viewdef` read, so on an unmigrated stack it would print the same zeros. Only the ledger's two `1|1` count lines, run outside the probe session, show the stack was migrated.
- Post-gates adversarial review round 1 raised it as a Nit. Adjudication found the observation true and refuted the finding only because no rule requires the stored output to carry its own count.

## Owner

- jaketlee07

## Unresolved questions

- Should a standing probe recipe say this, or is a line in the next view-rewrite plan enough?

## Projection

- No change now: a line in the next view-rewrite plan's probe task, or the owner records the separate count as accepted.


## Source

- Mode: repo-origin
- Locator: docs/specs/menu-pricing-review/notes/verification-ledger.md
- Revision: 45779f1
- Authority: repo-origin
