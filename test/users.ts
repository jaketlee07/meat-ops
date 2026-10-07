import { createTypedClient, type TypedClient } from "../src/lib/supabase.js";
import { resolveStackEnv } from "./env.js";

// Test users. Global setup creates all three on every run (a `supabase db reset`
// wipes auth users) and puts both operators, the operator and the password
// operator, on the allowlist; the non-operator is not on it. The suites sign in
// as one of them and use the anon key, the same as the app.

export const OPERATOR_EMAIL = "operator@meat-ops.test";
export const NON_OPERATOR_EMAIL = "outsider@meat-ops.test";
// A second operator that only the password-floor test (AC-0011) signs in as,
// because that test changes its password.
export const PASSWORD_OPERATOR_EMAIL = "password-operator@meat-ops.test";
// Local-only credentials, 12+ characters so they survive the password floor.
export const TEST_PASSWORD = "local-test-password-1";

async function signIn(email: string): Promise<TypedClient> {
  const env = resolveStackEnv();
  const client = createTypedClient(env.apiUrl, env.anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(`sign-in as ${email} failed: ${error.message}`);
  return client;
}

export function signInOperator(): Promise<TypedClient> {
  return signIn(OPERATOR_EMAIL);
}

export function signInNonOperator(): Promise<TypedClient> {
  return signIn(NON_OPERATOR_EMAIL);
}

// Only test/access.test.ts (AC-0011) may call this.
export function signInPasswordOperator(): Promise<TypedClient> {
  return signIn(PASSWORD_OPERATOR_EMAIL);
}
