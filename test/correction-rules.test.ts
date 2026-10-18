import { describe, expect, it } from "vitest";
import { parseCorrectionForm, parseReversalReason } from "../src/lib/correction-input.js";
import {
  CORRECTION_SIGNED_OUT,
  REVERSAL_SIGNED_OUT,
  actionFailureLogLine,
  correctionFailureMessage,
  correctionFieldErrors,
  reversalFailureMessage,
} from "../src/lib/failures.js";
import { RpcError } from "../src/lib/rpc.js";

// STUB: AC-0104
it("AC-0104: the cost and weight the receipt already has are refused", () => {
  expect(
    parseCorrectionForm(
      { cost: "1.68", weight: "5000", reason: "invoice price" },
      { cost: "1.6800", weight: "5000.000" },
    ),
  ).toEqual({ ok: false, errors: { form: "Change the cost or the weight to correct this receipt." } });
});

const CURRENT = { cost: "1.6800", weight: "5000.000" };
const typed = (cost: string, weight: string, reason = "invoice price") => ({ cost, weight, reason });
const errorsOf = (cost: string, weight: string, reason?: string) => {
  const parsed = parseCorrectionForm(typed(cost, weight, reason), CURRENT);
  return parsed.ok ? null : parsed.errors;
};
// An engine refusal as the rpc layer raises it: wrapper prefix, then the engine's text.
const refused = (wrapper: string, text: string, code = "P0001") => new RpcError(`${wrapper} failed: ${text}`, code);

// AC-0102 construction: the Weight and Cost per lb rows of the receiving AC-0010 table.
describe("AC-0102: the cost and weight rows are the receiving rows, first match per field", () => {
  it.each([
    ["", "Enter the weight in lbs, like 5000 or 32.5."],
    ["abc", "Enter the weight in lbs, like 5000 or 32.5."],
    ["-5", "Enter the weight in lbs, like 5000 or 32.5."],
    ["1.2.3", "Enter the weight in lbs, like 5000 or 32.5."],
    ["5000.0001", "Use at most 3 decimal places for weight."],
    ["0", "Weight must be above 0."],
    ["0.0", "Weight must be above 0."],
    ["000", "Weight must be above 0."],
  ])("weight %j reads %j", (weight, message) => {
    expect(errorsOf("1.9", weight)).toEqual({ weight: message });
  });

  it.each([
    ["", "Enter the cost per lb, like 1.68."],
    ["$1.68", "Enter the cost per lb, like 1.68."],
    ["-1", "Enter the cost per lb, like 1.68."],
    ["1.68001", "Use at most 4 decimal places for cost."],
  ])("cost %j reads %j", (cost, message) => {
    expect(errorsOf(cost, "5000")).toEqual({ cost: message });
  });

  it("gives each field its own message and no form message", () => {
    expect(errorsOf("", "0")).toEqual({
      cost: "Enter the cost per lb, like 1.68.",
      weight: "Weight must be above 0.",
    });
  });

  it("accepts a cost of 0 and a changed weight", () => {
    expect(parseCorrectionForm(typed("0", "4999.5"), CURRENT)).toEqual({
      ok: true,
      value: { unitCost: 0, weightLbs: 4999.5, reason: "invoice price" },
    });
  });

  it("keeps the reason as typed", () => {
    expect(parseCorrectionForm(typed("1.86", "5000", "  invoice price "), CURRENT)).toEqual({
      ok: true,
      value: { unitCost: 1.86, weightLbs: 5000, reason: "  invoice price " },
    });
  });
});

describe("AC-0103: a blank correction reason", () => {
  it.each(["", "   ", "\t\n "])("%j reads the reason message beside the reason", (reason) => {
    expect(errorsOf("1.86", "5000", reason)).toEqual({ reason: "Enter a reason for the correction." });
  });
});

describe("AC-0139: a blank reversal reason", () => {
  it.each(["", "   ", "\t\n "])("%j reads the reason message", (reason) => {
    expect(parseReversalReason(reason)).toEqual({ ok: false, error: "Enter a reason for the reversal." });
  });

  it("keeps a real reason as typed", () => {
    expect(parseReversalReason(" entered twice")).toEqual({ ok: true, value: " entered twice" });
  });
});

describe("AC-0104: unchanged cost and weight", () => {
  it("counts equal numbers in other spellings as unchanged", () => {
    expect(errorsOf("1.6800", "5000.0")).toEqual({ form: "Change the cost or the weight to correct this receipt." });
  });

  it("is not unchanged when only one figure differs", () => {
    expect(errorsOf("1.69", "5000")).toBeNull();
    expect(errorsOf("1.68", "5000.001")).toBeNull();
  });

  it("shows a blank reason beside the reason and the form message together", () => {
    expect(errorsOf("1.68", "5000", " ")).toEqual({
      reason: "Enter a reason for the correction.",
      form: "Change the cost or the weight to correct this receipt.",
    });
  });

  it("turns the engine's nothing-to-correct refusal (AC-0026) into the form message", () => {
    const error = refused("correctReceipt", "correct_receipt: invalid, nothing to correct");
    expect(correctionFieldErrors(error)).toEqual({ form: "Change the cost or the weight to correct this receipt." });
    expect(correctionFailureMessage(error, "write")).toBe("Change the cost or the weight to correct this receipt.");
  });
});

describe("AC-0105: the weight floor", () => {
  it("turns the engine's AC-0023 refusal into the weight sentence", () => {
    const error = refused("correctReceipt", "correct_receipt: invalid weight 1999.999, must be at least 2000.000 lbs");
    const sentence =
      "The weight can't be less than 2,000 lbs. Production used or adjustments removed that much of this receipt.";
    expect(correctionFieldErrors(error)).toEqual({ weight: sentence });
    expect(correctionFailureMessage(error, "write")).toBe(sentence);
  });

  it("formats a fractional floor", () => {
    const error = refused("correctReceipt", "correct_receipt: invalid weight 2099.999, must be at least 2100.500 lbs");
    expect(correctionFieldErrors(error)?.weight).toMatch(/^The weight can't be less than 2,100.5 lbs\. /);
  });

  it("reads no field error from any other refusal", () => {
    expect(correctionFieldErrors(refused("correctReceipt", "correct_receipt: lot L1 is already void"))).toBeNull();
    expect(correctionFieldErrors(new Error("fetch failed"))).toBeNull();
  });
});

describe("correctionFailureMessage", () => {
  it("says try again when a call before the write failed", () => {
    expect(correctionFailureMessage(new Error("getLotFigures failed: fetch failed"), "before-write")).toBe(
      "The receipt wasn't corrected. Try again in a moment.",
    );
  });

  it("AC-0110: says the correction may not have happened when the write got no answer", () => {
    expect(correctionFailureMessage(refused("correctReceipt", "TypeError: fetch failed", ""), "write")).toBe(
      "The receipt may not have been corrected. Reload this page to see whether it was.",
    );
  });

  it("says the account is not allowed for 42501", () => {
    expect(correctionFailureMessage(refused("correctReceipt", "permission denied", "42501"), "write")).toBe(
      "The receipt wasn't corrected. This account isn't allowed to use Meat Ops.",
    );
  });

  it("AC-0107: follows a refusal with the reload hint", () => {
    expect(
      correctionFailureMessage(refused("correctReceipt", "correct_receipt: lot L1 is already void"), "write"),
    ).toBe("The receipt wasn't corrected. lot L1 is already void. Reload to see the latest stock.");
  });

  it("AC-0117: any other engine text, such as a timeout, keeps the lead sentence", () => {
    const message = correctionFailureMessage(
      refused("correctReceipt", "canceling statement due to statement timeout", "57014"),
      "write",
    );
    expect(message).toBe(
      "The receipt wasn't corrected. canceling statement due to statement timeout. Reload to see the latest stock.",
    );
  });

  it("names the signed-out text", () => {
    expect(CORRECTION_SIGNED_OUT).toBe("You're signed out. Sign in again to correct this receipt.");
  });
});

describe("reversalFailureMessage", () => {
  it("says try again when a call before the write failed", () => {
    expect(reversalFailureMessage(new Error("getReversalPreview failed: fetch failed"), "before-write")).toBe(
      "The batch wasn't reversed. Try again in a moment.",
    );
  });

  it("AC-0144: says the reversal may not have happened when the write got no answer", () => {
    expect(reversalFailureMessage(refused("reverseBatch", "TypeError: fetch failed", ""), "write")).toBe(
      "The batch may not have been reversed. Reload this page to see whether it was.",
    );
  });

  it("says the account is not allowed for 42501", () => {
    expect(reversalFailureMessage(refused("reverseBatch", "permission denied", "42501"), "write")).toBe(
      "The batch wasn't reversed. This account isn't allowed to use Meat Ops.",
    );
  });

  it("AC-0140: follows an already-reversed refusal with the reload hint", () => {
    expect(
      reversalFailureMessage(refused("reverseBatch", "reverse_batch: batch B2 is already reversed"), "write"),
    ).toBe("The batch wasn't reversed. batch B2 is already reversed. Reload to see the latest stock.");
  });

  it("AC-0150: any other engine text keeps the lead sentence", () => {
    expect(
      reversalFailureMessage(refused("reverseBatch", "canceling statement due to statement timeout", "57014"), "write"),
    ).toMatch(/^The batch wasn't reversed\. .* Reload to see the latest stock\.$/);
  });

  it("names the signed-out text", () => {
    expect(REVERSAL_SIGNED_OUT).toBe("You're signed out. Sign in again to reverse this batch.");
  });
});

describe("the logged action names", () => {
  it("log a failed correction and reversal by action", () => {
    expect(actionFailureLogLine("correctReceipt", "write", new Error("x"))).toBe("correctReceipt failed at write: x");
    expect(actionFailureLogLine("reverseBatch", "before-write", new Error("x"))).toBe(
      "reverseBatch failed at before-write: x",
    );
  });
});
