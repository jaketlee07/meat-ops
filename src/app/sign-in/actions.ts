"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authFailureLogLine,
  SIGN_IN_BAD_CREDENTIALS,
  signInFailureMessage,
  type AuthFailure,
} from "../../lib/failures";
import { createSessionClient, SESSION_COOKIE_OPTIONS } from "../_server/session";

export interface SignInState {
  message?: string;
  email?: string;
}

// A server action is a public POST endpoint, so this takes only what it needs
// from caller input and trusts nothing else. A failed sign-in sets no cookie.
export async function signIn(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const typedEmail = typeof email === "string" ? email.trim() : "";
  if (!typedEmail || typeof password !== "string" || password === "") {
    return { message: SIGN_IN_BAD_CREDENTIALS, email: typedEmail };
  }

  const supabase = await createSessionClient();
  let failure: AuthFailure | null;
  try {
    ({ error: failure } = await supabase.auth.signInWithPassword({ email: typedEmail, password }));
  } catch {
    // A call that threw got no answer from the auth server.
    failure = {};
  }
  if (failure) {
    // Only bad credentials read as a wrong password (AC-0070). Any other failure
    // logs the auth error's code and status and nothing else (AC-0080), so
    // neither the email nor the password can reach the log.
    if (failure.code !== "invalid_credentials") console.error(authFailureLogLine(failure));
    return { message: signInFailureMessage(failure), email: typedEmail };
  }

  // redirect() throws to leave the action, so it stays outside the try.
  redirect("/receiving");
}

// Removes every Supabase auth cookie the request holds: the session cookie, its
// numbered chunks, and the code-verifier cookie. These are the names the
// session client reads and writes, and the removal uses the same cookie options.
async function dropAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  for (const { name } of cookieStore.getAll()) {
    if (name.startsWith("sb-") && name.includes("-auth-token")) {
      cookieStore.set(name, "", { ...SESSION_COOKIE_OPTIONS, path: "/", maxAge: 0 });
    }
  }
}

// Ends this device's session on the auth server and clears its cookies. Other
// sessions of the same user stay signed in. When the auth server answers with an
// error or not at all, the client keeps the cookies, so they are removed here: a
// kept session would come back once the auth server answers again (AC-0005).
export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  let failure: AuthFailure | null;
  try {
    ({ error: failure } = await supabase.auth.signOut({ scope: "local" }));
  } catch {
    // A call that threw got no answer from the auth server.
    failure = {};
  }
  if (failure) {
    console.error(authFailureLogLine(failure, "sign-out"));
    await dropAuthCookies();
  }
  redirect("/sign-in");
}
