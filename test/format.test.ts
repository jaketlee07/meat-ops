import { afterEach, describe, expect, it } from "vitest";
import { formatCostPerLb, formatDate, formatPricePerLb, formatWeight } from "../src/lib/format.js";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

// STUB: AC-0024
describe("AC-0024: display formats", () => {
  it("formats weight with separators and up to 3 decimals", () => {
    expect(formatWeight(5000)).toBe("5,000 lbs");
    expect(formatWeight(32.5)).toBe("32.5 lbs");
    expect(formatWeight(1234.5678)).toBe("1,234.568 lbs");
  });

  it("formats cost per lb with 4 decimals", () => {
    expect(formatCostPerLb(1.725)).toBe("$1.7250/lb");
    expect(formatCostPerLb(1.68)).toBe("$1.6800/lb");
  });

  it("formats price per lb with 2 decimals, rounding half away from zero", () => {
    expect(formatPricePerLb(2.6818)).toBe("$2.68/lb");
    expect(formatPricePerLb(2.685)).toBe("$2.69/lb");
    expect(formatPricePerLb(1.005)).toBe("$1.01/lb");
  });

  it("formats a date-only value the same in every time zone", () => {
    for (const tz of ["UTC", "America/Chicago", "Pacific/Auckland"]) {
      process.env.TZ = tz;
      expect(formatDate("2026-10-07")).toBe("Oct 7, 2026");
    }
  });
});
