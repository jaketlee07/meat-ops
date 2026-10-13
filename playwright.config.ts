import { defineConfig, devices } from "@playwright/test";
import { privilegedVariableNames } from "./src/privileged-env";
import { e2ePort, namesOwnStack, ownStackRefusal, readOwnStackFile, resolveStackEnv, stackEnvIsSet } from "./test/env";
import { localStackRefusal, realRunner } from "./test/network";

// Run this suite through `npm run test:e2e`. On Node 22.17 with Playwright 1.64,
// the default synchronous module hooks fail to load @supabase/supabase-js
// ("Unexpected module status 3"), which global setup and the specs import.
// PLAYWRIGHT_FORCE_ASYNC_LOADER=1 selects the older loader, and the script sets it.

const HOST = "127.0.0.1";
// Set E2E_PORT to run this suite beside another folder's run; 3100 when unset.
// A folder on its own stack (supabase/.env) must set it.
const ownStackFile = readOwnStackFile();
const PORT = e2ePort(process.env.E2E_PORT, namesOwnStack(ownStackFile));

// The fake model service listens on the next port up, and the spare app that the
// invoice specs start for AC-0021 and AC-0028 on the one after, so two folders'
// runs (3100 and 3200) never collide.
const FAKE_MODEL_PORT = PORT + 1;
if (PORT + 2 > 65535) throw new Error("E2E_PORT must leave room for two more ports (at most 65533). Refusing to run.");

// What the invoice specs expect the app to hold. Keep these two in step with
// ANTHROPIC_TEST_KEY in test/e2e/invoices-page.ts. The suite sets all three
// names itself, so neither .env nor the shell can supply them: Next.js fills a
// name from .env only when the process has no value for it.
const ANTHROPIC_TEST_KEY = "sk-ant-test-sentinel";
const ANTHROPIC_TEST_AUTH_TOKEN = "sk-ant-test-auth-token-sentinel";

// The localhost guard, the own-stack check, and the network check run here, at
// config load, before the web server builds the app. Playwright loads this file
// again in every worker, so the checks run there too.
const stackFromEnvironment = stackEnvIsSet();
const stack = resolveStackEnv();
const wrongStack = ownStackRefusal(ownStackFile, stack, stackFromEnvironment);
if (wrongStack) throw new Error(wrongStack);
const refusal = localStackRefusal({
  platform: process.platform,
  dbPort: Number(new URL(stack.dbUrl).port),
  run: realRunner,
});
if (refusal) throw new Error(refusal);

// The runner keeps the admin values that global setup and the pg checks need,
// and the web server inherits the runner's environment. So the server command
// unsets every privileged name first. The app's own guard (next.config.ts)
// fails the whole suite if one still gets through.
const unsetPrivileged = privilegedVariableNames()
  .map((name) => `-u '${name.replaceAll("'", `'\\''`)}'`)
  .join(" ");

export default defineConfig({
  testDir: "test/e2e",
  // Every spec resets the one shared database, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  globalSetup: "./test/global-setup.ts",
  use: { baseURL: `http://${HOST}:${PORT}` },
  projects: [
    // Signs in once per role through the form and saves each session under
    // test/e2e/.auth/, so the specs reuse it. The local auth server allows 30
    // sign-ins per 5 minutes per address, and the Vitest suites share that limit.
    { name: "setup", testMatch: "**/*.setup.ts" },
    {
      name: "chromium",
      testMatch: "**/*.spec.ts",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    // The fake model comes first, so the app never starts without it.
    {
      command: `env ${unsetPrivileged} node test/e2e/fake-model.mjs`,
      port: FAKE_MODEL_PORT,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { FAKE_MODEL_PORT: String(FAKE_MODEL_PORT) },
    },
    {
      command: `env ${unsetPrivileged} sh -c "npm run build && npm run start -- -p ${PORT}"`,
      port: PORT,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        SUPABASE_URL: stack.apiUrl,
        SUPABASE_ANON_KEY: stack.anonKey,
        ANTHROPIC_API_KEY: ANTHROPIC_TEST_KEY,
        ANTHROPIC_BASE_URL: `http://${HOST}:${FAKE_MODEL_PORT}`,
        ANTHROPIC_AUTH_TOKEN: ANTHROPIC_TEST_AUTH_TOKEN,
      },
    },
  ],
});
