import { defineConfig } from "@playwright/test";
import { privilegedVariableNames } from "./src/privileged-env";
import { resolveStackEnv } from "./test/env";

// Run this suite through `npm run test:e2e`. On Node 22.17 with Playwright 1.64,
// the default synchronous module hooks fail to load @supabase/supabase-js
// ("Unexpected module status 3"), which global setup and the specs import.
// PLAYWRIGHT_FORCE_ASYNC_LOADER=1 selects the older loader, and the script sets it.

const HOST = "127.0.0.1";
const PORT = 3100;

// The localhost guard runs here, at config load, before any server starts.
const stack = resolveStackEnv();

// The runner keeps the admin values that global setup and the pg checks need,
// and the web server inherits the runner's environment. So the server command
// unsets every privileged name first. The app's own guard (next.config.ts)
// fails the whole suite if one still gets through.
const unsetPrivileged = privilegedVariableNames()
  .map((name) => `-u '${name.replaceAll("'", `'\\''`)}'`)
  .join(" ");

export default defineConfig({
  testDir: "test/e2e",
  testMatch: "**/*.spec.ts",
  // Every spec resets the one shared database, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  globalSetup: "./test/global-setup.ts",
  use: { baseURL: `http://${HOST}:${PORT}` },
  webServer: {
    command: `env ${unsetPrivileged} sh -c "npm run build && npm run start -- -p ${PORT}"`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { SUPABASE_URL: stack.apiUrl, SUPABASE_ANON_KEY: stack.anonKey },
  },
});
