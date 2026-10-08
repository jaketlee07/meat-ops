"use server";

import { redirect } from "next/navigation";
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
  const failed = { message: "Email or password is incorrect.", email: typedEmail };
  if (!typedEmail || typeof password !== "string" || password === "") return failed;

  const supabase = await createSessionClient();
  const { error } = await supabase.auth.signInWithPassword({ email: typedEmail, password });
  if (error) return failed;

  redirect("/receiving");
}

// Ends this device's session on the auth server and clears its cookies. Other
// sessions of the same user stay signed in.
export async function signOut(): Promise<void> {
  const supabase = await createSessionClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/sign-in");
}
