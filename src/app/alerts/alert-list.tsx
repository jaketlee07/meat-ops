"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenAlert } from "../../lib/alerts";
import { AlertCard } from "./alert-card";
import type { AlertActionState } from "./decide";

interface Message {
  kind: "saved" | "refused";
  text: string;
}

const SECTIONS = [
  { heading: "Urgent", id: "urgent-heading", pick: (alert: OpenAlert) => alert.urgent },
  { heading: "Other alerts", id: "other-heading", pick: (alert: OpenAlert) => !alert.urgent },
] as const;

// The headed lists of open alerts, in the order the page was given. The list
// owns the message region: a reprice or dismiss removes its card, so the message
// cannot live in the card (AC-0137).
export function AlertList({ alerts }: { alerts: OpenAlert[] }) {
  const [message, setMessage] = useState<Message | null>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const refusedRef = useRef<HTMLDivElement>(null);

  // Keyboard focus follows the message (AC-0116, AC-0137, AC-0202).
  useEffect(() => {
    if (!message) return;
    (message.kind === "saved" ? savedRef : refusedRef).current?.focus();
  }, [message]);

  function show(state: AlertActionState) {
    if (state.status === "saved" || state.status === "dismissed") setMessage({ kind: "saved", text: state.message });
    else if (state.status === "refused") setMessage({ kind: "refused", text: state.message });
    else setMessage({ kind: "refused", text: state.fieldError });
  }

  return (
    <div className="space-y-6">
      {/* Both regions are in the page before they have text, so each message is announced. */}
      <div>
        <div ref={savedRef} role="status" tabIndex={-1} className="break-words text-base font-medium text-success">
          {message?.kind === "saved" ? message.text : null}
        </div>
        <div ref={refusedRef} role="alert" tabIndex={-1} className="break-words text-base font-medium text-error">
          {message?.kind === "refused" ? message.text : null}
        </div>
      </div>
      {SECTIONS.map(({ heading, id, pick }) => {
        const group = alerts.filter(pick);
        if (group.length === 0) return null;
        return (
          <section key={id} aria-labelledby={id}>
            <h2 id={id} className="mb-3 text-xl font-semibold">
              {heading}
            </h2>
            <ul className="space-y-3">
              {group.map((alert) => (
                <AlertCard key={alert.id} alert={alert} onResult={show} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
