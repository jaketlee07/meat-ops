# Plan: production

- **Spec:** [`spec.md`](spec.md)
- **Status:** Approved <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:**
  - **Area rules and access model:** `docs/architecture/overview.md`.
  - **Analogous implementation:** the receiving page, `src/app/receiving/` (`page.tsx`, `actions.ts`, `receipt-form.tsx`, `void-dialog.tsx`, `error.tsx`), over `src/lib/receiving.ts`, `src/lib/receipt-input.ts`, `src/lib/failures.ts`, and `src/lib/format.ts`.
  - **Its tests:** `test/receipt-input.test.ts`, `test/format.test.ts`, `test/failures.test.ts`, `test/receiving-data.test.ts`, and the browser suite `test/e2e/receiving.spec.ts` with `test/e2e/receiving-page.ts`, `test/e2e/a11y.ts`, and `test/e2e/states.ts`. Fixtures come from `test/db.ts` and `test/users.ts`.
  - **Named deviation:** receiving's save action has no test seam (`docs/product/intents/receiving-test-refinements.md`). The production save action keeps its decisions in a module that takes its database calls as arguments, so Vitest drives every branch.
  - **Read-only probe against the local stack, 2026-10-08:** PostgREST embeds the raw input many-to-one as `raw:raw_product_id(id,code,description,active)`; the hint form `products!raw_product_id` resolves the other way and returns `[]`. `finished_goods` ordered by `produced_seq.desc` with `production_batches(...)` embedded and `Prefer: count=exact` returns the recent batches and their count. `production_batch_lots` embeds `lots(lot_number,received_date,receipt_seq,vendors(name))`. Numerics arrive as JSON numbers (`0.2300` reads as 0.23). The shortfall refusal reads `produce_batch: shortfall, only 500.000 lbs raw available on or before 2026-10-06, need 6000`.
  - **Golden-number probe, 2026-10-08,** in a rolled-back transaction on the local stack with a copy of the 502 fixture: 2,000 raw lbs gave 1540.000 finished, raw cost 3360.0000, 2.6318 per lb, a finished lot of 1540.000 at 2.6318, and stock 6000.000 at 1.7400 (from 8000.000 at 1.7250); 6,000 raw lbs gave 4620.000, 10200.0000, 2.6578, and stock 2000.000 at 1.8000; 2,000 raw lbs measured at 1,500 gave 3360.0000 and 2.6900; 6,000 raw lbs dated 2026-10-03 was refused with `shortfall, only 5000.000 lbs raw available on or before 2026-10-03, need 6000`.

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/production/notes/verification-ledger.md`. A genuine artifact error
> follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material.

## Approach

The work lands as six dependency-ordered layers, and each leaves `npm test` green.

1. Add the pure rules in `src/lib/`, test-first: the batch form rules, the shrink and money formats, and the batch save messages, including the shortfall text.
2. Add the production reads in `src/lib/production.ts`, test-first against the local stack.
3. Add the save action's decisions as a module that takes its calls as arguments, test-first with no database, and the thin server action that wires them.
4. Add the production page: the shared header with navigation, the form, the product region, the check step, the save, and the result. Receiving moves onto the shared header.
5. Add the recent batches, the refusal and failure states, the error page, and the replayed-request checks.
6. Bring the architecture overview and the costing reference up to date, run the goal-based checks, and record the stopped-service run.

No migration is needed. `produce_batch` already does the work, and an operator can read every table the screen shows. The riskiest part is the check step in layer 4: a native dialog that stays open while the save is pending, then hands focus to the result or the message. The browser suite covers each focus outcome.

## Constraints

- `SYSTEM-SPEC.md` §2 and §11: the app computes no yield, cost, price, shrink, average, or margin, and writes the ledger only through operations.
- `AGENTS.md` hard rules 2, 3, 4, 6, and 7.
- The access model and app trust boundary in `docs/architecture/overview.md`: every server action settles the caller through `src/app/_server/caller.ts`, and every server-side client uses the 10-second request limit in `src/app/_server/session.ts`.
- No ADR or RFC governs this area.

## Construction tests

**Integration tests:** none beyond per-task tests. `test/global-setup.ts` and the per-test `assertLedgerInvariants` hook in the Vitest suites keep the costing invariants checked after every test that touches the ledger.

**Manual verification:** the T6 recorded run.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Current architecture and app trust boundary, `docs/architecture/overview.md` | T6 | The edited rows and write-path sentence named in the spec's Durable Outputs row | close-work reads each named row against `src/` and `test/` |
| Display formats, `docs/costing.md` Rounding note | T1 (formats and tests), T6 (note text) | `test/production-rules.test.ts` cases for AC-0045 and AC-0046, and the result-panel browser checks for the 4-decimal cost per finished lb | close-work finds each example in the note and in a passing test, and the rounding sentence covering the check step |
| Interface compatibility, `src/lib/database.types.ts` | T6 | AC-0062 output in the ledger | `npm run gen:types` leaves no diff |

Every design fact below either shows in code and tests or is delivery residue, except the save-action seam, whose reason belongs in the architecture overview's `src/app/` row (T6).

## Design (LLD)

### Design decisions

- **No migration.** The many-to-one embed, the recent-batches read, and the lots-used read all work through PostgREST over existing grants (probe above). Traces to: AC-0008, AC-0018 to AC-0027, AC-0038 to AC-0042.
- **Decisions apart from the action.** `src/app/production/save-batch.ts` exports `decideSave(fields, deps)` and the `SaveDeps<C>` shape: `caller()` resolves to an outcome that carries the session client `C` when the caller is an operator, and `readBefore`, `write`, and `readAfter` each take that client. `actions.ts` is the `"use server"` wrapper that passes `checkCaller` and the real calls and revalidates. It stays out of `src/lib/` because the caller check lives in `src/app/_server/`, and AC-0065 forbids that import. Traces to: AC-0029, AC-0034, AC-0035, AC-0075.
- **A pure result view.** `src/app/production/result-view.ts` turns a saved state into the panel's lines and sections, including the AC-0073 message in place of the missing ones and the AC-0072 "not used" note; `result-panel.tsx` only renders what it returns. Traces to: AC-0018, AC-0019, AC-0029, AC-0072, AC-0073.
- **The check step is a native `<dialog>` opened with `showModal()`**, as the void confirmation is: the browser traps focus and closes it on Escape. Go back comes first. Traces to: AC-0013 to AC-0017, AC-0070, AC-0071, AC-0051, AC-0056.
- **One shared header, not-allowed view, and error view.** `src/app/page-header.tsx` (heading, navigation, Sign out), `src/app/not-allowed.tsx`, and `src/app/page-error.tsx` (heading text and an optional extra line as props) serve both pages; the production error page passes the AC-0077 line. Receiving's page and error page switch to them with no change to what they show beyond the navigation. Traces to: AC-0002, AC-0005, AC-0006, AC-0043, AC-0044, AC-0077.
- **Shared number-text rules.** The digits-with-one-point pattern and the decimal-place count move out of `receipt-input.ts` into `src/lib/number-text.ts`, and both form-rule modules import them. Traces to: AC-0010.

### Component / module decomposition

- `src/lib/batch-input.ts`: `parseBatchForm(fields, finishedCodes)`, pure, run in the browser for instant messages and again in the action. It accepts a production date and a `today` only when each is a real calendar date written YYYY-MM-DD.
- `src/lib/production.ts`: `listActiveFinishedProducts` (each row `{ id, code, description, shrinkPct, raw: { id, code, description, active } }`), `listFinishedProducts` (active or not, for the action), `listLotsUsed(batchId)` sorted into draw order by received date then `receipt_seq` (an ordering, not arithmetic), `getFinishedLot(batchId)`, and `listRecentBatches(finishedProductId)` with its total. Raw stock reuses `getStock` from `src/lib/receiving.ts`.
- `src/lib/format.ts`: `formatShrink` and `formatMoney`. `formatShrink` moves the decimal point in the number's decimal text rather than multiplying by 100.
- `src/lib/failures.ts`: the batch texts and `batchSaveFailureMessage(error, stage)`; `ReceivingAction` widens to name `saveBatch` for the log line.
- `src/app/production/`: `page.tsx` (server: caller, product list, `?product=<code>` region), `production-form.tsx` (client: fields, product lookup, check step, result or message), `check-step.tsx`, `result-view.ts`, `result-panel.tsx`, `recent-batches.tsx`, `form-fields.ts` (FormData reading), `save-batch.ts`, `actions.ts`, `error.tsx`.

### State & control flow

Page contract for `/production`, from `frontend-engineering` create mode:

- **Who and why:** the owner, at a desk or on the floor, records one batch.
- **Primary action:** Save, then Save batch in the check step. The expected result is the "Batch saved" panel, and the next action is the next batch. Save batch writes one batch, and a refusal writes nothing.
- **First screen:** the product code field, raw lbs, finished lbs, date, notes, and Save, in one column at 320 px.
- **Product proof and measurement event:** none; this is an internal tool with no analytics.

State matrix (the applicable subset of the 18 states):

| State | Treatment | AC |
| --- | --- | --- |
| first-run | No product chosen: "Type a product code to start." With no active finished product, the AC-0082 text, and Save carries `aria-disabled="true"` | AC-0082, AC-0083 |
| loading | While the product changes, the product region has `aria-busy="true"` | AC-0008 |
| content | Product line with raw stock, form, recent batches | AC-0008, AC-0038 |
| no-results | Unknown code message, shown only after the page has re-rendered for that code and still has no such product | AC-0010, AC-0012 |
| empty | "No batches for this product yet."; a raw input with no stock shows "0 lbs" and "None yet" | AC-0041, AC-0047 |
| disabled | Check-step buttons `aria-disabled` while saving | AC-0017 |
| success | "Batch saved" panel in a `role="status"` region, focus on its heading; when the reads after the write failed, the AC-0073 message in place of the missing sections | AC-0018, AC-0052, AC-0029, AC-0073 |
| error | Field messages, or a focused form banner for a refusal or a failure, with every value kept | AC-0010, AC-0030 to AC-0035, AC-0074, AC-0075, AC-0080, AC-0037, AC-0055 |
| partial / large-data-set | "Showing the 10 most recent of N batches." | AC-0040 |
| permission/denied | Not-allowed page with Sign out | AC-0002 |
| destructive-confirmation | The check step: it says the batch can't be undone, and Go back is first in tab order and takes initial focus | AC-0013, AC-0014, AC-0015, AC-0070, AC-0071 |
| high-zoom | 320 px reflow | AC-0049 |
| keyboard-only | Full keyboard path, visible focus | AC-0051, AC-0057 |
| offline, blocked, long-content, reduced-motion | Not applicable: offline queueing is out of scope, and a dropped connection or unreachable database shows the AC-0034 or AC-0035 message with the form kept, or the error page with its AC-0077 line; nothing blocks; notes are capped at 500 characters and wrap; the UI has no animation | n/a |

The form moves through idle, invalid, checking, pending, saved, and refused or failed.

1. Save runs `parseBatchForm` with the device's today. When the code is not in the page's product list, the form first re-renders the page for that code (`?product=<code>`, as a typed code does) and runs the rules against the new list, so a product made active since the load gets its description and shrink from that render (AC-0012). A refusal shows each message beside its field and focuses the first (AC-0053). Otherwise the check step opens, showing typed weights through `formatWeight` and the date through `formatDate` (AC-0013).
2. Go back closes the dialog and focus returns to Save (AC-0056).
3. Save batch sends the action and keeps the dialog open with both buttons `aria-disabled` and a "Saving…" status, so a second press sends nothing (AC-0017).
4. When the state returns, the dialog closes. A saved state shows the result, empties raw lbs, finished lbs, and notes, and focuses "Batch saved" (AC-0028, AC-0052). A field-error state from the action behaves as step 1. A refused or failed state keeps every field and focuses the message (AC-0037, AC-0055).

The chosen product lives in the URL, as on receiving, so the server renders its stock and recent batches. The action revalidates `/production` only when the reads after the write loaded, because a failed render would swap the form for the error page. When that render fails anyway, the error page's AC-0077 line tells the owner the batch may have been saved.

### Behavior & rules

- The action settles the caller first, then the form rules with every finished code, then reads the raw input's stock before the write, then calls `produceBatch`, then reads lots used, the finished lot, and the stock after.
- "from shrink" or "measured" in the result, and the "not used" note on the product shrink line, come from whether the finished lbs field was filled. Nothing compares the engine's finished lbs with a computed one.
- `batchSaveFailureMessage` checks the raw-input refusal before the general "is inactive" rule, because both texts end in "is inactive". The shortfall text is matched whole, and its three values are shown through `formatWeight` and `formatDate`. A not-allowed refusal at the write (SQLSTATE 42501) gets the AC-0080 text. Any other engine text is shown after "The batch wasn't saved." with its `produce_batch: ` prefix removed (AC-0075).

### Failure, edge cases & resilience

- A save that fails before its write says the batch wasn't saved; a write with no answer says it may have been; a write that returned is a save even if the reads after it fail (AC-0029). These are the receiving rules applied to a batch.
- The 10-second request limit and the proxy's handling of an ended session on a POST are inherited unchanged.

### Quality attributes (NFRs)

- **Aesthetic reference:** Stripe Dashboard forms, as on receiving: a light surface, high contrast, tabular figures, no gradients or illustration. XD genre routing: skipped (experience-design pack absent). The page uses the existing tokens in `src/app/globals.css` and adds none.
- **Accessibility:** every field has a visible `<label>`; each error has an id that its field's `aria-describedby` names; the result panel sits in a `role="status"` region; the navigation is a `<nav aria-label="Primary">`.
- The page-state checks in `test/e2e/a11y.ts` (`checkPageState`) run in every page state the spec lists, at 320 px. Lots used render as a stacked list rather than a table so long lot numbers fit 320 px (AC-0049).

## Tasks

Stub validation, 2026-10-08: each `stub: true` block below was copied to disposable scratch outside the repository. Against placeholder declarations of the new modules, `tsc --noEmit` under the repository's compiler options exited 0 for all three. Against the current tree, `vitest run` under `sandbox-exec` with network and writes outside scratch denied and a 120-second alarm exited 1, each file failing to load its missing module: `../src/lib/batch-input.js` (T1), `../src/lib/production.js` (T2), and `../src/app/production/save-batch.js` (T3). The scratch copies were removed.

### T1: Batch form rules, shrink and money formats, and batch save messages pass their tables

**Depends on:** none

**Touches:** `src/lib/batch-input.ts`, `src/lib/number-text.ts`, `src/lib/receipt-input.ts`, `src/lib/format.ts`, `src/lib/failures.ts`, `test/production-rules.test.ts`

**Tests:**
- `test/production-rules.test.ts`, a new file. stub: true. Test functions and ACs: "AC-0010: finished lbs above the raw lbs is refused" (AC-0010), "AC-0045: a shrink shows as a percent" (AC-0045), "AC-0046: a raw cost total shows as dollars and cents" (AC-0046), "AC-0030: a shortfall names what is available and what is needed" (AC-0030). sha256 `3b4c204684249fdb3a2e9a90a8f59c0d7712813f7a90d1ea3d23a2a448fb9fb4`.

```ts
import { describe, expect, it } from "vitest";
import { parseBatchForm } from "../src/lib/batch-input.js";
import { batchSaveFailureMessage } from "../src/lib/failures.js";
import { formatMoney, formatShrink } from "../src/lib/format.js";
import { RpcError } from "../src/lib/rpc.js";

const fields = {
  productCode: "502",
  rawLbs: "2000",
  finishedLbs: "",
  productionDate: "2026-10-06",
  notes: "",
  today: "2026-10-08",
};

describe("batch form rules", () => {
  // STUB: AC-0010
  it("AC-0010: finished lbs above the raw lbs is refused", () => {
    expect(parseBatchForm({ ...fields, finishedLbs: "2000.001" }, new Set(["502"]))).toEqual({
      ok: false,
      errors: { finishedLbs: "Finished lbs can't be more than the raw lbs." },
    });
  });
});

describe("production formats", () => {
  // STUB: AC-0045
  it("AC-0045: a shrink shows as a percent", () => {
    expect([0.23, 0.235, 0.2345, 0].map((fraction) => formatShrink(fraction))).toEqual([
      "23%",
      "23.5%",
      "23.45%",
      "0%",
    ]);
  });

  // STUB: AC-0046
  it("AC-0046: a raw cost total shows as dollars and cents", () => {
    expect([3360, 10200, 1234.5678, 0.005].map((total) => formatMoney(total))).toEqual([
      "$3,360.00",
      "$10,200.00",
      "$1,234.57",
      "$0.01",
    ]);
  });
});

describe("batch save messages", () => {
  // STUB: AC-0030
  it("AC-0030: a shortfall names what is available and what is needed", () => {
    const error = new RpcError(
      "produceBatch failed: produce_batch: shortfall, only 5000.000 lbs raw available on or before 2026-10-03, need 6000",
      "P0001",
    );
    expect(batchSaveFailureMessage(error, "write")).toBe(
      "The batch wasn't saved. Only 5,000 lbs of raw on hand was received on or before Oct 3, 2026, and this batch needs 6,000 lbs.",
    );
  });
});
```

- The same file then grows, in EXECUTE: one case per AC-0010 row, including the YYYY-MM-DD row and an invalid `today` (construction for AC-0069), with first-row-wins order within a field; the AC-0011 values at the rule level; the remaining AC-0045 and AC-0046 examples; and `batchSaveFailureMessage` giving the AC-0031 and AC-0032 texts for the two inactive refusals, the AC-0034 text for any before-write error, the AC-0035 text for a write error with no code, the AC-0075 text for any other engine refusal, and the AC-0080 text for a 42501 from the write.
- `test/receipt-input.test.ts`, `test/format.test.ts`, and `test/failures.test.ts` stay unchanged and green.

**Approach:**
- Move the number-text pattern and decimal-place count into `number-text.ts`; `receipt-input.ts` imports them unchanged in behavior.
- Write `parseBatchForm` on the shape of `parseReceiptForm`, with the calendar-date check on both dates.
- Add `formatShrink`, `formatMoney`, and the batch texts with `batchSaveFailureMessage`.

**Done when:** the T1 tests are green.

### T2: The production reads return the screen's rows in the screen's order

**Depends on:** T1

**Touches:** `src/lib/production.ts`, `test/production-data.test.ts`

**Tests:**
- `test/production-data.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0008: the active finished products carry their raw input and shrink" (AC-0008). sha256 `da6de01c9ddde5c9612f2729cb184b40ac11fcd6556f25e25c7b7a4a5263cc7e`.

```ts
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { listActiveFinishedProducts } from "../src/lib/production.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { assertLedgerInvariants, closePool, RAW_TOM_ID, resetTestData } from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0008
it("AC-0008: the active finished products carry their raw input and shrink", async () => {
  const products = await listActiveFinishedProducts(operator);
  expect(products.find((product) => product.code === "502")).toMatchObject({
    shrinkPct: 0.23,
    raw: { id: RAW_TOM_ID, code: "RAW-TOM" },
  });
});
```

- The same file then grows, in EXECUTE, with fixtures built through `receiveCall` and `produceCall` from `test/db.ts`:
  - `listActiveFinishedProducts` omits an inactive finished product and every raw product.
  - `listLotsUsed` returns the AC-0024 fixture's lots in draw order, each with the AC-0023 fields.
  - `getFinishedLot` returns 1540 lbs at 2.6318 for the AC-0020 batch (construction for AC-0025).
  - `listRecentBatches` returns the 10 last-entered of 12 batches, last entered first, when the last one entered has the earliest production date, and a total of 12 (construction for AC-0038, AC-0076, and AC-0040).
  - `getStock` for a raw input with no `inventory_balances` row returns no balance (AC-0047).
  - The error a real shortfall call through `produceBatch` throws, passed to `batchSaveFailureMessage`, gives the AC-0030 text, pinning the T1 rule to the engine's actual wording.

**Approach:**
- Write the reads with the probed embed shapes; throw on error and return rows as the database delivered them, like `src/lib/receiving.ts`.

**Done when:** the T2 tests are green, with `assertLedgerInvariants` passing after each test.

### T3: The save action's decisions and the result view return the right state for every branch

**Depends on:** T1, T2

**Touches:** `src/app/production/save-batch.ts`, `src/app/production/result-view.ts`, `src/app/production/actions.ts`, `src/app/production/form-fields.ts`, `test/save-batch.test.ts`

**Tests:**
- `test/save-batch.test.ts`, a new file, no database. stub: true. Test function and AC: "AC-0034: a read before the write fails, so nothing is written" (AC-0034). sha256 `9e8ae0996c3582826e2dd1f0f53359f18cca158fe6e564c3e2569eaa3e60dd34`.

```ts
import { expect, it } from "vitest";
import { decideSave, type SaveDeps } from "../src/app/production/save-batch.js";

const validFields = {
  productCode: "502",
  rawLbs: "2000",
  finishedLbs: "",
  productionDate: "2026-10-06",
  notes: "",
  today: "2026-10-08",
};

async function unreachable(): Promise<never> {
  throw new Error("unreachable");
}

// STUB: AC-0034
it("AC-0034: a read before the write fails, so nothing is written", async () => {
  let wrote = false;
  const deps: SaveDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => {
      throw new Error("listFinishedProducts failed: fetch failed");
    },
    write: async () => {
      wrote = true;
      return unreachable();
    },
    readAfter: unreachable,
  };
  expect(await decideSave(validFields, deps)).toEqual({
    status: "refused",
    message: "The batch wasn't saved. Try again in a moment.",
  });
  expect(wrote).toBe(false);
});
```

- The same file then grows, in EXECUTE, with each call passed in as a fake:
  - the caller check ends, refuses as a non-operator, or fails: the AC-0004, AC-0067, and AC-0034 texts, and no read or write is called;
  - the write throws an error with no code: the AC-0035 text, in the same refused-state shape as the browser-tested refusals;
  - the write throws an engine refusal outside AC-0030 to AC-0033: the AC-0075 text, and a 42501 from the write: the AC-0080 text, in the same refused-state shape as the browser-tested refusals;
  - the write returns and a read after throws: a saved state that carries the returned batch and no totals, and `resultView` of that state gives the AC-0018 fields (AC-0029) and the AC-0073 message in place of the lots used, finished stock, and before-and-after stock (AC-0073);
  - the write returns and every read succeeds: a saved state with lots used, finished lot, and stock before and after, and `resultView` gives the AC-0072 note only when the finished lbs field was filled.

**Approach:**
- `decideSave` holds the branch logic and logs one `actionFailureLogLine` per failure. `actions.ts` passes `checkCaller`, the T2 reads, `produceBatch`, and `getStock`, and revalidates `/production` when the reads after the write loaded.

**Done when:** the T3 tests are green and `npm run typecheck` exits 0.

### T4: A batch can be checked, saved, and read back on `/production`

**Depends on:** T3

**Touches:** `src/app/page-header.tsx`, `src/app/not-allowed.tsx`, `src/app/receiving/page.tsx`, `src/app/production/*.tsx`, `test/e2e/production.spec.ts`, `test/e2e/production-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/production.spec.ts`, signed in as the operator, with fixtures written through `pg` like `test/e2e/receiving-page.ts`:
  - access and navigation: AC-0001, AC-0002, AC-0005, AC-0006 (both on both pages), AC-0007, AC-0068;
  - the form: AC-0082 and AC-0083 (with every finished product made inactive, and a `pg` count showing no batch written), AC-0008, AC-0009 (in a time zone far from UTC, as receiving's received-date test does), AC-0010 (one case per row, in the browser), AC-0011, AC-0012, AC-0047, AC-0059;
  - the check step: AC-0013, AC-0014, AC-0015, AC-0070, AC-0071, AC-0016, AC-0017;
  - the result: AC-0018, AC-0019, AC-0072, AC-0081, AC-0020, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, each golden case built from the 502 fixture and checked against the `production_batches` and `finished_goods` rows through `pg`;
  - keyboard and focus: AC-0051, AC-0052, AC-0053, AC-0054, AC-0056;
  - `checkPageState` with no findings in the empty form, the form with no active finished product, the form with a product chosen, the form after an AC-0010 refusal, the open check step, the form after a save, and the non-operator page: AC-0048, AC-0049, AC-0050, AC-0057, AC-0058.
- `test/e2e/receiving.spec.ts` stays green, including its page-state checks with the new header.

**Approach:**
- Build the shared header and not-allowed view, and move receiving onto them.
- Build the page, form, check step, and result panel on the receiving patterns named in the design.

**Done when:** `npm test` exits 0 with the new and existing browser tests green.

### T5: Recent batches, refusals, failures, and the error page behave as specified

**Depends on:** T4

**Touches:** `src/app/page-error.tsx`, `src/app/receiving/error.tsx`, `src/app/production/*.tsx`, `test/e2e/production.spec.ts`, `test/e2e/production-page.ts`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/production.spec.ts`:
  - recent batches: AC-0038, AC-0076, AC-0039, AC-0040, AC-0041, AC-0042;
  - refusals: AC-0030, AC-0031, AC-0032, AC-0033, AC-0075 (with a fixture product of shrink 0.6 whose raw input holds stock), AC-0036, and the AC-0037 kept values and AC-0055 focus after each;
  - the reads-after failure: AC-0029 and AC-0073, with the operator's SELECT on `production_batch_lots` revoked through `pg` just before confirming and granted back in a `finally` block and in `afterEach`, then `checkPageState` with no findings in that state;
  - the connection drop of AC-0074, through a request-dropping helper in `test/e2e/production-page.ts` that matches the production page's action requests, with the AC-0037 kept values and AC-0055 focus after it;
  - replayed action requests: AC-0003, AC-0004, and AC-0067 with no session and with a non-operator session, and AC-0069 with an operator session;
  - `checkPageState` with no findings after an AC-0030 refusal and after an AC-0074 failure.
- `test/e2e/receiving.spec.ts` stays green with receiving's error page on the shared view.

**Approach:**
- Add the recent-batches list and the message area, and move both error pages onto the shared error view.

**Done when:** `npm test` exits 0.

### T6: The docs match the code, the goal-based checks pass, and the stopped-service run is recorded

**Depends on:** T1, T2, T3, T4, T5

**Touches:** `docs/architecture/overview.md`, `docs/costing.md`, `docs/specs/production/notes/verification-ledger.md`

**Tests:** no stub (mode): goal-based checks and a recorded manual run.
- The recorded run in the verification ledger, against `npm run start` with the local REST service stopped:
  - before a page load: the error page with its AC-0077 line, its focus, and `checkPageState` on it (AC-0044, AC-0077, and AC-0048, AC-0049, AC-0050, AC-0057, AC-0058 for that state); then Try again after the restart (AC-0043);
  - after a page load: the AC-0034 message on confirming a save, every field's value (AC-0037), and the focused element (AC-0055).
- The same recorded run with the app's `SUPABASE_URL` pointed at a throwaway forwarder in scratch (not committed) in front of the local REST service, restored afterwards:
  - the forwarder holds the `produce_batch` call back past the 10-second limit: the AC-0035 message, every field's value, the focused element, and a `pg` count showing no batch written;
  - the forwarder holds the `produce_batch` call while a `pg` session deletes the operator's `private.operators` row, then lets it through: the AC-0080 message, every field's value, the focused element, and a `pg` count showing no batch written (AC-0036); the row is inserted back afterwards.
- The commands of AC-0060, AC-0061, AC-0062, AC-0063, AC-0064, AC-0065, AC-0066, AC-0078, and AC-0079, each with its exit code recorded in the ledger.

**Approach:**
- Edit the overview rows, the write-path sentence, the failure notes, and the `src/app/` guidance named in the spec's Durable Outputs row. In `docs/costing.md`, add the two Rounding-note rows, the cost-per-lb row's reach to batches, the sentence on what the screen rounds covering the check step's repeat of the owner's entries, and the suite names.

**Done when:** every check above is recorded as passing in the ledger.

## Rollout

- **Delivery:** one branch, `feat/production`, merged after review. Reverting the merge removes the page; no data or schema changes ship.
- **Infrastructure and external systems:** none. The app runs only against the local stack.
- **Deployment sequencing:** none, because there is no migration.

## Risks

- **Focus across the dialog.** The check step closes while the result or message renders, so focus could land on `body`. AC-0052 to AC-0056 catch it in the browser.
- **The shortfall text is matched by its wording.** A later change to the engine's message would fall back to the raw engine text. The T2 test against a real refusal turns red first.
- **Shared modules.** `failures.ts`, `format.ts`, and `receipt-input.ts` serve receiving too. The receiving suites run in every gate.

## Changelog

- 2026-10-08: initial plan.
- 2026-10-08: review round 1. Added validated stubs for T1 to T3 and `no stub (mode)` for T4 to T6; a pure result view; the re-render path for a code missing from the page's list; the calendar-date check; the error page's batch line; and the new criteria's task entries.
- 2026-10-08: review round 2. The recent-batches read picks the 10 last entered; a browser test forces the reads-after state by revoking one read grant for the test; the no-product state, the measured-batch shrink line, and the not-allowed refusal at the write get criteria and task entries; the recorded run closes the before-write case.
- 2026-10-08: review round 3. The no-product state splits into three criteria; the recent-batches fixture puts the last-entered batch earliest; the owner accepted unit-only proof for the write-call and not-allowed branches after a probe showed a held-up write ends in a coded refusal; T6 names the rounding-sentence edit.
- 2026-10-08: review round 4. The write-call and not-allowed branches move from unit-only proof to a recorded run through a throwaway forwarder (owner decision); AC-0084 is retired because nothing could turn it red; AC-0029 names the reads it covers.
