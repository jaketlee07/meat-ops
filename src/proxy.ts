import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS, supabaseEnv } from "./app/_server/session";
import type { Database } from "./lib/database.types";
import { privilegedVariableNames } from "./privileged-env";

// Refreshes the session and sends a signed-out GET to /sign-in. It is an
// optimistic check only and authorizes nothing: every page and every server
// action creates its own client and settles the caller again.
export async function proxy(request: NextRequest): Promise<NextResponse> {
  // A privileged variable can reach a running `next dev` when an env file
  // changes, after the boot check in next.config.ts has passed. Names only.
  const leaked = privilegedVariableNames();
  if (leaked.length > 0) {
    console.error(`Server misconfigured: privileged variable(s) in the app environment: ${leaked.join(", ")}`);
    return new NextResponse("Server misconfigured.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const isRead = request.method === "GET" || request.method === "HEAD";

  // The refreshed cookies go to the request, so this render's pages see them,
  // and to the response, so the browser keeps them.
  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};
  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        // Next.js renders the page again inside a server action's response when
        // the proxy sets a cookie. A cleared session would then send that render
        // to /sign-in and throw away the form the action is about to answer, so
        // the action must see the stale session and answer "signed out" itself.
        // A refresh still goes through, so the browser keeps the rotated tokens.
        if (!isRead && cookiesToSet.every(({ value }) => value === "")) return;
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        cacheHeaders = { ...cacheHeaders, ...headers };
        for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedOut = !data?.claims;

  if (signedOut && isRead && request.nextUrl.pathname !== "/sign-in") {
    const redirect = NextResponse.redirect(new URL("/sign-in", request.url));
    // Keep any cookie the client just cleared, and the headers that say not to cache it.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const [key, value] of Object.entries(cacheHeaders)) redirect.headers.set(key, value);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
