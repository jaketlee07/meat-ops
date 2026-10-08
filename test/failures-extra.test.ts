import { describe, expect, it } from "vitest";
import {
  NOT_SAVED,
  NOT_VOIDED,
  actionFailureLogLine,
  authFailureLogLine,
  saveFailureMessage,
  voidFailureMessage,
} from "../src/lib/failures.js";
import { RpcError } from "../src/lib/rpc.js";

// Cases the pinned test/failures.test.ts does not hold: the void refusal at the
// write stage, the before-write rule, and the server log lines.

const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";

describe("the not-saved and not-voided lead sentences", () => {
  it("are the sentences the owner reads", () => {
    expect(NOT_SAVED).toBe("The receipt wasn't saved.");
    expect(NOT_VOIDED).toBe("The receipt wasn't voided.");
  });
});

describe("AC-0083 and AC-0066: a void refused as not allowed", () => {
  it("says the account isn't allowed, with no reload hint, when void_receipt refuses with 42501", () => {
    const outsider = new RpcError("voidReceipt failed: void_receipt: not allowed (caller is not an operator)", "42501");
    expect(voidFailureMessage(outsider, "write")).toBe(`The receipt wasn't voided. ${NOT_ALLOWED}`);
  });

  it("reads any call before the write call as try again, never as not allowed", () => {
    const failed = new Error("isOperator failed: TypeError: fetch failed");
    expect(voidFailureMessage(failed, "before-write")).toBe("The receipt wasn't voided. Try again in a moment.");
    expect(saveFailureMessage(failed, "before-write")).toBe("The receipt wasn't saved. Try again in a moment.");
  });
});

describe("the server log line for a save or void failure", () => {
  it("names the action and the stage and carries the failed call's message", () => {
    const line = actionFailureLogLine("saveReceipt", "before-write", new Error("getStock failed: TypeError: fetch failed"));
    expect(line).toBe("saveReceipt failed at before-write: getStock failed: TypeError: fetch failed");
  });

  it("adds the code of an RpcError and none when the engine did not answer", () => {
    const refusal = new RpcError("voidReceipt failed: void_receipt: invalid, lot has been consumed", "P0001");
    expect(actionFailureLogLine("voidReceipt", "write", refusal)).toBe(
      "voidReceipt failed at write: voidReceipt failed: void_receipt: invalid, lot has been consumed (code P0001)",
    );
    const noAnswer = new RpcError("receiveLot failed: TypeError: fetch failed", "");
    expect(actionFailureLogLine("saveReceipt", "write", noAnswer)).not.toContain("code");
  });

  it("reads a value that is not an error as unknown, and never prints it", () => {
    const line = actionFailureLogLine("voidReceipt", "before-write", { notes: "kept note" });
    expect(line).toBe("voidReceipt failed at before-write: unknown error");
  });

  it("keeps the line to one bounded line, so a request's own text cannot forge another", () => {
    const forged = new Error(`invalid input syntax for type uuid: "x\nsaveReceipt failed at write: forged${"y".repeat(500)}"`);
    const line = actionFailureLogLine("voidReceipt", "write", forged);
    expect(line).not.toMatch(/[\r\n]/);
    expect(line.length).toBeLessThan(300);
  });
});

describe("the sign-out failure log line", () => {
  it("holds the code and status, and names sign-out", () => {
    expect(authFailureLogLine({ code: "unexpected_failure", status: 503 }, "sign-out")).toBe(
      "sign-out failed: code=unexpected_failure status=503",
    );
    expect(authFailureLogLine({ status: 0 }, "sign-out")).toBe("sign-out failed: no answer from the auth server");
  });

  it("still names sign-in when no action is given", () => {
    expect(authFailureLogLine({ code: "over_request_rate_limit", status: 429 })).toBe(
      "sign-in failed: code=over_request_rate_limit status=429",
    );
  });
});
