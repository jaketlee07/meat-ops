"use client";

import { useActionState, useEffect, useRef, type FormEvent } from "react";
import { signIn, type SignInState } from "./actions";
import { LABEL } from "../form-parts";

const INITIAL_STATE: SignInState = {};

const FIELD =
  "block h-11 w-full rounded-control border border-field-border bg-surface px-3 text-base text-ink";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL_STATE);
  const errorRef = useRef<HTMLDivElement>(null);
  // Set at once on press, because `pending` lands a render later; a second press
  // (a click, Enter on the button, or Enter in a field) sends nothing. A refusal clears it.
  const pressRef = useRef(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (pressRef.current || pending) {
      event.preventDefault();
      return;
    }
    pressRef.current = true;
  }

  // After a refused sign-in, move focus to the message so it is read out.
  useEffect(() => {
    pressRef.current = false;
    if (state.message) errorRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={LABEL}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          aria-describedby="sign-in-error"
          className={FIELD}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby="sign-in-error"
          className={FIELD}
        />
      </div>
      {/* The live region is in the page before it has text, so the message is announced. */}
      <div
        id="sign-in-error"
        ref={errorRef}
        role="alert"
        tabIndex={-1}
        className="text-note font-semibold text-error"
      >
        {state.message}
      </div>
      <button
        type="submit"
        aria-disabled={pending ? true : undefined}
        className="h-12 w-full rounded-xl bg-primary px-4 text-base font-bold text-on-primary aria-disabled:bg-primary/60"
      >
        Sign in
      </button>
    </form>
  );
}
