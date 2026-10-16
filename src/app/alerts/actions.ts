"use server";

import { revalidatePath } from "next/cache";
import { digestFacts } from "../../lib/alert-text";
import { appToday } from "../../lib/app-today";
import { listOpenAlerts } from "../../lib/alerts";
import {
  actionFailureLogLine,
  changeFailureMessage,
  DIGEST_TRY_AGAIN,
  dismissFailureMessage,
  logMessage,
} from "../../lib/failures";
import {
  applyAlertPrice as writeAlertPrice,
  dismissAlert as writeDismiss,
  finishDigest,
  startDigest,
} from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { modelReady, writeDigest as askModel } from "../_server/model";
import {
  decideDigest,
  decideDismiss,
  decideReprice,
  type AlertActionState,
  type CallerOutcome,
  type DigestState,
} from "./decide";

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

// The digest the page asks for. `automatic` is "true" for the send the page makes
// on its own and "false" for Try again; anything else counts as on its own, the
// stricter kind. The date is the app's today, never the form's.
export async function writeDigest(formData: FormData): Promise<DigestState> {
  const today = appToday(new Date());
  try {
    return await decideDigest(
      { today, automatic: text(formData, "automatic") !== "false" },
      {
        caller,
        modelReady,
        claim: startDigest,
        readFacts: async (client) => {
          const alerts = await listOpenAlerts(client);
          // An alert that closed after the claim leaves nothing to word.
          if (alerts.length === 0) throw new Error("no open alert");
          return {
            facts: digestFacts(
              alerts.map((alert) => alert.view),
              today,
            ),
            codes: alerts.map((alert) => alert.view.code),
          };
        },
        write: askModel,
        finish: finishDigest,
      },
    );
  } catch (error) {
    console.error(actionFailureLogLine("writeDigest", "before-write", error));
    return { status: "refused", message: DIGEST_TRY_AGAIN, retry: true };
  }
}
