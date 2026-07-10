import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.js";

// A Supabase client typed to the generated schema. The app only ever calls the
// costing RPCs and reads the views through this client; it never computes cost.
export type TypedClient = SupabaseClient<Database>;

export function createTypedClient(url: string, key: string): TypedClient {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
