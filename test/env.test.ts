import { afterEach, describe, expect, it } from "vitest";
import { resolveStackEnv } from "./env.js";

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe("Test-harness safety", () => {
  // STUB: AC-0042
  it("AC-0042: refuses a database URL whose host is not local", () => {
    process.env.API_URL = "http://127.0.0.1:54321";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL = "postgresql://postgres:postgres@db.example.com:5432/postgres";
    expect(() => resolveStackEnv()).toThrow(/not local/);
  });

  // STUB: AC-0042
  it("AC-0042: refuses an API URL whose host is not local", () => {
    process.env.API_URL = "https://example.supabase.co";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    expect(() => resolveStackEnv()).toThrow(/not local/);
  });

  // Build-out of AC-0042, added after the stub was proven red.
  it("AC-0042: refuses a database URL whose query string overrides the host", () => {
    process.env.API_URL = "http://127.0.0.1:54321";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL =
      "postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=db.example.com";
    expect(() => resolveStackEnv()).toThrow(/not local/);
  });

  it("AC-0042: refuses a database URL with an empty host", () => {
    process.env.API_URL = "http://127.0.0.1:54321";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL = "postgresql:///postgres";
    expect(() => resolveStackEnv()).toThrow(/not local/);
  });

  it("AC-0042: refuses a URL whose user info names a local host but whose host is remote", () => {
    process.env.API_URL = "http://127.0.0.1@example.supabase.co:54321";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    expect(() => resolveStackEnv()).toThrow(/not local/);
  });

  it("AC-0042: accepts local URLs without contacting anything", () => {
    process.env.API_URL = "http://localhost:54321";
    process.env.ANON_KEY = "local-anon-key";
    process.env.SERVICE_ROLE_KEY = "local-service-role-key";
    process.env.DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
    expect(resolveStackEnv().dbUrl).toBe(process.env.DB_URL);
  });
});
