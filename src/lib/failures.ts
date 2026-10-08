// What the owner reads when a call fails, and the limit a database request gets.
// Pure: no environment, no client, and no import from src/app/, because client
// components import the texts below. An error's PostgREST code is read from the
// error itself (src/lib/rpc.ts RpcError), not by importing that class.

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
function refusalReason(error: unknown, code: string): string {
  if (code === "42501") return NOT_ALLOWED;
  const text = (error instanceof Error ? error.message : "").replace(/^\w+ failed: /, "").replace(/^\w+: /, "");
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

export type ReceivingAction = "saveReceipt" | "voidReceipt";

const LOG_MESSAGE_LIMIT = 200;

// The server log line for a failure that saveReceipt or voidReceipt turned into a
// screen message. It names the action and the stage and identifies the failed call
// by the error's own message and, for an RpcError, its code. The line adds nothing
// from the form, but the error's message can quote a value the request sent: Postgres
// quotes a malformed vendor id, received date, or lot id when its cast fails, and the
// engine names ids in its refusals. Only a signed-in operator's hand-made request can
// carry such a value, and the message is cut to one bounded line.
export function actionFailureLogLine(action: ReceivingAction, stage: FailureStage, error: unknown): string {
  const message = (error instanceof Error ? error.message : "unknown error")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LOG_MESSAGE_LIMIT);
  const code = codeOf(error);
  return `${action} failed at ${stage}: ${message}${code ? ` (code ${code})` : ""}`;
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
