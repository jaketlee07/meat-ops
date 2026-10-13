import { expect, it } from "vitest";
import { draftLines, modelAddress, photoMediaType, type Catalog, type ReadingLine } from "../src/lib/invoice-reading.js";

const RAW_TOM = "22222222-2222-2222-2222-222222222222";
const REYES = "11111111-1111-1111-1111-111111111111";
const CATALOG: Catalog = {
  products: [{ id: RAW_TOM, code: "RAW-TOM", description: "Turkey Drums TOM (raw)" }],
  vendors: [{ id: REYES, name: "Reyes Meats" }],
};
const TODAY = "2026-10-09";
const USABLE: ReadingLine = {
  words: "TKY DRUMS 40#",
  product_code: "RAW-TOM",
  vendor_name: "Reyes Meats",
  weight_lbs: "5000",
  cost_per_lb: "1.68",
  received_date: "2026-10-01",
  unsure: [],
};

// STUB: AC-0050
it("AC-0050: a reading value that is not usable leaves its drafted field blank", () => {
  expect(draftLines([USABLE], CATALOG, TODAY)).toEqual([
    {
      words: "TKY DRUMS 40#",
      productId: RAW_TOM,
      vendorId: REYES,
      weightLbs: "5000",
      unitCost: "1.68",
      receivedDate: "2026-10-01",
      unsure: [],
    },
  ]);
  const unusable: ReadonlyArray<[ReadingLine, "productId" | "vendorId" | "weightLbs" | "unitCost" | "receivedDate"]> = [
    [{ ...USABLE, product_code: "RAW-OLD" }, "productId"],
    [{ ...USABLE, vendor_name: "reyes meats" }, "vendorId"],
    [{ ...USABLE, weight_lbs: "5,000" }, "weightLbs"],
    [{ ...USABLE, cost_per_lb: "$1.68" }, "unitCost"],
    [{ ...USABLE, received_date: "2026-10-10" }, "receivedDate"],
  ];
  for (const [reading, drafted] of unusable) {
    const [line] = draftLines([reading], CATALOG, TODAY);
    expect(line?.[drafted], JSON.stringify(reading)).toBeNull();
  }
});

// STUB: AC-0055
it("AC-0055: the photo rule names the media type from the bytes", () => {
  expect(photoMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  expect(photoMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  expect(photoMediaType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  expect(photoMediaType(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
});

// STUB: AC-0056
it("AC-0056: the model address rule allows only the API and the loopback", () => {
  expect(modelAddress(undefined)).toBe("https://api.anthropic.com");
  expect(modelAddress("")).toBe("https://api.anthropic.com");
  expect(modelAddress("http://127.0.0.1:4010")).toBe("http://127.0.0.1:4010");
  expect(modelAddress("http://localhost:4010/")).toBe("http://localhost:4010/");
  const refused = [
    "https://example.com",
    "http://127.0.0.1",
    "http://127.0.0.1:4010/v1",
    "http://user@127.0.0.1:4010",
    "https://api.anthropic.com.example.com",
    "http://10.0.0.5:4010",
  ];
  for (const value of refused) expect(modelAddress(value), value).toBeNull();
});

// Below: the rest of T1's cases. The stub above is unchanged.
import {
  answerSchema,
  checkReceiptText,
  failureKind,
  INSTRUCTIONS,
  parseAnswer,
  readFailureLogLine,
  readFailureMessage,
  requestParams,
  type FailureKind,
} from "../src/lib/invoice-reading.js";

const only = (over: Partial<ReadingLine>) => draftLines([{ ...USABLE, ...over }], CATALOG, TODAY)[0]!;

it("AC-0050: every listed unusable value leaves its field blank", () => {
  for (const code of ["RAW-OLD", "502", "RAW-NONE"]) expect(only({ product_code: code }).productId, code).toBeNull();
  for (const name of ["reyes meats", " Reyes Meats", "Reyes"]) expect(only({ vendor_name: name }).vendorId, name).toBeNull();
  for (const w of ["0", "5,000", "5000 lbs", "12.3456", "-5"]) expect(only({ weight_lbs: w }).weightLbs, w).toBeNull();
  for (const c of ["$1.68", "1.68/lb", "1.68456", "1,68"]) expect(only({ cost_per_lb: c }).unitCost, c).toBeNull();
  for (const d of ["2026-13-01", "10/01/2026", "2026-02-30", "2026-10-10"]) {
    expect(only({ received_date: d }).receivedDate, d).toBeNull();
  }
});

it("AC-0050: a blank-looking or missing value is blank too", () => {
  const line = only({ product_code: null, vendor_name: null, weight_lbs: null, cost_per_lb: null, received_date: null });
  expect([line.productId, line.vendorId, line.weightLbs, line.unitCost, line.receivedDate]).toEqual([
    null, null, null, null, null,
  ]);
  expect(only({ received_date: "2028-02-29" }).receivedDate).toBeNull();
  expect(draftLines([{ ...USABLE, received_date: "2024-02-29" }], CATALOG, TODAY)[0]?.receivedDate).toBe("2024-02-29");
});

it("AC-0051: an unsure field is blank and named", () => {
  const line = only({ unsure: ["weight", "date"] });
  expect(line.weightLbs).toBeNull();
  expect(line.receivedDate).toBeNull();
  expect(line.productId).toBe(RAW_TOM);
  expect(line.unsure).toEqual(["weight", "date"]);
});

it("AC-0052: usable values fill as written", () => {
  for (const w of ["5000", "32.5", ".5"]) expect(only({ weight_lbs: w }).weightLbs).toBe(w);
  for (const c of ["1.68", "0", "1.6800"]) expect(only({ cost_per_lb: c }).unitCost).toBe(c);
  const line = only({ received_date: TODAY });
  expect([line.productId, line.vendorId, line.receivedDate]).toEqual([RAW_TOM, REYES, TODAY]);
});

it("AC-0053: long words are cut to 200 code points and blank words are named", () => {
  const long = "a".repeat(199) + "\u{1F356}" + "tail";
  expect(Array.from(only({ words: long }).words)).toHaveLength(200);
  expect(only({ words: long }).words.endsWith("\u{1F356}")).toBe(true);
  expect(only({ words: "x".repeat(200) }).words).toBe("x".repeat(200));
  expect(only({ words: "   " }).words).toBe("(no words read)");
  expect(only({ words: "" }).words).toBe("(no words read)");
});

it("AC-0054: a line with every drafted field blank is kept", () => {
  const empty: ReadingLine = {
    words: "???", product_code: null, vendor_name: null, weight_lbs: null, cost_per_lb: null, received_date: null,
    unsure: ["product", "vendor", "weight", "cost", "date"],
  };
  expect(draftLines([empty, USABLE], CATALOG, TODAY)).toHaveLength(2);
  expect(draftLines([empty], CATALOG, TODAY)[0]).toEqual({
    words: "???", productId: null, vendorId: null, weightLbs: null, unitCost: null, receivedDate: null,
    unsure: ["product", "vendor", "weight", "cost", "date"],
  });
});

it("AC-0055: the photo rule needs the full signature", () => {
  expect(photoMediaType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  expect(photoMediaType(new Uint8Array())).toBeNull();
  expect(photoMediaType(new TextEncoder().encode("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
});

it("AC-0056: the loopback rule needs a port and nothing else", () => {
  for (const v of ["http://localhost:4010", "http://127.0.0.1:4010/"]) expect(modelAddress(v)).toBe(v);
  for (const v of ["https://api.anthropic.com", "http://127.0.0.1:4010//", "http://localhost:", " http://localhost:1"]) {
    expect(modelAddress(v), v).toBeNull();
  }
});

it("AC-0012: the Receipt text rows", () => {
  expect(checkReceiptText("")).toBe("Type a receipt, like: 5000 lbs RAW-TOM from Reyes Meats at 1.68 today.");
  expect(checkReceiptText("   ")).toBe("Type a receipt, like: 5000 lbs RAW-TOM from Reyes Meats at 1.68 today.");
  expect(checkReceiptText("x".repeat(2000))).toBeNull();
  expect(checkReceiptText("x".repeat(2001))).toBe("Keep the text to 2,000 characters or fewer.");
  expect(checkReceiptText("\u{1F356}".repeat(2000))).toBeNull();
  expect(checkReceiptText("\u{1F356}".repeat(2001))).toBe("Keep the text to 2,000 characters or fewer.");
});

const answer = (text: unknown, stop_reason: string | null = "end_turn") => ({
  stop_reason,
  content: [{ type: "thinking" }, { type: "text", text: typeof text === "string" ? text : JSON.stringify(text) }],
});

it("AC-0062: an answer that is not the reading schema is unreadable", () => {
  const unreadable = { ok: false, kind: "unreadable" };
  expect(parseAnswer(answer({ lines: [{ ...USABLE, extra: "x" }] }))).toEqual(unreadable);
  const { cost_per_lb: _omitted, ...missing } = USABLE;
  expect(parseAnswer(answer({ lines: [missing] }))).toEqual(unreadable);
  expect(parseAnswer(answer({ lines: [{ ...USABLE, weight_lbs: 5000 }] }))).toEqual(unreadable);
  expect(parseAnswer(answer({ lines: [{ ...USABLE, unsure: ["color"] }] }))).toEqual(unreadable);
  expect(parseAnswer(answer({ lines: [], extra: 1 }))).toEqual(unreadable);
  expect(parseAnswer(answer({ rows: [] }))).toEqual(unreadable);
  expect(parseAnswer(answer("not json"))).toEqual(unreadable);
  expect(parseAnswer(answer("[]"))).toEqual(unreadable);
  expect(parseAnswer({ stop_reason: "end_turn", content: [{ type: "thinking" }] })).toEqual(unreadable);
});

it("AC-0062: the read outcome order", () => {
  expect(parseAnswer(answer({ lines: [USABLE] }))).toEqual({ ok: true, lines: [USABLE] });
  expect(parseAnswer(answer({ lines: [] }))).toEqual({ ok: true, lines: [] });
  expect(parseAnswer(answer({ lines: [USABLE] }, "refusal"))).toEqual({ ok: false, kind: "declined" });
  expect(parseAnswer(answer("{", "max_tokens"))).toEqual({ ok: false, kind: "too-long" });
  expect(parseAnswer(answer({ lines: Array(30).fill(USABLE) })).ok).toBe(true);
  expect(parseAnswer(answer({ lines: Array(31).fill(USABLE) }))).toEqual({ ok: false, kind: "too-long" });
});

it("AC-0057: the failure kinds, texts, and log lines", () => {
  expect(failureKind({ type: "timeout" })).toBe("no-answer");
  expect(failureKind({ type: "connection" })).toBe("service-error");
  expect(failureKind({ type: "status", status: 401 })).toBe("key-refused");
  expect(failureKind({ type: "status", status: 403 })).toBe("key-refused");
  expect(failureKind({ type: "status", status: 400 })).toBe("service-error");
  expect(failureKind({ type: "status", status: 529 })).toBe("service-error");
  const kinds: FailureKind[] = [
    "not-set-up", "address-refused", "key-refused", "declined", "too-long", "no-answer", "unreadable", "service-error",
  ];
  expect(readFailureMessage("not-set-up")).toBe(
    "Invoice reading isn't set up. Set ANTHROPIC_API_KEY in the app's .env file, then restart the app.",
  );
  expect(readFailureMessage("address-refused")).toBe(
    "Invoice reading isn't set up. ANTHROPIC_BASE_URL must be unset, or a loopback address for tests. Fix it, then restart the app.",
  );
  expect(readFailureMessage("key-refused")).toBe(
    "Invoice reading isn't working. The model service refused the app's key. Check ANTHROPIC_API_KEY in the app's .env file.",
  );
  expect(readFailureMessage("declined")).toBe("The invoice wasn't read. The model declined it. Type the receipt instead.");
  expect(readFailureMessage("too-long")).toBe("This invoice is too long to read at once. Read it in parts.");
  for (const kind of ["no-answer", "unreadable", "service-error"] as const) {
    expect(readFailureMessage(kind)).toBe("The invoice wasn't read. Try again in a moment.");
  }
  for (const kind of kinds) expect(readFailureLogLine(kind)).toBe(`readInvoice failed: kind=${kind}`);

  // The error carries a key, the typed text, and a product description in its
  // message; the description model.ts builds from it, and the line, hold none.
  const error = Object.assign(new Error("sk-ant-SENTINEL 5000 lbs of Turkey Drums TOM (raw)"), {
    type: "status" as const,
    status: 401,
  });
  const kind = failureKind(error);
  expect(readFailureLogLine(kind, error.status)).toBe("readInvoice failed: kind=key-refused status=401");
});

const PHOTO_INPUT = { source: "photo", mediaType: "image/png", base64: "iVBORw0KGgo=" } as const;
const BIG_CATALOG: Catalog = {
  products: [
    { id: RAW_TOM, code: "RAW-TOM", description: "Turkey Drums TOM (raw)" },
    { id: "33333333-3333-3333-3333-333333333333", code: "RAW-CHK", description: "Chicken Thighs (raw)" },
  ],
  vendors: [
    { id: REYES, name: "Reyes Meats" },
    { id: "44444444-4444-4444-4444-444444444444", name: "Belmont Poultry" },
  ],
};

it("requestParams: exactly AC-0073's fields and settings", () => {
  const params = requestParams(PHOTO_INPUT, BIG_CATALOG, TODAY);
  expect(Object.keys(params).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
  expect(params.model).toBe("claude-opus-5-5");
  expect(params.max_tokens).toBe(16000);
  expect(Object.keys(params.output_config).sort()).toEqual(["effort", "format"]);
  expect(params.output_config.effort).toBe("medium");
  expect(params.output_config.format.type).toBe("json_schema");
  expect(params.output_config.format.schema).toEqual(answerSchema(BIG_CATALOG));
});

it("requestParams: the photo block comes first and the system text is fixed", () => {
  const photo = requestParams(PHOTO_INPUT, BIG_CATALOG, TODAY);
  const text = requestParams({ source: "text", text: "5000 lbs RAW-TOM" }, CATALOG, TODAY);
  expect(photo.messages).toHaveLength(1);
  expect(photo.messages[0]!.content[0]).toEqual({
    type: "image",
    source: { type: "base64", media_type: "image/png", data: "iVBORw0KGgo=" },
  });
  expect(photo.messages[0]!.content).toHaveLength(2);
  expect(photo.system).toBe(INSTRUCTIONS);
  expect(text.system).toBe(INSTRUCTIONS);
  expect(text.messages[0]!.content).toHaveLength(1);
  expect(INSTRUCTIONS).not.toMatch(/\u2014/);
});

it("requestParams: the catalog holds only the given codes, descriptions, and names", () => {
  const request = JSON.stringify(requestParams({ source: "text", text: "5000 lbs RAW-TOM" }, CATALOG, TODAY));
  expect(request).toContain("RAW-TOM");
  expect(request).toContain("Turkey Drums TOM (raw)");
  expect(request).toContain("Reyes Meats");
  expect(request).toContain(TODAY);
  expect(request).toContain("5000 lbs RAW-TOM");
  expect(request).not.toContain("RAW-CHK");
  expect(request).not.toContain("Belmont");
  expect(request).not.toContain(RAW_TOM);
  expect(request).not.toContain(REYES);
});

it("answerSchema: closed objects, the catalog's values, and an empty list gives null only", () => {
  const schema = answerSchema(CATALOG) as any;
  const item = schema.properties.lines.items;
  expect(schema.additionalProperties).toBe(false);
  expect(item.additionalProperties).toBe(false);
  expect(item.required.sort()).toEqual(Object.keys(item.properties).sort());
  expect(item.properties.product_code).toEqual({ anyOf: [{ enum: ["RAW-TOM"] }, { type: "null" }] });
  expect(item.properties.vendor_name).toEqual({ anyOf: [{ enum: ["Reyes Meats"] }, { type: "null" }] });
  expect(item.properties.unsure.items.enum).toEqual(["product", "vendor", "weight", "cost", "date"]);
  const none = answerSchema({ products: [], vendors: [] }) as any;
  expect(none.properties.lines.items.properties.product_code).toEqual({ type: "null" });
  expect(none.properties.lines.items.properties.vendor_name).toEqual({ type: "null" });
});
