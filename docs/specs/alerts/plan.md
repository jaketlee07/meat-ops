# Plan: alerts

- **Spec:** [`spec.md`](spec.md)
- **Status:** Approved <!-- Drafting | Approved | Executing | Done -->
- **Repository anchors:**
  - **Area rules and access model:** `docs/architecture/overview.md`.
  - **Analogous implementations:** the pricing change actions (`src/app/pricing/actions.ts`, decisions in `src/app/pricing/save-change.ts`, tested by `test/save-change.test.ts`) for the reprice and dismiss actions; invoice-entry's read action and `src/app/_server/model.ts` (on `feat/invoice-entry`, tested by `test/read-invoice.test.ts` and `test/e2e/invoices.spec.ts` there) for the digest action and its fake-model tests; `set_list_price` in `supabase/migrations/20261009070619_menu_pricing.sql` for the new functions' shape; `private.operators` in `supabase/migrations/20261007181933_engine_hardening.sql` for a private table.
  - **Named deviations:** this is the first feature that writes during a page render (the watch, idempotent and operator-only), the first trigger on a master-data table, and the first function that calls `set_list_price`. It builds on two unmerged branches, so the build starts only after both merge (see Rollout).

> **Plan contract:** this is the implementation strategy. It may change
> substantively only while its Status is `Drafting`, before approval records its
> baseline. After approval, `spec.md` and `plan.md` are pinned in substance;
> only lifecycle bookkeeping is permitted, and execution observations belong in
> `docs/specs/alerts/notes/verification-ledger.md`. A genuine artifact error
> follows the controlled-amendment path.
>
> **Not every field is contract.** `Touches`, `Tests` and `Done when` are what a
> completion gate reads, and they are pinned. `Design`, `Approach`, `Grounding`
> and `Risks` are working material: an implementer corrects them in place as the
> work teaches, without an amendment and without a review round.

## Approach

The work runs bottom up, in seven tasks, each leaving `npm test` green.

1. **Price history (T1).** `private.list_price_changes`, its trigger on `products`, the baseline step, and the menu-pricing AC-0034 clause. Small and independent, so the stale-price rule has data to read.
2. **The watch (T2).** The `alerts` table, `refresh_alerts`, and the five rules in SQL, proved against exact fixtures with the watch's today passed in. This is the riskiest part: exact medians, windows, zero guards, and the lifecycle.
3. **The other functions (T3).** `v_alerts`, `dismiss_alert`, `apply_alert_price`, `alert_digests`, `start_digest`, `finish_digest`, and the access sweep.
4. **The words (T4).** Pure modules: the alert sentences, the two new formats, the digest facts, and the digest checks. No database, no SDK.
5. **The page and the banner (T5).** The header's watch and banner, `/alerts` with its lists and the reprice and dismiss actions, and the other pages' browser-helper updates.
6. **The digest (T6).** `writeDigest` in `model.ts`, the digest action, the page's digest section, and the fake-model tests.
7. **Docs and recorded runs (T7).** The durable outputs, the goal-based checks, the held-call runs, and the live run.

## Constraints

- `SYSTEM-SPEC.md` §2 and §11: every alert, figure, and suggested value is computed in Postgres; the model only words what the app sends it, and nothing changes a price without the owner's press.
- The access model, write path, and app trust boundary in `docs/architecture/overview.md`: every server action settles the caller through `src/app/_server/caller.ts`; every server-side Supabase client uses the 10-second request limit in `src/app/_server/session.ts`; each new table, view, sequence, and function revokes its default privileges and grants back only what the access model names; a new view sets `security_invoker`.
- The invoice-entry spec's AI connection: `src/app/_server/model.ts` is the only importer of `@anthropic-ai/sdk` and the only reader of `ANTHROPIC_*`; the client is built with every setting explicit; no tools, no beta features.
- Menu-pricing AC-0034, amended by the clause the spec's Durable Outputs name; `test/pricing.test.ts` stays unchanged.
- `AGENTS.md` hard rules 3 and 6: numbers round only for display, and a red costing test stops the work.
- `AGENTS.md` "Run two folders' tests at once": every test run, reset, or stop waits as that section directs for this folder's stack.

## Construction tests

Most construction tests live under each task. Cross-cutting:

- **Integration:** the selling-narrative checks AC-0014 and AC-0015 drive `/receiving` and `/pricing` with the watch running in their headers, so they prove the header, the watch, and the existing save actions together.
- **The five-alert fixture:** one helper in `test/alert-fixtures.ts`, shared by the Vitest and browser suites, builds it through the operations: the cost fixture with a fifth RAW-TOM receipt of 5,000 lbs at 1.90 (a cost alert); 502 with a 20% target and a 2.68 list price (a margin alert); a measured 502 batch of 1,000 raw lbs to 700 finished lbs (a yield alert); a second finished product from RAW-TOM with no fees and a list price set after the first four receipts (a price alert); and a second raw product with one 2,000 lb receipt and a finished product that draws 1,800 lbs of it within the window (a low-stock alert). Its first watch must leave exactly one open alert of each type, which the helper asserts.
- **Manual verification:** T7's recorded runs and live run, per the spec's Testing Strategy.

## Durable-output map

| Durable output | Tasks | Implementation evidence | Closeout evidence |
| --- | --- | --- | --- |
| Master brief, `SYSTEM-SPEC.md` §4 and §7 | T7 | The §4 and §7 edits in the diff | close-work finds each built column and each threshold |
| Shipped contract amended, menu-pricing AC-0034 | T1 | The clause in the diff; `test/pricing.test.ts` unchanged and green | close-work finds the clause and the unchanged test |
| Display formats, `docs/costing.md` Rounding note | T4 | AC-0107 and AC-0108 green in `test/alert-text.test.ts` | close-work finds the Days and Change rows |
| Current architecture, trust boundary, and AI connection, `docs/architecture/overview.md` | T7 | The overview diff | close-work matches each named row and sentence to `src/`, `supabase/`, and `test/` |
| Agent guidance, `AGENTS.md` | T7 | The environment paragraph diff | close-work finds the sentence |
| Interface compatibility, `src/lib/database.types.ts` | T1, T2, T3 | AC-0172 | `npm run gen:types` leaves no diff |
| Backlog, `workspace.toml` and the price-change-history intent | close-work | This spec's Assumptions answer the intent's questions | close-work moves the intent to `backlog.closed` |

Design facts with no other owner: the facts keys per alert type and the digest
states live in the migration's column comments and `src/lib/alert-text.ts`'s
types; the rule thresholds live in `SYSTEM-SPEC.md` §7 (T7). The rest is
inferable from code and tests or is delivery residue.

## Design (LLD)

### Design decisions

- **Every public function settles the caller first.** `refresh_alerts`, `dismiss_alert`, `apply_alert_price`, `start_digest`, and `finish_digest` each run `perform private.assert_caller('<name>')` as their first statement, before any argument check, lock, or read, as `set_list_price` does. Traces to: AC-0059, AC-0077.
- **The watch is one SQL function, run once per request.** `refresh_alerts(p_today date)` refuses no today, takes a transaction-level advisory lock, builds the current conditions from five CTEs (one per rule) as rows of type, product, lot, batch, and facts, then: updates the facts of each open live alert whose condition holds and whose facts differ; inserts an alert for each condition with no live alert of that type and subject; and ends each live alert whose condition is gone (an open one becomes `cleared`; a dismissed one keeps its status and gets its end time). It returns the open and urgent counts. The app wraps the call in React's `cache()` (`src/app/_server/watch.ts`), so the header and `/alerts` share one watch per request. Traces to: AC-0010 to AC-0017, AC-0028, AC-0030 to AC-0059.
- **Today comes from the app.** `p_today` is the app's today, worked out from the app process's clock and time zone (`appToday()` in `src/lib/app-today.ts`, a pure function of a `Date`), so the tests pass an exact date and the windows never depend on the database's UTC clock. Traces to: AC-0037, AC-0039, AC-0047, AC-0106.
- **Exact medians and guarded divisions.** `percentile_cont` returns `float8`, so the median is the mean of the middle one or two `numeric` values picked by `row_number()` over the ordered set. The cost CTE keeps only lots whose usual cost is above 0 before it divides, and the price CTE keeps only last changes whose cost is above 0, so no division by 0 is ever evaluated. Every rule compares exact `numeric` values and rounds only what it stores. Traces to: AC-0031 to AC-0036, AC-0038, AC-0041, AC-0078, AC-0193 to AC-0197.
- **The history is private and a trigger sees every writer.** `private.list_price_changes` sits beside `private.operators`, out of the Data API, with no grant to `anon`, `authenticated`, or `service_role`. `private.record_list_price_change()` is `SECURITY DEFINER` and runs `AFTER INSERT OR UPDATE OF list_price_per_lb ON products FOR EACH ROW` when the new price is distinct from the old; it reads the product's `cost_per_lb` from `v_product_pricing` when `has_cost`, so the price rule is not written a third time. `set_list_price` is unchanged, and `test/pricing.test.ts`'s AC-0034 check still passes because `tableFingerprints` covers `public` only. Traces to: AC-0067 to AC-0071, AC-0184, AC-0188.
- **The baseline is a function the migration calls once.** `private.baseline_list_prices()` inserts one baseline row for each product with a list price and no history row, so it is safe to rerun and the test can call it. Traces to: AC-0070.
- **Repricing goes through `set_list_price`.** `apply_alert_price(p_alert_id, p_price_per_lb)` settles the caller, locks the alert row, refuses one that is not open or not a margin or price alert, calls `public.set_list_price` (whose caller check reads the same JWT claims), and marks the alert actioned. It returns the `products` row, so the action reuses the pricing saved message. Traces to: AC-0060, AC-0061, AC-0111 to AC-0113.
- **Refusal texts carry the page's words.** `apply_alert_price` raises `apply_alert_price: This alert is no longer open.` and `dismiss_alert` raises `dismiss_alert: It is no longer open.` for a closed alert, and both raise `<function>: alert <id> not found` for an unknown id, so `src/lib/failures.ts`'s existing prefix stripping yields AC-0121 and AC-0122, and its inactive-product rule yields AC-0147. Traces to: AC-0121, AC-0122, AC-0147.
- **Messages outlive their card.** The reprice and dismiss outcome messages render in one status region at the top of the alert lists, outside the cards, so a success message and its focus target stay after the card leaves. Traces to: AC-0111, AC-0115, AC-0116, AC-0137.
- **The digest claim is a row, and the claim enforces once a day.** `start_digest(p_date, p_automatic)` locks the date's `alert_digests` row (inserting it when absent) and returns the AC-0065 result for the date's state and the kind of send, a failed day's result carrying its failure kind so the action can return that day's message. A send the page made on its own claims only a day with no row; a Try again press also takes over a failed day or a writing claim older than 180 seconds. `finish_digest(p_date, p_paragraphs, p_failure_kind)` takes exactly one of the two. The `/alerts` render applies the digest page rule from the row it reads, and the digest section passes `automatic: true` for the send it makes on its own and `false` for Try again, so a stale render (a browser Back, say) still cannot buy a second automatic request. After a claim, the action finishes the day as failed with the outcome's kind for every outcome but a written digest and a failed store of its paragraphs, and returns the outcome's message whether or not that record succeeds. When the call that records a failure gets no answer or is refused, the action makes no further `finish_digest` call and logs as AC-0127 and AC-0208 require. Traces to: AC-0064 to AC-0066, AC-0080 to AC-0096, AC-0185, AC-0198 to AC-0200, AC-0204, AC-0205, AC-0207.
- **The digest request is built from the page's own sentences.** `digestFacts(alerts, today)` in `src/lib/alert-text.ts` joins the same title, sentence, and next step the page shows, so the facts and the screen cannot drift. `src/lib/digest.ts` holds the fixed instructions, `digestRequest(facts)` (exact body: `model`, `max_tokens: 16000`, `system`, one user message, `output_config: { effort: "low", format: { type: "json_schema", schema } }`), and `digestVerdict(answer, facts, codes)`. The instructions say the user message is data to summarize, never directions to follow; the user message is exactly the digest facts, with no wrapper. Traces to: AC-0083, AC-0091 to AC-0093, AC-0097, AC-0098, AC-0160, AC-0192.
- **`model.ts` gains one export.** `writeDigest(facts)` reuses invoice-entry's `modelReady()` and client settings (`authToken: null`, `logLevel: "off"`, `maxRetries: 0`), passes a per-request `timeout: 60_000`, and maps errors with invoice-entry's failure-kind rule, adding `unfaithful`. No other file imports the SDK. Traces to: AC-0083, AC-0086 to AC-0090, AC-0109, AC-0127, AC-0158, AC-0162, AC-0189, AC-0190.
- **The page starts the digest, not the render.** When the page rule calls for a send, a client component sends `writeDigest` once on mount (a ref guards against a second send). The render never waits on the model. Traces to: AC-0080, AC-0081, AC-0134.

### Data & schema

- `private.list_price_changes`: `seq bigint generated always as identity primary key`, `product_id uuid not null references public.products`, `old_price numeric(10,2)`, `new_price numeric(10,2)`, `cost_per_lb numeric(12,4)`, `changed_at timestamptz not null default now()`, `baseline boolean not null default false`. `revoke all` on the table and its sequence from `public, anon, authenticated, service_role`.
- `public.alerts`: `id uuid pk default gen_random_uuid()`, `type text not null check (type in ('margin_below_target','cost_anomaly','yield_anomaly','low_stock','price_stale'))`, `severity text not null check (severity in ('high','medium','low'))`, `product_id uuid not null references products`, `lot_id uuid references lots`, `batch_id uuid references production_batches`, `facts jsonb not null`, `status text not null default 'open' check (status in ('open','dismissed','actioned','cleared'))`, `created_at`, `updated_at`, `closed_at timestamptz` (status left open), `ended_at timestamptz` (episode ended). Checks: `status = 'open'` implies no `ended_at`; `actioned` and `cleared` imply `ended_at`. A unique index on `(type, product_id, lot_id, batch_id) nulls not distinct where ended_at is null` holds AC-0051.
- Facts keys, all `numeric` or ISO date text: margin `list_price`, `margin_at_list`, `target_margin`, `cost_per_lb`, `suggested_list_price`, `price_action`; price `list_price`, `changed_at`, `cost_then`, `cost_per_lb`, `drift`, `price_action`, `suggested_list_price`; cost `received_date`, `unit_cost`, `usual_cost`, `change`, `band`, `reference_count`; yield `production_date`, `raw_lbs_in`, `finished_lbs_out`, `shrink`, `usual_shrink`, `band`, `shrink_used`; low stock `on_hand`, `daily_use`, `days_left`, `order_lbs`.
- `public.alert_digests`: `digest_date date primary key`, `status text not null check (status in ('writing','written','failed'))`, `paragraphs text[]`, `failure_kind text`, `model text`, `claimed_at timestamptz not null`, `finished_at timestamptz`. Checks: `written` holds 1 to 6 paragraphs of 1 to 800 characters and no failure kind; `failed` holds a failure kind and no paragraphs; `writing` holds neither.
- `public.v_alerts` (`security_invoker = true`): each alert with its product's code and description, its lot's number, received date, entry order, and vendor name, and its batch's number, production date, and entry order.
- Grants: `select` on the two public tables and the view to `authenticated` and `service_role`; RLS on each public table with the operator read policy the other tables use; no insert, update, or delete grant. The five public functions revoke from `public, anon, authenticated, service_role`, then grant `execute` to `authenticated`; the two private functions keep no grant.

### Interfaces & contracts

- Database: `refresh_alerts(p_today date)`, `dismiss_alert(p_alert_id uuid)`, `apply_alert_price(p_alert_id uuid, p_price_per_lb numeric)`, `start_digest(p_date date, p_automatic boolean)`, `finish_digest(p_date date, p_paragraphs text[], p_failure_kind text)`, and the view `v_alerts`. Consumed only by this app.
- `src/lib/rpc.ts`: `refreshAlerts`, `dismissAlert`, `applyAlertPrice`, `startDigest`, `finishDigest`. `src/lib/alerts.ts`: `listOpenAlerts`, `getDigest`, each parsing `facts` into `AlertView`.
- `src/lib/failures.ts`: the dismiss and digest texts; `LoggedAction` gains `applyAlertPrice`, `dismissAlert`, and `writeDigest`.

### Component / module decomposition

- `src/app/_server/watch.ts` (`server-only`): `runWatch()`, cached per request; returns `{ status: "ok", open, urgent }` or `{ status: "failed" }` and logs the failure.
- `src/app/page-header.tsx`: gains the Alerts link, last; becomes an async server component that awaits `runWatch()` and renders `UrgentBanner` or the failure line. On `/alerts` it renders neither; the page shows the failure line above its first section.
- `src/app/alerts/`: `page.tsx`, `error.tsx`, `alert-list.tsx` (with the shared outcome status region), `alert-card.tsx` (client: reprice and dismiss buttons), `digest-section.tsx` (client), `actions.ts` (`applyAlertPrice`, `dismissAlert`, `writeDigest`), and `decide.ts` (the three decisions, every outside call an argument).
- `src/lib/alert-text.ts`, `src/lib/digest.ts`, `src/lib/app-today.ts`: pure. `src/lib/format.ts` gains `formatDays` and `formatChange`.

### State & control flow

- A header page render: operator check, `runWatch()`, then the page's own reads; the banner shows the watch's urgent count.
- `/alerts`: operator check, `runWatch()`, then `listOpenAlerts` and `getDigest(appToday)` in parallel, then the digest page rule.
- Reprice or dismiss: decision in the spec's outcome order; on success the action revalidates `/alerts`, whose render runs a fresh watch.
- Digest: the spec's digest outcome order.

### Behavior & rules

The five rules, the outcome orders, and the texts are the spec's definitions and criteria; the SQL and the TypeScript implement them without restating them.

### Failure, edge cases & resilience

- The watch never breaks a page: `runWatch()` catches every failure and the header or `/alerts` shows the AC-0016 line. A watch that waits on the advisory lock behind another finishes after it; both see the same data.
- A digest request that never returns leaves a writing claim; after 180 seconds the page shows Try again.
- `apply_alert_price` and `dismiss_alert` lock the alert row and take the watch's advisory lock after their caller check, so a concurrent watch never clears an alert the owner is acting on mid-transaction.

### Quality attributes (NFRs)

- Watch speed: AC-0144's bar. Indexes on `lots (product_id, received_date, receipt_seq)` and `production_batches (finished_product_id, production_date)` exist or are added if the T2 timing misses the bar.
- Accessibility: the existing `checkPageState` bar for every page state.

### Dependencies & integration

- Invoice-entry's `src/app/_server/model.ts` (it exports `modelReady` and builds its client inside `readReceipt`), its failure-kind rule, and its fake model (`test/e2e/fake-model.mjs` on `127.0.0.1:3101`). Discovery predicate: after the rebase, the client construction and the failure-kind rule can be shared. If the client is built inside `readReceipt`, move its construction into a private helper in `model.ts` unchanged, as a bundled Tier 3 change; if the failure-kind rule is private, export it unchanged. Proof obligation: invoice-entry's suites stay green.
- `@anthropic-ai/sdk` as invoice-entry pins it: its `messages.create` takes a per-request `timeout` option (claude-api skill, client config).
- Sales' `/sales` and `/trace` pages, whose headers gain the Alerts link and banner.

## Tasks

Each `stub: true` block's validation is recorded under "Stub validation" at the end of this section.

### T1: Every list-price change lands in the private history with the cost of that moment

**Depends on:** none

**Touches:** `supabase/migrations/*_alerts.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/price-history.test.ts`, `docs/specs/menu-pricing/spec.md`

**Tests:**
- `test/price-history.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0067: set_list_price records each change with the old and new price and the cost then" (AC-0067). sha256 `e6ff4ba534d392e1bdba11bc34a7c10f5f3f911c0511d4db44b57ed604486089`.

```ts
import { afterAll, beforeEach, expect, it } from "vitest";
import { callAsOperator, closePool, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterAll(async () => {
  await closePool();
});

const setListPrice = (price: number) =>
  callAsOperator({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: price } });

// STUB: AC-0067
it("AC-0067: set_list_price records each change with the old and new price and the cost then", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).error).toBeUndefined();
  expect((await setListPrice(2.68)).error).toBeUndefined();
  expect((await setListPrice(3.29)).error).toBeUndefined();
  expect(
    await query(
      `select old_price::text, new_price::text, cost_per_lb::text, baseline, changed_at is not null as dated
       from private.list_price_changes where product_id = $1 order by seq`,
      [PROD_502_ID],
    ),
  ).toEqual([
    { old_price: null, new_price: "2.68", cost_per_lb: "2.6318", baseline: false, dated: true },
    { old_price: "2.68", new_price: "3.29", cost_per_lb: "2.6318", baseline: false, dated: true },
  ]);
});
```

- The same file grows in EXECUTE with one test each for AC-0068 (the operator and `service_role` updates go through `pg` sessions with that role's claims; the `postgres` update through `query`), AC-0184, AC-0069, AC-0070 (calls `private.baseline_list_prices()` as `postgres` over a fixture whose list prices were set through `query` with the trigger disabled for that statement), AC-0071 (tries a read and each write as each role), and AC-0188 (reads the privileges of every function and sequence the migration adds in `private`, from the catalog, for each role).
- `test/costing.test.ts`, `test/pricing.test.ts`, and the menu-pricing suites stay unchanged and green.

**Approach:**
- Run the `AGENTS.md` folder check, then `supabase db reset` from this worktree, and record `public`'s base tables, views, columns, and functions from the catalog in the verification ledger, for AC-0170 and AC-0171.
- Create the migration with `supabase migration new alerts`; T2 and T3 add to the same file. Add `private.list_price_changes` to `test/db.ts`'s truncate statement.
- Add the AC-0034 clause to `docs/specs/menu-pricing/spec.md`.

**Done when:** the T1 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T2: The watch opens, updates, and closes each alert by the spec's five rules

**Depends on:** T1

**Touches:** `supabase/migrations/*_alerts.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/alert-fixtures.ts`, `test/alerts-watch.test.ts`, `test/access.test.ts`

**Tests:**
- `test/alerts-watch.test.ts`, a new file, against the local stack. stub: true. Test functions and ACs: "AC-0030: a watch in the margin case opens one urgent margin alert with its figures" (AC-0030), "AC-0031: the cost rule opens a cost alert exactly at its band" (AC-0031). sha256 `5031b3fe83e7b1768e5e01baf94a507af735987ce10d7ebebc9ff0af25f1e573`.

```ts
import { afterAll, beforeEach, expect, it } from "vitest";
import { callAsOperator, closePool, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterAll(async () => {
  await closePool();
});

const TODAY = "2026-10-13";
const watch = () => callAsOperator({ fn: "refresh_alerts", args: { p_today: TODAY } });
const receive = async (weight: number, cost: number | string, received: string) =>
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, weight, cost, received))).error).toBeUndefined();

// STUB: AC-0030
it("AC-0030: a watch in the margin case opens one urgent margin alert with its figures", async () => {
  await receive(5000, 1.68, "2026-10-01");
  expect(
    (await callAsOperator({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: 20 } })).error,
  ).toBeUndefined();
  expect(
    (await callAsOperator({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: 2.68 } })).error,
  ).toBeUndefined();
  expect((await watch()).error).toBeUndefined();
  expect(
    await query(
      `select type, severity, status, product_id::text, facts->>'list_price' as list_price,
              facts->>'margin_at_list' as margin_at_list, facts->>'target_margin' as target_margin,
              facts->>'cost_per_lb' as cost_per_lb, facts->>'suggested_list_price' as suggested_list_price
       from public.alerts`,
    ),
  ).toEqual([
    {
      type: "margin_below_target",
      severity: "high",
      status: "open",
      product_id: PROD_502_ID,
      list_price: "2.68",
      margin_at_list: "0.0180",
      target_margin: "0.2000",
      cost_per_lb: "2.6318",
      suggested_list_price: "3.29",
    },
  ]);
});

// STUB: AC-0031
it("AC-0031: the cost rule opens a cost alert exactly at its band", async () => {
  const cases: ReadonlyArray<[string, string | null]> = [
    ["1.90", "0.1446"],
    ["1.826", "0.1000"],
    ["1.8259", null],
    ["1.80", null],
    ["1.49", "-0.1024"],
  ];
  for (const [cost, change] of cases) {
    await resetTestData();
    for (const [i, earlier] of ["1.60", "1.68", "1.70", "1.64"].entries()) {
      await receive(1000, earlier, `2026-10-0${i + 1}`);
    }
    await receive(1000, cost, "2026-10-05");
    expect((await watch()).error).toBeUndefined();
    const rows = await query(
      `select a.severity, a.facts->>'change' as change, a.facts->>'usual_cost' as usual_cost,
              a.facts->>'reference_count' as reference_count, l.unit_cost::text as unit_cost
       from public.alerts a join public.lots l on l.id = a.lot_id
       where a.type = 'cost_anomaly'`,
    );
    expect(rows, cost).toEqual(
      change === null
        ? []
        : [{ severity: "high", change, usual_cost: "1.6600", reference_count: "4", unit_cost: Number(cost).toFixed(4) }],
    );
  }
});
```

- The same file grows in EXECUTE with one test each for AC-0032, AC-0033, AC-0034, AC-0035, AC-0036, AC-0037, AC-0038, AC-0039, AC-0040, AC-0041, AC-0042, AC-0043, AC-0044, AC-0045, AC-0046, AC-0047, AC-0048, AC-0049, AC-0050, AC-0051, AC-0052, AC-0053, AC-0054, AC-0055, AC-0056, AC-0057, AC-0058, AC-0059, AC-0078, AC-0079, AC-0193, AC-0194, AC-0195, AC-0196, and AC-0197. Fixtures build every receipt, batch, target, and price through the operations and `set_list_price`; AC-0046, AC-0050, AC-0057, and AC-0079 use the five-alert fixture helper, AC-0046 and AC-0079 once per alert type, making that alert's product inactive through `query`; AC-0057 compares `tableFingerprints` without `alerts`, plus a fingerprint of `private.list_price_changes`, before and after; AC-0058 uses `raceCalls`; AC-0197 removes 502's fees through `query`.
- `test/access.test.ts` gains a `validArgs` entry and an operator fixture call for `refresh_alerts`.

**Approach:**
- `test/db.ts`: `OperationName` gains the five new functions; `PARAM_TYPES` gains `p_today`, `p_alert_id`, `p_date`, `p_automatic`, `p_paragraphs`, and `p_failure_kind`; the truncate list gains `alerts`.
- Write each rule as its own CTE and prove it before the next: margin, price, cost, yield, stock; then the lifecycle statements.
- Time AC-0144's fixture once here; add an index if the median misses 1 second.

**Done when:** the T2 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T3: Alerts can be repriced and dismissed, digests claimed and finished, and only the operator reaches them

**Depends on:** T2

**Touches:** `supabase/migrations/*_alerts.sql`, `src/lib/database.types.ts`, `test/db.ts`, `test/alerts-data.test.ts`, `test/access.test.ts`

**Tests:**
- `test/alerts-data.test.ts`, a new file, against the local stack. stub: true. Test function and AC: "AC-0060: apply_alert_price sets the list price and marks the alert actioned" (AC-0060). sha256 `a7036f759745ebe05f73be052099fd3b5ee1d766fb7b62182594b09fef981b76`.

```ts
import { afterAll, beforeEach, expect, it } from "vitest";
import { callAsOperator, closePool, PROD_502_ID, query, RAW_TOM_ID, receiveCall, resetTestData, VENDOR_ID } from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0060
it("AC-0060: apply_alert_price sets the list price and marks the alert actioned", async () => {
  expect((await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"))).error).toBeUndefined();
  expect(
    (await callAsOperator({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: 20 } })).error,
  ).toBeUndefined();
  expect(
    (await callAsOperator({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: 2.68 } })).error,
  ).toBeUndefined();
  expect((await callAsOperator({ fn: "refresh_alerts", args: { p_today: "2026-10-13" } })).error).toBeUndefined();
  const [alert] = await query<{ id: string }>("select id::text as id from public.alerts where type = 'margin_below_target'");
  expect(alert).toBeDefined();
  const applied = await callAsOperator({
    fn: "apply_alert_price",
    args: { p_alert_id: alert?.id ?? null, p_price_per_lb: 3.29 },
  });
  expect(applied.error).toBeUndefined();
  expect(await query("select list_price_per_lb::text as price from public.products where id = $1", [PROD_502_ID])).toEqual([
    { price: "3.29" },
  ]);
  expect(
    await query("select status, ended_at is not null as ended from public.alerts where id = $1", [alert?.id]),
  ).toEqual([{ status: "actioned", ended: true }]);
});
```

- The same file grows in EXECUTE with one test each for AC-0061, AC-0062, AC-0063, AC-0064, AC-0065, AC-0066, AC-0072, AC-0073, AC-0074, AC-0075, AC-0076, and AC-0077. Refusals compare `tableFingerprints` and a fingerprint of `private.list_price_changes` before and after; AC-0064 uses `raceCalls`; AC-0065 builds each table row's state, aging claims through `query`, and calls with each kind of send; AC-0072 and AC-0073 read as the non-operator and as `service_role`; AC-0074 tries each write as each role; AC-0075 checks `has_function_privilege`; AC-0076 reads `pg_proc.proconfig`; AC-0077 calls each function as the non-operator with each listed argument.
- `test/access.test.ts` gains `validArgs` entries and operator fixture calls for the other four functions.

**Approach:**
- Add `alert_digests` to the truncate list. Write the view, the four functions, and the grants, each function with its revoke-then-grant lines.

**Done when:** the T3 tests are green, `npm test` exits 0, and `npm run gen:types` leaves no diff.

### T4: The alert sentences, the two formats, the digest facts, and the digest checks pass their examples

**Depends on:** none

**Touches:** `src/lib/alert-text.ts`, `src/lib/digest.ts`, `src/lib/app-today.ts`, `src/lib/format.ts`, `src/lib/failures.ts`, `test/alert-text.test.ts`, `docs/costing.md`

**Tests:**
- `test/alert-text.test.ts`, a new file, no database. stub: true. Test functions and ACs: "AC-0100: a margin alert reads as the spec writes it" (AC-0100), "AC-0107: the days format" (AC-0107), "AC-0108: the change format" (AC-0108), "AC-0092: a digest with a number the facts do not hold is refused" (AC-0092). sha256 `339270ed562c03e7fde55fd2ccedd8bc3827e912f4b88f8132c29b51c5053f83`.

```ts
import { expect, it } from "vitest";
import { alertText, type AlertView } from "../src/lib/alert-text.js";
import { digestVerdict } from "../src/lib/digest.js";
import { formatChange, formatDays } from "../src/lib/format.js";

const MARGIN: AlertView = {
  type: "margin_below_target",
  code: "502",
  description: "Smoked Turkey Drums Tom",
  listPrice: 2.68,
  marginAtList: 0.018,
  targetMargin: 0.2,
  costPerLb: 2.6318,
  suggestedListPrice: 3.29,
  priceAction: "raise",
};

// STUB: AC-0100
it("AC-0100: a margin alert reads as the spec writes it", () => {
  expect(alertText(MARGIN)).toEqual({
    title: "Margin below target: 502 Smoked Turkey Drums Tom",
    sentence: "At your list price of $2.68/lb, the margin is 1.8%, below your 20% target. Cost is $2.6318/lb.",
    nextStep: "Raise list price to $3.29/lb",
  });
});

// STUB: AC-0107
it("AC-0107: the days format", () => {
  expect([5.3333, 7, 1, 0, 0.96].map(formatDays)).toEqual(["5.3 days", "7 days", "1 day", "0 days", "1 day"]);
});

// STUB: AC-0108
it("AC-0108: the change format", () => {
  expect([0.0962, -0.1024, 0.1, 0.6667].map(formatChange)).toEqual(["9.62%", "10.24%", "10%", "66.67%"]);
});

// STUB: AC-0092
it("AC-0092: a digest with a number the facts do not hold is refused", () => {
  const facts = "At $2.68/lb the margin is 1.8%, below 20%.";
  const digest = (text: string) => digestVerdict({ paragraphs: [text] }, facts, []);
  expect(digest("Your price of 2.68 gives 1.8% against 20%.")).toEqual({
    kind: "digest",
    paragraphs: ["Your price of 2.68 gives 1.8% against 20%."],
  });
  for (const extra of ["3.30", "2", "2,000"]) {
    expect(digest(`Your price of 2.68 gives 1.8% against 20%, so try ${extra}.`), extra).toEqual({ kind: "unfaithful" });
  }
});
```

- The same file grows in EXECUTE with one test each for AC-0091, AC-0093, AC-0101, AC-0102, AC-0103, AC-0104, AC-0105, AC-0106 (builds a change time near midnight UTC and checks the date in a fixed `TZ`), and AC-0192.
- `test/format.test.ts` and `test/format-extra.test.ts` stay unchanged and green.

**Approach:**
- Add the Days and Change rows to `docs/costing.md`'s Rounding note with the AC-0107 and AC-0108 examples.

**Done when:** the T4 tests are green and `npm test` exits 0.

### T5: Every header page shows the Alerts link and the urgent banner, and `/alerts` lists, reprices, and dismisses

**Depends on:** T3, T4

**Touches:** `src/app/_server/watch.ts`, `src/app/page-header.tsx`, `src/app/alerts/*` (except `digest-section.tsx`), `src/lib/alerts.ts`, `src/lib/rpc.ts`, `src/lib/failures.ts`, `playwright.config.ts`, `test/alert-actions.test.ts`, `test/e2e/alerts.spec.ts`, `test/e2e/alerts-page.ts`, `test/e2e/*-page.ts` (control lists only), `test/e2e/*.spec.ts` (control lists and `alerts` table exclusions only)

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/alerts.spec.ts`, signed in as the operator, with fixtures built through the operations and `pg`:
  - access and navigation: AC-0001, AC-0002, AC-0005 (on every header page), AC-0006, AC-0007, and AC-0003 for the reprice and dismiss actions;
  - the banner: AC-0010 (on every header page but `/alerts`), AC-0011, AC-0012, AC-0013, AC-0014 (through the receiving form), AC-0015 (through the pricing button), AC-0016 (on `/receiving` and on `/alerts`) and AC-0017 (on `/receiving`), each with the test revoking `execute` on `refresh_alerts` from `authenticated` and restoring it whether or not the test passes, AC-0135;
  - the page: AC-0020, AC-0180, AC-0181, AC-0182, AC-0021, AC-0022, AC-0023, AC-0024, AC-0025, AC-0026, AC-0027, AC-0028, AC-0111, AC-0112 (a receipt through `callAsOperator` after the page loads), AC-0113, AC-0115, AC-0116, AC-0117, AC-0118, AC-0120, AC-0121 (the alert closed through `pg` after the page loads), AC-0147 (the product made inactive through `pg` after the page loads), AC-0122, AC-0123 and AC-0137 (after the AC-0117, AC-0121, and AC-0147 outcomes), AC-0133;
  - `checkPageState` with no findings in every page state but the digest ones: AC-0130, AC-0131, AC-0132, AC-0139, AC-0141.
- `test/alert-actions.test.ts`, no database, drives `src/app/alerts/decide.ts`'s reprice and dismiss decisions with every outside call as an argument: AC-0119, and every branch of the change and dismiss outcome orders.
- The page helpers' control lists gain "a Alerts" as the last Primary link, and "a See alerts" where a test's fixture holds an open urgent alert; a test that fingerprints every `public` table around a page render leaves out `alerts`. The existing suites stay green.

**Approach:**
- Write `watch.ts` and the header, then `alerts.ts` reads, then `decide.ts` and the actions, then the page and its components. Set `TZ` in `playwright.config.ts`'s app environment so the browser suite knows the app's today.

**Done when:** the T5 tests are green and `npm test` exits 0.

### T6: The first `/alerts` visit each day writes a checked digest, and every failure says so

**Depends on:** T5

**Touches:** `src/app/_server/model.ts`, `src/app/alerts/digest-section.tsx`, `src/app/alerts/actions.ts`, `src/app/alerts/decide.ts`, `src/app/alerts/page.tsx`, `src/lib/digest.ts`, `src/lib/alerts.ts`, `src/lib/rpc.ts`, `src/lib/failures.ts`, `test/alert-actions.test.ts`, `test/e2e/alerts.spec.ts`, `test/e2e/alerts-page.ts`, `test/e2e/fake-model.mjs`

**Tests:** no stub (mode): manual QA exercised by the browser suite.
- `test/e2e/alerts.spec.ts` gains, with answers set on the fake model and requests read from it:
  - AC-0003 and AC-0004 for the digest action, AC-0080, AC-0081 (the fake model holds its answer until the test releases it), AC-0082, AC-0083, AC-0084, AC-0085, AC-0198, AC-0088, AC-0089, AC-0199, and AC-0096 (rows seeded through `pg`), AC-0090 (each case; the failed store revokes `execute` on `finish_digest` and restores it), AC-0095, AC-0185 (from a failed day and from an aged claim), AC-0204 (a replayed request with the on-its-own flag), AC-0205 (a day with no row, the page's own send answered with status 500 by the fake model, a link to `/receiving`, then `page.goBack()`), AC-0190 (429, 500, 529, and a drop), AC-0097 and AC-0099 (in the five-alert fixture helper's state), AC-0098, AC-0109 and AC-0162 (as invoice-entry's browser suite checks its key and machine-value header criteria), AC-0110, AC-0124, AC-0125, AC-0134, AC-0136;
  - `checkPageState` in the digest page states.
- `test/alert-actions.test.ts` gains the digest decision: AC-0126, AC-0127 (the log line for each kind, with a failing error whose message carries a sentinel key, the facts, and a product description), AC-0200, AC-0207 and AC-0208 (the recording call fails after each failure kind), and every branch of the digest outcome order.
- `fake-model.mjs` gains no new mode if its answer queue already sets any JSON body; otherwise it gains one, used only by this suite.

**Approach:**
- Settle the Dependencies & integration discovery predicate first; then `writeDigest`, the decision, the action, and the section.

**Done when:** the T6 tests are green, `npm test` exits 0, and invoice-entry's suites are unchanged and green.

### T7: The docs match the code, the goal-based checks pass, and the recorded runs are in the ledger

**Depends on:** T6

**Touches:** `SYSTEM-SPEC.md`, `docs/architecture/overview.md`, `AGENTS.md`, `docs/specs/alerts/notes/verification-ledger.md`

**Tests:** no stub (mode): goal-based checks and manual QA recorded in the verification ledger.
- AC-0144, AC-0150, AC-0151, AC-0152, AC-0153, AC-0154, AC-0155, AC-0156, AC-0157, AC-0158, AC-0186, AC-0170, AC-0171, AC-0172, AC-0173, AC-0174, and AC-0175, each as its command, with output in the ledger; AC-0170 and AC-0171 compare against T1's catalog record, and AC-0172 runs right after a `supabase db reset` from this worktree.
- The recorded run against `npm run start`, per the spec's Testing Strategy, for AC-0086, AC-0087, AC-0128, AC-0129, AC-0201, AC-0202, AC-0140, AC-0142, AC-0143, AC-0203, AC-0189, and AC-0159, with throwaway forwarders and invoice-entry's offline-run sandbox profile in scratch.
- The live run for AC-0160, once the owner confirms the key is in `.env`; its fixture is the five-alert fixture helper's state with one product description set to the AC-0160 direction. The ledger records what the spec's live-run step lists.
- Rendered-page inspection of `/alerts` with urgent and other alerts and a written digest, and `/receiving` with the banner, at the narrow and wide fallback channels, with the observations recorded in the ledger for the `frontend-reviewer`.

**Approach:**
- Write `SYSTEM-SPEC.md` §4's alert lines and §7's rule measures, the overview's rows, access model, write-path paragraph, and AI connection line, and `AGENTS.md`'s digest sentence; then run the checks and the recorded runs.

**Done when:** every T7 entry is recorded in the ledger with a pass, and `npm test` exits 0.

### Stub validation

Run 2026-10-13, then rerun for the T1 stub after its table moved to the `private` schema. Each `stub: true` block was extracted from this file into a `git archive` copy of `HEAD` in the session's scratch directory, outside the repository, and its sha256 recorded from that extraction (the code lines plus one terminal newline).

- **Compile:** with placeholder declarations of `src/lib/alert-text.ts` (`AlertView` and `alertText`), `src/lib/digest.ts` (`digestVerdict`), `formatDays` and `formatChange` in `src/lib/format.ts`, and the T2 `test/db.ts` names (five `OperationName` entries and five `PARAM_TYPES` entries), `tsc --noEmit -p tsconfig.json` over the scratch copy exited 0.
- **Red, with the placeholder modules removed and the `test/db.ts` names kept:** `vitest run` over the four files exited 1, 4 files and 4 tests failed. `test/alert-text.test.ts` failed to load `../src/lib/alert-text.js`. AC-0030, AC-0031, and AC-0060 failed on `function public.refresh_alerts(p_today => date) does not exist`, after their receipts, target, and list price calls had succeeded. AC-0067 failed on `relation "private.list_price_changes" does not exist`, after its receipt and both `set_list_price` calls had succeeded. The rerun, after the T1 stub's table moved to `private`, gave the same results with that message, under the same isolation.
- **Isolation:** the run went through `sandbox-exec` with: outbound network denied except to `localhost` and Unix sockets (a `curl` to `https://api.anthropic.com` under the same profile exited 7, could not connect); file-content reads denied except for the repository, the Node 22.17.0 install under `~/.nvm/versions/node/v22.17.0`, the scratch directory, this user's temporary directory (`os.tmpdir()`), `/private/var/db/timezone`, `/System`, `/usr`, `/private/etc`, and `/dev` (a read of `~/.zshrc` was refused); file writes denied except under the scratch directory, the temporary directory, and `/dev` (a write into the repository was refused); and a 120-second `alarm`. The scratch copy's `node_modules` was a directory of links to the repository's packages, so Vitest's config cache was written under scratch. Vitest ran as `node node_modules/vitest/vitest.mjs`, not through `npx`. The stack details came from `supabase status -o env` outside the sandbox and were passed in the environment.
- **Declared test-harness side effects,** all on stack A through `localhost`: global setup's idempotent creation of the test users and their allowlist rows, and `resetTestData`'s truncate and reseed of the local database. These are the side effects `npm test` has on every run. The `AGENTS.md` folder check listed no other stack A folder before the run.
- **Probe of the load-bearing mechanisms,** in one rolled-back transaction on stack A: a `SECURITY DEFINER` trigger on `products` read the product's `cost_per_lb` from `v_product_pricing` (2.1818 for a 1.68 receipt at 23% shrink); a `SECURITY DEFINER` function called by an operator session called `set_list_price` and passed its caller check; a partial unique index with `nulls not distinct` refused a second live row; and `->>` on a `jsonb` built from `round(x, 4)` kept the scale (`0.1000`, `-0.1024`). Afterwards no probe object or row remained.
- The scratch copy was removed.

## Rollout

- **Delivery:** local only. Merging adds `/alerts`, the banner, and the history trigger. Without `ANTHROPIC_API_KEY`, alerts work and the digest says it isn't set up.
- **Infrastructure:** none. The digest uses the key invoice-entry already set up, at about $0.05 a day.
- **External-system integration:** the Claude Messages API, under the terms invoice-entry records.
- **Deployment sequencing:** Sales and Invoice entry merge into `main` first; this branch rebases onto that `main`, names its migration with a timestamp after both of theirs, regenerates the types, and only then starts T1. The migration applies before the app that calls its functions; the hosted rollout stays with the hosted-supabase-rollout intent, where the baseline step gives existing list prices their first history row.

## Risks

- **Two unmerged foundations.** If Sales or Invoice entry changes `PageHeader`, `model.ts`, the fake model, or the page helpers differently than their plans say, T5 and T6 adapt to what merged; the spec's criteria stay fixed.
- **Shared stack A.** A test run in another worktree wipes this one's data. Take turns through the folder check.
- **Watch cost per page.** Every header page now waits on one database call. AC-0144 bounds it; if Next.js prefetching renders pages in the background, each prefetch also runs a watch, which is harmless because the watch is idempotent.
- **Actions queue behind the digest.** Next.js runs a page's server actions one at a time, so on the first `/alerts` visit of a day a reprice or dismiss pressed while the digest is being written waits for it, at most 60 seconds. Accepted for now; a route handler for the digest would remove the wait.
- **Model behavior.** Opus 5.5 at low effort may round or restate a figure; AC-0092 refuses it and AC-0160 records how the live run went. The fix is instruction wording within the same rules.

## Changelog

- 2026-10-13: initial plan
- 2026-10-13: after review round 1: the price history moves to the private schema and menu-pricing AC-0034 gains a clause; every public function settles the caller first; the page sends the digest on its own only for a day with no row, and every failure after a claim finishes the day as failed; the digest instructions treat the facts as data; messages render outside the cards; new tasks' coverage for the zero, window, swing, and rounding edges.
- 2026-10-13: after review round 2: the claim, not only the render, holds the once-a-day automatic send; the digest facts go unwrapped; the private history joins the no-change checks; the inactive-product checks cover all five types; the live-run cost record moves from the criteria into the live-run step.
- 2026-10-13: after review round 3: a failed record leaves the day writing and adds no log line; the browser Back check starts from the page's own failed send; the claim race names its state; the live-run direction record ignores word-for-word copies of the planted description and gates nothing, by the owner's choice.
- 2026-10-13: after review rounds 4 and 5: the unchecked "the day stays writing" clause is gone, and so is the "failed record" term; AC-0200, AC-0207, and AC-0208 name the failing call that records a failure, and a failed store of the paragraphs keeps its store-failed line.
