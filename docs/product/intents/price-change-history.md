# List price change history for price-stale alerts

- **Status:** Draft


## Outcome

The price-stale alert (SYSTEM-SPEC §13 item 7) can tell when a product's list price last moved and what its cost per lb was then.

## Boundary

- Each list-price change records when it happened and the product's cost per lb at that moment.
- The app changes list prices only through set_list_price, but Studio and the update grant that operators and service_role hold on products can change list_price_per_lb too.
- menu-pricing stores only the current list price (products.list_price_per_lb) and keeps no history; its spec forbids a new table or products column beyond the two it adds.

## Owner

- jaketlee07

## Unresolved questions

- A history table, or two products columns (when the list price last changed, and the cost then)?
- Does the record start with the Alerts feature, or earlier, so history exists before alerts ship?
- Does set_list_price keep the record, or a trigger that sees every writer?

## Projection

- Part of the Alerts spec (SYSTEM-SPEC §13 item 7), or a small spec before it.


## Source

- Mode: repo-origin
- Locator: docs/specs/menu-pricing/spec.md
- Revision: 1f93cdf
- Authority: repo-origin
