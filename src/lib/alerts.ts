import { dateInAppZone } from "./app-today";
import type { AlertView } from "./alert-text";
import type { DigestRow } from "./digest";
import { isUrgent } from "./alert-text";
import type { TypedClient } from "./supabase.js";

// Typed read of the open alerts. Like pricing.ts, it throws on error and
// computes nothing: the watch stored every figure, and this only parses them
// into AlertView for src/lib/alert-text.ts to word.

export interface OpenAlert {
  id: string;
  urgent: boolean;
  view: AlertView;
}

const COLUMNS =
  "id, type, facts, code, description, lot_number, received_date, receipt_seq, vendor_name, batch_number, production_date, produced_seq, created_at";

interface AlertRow {
  id: string | null;
  type: string | null;
  facts: unknown;
  code: string | null;
  description: string | null;
  lot_number: string | null;
  received_date: string | null;
  receipt_seq: number | null;
  vendor_name: string | null;
  batch_number: string | null;
  production_date: string | null;
  produced_seq: number | null;
  created_at: string | null;
}

class Facts {
  constructor(private readonly facts: Record<string, unknown>) {}

  number(key: string): number {
    const value = this.facts[key];
    if (typeof value !== "number") throw new Error(`listOpenAlerts failed: fact ${key} is not a number`);
    return value;
  }

  text(key: string): string {
    const value = this.facts[key];
    if (typeof value !== "string") throw new Error(`listOpenAlerts failed: fact ${key} is not text`);
    return value;
  }

  action(): "raise" | "lower" {
    const value = this.text("price_action");
    if (value !== "raise" && value !== "lower") throw new Error("listOpenAlerts failed: unknown price action");
    return value;
  }
}

function present<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`listOpenAlerts failed: ${what} is missing`);
  return value;
}

function parseView(row: AlertRow): AlertView {
  if (typeof row.facts !== "object" || row.facts === null || Array.isArray(row.facts)) {
    throw new Error("listOpenAlerts failed: an alert has no facts");
  }
  const facts = new Facts(row.facts as Record<string, unknown>);
  const subject = { code: present(row.code, "code"), description: present(row.description, "description") };
  switch (row.type) {
    case "margin_below_target":
      return {
        ...subject,
        type: "margin_below_target",
        listPrice: facts.number("list_price"),
        marginAtList: facts.number("margin_at_list"),
        targetMargin: facts.number("target_margin"),
        costPerLb: facts.number("cost_per_lb"),
        suggestedListPrice: facts.number("suggested_list_price"),
        priceAction: facts.action(),
      };
    case "price_stale":
      return {
        ...subject,
        type: "price_stale",
        listPrice: facts.number("list_price"),
        // The watch stores the change time as UTC ISO text; the sentence names its date in the app's time zone.
        changedOn: dateInAppZone(facts.text("changed_at")),
        costThen: facts.number("cost_then"),
        costPerLb: facts.number("cost_per_lb"),
        drift: facts.number("drift"),
        suggestedListPrice: facts.number("suggested_list_price"),
        priceAction: facts.action(),
      };
    case "cost_anomaly":
      return {
        ...subject,
        type: "cost_anomaly",
        lotNumber: present(row.lot_number, "lot number"),
        vendorName: present(row.vendor_name, "vendor name"),
        receivedDate: facts.text("received_date"),
        unitCost: facts.number("unit_cost"),
        usualCost: facts.number("usual_cost"),
        change: facts.number("change"),
        referenceCount: facts.number("reference_count"),
      };
    case "yield_anomaly":
      return {
        ...subject,
        type: "yield_anomaly",
        batchNumber: present(row.batch_number, "batch number"),
        productionDate: facts.text("production_date"),
        rawLbsIn: facts.number("raw_lbs_in"),
        finishedLbsOut: facts.number("finished_lbs_out"),
        shrink: facts.number("shrink"),
        usualShrink: facts.number("usual_shrink"),
        shrinkUsed: facts.number("shrink_used"),
      };
    case "low_stock":
      return {
        ...subject,
        type: "low_stock",
        onHand: facts.number("on_hand"),
        dailyUse: facts.number("daily_use"),
        daysLeft: facts.number("days_left"),
        orderLbs: facts.number("order_lbs"),
      };
    default:
      throw new Error("listOpenAlerts failed: unknown alert type");
  }
}

// Alert order, after urgent first: alerts created together by type in this order.
const TYPE_RANK: Record<AlertView["type"], number> = {
  margin_below_target: 0,
  cost_anomaly: 1,
  yield_anomaly: 2,
  low_stock: 3,
  price_stale: 4,
};

// Oldest first within a type: lots by received date then entry order, batches by
// production date then entry order. The other types have one alert per product.
function subjectOrder(a: AlertRow, b: AlertRow): number {
  const byDate = (a.received_date ?? a.production_date ?? "").localeCompare(b.received_date ?? b.production_date ?? "");
  if (byDate !== 0) return byDate;
  return (a.receipt_seq ?? a.produced_seq ?? 0) - (b.receipt_seq ?? b.produced_seq ?? 0);
}

// The open alerts in the spec's alert order: urgent first; within each, newest
// creation first; alerts created together by code order of their product (the
// database sorts the text), then by type, then by subject, oldest first.
export async function listOpenAlerts(client: TypedClient): Promise<OpenAlert[]> {
  const { data, error } = await client
    .from("v_alerts")
    .select(COLUMNS)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .order("code");
  if (error) throw new Error(`listOpenAlerts failed: ${error.message}`);

  // The database ordered by creation time and code. Rows that share both are
  // ordered here by type, then subject; the sort is stable for everything else.
  const rows = (data as AlertRow[]).map((row) => ({ row, view: parseView(row) }));
  const ordered: typeof rows = [];
  for (let start = 0; start < rows.length; ) {
    let end = start + 1;
    while (
      end < rows.length &&
      rows[end]?.row.created_at === rows[start]?.row.created_at &&
      rows[end]?.row.code === rows[start]?.row.code
    ) {
      end += 1;
    }
    const run = rows.slice(start, end);
    run.sort((a, b) => TYPE_RANK[a.view.type] - TYPE_RANK[b.view.type] || subjectOrder(a.row, b.row));
    ordered.push(...run);
    start = end;
  }

  const alerts = ordered.map(({ row, view }) => ({ id: present(row.id, "id"), urgent: isUrgent(view), view }));
  return [...alerts.filter((alert) => alert.urgent), ...alerts.filter((alert) => !alert.urgent)];
}

// Today's digest row, or null when the day has none. Like listOpenAlerts, it
// throws on error.
export async function getDigest(client: TypedClient, date: string): Promise<DigestRow | null> {
  const { data, error } = await client
    .from("alert_digests")
    .select("status, paragraphs, failure_kind, claimed_at")
    .eq("digest_date", date)
    .maybeSingle();
  if (error) throw new Error(`getDigest failed: ${error.message}`);
  if (!data) return null;
  if (data.status !== "writing" && data.status !== "written" && data.status !== "failed") {
    throw new Error("getDigest failed: unknown digest status");
  }
  return { status: data.status, paragraphs: data.paragraphs, failureKind: data.failure_kind, claimedAt: data.claimed_at };
}
