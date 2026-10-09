"use client";

import { useEffect, useId, useRef } from "react";
import type { BatchInput } from "../../lib/batch-input";
import { formatDate, formatShrink, formatWeight } from "../../lib/format";
import { Facts } from "../receiving/facts";

export interface CheckedProduct {
  code: string;
  description: string;
  shrinkPct: number | null;
}

interface Props {
  input: BatchInput;
  product: CheckedProduct;
  saving: boolean;
  // Go back, Escape, or any other close of the dialog.
  onClose: () => void;
  onConfirm: () => void;
}

// The check step before a batch is written: a native <dialog> opened with
// showModal(), so the browser traps focus in it and closes it on Escape. Go back
// comes first in the dialog, so it is the first stop for Tab and takes focus
// when the dialog opens. The parent closes the step by unmounting it once the
// save has answered.
export function CheckStep({ input, product, saving, onClose, onConfirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const factsId = useId();
  const warningId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const finished =
    input.finishedLbs !== undefined
      ? formatWeight(input.finishedLbs)
      : product.shrinkPct === null
        ? "From shrink"
        : `From shrink (${formatShrink(product.shrinkPct)})`;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      aria-describedby={`${factsId} ${warningId}`}
      onClose={onClose}
      onCancel={(event) => {
        // Escape must not hide a save that is already on its way.
        if (saving) event.preventDefault();
      }}
      className="m-auto w-full max-w-md rounded-md border border-field-border bg-surface p-4 text-ink backdrop:bg-ink/50"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 id={headingId} className="text-xl font-semibold">
            Check this batch
          </h2>
          <button
            type="button"
            aria-disabled={saving ? true : undefined}
            onClick={() => {
              if (!saving) dialogRef.current?.close();
            }}
            className="rounded-md border border-field-border bg-surface px-4 text-base font-medium text-ink aria-disabled:opacity-60"
          >
            Go back
          </button>
        </div>

        <div id={factsId}>
          <Facts
            rows={[
              ["Product", `${product.code} ${product.description}`],
              ["Raw lbs", formatWeight(input.rawLbs)],
              ["Production date", formatDate(input.productionDate)],
              ["Finished lbs", finished],
            ]}
          />
        </div>
        <p id={warningId} className="text-base font-medium">
          A batch can&apos;t be undone.
        </p>

        <button
          type="button"
          aria-disabled={saving ? true : undefined}
          onClick={() => {
            if (!saving) onConfirm();
          }}
          className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:opacity-60"
        >
          Save batch
        </button>
        {/* The status is in the dialog before it has text, so "Saving…" is announced. */}
        <p role="status" className="text-base text-ink-secondary">
          {saving ? "Saving…" : null}
        </p>
      </div>
    </dialog>
  );
}
