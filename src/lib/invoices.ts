import type { Catalog } from "./invoice-reading";
import { listActiveRawProducts, listVendors } from "./receiving";
import type { TypedClient } from "./supabase";

// Typed reads for the invoices screen. Like receiving.ts, every read throws on
// error and returns rows as the database delivered them. Nothing here writes.

// What a read sends the model: the active raw products and the vendors, as
// receiving's pickers list them. The ids stay on this side; requestParams drops them.
export async function readCatalog(client: TypedClient): Promise<Catalog> {
  const [products, vendors] = await Promise.all([listActiveRawProducts(client), listVendors(client)]);
  return {
    products: products.map(({ id, code, description }) => ({ id, code, description })),
    vendors: vendors.map(({ id, name }) => ({ id, name })),
  };
}

export interface WaitingDraft {
  id: string;
  source: "photo" | "text";
  // The device's date sent with the read, shown through format.ts.
  capturedOn: string;
  lineCount: number;
  firstWords: string;
}

// PostgREST caps every read at 1,000 rows without saying so, so the list is read
// in pages. Each draft brings its lines, so a page is kept small.
const PAGE = 100;

// The waiting drafts, newest capture time first.
export async function listWaitingDrafts(client: TypedClient): Promise<WaitingDraft[]> {
  const drafts: WaitingDraft[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from("import_drafts")
      .select("id, source, captured_on, import_draft_lines(line_no, words)")
      .eq("status", "pending")
      .order("captured_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listWaitingDrafts failed: ${error.message}`);
    for (const draft of data) {
      const first = draft.import_draft_lines.reduce<{ line_no: number; words: string | null } | null>(
        (best, line) => (best === null || line.line_no < best.line_no ? line : best),
        null,
      );
      drafts.push({
        id: draft.id,
        source: draft.source === "photo" ? "photo" : "text",
        capturedOn: draft.captured_on,
        lineCount: draft.import_draft_lines.length,
        firstWords: first?.words ?? "",
      });
    }
    if (data.length < PAGE) return drafts;
  }
}

// The shape Postgres writes a uuid in. The review and the photo address check a
// draft id with it before any database call, so a malformed id is never sent.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(text: string): boolean {
  return UUID.test(text);
}

export interface DraftLine {
  id: string;
  lineNo: number;
  // Null only after a discard.
  words: string | null;
  productId: string | null;
  vendorId: string | null;
  // The stored numbers as the owner reads them in a field: 5000.000 is "5000", 1.6800 is "1.68".
  weightLbs: string | null;
  unitCost: string | null;
  receivedDate: string | null;
  // The lot a saved line made.
  lotNumber: string | null;
}

export interface Draft {
  id: string;
  source: "photo" | "text";
  status: "pending" | "confirmed" | "discarded";
  captureText: string | null;
  // Whether a photo is stored. The bytes are never read here; the photo address serves them.
  hasPhoto: boolean;
  lines: DraftLine[];
}

// A stored number as field text, text to text, so no JavaScript number carries a
// weight or a cost: trailing zeros after the point go.
function fieldText(stored: string | null): string | null {
  return stored !== null && stored.includes(".") ? stored.replace(/\.?0+$/, "") : stored;
}

// The draft and its lines in line order, or null when no row has the id. The
// photo's bytes stay out of this read: capture_image is selected only by getDraftPhoto.
export async function getDraft(client: TypedClient, id: string): Promise<Draft | null> {
  // A draft holds at most 30 lines, so the 1,000-row cap never applies.
  const { data, error } = await client
    .from("import_drafts")
    .select(
      "id, source, status, capture_text, capture_image_type, import_draft_lines(id, line_no, words, product_id, vendor_id, weight_lbs::text, unit_cost::text, received_date, lots(lot_number))",
    )
    .eq("id", id)
    .order("line_no", { referencedTable: "import_draft_lines" })
    .maybeSingle();
  if (error) throw new Error(`getDraft failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    source: data.source === "photo" ? "photo" : "text",
    status: data.status === "confirmed" || data.status === "discarded" ? data.status : "pending",
    captureText: data.capture_text,
    hasPhoto: data.capture_image_type !== null,
    lines: data.import_draft_lines.map((line) => ({
      id: line.id,
      lineNo: line.line_no,
      words: line.words,
      productId: line.product_id,
      vendorId: line.vendor_id,
      weightLbs: fieldText(line.weight_lbs),
      unitCost: fieldText(line.unit_cost),
      receivedDate: line.received_date,
      lotNumber: line.lots?.lot_number ?? null,
    })),
  };
}

export interface DraftPhoto {
  bytes: Uint8Array;
  mediaType: string;
}

// The stored photo, or null when no row has the id or the draft holds no photo.
// PostgREST sends a bytea column as a "\x..." hex string.
export async function getDraftPhoto(client: TypedClient, id: string): Promise<DraftPhoto | null> {
  const { data, error } = await client
    .from("import_drafts")
    .select("capture_image, capture_image_type")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getDraftPhoto failed: ${error.message}`);
  if (!data?.capture_image || !data.capture_image_type) return null;
  return { bytes: Buffer.from(data.capture_image.replace(/^\\x/, ""), "hex"), mediaType: data.capture_image_type };
}
