import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Stack B's settings, checked against stack A's so the two stacks never share a
// project id or a port. `npm run db:reset:stack-b` trusts these lines as written
// (it accepts only a byte-identical copy), so they are compared byte for byte.
const TEMPLATE = readFileSync(new URL("../supabase/stack-b.env", import.meta.url), "utf8");
const CONFIG = readFileSync(new URL("../supabase/config.toml", import.meta.url), "utf8");

const SETTINGS = [
  "SUPABASE_PROJECT_ID=meat-ops-b",
  "SUPABASE_API_PORT=55321",
  "SUPABASE_DB_PORT=55322",
  "SUPABASE_DB_SHADOW_PORT=55320",
  "SUPABASE_STUDIO_ENABLED=false",
  "SUPABASE_INBUCKET_ENABLED=false",
  "SUPABASE_STORAGE_ENABLED=false",
  "SUPABASE_REALTIME_ENABLED=false",
  "SUPABASE_ANALYTICS_ENABLED=false",
  "SUPABASE_EDGE_RUNTIME_ENABLED=false",
];

const TEMPLATE_LINES = TEMPLATE.split("\n").filter((line) => line !== "" && !line.startsWith("#"));

function value(name: string): string {
  const line = TEMPLATE_LINES.find((setting) => setting.startsWith(`${name}=`));
  if (!line) throw new Error(`no ${name} setting`);
  return line.slice(name.length + 1);
}

// Only lines before the first section header are top level.
function configProjectId(): string | undefined {
  for (const line of CONFIG.split("\n")) {
    if (line.startsWith("[")) return undefined;
    const match = /^project_id\s*=\s*"([^"]*)"\s*$/.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

// Every port number config.toml assigns on an uncommented line: port, shadow_port,
// inspector_port, and any other key ending in "port".
function configPorts(): string[] {
  return [...CONFIG.matchAll(/^\s*[a-z_]*port\s*=\s*(\d+)\s*$/gm)].map((match) => match[1]!);
}

describe("Stack B settings", () => {
  it("are exactly the ten settings, byte for byte, beside comments and blank lines", () => {
    expect(TEMPLATE_LINES).toEqual(SETTINGS);
  });

  it("name a project other than stack A's", () => {
    const stackA = configProjectId();
    expect(stackA).toBe("meat-ops");
    expect(value("SUPABASE_PROJECT_ID")).not.toBe(stackA);
  });

  it("use no port that stack A's config assigns", () => {
    const stackA = configPorts();
    expect(stackA).toEqual(expect.arrayContaining(["54321", "54322", "54320"]));
    for (const name of ["SUPABASE_API_PORT", "SUPABASE_DB_PORT", "SUPABASE_DB_SHADOW_PORT"]) {
      expect(stackA, name).not.toContain(value(name));
    }
  });
});
