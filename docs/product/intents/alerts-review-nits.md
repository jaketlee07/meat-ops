# Alerts: two design nits deferred at build

- **Status:** Draft


## Outcome

Urgency for the banner count, the Urgent section, and the digest facts comes from one rule, and a written digest stores the model from the same source the request uses; or the owner records either split as accepted.

## Boundary

- Urgency: `isUrgent` in `src/lib/alert-text.ts` picks margin and cost alerts by type for the Urgent section and the digest facts' "Urgent." label, while `refresh_alerts` counts severity `high` for the banner. They agree today because the alerts spec defines urgent alerts as margin and cost alerts and AC-0045 gives exactly those severity `high`; changing one alone would make the banner count disagree with the Urgent list.
- Stored model: `finish_digest` writes the literal `'claude-opus-5-5'`, while the request's model comes from `MODEL` in `src/lib/invoice-reading.ts`. AC-0066 pins the literal, so a model change made only through `MODEL` would leave new `alert_digests` rows naming the old model.
- Both were review round 1 Nits (quality engineer) deferred because the spec fixes each side; a change amends AC-0045 or AC-0066.

## Owner

- jaketlee07

## Unresolved questions

- Should urgency come from the alert's severity everywhere, or from its type everywhere?
- Should the app pass the model name to `finish_digest`, or should the database hold the one copy?

## Projection

- A small spec, or a controlled amendment of the alerts criteria, checked by the alerts Vitest and browser suites.


## Source

- Mode: repo-origin
- Locator: docs/specs/alerts/notes/verification-ledger.md
- Revision: 7903993
- Authority: repo-origin
