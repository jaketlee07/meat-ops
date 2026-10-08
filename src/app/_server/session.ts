import "server-only";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../../lib/database.types";
import { DB_CALL_TIMEOUT_MS, withTimeout } from "../../lib/failures";
import type { TypedClient } from "../../lib/supabase";

// The one cookie-options constant. Every createServerClient call passes it,
// the proxy's included. The package default is httpOnly: false, so each call
// must override it. No browser code reads the session, so script access to the
// auth cookies is never needed.
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  httpOnly: true,
  sameSite: "lax",
};

// Every server-side Supabase client, the proxy's included, passes this as its
// `global.fetch` (AC-0082). supabase-js hands that fetch to its auth client
// (sign-in, the user lookup, token refresh, and the signing-key fetch behind
// getClaims), to PostgREST (every table read and function call), and to the
// storage and functions clients. The global fetch is looked up on each call, as
// supabase-js does.
export const TIMED_FETCH = withTimeout((input, init) => fetch(input, init), DB_CALL_TIMEOUT_MS);

// The app holds only these two variables: the project URL and the anon key, so
// row-level security applies to every call. Neither has a NEXT_PUBLIC_ prefix,
// so neither reaches a client bundle.
export function supabaseEnv(): { url: string; anonKey: string } {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in the app's environment.");
  }
  return { url, anonKey };
}

// A new client for each page render and each server action, never shared. Reads
// the request's cookies and writes refreshed ones back where Next.js allows it.
//
// A server action that must keep its form passes `readOnly`. Any cookie write
// inside an action makes Next.js render the page again in the action's response,
// and a signed-out page redirects, which would throw away the form the action is
// answering. The proxy has already refreshed or cleared the session for this
// request, so such an action only reads it.
export async function createSessionClient({
  readOnly = false,
}: { readOnly?: boolean } = {}): Promise<TypedClient> {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    global: { fetch: TIMED_FETCH },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        if (readOnly) return;
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // A server component cannot write cookies. The proxy has already
          // refreshed the session for this request, so ignoring this is safe.
        }
      },
    },
  });
}
