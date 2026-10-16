import { afterAll, beforeEach, expect, it } from "vitest";
import { createTypedClient } from "../src/lib/supabase.js";
import { ALERT_TYPES, buildFiveAlertFixture, type AlertType } from "./alert-fixtures.js";
import {
  callAsOperator,
  closePool,
  idOf,
  PROD_502_ID,
  query,
  raceCalls,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  tableFingerprints,
  VENDOR_ID,
  type OpCall,
} from "./db.js";
import { resolveStackEnv } from "./env.js";
import { signInNonOperator, signInOperator } from "./users.js";

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

// ---- Helpers for the rest of the file ----

const TODAY = "2026-10-13";
const DAY = "2026-10-13";
const UNKNOWN_ID = "00000000-0000-4000-8000-000000000001";

const op = async (call: OpCall): Promise<Record<string, unknown>[]> => {
  const outcome = await callAsOperator(call);
  expect(outcome.error, `${call.fn} ${JSON.stringify(call.args)}`).toBeUndefined();
  return outcome.rows ?? [];
};
const runWatch = (today = TODAY) => op({ fn: "refresh_alerts", args: { p_today: today } });

// The margin case: the 502 fixture with a 20% target and a 2.68 list price, watched once.
async function marginCase(): Promise<string> {
  await op(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
  await op({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: 20 } });
  await op({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: 2.68 } });
  await runWatch();
  return alertIdOf("margin_below_target");
}

async function alertIdOf(type: AlertType): Promise<string> {
  const rows = await query<{ id: string }>("select id::text as id from public.alerts where type = $1", [type]);
  expect(rows.length, `one ${type} alert`).toBe(1);
  return rows[0]!.id;
}

const dismiss = (id: string | null): OpCall => ({ fn: "dismiss_alert", args: { p_alert_id: id } });
const reprice = (id: string | null, price: number | string | null): OpCall => ({
  fn: "apply_alert_price",
  args: { p_alert_id: id, p_price_per_lb: price },
});
const start = (date: string | null, automatic: boolean | null): OpCall => ({
  fn: "start_digest",
  args: { p_date: date, p_automatic: automatic === null ? null : String(automatic) },
});
// A text[] argument as a Postgres array literal, because OpCall args are scalars.
const pgArray = (...items: string[]): string =>
  `{${items.map((i) => `"${i.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;
const finish = (date: string | null, paragraphs: string | null, kind: string | null): OpCall => ({
  fn: "finish_digest",
  args: { p_date: date, p_paragraphs: paragraphs, p_failure_kind: kind },
});

const historyFingerprint = async () =>
  (
    await query<{ f: string }>(
      `select count(*)::text || ':' || md5(coalesce(string_agg(t::text, '|' order by seq), '')) as f
       from private.list_price_changes t`,
    )
  )[0]?.f;
const everything = async () => ({ ...(await tableFingerprints()), history: await historyFingerprint() });

// The call is refused with a message that matches, and no table changes.
async function expectRefused(call: OpCall, message: RegExp): Promise<void> {
  const before = await everything();
  const outcome = await callAsOperator(call);
  expect(outcome.ok, `${call.fn} ${JSON.stringify(call.args)} is refused`).toBe(false);
  expect(outcome.error, `${call.fn} ${JSON.stringify(call.args)}`).toMatch(message);
  expect(await everything(), `${call.fn} ${JSON.stringify(call.args)} changes nothing`).toEqual(before);
}

const without = (all: Record<string, string | undefined>, key: string) =>
  Object.fromEntries(Object.entries(all).filter(([k]) => k !== key));

const digestRow = async (date = DAY) =>
  (await query<{ r: string }>("select t::text as r from public.alert_digests t where digest_date = $1", [date]))[0]?.r;

// ---- Reprice ----

// AC-0060 (price alert)
it("AC-0060: apply_alert_price also actions a price alert, and the list price change lands in the history", async () => {
  const fx = await buildFiveAlertFixture();
  const id = await alertIdOf("price_stale");
  const [product] = await op(reprice(id, 2.99));
  expect(product).toMatchObject({ id: fx.subjects.price_stale.productId, list_price_per_lb: "2.99" });
  expect(await query("select status from public.alerts where id = $1", [id])).toEqual([{ status: "actioned" }]);
  expect(
    await query("select new_price::text from private.list_price_changes where product_id = $1 order by seq desc limit 1", [
      fx.subjects.price_stale.productId,
    ]),
  ).toEqual([{ new_price: "2.99" }]);
});

// AC-0061
it("AC-0061: apply_alert_price is refused and changes nothing for a closed alert, an unknown id, a cost, yield, or low-stock alert, and a refused price", async () => {
  await buildFiveAlertFixture();
  const margin = await alertIdOf("margin_below_target");
  for (const type of ["cost_anomaly", "yield_anomaly", "low_stock"] as const) {
    const id = await alertIdOf(type);
    await expectRefused(reprice(id, 3.29), new RegExp(`^apply_alert_price: alert ${id} is not a margin or price alert`));
  }
  await expectRefused(reprice(UNKNOWN_ID, 3.29), new RegExp(`^apply_alert_price: alert ${UNKNOWN_ID} not found`));
  await expectRefused(reprice(null, 3.29), /^apply_alert_price: alert <NULL> not found/);

  // Prices set_list_price refuses pass through with its prefix, and the alert stays open.
  for (const [price, message] of [
    [0, /^set_list_price: price must be above 0/],
    [-1, /^set_list_price: price must be above 0/],
    [3.295, /^set_list_price: price has more than 2 decimal places/],
    ["NaN", /^set_list_price: price must be a finite number/],
    [null, /^set_list_price: price must be a finite number/],
    [100000000, /^set_list_price: price must be below 100000000/],
  ] as const) {
    await expectRefused(reprice(margin, price), message);
  }
  expect(await query("select status from public.alerts where id = $1", [margin])).toEqual([{ status: "open" }]);

  // An inactive product: set_list_price refuses and the alert stays open.
  await query("update public.products set active = false where id = $1", [PROD_502_ID]);
  await expectRefused(reprice(margin, 3.29), /^set_list_price: product .* is inactive/);

  // A closed alert, one for each way an alert closes.
  await query("update public.products set active = true where id = $1", [PROD_502_ID]);
  const price = await alertIdOf("price_stale");
  await op(dismiss(price));
  await expectRefused(reprice(price, 2.99), /^apply_alert_price: This alert is no longer open\.$/);
  await op(reprice(margin, 3.29));
  await expectRefused(reprice(margin, 3.3), /^apply_alert_price: This alert is no longer open\.$/);
  const cost = await alertIdOf("cost_anomaly");
  await query("update public.alerts set status = 'cleared', closed_at = now(), ended_at = now() where id = $1", [cost]);
  await expectRefused(reprice(cost, 3.29), /^apply_alert_price: This alert is no longer open\.$/);
});

// ---- Dismiss ----

// AC-0062
it("AC-0062: dismiss_alert marks an open alert dismissed and changes no other row", async () => {
  await buildFiveAlertFixture();
  const id = await alertIdOf("cost_anomaly");
  const others = () =>
    query("select t::text as r from public.alerts t where id <> $1 order by id", [id]);
  const before = { ...without(await everything(), "alerts"), others: await others() };
  const [row] = await op(dismiss(id));
  expect(row).toMatchObject({ id, status: "dismissed", type: "cost_anomaly", ended_at: null });
  expect(row?.closed_at).toBeInstanceOf(Date);
  expect(
    await query("select status, closed_at is not null as closed, ended_at is not null as ended from public.alerts where id = $1", [id]),
  ).toEqual([{ status: "dismissed", closed: true, ended: false }]);
  expect({ ...without(await everything(), "alerts"), others: await others() }).toEqual(before);
  // The dismissed alert still counts for the live-alert index: the next watch does not reopen it.
  await runWatch();
  expect(await query("select status from public.alerts where id = $1", [id])).toEqual([{ status: "dismissed" }]);
  expect((await query("select 1 from public.alerts where type = 'cost_anomaly'")).length).toBe(1);
});

// AC-0063
it("AC-0063: dismiss_alert is refused and changes nothing for a closed alert and an unknown id", async () => {
  await buildFiveAlertFixture();
  const dismissed = await alertIdOf("low_stock");
  await op(dismiss(dismissed));
  const actioned = await alertIdOf("margin_below_target");
  await op(reprice(actioned, 3.29));
  const cleared = await alertIdOf("cost_anomaly");
  await query("update public.alerts set status = 'cleared', closed_at = now(), ended_at = now() where id = $1", [cleared]);
  for (const id of [dismissed, actioned, cleared]) {
    await expectRefused(dismiss(id), /^dismiss_alert: It is no longer open\.$/);
  }
  await expectRefused(dismiss(UNKNOWN_ID), new RegExp(`^dismiss_alert: alert ${UNKNOWN_ID} not found$`));
  await expectRefused(dismiss(null), /^dismiss_alert: alert <NULL> not found$/);
});

// AC-0062 and AC-0061, the watch's lock: acting on an alert waits for a watch in progress.
it("AC-0062: dismiss_alert and apply_alert_price wait for a watch that is running", async () => {
  const id = await marginCase();
  const watchCall: OpCall = { fn: "refresh_alerts", args: { p_today: TODAY } };
  for (const call of [dismiss(id), reprice(id, 3.29)]) {
    const [a, b] = await raceCalls(watchCall, call);
    expect(a.error).toBeUndefined();
    expect(b.error, call.fn).toBeUndefined();
    expect(b.waitedOn?.some((w) => w.startsWith("advisory")), `${call.fn} waited on the watch`).toBe(true);
    await query("update public.alerts set status = 'open', closed_at = null, ended_at = null where id = $1", [id]);
  }
});

// ---- The digest claim ----

// AC-0064
it("AC-0064: two start_digest calls at the same time claim a date once", async () => {
  await marginCase();
  const [a, b] = await raceCalls(start(DAY, false), start(DAY, false));
  expect(a.error).toBeUndefined();
  expect(b.error).toBeUndefined();
  expect(b.waitedOn, "the second call waited on the first").toBeDefined();
  expect([a.rows?.[0]?.result, b.rows?.[0]?.result]).toEqual(["claimed", "busy"]);
  expect((await query("select status from public.alert_digests")).length).toBe(1);
  // A second race on the same day, now that a fresh claim exists, claims nothing.
  const [c, d] = await raceCalls(start(DAY, true), start(DAY, false));
  expect([c.rows?.[0]?.result, d.rows?.[0]?.result]).toEqual(["busy", "busy"]);
});

type DigestState = "none" | "written" | "failed" | "fresh" | "stale";
const PARAGRAPHS = pgArray("First paragraph.", "Second paragraph.");

async function setDigestState(state: DigestState): Promise<void> {
  await query("delete from public.alert_digests");
  const row = {
    written: `'written', '${PARAGRAPHS}'::text[], null, 'claude-opus-5-5', now() - interval '3 hours', now() - interval '3 hours'`,
    failed: `'failed', null, 'unfaithful', null, now() - interval '3 hours', now() - interval '3 hours'`,
    fresh: `'writing', null, null, null, now() - interval '178 seconds', null`,
    stale: `'writing', null, null, null, now() - interval '182 seconds', null`,
  };
  if (state === "none") return;
  await query(
    `insert into public.alert_digests(digest_date, status, paragraphs, failure_kind, model, claimed_at, finished_at)
     values ('${DAY}', ${row[state]})`,
  );
}

// AC-0065
it("AC-0065: start_digest returns the first matching row of the spec's table and changes the row only on claimed", async () => {
  const id = await marginCase();
  const states: DigestState[] = ["none", "written", "failed", "fresh", "stale"];
  type Expected = { result: string; paragraphs?: string[]; kind?: string; row: "same" | "claimed" };
  const table: Record<DigestState, Record<"try" | "own", Expected>> = {
    none: { try: { result: "claimed", row: "claimed" }, own: { result: "claimed", row: "claimed" } },
    written: {
      try: { result: "written", paragraphs: ["First paragraph.", "Second paragraph."], row: "same" },
      own: { result: "written", paragraphs: ["First paragraph.", "Second paragraph."], row: "same" },
    },
    failed: { try: { result: "claimed", row: "claimed" }, own: { result: "failed", kind: "unfaithful", row: "same" } },
    fresh: { try: { result: "busy", row: "same" }, own: { result: "busy", row: "same" } },
    stale: { try: { result: "claimed", row: "claimed" }, own: { result: "stale", row: "same" } },
  };
  for (const state of states) {
    for (const send of ["try", "own"] as const) {
      const label = `${state} / ${send}`;
      await setDigestState(state);
      const before = await digestRow();
      const [row] = await op(start(DAY, send === "own"));
      const expected = table[state][send];
      expect(row, label).toEqual({
        result: expected.result,
        paragraphs: expected.paragraphs ?? null,
        failure_kind: expected.kind ?? null,
      });
      if (expected.row === "same") {
        expect(await digestRow(), label).toBe(before);
      } else {
        expect(
          await query(
            `select status, paragraphs, failure_kind, model, finished_at is null as open,
                    claimed_at > now() - interval '30 seconds' as fresh
             from public.alert_digests where digest_date = $1`,
            [DAY],
          ),
          label,
        ).toEqual([{ status: "writing", paragraphs: null, failure_kind: null, model: null, open: true, fresh: true }]);
      }
    }
  }

  // With no alert open the result is none for every state and either send, and nothing is stored.
  await op(dismiss(id));
  for (const state of states) {
    for (const automatic of [false, true]) {
      await setDigestState(state);
      const before = await everything();
      const [row] = await op(start(DAY, automatic));
      expect(row, `${state} / ${automatic} with no alert open`).toEqual({ result: "none", paragraphs: null, failure_kind: null });
      expect(await everything(), `${state} / ${automatic} with no alert open`).toEqual(before);
    }
  }
});

// AC-0066
it("AC-0066: finish_digest stores a writing date as written or failed, and is refused otherwise", async () => {
  await marginCase();
  await op(start(DAY, false));
  const [written] = await op(finish(DAY, PARAGRAPHS, null));
  expect(written).toMatchObject({ status: "written", model: "claude-opus-5-5" });
  expect(
    await query(
      `select status, paragraphs, failure_kind, model, finished_at is not null as finished
       from public.alert_digests where digest_date = $1`,
      [DAY],
    ),
  ).toEqual([
    {
      status: "written",
      paragraphs: ["First paragraph.", "Second paragraph."],
      failure_kind: null,
      model: "claude-opus-5-5",
      finished: true,
    },
  ]);

  // A written day is not writing, whichever way it is finished again.
  await expectRefused(finish(DAY, pgArray("Another."), null), /^finish_digest: the digest for 2026-10-13 is not being written$/);
  await expectRefused(finish(DAY, null, "timeout"), /is not being written$/);

  // A failed record.
  await query("delete from public.alert_digests");
  await op(start(DAY, false));
  await op(finish(DAY, null, "timeout"));
  expect(
    await query(
      "select status, paragraphs, failure_kind, model, finished_at is not null as finished from public.alert_digests",
    ),
  ).toEqual([{ status: "failed", paragraphs: null, failure_kind: "timeout", model: null, finished: true }]);
  await expectRefused(finish(DAY, pgArray("Late."), null), /is not being written$/);
  await expectRefused(finish(DAY, null, "timeout"), /is not being written$/);

  // No row for the date, and no date.
  await expectRefused(finish("2026-10-12", pgArray("Early."), null), /^finish_digest: the digest for 2026-10-12 is not being written$/);
  await expectRefused(finish(null, pgArray("Early."), null), /is not being written$/);

  // Exactly one of the two, and paragraphs the table accepts.
  await query("delete from public.alert_digests");
  await op(start(DAY, false));
  await expectRefused(finish(DAY, null, null), /^finish_digest: give the paragraphs or a failure kind/);
  await expectRefused(finish(DAY, PARAGRAPHS, "timeout"), /^finish_digest: give the paragraphs or a failure kind/);
  await expectRefused(finish(DAY, null, ""), /^finish_digest: give the paragraphs or a failure kind/);
  await expectRefused(finish(DAY, "{}", null), /alert_digests_state/);
  await expectRefused(finish(DAY, pgArray("1", "2", "3", "4", "5", "6", "7"), null), /alert_digests_state/);
  await expectRefused(finish(DAY, pgArray("ok", ""), null), /alert_digests_state/);
  await expectRefused(finish(DAY, pgArray("x".repeat(801)), null), /alert_digests_state/);
  expect((await query("select status from public.alert_digests"))).toEqual([{ status: "writing" }]);
  // The limits themselves are accepted: six paragraphs of 800 characters.
  await op(finish(DAY, pgArray(...Array.from({ length: 6 }, () => "x".repeat(800))), null));
  expect(await query("select cardinality(paragraphs) as n, status from public.alert_digests")).toEqual([
    { n: 6, status: "written" },
  ]);
});

// ---- Access ----

const env = resolveStackEnv();
type Rpc = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error: { code?: string; message: string } | null }> };
type Reader = {
  from: (table: string) => {
    select: (cols: string) => PromiseLike<{ data: unknown[] | null; error: { code?: string } | null }>;
    insert: (row: Record<string, unknown>) => PromiseLike<{ error: { code?: string } | null }>;
    update: (row: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<{ error: { code?: string } | null }> };
    delete: () => { eq: (c: string, v: string) => PromiseLike<{ error: { code?: string } | null }> };
  };
};
const asClient = (c: unknown) => c as Rpc & Reader;

// A fixture where an operator reads at least one row from alerts, alert_digests, and v_alerts.
async function readableFixture(): Promise<string> {
  const id = await marginCase();
  await op(start(DAY, false));
  await op(finish(DAY, PARAGRAPHS, null));
  return id;
}
const RELATIONS = ["alerts", "alert_digests", "v_alerts"] as const;

// AC-0072
it("AC-0072: a non-operator reads 0 rows from alerts, alert_digests, and v_alerts", async () => {
  await readableFixture();
  const operator = asClient(await signInOperator());
  const nonOperator = asClient(await signInNonOperator());
  for (const table of RELATIONS) {
    const mine = await operator.from(table).select("*");
    expect(mine.error, `operator ${table}`).toBeNull();
    expect(mine.data?.length, `operator rows in ${table}`).toBeGreaterThanOrEqual(1);
    const theirs = await nonOperator.from(table).select("*");
    expect(theirs.error, `non-operator ${table}`).toBeNull();
    expect(theirs.data, `non-operator rows in ${table}`).toEqual([]);
  }
});

// AC-0073
it("AC-0073: service_role reads at least one row from alerts, alert_digests, and v_alerts", async () => {
  await readableFixture();
  const service = asClient(createTypedClient(env.apiUrl, env.serviceRoleKey));
  for (const table of RELATIONS) {
    const res = await service.from(table).select("*");
    expect(res.error, `service_role ${table}`).toBeNull();
    expect(res.data?.length, `service_role rows in ${table}`).toBeGreaterThanOrEqual(1);
  }
});

// AC-0074
it("AC-0074: an insert, update, or delete on alerts or alert_digests is refused to anon, authenticated, and service_role", async () => {
  const id = await readableFixture();
  const clients: [string, Rpc & Reader][] = [
    ["anon", asClient(createTypedClient(env.apiUrl, env.anonKey))],
    ["operator", asClient(await signInOperator())],
    ["non-operator", asClient(await signInNonOperator())],
    ["service_role", asClient(createTypedClient(env.apiUrl, env.serviceRoleKey))],
  ];
  const [alert] = await query<Record<string, unknown>>("select to_jsonb(a) - 'id' as r from public.alerts a").then((r) => r.map((x) => x["r"] as Record<string, unknown>));
  const [digest] = await query<Record<string, unknown>>("select to_jsonb(d) - 'digest_date' as r from public.alert_digests d").then((r) => r.map((x) => x["r"] as Record<string, unknown>));
  const before = await everything();
  for (const [role, client] of clients) {
    const attempts: [string, PromiseLike<{ error: { code?: string } | null }>][] = [
      ["insert alerts", client.from("alerts").insert({ ...alert })],
      ["update alerts", client.from("alerts").update({ status: "open" }).eq("id", id)],
      ["delete alerts", client.from("alerts").delete().eq("id", id)],
      ["insert alert_digests", client.from("alert_digests").insert({ ...digest, digest_date: "2026-10-14" })],
      ["update alert_digests", client.from("alert_digests").update({ status: "writing" }).eq("digest_date", DAY)],
      ["delete alert_digests", client.from("alert_digests").delete().eq("digest_date", DAY)],
    ];
    for (const [what, attempt] of attempts) {
      expect((await attempt).error?.code, `${role} ${what}`).toBe("42501");
    }
  }
  expect(await everything()).toEqual(before);
});

const FUNCTIONS = ["refresh_alerts", "dismiss_alert", "apply_alert_price", "start_digest", "finish_digest"] as const;

// AC-0075
it("AC-0075: anon and service_role cannot execute the five functions, and only authenticated can", async () => {
  for (const fn of FUNCTIONS) {
    const [row] = await query<{ anon: boolean; service: boolean; authenticated: boolean; oid: string }>(
      `select has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated,
              p.oid::text as oid
       from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1`,
      [fn],
    );
    expect(row, fn).toMatchObject({ anon: false, service: false, authenticated: true });
    // No other role holds the default PUBLIC grant either.
    const [pub] = await query<{ n: number }>(
      `select count(*)::int as n from pg_proc p, aclexplode(p.proacl) a
       where p.pronamespace = 'public'::regnamespace and p.proname = $1 and a.grantee = 0`,
      [fn],
    );
    expect(pub?.n, `PUBLIC execute on ${fn}`).toBe(0);
  }
  const service = asClient(createTypedClient(env.apiUrl, env.serviceRoleKey));
  const anon = asClient(createTypedClient(env.apiUrl, env.anonKey));
  for (const [label, client] of [["service_role", service], ["anon", anon]] as const) {
    expect((await client.rpc("dismiss_alert", { p_alert_id: UNKNOWN_ID })).error?.code, label).toBe("42501");
  }
  // The private helper the table's check calls grants nothing to the API roles (AC-0188).
  for (const role of ["anon", "authenticated", "service_role"]) {
    const [row] = await query<{ ok: boolean }>(
      "select has_function_privilege($1, 'private.digest_paragraphs_ok(text[])', 'EXECUTE') as ok",
      [role],
    );
    expect(row?.ok, `${role} EXECUTE on digest_paragraphs_ok`).toBe(false);
  }
});

// AC-0076
it("AC-0076: every function the migration adds sets search_path to an empty value", async () => {
  const names = [
    "record_list_price_change",
    "baseline_list_prices",
    "digest_paragraphs_ok",
    ...FUNCTIONS,
  ];
  const rows = await query<{ name: string; config: string[] | null }>(
    `select p.proname as name, p.proconfig as config from pg_proc p
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace) and p.proname = any($1::text[])
     order by 1`,
    [names],
  );
  expect(rows.map((r) => r.name)).toEqual([...names].sort());
  for (const row of rows) expect(row.config, row.name).toEqual(['search_path=""']);
});

// AC-0077
it("AC-0077: a non-operator's call to any of the five functions is refused with 42501 and changes no table", async () => {
  await buildFiveAlertFixture();
  const open = await alertIdOf("margin_below_target");
  const cost = await alertIdOf("cost_anomaly");
  const closed = await alertIdOf("low_stock");
  await op(dismiss(closed));
  await op(start(DAY, false));
  const nonOperator = asClient(await signInNonOperator());

  const arrayOf = (...x: string[]) => x;
  const calls: [string, Record<string, unknown>][] = [
    ["refresh_alerts", { p_today: TODAY }],
    ["refresh_alerts", { p_today: null }],
    ["dismiss_alert", { p_alert_id: open }],
    ["dismiss_alert", { p_alert_id: UNKNOWN_ID }],
    ["dismiss_alert", { p_alert_id: closed }],
    ["dismiss_alert", { p_alert_id: null }],
    ["apply_alert_price", { p_alert_id: open, p_price_per_lb: 3.29 }],
    ["apply_alert_price", { p_alert_id: UNKNOWN_ID, p_price_per_lb: 3.29 }],
    ["apply_alert_price", { p_alert_id: closed, p_price_per_lb: 3.29 }],
    ["apply_alert_price", { p_alert_id: cost, p_price_per_lb: 3.29 }],
    ["apply_alert_price", { p_alert_id: open, p_price_per_lb: 3.295 }],
    ["apply_alert_price", { p_alert_id: open, p_price_per_lb: null }],
    ["start_digest", { p_date: "2026-10-14", p_automatic: false }],
    ["start_digest", { p_date: "2026-10-14", p_automatic: true }],
    ["start_digest", { p_date: DAY, p_automatic: false }],
    ["start_digest", { p_date: null, p_automatic: false }],
    ["start_digest", { p_date: DAY, p_automatic: null }],
    ["finish_digest", { p_date: DAY, p_paragraphs: arrayOf("A paragraph."), p_failure_kind: null }],
    ["finish_digest", { p_date: DAY, p_paragraphs: null, p_failure_kind: "timeout" }],
    ["finish_digest", { p_date: DAY, p_paragraphs: arrayOf("A paragraph."), p_failure_kind: "timeout" }],
    ["finish_digest", { p_date: DAY, p_paragraphs: null, p_failure_kind: null }],
    ["finish_digest", { p_date: "2026-10-14", p_paragraphs: arrayOf("A paragraph."), p_failure_kind: null }],
  ];
  const attempt = async (list: typeof calls) => {
    const before = await everything();
    for (const [fn, args] of list) {
      const res = await nonOperator.rpc(fn, args);
      expect(res.error?.code, `${fn} ${JSON.stringify(args)}`).toBe("42501");
    }
    expect(await everything()).toEqual(before);
  };
  await attempt(calls);

  // A date with no open alert: every alert closed, and the same calls are still refused.
  await query("update public.alerts set status = 'dismissed', closed_at = now() where status = 'open'");
  expect((await query("select 1 from public.alerts where status = 'open'")).length).toBe(0);
  await attempt(calls.filter(([fn]) => fn === "start_digest" || fn === "finish_digest" || fn === "refresh_alerts"));
});
