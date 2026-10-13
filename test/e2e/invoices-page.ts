import { spawn, type ChildProcess } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";
import { crc32, deflateSync } from "node:zlib";
import { expect, type Locator, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { privilegedVariableNames } from "../../src/privileged-env";
import { callAsOperator, query, RAW_TOM_ID, resetTestData, seedInvoiceFixture, tableFingerprints, VENDOR_ID } from "../db";
import { deviceDate } from "./receiving-page";
import { resolveStackEnv } from "../env";

// What the invoice specs share: finding the read forms' parts, the fake model's
// control calls, image fixtures built in the test, and the spare app. The pg pool
// stays open: every spec in this worker shares it.

// What the suite starts the app with (playwright.config.ts). Keep the key in step
// with ANTHROPIC_TEST_KEY there.
export const ANTHROPIC_TEST_KEY = "sk-ant-test-sentinel";
export const ANTHROPIC_TEST_AUTH_TOKEN = "sk-ant-test-auth-token-sentinel";

export const READING = "Reading. This can take up to two minutes.";
export const TRY_AGAIN = "The invoice wasn't read. Try again in a moment.";
export const NOT_ALLOWED_READ = "The invoice wasn't read. This account isn't allowed to use Meat Ops.";
export const READ_SIGNED_OUT = "You're signed out. Sign in again to read this invoice.";
export const NOT_SET_UP =
  "Invoice reading isn't set up. Set ANTHROPIC_API_KEY in the app's .env file, then restart the app.";
export const ADDRESS_REFUSED =
  "Invoice reading isn't set up. ANTHROPIC_BASE_URL must be unset, or a loopback address for tests. Fix it, then restart the app.";
export const KEY_REFUSED =
  "Invoice reading isn't working. The model service refused the app's key. Check ANTHROPIC_API_KEY in the app's .env file.";
export const DECLINED = "The invoice wasn't read. The model declined it. Type the receipt instead.";
export const TOO_LONG = "This invoice is too long to read at once. Read it in parts.";
export const NO_LINES = "No receipt lines were found. Try a clearer photo, or type the receipt.";
export const PHOTO_NONE = "Choose a photo of an invoice.";
export const PHOTO_TYPE = "Use a JPEG, PNG, or WebP photo.";
export const PHOTO_TOO_LARGE = "This photo is too large. Use one under 4 MB.";
export const TEXT_BLANK = "Type a receipt, like: 5000 lbs RAW-TOM from Reyes Meats at 1.68 today.";
export const TEXT_TOO_LONG = "Keep the text to 2,000 characters or fewer.";
export const FRAMING = { "content-security-policy": "frame-ancestors 'none'", "x-frame-options": "DENY" };

export const RECEIPT_TEXT = "5000 lbs RAW-TOM from Reyes Meats at 1.68 today";
export const ZERO_ID = "00000000-0000-0000-0000-000000000000";

// What Tab reaches on /invoices before any draft link, in order.
export const FORM_CONTROLS = [
  "a Receiving",
  "a Production",
  "a Menu",
  "a Pricing",
  "a Invoices",
  "button Sign out",
  "input #invoice-photo",
  "button Read photo",
  "textarea #receipt-text",
  "button Read text",
];

// The link every ?draft= state shows, after Sign out.
export const BACK_LINK = "a Back to invoices";

// What Tab reaches on a draft's address with nothing to edit: the navigation,
// Sign out, and the way back.
export const NAV_CONTROLS = [...FORM_CONTROLS.slice(0, 6), BACK_LINK];

// The app's port and the three beside it: the fake model, and the spare app.
export function ports(baseURL: string | undefined): { app: number; model: number; spare: number; forwarder: number } {
  const app = Number(new URL(baseURL ?? "").port);
  return { app, model: app + 1, spare: app + 2, forwarder: app + 3 };
}

// ---- The fake model ----

export interface ReadingLine {
  words: string;
  product_code: string | null;
  vendor_name: string | null;
  weight_lbs: string | null;
  cost_per_lb: string | null;
  received_date: string | null;
  unsure: string[];
}

export type FakeAnswer =
  | { reading: ReadingLine[]; stop_reason?: string }
  | { text: string; stop_reason?: string }
  | { status: number; body?: unknown }
  | { rawBody: string; status?: number; contentType?: string }
  | { drop: true }
  | { hold: true; then: FakeAnswer };

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  // The parsed JSON body, or the text when it was not JSON.
  body: {
    model: string;
    max_tokens: number;
    system: string;
    messages: Array<{ role: string; content: Array<Record<string, unknown> & { type: string }> }>;
    output_config: { effort: string; format: { type: string; schema: unknown } };
    [key: string]: unknown;
  };
}

export class FakeModel {
  constructor(readonly base: string) {}

  private async post(path: string, body?: unknown): Promise<void> {
    const response = await fetch(`${this.base}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    expect(response.ok, `fake model ${path}`).toBe(true);
  }

  reset(): Promise<void> {
    return this.post("/__fake/reset");
  }

  // The answers, used in order, one per request.
  answer(...answers: FakeAnswer[]): Promise<void> {
    return this.post("/__fake/answers", { answers });
  }

  release(): Promise<void> {
    return this.post("/__fake/release");
  }

  async requests(): Promise<RecordedRequest[]> {
    const response = await fetch(`${this.base}/__fake/requests`);
    return (await response.json()) as RecordedRequest[];
  }

  // Waits until the fake model has recorded `count` requests.
  async waitForRequests(count: number): Promise<void> {
    await expect.poll(async () => (await this.requests()).length, { message: "requests at the fake model" }).toBe(count);
  }
}

export function fakeModel(baseURL: string | undefined): FakeModel {
  return new FakeModel(`http://127.0.0.1:${ports(baseURL).model}`);
}

// ---- The turkey reading ----

export const TURKEY_LINES: ReadingLine[] = [
  {
    words: "TKY DRUMS 40#",
    product_code: "RAW-TOM",
    vendor_name: "Reyes Meats",
    weight_lbs: "5000",
    cost_per_lb: "1.68",
    received_date: "2026-10-01",
    unsure: [],
  },
  {
    words: "TKY DRUMS 40#",
    product_code: "RAW-TOM",
    vendor_name: "Reyes Meats",
    weight_lbs: "3000",
    cost_per_lb: "1.80",
    received_date: "2026-10-05",
    unsure: [],
  },
];

export const TURKEY: FakeAnswer = { reading: TURKEY_LINES };

// The invoice fixture, empty of drafts and lots.
export async function seedFixture(): Promise<void> {
  await resetTestData();
  await seedInvoiceFixture();
}

// ---- Page parts ----

export function parts(page: Page) {
  return {
    photoSection: page.getByRole("region", { name: "Read an invoice" }),
    textSection: page.getByRole("region", { name: "Type a receipt" }),
    draftsSection: page.getByRole("region", { name: "Drafts to confirm" }),
    photo: page.getByLabel("Invoice photo"),
    text: page.getByLabel("Receipt text"),
    readPhoto: page.getByRole("button", { name: "Read photo" }),
    readText: page.getByRole("button", { name: "Read text" }),
    photoStatus: page.getByRole("region", { name: "Read an invoice" }).getByRole("status"),
    textStatus: page.getByRole("region", { name: "Type a receipt" }).getByRole("status"),
    photoMessage: page.locator("#photo-message"),
    textMessage: page.locator("#text-message"),
    photoError: page.locator("#invoice-photo-error"),
    textError: page.locator("#receipt-text-error"),
    draftLinks: page.getByRole("region", { name: "Drafts to confirm" }).getByRole("link"),
  };
}

export type Parts = ReturnType<typeof parts>;

// Opens /invoices and waits for the read forms.
export async function openInvoices(page: Page, url = "/invoices"): Promise<Parts> {
  await page.goto(url);
  const p = parts(page);
  await expect(p.readText).toBeVisible();
  return p;
}

// Types a receipt and presses Read text.
export async function readText(p: Parts, text = RECEIPT_TEXT): Promise<void> {
  await p.text.fill(text);
  await p.readText.click();
}

export function pngFile(width: number, height: number, name = "invoice.png") {
  return { name, mimeType: "image/png", buffer: png(width, height) };
}

// Waits for the page to reach a draft's address and returns the draft's id.
export async function draftIdFromUrl(page: Page): Promise<string> {
  await expect(page).toHaveURL(/\/invoices\?draft=[0-9a-f-]{36}$/);
  return new URL(page.url()).searchParams.get("draft") ?? "";
}

// ---- Rows through pg ----

export async function draftCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from import_drafts");
  return row?.n ?? -1;
}

export async function draftLineCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from import_draft_lines");
  return row?.n ?? -1;
}

export async function lotCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from lots");
  return row?.n ?? -1;
}

// Every table's fingerprint but the two import tables: a read changes only those.
export async function ledgerFingerprints(): Promise<Record<string, string>> {
  const { import_drafts: _drafts, import_draft_lines: _lines, ...rest } = await tableFingerprints();
  return rest;
}

export async function draftRows() {
  return query<{
    id: string;
    source: string;
    capture_text: string | null;
    capture_image_type: string | null;
    captured_on: string;
    model: string;
    status: string;
  }>("select id, source, capture_text, capture_image_type, captured_on::text, model, status from import_drafts order by captured_at");
}

export async function lineRows(draftId: string) {
  return query<{
    line_no: number;
    words: string;
    product: string | null;
    vendor: string | null;
    weight: string | null;
    cost: string | null;
    received: string | null;
    unsure_fields: string[];
    status: string;
  }>(
    `select l.line_no, l.words, p.code as product, v.name as vendor, l.weight_lbs::text as weight,
            l.unit_cost::text as cost, l.received_date::text as received, l.unsure_fields, l.status
     from import_draft_lines l
     left join products p on p.id = l.product_id
     left join vendors v on v.id = l.vendor_id
     where l.import_draft_id = $1 order by l.line_no`,
    [draftId],
  );
}

export async function storedImage(draftId: string): Promise<Buffer> {
  const [row] = await query<{ capture_image: Buffer }>("select capture_image from import_drafts where id = $1", [draftId]);
  return row?.capture_image ?? Buffer.alloc(0);
}

// Creates a waiting draft through the engine, as the operator.
export async function seedDraft(options: {
  source?: "text" | "photo";
  capturedOn?: string;
  words?: string[];
  text?: string;
}): Promise<string> {
  const { source = "text", capturedOn = "2026-10-01", words = ["TKY DRUMS 40#"], text = "typed receipt" } = options;
  const lines = words.map((line) => ({
    words: line,
    product_id: RAW_TOM_ID,
    vendor_id: VENDOR_ID,
    weight_lbs: "5000",
    unit_cost: "1.68",
    received_date: "2026-10-01",
    unsure: [],
  }));
  const outcome = await callAsOperator({
    fn: "create_import_draft",
    args: {
      p_source: source,
      p_captured_on: capturedOn,
      p_model: "claude-opus-5-5",
      p_lines: JSON.stringify(lines),
      p_capture_text: source === "text" ? text : null,
      p_capture_image: source === "photo" ? `\\x${png(4, 4).toString("hex")}` : null,
      p_capture_image_type: source === "photo" ? "image/png" : null,
    },
  });
  expect(outcome.ok, outcome.error).toBe(true);
  return String(outcome.rows?.[0]?.id);
}

// ---- The review ----

export const SAVE_SIGNED_OUT = "You're signed out. Sign in again to save these receipts.";
export const DISCARD_SIGNED_OUT = "You're signed out. Sign in again to discard this draft.";
export const NOT_SAVED = "The receipts weren't saved.";
export const NOT_DISCARDED = "The draft wasn't discarded.";
export const NOT_ALLOWED_SAVE = `${NOT_SAVED} This account isn't allowed to use Meat Ops.`;
export const NOT_ALLOWED_DISCARD = `${NOT_DISCARDED} This account isn't allowed to use Meat Ops.`;
export const SAVE_UNKNOWN =
  "The receipts may have been saved. Reload this page to check the draft before saving again.";
export const DISCARD_UNKNOWN = "The draft may have been discarded. Reload this page to check it.";
export const ENTER_FROM_INVOICE = "Enter this from the invoice.";
export const TRY_LATER = "Try again in a moment.";
export const PHOTO_NOT_LOADED = "The photo couldn't be loaded. Reload the page to try again.";

// What Tab reaches in a waiting draft's review, after the Primary navigation and
// Sign out: every line's checkbox and five fields in order, then the two buttons.
export function reviewControls(lineCount: number): string[] {
  const lines = Array.from({ length: lineCount }, (_, i) =>
    ["input #line-N-save", "select #line-N-product", "select #line-N-vendor", "input #line-N-weight", "input #line-N-cost", "input #line-N-date"].map(
      (label) => label.replace("N", String(i + 1)),
    ),
  );
  return [...NAV_CONTROLS, ...lines.flat(), "button Save receipts", "button Discard draft"];
}

// The lines of a draft's review, one group each.
export function review(page: Page) {
  const group = (n: number) => page.getByRole("group", { name: `Line ${n}`, exact: true });
  const line = (n: number) => ({
    group: group(n),
    words: group(n).getByText(/^Invoice says: /),
    tick: group(n).getByLabel("Save this line"),
    product: group(n).getByLabel("Product", { exact: true }),
    vendor: group(n).getByLabel("Vendor", { exact: true }),
    weight: group(n).getByLabel("Weight (lbs)", { exact: true }),
    cost: group(n).getByLabel("Cost per lb", { exact: true }),
    date: group(n).getByLabel("Received date", { exact: true }),
    hints: group(n).getByText(ENTER_FROM_INVOICE),
  });
  return {
    section: page.getByRole("region", { name: "Draft review" }),
    heading: page.getByRole("heading", { level: 2, name: "Draft review" }),
    photo: page.getByAltText("Invoice photo"),
    typed: page.getByRole("heading", { level: 3, name: "You typed" }),
    groups: page.getByRole("group"),
    line,
    save: page.getByRole("button", { name: "Save receipts" }),
    discard: page.getByRole("button", { name: "Discard draft" }),
    message: page.locator("#draft-message"),
    // The live region: the outcome sentence only. The lots and totals are in details.
    result: page.getByRole("status", { name: "Draft result" }),
    details: page.getByRole("region", { name: "Saved receipts" }),
    back: page.getByRole("link", { name: "Back to invoices" }),
  };
}

export type Review = ReturnType<typeof review>;

// Opens a draft's review and waits for it to settle.
export async function openReview(page: Page, id: string): Promise<Review> {
  await page.goto(`/invoices?draft=${id}`);
  const r = review(page);
  await expect(r.heading).toBeVisible();
  return r;
}

// Every line's checkbox and field values as the page holds them (a picker as its shown text).
export async function reviewValues(r: Review, lineCount: number) {
  const values = [];
  for (let n = 1; n <= lineCount; n++) {
    const line = r.line(n);
    values.push({
      ticked: await line.tick.isChecked(),
      product: await line.product.locator("option:checked").innerText(),
      vendor: await line.vendor.locator("option:checked").innerText(),
      weight: await line.weight.inputValue(),
      cost: await line.cost.inputValue(),
      date: await line.date.inputValue(),
    });
  }
  return values;
}

export interface SeedLine {
  words: string;
  product_id?: string | null;
  vendor_id?: string | null;
  weight_lbs?: string | null;
  unit_cost?: string | null;
  received_date?: string | null;
}

// A waiting draft with the given lines (the turkey reading's values unless a line gives its own).
export async function seedLines(
  lines: SeedLine[],
  options: { source?: "text" | "photo"; text?: string } = {},
): Promise<string> {
  const { source = "text", text = "typed receipt" } = options;
  const outcome = await callAsOperator({
    fn: "create_import_draft",
    args: {
      p_source: source,
      p_captured_on: "2026-10-09",
      p_model: "claude-opus-5-5",
      p_lines: JSON.stringify(
        lines.map((line) => ({
          product_id: RAW_TOM_ID,
          vendor_id: VENDOR_ID,
          weight_lbs: "5000",
          unit_cost: "1.68",
          received_date: "2026-10-01",
          unsure: [],
          ...line,
        })),
      ),
      p_capture_text: source === "text" ? text : null,
      p_capture_image: source === "photo" ? `\\x${png(4, 4).toString("hex")}` : null,
      p_capture_image_type: source === "photo" ? "image/png" : null,
    },
  });
  expect(outcome.ok, outcome.error).toBe(true);
  return String(outcome.rows?.[0]?.id);
}

export async function draftStatus(id: string): Promise<string> {
  const [row] = await query<{ status: string }>("select status from import_drafts where id = $1", [id]);
  return row?.status ?? "none";
}

export async function lotRows() {
  return query<{
    lot_number: string;
    product: string;
    vendor: string;
    weight: string;
    cost: string;
    received: string;
  }>(
    `select l.lot_number, p.code as product, v.name as vendor, l.weight_lbs::text as weight,
            l.unit_cost::text as cost, l.received_date::text as received
     from lots l join products p on p.id = l.product_id join vendors v on v.id = l.vendor_id
     order by l.receipt_seq`,
  );
}

// Every table's fingerprint, the two import tables included: a refused save or discard changes none.
export async function allFingerprints(): Promise<Record<string, string>> {
  return tableFingerprints();
}

// The device's date, a day after it, for the "after today" row.
export { deviceDate };

// ---- Image fixtures ----

// A grayscale PNG of one solid shade, built by hand so a test needs no binary file.
export function png(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // grayscale
  const row = Buffer.alloc(1 + width, 0x80); // filter byte 0, then the pixels
  row[0] = 0;
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A 1 x 1 GIF: an image every browser decodes, which the read must still refuse.
export const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

// A JPEG drawn by the browser, `width` x `height`.
export async function canvasJpeg(page: Page, width: number, height: number): Promise<Buffer> {
  const data = await page.evaluate(
    ([w, h]) => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no canvas");
      context.fillStyle = "#808080";
      context.fillRect(0, 0, w, h);
      context.fillStyle = "#ffffff";
      context.fillRect(10, 10, w / 2, h / 2);
      return canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
    },
    [width, height] as const,
  );
  return Buffer.from(data, "base64");
}

const EXIF_MARK = Buffer.from("Exif\0\0", "latin1");
const XMP_MARK = Buffer.from("http://ns.adobe.com/xap/1.0/\0", "latin1");

function app1(payload: Buffer): Buffer {
  const length = Buffer.alloc(2);
  length.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, 0xe1]), length, payload]);
}

// Adds an EXIF block holding a GPS position, and an XMP block, after the JPEG's
// start marker.
export function withLocation(jpeg: Buffer): Buffer {
  // TIFF header, IFD0 with one entry (the GPS block's address), the GPS IFD with
  // a latitude reference and a latitude.
  const tiff = Buffer.alloc(8 + 2 + 12 + 4 + 2 + 12 + 12 + 4 + 24);
  tiff.write("MM", 0, "latin1");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8); // IFD0: one entry
  tiff.writeUInt16BE(0x8825, 10); // GPSInfo
  tiff.writeUInt16BE(4, 12); // LONG
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt32BE(26, 18); // the GPS IFD follows IFD0
  tiff.writeUInt32BE(0, 22); // no next IFD
  tiff.writeUInt16BE(2, 26); // GPS IFD: two entries
  tiff.writeUInt16BE(1, 28); // GPSLatitudeRef
  tiff.writeUInt16BE(2, 30); // ASCII
  tiff.writeUInt32BE(2, 32);
  tiff.write("N\0", 36, "latin1");
  tiff.writeUInt16BE(2, 40); // GPSLatitude
  tiff.writeUInt16BE(5, 42); // RATIONAL
  tiff.writeUInt32BE(3, 44);
  tiff.writeUInt32BE(56, 48); // the three rationals follow
  tiff.writeUInt32BE(0, 52);
  [40, 1, 26, 1, 46, 1].forEach((value, i) => tiff.writeUInt32BE(value, 56 + i * 4));
  const exif = app1(Buffer.concat([EXIF_MARK, tiff]));
  const xmp = app1(Buffer.concat([XMP_MARK, Buffer.from('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')]));
  return Buffer.concat([jpeg.subarray(0, 2), exif, xmp, jpeg.subarray(2)]);
}

// The marker bytes (after FF) of each segment before the image data, in order.
function jpegSegments(jpeg: Buffer): Array<{ marker: number; start: number; length: number }> {
  const segments: Array<{ marker: number; start: number; length: number }> = [];
  let at = 2;
  while (at + 4 <= jpeg.length) {
    if (jpeg[at] !== 0xff) break;
    const marker = jpeg[at + 1] ?? 0;
    const length = jpeg.readUInt16BE(at + 2);
    segments.push({ marker, start: at + 4, length: length - 2 });
    if (marker === 0xda) break;
    at += 2 + length;
  }
  return segments;
}

// A JPEG's pixel size, read from its start-of-frame segment.
export function jpegSize(jpeg: Buffer): { width: number; height: number } {
  expect(jpeg.subarray(0, 3), "a JPEG").toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  const frame = jpegSegments(jpeg).find(({ marker }) => marker >= 0xc0 && marker <= 0xc3);
  if (!frame) throw new Error("no start-of-frame segment");
  return { height: jpeg.readUInt16BE(frame.start + 1), width: jpeg.readUInt16BE(frame.start + 3) };
}

// Whether the JPEG holds an EXIF or an XMP block (any APP1 segment says so too).
export function jpegMetadata(jpeg: Buffer): { exif: boolean; xmp: boolean; app1: number } {
  const segments = jpegSegments(jpeg);
  const holds = (mark: Buffer) =>
    segments.some(({ start, length }) => jpeg.subarray(start, start + length).subarray(0, mark.length).equals(mark));
  return { exif: holds(EXIF_MARK), xmp: holds(XMP_MARK), app1: segments.filter(({ marker }) => marker === 0xe1).length };
}

// The image a read sent the model, from its recorded request.
export function sentImage(request: RecordedRequest): { mediaType: unknown; bytes: Buffer } {
  const block = request.body.messages[0]?.content[0] as { type: string; source?: { media_type?: unknown; data?: string } } | undefined;
  expect(block?.type, "the first block of the message").toBe("image");
  return { mediaType: block?.source?.media_type, bytes: Buffer.from(block?.source?.data ?? "", "base64") };
}

// ---- Replayed action requests ----

export interface SentAction {
  url: string;
  headers: Record<string, string>;
  body: Buffer;
}

// Runs `press` and returns the action request it sends, without the operator's
// cookie, as an attacker would replay it. The request is stopped in the browser,
// so the capture itself reads nothing and writes nothing.
export async function captureAction(page: Page, press: () => Promise<void>): Promise<SentAction> {
  let resolveSent: (sent: SentAction) => void = () => undefined;
  const sentPromise = new Promise<SentAction>((resolve) => {
    resolveSent = resolve;
  });
  await page.route("**/invoices**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) {
      const headers = await request.allHeaders();
      for (const name of ["cookie", "content-length", "host"]) delete headers[name];
      resolveSent({ url: request.url(), headers, body: request.postDataBuffer() ?? Buffer.alloc(0) });
      await route.abort();
    } else {
      await route.continue();
    }
  });
  await press();
  const sent = await sentPromise;
  await page.unroute("**/invoices**");
  return sent;
}

export interface Part {
  name: string;
  filename?: string;
  contentType?: string;
  data: Buffer;
}

// The parts of a captured multipart body. React names a FormData's entries
// "_<id>_<name>" beside a "0" part that points at them.
export function parseParts(sent: SentAction): Part[] {
  const type = sent.headers["content-type"] ?? "";
  const boundary = /boundary=(.+)$/.exec(type)?.[1];
  if (!boundary) throw new Error(`no multipart boundary in ${type}`);
  const delimiter = Buffer.from(`--${boundary}`, "latin1");
  const found: Part[] = [];
  let at = sent.body.indexOf(delimiter);
  while (at !== -1) {
    const next = sent.body.indexOf(delimiter, at + delimiter.length);
    if (next === -1) break;
    const block = sent.body.subarray(at + delimiter.length + 2, next - 2);
    const split = block.indexOf("\r\n\r\n");
    const head = block.subarray(0, split).toString("latin1");
    found.push({
      name: /name="([^"]*)"/.exec(head)?.[1] ?? "",
      filename: /filename="([^"]*)"/.exec(head)?.[1],
      contentType: /content-type: (.+)/i.exec(head)?.[1],
      data: block.subarray(split + 4),
    });
    at = next;
  }
  return found;
}

export type Change = string | { name: string; mimeType: string; buffer: Buffer };

// Replays a captured action with some fields changed, in a fresh context, and
// returns the response text. The body is written as the browser wrote it: the
// same boundary and part layout. `change` maps a field's name (without its "_1_"
// prefix) to its new text or file; a name that is not in the capture is added.
export async function replayWith(
  playwright: PlaywrightWorkerArgs["playwright"],
  baseURL: string | undefined,
  sent: SentAction,
  storageState: string | undefined,
  change: Record<string, Change> = {},
): Promise<string> {
  const boundary = /boundary=(.+)$/.exec(sent.headers["content-type"] ?? "")?.[1] ?? "";
  const parts = parseParts(sent);
  for (const [name, value] of Object.entries(change)) {
    const part: Part =
      typeof value === "string"
        ? { name: `_1_${name}`, data: Buffer.from(value, "utf8") }
        : { name: `_1_${name}`, filename: value.name, contentType: value.mimeType, data: value.buffer };
    const at = parts.findIndex((other) => other.name === part.name);
    if (at === -1) parts.push(part);
    else parts[at] = part;
  }
  const body = Buffer.concat([
    ...parts.map((part) =>
      Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"` +
            (part.filename === undefined ? "" : `; filename="${part.filename}"`) +
            (part.contentType === undefined ? "" : `\r\nContent-Type: ${part.contentType}`) +
            "\r\n\r\n",
          "utf8",
        ),
        part.data,
        Buffer.from("\r\n"),
      ]),
    ),
    Buffer.from(`--${boundary}--\r\n`),
  ]);
  const replay = await playwright.request.newContext({ baseURL, storageState });
  try {
    const response = await replay.post(sent.url, { headers: sent.headers, data: body, maxRedirects: 0 });
    return await response.text();
  } finally {
    await replay.dispose();
  }
}

// ---- The spare app ----

export interface SpareApp {
  url: string;
  // Everything the app wrote to its output so far.
  output: () => string;
  stop: () => Promise<void>;
}

// A second `next start` over the same build, on the spare port, for the cases
// that need the app started with another key or address. The privileged names are
// unset, as the suite's own app has them.
export async function startSpare(port: number, env: Record<string, string>): Promise<SpareApp> {
  const stack = resolveStackEnv();
  const clean: Record<string, string> = {};
  const hidden = new Set(privilegedVariableNames());
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !hidden.has(name) && name !== "NODE_ENV") clean[name] = value;
  }
  const childEnv: Record<string, string> = { ...clean, SUPABASE_URL: stack.apiUrl, SUPABASE_ANON_KEY: stack.anonKey, ...env };
  const child: ChildProcess = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      env: childEnv as NodeJS.ProcessEnv,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => (output += chunk.toString()));
  const url = `http://127.0.0.1:${port}`;
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${url}/sign-in`)).status;
        } catch {
          return 0;
        }
      },
      { timeout: 30_000, message: "the spare app starting" },
    )
    .toBe(200);
  return {
    url,
    output: () => output,
    stop: () =>
      new Promise((done) => {
        child.once("close", () => done());
        child.kill();
      }),
  };
}

// A sentence in the page's message region that appears once the read has an outcome.
export function messageIn(p: Parts, source: "photo" | "text"): Locator {
  return source === "photo" ? p.photoMessage : p.textMessage;
}

// ---- The forwarder (AC-0097) ----

export interface Forwarder {
  url: string;
  // The next request whose path starts with `prefix` is answered 500 with a
  // PostgREST-shaped error, and the one after it goes through again.
  failNext: (prefix: string) => void;
  // How many requests were answered 500.
  failures: () => number;
  stop: () => Promise<void>;
}

// A small server on 127.0.0.1 that passes every request through to the stack's
// API unchanged until a test arms it. A spare app started with SUPABASE_URL set
// to it can then be made to fail one database call it makes. The status is 500
// because postgrest-js retries 503 and 520.
export async function startForwarder(port: number): Promise<Forwarder> {
  const target = new URL(resolveStackEnv().apiUrl);
  let armed: string | null = null;
  let failed = 0;
  const server = createServer((req, res) => {
    if (armed !== null && (req.url ?? "").startsWith(armed)) {
      armed = null;
      failed += 1;
      req.resume();
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ code: "XX000", details: null, hint: null, message: "forced failure for the test" }));
      return;
    }
    const upstream = httpRequest(
      { host: target.hostname, port: target.port, path: req.url, method: req.method, headers: { ...req.headers, host: target.host } },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on("error", () => res.destroy());
    req.pipe(upstream);
  });
  await new Promise<void>((done) => server.listen(port, "127.0.0.1", done));
  return {
    url: `http://127.0.0.1:${port}`,
    failNext: (prefix) => {
      armed = prefix;
    },
    failures: () => failed,
    stop: () =>
      new Promise((done) => {
        server.close(() => done());
        server.closeAllConnections();
      }),
  };
}
