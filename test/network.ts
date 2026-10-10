import { execFileSync } from "node:child_process";

// Confirms that only this Mac can reach the local Supabase stack, so the suites
// never run while Docker's published ports answer the network. Every command
// output is matched exactly; anything unrecognized is a refusal, never a pass
// (AC-0005). The runner is injected so unit tests can replay recorded outputs.

export type Runner = (file: string, args: string[]) => string | null;

const FIREWALL = "/usr/libexec/ApplicationFirewall/socketfilterfw";
const TAIL = 'Refusing to run. See "Keep the local stack on this Mac" in docs/architecture/overview.md.';
const CANNOT_CONFIRM = "so the network check cannot confirm that only this computer reaches the local Supabase stack.";
const HOSTS = ["0.0.0.0", "[::]", "127.0.0.1", "[::1]"];

// Splits output into lines, dropping the one terminal newline.
function linesOf(out: string): string[] {
  return (out.endsWith("\n") ? out.slice(0, -1) : out).split("\n");
}

function isPort(text: string): boolean {
  if (!/^[0-9]+$/.test(text)) return false;
  const n = Number(text);
  return n >= 1 && n <= 65535;
}

const unreadable = (what: string) => `Could not read ${what}, ${CANNOT_CONFIRM} ${TAIL}`;

// The first host port of each published entry; null when an entry is unrecognized.
function publishedPorts(out: string): number[] | null {
  const ports: number[] = [];
  for (const line of linesOf(out)) {
    if (line === "") continue;
    for (const entry of line.split(", ")) {
      if (!entry.includes("->")) {
        if (!/^[0-9]+\/tcp$/.test(entry) || !isPort(entry.slice(0, -4))) return null;
        continue;
      }
      const match = entry.match(/^(.+):([0-9]+)->([0-9]+)\/tcp$/);
      if (!match || !HOSTS.includes(match[1]!) || !isPort(match[2]!) || !isPort(match[3]!)) return null;
      const port = Number(match[2]);
      if (!ports.includes(port)) ports.push(port);
    }
  }
  return ports;
}

export function localStackRefusal({
  platform,
  dbPort,
  run,
}: {
  platform: string;
  dbPort: number;
  run: Runner;
}): string | null {
  if (platform !== "darwin") {
    return `The network check supports only macOS, ${CANNOT_CONFIRM} ${TAIL}`;
  }

  const globalState = run(FIREWALL, ["--getglobalstate"]);
  if (globalState === null) return unreadable("the firewall state");
  const stateLines = linesOf(globalState);
  if (stateLines.length !== 1 || !/^Firewall is (enabled\. \(State = [12]\)|disabled\. \(State = 0\))$/.test(stateLines[0]!)) {
    return unreadable("the firewall state");
  }
  if (stateLines[0] === "Firewall is disabled. (State = 0)") {
    return `The macOS firewall is off, so other devices can reach the local Supabase stack. ${TAIL}`;
  }

  const allowSigned = run(FIREWALL, ["--getallowsigned"]);
  if (allowSigned === null) return unreadable("the firewall's automatic allow setting");
  const allowLines = linesOf(allowSigned);
  const builtIn = /^Automatically allow built-in signed software (ENABLED|DISABLED)\.$/;
  const downloaded = /^Automatically allow downloaded signed software (ENABLED|DISABLED)\.$/;
  if (allowLines.length !== 2 || !builtIn.test(allowLines[0]!) || !downloaded.test(allowLines[1]!)) {
    return unreadable("the firewall's automatic allow setting");
  }
  if (allowLines[1]!.endsWith(" ENABLED.")) {
    return `The macOS firewall lets downloaded signed apps accept connections without asking, so a Docker update could reopen the local Supabase stack. ${TAIL}`;
  }

  const projectOut = run("docker", [
    "ps",
    "--filter",
    `publish=${dbPort}`,
    "--format",
    '{{.Label "com.supabase.cli.project"}}',
  ]);
  const projectLines = projectOut === null ? [] : linesOf(projectOut);
  if (projectLines.length !== 1 || !/^[A-Za-z0-9_.-]+$/.test(projectLines[0]!)) {
    return unreadable("the local Supabase project name");
  }

  const portsOut = run("docker", [
    "ps",
    "--filter",
    `label=com.supabase.cli.project=${projectLines[0]}`,
    "--format",
    "{{.Ports}}",
  ]);
  if (portsOut === null) return unreadable("the local Supabase stack's published ports");
  const ports = publishedPorts(portsOut);
  if (ports === null) return unreadable("the local Supabase stack's published ports");
  if (ports.length === 0) {
    return `Found no port the local Supabase stack publishes, ${CANNOT_CONFIRM} ${TAIL}`;
  }

  const pidsByPort = new Map<number, number[]>();
  for (const port of ports) {
    const out = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fp"]);
    const pids: number[] = [];
    if (out !== null) {
      for (const line of linesOf(out)) {
        if (line === "" || /^f[0-9]+$/.test(line)) continue;
        if (!/^p[1-9][0-9]*$/.test(line)) return unreadable(`the program serving port ${port}`);
        pids.push(Number(line.slice(1)));
      }
    }
    if (pids.length === 0) return `Found no program serving port ${port}, ${CANNOT_CONFIRM} ${TAIL}`;
    pidsByPort.set(port, pids);
  }

  const portByPath = new Map<string, number>();
  for (const [port, pids] of pidsByPort) {
    for (const pid of pids) {
      const out = run("lsof", ["-a", "-p", String(pid), "-d", "txt", "-Fn"]);
      const lines = out === null ? [] : linesOf(out);
      const txt = lines.indexOf("ftxt");
      const name = txt === -1 ? undefined : lines.slice(txt + 1).find((line) => line.startsWith("n"));
      if (name === undefined || !name.startsWith("n/")) {
        return unreadable(`the program serving port ${port}`);
      }
      const path = name.slice(1);
      if (!portByPath.has(path)) portByPath.set(path, port);
    }
  }

  for (const [path, port] of portByPath) {
    const out = run(FIREWALL, ["--getappblocked", path]);
    if (out === null) return unreadable(`the firewall rule for ${path}`);
    const lines = linesOf(out);
    if (lines.length === 1 && lines[0] === `Incoming connection to ${path} is blocked.`) continue;
    if (lines.length === 1 && lines[0] === `Incoming connection to ${path} is permitted.`) {
      return `The macOS firewall lets other devices reach ${path}, which serves the local Supabase stack's port ${port}. ${TAIL}`;
    }
    return unreadable(`the firewall rule for ${path}`);
  }

  return null;
}

// No shell: each value is its own argument. Any failure, lsof's exit 1 included,
// is null, which the check treats as unreadable.
export const realRunner: Runner = (file, args) => {
  try {
    return execFileSync(file, args, { encoding: "utf8", timeout: 10_000 });
  } catch {
    return null;
  }
};
