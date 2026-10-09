"use server";

import { revalidatePath } from "next/cache";
import { changeFailureMessage, logMessage } from "../../lib/failures";
import { setListPrice, setTargetMargin } from "../../lib/rpc";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { readChangeFields } from "./form-fields";
import { decideChange, type CallerOutcome, type ChangeKind, type ChangeState } from "./save-change";

async function caller(): Promise<CallerOutcome<TypedClient>> {
  const outcome = await checkCaller();
  return outcome.status === "operator" ? { status: "operator", client: outcome.supabase } : outcome;
}

// A server action is a public POST endpoint, so every field is caller input; the
// form rule runs inside decideChange. Nothing here may reject: a rejected action
// would reach the error boundary and lose the form.
async function change(kind: ChangeKind, formData: FormData): Promise<ChangeState> {
  const { productId, value } = readChangeFields(formData);
  let state: ChangeState;
  try {
    state = await decideChange(
      { kind, productId, value },
      {
        caller,
        write: (client, { kind: writeKind, productId: id, value: parsed }) =>
          writeKind === "list-price"
            ? setListPrice(client, id, parsed as number)
            : setTargetMargin(client, id, parsed),
      },
    );
  } catch (error) {
    console.error(`${kind} change failed unexpectedly: ${logMessage(error)}`);
    return { status: "refused", message: changeFailureMessage(error, "before-write") };
  }
  // Only after a write that returned, so a failed change never re-renders the page.
  if (state.status === "saved") revalidatePath("/pricing");
  return state;
}

// Like saveBatch, each takes the form data and returns the state; the component calls it directly.
export async function saveTargetMargin(formData: FormData): Promise<ChangeState> {
  return change("target", formData);
}

export async function removeTargetMargin(formData: FormData): Promise<ChangeState> {
  return change("remove-target", formData);
}

export async function saveListPrice(formData: FormData): Promise<ChangeState> {
  return change("list-price", formData);
}
