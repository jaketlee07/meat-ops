import { describe, expect, it } from "vitest";
import { e2ePort } from "./env.js";

describe("Browser suite port", () => {
  // STUB: AC-0001
  it("AC-0001: uses the port E2E_PORT names, and 3100 when it is unset in a folder on stack A", () => {
    expect(e2ePort("3200", true)).toBe(3200);
    expect(e2ePort(undefined, false)).toBe(3100);
  });
});

// Build-out of AC-0001, AC-0002, and AC-0014, added after the stub was proven red.
describe("Browser suite port, every form", () => {
  it("AC-0001: accepts both ends of the range and stack B's port, on either stack", () => {
    for (const ownStack of [false, true]) {
      expect(e2ePort("1", ownStack)).toBe(1);
      expect(e2ePort("65535", ownStack)).toBe(65535);
      expect(e2ePort("3200", ownStack)).toBe(3200);
    }
  });

  it("AC-0002: refuses every value that is not a port in canonical digits", () => {
    for (const value of ["", "0", "65536", "03200", "3200.0", "+3200", "-1", " 3200", "3200 ", "1e3", "abc", "3200; true"]) {
      expect(() => e2ePort(value, false), JSON.stringify(value)).toThrow(/E2E_PORT.*1 to 65535/);
    }
  });

  it("AC-0014: refuses an unset E2E_PORT in a folder that names its own stack", () => {
    expect(() => e2ePort(undefined, true)).toThrow(/E2E_PORT/);
  });
});
