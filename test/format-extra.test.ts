import { describe, expect, it } from "vitest";
import { formatCostPerLb, formatPricePerLb, formatWeight } from "../src/lib/format.js";

// Cases the plan's stubs leave open: ties and zero for weight and cost, and
// thousands separators on a price.
describe("display formats, beyond the stubs", () => {
  it("rounds a weight tie away from zero and shows zero as 0 lbs", () => {
    expect(formatWeight(0.0005)).toBe("0.001 lbs");
    expect(formatWeight(0)).toBe("0 lbs");
  });

  it("rounds a cost tie away from zero", () => {
    expect(formatCostPerLb(1.00005)).toBe("$1.0001/lb");
    expect(formatCostPerLb(0)).toBe("$0.0000/lb");
  });

  it("puts thousands separators in a price", () => {
    expect(formatPricePerLb(1234.5)).toBe("$1,234.50/lb");
  });
});
