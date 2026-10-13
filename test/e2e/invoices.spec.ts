import { readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { receiveLot } from "../../src/lib/rpc";
import { query, RAW_TOM_ID, VENDOR_ID } from "../db";
import { resolveStackEnv } from "../env";
import { OPERATOR_EMAIL, signInOperator } from "../users";
import { checkPageState } from "./a11y";
import {
  ADDRESS_REFUSED,
  ANTHROPIC_TEST_AUTH_TOKEN,
  ANTHROPIC_TEST_KEY,
  canvasJpeg,
  captureAction,
  DECLINED,
  draftCount,
  draftIdFromUrl,
  draftLineCount,
  draftRows,
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
  NO_LINES,
  NOT_ALLOWED_READ,
  NOT_SET_UP,
  openInvoices,
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
  seedDraft,
  seedFixture,
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
} from "./invoices-page";
import { deviceDate, NOT_ALLOWED, sendsActionRequest } from "./receiving-page";
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
