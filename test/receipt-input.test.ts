import { describe, expect, it } from "vitest";
import { parseReceiptForm, parseVoidReason, type ReceiptFields } from "../src/lib/receipt-input.js";

const CODES: ReadonlySet<string> = new Set(["RAW-TOM"]);
const VALID: ReceiptFields = {
  productCode: "RAW-TOM",
  vendorId: "11111111-1111-1111-1111-111111111111",
  weight: "5000",
  cost: "1.68",
  receivedDate: "2026-10-07",
  notes: "",
  today: "2026-10-07",
};

// STUB: AC-0010
describe("AC-0010: receipt form rules", () => {
  it.each<[keyof ReceiptFields, string, string]>([
    ["productCode", "", "Enter a product code."],
    ["productCode", "502", "No active raw product has code 502."],
    ["vendorId", "", "Choose a vendor."],
    ["weight", "", "Enter the weight in lbs, like 5000 or 32.5."],
    ["weight", "5,000", "Enter the weight in lbs, like 5000 or 32.5."],
    ["weight", "-5", "Enter the weight in lbs, like 5000 or 32.5."],
    ["weight", "1.2345", "Use at most 3 decimal places for weight."],
    ["weight", "0.0000", "Use at most 3 decimal places for weight."],
    ["weight", "0", "Weight must be above 0."],
    ["weight", "0.0", "Weight must be above 0."],
    ["weight", "000", "Weight must be above 0."],
    ["cost", "", "Enter the cost per lb, like 1.68."],
    ["cost", "-1", "Enter the cost per lb, like 1.68."],
    ["cost", "1.68555", "Use at most 4 decimal places for cost."],
    ["receivedDate", "", "Enter the received date."],
    ["receivedDate", "2026-10-08", "The received date can't be after today."],
    ["notes", "x".repeat(501), "Keep notes to 500 characters or fewer."],
  ])("refuses %s = %j with its message", (field, input, message) => {
    expect(parseReceiptForm({ ...VALID, [field]: input }, CODES)).toEqual({
      ok: false,
      errors: { [field]: message },
    });
  });
});

// STUB: AC-0011
describe("AC-0011: boundary values save", () => {
  it("accepts the smallest weight, a zero cost, today, and a 500-character note", () => {
    expect(
      parseReceiptForm({ ...VALID, weight: "0.001", cost: "0", notes: "n".repeat(500) }, CODES),
    ).toEqual({
      ok: true,
      value: {
        productCode: "RAW-TOM",
        vendorId: VALID.vendorId,
        weightLbs: 0.001,
        unitCost: 0,
        receivedDate: "2026-10-07",
        notes: "n".repeat(500),
      },
    });
  });

  it("accepts 3 weight decimals and 4 cost decimals", () => {
    expect(parseReceiptForm({ ...VALID, weight: "32.125", cost: "1.6855" }, CODES)).toEqual({
      ok: true,
      value: {
        productCode: "RAW-TOM",
        vendorId: VALID.vendorId,
        weightLbs: 32.125,
        unitCost: 1.6855,
        receivedDate: "2026-10-07",
      },
    });
  });
});

// STUB: AC-0051
describe("AC-0051: void reason rule", () => {
  it("refuses a blank or spaces-only reason and keeps a real one", () => {
    expect(parseVoidReason("")).toEqual({ ok: false, error: "Enter a reason for the void." });
    expect(parseVoidReason("   ")).toEqual({ ok: false, error: "Enter a reason for the void." });
    expect(parseVoidReason("entered twice")).toEqual({ ok: true, value: "entered twice" });
  });
});
