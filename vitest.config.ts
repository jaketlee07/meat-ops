import { defineConfig } from "vitest/config";

// Single-threaded: the golden tests share one local database and reset it in
// beforeEach, so they must not run in parallel against the same tables.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
