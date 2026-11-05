"use client";

import { useRef, useState, type FormEvent } from "react";
import { CHANGE_UNKNOWN } from "../../lib/failures";
import type { ValueParse } from "../../lib/price-input";
import type { ChangeState } from "./save-change";

type ChangeAction = (formData: FormData) => Promise<ChangeState>;

const CONTROL = "col-start-1 row-start-2 block w-full min-w-0 rounded-control border border-field-border bg-surface px-3 text-base text-ink tabular-nums";
const BUTTON = "rounded-control px-3.5 text-base font-bold";

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
    <section aria-labelledby={`${id}-heading`} className="mt-3 border-t border-card-border pt-3">
      <h2 id={`${id}-heading`} className="mb-2 text-base font-bold">
        {heading}
      </h2>
      <form onSubmit={submit} noValidate className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2">
        {/* The field's parts sit straight on the form's grid: label above, input and Save on one line, then the error. */}
        <div className="contents">
          <label htmlFor={id} className="col-span-2 row-start-1 mb-1.5 block text-sm font-semibold text-ink-secondary">
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
            <p id={errorId} role="alert" className="col-span-2 row-start-3 mt-1 break-words text-base font-medium text-error">
              {error}
            </p>
          )}
        </div>
        <button type="submit" aria-disabled={pending ? true : undefined} className={`${BUTTON} col-start-2 row-start-2 bg-primary text-on-primary aria-disabled:bg-primary/60`}>
          {saveLabel}
        </button>
        {remove && (
          <button
            type="button"
            aria-disabled={pending ? true : undefined}
            onClick={() => void run(remove.action, "")}
            className={`${BUTTON} col-span-2 row-start-4 mt-2 justify-self-start font-semibold border border-field-border bg-surface text-ink aria-disabled:text-ink/60 aria-disabled:border-field-border/60`}
          >
            {remove.label}
          </button>
        )}
        {/* The status is in the page before it has text, so "Saving…" is announced. */}
        <p role="status" className="col-span-2 row-start-5 text-base text-ink-secondary">
          {pending ? "Saving…" : null}
        </p>
      </form>
    </section>
  );
}
