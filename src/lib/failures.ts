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

const NOT_SAVED = "The receipt wasn't saved.";
const NOT_VOIDED = "The receipt wasn't voided.";
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

export function saveFailureMessage(error: unknown, stage: FailureStage): string {
  const code = codeOf(error);
  if (stage === "before-write") return `${NOT_SAVED} ${code === "42501" ? NOT_ALLOWED : TRY_AGAIN}`;
  if (code === "") return SAVE_UNKNOWN;
  return `${NOT_SAVED} ${refusalReason(error, code)}`;
}

export function voidFailureMessage(error: unknown, stage: FailureStage): string {
  const code = codeOf(error);
  if (stage === "before-write") return `${NOT_VOIDED} ${code === "42501" ? NOT_ALLOWED : TRY_AGAIN}`;
  if (code === "") return VOID_UNKNOWN;
  if (code === "42501") return `${NOT_VOIDED} ${NOT_ALLOWED}`;
  // The engine's text has no closing period; the reload hint is a sentence of its own.
  const reason = refusalReason(error, code);
  return `${NOT_VOIDED} ${/[.!?]$/.test(reason) ? reason : `${reason}.`} ${RELOAD_STOCK}`;
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

// The server log line for a failed sign-in (AC-0080). It reads the code and the
// status and nothing else, so the email and the password cannot reach the log.
export function authFailureLogLine({ code, status }: AuthFailure): string {
  const answered = status !== undefined && status !== 0;
  if (!code && !answered) return "sign-in failed: no answer from the auth server";
  return `sign-in failed: code=${code || "none"} status=${answered ? status : "none"}`;
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
