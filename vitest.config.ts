import { defineConfig } from "vitest/config";

// One file at a time: the golden tests share one local database and reset it
// in beforeEach, so they must not run in parallel against the same tables.
// Each file in its own process: test/db.ts ends its shared pg pool after a
// file's last test, so files must not share modules. Keep isolation on; Vitest's
// suggested `isolate: false` breaks every database suite after the first.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    fileParallelism: false,
    pool: "forks",
  },
});
