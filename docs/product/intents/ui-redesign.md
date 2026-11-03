# Redesign the screens in look E

- **Status:** Accepted


## Outcome

Every Meat Ops screen wears look E from the UI directions canvas: a navy side menu on a desktop, a navy top bar with a menu button on a phone, white rounded cards on a cool blue-gray background, blue (#1D4ED8) buttons and highlights, compact tables, and a product's details in a side panel. What each screen does, and every figure it shows, stays the same.

## Boundary

- Covers `/sign-in`, the nine pages (`/receiving`, `/production`, `/menu`, `/pricing`, `/sales`, `/trace`, `/invoices`, `/ask`, and `/alerts`), the shared header in `src/app/page-header.tsx`, and the tokens in `src/app/globals.css`.
- The canvas draws two screens only: Receiving on a phone and Pricing on a desktop. The other screens use the same parts.
- Status colors stay amber for needs a new price, green for priced, gray for no cost yet, and red for a loss, and each keeps its words.
- The screen rules in `docs/architecture/overview.md` and `globals.css` hold: controls at least 44 px tall, the focus outline, the browser suite's contrast and axe checks, tabular figures, no gradients or illustration, and every figure from the database through `src/lib/format.ts`. On the floor screens, hard to mistype comes first, fast on a phone second, and numbers easy to trust third. The canvas draws 38 px desktop buttons and fields; they grow to 44 px.
- The look's description changes in the same work: the overview's "Keep the screens' look" line, and the `globals.css` note that names Stripe Dashboard forms as the reference.
- Three canvas ideas add behavior, so they sit outside this intent: the "Jump to ⌘K" box, the Receiving product card's "Last paid" figure with its "$0.06/lb below the last receipt" hint, and the Pricing tile "Average margin, priced". The app shows none of them today. Each one the owner wants gets its own intent or spec.
- The `shared-display-parts.md` move sits outside this intent too. It stays its own change.
- The Pricing tiles' counts and the "Use $3.44" button reuse what the app has: the "Needs a new price" group in `src/app/pricing/pricing-list.tsx` and the one-press button in `src/app/pricing/price-advice-block.tsx`.
- The browser suite finds controls by role and name, so a renamed control changes its tests in the same work.
- The canvas holds made-up names and numbers only. Real business data stays out of the repository.

## Owner

- jaketlee07

## Unresolved questions

- Do the screens load Plus Jakarta Sans, the canvas font, or keep today's system font? The layout loads no web font now.
- Does the "Urgent alerts" banner under the header stay, or does the urgent count move onto the alerts bell?
- How do Production, Menu, Sales, Trace, Invoices, Ask, Alerts, and sign-in look in E: drawn on the canvas first, or settled in each spec?
- What does the phone's menu button open?
- Which of the three new ideas does the owner want: the ⌘K box, Last paid with its hint, and the average margin tile?
- Does `shared-display-parts.md` ship before the page specs, so each shared display part is restyled in one place?

## Projection

- A delivery brief with three specs that together cover the outcome, each screen in exactly one:
  1. The look and shell: the tokens in `globals.css`, the side menu and phone top bar in `page-header.tsx`, and `/sign-in`.
  2. Pricing and Receiving in look E.
  3. Production, Menu, Sales, Trace, Invoices, Ask, and Alerts in look E.

## Assumptions

- Riskiest: the business owner, who uses the floor screens every day, finds look E at least as quick and hard to mistype as today's screens. The developer chose E from two drawn screens, and nobody has used it on the floor yet. Showing the business owner Receiving in look E before the other pages change would test it.


## Source

- Mode: chat-only
- Locator: https://claude.ai/artifact/4EaCu25FA6HoBaDA4PKAnX
- Revision: 1793725345-7886
- Authority: transferred-to-repository
