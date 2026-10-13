import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDraft, getDraftPhoto, isUuid, listWaitingDrafts } from "../src/lib/invoices.js";
import {
  confirmImportDraft,
  createImportDraft,
  discardImportDraft,
  RpcError,
  type NewDraft,
  type NewDraftLine,
} from "../src/lib/rpc.js";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  closePool,
  query,
  RAW_TOM_ID,
  resetTestData,
  seedInvoiceFixture,
  VENDOR_ID,
} from "./db.js";
import { signInNonOperator, signInOperator } from "./users.js";

let operator: TypedClient;
let nonOperator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
  nonOperator = await signInNonOperator();
});
beforeEach(async () => {
  await resetTestData();
  await seedInvoiceFixture();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

const line = (words: string, over: Partial<NewDraftLine> = {}): NewDraftLine => ({
  words,
  productId: RAW_TOM_ID,
  vendorId: VENDOR_ID,
  weightLbs: "5000",
  unitCost: "1.6800",
  receivedDate: "2026-10-01",
  unsure: [],
  ...over,
});

// Bytes that a text column could not hold: a zero, a high byte, and a backslash.
const PHOTO = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x5c, 0x78, 0x41]);

const textDraft = (lines: NewDraftLine[], capturedOn = "2026-10-09"): Promise<{ id: string }> =>
  createImportDraft(operator, { source: "text", text: "typed receipt", capturedOn, model: "claude-opus-5-5", lines });

const photoDraft = (lines: NewDraftLine[]): Promise<{ id: string }> => {
  const draft: NewDraft = {
    source: "photo",
    image: PHOTO,
    imageType: "image/png",
    capturedOn: "2026-10-09",
    model: "claude-opus-5-5",
    lines,
  };
  return createImportDraft(operator, draft);
};

describe("isUuid", () => {
  it("accepts the shape Postgres writes and nothing else", () => {
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
    expect(isUuid("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA")).toBe(true);
    for (const text of ["", "abc", "0000000000000000000000000000000000000", "00000000-0000-0000-0000-00000000000g", " 00000000-0000-0000-0000-000000000000"]) {
      expect(isUuid(text), text).toBe(false);
    }
  });
});

describe("listWaitingDrafts", () => {
  it("lists waiting drafts newest first with their line count and first line's words, as the operator", async () => {
    const oldest = await textDraft([line("FIRST"), line("second")], "2026-10-01");
    const middle = await photoDraft([line("PHOTO WORDS")]);
    const newest = await textDraft([line("NEWEST"), line("b"), line("c")], "2026-10-08");
    expect(await listWaitingDrafts(operator)).toEqual([
      { id: newest.id, source: "text", capturedOn: "2026-10-08", lineCount: 3, firstWords: "NEWEST" },
      { id: middle.id, source: "photo", capturedOn: "2026-10-09", lineCount: 1, firstWords: "PHOTO WORDS" },
      { id: oldest.id, source: "text", capturedOn: "2026-10-01", lineCount: 2, firstWords: "FIRST" },
    ]);
  });

  it("leaves out saved and discarded drafts, and lists nothing for a non-operator", async () => {
    const saved = await textDraft([line("SAVED")]);
    const discarded = await textDraft([line("DISCARDED")]);
    const waiting = await textDraft([line("WAITING")]);
    const [first] = (await getDraft(operator, saved.id))!.lines;
    await confirmImportDraft(operator, saved.id, [
      { lineId: first!.id, productId: RAW_TOM_ID, vendorId: VENDOR_ID, weightLbs: "5000", unitCost: "1.68", receivedDate: "2026-10-01" },
    ]);
    await discardImportDraft(operator, discarded.id);
    expect((await listWaitingDrafts(operator)).map((draft) => draft.id)).toEqual([waiting.id]);
    expect(await listWaitingDrafts(nonOperator)).toEqual([]);
  });
});

describe("getDraft", () => {
  it("returns the draft with its lines in line order and no photo bytes", async () => {
    const created = await photoDraft([
      line("TKY DRUMS 40#"),
      line("blank line", { productId: null, vendorId: null, weightLbs: null, unitCost: null, receivedDate: null }),
      line("<b>9</b>", { weightLbs: "32.5", unitCost: "1.8000" }),
    ]);
    const draft = await getDraft(operator, created.id);
    expect(draft).toMatchObject({
      id: created.id,
      source: "photo",
      status: "pending",
      captureText: null,
      hasPhoto: true,
    });
    expect(draft).not.toHaveProperty("captureImage");
    expect(draft?.lines.map(({ id: _id, ...rest }) => rest)).toEqual([
      {
        lineNo: 1,
        words: "TKY DRUMS 40#",
        productId: RAW_TOM_ID,
        vendorId: VENDOR_ID,
        weightLbs: "5000",
        unitCost: "1.68",
        receivedDate: "2026-10-01",
        lotNumber: null,
      },
      {
        lineNo: 2,
        words: "blank line",
        productId: null,
        vendorId: null,
        weightLbs: null,
        unitCost: null,
        receivedDate: null,
        lotNumber: null,
      },
      {
        lineNo: 3,
        words: "<b>9</b>",
        productId: RAW_TOM_ID,
        vendorId: VENDOR_ID,
        weightLbs: "32.5",
        unitCost: "1.8",
        receivedDate: "2026-10-01",
        lotNumber: null,
      },
    ]);
  });

  it("returns a text draft's typed text", async () => {
    const created = await textDraft([line("A")]);
    expect(await getDraft(operator, created.id)).toMatchObject({ source: "text", captureText: "typed receipt", hasPhoto: false });
  });

  it("returns null for an id with no draft, and for a non-operator", async () => {
    const created = await textDraft([line("A")]);
    expect(await getDraft(operator, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getDraft(nonOperator, created.id)).toBeNull();
  });

  it("gives a saved draft's lines their lot numbers and an unticked line none", async () => {
    const created = await textDraft([line("ONE"), line("TWO"), line("THREE")]);
    const lines = (await getDraft(operator, created.id))!.lines;
    const lots = await confirmImportDraft(operator, created.id, [
      { lineId: lines[0]!.id, productId: RAW_TOM_ID, vendorId: VENDOR_ID, weightLbs: "5000", unitCost: "1.68", receivedDate: "2026-10-01" },
      { lineId: lines[2]!.id, productId: RAW_TOM_ID, vendorId: VENDOR_ID, weightLbs: "3000", unitCost: "1.80", receivedDate: "2026-10-05" },
    ]);
    expect(lots.map((lot) => lot.lot_number)).toHaveLength(2);
    const saved = await getDraft(operator, created.id);
    expect(saved?.status).toBe("confirmed");
    expect(saved?.lines.map((l) => l.lotNumber)).toEqual([lots[0]!.lot_number, null, lots[1]!.lot_number]);
    // The saved draft keeps its words as the record behind its lots.
    expect(saved?.lines.map((l) => l.words)).toEqual(["ONE", "TWO", "THREE"]);
  });

  it("returns a discarded draft with no text, no photo, and no words", async () => {
    const created = await photoDraft([line("ONE")]);
    await discardImportDraft(operator, created.id);
    const draft = await getDraft(operator, created.id);
    expect(draft).toMatchObject({ status: "discarded", captureText: null, hasPhoto: false });
    expect(draft?.lines.map((l) => l.words)).toEqual([null]);
  });
});

describe("getDraftPhoto", () => {
  it("returns the stored bytes and media type as the operator", async () => {
    const created = await photoDraft([line("A")]);
    const photo = await getDraftPhoto(operator, created.id);
    expect(photo?.mediaType).toBe("image/png");
    expect([...(photo?.bytes ?? [])]).toEqual([...PHOTO]);
    // The same bytes the database holds.
    const [row] = await query<{ hex: string }>("select encode(capture_image, 'hex') as hex from import_drafts where id = $1", [created.id]);
    expect(Buffer.from(photo?.bytes ?? []).toString("hex")).toBe(row?.hex);
  });

  it("returns null for a text draft, an unknown id, a discarded draft, and a non-operator", async () => {
    const text = await textDraft([line("A")]);
    const photo = await photoDraft([line("A")]);
    const gone = await photoDraft([line("A")]);
    await discardImportDraft(operator, gone.id);
    expect(await getDraftPhoto(operator, text.id)).toBeNull();
    expect(await getDraftPhoto(operator, "00000000-0000-0000-0000-000000000000")).toBeNull();
    expect(await getDraftPhoto(operator, gone.id)).toBeNull();
    expect(await getDraftPhoto(nonOperator, photo.id)).toBeNull();
  });
});

describe("the write wrappers", () => {
  it("refuse with the engine's text and its code, as the others do", async () => {
    const created = await textDraft([line("A")]);
    await expect(confirmImportDraft(operator, created.id, [])).rejects.toMatchObject({
      name: "RpcError",
      message: "confirmImportDraft failed: confirm_import_draft: no line to save",
    });
    await expect(discardImportDraft(operator, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      "discardImportDraft failed: discard_import_draft: draft 00000000-0000-0000-0000-000000000000 not found",
    );
    const refused = await discardImportDraft(nonOperator, created.id).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(RpcError);
    expect((refused as RpcError).code).toBe("42501");
  });
});
