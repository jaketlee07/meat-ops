import type { NextConfig } from "next";
import { privilegedVariableNames } from "./src/privileged-env";

// Build, start, and dev all load this file after the .env files. A privileged
// variable (the service-role key, a database URL, a JWT secret) must never
// reach the app, so print the names, never a value, and stop.
const leaked = privilegedVariableNames();
if (leaked.length > 0) {
  console.error(`Refusing to run: privileged variable(s) in the app environment: ${leaked.join(", ")}`);
  process.exit(1);
}

const nextConfig: NextConfig = {
  // `next dev` otherwise writes a managed block into AGENTS.md when an agent runs it.
  agentRules: false,
  // No page may load inside another page's frame: one press changes a price.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
