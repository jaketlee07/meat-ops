# Spec: search-filters

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the Constraints and Non-goals in the brief [`docs/product/briefs/ui-polish.md`](../../product/briefs/ui-polish.md), including the intent's Guardrail and Limits they point to; the screen rules in the `src/app` row and the Access model in [`docs/architecture/overview.md`](../../architecture/overview.md); [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** docs/product/briefs/ui-polish.md
- **Discovery:** none
- **Contract:** none (no published interface; the reads are this app's own)
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

The business owner finds any past receipt, batch, or sale, and any active finished product, from the list that already holds it. This is spec 2b of the brief.

Success for the business owner:

- Recent receipts, Recent batches, and Recent sales each have a search box and a date, and Menu has a search box.
- Each Recent list pages back 10 rows at a time, up to 50, with or without a search; a search or a date reaches every older row.
- A row found by search or paging keeps its Correct, Reverse, or Void button, so an older receipt, batch, or sale is fixed the same way as a recent one.

The design reference is the "Finding things" block of the comparison page that the brief's Design artifacts name.

## Durable Outputs

This spec, its plan, and its verification ledger are kept in the repository under `docs/specs/search-filters/`. At closeout, the overview, the code, and the tests hold every lasting fact, and the folder cools for 30 days through `close-work`.

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture: the screens | The overview's `src/app` row describes each page. It records the limit the owner accepted on 2026-10-14, says Recent sales lists the 10 last-entered sales with `listRecentSales` unchanged and `orderRecentSales` sorting them, and lists the surfaces its field-label and date-box rules cover. | `docs/architecture/overview.md`, the `src/app` row | `work-loop` implementer | The row names each list's search, its order, "Show 10 more" and the 50-row cap, and that found rows keep their buttons; its label and date-box lists name the search controls; the 2026-10-14 sentence and the `orderRecentSales` sentence are gone. | `close-work` reads the row whole against the code. |
| Current architecture: the reads | The overview's `src/lib/` row lists each read module. | `docs/architecture/overview.md`, the `src/lib/` row | `work-loop` implementer | The row names `src/lib/list-search.ts`, how a search text matches, and the 100-vendor limit. | `close-work` reads the row against the code. |
| Current architecture: the test suites | The overview's `test/` and `test/e2e/` rows list each suite. | `docs/architecture/overview.md`, the `test/` and `test/e2e/` rows | `work-loop` implementer | The rows list this spec's new suites. | `close-work` reads both rows whole. |
| Decision record | The owner's 2026-11-10 calls settle the brief's 2b question, retire the 2026-10-14 limit, and change which sales Recent sales picks. | This spec's Assumptions; the overview's `src/app` row as current behavior | Owner | The Assumptions entries; the overview row | `close-work` confirms the overview states them as current behavior. |
| Design reference | The comparison page is the reference for AC-0042. | The brief's Design artifacts section | Owner | The AC-0042 entry in the verification ledger | `close-work` confirms the brief still links the page. |
| Delivery coordination | This spec is a child of the brief. | The brief's Spec map; this spec's `workspace.toml` entry | Lifecycle: `new-spec`, then `work-loop` | The Spec map row and the workspace entry carry this spec's status. | `python3 .claude/skills/author-delivery-brief/scripts/lint-brief-coverage.py --root .` passes. |
| User documentation | None. Meat Ops has no user guide. | None | None | None | None |
| Release history | None. The app has no version. | None | None | None | None |

## Boundaries

The owners the `Constrained by` line names state the rules this work follows. The lines below are this spec's own limits.

### Always do

- Keep every figure, tag, control name, role, and Tab order the four pages show, except where an acceptance criterion below changes one.
- Match a Recent list's search in the database, through that list's read in `src/lib/`.
- Stop any app or test server you start by its own PID.

### Ask first

- Changing an expectation in an existing test beyond what AC-0044 allows.
- Any change to the database: a table, view, function, index, or grant.
- Stopping any service of a local Supabase stack.

### Never do

- Add a dependency to `package.json`.
- Add a page, a route, or a folder under `src/`.
- Search anything beyond the four lists named below, or add anything the brief's Non-goals name.

## Testing Strategy

- **TDD against the local stack in Vitest (AC-0009, AC-0012, AC-0018, AC-0046, AC-0023, AC-0029)**: each is the set or order of rows a read returns for a given search, checked against seeded rows.
- **TDD as a pure Vitest test (AC-0011, AC-0015, AC-0016, AC-0017)**: each is what the address parser makes of a given value. The browser suite also opens each crafted address AC-0015, AC-0016, and AC-0017 name, since each names the page's result, and checks AC-0011 on Menu's box, which has no parser.
- **Manual QA exercised by the end-to-end (E2E) browser suite (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005, AC-0006, AC-0007, AC-0045, AC-0008, AC-0010, AC-0013, AC-0014, AC-0019, AC-0020, AC-0021, AC-0022, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0047, AC-0030, AC-0031, AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0039, AC-0040, AC-0041)**: each is a form, list, link, line, or layout the owner meets, read from the page's roles, text, element boxes, focus, address, and the rows the test seeded.
- **Goal-based check over the whole suite (AC-0043)**: `npm test` passes.
- **Visual and manual QA, recorded in the verification ledger (AC-0042, AC-0044)**: the owner's comparison with the comparison page, and a read of the branch's test diff.

## Acceptance Criteria

### The search forms

- [ ] **AC-0001.** On `/receiving` with a product chosen, a form named "Search receipts" sits inside the Recent receipts section, above its rows. It holds, in this order, a text box named "Search", a date box named "Received on", and a button named "Search".
- [ ] **AC-0002.** Submitting "Search receipts" lists only the chosen product's receipts whose lot number or vendor name contains the search text and, when a date is given, whose received date is that date.
- [ ] **AC-0003.** On `/production` with a product chosen, a form named "Search batches" sits inside the Recent batches section, above its rows. It holds, in this order, a text box named "Search", a date box named "Produced on", and a button named "Search".
- [ ] **AC-0004.** Submitting "Search batches" lists only the chosen product's batches whose batch number contains the search text and, when a date is given, whose production date is that date.
- [ ] **AC-0005.** On `/sales`, a form named "Search sales" sits inside the Recent sales section, above its rows. It holds, in this order, a text box named "Search", a date box named "Sold on", and a button named "Search".
- [ ] **AC-0006.** Submitting "Search sales" lists only the sales whose sale number, customer name, product code, or product name contains the search text and, when a date is given, whose sale date is that date.
- [ ] **AC-0007.** On `/menu`, a text box named "Search products" sits inside the Menu list's section, above the "Sellable only" switch.
- [ ] **AC-0045.** As the owner types in "Search products", Menu shows every finished product that the switch's choice shows and whose code or name contains the search text, and no other.
- [ ] **AC-0008.** A search whose text is empty or only spaces, and whose date is empty, lists the rows the list shows with no search.

### What a search text matches

- [ ] **AC-0009.** In Recent receipts, Recent batches, and Recent sales, each character of a search text matches only itself, in any letter case. This holds for letters, accented letters included, digits, the space, and every printable ASCII character from `!` to `~` that is not a letter or digit. So "50% off" finds "50% Off Meats" and not "500 Off Meats", "A_B" finds "A_B Foods" and not "AXB Foods", "star*" finds "Star*Market" and not "StarXMarket", and "h, J" finds "Smith, Jones (Co)" and not "Smith Jones Co".
- [ ] **AC-0010.** Menu's search box matches the same way: each character, from the same set, matches only itself in any letter case, and each of AC-0009's four examples gives the same result as a product code or name.
- [ ] **AC-0011.** On all four lists, white space at the start and end of a search text is ignored, as JavaScript's `trim` removes it.
- [ ] **AC-0012.** A search text holding filter syntax, such as `x",lot_number.not.is.null,lot_number.eq."` or `x),sale_number.not.is.null,or(sale_number.eq.y`, lists only the rows whose searched columns contain it as written. A row whose only match sits in text its list does not search is not listed: a receipt's notes, void reason, or correction reason, a batch's notes or reversal reason, or a sale's void reason.

### The address

- [ ] **AC-0013.** A Recent list's search lives in its page's address as `q` for the text and `date` for the date, beside `product` on `/receiving` and `/production`, and its row count lives there as `rows`. Opening that address shows the same list.
- [ ] **AC-0014.** Each search box, Menu's included, takes at most 100 characters as the browser counts them.
- [ ] **AC-0015.** An address `q` has its NUL characters removed and is trimmed as AC-0011 says. It is then cut to its longest start of at most 100 UTF-16 code units that does not split a surrogate pair, and trimmed again. A `q` holding a NUL, or longer than 100 code units, opens the page with no error view.
- [ ] **AC-0016.** An address `date` counts only when it is written `yyyy-mm-dd`, names a real calendar day, and has a year from 0100 to 9999. Any other `date`, such as `2026-02-30`, `0000-01-01`, or `11/10/2026`, is ignored, its date box shows empty, and the page opens with no error view.
- [ ] **AC-0017.** An address `rows` written in digits alone counts as its value from 10 to 50, and as 50 above that, so `1000000` and `99999999999999999999` count as 50. Any other `rows`, such as `5`, `-5`, `+20`, `20.0`, or `1e21`, counts as 10. Each opens the page with no error view.

### Order and paging

- [ ] **AC-0018.** Recent receipts and Recent batches order their matches latest entered first.
- [ ] **AC-0046.** Recent sales orders its matches by sale date, newest first, and latest entered first within one sale date. Sales that share a sale date and an entry time keep the one fixed order AC-0023 describes.
- [ ] **AC-0019.** Outside AC-0047's too-many case, a Recent list shows its first R matches in its order, where R is the address's row count (10 when it has none), or every match when fewer match.
- [ ] **AC-0020.** Outside AC-0047's too-many case, while a Recent list shows fewer rows than match, and fewer than 50, it ends with the line "Showing N of M receipts." (or "batches.", or "sales."), where M is how many rows match. Below that line, a "Show 10 more" link opens the same address with the row count raised by 10, which adds the next matches below the rows shown.
- [ ] **AC-0021.** When a Recent list shows 50 rows and more match, it ends with the line "Showing 50 of M receipts. Search or pick a date to find the rest." (or "batches.", or "sales."), and no "Show 10 more" link.
- [ ] **AC-0022.** Outside AC-0047's too-many case, when a Recent list shows every match, it has no "Showing" line and no "Show 10 more" link.
- [ ] **AC-0023.** For each Recent list, a read asked for R + 10 rows returns, as its first R rows, the rows a read asked for R returns, in the same order, even when matches share the dates and entry times the order sorts by.
- [ ] **AC-0024.** After "Show 10 more", the search box and the date box keep their values.
- [ ] **AC-0025.** After "Show 10 more", the page does not scroll back to its top.
- [ ] **AC-0026.** After "Show 10 more", keyboard focus is on the first row it added.
- [ ] **AC-0027.** Outside AC-0047's too-many case, a Recent list whose search matches nothing reads "No receipts match." (or "No batches match.", or "No sales match.") and offers a "Clear search" link to the same page with no search, keeping its chosen product.
- [ ] **AC-0028.** When Menu's search text, once trimmed, is not empty and no product shows, Menu reads "No products match." and not "No product can be sold right now.". When the trimmed text is empty, Menu's lines are those it shows with no search box.
- [ ] **AC-0029.** When a receipt search's trimmed text is empty, or at most 100 vendor names contain it, Recent receipts lists the receipts AC-0002 and AC-0019 give, with no error view, for every text AC-0015 keeps.
- [ ] **AC-0047.** When a receipt search's trimmed text is not empty and more than 100 vendor names contain it, Recent receipts reads "Too many vendors match. Type more of the name." and offers the "Clear search" link AC-0027 describes. It shows no receipt, no "Showing" line, no "Show 10 more" link, and no "No receipts match." line.

### Row actions on found rows

- [ ] **AC-0030.** A receipt listed by a search or by "Show 10 more" shows the same figures, tags, and buttons as it does among the 10 latest.
- [ ] **AC-0031.** That receipt's Correct and Void save as they do among the 10 latest.
- [ ] **AC-0032.** A batch listed by a search or by "Show 10 more" shows the same figures, tags, and buttons as it does among the 10 latest.
- [ ] **AC-0033.** That batch's Reverse shows the same confirmation and saves as it does among the 10 latest.
- [ ] **AC-0034.** A sale listed by a search or by "Show 10 more" shows the same figures, tags, and buttons as it does among the 10 latest.
- [ ] **AC-0035.** That sale's Void saves as it does among the 10 latest.
- [ ] **AC-0036.** After a Correct, Void, or Reverse saves on a row listed by a search or by "Show 10 more", the page keeps its address and shows that row's new state.

### Layout and keyboard

- [ ] **AC-0037.** On `/receiving`, `/production`, and `/sales`, the search controls come in the Tab order after the stops that come before the list today and before the list's own stops, or, when the list has none, before the stops that come after it today. "Show 10 more" and "Clear search" come right after the list's own stops, or right after the search controls when the list has none. On `/menu`, "Search products" comes right before the "Sellable only" switch. Every other Tab stop keeps today's order.
- [ ] **AC-0038.** At 390 px, 1024 px, and 1280 px, at the default text size and with the browser's text size at 20 px, each search control, Menu's box included, stays inside the box of the section of the list it searches.
- [ ] **AC-0039.** At those widths and text sizes, with a search entered, none of the four pages scrolls sideways.
- [ ] **AC-0040.** Each search control's label, and each search date box, follows the field-label and date-box rules of the overview's `src/app` row.
- [ ] **AC-0041.** The browser suite's page-state check (`checkPageState`) reports no violation on each of the four pages with a search entered and with a search that matches nothing, and on the three Recent lists after "Show 10 more" and at 50 rows, and on Recent receipts in AC-0047's too-many case.

### Look and regressions

- [ ] **AC-0042.** The verification ledger records the owner's "match" verdict for `/receiving`, `/production`, `/sales`, and `/menu` with a search entered, built from this branch at 1280 px with made-up data, compared with the comparison page at revision 1794121141-4df1, its "Finding things" block. A "no match" fails this criterion. The test data's names, numbers, and dates do not count as differences, nor do the comparison's Category and Vendor filters, the look of Menu's switch, which spec 1a set, or anything the brief's Non-goals or the intent's Limits leave out.
- [ ] **AC-0043.** `npm test` passes.
- [ ] **AC-0044.** Read from the branch point with `main`, tracked and untracked, the only changed expectations in existing test files are these, each moved by the criterion named. The values, names, and orders the changed lines assert are otherwise unchanged. A test added to an existing file is not a changed expectation. A change the owner approves under Ask first, recorded in the verification ledger with its date, joins this list.
  - Existing checks of the "Showing the N most recent of M" lines under Recent receipts, Recent batches, and Recent sales (AC-0020).
  - Existing checks that Recent sales picks the 10 last-entered sales (AC-0046, AC-0019).
  - Existing Tab-order lists of `/receiving`, `/production`, `/sales`, and `/menu`, the lists page-state checks compare included, that the search controls, "Show 10 more", and "Clear search" move (AC-0037).

## Follow-ons

None.

## Assumptions

- Technical: Recent receipts and Recent batches list the 10 latest entered per chosen product, and Recent sales the 10 last-entered sales shown by sale date (`orderRecentSales`), each with an exact count; Correct and Reverse sit only in those lists, a limit the owner accepted on 2026-10-14 (source: `src/lib/receiving.ts`, `src/lib/production.ts`, `src/lib/sales.ts`, `src/app/sales/recent-order.ts`; the overview's `src/app` row)
- Technical: the pages read their choices from the address (`?product=`), so a search and its row count can live there too (source: `src/app/receiving/page.tsx`, `src/app/production/page.tsx`)
- Technical: `lots.receipt_seq` and `finished_goods.produced_seq` are always-identity columns that only their sequences write, so they never tie; `v_sale_summary.sale_date` and `created_at` can tie, and sales written in one transaction share a `created_at`, since `now()` is fixed when a transaction starts, so the sales read adds `sale_id` as its last sort key (source: `supabase/migrations/20261007181933_engine_hardening.sql`; a catalog read of stack A, 2026-11-10)
- Technical: at 50 rows a list stays under PostgREST's 1,000-row cap, so each read is one request (source: `supabase/config.toml` `max_rows`)
- Technical: `/production` builds a Reverse preview, about five reads, for each open batch it lists, so the 50-row cap holds one render to about 250 preview reads, against about 50 at 10 rows (source: `src/app/production/page.tsx`, `getReversalPreview` in `src/lib/production.ts`)
- Technical: Menu already loads every active finished product into the browser, so its search filters that list and needs no new read (source: `src/app/menu/menu-list.tsx`)
- Technical: on PostgREST v14.10, `or()` cannot name an embedded table's column. A vendor read first, then `or()` over `lot_number` and `vendor_id`, returned the right lots for vendor and lot-number terms (source: `embed-or.mjs`, a probe on stack A with made-up rows, 2026-11-10, its rows deleted after)
- Technical: inside `or()`, `ilike` reads `*` as a wildcard, so it cannot match an asterisk (source: `or-quote.mjs`, the same kind of probe)
- Technical: inside `or()`, `imatch` with the regular-expression specials escaped, then the value double-quoted with `\` and `"` escaped, matched only itself for made-up names holding `* % _ . ( ) [ ] ^ $ + ? | { } \`, accents in either letter case (`embed-or.mjs`), and commas, double quotes, and apostrophes; two filter-syntax texts matched nothing (`or-imatch-commas.mjs`) (source: probes on stack A, 2026-11-10)
- Technical: a single-column `imatch`, regex-escaped and not quoted, matched only itself for names holding commas, parentheses, `*`, `%`, `|`, braces, a backslash, double quotes, and accents; a quoted single-column value matches nothing, since quotes are kept as written there (source: `limits.mjs` and `embed-or.mjs`, probes on stack A, 2026-11-10)
- Technical: PostgREST accepts an inner-joined `production_batches` embed carrying a filter on `finished_goods`, with an exact count; the probe ran against a product with no rows, so it shows only that the request is accepted (source: `batch-syntax.mjs`, read-only, 2026-11-10)
- Technical: the local gateway answers 414 past an 8 KB address. The planned receipts read (today's select, product, date, `or()` over the text and vendor ids, order, and a 50-row range) held at most 196 vendor ids with a one-letter text and 165 with 100 backslashes, the longest-encoding text AC-0015 keeps (12 encoded characters each); the hosted gateway is not measured (source: `receipts-len.mjs`, read-only, 2026-11-10; `limits.mjs` for the 414)
- Technical: a NUL in a filter value does not fail the read but cuts the match short, and a `0000-01-01` date fails it with a 400; `isCalendarDate` in `src/lib/batch-input.ts` refuses years 0000 to 0099 (source: `limits.mjs`; `src/lib/batch-input.ts`)
- Technical: `receive_lot`, `produce_batch`, and `record_sale` take the lot, batch, and sale number as a parameter, and no check rule limits those columns, so tests can seed numbers holding any character (source: `pg_proc` and `pg_constraint` reads on stack A, 2026-11-10)
- Technical: an operator reads every table and view, so a search shows nothing the operator cannot already read (source: the overview's Access model)
- Process: the experience-design skills (`creative-direction`, `design-review`) are not installed, so the comparison page and look E stand in as the design reference (source: the installed skills list, 2026-11-10)
- Process: the business owner gives no input to this work; the owner (the developer) makes every product call (source: the intent's Outcome section)
- Process: the probe scripts named above live in the session scratchpad; copies of all six are under the ignored `.context/reviews/a5f08fda-ae0d-4d6e-a49d-fb51e365b01a/evidence/` (source: this spec's review run)
- Product: Recent receipts, Recent batches, Recent sales, and Menu get search; raw products have no list, so a raw product is still found by its code on Receiving's form, and the comparison's Category and Vendor filters stay out (source: user confirmation 2026-11-10)
- Product: inactive finished products stay out of Menu's search; no page lists them, and "every product" in the brief's Scope means every active one (source: user confirmation 2026-11-10)
- Product: Correct, Reverse, and Void follow search and paging to older rows, which retires the limit accepted on 2026-10-14 (source: user confirmation 2026-11-10)
- Product: Recent sales picks, pages, and shows its rows by sale date, then entry, newest first, which replaces spec 1a's "10 last-entered, shown by sale date"; a back-dated sale can open lower down, and search and paging reach it (source: user confirmation 2026-11-10)
- Product: each Recent list pages with "Show 10 more", with or without a search, up to 50 rows; past 50, a search or a date finds the rest (source: user confirmation 2026-11-10)
- Product: a receipt search supports up to 100 matching vendor names, with no database change, leaving room under the local gateway's limit in case the hosted one is stricter (source: user confirmation 2026-11-10, after the measured request held 165 to 196)
- Product: each Recent list's search is one text box matching any part of its numbers and names, plus one exact-day date; Menu's is a text box alone (source: user confirmation 2026-11-10)
