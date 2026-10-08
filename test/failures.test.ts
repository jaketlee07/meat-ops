import { describe, expect, it } from "vitest";
import {
  DB_CALL_TIMEOUT_MS,
  authFailureLogLine,
  saveFailureMessage,
  sessionOutcome,
  signInFailureMessage,
  voidFailureMessage,
  withTimeout,
} from "../src/lib/failures.js";
import { RpcError } from "../src/lib/rpc.js";

const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";
const SAVE_UNKNOWN =
  "The receipt may not have been saved. Reload this page and check Recent receipts before saving again.";
const VOID_UNKNOWN = "The receipt may not have been voided. Reload this page to see whether it was.";
const noAnswer = (wrapper: string) => new RpcError(`${wrapper} failed: TypeError: fetch failed`, "");

// STUB: AC-0072
describe("AC-0072: save failure messages", () => {
  it("says the receipt wasn't saved when a call before the write failed", () => {
    expect(saveFailureMessage(new Error("getStock failed: TypeError: fetch failed"), "before-write")).toMatch(
      /^The receipt wasn't saved\./,
    );
  });

  it("says the receipt may not have been saved when the write got no engine answer", () => {
    expect(saveFailureMessage(noAnswer("receiveLot"), "write")).toBe(SAVE_UNKNOWN);
  });

  it("keeps an engine refusal as wasn't saved", () => {
    const inactive = new RpcError(
      "receiveLot failed: receive_lot: product 6f1c2a9e-0b7d-4c2e-9a51-3d8e7f40b2c6 is inactive",
      "P0001",
    );
    const outsider = new RpcError("receiveLot failed: receive_lot: not allowed (caller is not an operator)", "42501");
    expect(saveFailureMessage(inactive, "write")).toBe("The receipt wasn't saved. This product is no longer active.");
    expect(saveFailureMessage(outsider, "write")).toBe(`The receipt wasn't saved. ${NOT_ALLOWED}`);
  });
});

// STUB: AC-0083
describe("AC-0083 and AC-0077: void failure messages", () => {
  it("says the receipt wasn't voided when a call before the write failed", () => {
    expect(voidFailureMessage(new Error("isOperator failed: TypeError: fetch failed"), "before-write")).toMatch(
      /^The receipt wasn't voided\./,
    );
  });

  it("says the receipt may not have been voided when the write got no engine answer", () => {
    expect(voidFailureMessage(noAnswer("voidReceipt"), "write")).toBe(VOID_UNKNOWN);
  });

  it("adds the reload hint to an engine refusal", () => {
    const consumed = new RpcError(
      "voidReceipt failed: void_receipt: invalid, lot 0c4b7e2d-5a19-4f63-b8e0-91d2a6c3f57e has been consumed",
      "P0001",
    );
    expect(voidFailureMessage(consumed, "write")).toMatch(
      /^The receipt wasn't voided\. .*Reload to see the latest stock\.$/,
    );
  });
});

// STUB: AC-0082
describe("AC-0082: the request limit", () => {
  it("is 10 seconds", () => {
    expect(DB_CALL_TIMEOUT_MS).toBe(10_000);
  });

  it("aborts a request that never answers with an AbortError, which postgrest-js does not retry", async () => {
    const never: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    await expect(withTimeout(never, 50)("http://127.0.0.1/rest/v1/lots")).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});

// STUB: AC-0070
describe("AC-0070: sign-in failure messages", () => {
  it("keeps the wrong-password message for bad credentials only", () => {
    const later = "Couldn't sign in right now. Wait a few minutes and try again.";
    expect(signInFailureMessage({ code: "invalid_credentials", status: 400 })).toBe("Email or password is incorrect.");
    expect(signInFailureMessage({ code: "over_request_rate_limit", status: 429 })).toBe(later);
    expect(signInFailureMessage({ code: "unexpected_failure", status: 500 })).toBe(later);
    expect(signInFailureMessage({ status: 0 })).toBe(later);
  });
});

// STUB: AC-0080
describe("AC-0080: the sign-in failure log line", () => {
  it("holds the code and status and nothing else from the error", () => {
    const error = { code: "over_request_rate_limit", status: 429, message: "limit hit for owner@example.com" };
    const line = authFailureLogLine(error);
    expect(line).toContain("over_request_rate_limit");
    expect(line).toContain("429");
    expect(line).not.toContain("owner@example.com");
  });

  it("says no answer when the auth server sent no code or status", () => {
    expect(authFailureLogLine({ status: 0 })).toContain("no answer");
  });
});

// STUB: AC-0042
describe("caller check: an ended session or a failed lookup", () => {
  it("reads claims as signed in", () => {
    expect(sessionOutcome({ claims: { sub: "user" }, error: null })).toBe("signed-in");
  });

  it("reads no claims with no error, or an auth refusal, as an ended session", () => {
    expect(sessionOutcome({ claims: null, error: null })).toBe("ended");
    expect(sessionOutcome({ claims: null, error: { code: "session_not_found", status: 403 } })).toBe("ended");
  });

  it("reads no answer, a rate limit, or a server error as a failed lookup", () => {
    expect(sessionOutcome({ claims: null, error: { status: 0 } })).toBe("failed");
    expect(sessionOutcome({ claims: null, error: { status: 429 } })).toBe("failed");
    expect(sessionOutcome({ claims: null, error: { status: 503 } })).toBe("failed");
  });
});
