import { describe, expect, it } from "vitest";
import { isAllowedHost } from "../src/allowed-host.js";

const APP = "meat-ops.example";
const LOCAL = ["127.0.0.1", "localhost", "127.0.0.1:3000", "LOCALHOST:3100"];

describe("The Host the app answers", () => {
  // STUB: AC-0002
  it("AC-0002: serves the APP_HOST name, ignoring letter case on both sides", () => {
    for (const host of [APP, "MEAT-OPS.Example"]) expect(isAllowedHost(host, APP), host).toBe(true);
    expect(isAllowedHost(APP, "Meat-Ops.Example"), "a mixed-case APP_HOST").toBe(true);
  });

  // STUB: AC-0004
  it("AC-0004: refuses look-alikes of the APP_HOST name and other names", () => {
    const refused = [`${APP}:443`, `x${APP}`, `sub.${APP}`, `${APP}.rebind.example`, "meat-opsxexample", "rebind.example:3100", "", null];
    for (const host of refused) expect(isAllowedHost(host, APP), String(host)).toBe(false);
  });

  // STUB: AC-0005
  it("AC-0005: with APP_HOST unset or empty, refuses the hosted name, other names, and an empty Host", () => {
    for (const appHost of [undefined, ""]) {
      for (const host of [APP, "rebind.example:3100", "", null]) {
        expect(isAllowedHost(host, appHost), `${String(host)} with ${String(appHost)}`).toBe(false);
      }
    }
  });

  // STUB: AC-0012
  it("AC-0012: serves 127.0.0.1 and localhost in every APP_HOST setting", () => {
    for (const appHost of [undefined, "", APP]) {
      for (const host of LOCAL) expect(isAllowedHost(host, appHost), `${host} with ${String(appHost)}`).toBe(true);
    }
  });
});
