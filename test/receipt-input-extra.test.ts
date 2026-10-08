import { describe, expect, it } from "vitest";
import { parseReceiptForm, type ReceiptFields } from "../src/lib/receipt-input.js";

// Cases the plan's stubs leave open: the trim rule, number shapes, blank notes,
// and one message per refused field.
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

describe("receipt form rules, beyond the stubs", () => {
  it("trims the product code before the lookup and saves the trimmed code", () => {
    const parsed = parseReceiptForm({ ...VALID, productCode: "  RAW-TOM \n" }, CODES);
    expect(parsed.ok && parsed.value.productCode).toBe("RAW-TOM");
  });

  it("treats a spaces-only product code as blank and names the trimmed code when unknown", () => {
    expect(parseReceiptForm({ ...VALID, productCode: "   " }, CODES)).toEqual({
      ok: false,
      errors: { productCode: "Enter a product code." },
    });
    expect(parseReceiptForm({ ...VALID, productCode: " 502 " }, CODES)).toEqual({
      ok: false,
      errors: { productCode: "No active raw product has code 502." },
    });
  });

  it("matches a product code exactly, including case", () => {
    expect(parseReceiptForm({ ...VALID, productCode: "raw-tom" }, CODES)).toEqual({
      ok: false,
      errors: { productCode: "No active raw product has code raw-tom." },
    });
  });

  it.each(["", ".", "1.2.3", "1e3", "+5", " 5", "5 ", "5\n", "٣"])(
    "refuses weight %j as a bad format",
    (weight) => {
      expect(parseReceiptForm({ ...VALID, weight }, CODES)).toEqual({
        ok: false,
        errors: { weight: "Enter the weight in lbs, like 5000 or 32.5." },
      });
    },
  );

  it("accepts a number with a trailing or leading decimal point", () => {
    const parsed = parseReceiptForm({ ...VALID, weight: "5.", cost: ".5" }, CODES);
    expect(parsed.ok && [parsed.value.weightLbs, parsed.value.unitCost]).toEqual([5, 0.5]);
  });

  it("refuses a cost with a bad format, and accepts 0 and 0.0000", () => {
    expect(parseReceiptForm({ ...VALID, cost: "." }, CODES)).toEqual({
      ok: false,
      errors: { cost: "Enter the cost per lb, like 1.68." },
    });
    const zero = parseReceiptForm({ ...VALID, cost: "0.0000" }, CODES);
    expect(zero.ok && zero.value.unitCost).toBe(0);
  });

  it("accepts a received date before today", () => {
    expect(parseReceiptForm({ ...VALID, receivedDate: "2026-10-06" }, CODES).ok).toBe(true);
  });

  it("counts notes by string length and turns blank notes into no notes", () => {
    expect(parseReceiptForm({ ...VALID, notes: "n".repeat(501) }, CODES).ok).toBe(false);
    const blank = parseReceiptForm({ ...VALID, notes: "   " }, CODES);
    expect(blank.ok && "notes" in blank.value).toBe(false);
    const kept = parseReceiptForm({ ...VALID, notes: "dock 3" }, CODES);
    expect(kept.ok && kept.value.notes).toBe("dock 3");
  });

  it("gives every refused field exactly one message and no others", () => {
    expect(
      parseReceiptForm(
        { ...VALID, productCode: "", vendorId: "", weight: "0", cost: "x", receivedDate: "" },
        CODES,
      ),
    ).toEqual({
      ok: false,
      errors: {
        productCode: "Enter a product code.",
        vendorId: "Choose a vendor.",
        weight: "Weight must be above 0.",
        cost: "Enter the cost per lb, like 1.68.",
        receivedDate: "Enter the received date.",
      },
    });
  });
});
