"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { parseVoidReason } from "../../lib/receipt-input";
import type { VoidState } from "./actions";

interface Props {
  lotNumber: string;
  // The weight as shown on screen.
  weight: string;
  vendor: string;
  // The void action with this receipt's lot id bound to it.
  voidAction: (reason: string) => Promise<VoidState>;
  // Where focus goes once the receipt is void and its Void button is gone.
  listHeadingId: string;
}

// A message in state is an object, so the same text twice still moves focus again.
interface Message {
  text: string;
}

// The Void button of one untouched receipt, its confirmation, and the refusal
// the confirmation leaves behind. The confirmation is a native <dialog> opened
// with showModal(): the browser traps focus in it, closes it on Escape, and
// returns focus to the Void button when it closes. Cancel comes first in the
// dialog, so it is the first stop for Tab and takes focus when the dialog opens.
export function VoidDialog({ lotNumber, weight, vendor, voidAction, listHeadingId }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const errorId = useId();

  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<Message | null>(null);
  const [refusal, setRefusal] = useState<Message | null>(null);
  const [pending, startVoid] = useTransition();

  // A refusal closes the confirmation, so its message sits in the list, where
  // it takes focus (AC-0057). A blank reason keeps the confirmation open and
  // sends focus back to the reason field (AC-0051).
  useEffect(() => {
    if (refusal) messageRef.current?.focus();
  }, [refusal]);
  useEffect(() => {
    if (invalid) reasonRef.current?.focus();
  }, [invalid]);

  function open() {
    setRefusal(null);
    dialogRef.current?.showModal();
  }

  // Closing by Cancel, Escape, or a refusal all end here: the next opening starts empty.
  function closed() {
    setReason("");
    setInvalid(null);
  }

  // The reason rule runs here first for an instant message, and again in the
  // action, which cannot trust this check.
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const checked = parseVoidReason(reason);
    if (!checked.ok) {
      setInvalid({ text: checked.error });
      return;
    }
    setInvalid(null);
    startVoid(async () => {
      const result = await voidAction(reason);
      if (result.status === "invalid") {
        setInvalid({ text: result.error });
        return;
      }
      dialogRef.current?.close();
      if (result.status === "refused") {
        setRefusal({ text: result.message });
      } else {
        // The page is about to show this receipt as void, without a Void button.
        document.getElementById(listHeadingId)?.focus();
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        aria-label={`Void lot ${lotNumber}`}
        className="rounded-md border border-error bg-surface px-4 text-base font-medium text-error"
      >
        Void
      </button>

      {/* The live region is in the page before it has text, so a refusal is announced. */}
      <div
        ref={messageRef}
        role="alert"
        tabIndex={-1}
        className={refusal ? "mt-2 break-words text-base font-medium text-error" : undefined}
      >
        {refusal?.text}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        onClose={closed}
        onCancel={(event) => {
          // Escape must not hide a void that is already on its way.
          if (pending) event.preventDefault();
        }}
        className="m-auto w-full max-w-md rounded-md border border-field-border bg-surface p-4 text-ink backdrop:bg-ink/50"
      >
        <form onSubmit={confirm} noValidate className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 id={headingId} className="text-xl font-semibold">
              Void this receipt?
            </h2>
            <button
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              className="rounded-md border border-field-border bg-surface px-4 text-base font-medium text-ink disabled:opacity-60"
            >
              Cancel
            </button>
          </div>

          <p className="break-words text-base">{`Lot ${lotNumber}, ${weight}, from ${vendor}. Voiding takes it out of stock and can't be undone.`}</p>

          <div>
            <label className="block text-base font-medium">
              Reason for the void
              <textarea
                ref={reasonRef}
                name="reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={invalid ? true : undefined}
                aria-describedby={invalid ? errorId : undefined}
                className="mt-1 block w-full rounded-md border border-field-border bg-surface px-3 py-2 text-base font-normal text-ink"
              />
            </label>
            {invalid && (
              <p id={errorId} className="mt-1 text-base font-medium text-error">
                {invalid.text}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-error px-4 text-base font-medium text-on-primary disabled:opacity-60"
          >
            Void receipt
          </button>
        </form>
      </dialog>
    </div>
  );
}
