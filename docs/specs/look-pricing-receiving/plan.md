# Plan: look-pricing-receiving

- **Spec:** [`spec.md`](spec.md)
- **Status:** Approved <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** the shell in `src/app/page-header.tsx` (`PageShell`, its `desk` content cap) and its suite `test/e2e/shell.spec.ts`; the Pricing page in `src/app/pricing/` with `test/e2e/pricing-page.ts` and `pricing.spec.ts`; the Receiving page in `src/app/receiving/` with `test/e2e/receiving-page.ts`, `receiving.spec.ts`, and `correct.spec.ts`; the shared parts `src/app/facts.tsx` and `before-after.tsx`; the tokens in `src/app/globals.css`. No precedent exists for one markup that reads as a table at desktop width and as cards on a phone; the design below names the mechanism and a probe grounds the Receiving half.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/<feature>/notes/verification-ledger.md` (or the adopter's
> equivalent). A genuine artifact error follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round. Treating them as
> contract is how a review spends a round on prose no gate consumes; the
> measured share is over half the plan's lines. `Grounding` stays *recorded*,
> because a per-task resolution that nobody wrote is not grounding; what it stops
> being is a claim a reviewer holds the plan to.

## Approach

Tokens and the shared icon come first, because every later task uses them. The shared parts follow, restyled in place. Pricing then gets its tiles and its table look, and after that the details panel. Receiving comes last, because it shares the shell option, the new suite, and the overview rows with the Pricing tasks. A final task records what only a person or a diff read can check.

The riskiest part is keeping today's tests green while the layout changes. The design keeps every element the tests find (a product's `li` with its level-3 heading, each figure's `dt` and `dd`, `#product-region`, the result's status container) and moves only how they are laid out. The planned test changes scope the Pricing details reads to the new panel.

## Constraints

- The brief's Constraints: 44 px controls, the 3:1 focus outline, made-up data only on canvas boards, and each Pricing tile counting one existing group with no new query.
- The look-and-shell shell and its tests: `<main>`'s first child stays the title-and-banner `div`; a page's own status stays out of `main > div > [role=status]` (the alerts suite's saved-receipt banner test on `/receiving`).
- `AGENTS.md`: no em dashes, `type(scope): description` commits, `npm ci --ignore-scripts`, and the folder check before any test run or stack stop.

## Construction tests

Most construction tests live under **Tasks** below.

**Integration tests:** none beyond per-task tests.
**Manual verification:** T6's owner comparison with the canvas and its two diff reads.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Overview `src/app` row: the content cap, Pricing, and Receiving | T3, T4, T5, T7 | The row's diff names the 34rem cap and that both pages lift it, the tiles, the details panel, and the Receiving cards. | `close-work` reads the row whole against the code. |
| Overview look notes: tokens, the table width, and the icon component | T1, T3, T7 | The notes name the radius and type-size tokens, `line-icon.tsx`, the 1280 px `wide` variant, and the `receipt-table` variant with its section-width condition. | `close-work` reads them. |
| Overview `test/e2e/` row | T3 | The row lists `look-pages.spec.ts`. | `close-work` reads the row whole. |
| Intent `look-e-shared-tokens-and-icons.md` | T1 | AC-0014 to AC-0016 pass. | `close-work` marks it Fulfilled and reconcile shows no finding. |
| Design reference: the canvas | T6 | The AC-0018 ledger entries name revision 1793856599-9c48. | The brief still links the canvas. |

## Design (LLD)

### Design decisions

- **Two desktop widths.** From `desk` (1024 px) the shell shows the side menu and both pages lift the content cap. From a new `wide` variant (1280 px, set in px like `desk`) the Pricing groups read as tables. Between the two, both stay cards: at 1024 px the content is 728 px wide, and beside the 360 px details panel or the 340 px receipt form a six-column row has under 40 px per column. Recent receipts read as a table through the `receipt-table` variant in `globals.css`: it needs the 1280 px width and a Recent receipts section (a size container) wide enough for the row, so a larger text size keeps the cards until the row fits. Traces to: AC-0003, AC-0004, AC-0012, AC-0013, AC-0022, AC-0023.
- **One markup, two looks.** Each Pricing product stays an `li` with its level-3 heading link, a `dl` of five `Figure`s, and its advice block. From `wide` up, the group's `ul` becomes a grid with a header line (`aria-hidden="true"`, naming the five figures), each `li` lays its `dl` out on the same columns with CSS subgrid, and the list's own classes hide each `dt` visually. The label stays in the page, so screen readers and `figure()` still find it. `Figure` itself keeps a visible label, so the details panel and the what-if results show theirs. Recent receipts use the same pattern; T5, which first renders it, gives `Facts` an `inline` option that only picks classes (AC-0019). Traces to: AC-0003, AC-0004, AC-0006, AC-0012, AC-0013, AC-0019.
- **`PageShell` gains `fullWidth` and `mainClassName`.** `fullWidth` drops the 34rem cap on `<main>`'s children; `/pricing` and `/receiving` pass it, and every other page keeps the cap. `mainClassName` adds Receiving's grid classes to `<main>` itself, because a wrapping `div` would put the result's status container inside `main > div`. Traces to: AC-0001, AC-0011.
- **The tiles are a list, not headings.** A `ul` labeled "Product counts" holds three items, each a label and a number counted from the rows `listPricing` returns, so `groupHeadings()` and `group()` in the test helpers see nothing new. Each tile's top edge takes its group's status color. Traces to: AC-0002.
- **The details view.** On `/pricing?product=<code>` for a known code, the page calls `getPricingDetail` and `listPricing`, and renders the tiles, then a grid holding a `section` named "Product details" (holding `PricingDetail`) first in the page and the list second. From `desk` up the grid puts the list on the left and the panel on the right, so Tab reaches the panel first. Under `desk` the tiles and the list are hidden. `PricingList` takes the open product's code: that row is tinted with an accent edge, its link carries `aria-current="page"`, and it leaves out its advice block, so no control name appears twice. The view has no what-if section. An unknown code shows today's message alone. Traces to: AC-0005 to AC-0009, AC-0021.
- **Receiving keeps `#product-region` whole and lets the layout place its parts.** `ProductRegion` renders two `section`s: the stock card (stock and suggested prices) and Recent receipts. Under `desk` the page keeps today's order: form, result, stock card, Recent receipts. From `desk` up, `#product-region` is `display: contents` and `<main>` is a two-column grid with named areas: the title-and-banner `div` across the top, form and result on the left, stock card and Recent receipts on the right. DOM order, and so Tab order, stays form, result, region. A probe on 2026-11-04 (a static page without the side menu, run through the repository's `checkPageState`) placed the form at x 16 and the stock card at x 408 on the same top at 1280 px, still read `factValue` and `aria-busy` through `#product-region`, found one `main > div > [role=status]`, kept the Tab walk, and passed axe. Traces to: AC-0010, AC-0011.
- **Tokens.** `globals.css` gains radius tokens (`--radius-control` 10px, `--radius-card` 14px, `--radius-mark` 9px), type sizes for the values spec 1 wrote raw (22px, 15px, 11px), the tiles' status edges (amber #D97706, green #16A34A, gray #94A3B8), and the advice box (#FFFBEB fill, #92400E text). Every arbitrary radius and text value in `src/app` moves onto them. Traces to: AC-0014.
- **One icon component.** `src/app/line-icon.tsx` draws an inline SVG from a path, a size, and a stroke width, and always sets `aria-hidden="true"`; the shell's four icons and the nav icons use it. The name avoids `icon.tsx`, which Next.js reserves for the app icon route. Traces to: AC-0015, AC-0016.

### Component / module decomposition

- `src/app/globals.css`: the tokens and the `wide` variant.
- `src/app/line-icon.tsx` (new): `LineIcon`.
- `src/app/page-header.tsx`: `fullWidth` and `mainClassName` on `PageShell`; icons through `LineIcon`.
- `src/app/facts.tsx`: look E classes (T2) and an `inline` option (T5). `src/app/before-after.tsx`: look E classes.
- `src/app/pricing/`: `page.tsx` (tiles, `fullWidth`, the details view), `pricing-list.tsx` (tiles, the `wide` grid, the open product), `figure.tsx`, `price-advice-block.tsx`, `apply-button.tsx`, `what-if-form.tsx`, `what-if-results.tsx`, `pricing-detail.tsx`, `change-form.tsx` (look E classes).
- `src/app/receiving/`: `page.tsx` (`fullWidth`, `mainClassName`), `receipt-form.tsx` (cards, grid areas), `product-region.tsx` (two sections), `recent-receipts.tsx` (header line, `Facts inline`), `result-panel.tsx`, `void-dialog.tsx`, `correct-dialog.tsx` (look E classes).

### State & control flow

- `/pricing?product=<code>` renders the same `PricingDetail` it does today, now beside the list on a desktop. Pressing a list row's link loads that row's details. Saving in the panel refreshes the page as today, so the tiles and the list follow.

### Quality attributes (NFRs)

- **Contrast**: #92400E on #FFFBEB is about 6.8:1; every other text pair uses spec 1's tokens on white or #F3F6FA. The tiles' colored edges are decoration beside a text label. axe in the page-state check enforces the text pairs.
- **Targets**: every control stays at least 44 px from `--spacing-control`.

## Tasks

### T1: Look E's sizes and icons come from tokens and one component

**Depends on:** none
**Mode:** goal-based check (a Vitest search of the source)
**Touches:** `src/app/globals.css`, `src/app/line-icon.tsx`, `src/app/page-header.tsx`, `src/app/phone-menu.tsx`, `src/app/lone-card.tsx`, `src/app/page-error.tsx`, `src/app/not-allowed.tsx`, `src/app/sign-in/page.tsx`, `src/app/sign-in/sign-in-form.tsx`, `test/look-source.test.ts`, `docs/architecture/overview.md`

**Tests:**
- New Vitest `test/look-source.test.ts` reads every `.tsx` under `src/app` and fails on a class matching `\brounded(-[a-z]{1,2})?-\[` or `\btext-\[` (AC-0014), when `<svg` appears in any file but `src/app/line-icon.tsx` (AC-0015), and when that file's `<svg` lacks `aria-hidden="true"` (AC-0016). Red first: it fails on today's tree.
- The shell and lone-card tests in `test/e2e/shell.spec.ts` stay green: the look does not change.

**Approach:**
- Add the tokens, move every arbitrary value onto them, add `LineIcon`, and route the shell's icons through it.
- Name the tokens and `line-icon.tsx` in the overview's look notes.

**Done when:** the T1 tests pass and `npm test` passes.

### T2: The label-and-value list and the before-and-after table wear look E

**Depends on:** T1
**Mode:** goal-based check (the existing browser suites pass unchanged)
**Touches:** `src/app/facts.tsx`, `src/app/before-after.tsx`

**Tests:**
- Every existing suite that reads these parts (`receiving`, `correct`, `production`, `reverse`, `sales`, `trace`, `invoices`) passes unchanged.

**Approach:**
- Restyle with the tokens (light row rules, a tinted header line on the table). Elements, nesting, attributes, and text stay as they are (AC-0019, read in T6).

**Done when:** `npm test` passes.

### T3: The Pricing list has tiles and reads as tables at 1280 px and wider

**Depends on:** T1
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/page-header.tsx`, `src/app/pricing/page.tsx`, `src/app/pricing/pricing-list.tsx`, `src/app/pricing/figure.tsx`, `src/app/pricing/price-advice-block.tsx`, `src/app/pricing/apply-button.tsx`, `src/app/pricing/what-if-form.tsx`, `src/app/pricing/what-if-results.tsx`, `test/e2e/look-pages.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- New `test/e2e/look-pages.spec.ts`, operator session, `resetTestData()` before each test. The suite builds its states as `orderingFixture` in `pricing.spec.ts` does, from `retire502`, `addRaw`, `addFinished`, `receive`, and `setListPrice` in `test/e2e/menu-page.ts` and `setTarget` in `test/e2e/pricing-page.ts`: products in all three groups, one group emptied, and no active finished product.
  - AC-0001 for `/pricing` at 1024×768 and 1280×720: every `main > *` reads computed max-width `none`.
  - AC-0002: the "Product counts" list reads the three labels in order with counts equal to each group's number of level-3 headings, 0 for the emptied group, and no "Product counts" list with no active finished product.
  - AC-0003 at 1280×720 and 1440×900: within one product, the five `dd` boxes share a top within 4 px, the group's header line is visible with the five labels in order, and each `dd`'s `scrollWidth` is at most its `clientWidth`.
  - AC-0004 at 1279×800, 1024×768, and 390×844: each `dd` sits below the one before it, and each `dt` is visible.
- The existing `pricing.spec.ts` and `alerts.spec.ts` pass unchanged.

**Approach:**
- Add the `wide` variant, `fullWidth` on `PageShell`, the tiles, the `wide` grid, and the look E classes on the list, the advice block, the one-press button, and the what-if.
- Describe the content cap, its lifting, and the tiles in the overview's `src/app` row; name the `wide` variant in its look notes; list `look-pages.spec.ts` in its `test/e2e/` row.

**Done when:** the T3 tests pass and `npm test` passes.

### T4: A product's details open in a panel beside the list on a desktop

**Depends on:** T3
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/pricing/page.tsx`, `src/app/pricing/pricing-list.tsx`, `src/app/pricing/pricing-detail.tsx`, `src/app/pricing/change-form.tsx`, `test/e2e/pricing-page.ts`, `test/e2e/pricing.spec.ts`, `test/e2e/look-pages.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-pages.spec.ts` on `/pricing?product=<code>` for a product that needs a new price:
  - AC-0005 at 1024×768 and 1280×720: the tiles, the list's groups, and the region named "Product details" are visible, and the region's left edge is right of the list's right edge.
  - AC-0006 at 1280×720: the region holds the level-2 heading, every build-up `dt` visible, the advice, the one-press button, `#change-saved`, `#change-refused`, and both forms.
  - AC-0021: the page has no "What if raw cost changes?" heading and no `#what-if-raw` control.
  - AC-0007 at 1023×768 and 390×844: the region is visible, and no tile and no group region is visible.
  - AC-0008: the open product's `li` holds no button and no advice text, while the region holds the one-press button.
  - AC-0009 at 1024×768 and 1280×720: pressing Tab from the top of the page focuses every control in the region before any link in the list.
  - AC-0003 at 1280×720 and 1440×900 and AC-0004 at 1279×800 and 1024×768 for the list beside the panel, as in T3.
- In the existing Pricing tests, every detail-page read scopes to the "Product details" region (AC-0020): `detail()` in `test/e2e/pricing-page.ts`, and in `pricing.spec.ts` the `figures()` helper and the direct `main` locators of the detail tests. With those changes, the existing `pricing.spec.ts` passes.

**Approach:**
- On a known code, call `listPricing` too, and render the tiles, the region with `PricingDetail` first, and the list second, given the open code. Keep today's message for an unknown code.
- Name the panel in the overview's `src/app` row.

**Done when:** the T4 tests pass and `npm test` passes.

### T5: Receiving shows its product in a card beside the form on a desktop

**Depends on:** T2, T4
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/page-header.tsx`, `src/app/facts.tsx`, `src/app/receiving/page.tsx`, `src/app/receiving/receipt-form.tsx`, `src/app/receiving/product-region.tsx`, `src/app/receiving/recent-receipts.tsx`, `src/app/receiving/result-panel.tsx`, `src/app/receiving/void-dialog.tsx`, `src/app/receiving/correct-dialog.tsx`, `test/e2e/look-pages.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-pages.spec.ts` on `/receiving?product=RAW-TOM`, with three receipts, one of them void, built in the suite from `seedReceipt` and `voidThrough` in `test/e2e/receiving-page.ts`:
  - AC-0001 for `/receiving` at 1024×768 and 1280×720.
  - AC-0010 at 1023×768 and 390×844: the form's bottom is above the stock card's top, and the stock card's bottom above Recent receipts' heading.
  - AC-0011 at 1024×768 and 1280×720: the desktop `h1`'s bottom is above the form's and the stock card's tops, and the form's right edge is left of the stock card's and Recent receipts' left edges.
  - AC-0012 at 1280×720 and 1440×900 and AC-0013 at 1279×800, 1024×768, and 390×844, as for AC-0003 and AC-0004 with the six receipt figures.
- The existing `receiving.spec.ts`, `correct.spec.ts`, and `alerts.spec.ts` pass unchanged, including the one `main > div > [role=status]` on `/receiving`.

**Approach:**
- Add `mainClassName` to `PageShell`, pass `fullWidth` and the grid classes from `/receiving`, give `Facts` its `inline` option, split `ProductRegion` into its two sections, and set `#product-region` to `display: contents` from `desk` up. Restyle the form, the result, and the void and correct dialogs as cards.
- Describe the Receiving layout in the overview's `src/app` row.

**Done when:** the T5 tests pass and `npm test` passes.

### T6: The recorded checks are in the verification ledger

**Depends on:** T1, T2, T3, T4, T5, T7
**Mode:** visual and manual QA
**Touches:** `docs/specs/look-pricing-receiving/notes/verification-ledger.md`

**Tests:**
- AC-0018: the built app on `127.0.0.1` with the test data, each screen in the state AC-0018 names, compared by the owner with its board; the ledger records each verdict. The verdicts that stand at `21a6886` (the owner's two desktop verdicts on a build of `21a6886`, and the three phone and result verdicts from `db3d64c` the ledger carries forward) stand at the head T6 records when a full read of `git diff 21a6886 <that head> -- src/app` finds only the changes T7's AC-0018 bullet allows; otherwise the owner compares every board that diff can reach again.
- AC-0017: `npm test` on the branch head after T1 to T5 and T7, its pass counts and run time in the ledger.
- AC-0019: `git diff "$(git merge-base main HEAD)" -- src/app/facts.tsx src/app/before-after.tsx` read in full; the ledger records that, for the same props, the elements, nesting, attributes other than `class`, and text are unchanged.
- AC-0020: `git diff "$(git merge-base main HEAD)" -- test/e2e` read in full, plus every file `git ls-files --others --exclude-standard -- test/e2e` lists; the ledger lists each changed expectation in an existing test file.

**Approach:**
- Script the screenshots in the ignored `.context/recorded-run/` and stop every process it starts by its PID.

**Done when:** the ledger records the owner's "match" for each of the five boards, the AC-0017 pass, the AC-0019 read with only class choices changed, and the AC-0020 list with no change outside the details scoping.

### T7: Recent receipts keep cards at a larger text size

**Depends on:** T5
**Mode:** manual QA through the new browser suite
**Touches:** `src/app/globals.css`, `src/app/facts.tsx`, `src/app/receiving/recent-receipts.tsx`, `test/e2e/look-pages.spec.ts`, `docs/architecture/overview.md`

**Tests:**
- `look-pages.spec.ts`, the larger-text-size test, titled for AC-0022, AC-0023, and AC-0012: with the root text size at 20 px, at 1280×720 and 1440×900 the receipts header line is hidden and every receipt label is wider than 20 px and sits beside its value on the value's first line (AC-0022); at 1920×1080 the header line is visible, each receipt's six values start at one top within 4 px, and each label is 1 px wide or less (AC-0022); at each of the three widths every Void and Correct button ends inside the Recent receipts section (AC-0023); at 1280×720 with 16 px text the header line is visible (AC-0012).
- AC-0018: `git diff 21a6886 HEAD -- src/app`, read in full on T7's head, changes only comments and the message-row variant's name, in its definition and every use; the ledger records the read and that the AC-0018 verdicts standing at `21a6886` (see T6) therefore still hold. If the read finds any other change, the owner compares every board it can reach again, and the ledger records those verdicts.
- The AC-0012 tests keep the tops check on every receipt and drop the value-height comparison, which cannot fail.
- The existing suites pass unchanged.

**Approach:**
- Retitle and strengthen the text-size test. Reword the comment above `VALUE_CLASS` in `facts.tsx` so it claims only what each look's classes do. Rename the message-row variant for the status area it matches, apart from the receipt form's `receipt-message` id, and make its comment describe that element. Reword the overview's `src/app` row: each receipt's `li` holds the column rules, the "cells" look places `Facts`'s pairs on them, and the table shows at 1280 px and wider at the default text size, while a larger text size keeps cards until the section fits. Name the `receipt-table` variant and its section-width condition in the look notes.

**Done when:** the T7 tests pass, the ledger records the AC-0018 diff read (and any new owner verdicts it calls for), and `npm test` passes.

## Rollout

Big bang, in one PR. Rollback is a revert. No data, schema, or hosted setting changes. Until spec 3 ships, the other seven pages keep their own content in the old layout inside the shell, which the brief accepts.

## Risks

- CSS subgrid and `display: contents` are the two layout tools this design leans on. Both work in the suite's Chromium; the probe covered `display: contents`. The tables show only at 1280 px and wider, so a phone browser never needs subgrid. Assumption: the owner's desktop browser is a current Chrome, Safari, or Edge, which all support both.
- A test outside the Pricing and Receiving suites that reads the list or the region by position could notice the new layout. The full suite run in each task names it.

## Changelog

- 2026-11-04: initial plan, after the owner's answers (full button name, all five figures), the confirmed boards, and a probe of the Receiving layout.
- 2026-11-05: after the round 1 reviews and the owner's answers (stock card below the form on a phone, no what-if beside the details, boards redrawn to the app's words): the table look starts at 1280 px, the icon file is `line-icon.tsx`, T4 scopes every detail read in `pricing.spec.ts`, T5 depends on T2 and T4 and adds `Facts`'s `inline` option, the fixtures come from the menu helpers, and each task names its mode.
- 2026-11-05: controlled amendment after post-gates review round 3: AC-0012 holds at the default text size, the new AC-0022 states the owner's larger-text-size rule, and T7 carries its test and the round 3 comment and naming fixes.
- 2026-11-05: amendment review: AC-0022 split into AC-0022 and AC-0023 with the owner's approval; T6 now depends on T7; T7 checks the 1920 px table rows and proves the signed-off look unchanged by a full read of its `src/app` diff from `21a6886`.
