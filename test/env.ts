import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Resolves the local Supabase connection details from `supabase status -o env`.
// Nothing is hardcoded: URLs and keys come straight from the running stack.
// Results are cached on process.env so we only shell out once per process.
//
// Safety: the suites truncate tables and create users, so they must only ever
// reach a local stack. Every URL is checked before any detail is returned or
// cached (AC-0042).

export interface StackEnv {
  apiUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  dbUrl: string;
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function assertLocalUrl(name: string, value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL, so its host is not local. Refusing to run.`);
  }
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`${name} host is not local (expected 127.0.0.1 or localhost). Refusing to run.`);
  }
  // `pg` lets a `host` query parameter replace the URL host, so refuse it.
  for (const key of url.searchParams.keys()) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "hostaddr") {
      throw new Error(`${name} has a "${key}" query parameter, so its host is not local. Refusing to run.`);
    }
  }
}

function readStatusEnv(): Record<string, string> {
  let raw: string;
  try {
    raw = execSync("supabase status -o env", { encoding: "utf8" });
  } catch {
    throw new Error(
      "Could not read `supabase status`. Start the local stack first: `supabase start`.",
    );
  }
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match && match[1]) out[match[1]] = match[2] ?? "";
  }
  return out;
}

export function resolveStackEnv(): StackEnv {
  // Check whatever the environment already holds before anything else.
  if (process.env.API_URL) assertLocalUrl("API_URL", process.env.API_URL);
  if (process.env.DB_URL) assertLocalUrl("DB_URL", process.env.DB_URL);

  if (
    process.env.API_URL &&
    process.env.ANON_KEY &&
    process.env.SERVICE_ROLE_KEY &&
    process.env.DB_URL
  ) {
    return {
      apiUrl: process.env.API_URL,
      anonKey: process.env.ANON_KEY,
      serviceRoleKey: process.env.SERVICE_ROLE_KEY,
      dbUrl: process.env.DB_URL,
    };
  }

  const status = readStatusEnv();
  const apiUrl = status.API_URL;
  const anonKey = status.ANON_KEY;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  const dbUrl = status.DB_URL;

  if (!apiUrl || !anonKey || !serviceRoleKey || !dbUrl) {
    throw new Error(
      "Local Supabase stack is not fully up (missing API_URL / ANON_KEY / SERVICE_ROLE_KEY / DB_URL). Run `supabase start`.",
    );
  }

  assertLocalUrl("API_URL", apiUrl);
  assertLocalUrl("DB_URL", dbUrl);

  process.env.API_URL = apiUrl;
  process.env.ANON_KEY = anonKey;
  process.env.SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.DB_URL = dbUrl;

  return { apiUrl, anonKey, serviceRoleKey, dbUrl };
}

// The browser suite's port. It goes into the web server's shell command, so only
// canonical digits pass. Playwright takes any app that answers its port during the
// build as its own, so a folder on its own stack must name its port.
export function e2ePort(value: string | undefined, ownStack: boolean): number {
  if (value === undefined) {
    if (ownStack) {
      throw new Error(
        "This folder's supabase/.env names its own Supabase stack, so set E2E_PORT to that stack's browser port (3200 for stack B). Refusing to run.",
      );
    }
    return 3100;
  }
  if (!/^[1-9][0-9]{0,4}$/.test(value) || Number(value) > 65535) {
    throw new Error(
      "E2E_PORT must be a whole number from 1 to 65535 with no leading zero, or unset for port 3100. Refusing to run.",
    );
  }
  return Number(value);
}

// A folder's own Supabase stack settings: <cwd>/supabase/.env, the file the
// Supabase CLI reads in the same folder. Null when the folder has none.
export function readOwnStackFile(): string | null {
  try {
    return readFileSync(join(process.cwd(), "supabase", ".env"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

// Lines end at LF, CRLF, or a bare CR, as in the CLI's env loader.
function linesOf(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

// Setting lines as the CLI's env loader reads them: leading spaces, an optional
// `export`, `=` or `:` between name and value, and the last line for a name wins.
// Any other line is skipped.
function settingsOf(text: string): Map<string, string> {
  const settings = new Map<string, string>();
  for (const line of linesOf(text)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.]*)\s*[=:]\s*(.*)$/.exec(line);
    if (match) settings.set(match[1]!, match[2]!);
  }
  return settings;
}

// A folder names its own stack when its supabase/.env sets SUPABASE_PROJECT_ID.
// A file with other names only, such as Studio's OPENAI_API_KEY, does not. The CLI
// also reads a setting after a quoted value on the same line, so any non-comment
// line where the name meets `=` or `:` counts, erring toward the refusals below.
export function namesOwnStack(text: string | null): boolean {
  if (text === null) return false;
  return linesOf(text).some((line) => !/^\s*#/.test(line) && /(?:^|[^A-Za-z0-9_])SUPABASE_PROJECT_ID\s*[=:]/.test(line));
}

// True when resolveStackEnv() will take the stack from the environment, not from
// `supabase status`. Read it before calling resolveStackEnv(), which caches there.
export function stackEnvIsSet(): boolean {
  return ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "DB_URL"].every((name) => Boolean(process.env[name]));
}

// Refuses a run whose stack is not the one the folder's supabase/.env names, so a
// folder meant for its own stack never writes to another folder's.
export function ownStackRefusal(
  text: string | null,
  env: { apiUrl: string; dbUrl: string },
  fromEnvironment = false,
): string | null {
  if (text === null || !namesOwnStack(text)) return null;
  // pg re-encodes a URL with a space or a stray `%` before reading it, so its port
  // can differ from the one read here.
  if (/ |%[^a-f0-9]|%[a-f0-9][^a-f0-9]/i.test(env.dbUrl)) {
    return "This folder's supabase/.env names its own Supabase stack, but this run's DB_URL has a space or a stray % that Postgres reads differently, so the run cannot confirm which stack it reaches. Refusing to run.";
  }
  const settings = settingsOf(text);
  const apiPort = settings.get("SUPABASE_API_PORT");
  const dbPort = settings.get("SUPABASE_DB_PORT");
  if (!apiPort || !dbPort || !/^[1-9][0-9]*$/.test(apiPort) || !/^[1-9][0-9]*$/.test(dbPort)) {
    return "This folder's supabase/.env names its own Supabase stack but does not set SUPABASE_API_PORT and SUPABASE_DB_PORT as plain numbers, so the run cannot confirm which stack it reaches. Refusing to run.";
  }
  const runApiPort = new URL(env.apiUrl).port;
  // pg connects to a `port` query parameter over the URL's own port; the last one wins.
  const dbUrl = new URL(env.dbUrl);
  const runDbPort = dbUrl.searchParams.getAll("port").at(-1) || dbUrl.port;
  if (runApiPort === apiPort && runDbPort === dbPort) return null;
  const source = fromEnvironment ? "the API_URL and DB_URL in the environment" : "supabase status";
  return `This folder's supabase/.env names a Supabase stack on API port ${apiPort} and Postgres port ${dbPort}, but this run would use API port ${runApiPort || "none"} and Postgres port ${runDbPort || "none"}, from ${source}, so it could reach another folder's stack. Refusing to run.`;
}
