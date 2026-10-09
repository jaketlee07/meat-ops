import { Client } from "pg";
import { createTypedClient } from "../src/lib/supabase.js";
import { resolveStackEnv } from "./env.js";
import { NON_OPERATOR_EMAIL, OPERATOR_EMAIL, PASSWORD_OPERATOR_EMAIL, TEST_PASSWORD } from "./users.js";

// Runs once before the suites. The localhost guard in resolveStackEnv runs
// first, before anything below writes. Then it creates an operator, a
// non-operator user, and a second operator (for the password test) through the
// admin API (service-role key, setup only), and puts both operators on the
// allowlist through pg. Every step can be repeated: an existing user is found
// and its password reset, and the allowlist insert skips rows already there.
// (`supabase db reset` wipes auth users, so the next run creates them again.)
export default async function setup(): Promise<void> {
  const env = resolveStackEnv();
  process.env.API_URL = env.apiUrl;
  process.env.ANON_KEY = env.anonKey;
  process.env.SERVICE_ROLE_KEY = env.serviceRoleKey;
  process.env.DB_URL = env.dbUrl;

  const admin = createTypedClient(env.apiUrl, env.serviceRoleKey).auth.admin;

  async function ensureUser(email: string): Promise<string> {
    const created = await admin.createUser({
      email,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (created.data.user) return created.data.user.id;

    const { data, error } = await admin.listUsers({ perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const existing = data.users.find((u) => u.email === email);
    if (!existing) {
      throw new Error(`createUser failed for ${email}: ${created.error?.message ?? "unknown error"}`);
    }
    const { error: updateError } = await admin.updateUserById(existing.id, {
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (updateError) throw new Error(`updateUserById failed: ${updateError.message}`);
    return existing.id;
  }

  const operatorId = await ensureUser(OPERATOR_EMAIL);
  await ensureUser(NON_OPERATOR_EMAIL);
  const passwordOperatorId = await ensureUser(PASSWORD_OPERATOR_EMAIL);

  const pg = new Client({ connectionString: env.dbUrl });
  await pg.connect();
  try {
    // Heals a run killed inside the AC-0029/AC-0073 browser test, which withdraws this grant.
    // Only when it is missing: a GRANT makes PostgREST reload its schema cache, which slows the next suite.
    const { rows } = await pg.query<{ granted: boolean }>(
      "select has_table_privilege('authenticated', 'public.production_batch_lots', 'select') as granted",
    );
    if (!rows[0]?.granted) await pg.query("grant select on table public.production_batch_lots to authenticated");
    await pg.query(
      "insert into private.operators(user_id) select unnest($1::uuid[]) on conflict (user_id) do nothing",
      [[operatorId, passwordOperatorId]],
    );
  } finally {
    await pg.end();
  }
}
