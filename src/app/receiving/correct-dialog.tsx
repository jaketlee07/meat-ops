"use client";

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from "react";
import { parseCorrectionForm, type CorrectionErrors, type CorrectionFields } from "../../lib/correction-input";
import { CORRECTION_UNKNOWN } from "../../lib/failures";
import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import { BeforeAfter } from "../before-after";
import { stockView } from "../stock-view";
import type { CorrectionState } from "./actions";
import type { CorrectionDetails } from "./correct-receipt";
import { TotalsView } from "./result-panel";
import { priceChanges } from "./totals";

interface Props {
  lotNumber: string;
  vendor: string;
  // The weight as shown on screen.
  weight: string;
  // The receipt's current cost and weight as the database's text: they fill the
  // fields, and the unchanged rule compares the typed numbers with them.
  costText: string;
  weightText: string;
  // The correct action with this receipt's lot id bound to it.
  correctAction: (fields: CorrectionFields) => Promise<CorrectionState>;
}

// A message in state is an object, so the same text twice still moves focus again.
interface Message {
  text: string;
}
interface Invalid {
  errors: CorrectionErrors;
}
type Corrected = Extract<CorrectionState, { status: "corrected" }>;

const FIELD = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base font-normal text-ink";
const SUBHEAD = "text-lg font-semibold";

// The batches whose cost per finished lb the correction restated, each with the
// database's figure before and after. The pair is matched by batch id.
function BatchesRestated({ details }: { details: CorrectionDetails }) {
  const { before, after } = details;
  // "Changed" is the database's own answer: the cost it holds now against the cost it held.
  const costChanged = before.lot.unitCost !== after.lot.unitCost;
  const rows = after.batches.flatMap((batch) => {
    const was = before.batches.find((candidate) => candidate.batchId === batch.batchId);
    if (!was) return [];
    return [
      {
        label: `${batch.batchNumber}, ${batch.productCode}, ${formatDate(batch.productionDate)}${batch.reversed ? ", Reversed" : ""}`,
        before: formatCostPerLb(was.costPerFinishedLb),
        after: formatCostPerLb(batch.costPerFinishedLb),
      },
    ];
  });
  if (!costChanged || rows.length === 0) return <p>No batch cost changed.</p>;
  return (
    <>
      <h4 className={SUBHEAD}>Batches restated</h4>
      <BeforeAfter title="Cost per finished lb" rows={rows} />
    </>
  );
}

function Details({ details }: { details: CorrectionDetails }) {
  const { before, after } = details;
  return (
    <>
      <p className="break-words">{`Reason: ${after.reason}`}</p>
      <BeforeAfter
        title="Receipt"
        rows={[
          { label: "Cost per lb", before: formatCostPerLb(before.lot.unitCost), after: formatCostPerLb(after.lot.unitCost) },
          { label: "Weight", before: formatWeight(before.lot.weightLbs), after: formatWeight(after.lot.weightLbs) },
          { label: "Remaining", before: formatWeight(before.lot.remainingLbs), after: formatWeight(after.lot.remainingLbs) },
        ]}
      />
      <TotalsView
        totals={{
          stock: { before: stockView(before.stock), after: stockView(after.stock) },
          prices: priceChanges(before, after),
        }}
      />
      <BatchesRestated details={details} />
    </>
  );
}

// The Correct button of one non-void receipt, its confirmation, the message a
// closing refusal leaves behind, and the "Receipt corrected" panel. All of it
// stays in this receipt's list item, mounted for as long as the receipt is not
// void, so the list re-rendering after the write keeps the panel and the
// messages. The confirmation is a native <dialog> opened with showModal(): the
// browser traps focus in it, closes it on Escape, and returns focus to the
// Correct button when it closes. Cancel comes first in the dialog, so it is the
// first stop for Tab and takes focus when the dialog opens.
export function CorrectDialog({ lotNumber, vendor, weight, costText, weightText, correctAction }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const costRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const formMessageRef = useRef<HTMLDivElement>(null);
  const refusalRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const sentenceId = useId();
  const costErrorId = useId();
  const weightErrorId = useId();
  const reasonErrorId = useId();

  const [cost, setCost] = useState(costText);
  const [weightField, setWeightField] = useState(weightText);
  const [reason, setReason] = useState("");
  const [invalid, setInvalid] = useState<Invalid | null>(null);
  const [refusal, setRefusal] = useState<Message | null>(null);
  const [corrected, setCorrected] = useState<Corrected | null>(null);
  const [pending, startCorrect] = useTransition();

  const errors = invalid?.errors ?? {};

  // A closing refusal puts its message in the list, where it takes focus
  // (AC-0177). A correction puts its panel there and focus goes to its heading
  // (AC-0174). A refusal that keeps the confirmation open sends focus to the
  // first field with an error (AC-0175), or to the form message (AC-0176).
  useEffect(() => {
    if (refusal) refusalRef.current?.focus();
  }, [refusal]);
  useEffect(() => {
    if (corrected) headingRef.current?.focus();
  }, [corrected]);
  useEffect(() => {
    if (!invalid) return;
    const first = [
      [invalid.errors.cost, costRef],
      [invalid.errors.weight, weightRef],
      [invalid.errors.reason, reasonRef],
    ].find(([message]) => message);
    (first ? (first[1] as typeof costRef) : formMessageRef).current?.focus();
  }, [invalid]);

  // Every opening starts from what the receipt holds now, with no reason.
  function open() {
    setRefusal(null);
    setCorrected(null);
    setCost(costText);
    setWeightField(weightText);
    setReason("");
    setInvalid(null);
    dialogRef.current?.showModal();
  }

  // Closing by Cancel, Escape, or the write all end here.
  function closed() {
    setInvalid(null);
  }

  // The form rules run here first for an instant message, and again in the
  // action, which cannot trust this check.
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const fields = { cost, weight: weightField, reason };
    const checked = parseCorrectionForm(fields, { cost: costText, weight: weightText });
    if (!checked.ok) {
      setInvalid({ errors: checked.errors });
      return;
    }
    setInvalid(null);
    startCorrect(async () => {
      let result: CorrectionState;
      try {
        result = await correctAction(fields);
      } catch {
        // A dropped connection or a server error: the correction may have
        // happened (AC-0116). A rejected action reaches the error boundary,
        // which would unmount the list, so it is answered here like a refusal.
        result = { status: "refused", message: CORRECTION_UNKNOWN };
      }
      if (result.status === "invalid") {
        // The browser can close the dialog on a third Escape while the save is
        // pending. The errors belong in the dialog with the typed fields, so
        // it opens again; nothing here resets the fields.
        if (!dialogRef.current?.open) dialogRef.current?.showModal();
        setInvalid({ errors: result.errors });
        return;
      }
      dialogRef.current?.close();
      if (result.status === "refused") setRefusal({ text: result.message });
      else if (result.status === "corrected") setCorrected(result);
    });
  }

  function describe(message: string | undefined, id: string) {
    return message ? { "aria-invalid": true, "aria-describedby": id } : {};
  }

  return (
    <div className={`min-w-0 max-w-full ${corrected || refusal ? "basis-full" : ""}`}>
      <button
        type="button"
        onClick={open}
        aria-label={`Correct lot ${lotNumber}`}
        className="rounded-md border border-field-border bg-surface px-4 text-base font-medium text-ink"
      >
        Correct
      </button>

      {/* The live region is in the page before it has text, so a refusal is announced. */}
      <div
        ref={refusalRef}
        role="alert"
        tabIndex={-1}
        className={refusal ? "mt-2 break-words text-base font-medium text-error" : undefined}
      >
        {refusal?.text}
      </div>

      {/* The panel is in a status region that is in the page before the correction fills it. */}
      <div role="status" aria-label={`Correction of lot ${lotNumber}`} className={corrected ? "mt-2 space-y-4" : undefined}>
        {corrected && (
          <>
            <h3 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-success">
              Receipt corrected
            </h3>
            <p className="break-words">{`Lot ${corrected.lotNumber}`}</p>
            {corrected.details ? (
              <Details details={corrected.details} />
            ) : (
              <p>The new figures couldn&apos;t be loaded. Reload to see them.</p>
            )}
          </>
        )}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={sentenceId}
        onClose={closed}
        onCancel={(event) => {
          // Escape must not hide a correction that is already on its way.
          if (pending) event.preventDefault();
        }}
        className="m-auto w-full max-w-md rounded-md border border-field-border bg-surface p-4 text-ink backdrop:bg-ink/50"
      >
        <form onSubmit={confirm} noValidate className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 id={titleId} className="text-xl font-semibold">
              {`Correct receipt ${lotNumber}`}
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

          <p id={sentenceId} className="break-words text-base">{`Lot ${lotNumber}, from ${vendor}, now ${weight}. The receipt keeps what was first entered, and a change of cost restates every batch made from it.`}</p>

          <div>
            <label className="block text-base font-medium">
              Cost per lb ($)
              <input
                ref={costRef}
                name="cost"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={cost}
                onChange={(event) => setCost(event.target.value)}
                className={FIELD}
                {...describe(errors.cost, costErrorId)}
              />
            </label>
            {errors.cost && (
              <p id={costErrorId} className="mt-1 text-base font-medium text-error">
                {errors.cost}
              </p>
            )}
          </div>

          <div>
            <label className="block text-base font-medium">
              Weight (lbs)
              <input
                ref={weightRef}
                name="weight"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={weightField}
                onChange={(event) => setWeightField(event.target.value)}
                className={FIELD}
                {...describe(errors.weight, weightErrorId)}
              />
            </label>
            {errors.weight && (
              <p id={weightErrorId} className="mt-1 text-base font-medium text-error">
                {errors.weight}
              </p>
            )}
          </div>

          <div>
            <label className="block text-base font-medium">
              Reason for the correction
              <textarea
                ref={reasonRef}
                name="reason"
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={`${FIELD} py-2`}
                {...describe(errors.reason, reasonErrorId)}
              />
            </label>
            {errors.reason && (
              <p id={reasonErrorId} className="mt-1 text-base font-medium text-error">
                {errors.reason}
              </p>
            )}
          </div>

          {/* In the dialog before it has text, so the unchanged-figures message is announced and can take focus. */}
          <div
            ref={formMessageRef}
            role="alert"
            tabIndex={-1}
            className={errors.form ? "break-words text-base font-medium text-error" : undefined}
          >
            {errors.form}
          </div>

          <p role="status" className={pending ? "text-base" : undefined}>
            {pending ? "Saving…" : null}
          </p>

          <button
            type="submit"
            aria-disabled={pending ? true : undefined}
            className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:opacity-60"
          >
            Save correction
          </button>
        </form>
      </dialog>
    </div>
  );
}
