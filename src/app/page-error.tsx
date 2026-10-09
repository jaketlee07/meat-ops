"use client";

import { useEffect, useId, useRef, useState } from "react";

// Shown when a page fails to load. Try again calls retry, which fetches the page
// again and replaces this with the result; reset would only render the same
// failed children again. `extra` is a second line for pages where a failed load
// can follow a write.
export function PageError({ heading, extra, retry }: { heading: string; extra?: string; retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageId = useId();
  // Set when Try again is pressed. If the fetch fails again, the boundary mounts
  // this component anew, which clears it; if it succeeds, this page is replaced.
  const [trying, setTrying] = useState(false);

  // The page just changed under the owner, so focus goes to its heading.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 ref={headingRef} tabIndex={-1} aria-describedby={messageId} className="mb-4 text-2xl font-semibold">
        {heading}
      </h1>
      <div id={messageId} role="alert" className="mb-6 space-y-2 text-base text-error">
        <p>Couldn&apos;t load this page.</p>
        {extra && <p>{extra}</p>}
      </div>
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
