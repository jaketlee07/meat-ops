"use client";

import { useActionState, useEffect, useRef } from "react";
import { signIn, type SignInState } from "./actions";

const INITIAL_STATE: SignInState = {};

const FIELD =
  "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL_STATE);
  const errorRef = useRef<HTMLDivElement>(null);

  // After a refused sign-in, move focus to the message so it is read out.
  useEffect(() => {
    if (state.message) errorRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-base font-medium">
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
      <div>
        <label htmlFor="password" className="block text-base font-medium">
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
        className="text-base font-medium text-error"
      >
        {state.message}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary disabled:opacity-60"
      >
        Sign in
      </button>
    </form>
  );
}
