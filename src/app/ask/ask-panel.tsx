"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import {
  ANSWER_NOTE,
  checkQuestion,
  CHECK_FAILED_ASK,
  CHECK_FAILED_LOOKUP,
  IN_FLIGHT_TEXT,
  LOOKED_UP_PREFIX,
  type Choice,
} from "../../lib/ask";
import { askQuestion, lookUpAnswer, type AskState } from "./actions";
import { PARAM_FIELD, QUERY_FIELD, QUESTION_FIELD } from "./form-fields";

const IDLE: AskState = { status: "idle" };
const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";
const BUTTON = "w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:opacity-60";
const CHOICE_BUTTON =
  "w-full break-words rounded-md border border-field-border bg-surface px-4 py-2 text-left text-base font-medium text-ink aria-disabled:opacity-60";
const LINK =
  "inline-flex min-h-control min-w-control items-center rounded-md px-3 text-base font-medium text-primary underline";

type Press = { kind: "ask"; question: string } | { kind: "lookup"; query: string; param: string };

// A lookup posts the choice's query and, for a product or a number, its text.
function lookupOf(choice: Choice): Press {
  const param = "productCode" in choice ? choice.productCode : "number" in choice ? choice.number : "";
  return { kind: "lookup", query: choice.query, param };
}

// The browser applies the question rules before it sends an Ask, so a refused
// question sends nothing. A rejected action (a dropped connection) would reach
// the error boundary and lose the typed question, so it is answered here.
async function run(_previous: AskState, press: Press): Promise<AskState> {
  try {
    const formData = new FormData();
    if (press.kind === "ask") {
      const refusal = checkQuestion(press.question);
      if (refusal) return { status: "invalid", message: refusal };
      formData.set(QUESTION_FIELD, press.question);
      return await askQuestion(formData);
    }
    formData.set(QUERY_FIELD, press.query);
    formData.set(PARAM_FIELD, press.param);
    return await lookUpAnswer(formData);
  } catch {
    return { status: "message", message: press.kind === "ask" ? CHECK_FAILED_ASK : CHECK_FAILED_LOOKUP };
  }
}

export function AskPanel() {
  const [state, dispatch, pending] = useActionState(run, IDLE);
  const [question, setQuestion] = useState("");
  // Whether the press in flight was an Ask, which is the one that waits on the model.
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (state.status === "invalid") document.getElementById("ask-question")?.focus();
    else if (state.status === "answer") document.getElementById("answer-heading")?.focus();
    else if (state.status !== "idle") document.getElementById("ask-message")?.focus();
  }, [state]);

  function press(next: Press) {
    // Next.js runs a page's actions one at a time, so a second press would wait
    // and land after the first. Every control is disabled meanwhile.
    if (pending) return;
    setAsking(next.kind === "ask");
    startTransition(() => dispatch(next));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    press({ kind: "ask", question });
  }

  // An old refusal leaves the field once the next Ask is in flight.
  const invalid = !pending && state.status === "invalid" ? state.message : null;
  const message =
    state.status === "message" || state.status === "choose" || state.status === "lookup-failed" ? state.message : null;
  const disabled = pending ? true : undefined;

  return (
    <>
      <form onSubmit={submit} noValidate className="mb-4 space-y-4">
        <div>
          <label htmlFor="ask-question" className="block text-base font-medium">
            Your question
          </label>
          <input
            id="ask-question"
            type="text"
            autoComplete="off"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className={`${CONTROL} py-2`}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? "ask-question-error" : undefined}
          />
          {invalid && (
            <p id="ask-question-error" role="alert" className="mt-1 break-words text-base font-medium text-error">
              {invalid}
            </p>
          )}
        </div>
        <button type="submit" aria-disabled={disabled} className={BUTTON}>
          Ask
        </button>
        {/* In the page before an Ask press fills it, so the change is announced. Two lines are reserved. */}
        <div role="status" className="min-h-12 text-base">
          {pending && asking ? IN_FLIGHT_TEXT : null}
        </div>
      </form>

      <div className="mb-4 space-y-4">
        <div
          id="ask-message"
          role="alert"
          tabIndex={-1}
          className={`break-words text-base font-medium ${state.status === "choose" ? "text-ink" : "text-error"}`}
        >
          {message}
        </div>
        {state.status === "choose" && (
          <ul className="space-y-2">
            {state.candidates.map((product) => (
              <li key={product.code}>
                <button
                  type="button"
                  aria-disabled={disabled}
                  onClick={() => press({ kind: "lookup", query: state.query, param: product.code })}
                  className={CHOICE_BUTTON}
                >
                  {product.code} {product.description}
                </button>
              </li>
            ))}
          </ul>
        )}
        {state.status === "lookup-failed" && (
          <button
            type="button"
            aria-disabled={disabled}
            onClick={() => press(lookupOf(state.choice))}
            className={BUTTON}
          >
            Look it up again
          </button>
        )}
      </div>

      {state.status === "answer" && (
        <section aria-labelledby="answer-heading" className="space-y-3">
          <h2 id="answer-heading" tabIndex={-1} className="text-xl font-semibold">
            Answer
          </h2>
          <p className="break-words text-base text-ink-secondary">
            {LOOKED_UP_PREFIX}
            {state.answer.lookedUp}
          </p>
          <div className="space-y-2 break-words text-base tabular-nums">
            <p>{state.answer.text.lead}</p>
            {state.answer.text.items.length > 0 && (
              <ul className="list-disc space-y-1 pl-6">
                {state.answer.text.items.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
            {state.answer.text.tail && <p>{state.answer.text.tail}</p>}
          </div>
          <Link href={state.answer.link.href} className={LINK}>
            {state.answer.link.name}
          </Link>
          <p className="text-base text-ink-secondary">{ANSWER_NOTE}</p>
        </section>
      )}
    </>
  );
}
