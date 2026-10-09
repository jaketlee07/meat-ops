"use client";

import { useRef, useState, type FormEvent } from "react";
import { CHANGE_UNKNOWN } from "../../lib/failures";
import type { ValueParse } from "../../lib/price-input";
import type { ChangeState } from "./save-change";

type ChangeAction = (formData: FormData) => Promise<ChangeState>;

const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink tabular-nums";
const BUTTON = "w-full rounded-md px-4 text-base font-medium aria-disabled:opacity-60";

// One value field with its Save button and, for a target, a Remove button. The
// parent owns the field's text and error, so a saved price from Apply can fill
// the field too. The browser runs the form rule first for an instant message;
// the action runs it again. A press while one is pending sends nothing.
export function ChangeForm({
  id,
  heading,
  label,
  value,
  onValueChange,
  error,
  onError,
  productId,
  parse,
  save,
  saveLabel,
  remove,
  onStart,
  onResult,
}: {
  id: string;
  heading: string;
  label: string;
  value: string;
  onValueChange: (text: string) => void;
  error: string | null;
  onError: (message: string | null) => void;
  productId: string;
  parse: (text: string) => ValueParse;
  save: ChangeAction;
  saveLabel: string;
  remove: { label: string; action: ChangeAction } | null;
  onStart: () => void;
  onResult: (state: ChangeState) => void;
}) {
  const [pending, setPending] = useState(false);
  // Set at once on press, because state updates land a render later.
  const pendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function run(action: ChangeAction, text: string) {
    if (pendingRef.current) return;
    const formData = new FormData();
    formData.set("productId", productId);
    formData.set("value", text);
    pendingRef.current = true;
    setPending(true);
    onError(null);
    onStart();
    let state: ChangeState;
    try {
      state = await action(formData);
    } catch {
      // A dropped connection or a server error: the change may have been saved.
      state = { status: "refused", message: CHANGE_UNKNOWN };
    }
    pendingRef.current = false;
    setPending(false);
    if (state.status === "invalid") {
      onError(state.fieldError);
      inputRef.current?.focus();
    } else {
      onResult(state);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const parsed = parse(value);
    if (!parsed.ok) {
      onError(parsed.error);
      onStart();
      inputRef.current?.focus();
      return;
    }
    void run(save, value);
  }

  const errorId = `${id}-error`;
  return (
    <section aria-labelledby={`${id}-heading`} className="mt-6">
      <h2 id={`${id}-heading`} className="mb-3 text-xl font-semibold">
        {heading}
      </h2>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div>
          <label htmlFor={id} className="block text-base font-medium">
            {label}
          </label>
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            className={CONTROL}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
          {error && (
            <p id={errorId} className="mt-1 break-words text-base font-medium text-error">
              {error}
            </p>
          )}
        </div>
        <button type="submit" aria-disabled={pending ? true : undefined} className={`${BUTTON} bg-primary text-on-primary`}>
          {saveLabel}
        </button>
        {remove && (
          <button
            type="button"
            aria-disabled={pending ? true : undefined}
            onClick={() => void run(remove.action, "")}
            className={`${BUTTON} border border-field-border bg-surface text-ink`}
          >
            {remove.label}
          </button>
        )}
        {/* The status is in the page before it has text, so "Saving…" is announced. */}
        <p role="status" className="text-base text-ink-secondary">
          {pending ? "Saving…" : null}
        </p>
      </form>
    </section>
  );
}
