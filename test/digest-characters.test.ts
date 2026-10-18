import { expect, it } from "vitest";
import { digestVerdict } from "../src/lib/digest.js";

// Facts that hold the number tokens 13, 2026, 1, 502, U+00BD, U+FF11 U+FF12,
// 3.29, 1.8, and 20; the letter U+00F1; the symbols U+00B0 and U+00B7; a line
// feed; and, away from any digit, U+00A0, the combining marks U+0323 and
// U+20E0, and the default-ignorable U+200B, U+2060, U+034F, U+FE00, U+3164,
// and U+00AD.
const FACTS = [
  "Today is Oct 13, 2026. Open alerts: 1. Urgent: 1.",
  "Urgent. Margin below target: 502 Jalape\u00F1o Half\u00BD Box \uFF11\uFF12 Smoked\u00B0 Tray\u00B7 Drums. At your list price of $3.29/lb, the margin is 1.8%, below your 20% target.",
  "Notes: a\u00A0b a\u0323b a\u20E0b a\u200Bb a\u2060b a\u034Fb a\uFE00b a\u3164b a\u00ADb.",
].join("\n");

const digest = (...paragraphs: string[]) => digestVerdict({ paragraphs }, FACTS, ["502"]);

it("AC-0092: a digest of plain digest characters passes", () => {
  for (const text of [
    "502 is at 1.8%, below your 20% target.",
    "\u2018502\u2019s\u2019 margin of \u201C1.8%\u201D is below 20% \u2013 raise it \u2014 now\u2026",
    "502 Jalape\u00F1o Half\u00BD Box \uFF11\uFF12 Drums is at 1.8%.",
  ]) {
    expect(digest(text), JSON.stringify(text)).toEqual({ kind: "digest", paragraphs: [text] });
  }
  expect(digest("  502 is at 1.8%.\n")).toEqual({ kind: "digest", paragraphs: ["502 is at 1.8%."] });
});

it("AC-0092: a character that is not a plain digest character refuses the digest", () => {
  for (const text of [
    "502 is at 1.8%,\u00A0below 20%.",
    "502 margin is 20\u032313%.",
    "502 margin is 1.8\u20E0%.",
    "502 margin is 20\u00B713%.",
    "502 is at 1.8\u00B0.",
    "502 margin is 1\u200B1.8%.",
    "502 margin is 1\u20601.8%.",
    "502 margin is 1\u034F1.8%.",
    "502 margin is 1\uFE001.8%.",
    "502 margin is 1\u31641.8%.",
    "502 margin is 1\u00AD1.8%.",
    "502 is at 1.8%.\nBelow 20%.",
    "502 is at 1.8%.\u0007",
    "502 margin is 1\u0417%.",
    "502 is at 1.8% in Z\u00FCrich.",
    "502 uses \u00BC of it.",
  ]) {
    expect(digest(text), JSON.stringify(text)).toEqual({ kind: "unfaithful" });
  }
});

it("AC-0092: a run of number characters the facts do not hold refuses the digest", () => {
  for (const text of [
    "502 margin is 1\u00BD%.",
    "502 margin is \uFF12\uFF11%.",
    "502 margin is \uFF19\uFF10%.",
    "502 target is 20\u00B2%.",
  ]) {
    expect(digest(text), JSON.stringify(text)).toEqual({ kind: "unfaithful" });
  }
});

it("AC-0092: one paragraph that is not plain refuses the whole digest", () => {
  expect(digest("502 is at 1.8%.", "Its margin is 1\u034F1.8%.")).toEqual({ kind: "unfaithful" });
});
