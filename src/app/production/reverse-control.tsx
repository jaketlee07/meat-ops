"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { parseReversalReason } from "../../lib/correction-input";
import { REVERSAL_UNKNOWN } from "../../lib/failures";
import { formatDate, formatPricePerLb, formatWeight } from "../../lib/format";
import type { ReversalPreview } from "../../lib/production";
import type { SaleSummary } from "../../lib/sales";
import { BeforeAfter } from "../before-after";
import { Facts } from "../facts";
import { showAverage, showOnHand, stockView } from "../stock-view";
import type { ReversalState } from "./actions";
import type { ReversalDetails, ReversalStock } from "./reverse-batch";

// What the confirmation lists, read when the page was rendered.
export type Preview = Pick<ReversalPreview, "lots" | "sales">;

interface Props {
  batchNumber: string;
  // The production date and the finished lbs, as shown on screen.
  madeOn: string;
  finishedLbs: string;
  // The finished product's code, which labels its finished lbs on hand.
  productCode: string;
  // True once the database shows the batch as reversed. The control stays
  // mounted then, so the panel and messages it holds survive the list re-render.
  reversed: boolean;
  // Null for a batch that is reversed.
  preview: Preview | null;
  // The reverse action with this batch's ids bound to it.
  reverseAction: (reason: string) => Promise<ReversalState>;
}

// A message in state is an object, so the same text twice still moves focus again.
interface Message {
  text: string;
}
type Reversed = Extract<ReversalState, { status: "reversed" }>;

const NOT_AVAILABLE = "Not available";
const SUBHEAD = "text-lg font-semibold";

const finishedOnHand = (stock: ReversalStock) => (stock.finishedLbs === null ? NOT_AVAILABLE : formatWeight(stock.finishedLbs));

// A sale to record again carries its price; a sale to be voided does not need it.
function SaleFacts({ sale, withPrice }: { sale: SaleSummary; withPrice: boolean }) {
  return (
    <Facts
      rows={[
        ["Sale number", sale.saleNumber],
        ["Sale date", formatDate(sale.saleDate)],
        ["Customer", sale.customer ?? "No customer"],
        ["Lbs", formatWeight(sale.lbsSold)],
        ...(withPrice ? ([["Price per lb", formatPricePerLb(sale.pricePerLb)]] as const) : []),
      ]}
    />
  );
}

function Details({ details, productCode }: { details: ReversalDetails; productCode: string }) {
  const { before, after } = details;
  const rawBefore = stockView(before.stock.raw);
  const rawAfter = stockView(after.stock.raw);
  return (
    <>
      <BeforeAfter
        title="Raw stock"
        rows={[
          { label: "On hand", before: showOnHand(rawBefore), after: showOnHand(rawAfter) },
          { label: "Average cost", before: showAverage(rawBefore), after: showAverage(rawAfter) },
        ]}
      />
      <BeforeAfter
        title="Finished stock"
        rows={[
          {
            label: `${productCode} finished lbs on hand`,
            before: finishedOnHand(before.stock),
            after: finishedOnHand(after.stock),
          },
        ]}
      />
      {after.voidedSales.length === 0 ? (
        <p>No sale was voided.</p>
      ) : (
        <>
          <h4 className={SUBHEAD}>Sales voided</h4>
          <ul className="space-y-3">
            {after.voidedSales.map((sale) => (
              <li key={sale.id}>
                <SaleFacts sale={sale} withPrice />
              </li>
            ))}
          </ul>
          <p>Record these sales again on Sales.</p>
        </>
      )}
    </>
  );
}

// The Reverse button of one batch, its confirmation, the message a closing
// refusal leaves behind, and the "Batch reversed" panel. All of it stays in
// this batch's list item, mounted whether or not the batch is reversed, so the
// list re-rendering after the write keeps the panel and the messages. The
// confirmation is a native <dialog> opened with showModal(): the browser traps
// focus in it, closes it on Escape, and returns focus to the Reverse button
// when it closes. Cancel comes first in the dialog, so it is the first stop
// for Tab and takes focus when the dialog opens.
export function ReverseControl({ batchNumber, madeOn, finishedLbs, productCode, reversed, preview, reverseAction }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const refusalRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const sentenceId = useId();
  const errorId = useId();

  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<Message | null>(null);
  const [refusal, setRefusal] = useState<Message | null>(null);
  const [done, setDone] = useState<Reversed | null>(null);
  const [pending, startReverse] = useTransition();

  // A closing refusal puts its message in the list, where it takes focus
  // (AC-0177). A reversal puts its panel there and focus goes to its heading
  // (AC-0174). A blank reason keeps the confirmation open and sends focus to
  // the reason field (AC-0175).
  useEffect(() => {
    if (refusal) refusalRef.current?.focus();
  }, [refusal]);
  useEffect(() => {
    if (done) headingRef.current?.focus();
  }, [done]);
  useEffect(() => {
    if (invalid) reasonRef.current?.focus();
  }, [invalid]);

  function open() {
    setRefusal(null);
    setDone(null);
    setReason("");
    setInvalid(null);
    dialogRef.current?.showModal();
  }

  // The form rule runs here first for an instant message, and again in the
  // action, which cannot trust this check.
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const checked = parseReversalReason(reason);
    if (!checked.ok) {
      setInvalid({ text: checked.error });
      return;
    }
    setInvalid(null);
    startReverse(async () => {
      let result: ReversalState;
      try {
        result = await reverseAction(reason);
      } catch {
        // A dropped connection or a server error: the reversal may have
        // happened (AC-0149). A rejected action reaches the error boundary,
        // which would unmount the list, so it is answered here like a refusal.
        result = { status: "refused", message: REVERSAL_UNKNOWN };
      }
      if (result.status === "invalid") {
        setInvalid({ text: result.error });
        return;
      }
      dialogRef.current?.close();
      if (result.status === "refused") setRefusal({ text: result.message });
      else if (result.status === "reversed") setDone(result);
    });
  }

  return (
    <div className="min-w-0 max-w-full">
      {!reversed && (
        <button
          type="button"
          onClick={open}
          aria-label={`Reverse batch ${batchNumber}`}
          className="rounded-md border border-error bg-surface px-4 text-base font-medium text-error"
        >
          Reverse
        </button>
      )}

      {/* The live region is in the page before it has text, so a refusal is announced. */}
      <div
        ref={refusalRef}
        role="alert"
        tabIndex={-1}
        className={refusal ? "mt-2 break-words text-base font-medium text-error" : undefined}
      >
        {refusal?.text}
      </div>

      {/* The panel is in a status region that is in the page before the reversal fills it. */}
      <div role="status" aria-label={`Reversal of batch ${batchNumber}`} className={done ? "mt-2 space-y-4" : undefined}>
        {done && (
          <>
            <h3 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-success">
              Batch reversed
            </h3>
            <p className="break-words">{`Batch ${done.batchNumber}`}</p>
            {done.details ? (
              <Details details={done.details} productCode={productCode} />
            ) : (
              <p>The new figures couldn&apos;t be loaded. Reload to see them.</p>
            )}
          </>
        )}
      </div>

      {!reversed && preview && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          aria-describedby={sentenceId}
          onClose={() => setInvalid(null)}
          onCancel={(event) => {
            // Escape must not hide a reversal that is already on its way.
            if (pending) event.preventDefault();
          }}
          className="m-auto w-full max-w-md rounded-md border border-field-border bg-surface p-4 text-ink backdrop:bg-ink/50"
        >
          <form onSubmit={confirm} noValidate className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 id={titleId} className="text-xl font-semibold">
                {`Reverse batch ${batchNumber}`}
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

            <p id={sentenceId} className="break-words text-base">{`Batch ${batchNumber}, made ${madeOn}, ${finishedLbs} finished. Reversing it voids every sale made from it and can't be undone.`}</p>

            <h3 className={SUBHEAD}>Raw lbs that go back</h3>
            <Facts rows={preview.lots.map((lot) => [lot.lotNumber, formatWeight(lot.lbs)] as const)} />

            <h3 className={SUBHEAD}>Finished lbs that leave stock</h3>
            <Facts rows={[[`${productCode} finished lbs`, finishedLbs]]} />

            <h3 className={SUBHEAD}>Sales to be voided</h3>
            {preview.sales.length === 0 ? (
              <p>No sale drew from this batch.</p>
            ) : (
              <ul className="space-y-3">
                {preview.sales.map((sale) => (
                  <li key={sale.id}>
                    <SaleFacts sale={sale} withPrice={false} />
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label className="block text-base font-medium">
                Reason for the reversal
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

            <p role="status" className={pending ? "text-base" : undefined}>
              {pending ? "Reversing…" : null}
            </p>

            <button
              type="submit"
              aria-disabled={pending ? true : undefined}
              className="w-full rounded-md bg-error px-4 text-base font-medium text-on-primary aria-disabled:opacity-60"
            >
              Reverse batch
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}
