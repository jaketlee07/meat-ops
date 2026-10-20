# Purchasing advisor

- **Status:** Draft


## Outcome

When a raw product runs low, the owner sees which vendor gives the lowest cost per finished lb after shrink, as `SYSTEM-SPEC.md` section 7 "Advise" describes, beside the low-stock alert's order amount.

## Boundary

- Today the low-stock alert suggests only an amount (14 days at the last 28 days' use) and a link to Receiving; it names no vendor.
- Ranking on post-shrink cost needs each vendor's receipt costs and the shrink of the batches made from their lots.
- No purchase record is made, as the alerts spec's Assumptions say; the owner still receives through Receiving.

## Owner

- jaketlee07

## Unresolved questions

- Does the advisor rank on each vendor's last receipt, or on an average over recent receipts?
- Does the ranking sit on the low-stock alert, or on its own screen?

## Projection

- A new spec through new-spec, full mode, since it adds a database read over costs and shrink.


## Source

- Mode: repo-origin
- Locator: docs/specs/alerts/spec.md
- Revision: 895d232
- Authority: repo-origin
