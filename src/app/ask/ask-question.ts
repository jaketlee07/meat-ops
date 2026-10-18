// The ask and lookup actions' decisions, apart from the "use server" wrapper so
// Vitest can import them: nothing here touches next/*, server-only, or
// src/app/_server. The browser imports the state types only. Nothing here
// writes, stores, or logs the question or an answer.
import {
  askFailureLogLine,
  askFailureMessage,
  askRequest,
  checkQuestion,
  CHECK_FAILED_ASK,
  CHECK_FAILED_LOOKUP,
  DECLINED_QUESTION,
  interpret,
  LOOKUP_ASK_AGAIN,
  LOOKUP_TRY_AGAIN,
  NAME_THE_PRODUCT,
  NEED_LOT_NUMBER,
  NEED_SALE_NUMBER,
  NOT_ALLOWED_ASK,
  NOT_ALLOWED_LOOKUP,
  parseLookup,
  SIGNED_OUT_ASK,
  SIGNED_OUT_LOOKUP,
  WHICH_PRODUCT,
  type AskModelResult,
  type CatalogProduct,
  type Choice,
  type ProductLists,
  type ProductQuery,
} from "../../lib/ask";
import type { Answer } from "../../lib/ask-answers";
import { actionFailureLogLine } from "../../lib/failures";
import type { CallerOutcome, ModelReadiness } from "../invoices/read-invoice";

export type AskState =
  | { status: "idle" }
  // An AC-0011 refusal; the page focuses the field.
  | { status: "invalid"; message: string }
  // Every other message; the page focuses it.
  | { status: "message"; message: string }
  // AC-0050: the product buttons.
  | { status: "choose"; query: ProductQuery; candidates: CatalogProduct[]; message: string }
  // AC-0080: the choice's read failed; the page offers "Look it up again".
  | { status: "lookup-failed"; choice: Choice; message: string }
  | { status: "answer"; answer: Answer };

export interface AskDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  modelReady: () => ModelReadiness;
  readProducts: (client: C) => Promise<ProductLists>;
  askModel: (request: ReturnType<typeof askRequest>) => Promise<AskModelResult>;
  readAnswer: (client: C, choice: Choice) => Promise<Answer | null>;
}

export type LookupDeps<C> = Pick<AskDeps<C>, "caller" | "readAnswer">;

const message = (text: string): AskState => ({ status: "message", message: text });
const lookupFailed = (choice: Choice): AskState => ({
  status: "lookup-failed",
  choice,
  message: LOOKUP_TRY_AGAIN,
});

// The spec's Ask outcome order: the session, the caller, the question rules, the
// key, the model address, the product lists, the model's answer, what the answer
// means, then the choice's read. Nothing before the model call sends a request.
export async function decideAsk<C>(question: string, deps: AskDeps<C>): Promise<AskState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return message(SIGNED_OUT_ASK);
  if (caller.status === "not-operator") return message(NOT_ALLOWED_ASK);
  if (caller.status === "failed") {
    console.error(actionFailureLogLine("askQuestion", "before-write", caller.error));
    return message(CHECK_FAILED_ASK);
  }
  const { client } = caller;

  const refusal = checkQuestion(question);
  if (refusal) return { status: "invalid", message: refusal };

  const ready = deps.modelReady();
  if (!ready.ok) {
    console.error(askFailureLogLine(ready.kind));
    return message(askFailureMessage(ready.kind));
  }

  let products: ProductLists;
  try {
    products = await deps.readProducts(client);
  } catch (error) {
    console.error(actionFailureLogLine("askQuestion", "before-write", error));
    return message(CHECK_FAILED_ASK);
  }

  // A throw here is logged by kind only: its text could carry the question.
  let result: AskModelResult;
  try {
    result = await deps.askModel(askRequest(question, products));
  } catch {
    result = { ok: false, kind: "service-error" };
  }
  if (!result.ok) {
    console.error(askFailureLogLine(result.kind, result.status));
    return message(askFailureMessage(result.kind));
  }

  const meaning = interpret(result.answer, products, question);
  if (meaning.kind === "decline") return message(DECLINED_QUESTION);
  if (meaning.kind === "choose") {
    return { status: "choose", query: meaning.query, candidates: meaning.candidates, message: WHICH_PRODUCT };
  }
  if (meaning.kind === "name-product") return message(NAME_THE_PRODUCT);
  if (meaning.kind === "need-number") {
    return message(meaning.query === "sale_lots" ? NEED_SALE_NUMBER : NEED_LOT_NUMBER);
  }

  let answer: Answer | null;
  try {
    answer = await deps.readAnswer(client, meaning.choice);
  } catch (error) {
    console.error(actionFailureLogLine("askQuestion", "before-write", error));
    return lookupFailed(meaning.choice);
  }
  return answer ? { status: "answer", answer } : message(LOOKUP_ASK_AGAIN);
}

// The spec's Lookup outcome order. It never reaches the model, the key check,
// or the product lists.
export async function decideLookup<C>(
  request: { query: string; param: string | null },
  deps: LookupDeps<C>,
): Promise<AskState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return message(SIGNED_OUT_LOOKUP);
  if (caller.status === "not-operator") return message(NOT_ALLOWED_LOOKUP);
  if (caller.status === "failed") {
    console.error(actionFailureLogLine("lookUpAnswer", "before-write", caller.error));
    return message(CHECK_FAILED_LOOKUP);
  }

  const choice = parseLookup(request.query, request.param);
  if (choice === null) return message(LOOKUP_ASK_AGAIN);

  let answer: Answer | null;
  try {
    answer = await deps.readAnswer(caller.client, choice);
  } catch (error) {
    console.error(actionFailureLogLine("lookUpAnswer", "before-write", error));
    return lookupFailed(choice);
  }
  return answer ? { status: "answer", answer } : message(LOOKUP_ASK_AGAIN);
}
