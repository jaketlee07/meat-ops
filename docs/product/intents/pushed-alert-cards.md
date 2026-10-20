# Pushed alert cards on a phone

- **Status:** Draft


## Outcome

An urgent alert reaches the owner's phone as a pushed card without opening the app, as `SYSTEM-SPEC.md` section 8 describes.

## Boundary

- Today urgent alerts show only as the banner on every page and on `/alerts`, when the owner opens the app.
- Web push needs the app served over HTTPS (the app HTTPS hosting intent) and an installable PWA first.
- The watch runs only when a page renders, so a push needs something that runs the watch without a page view.

## Owner

- jaketlee07

## Unresolved questions

- What runs the watch when no page is open?
- Which alerts push: urgent only, or every new alert?

## Projection

- A new spec after the HTTPS hosting work ships.


## Source

- Mode: repo-origin
- Locator: docs/specs/alerts/spec.md
- Revision: 895d232
- Authority: repo-origin
