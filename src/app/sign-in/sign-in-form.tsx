"use client";

import { useActionState, useEffect, useRef } from "react";
import { signIn, type SignInState } from "./actions";

const INITIAL_STATE: SignInState = {};

const FIELD =
  "block h-11 w-full rounded-[10px] border border-field-border bg-surface px-3 text-base text-ink";

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL_STATE);
  const errorRef = useRef<HTMLDivElement>(null);

  // After a refused sign-in, move focus to the message so it is read out.
  useEffect(() => {
    if (state.message) errorRef.current?.focus();
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-semibold text-ink-secondary">
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
        <label htmlFor="password" className="text-sm font-semibold text-ink-secondary">
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
        className="text-[15px] font-semibold text-error"
      >
        {state.message}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-primary px-4 text-base font-bold text-on-primary disabled:opacity-60"
      >
        Sign in
      </button>
    </form>
  );
}
