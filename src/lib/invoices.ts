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
