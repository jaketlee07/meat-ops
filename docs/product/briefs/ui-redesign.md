# Brief: Redesign the screens in look E

- **Slug:** `ui-redesign`
- **Status:** Executing
- **Received:** 2026-11-03
- **Owner:** jaketlee07

## Outcome

Every Meat Ops screen wears look E: a navy side menu on a desktop, a navy top bar with a menu button on a phone, white rounded cards on a cool blue-gray background, blue (#1D4ED8) buttons and highlights, compact tables, and a product's details in a side panel. What each screen does, and every figure it shows, stays the same.

## Scope

**In scope:**

- `/sign-in` and the nine pages that share the header in `src/app/page-header.tsx`.
- The parts those pages share: the header with the Primary navigation, the not-allowed view (`src/app/not-allowed.tsx`), the error view (`src/app/page-error.tsx`), and the tokens in `src/app/globals.css`.
- The two shared display parts in `src/app/`: the label-and-value list (`facts.tsx`) and the before-and-after table (`before-after.tsx`). Each is restyled once, where it lives. The `src/app` row of `docs/architecture/overview.md` lists the pages that show each.
- Drawing what the canvas lacks, each when its spec starts: Receiving on a desktop, Pricing on a phone, the before-and-after table, `/sign-in`, the not-allowed and error views, and the seven other pages. The owner chose this on 2026-11-03, so each drawing sits with the spec that builds it.
- The look's description: the "Keep the screens' look" sentence in `docs/architecture/overview.md` and the `globals.css` comment that names Stripe Dashboard forms as the reference.
- The tests each change breaks or newly needs, in the same spec as the change, including tests for new controls and new contrast pairs.

**Non-goals:**

- Any canvas control or figure that offers something the app does not offer today: the "Jump to ⌘K" box, the Pricing search box, the date in the phone top bar, Receiving's "Last paid" figure with its hint, and the Pricing tile "Average margin, priced". Each one the owner wants gets its own intent or spec. The phone menu button, the phone's alerts bell, and the Alerts badge in the desktop side menu reach pages and counts the app already has, so they are part of the look.
- New status colors or meanings. Amber, green, gray, and red keep their words.
- Next.js's built-in not-found and error pages. The app has no `not-found.tsx` or `global-error.tsx`, and no `error.tsx` outside the nine page folders, so an error on `/sign-in` shows the built-in error page.

## Constraints

- Every screen rule in `docs/architecture/overview.md` and `src/app/globals.css` holds, except "a light surface", which the navy menu and top bar replace.
- The focus outline keeps at least 3:1 contrast against what is behind it, navy included. Today's blue outline (#1D4ED8) is under 3:1 on navy, and the page-state checks in `test/e2e/a11y.ts` score the outline against the backgrounds behind it.
- The canvas draws 38 px desktop buttons and fields. They grow to the 44 px `--spacing-control` in `globals.css`.
- Each in-scope Pricing tile counts one existing group in `src/app/pricing/pricing-list.tsx`, and no tile adds a new query. The canvas's "Use $3.44" button is the one-press button that `src/app/pricing/price-advice-block.tsx` shows.
- Every board, drawn now or when a spec starts, holds made-up names and numbers only. Hard rule 8 in `AGENTS.md` governs real business data.
- From spec 3 on, every table or card layout picks its look from the room its own section has (its width and the text size), not the screen width alone; the owner chose this on 2026-11-05.

## Assumptions and risks

- **Riskiest assumption:** the business owner, who uses the floor screens every day, finds look E at least as quick and hard to mistype as today's screens. The developer chose E from two drawn screens, and nobody has used it on the floor yet. On 2026-11-04 the owner chose to build all three specs without a try-out by the business owner first. A problem the business owner finds in what a shipped spec built gets its own intent, even while a later spec is still in progress. The old layout on a page a later spec still redoes is the mixed look below, and that spec closes it.
- **Mixed look between specs:** the token and header change reaches every page at once, and spec 2's shared display parts also reach the other pages that the overview's `src/app` row lists for them. Until the last spec ships, a page not yet redone shows the navy menu and new colors around its old layout.
- **One more tap on a phone:** today the nine page links wrap onto the phone screen under the title. Behind a menu button, moving between pages takes an extra tap.
- **Taller desktop rows:** at 44 px instead of 38 px, a table row with a button is taller, so fewer rows fit on one screen.

## Open questions

The spec that covers the header settles these:

- Do the screens load Plus Jakarta Sans, the canvas font, or keep today's system font? The layout loads no web font now.
- Does the "Urgent alerts" banner under the header stay, or does the urgent count move onto the phone's alerts bell and the side menu's Alerts badge? The browser suite finds the banner by its region name, "Urgent alerts".
- What does the phone's menu button open?
- What color does the focus outline use on the navy menu and top bar?

The spec that covers Pricing settles this one:

- Does the one-press button keep today's name, such as "Raise list price to $3.44/lb", or take the canvas's shorter "Use $3.44"?

## Sequencing

This brief proposes three specs, built from the intent's projection, with each screen in exactly one. The owner confirms the cut after this brief is Ready.

1. **Look and shell:** the tokens and the look's description, the side menu and phone top bar, the not-allowed and error views, and `/sign-in`.
2. **Pricing and Receiving**, with the two shared display parts, because Receiving imports both.
3. **The other seven pages**, in two specs by the owner's choice on 2026-11-05:
   - **3a. Production, Sales, and Trace**, the pages built like Receiving, together with the spec 2 leftovers intent `docs/product/intents/look-pricing-receiving-review-nits.md`.
   - **3b. Menu, Invoices, Ask, and Alerts.**

Spec 2 builds on spec 1's tokens and header. Specs 3a and 3b build on those and on spec 2's two shared display parts.

## Governance references

None.

## Design artifacts

- The UI directions canvas, https://claude.ai/artifact/4EaCu25FA6HoBaDA4PKAnX at revision 1793725345-7886. Its two E boards draw Receiving on a phone and Pricing on a desktop in look E. Boards A to D hold the looks not chosen.

## Spec map

| Spec | Status |
| --- | --- |
| `look-and-shell` | Shipped |
| `look-pricing-receiving` | Shipped |
| `look-production-sales-trace` | Shipped |

## Source

- Mode: repo-origin
- Ref: `docs/product/intents/ui-redesign.md`, the Accepted intent whose outcome and boundary this brief delivers
- Revision: 2595c24
