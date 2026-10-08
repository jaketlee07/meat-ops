import "server-only";
import { sessionOutcome } from "../../lib/failures";
import { isOperator } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { createSessionClient } from "./session";

// Who is calling a receiving action. Every outcome but "operator" ends the action
// before it reads or writes anything else.
export type Caller =
  // Signed in and on the allowlist. `supabase` is the read-only session client
  // the rest of the action must use, so no step of the action writes a cookie.
  | { status: "operator"; supabase: TypedClient }
  // The session ended (AC-0042, AC-0043).
  | { status: "ended" }
  // Signed in, but not on the allowlist (AC-0066).
  | { status: "not-operator" }
  // The auth lookup or the operator check got no usable answer, so nothing is
  // known about the caller. The error is for the action's before-write message.
  | { status: "failed"; error: unknown };

// The one caller check for saveReceipt and voidReceipt: the read-only session
// client, getClaims read through sessionOutcome, then isOperator. Keeping the
// three steps in one place means a new receiving action cannot skip one or
// forget the read-only flag. signIn and signOut write cookies on purpose, so
// they keep their own client.
export async function checkCaller(): Promise<Caller> {
  try {
    const supabase = await createSessionClient({ readOnly: true });
    const { data, error } = await supabase.auth.getClaims();
    const outcome = sessionOutcome({ claims: data?.claims, error });
    if (outcome === "ended") return { status: "ended" };
    if (outcome === "failed") return { status: "failed", error };
    return (await isOperator(supabase)) ? { status: "operator", supabase } : { status: "not-operator" };
  } catch (error) {
    // isOperator throws on anything but an answer (a timeout, a dropped
    // connection, a server error), and so can the client itself.
    return { status: "failed", error };
  }
}
