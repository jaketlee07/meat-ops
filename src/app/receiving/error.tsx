"use client";

import { useEffect, useRef } from "react";

// Shown when the receiving page fails to load. Try again calls retry, which
// fetches the page again and replaces this with the result; reset would only
// render the same failed children again.
export default function ReceivingError({ retry }: { error: Error; retry: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The page just changed under the owner, so focus goes to its heading (AC-0075).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 ref={headingRef} tabIndex={-1} className="mb-4 text-2xl font-semibold">
        Receiving
      </h1>
      <p role="alert" className="mb-6 text-base text-error">
        Couldn&apos;t load this page.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary"
      >
        Try again
      </button>
    </main>
  );
}
