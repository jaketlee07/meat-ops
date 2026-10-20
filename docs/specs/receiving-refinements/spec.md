# Spec: receiving-refinements

- **Status:** Implementing <!-- Draft | Approved | Implementing | Shipped | Archived -->
- **Owner:** jaketlee07
- **Plan:** [`plan.md`](plan.md)
- **Constrained by:** the intent [`docs/product/intents/receiving-test-refinements.md`](../../product/intents/receiving-test-refinements.md) (its Outcome and Boundary); the receiving spec [`../receiving/spec.md`](../receiving/spec.md) (AC-0012, AC-0031, AC-0071, AC-0072, AC-0073, and AC-0083); the failure texts and log-line format in `src/lib/failures.ts`; [`SYSTEM-SPEC.md`](../../../SYSTEM-SPEC.md) §11; the `AGENTS.md` hard rules
- **Brief:** none
- **Discovery:** none
- **Contract:** none (server actions and test helpers used only inside this app; no published interface)
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

This spec delivers the outcome and boundary of the
[receiving test-refinements intent](../../product/intents/receiving-test-refinements.md):
every receiving branch that a test claims to cover has a test that fails when
the branch breaks.

- **Four save and void branches have tests.** The shared local stack cannot make
  a database call fail on demand, so each of these runs in a Vitest test with
  stand-in calls:
  - a save whose totals cannot be read after the lot is written
  - an engine refusal of a save as not allowed
  - a save whose write call gets no answer
  - a void whose write call gets no answer
- **The browser suite scores each focus ring the way the browser draws it.** A
  ring drawn too faint to reach 3:1 fails the check. So does a ring under a
  filter, a blend mode, or a faded ancestor, which the checker cannot score.
  Clipping and masks stay outside the check, as the owner accepted.
- **Waiting and blocked buttons still look faded, and their rings pass.** On
  every page, a button that waits or is blocked reads as faded, and its focus
  ring keeps the full ring color.

## Durable Outputs

| Semantic role | Applicability | Destination | Owner | Expected evidence | Closeout condition |
| --- | --- | --- | --- | --- | --- |
| Current architecture | Applicable: the save's and void's decisions gain a module, the Vitest suites gain a file, and the browser suite's focus check changes what it scores | `docs/architecture/overview.md`, the `src/app/`, `test/`, and `test/e2e/` rows of the areas table | jaketlee07 | The `src/app/` row names the module that holds `saveReceipt`'s and `voidReceipt`'s decisions. The `test/` row lists `save-receipt` among the receiving suites. The `test/e2e/` row says `a11y.ts` scores focus outlines as drawn, fails a ring it cannot score (a filter or blend mode on the control or any ancestor, or an ancestor with opacity under 1), leaves clipping and masks outside it as an owner-accepted limit, and names the spec that tests the scorer | close-work finds the three statements matching the code |
| Execution record | Applicable: the probes, the red runs, the recorded error-page run, gate results, and review rounds need a home outside the contract | `docs/specs/receiving-refinements/notes/verification-ledger.md` | work-loop | Ledger entries | The ledger holds every observation the Testing Strategy routes to it |
| Intent closeout | Applicable: this spec delivers a backlog intent | `docs/product/intents/receiving-test-refinements.md`, `workspace.toml` `[backlog]` | close-work | none | close-work marks the intent Fulfilled and its entry leaves `open` |
| Lifecycle closeout | Applicable: delivered work is recorded when it ships | `docs/lifecycle/receiving-refinements.json` | close-work | none | close-work records the spec as delivered |
| Reusable learning | Applicable when the build teaches something that would change a future approach | the `project-knowledge` capture gates in work-loop | work-loop | Capture receipt, or a named no-diff outcome | Captured or recorded as unavailable |
| Shipped receiving text | Not applicable: the receiving spec stays as shipped. Its Testing Strategy and Assumptions name this intent as the home of the write-call test, and close-work records the intent Fulfilled | none | n/a | n/a | n/a |
| Master brief (current product truth) | Not applicable: no table, operation, or boundary in `SYSTEM-SPEC.md` changes | none | n/a | n/a | n/a |
| Costing truth | Not applicable: no costing rule or golden number changes | none | n/a | n/a | n/a |
| User documentation | Not applicable: no user-docs surface exists, and no page, label, or message changes | none | n/a | n/a | n/a |
| Agent guidance and commands | Not applicable: no command, variable, or setup step changes | none | n/a | n/a | n/a |
| Interface compatibility | Not applicable: no schema change, so `src/lib/database.types.ts` does not move | none | n/a | n/a | n/a |
| Release history | Not applicable: nothing is released and `docs/product/changelog.md` has no versioned artifact | none | n/a | n/a | n/a |
| Decision rationale | Not applicable as a separate record: the repository has no ADR directory; the owner's decisions are in Assumptions and the reasons in `plan.md` | none | n/a | n/a | n/a |

## Boundaries

The three-tier guard that keeps an implementing agent inside the lines.
*Always do* applies without asking; *Ask first* requires human sign-off
before proceeding; *Never do* is a hard rule, even under time pressure.

### Always do

- Keep every screen message, log line, database call, and call order of `saveReceipt` and `voidReceipt` as they are at base `9b37639`. Moving the decisions changes where they live, not what they decide.
- Name each test only after the criteria its own assertions check.

### Ask first

- Changing any `src/lib/` module, `src/lib/failures.ts` included.
- Changing how a control fades beyond the controls whose classes held `aria-disabled:opacity-60` at base `9b37639`, or changing any color token in `src/app/globals.css`.
- Stopping any stack A service other than the REST service, or stopping it for more than the one recorded run in the Testing Strategy.

### Never do

- No new dependency and no new top-level directory.
- No test-only route, flag, or branch in the app, for reaching the error page or anything else.
- No migration and no database change.

## Testing Strategy

- **TDD, Vitest, no database (AC-0001, AC-0002, AC-0003, AC-0004, AC-0005).** Each branch needs a database call to fail in a set way at a set moment, which the shared stack cannot do on demand. A new suite, `test/save-receipt.test.ts`, runs the save's and void's decisions with stand-in calls. Each stand-in returns or throws what its criterion says. The suite asserts the decision's result and its server log lines.
- **Manual QA of the tests, recorded in the verification ledger (AC-0006).** A test can only be shown to fail by changing the code under it. Each change is made in the working tree, its test run red, and the change undone. The ledger records each change, the failing assertion, and the green run after it is undone.
- **TDD in the browser suite (AC-0007, AC-0008).** The scorer reads computed styles that only a real browser gives. A new spec loads small fixture pages with `page.setContent` and asserts what the page-state check reports for each one. Each test is red against the scorer at base `9b37639`.
- **Goal-based checks (AC-0009, AC-0010).** One `grep` over `src/` settles AC-0009. Four `grep` counts and a line-by-line pairing check over `src/` settle AC-0010, with the commands in the plan. The browser suite does not score a faded control's colors (Assumptions, axe-core).
- **E2E (AC-0011).** The browser tests that run the page-state checks in each AC-0011 state pass with the drawn scorer. Probe #1 (Assumptions) showed each of them red with the drawn scorer and the opacity fades at base `9b37639`.
- **Manual QA recorded in the verification ledger (AC-0012).** No committed test can make a page fail to load, because the suites share one stack. One run against `npm run start` stops stack A's REST service and opens `/receiving`. It presses Try again and runs the page-state checks while the button reads "Trying again…". Then it starts the REST service again and confirms the form comes back. The ledger records each step's result.

## Acceptance Criteria

### Save and void decisions

- [ ] **AC-0001.** When a save's write call returns the written lot and a read after the write fails, the save's result is a save, not a refusal. It carries the written lot's receiving AC-0012 fields, and it carries no totals.
- [ ] **AC-0002.** When a save's write call is refused with SQLSTATE `42501`, the save's result is the refusal "The receipt wasn't saved. This account isn't allowed to use Meat Ops."
- [ ] **AC-0003.** When a save's write call fails with no answer from the engine (an error with no code), the save's result is a refusal with the receiving AC-0071 message, as receiving AC-0072 requires.
- [ ] **AC-0004.** When a void's write call fails with no answer from the engine (an error with no code), the void's result is a refusal with the receiving AC-0073 message, as receiving AC-0083 requires.
- [ ] **AC-0005.** Each outcome in AC-0001 to AC-0004 makes exactly one `console.error` call on the server. For AC-0002 and AC-0003 it logs the line `src/lib/failures.ts` gives for a `saveReceipt` failure at the `write` stage, and for AC-0004 the line it gives for a `voidReceipt` failure at the `write` stage. For AC-0001 it logs "saveReceipt: reading the totals after the write failed: " followed by the failed read's whole message, not passed through `logMessage` in `src/lib/failures.ts`, as at base `9b37639`.
- [ ] **AC-0006.** The test of each of AC-0001 to AC-0005 is red against a change to the branch it covers, with each change made alone:
  - For AC-0001, a failed read after the write ends the save as a refusal.
  - For AC-0002, AC-0003, and AC-0004, a failed write call counts as a failure of a call before the write.
  - For AC-0005, only a logged line changes and the result stays the same, and the named tests are red at their log assertion: the stage in the save's write line (the AC-0002 and AC-0003 tests), the stage in the void's write line (the AC-0004 test), and the text of the after-write line (the AC-0001 test).

### Focus ring scoring

- [ ] **AC-0007.** In every page state the browser suite checks, the page-state check fails unless each focused control's ring, as drawn, has a contrast of at least 3:1 against the background behind it. The drawn color is the control's computed outline color, with its alpha multiplied by the control's computed opacity, laid over the background behind the ring. An `aria-disabled` button at opacity 0.6, with the ring color `rgb(29, 78, 216)`, on a white page fails the check with "outline contrast is 2.90:1, under 3:1".
- [ ] **AC-0008.** The page-state check fails, naming the focused control and saying its ring cannot be scored, when that control or any ancestor has a computed `filter` other than `none` or a computed `mix-blend-mode` other than `normal`, or when any ancestor has a computed opacity under 1.

### Faded controls

- [ ] **AC-0009.** No control in `src/` fades by opacity while `aria-disabled`: `grep -rn "aria-disabled:opacity" src` prints nothing.
- [ ] **AC-0010.** Each control whose classes held `aria-disabled:opacity-60` at base `9b37639` fades while `aria-disabled` by its own colors at 60% alpha: a filled control by its fill color, and an outlined control by its text color and its border color. Counted with `grep -rno` over `src/`, `aria-disabled:bg-primary/60` appears 12 times, `aria-disabled:bg-error/60` 2 times, `aria-disabled:text-ink/60` 5 times, and `aria-disabled:border-field-border/60` 5 times. Every line in `src/` that holds one of these four classes also holds, as a class of its own, the color it fades: `bg-primary`, `bg-error`, `text-ink`, or `border-field-border`.
- [ ] **AC-0011.** In each of these page states, a browser test runs the page-state checks while the faded control can take focus, and the checks pass with the AC-0007 scorer:
  - `/receiving` with no vendors, while Save is `aria-disabled`
  - `/production` with no active finished product, while Save is `aria-disabled`
  - `/sales` with no active finished product, while Save sale is `aria-disabled`
  - `/ask` while a question is in flight, while Ask and every product button are `aria-disabled`
  - `/ask` while a question is in flight with ask-your-data AC-0080's Look it up again on the page, while Ask and Look it up again are `aria-disabled`
  - `/invoices` while a text read is in flight, at the suite's default width and at 320 px, while both Read buttons are `aria-disabled`
  - `/invoices` while a photo read is in flight, at the suite's default width and at 320 px, while both Read buttons are `aria-disabled`
- [ ] **AC-0012.** On the `/receiving` error page, while Try again reads "Trying again…" and is `aria-disabled`, the page-state checks pass with the AC-0007 scorer.

## Follow-ons

None.

## Assumptions

- Technical: every other action already keeps its decisions in a module under `src/app/`, with the caller check and each database call as arguments, tested by a Vitest suite. Examples are `sales/save-sale.ts` with `test/save-sale.test.ts`, and `receiving/correct-receipt.ts` with `test/save-correction.test.ts`. `saveReceipt` and `voidReceipt` were the only actions without one. So the intent's open question has its answer: the seam lives under `src/app/receiving/`, not `src/lib/` (source: `docs/architecture/overview.md` areas table, `src/app/` row).
- Technical: the save path's helpers (`src/lib/receipt-input.ts`, `src/lib/failures.ts`, `src/app/stock-view.ts`, `src/app/receiving/totals.ts`, `src/app/receiving/form-fields.ts`) import nothing from `next/*`, `server-only`, or `src/app/_server`, so Vitest can load a module built from them (source: each file's imports).
- Technical: at base `9b37639`, the focus check scores the computed outline color and ignores opacity. At opacity 0.6, the ring `rgb(29, 78, 216)` on white scores 2.90:1 as drawn, against 6.70:1 at full strength (source: probe #1, 2026-10-20).
- Technical: probe #1 put the drawn score into `test/e2e/a11y.ts` for one browser-suite run, then reverted it. The run had 646 passed and 9 failed in 11.1 minutes. Each failure is one of the AC-0011 tests, and each failing ring belongs to a control at opacity 0.6 scoring 2.90:1. No focused control had an ancestor with opacity under 1, a filter, or a blend mode (source: probe #1, 2026-10-20).
- Technical: at base `9b37639`, 18 class strings in 14 files under `src/app/` fade with `aria-disabled:opacity-60`, the error page's Try again among them. Of those strings, 11 are filled with `bg-primary`, 2 are filled with `bg-error`, 4 are outlined, and `pricing/change-form.tsx`'s shared string serves one filled and one outlined button. So the fading class sets come to 12 filled with `bg-primary`, 2 filled with `bg-error`, and 5 outlined (source: `git grep -n "aria-disabled:opacity-60" 9b37639 -- src` and each string's classes).
- Technical: axe-core 4.13.0, the version `@axe-core/playwright` 4.13.0 uses, skips the color contrast of any element that is `aria-disabled` or inside one (source: `colorContrastMatches` and `isDisabled` in `node_modules/axe-core/axe.js`).
- Technical: Tailwind 4.3 compiles a color-alpha class such as `bg-ink/50` to `color-mix(in oklab, var(--color-ink) 50%, transparent)`, with a hex fallback (source: the built CSS in `.next/static/chunks`).
- Technical: in Chromium under Playwright 1.64, a button whose fill is the primary color at 60% alpha draws its fill within 1 color step per channel of the same button at opacity 0.6 (outside glyph edges). Its ring draws at `rgb(29, 78, 216)`, where the opacity-faded ring draws at `rgb(119, 148, 231)`. An outlined button with its text and border at 60% alpha matches the opacity-faded one the same way (source: probe #2, a scratch page, 2026-10-20).
- Technical: no committed test opens any page's error page. The "Trying again…" state was checked only by the ignored recorded run `.context/recorded-run/round2.spec.ts` (source: `grep` of `test/e2e` for "Couldn't load").
- Technical: receiving AC-0031 measures the computed outline color. A faded control now keeps its full ring color, so that shipped criterion still holds and the receiving spec needs no amendment (source: receiving spec AC-0031).
- Product: faded controls fade their fill, text, and border, not their opacity, so the ring keeps its full color on every page (source: user confirmation 2026-10-20).
- Product: the scorer models the control's own opacity and refuses the effects AC-0008 names. Any effect AC-0008 does not name, such as clipping or a mask, stays outside the scorer as a known limit (source: user confirmation 2026-10-20).
- Process: the error page's pending ring is proven by one recorded run that stops stack A's REST service for about a minute (source: user confirmation 2026-10-20).
- Process: this folder is the only one on stack A, so the tests run with plain `npm test`. The owner approves the spec and then the plan in chat (source: `git worktree list` and each folder's `supabase/.env`; zero-stock-average precedent).
