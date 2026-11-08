# Brief: Meat Ops looks finished to anyone who sees it, and the business owner sees the day at a glance

- **Slug:** `ui-polish`
- **Status:** Ready
- **Received:** 2026-11-08
- **Owner:** jaketlee07

## Outcome

Anyone who sees a Meat Ops screen (the business owner, floor staff, customers, vendors, and inspectors) takes it for a finished business tool they can trust. Right after signing in, the business owner knows where the business stands today, and can find any past receipt, sale, or product fast. Every screen keeps what it does today, and every figure it shows stays the same; Part 2 adds the home screen and search.

The measures live in the Outcome section of `docs/product/intents/ui-polish.md`: its Input, its Outcome with the proof that can fail, and its Guardrail.

## Scope

**In scope:**

- The polish pass on look E, across `/sign-in` and the nine pages: every Part 1 gap in the Boundary of `docs/product/intents/ui-polish.md`, measured on 2026-11-08. That list ends with the look E leftovers that its last Part 1 bullet names, which the owner folded in on 2026-11-08. The polish pass adds no data and no screen.
- A home screen that shows the business owner where the business stands today. Today `/` redirects to `/receiving`.
- Search and filters on the lists. Search reaches every past receipt and sale, and every product, as the Outcome requires. Today Recent receipts and Recent batches show the 10 latest per product, and Recent sales the 10 latest overall.
- The look notes in `docs/architecture/overview.md`, updated in the same work as each change they describe.
- The tests each change breaks or newly needs, in the same spec as the change. The browser suite finds controls by role and name, and its sign-in waits for `/receiving`.

**Non-goals:**

- Pushed alert cards (`docs/product/intents/pushed-alert-cards.md`), the "Jump to ⌘K" box, the purchasing advisor (`docs/product/intents/purchasing-advisor.md`), and a web font. Each needs its own intent.
- New costing math. A home-screen figure comes from an existing view, or from a new view that follows the engine rule below.
- A change to look E's colors, navy side menu, or phone top bar.

## Constraints

- No cost, price, shrink, average, or margin is computed outside the database engine (`SYSTEM-SPEC.md` §11).
- `AGENTS.md` hard rules 6 and 7 govern any new view or `src/lib/` change, and hard rule 8 governs every board and screenshot.
- Every screen rule in `docs/architecture/overview.md` holds.
- The Guardrail in the intent's Outcome section holds.

## Assumptions and risks

- **Riskiest assumption:** the business owner judges "professional" by what the 2026-11-08 comparison found (status tags, calm tables, one main button, a home screen), not by something it missed, such as a logo or charts. The test is showing the business owner the comparison page. As of 2026-11-08 it is pending, and its result is due before the first of 1a and 1b is approved. A found item the business owner rejects leaves the intent's Boundary, which the owner amends, and so leaves the scope of the spec that holds it. If the business owner rejects the home screen, the owner revisits the intent's Outcome before spec 2a is approved. A gap they name that the comparison missed gets its own intent, or joins a spec that has not started.
- **Reopening an accepted limit:** if Correct and Reverse follow search to rows older than the 10 shown, that reopens the limit the owner accepted on 2026-10-14, which `docs/architecture/overview.md` records. No acceptance is recorded for Void, which today sits only in Recent receipts and Recent sales.

## Open questions

Spec 1a settles these:

- Should Recent sales list the 10 latest by sale date or by entry? By sale date, a back-dated sale can drop out of the 10, and Void sits only there.
- How do a row's Void and Correct sit without stacking? The intent's Guardrail counts the presses to save a receipt, batch, or sale, and does not say whether Void and Correct may take one more press than today.
- How should the sale trace's cards lay out on a desktop: capped in width, with their facts in columns, or side by side?

Spec 1b settles these:

- Does the urgent banner become a slim bar, or leave the work to the Alerts badge alone?
- Does the limit accepted on 2026-11-05 stand, where Receiving's saved result drops under a tall "Stock and prices" card? If it stands, it leaves the intent's Boundary, which the owner amends.

Spec 2a settles these:

- Does sign-in land on the home screen, or stay on Receiving so the floor reaches its form first?
- What does the home screen show first: open alerts, stock and low stock, the day's entries, or money figures that need new views?
- Does the urgent banner show only on the home screen?

Spec 2b settles this:

- Which lists get search and filters, and do Correct, Reverse, and Void follow search to rows older than the 10 shown?

## Sequencing

The owner chose on 2026-11-08 to cut the work into four specs. Each Part 1 gap in the intent's Boundary sits in exactly one of 1a and 1b, except Weight, which splits by place: 1b sets the weight of everything in the form column (form labels, and the saved result's table and facts), and 1a sets it everywhere else (tables, trace result cards, stock tiles, and advice).

- **1a. Tables and status:** the intent's Status, IDs and dates, Row actions, Main buttons, Menu's "Sellable only" switch, Weight, and Recent sales order gaps, and the leftovers' stock tiles and sale trace. Its sale trace covers the cards a trace result shows.
- **1b. Forms, alerts, and page space:** the intent's Forms, urgent banner, Alerts' daily digest, and Blank space gaps, and the leftovers' saved results, Receiving's result, waiting buttons, Vendor picker, and Alerts AC-0001 test. 1b owns the form column: its field layout, the one label style, and the results under the form. Its Blank space covers Trace's two finder cards.
- **2a. The home screen.** Its figures may need new database views.
- **2b. Search and filters on the lists.**

1b builds on 1a: Receiving's result starts under the form only while the form is taller than the "Stock and prices" card, which holds 1a's stock tiles. 2a and 2b build on 1a's status tags and table parts, and 2a builds on 1b for the urgent banner.

## Governance references

None.

## Design artifacts

- The comparison page, https://claude.ai/artifact/TAxCQmsNhq3A6nmRVqCoEo at revision 1794121141-4df1. It shows Meat Ops screens beside Cleavr, xtraCHEF by Toast, MarketMan, and Katana, with the change each comparison suggests.

## Spec map

| Spec | Status |
| --- | --- |

## Source

- Mode: repo-origin
- Ref: `docs/product/intents/ui-polish.md`, the Accepted intent whose outcome and boundary this brief delivers
- Revision: b28cf13
