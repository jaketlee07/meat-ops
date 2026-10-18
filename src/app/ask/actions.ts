"use server";

import { CHECK_FAILED_ASK, CHECK_FAILED_LOOKUP } from "../../lib/ask";
import { answerFor, readProductLists } from "../../lib/ask-answers";
import { logMessage } from "../../lib/failures";
import type { TypedClient } from "../../lib/supabase";
import { checkCaller } from "../_server/caller";
import { askModel, modelReady } from "../_server/model";
import type { CallerOutcome } from "../invoices/read-invoice";
import { decideAsk, decideLookup, type AskState } from "./ask-question";
import { readLookupFields, readQuestionFields } from "./form-fields";

export type { AskState } from "./ask-question";

async function caller(): Promise<CallerOutcome<TypedClient>> {
  const outcome = await checkCaller();
  return outcome.status === "operator" ? { status: "operator", client: outcome.supabase } : outcome;
}

// A server action is a public POST endpoint, so every field is caller input; the
// rules run inside decideAsk after the caller is settled. Nothing here may
// reject (a rejected action would lose the typed question), revalidate a page,
// set a cookie, or write: an answer is a value, not a page address. The log
// line holds the error's text only, never the question.
export async function askQuestion(formData: FormData): Promise<AskState> {
  try {
    return await decideAsk(readQuestionFields(formData).question, {
      caller,
      modelReady,
      readProducts: readProductLists,
      askModel,
      readAnswer: answerFor,
    });
  } catch (error) {
    console.error(`askQuestion failed unexpectedly: ${logMessage(error)}`);
    return { status: "message", message: CHECK_FAILED_ASK };
  }
}

export async function lookUpAnswer(formData: FormData): Promise<AskState> {
  try {
    return await decideLookup(readLookupFields(formData), { caller, readAnswer: answerFor });
  } catch (error) {
    console.error(`lookUpAnswer failed unexpectedly: ${logMessage(error)}`);
    return { status: "message", message: CHECK_FAILED_LOOKUP };
  }
}
