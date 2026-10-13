"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { SALE_VOID_UNKNOWN } from "../../lib/failures";
import { parseVoidReason } from "../../lib/receipt-input";
import type { SaleVoidState } from "./save-sale";
import { useVoidedSales } from "./voided-sales";

interface Props {
  saleId: string;
  saleNumber: string;
  productCode: string;
  // The lbs as shown on screen.
  lbs: string;
  // The customer's name, or null for a sale with no customer.
  customer: string | null;
  // The void action with this sale's id bound to it.
  voidAction: (reason: string) => Promise<SaleVoidState>;
  // Where focus goes once the sale is void and its Void button is gone.
  listHeadingId: string;
}

// A message in state is an object, so the same text twice still moves focus again.
interface Message {
  text: string;
}

// The Void button of one sale, its confirmation, and the refusal the
// confirmation leaves behind. A sales copy of the receipt dialog: a native
// <dialog> opened with showModal(), so the browser traps focus, closes it on
// Escape, and returns focus to the Void button when it closes. Cancel comes
// first, so it takes focus when the dialog opens.
export function VoidDialog({ saleId, saleNumber, productCode, lbs, customer, voidAction, listHeadingId }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const sentenceId = useId();
  const errorId = useId();
  const { markVoided } = useVoidedSales();

  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<Message | null>(null);
  const [refusal, setRefusal] = useState<Message | null>(null);
  const [pending, startVoid] = useTransition();

  // A refusal closes the confirmation, so its message sits under the sale,
  // where it takes focus. A blank reason keeps the confirmation open and sends
  // focus back to the reason field.
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
      let result: SaleVoidState;
      try {
        result = await voidAction(reason);
      } catch {
        // A dropped connection or a server error: the void may have happened.
        // A rejected action reaches the error boundary, which would unmount the
        // list, so it is answered here like a refusal.
        result = { status: "refused", message: SALE_VOID_UNKNOWN };
      }
      if (result.status === "invalid") {
        setInvalid({ text: result.error });
        return;
      }
      dialogRef.current?.close();
      if (result.status === "refused") {
        setRefusal({ text: result.message });
      } else {
        markVoided(saleId);
        // The page is about to show this sale as void, without a Void button.
        document.getElementById(listHeadingId)?.focus();
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={open}
        aria-label={`Void sale ${saleNumber}`}
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
        aria-describedby={sentenceId}
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
              Void this sale?
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

          <p id={sentenceId} className="break-words text-base">{`Sale ${saleNumber}, ${productCode}, ${lbs}, ${customer === null ? "No customer" : `to ${customer}`}. Voiding puts its lbs back in stock and takes it out of every trace.`}</p>

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
            {pending ? "Voiding…" : "Void sale"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
