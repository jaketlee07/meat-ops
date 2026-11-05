# Look E: named tokens for radius and title size, and one icon setup

- **Status:** Draft


## Outcome

Look E's corner radii and title size come from named tokens in `src/app/globals.css`, and every inline shell icon takes its shared attributes, `aria-hidden="true"` included, from one place, so specs 2 and 3 reuse them instead of copying raw values.

## Boundary

- Spec 1 (look-and-shell) wrote 17 raw radius and font-size values (`rounded-[10px]`, `rounded-[9px]`, `rounded-[14px]`, `text-[22px]`, `text-[15px]`, `text-[11px]`) across `src/app/page-header.tsx`, `phone-menu.tsx`, `lone-card.tsx`, `page-error.tsx`, `not-allowed.tsx`, `sign-in/page.tsx`, and `sign-in/sign-in-form.tsx`.
- The four inline icons in `page-header.tsx` and `phone-menu.tsx` each repeat the same `viewBox`, `fill`, `stroke`, `strokeLinecap`, and `aria-hidden` attributes; the look-and-shell spec requires `aria-hidden` on every icon.
- Spec 1's post-gates review raised both on 2026-11-04, and the owner chose to do them in spec 2 (Pricing and Receiving), where these values are first reused.
- Every screen looks the same before and after.

## Owner

- jaketlee07

## Unresolved questions

- Which of the six raw values become tokens, and what are they named?

## Projection

- Part of spec 2 of `docs/product/briefs/ui-redesign.md`, or a direct-light change just before it.


## Source

- Mode: repo-origin
- Locator: docs/specs/look-and-shell/notes/verification-ledger.md
- Revision: f329323
- Authority: repo-origin
