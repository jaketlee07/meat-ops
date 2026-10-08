import { describe, expect, it } from "vitest";
import { isOperator } from "../src/lib/rpc.js";
import { signInNonOperator, signInOperator } from "./users.js";

// STUB: AC-0004
describe("AC-0004: the operator check behind the not-allowed page", () => {
  it("is true for an operator and false for a non-operator", async () => {
    const operator = await signInOperator();
    const nonOperator = await signInNonOperator();
    expect(await isOperator(operator)).toBe(true);
    expect(await isOperator(nonOperator)).toBe(false);
  });
});
