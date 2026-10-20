"use client";

import { useEffect, useRef, useState } from "react";
import type { DigestPage } from "../../lib/digest";
import {
  DIGEST_BUSY,
  DIGEST_FOOTER,
  DIGEST_TRY_AGAIN,
  DIGEST_WRITING,
  digestFailureMessage,
} from "../../lib/failures";
import { writeDigest } from "./actions";
import type { DigestState } from "./decide";

// What the section shows: the paragraphs, or one message with Try again or without.
type Shown =
  | { kind: "digest"; paragraphs: string[] }
  | { kind: "message"; text: string; retry: boolean; failure: boolean };

function fromPage(page: Exclude<DigestPage, { kind: "no-alerts" } | { kind: "send" }>): Shown {
  if (page.kind === "written") return { kind: "digest", paragraphs: page.paragraphs };
  if (page.kind === "writing") return { kind: "message", text: DIGEST_BUSY, retry: false, failure: false };
  return { kind: "message", text: digestFailureMessage(page.failureKind), retry: true, failure: true };
}

function fromState(state: DigestState): Shown {
  if (state.status === "written") return { kind: "digest", paragraphs: state.paragraphs };
  if (state.status === "notice") return { kind: "message", text: state.message, retry: false, failure: false };
  return { kind: "message", text: state.message, retry: state.retry, failure: true };
}

// Today's digest. When the page rule calls for a send, the section sends the
// action once on mount, on its own (a ref guards a second send). Try again sends
// it again. The render never waits on the model (alerts plan, T6).
export function DigestSection({ page }: { page: Exclude<DigestPage, { kind: "no-alerts" }> }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Shown | null>(null);
  const sentRef = useRef(false);
  const busyRef = useRef(false);
  const focusRef = useRef(false);
  const outcomeRef = useRef<HTMLDivElement>(null);

  async function send(automatic: boolean) {
    if (busyRef.current) return;
    busyRef.current = true;
    setSending(true);
    const formData = new FormData();
    formData.set("automatic", automatic ? "true" : "false");
    let shown: Shown;
    try {
      shown = fromState(await writeDigest(formData));
    } catch {
      // A dropped connection or a server error: the day may be left writing.
      shown = { kind: "message", text: DIGEST_TRY_AGAIN, retry: true, failure: true };
    }
    busyRef.current = false;
    setResult(shown);
    setSending(false);
  }

  useEffect(() => {
    if (page.kind !== "send" || sentRef.current) return;
    sentRef.current = true;
    void send(true);
    // The guard makes this run once; the dependency is the page rule only.
  }, [page.kind]);

  // Keyboard focus follows the outcome of Try again only (AC-0134, AC-0136).
  useEffect(() => {
    if (result && focusRef.current) {
      focusRef.current = false;
      outcomeRef.current?.focus();
    }
  }, [result]);

  const shown: Shown | null = result ?? (page.kind === "send" ? null : fromPage(page));

  return (
    <>
      {/* In the page before it has text, so the message is announced (AC-0081). */}
      <p role="status" className="text-base text-ink-secondary">
        {sending ? DIGEST_WRITING : null}
      </p>
      <div ref={outcomeRef} tabIndex={-1} aria-live="polite" className="space-y-3">
        {!sending && shown?.kind === "digest" && (
          <>
            {shown.paragraphs.map((paragraph, index) => (
              <p key={index} className="break-words text-base">
                {paragraph}
              </p>
            ))}
            <p className="text-base text-ink-secondary">{DIGEST_FOOTER}</p>
          </>
        )}
        {!sending && shown?.kind === "message" && (
          <p className={`break-words text-base ${shown.failure ? "font-medium text-error" : ""}`}>{shown.text}</p>
        )}
      </div>
      {shown?.kind === "message" && shown.retry && (
        <button
          type="button"
          aria-disabled={sending ? true : undefined}
          onClick={() => {
            if (busyRef.current) return;
            focusRef.current = true;
            void send(false);
          }}
          className="mt-3 w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:bg-primary/60"
        >
          Try again
        </button>
      )}
    </>
  );
}
