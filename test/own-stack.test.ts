import { describe, expect, it } from "vitest";
import { ownStackRefusal } from "./env.js";

const STACK_B_FILE = "SUPABASE_PROJECT_ID=meat-ops-b\nSUPABASE_API_PORT=55321\nSUPABASE_DB_PORT=55322\n";
const STACK_A = { apiUrl: "http://127.0.0.1:54321", dbUrl: "postgresql://postgres:postgres@127.0.0.1:54322/postgres" };
const STACK_B = { apiUrl: "http://127.0.0.1:55321", dbUrl: "postgresql://postgres:postgres@127.0.0.1:55322/postgres" };

describe("Own-stack check", () => {
  // STUB: AC-0015
  it("AC-0015: refuses when supabase status reports a stack other than the one supabase/.env names", () => {
    expect(ownStackRefusal(STACK_B_FILE, STACK_A)).toMatch(/supabase\/\.env/);
    expect(ownStackRefusal(STACK_B_FILE, STACK_B)).toBeNull();
  });
});

// Build-out of AC-0015, added after the stub was proven red.
import { readFileSync } from "node:fs";
import { namesOwnStack } from "./env.js";

describe("Own-stack check, every form", () => {
  const TEMPLATE = readFileSync(new URL("../supabase/stack-b.env", import.meta.url), "utf8");

  it("AC-0015: passes a folder that names no stack of its own", () => {
    expect(ownStackRefusal(null, STACK_A)).toBeNull();
    expect(ownStackRefusal("OPENAI_API_KEY=sk-local\n", STACK_A)).toBeNull();
    expect(namesOwnStack(null)).toBe(false);
    expect(namesOwnStack("OPENAI_API_KEY=sk-local\n")).toBe(false);
  });

  it("AC-0015: passes the stack B template, comments and blank lines included, on stack B", () => {
    expect(namesOwnStack(TEMPLATE)).toBe(true);
    expect(ownStackRefusal(TEMPLATE, STACK_B)).toBeNull();
  });

  it("AC-0015: refuses the stack B template on stack A, and names where the ports came from", () => {
    expect(ownStackRefusal(TEMPLATE, STACK_A)).toMatch(/supabase\/\.env.*API port 54321 and Postgres port 54322, from supabase status/);
    expect(ownStackRefusal(TEMPLATE, STACK_A, true)).toMatch(/from the API_URL and DB_URL in the environment/);
  });

  it("AC-0015: refuses when only one port differs", () => {
    const apiOnly = { apiUrl: STACK_B.apiUrl, dbUrl: STACK_A.dbUrl };
    const dbOnly = { apiUrl: STACK_A.apiUrl, dbUrl: STACK_B.dbUrl };
    expect(ownStackRefusal(STACK_B_FILE, apiOnly)).toMatch(/supabase\/\.env/);
    expect(ownStackRefusal(STACK_B_FILE, dbOnly)).toMatch(/supabase\/\.env/);
  });

  it("AC-0015: refuses a file that names its own stack without both ports as plain digits", () => {
    for (const file of [
      "SUPABASE_PROJECT_ID=meat-ops-b\nSUPABASE_DB_PORT=55322\n",
      "SUPABASE_PROJECT_ID=meat-ops-b\nSUPABASE_API_PORT=55321\n",
      'SUPABASE_PROJECT_ID=meat-ops-b\nSUPABASE_API_PORT="55321"\nSUPABASE_DB_PORT=55322\n',
      "SUPABASE_PROJECT_ID=meat-ops-b\nSUPABASE_API_PORT=55321\nSUPABASE_DB_PORT=55322 # Postgres\n",
    ]) {
      expect(ownStackRefusal(file, STACK_B), JSON.stringify(file)).toMatch(/supabase\/\.env.*plain numbers/);
    }
  });

  it("AC-0015: reads the file as the CLI does: Windows line ends and an export prefix count, and the last line for a name wins", () => {
    expect(namesOwnStack("export SUPABASE_PROJECT_ID=meat-ops-b\n")).toBe(true);
    const crlf = STACK_B_FILE.replaceAll("\n", "\r\n");
    expect(ownStackRefusal(crlf, STACK_B)).toBeNull();
    expect(ownStackRefusal(crlf, STACK_A)).toMatch(/supabase\/\.env/);
    const repointed = `${STACK_B_FILE}SUPABASE_API_PORT=54321\nSUPABASE_DB_PORT=54322\n`;
    expect(ownStackRefusal(repointed, STACK_A)).toBeNull();
    expect(ownStackRefusal(repointed, STACK_B)).toMatch(/supabase\/\.env/);
  });
});
