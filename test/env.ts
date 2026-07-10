import { execSync } from "node:child_process";

// Resolves the local Supabase connection details from `supabase status -o env`.
// Nothing is hardcoded: URLs and keys come straight from the running stack.
// Results are cached on process.env so we only shell out once per process.

export interface StackEnv {
  apiUrl: string;
  serviceRoleKey: string;
  dbUrl: string;
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
  if (process.env.API_URL && process.env.SERVICE_ROLE_KEY && process.env.DB_URL) {
    return {
      apiUrl: process.env.API_URL,
      serviceRoleKey: process.env.SERVICE_ROLE_KEY,
      dbUrl: process.env.DB_URL,
    };
  }

  const status = readStatusEnv();
  const apiUrl = status.API_URL;
  const serviceRoleKey = status.SERVICE_ROLE_KEY;
  const dbUrl = status.DB_URL;

  if (!apiUrl || !serviceRoleKey || !dbUrl) {
    throw new Error(
      "Local Supabase stack is not fully up (missing API_URL / SERVICE_ROLE_KEY / DB_URL). Run `supabase start`.",
    );
  }

  process.env.API_URL = apiUrl;
  process.env.SERVICE_ROLE_KEY = serviceRoleKey;
  process.env.DB_URL = dbUrl;

  return { apiUrl, serviceRoleKey, dbUrl };
}
