import { readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { receiveLot } from "../../src/lib/rpc";
import { callAsOperator, query, RAW_CHK_ID, RAW_TOM_ID, VENDOR_ID } from "../db";
import { resolveStackEnv } from "../env";
import { OPERATOR_EMAIL, signInOperator } from "../users";
import { checkPageState } from "./a11y";
import {
  ADDRESS_REFUSED,
  allFingerprints,
  ANTHROPIC_TEST_AUTH_TOKEN,
  ANTHROPIC_TEST_KEY,
  canvasJpeg,
  captureAction,
  DECLINED,
  DISCARD_SIGNED_OUT,
  DISCARD_UNKNOWN,
  draftCount,
  draftIdFromUrl,
  draftLineCount,
  draftRows,
  draftStatus,
  ENTER_FROM_INVOICE,
  type FakeAnswer,
  FakeModel,
  fakeModel,
  FORM_CONTROLS,
  FRAMING,
  GIF,
  jpegMetadata,
  jpegSize,
  KEY_REFUSED,
  ledgerFingerprints,
  lineRows,
  lotCount,
  lotRows,
  NO_LINES,
  NOT_ALLOWED_DISCARD,
  NOT_ALLOWED_READ,
  NOT_ALLOWED_SAVE,
  NOT_DISCARDED,
  NOT_SAVED,
  NOT_SET_UP,
  openInvoices,
  openReview,
  parseParts,
  type Parts,
  PHOTO_NONE,
  PHOTO_TOO_LARGE,
  PHOTO_TYPE,
  pngFile,
  png,
  ports,
  READ_SIGNED_OUT,
  READING,
  readText,
  RECEIPT_TEXT,
  replayWith,
  review,
  reviewControls,
  reviewValues,
  SAVE_SIGNED_OUT,
  SAVE_UNKNOWN,
  seedDraft,
  seedFixture,
  seedLines,
  type SeedLine,
  sentImage,
  startSpare,
  storedImage,
  TEXT_BLANK,
  TEXT_TOO_LONG,
  TOO_LONG,
  TRY_AGAIN,
  TURKEY,
  TURKEY_LINES,
  withLocation,
  ZERO_ID,
} from "./invoices-page";
import { beforeAfter, deviceDate, factValue, NOT_ALLOWED, sendsActionRequest } from "./receiving-page";
import { readSession } from "./session";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// The invoices page, end to end: a real browser over the production build, the
// local database, and the fake model service. Raw tables are read through pg to
// show what was or was not written, and the fake model's record shows what each
// read sent.

test.use({ storageState: OPERATOR_STATE });

let model: FakeModel;

test.beforeEach(async ({ baseURL }) => {
  await seedFixture();
  model = fakeModel(baseURL);
  await model.reset();
});

// The fake model's one recorded request.
async function onlyRequest() {
  const requests = await model.requests();
  expect(requests).toHaveLength(1);
  return requests[0]!;
}

test.describe("access and navigation", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /invoices ends on /sign-in", async ({ page }) => {
      await page.goto("/invoices");
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test("AC-0006: /invoices carries the framing headers, signed out", async ({ request }) => {
      const response = await request.get("/invoices");
      for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
      // The redirect itself carries them too.
      const redirect = await request.get("/invoices", { maxRedirects: 0 });
      for (const [name, value] of Object.entries(FRAMING)) expect(redirect.headers()[name]).toBe(value);
    });
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0002: /invoices shows the not-allowed message, Sign out, and no draft", async ({ page }) => {
      await seedDraft({ words: ["SECRET WORDS"] });
      await page.goto("/invoices");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByText("SECRET WORDS")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Drafts to confirm" })).toHaveCount(0);
      expect(await checkPageState(page)).toEqual(["button Sign out"]);
    });
  });

  for (const path of ["/receiving", "/production", "/menu", "/pricing", "/invoices"]) {
    test(`AC-0004: ${path} links Invoices after Pricing in the Primary navigation`, async ({ page }) => {
      await page.goto(path);
      const nav = page.getByRole("navigation", { name: "Primary" });
      await expect(nav.getByRole("link")).toHaveText(["Receiving", "Production", "Menu", "Pricing", "Invoices"]);
      await expect(nav.getByRole("link", { name: "Invoices" })).toHaveAttribute("href", "/invoices");
    });
  }

  test("AC-0005: on /invoices only the Invoices link carries aria-current, with the value page", async ({ page }) => {
    await page.goto("/invoices");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.locator("[aria-current]")).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "Invoices" })).toHaveAttribute("aria-current", "page");
  });

  test("AC-0006: /invoices carries the framing headers, signed in as the operator", async ({ request }) => {
    const response = await request.get("/invoices");
    for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
  });

  test("AC-0003, AC-0007, AC-0190: a read replayed with no session or a non-operator's writes nothing and sends nothing", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const p = await openInvoices(page);
    const sent = await captureAction(page, () => readText(p));
    const before = await ledgerFingerprints();
    const replays = [
      { who: "no session", storageState: undefined, message: READ_SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: NOT_ALLOWED_READ },
    ];
    for (const { who, storageState, message } of replays) {
      expect(await replayWith(playwright, baseURL, sent, storageState), `response for ${who}`).toContain(message);
      expect(await draftCount(), `drafts after ${who}`).toBe(0);
      expect(await draftLineCount(), `draft lines after ${who}`).toBe(0);
      expect(await lotCount(), `lots after ${who}`).toBe(0);
      expect(await ledgerFingerprints(), `ledger after ${who}`).toEqual(before);
      expect(await model.requests(), `requests after ${who}`).toEqual([]);
    }
  });
});

test.describe("the read forms", () => {
  test("AC-0010: the page has the two read sections and their fields", async ({ page }) => {
    const p = await openInvoices(page);
    await expect(page.getByRole("heading", { level: 1, name: "Invoices" })).toBeVisible();
    await expect(p.photoSection).toBeVisible();
    await expect(p.photoSection.getByRole("heading", { level: 2 })).toHaveText("Read an invoice");
    await expect(p.photo).toHaveAttribute("type", "file");
    await expect(p.photo).toHaveAttribute("accept", "image/*");
    await expect(p.photoSection.getByRole("button", { name: "Read photo" })).toBeVisible();
    await expect(p.textSection).toBeVisible();
    await expect(p.textSection.getByRole("heading", { level: 2 })).toHaveText("Type a receipt");
    await expect(p.text).toBeVisible();
    await expect(p.textSection.getByRole("button", { name: "Read text" })).toBeVisible();
  });

  test("the first-run page says no drafts are waiting and meets the page-state checks", async ({ page }) => {
    const p = await openInvoices(page);
    await expect(p.draftsSection.getByRole("heading", { level: 2 })).toHaveText("Drafts to confirm");
    await expect(p.draftsSection).toContainText("No drafts waiting.");
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0011: reading a photo creates one waiting draft and opens its address", async ({ page }) => {
    await model.answer(TURKEY);
    const p = await openInvoices(page);
    await p.photo.setInputFiles(pngFile(600, 400));
    await p.readPhoto.click();
    const id = await draftIdFromUrl(page);
    const drafts = await draftRows();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id,
      source: "photo",
      capture_text: null,
      capture_image_type: "image/jpeg",
      model: "claude-opus-5-5",
      status: "pending",
    });
    expect(drafts[0]?.captured_on).toBe(await deviceDate(page));
    expect(await lineRows(id)).toEqual([
      {
        line_no: 1,
        words: "TKY DRUMS 40#",
        product: "RAW-TOM",
        vendor: "Reyes Meats",
        weight: "5000.000",
        cost: "1.6800",
        received: "2026-10-01",
        unsure_fields: [],
        status: "pending",
      },
      {
        line_no: 2,
        words: "TKY DRUMS 40#",
        product: "RAW-TOM",
        vendor: "Reyes Meats",
        weight: "3000.000",
        cost: "1.8000",
        received: "2026-10-05",
        unsure_fields: [],
        status: "pending",
      },
    ]);
    expect(await lotCount()).toBe(0);
  });

  test("AC-0015: reading the typed text creates one waiting draft that holds the text as written", async ({ page }) => {
    await model.answer({ reading: [TURKEY_LINES[0]!] });
    const p = await openInvoices(page);
    await readText(p);
    const id = await draftIdFromUrl(page);
    const drafts = await draftRows();
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({ id, source: "text", capture_text: RECEIPT_TEXT, capture_image_type: null });
    expect(await lineRows(id)).toHaveLength(1);
  });

  test("AC-0014: while a read is in flight the page says so and both Read buttons are disabled", async ({ page }) => {
    await model.answer({ hold: true, then: TURKEY });
    const p = await openInvoices(page);
    await expect(p.status).toHaveText("");
    await readText(p);
    await model.waitForRequests(1);
    await expect(p.status).toHaveText(READING);
    await expect(p.readPhoto).toBeDisabled();
    await expect(p.readText).toBeDisabled();
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);

    await model.release();
    await draftIdFromUrl(page);
    expect(await draftCount()).toBe(1);
  });

  test("AC-0025 and AC-0098: each waiting draft once, newest first, with its date, kind, line count, and first words", async ({
    page,
  }) => {
    const oldest = await seedDraft({ capturedOn: "2026-10-01", words: ["FIRST <b>9</b>", "second line"] });
    const middle = await seedDraft({ source: "photo", capturedOn: "2026-10-08", words: ["PHOTO WORDS"] });
    const newest = await seedDraft({ capturedOn: "2026-10-09", words: ["NEWEST", "b", "c"] });
    const p = await openInvoices(page);
    await expect(p.draftLinks).toHaveCount(3);
    const links = await p.draftLinks.all();
    expect(await Promise.all(links.map((link) => link.getAttribute("href")))).toEqual([
      `/invoices?draft=${newest}`,
      `/invoices?draft=${middle}`,
      `/invoices?draft=${oldest}`,
    ]);
    await expect(links[0]!).toContainText("Oct 9, 2026");
    await expect(links[0]!).toContainText("Text, 3 lines");
    await expect(links[0]!).toContainText("NEWEST");
    await expect(links[1]!).toContainText("Oct 8, 2026");
    await expect(links[1]!).toContainText("Photo, 1 line");
    await expect(links[2]!).toContainText("Oct 1, 2026");
    await expect(links[2]!).toContainText("Text, 2 lines");
    // The words are text, not markup.
    await expect(links[2]!).toContainText("FIRST <b>9</b>");
    await expect(links[2]!.locator("b")).toHaveCount(0);
    await expect(p.draftsSection).not.toContainText("No drafts waiting.");
    // Tab reaches the form, then each draft's link.
    const labels = await checkPageState(page);
    expect(labels.slice(0, FORM_CONTROLS.length)).toEqual(FORM_CONTROLS);
    expect(labels.slice(FORM_CONTROLS.length)).toHaveLength(3);
  });

  test("AC-0133: Read text, Read photo, and a draft link work by keyboard alone", async ({ page }) => {
    await model.answer({ reading: [TURKEY_LINES[0]!] }, { reading: [TURKEY_LINES[1]!] });
    const p = await openInvoices(page);
    await p.text.focus();
    await page.keyboard.type(RECEIPT_TEXT);
    await page.keyboard.press("Tab");
    await expect(p.readText).toBeFocused();
    await page.keyboard.press("Enter");
    const first = await draftIdFromUrl(page);

    await openInvoices(page);
    await p.photo.focus();
    await p.photo.setInputFiles(pngFile(300, 200));
    await page.keyboard.press("Tab");
    await expect(p.readPhoto).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page).not.toHaveURL(new RegExp(first));
    const second = await draftIdFromUrl(page);
    expect(second).not.toBe(first);

    await openInvoices(page);
    await p.draftLinks.first().focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/invoices\?draft=/);
  });
});

test.describe("read refusals", () => {
  const sleepless = async (page: Page, press: () => Promise<void>) => {
    const sent = sendsActionRequest(page);
    await press();
    expect(await sent, "a read request left the page").toBe(false);
  };

  const photoRows = [
    { row: "none chosen", file: undefined, message: PHOTO_NONE },
    { row: "a file that is not an image", file: { name: "invoice.png", mimeType: "image/png", buffer: Buffer.from("not an image") }, message: PHOTO_TYPE },
    { row: "a PDF", file: { name: "invoice.jpg", mimeType: "image/jpeg", buffer: Buffer.from("%PDF-1.7 .....") }, message: PHOTO_TYPE },
    { row: "a GIF the browser can decode", file: { name: "invoice.gif", mimeType: "image/gif", buffer: GIF }, message: PHOTO_TYPE },
  ];
  for (const { row, file, message } of photoRows) {
    test(`AC-0012, AC-0135, AC-0136: ${row} is refused beside the Invoice photo field, and nothing is sent`, async ({
      page,
    }) => {
      const p = await openInvoices(page);
      if (file) await p.photo.setInputFiles(file);
      await sleepless(page, () => p.readPhoto.click());
      await expect(p.photoError).toHaveText(message);
      await expect(p.photo).toBeFocused();
      await expect(p.photo).toHaveAttribute("aria-describedby", "invoice-photo-error");
      expect(await draftCount()).toBe(0);
      expect(await model.requests()).toEqual([]);
    });
  }

  const textRows = [
    { row: "a blank text", text: "", message: TEXT_BLANK },
    { row: "a text of only spaces", text: "   \t  ", message: TEXT_BLANK },
    { row: "a text of 2,001 characters", text: "x".repeat(2001), message: TEXT_TOO_LONG },
  ];
  for (const { row, text, message } of textRows) {
    test(`AC-0012, AC-0024, AC-0135, AC-0136: ${row} is refused beside the Receipt text field, and the text stays`, async ({
      page,
    }) => {
      const p = await openInvoices(page);
      await p.text.fill(text);
      await sleepless(page, () => p.readText.click());
      await expect(p.textError).toHaveText(message);
      await expect(p.text).toBeFocused();
      await expect(p.text).toHaveAttribute("aria-describedby", "receipt-text-error");
      await expect(p.text).toHaveValue(text);
      expect(await draftCount()).toBe(0);
      expect(await model.requests()).toEqual([]);
    });
  }

  test("a refusal meets the page-state checks, for each field", async ({ page }) => {
    const p = await openInvoices(page);
    await p.readPhoto.click();
    await expect(p.photoError).toHaveText(PHOTO_NONE);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
    await p.readText.click();
    await expect(p.textError).toHaveText(TEXT_BLANK);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
  });

  test("AC-0012: a replayed read refuses what the browser would, and the 4 MB row fires at its limit", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const p = await openInvoices(page);
    await p.photo.setInputFiles(pngFile(100, 100));
    const sent = await captureAction(page, () => p.readPhoto.click());
    const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const big = (length: number) => Buffer.concat([Buffer.from(header), Buffer.alloc(length - header.length)]);
    const rows: Array<[string, { name: string; mimeType: string; buffer: Buffer }, string]> = [
      ["no bytes", { name: "", mimeType: "application/octet-stream", buffer: Buffer.alloc(0) }, PHOTO_NONE],
      ["bytes that are not an image, claimed as a PNG", { name: "x.png", mimeType: "image/png", buffer: Buffer.from("hello there, not an image") }, PHOTO_TYPE],
      ["a photo of 4,194,305 bytes", { name: "big.png", mimeType: "image/png", buffer: big(4_194_305) }, PHOTO_TOO_LARGE],
    ];
    for (const [which, photo, message] of rows) {
      expect(await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { photo }), which).toContain(message);
    }
    expect(await draftCount()).toBe(0);
    expect(await model.requests()).toEqual([]);
  });

  test("AC-0012: a replayed text read refuses a blank text and a text over 2,000 characters", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const p = await openInvoices(page);
    const sent = await captureAction(page, () => readText(p));
    expect(await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { text: "  " })).toContain(TEXT_BLANK);
    expect(await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { text: "é".repeat(2001) })).toContain(TEXT_TOO_LONG);
    expect(await draftCount()).toBe(0);
    expect(await model.requests()).toEqual([]);
  });
});

// A reading of `count` copies of the first turkey line.
const lines = (count: number) => Array.from({ length: count }, () => TURKEY_LINES[0]!);

const FAILURES: Array<{ ac: string; which: string; answer: FakeAnswer; message: string }> = [
  { ac: "AC-0016", which: "a reading with no line", answer: { reading: [] }, message: NO_LINES },
  { ac: "AC-0017", which: "a reading of 31 lines", answer: { reading: lines(31) }, message: TOO_LONG },
  { ac: "AC-0017", which: "an answer cut off at its output limit", answer: { reading: lines(2), stop_reason: "max_tokens" }, message: TOO_LONG },
  { ac: "AC-0018", which: "a declined read", answer: { reading: [], stop_reason: "refusal" }, message: DECLINED },
  { ac: "AC-0019", which: "a dropped connection", answer: { drop: true }, message: TRY_AGAIN },
  { ac: "AC-0019", which: "status 400", answer: { status: 400 }, message: TRY_AGAIN },
  { ac: "AC-0019", which: "status 429", answer: { status: 429 }, message: TRY_AGAIN },
  { ac: "AC-0019", which: "status 500", answer: { status: 500 }, message: TRY_AGAIN },
  { ac: "AC-0019", which: "status 529", answer: { status: 529 }, message: TRY_AGAIN },
  { ac: "AC-0019", which: "an answer that is not JSON", answer: { text: "I could not read this." }, message: TRY_AGAIN },
  { ac: "AC-0019", which: "a reading with an extra property", answer: { text: JSON.stringify({ lines: [], extra: 1 }) }, message: TRY_AGAIN },
  { ac: "AC-0019", which: "an answer that is not a message", answer: { rawBody: "{}" }, message: TRY_AGAIN },
  { ac: "AC-0020", which: "status 401", answer: { status: 401 }, message: KEY_REFUSED },
  { ac: "AC-0020", which: "status 403", answer: { status: 403 }, message: KEY_REFUSED },
];

test.describe("read failures", () => {
  for (const { ac, which, answer, message } of FAILURES) {
    test(`${ac}, AC-0024, AC-0026, AC-0027, AC-0137: ${which} says so, keeps the text, changes no ledger row, and sends one request`, async ({
      page,
    }) => {
      await model.answer(answer);
      const p = await openInvoices(page);
      const before = await ledgerFingerprints();
      await readText(p);
      await expect(p.textMessage).toHaveText(message);
      await expect(p.textMessage).toBeFocused();
      await expect(p.text).toHaveValue(RECEIPT_TEXT);
      await expect(p.status).toHaveText("");
      expect(await draftCount()).toBe(0);
      expect(await ledgerFingerprints()).toEqual(before);
      expect(await model.requests()).toHaveLength(1);
      expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
    });
  }

  test("a failed photo read shows its message beside the photo form and takes focus", async ({ page }) => {
    await model.answer({ status: 401 });
    const p = await openInvoices(page);
    await p.photo.setInputFiles(pngFile(200, 100));
    await p.readPhoto.click();
    await expect(p.photoMessage).toHaveText(KEY_REFUSED);
    await expect(p.photoMessage).toBeFocused();
    await expect(p.textMessage).toHaveText("");
    expect(await draftCount()).toBe(0);
  });

  test("AC-0022: a read after the session ended says so and sends no request", async ({ page }) => {
    const p = await openInvoices(page);
    await page.context().clearCookies();
    await readText(p);
    await expect(p.textMessage).toHaveText(READ_SIGNED_OUT);
    await expect(p.textMessage).toBeFocused();
    await expect(p.text).toHaveValue(RECEIPT_TEXT);
    expect(await draftCount()).toBe(0);
    expect(await model.requests()).toEqual([]);
  });

  test("AC-0185: a draft write refused after the model answered says why and creates no draft", async ({ page }) => {
    await model.answer({ hold: true, then: TURKEY });
    const p = await openInvoices(page);
    await readText(p);
    await model.waitForRequests(1);
    await query("update products set active = false where code = 'RAW-TOM'");
    await model.release();
    await expect(p.textMessage).toHaveText(
      `The draft wasn't saved. line 1 product ${RAW_TOM_ID} is not an active raw product`,
    );
    await expect(p.textMessage).toBeFocused();
    expect(await draftCount()).toBe(0);
    expect(await lotCount()).toBe(0);
  });
});

test.describe("photos", () => {
  const sizes: Array<[string, number, number, number, number]> = [
    ["a 4,000 x 3,000 px PNG", 4000, 3000, 2576, 1932],
    ["a 3,000 x 4,000 px PNG", 3000, 4000, 1932, 2576],
    ["an 800 x 600 px PNG", 800, 600, 800, 600],
  ];
  for (const [which, width, height, sentWidth, sentHeight] of sizes) {
    test(`AC-0013: ${which} reaches the model as a JPEG of ${sentWidth} x ${sentHeight}`, async ({ page }) => {
      await model.answer(TURKEY);
      const p = await openInvoices(page);
      await p.photo.setInputFiles(pngFile(width, height));
      await p.readPhoto.click();
      await draftIdFromUrl(page);
      const image = sentImage(await onlyRequest());
      expect(image.mediaType).toBe("image/jpeg");
      expect(jpegSize(image.bytes)).toEqual({ width: sentWidth, height: sentHeight });
    });
  }

  test("AC-0008: a photo with a GPS position reaches the model, and the draft keeps it, without EXIF or XMP", async ({
    page,
  }) => {
    await model.answer(TURKEY);
    const p = await openInvoices(page);
    const original = withLocation(await canvasJpeg(page, 1000, 750));
    expect(jpegSize(original)).toEqual({ width: 1000, height: 750 });
    expect(jpegMetadata(original)).toMatchObject({ exif: true, xmp: true });
    await p.photo.setInputFiles({ name: "gps.jpg", mimeType: "image/jpeg", buffer: original });
    await p.readPhoto.click();
    const id = await draftIdFromUrl(page);

    const sent = sentImage(await onlyRequest());
    expect(sent.mediaType).toBe("image/jpeg");
    expect(jpegSize(sent.bytes)).toEqual({ width: 1000, height: 750 });
    expect(jpegMetadata(sent.bytes)).toEqual({ exif: false, xmp: false, app1: 0 });
    const stored = await storedImage(id);
    expect(jpegMetadata(stored)).toEqual({ exif: false, xmp: false, app1: 0 });
    expect(stored.equals(sent.bytes)).toBe(true);
    expect(stored.includes(Buffer.from("Exif"))).toBe(false);
  });

  test("AC-0070 and AC-0055: a replayed photo read sends the bytes it received, typed by their content", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const p = await openInvoices(page);
    await p.photo.setInputFiles(pngFile(100, 100));
    const sent = await captureAction(page, () => p.readPhoto.click());
    await model.answer(TURKEY);
    const bytes = png(600, 400);
    // The request claims a JPEG and a text file name; the content is a PNG.
    const text = await replayWith(playwright, baseURL, sent, OPERATOR_STATE, {
      photo: { name: "claimed.txt", mimeType: "image/jpeg", buffer: bytes },
    });
    expect(text).toContain('"status":"read"');
    const image = sentImage(await onlyRequest());
    expect(image.mediaType).toBe("image/png");
    expect(image.bytes.equals(bytes)).toBe(true);
    const [draft] = await draftRows();
    expect(draft?.capture_image_type).toBe("image/png");
    expect((await storedImage(draft?.id ?? "")).equals(bytes)).toBe(true);
  });
});

test.describe("what the model receives", () => {
  async function textRead(page: Page, p: Parts, text = RECEIPT_TEXT) {
    await model.answer({ reading: [TURKEY_LINES[0]!] });
    await readText(p, text);
    await draftIdFromUrl(page);
    return onlyRequest();
  }

  test("AC-0071: a text read holds the active raw products, the vendors, and the date, and nothing inactive", async ({
    page,
  }) => {
    await query("update products set description = 'Smoked Turkey Drums Tom' where code = '502'");
    const p = await openInvoices(page);
    const request = await textRead(page, p);
    const sent = JSON.stringify(request.body);
    for (const wanted of ["RAW-TOM", "Turkey Drums TOM (raw)", "RAW-CHK", "Chicken Thighs (raw)", "Reyes Meats", "Belmont Poultry", RECEIPT_TEXT]) {
      expect(sent, wanted).toContain(wanted);
    }
    expect(request.body.messages[0]?.content.map((block) => JSON.stringify(block)).join("")).toContain(
      `The device's today: ${await deviceDate(page)}`,
    );
    for (const unwanted of ["RAW-OLD", "Old Turkey", "Smoked Turkey Drums Tom"]) expect(sent, unwanted).not.toContain(unwanted);
  });

  test("AC-0072: a text read holds none of the other data in the database, the session, or the browser", async ({
    page,
    context,
  }) => {
    await query(
      "update vendors set contact_name = 'Sentinel Contact', phone = '555-0199', email = 'sentinel@example.test', notes = 'sentinel vendor note' where id = $1",
      [VENDOR_ID],
    );
    await query("update products set brand = 'Sentinel Brand' where id = $1", [RAW_TOM_ID]);
    await query("insert into customers(name) values ('Sentinel Customer')");
    // The lot goes through the operation, as every lot does.
    await receiveLot(await signInOperator(), {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 100,
      unitCost: 9.8765,
      received: "2026-10-01",
      lotNumber: "L-SENTINEL",
      notes: "sentinel lot note",
    });
    const p = await openInvoices(page);
    const cookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
    expect(cookies.length).toBeGreaterThan(0);
    const session = readSession(cookies);
    const sentinels = [
      "Sentinel Contact",
      "555-0199",
      "sentinel@example.test",
      "sentinel vendor note",
      "Sentinel Brand",
      "L-SENTINEL",
      "9.8765",
      "sentinel lot note",
      "Sentinel Customer",
      OPERATOR_EMAIL,
      resolveStackEnv().anonKey,
      session.access_token,
      session.refresh_token,
      ...cookies.map((cookie) => cookie.value),
    ];
    const request = await textRead(page, p);
    const sent = JSON.stringify({ headers: request.headers, body: request.body });
    for (const sentinel of sentinels) expect(sent, sentinel.slice(0, 24)).not.toContain(sentinel);
  });

  test("AC-0073 and AC-0074: the body and settings are fixed, and only the key authorizes the request", async ({ page }) => {
    const p = await openInvoices(page);
    const { body, headers } = await textRead(page, p);
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.max_tokens).toBe(16000);
    expect(Object.keys(body.output_config).sort()).toEqual(["effort", "format"]);
    expect(body.output_config.effort).toBe("medium");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(headers["anthropic-beta"]).toBeUndefined();
    expect(headers["x-api-key"]).toBe(ANTHROPIC_TEST_KEY);
    expect(headers.authorization).toBeUndefined();
    expect(JSON.stringify({ headers, body })).not.toContain(ANTHROPIC_TEST_AUTH_TOKEN);
  });

  test("AC-0029: the system text is fixed across reads and catalogs, and holds none of the typed text", async ({ page }) => {
    const p = await openInvoices(page);
    await model.answer({ reading: [TURKEY_LINES[0]!] }, { reading: [TURKEY_LINES[1]!] });
    const typed = "unique typed words 8841";
    await readText(p, typed);
    await draftIdFromUrl(page);
    await query("insert into products(code, description, species, kind) values ('RAW-NEW', 'New Raw Product', 'Turkey', 'raw')");
    const again = await openInvoices(page);
    await again.photo.setInputFiles(pngFile(200, 100));
    await again.readPhoto.click();
    await expect.poll(async () => (await model.requests()).length).toBe(2);
    const [first, second] = await model.requests();
    expect(JSON.stringify(first!.body.messages)).not.toContain("RAW-NEW");
    expect(JSON.stringify(second!.body.messages)).toContain("RAW-NEW");
    expect(typeof first!.body.system).toBe("string");
    expect(first!.body.system).toBe(second!.body.system);
    expect(first!.body.system).not.toContain(typed);
    expect(first!.body.system.length).toBeGreaterThan(100);
  });

  test("AC-0184: no header value holds this machine's host name, operating system, architecture, or Node version", async ({
    page,
  }) => {
    const p = await openInvoices(page);
    const { headers } = await textRead(page, p);
    const squash = (text: string) => text.toLowerCase().replaceAll(/\s+/g, "");
    const machine = [
      os.hostname(),
      os.type(),
      os.platform(),
      "macOS",
      "Windows",
      "Linux",
      os.arch(),
      process.version,
      process.version.replace(/^v/, ""),
      // Every value the SDK can write for the operating system's name.
      "MacOS",
      "FreeBSD",
      "OpenBSD",
      "iOS",
      "Android",
      "Unknown",
    ];
    for (const [name, value] of Object.entries(headers)) {
      for (const word of machine) expect(squash(value), `${name} holds ${word}`).not.toContain(squash(word));
    }
    expect(Object.keys(headers).filter((name) => name.startsWith("x-stainless"))).toEqual([]);
    expect(headers["user-agent"]).not.toMatch(/Anthropic/i);
  });

  test("AC-0075: no response in any page state carries the key, and no static file does", async ({ page }) => {
    const bodies: Array<Promise<string>> = [];
    page.on("response", (response) => {
      bodies.push(response.body().then((buffer) => buffer.toString("latin1")).catch(() => ""));
    });
    await model.answer({ status: 401 }, TURKEY);
    const p = await openInvoices(page);
    await readText(p);
    await expect(p.textMessage).toHaveText(KEY_REFUSED);
    await readText(p);
    await draftIdFromUrl(page);
    await page.goto("/invoices");
    const seen = await Promise.all(bodies);
    expect(seen.length).toBeGreaterThan(3);
    for (const body of seen) {
      expect(body).not.toContain(ANTHROPIC_TEST_KEY);
      expect(body).not.toContain(ANTHROPIC_TEST_AUTH_TOKEN);
    }

    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
      );
    const files = walk(join(process.cwd(), ".next", "static"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file);
      expect(content.includes(ANTHROPIC_TEST_KEY), file).toBe(false);
      expect(content.includes(ANTHROPIC_TEST_AUTH_TOKEN), file).toBe(false);
    }
  });
});

test.describe("an app started without a usable key or address", () => {
  test("AC-0021: an empty key says reading isn't set up, sends nothing, and logs one line", async ({
    browser,
    baseURL,
  }) => {
    const spare = await startSpare(ports(baseURL).spare, {
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_BASE_URL: model.base,
    });
    const context = await browser.newContext({ baseURL: spare.url, storageState: OPERATOR_STATE });
    try {
      const page = await context.newPage();
      const p = await openInvoices(page);
      await readText(p);
      await expect(p.textMessage).toHaveText(NOT_SET_UP);
      await expect(p.textMessage).toBeFocused();
      await expect(p.text).toHaveValue(RECEIPT_TEXT);
      expect(await draftCount()).toBe(0);
      expect(await model.requests()).toEqual([]);
      await expect.poll(() => spare.output().split("readInvoice failed").length - 1).toBe(1);
      expect(spare.output()).toContain("readInvoice failed: kind=not-set-up\n");
      expect(spare.output()).not.toContain(RECEIPT_TEXT);
    } finally {
      await context.close();
      await spare.stop();
    }
  });

  test("the SDK's own environment switches change nothing a read sends or logs (AC-0074, AC-0175, AC-0184)", async ({
    browser,
    baseURL,
  }) => {
    const spare = await startSpare(ports(baseURL).spare, {
      ANTHROPIC_API_KEY: ANTHROPIC_TEST_KEY,
      ANTHROPIC_BASE_URL: model.base,
      ANTHROPIC_AUTH_TOKEN: ANTHROPIC_TEST_AUTH_TOKEN,
      ANTHROPIC_WEBHOOK_SIGNING_KEY: "whsec-webhook-sentinel",
      ANTHROPIC_LOG: "debug",
      ANTHROPIC_CUSTOM_HEADERS: "X-Machine-Secret: custom-header-sentinel",
    });
    const context = await browser.newContext({ baseURL: spare.url, storageState: OPERATOR_STATE });
    try {
      await model.answer({ reading: [TURKEY_LINES[0]!] });
      const page = await context.newPage();
      const p = await openInvoices(page);
      await readText(p);
      await draftIdFromUrl(page);
      const { headers, body } = await onlyRequest();
      expect(headers["x-api-key"]).toBe(ANTHROPIC_TEST_KEY);
      expect(headers.authorization).toBeUndefined();
      expect(headers["x-machine-secret"]).toBeUndefined();
      expect(JSON.stringify({ headers, body })).not.toContain("custom-header-sentinel");
      const output = spare.output();
      for (const secret of [RECEIPT_TEXT, "Turkey Drums TOM (raw)", ANTHROPIC_TEST_KEY, ANTHROPIC_TEST_AUTH_TOKEN, "custom-header-sentinel", "whsec-webhook-sentinel"]) {
        expect(output, secret).not.toContain(secret);
      }
      expect(output).not.toMatch(/log_[0-9a-f]{6}/);
    } finally {
      await context.close();
      await spare.stop();
    }
  });

  test("AC-0028: a key and an address that is not loopback says reading isn't set up, sends nothing, and logs one line", async ({
    browser,
    baseURL,
  }) => {
    const spare = await startSpare(ports(baseURL).spare, {
      ANTHROPIC_API_KEY: ANTHROPIC_TEST_KEY,
      ANTHROPIC_BASE_URL: "https://example.com",
    });
    const context = await browser.newContext({ baseURL: spare.url, storageState: OPERATOR_STATE });
    try {
      const page = await context.newPage();
      const p = await openInvoices(page);
      await readText(p);
      await expect(p.textMessage).toHaveText(ADDRESS_REFUSED);
      await expect(p.textMessage).toBeFocused();
      expect(await draftCount()).toBe(0);
      expect(await model.requests()).toEqual([]);
      await expect.poll(() => spare.output().split("readInvoice failed").length - 1).toBe(1);
      expect(spare.output()).toContain("readInvoice failed: kind=address-refused\n");
      expect(spare.output()).not.toContain(ANTHROPIC_TEST_KEY);
    } finally {
      await context.close();
      await spare.stop();
    }
  });
});

// ---- Reviewing, saving, and discarding a draft ----

const TOM_LABEL = "RAW-TOM Turkey Drums TOM (raw)";
const NAV_CONTROLS = FORM_CONTROLS.slice(0, 6);

// The turkey reading's two lines as a waiting draft holds them.
const TURKEY_SEED: SeedLine[] = [
  { words: "TKY DRUMS 40#" },
  { words: "TKY DRUMS 40#", weight_lbs: "3000", unit_cost: "1.80", received_date: "2026-10-05" },
];

const TURKEY_VALUES = [
  { ticked: true, product: TOM_LABEL, vendor: "Reyes Meats", weight: "5000", cost: "1.68", date: "2026-10-01" },
  { ticked: true, product: TOM_LABEL, vendor: "Reyes Meats", weight: "3000", cost: "1.8", date: "2026-10-05" },
];

async function lineIds(draftId: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    "select id from import_draft_lines where import_draft_id = $1 order by line_no",
    [draftId],
  );
  return rows.map((row) => row.id);
}

// Saves some of a draft's lines at the engine, as another session would.
async function confirmAtEngine(draftId: string, count: number): Promise<void> {
  const ids = (await lineIds(draftId)).slice(0, count);
  const outcome = await callAsOperator({
    fn: "confirm_import_draft",
    args: {
      p_draft_id: draftId,
      p_lines: JSON.stringify(
        ids.map((id) => ({
          line_id: id,
          product_id: RAW_TOM_ID,
          vendor_id: VENDOR_ID,
          weight_lbs: "5000",
          unit_cost: "1.68",
          received_date: "2026-10-01",
        })),
      ),
    },
  });
  expect(outcome.ok, outcome.error).toBe(true);
}

async function discardAtEngine(draftId: string): Promise<void> {
  const outcome = await callAsOperator({ fn: "discard_import_draft", args: { p_draft_id: draftId } });
  expect(outcome.ok, outcome.error).toBe(true);
}

// Stops every server action request the page sends from now on, as a dropped connection would.
async function dropActions(page: Page): Promise<void> {
  await page.route("**/invoices**", async (route) => {
    const request = route.request();
    if (request.method() === "POST" && "next-action" in request.headers()) await route.abort();
    else await route.continue();
  });
}

test.describe("the draft review", () => {
  test("AC-0011 and AC-0079: a photo read opens a review with both lines filled and the stored photo", async ({
    page,
  }) => {
    await model.answer(TURKEY);
    const p = await openInvoices(page);
    await p.photo.setInputFiles(pngFile(600, 400));
    await p.readPhoto.click();
    const id = await draftIdFromUrl(page);
    const r = review(page);
    await expect(r.heading).toBeVisible();
    await expect(r.line(1).words).toHaveText("Invoice says: TKY DRUMS 40#");
    await expect(r.line(2).words).toHaveText("Invoice says: TKY DRUMS 40#");
    await expect(r.groups).toHaveCount(2);
    expect(await reviewValues(r, 2)).toEqual(TURKEY_VALUES);
    await expect(r.photo).toBeVisible();
    await expect(r.photo).toHaveAttribute("src", `/invoices/photo/${id}`);
    await expect
      .poll(() => r.photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
      .toBe(true);
    await expect(r.typed).toHaveCount(0);
    expect(await lotCount()).toBe(0);
  });

  test("AC-0015 and AC-0079: a text read opens a review that shows the typed text as written", async ({ page }) => {
    await model.answer({ reading: [TURKEY_LINES[0]!] });
    const p = await openInvoices(page);
    await readText(p);
    await draftIdFromUrl(page);
    const r = review(page);
    await expect(r.typed).toBeVisible();
    await expect(page.getByText(RECEIPT_TEXT, { exact: true })).toBeVisible();
    await expect(r.photo).toHaveCount(0);
    await expect(r.groups).toHaveCount(1);
    expect(await reviewValues(r, 1)).toEqual([TURKEY_VALUES[0]]);
  });

  test("AC-0076: each line is a group with its words, a ticked checkbox, and its five fields", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await expect(r.groups).toHaveCount(2);
    for (const n of [1, 2]) {
      const line = r.line(n);
      await expect(line.group.locator("legend")).toHaveText(`Line ${n}`);
      await expect(line.words).toBeVisible();
      await expect(line.tick).toBeChecked();
      for (const control of [line.product, line.vendor, line.weight, line.cost, line.date]) {
        await expect(control).toBeVisible();
      }
    }
    await expect(r.save).toBeVisible();
    await expect(r.discard).toBeVisible();
    await expect(r.line(1).date).toHaveAttribute("type", "date");
  });

  test("AC-0077 and AC-0078: the pickers list the active products and the vendors in order, and a blank drafted field asks for entry", async ({
    page,
  }) => {
    await query(
      `insert into products(code, description, kind) values ('100', 'Hundred (raw)', 'raw'), ('20', 'Twenty (raw)', 'raw');
       insert into vendors(name) values ('acme foods')`,
    );
    const id = await seedLines([
      { words: "FILLED" },
      { words: "BLANK", product_id: null, vendor_id: null, weight_lbs: null, unit_cost: null, received_date: null },
    ]);
    const r = await openReview(page, id);
    const products = [
      "Choose a product",
      "100 Hundred (raw)",
      "20 Twenty (raw)",
      "RAW-CHK Chicken Thighs (raw)",
      TOM_LABEL,
    ];
    const vendors = ["Choose a vendor", "acme foods", "Belmont Poultry", "Reyes Meats"];
    for (const n of [1, 2]) {
      expect(await r.line(n).product.locator("option").allInnerTexts()).toEqual(products);
      expect(await r.line(n).vendor.locator("option").allInnerTexts()).toEqual(vendors);
    }
    expect(await reviewValues(r, 2)).toEqual([
      TURKEY_VALUES[0],
      { ticked: true, product: "Choose a product", vendor: "Choose a vendor", weight: "", cost: "", date: "" },
    ]);
    await expect(r.line(1).hints).toHaveCount(0);
    await expect(r.line(2).hints).toHaveCount(5);
    // The note is beside the field it names, and the field points at it.
    await expect(r.line(2).weight).toHaveAttribute("aria-describedby", "line-2-weight-hint");
    await expect(page.locator("#line-2-weight-hint")).toHaveText(ENTER_FROM_INVOICE);
    await r.line(2).weight.fill("12");
    await expect(r.line(2).hints).toHaveCount(4);
  });

  test("AC-0077: a drafted product that is no longer active starts on Choose a product", async ({ page }) => {
    const id = await seedLines([{ words: "OLD", product_id: RAW_CHK_ID }]);
    await query("update products set active = false where code = 'RAW-CHK'");
    const r = await openReview(page, id);
    expect((await reviewValues(r, 1))[0]?.product).toBe("Choose a product");
    await expect(r.line(1).hints).toHaveCount(1);
  });

  test("AC-0080: invoice words show as literal text and add no element", async ({ page }) => {
    const id = await seedLines([{ words: "<b>9</b>" }]);
    const r = await openReview(page, id);
    await expect(r.line(1).words).toHaveText("Invoice says: <b>9</b>");
    await expect(page.locator("main b")).toHaveCount(0);
  });

  test("AC-0079: typed text shows as literal text under You typed", async ({ page }) => {
    const id = await seedLines([{ words: "A" }], { text: "5 lbs <i>x</i>\nsecond line" });
    const r = await openReview(page, id);
    await expect(r.typed).toBeVisible();
    await expect(page.locator("main i")).toHaveCount(0);
    await expect(page.getByText("5 lbs <i>x</i>")).toBeVisible();
  });

  test("AC-0093: the review of a saved draft says so, lists its lot numbers, and has no field or button", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    await confirmAtEngine(id, 2);
    const numbers = (await lotRows()).map((lot) => lot.lot_number);
    expect(numbers).toHaveLength(2);
    await page.goto(`/invoices?draft=${id}`);
    const r = review(page);
    await expect(page.getByText("This draft was saved.", { exact: true })).toBeVisible();
    for (const number of numbers) await expect(page.getByText(number, { exact: true })).toBeVisible();
    await expect(r.section.locator("input, select, textarea, button")).toHaveCount(0);
    await expect(r.photo).toHaveCount(0);
    await expect(page.getByText("TKY DRUMS 40#")).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
  });

  test("AC-0105: the review of a discarded draft says so and shows no photo, text, words, field, or button", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED, { source: "photo" });
    await discardAtEngine(id);
    await page.goto(`/invoices?draft=${id}`);
    const r = review(page);
    await expect(page.getByText("This draft was discarded.", { exact: true })).toBeVisible();
    await expect(r.section.locator("input, select, textarea, button, img")).toHaveCount(0);
    await expect(page.getByText("TKY DRUMS 40#")).toHaveCount(0);
    await expect(r.typed).toHaveCount(0);
    await expect(r.groups).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
  });

  test("AC-0094: an id that names no draft says so and shows the id as literal text", async ({ page }) => {
    for (const id of [ZERO_ID, "<b>not an id</b>", "x".repeat(300)]) {
      await page.goto(`/invoices?draft=${encodeURIComponent(id)}`);
      await expect(page.getByText("No draft has this id.", { exact: true })).toBeVisible();
      await expect(page.getByText(id, { exact: true })).toBeVisible();
      await expect(page.locator("main b")).toHaveCount(0);
      expect(await checkPageState(page)).toEqual(NAV_CONTROLS);
    }
  });

  test("a waiting draft's review meets the page-state checks, for a photo and for a text", async ({ page }) => {
    const photo = await seedLines(TURKEY_SEED, { source: "photo" });
    const r = await openReview(page, photo);
    await expect.poll(() => r.photo.evaluate((img: HTMLImageElement) => img.complete)).toBe(true);
    expect(await checkPageState(page)).toEqual(reviewControls(2));
    const text = await seedLines(TURKEY_SEED);
    await openReview(page, text);
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0138: the Weight and Cost fields are named for lbs and per lb, inside their line's group", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await expect(page.getByRole("textbox", { name: /lbs/ })).toHaveCount(2);
    await expect(page.getByRole("textbox", { name: /per lb/ })).toHaveCount(2);
    for (const n of [1, 2]) {
      const group = r.line(n).group;
      await expect(group.getByRole("textbox", { name: /lbs/ })).toHaveCount(1);
      await expect(group.getByRole("textbox", { name: /per lb/ })).toHaveCount(1);
      await expect(group.getByRole("checkbox", { name: "Save this line" })).toHaveCount(1);
      await expect(group.getByRole("combobox")).toHaveCount(2);
    }
  });
});

test.describe("the photo address", () => {
  test("AC-0081: an operator gets the stored bytes with their type, nosniff, and no caching", async ({
    page,
    request,
  }) => {
    await model.answer(TURKEY);
    const p = await openInvoices(page);
    await p.photo.setInputFiles(pngFile(600, 400));
    await p.readPhoto.click();
    const id = await draftIdFromUrl(page);
    const response = await request.get(`/invoices/photo/${id}`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/jpeg");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    expect((await response.body()).equals(await storedImage(id))).toBe(true);
  });

  test("AC-0081: a PNG draft is served as a PNG", async ({ request }) => {
    const id = await seedLines(TURKEY_SEED, { source: "photo" });
    const response = await request.get(`/invoices/photo/${id}`);
    expect(response.headers()["content-type"]).toBe("image/png");
    expect((await response.body()).equals(png(4, 4))).toBe(true);
  });

  test("AC-0099: a signed-out visitor gets no image bytes", async ({ playwright, baseURL }) => {
    const id = await seedLines(TURKEY_SEED, { source: "photo" });
    const visitor = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      for (const maxRedirects of [0, 5]) {
        const response = await visitor.get(`/invoices/photo/${id}`, { maxRedirects });
        expect(response.headers()["content-type"] ?? "").not.toMatch(/^image\//);
        expect((await response.body()).includes(png(4, 4))).toBe(false);
      }
      expect((await visitor.get(`/invoices/photo/${id}`, { maxRedirects: 0 })).status()).toBe(307);
    } finally {
      await visitor.dispose();
    }
  });

  test("AC-0099: a non-operator, an unknown id, a malformed id, a text draft, and a discarded draft get a bare 404", async ({
    playwright,
    baseURL,
    request,
  }) => {
    const photo = await seedLines(TURKEY_SEED, { source: "photo" });
    const text = await seedLines(TURKEY_SEED);
    const gone = await seedLines(TURKEY_SEED, { source: "photo" });
    await discardAtEngine(gone);
    const outsider = await playwright.request.newContext({ baseURL, storageState: NON_OPERATOR_STATE });
    try {
      const cases: Array<[string, typeof request, string]> = [
        ["a non-operator", outsider, photo],
        ["an unknown id", request, ZERO_ID],
        ["a malformed id", request, "<b>nope</b>"],
        ["a text draft", request, text],
        ["a discarded draft", request, gone],
      ];
      for (const [which, client, id] of cases) {
        const response = await client.get(`/invoices/photo/${encodeURIComponent(id)}`);
        expect(response.status(), which).toBe(404);
        expect(await response.body(), which).toHaveLength(0);
        expect(response.headers()["content-type"] ?? "", which).not.toMatch(/^image\//);
      }
    } finally {
      await outsider.dispose();
    }
  });
});

test.describe("saving a draft", () => {
  test("AC-0082, AC-0107, AC-0100, AC-0098, AC-0134, AC-0104: saving both lines shows the lots and the stock, and the draft leaves the list", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.save.click();
    const heading = r.result.getByRole("heading", { name: "Saved 2 receipts." });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    expect(await draftStatus(id)).toBe("confirmed");

    const lots = await lotRows();
    expect(lots).toEqual([
      {
        lot_number: expect.any(String),
        product: "RAW-TOM",
        vendor: "Reyes Meats",
        weight: "5000.000",
        cost: "1.6800",
        received: "2026-10-01",
      },
      {
        lot_number: expect.any(String),
        product: "RAW-TOM",
        vendor: "Reyes Meats",
        weight: "3000.000",
        cost: "1.8000",
        received: "2026-10-05",
      },
    ]);
    const items = r.result.getByRole("listitem");
    await expect(items).toHaveCount(2);
    const shown = [
      { weight: "5,000 lbs", cost: "$1.6800/lb", received: "Oct 1, 2026" },
      { weight: "3,000 lbs", cost: "$1.8000/lb", received: "Oct 5, 2026" },
    ];
    for (const [i, expected] of shown.entries()) {
      const item = items.nth(i);
      await expect(factValue(item, "Lot number")).toHaveText(lots[i]!.lot_number);
      await expect(factValue(item, "Product")).toHaveText(TOM_LABEL);
      await expect(factValue(item, "Vendor")).toHaveText("Reyes Meats");
      await expect(factValue(item, "Weight")).toHaveText(expected.weight);
      await expect(factValue(item, "Cost per lb")).toHaveText(expected.cost);
      await expect(factValue(item, "Received")).toHaveText(expected.received);
    }
    await expect(beforeAfter(r.result, /^On hand/)).toHaveText(["0 lbs", "8,000 lbs"]);
    await expect(beforeAfter(r.result, /^Average cost/)).toHaveText(["None yet", "$1.7250/lb"]);
    await expect(r.result.getByRole("columnheader", { name: TOM_LABEL })).toBeVisible();
    // The fields and buttons give way to the result.
    await expect(r.save).toHaveCount(0);
    await expect(r.groups).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);

    // AC-0104: the list no longer holds it.
    const p = await openInvoices(page);
    await expect(p.draftLinks).toHaveCount(0);
    await expect(p.draftsSection).toContainText("No drafts waiting.");
  });

  test("AC-0082: saving one line says Saved 1 receipt.", async ({ page }) => {
    const id = await seedLines([{ words: "ONE" }]);
    const r = await openReview(page, id);
    await r.save.click();
    await expect(r.result.getByRole("heading", { name: "Saved 1 receipt." })).toBeFocused();
    expect(await lotCount()).toBe(1);
  });

  test("AC-0100: two products show their own stock before and after", async ({ page }) => {
    const id = await seedLines([
      { words: "TOM" },
      { words: "CHK", product_id: RAW_CHK_ID, weight_lbs: "250", unit_cost: "3.5" },
    ]);
    const r = await openReview(page, id);
    await r.save.click();
    await expect(r.result.getByRole("heading", { name: "Saved 2 receipts." })).toBeFocused();
    const tables = r.result.getByRole("table");
    await expect(tables).toHaveCount(2);
    const chk = tables.filter({ hasText: "RAW-CHK Chicken Thighs (raw)" });
    await expect(chk.getByRole("row", { name: /^On hand/ }).getByRole("cell")).toHaveText(["0 lbs", "250 lbs"]);
    const tom = tables.filter({ hasText: TOM_LABEL });
    await expect(tom.getByRole("row", { name: /^Average cost/ }).getByRole("cell")).toHaveText([
      "None yet",
      "$1.6800/lb",
    ]);
    expect((await lotRows()).map((lot) => lot.product)).toEqual(["RAW-TOM", "RAW-CHK"]);
  });

  test("AC-0091: a saved lot carries the values in the fields when Save was pressed", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    const line = r.line(1);
    await line.product.selectOption({ label: "RAW-CHK Chicken Thighs (raw)" });
    await line.vendor.selectOption({ label: "Belmont Poultry" });
    await line.weight.fill("4000.125");
    await line.cost.fill("1.6855");
    await line.date.fill("2026-10-02");
    await r.save.click();
    await expect(r.result.getByRole("heading", { name: "Saved 2 receipts." })).toBeFocused();
    // The engine enters lots by product id, then line number; the result lists them by line.
    expect(await lotRows()).toEqual([
      {
        lot_number: expect.any(String),
        product: "RAW-TOM",
        vendor: "Reyes Meats",
        weight: "3000.000",
        cost: "1.8000",
        received: "2026-10-05",
      },
      {
        lot_number: expect.any(String),
        product: "RAW-CHK",
        vendor: "Belmont Poultry",
        weight: "4000.125",
        cost: "1.6855",
        received: "2026-10-02",
      },
    ]);
    const first = r.result.getByRole("listitem").first();
    await expect(factValue(first, "Weight")).toHaveText("4,000.125 lbs");
    await expect(factValue(first, "Cost per lb")).toHaveText("$1.6855/lb");
  });

  test("AC-0090: an unticked line with a blank weight is not checked, not sent, and not saved", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.line(2).tick.uncheck();
    await r.line(2).weight.fill("");
    const sent = await captureAction(page, () => r.save.click());
    const names = parseParts(sent).map((part) => part.name);
    // The unticked line (position 1) sends its id and nothing else.
    expect(names.filter((name) => /^_1_(save|product|vendor|weight|cost|date)\.1$/.test(name))).toEqual([]);
    expect(names.filter((name) => name === "_1_lineId")).toHaveLength(2);
    expect(names).toContain("_1_weight.0");

    // The captured request was stopped; save for real.
    await page.reload();
    const again = review(page);
    await again.line(2).tick.uncheck();
    await again.line(2).weight.fill("");
    await again.save.click();
    await expect(again.result.getByRole("heading", { name: "Saved 1 receipt." })).toBeFocused();
    expect(await lotRows()).toEqual([
      {
        lot_number: expect.any(String),
        product: "RAW-TOM",
        vendor: "Reyes Meats",
        weight: "5000.000",
        cost: "1.6800",
        received: "2026-10-01",
      },
    ]);
    expect((await lineRows(id)).map((line) => line.status)).toEqual(["saved", "skipped"]);
  });

  // The AC-0083 table: each input Receiving's AC-0010 refuses, on a ticked line.
  const WEIGHT_FORMAT = "Enter the weight in lbs, like 5000 or 32.5.";
  const WEIGHT_PLACES = "Use at most 3 decimal places for weight.";
  const COST_FORMAT = "Enter the cost per lb, like 1.68.";
  type Field = "product" | "vendor" | "weight" | "cost" | "date";
  const RULES: Array<[Field, string, string]> = [
    ["product", "", "Choose a product."],
    ["vendor", "", "Choose a vendor."],
    ["weight", "", WEIGHT_FORMAT],
    ["weight", "5,000", WEIGHT_FORMAT],
    ["weight", "-5", WEIGHT_FORMAT],
    ["weight", "1.2345", WEIGHT_PLACES],
    ["weight", "0.0000", WEIGHT_PLACES],
    ["weight", "0", "Weight must be above 0."],
    ["weight", "0.0", "Weight must be above 0."],
    ["weight", "000", "Weight must be above 0."],
    ["cost", "", COST_FORMAT],
    ["cost", "-1", COST_FORMAT],
    ["cost", "1.68555", "Use at most 4 decimal places for cost."],
    ["date", "", "Enter the received date."],
    ["date", "TOMORROW", "The received date can't be after today."],
  ];

  for (const [field, input, message] of RULES) {
    test(`AC-0083, AC-0089, AC-0135, AC-0136: ${field} ${JSON.stringify(input)} on a ticked line is refused beside its field`, async ({
      page,
    }) => {
      const id = await seedLines(TURKEY_SEED);
      const r = await openReview(page, id);
      const control = r.line(2)[field];
      if (field === "product") await control.selectOption({ label: "Choose a product" });
      else if (field === "vendor") await control.selectOption({ label: "Choose a vendor" });
      else if (field === "date") await control.fill(input === "TOMORROW" ? await deviceDate(page, 1) : input);
      else await control.fill(input);
      const typed = await reviewValues(r, 2);
      await r.save.click();

      const errorId = `line-2-${field}-error`;
      await expect(page.locator(`#${errorId}`)).toHaveText(message);
      await expect(control).toHaveAttribute("aria-describedby", errorId);
      await expect(control).toHaveAttribute("aria-invalid", "true");
      await expect(control).toBeFocused();
      await expect(page.locator("[aria-invalid=true]")).toHaveCount(1);
      expect(await reviewValues(r, 2)).toEqual(typed);
      expect(await lotCount()).toBe(0);
      expect(await draftStatus(id)).toBe("pending");
    });
  }

  test("AC-0083, AC-0135, AC-0136: with several errors, focus is on the first field and each points to its message", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.line(2).weight.fill("");
    await r.line(2).cost.fill("x");
    await r.line(1).vendor.selectOption({ label: "Choose a vendor" });
    await r.save.click();
    const expected: Array<[Locator, string, string]> = [
      [r.line(1).vendor, "line-1-vendor", "Choose a vendor."],
      [r.line(2).weight, "line-2-weight", WEIGHT_FORMAT],
      [r.line(2).cost, "line-2-cost", COST_FORMAT],
    ];
    for (const [control, fieldId, message] of expected) {
      await expect(control).toHaveAttribute("aria-describedby", `${fieldId}-error`);
      await expect(page.locator(`#${fieldId}-error`)).toHaveText(message);
    }
    await expect(r.line(1).vendor).toBeFocused();
    await expect(page.locator("[aria-invalid=true]")).toHaveCount(3);
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0083: an unticked line's bad values are not refused", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.line(2).tick.uncheck();
    await r.line(2).product.selectOption({ label: "Choose a product" });
    await r.line(2).weight.fill("abc");
    await r.save.click();
    await expect(r.result.getByRole("heading", { name: "Saved 1 receipt." })).toBeFocused();
  });

  test("AC-0084, AC-0089, AC-0137: no ticked line says to tick one, saves nothing, and keeps the fields", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.line(1).tick.uncheck();
    await r.line(2).tick.uncheck();
    const typed = await reviewValues(r, 2);
    await r.save.click();
    await expect(r.message).toHaveText("Tick at least one line to save.");
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0085, AC-0089, AC-0137: a product made inactive after the review loaded names its line and saves nothing", async ({
    page,
  }) => {
    const id = await seedLines([{ words: "CHK", product_id: RAW_CHK_ID }, { words: "TOM" }]);
    const r = await openReview(page, id);
    await query("update products set active = false where code = 'RAW-TOM'");
    const typed = await reviewValues(r, 2);
    await r.save.click();
    await expect(r.message).toHaveText(`${NOT_SAVED} Line 2: This product is no longer active.`);
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    expect(await draftStatus(id)).toBe("pending");
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0086, AC-0089, AC-0137: a draft discarded after the review loaded says so", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await discardAtEngine(id);
    const typed = await reviewValues(r, 2);
    await r.save.click();
    await expect(r.message).toHaveText(`${NOT_SAVED} This draft was already saved or discarded.`);
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0086: a draft saved after the review loaded says so, and is saved once", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await confirmAtEngine(id, 1);
    await r.save.click();
    await expect(r.message).toHaveText(`${NOT_SAVED} This draft was already saved or discarded.`);
    expect(await lotCount()).toBe(1);
  });

  test("AC-0088, AC-0089, AC-0137: an ended session says to sign in again, saves nothing, and keeps the fields", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.line(2).weight.fill("2999");
    await page.context().clearCookies();
    const typed = await reviewValues(r, 2);
    await r.save.click();
    await expect(r.message).toHaveText(SAVE_SIGNED_OUT);
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0116 path: a save whose request is dropped keeps the fields and says the receipts may have been saved", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.line(1).weight.fill("4999");
    await dropActions(page);
    const typed = await reviewValues(r, 2);
    await r.save.click();
    await expect(r.message).toHaveText(SAVE_UNKNOWN);
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await lotCount()).toBe(0);
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0003, AC-0059, AC-0087, AC-0088: a save replayed with no session or a non-operator's changes nothing; a bad line id shows the engine's text", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    const sent = await captureAction(page, () => r.save.click());
    const before = await allFingerprints();
    const message = (text: string) => `"message":"${text}"`;

    const replays = [
      { who: "no session", storageState: undefined, message: SAVE_SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: NOT_ALLOWED_SAVE },
    ];
    for (const { who, storageState, message: expected } of replays) {
      expect(await replayWith(playwright, baseURL, sent, storageState), `response for ${who}`).toContain(
        message(expected),
      );
      expect(await allFingerprints(), `tables after ${who}`).toEqual(before);
    }

    // AC-0059: the operator's session, a line id that names no line of the draft.
    const bad = await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { lineId: ZERO_ID });
    expect(bad).toContain(message(`${NOT_SAVED} line ${ZERO_ID} is not in this draft`));
    expect(await allFingerprints()).toEqual(before);

    // The browser's rules run again on the server: a blank weight is refused there too.
    const blank = await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { "weight.0": "" });
    expect(blank).toContain('"status":"invalid"');
    expect(blank).toContain("Enter the weight in lbs, like 5000 or 32.5.");
    expect(await allFingerprints()).toEqual(before);
  });

  test("AC-0133: a line checkbox, Save receipts, and Discard draft work by keyboard alone", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.line(1).tick.focus();
    await page.keyboard.press("Space");
    await expect(r.line(1).tick).not.toBeChecked();
    await page.keyboard.press("Space");
    await expect(r.line(1).tick).toBeChecked();
    await r.save.focus();
    await page.keyboard.press("Enter");
    await expect(r.result.getByRole("heading", { name: "Saved 2 receipts." })).toBeFocused();

    const other = await seedLines(TURKEY_SEED);
    const second = await openReview(page, other);
    await second.discard.focus();
    await page.keyboard.press("Space");
    await expect(second.result.getByText("Draft discarded.", { exact: true })).toBeFocused();
    expect(await draftStatus(other)).toBe("discarded");
  });

  test("a second press of Save while the first is pending writes the lots once", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await r.save.click();
    await r.save.click({ force: true, timeout: 1000 }).catch(() => undefined);
    await expect(r.result.getByRole("heading", { name: "Saved 2 receipts." })).toBeFocused();
    expect(await lotCount()).toBe(2);
  });
});

test.describe("discarding a draft", () => {
  test("AC-0092, AC-0134, AC-0104, AC-0105: Discard draft says so, clears the draft, and removes it from the list", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED, { source: "photo" });
    const r = await openReview(page, id);
    await r.discard.click();
    const done = r.result.getByText("Draft discarded.", { exact: true });
    await expect(done).toBeVisible();
    await expect(done).toBeFocused();
    expect(await draftStatus(id)).toBe("discarded");
    const [row] = await query<{ capture_image: unknown; capture_image_type: unknown }>(
      "select capture_image, capture_image_type from import_drafts where id = $1",
      [id],
    );
    expect(row).toEqual({ capture_image: null, capture_image_type: null });
    expect(await lotCount()).toBe(0);
    await expect(r.save).toHaveCount(0);
    await expect(r.groups).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(NAV_CONTROLS);

    const p = await openInvoices(page);
    await expect(p.draftLinks).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(FORM_CONTROLS);
    await page.goto(`/invoices?draft=${id}`);
    await expect(page.getByText("This draft was discarded.", { exact: true })).toBeVisible();
  });

  test("AC-0095, AC-0137: a draft saved or discarded after the review loaded says so", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await discardAtEngine(id);
    const typed = await reviewValues(r, 2);
    await r.discard.click();
    await expect(r.message).toHaveText(`${NOT_DISCARDED} It was already saved or discarded.`);
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await checkPageState(page)).toEqual(reviewControls(2));

    const saved = await seedLines(TURKEY_SEED);
    const second = await openReview(page, saved);
    await confirmAtEngine(saved, 1);
    await second.discard.click();
    await expect(second.message).toHaveText(`${NOT_DISCARDED} It was already saved or discarded.`);
    expect(await draftStatus(saved)).toBe("confirmed");
  });

  test("AC-0096, AC-0089, AC-0137: an ended session says to sign in again and keeps the fields", async ({ page }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await page.context().clearCookies();
    const typed = await reviewValues(r, 2);
    await r.discard.click();
    await expect(r.message).toHaveText(DISCARD_SIGNED_OUT);
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await draftStatus(id)).toBe("pending");
    expect(await checkPageState(page)).toEqual(reviewControls(2));
  });

  test("AC-0188 path: a discard whose request is dropped says the draft may have been discarded and keeps the fields", async ({
    page,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    await dropActions(page);
    const typed = await reviewValues(r, 2);
    await r.discard.click();
    await expect(r.message).toHaveText(DISCARD_UNKNOWN);
    await expect(r.message).toBeFocused();
    expect(await reviewValues(r, 2)).toEqual(typed);
    expect(await draftStatus(id)).toBe("pending");
  });

  test("AC-0003, AC-0187, AC-0189: a discard replayed with no session or a non-operator's changes nothing; an unknown id shows the engine's text", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const id = await seedLines(TURKEY_SEED);
    const r = await openReview(page, id);
    const sent = await captureAction(page, () => r.discard.click());
    const before = await allFingerprints();
    const message = (text: string) => `"message":"${text}"`;

    const replays = [
      { who: "no session", storageState: undefined, message: DISCARD_SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: NOT_ALLOWED_DISCARD },
    ];
    for (const { who, storageState, message: expected } of replays) {
      expect(await replayWith(playwright, baseURL, sent, storageState), `response for ${who}`).toContain(
        message(expected),
      );
      expect(await allFingerprints(), `tables after ${who}`).toEqual(before);
    }
    const unknown = await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { draftId: ZERO_ID });
    expect(unknown).toContain(message(`${NOT_DISCARDED} draft ${ZERO_ID} not found`));
    expect(await allFingerprints()).toEqual(before);
  });
});
