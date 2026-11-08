# Meat Ops looks finished to anyone who sees it, and the business owner sees the day at a glance

- **Status:** Accepted
- **Slug:** `ui-polish`
- **Level:** `feature`
- **Scale:** `app`
- **Maturity:** `brownfield`


## Outcome

Anyone who sees a Meat Ops screen (the business owner, floor staff, customers, vendors, and inspectors) takes it for a finished business tool they can trust. Right after signing in, the business owner knows where the business stands today, and can find any past receipt, sale, or product fast. Every screen keeps what it does today, and every figure it shows stays the same; Part 2 adds the home screen and search.

- **Input (steerable):** the number of gaps from the 2026-11-08 comparison still on the screens (the Boundary lists them; none left when done), and the number of pages the business owner opens to learn today's open alerts, low stock, and the day's receipts, batches, and sales (today at least three, since Receiving and Production list recent entries per product only; one when done).
- **Outcome (lagging):** shown the finished screens beside the 2026-11-08 comparison, the business owner calls Meat Ops finished and would show any screen to a customer, vendor, or inspector. The proof fails if the business owner names a screen they would not show someone, or if a gap from the Boundary is still visible.
- **Guardrail:** floor entry stays as quick and hard to mistype. Receiving, Production, and Sales keep their fields, Tab order, and 44 px controls, and saving a receipt, batch, or sale takes no more presses than today. Every figure still comes from the database through `src/lib/format.ts`, and the browser suite's contrast, axe, and focus checks and the golden costing suite stay green.

## Opportunity

The business owner wants to run the day from one place, trust what the screens show, and have the tool reflect a well-run operation when others see it.

- **Functional job:** know where the business stands today and act on it (what came in, what was made and sold, what needs a price or an order), and find a past receipt, sale, or product fast.
- **Emotional job:** feel in control and sure the numbers are right, never unsure whether a screen is broken or half-finished.
- **Social job:** be seen as a professional, well-run processor by everyone who sees a screen: floor staff, customers, vendors, and inspectors. The owner set this audience on 2026-11-08 ("professional for all").
- **Struggling moment:** right after sign-in the business owner lands on a mostly blank Receiving form under a red banner, and has to open Alerts, Sales, and each product's Receiving and Production pages to piece the day together. When showing a sale or lot to someone else, IDs broken across lines, stacked buttons, and four-line red notes make the business look unfinished.

## Boundary

Part 1, the polish pass on look E. It adds no data and no screen.

- Status: Menu, Pricing, Receiving, and Sales show status as plain words ("Sellable now", "Not sellable now", "No list price yet"). A void shows as a bold red note that runs four lines ("Void:", "Entered", "twice by", "mistake").
- IDs and dates: at 1440 px, Recent receipts and Recent sales break lot numbers, sale numbers, and dates inside the value ("L-20261106-" then "1f9f5b", "Nov 6," then "2026").
- Row actions: Recent receipts stacks Void and Correct, so rows are about 110 px tall. Recent sales shows a full-size red Void button on all 10 rows.
- Main buttons: each "Needs a new price" row on Pricing has a full blue button and a bold orange advice sentence, so three rows show three main buttons.
- Forms: two label styles (small gray bold on Receiving, Production, and Sign in; larger plain black on Sales, Trace, Invoices, and Ask), one field per line in the 280 px form column, and the browser's own dropdowns, date boxes, and invoice photo picker ("Choose File", "No file chosen").
- Menu's "Sellable only" switch shows as an empty 44 px checkbox.
- The urgent banner (the region named "Urgent alerts") is a red bar above the work on every page, beside the red badge on the three Alerts links.
- Weight: table data, labels, and advice are mostly bold.
- Recent sales are ordered by entry time (`created_at` in `src/lib/sales.ts`), so the sale dates read out of order: Nov 5, Sep 30, Nov 4, Oct 8.
- Alerts' daily digest is one block of paragraphs.
- Blank space: Trace's and Invoices' cards hold gaps above or below their buttons, and Ask keeps its 544 px column.
- The look E leftovers: this work takes in the gaps that the Boundary of `docs/product/intents/look-production-sales-trace-review-nits.md` records: stock tiles that split figures at 20 px text, saved results that split figures and words at 20 px text, sale trace labels far from their values on a desktop, Receiving's result under a tall stock card, six buttons that fade by opacity while waiting, the draft review's 167 px Vendor picker, and the Alerts AC-0001 test's block count. That Boundary's closing line on words and control names does not bind this work, which follows this intent's Outcome and Limits. The owner chose on 2026-11-08 to fold it in. That intent leaves `[backlog].open` when both specs that hold its gaps have shipped.

Part 2, the new features.

- A home screen that shows where the business stands today. Today `/` redirects to `/receiving`, and the browser suite's sign-in waits for `/receiving`.
- Search and filters on the lists. Today Recent receipts and Recent batches show the 10 latest per product, and Recent sales the 10 latest overall. Correct and Reverse sit only in those lists, a limit the owner accepted on 2026-10-14.

Limits on both parts.

- Every figure comes from the database and shows through `src/lib/format.ts`. Cost, price, shrink, average, and margin are never computed outside the engine (`SYSTEM-SPEC.md` §11), so a home-screen figure such as stock value needs a database view.
- The screen rules in `docs/architecture/overview.md` hold: 44 px controls, the focus ring, the waiting-control rule, the contrast and axe checks, tabular figures, the system font (a web font would make every build and `npm test` need the internet), `LineIcon` for every icon, no gradients or illustration, and each layout picks its look from its own section's width and the text size.
- Look E's colors, navy side menu, and phone top bar stay.
- The browser suite finds controls by role and name, so a renamed control or a moved banner changes its tests in the same work.
- Real business data stays out of the repository. The comparison used made-up test data.
- Outside this intent: pushed alert cards (`pushed-alert-cards.md`), the "Jump to ⌘K" box, the purchasing advisor (`purchasing-advisor.md`), and a web font.

## Owner

- jaketlee07

## Unresolved questions

- Does sign-in land on the home screen, or stay on Receiving so the floor reaches its form first?
- What does the home screen show first: open alerts, stock and low stock, the day's entries, or money figures that need new views?
- Should Recent sales list the 10 latest by sale date or by entry? By sale date, a back-dated sale can drop out of the 10, and Void sits only there.
- Which lists get search and filters? Do Correct, Reverse, and Void follow search to rows older than the 10 shown? For Correct and Reverse, that would reopen the limit the owner accepted on 2026-10-14; no acceptance is recorded for Void.
- Does the urgent banner become a slim bar, leave the work to the Alerts badge alone, or show only on the home screen?
- Two questions carry over from the leftovers intent: does the accepted Receiving limit stand, and how should the sale trace's cards lay out on a desktop?
- Does this work join `[ini-001]` (look E, kept active until its day-30 reviews on 2026-12-04 to 2026-12-06), or start a new initiative?

## Projection

- A delivery brief with two specs, in this order:
  1. The polish pass: every Part 1 item, the look E leftovers included. No new data or screens.
  2. The home screen, and search and filters on the lists. Its figures may need new database views.

## Assumptions

- Riskiest: the business owner judges "professional" by what the 2026-11-08 comparison found (status tags, calm tables, one main button, a home screen), not by something it missed, such as a logo, a web font, or charts. Showing the business owner the comparison page, or the polished Receiving and Sales screens before the rest, would test it.
- Restyling tables and forms keeps floor entry as quick and hard to mistype. A More button adds one press before Void and Correct.
- The home screen's figures come from existing views, or from new views that follow the engine rule, with no new costing math.
- **Knowledge surface:** the in-repo doc set: `SYSTEM-SPEC.md` (§3 users and jobs, §11 boundaries), `docs/architecture/overview.md` (screen rules and look notes), and `workspace.toml` with the open intents in `docs/product/intents/` (in-flight work). No internal retrieval tool was detected. The product comparison used public web pages, which are not an internal surface.

## Decomposition

-


## Source

- Mode: chat-only
- Locator: https://claude.ai/artifact/TAxCQmsNhq3A6nmRVqCoEo
- Revision: 1794121141-4df1
- Authority: transferred-to-repository
