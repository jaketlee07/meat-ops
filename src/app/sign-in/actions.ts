"use server";

import { redirect } from "next/navigation";
import {
  authFailureLogLine,
  SIGN_IN_BAD_CREDENTIALS,
  signInFailureMessage,
  type AuthFailure,
} from "../../lib/failures";
import { createSessionClient } from "../_server/session";

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

// Ends this device's session on the auth server and clears its cookies. Other
// sessions of the same user stay signed in.
export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/sign-in");
}
