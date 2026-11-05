# Spec: look-pricing-receiving

- **Status:** Shipped <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints in the brief [`docs/product/briefs/ui-redesign.md`](../../product/briefs/ui-redesign.md); the look-and-shell spec [`../look-and-shell/spec.md`](../look-and-shell/spec.md) (the shell, its 34rem content cap, and its focus outlines); the menu-pricing spec [`../menu-pricing/spec.md`](../menu-pricing/spec.md) (its criteria for the advice and the one-press button); the receiving, receiving-refinements, and corrections specs (what `/receiving` shows and does); the alerts spec [`../alerts/spec.md`](../alerts/spec.md) (its saved-receipt banner criterion, whose test finds the banner's status container); the screen rules in the `src/app` row of [`docs/architecture/overview.md`](../../architecture/overview.md); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** docs/product/briefs/ui-redesign.md
- **Discovery:** none
- **Contract:** none (page markup and styles inside this app; no published interface)
- **Shape:** ui

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory: it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

The business owner prices products on `/pricing` and logs receipts on `/receiving` in look E, inside the shell spec 1 built. This spec is the second of the three the brief names. It also restyles the two shared display parts, the label-and-value list (`facts.tsx`) and the before-and-after table (`before-after.tsx`), once where they live.

Success for the owner:

- On `/pricing`, three tiles count the products that need a new price, are priced, and have no cost yet. Each product keeps its five figures and, when it needs a new price, its advice and its one-press button, still named "Raise list price to $3.44/lb" and the like.
- On a desktop 1280 px or wider, each group reads as a compact table. On a narrower desktop and on a phone, each product is a card.
- On a desktop, a product's details open in a panel beside the list, and the keyboard reaches the panel first. On a phone, a product's details open on their own.
- On `/receiving`, the chosen product's stock and suggested prices sit in a card: below the form on a phone, so nothing moves while the owner types, and beside the form on a desktop. Recent receipts read as a table at 1280 px and wider at the browser's default text size, and as cards below that; with a larger text size they stay cards until their section has room for the table.
- Look E's corner radii and type sizes come from named tokens, and every inline icon comes from one shared component.

What each screen does, and every figure, word, and control name it shows, stays the same. The drawn reference is the spec 2 row of boards on the [UI directions canvas](https://claude.ai/artifact/4EaCu25FA6HoBaDA4PKAnX) at revision 1793856599-9c48.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/look-pricing-receiving/`. At closeout, the overview, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture: the two pages and the shared parts | The overview's `src/app` row describes `/pricing` (its list, one-press repricing, what-if, and per-product detail) and `/receiving`. It does not name the shell's 34rem content cap. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names the content cap and that both pages lift it, the Pricing tiles and details panel, and the Receiving card layout. | `close-work` reads the row whole against the code. |
| Current architecture: the look's tokens and icons | The overview's screen-look sentence points at the tokens in `globals.css`. | `docs/architecture/overview.md`, the `src/app` row's notes column; `src/app/globals.css` | `work-loop` implementer | The notes name the radius and type-size tokens, the 1280 px table width, the `receipt-table` variant with its section-width condition, and the shared icon component. | `close-work` reads both. |
| Current architecture: the browser suite | The overview's `test/e2e/` row lists each suite. | `docs/architecture/overview.md`, the `test/e2e/` row | `work-loop` implementer | The row lists this spec's new suite. | `close-work` reads the row whole. |
| Backlog | This spec delivers the Draft intent `docs/product/intents/look-e-shared-tokens-and-icons.md`. | That intent and its `workspace.toml` entry | `close-work` | The intent reads Fulfilled and leaves `backlog.open`. | `workspace_status.py reconcile --root .` shows no finding for it. |
| Design reference | The canvas boards are the drawn reference for AC-0018. | The UI directions canvas, linked in the brief's Design artifacts section | Owner | The AC-0018 entries in the verification ledger | `close-work` confirms that the brief still links the canvas. |
| Delivery coordination | This spec is a child of the brief. | The brief's Spec map; this spec's `workspace.toml` entry | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide. | None | None | None | None |
| Release history | None. The app has no version. | None | None | None | None |

## Boundaries

### Always do

- Keep every figure, word, control name, role, and Tab order these pages show today, except where an acceptance criterion below changes one.
- Take every color from a token defined in `src/app/globals.css`, and every radius and font size from a theme token: Tailwind's built-in scale or a token defined in `src/app/globals.css`. Never use an arbitrary value for any of them.
- Draw every icon through the shared icon component.
- Run `npm test` in full before handing a task back, and stop any app or test server you started by its PID.

### Ask first

- Any change to what the spec 2 canvas boards draw.
- Changing an expectation in an existing browser test beyond what AC-0020 allows.
- Any change to how a product is chosen on `/receiving` or `/pricing`.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Change anything under `src/lib/` or `supabase/`, change a server action, or write a new query. A page may call an existing `src/lib` read that it does not call today.
- Load a font, image, script, or style from another host, or load any web font.
- Add any canvas control or figure that the brief's Non-goals section names.

## Testing Strategy

- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0021, AC-0022, AC-0023)**: in a new `test/e2e/look-pages.spec.ts`. Each is a layout or content the owner sees in a browser. Each width-bound criterion is checked at its edge and at a common size: 1024 and 1280 px from 1024 up, 1023 and 390 px under 1024, 1280 and 1440 px from 1280 up, and 1279, 1024, and 390 px under 1280. AC-0022 and AC-0023 are checked at 1280, 1440, and 1920 px with the root text size set to 20 px.
- **Goal-based check over the source (AC-0014, AC-0015, AC-0016)**: a Vitest search of `src/app` decides each.
- **Goal-based check over the whole suite (AC-0017)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0018, AC-0019, AC-0020)**: the owner's comparison with the canvas boards, a read of the shared parts' markup diff, and a read of the branch's test diff.

## Acceptance Criteria

### Width

- [x] **AC-0001.** At 1024 CSS px and wider, the content of `/pricing` and `/receiving` fills the width beside the side menu: no child of `<main>` has a computed max-width.

### Pricing list

- [x] **AC-0002.** Whenever `/pricing` shows its product list, three tiles show above it, in this order: "Needs a new price", "Priced", and "No cost yet". Each tile shows the number of products the list shows in its group, and 0 for an empty group. With no product list, no tile shows.
- [x] **AC-0003.** At 1280 px and wider, on `/pricing` and beside a product's details, each product's five figures (Cost per lb, List price, Suggested price, Margin at list price, Target margin) sit on one line, under one header line per group that names the five figures in that order. No figure's text runs past its cell.
- [x] **AC-0004.** Under 1280 px, each product's five figures each sit on their own line beside a visible label.

### Pricing details

- [x] **AC-0005.** At 1024 px and wider, `/pricing?product=<code>` for an active finished product shows the tiles and the list, and to the list's right a region named "Product details".
- [x] **AC-0006.** The "Product details" region holds that product's heading, its cost build-up with every label visible, the advice and the one-press button when it needs a new price, the two message regions, and the Target margin and List price forms.
- [x] **AC-0007.** Under 1024 px, `/pricing?product=<code>` shows the "Product details" region, and no tile and no product list.
- [x] **AC-0008.** While a product's details are open, that product's row in the list shows no advice and no one-press button.
- [x] **AC-0009.** At 1024 px and wider, on `/pricing?product=<code>`, Tab from the top of the page reaches every control in the "Product details" region before any link in the list.
- [x] **AC-0021.** `/pricing?product=<code>` shows no what-if section.

### Receiving

- [x] **AC-0010.** With a product chosen, under 1024 px, `/receiving` shows from top to bottom the "New receipt" form, the card holding the product's stock (On hand, Average cost) and suggested prices, and Recent receipts.
- [x] **AC-0011.** With a product chosen, at 1024 px and wider, the page title sits above the form and the stock card, and the "New receipt" form sits to the left of the stock card and of Recent receipts.
- [x] **AC-0012.** At 1280 px and wider, at the browser's default text size, each recent receipt's six figures (Lot number, Received, Vendor, Weight, Cost per lb, Remaining) sit on one line, under one header line that names them in that order. No figure's text runs past its cell.
- [x] **AC-0013.** Under 1280 px, each recent receipt's six figures each sit on their own line beside a visible label.
- [x] **AC-0022.** With the browser's text size at 20 px, Recent receipts show as cards, each label beside its value, at 1280 px and 1440 px, and as the table at 1920 px.
- [x] **AC-0023.** With the browser's text size at 20 px, at 1280 px, 1440 px, and 1920 px, every Void and Correct button sits inside the Recent receipts section.

### Tokens and icons

- [x] **AC-0014.** No class in `src/app` uses an arbitrary value for a radius or for text: no class, with or without a variant prefix, starts `rounded-[`, `rounded-<side>-[`, or `text-[`.
- [x] **AC-0015.** Exactly one file in `src/app` contains `<svg`: the shared icon component.
- [x] **AC-0016.** That icon component sets `aria-hidden="true"` on every icon it draws.

### Look and regressions

- [x] **AC-0017.** `npm test` passes.
- [x] **AC-0018.** The verification ledger records the owner's "match" verdict for each of the five spec 2 boards on the canvas at revision 1793856599-9c48, each compared whole with the built screen set to the board's state, and a "no match" on any fails this criterion. The states: `/pricing` at 390 px wide with products in all three groups (S2-Pricing-Phone); `/receiving` at 390 px and at 1280 px with a product chosen and three recent receipts, one of them void (S2-Receiving-Phone, S2-Receiving-Desktop); the "Receipt saved" result card alone at 390 px (S2-BeforeAfter); and `/pricing?product=<code>` at 1280 px for a product that needs a new price (S2-Pricing-Desktop). Three differences do not count: the names, numbers, dates, and how many products, receipts, or cost build-up rows are listed are the test data's; a drawn text color shown as its nearest `globals.css` color token; and focus outlines.
- [x] **AC-0019.** Read from the branch point with `main`, for the same props, `facts.tsx` and `before-after.tsx` render the same elements in the same nesting, with the same attributes other than `class` and the same text. A new prop may only choose classes.
- [x] **AC-0020.** Read from the branch point with `main`, tracked and untracked, the only changed expectations in existing browser test files scope a locator on `/pricing?product=<code>` to the "Product details" region. The values, names, and orders they assert are unchanged.

## Follow-ons

None. The canvas ideas this spec leaves out are the brief's non-goals.

## Assumptions

- Technical: `/pricing` shows three groups of product cards ("Needs a new price", "Priced", "No cost yet"); each card has five figures and, when it needs a new price, the advice and the one-press button (source: `src/app/pricing/pricing-list.tsx`, `price-advice-block.tsx`)
- Technical: a product's details open at `/pricing?product=<code>` in place of the list (source: `src/app/pricing/page.tsx`)
- Technical: the one-press button is named "Set", "Raise", or "Lower list price to $X.XX/lb" (source: `src/lib/price-advice.ts`; the menu-pricing spec's button-name criterion)
- Technical: `/receiving` shows the receipt form, the "Receipt saved" result with two before-and-after tables ("Stock" and "Suggested price"), the product's stock and suggested prices, and Recent receipts, each a block of six labeled figures with Void and Correct (source: `src/app/receiving/*.tsx`)
- Technical: the label-and-value list is also shown on `/production`, `/sales`, `/trace`, and the `/invoices` saved result; the before-and-after table on `/production`, `/sales`, the `/receiving` Correct dialog, and the `/invoices` saved result (source: import search of `src/app`, 2026-11-05)
- Technical: the look-and-shell cap holds each header page's content children at 34rem from 1024 px up (source: `src/app/page-header.tsx`)
- Technical: the Pricing test helpers find a product card as an `li` holding a level-3 heading and a figure as the `dd` after a `dt` with its label, and the details helper takes the page's first level-2 heading (source: `test/e2e/pricing-page.ts`, `test/e2e/receiving-page.ts` `factValue`)
- Technical: tests press the one-press button by its name with no scope (source: `test/e2e/pricing.spec.ts`, `test/e2e/alerts.spec.ts`)
- Technical: the alerts suite's saved-receipt banner test selects `main > div > [role=status]` and expects one match on `/receiving` (source: `test/e2e/alerts.spec.ts`)
- Process: the experience-design pack is not installed, so the canvas boards stand in as the design reference (source: the installed skills list)
- Product: the one-press button keeps today's name, such as "Raise list price to $3.44/lb" (source: user confirmation 2026-11-04)
- Product: the Pricing list keeps all five figures per product (source: user confirmation 2026-11-04)
- Product: `/pricing` and `/receiving` use the full width beside the side menu on a desktop (source: user confirmation 2026-11-04)
- Product: Receiving keeps typing the product code; on a phone the product's stock card sits below the form, so the form does not move when the card loads (source: user confirmation 2026-11-05)
- Product: a product's details open in a side panel beside the Pricing list on a desktop, and alone on a phone (source: the brief's Outcome; user confirmation 2026-11-04)
- Product: beside the details panel the page shows the tiles and the list and no what-if section; the keyboard reaches the panel first; on a phone the details show with no tiles (source: user confirmation 2026-11-05)
- Product: the boards use today's words: the advice sentence, "Stock and prices", the vendor list, and the product hint; the open product's row shows no advice or button (source: user confirmation 2026-11-05; canvas revision 1793856599-9c48)
- Technical: at 1024 px the content beside the side menu is 728 px wide (1024 less the 240 px menu and two 28 px paddings), too narrow for a six-column row beside the details panel or the receipt form, so the table look starts at 1280 px; the list alone on `/pricing` uses the same width, so a product's row looks the same with or without the panel (source: `src/app/page-header.tsx`; the S2 desktop boards' 360 px panel and 340 px form; user confirmation 2026-11-05)
- Product: with a larger browser text size, Recent receipts stay as cards until their section has room for the table, so Void and Correct stay usable; at the default text size the table shows from 1280 px (source: user confirmation 2026-11-05, after a probe put Void and Correct outside the section at 1280 px with 20 px text)
- Product: the label-and-value list and the before-and-after table keep their markup and change only color and spacing, on every page that shows them (source: user confirmation 2026-11-04)
- Product: this spec delivers the Draft intent `look-e-shared-tokens-and-icons.md`, the owner's choice of 2026-11-04 (source: that intent)
