// The read actions' decisions, apart from the "use server" wrapper so Vitest can
// import them: nothing here touches next/*, server-only, or src/app/_server. The
// browser imports the state types only.
import {
  actionFailureLogLine,
  draftWriteFailureMessage,
  NO_RECEIPT_LINES,
  NOT_ALLOWED,
  NOT_READ,
  READ_SIGNED_OUT,
  READ_TRY_AGAIN,
  type FailureStage,
} from "../../lib/failures";
import {
  checkReceiptText,
  draftLines,
  MAX_PHOTO_BYTES,
  MODEL,
  PHOTO_NONE,
  PHOTO_TOO_LARGE,
  PHOTO_TYPE,
  photoMediaType,
  readFailureLogLine,
  readFailureMessage,
  type Catalog,
  type FailureKind,
  type ReadInput,
  type ReadingLine,
} from "../../lib/invoice-reading";
import type { NewDraft } from "../../lib/rpc";

export type ReadSource = "photo" | "text";

export type ReadState =
  | { status: "idle" }
  // An AC-0012 rule refused the input; nothing was sent and no draft was made.
  | { status: "invalid"; source: ReadSource; message: string }
  // The caller, the model service, or the database refused or failed the read; the message says why.
  | { status: "refused"; source: ReadSource; message: string }
  | { status: "read"; draftId: string };

// `photo` reads the chosen file's bytes only when it is called, so the caller
// check settles before any of the upload is touched. Null when no file arrived.
export type ReadRequest =
  | { source: "photo"; today: string; photo: (() => Promise<Uint8Array>) | null }
  | { source: "text"; today: string; text: string };

export type CallerOutcome<C> =
  | { status: "operator"; client: C }
  | { status: "ended" }
  | { status: "not-operator" }
  | { status: "failed"; error: unknown };

// What model.ts says before it sends anything (AC-0021, AC-0183, AC-0028).
export type ModelReadiness = { ok: true } | { ok: false; kind: "not-set-up" | "address-refused" };

// What model.ts returns for a sent request: the reading, or a failure kind with
// the model service's status when there is one.
export type ModelResult = { ok: true; lines: ReadingLine[] } | { ok: false; kind: FailureKind; status?: number };

// What the draft keeps of the capture: the typed text, or the photo as it was received.
type Capture = { source: "text"; text: string } | { source: "photo"; image: Uint8Array; imageType: string };

export interface ReadDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  modelReady: () => ModelReadiness;
  readCatalog: (client: C) => Promise<Catalog>;
  readModel: (input: ReadInput, catalog: Catalog, today: string) => Promise<ModelResult>;
  writeDraft: (client: C, draft: NewDraft) => Promise<{ id: string }>;
}

// The device's date as the form sends it: a real calendar date written YYYY-MM-DD.
function isDate(text: string): boolean {
  const parsed = new Date(`${text}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(text);
}

// The spec's read outcome order: the session, the caller, the input rules, the
// key, the model address, the catalog, the model's answer, then the draft write.
// A refusal or failure creates no draft, and nothing before the model call sends
// a request.
export async function decideRead<C>(request: ReadRequest, deps: ReadDeps<C>): Promise<ReadState> {
  const { source, today } = request;
  const refused = (message: string): ReadState => ({ status: "refused", source, message });
  const invalid = (message: string): ReadState => ({ status: "invalid", source, message });
  const failed = (stage: FailureStage, error: unknown): ReadState => {
    console.error(actionFailureLogLine("readInvoice", stage, error));
    return refused(READ_TRY_AGAIN);
  };
  const modelFailed = (kind: FailureKind, status?: number): ReadState => {
    console.error(readFailureLogLine(kind, status));
    return refused(readFailureMessage(kind));
  };

  const caller = await deps.caller();
  if (caller.status === "ended") return refused(READ_SIGNED_OUT);
  if (caller.status === "not-operator") return refused(`${NOT_READ} ${NOT_ALLOWED}`);
  if (caller.status === "failed") return failed("before-write", caller.error);
  const { client } = caller;

  let input: ReadInput;
  let stored: Capture;
  if (request.source === "text") {
    const message = checkReceiptText(request.text);
    if (message) return invalid(message);
    input = { source: "text", text: request.text };
    stored = { source: "text", text: request.text };
  } else {
    const bytes = request.photo ? await request.photo() : null;
    if (!bytes || bytes.length === 0) return invalid(PHOTO_NONE);
    const mediaType = photoMediaType(bytes);
    if (!mediaType) return invalid(PHOTO_TYPE);
    if (bytes.length > MAX_PHOTO_BYTES) return invalid(PHOTO_TOO_LARGE);
    input = { source: "photo", mediaType, base64: Buffer.from(bytes).toString("base64") };
    stored = { source: "photo", image: bytes, imageType: mediaType };
  }
  // The date goes into the model's request, so only a real date is sent. The
  // message holds no form text, because it reaches the log.
  if (!isDate(today)) return failed("before-write", new Error("the device date is not a calendar date"));

  const ready = deps.modelReady();
  if (!ready.ok) return modelFailed(ready.kind);

  let catalog: Catalog;
  try {
    catalog = await deps.readCatalog(client);
  } catch (error) {
    return failed("before-write", error);
  }

  const answer = await deps.readModel(input, catalog, today);
  if (!answer.ok) return modelFailed(answer.kind, answer.status);
  if (answer.lines.length === 0) return refused(NO_RECEIPT_LINES);

  try {
    const draft = await deps.writeDraft(client, {
      ...stored,
      capturedOn: today,
      model: MODEL,
      lines: draftLines(answer.lines, catalog, today),
    });
    // A write that resolves with no row is a write with no answer (AC-0117).
    if (!draft) throw new Error("the write returned no draft");
    return { status: "read", draftId: draft.id };
  } catch (error) {
    console.error(actionFailureLogLine("readInvoice", "write", error));
    return refused(draftWriteFailureMessage(error));
  }
}
