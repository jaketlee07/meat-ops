# Plan: receiving-refinements

- **Spec:** [`spec.md`](spec.md)
- **Status:** Executing <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:** `docs/architecture/overview.md` areas table, `src/app/` row (where each action's decisions live). Analogous implementations: `src/app/sales/save-sale.ts` (`decideSaleSave`, `decideSaleVoid`), wired in `src/app/sales/actions.ts` and tested by `test/save-sale.test.ts`; `src/app/receiving/correct-receipt.ts` (`decideCorrection`), wired in `src/app/receiving/actions.ts` and tested by `test/save-correction.test.ts`. For the scorer: `test/e2e/a11y.ts` itself. Uncertainty: no spec in `test/e2e/` loads a page with `page.setContent` yet, so the T2 spec is the first one that tests a helper of the suite rather than a page of the app

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
> contract is how a review spends a round on prose no gate consumes. `Grounding`
> stays *recorded*, because a per-task resolution that nobody wrote is not
> grounding; what it stops being is a claim a reviewer holds the plan to.

## Approach

Three small changes, in an order that keeps the suite green after each one.

- **T1** moves the save's and void's decisions out of the `"use server"` file into `src/app/receiving/save-receipt.ts`, in the shape `sales/save-sale.ts` already has. The server actions become wiring. A new Vitest suite drives the four branches with stand-in calls.
- **T3** swaps each `aria-disabled:opacity-60` for color-alpha classes. Each control then looks the same, and its ring keeps its full color.
- **T2** makes `test/e2e/a11y.ts` score the ring as drawn and refuse the effects it cannot model. A new spec tests the scorer on fixture pages. T2 comes after T3, because with the fades at base `9b37639` the drawn score turns 9 tests red (probe #1).
- **T4** proves the error page's pending ring with one recorded run against the built app.

Each task updates the overview row it changes, so the docs never trail the code.

## Constraints

- `AGENTS.md` hard rules: no em dashes (rule 4), `type(scope): description` commits (rule 5), `npm test` after a change (rule 6 names `src/lib/`; the T1, T2, and T3 Tests run it after every task here), nothing written to the hosted project (rule 7).
- `SYSTEM-SPEC.md` §11 boundaries hold unchanged: no task touches the database.
- `src/lib/failures.ts` owns every failure text and the log-line format. The decisions call it and never restate it.
- The `AGENTS.md` folder check runs before every `npm test`, and before the T4 run stops the REST service. Apps and helpers started by hand are stopped by their PID.

## Construction tests

Most construction tests live under **Tasks** below. Cross-cutting:

**Integration tests:** none beyond per-task tests.
**End-to-end:** the AC-0011 tests already in the browser suite, run by `npm test` against the built app after T2.
**Manual verification:** the AC-0006 red runs (T1) and the AC-0012 recorded run (T4), in the verification ledger.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Current architecture, `docs/architecture/overview.md` | T1 (`src/app/` and `test/` rows), T2 (`test/e2e/` row) | Diff of the three rows | close-work matches each row to the code |
| Execution record, `notes/verification-ledger.md` | T1 to T4 | Ledger entries | close-work reads the ledger |

Design facts with an owner: where the decisions live goes to the overview's `src/app/` row; what the scorer measures, the effects it refuses, and the owner-accepted limit (clipping and masks) go to the `test/e2e/` row and to the comment block that opens `test/e2e/a11y.ts`. The class mapping in T3 is mechanically evident from the diff and is delivery residue.

## Design (LLD)

### Design decisions

- **The seam lives in `src/app/receiving/`, beside its wrapper.** Every other action's decisions sit beside their wrapper (overview `src/app/` row), so this one does too. The shared caller type is `CallerOutcome` from `sales/save-sale.ts`, and the `caller()` adapter that `actions.ts` already has for `correctReceipt` feeds both decisions. Rejected: `src/lib/`, which would mix a page's outcome states into the data layer and put a `src/lib/` change into scope (spec Ask first). Traces to AC-0001 to AC-0005.
- **No outer catch is added to the wrappers.** Today's `saveReceipt` and `voidReceipt` reject only if `checkCaller` itself throws, and the sales wrappers' outer catch would change that. The spec's Always do keeps behavior as it is. Traces to AC-0001 to AC-0004.
- **Revalidation stays in the wrappers.** `revalidatePath` is from `next/cache`, which Vitest cannot load. The save wrapper revalidates only when the result carries totals, as `correctReceipt`'s wrapper does. The void wrapper revalidates only when the decision returns `voided`, as `voidSale`'s wrapper does and as `voidReceipt` does at base `9b37639`, so a refused void leaves the list in place (receiving AC-0083). No criterion pins it, and the browser suite's save tests show the page after a save.
- **Fade by color alpha, not opacity.** A filled control fades its fill (`aria-disabled:bg-primary/60` or `aria-disabled:bg-error/60`), and its white text stays white, as it was under opacity on the white page. An outlined control fades its text and border (`aria-disabled:text-ink/60 aria-disabled:border-field-border/60`), and its white fill stays white. Probe #2 (spec Assumptions) shows the pixels match within 1 color step and the ring keeps `rgb(29, 78, 216)`. Natively `disabled` controls keep `disabled:opacity-60`: they cannot take focus, so they draw no ring. Traces to AC-0009 to AC-0012.
- **The scorer refuses what it does not model.** It multiplies the ring's alpha by the control's own opacity. It does not model an ancestor's opacity, a filter, or a blend mode, so for those it reports that the ring cannot be scored. The owner chose this over scoring a screenshot (spec Assumptions). Traces to AC-0007, AC-0008.

### Interfaces & contracts

`src/app/receiving/save-receipt.ts` exports:

- The state types `SavedLot`, `PriceChange`, `Totals`, `SaveState`, and `VoidState`, moved from `actions.ts`. `actions.ts` re-exports the ones its importers use, as it does `CorrectionState`. `totals.ts` imports `PriceChange` from the new module.
- `ReceiptBeforeWrite`, a union of `{ ok: false; errors }` and `{ ok: true; input; product; stockBefore; pricesBefore; vendors }`. `ReceiptReadyToWrite` is its `ok: true` member.
- `ReceiptSaveDeps<C>`, with `caller()`, `readBefore(client, formData)`, `write(client, ready)` returning the `Lot`, and `readAfter(client, ready)` returning `{ stockAfter, pricesAfter }`.
- `ReceiptVoidDeps<C>`, with `caller()` and `write(client, lotId, reason)`.
- `decideReceiptSave(formData, deps)` and `decideReceiptVoid(lotId, reason, deps)`.

`actions.ts` keeps `saveReceipt(formData)` and `voidReceipt(lotId, reason)` with the same signatures. They pass the real calls in the order they make them at base `9b37639`:

1. `checkCaller`.
2. The product list (all raw codes, or the active ones when the form marks a recheck).
3. Stock, finished prices, and vendors, in parallel.
4. `receiveLot`.
5. Stock and finished prices, in parallel.

### Behavior & rules

The save decision runs the `saveReceipt` body of base `9b37639` unchanged, with each database call replaced by its dep:

1. Settle the caller.
2. Read before the write, under a before-write catch.
3. If the form rules refused, return `invalid`.
4. Write, under a write-stage catch.
5. Read after the write and build the totals inside one catch. A failure there logs the after-write line and leaves the totals null.

The void decision settles the caller, applies `parseVoidReason`, then writes under a write-stage catch. Each catch logs through `actionFailureLogLine` and maps through `saveFailureMessage` or `voidFailureMessage`, as at base `9b37639`.

The scorer, per focused control:

1. Read the control's computed `opacity`, `filter`, and `mix-blend-mode`, and each ancestor's computed `opacity`, `filter`, and `mix-blend-mode`, in the same page walk that reads the ancestor backgrounds.
2. If any effect from AC-0008 is present, report "`<label>` ring cannot be scored: `<the effect and where it is>`", and skip the contrast check for that control.
3. Otherwise, lay the outline color, with its alpha times the control's opacity, over the background behind it, and compare it with that background, as at base `9b37639`.

### Failure, edge cases & resilience

- A form that the rules refuse returns `invalid` before any write, as at base `9b37639`. The browser suite's tests of receiving AC-0010 and AC-0019 keep that path covered.
- The scorer still throws on a color format it cannot parse, as at base `9b37639`.

## Tasks

Stub validation, 2026-10-20. The T1 and T2 blocks below were extracted from
this file into a `git archive` copy of `HEAD` (`9b37639`) in the session's
scratch directory, outside the repository. Each sha256 is of the code lines plus
one terminal newline.

- **Rerun:** the T1 block changed in spec-stage round 3 (a two-line read error). Its compile and red runs below were repeated on the changed block, with the same results.
- **Compile:** with placeholder declarations of the `save-receipt.ts` surface, `tsc --noEmit -p tsconfig.json` exited 0 over the copy with both stubs.
- **T1 red:** with the placeholder removed, Vitest 5.0.3 exited 1. The suite failed to load with "Cannot find module '../src/app/receiving/save-receipt.js'". The config was a scratch copy with only the stub file, no global setup (the stub needs no database), and its cache directory in scratch.
- **T2 red:** Playwright 1.64.0 ran the spec in Chromium against the `test/e2e/a11y.ts` of `9b37639` and exited 1, with all 6 tests failing. Each failed its `toContain` with the received text "the page-state checks passed". So each fixture page passes the base's axe scan, width, target-size, and outline checks, and each test is red only on its own assertion. The config was a scratch one with only the stub spec, no web server, no global setup, and no sign-in project.
- **Isolation:** both runs went through `sandbox-exec`, with network denied except to `localhost`. File-content reads were denied except for the root directory's own listing, the repository, the scratch directory, the Node 22.17.0 install, `os.tmpdir()`, the Playwright browsers under `~/Library/Caches/ms-playwright`, `~/Library/Application Support/vitest`, `/private/var/db/timezone`, `/System`, `/Library/Fonts`, `/usr`, `/private/etc`, and `/dev`. File writes were denied except under the scratch directory, `os.tmpdir()`, and `/dev`. A `perl` alarm stopped each run at 120 s (Vitest) or 180 s (Playwright). Under the same profile, a read of `~/.zshrc` and a write into the repository each failed with EPERM, and a request to `example.com` failed with ENOTFOUND.
- **Declared test-harness side effects:** none. Neither run reached the local stack or the app.
- The scratch copy was removed.

### T1: The save's and void's decisions run under a Vitest suite, with the same behavior through the app

**Depends on:** none

**Touches:** `src/app/receiving/save-receipt.ts`, `src/app/receiving/actions.ts`, `src/app/receiving/totals.ts`, `test/save-receipt.test.ts`, `docs/architecture/overview.md`, `docs/specs/receiving-refinements/notes/verification-ledger.md`

**Tests:**
- `test/save-receipt.test.ts`, a new file, with no database. stub: true. Test functions and ACs: "AC-0001, AC-0005: a read after the write fails, so the save carries the written lot and no totals, and logs the failed read" (AC-0001, AC-0005); "AC-0002, AC-0005: the engine refuses the write as not allowed, so the save says this account isn't allowed and logs the write stage" (AC-0002, AC-0005); "AC-0003, AC-0005: the write gets no answer, so the save may have happened and the log names the write stage" (AC-0003, AC-0005); "AC-0004, AC-0005: the void's write gets no answer, so the void may have happened and the log names the write stage" (AC-0004, AC-0005). sha256 `576ea623265efab28e7576a486e8cd3930208375ddfba706fc985e5d469184dc`.

```ts
import { expect, it, vi } from "vitest";
import {
  decideReceiptSave,
  decideReceiptVoid,
  type ReceiptReadyToWrite,
  type ReceiptSaveDeps,
  type ReceiptVoidDeps,
} from "../src/app/receiving/save-receipt.js";
import { RpcError, type Lot } from "../src/lib/rpc.js";

const ready: ReceiptReadyToWrite = {
  ok: true,
  input: { productCode: "RAW-TOM", vendorId: "v1", weightLbs: 500, unitCost: 1.85, receivedDate: "2026-10-08" },
  product: { id: "p1", code: "RAW-TOM", description: "Turkey Drums TOM (raw)" },
  stockBefore: { balance: { qtyOnHand: 1000, movingAvgCost: 1.8 }, nonVoidReceipts: 2 },
  pricesBefore: [],
  vendors: [{ id: "v1", name: "Acme Foods" }],
};

const lot = {
  id: "lot-1",
  lot_number: "L-0003",
  vendor_id: "v1",
  received_date: "2026-10-08",
  weight_lbs: 500,
  unit_cost: 1.85,
} as Lot;

function saveDeps(overrides: Partial<ReceiptSaveDeps<null>>): ReceiptSaveDeps<null> {
  return {
    caller: async () => ({ status: "operator", client: null }),
    readBefore: async () => ready,
    write: async () => lot,
    readAfter: async () => ({
      stockAfter: { balance: { qtyOnHand: 1500, movingAvgCost: 1.8167 }, nonVoidReceipts: 3 },
      pricesAfter: [],
    }),
    ...overrides,
  };
}

function voidDeps(write: ReceiptVoidDeps<null>["write"]): ReceiptVoidDeps<null> {
  return { caller: async () => ({ status: "operator", client: null }), write };
}

// Runs a decision with console.error captured, and returns its result and every line it logged.
async function logged<T>(run: () => Promise<T>): Promise<{ result: T; lines: unknown[][] }> {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const result = await run();
    return { result, lines: [...spy.mock.calls] };
  } finally {
    spy.mockRestore();
  }
}

// STUB: AC-0001
it("AC-0001, AC-0005: a read after the write fails, so the save carries the written lot and no totals, and logs the failed read", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptSave(
      new FormData(),
      saveDeps({
        readAfter: async () => {
          throw new Error("getStock failed: fetch failed\nother side closed");
        },
      }),
    ),
  );
  expect(result).toEqual({
    status: "saved",
    lot: {
      lotNumber: "L-0003",
      productCode: "RAW-TOM",
      productDescription: "Turkey Drums TOM (raw)",
      vendorName: "Acme Foods",
      receivedDate: "2026-10-08",
      weightLbs: 500,
      unitCost: 1.85,
    },
    totals: null,
  });
  expect(lines).toEqual([
    ["saveReceipt: reading the totals after the write failed: getStock failed: fetch failed\nother side closed"],
  ]);
});

// STUB: AC-0002
it("AC-0002, AC-0005: the engine refuses the write as not allowed, so the save says this account isn't allowed and logs the write stage", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptSave(
      new FormData(),
      saveDeps({
        write: async () => {
          throw new RpcError("receiveLot failed: permission denied for function receive_lot", "42501");
        },
      }),
    ),
  );
  expect(result).toEqual({
    status: "refused",
    message: "The receipt wasn't saved. This account isn't allowed to use Meat Ops.",
  });
  expect(lines).toEqual([
    ["saveReceipt failed at write: receiveLot failed: permission denied for function receive_lot (code 42501)"],
  ]);
});

// STUB: AC-0003
it("AC-0003, AC-0005: the write gets no answer, so the save may have happened and the log names the write stage", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptSave(
      new FormData(),
      saveDeps({
        write: async () => {
          throw new RpcError("receiveLot failed: TypeError: fetch failed", "");
        },
      }),
    ),
  );
  expect(result).toEqual({
    status: "refused",
    message: "The receipt may not have been saved. Reload this page and check Recent receipts before saving again.",
  });
  expect(lines).toEqual([["saveReceipt failed at write: receiveLot failed: TypeError: fetch failed"]]);
});

// STUB: AC-0004
it("AC-0004, AC-0005: the void's write gets no answer, so the void may have happened and the log names the write stage", async () => {
  const { result, lines } = await logged(() =>
    decideReceiptVoid(
      "lot-1",
      "Entered twice",
      voidDeps(async () => {
        throw new RpcError("voidReceipt failed: TypeError: fetch failed", "");
      }),
    ),
  );
  expect(result).toEqual({
    status: "refused",
    message: "The receipt may not have been voided. Reload this page to see whether it was.",
  });
  expect(lines).toEqual([["voidReceipt failed at write: voidReceipt failed: TypeError: fetch failed"]]);
});
```

- The AC-0001 test's read error has two lines, so its log assertion tells the whole message from the one-line form `logMessage` would give.
- AC-0006, recorded in the ledger with the failing assertion of each run: with `test/save-receipt.test.ts` green, each change below is made alone in the working tree, the suite is run, and the change is undone before the next one.
  - M1: the after-write catch returns a refusal. The AC-0001 test must be red.
  - M2: the save's write catch passes `"before-write"`. The AC-0002 and AC-0003 tests must be red.
  - M3: the void's write catch passes `"before-write"`. The AC-0004 test must be red.
  - M4: only the save's write log line takes `"before-write"`, and the message keeps `"write"`. The AC-0002 and AC-0003 tests must be red at their log assertion.
  - M5: only the void's write log line takes `"before-write"`, and the message keeps `"write"`. The AC-0004 test must be red at its log assertion.
  - M6: the after-write log line's text changes, and the result stays a save with no totals. The AC-0001 test must be red at its log assertion.
- The full `npm test` stays green, which covers the wrappers' wiring through the browser suite's receiving tests.

**Approach:**
- Create `save-receipt.ts` by moving `SavedLot`, `PriceChange`, `Totals`, `SaveState`, `VoidState`, the two refused-state helpers, and the bodies of `saveReceipt` and `voidReceipt` into `decideReceiptSave` and `decideReceiptVoid`, with each database call replaced by its dep.
- In `actions.ts`, keep `readBeforeWrite` as the `readBefore` dep, pass `receiveLot`, the after-write reads, and `voidReceiptCall` as deps, and revalidate as Design gives.
- Point `totals.ts` at the new module for `PriceChange`.
- Update the overview's `src/app/` row (`saveReceipt`'s and `voidReceipt`'s decisions live in `receiving/save-receipt.ts`) and `test/` row (add `save-receipt` to the receiving suites).
- Materialize the stub, verify byte identity, prove its red (the module is missing), then implement. Then run M1 to M6 and record them.

**Done when:** the T1 Tests hold: the suite is green, M1 to M6 are recorded in the ledger, and `npm test` passes.

### T3: Faded controls fade by color, so every ring keeps its full color

**Depends on:** none

**Touches:** the 14 files `grep -rln "aria-disabled:opacity-60" src` lists: `src/app/page-error.tsx`, `src/app/receiving/receipt-form.tsx`, `src/app/receiving/correct-dialog.tsx`, `src/app/production/production-form.tsx`, `src/app/production/check-step.tsx`, `src/app/production/reverse-control.tsx`, `src/app/sales/sale-form.tsx`, `src/app/sales/void-dialog.tsx`, `src/app/invoices/read-forms.tsx`, `src/app/alerts/alert-card.tsx`, `src/app/alerts/digest-section.tsx`, `src/app/ask/ask-panel.tsx`, `src/app/pricing/change-form.tsx`, `src/app/pricing/apply-button.tsx`; and `docs/specs/receiving-refinements/notes/verification-ledger.md`

**Tests:** no stub (goal-based check)
- AC-0009: `grep -rn "aria-disabled:opacity" src` prints nothing.
- AC-0010: the first command prints `bg-primary/60 12`, `bg-error/60 2`, `text-ink/60 5`, and `border-field-border/60 5`, and the second prints nothing. The ledger records both outputs and lists each of the 18 base strings with the classes that replaced it.

```bash
for c in bg-primary/60 bg-error/60 text-ink/60 border-field-border/60; do printf '%s %s\n' "$c" "$(grep -rno "aria-disabled:${c}" src | wc -l | tr -d ' ')"; done
for c in bg-primary bg-error text-ink border-field-border; do grep -rn "aria-disabled:${c}/60" src | grep -vE "[\"\` ]${c}[\"\` ]"; done
```

- `npm test` passes. It does not score the faded colors (spec Testing Strategy), so the AC-0010 commands and the ledger listing are the checks of the faded look. Probe #2 showed, before the change, that the color fade draws the opacity fade's pixels.

**Approach:**
- Replace each `aria-disabled:opacity-60` with the filled or outlined classes from Design. `pricing/change-form.tsx`'s shared `BUTTON` constant loses the fade, and each of its two buttons adds its own.
- Leave every `disabled:opacity-60` as it is.

**Done when:** the T3 Tests hold.

### T2: The focus check scores each ring as drawn, and refuses a ring it cannot score

**Depends on:** T3 (with the fades at base `9b37639`, the drawn score turns the AC-0011 tests red)

**Touches:** `test/e2e/a11y.ts`, `test/e2e/focus-ring.spec.ts`, `docs/architecture/overview.md`, `docs/specs/receiving-refinements/notes/verification-ledger.md`

**Tests:**
- `test/e2e/focus-ring.spec.ts`, a new file in the browser suite. stub: true. Test functions and ACs: "AC-0007: a ring faded by its control's opacity is scored as drawn and fails at 2.90:1" (AC-0007), and "AC-0008: when `<effect>`, the ring cannot be scored and the check fails", once for each of the five effects AC-0008 names (AC-0008). sha256 `2b2ae1ded6914c1b8e66c59842ce61ea8d1a910199bb93eb7c3ce0e4342774e7`.

```ts
import { expect, test, type Page } from "@playwright/test";
import { checkPageState } from "./a11y";

// One page with one focusable button, drawn the way the app draws a faded
// control: the primary fill, white text, aria-disabled, and the app's focus ring.
function ringPage({ button = "", wrapper = "" }: { button?: string; wrapper?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Focus ring</title>
<style>
body { margin: 0; background: #fff; color: #111827; font: 16px sans-serif; }
button { min-width: 44px; min-height: 44px; padding: 0 16px; border: 0; border-radius: 6px; background: #1d4ed8; color: #fff; font: inherit; }
:focus-visible { outline: 2px solid #1d4ed8; outline-offset: 2px; }
</style>
</head>
<body><main><div style="${wrapper}"><button type="button" aria-disabled="true" style="${button}">Save</button></div></main></body>
</html>`;
}

const COLOR_CODE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

// The page-state checks' failure message without terminal color codes, or a
// fixed text when the checks pass.
async function checkFailure(page: Page): Promise<string> {
  try {
    await checkPageState(page);
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).replace(COLOR_CODE, "");
  }
  return "the page-state checks passed";
}

// STUB: AC-0007
test("AC-0007: a ring faded by its control's opacity is scored as drawn and fails at 2.90:1", async ({ page }) => {
  await page.setContent(ringPage({ button: "opacity: 0.6" }));
  expect(await checkFailure(page)).toContain("button Save outline contrast is 2.90:1, under 3:1");
});

const UNSCORABLE = [
  { effect: "the control has a filter", button: "filter: brightness(1)", wrapper: "" },
  { effect: "the control has a blend mode", button: "mix-blend-mode: multiply", wrapper: "" },
  { effect: "an ancestor has a filter", button: "", wrapper: "filter: brightness(1)" },
  { effect: "an ancestor has a blend mode", button: "", wrapper: "mix-blend-mode: multiply" },
  { effect: "an ancestor is faded", button: "", wrapper: "opacity: 0.9" },
];

for (const { effect, button, wrapper } of UNSCORABLE) {
  // STUB: AC-0008
  test(`AC-0008: when ${effect}, the ring cannot be scored and the check fails`, async ({ page }) => {
    await page.setContent(ringPage({ button, wrapper }));
    expect(await checkFailure(page)).toContain("button Save ring cannot be scored");
  });
}
```

- A construction case added in EXECUTE beside the stub: a button whose fill fades by color (`color-mix(in oklab, #1d4ed8 60%, transparent)`) passes the page-state checks and returns `["button Save"]`. This shows the AC-0007 measure does not fail a full-strength ring.
- AC-0011: `npm test` passes with the new scorer, and the ledger names these nine tests among the passes, one or more per AC-0011 state, in the spec's order:
  - `receiving.spec.ts`: "the first-run state says what is missing, and Save is aria-disabled"
  - `production.spec.ts`: "AC-0082 and AC-0083: with no active finished product the page says so, and Save opens no check step"
  - `sales.spec.ts`: "the form with no active finished product meets the page-state checks"
  - `ask.spec.ts`: "AC-0012, AC-0017: while an ask press is in flight the status text shows and Ask and every product button are disabled"
  - `ask.spec.ts`: "AC-0012, AC-0017: while an ask press is in flight Look it up again is disabled too"
  - `invoices.spec.ts`: "AC-0014: while a text read is in flight the message sits by that Read button, nothing moves, and both buttons are disabled"
  - `invoices.spec.ts`: "AC-0014: while a text read is in flight at 320 px the message sits by that Read button, nothing moves, and both buttons are disabled"
  - `invoices.spec.ts`: "AC-0014: while a photo read is in flight the message sits by that Read button, nothing moves, and both buttons are disabled"
  - `invoices.spec.ts`: "AC-0014: while a photo read is in flight at 320 px the message sits by that Read button, nothing moves, and both buttons are disabled"

**Approach:**
- In `walkTabOrder`'s page step, read the control's `opacity`, `filter`, and `mix-blend-mode`, and each ancestor's `opacity`, `filter`, and `mix-blend-mode`, beside `ancestorBackgrounds`. Add them to `FocusedControl`.
- In `controlProblems`, report the cannot-score problem from Design, or else score the outline with its alpha multiplied by the opacity.
- Update the comment that opens `a11y.ts`, and the overview's `test/e2e/` row, to say three things: the ring is scored as drawn; a filter or blend mode on the control or any ancestor, or an ancestor with opacity under 1, fails as a ring that cannot be scored; and clipping and masks stay outside the check as an owner-accepted limit. The row also names `focus-ring.spec.ts`.
- Materialize the stub, verify byte identity, and prove its red against the scorer at base `9b37639`, then implement.

**Done when:** the T2 Tests hold.

### T4: The error page's pending ring passes the drawn check against the built app

**Depends on:** T2, T3

**Touches:** `docs/specs/receiving-refinements/notes/verification-ledger.md`, and the ignored `.context/recorded-run/` folder for the run's script

**Tests:** no stub (manual QA, recorded in the ledger)
- AC-0012: the ledger records each step of one run against `npm run start` on stack A:
  1. The operator signs in.
  2. With `supabase_rest_meat-ops` stopped, `/receiving` shows the error page.
  3. Try again is pressed, and the page shows "Trying again…" with `aria-disabled="true"`.
  4. `checkPageState` passes in that state and returns the controls it reached.
  5. `supabase_rest_meat-ops` is started again, and the form shows.
  The ledger also records the seconds the REST service was stopped.

**Approach:**
- Run the `AGENTS.md` folder check. With no other stack A folder listed, build, then start the app on port 3000 with `& echo $!` and keep its PID.
- Drive the run with a Playwright script in `.context/recorded-run/` that imports `test/e2e/a11y.ts`. Hold the retry's page request with `page.route` until the checks finish, so "Trying again…" cannot clear partway through them.
- Start the REST container again before anything else on any exit path, then stop the app by its PID.

**Done when:** the T4 Tests are in the ledger.

## Rollout

Nothing is released. Every change is in the app's own code and the test suites, and the app runs only on this Mac. A revert of the merge undoes all of it.

## Risks

- T1 can change behavior silently if a call moves across a catch. The browser suite's receiving tests cover the wiring, and the stand-in suite covers each catch's stage.
- T3 touches nine pages, and no test sees a faded control's colors: axe skips `aria-disabled` controls, and the page-state checks score only the ring. A wrong fade is caught only by the AC-0010 commands and the ledger listing. Probe #2 compared the two fades on a scratch page before the change.
- T4 stops a container that every stack A folder uses. Today this folder is the only one. The folder check runs first.

## Changelog

- 2026-10-20: initial plan
- 2026-10-20: spec-stage round 1. AC-0009 split into the grep (AC-0009) and the color fade with its counts (AC-0010); later criteria renumbered. T1 adds M5 and M6 so each log line goes red alone. T3 no longer claims the browser suite judges faded colors. The void wrapper revalidates only after a void that happened.
- 2026-10-20: spec-stage round 2. AC-0011's fifth state is the one its test reaches (a question in flight after a refused look-up). AC-0010 counts each outlined class alone and adds a line-by-line pairing check. AC-0006 names the test each log-only change turns red. AC-0005 says the after-write line keeps the whole message. T2's doc step names the refused effects and the accepted limit.
- 2026-10-20: spec-stage round 3. AC-0011's fifth state cites ask-your-data AC-0080 for Look it up again. AC-0005 counts `console.error` calls and says the after-write line skips `logMessage`. The T1 stub's after-write error has two lines so that claim can fail. The Design no longer gives the outlined classes an order.
