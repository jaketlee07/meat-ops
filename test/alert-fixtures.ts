import {
  callAsOperator,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  VENDOR_ID,
  type OpCall,
} from "./db.js";

// The alerts spec's "five-alert fixture": one watch leaves exactly one open
// alert of each type. Shared by the Vitest and Playwright suites. Call it after
// resetTestData. Everything but the extra master data (two raw/finished
// products below) goes through the operations and set_list_price.
//
//   cost       RAW-TOM: receipts of 1,000 lbs at 1.60, 1.68, 1.70, and 1.64 on
//              2026-10-01 to 2026-10-04, then 5,000 lbs at 1.90 on 2026-10-05.
//   margin     502: a 20% target and a 2.68 list price.
//   yield      502: a measured batch of 1,000 raw lbs to 700 finished lbs on
//              2026-10-06.
//   price      503, a second finished product from RAW-TOM with no fees: its
//              list price is set after the first four receipts.
//   low stock  RAW-BEEF: one 2,000 lb receipt, and 601 draws 1,800 lbs of it
//              on 2026-10-10.
//
// Importing vitest outside its runner throws, and the browser suite imports
// this file, so `expect` loads when a check runs.

export const ALERT_TYPES = [
  "margin_below_target",
  "cost_anomaly",
  "yield_anomaly",
  "low_stock",
  "price_stale",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const FIVE_ALERT_TODAY = "2026-10-13";

export const RAW_BEEF_ID = "88888888-8888-8888-8888-888888888888";
export const PROD_503_ID = "99999999-9999-9999-9999-999999999993";
export const PROD_601_ID = "99999999-9999-9999-9999-999999999996";

export interface AlertSubject {
  productId: string;
  lotId: string | null;
  batchId: string | null;
}

export interface FiveAlertFixture {
  today: string;
  // Where each type's alert will sit once a watch has run.
  subjects: Record<AlertType, AlertSubject>;
}

// A date `days` after (or before, when negative) an ISO date.
function shifted(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

async function run(call: OpCall): Promise<string> {
  const outcome = await callAsOperator(call);
  if (!outcome.ok) throw new Error(`${call.fn}: ${outcome.error}`);
  return idOf(outcome);
}

// With `watch: false` the data is built and no watch runs, for a test that
// changes something before the first watch. Otherwise the fixture runs its
// first watch and asserts it left exactly one open alert of each type.
// `today` (default 2026-10-13) is the watch's today; every date above moves
// with it, so the browser suite can build the fixture for the app's real today.
export async function buildFiveAlertFixture(
  opts: { watch?: boolean; today?: string } = {},
): Promise<FiveAlertFixture> {
  const today = opts.today ?? FIVE_ALERT_TODAY;
  // Offsets from 2026-10-13, the date the comments above and the spec use.
  const on = (month: number, day: number) =>
    shifted(today, Math.round((Date.UTC(2026, month - 1, day) - Date.UTC(2026, 9, 13)) / 86_400_000));
  await query(
    `insert into products(id, code, description, species, kind) values
       ('${RAW_BEEF_ID}', 'RAW-BEEF', 'Beef Trim (raw)', 'Beef', 'raw');
     insert into products(id, code, description, species, kind, raw_product_id, shrink_pct) values
       ('${PROD_503_ID}', '503', 'Seasoned Turkey Drums', 'Turkey', 'finished', '${RAW_TOM_ID}', 0.2000),
       ('${PROD_601_ID}', '601', 'Ground Beef', 'Beef', 'finished', '${RAW_BEEF_ID}', 0.1000)`,
  );

  const costs = ["1.60", "1.68", "1.70", "1.64"];
  for (const [i, cost] of costs.entries()) {
    await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, cost, on(10, i + 1)));
  }
  // The price alert's product takes its sheet price now, before the cost moves.
  const [sheet] = await query<{ price: string }>(
    "select suggested_list_price::text as price from public.v_product_pricing where product_id = $1",
    [PROD_503_ID],
  );
  await run({ fn: "set_list_price", args: { p_product_id: PROD_503_ID, p_price_per_lb: sheet?.price ?? null } });

  const costLotId = await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, "1.90", on(10, 5)));
  await run({ fn: "set_target_margin", args: { p_product_id: PROD_502_ID, p_target_percent: 20 } });
  await run({ fn: "set_list_price", args: { p_product_id: PROD_502_ID, p_price_per_lb: 2.68 } });
  const batchId = await run(produceCall(PROD_502_ID, 1000, 700, on(10, 6)));

  await run(receiveCall(RAW_BEEF_ID, VENDOR_ID, 2000, "2.00", on(10, 5)));
  await run(produceCall(PROD_601_ID, 1800, null, on(10, 10)));

  const fixture: FiveAlertFixture = {
    today,
    subjects: {
      margin_below_target: { productId: PROD_502_ID, lotId: null, batchId: null },
      cost_anomaly: { productId: RAW_TOM_ID, lotId: costLotId, batchId: null },
      yield_anomaly: { productId: PROD_502_ID, lotId: null, batchId: batchId },
      low_stock: { productId: RAW_BEEF_ID, lotId: null, batchId: null },
      price_stale: { productId: PROD_503_ID, lotId: null, batchId: null },
    },
  };

  if (opts.watch !== false) {
    const expect = (await import("vitest")).expect;
    const watched = await callAsOperator({ fn: "refresh_alerts", args: { p_today: fixture.today } });
    expect(watched.error, "the fixture's first watch").toBeUndefined();
    const rows = await query<{ type: string; status: string }>(
      "select type, status from public.alerts order by type",
    );
    expect(rows, "one open alert of each type").toEqual(
      [...ALERT_TYPES].sort().map((type) => ({ type, status: "open" })),
    );
  }
  return fixture;
}
