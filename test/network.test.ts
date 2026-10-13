import { describe, expect, it } from "vitest";
import { localStackRefusal } from "./network.js";

const FW = "/usr/libexec/ApplicationFirewall/socketfilterfw";

function replay(outputs: Record<string, string>) {
  return (file: string, args: string[]): string | null => outputs[[file, ...args].join(" ")] ?? null;
}

describe("Local stack network check", () => {
  // STUB: AC-0001
  it("AC-0001: refuses when the macOS firewall is off", () => {
    const run = replay({ [`${FW} --getglobalstate`]: "Firewall is disabled. (State = 0)\n" });
    expect(localStackRefusal({ platform: "darwin", dbPort: 54322, run })).toMatch(/firewall is off/);
  });
});

const API = "/Applications/Docker.app/Contents/MacOS/com.docker.backend";
const OTHER = "/opt/other/analytics-proxy";
const PROJECT_CMD = `docker ps --filter publish=54322 --format {{.Label "com.supabase.cli.project"}}`;
const PORTS_CMD = "docker ps --filter label=com.supabase.cli.project=meat-ops --format {{.Ports}}";
const lsofPort = (port: number) => `lsof -nP -iTCP:${port} -sTCP:LISTEN -Fp`;
const lsofTxt = (pid: number) => `lsof -a -p ${pid} -d txt -Fn`;
const blockedLine = (path: string) => `Incoming connection to ${path} is blocked.\n`;
const permittedLine = (path: string) => `Incoming connection to ${path} is permitted.\n`;

const ENABLED = "Firewall is enabled. (State = 1)\n";
const ALLOW_OFF = "Automatically allow built-in signed software ENABLED.\nAutomatically allow downloaded signed software DISABLED.\n";
const ALLOW_ON = "Automatically allow built-in signed software ENABLED.\nAutomatically allow downloaded signed software ENABLED.\n";
const PORTS_LINE = "0.0.0.0:54322->5432/tcp, [::]:54322->5432/tcp\n";

// A stack with one published port (54322) served by a blocked executable.
function baseline(): Record<string, string> {
  return {
    [`${FW} --getglobalstate`]: ENABLED,
    [`${FW} --getallowsigned`]: ALLOW_OFF,
    [PROJECT_CMD]: "meat-ops\n",
    [PORTS_CMD]: `8080/tcp\n\n${PORTS_LINE}`,
    [lsofPort(54322)]: "p48398\nf171\n",
    [lsofTxt(48398)]: `p48398\nftxt\nn${API}\n`,
    [`${FW} --getappblocked ${API}`]: blockedLine(API),
  };
}

function check(outputs: Record<string, string>, platform = "darwin", dbPort = 54322): string | null {
  return localStackRefusal({ platform, dbPort, run: replay(outputs) });
}

const TAIL = 'Refusing to run. See "Keep the local stack on this Mac" in docs/architecture/overview.md.';

describe("Local stack network check, more states", () => {
  it("passes when the firewall is on, automatic allow of downloaded apps is off, and every executable is blocked", () => {
    expect(check(baseline())).toBeNull();
  });

  it("reads State = 2 as the firewall on", () => {
    expect(check({ ...baseline(), [`${FW} --getglobalstate`]: "Firewall is enabled. (State = 2)\n" })).toBeNull();
  });

  it("Refuses: the firewall-off message ends with the overview pointer", () => {
    const message = check({ ...baseline(), [`${FW} --getglobalstate`]: "Firewall is disabled. (State = 0)\n" });
    expect(message).toMatch(/^The macOS firewall is off, so other devices can reach the local Supabase stack\. /);
    expect(message?.endsWith(TAIL)).toBe(true);
  });

  it("AC-0002: refuses and names the program path and the port when it is permitted", () => {
    const message = check({ ...baseline(), [`${FW} --getappblocked ${API}`]: permittedLine(API) });
    expect(message).toContain(`reach ${API}, which serves the local Supabase stack's port 54322.`);
    expect(message?.endsWith(TAIL)).toBe(true);
  });

  it("AC-0003: refuses when a second port is served by a permitted executable", () => {
    const message = check({
      ...baseline(),
      [PORTS_CMD]: "0.0.0.0:54321->8000/tcp\n0.0.0.0:54327->4000/tcp\n",
      [lsofPort(54321)]: "p48398\nf171\n",
      [lsofPort(54327)]: "p5000\nf9\n",
      [lsofTxt(5000)]: `p5000\nftxt\nn${OTHER}\n`,
      [`${FW} --getappblocked ${OTHER}`]: permittedLine(OTHER),
    });
    expect(message).toContain(`reach ${OTHER}, which serves the local Supabase stack's port 54327.`);
  });

  it("AC-0003: refuses when a second program on the same port is permitted", () => {
    const message = check({
      ...baseline(),
      [lsofPort(54322)]: "p48398\nf171\np5000\nf9\n",
      [lsofTxt(5000)]: `p5000\nftxt\nn${OTHER}\n`,
      [`${FW} --getappblocked ${OTHER}`]: permittedLine(OTHER),
    });
    expect(message).toContain(`reach ${OTHER}, which serves the local Supabase stack's port 54322.`);
  });

  it("AC-0002: refuses a program missing from the firewall's list, which reads as permitted", () => {
    // Recorded 2026-10-12: `--getappblocked /usr/bin/true`, a path not in the list.
    const missing = "/usr/bin/true";
    expect(permittedLine(missing)).toBe("Incoming connection to /usr/bin/true is permitted.\n");
    const message = check({
      ...baseline(),
      [lsofTxt(48398)]: `p48398\nftxt\nn${missing}\n`,
      [`${FW} --getappblocked ${missing}`]: permittedLine(missing),
    });
    expect(message).toContain(`reach ${missing}, which serves the local Supabase stack's port 54322.`);
  });

  it("finds the stack from the database port it is given", () => {
    const otherProject = `docker ps --filter publish=55322 --format {{.Label "com.supabase.cli.project"}}`;
    expect(check({ ...baseline(), [otherProject]: "meat-ops\n" }, "darwin", 55322)).toBeNull();
    expect(check(baseline(), "darwin", 55322)).toMatch(/^Could not read the local Supabase project name, /);
  });

  it("AC-0003: passes when two ports are served by two blocked executables", () => {
    expect(
      check({
        ...baseline(),
        [PORTS_CMD]: "0.0.0.0:54321->8000/tcp\n0.0.0.0:54327->4000/tcp\n",
        [lsofPort(54321)]: "p48398\nf171\n",
        [lsofPort(54327)]: "p5000\nf9\n",
        [lsofTxt(5000)]: `p5000\nftxt\nn${OTHER}\n`,
        [`${FW} --getappblocked ${OTHER}`]: blockedLine(OTHER),
      }),
    ).toBeNull();
  });

  it("AC-0004: refuses on a platform other than macOS and says only macOS is supported", () => {
    const message = check(baseline(), "linux");
    expect(message).toMatch(/^The network check supports only macOS, /);
    expect(message?.endsWith(TAIL)).toBe(true);
  });

  it("AC-0004: does not run any command on a platform other than macOS", () => {
    const calls: string[] = [];
    localStackRefusal({
      platform: "win32",
      dbPort: 54322,
      run: (file, args) => (calls.push([file, ...args].join(" ")), null),
    });
    expect(calls).toEqual([]);
  });

  it.each(Object.keys(baseline()))("AC-0005: refuses when this command returns null: %s", (command) => {
    const outputs = baseline();
    delete outputs[command];
    const message = check(outputs);
    expect(message).not.toBeNull();
    expect(message?.endsWith(TAIL)).toBe(true);
  });

  it("AC-0005: refuses an unrecognized firewall state", () => {
    const message = check({ ...baseline(), [`${FW} --getglobalstate`]: "Firewall is enabled. (State = 9)\n" });
    expect(message).toMatch(/^Could not read the firewall state, /);
  });

  it("AC-0005: refuses an unrecognized automatic allow output", () => {
    const message = check({ ...baseline(), [`${FW} --getallowsigned`]: "Automatically allow downloaded signed software DISABLED.\n" });
    expect(message).toMatch(/^Could not read the firewall's automatic allow setting, /);
  });

  it("AC-0005: refuses a project name that is not exactly one clean line", () => {
    expect(check({ ...baseline(), [PROJECT_CMD]: "meat-ops\nother\n" })).toMatch(/^Could not read the local Supabase project name, /);
    expect(check({ ...baseline(), [PROJECT_CMD]: "\n" })).toMatch(/^Could not read the local Supabase project name, /);
    expect(check({ ...baseline(), [PROJECT_CMD]: "meat ops\n" })).toMatch(/^Could not read the local Supabase project name, /);
  });

  it("AC-0005: refuses a port range entry", () => {
    const message = check({ ...baseline(), [PORTS_CMD]: "0.0.0.0:54321-54322->8000-8001/tcp\n" });
    expect(message).toMatch(/^Could not read the local Supabase stack's published ports, /);
  });

  it("AC-0005: refuses an unrecognized host or a port out of range", () => {
    expect(check({ ...baseline(), [PORTS_CMD]: "10.0.0.1:54322->5432/tcp\n" })).toMatch(/^Could not read the local Supabase stack's published ports, /);
    expect(check({ ...baseline(), [PORTS_CMD]: "0.0.0.0:70000->5432/tcp\n" })).toMatch(/^Could not read the local Supabase stack's published ports, /);
    expect(check({ ...baseline(), [PORTS_CMD]: "0.0.0.0:54322->5432/udp\n" })).toMatch(/^Could not read the local Supabase stack's published ports, /);
  });

  it("AC-0005: refuses an unrecognized lsof line", () => {
    const message = check({ ...baseline(), [lsofPort(54322)]: "p48398\nfoo\n" });
    expect(message).toMatch(/^Could not read the program serving port 54322, /);
  });

  it("AC-0005: refuses a pid line without its p prefix, even when its digits name a real pid", () => {
    const message = check({ ...baseline(), [lsofPort(54322)]: "x48398\nf171\n" });
    expect(message).toMatch(/^Could not read the program serving port 54322, /);
  });

  it("AC-0005: refuses an unpublished entry that is not <port>/tcp", () => {
    const message = check({ ...baseline(), [PORTS_CMD]: `8080/udp\n${PORTS_LINE}` });
    expect(message).toMatch(/^Could not read the local Supabase stack's published ports, /);
  });

  it("AC-0005: refuses a program lookup for another pid or with an unrecognized line", () => {
    expect(check({ ...baseline(), [lsofTxt(48398)]: `p99999\nftxt\nn${API}\n` })).toMatch(/^Could not read the program serving port 54322, /);
    expect(check({ ...baseline(), [lsofTxt(48398)]: `p48398\nftxt\nn${API}\nxyz\n` })).toMatch(/^Could not read the program serving port 54322, /);
  });

  it("AC-0005: refuses an executable that is not an absolute path", () => {
    const message = check({ ...baseline(), [lsofTxt(48398)]: "p48398\nftxt\nncom.docker.backend\n" });
    expect(message).toMatch(/^Could not read the program serving port 54322, /);
  });

  it("AC-0005: refuses an --getappblocked line that names a different path", () => {
    const message = check({ ...baseline(), [`${FW} --getappblocked ${API}`]: blockedLine(OTHER) });
    expect(message).toMatch(/^Could not read the firewall rule for /);
  });

  it("AC-0008: refuses when the stack publishes no port with a host binding", () => {
    const message = check({ ...baseline(), [PORTS_CMD]: "8080/tcp\n\n" });
    expect(message).toMatch(/^Found no port the local Supabase stack publishes, /);
    expect(message?.endsWith(TAIL)).toBe(true);
  });

  it("AC-0008: refuses when a published port has no program that lsof can name", () => {
    const message = check({ ...baseline(), [lsofPort(54322)]: "" });
    expect(message).toMatch(/^Found no program serving port 54322, /);
    expect(message?.endsWith(TAIL)).toBe(true);
  });

  it("AC-0008: refuses when lsof fails for a published port", () => {
    const outputs = baseline();
    delete outputs[lsofPort(54322)];
    expect(check(outputs)).toMatch(/^Found no program serving port 54322, /);
  });

  it("AC-0013: refuses when the firewall allows downloaded signed software automatically", () => {
    const message = check({ ...baseline(), [`${FW} --getallowsigned`]: ALLOW_ON });
    expect(message).toMatch(/lets downloaded signed apps accept connections without asking/);
    expect(message?.endsWith(TAIL)).toBe(true);
  });

  it("checks run in order, so a firewall that is off is reported before a bad project name", () => {
    const message = check({ [`${FW} --getglobalstate`]: "Firewall is disabled. (State = 0)\n", [PROJECT_CMD]: "\n" });
    expect(message).toMatch(/firewall is off/);
  });

  it("Boundaries: keeps addresses out of every message", () => {
    const messages = [
      check({ ...baseline(), [`${FW} --getappblocked ${API}`]: permittedLine(API) }),
      check({ ...baseline(), [PORTS_CMD]: "10.0.0.1:54322->5432/tcp\n" }),
      check({ ...baseline(), [lsofPort(54322)]: "" }),
    ];
    for (const message of messages) expect(message).not.toMatch(/[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|\[::/);
  });
});
