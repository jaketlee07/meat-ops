import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("AC-0024: the date format does not depend on the host's time zone", () => {
  const hostZone = process.env.TZ;

  afterEach(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
    vi.resetModules();
  });

  // The date formatter is built when the module loads. A formatter built in the
  // host's zone reads 2026-10-07 at midnight UTC as Oct 6 in a zone behind UTC,
  // so each zone gets a fresh module, whatever zone this host is in.
  it("keeps the day in a zone far behind UTC and in one far ahead", async () => {
    for (const zone of ["Pacific/Pago_Pago", "Pacific/Kiritimati"]) {
      process.env.TZ = zone;
      vi.resetModules();
      const { formatDate } = await import("../src/lib/format.js");
      expect(formatDate("2026-10-07"), zone).toBe("Oct 7, 2026");
      expect(formatDate("2026-01-01"), zone).toBe("Jan 1, 2026");
    }
  });
});
