import { describe, expect, it } from "vitest";
import { parseBatchForm } from "../src/lib/batch-input.js";
import { batchSaveFailureMessage } from "../src/lib/failures.js";
import { formatMoney, formatShrink } from "../src/lib/format.js";
import { RpcError } from "../src/lib/rpc.js";

const fields = {
  productCode: "502",
  rawLbs: "2000",
  finishedLbs: "",
  productionDate: "2026-10-06",
  notes: "",
  today: "2026-10-08",
};

describe("batch form rules", () => {
  // STUB: AC-0010
  it("AC-0010: finished lbs above the raw lbs is refused", () => {
    expect(parseBatchForm({ ...fields, finishedLbs: "2000.001" }, new Set(["502"]))).toEqual({
      ok: false,
      errors: { finishedLbs: "Finished lbs can't be more than the raw lbs." },
    });
  });
});

describe("production formats", () => {
  // STUB: AC-0045
  it("AC-0045: a shrink shows as a percent", () => {
    expect([0.23, 0.235, 0.2345, 0].map((fraction) => formatShrink(fraction))).toEqual([
      "23%",
      "23.5%",
      "23.45%",
      "0%",
    ]);
  });

  // STUB: AC-0046
  it("AC-0046: a raw cost total shows as dollars and cents", () => {
    expect([3360, 10200, 1234.5678, 0.005].map((total) => formatMoney(total))).toEqual([
      "$3,360.00",
      "$10,200.00",
      "$1,234.57",
      "$0.01",
    ]);
  });
});

describe("batch save messages", () => {
  // STUB: AC-0030
  it("AC-0030: a shortfall names what is available and what is needed", () => {
    const error = new RpcError(
      "produceBatch failed: produce_batch: shortfall, only 5000.000 lbs raw available on or before 2026-10-03, need 6000",
      "P0001",
    );
    expect(batchSaveFailureMessage(error, "write")).toBe(
      "The batch wasn't saved. Only 5,000 lbs of raw on hand was received on or before Oct 3, 2026, and this batch needs 6,000 lbs.",
    );
  });
});

const codes = new Set(["502"]);
const refusal = (over: Partial<typeof fields>) => {
  const result = parseBatchForm({ ...fields, ...over }, codes);
  return result.ok ? null : result.errors;
};

describe("AC-0010: each refused input", () => {
  it.each([
    ["blank code", { productCode: "" }, { productCode: "Enter a product code." }],
    ["blank-looking code", { productCode: "  " }, { productCode: "Enter a product code." }],
    ["unknown code", { productCode: "RAW-TOM" }, { productCode: "No active finished product has code RAW-TOM." }],
    ["blank raw lbs", { rawLbs: "" }, { rawLbs: "Enter the raw lbs, like 2000 or 32.5." }],
    ["letters in raw lbs", { rawLbs: "12a" }, { rawLbs: "Enter the raw lbs, like 2000 or 32.5." }],
    ["two points in raw lbs", { rawLbs: "1.2.3" }, { rawLbs: "Enter the raw lbs, like 2000 or 32.5." }],
    ["negative raw lbs", { rawLbs: "-5" }, { rawLbs: "Enter the raw lbs, like 2000 or 32.5." }],
    ["four decimals in raw lbs", { rawLbs: "1.0001" }, { rawLbs: "Use at most 3 decimal places for weight." }],
    ["zero raw lbs", { rawLbs: "0" }, { rawLbs: "Raw lbs must be above 0." }],
    ["0.0 raw lbs", { rawLbs: "0.0" }, { rawLbs: "Raw lbs must be above 0." }],
    ["000 raw lbs", { rawLbs: "000" }, { rawLbs: "Raw lbs must be above 0." }],
    ["letters in finished lbs", { finishedLbs: "abc" }, { finishedLbs: "Enter the finished lbs, like 1540 or 32.5, or leave it blank." }],
    ["four decimals in finished lbs", { finishedLbs: "1.0001" }, { finishedLbs: "Use at most 3 decimal places for weight." }],
    ["zero finished lbs", { finishedLbs: "0" }, { finishedLbs: "Finished lbs must be above 0." }],
    ["finished above raw", { finishedLbs: "2000.001" }, { finishedLbs: "Finished lbs can't be more than the raw lbs." }],
    ["blank date", { productionDate: "" }, { productionDate: "Enter the production date." }],
    ["not YYYY-MM-DD", { productionDate: "10/06/2026" }, { productionDate: "Enter the production date." }],
    ["not a calendar date", { productionDate: "2026-02-30" }, { productionDate: "Enter the production date." }],
    ["month 13", { productionDate: "2026-13-01" }, { productionDate: "Enter the production date." }],
    ["date after today", { productionDate: "2026-10-09" }, { productionDate: "The production date can't be after today." }],
    ["long notes", { notes: "x".repeat(501) }, { notes: "Keep notes to 500 characters or fewer." }],
    ["invalid today", { today: "2026-02-30" }, { productionDate: "Enter the production date." }],
    ["blank today", { today: "" }, { productionDate: "Enter the production date." }],
  ])("%s", (_name, over, errors) => {
    expect(refusal(over)).toEqual(errors);
  });

  it("first matching row wins within a field", () => {
    expect(refusal({ rawLbs: "0.0001" })).toEqual({ rawLbs: "Use at most 3 decimal places for weight." });
    expect(refusal({ finishedLbs: "0.0001" })).toEqual({ finishedLbs: "Use at most 3 decimal places for weight." });
    expect(refusal({ productionDate: "2026-02-30", today: "2026-01-01" })).toEqual({
      productionDate: "Enter the production date.",
    });
  });

  it("compares finished to raw only when the raw lbs pass their rows", () => {
    expect(refusal({ rawLbs: "abc", finishedLbs: "5" })).toEqual({
      rawLbs: "Enter the raw lbs, like 2000 or 32.5.",
    });
    expect(refusal({ rawLbs: "0", finishedLbs: "5" })).toEqual({ rawLbs: "Raw lbs must be above 0." });
  });

  it("reports every field's error at once", () => {
    expect(refusal({ productCode: "", rawLbs: "", productionDate: "" })).toEqual({
      productCode: "Enter a product code.",
      rawLbs: "Enter the raw lbs, like 2000 or 32.5.",
      productionDate: "Enter the production date.",
    });
  });
});

describe("AC-0011: accepted extremes", () => {
  it("accepts 0.001 raw and finished lbs, today, and a 500-character note", () => {
    const notes = "n".repeat(500);
    expect(
      parseBatchForm(
        { ...fields, rawLbs: "0.001", finishedLbs: "0.001", productionDate: "2026-10-08", notes },
        codes,
      ),
    ).toEqual({
      ok: true,
      value: { productCode: "502", rawLbs: 0.001, finishedLbs: 0.001, productionDate: "2026-10-08", notes },
    });
  });

  it("accepts finished lbs equal to raw lbs", () => {
    expect(parseBatchForm({ ...fields, finishedLbs: "2000" }, codes)).toEqual({
      ok: true,
      value: { productCode: "502", rawLbs: 2000, finishedLbs: 2000, productionDate: "2026-10-06" },
    });
  });

  it("leaves finished lbs and notes out when blank", () => {
    expect(parseBatchForm({ ...fields, notes: "  " }, codes)).toEqual({
      ok: true,
      value: { productCode: "502", rawLbs: 2000, productionDate: "2026-10-06" },
    });
  });
});

describe("AC-0045 and AC-0046: more examples", () => {
  it("shows other shrinks without float noise", () => {
    expect([0.6, 0.07, 0.1, 1, 0.12345].map((f) => formatShrink(f))).toEqual(["60%", "7%", "10%", "100%", "12.35%"]);
  });

  it("shows other money totals", () => {
    expect([1, 999999.995, 0.004].map((t) => formatMoney(t))).toEqual(["$1.00", "$1,000,000.00", "$0.00"]);
  });
});

describe("batch save messages: the rest", () => {
  const rpc = (message: string, code: string) => new RpcError(`produceBatch failed: ${message}`, code);

  it("AC-0031: an inactive finished product", () => {
    expect(batchSaveFailureMessage(rpc("produce_batch: product abc is inactive", "P0001"), "write")).toBe(
      "The batch wasn't saved. This product is no longer active.",
    );
  });

  it("AC-0032: an inactive raw input is checked before the general rule", () => {
    expect(batchSaveFailureMessage(rpc("produce_batch: raw input abc is inactive", "P0001"), "write")).toBe(
      "The batch wasn't saved. Its raw product is no longer active.",
    );
  });

  it("AC-0034: any error before the write", () => {
    const text = "The batch wasn't saved. Try again in a moment.";
    expect(batchSaveFailureMessage(new Error("fetch failed"), "before-write")).toBe(text);
    expect(batchSaveFailureMessage(rpc("x", "42501"), "before-write")).toBe(text);
  });

  it("AC-0035: a write error with no code", () => {
    const text =
      "The batch may not have been saved. Reload this page and check Recent batches before saving again.";
    expect(batchSaveFailureMessage(new Error("aborted"), "write")).toBe(text);
    expect(batchSaveFailureMessage(new RpcError("produceBatch failed: x", ""), "write")).toBe(text);
  });

  it("AC-0075: any other engine refusal shows its reason", () => {
    expect(
      batchSaveFailureMessage(
        rpc("produce_batch: invalid yield, finished lbs out would be 0", "P0001"),
        "write",
      ),
    ).toBe("The batch wasn't saved. invalid yield, finished lbs out would be 0");
  });

  it("AC-0080: a 42501 from the write", () => {
    expect(batchSaveFailureMessage(rpc("permission denied", "42501"), "write")).toBe(
      "The batch wasn't saved. This account isn't allowed to use Meat Ops.",
    );
  });

  it("AC-0030: a fractional shortfall is formatted", () => {
    const error = rpc(
      "produce_batch: shortfall, only 0.500 lbs raw available on or before 2026-10-03, need 1234.5",
      "P0001",
    );
    expect(batchSaveFailureMessage(error, "write")).toBe(
      "The batch wasn't saved. Only 0.5 lbs of raw on hand was received on or before Oct 3, 2026, and this batch needs 1,234.5 lbs.",
    );
  });
});
