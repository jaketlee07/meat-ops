"use server";

import { revalidatePath } from "next/cache";
import { changeFailureMessage, dismissFailureMessage, logMessage } from "../../lib/failures";
import { applyAlertPrice as writeAlertPrice, dismissAlert as writeDismiss } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { decideDismiss, decideReprice, type AlertActionState, type CallerOutcome } from "./decide";

async function caller(): Promise<CallerOutcome<TypedClient>> {
  const outcome = await checkCaller();
  return outcome.status === "operator" ? { status: "operator", client: outcome.supabase } : outcome;
}

// A server action is a public POST endpoint, so every field is caller input.
// A missing or non-text entry reads as blank. Nothing here may reject: a
// rejected action would reach the error boundary and lose the page's messages.
function text(formData: FormData, name: string): string {
  const entry = formData.get(name);
  return typeof entry === "string" ? entry : "";
}

// Like the pricing actions, each takes the form data and returns the state; the
// card calls it directly. Only after a write that returned does it revalidate,
// so a refused press never re-renders the page.
export async function applyAlertPrice(formData: FormData): Promise<AlertActionState> {
  let state: AlertActionState;
  try {
    state = await decideReprice(
      { alertId: text(formData, "alertId"), value: text(formData, "value") },
      { caller, apply: writeAlertPrice },
    );
  } catch (error) {
    console.error(`applyAlertPrice failed unexpectedly: ${logMessage(error)}`);
    return { status: "refused", message: changeFailureMessage(error, "before-write") };
  }
  if (state.status === "saved") revalidatePath("/alerts");
  return state;
}

export async function dismissAlert(formData: FormData): Promise<AlertActionState> {
  let state: AlertActionState;
  try {
    state = await decideDismiss({ alertId: text(formData, "alertId") }, { caller, dismiss: writeDismiss });
  } catch (error) {
    console.error(`dismissAlert failed unexpectedly: ${logMessage(error)}`);
    return { status: "refused", message: dismissFailureMessage(error, "before-write") };
  }
  if (state.status === "dismissed") revalidatePath("/alerts");
  return state;
}
