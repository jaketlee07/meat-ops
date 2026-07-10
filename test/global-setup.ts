import { resolveStackEnv } from "./env.js";

// Fail fast with a clear message if the local stack is not running, and cache
// the resolved connection details on process.env for the worker to inherit.
export default function setup(): void {
  const env = resolveStackEnv();
  process.env.API_URL = env.apiUrl;
  process.env.SERVICE_ROLE_KEY = env.serviceRoleKey;
  process.env.DB_URL = env.dbUrl;
}
