import { expect, it } from "vitest";
import { alertText, type AlertView } from "../src/lib/alert-text.js";
import { digestVerdict } from "../src/lib/digest.js";
import { formatChange, formatDays } from "../src/lib/format.js";

const MARGIN: AlertView = {
  type: "margin_below_target",
  code: "502",
  description: "Smoked Turkey Drums Tom",
  listPrice: 2.68,
  marginAtList: 0.018,
  targetMargin: 0.2,
  costPerLb: 2.6318,
  suggestedListPrice: 3.29,
  priceAction: "raise",
};

// STUB: AC-0100
it("AC-0100: a margin alert reads as the spec writes it", () => {
  expect(alertText(MARGIN)).toEqual({
    title: "Margin below target: 502 Smoked Turkey Drums Tom",
    sentence: "At your list price of $2.68/lb, the margin is 1.8%, below your 20% target. Cost is $2.6318/lb.",
    nextStep: "Raise list price to $3.29/lb",
  });
});

// STUB: AC-0107
it("AC-0107: the days format", () => {
  expect([5.3333, 7, 1, 0, 0.96].map(formatDays)).toEqual(["5.3 days", "7 days", "1 day", "0 days", "1 day"]);
});

// STUB: AC-0108
it("AC-0108: the change format", () => {
  expect([0.0962, -0.1024, 0.1, 0.6667].map(formatChange)).toEqual(["9.62%", "10.24%", "10%", "66.67%"]);
});

// STUB: AC-0092
it("AC-0092: a digest with a number the facts do not hold is refused", () => {
  const facts = "At $2.68/lb the margin is 1.8%, below 20%.";
  const digest = (text: string) => digestVerdict({ paragraphs: [text] }, facts, []);
  expect(digest("Your price of 2.68 gives 1.8% against 20%.")).toEqual({
    kind: "digest",
    paragraphs: ["Your price of 2.68 gives 1.8% against 20%."],
  });
  for (const extra of ["3.30", "2", "2,000"]) {
    expect(digest(`Your price of 2.68 gives 1.8% against 20%, so try ${extra}.`), extra).toEqual({ kind: "unfaithful" });
  }
});
