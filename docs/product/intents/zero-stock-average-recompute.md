# Zero-stock average after voids

- **Status:** Draft


## Outcome

When voids leave a raw product with 0 lbs on hand, its average equals what it would be had the voided receipts never been entered, whatever order they were voided in. The same holds when a cost correction leaves 0 lbs on hand, where the average keeps its stored value today, and when a void's zero-stock value carries a corrected receipt's cost through a lot's prior average.

## Boundary

- Replace the three zero-stock steps in the void_receipt section of docs/costing.md with a recompute from the non-void lots alone.
- Keep every other costing rule and the seven golden invariants unchanged.
- Land before real business data is loaded.

## Owner

- jaketlee07

## Unresolved questions

- Which value applies when the last non-void lot was adjusted to 0 rather than consumed?
- How are events in one transaction ordered for the recompute?

## Projection

- A spec that amends AC-0053 and replaces the known limit in docs/costing.md.


## Source

- Mode: repo-origin
- Locator: docs/specs/foundation-hardening/spec.md
- Revision: adcb0a0
- Authority: repo-origin
