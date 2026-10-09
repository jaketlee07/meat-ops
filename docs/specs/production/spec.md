# Spec: production

- **Status:** Approved <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §2 (deterministic engine), §5 "Produce a batch", §8 (web app, floor and office), §11 (boundaries), §12 (verification), §13 item 3; [`docs/costing.md`](../../costing.md) (invariants 3 and 5, the Rounding note); the access model and the `supabase/migrations/` change guidance in [`docs/architecture/overview.md`](../../architecture/overview.md); the app trust boundary in the same file, which this feature's page and action sit inside
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the page and server action are consumed only by this app; no published interface)
- **Shape:** ui

> **Spec contract:** this document defines what "done" means. The implementing
> PR must match this spec, or update it. Verification must be derivable from it.
>
> **Not every section is contract.** `Boundaries`, `Testing Strategy` and
> `Acceptance Criteria` are what a completion gate reads, and an amendment
> changes them. `Objective`, `Durable Outputs`, `Follow-ons` and `Assumptions`
> are working material: they orient a reader and an author corrects them in place
> as the work teaches, without an amendment and without a review round. A review
> finding against working material is advisory — it cannot block, because nothing
> gates the text it cites. Marking the tiers is the spec's job; honouring them
> when a finding is adjudicated is the reviewing surface's.

## Objective

The owner turns raw meat into a finished product and records it as a batch.
On `/production` they type the finished product's code. The screen shows its
raw input, its shrink, and the raw input's pounds on hand and average cost per
lb. They enter the raw pounds used, an optional measured finished weight, the
production date, and an optional note. Because a saved batch cannot be undone,
Save first opens a check step that repeats the batch and says so. After the
owner confirms, the screen shows the batch the engine wrote. It shows the
finished pounds out and whether they came from shrink or a measurement, and
each raw lot the batch drew from, in the order it drew them. It shows the raw
cost, the cost per finished lb, and the finished stock added. It also shows
the raw input's pounds on hand and average cost before and after. A batch
bigger than the raw stock is refused with the pounds available and the pounds
needed. The product's recent batches are listed, so after a dropped connection
the owner can see whether a batch went through. Every stock, cost, shrink, and
batch figure on screen comes from the database. Apart from those, the screen
shows only what the owner types or picks, the device's date in the date field,
and the owner's entries repeated back in the check step. The app computes no
yield, cost, average, or stock.

The screen keeps the receiving screen's three ranked goals: hard to mistype
first, fast on a phone second, and numbers that are easy to trust third.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture and app trust boundary | Applicable: a new route, a new server action, new `src/lib/` modules, and a new ledger write from the app change the areas map, the write path, and the failure notes | `docs/architecture/overview.md` | jaketlee07 | The `src/app/` row names `/production`, says `_server/caller.ts` settles the caller for its save action, and says why the save action's decisions take their calls as arguments. The `src/lib/` row names the production reads, the batch form rules, and the shared number-text rules. The `test/` and `test/e2e/` rows name the production suites. The write path says the app changes the ledger only through `receive_lot`, `void_receipt`, and `produce_batch`, called with the signed-in user's session. The app trust boundary's failure notes cover a batch save as well as a receipt, including the production error page's line about a batch that may have been saved. The `src/app/` guidance on where numbers come from matches the two Always do bullets on reading and showing figures | close-work confirms each named row and sentence exists and matches `src/` and `test/` |
| Display formats (current product truth) | Applicable: the shrink and money-total formats, and the cost-per-lb format's reach to batches, are product decisions that outlive this spec | `docs/costing.md` "Rounding note" | jaketlee07 | The note's table has the AC-0045 and AC-0046 rows with their examples, its cost-per-lb row also covers a batch's cost per finished lb and a finished lot's cost per lb, its sentence on what the screen rounds also covers the check step's repeat of the owner's entries, and the file's opening names the suites that assert them | close-work finds each AC-0045 and AC-0046 example in the note and in a passing test, and finds that sentence covering the check step |
| Interface compatibility | Applicable as a check only: no migration is planned, so the generated types stay as they are | `src/lib/database.types.ts` | jaketlee07 | AC-0062 passes | `npm run gen:types` leaves no diff on the closing commit |
| Agent guidance and commands | Not applicable: no command, variable, or setup step changes | none | n/a | n/a | n/a |
| User documentation | Not applicable: no user-docs surface exists, the owner is the only user, and the screen labels carry the task | none | n/a | n/a | n/a |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory, and the reasons live in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

### Always do

- Read every stock, average, shrink, and every figure of a written batch, lot used, or finished lot from the database.
- Show every weight, cost, percent, and date that the screen displays as a figure, the check step's repeat of the owner's entries included, through the formats in the `docs/costing.md` Rounding note, AC-0045, and AC-0046. Form fields keep what the owner typed or picked, and message text shows as written, AC-0010's typing examples and the engine's reason in AC-0075 included.
- Change the ledger from this page only through `produce_batch`, called with the signed-in user's session.
- Settle the caller inside every server action before it reads or writes anything else, through `src/app/_server/caller.ts`.
- Run `npm run typecheck`, `npm run build`, and `npm test` after each task; a red result stops the work until it is green.

### Ask first

- Any migration, or any change to the six operations, the three views, a grant, or a policy. The one exception is the browser test for AC-0029 and AC-0073, which revokes and then restores the operator's SELECT on `production_batch_lots` on the local stack.
- Any change to a number asserted in `test/costing.test.ts`.
- Adding any npm package.
- Adding a route beyond `/`, `/sign-in`, `/receiving`, and `/production`.
- Changing what the receiving page shows or does, beyond adding the AC-0005 navigation.
- Any write to the hosted Supabase project, or pointing the app at it.

### Never do

- Compute a yield, cost, price, shrink, average, margin, or stock figure in TypeScript. That includes predicting a batch's finished lbs, lots, or cost before the engine writes it, and working out a "before" value from an "after" value.
- Import a Postgres driver under `src/`, or import anything from `src/app/` into `src/lib/`.
- Edit an existing migration file.
- Commit a new top-level directory, or add a PWA manifest, a service worker, or offline queueing.
- Read a privileged variable anywhere under `src/`, except in `src/privileged-env.ts`. "Privileged variable" is defined in the receiving spec's Acceptance Criteria definitions ([`../receiving/spec.md`](../receiving/spec.md)).

## Testing Strategy

The Vitest suites and the Playwright browser suite run under `npm test` against the local Supabase stack. Goal-based checks run as the commands their criteria name. Each criterion is listed once, under the check that closes it; where another check adds a case, the bullet says so.

- **TDD, no database: display formats (AC-0045, AC-0046)**: each format row is a pure rule with exact examples that a wrong formatter fails. The form rules and the refusal and failure messages, including the engine's exact shortfall text, are unit-tested the same way, as construction for the browser and recorded criteria below.
- **TDD, no database: the save action's decisions**: which state the save action returns for each branch: the caller check's outcomes, a failed call before the write, a write with no engine answer, an engine refusal including the not-allowed one, and a failed read after the write; and what the result view shows for each saved state. The action's decisions take their database calls as arguments, so a test makes any one of them fail. A write with no answer and a not-allowed refusal at the write each return the same refused-state shape as the browser-tested refusals. These tests are construction for the browser and recorded criteria below.
- **TDD against the local stack: the production reads**: the product lookup, the lots a batch drew in draw order, the finished lot, and the recent-batches list with its choice, order, and count, over fixtures built through the operations, as construction for the result and recent-batches criteria. A real shortfall refusal from the engine, fed to the message rule, pins that rule to the engine's wording.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033, AC-0036, AC-0038, AC-0039, AC-0040, AC-0041, AC-0042, AC-0047, AC-0051, AC-0052, AC-0053, AC-0054, AC-0056, AC-0059, AC-0067, AC-0068, AC-0069, AC-0070, AC-0071, AC-0072, AC-0073, AC-0074, AC-0075, AC-0076, AC-0081, AC-0082, AC-0083)**: each criterion is a state, a trigger, and an on-screen outcome that only a real browser over the real server and database shows. The suite drives Chromium through Playwright and reads raw tables through `pg` to confirm what was or was not written. For AC-0029 and AC-0073 the test withdraws the operator's read of `production_batch_lots` on the local stack just before confirming, and restores it whether or not the test passes. AC-0036's not-allowed case closes in the recorded run below, with `test/access.test.ts` already showing that the engine's not-allowed refusal writes nothing.
- **E2E accessibility and phone-width checks (AC-0048, AC-0049, AC-0050, AC-0057, AC-0058)**: axe-core, measured element boxes, and computed styles in the same browser suite give a pass or fail bar for each page state. The recorded run applies the same checks to the error page.
- **Manual QA recorded in the verification ledger (AC-0034, AC-0035, AC-0037, AC-0043, AC-0044, AC-0055, AC-0077, AC-0080)**: a recorded run against `npm run start`.
  - With the local REST service stopped before a page load, it records the error page, its text, its focus, its page-state checks, and the recovery after Try again.
  - With the REST service stopped after a page load, it records the AC-0034 message after confirming a save, every field's value, and the focused element.
  - With the app pointed at a throwaway forwarder that holds the save's write call back past the 10-second limit, it records the AC-0035 message, every field's value, the focused element, and that no batch was written.
  - With the forwarder holding the write call while the operator's allowlist row is removed, then letting it through, it records the AC-0080 message, every field's value, the focused element, and that no batch was written; the row is restored afterwards.
  - AC-0037 and AC-0055 close with these cases and the browser suite's refusal and connection-drop cases.
- **Goal-based checks (AC-0060, AC-0061, AC-0062, AC-0063, AC-0064, AC-0065, AC-0066, AC-0078, AC-0079)**: each is settled by one command or one set of commands: a build, a test run, a type regeneration diff, a typecheck, a `grep`, or a dependency audit.
- **Stub tally:** T1, T2, and T3 are covered by validated stubs (`stub: true`); T4, T5, and T6 record `no stub (mode)`; none is uncovered.

## Acceptance Criteria

Definitions used by these criteria:

- **Operator, non-operator, signed-out visitor:** the roles in the access model of [`docs/architecture/overview.md`](../../architecture/overview.md). A signed-out visitor holds no session.
- **Ended session, focusable controls of a page state:** as defined in the receiving spec's Acceptance Criteria definitions ([`../receiving/spec.md`](../receiving/spec.md)).
- **Host scope:** every criterion concerns requests whose `Host` header names `127.0.0.1` or `localhost`.
- **Active finished product:** a `products` row with `kind = 'finished'` and `active = true`.
- **Raw input:** the raw product a finished product's `raw_product_id` names.
- **The page's product list:** the active finished products as of the production page's latest server render.
- **Batch:** one `production_batches` row of the chosen finished product.
- **Lots used:** the `production_batch_lots` rows of a batch, each with the lot it drew from.
- **Draw order:** received date first, then the order the lots were entered (`receipt_seq`), as in `docs/costing.md` invariant 5.
- **The 502 fixture:** RAW-TOM and 502 Smoked Turkey Drums Tom as in the `docs/costing.md` reference product (shrink 0.23; processing fees 0.05, 0.03, and 0.37 per lb; profit 0.05 per lb), with two RAW-TOM receipts: lot A, 5,000 lbs at 1.68, received 2026-10-01, then lot B, 3,000 lbs at 1.80, received 2026-10-05. Batches in the 502 fixture are dated 2026-10-06 unless a criterion says otherwise.
- **Save refusals:** an AC-0010 refusal, and the outcomes of AC-0030, AC-0031, AC-0032, AC-0033, AC-0075, and AC-0080.
- **Save failures:** the outcomes of AC-0034, AC-0035, and AC-0074.
- **Advisory waivers:** none. Each waiver names an npm advisory ID, the date, and the owner's acceptance. Adding one changes this contract section, so it is an amendment.
- **Page states:** the empty production form; the form with no active finished product (AC-0082); the form with a product chosen; the form after an AC-0010 refusal; the open check step; the form after a save; the form after an AC-0029 save; the form after an AC-0030 refusal; the form after an AC-0074 failure; the non-operator page at `/production`; the `/production` error page.

Access and navigation

- [ ] **AC-0001.** While signed out, a request for `/production` ends on `/sign-in`.
- [ ] **AC-0002.** Signed in as a non-operator, `/production` shows "This account isn't allowed to use Meat Ops." and a Sign out button, and shows no production form.
- [ ] **AC-0003.** A save action request replayed with no session, or with a non-operator's session, writes no batch and changes no lot.
- [ ] **AC-0004.** A save action request replayed with no session returns "You're signed out. Sign in again to save this batch."
- [ ] **AC-0067.** A save action request replayed with a non-operator's session returns a message containing "This account isn't allowed to use Meat Ops."
- [ ] **AC-0005.** `/receiving` and `/production` each show a navigation region with a link named "Receiving" to `/receiving` and a link named "Production" to `/production`.
- [ ] **AC-0006.** In the AC-0005 navigation, the only link with an `aria-current` attribute is the link to the page being shown, and its value is `page`.
- [ ] **AC-0007.** Choosing Sign out on `/production` ends on `/sign-in`.
- [ ] **AC-0068.** After Sign out on `/production`, a following request for `/production` ends on `/sign-in`.

Production form

- [ ] **AC-0008.** Typing the code of a product in the page's product list shows its description, its raw input's code and description, its shrink in the AC-0045 format, and its raw input's pounds on hand and average cost per lb.
- [ ] **AC-0009.** The production date starts at today's date on the device.
- [ ] **AC-0082.** When there is no active finished product, `/production` says "No active finished products yet. Add one in Supabase Studio, then reload this page."
- [ ] **AC-0083.** When there is no active finished product, pressing Save opens no check step.
- [ ] **AC-0010.** Each input in this table is refused with its message shown beside its field, and the check step does not open. Within one field, the first matching row wins.

  | Field | Input | Message |
  | --- | --- | --- |
  | Product code | blank | Enter a product code. |
  | Product code | not the code of an active finished product, including a raw product's code and an inactive finished product's code | No active finished product has code `<code>`. |
  | Raw lbs | blank, or anything other than digits with at most one decimal point | Enter the raw lbs, like 2000 or 32.5. |
  | Raw lbs | more than 3 decimal places | Use at most 3 decimal places for weight. |
  | Raw lbs | a value equal to 0, such as 0, 0.0, or 000 | Raw lbs must be above 0. |
  | Finished lbs | not blank, and anything other than digits with at most one decimal point | Enter the finished lbs, like 1540 or 32.5, or leave it blank. |
  | Finished lbs | more than 3 decimal places | Use at most 3 decimal places for weight. |
  | Finished lbs | a value equal to 0 | Finished lbs must be above 0. |
  | Finished lbs | a value above the raw lbs, while the raw lbs pass their rows | Finished lbs can't be more than the raw lbs. |
  | Production date | blank, or not a calendar date written YYYY-MM-DD, such as 2026-02-30 | Enter the production date. |
  | Production date | a date after today on the device | The production date can't be after today. |
  | Notes | longer than 500 characters, counted as JavaScript string length | Keep notes to 500 characters or fewer. |

- [ ] **AC-0069.** A save action request replayed with a production date or a `today` value that is not a calendar date written YYYY-MM-DD writes no batch.
- [ ] **AC-0011.** A form with raw lbs 0.001, finished lbs 0.001, today's date, and a 500-character note saves one batch, and so does a form with raw lbs 2000 and finished lbs 2000.
- [ ] **AC-0012.** Typing the code of an active finished product that is not in the page's product list, on a page whose list holds at least one product, and confirming the save writes one batch of it without a reload.

Check step

- [ ] **AC-0013.** With every field valid, Save opens a check step that names the product code and description, the raw lbs, the production date, and the finished lbs typed or, when that field is blank, "From shrink" and the shrink in the AC-0045 format. Weights show in the Rounding note's weight format and the date in its date format: raw lbs typed as 2000 show as "2,000 lbs", and 2026-10-06 shows as "Oct 6, 2026".
- [ ] **AC-0014.** The check step says "A batch can't be undone."
- [ ] **AC-0015.** Choosing Go back in the check step closes it.
- [ ] **AC-0070.** Choosing Go back in the check step writes no batch.
- [ ] **AC-0071.** After Go back in the check step, every field keeps its value.
- [ ] **AC-0016.** The check step's accessible description contains the product code, the raw lbs, and the production date it names.
- [ ] **AC-0017.** While a save has not returned, pressing Save batch again writes no second batch.

Batch result

- [ ] **AC-0018.** After a save, the screen shows a "Batch saved" heading with the batch number, the product code and description, the production date, the raw lbs in, the finished lbs out, and a "Product shrink" line with the batch's stored shrink in the AC-0045 format, all from the batch the engine wrote.
- [ ] **AC-0019.** The finished lbs out in the result reads "from shrink" when the finished lbs field was blank and "measured" when it was filled.
- [ ] **AC-0072.** When the finished lbs field was filled, the result's "Product shrink" line also says "not used, finished lbs measured".
- [ ] **AC-0081.** In the AC-0022 case, the result's "Product shrink" line shows 23% and says "not used, finished lbs measured".
- [ ] **AC-0020.** In the 502 fixture, a batch of 502 with 2,000 raw lbs and a blank finished lbs field shows finished lbs out 1,540 lbs, one lot used (lot A, 2,000 lbs drawn at $1.6800/lb), raw cost $3,360.00, and cost per finished lb $2.6318/lb.
- [ ] **AC-0021.** In the 502 fixture, a batch of 502 with 6,000 raw lbs shows finished lbs out 4,620 lbs, lot A with 5,000 lbs drawn and then lot B with 1,000 lbs drawn, raw cost $10,200.00, and cost per finished lb $2.6578/lb.
- [ ] **AC-0022.** In the 502 fixture, a batch of 502 with 2,000 raw lbs and finished lbs 1500 shows finished lbs out 1,500 lbs, raw cost $3,360.00, and cost per finished lb $2.6900/lb.
- [ ] **AC-0023.** Each lot used shows its lot number, received date, vendor, lbs drawn, and cost per lb.
- [ ] **AC-0024.** The lots used are listed in draw order. The check fixture holds a lot received 2026-10-05 and entered first, and a lot received 2026-10-01 and entered second, and a batch that draws from both lists the 2026-10-01 lot first.
- [ ] **AC-0025.** In the AC-0020 case, the result shows finished stock added of 1,540 lbs at $2.6318/lb.
- [ ] **AC-0026.** In the AC-0020 case, the result shows the raw input's pounds on hand before 8,000 lbs and after 6,000 lbs, and its average cost before $1.7250/lb and after $1.7400/lb.
- [ ] **AC-0027.** In the AC-0021 case, the result shows the raw input's pounds on hand after 2,000 lbs and its average cost after $1.8000/lb.
- [ ] **AC-0028.** After a save, the product code and production date keep their values, and raw lbs, finished lbs, and notes are empty.
- [ ] **AC-0029.** When a read that the save makes after the engine returns its batch fails, the result shows the AC-0018 fields of the batch the engine returned. Those reads are the lots used, the finished lot, and the raw input's stock after.
- [ ] **AC-0073.** In the AC-0029 case, the result shows no lots used, finished stock added, or before-and-after stock, and in their place says "The batch was saved, but its lots and stock couldn't be loaded. Reload this page to see them."

Refused and failed saves

- [ ] **AC-0030.** In the 502 fixture, a batch of 502 dated 2026-10-03 with 6,000 raw lbs is refused with "The batch wasn't saved. Only 5,000 lbs of raw on hand was received on or before Oct 3, 2026, and this batch needs 6,000 lbs."
- [ ] **AC-0031.** When a product in the page's product list is made inactive after the page loaded, confirming a save of it shows "The batch wasn't saved. This product is no longer active."
- [ ] **AC-0032.** When the raw input of a product in the page's product list is made inactive after the page loaded, confirming a save of it shows "The batch wasn't saved. Its raw product is no longer active."
- [ ] **AC-0033.** When the session has ended after the production form loaded, confirming a save shows "You're signed out. Sign in again to save this batch."
- [ ] **AC-0034.** When a call that a save makes before its write call fails, the form shows "The batch wasn't saved. Try again in a moment." Those calls are the caller check's auth lookup, unless the auth server ends the session (AC-0033), the operator check, and the reads before the write.
- [ ] **AC-0035.** When the save's write call gets no answer from the engine, the form shows "The batch may not have been saved. Reload this page and check Recent batches before saving again."
- [ ] **AC-0074.** When the connection to the app drops while a save is in flight, the form shows the AC-0035 message.
- [ ] **AC-0075.** When the engine refuses a confirmed save for a reason other than those of AC-0030 to AC-0033 and AC-0080, the form shows "The batch wasn't saved." followed by the engine's reason, which is the refusal text after its `produce_batch: ` prefix. With a product of shrink 0.6 whose raw input has at least 0.001 lbs on hand in lots received on or before the production date, raw lbs 0.001 and a blank finished lbs field show "The batch wasn't saved. invalid yield, finished lbs out would be 0".
- [ ] **AC-0080.** When the engine refuses a confirmed save because the caller is not an operator, the form shows "The batch wasn't saved. This account isn't allowed to use Meat Ops."
- [ ] **AC-0036.** Every save refusal writes no batch and changes no lot.
- [ ] **AC-0037.** After a save refusal or a save failure, every field keeps its value.

Recent batches

- [ ] **AC-0038.** With a product chosen, the screen lists the product's 10 last-entered batches, chosen by entry order and not by production date, or all of them when it has 10 or fewer. The check fixture holds 12 batches, and the last one entered has an earlier production date than every other batch.
- [ ] **AC-0076.** The listed batches run last entered first. The check fixture holds batches whose production dates are not in the order they were entered.
- [ ] **AC-0039.** Each listed batch shows its batch number, production date, raw lbs in, finished lbs out, and cost per finished lb, the last in the Rounding note's cost-per-lb format, such as $2.6318/lb.
- [ ] **AC-0040.** When the product has more than 10 batches, the list says "Showing the 10 most recent of N batches.", where N is the product's batch count.
- [ ] **AC-0041.** When the product has no batches, the screen shows "No batches for this product yet."
- [ ] **AC-0042.** After a save whose result shows its lots used, the saved batch is the first in the list.

Error page

- [ ] **AC-0043.** After a `/production` load fails because the database is unreachable, pressing Try again once the database is reachable again shows the production page without a browser reload.
- [ ] **AC-0044.** When the `/production` error page appears, keyboard focus is on its heading.
- [ ] **AC-0077.** The `/production` error page says "If you were saving a batch, it may have been saved. Check Recent batches before saving it again."

Display

- [ ] **AC-0045.** A shrink shows as the stored fraction written as a percent, with 0 to 2 decimals, trailing zeros dropped, then "%": 0.23 → 23%, 0.235 → 23.5%, 0.2345 → 23.45%, 0 → 0%.
- [ ] **AC-0046.** A raw cost total shows as "$", thousands separators, and 2 decimals, rounding half away from zero: 3360 → $3,360.00; 10200 → $10,200.00; 1234.5678 → $1,234.57; 0.005 → $0.01.
- [ ] **AC-0047.** Choosing a product whose raw input has no `inventory_balances` row shows its raw on hand as "0 lbs" and its average cost as "None yet".

Accessibility and phone width

- [ ] **AC-0048.** axe-core reports zero violations for the WCAG tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` in each page state.
- [ ] **AC-0049.** At a 320 × 640 CSS px viewport, in each page state, the page's scroll width is at most 320 CSS px.
- [ ] **AC-0050.** At a 320 × 640 CSS px viewport, in each page state, every focusable control is at least 44 CSS px tall and 44 CSS px wide.
- [ ] **AC-0051.** A batch can be completed, confirmed in the check step, and saved with the keyboard alone.
- [ ] **AC-0052.** After a save, keyboard focus is on the "Batch saved" heading.
- [ ] **AC-0053.** After an AC-0010 refusal, keyboard focus is on the first field with an error.
- [ ] **AC-0054.** After an AC-0010 refusal, the `aria-describedby` of every field with an error points to that field's message.
- [ ] **AC-0055.** After a save refusal other than an AC-0010 refusal, or after a save failure, keyboard focus is on the message that states it.
- [ ] **AC-0056.** After Go back in the check step, keyboard focus is on the Save button.
- [ ] **AC-0057.** In each page state, every focusable control, when focused from the keyboard, has a computed outline style other than `none` and an outline width of at least 2 CSS px.
- [ ] **AC-0058.** In each page state, every focusable control, when focused from the keyboard, has a contrast ratio of at least 3:1 between its computed outline color and the background color behind it.
- [ ] **AC-0059.** The accessible names of the raw lbs field and the finished lbs field each contain "lbs".

Build and repository checks

- [ ] **AC-0060.** `npm run build` exits 0.
- [ ] **AC-0061.** `npm test` runs the Vitest suites and then the Playwright suite, and exits 0.
- [ ] **AC-0062.** Running `npm run gen:types` leaves `src/lib/database.types.ts` with no diff.
- [ ] **AC-0063.** `npm run typecheck` exits 0.
- [ ] **AC-0064.** `grep -rnE "\.(insert|update|upsert|delete)\(" src/` prints nothing.
- [ ] **AC-0065.** `grep -rnE "from ['\"][^'\"]*app/" src/lib/` prints nothing.
- [ ] **AC-0066.** `npm audit --omit=dev --audit-level=high` exits 0, or every high or critical advisory it reports appears in the Advisory waivers list above.
- [ ] **AC-0078.** `grep -rnE "['\"]pg(-pool)?(/[^'\"]*)?['\"]" src/` prints nothing.
- [ ] **AC-0079.** No code under `src/` reads a privileged variable, except `src/privileged-env.ts`, which reads no environment value at all. Each of these prints nothing:
  - `grep -rniE "env(\.|\[['\"])[a-z0-9_]*(service_role|secret|jwt|db_url|database_url|postgres)" src/ | grep -v '^src/privileged-env.ts:'`
  - `grep -rnE "\}\s*=\s*process\.env" src/`
  - `grep -nE "process\.env(\.|\[)" src/privileged-env.ts`

## Retired identifiers

- `AC-0084`

## Follow-ons

- jaketlee07: [`docs/product/intents/corrections-consumed-receipts.md`](../../product/intents/corrections-consumed-receipts.md), reversing a batch that was saved by mistake.
- jaketlee07: [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §13 item 7 (Alerts), a low-raw warning against recent consumption.
- jaketlee07: [`docs/product/intents/app-https-hosting.md`](../../product/intents/app-https-hosting.md), host the app over HTTPS so receiving and production work from a phone, and make the app installable there.

## Assumptions

- Technical: `produce_batch` checks the caller, refuses invalid arguments, draws raw lots in draw order from lots received on or before the production date, applies shrink unless a measured yield is given, writes the batch, its lots used, and one finished lot, and returns only the batch row (source: `supabase/migrations/20261007181933_engine_hardening.sql`, `produce_batch`)
- Technical: the returned batch row carries the batch number, production date, raw lbs in, shrink used, finished lbs out, raw cost total, and cost per finished lb; the lots used and the finished lot need reads after the write, and an operator can read both tables (source: `supabase/migrations/0001_init.sql` table definitions; `supabase/migrations/20261007182816_access_lockdown.sql` `operators_select` policies)
- Technical: the engine's shortfall refusal text carries the lbs available, the production date, and the lbs needed: `produce_batch: shortfall, only <available> lbs raw available on or before <date>, need <needed>` (source: `engine_hardening.sql`, `produce_batch`)
- Technical: the engine refuses an inactive finished product with text ending "is inactive" and an inactive raw input with text "raw input <id> is inactive" (source: `engine_hardening.sql`, `produce_batch`)
- Technical: no operation reverses a batch (source: grep of `supabase/migrations/` for function definitions)
- Technical: the caller check, the session client with its 10-second request limit, the failure texts, the display formats, the not-allowed page, and the browser-suite helpers exist from receiving and are reused; the request limit lives in the shared session client, so it covers this page's calls without a criterion of its own (source: `src/app/_server/caller.ts`, `src/app/_server/session.ts`, `src/lib/failures.ts`, `src/lib/format.ts`, `test/e2e/a11y.ts`; the receiving spec's 10-second request-limit criterion)
- Technical: the proxy sends every signed-out page load other than `/sign-in` to `/sign-in`, so `/production` needs no proxy change (source: `src/proxy.ts`)
- Technical: the seed holds one finished product, 502, made from RAW-TOM at 23 percent shrink, and the suites build their own fixtures (source: `supabase/seed.sql`, `test/db.ts`)
- Technical: the local stack is running (source: `docker ps`, 2026-10-08)
- Product: a saved batch cannot be undone, so Save opens a check step that repeats the batch and says it can't be undone (source: user confirmation 2026-10-08)
- Product: there is no low-raw threshold; the form shows the raw input's pounds on hand, a batch bigger than the stock is refused with the pounds available and needed, and threshold warnings wait for Alerts (source: user confirmation 2026-10-08)
- Product: the finished lbs out, lots used, and cost appear after the save, from the engine; nothing predicts them before (source: user confirmation 2026-10-08)
- Product: besides the batch result, the screen shows the product's 10 most recent batches and the raw input's on hand and average before and after; it does not show suggested prices (source: user confirmation 2026-10-08)
- Product: the finished product is chosen by typing its code; the production date starts at today and can't be after today; measured finished lbs is optional, above 0 and at most the raw lbs; the engine names the batch; notes are optional, up to 500 characters; Receiving and Production link to each other, and `/` still opens Receiving; the app runs only against the local stack (source: user confirmation 2026-10-08)
- Product: design goals in order are hard to mistype, fast on a phone, and numbers easy to trust; plain, high contrast, no decoration; the experience-design pack is not installed, so design intent for this surface is grounded only in these goals (source: receiving spec Assumptions; skill roster, 2026-10-08)
- Product: the result shows a "Product shrink" line with the shrink the engine stored on the batch, and on a measured batch that line says the shrink was not used (source: user confirmation 2026-10-08)
- Product: because a batch cannot be undone, the production error page says a batch may have been saved and to check Recent batches, rather than accepting receiving's silent window (source: user confirmation 2026-10-08)
- Product: an engine refusal the screen does not name shows "The batch wasn't saved." followed by the engine's own reason, as on receiving (source: user confirmation 2026-10-08)
- Process: this spec keeps its own Advisory waivers list, as receiving does (source: user confirmation 2026-10-08)
- Technical: `produce_batch` stores the product's shrink in `shrink_pct_used` even when a measured finished weight replaces it, and it refuses a batch whose shrink-derived finished lbs round to 0 with `produce_batch: invalid yield, finished lbs out would be 0`, after its shortfall check (source: `engine_hardening.sql`, `produce_batch`; rolled-back probe 2026-10-08: shrink 0.6 at 0.001 raw lbs gave that refusal, and 10 raw lbs measured at 9 stored 0.6000)
- Process: the write-call branch of AC-0035 and the not-allowed refusal of AC-0080 are shown on screen in the recorded run, through a throwaway forwarder between the app and the REST service that holds the save's write call back; for AC-0080 the run removes the operator's allowlist row while the call is held and restores it afterwards (source: user confirmation 2026-10-08; the receiving build used the same kind of forwarder, `docs/specs/receiving/notes/verification-ledger.md` T11)
- Technical: on the local stack the `authenticated` role has an 8-second statement timeout and the API's login role an 8-second lock timeout, both shorter than the app's 10-second request limit, so a save held up in the database, with the REST service answering, ends with a database refusal that carries a code, not with no answer (source: `pg_roles` read 2026-10-08; probe 2026-10-08: with the raw input's balance row locked from another session, an operator's `produce_batch` call ended after 8.1 seconds with code 57014, "canceling statement due to statement timeout", and wrote nothing)
- Process: the browser test for AC-0029 and AC-0073 briefly withdraws the operator's read of `production_batch_lots` on the local stack and restores it in a cleanup that runs whether or not the test passes (source: user confirmation 2026-10-08)
- Product: the installable app stays out of this feature, as on receiving; the HTTPS hosting intent's Boundary now carries it (source: user confirmation 2026-10-08; `docs/product/intents/app-https-hosting.md`)
- Process: shipped dependencies are audited with `npm audit --omit=dev --audit-level=high` before merge (source: receiving spec Assumptions)
- Process: the owner approves the spec and the plan in chat, and the agent records the Approved status (source: receiving spec Assumptions)
