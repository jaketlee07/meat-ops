"use client";

import { useEffect, useId, useRef, useState } from "react";

// Shown when the receiving page fails to load. Try again calls retry, which
// fetches the page again and replaces this with the result; reset would only
// render the same failed children again.
export default function ReceivingError({ retry }: { error: Error; retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageId = useId();
  // Set when Try again is pressed. If the fetch fails again, the boundary mounts
  // this component anew, which clears it; if it succeeds, this page is replaced.
  const [trying, setTrying] = useState(false);

  // The page just changed under the owner, so focus goes to its heading (AC-0075).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 ref={headingRef} tabIndex={-1} aria-describedby={messageId} className="mb-4 text-2xl font-semibold">
        Receiving
      </h1>
      <p id={messageId} role="alert" className="mb-6 text-base text-error">
        Couldn&apos;t load this page.
      </p>
      <button
        type="button"
        aria-disabled={trying ? true : undefined}
        onClick={() => {
          if (trying) return;
          setTrying(true);
          retry();
        }}
        className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:opacity-60"
      >
        {trying ? "Trying again…" : "Try again"}
      </button>
    </main>
  );
}
