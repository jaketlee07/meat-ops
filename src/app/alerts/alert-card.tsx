"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent } from "react";
import { alertText } from "../../lib/alert-text";
import type { OpenAlert } from "../../lib/alerts";
import { CHANGE_UNKNOWN, DISMISS_UNKNOWN } from "../../lib/failures";
import { priceFieldText } from "../../lib/format";
import { applyAlertPrice, dismissAlert } from "./actions";
import type { AlertActionState } from "./decide";

// Where an alert sends the owner. Margin and price alerts act in place instead.
function link(type: OpenAlert["view"]["type"]): { href: string; name: string } | null {
  if (type === "cost_anomaly" || type === "low_stock") return { href: "/receiving", name: "Go to Receiving" };
  if (type === "yield_anomaly") return { href: "/production", name: "Go to Production" };
  return null;
}

// One alert: its title, sentence, and next step, then what the owner can do. The
// outcome goes to the list's message region, because a reprice or dismiss removes
// this card and the message must stay (AC-0111, AC-0115, AC-0116).
export function AlertCard({ alert, onResult }: { alert: OpenAlert; onResult: (state: AlertActionState) => void }) {
  const { view } = alert;
  const { title, sentence, nextStep } = alertText(view);
  const titleId = useId();
  const [pending, setPending] = useState<"reprice" | "dismiss" | null>(null);
  // Set at once on press, because state updates land a render later.
  const pendingRef = useRef(false);
  const destination = link(view.type);

  async function submit(
    event: FormEvent<HTMLFormElement>,
    kind: "reprice" | "dismiss",
    send: (formData: FormData) => Promise<AlertActionState>,
    unknown: string,
  ) {
    event.preventDefault();
    if (pendingRef.current) return;
    // Read before the first await: the event's form is gone after it.
    const formData = new FormData(event.currentTarget);
    pendingRef.current = true;
    setPending(kind);
    let state: AlertActionState;
    try {
      state = await send(formData);
    } catch {
      // A dropped connection or a server error: the write may have happened.
      state = { status: "refused", message: unknown };
    }
    pendingRef.current = false;
    setPending(null);
    onResult(state);
  }

  return (
    <li>
      <div role="group" aria-labelledby={titleId} className="rounded-md border border-field-border p-3">
        <h3 id={titleId} className="break-words text-lg font-semibold">
          {title}
        </h3>
        <p className="mt-1 break-words text-base">{sentence}</p>
        {view.type === "margin_below_target" || view.type === "price_stale" ? (
          <>
            <p className="mt-2 text-base font-medium">Next step</p>
            <form onSubmit={(event) => submit(event, "reprice", applyAlertPrice, CHANGE_UNKNOWN)}>
              <input type="hidden" name="alertId" value={alert.id} />
              <input type="hidden" name="value" value={priceFieldText(view.suggestedListPrice)} />
              <button
                type="submit"
                aria-disabled={pending !== null ? true : undefined}
                className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:opacity-60"
              >
                {nextStep}
              </button>
              <p role="status" className="text-base text-ink-secondary">
                {pending === "reprice" ? "Saving…" : null}
              </p>
            </form>
          </>
        ) : (
          <p className="mt-2 break-words text-base">
            <span className="font-medium">Next step:</span> {nextStep}
          </p>
        )}
        {destination && (
          <Link
            href={destination.href}
            className="mt-2 inline-flex min-h-control min-w-control items-center rounded-md px-3 text-base font-medium text-primary underline"
          >
            {destination.name}
          </Link>
        )}
        <form onSubmit={(event) => submit(event, "dismiss", dismissAlert, DISMISS_UNKNOWN)} className="mt-2">
          <input type="hidden" name="alertId" value={alert.id} />
          {/* The name starts with the visible word and adds the title, so two alerts' buttons differ (AC-0025). */}
          <button
            type="submit"
            aria-label={`Dismiss ${title}`}
            aria-disabled={pending !== null ? true : undefined}
            className="w-full rounded-md border border-field-border bg-surface px-4 text-base font-medium text-ink aria-disabled:opacity-60"
          >
            Dismiss
          </button>
          <p role="status" className="text-base text-ink-secondary">
            {pending === "dismiss" ? "Dismissing…" : null}
          </p>
        </form>
      </div>
    </li>
  );
}
