import { describe, expect, it } from "vitest";
import { changeFailureMessage } from "../src/lib/failures.js";
import { formatMargin } from "../src/lib/format.js";
import { priceAdvice, priceButtonName } from "../src/lib/price-advice.js";
import { parseTargetMargin } from "../src/lib/price-input.js";
import { RpcError } from "../src/lib/rpc.js";

describe("margin format", () => {
  // STUB: AC-0140
  it("AC-0140: a margin shows as a percent", () => {
    expect([0.2, 0.018, 0.2001, 0.2481, -0.0527, 0].map((fraction) => formatMargin(fraction))).toEqual([
      "20%",
      "1.8%",
      "20.01%",
      "24.81%",
      "-5.27%",
      "0%",
    ]);
  });
});

describe("price form rules", () => {
  // STUB: AC-0091
  it("AC-0091: a target margin of 100 is refused", () => {
    expect(parseTargetMargin("100")).toEqual({ ok: false, error: "A target margin must be below 100." });
  });
});

describe("price advice", () => {
  // STUB: AC-0065
  it("AC-0065: the advice for a product with a target and a list price", () => {
    const row = {
      costPerLb: 2.6318,
      suggestedListPrice: 3.29,
      targetMarginPct: 0.2,
      listPricePerLb: 2.68,
      marginAtListPct: 0.018,
      marginFeesPerLb: 0.05,
    };
    expect(priceAdvice(row)).toBe(
      "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. At your list price of $2.68/lb, the margin is 1.8%.",
    );
    expect(priceButtonName("raise", 3.29)).toBe("Raise list price to $3.29/lb");
  });
});

describe("change messages", () => {
  // STUB: AC-0116
  it("AC-0116: an inactive product's refusal says so", () => {
    const error = new RpcError(
      "setListPrice failed: set_list_price: product 33333333-3333-3333-3333-333333333333 is inactive",
      "P0001",
    );
    expect(changeFailureMessage(error, "write")).toBe("The change wasn't saved. This product is no longer active.");
  });
});

import { CHANGE_SIGNED_OUT } from "../src/lib/failures.js";
import { percentText, priceFieldText, formatCostPerLb } from "../src/lib/format.js";
import { parseListPrice, parseWhatIf } from "../src/lib/price-input.js";

describe("target margin rows (AC-0091)", () => {
  it.each(["", " ", "abc", "-5", "1e2", "2.5.1", "."])("%j asks for a target margin", (text) => {
    expect(parseTargetMargin(text)).toEqual({ ok: false, error: "Enter a target margin, like 20 or 22.5." });
  });
  it("more than 2 decimal places wins over 100 or more", () => {
    const error = "Use at most 2 decimal places for a target margin.";
    expect(parseTargetMargin("22.555")).toEqual({ ok: false, error });
    expect(parseTargetMargin("100.001")).toEqual({ ok: false, error });
  });
  it.each(["100", "100.00", "250"])("%s is above the limit", (text) => {
    expect(parseTargetMargin(text)).toEqual({ ok: false, error: "A target margin must be below 100." });
  });
  it("returns the number the text spells", () => {
    expect(parseTargetMargin("22.5")).toEqual({ ok: true, value: 22.5 });
    expect(parseTargetMargin("0")).toEqual({ ok: true, value: 0 });
    expect(parseTargetMargin("99.99")).toEqual({ ok: true, value: 99.99 });
  });
});

describe("list price rows (AC-0101)", () => {
  it.each(["", "x", "-1", "3,29"])("%j asks for the price", (text) => {
    expect(parseListPrice(text)).toEqual({ ok: false, error: "Enter the price per lb, like 3.29." });
  });
  it("more than 2 decimal places wins over zero and the limit", () => {
    const error = "Use at most 2 decimal places for a price.";
    expect(parseListPrice("0.001")).toEqual({ ok: false, error });
    expect(parseListPrice("100000000.001")).toEqual({ ok: false, error });
  });
  it.each(["0", "0.0", "000", "0.00"])("%s is not above 0", (text) => {
    expect(parseListPrice(text)).toEqual({ ok: false, error: "Price must be above 0." });
  });
  it.each(["100000000", "100000000.00", "999999999"])("%s is at or above the limit", (text) => {
    expect(parseListPrice(text)).toEqual({ ok: false, error: "Price must be below 100,000,000." });
  });
  it("returns the number the text spells", () => {
    expect(parseListPrice("3.29")).toEqual({ ok: true, value: 3.29 });
    expect(parseListPrice("99999999.99")).toEqual({ ok: true, value: 99999999.99 });
    expect(parseListPrice("0.01")).toEqual({ ok: true, value: 0.01 });
  });
});

describe("what-if rows (AC-0123)", () => {
  it("refuses no raw product, and keeps a good cost", () => {
    expect(parseWhatIf({ rawCode: "", cost: "2.00" })).toEqual({
      ok: false,
      errors: { rawCode: "Choose a raw product." },
    });
  });
  it("refuses both fields at once", () => {
    expect(parseWhatIf({ rawCode: "", cost: "" })).toEqual({
      ok: false,
      errors: { rawCode: "Choose a raw product.", cost: "Enter the cost per lb, like 1.68." },
    });
  });
  it.each(["", "abc", "-1", "1.2.3"])("%j asks for the cost", (cost) => {
    expect(parseWhatIf({ rawCode: "RAW-TOM", cost })).toEqual({
      ok: false,
      errors: { cost: "Enter the cost per lb, like 1.68." },
    });
  });
  it("refuses more than 4 decimal places", () => {
    expect(parseWhatIf({ rawCode: "RAW-TOM", cost: "1.23456" })).toEqual({
      ok: false,
      errors: { cost: "Use at most 4 decimal places for cost." },
    });
  });
  it("accepts a cost of 0 and passes an unknown code through", () => {
    expect(parseWhatIf({ rawCode: "RAW-TOM", cost: "2.0000" })).toEqual({
      ok: true,
      value: { rawCode: "RAW-TOM", cost: 2 },
    });
    expect(parseWhatIf({ rawCode: "<b>9</b>", cost: "0" })).toEqual({
      ok: true,
      value: { rawCode: "<b>9</b>", cost: 0 },
    });
  });
});

describe("starting values (AC-0090, AC-0100)", () => {
  it("writes a target as a percent without %", () => {
    expect([0.2, 0.225, 0.2, 0].map((fraction) => percentText(fraction))).toEqual(["20", "22.5", "20", "0"]);
  });
  it("writes a list price with 2 decimals", () => {
    expect([3.5, 3.29, 12].map((price) => priceFieldText(price))).toEqual(["3.50", "3.29", "12.00"]);
    expect(priceFieldText(1234.5)).toBe("1234.50");
  });
  it("shows a fee with 4 decimals", () => {
    expect(formatCostPerLb(0.05)).toBe("$0.0500/lb");
  });
});

describe("advice rows (AC-0065, AC-0066)", () => {
  const base = {
    costPerLb: 2.6318,
    suggestedListPrice: 3.29,
    targetMarginPct: 0.2,
    listPricePerLb: 2.68,
    marginAtListPct: 0.018,
    marginFeesPerLb: 0.05,
  };
  it("target set, no list price", () => {
    expect(priceAdvice({ ...base, listPricePerLb: null, marginAtListPct: null })).toBe(
      "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. This product has no list price yet.",
    );
  });
  it("no target, list price set", () => {
    expect(priceAdvice({ ...base, targetMarginPct: null })).toBe(
      "Cost is $2.6318/lb. With no target margin, the suggested price is cost plus $0.0500/lb in margin fees. At your list price of $2.68/lb, the margin is 1.8%.",
    );
  });
  it("no target, no list price (the 502 fixture)", () => {
    expect(
      priceAdvice({
        ...base,
        suggestedListPrice: 2.68,
        targetMarginPct: null,
        listPricePerLb: null,
        marginAtListPct: null,
      }),
    ).toBe(
      "Cost is $2.6318/lb. With no target margin, the suggested price is cost plus $0.0500/lb in margin fees. This product has no list price yet.",
    );
  });
  it("names the Set and Lower buttons", () => {
    expect(priceButtonName("set", 3.29)).toBe("Set list price to $3.29/lb");
    expect(priceButtonName("lower", 3.29)).toBe("Lower list price to $3.29/lb");
  });
});

describe("more margins (AC-0140)", () => {
  it("handles a whole-number and a negative margin", () => {
    expect([0.5, 0.0737, -0.1].map((fraction) => formatMargin(fraction))).toEqual(["50%", "7.37%", "-10%"]);
  });
});

describe("change messages (AC-0110, AC-0113, AC-0114, AC-0117, AC-0118)", () => {
  it("AC-0113: a failure before the write says try again", () => {
    expect(changeFailureMessage(new Error("auth lookup failed"), "before-write")).toBe(
      "The change wasn't saved. Try again in a moment.",
    );
  });
  it("AC-0114: a write with no answer may not have been saved", () => {
    expect(changeFailureMessage(new RpcError("setTargetMargin failed: fetch failed", ""), "write")).toBe(
      "The change may not have been saved. Reload this page to check it.",
    );
  });
  it("AC-0117: a 42501 is not allowed", () => {
    expect(changeFailureMessage(new RpcError("setListPrice failed: set_list_price: not an operator", "42501"), "write")).toBe(
      "The change wasn't saved. This account isn't allowed to use Meat Ops.",
    );
  });
  it("AC-0118: another refusal shows its text after the prefixes", () => {
    const id = "00000000-0000-0000-0000-000000000000";
    expect(changeFailureMessage(new RpcError(`setListPrice failed: set_list_price: product ${id} not found`, "P0001"), "write")).toBe(
      `The change wasn't saved. product ${id} not found`,
    );
    expect(
      changeFailureMessage(new RpcError("setTargetMargin failed: set_target_margin: target has more than 2 decimal places", "P0001"), "write"),
    ).toBe("The change wasn't saved. target has more than 2 decimal places");
  });
  it("AC-0110: the signed-out text", () => {
    expect(CHANGE_SIGNED_OUT).toBe("You're signed out. Sign in again to save this change.");
  });
});
