import { execSync } from "node:child_process";

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
