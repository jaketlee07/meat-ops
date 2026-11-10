# Brief: Meat Ops looks finished to anyone who sees it, and the business owner sees the day at a glance

- **Slug:** `ui-polish`
- **Status:** Executing
- **Received:** 2026-11-08
- **Owner:** jaketlee07

## Outcome

Anyone who sees a Meat Ops screen (the business owner, floor staff, customers, vendors, and inspectors) takes it for a finished business tool they can trust. Right after signing in, the business owner knows where the business stands today, and can find any past receipt, sale, or product fast. Every screen keeps what it does today, and every figure it shows stays the same; Part 2 adds the home screen and search.

The measures live in the Outcome section of `docs/product/intents/ui-polish.md`: its Input, its Outcome with the proof that can fail, and its Guardrail.

## Scope

**In scope:**

- The polish pass on look E, across `/sign-in` and the nine pages: every Part 1 gap in the Boundary of `docs/product/intents/ui-polish.md`. That list ends with the look E leftovers that its last Part 1 bullet names. The polish pass adds no data and no screen.
- A home screen that shows the business owner where the business stands today. Today `/` redirects to `/receiving`.
- Search and filters on the lists. Search reaches every past receipt and sale, and every product, as the Outcome requires. Today Recent receipts and Recent batches show the 10 latest per product, and Recent sales the 10 latest overall.
- The `src/app/` row of the "Areas and change guidance" table in `docs/architecture/overview.md`, which describes each page's look, updated in the same work as each change it describes.
- The tests each change breaks or newly needs, in the same spec as the change. The browser suite finds controls by role and name, and its sign-in waits for `/receiving`.

**Non-goals:**

- Pushed alert cards (`docs/product/intents/pushed-alert-cards.md`), the "Jump to ⌘K" box, the purchasing advisor (`docs/product/intents/purchasing-advisor.md`), and a web font. Each needs its own intent.
- New costing math. A home-screen figure comes from an existing view, or from a new view that follows the engine rule below.
- A change to look E's colors, navy side menu, or phone top bar.

## Constraints

- No cost, price, shrink, average, or margin is computed outside the database engine (`SYSTEM-SPEC.md` §11).
- `AGENTS.md` hard rules 6 and 7 govern any new view or `src/lib/` change. A new view also follows the `supabase/migrations/` row of the overview's "Areas and change guidance" table and its Access model. Hard rule 8 governs every board and screenshot.
- The screen rules listed in the intent's Limits hold.
- The Guardrail in the intent's Outcome section holds.

## Assumptions and risks

- **Riskiest assumption:** the one in the intent's Assumptions section, that the 2026-11-08 comparison found what makes Meat Ops look professional; the intent also says how it is tested. The owner accepted the comparison page in Design artifacts unchanged on 2026-11-08. The specs build to the intent's Boundary, which records what that page found; the page only illustrates the Boundary and adds no scope. A gap the owner later names that the comparison missed follows the Boundary-change rule in Sequencing.
- **Reopening an accepted limit:** if Correct and Reverse follow search to rows older than the 10 shown, that reopens the limit the owner accepted on 2026-10-14, which `docs/architecture/overview.md` records. No acceptance is recorded for Void, which today sits only in Recent receipts and Recent sales.

## Open questions

Spec 1a settles these:

- Should Recent sales list the 10 latest by sale date or by entry? By sale date, a back-dated sale can drop out of the 10, and Void sits only there.
- How do a row's Void and Correct sit without stacking? The intent's Guardrail counts the presses to save a receipt, batch, or sale, and does not say whether Void and Correct may take one more press than today.
- How should the sale trace's cards lay out on a desktop: capped in width, with their facts in columns, or side by side?

Spec 1b settles these:

- Does the urgent banner become a slim bar, or leave the work to the Alerts badge alone?
- Does the limit accepted on 2026-11-05 stand, where Receiving's saved result drops under a tall "Stock and prices" card? If it stands, the owner takes it out of the intent's Boundary under the Boundary-change rule in Sequencing.

Spec 2a settles these:

- Does sign-in land on the home screen, or stay on Receiving so the floor reaches its form first?
- What does the home screen show first: open alerts, stock and low stock, the day's entries, or money figures that need new views?
- Does the urgent banner show only on the home screen?

Spec 2b settles this:

- Which lists get search and filters, and do Correct, Reverse, and Void follow search to rows older than the 10 shown?

## Sequencing

The owner chose on 2026-11-08 to cut the work into four specs. Each Part 1 gap in the intent's Boundary sits in exactly one of 1a and 1b, except Weight, which splits by place: 1b sets the weight of every form's labels (Sign in, Trace, Invoices, and Ask included) and of everything in the form column (the saved result's table and facts), and 1a sets it everywhere else (tables, trace result cards, stock tiles, and advice).

- **1a. Tables and status:** the intent's Status, IDs and dates, Row actions, Main buttons, Menu's "Sellable only" switch, Weight (everywhere 1b does not set it), and Recent sales order gaps, and the leftovers' stock tiles and sale trace. Its sale trace covers the cards a trace result shows.
- **1b. Forms, alerts, and page space:** the intent's Forms, urgent banner, Alerts' daily digest, and Blank space gaps, Weight in the places named above, and the leftovers' saved results, Receiving's result, waiting buttons, Vendor picker, and Alerts AC-0001 test. 1b owns the form column: its field layout, the one label style, and the results under the form. Its Blank space covers Trace's two finder cards.
- **2a. The home screen.** Its figures may need new database views.
- **2b. Search and filters on the lists.**

1b builds on 1a: Receiving's result starts under the form only while the form is taller than the "Stock and prices" card, which holds 1a's stock tiles. 2a and 2b build on 1a's status tags and table parts. 2a builds on 1b for the urgent banner, and 2b builds on 1b's form controls and label style for its search and filters.

The Boundary-change rule: a new Part 1 gap goes whole to 1b if any part of it sits in a form or the form column, and whole to 1a otherwise. It enters the intent's Boundary only while the spec it would join is unwritten or still Draft; otherwise it stays out of this Boundary and gets its own intent. A gap taken out of the Boundary leaves the scope of the spec that holds it. The pull request that changes the Boundary also updates the 1a or 1b list above, and sets this brief's Source revision and the workspace entry's `source.revision` to the commit that amends the intent.

## Governance references

None.

## Design artifacts

- The comparison page, https://claude.ai/artifact/TAxCQmsNhq3A6nmRVqCoEo at revision 1794121141-4df1. It shows Meat Ops screens beside Cleavr, xtraCHEF by Toast, MarketMan, and Katana, with the change each comparison suggests.

## Spec map

| Spec | Status |
| --- | --- |
| `polish-tables-status` | Shipped |
| `polish-forms-alerts` | Shipped |
| `home-screen` | Shipped |

## Source

- Mode: repo-origin
- Ref: `docs/product/intents/ui-polish.md`, the Accepted intent whose outcome and boundary this brief delivers
- Revision: c98460e
