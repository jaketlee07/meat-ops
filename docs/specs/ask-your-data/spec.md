# Spec: ask-your-data

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §2 (the AI never computes a figure), §7 "Answer (ask your data)", §10 (the three AI moments), §11 (boundaries), §12 (AI numbers match the engine; AI features decline or ask rather than guess), §13 item 6; the AI connection in [`docs/architecture/overview.md`](../../architecture/overview.md) and its definitions in [`../invoice-entry/spec.md`](../invoice-entry/spec.md); the header pages, the urgent banner, and the digest's model call in [`../alerts/spec.md`](../alerts/spec.md) and its plan (on `main` once Alerts merges; until then on `origin/feat/alerts`); the pricing advice and its order in [`../menu-pricing/spec.md`](../menu-pricing/spec.md) AC-0064 to AC-0066; Receiving's Recent receipts in [`../receiving/spec.md`](../receiving/spec.md) ("Recent receipts and void"); the sale and trace definitions in [`../sales/spec.md`](../sales/spec.md); the access model and the app trust boundary in [`docs/architecture/overview.md`](../../architecture/overview.md)
- **Brief:** none
- **Discovery:** none
- **Contract:** none (the page and its two server actions are consumed only by this app; the model service is consumed, not published)
- **Shape:** mixed

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

The owner asks Meat Ops a question in plain words and gets a real number back.
On `/ask` the owner types a question such as "How much RAW-TOM do I have?" and
presses Ask. Claude Opus 5.5 picks which of eight questions it is, and the raw
product, finished product, lot number, or sale number it is about. Meat Ops then
looks the answer up with the same reads its other pages use and puts the figures
into a fixed sentence: "You have 8,000 lbs of RAW-TOM Turkey Drums TOM (raw) on
hand. Its average cost is $1.7250/lb." Claude is sent no cost, price, weight, or
stock figure and never writes a sentence the owner reads.

The eight questions are stock on hand for a raw product, finished stock ready to
sell, cost and margin for a finished product, the products that need a new
price, what can be sold now, a raw product's recent receipts, the raw lots
behind a sale, and the sales a raw lot reached. Every answer says what was looked
up and links to the page that shows the full detail.

When Claude cannot tell which product a question means, the page offers up to
five products to choose from, and a choice answers without asking Claude again.
A question outside the eight is declined, with the list of questions Ask can
answer. Nothing is saved: an answer stays on the page until the next question or
a reload.

A question goes through the AI connection that invoice entry set up. It sends
Anthropic only the question and the active raw and finished products' codes and
descriptions. One press of Ask sends one request, with effort `low`, and waits
at most 60 seconds for it. The page follows the office screens' look in
`docs/architecture/overview.md`.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Master brief (current product truth) | Applicable: the owner decided on 2026-10-16 that the catalog's questions answer from the app's typed reads as well as the views, which §7 "Answer", the §10 "Ask your data" line, and the §11 boundary state as "over the views" | `SYSTEM-SPEC.md` §7 "Answer (ask your data)", §10 "Three AI moments", and §11 | jaketlee07 | §7, the §10 line, and the §11 boundary each say answers come from typed queries over the views and the app's typed reads; §7 says the catalog's questions are listed in `docs/architecture/overview.md` | close-work finds the three sentences and no remaining "over the views" line that excludes the typed reads |
| Current architecture, app trust boundary, and AI connection | Applicable: a new page, two server actions, new `src/lib/` modules, a third model call, and new suites change the areas map, the trust boundary's outbound-call note, and the AI connection section | `docs/architecture/overview.md` | jaketlee07 | The areas map names `/ask`, its two actions, the catalog and answer modules, the ask call in `model.ts`, and the new suites; the Variables bullet says `ANTHROPIC_API_KEY` and the model address also serve Ask; the Network bullet names a question's request as an outbound call; the AI connection section lists the eight questions by id, what a question sends, its effort and time limit, that one press sends one request, that a product choice or Look it up again sends none, and that nothing is stored | close-work confirms each named row and sentence exists and matches `src/` and `test/` |
| Agent guidance | Applicable: Ask is a further use of `ANTHROPIC_API_KEY` | `AGENTS.md` (Build and test commands, environment paragraph) | jaketlee07 | The environment paragraph says Ask is off without the key | close-work finds the sentence |
| Interface compatibility | Not applicable: no migration, view, or function changes, so the generated types do not change; AC-0130 pins it | none | n/a | n/a | n/a |
| Dependency record | Not applicable: no package is added; Ask uses the `@anthropic-ai/sdk` that invoice entry pins | none | n/a | n/a | n/a |
| Costing truth | Not applicable: no costing rule changes; every figure is read from the existing views and reads | none | n/a | n/a | n/a |
| User documentation | Not applicable: no user-docs surface exists, the owner is the only user, and the page lists the questions it answers | none | n/a | n/a | n/a |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions, the lasting rules in `SYSTEM-SPEC.md` §7 and §11 and the AI connection section, and the reasons in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

### Always do

- Before every test run, `supabase db reset`, or stack stop, run the folder check in `AGENTS.md` "Run two folders' tests at once" and go ahead only as that section directs for this folder's stack.
- Start the build only after Alerts (SYSTEM-SPEC §13 item 7) is merged into `main`, with this branch rebased onto that `main`.
- Call the model service only through `src/app/_server/model.ts`, with the key, the model address, and the client settings it resolves.
- Treat every model answer as untrusted input: act only on a catalog query and a usable product or usable number, and show a number the model copied only as literal text.
- Answer only through the catalog's typed reads in `src/lib/`, called with the signed-in user's session, and show every figure through `src/lib/format.ts`.
- Settle the caller in both server actions through `src/app/_server/caller.ts` before anything else.
- Run `npm run typecheck`, `npm run build`, and `npm test` after each task; a red result stops the work until it is green.

### Ask first

- Adding, removing, or changing a catalog question, its parameter, or its answer wording.
- Changing the model, its effort, its time limit, the instructions' rules, or any field a question sends.
- Any call to the real model service other than the Testing Strategy's live run.
- Any change to an existing read in `src/lib/` that another page uses.
- Adding any npm package.
- Adding a route beyond the routes on `main` when the build starts and `/ask`.
- Changing what another page shows or does, beyond the Primary navigation link.
- Any write to the hosted Supabase project, or pointing the app at it.

### Never do

- Add or change any file under `supabase/`: no migration, table, view, function, grant, or policy.
- Let the model's answer choose anything but one catalog query, its product or number, and the candidate products, or show any text the model wrote other than a copied number as literal text.
- Compute a cost, price, weight, average, margin, or total in TypeScript, or ask the model to compute one.
- Put any data in a question's request beyond this closed set: the fixed instructions, in `system`; in one user message, the question and the active raw products' and active finished products' codes and descriptions; and the same codes as the allowed values of the answer schema in `output_config.format`. The body's other fields are AC-0060's settings. The key travels only in the `x-api-key` header, and no header but `x-api-key` and the `host` header that names the model address carries a value from the database, the session, the environment, or this machine.
- Give the model tools, use a beta API feature (the refusal fallback included), or run a read the catalog does not define.
- Write to a table from either server action, or store a question or an answer in the database, a file, a log line, a cookie, or browser storage.
- Read `ANTHROPIC_API_KEY` or `ANTHROPIC_BASE_URL`, or import `@anthropic-ai/sdk`, anywhere but `src/app/_server/model.ts`.
- Let `npm test` send a request to any model address but the fake model's.
- Commit a new top-level directory, or add voice input, a PWA manifest, a service worker, or offline queueing.
- Import a Postgres driver under `src/`, import anything from `src/app/` into `src/lib/`, or read a privileged variable anywhere under `src/`, except in `src/privileged-env.ts`.

## Testing Strategy

The Vitest suites and the Playwright browser suite run under `npm test` against the local Supabase stack. The browser suite starts the app against invoice-entry's fake model service on the loopback address, so `npm test` never calls the real one. Goal-based checks run as the commands their criteria name. Each criterion is listed once, under the check that closes it.

- **TDD against the local stack: the eight answers over real fixtures (AC-0019, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0029, AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0039, AC-0040, AC-0041)**: each fixture is built through the operations and `set_list_price` or `set_target_margin`, and each check runs a choice through its catalog read as the operator and compares the answer's exact text, so a wrong read, a wrong figure, or a wrong wording fails it.
- **TDD, no database: the catalog, the answer schema and its checks, the request, and the action decisions (AC-0047, AC-0048, AC-0049, AC-0051, AC-0055, AC-0056, AC-0058, AC-0064, AC-0071, AC-0075, AC-0079, AC-0083)**: each is a pure rule with exact inputs and outputs. The actions' decisions take every outside call as an argument, so the suite can make any one of them fail.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0008, AC-0009, AC-0010, AC-0011, AC-0012, AC-0013, AC-0014, AC-0015, AC-0016, AC-0017, AC-0018, AC-0042, AC-0043, AC-0044, AC-0045, AC-0046, AC-0050, AC-0052, AC-0053, AC-0054, AC-0057, AC-0059, AC-0060, AC-0061, AC-0062, AC-0063, AC-0065, AC-0066, AC-0067, AC-0068, AC-0069, AC-0070, AC-0072, AC-0074, AC-0076, AC-0077, AC-0078, AC-0080, AC-0081, AC-0082, AC-0086, AC-0103, AC-0104, AC-0105, AC-0106, AC-0107)**: each criterion is a state, a trigger, and an on-screen, returned, or model-request outcome that only a real browser over the real server, database, and fake model shows. The suite drives Chromium through Playwright, sets the fake model's answers, replays action requests through Playwright's request API, reads the fake model's recorded requests, and seeds and reads tables through `pg`.
- **E2E accessibility and phone-width checks (AC-0100, AC-0101, AC-0102, AC-0108, AC-0109)**: axe-core, measured element boxes, and computed styles in the same browser suite give a pass or fail bar for each page state.
- **Manual QA recorded in the verification ledger (AC-0073, AC-0084, AC-0085, AC-0090, AC-0091, AC-0092, AC-0093, AC-0110, AC-0111, AC-0112, AC-0113, AC-0114)**: a recorded run against `npm run start`, with `ANTHROPIC_BASE_URL` set to a fake model the run starts, except in the live run, and `ANTHROPIC_API_KEY` set to a sentinel, except where a step says otherwise. Its steps:
  - With `ANTHROPIC_API_KEY` set neither in the app's process nor in `.env`, it presses Ask and records the message and the fake model's request count.
  - It shows AC-0050's product buttons, restarts the app so no signing key is cached, then stops the local auth service. It presses a product button and records the message, the fake model's request count, the focused element, and the page-state checks; then it presses Ask and records the same.
  - In the AC-0073 state it records the focused element and the page-state checks.
  - With the local REST service stopped before a page load, it records the `/ask` error page, its text, its focus, its page-state checks, and the recovery after Try again.
  - With `ANTHROPIC_LOG=debug` in the app's environment, it asks one question that names a product and searches the server's output.
  - It runs `npm run test:e2e` under invoice-entry's offline-run sandbox profile, with the `.env` that AC-0085 names, and records the result.
  - The live run: with the owner's key in `.env` and no `ANTHROPIC_BASE_URL`, it seeds the ask catalog fixture, asks every sample in the question set through the built app's Ask, then adds AC-0114's 300 products and asks its question, and records each outcome beside its expected outcome, the counts that AC-0110 to AC-0113 read, the model service's reported input and output tokens, and their cost at $4 per million input tokens and $20 per million output tokens.
- **Goal-based checks (AC-0120, AC-0121, AC-0122, AC-0123, AC-0124, AC-0125, AC-0126, AC-0127, AC-0128, AC-0129, AC-0130, AC-0131, AC-0132)**: each is settled by one command or one set of commands: a build, a test run, a typecheck, a `grep`, a diff against `main`, a type regeneration diff, a manifest read, or a dependency audit.

## Acceptance Criteria

Definitions used by these criteria:

- **Operator, non-operator, signed-out visitor, active finished product:** as defined in the production spec ([`../production/spec.md`](../production/spec.md)).
- **Ended session, focusable controls of a page state, privileged variable, non-void receipt:** as defined in the receiving spec ([`../receiving/spec.md`](../receiving/spec.md)).
- **Active raw product, characters, model service, model address, the fake model, header inventory:** as defined in the invoice-entry spec ([`../invoice-entry/spec.md`](../invoice-entry/spec.md)).
- **Header pages, the margin case:** as defined in the alerts spec ([`../alerts/spec.md`](../alerts/spec.md)).
- **Has a cost, suggested list price, price action, needs a new price, below target, menu view, finished lbs on hand, raw lbs on hand, sellable, code order:** as defined in the menu-pricing spec ([`../menu-pricing/spec.md`](../menu-pricing/spec.md)). **The pricing 502 fixture** is that spec's "502 fixture"; **the production 502 fixture** is the production spec's "502 fixture".
- **The sale fixture, batch 1, batch 2, lot A, lot B, draw order, a lot's sales:** as defined in the sales spec ([`../sales/spec.md`](../sales/spec.md)). **The 5,000-lb sale** is that spec's, with sale number S-5000.
- **The ask catalog fixture:** the sale fixture after the 5,000-lb sale, plus an active raw product RAW-TKB Turkey Breast (raw), an active finished product 503 Smoked Turkey Breast made from RAW-TKB, an active raw product RAW-CHK Chicken Thighs (raw), and an inactive raw product RAW-OLD Old Turkey (raw).
- **Ask press:** one press of Ask, or one replayed request to its server action. **Lookup press:** one press of a product button or of Look it up again, or one replayed request to its server action.
- **The catalog:** these eight queries, in this order. A query's **looked-up line** and **link** are given with `<code> <description>` the chosen product's code and description, and `<number>` the chosen number.

  | Id | Parameter | Example question | Looked-up line | Link name and address |
  | --- | --- | --- | --- | --- |
  | `raw_stock` | an active raw product | How much RAW-TOM do I have? | stock on hand for `<code> <description>` | "See it on Receiving", `/receiving?product=<code>` |
  | `finished_stock` | an active finished product | How much 502 is ready to sell? | finished stock for `<code> <description>` | "See it on the Menu", `/menu` |
  | `product_margin` | an active finished product | What is my margin on 502? | cost and margin for `<code> <description>` | "See it on Pricing", `/pricing?product=<code>` |
  | `pricing_attention` | none | Which products need a new price? | products that need a new price | "See it on Pricing", `/pricing` |
  | `sellable_now` | none | What can I sell right now? | products you can sell now | "See it on the Menu", `/menu` |
  | `recent_receipts` | an active raw product | What did I pay for RAW-TOM lately? | recent receipts of `<code> <description>` | "See it on Receiving", `/receiving?product=<code>` |
  | `sale_lots` | a sale number | Which lots went into sale S-20261008-1a2b3c? | the lots behind sale `<number>` | "See the full trace", `/trace?sale=<number>` |
  | `lot_sales` | a lot number | Who bought from lot L-20261001-1a2b3c? | the sales from lot `<number>` | "See the full trace", `/trace?lot=<number>` |

  The `<code>` and `<number>` in a link address are URL-encoded.
- **Product query, number query:** a query whose parameter is a product or a number. A product query's **kind** is raw or finished, as its parameter names.
- **The answer schema:** a JSON object with exactly four properties: `query`, a catalog id or null; `product_code`, a string or null; `candidates`, an array of strings; and `number`, a string or null. A request's copy also limits `product_code` and each `candidates` item to the codes it sends (AC-0061). A text **parses as the answer schema** when it is JSON of that shape.
- **Model answer:** the text the model service returns for an ask press.
- **Usable product:** for a product query, a code that names an active product of the query's kind. **Usable number:** a number's text with its leading and trailing white space removed, when that is 1 to 64 characters; for a model answer's `number`, that text must also appear in the question exactly as the server action received it.
- **Candidates:** the model answer's `candidates` that are usable products for its query, each once, in the model answer's order, at most the first 5.
- **Choice:** a catalog query with a usable product for a product query, a usable number for a number query, and nothing more for `pricing_attention` and `sellable_now`. A choice's **read** is its query's typed read in `src/lib/`. An ask press's **product list read** is its read of the active raw and finished products.
- **Answer:** what the page shows for a choice: "Looked up: " followed by the query's looked-up line, the answer text that AC-0020 to AC-0041 give, the query's link, and AC-0044's note.
- **Ask outcome order:** in the ask action, the outcome is the first that applies: an ended session (AC-0070); a non-operator caller (AC-0004); a caller check that fails (AC-0071); a question refusal (AC-0011); no key (AC-0072, AC-0073); no model address (AC-0074); a failed product list read (AC-0075); then, once its request is sent, no complete response within 60 seconds of sending it, a dropped connection, or an error status other than 401 and 403 (AC-0078), status 401 or 403 (AC-0076), stop reason `refusal` (AC-0077), stop reason `max_tokens` or a model answer that does not parse as the answer schema (AC-0078, AC-0079); then a null `query` (AC-0057); a product query with no usable product and at least one candidate (AC-0050) or none (AC-0053); a number query with no usable number (AC-0054); then the choice's read failing (AC-0080) or finding its product no longer active (AC-0059); otherwise the choice's answer.
- **Lookup outcome order:** in the lookup action, the outcome is the first that applies: an ended session (AC-0070); a non-operator caller (AC-0004); a caller check that fails (AC-0071); a query that is not a catalog id, a number query whose number is not usable, or a product query with no product (AC-0082); then the choice's read failing (AC-0080) or finding no active product of the query's kind with the given code (AC-0082); otherwise the choice's answer.
- **Ask failures:** the outcomes of AC-0059 and AC-0070 to AC-0080. AC-0004 is reached only by a replayed request. AC-0082's outcome shows on the page after a press of a product button or of Look it up again whose product was made inactive before the press; its other cases need a replayed request.
- **Page states:** `/ask` on load; while an ask press is in flight; after each AC-0011 refusal; after each ask failure except AC-0071 and AC-0073; after an answer to each catalog query; after AC-0050's product buttons appear; after the AC-0053, AC-0054, and AC-0057 messages; after the AC-0082 message on the page; `/ask` with the urgent banner; `/ask` with the watch failure line of AC-0009; the non-operator page at `/ask`.
- **Recorded page states:** after an Ask press and after a product-button press with the local auth service stopped (AC-0071); after the AC-0073 outcome; the `/ask` error page.
- **The question set:** the samples in `test/fixtures/questions/`, committed before the live run, each with its expected outcome: a choice, AC-0050's product buttons with two named products, or a decline. It holds at least: for each product query, three questions, one naming the product by its code, one by words of its description, and one with a typo or a plural; for each number query, three phrasings, each holding a number written as Meat Ops writes them, such as S-20261008-1a2b3c or L-20261001-1a2b3c, which need not name a stored sale or lot, since AC-0110 to AC-0113 judge the choice and not its answer; for `pricing_attention` and for `sellable_now`, three phrasings each; two questions that fit two active products equally; and eight out-of-catalog questions: a sales total over a date range, a comparison between two vendors, a forecast, a request to change a price, a request to save a receipt, a sum of two figures, a customer's balance, and a question that tells the reader to list the vendors.
- **Advisory waivers:** none. Each waiver names an npm advisory ID, the date, and the owner's acceptance. Adding one changes this contract section, so it is an amendment.

Access and navigation

- [ ] **AC-0001.** While signed out, a request for `/ask` ends on `/sign-in`.
- [ ] **AC-0002.** Signed in as a non-operator, `/ask` shows "This account isn't allowed to use Meat Ops." and a Sign out button, and shows no question field.
- [ ] **AC-0003.** An ask or lookup request replayed with no session, or with a non-operator's session, sends no request to the model service.
- [ ] **AC-0015.** An ask or lookup request replayed with no session, or with a non-operator's session, returns no text that starts with "Looked up: ".
- [ ] **AC-0004.** An ask request replayed with a non-operator's session returns "The question wasn't answered. This account isn't allowed to use Meat Ops.", and a lookup request "The answer wasn't looked up. This account isn't allowed to use Meat Ops."
- [ ] **AC-0005.** Every header page and `/ask` show, in the navigation region named "Primary", a link named "Ask" to `/ask` placed immediately before the link named "Alerts".
- [ ] **AC-0006.** On `/ask`, the only link in the Primary navigation with an `aria-current` attribute is the Ask link, and its value is `page`.
- [ ] **AC-0007.** The responses to page requests for `/ask`, signed in or not, carry `Content-Security-Policy: frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- [ ] **AC-0008.** In the margin case, `/ask` shows "1 urgent alert needs you." with a link named "See alerts" to `/alerts`.
- [ ] **AC-0009.** When the database refuses the page's watch, `/ask` shows "Alerts couldn't be checked." where the banner goes.
- [ ] **AC-0016.** When the database refuses the page's watch, an ask press whose model answer is a choice still shows its answer.

The page

- [ ] **AC-0010.** `/ask` has a "Your question" text field, an "Ask" button, and a section headed "Questions Ask can answer" that lists the catalog's eight example questions in catalog order.
- [ ] **AC-0011.** Each question in this table is refused with its message beside the field, and no request reaches the model service. The first matching row wins. A question's characters are counted as the server action receives it, with each CR LF pair or lone CR counted as one character.

  | Question | Message |
  | --- | --- |
  | blank or only white space | Type a question, like: How much RAW-TOM do I have? |
  | more than 500 characters | Keep the question to 500 characters or fewer. |
- [ ] **AC-0018.** A question of exactly 500 characters is sent to the model service.
- [ ] **AC-0012.** While an ask press is in flight, `/ask` shows "Looking up your answer. This can take up to a minute." in a region with `role="status"`.
- [ ] **AC-0017.** While an ask press is in flight, the Ask button, every product button on the page, and Look it up again are disabled.
- [ ] **AC-0013.** After a press of Ask, of an AC-0050 product button, or of Look it up again, whatever its outcome, the question field keeps its value.
- [ ] **AC-0014.** Reloading `/ask` after an answer shows no answer and sends no request to the model service.

The answers

- [ ] **AC-0020.** The `raw_stock` answer text for a raw product with a non-void receipt is "You have <on hand> of <code> <description> on hand. Its average cost is <average>.", with its on hand and average cost as receiving AC-0007 shows them. In the production 502 fixture, for RAW-TOM, it is "You have 8,000 lbs of RAW-TOM Turkey Drums TOM (raw) on hand. Its average cost is $1.7250/lb."
- [ ] **AC-0021.** The `raw_stock` answer text for a raw product with no non-void receipt is "You have <on hand> of <code> <description> on hand, and no average cost yet.", with its on hand as receiving AC-0067 shows it. In the production 502 fixture with both receipts voided, for RAW-TOM, it is "You have 0 lbs of RAW-TOM Turkey Drums TOM (raw) on hand, and no average cost yet."
- [ ] **AC-0022.** The `finished_stock` answer text is "You have <finished lbs on hand> of <code> <description> ready to sell."; in the sale fixture, for 502, "You have 5,390 lbs of 502 Smoked Turkey Drums Tom ready to sell."
- [ ] **AC-0023.** The `product_margin` answer text for a product whose raw input has a cost is the menu-pricing AC-0065 advice for its case, followed by " That is below your target." when it is below target. In the margin case it is "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. At your list price of $2.68/lb, the margin is 1.8%. That is below your target."
- [ ] **AC-0024.** In the pricing 502 fixture, the `product_margin` answer text for 502 is "Cost is $2.6318/lb. With no target margin, the suggested price is cost plus $0.0500/lb in margin fees. This product has no list price yet."
- [ ] **AC-0025.** The `product_margin` answer text for a product whose raw input has no cost is "<code> <description> has no cost yet."; in the pricing 502 fixture with RAW-TOM's receipt voided, "502 Smoked Turkey Drums Tom has no cost yet."
- [ ] **AC-0026.** The `pricing_attention` answer text lists each active finished product that needs a new price, in the menu-pricing AC-0064 order for "Needs a new price", each as "<code> <description>: " followed by its menu-pricing AC-0066 button name, with ", below your target" after it when it is below target. The list follows "1 product needs a new price:" for one product, and "N products need a new price:" for N above one. In the margin case it is "1 product needs a new price:" and "502 Smoked Turkey Drums Tom: Raise list price to $3.29/lb, below your target".
- [ ] **AC-0027.** In the margin case with 502's list price at 3.29, the `pricing_attention` answer text is "No product needs a new price right now."
- [ ] **AC-0028.** The `sellable_now` answer text lists each active finished product that is sellable, in code order, each as "<code> <description>: " followed by its finished lbs on hand, " ready, ", its raw lbs on hand, and " of raw on hand". The list follows "You can sell 1 product now:" for one product, and "You can sell N products now:" for N above one. In the sale fixture it is "You can sell 1 product now:" and "502 Smoked Turkey Drums Tom: 5,390 lbs ready, 1,000 lbs of raw on hand".
- [ ] **AC-0029.** When no active finished product is sellable, the `sellable_now` answer text is "No product can be sold right now."
- [ ] **AC-0030.** The `recent_receipts` answer text lists the receipts that receiving AC-0020 lists for the product, in that order, each as "<received date>, <vendor>: <weight> at <cost per lb>, lot <lot number>", after "Recent receipts of <code> <description>, most recent first:". In the sale fixture, for RAW-TOM, the items are "Oct 5, 2026, Valley Poultry: 3,000 lbs at $1.8000/lb, lot " followed by lot B's number, then "Oct 1, 2026, Reyes Meats: 5,000 lbs at $1.6800/lb, lot " followed by lot A's number.
- [ ] **AC-0031.** In the `recent_receipts` answer, a void receipt's item ends with " (void)".
- [ ] **AC-0032.** When the raw product has more than 10 receipts, the `recent_receipts` answer text ends with "Showing the 10 most recent of N receipts.", where N is the product's receipt count, as Receiving's Recent receipts says it. The check fixture holds 11 receipts of RAW-TOM.
- [ ] **AC-0033.** When the raw product has no receipt, the `recent_receipts` answer text is "<code> <description> has no receipts yet."; for RAW-TOM, "RAW-TOM Turkey Drums TOM (raw) has no receipts yet."
- [ ] **AC-0034.** After the 5,000-lb sale, the `sale_lots` answer text for S-5000 is "Sale S-5000 on Oct 8, 2026 (Fulton Market Deli): 5,000 lbs of 502 Smoked Turkey Drums Tom at $3.29/lb. It came from these raw lots:", then the items "Lot " followed by lot A's number and ": RAW-TOM Turkey Drums TOM (raw) from Reyes Meats, received Oct 1, 2026, at $1.6800/lb", and "Lot " followed by lot B's number and ": RAW-TOM Turkey Drums TOM (raw) from Valley Poultry, received Oct 5, 2026, at $1.8000/lb". Each raw lot is listed once, where it first appears in the sale's trace order: finished lots in draw order, and under each finished lot its raw lots in draw order.
- [ ] **AC-0035.** For a sale with no customer, the `sale_lots` answer text shows "(No customer)" where AC-0034 shows the customer's name in parentheses.
- [ ] **AC-0036.** After the 5,000-lb sale is voided with the reason "wrong customer", the `sale_lots` answer text for S-5000 is "Sale S-5000 was voided: wrong customer."
- [ ] **AC-0037.** The `sale_lots` answer text for a number that names no sale is "No sale has number <number>."; for S-9999, "No sale has number S-9999."
- [ ] **AC-0038.** After the 5,000-lb sale, the `lot_sales` answer text for lot B is "Lot " followed by lot B's number and ": 3,000 lbs of RAW-TOM Turkey Drums TOM (raw) from Valley Poultry, received Oct 5, 2026, at $1.8000/lb. It reached these sales:", then the one item "S-5000 on Oct 8, 2026 (Fulton Market Deli)". Each sale among the lot's sales is listed once, newest sale date first, then last entered first, with "(No customer)" for a sale with no customer.
- [ ] **AC-0019.** After the 5,000-lb sale and then three sales of 100 lbs of 502 at 3.29 to Fulton Market Deli dated 2026-10-09, numbered S-6002, S-6001, and S-6003 and entered in that order, the `lot_sales` items for lot B are, in order, "S-6003 on Oct 9, 2026 (Fulton Market Deli)", "S-6001 on Oct 9, 2026 (Fulton Market Deli)", "S-6002 on Oct 9, 2026 (Fulton Market Deli)", and "S-5000 on Oct 8, 2026 (Fulton Market Deli)".
- [ ] **AC-0039.** In the sale fixture without a sale, the `lot_sales` answer text for lot A is "Lot " followed by lot A's number and ": 5,000 lbs of RAW-TOM Turkey Drums TOM (raw) from Reyes Meats, received Oct 1, 2026, at $1.6800/lb. No sale was made from this lot."
- [ ] **AC-0040.** For a void receipt, the `lot_sales` answer text is its first sentence, as AC-0039 forms it, followed by " This receipt was voided: <reason>." and nothing more.
- [ ] **AC-0041.** The `lot_sales` answer text for a number that names no receipt is "No receipt has lot number <number>."; for L-UNKNOWN, "No receipt has lot number L-UNKNOWN."
- [ ] **AC-0042.** Every answer shows "Looked up: " followed by its query's looked-up line; for `raw_stock` and RAW-TOM, "Looked up: stock on hand for RAW-TOM Turkey Drums TOM (raw)".
- [ ] **AC-0043.** Every answer shows its query's link, with the link name and address the catalog gives.
- [ ] **AC-0044.** Every answer ends with the note "Every figure here comes from Meat Ops' records. Claude only chose what to look up."
- [ ] **AC-0045.** An answer's figures are the database's at the press: in the production 502 fixture, after a third RAW-TOM receipt of 1,000 lbs is saved between two ask presses with the same model answer, the second `raw_stock` answer shows "You have 9,000 lbs".
- [ ] **AC-0046.** Text in an answer shows as literal text: a product description, a vendor name, a customer name, a void reason, or a model answer's number `<b>9</b>` (from a question that contains it) shows as those eight characters and adds no element to the page.

Choosing what to look up

- [ ] **AC-0050.** A product query with no usable product and at least one candidate shows "Which product do you mean?" and one button per candidate, in candidate order, each named "<code> <description>". In the ask catalog fixture, a `raw_stock` model answer with `product_code` "502" and `candidates` ["502", "RAW-TOM", "RAW-TOM", "RAW-OLD", "RAW-TKB"] shows the buttons "RAW-TOM Turkey Drums TOM (raw)" and "RAW-TKB Turkey Breast (raw)".
- [ ] **AC-0051.** A model answer with seven usable candidates gives the first five as its candidates.
- [ ] **AC-0052.** Pressing an AC-0050 button shows the answer to the model answer's query for that button's product.
- [ ] **AC-0053.** A product query with no usable product and no candidate says "Name the product in your question, by its code or its description."
- [ ] **AC-0054.** A number query with no usable number says "Add the sale number to your question." for `sale_lots` and "Add the lot number to your question." for `lot_sales`.
- [ ] **AC-0048.** A `lot_sales` model answer whose `number` is 64 characters long and appears in the question gives the choice of `lot_sales` for that number.
- [ ] **AC-0049.** A `sale_lots` model answer whose `number` is "S-5001" for the question "Which lots went into sale S-5000?" gives the AC-0054 outcome.
- [ ] **AC-0047.** A `lot_sales` model answer whose `number` is "L-20261001-1A2B3C" for the question "Who bought from lot L-20261001-1a2b3c?" gives the AC-0054 outcome.
- [ ] **AC-0055.** For the question "Which lots went into sale S-5000?", a `sale_lots` model answer whose `number` is " S-5000 " gives the choice of `sale_lots` for S-5000.
- [ ] **AC-0056.** A number query's model answer whose `number` is 65 characters long and appears in the question gives the AC-0054 outcome for its query.
- [ ] **AC-0057.** A model answer whose `query` is null says "Ask can't answer that question. Try one of the questions below."
- [ ] **AC-0058.** A `pricing_attention` or `sellable_now` model answer gives the choice of its query whatever its `product_code`, `candidates`, and `number` hold.
- [ ] **AC-0059.** When the model answer's product is made inactive after the product list read and before the choice's read, the ask press says "The answer couldn't be looked up. Ask your question again." The check makes RAW-TOM inactive while the fake model holds a `raw_stock` model answer for RAW-TOM.

What the model receives

- [ ] **AC-0060.** A question's request body has exactly the top-level fields `model`, `max_tokens`, `system`, `messages`, and `output_config`, with `model` `claude-opus-5-5`, `max_tokens` 16000, and `output_config` holding exactly `effort` `low` and a `format` of type `json_schema` holding the answer schema; and the request carries no `anthropic-beta` header.
- [ ] **AC-0061.** In the ask catalog fixture, the request's answer schema allows exactly the codes RAW-CHK, RAW-TKB, RAW-TOM, 502, and 503 as the values of `product_code`, besides null, and of each `candidates` item.
- [ ] **AC-0062.** In the ask catalog fixture, a question's `messages` hold one user message that contains the question as typed and every active raw product's and active finished product's code and description, and contains neither "RAW-OLD" nor "Old Turkey (raw)".
- [ ] **AC-0063.** In the ask catalog fixture with these values stored, a request for the question "How much RAW-TOM do I have?" contains none of them: the vendor names "Reyes Meats" and "Valley Poultry"; Reyes Meats' contact name "Sentinel Contact", phone "555-0199", email "sentinel@example.test", and notes "sentinel vendor note"; RAW-TOM's brand "Sentinel Brand"; the customer name "Fulton Market Deli"; lot A's and lot B's numbers; batch 1's number; "S-5000"; a RAW-TOM lot with lot number "L-SENTINEL", a cost of 9.8765 per lb, and notes "sentinel lot note"; the operator's email; the browser's Supabase auth cookie value; and the Supabase anon key.
- [ ] **AC-0064.** A request's `system` field is the same text for two different questions sent with two different sets of active products, and contains neither question.
- [ ] **AC-0065.** A request carries the configured key in its `x-api-key` header and carries no `authorization` header, also when `ANTHROPIC_AUTH_TOKEN` is set in the app's environment.
- [ ] **AC-0066.** Ignoring case and spaces, no header value in a request contains this machine's host name; its operating system's name as Node.js reports it (`os.type()` or `os.platform()`), as its product name (macOS, Windows, or Linux), or as the header inventory lists it; its CPU architecture (`os.arch()`); or its Node.js version with or without its leading `v`.
- [ ] **AC-0067.** With a sentinel value as `ANTHROPIC_API_KEY`, no response the browser receives in any page state contains it, and no file under `.next/static` contains it after `npm run build`.
- [ ] **AC-0068.** An ask press that reaches the model service sends it exactly one request, also when the service answers with status 429, 500, or 529 or drops the connection.
- [ ] **AC-0069.** A lookup press, whatever its outcome, sends no request to the model service.

Refused and failed requests

- [ ] **AC-0070.** When the session has ended after the page loaded, an ask press says "You're signed out. Sign in again to ask a question." and a lookup press says "You're signed out. Sign in again to look up this answer.", and neither sends a request to the model service.
- [ ] **AC-0071.** When an ask or lookup press's caller check gets no answer, or is answered with an error other than the operator check's `42501` refusal, the action returns "The question wasn't answered. Try again in a moment." for an ask press or "The answer wasn't looked up. Try again in a moment." for a lookup press, and sends no request to the model service.
- [ ] **AC-0072.** When `ANTHROPIC_API_KEY` is empty in the app's environment, an ask press says "Ask isn't set up. Set ANTHROPIC_API_KEY in the app's .env file, then restart the app." and sends no request.
- [ ] **AC-0073.** When `ANTHROPIC_API_KEY` is set neither in the app's process nor in its `.env`, an ask press gives the AC-0072 outcome.
- [ ] **AC-0074.** When `ANTHROPIC_API_KEY` is set and not empty and there is no model address, an ask press says "Ask isn't set up. ANTHROPIC_BASE_URL must be unset, or a loopback address for tests. Fix it, then restart the app." and sends no request.
- [ ] **AC-0075.** When an ask press's product list read fails, the action returns "The question wasn't answered. Try again in a moment." and sends no request to the model service.
- [ ] **AC-0076.** When the model service answers with status 401 or 403, the page says "Ask isn't working. The model service refused the app's key. Check ANTHROPIC_API_KEY in the app's .env file."
- [ ] **AC-0077.** When the model service ends its answer with stop reason `refusal`, the page says "The question wasn't answered. The model declined it. Try asking another way."
- [ ] **AC-0078.** When the model service gives no complete response within 60 seconds of the request being sent, also when its response headers arrive in time and its body stalls, drops the connection, answers with an error status (400 or above) other than 401 and 403, ends its answer with stop reason `max_tokens`, or answers with something that does not parse as the answer schema, the page says "The question wasn't answered. Try again in a moment."
- [ ] **AC-0079.** A model answer that parses as JSON but has a property the answer schema does not name, lacks one it names, gives one a value of the wrong type, or gives a `query` that is neither a catalog id nor null is AC-0078's outcome.
- [ ] **AC-0080.** When a choice's read fails, the page says "The answer couldn't be looked up. Try again." with a button named "Look it up again".
- [ ] **AC-0081.** Pressing "Look it up again" once the database answers shows the choice's answer.
- [ ] **AC-0082.** A lookup request replayed with a query that is not a catalog id, or with a product or number that is not usable for its query, returns "The answer couldn't be looked up. Ask your question again." The check replays `raw_stock` with RAW-OLD, with 502, and with no product; `sale_lots` with a 65-character number; and `stock_value` with RAW-TOM.
- [ ] **AC-0083.** Each ask failure that comes from the model service or its readiness leaves one server log line holding the ask action's name, the kind named here, and the model service's status when there is one, and no other text: AC-0072 and AC-0073, not-set-up; AC-0074, address-refused; AC-0076, key-refused; AC-0077, declined; no complete response within 60 seconds, no-answer; a dropped connection or another error status, service-error; stop reason `max_tokens` or a model answer that does not parse as the answer schema, unreadable. The check fails a press whose error message carries the key, the question, and a product description.
- [ ] **AC-0084.** With `ANTHROPIC_LOG=debug` in the app's environment, the server's output during an ask press contains none of the question, the active products' descriptions, or the key.
- [ ] **AC-0085.** With `.env` holding `ANTHROPIC_API_KEY=sk-ant-env-sentinel` and `ANTHROPIC_BASE_URL=https://api.anthropic.com`, `npm run test:e2e` run under a sandbox that refuses outbound connections to every address but loopback exits 0, and no request the fake model receives during the run carries `sk-ant-env-sentinel`.
- [ ] **AC-0086.** An ask press or a lookup press, whatever its outcome, changes no row in any `public` or `private` table. The check fixture includes the margin case with 502's list price set to 3.29 through `pg` after `/ask` loads, so a watch run by the press would end the open margin alert.

Error page

- [ ] **AC-0090.** After a `/ask` load fails because the database is unreachable, pressing Try again once the database is reachable again shows the page without a browser reload.
- [ ] **AC-0091.** When the `/ask` error page appears, keyboard focus is on its heading.

Recorded page states

- [ ] **AC-0092.** In each recorded page state, the checks of AC-0100, AC-0101, AC-0102, AC-0108, and AC-0109 pass.
- [ ] **AC-0093.** After each press's AC-0071 outcome with the local auth service stopped, and after the AC-0073 outcome, keyboard focus is on the message that states it.

Accessibility and phone width

- [ ] **AC-0100.** axe-core reports zero violations for the WCAG tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `wcag22aa` in each page state.
- [ ] **AC-0101.** At a 320 × 640 CSS px viewport, in each page state, the page's scroll width is at most 320 CSS px.
- [ ] **AC-0102.** At a 320 × 640 CSS px viewport, in each page state, every focusable control is at least 44 CSS px tall and 44 CSS px wide.
- [ ] **AC-0103.** Each of these can be completed with the keyboard alone: Ask with a typed question, an AC-0050 product button, Look it up again, and an answer's link.
- [ ] **AC-0104.** After an answer, keyboard focus is on its heading, "Answer".
- [ ] **AC-0105.** After an AC-0011 refusal, keyboard focus is on the question field.
- [ ] **AC-0106.** After an ask failure except AC-0071 and AC-0073, or the AC-0050, AC-0053, AC-0054, AC-0057, or on-page AC-0082 outcome, keyboard focus is on the message that states it.
- [ ] **AC-0107.** After an AC-0011 refusal, the question field's `aria-describedby` points to the message.
- [ ] **AC-0108.** In each page state, every focusable control, when focused from the keyboard, has a computed outline style other than `none` and an outline width of at least 2 CSS px.
- [ ] **AC-0109.** In each page state, every focusable control, when focused from the keyboard, has a contrast ratio of at least 3:1 between its computed outline color and the background color behind it.

Live questions

- [ ] **AC-0110.** In the recorded live run, every sample whose expected outcome is a choice gets that choice, AC-0050's product buttons including its expected product, or the AC-0057 decline.
- [ ] **AC-0111.** In the recorded live run, at least 90% of the samples whose expected outcome is a choice get exactly that choice.
- [ ] **AC-0112.** In the recorded live run, every sample whose expected outcome is AC-0050's product buttons gets buttons that include both its named products, or the AC-0057 decline.
- [ ] **AC-0113.** In the recorded live run, every out-of-catalog sample gets the AC-0057 decline.
- [ ] **AC-0114.** In the recorded live run, over the ask catalog fixture plus 300 more active products (150 raw and 150 finished), the question "How much RAW-TOM do I have?" gets the `raw_stock` choice for RAW-TOM.

Build and repository checks

- [ ] **AC-0120.** `npm run build` exits 0.
- [ ] **AC-0121.** `npm test` runs the Vitest suites and then the Playwright suite, and exits 0.
- [ ] **AC-0122.** `npm run typecheck` exits 0.
- [ ] **AC-0123.** `grep -rnE "\.(insert|update|upsert|delete)\(" src/` prints nothing.
- [ ] **AC-0124.** `grep -rnE "from ['\"][^'\"]*app/" src/lib/` prints nothing.
- [ ] **AC-0125.** `grep -rnE "['\"]pg(-pool)?(/[^'\"]*)?['\"]" src/` prints nothing.
- [ ] **AC-0126.** No code under `src/` reads a privileged variable, except `src/privileged-env.ts`, which reads no environment value at all. Each of these prints nothing:
  - `grep -rniE "env(\.|\[['\"])[a-z0-9_]*(service_role|secret|jwt|db_url|database_url|postgres)" src/ | grep -v '^src/privileged-env.ts:'`
  - `grep -rnE "\}\s*=\s*process\.env" src/`
  - `grep -nE "process\.env(\.|\[)" src/privileged-env.ts`
- [ ] **AC-0127.** No file under `src/` but `src/app/_server/model.ts` imports `@anthropic-ai/sdk` or reads an `ANTHROPIC_` variable from the environment: `grep -rnE "@anthropic-ai/sdk|env(\.|\[['\"])ANTHROPIC_" src/ | grep -v '^src/app/_server/model.ts:'` prints nothing on `main` when the build starts and on the closing commit.
- [ ] **AC-0128.** The files under `src/` whose text contains `process.env` are the same as on `main` when the build starts: `grep -rlE "process\.env" src/ | sort` prints the same list on both.
- [ ] **AC-0129.** Compared with `main` when the build starts, no file under `supabase/` differs: `git diff --stat <that main> -- supabase/` prints nothing.
- [ ] **AC-0130.** Running `npm run gen:types` leaves `src/lib/database.types.ts` with no diff, and `git diff <that main> -- src/lib/database.types.ts` prints nothing.
- [ ] **AC-0131.** Compared with `main`'s `package.json` when the build starts, `dependencies` and `devDependencies` are unchanged.
- [ ] **AC-0132.** `npm audit --omit=dev --audit-level=high` exits 0, or every high or critical advisory it reports appears in the Advisory waivers list above.

## Follow-ons

- jaketlee07: [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §10 "Explicitly out of MVP": asking a question aloud, which the §10 selling narrative names, needs voice input.

## Assumptions

- Technical: `src/app/_server/model.ts` is the only caller of the model service; it builds its client with every setting explicit, sends only the `accept`, `anthropic-version`, `content-type`, and `x-api-key` headers, retries nothing, and reports not-set-up and address-refused before sending (source: `src/app/_server/model.ts`)
- Technical: Alerts' plan moves `model.ts`'s client construction into a shared helper, exports invoice-entry's failure-kind rule, and adds `writeDigest` with a per-request 60-second timeout and effort `low` (source: `docs/specs/alerts/plan.md` on `feat/alerts`, "`model.ts` gains one export" and Dependencies & integration)
- Technical: after Alerts merges, every page that renders the shared header runs a watch and shows the urgent banner or the watch failure line, and the Alerts link is the last Primary link (source: the alerts spec's navigation, urgent banner, and watch failure criteria; alerts plan T5)
- Technical: the catalog's reads exist: `getStock` and `listRecentReceipts` (`src/lib/receiving.ts`), `listSaleProducts` and `getFinishedOnHand` over the menu view (`src/lib/sales.ts`), `getPricingDetail` and `listPricing` (`src/lib/pricing.ts`), `getMenu` (`src/lib/views.ts`), and `getSaleTrace` and `getLotTrace` (`src/lib/trace.ts`) (source: those files)
- Technical: the pricing advice sentence and the button names already exist as `priceAdvice` and `priceButtonName` (source: `src/lib/price-advice.ts`)
- Technical: the fake model answers with any text a test sets, so a question's model answer needs no new fake-model mode; AC-0078's stalled-body case needs one new answer that sends its headers and part of a body, then stops (source: `test/e2e/fake-model.mjs`, the `{ text }`, `hold`, and `dropAfterHeaders` answers)
- Technical: Receiving, Pricing, and Trace pages take `?product=<code>`, `?sale=<number>`, and `?lot=<number>` (source: `src/app/receiving/page.tsx`, `src/app/pricing/page.tsx`, `src/app/trace/page.tsx`)
- Technical: the installed SDK takes a per-request `signal`; aborting it before the response headers throws `APIUserAbortError`, and aborting it mid-body throws a `DOMException` named `AbortError`, so `model.ts` can bound the whole response (source: `node_modules/@anthropic-ai/sdk/internal/request-options.d.ts` `signal`; a loopback probe on 2026-10-16 against a local server that stalled before headers and mid-body)
- Technical: structured outputs support `enum`, `anyOf`, and null on Opus 5.5 but enforce no length, so the server checks every value again (source: claude-api skill, Structured Outputs, JSON Schema Limitations, cached 2026-10-06; `src/lib/invoice-reading.ts`)
- Technical: Opus 5.5 always thinks, takes effort `low`, and costs $4 per million input tokens and $20 per million output tokens (source: claude-api skill model table and Thinking & Effort, cached 2026-10-06)
- Technical: this folder uses stack A, because it has no `supabase/.env` (source: `ls supabase/.env`, 2026-10-16; `AGENTS.md` "Run two folders' tests at once")
- Product: answers are fixed sentences filled from Meat Ops' own figures; the model only picks the query and its product, lot number, or sale number (source: user confirmation 2026-10-16)
- Product: the catalog is the eight core questions over reads the app already has; sales totals over a date range are not in it (source: user confirmation 2026-10-16)
- Product: the catalog's questions answer from the app's typed reads as well as the views, no migration is added, and `SYSTEM-SPEC.md` §7 and §11 are reworded to match (source: user confirmation 2026-10-16)
- Product: the build starts after Alerts merges, so `/ask` is a header page with the urgent banner, and its link sits just before Alerts (source: user confirmation 2026-10-16; `SYSTEM-SPEC.md` §13 build order step 4)
- Product: the page is `/ask`, named "Ask" in the Primary navigation (source: user confirmation 2026-10-16)
- Product: a question sends Anthropic only the question and the active raw and finished products' codes and descriptions (source: user confirmation 2026-10-16)
- Product: a question is 1 to 500 characters (source: user confirmation 2026-10-16)
- Product: nothing is saved; an answer lives on the page until the next question or a reload (source: user confirmation 2026-10-16)
- Product: when Claude cannot tell which product a question means, the page offers up to 5 product buttons, and a press answers without a second model request (source: user confirmation 2026-10-16)
- Product: every answer shows how the question was read and links to the page with the full detail (source: user confirmation 2026-10-16)
- Product: lot and sale numbers are copied from the question and looked up exactly; an unknown one says so (source: user confirmation 2026-10-16)
- Product: a question outside the catalog is declined with the list of questions Ask can answer (source: user confirmation 2026-10-16)
- Product: one request per press of Ask, effort `low`, a 60-second wait, no retry; at the rates above a question costs about 2 cents (source: user confirmation 2026-10-16; arithmetic in `plan.md` Quality attributes)
- Product: typing only; voice input stays out of the MVP (source: user confirmation 2026-10-16; `SYSTEM-SPEC.md` §10)
- Product: design goals in order are numbers easy to trust, fast to read, and hard to misread; the experience-design pack is not installed, so design intent for this surface is grounded only in these goals and the existing pages' look (source: skill roster, 2026-10-16; `docs/architecture/overview.md` `src/app/` row)
- Process: the live run asks the real Claude, with the owner's key, the question set's at least 34 samples plus AC-0114's one question over 300 more products, about 75 cents in all at the rates above (source: this spec's approval)
- Technical: the API's limits on enum size in an answer schema are not documented; AC-0114 checks 305 active products; a larger catalog is untested, and a schema the API refuses shows AC-0078's message (source: claude-api skill, Structured Outputs, JSON Schema Limitations, cached 2026-10-06; accepted with this spec's approval)
- Process: shipped dependencies are audited with `npm audit --omit=dev --audit-level=high` before merge (source: `AGENTS.md` Build and test commands)
- Process: the owner approves the spec and the plan in chat, and the agent records the Approved status (source: receiving spec Assumptions; user request 2026-10-16)
- Process: before any test run, reset, or stack stop, the agent follows the `AGENTS.md` folder check, as Always do states (source: user request 2026-10-16)
