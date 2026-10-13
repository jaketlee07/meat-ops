// What the owner reads when a call fails, and the limit a database request gets.
// Pure: no environment, no client, and no import from src/app/, because client
// components import the texts below. An error's PostgREST code is read from the
// error itself (src/lib/rpc.ts RpcError), not by importing that class.

import { formatDate, formatWeight } from "./format";
import { readFailureMessage } from "./invoice-reading";

export const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";
export const INACTIVE_PRODUCT = "This product is no longer active.";
// AC-0071: the write call got no answer from the engine, so the save may have happened.
export const SAVE_UNKNOWN =
  "The receipt may not have been saved. Reload this page and check Recent receipts before saving again.";
// AC-0073: the same for a void.
export const VOID_UNKNOWN = "The receipt may not have been voided. Reload this page to see whether it was.";
export const SIGN_IN_BAD_CREDENTIALS = "Email or password is incorrect.";
export const SIGN_IN_LATER = "Couldn't sign in right now. Wait a few minutes and try again.";

// The two lead sentences of every not-saved and not-voided message, shared with
// the actions' own refusals so each prefix is spelled once.
export const NOT_SAVED = "The receipt wasn't saved.";
export const NOT_VOIDED = "The receipt wasn't voided.";
const TRY_AGAIN = "Try again in a moment.";
const RELOAD_STOCK = "Reload to see the latest stock.";

// The longest a database request waits for an answer (AC-0082).
export const DB_CALL_TIMEOUT_MS = 10_000;

// The call that failed: any call before the write call, or the write call.
export type FailureStage = "before-write" | "write";

// PostgREST's code on an error that came from an answer, a SQLSTATE or a PGRST
// code. An empty string means no answer: a dropped connection, an abort, or a timeout.
function codeOf(error: unknown): string {
  return error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "";
}

// The engine's text without the "<wrapper> failed: " and "<function>: " prefixes.
function engineText(error: unknown): string {
  return (error instanceof Error ? error.message : "").replace(/^\w+ failed: /, "").replace(/^\w+: /, "");
}

function refusalReason(error: unknown, code: string): string {
  if (code === "42501") return NOT_ALLOWED;
  const text = engineText(error);
  return / is inactive$/.test(text) ? INACTIVE_PRODUCT : text;
}

// A call before the write call never carries a 42501: isOperator turns that
// refusal into false, and the reads throw plain errors. So a before-write
// failure always reads as "try again".
export function saveFailureMessage(error: unknown, stage: FailureStage): string {
  if (stage === "before-write") return `${NOT_SAVED} ${TRY_AGAIN}`;
  const code = codeOf(error);
  if (code === "") return SAVE_UNKNOWN;
  return `${NOT_SAVED} ${refusalReason(error, code)}`;
}

export function voidFailureMessage(error: unknown, stage: FailureStage): string {
  if (stage === "before-write") return `${NOT_VOIDED} ${TRY_AGAIN}`;
  const code = codeOf(error);
  if (code === "") return VOID_UNKNOWN;
  if (code === "42501") return `${NOT_VOIDED} ${NOT_ALLOWED}`;
  // The engine's text has no closing period; the reload hint is a sentence of its own.
  const reason = refusalReason(error, code);
  return `${NOT_VOIDED} ${/[.!?]$/.test(reason) ? reason : `${reason}.`} ${RELOAD_STOCK}`;
}

// The lead sentence of every not-saved batch message, shared with the batch action.
export const NOT_SAVED_BATCH = "The batch wasn't saved.";
// AC-0035: the write call got no answer from the engine, so the batch may have been saved.
export const BATCH_SAVE_UNKNOWN =
  "The batch may not have been saved. Reload this page and check Recent batches before saving again.";
const RAW_INACTIVE = "Its raw product is no longer active.";
const SHORTFALL =
  /^shortfall, only (\d+(?:\.\d+)?) lbs raw available on or before (\d{4}-\d{2}-\d{2}), need (\d+(?:\.\d+)?)$/;

// AC-0030 to AC-0035, AC-0075, AC-0080. The raw-input refusal is checked before
// the general "is inactive" rule because both texts end in "is inactive".
export function batchSaveFailureMessage(error: unknown, stage: FailureStage): string {
  if (stage === "before-write") return `${NOT_SAVED_BATCH} ${TRY_AGAIN}`;
  const code = codeOf(error);
  if (code === "") return BATCH_SAVE_UNKNOWN;
  if (code === "42501") return `${NOT_SAVED_BATCH} ${NOT_ALLOWED}`;
  const text = engineText(error);
  if (/^raw input .+ is inactive$/.test(text)) return `${NOT_SAVED_BATCH} ${RAW_INACTIVE}`;
  const shortfall = SHORTFALL.exec(text);
  if (shortfall) {
    const [, available, onOrBefore, needed] = shortfall;
    return `${NOT_SAVED_BATCH} Only ${formatWeight(Number(available))} of raw on hand was received on or before ${formatDate(onOrBefore ?? "")}, and this batch needs ${formatWeight(Number(needed))}.`;
  }
  return `${NOT_SAVED_BATCH} ${refusalReason(error, code)}`;
}

// Pricing change actions (menu-pricing AC-0110, AC-0113 to AC-0118).
export const NOT_SAVED_CHANGE = "The change wasn't saved.";
// AC-0114: the write call got no answer from the engine, so the change may have happened.
export const CHANGE_UNKNOWN = "The change may not have been saved. Reload this page to check it.";
// AC-0110: the session ended after the page loaded.
export const CHANGE_SIGNED_OUT = "You're signed out. Sign in again to save this change.";

export function changeFailureMessage(error: unknown, stage: FailureStage): string {
  if (stage === "before-write") return `${NOT_SAVED_CHANGE} ${TRY_AGAIN}`;
  const code = codeOf(error);
  if (code === "") return CHANGE_UNKNOWN;
  return `${NOT_SAVED_CHANGE} ${refusalReason(error, code)}`;
}

// Invoice reading (invoice-entry AC-0016, AC-0022, AC-0023, AC-0117, AC-0185, AC-0190).
// The model failures' texts live in invoice-reading.ts; "Try again" is read from there.
export const NOT_READ = "The invoice wasn't read.";
export const READ_TRY_AGAIN = readFailureMessage("service-error");
// AC-0022: the session ended after the page loaded.
export const READ_SIGNED_OUT = "You're signed out. Sign in again to read this invoice.";
// AC-0016: the reading held no line.
export const NO_RECEIPT_LINES = "No receipt lines were found. Try a clearer photo, or type the receipt.";
export const NOT_DRAFT_SAVED = "The draft wasn't saved.";
// AC-0117: the draft write got no answer from the engine, so the draft may exist.
export const DRAFT_UNKNOWN =
  "The draft may have been saved. Reload this page and check Drafts to confirm before reading again.";

// AC-0117, AC-0185: no answer reads as unknown; a refusal gives the engine's text without its prefix.
export function draftWriteFailureMessage(error: unknown): string {
  const code = codeOf(error);
  if (code === "") return DRAFT_UNKNOWN;
  return `${NOT_DRAFT_SAVED} ${code === "42501" ? NOT_ALLOWED : engineText(error)}`;
}

// Saving and discarding a draft (invoice-entry AC-0083 to AC-0097, AC-0116, AC-0187 to AC-0189).
export const NOT_SAVED_RECEIPTS = "The receipts weren't saved.";
export const NOT_DISCARDED = "The draft wasn't discarded.";
// AC-0088, AC-0096: the session ended after the review loaded.
export const RECEIPTS_SIGNED_OUT = "You're signed out. Sign in again to save these receipts.";
export const DISCARD_SIGNED_OUT = "You're signed out. Sign in again to discard this draft.";
// AC-0116: the write call got no answer from the database, so the receipts may exist.
export const RECEIPTS_UNKNOWN = "The receipts may have been saved. Reload this page to check the draft before saving again.";
// AC-0188: the same for a discard.
export const DISCARD_UNKNOWN = "The draft may have been discarded. Reload this page to check it.";
export const NO_LINE_TICKED = "Tick at least one line to save.";
export const CHOOSE_PRODUCT = "Choose a product.";
export const CHOOSE_VENDOR = "Choose a vendor.";
// AC-0078: a drafted field that was blank when the review loaded.
export const ENTER_FROM_INVOICE = "Enter this from the invoice.";
export const DRAFT_DISCARDED_NOW = "Draft discarded.";
export const DRAFT_SAVED = "This draft was saved.";
export const DRAFT_WAS_DISCARDED = "This draft was discarded.";
export const NO_DRAFT = "No draft has this id.";
export const PHOTO_NOT_LOADED = "The photo couldn't be loaded. Reload the page to try again.";
export const BACK_TO_INVOICES = "Back to invoices";

const ALREADY_SETTLED = /^draft .+ is already saved or discarded$/;
// confirm_import_draft re-raises a receive_lot refusal as "line N: receive_lot: <text>", with no function prefix.
const LINE_INACTIVE = /^line (\d+): receive_lot: product .+ is inactive$/;

// AC-0059, AC-0085, AC-0086, AC-0087, AC-0097, AC-0116. A refusal is checked from the
// most to the least specific form: not allowed, a line's inactive product, a draft
// that is already settled, then the engine's own text.
export function draftSaveFailureMessage(error: unknown, stage: FailureStage): string {
  if (stage === "before-write") return `${NOT_SAVED_RECEIPTS} ${TRY_AGAIN}`;
  const code = codeOf(error);
  if (code === "") return RECEIPTS_UNKNOWN;
  if (code === "42501") return `${NOT_SAVED_RECEIPTS} ${NOT_ALLOWED}`;
  const text = engineText(error);
  const inactive = LINE_INACTIVE.exec(text);
  if (inactive) return `${NOT_SAVED_RECEIPTS} Line ${inactive[1]}: ${INACTIVE_PRODUCT}`;
  if (ALREADY_SETTLED.test(text)) return `${NOT_SAVED_RECEIPTS} This draft was already saved or discarded.`;
  return `${NOT_SAVED_RECEIPTS} ${text}`;
}

// AC-0095, AC-0097, AC-0187 to AC-0189.
export function draftDiscardFailureMessage(error: unknown, stage: FailureStage): string {
  if (stage === "before-write") return `${NOT_DISCARDED} ${TRY_AGAIN}`;
  const code = codeOf(error);
  if (code === "") return DISCARD_UNKNOWN;
  if (code === "42501") return `${NOT_DISCARDED} ${NOT_ALLOWED}`;
  const text = engineText(error);
  if (ALREADY_SETTLED.test(text)) return `${NOT_DISCARDED} It was already saved or discarded.`;
  return `${NOT_DISCARDED} ${text}`;
}

// Every server action whose failures are logged: the receiving actions, saveBatch, the three pricing change actions, readInvoice, saveDraft, and discardDraft.
export type LoggedAction =
  | "saveReceipt"
  | "voidReceipt"
  | "saveBatch"
  | "saveTargetMargin"
  | "removeTargetMargin"
  | "saveListPrice"
  | "readInvoice"
  | "saveDraft"
  | "discardDraft";

const LOG_MESSAGE_LIMIT = 200;

// The one rule for the error text in any action's log line: the error's own
// message on one line, trimmed and cut to LOG_MESSAGE_LIMIT. It holds no form values.
export function logMessage(error: unknown): string {
  return (error instanceof Error ? error.message : "unknown error")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LOG_MESSAGE_LIMIT);
}

// The server log line for a failure that an action turned into a
// screen message. It names the action and the stage and identifies the failed call
// by the error's own message and, for an RpcError, its code. The line adds nothing
// from the form, but the error's message can quote a value the request sent: Postgres
// quotes a malformed vendor id, received date, or lot id when its cast fails, and the
// engine names ids in its refusals. Only a signed-in operator's hand-made request can
// carry such a value, and the message is cut to one bounded line.
export function actionFailureLogLine(action: LoggedAction, stage: FailureStage, error: unknown): string {
  const code = codeOf(error);
  return `${action} failed at ${stage}: ${logMessage(error)}${code ? ` (code ${code})` : ""}`;
}

// An auth-js error, read for its code and status only. Both are missing or 0
// when the auth server did not answer.
export interface AuthFailure {
  code?: string | undefined;
  status?: number | undefined;
}

// Only bad credentials read as a wrong password; a rate limit, a server error,
// or no answer says nothing about the password (AC-0070).
export function signInFailureMessage({ code }: AuthFailure): string {
  return code === "invalid_credentials" ? SIGN_IN_BAD_CREDENTIALS : SIGN_IN_LATER;
}

// The server log line for a failed sign-in (AC-0080) or sign-out. It reads the code
// and the status and nothing else, so the email and the password cannot reach the log.
export function authFailureLogLine({ code, status }: AuthFailure, action = "sign-in"): string {
  const answered = status !== undefined && status !== 0;
  if (!code && !answered) return `${action} failed: no answer from the auth server`;
  return `${action} failed: code=${code || "none"} status=${answered ? status : "none"}`;
}

export type SessionOutcome = "signed-in" | "ended" | "failed";

// Settles a getClaims result. Claims mean signed in. No claims and no error, or an
// auth refusal (a 4xx other than the 429 rate limit), mean the session ended. Any
// other error is a lookup that failed, and says nothing about the session.
export function sessionOutcome({
  claims,
  error,
}: {
  claims: object | null | undefined;
  error: AuthFailure | null | undefined;
}): SessionOutcome {
  if (claims) return "signed-in";
  if (!error) return "ended";
  const { status } = error;
  return status !== undefined && status >= 400 && status <= 499 && status !== 429 ? "ended" : "failed";
}

// Wraps fetch so a request that gets no answer within `ms` is aborted with its own
// AbortController. The fetch then rejects with an AbortError, which postgrest-js
// never retries. A signal the caller passed still aborts the request too.
export function withTimeout(fetchImpl: typeof fetch, ms: number): typeof fetch {
  return async (input, init) => {
    const limit = new AbortController();
    const timer = setTimeout(() => limit.abort(), ms);
    const signal = init?.signal ? AbortSignal.any([init.signal, limit.signal]) : limit.signal;
    try {
      return await fetchImpl(input, { ...init, signal });
    } finally {
      clearTimeout(timer);
    }
  };
}
