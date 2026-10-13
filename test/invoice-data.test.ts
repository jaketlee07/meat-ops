import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { listRecentReceipts } from "../src/lib/receiving.js";
import { createTypedClient, type TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  BELMONT_ID,
  callAsOperator,
  closePool,
  idOf,
  PROD_502_ID,
  query,
  RAW_CHK_ID,
  RAW_OLD_ID,
  RAW_TOM_ID,
  raceCalls,
  receiveCall,
  resetTestData,
  seedInvoiceFixture,
  tableFingerprints,
  VENDOR_ID,
  voidReceiptCall,
  type Arg,
  type OpCall,
} from "./db.js";
import { resolveStackEnv } from "./env.js";
import { signInNonOperator, signInOperator } from "./users.js";

type Loose = SupabaseClient;
const env = resolveStackEnv();
let operator: TypedClient;
let nonOperator: TypedClient;
let anon: Loose;
let service: Loose;

beforeAll(async () => {
  operator = await signInOperator();
  nonOperator = await signInNonOperator();
  anon = createTypedClient(env.apiUrl, env.anonKey) as unknown as Loose;
  service = createTypedClient(env.apiUrl, env.serviceRoleKey) as unknown as Loose;
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

const ZERO_ID = "00000000-0000-0000-0000-000000000000";
const TEXT = "5000 lbs RAW-TOM from Reyes Meats at 1.68 on Oct 1, 3000 at 1.80 on Oct 5";

interface DraftLine {
  words?: string | null;
  product_id?: string | null;
  vendor_id?: string | null;
  weight_lbs?: string | null;
  unit_cost?: string | null;
  received_date?: string | null;
  unsure?: unknown;
}

const draftLine = (over: DraftLine = {}): DraftLine => ({
  words: "TKY DRUMS 40#",
  product_id: RAW_TOM_ID,
  vendor_id: VENDOR_ID,
  weight_lbs: "5000",
  unit_cost: "1.68",
  received_date: "2026-10-01",
  unsure: [],
  ...over,
});

const createCall = (lines: unknown, over: Record<string, Arg> = {}): OpCall => ({
  fn: "create_import_draft",
  args: {
    p_source: "text",
    p_capture_text: TEXT,
    p_captured_on: "2026-10-09",
    p_model: "claude-opus-5-5",
    p_lines: JSON.stringify(lines),
    ...over,
  },
});

const photoCall = (lines: unknown, over: Record<string, Arg> = {}): OpCall =>
  createCall(lines, {
    p_source: "photo",
    p_capture_text: null,
    p_capture_image: "\\xffd8ffe0",
    p_capture_image_type: "image/jpeg",
    ...over,
  });

async function makeDraft(lines: unknown = [draftLine(), draftLine({ weight_lbs: "3000" })], call = createCall): Promise<string> {
  const created = await callAsOperator(call(lines));
  expect(created.error).toBeUndefined();
  return idOf(created);
}

interface LineRow {
  id: string;
  line_no: number;
  words: string | null;
  product_id: string | null;
  vendor_id: string | null;
  weight_lbs: string | null;
  unit_cost: string | null;
  received_date: string | null;
  unsure_fields: string[];
  status: string;
  lot_id: string | null;
}

const linesOf = (draftId: string) =>
  query<LineRow>(
    `select id, line_no, words, product_id, vendor_id, weight_lbs::text, unit_cost::text,
            received_date::text, unsure_fields, status, lot_id
     from public.import_draft_lines where import_draft_id = $1 order by line_no`,
    [draftId],
  );

const draftRow = async (draftId: string) =>
  (
    await query<Record<string, unknown>>(
      `select id, source, capture_text, encode(capture_image, 'hex') as image_hex, capture_image_type,
              captured_on::text, captured_at, model, status, settled_at
       from public.import_drafts where id = $1`,
      [draftId],
    )
  )[0];

const given = (lineId: string, over: Record<string, string | null | undefined> = {}) => ({
  line_id: lineId,
  product_id: RAW_TOM_ID,
  vendor_id: VENDOR_ID,
  weight_lbs: "5000",
  unit_cost: "1.68",
  received_date: "2026-10-01",
  ...over,
});

const confirmCall = (draftId: string, lines: unknown): OpCall => ({
  fn: "confirm_import_draft",
  args: { p_draft_id: draftId, p_lines: JSON.stringify(lines) },
});
const discardCall = (draftId: string): OpCall => ({ fn: "discard_import_draft", args: { p_draft_id: draftId } });

// A refusal carries the pattern and leaves every table unchanged.
async function refused(call: OpCall, pattern: RegExp): Promise<void> {
  const before = await tableFingerprints();
  const outcome = await callAsOperator(call);
  expect(outcome.ok, `expected a refusal: ${JSON.stringify(call.args).slice(0, 300)}`).toBe(false);
  expect(outcome.error).toMatch(pattern);
  expect(await tableFingerprints()).toEqual(before);
}

const LEDGER_TABLES = ["lots", "inventory_balances", "lot_adjustments", "production_batches", "production_batch_lots", "finished_goods", "sales", "sale_items"];
const ledgerOnly = (all: Record<string, string>) => Object.fromEntries(LEDGER_TABLES.map((t) => [t, all[t]]));

describe("create_import_draft", () => {
  it("AC-0030: stores one waiting draft with its capture and its lines in the given order", async () => {
    const lines = [
      draftLine({ unsure: ["date"], received_date: null }),
      draftLine({ words: "CHK THIGH", product_id: RAW_CHK_ID, vendor_id: BELMONT_ID, weight_lbs: "12.5", unit_cost: "0.9", unsure: [] }),
    ];
    const textId = await makeDraft(lines);
    const text = await draftRow(textId);
    expect(text).toMatchObject({
      source: "text",
      capture_text: TEXT,
      image_hex: null,
      capture_image_type: null,
      captured_on: "2026-10-09",
      model: "claude-opus-5-5",
      status: "pending",
      settled_at: null,
    });
    const [now] = await query<{ recent: boolean }>("select (captured_at > now() - interval '1 minute') as recent from public.import_drafts where id = $1", [textId]);
    expect(now?.recent).toBe(true);
    expect(await linesOf(textId)).toEqual([
      expect.objectContaining({ line_no: 1, words: "TKY DRUMS 40#", product_id: RAW_TOM_ID, vendor_id: VENDOR_ID, weight_lbs: "5000.000", unit_cost: "1.6800", received_date: null, unsure_fields: ["date"], status: "pending", lot_id: null }),
      expect.objectContaining({ line_no: 2, words: "CHK THIGH", product_id: RAW_CHK_ID, vendor_id: BELMONT_ID, weight_lbs: "12.500", unit_cost: "0.9000", received_date: "2026-10-01", unsure_fields: [], status: "pending", lot_id: null }),
    ]);

    const photoId = await makeDraft([draftLine()], photoCall);
    expect(await draftRow(photoId)).toMatchObject({
      source: "photo",
      capture_text: null,
      image_hex: "ffd8ffe0",
      capture_image_type: "image/jpeg",
      status: "pending",
    });
    // The edges: 30 lines, 2,000 code points of text (more than 2,000 bytes), and 4,194,304 bytes of image.
    expect((await linesOf(await makeDraft(Array.from({ length: 30 }, () => draftLine())))).map((l) => l.line_no)).toEqual(
      Array.from({ length: 30 }, (_, i) => i + 1),
    );
    await makeDraft([draftLine()], (l) => createCall(l, { p_capture_text: "\u{1F600}".repeat(2000) }));
    await makeDraft([draftLine()], (l) => photoCall(l, { p_capture_image: "\\x" + "ab".repeat(4194304), p_capture_image_type: "image/webp" }));
  });

  it("AC-0031: every listed bad input is refused and changes no table", async () => {
    const one = [draftLine()];
    const refuse = refused;
    // Source and capture.
    await refuse(createCall(one, { p_source: "scan" }), /^create_import_draft: source must be photo or text/);
    await refuse(createCall(one, { p_source: null }), /^create_import_draft: source must be photo or text/);
    await refuse(photoCall(one, { p_capture_image: null }), /^create_import_draft: a photo draft needs an image/);
    await refuse(photoCall(one, { p_capture_image: "\\x" + "ab".repeat(4194305) }), /^create_import_draft: image is over 4194304 bytes/);
    for (const type of ["image/gif", "application/pdf", null]) {
      await refuse(photoCall(one, { p_capture_image_type: type }), /^create_import_draft: image type must be/);
    }
    await refuse(createCall(one, { p_capture_text: null }), /^create_import_draft: text is blank/);
    await refuse(createCall(one, { p_capture_text: "  \n " }), /^create_import_draft: text is blank/);
    await refuse(createCall(one, { p_capture_text: "a".repeat(2001) }), /^create_import_draft: text is over 2000 characters/);
    // Lines.
    await refuse(createCall([]), /^create_import_draft: a draft needs at least 1 line/);
    await refuse(createCall(null), /^create_import_draft: a draft needs at least 1 line/);
    await refuse(createCall(Array.from({ length: 31 }, () => draftLine())), /^create_import_draft: a draft holds at most 30 lines/);
    await refuse(createCall([draftLine({ words: "   " })]), /^create_import_draft: line 1 has no words/);
    await refuse(createCall([draftLine({ words: null })]), /^create_import_draft: line 1 has no words/);
    await refuse(createCall([draftLine({ words: "w".repeat(201) })]), /^create_import_draft: line 1 words are over 200 characters/);
    await refuse(createCall([draftLine(), draftLine({ product_id: RAW_OLD_ID })]), /^create_import_draft: line 2 product .* is not an active raw product/);
    await refuse(createCall([draftLine({ product_id: PROD_502_ID })]), /^create_import_draft: line 1 product .* is not an active raw product/);
    await refuse(createCall([draftLine({ product_id: ZERO_ID })]), /^create_import_draft: line 1 product .* is not an active raw product/);
    await refuse(createCall([draftLine({ vendor_id: ZERO_ID })]), /^create_import_draft: line 1 vendor .* not found/);
    for (const weight of ["0", "-1", "0.000"]) {
      await refuse(createCall([draftLine(), draftLine(), draftLine({ weight_lbs: weight })]), /^create_import_draft: line 3 weight must be above 0/);
    }
    await refuse(createCall([draftLine(), draftLine(), draftLine({ weight_lbs: "1.2345" })]), /^create_import_draft: line 3 weight has more than 3 decimal places/);
    await refuse(createCall([draftLine({ weight_lbs: "5.0000" })]), /^create_import_draft: line 1 weight has more than 3 decimal places/);
    await refuse(createCall([draftLine({ weight_lbs: "5,000" })]), /^create_import_draft: line 1 weight is not a number/);
    await refuse(createCall([draftLine({ unit_cost: "-0.01" })]), /^create_import_draft: line 1 cost must be 0 or more/);
    await refuse(createCall([draftLine({ unit_cost: "1.23456" })]), /^create_import_draft: line 1 cost has more than 4 decimal places/);
    await refuse(createCall([draftLine({ unit_cost: "$1.68" })]), /^create_import_draft: line 1 cost is not a number/);
    await refuse(createCall([draftLine({ received_date: "2026-02-30" })]), /^create_import_draft: line 1 date is not a valid date/);
    await refuse(createCall([draftLine({ unsure: ["price"] })]), /^create_import_draft: line 1 unsure names a field other than/);
    await refuse(createCall([draftLine({ unsure: [3] })]), /^create_import_draft: line 1 unsure names a field other than/);
    // A cost of 0 and a weight of 0.001 are the edges that stay allowed.
    await makeDraft([draftLine({ weight_lbs: "0.001", unit_cost: "0" })]);

    // A non-operator: SQLSTATE 42501, nothing written.
    const before = await tableFingerprints();
    const res = await (nonOperator as unknown as Loose).rpc("create_import_draft", {
      p_source: "text",
      p_capture_text: TEXT,
      p_captured_on: "2026-10-09",
      p_model: "m",
      p_lines: one,
    });
    expect(res.error?.code).toBe("42501");
    expect(await tableFingerprints()).toEqual(before);
  });

  it("AC-0047: stores a line whose drafted fields are all empty", async () => {
    const id = await makeDraft([
      { words: "????", product_id: null, vendor_id: null, weight_lbs: null, unit_cost: null, received_date: null, unsure: ["product", "vendor", "weight", "cost", "date"] },
      { words: "bare" },
    ]);
    expect(await linesOf(id)).toEqual([
      expect.objectContaining({ words: "????", product_id: null, vendor_id: null, weight_lbs: null, unit_cost: null, received_date: null, unsure_fields: ["product", "vendor", "weight", "cost", "date"], status: "pending" }),
      expect.objectContaining({ words: "bare", product_id: null, vendor_id: null, weight_lbs: null, unit_cost: null, received_date: null, unsure_fields: [], status: "pending" }),
    ]);
  });

  it("stores and saves the number texts Receiving accepts, .5 and 5000., exactly", async () => {
    const id = await makeDraft([
      draftLine({ weight_lbs: ".5", unit_cost: "5000." }),
      draftLine({ weight_lbs: "5000.", unit_cost: ".5", received_date: "2026-10-02" }),
    ]);
    const lines = await linesOf(id);
    expect(lines.map((l) => [l.weight_lbs, l.unit_cost])).toEqual([
      ["0.500", "5000.0000"],
      ["5000.000", "0.5000"],
    ]);
    // The text is still refused when it has no digit or a second point.
    await refused(createCall([draftLine({ weight_lbs: "." })]), /^create_import_draft: line 1 weight is not a number/);
    await refused(createCall([draftLine({ unit_cost: "1.2.3" })]), /^create_import_draft: line 1 cost is not a number/);

    const saved = await callAsOperator(
      confirmCall(id, [
        given(lines[0]!.id, { weight_lbs: ".5", unit_cost: "5000." }),
        given(lines[1]!.id, { weight_lbs: "5000.", unit_cost: ".5", received_date: "2026-10-02" }),
      ]),
    );
    expect(saved.error).toBeUndefined();
    const lots = await query<{ weight_lbs: string; unit_cost: string }>(
      "select weight_lbs::text, unit_cost::text from public.lots order by received_date",
    );
    expect(lots).toEqual([
      { weight_lbs: "0.500", unit_cost: "5000.0000" },
      { weight_lbs: "5000.000", unit_cost: "0.5000" },
    ]);
  });
});

describe("confirm_import_draft", () => {
  it("AC-0032: saves each given line as one lot, skips the rest, and settles the draft", async () => {
    const draftId = await makeDraft([
      draftLine(),
      draftLine({ words: "skip me" }),
      draftLine({ words: "CHK", product_id: RAW_CHK_ID, vendor_id: BELMONT_ID, weight_lbs: "40", unit_cost: "0.99" }),
    ]);
    const lines = await linesOf(draftId);
    const saved = await callAsOperator(
      confirmCall(draftId, [
        given(lines[0]!.id, { weight_lbs: "4999.5", unit_cost: "1.7", received_date: "2026-10-02" }),
        given(lines[2]!.id, { product_id: RAW_CHK_ID, vendor_id: BELMONT_ID, weight_lbs: "40", unit_cost: "0.99", received_date: "2026-10-03" }),
      ]),
    );
    expect(saved.error).toBeUndefined();
    const lots = await query<{ id: string; product_id: string; vendor_id: string; weight_lbs: string; unit_cost: string; received_date: string }>(
      "select id, product_id, vendor_id, weight_lbs::text, unit_cost::text, received_date::text from public.lots order by received_date",
    );
    expect(lots).toEqual([
      expect.objectContaining({ product_id: RAW_TOM_ID, vendor_id: VENDOR_ID, weight_lbs: "4999.500", unit_cost: "1.7000", received_date: "2026-10-02" }),
      expect.objectContaining({ product_id: RAW_CHK_ID, vendor_id: BELMONT_ID, weight_lbs: "40.000", unit_cost: "0.9900", received_date: "2026-10-03" }),
    ]);
    expect(saved.rows?.map((r) => r.id)).toEqual(lots.map((l) => l.id));
    const after = await linesOf(draftId);
    expect(after.map((l) => [l.status, l.lot_id])).toEqual([
      ["saved", lots[0]!.id],
      ["skipped", null],
      ["saved", lots[1]!.id],
    ]);
    const draft = await draftRow(draftId);
    expect(draft?.status).toBe("confirmed");
    expect(draft?.settled_at).not.toBeNull();
  });

  it("AC-0033: a refused line names its number and rolls back every lot, line, draft, and balance", async () => {
    const draftId = await makeDraft([draftLine(), draftLine({ words: "CHK", product_id: RAW_CHK_ID, vendor_id: BELMONT_ID })]);
    const lines = await linesOf(draftId);
    // RAW-TOM enters first (lower id) and succeeds; RAW-CHK is refused after it.
    await query("update public.products set active = false where id = $1", [RAW_CHK_ID]);
    await refused(
      confirmCall(draftId, [given(lines[0]!.id), given(lines[1]!.id, { product_id: RAW_CHK_ID, vendor_id: BELMONT_ID })]),
      /^line 2: receive_lot: product .* is inactive/,
    );
    expect(await query("select 1 from public.lots")).toEqual([]);
    expect((await draftRow(draftId))?.status).toBe("pending");
    expect((await linesOf(draftId)).map((l) => l.status)).toEqual(["pending", "pending"]);
    // A refusal on the first line named by its number too.
    await refused(confirmCall(draftId, [given(lines[0]!.id, { weight_lbs: "-4" })]), /^line 1: receive_lot: /);
  });

  it("AC-0034: every listed bad input is refused and changes no table", async () => {
    const draftId = await makeDraft();
    const otherId = await makeDraft();
    const lines = await linesOf(draftId);
    const other = await linesOf(otherId);
    const ok = given(lines[0]!.id);

    await refused(confirmCall(ZERO_ID, [ok]), /^confirm_import_draft: draft 00000000-0000-0000-0000-000000000000 not found/);
    await refused(confirmCall(draftId, [given(other[0]!.id)]), new RegExp(`^confirm_import_draft: line ${other[0]!.id} is not in this draft`));
    await refused(confirmCall(draftId, [ok, ok]), new RegExp(`^confirm_import_draft: line ${lines[0]!.id} is given twice`));
    await refused(confirmCall(draftId, []), /^confirm_import_draft: no line to save/);
    await refused(confirmCall(draftId, null), /^confirm_import_draft: no line to save/);
    await refused(confirmCall(draftId, [{ ...ok, line_id: undefined }]), /^confirm_import_draft: line 1 is missing line_id/);
    for (const field of ["product_id", "vendor_id", "weight_lbs", "unit_cost", "received_date"]) {
      await refused(confirmCall(draftId, [{ ...ok, [field]: null }]), new RegExp(`^confirm_import_draft: line 1 is missing ${field}`));
      await refused(confirmCall(draftId, [{ ...ok, [field]: undefined }]), new RegExp(`^confirm_import_draft: line 1 is missing ${field}`));
    }

    const confirmedId = await makeDraft();
    const confirmedLines = await linesOf(confirmedId);
    expect((await callAsOperator(confirmCall(confirmedId, [given(confirmedLines[0]!.id)]))).error).toBeUndefined();
    await refused(confirmCall(confirmedId, [given(confirmedLines[1]!.id)]), new RegExp(`^confirm_import_draft: draft ${confirmedId} is already saved or discarded`));

    const discardedId = await makeDraft();
    const discardedLines = await linesOf(discardedId);
    expect((await callAsOperator(discardCall(discardedId))).error).toBeUndefined();
    await refused(confirmCall(discardedId, [given(discardedLines[0]!.id)]), new RegExp(`^confirm_import_draft: draft ${discardedId} is already saved or discarded`));

    const before = await tableFingerprints();
    const res = await (nonOperator as unknown as Loose).rpc("confirm_import_draft", { p_draft_id: draftId, p_lines: [ok] });
    expect(res.error?.code).toBe("42501");
    expect(await tableFingerprints()).toEqual(before);
  });

  it("AC-0036: two saves of one draft at the same time save its lines once", async () => {
    const draftId = await makeDraft();
    const lines = await linesOf(draftId);
    const call = confirmCall(draftId, [given(lines[0]!.id), given(lines[1]!.id, { weight_lbs: "3000", unit_cost: "1.80" })]);
    const [first, second] = await raceCalls(call, call);
    expect(first.ok).toBe(true);
    expect(second.waitedOn, "the second call waited on the draft row").toBeDefined();
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(new RegExp(`^confirm_import_draft: draft ${draftId} is already saved or discarded`));
    expect(await query("select 1 from public.lots")).toHaveLength(2);
  });

  it("AC-0046: lots of one product enter in line order whatever order the lines are given", async () => {
    const draftId = await makeDraft([
      draftLine({ weight_lbs: "10" }),
      draftLine({ words: "CHK", product_id: RAW_CHK_ID, vendor_id: BELMONT_ID, weight_lbs: "20" }),
      draftLine({ weight_lbs: "30" }),
      draftLine({ words: "CHK", product_id: RAW_CHK_ID, vendor_id: BELMONT_ID, weight_lbs: "40" }),
    ]);
    const lines = await linesOf(draftId);
    const forProduct = (n: number) => {
      const chk = n === 2 || n === 4;
      return given(lines[n - 1]!.id, {
        product_id: chk ? RAW_CHK_ID : RAW_TOM_ID,
        vendor_id: chk ? BELMONT_ID : VENDOR_ID,
        weight_lbs: String(n * 10),
      });
    };
    const saved = await callAsOperator(confirmCall(draftId, [forProduct(4), forProduct(3), forProduct(2), forProduct(1)]));
    expect(saved.error).toBeUndefined();
    const rows = await query<{ line_no: number; product_id: string; receipt_seq: string }>(
      `select d.line_no, l.product_id, l.receipt_seq::text
       from public.import_draft_lines d join public.lots l on l.id = d.lot_id
       where d.import_draft_id = $1 order by d.line_no`,
      [draftId],
    );
    for (const product of [RAW_TOM_ID, RAW_CHK_ID]) {
      const seqs = rows.filter((r) => r.product_id === product).map((r) => BigInt(r.receipt_seq));
      expect(seqs).toHaveLength(2);
      expect(seqs[0]! < seqs[1]!).toBe(true);
    }
    // The call returns the lots in line order.
    expect(saved.rows?.map((r) => r.weight_lbs)).toEqual(["10.000", "20.000", "30.000", "40.000"]);
  });

  it("AC-0106: keeps the photo, its type, the typed text, and every line's words", async () => {
    const photoId = await makeDraft([draftLine({ words: "first" }), draftLine({ words: "second" })], photoCall);
    const photoLines = await linesOf(photoId);
    expect((await callAsOperator(confirmCall(photoId, [given(photoLines[0]!.id)]))).error).toBeUndefined();
    expect(await draftRow(photoId)).toMatchObject({ status: "confirmed", image_hex: "ffd8ffe0", capture_image_type: "image/jpeg", capture_text: null });
    expect((await linesOf(photoId)).map((l) => l.words)).toEqual(["first", "second"]);

    const textId = await makeDraft([draftLine({ words: "typed" })]);
    const textLines = await linesOf(textId);
    expect((await callAsOperator(confirmCall(textId, [given(textLines[0]!.id)]))).error).toBeUndefined();
    expect(await draftRow(textId)).toMatchObject({ status: "confirmed", capture_text: TEXT });
    expect((await linesOf(textId)).map((l) => l.words)).toEqual(["typed"]);
  });
});

describe("discard_import_draft", () => {
  it("AC-0035: marks a waiting draft discarded and its lines skipped, and changes no ledger row", async () => {
    const draftId = await makeDraft();
    const before = ledgerOnly(await tableFingerprints());
    const discarded = await callAsOperator(discardCall(draftId));
    expect(discarded.error).toBeUndefined();
    expect(idOf(discarded)).toBe(draftId);
    expect(await draftRow(draftId)).toMatchObject({ status: "discarded" });
    expect((await draftRow(draftId))?.settled_at).not.toBeNull();
    expect((await linesOf(draftId)).map((l) => [l.status, l.lot_id])).toEqual([["skipped", null], ["skipped", null]]);
    expect(ledgerOnly(await tableFingerprints())).toEqual(before);
  });

  it("AC-0101: refuses a draft that is not waiting, an unknown id, and a non-operator, changing no table", async () => {
    const discardedId = await makeDraft();
    expect((await callAsOperator(discardCall(discardedId))).error).toBeUndefined();
    await refused(discardCall(discardedId), new RegExp(`^discard_import_draft: draft ${discardedId} is already saved or discarded`));

    const confirmedId = await makeDraft();
    const lines = await linesOf(confirmedId);
    expect((await callAsOperator(confirmCall(confirmedId, [given(lines[0]!.id)]))).error).toBeUndefined();
    await refused(discardCall(confirmedId), new RegExp(`^discard_import_draft: draft ${confirmedId} is already saved or discarded`));

    await refused(discardCall(ZERO_ID), /^discard_import_draft: draft 00000000-0000-0000-0000-000000000000 not found/);

    const waitingId = await makeDraft();
    const before = await tableFingerprints();
    const res = await (nonOperator as unknown as Loose).rpc("discard_import_draft", { p_draft_id: waitingId });
    expect(res.error?.code).toBe("42501");
    expect(await tableFingerprints()).toEqual(before);
  });

  it("AC-0102: leaves no photo, no photo type, no typed text, and no words", async () => {
    for (const call of [photoCall, createCall]) {
      const draftId = await makeDraft([draftLine({ words: "a" }), draftLine({ words: "b" })], call);
      expect((await callAsOperator(discardCall(draftId))).error).toBeUndefined();
      expect(await draftRow(draftId)).toMatchObject({ status: "discarded", capture_text: null, image_hex: null, capture_image_type: null });
      expect((await linesOf(draftId)).map((l) => l.words)).toEqual([null, null]);
    }
  });
});

describe("the tables and the receipts they make", () => {
  async function fixtureDraft(): Promise<string> {
    const draftId = await makeDraft();
    const lines = await linesOf(draftId);
    expect((await callAsOperator(confirmCall(draftId, [given(lines[0]!.id)]))).error).toBeUndefined();
    await makeDraft();
    return draftId;
  }

  it("AC-0037: a non-operator reads no rows where an operator reads at least one", async () => {
    await fixtureDraft();
    for (const table of ["import_drafts", "import_draft_lines"]) {
      const asOperator = await (operator as unknown as Loose).from(table).select("id");
      expect(asOperator.error).toBeNull();
      expect(asOperator.data?.length, `operator rows in ${table}`).toBeGreaterThanOrEqual(1);
      const asOutsider = await (nonOperator as unknown as Loose).from(table).select("id");
      expect(asOutsider.data ?? [], `non-operator rows in ${table}`).toEqual([]);
    }
  });

  it("AC-0038: service_role reads at least one row from each table", async () => {
    await fixtureDraft();
    for (const table of ["import_drafts", "import_draft_lines"]) {
      const res = await service.from(table).select("id");
      expect(res.error).toBeNull();
      expect(res.data?.length, `service_role rows in ${table}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("AC-0039: no role can insert, update, or delete on either table", async () => {
    const draftId = await fixtureDraft();
    const roles: [string, Loose][] = [
      ["anon", anon],
      ["non-operator", nonOperator as unknown as Loose],
      ["operator", operator as unknown as Loose],
      ["service_role", service],
    ];
    const payloads: Record<string, Record<string, unknown>> = {
      import_drafts: { source: "text", capture_text: "x", captured_on: "2026-10-09", model: "m" },
      import_draft_lines: { import_draft_id: draftId, line_no: 9, words: "x" },
    };
    for (const [role, client] of roles) {
      for (const table of Object.keys(payloads)) {
        const before = await tableFingerprints();
        const results = [
          ["insert", await client.from(table).insert(payloads[table]!).select()],
          ["update", await client.from(table).update({ [table === "import_drafts" ? "model" : "words"]: "changed" }).not("id", "is", null).select()],
          ["delete", await client.from(table).delete().not("id", "is", null).select()],
        ] as const;
        for (const [verb, res] of results) {
          expect(res.error?.code, `${role} ${verb} ${table}`).toBe("42501");
        }
        expect(await tableFingerprints(), `${role} left ${table} unchanged`).toEqual(before);
      }
    }
  });

  it("AC-0041: anon and service_role cannot execute the three functions; authenticated can", async () => {
    const rows = await query<{ name: string; anon: boolean; service: boolean; authenticated: boolean }>(`
      select p.proname as name,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
             has_function_privilege('service_role', p.oid, 'EXECUTE') as service,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('create_import_draft', 'confirm_import_draft', 'discard_import_draft')
      order by 1`);
    expect(rows).toEqual([
      { name: "confirm_import_draft", anon: false, service: false, authenticated: true },
      { name: "create_import_draft", anon: false, service: false, authenticated: true },
      { name: "discard_import_draft", anon: false, service: false, authenticated: true },
    ]);
  });

  it("AC-0042: every function the migration adds sets an empty search_path", async () => {
    const rows = await query<{ name: string; proconfig: string[] | null; definer: boolean }>(`
      select p.proname as name, p.proconfig, p.prosecdef as definer
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('create_import_draft', 'confirm_import_draft', 'discard_import_draft')
      order by 1`);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.proconfig, row.name).toEqual(['search_path=""']);
      expect(row.definer, row.name).toBe(true);
    }
  });

  it("AC-0043: the table checks refuse a bad state even for postgres", async () => {
    const waitingId = await makeDraft();
    const confirmedId = await makeDraft();
    const [confirmedLine] = await linesOf(confirmedId);
    expect((await callAsOperator(confirmCall(confirmedId, [given(confirmedLine!.id)]))).error).toBeUndefined();
    const [waitingLine] = await linesOf(waitingId);
    const before = await tableFingerprints();
    const bad = [
      ["update public.import_draft_lines set status = 'saved' where id = $1", [waitingLine!.id]],
      ["update public.import_drafts set settled_at = now() where id = $1", [waitingId]],
      ["update public.import_drafts set status = 'confirmed' where id = $1", [waitingId]],
      ["update public.import_drafts set status = 'discarded', capture_text = null where id = $1", [waitingId]],
      ["update public.import_drafts set settled_at = null where id = $1", [confirmedId]],
      // A waiting draft must hold its capture, and a discarded one must not.
      ["update public.import_drafts set capture_text = null where id = $1", [waitingId]],
      ["update public.import_drafts set status = 'discarded', settled_at = now() where id = $1", [confirmedId]],
    ] as const;
    for (const [sql, values] of bad) {
      await expect(query(sql, [...values]), sql).rejects.toMatchObject({ code: "23514" });
    }
    expect(await tableFingerprints()).toEqual(before);
  });

  it("AC-0044: a lot saved from a draft line reads in Recent receipts like a receipt saved directly", async () => {
    const draftId = await makeDraft([draftLine({ weight_lbs: "1000", unit_cost: "2.5", received_date: "2026-10-02" })]);
    const [line] = await linesOf(draftId);
    const saved = await callAsOperator(confirmCall(draftId, [given(line!.id, { weight_lbs: "1000", unit_cost: "2.5", received_date: "2026-10-02" })]));
    expect(saved.error).toBeUndefined();
    const direct = await callAsOperator(receiveCall(RAW_TOM_ID, VENDOR_ID, "1000", "2.5", "2026-10-02"));
    expect(direct.error).toBeUndefined();
    const { receipts, total } = await listRecentReceipts(operator, RAW_TOM_ID);
    expect(total).toBe(2);
    const [viaDirect, viaDraft] = receipts;
    expect(viaDraft?.id).toBe(idOf(saved));
    expect(viaDraft?.lotNumber).toMatch(/^L-\d{8}-[0-9a-f]{6}$/);
    const shape = (r: typeof viaDraft) => ({ ...r, id: undefined, lotNumber: undefined });
    expect(shape(viaDraft)).toEqual(shape(viaDirect));
    expect(viaDraft).toMatchObject({ vendorName: "Reyes Meats", weightLbs: 1000, unitCost: 2.5, remainingLbs: 1000, status: "untouched", voidReason: null });
  });

  it("AC-0103: void_receipt voids a lot saved from a draft line that nothing has touched", async () => {
    const draftId = await makeDraft();
    const [line] = await linesOf(draftId);
    const saved = await callAsOperator(confirmCall(draftId, [given(line!.id)]));
    expect(saved.error).toBeUndefined();
    const voided = await callAsOperator(voidReceiptCall(idOf(saved), "entered twice"));
    expect(voided.error).toBeUndefined();
    expect(await query("select void_reason, voided_at is not null as voided from public.lots where id = $1", [idOf(saved)])).toEqual([
      { void_reason: "entered twice", voided: true },
    ]);
  });
});
