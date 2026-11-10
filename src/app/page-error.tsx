"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { LoneCard } from "./lone-card";

// Shown when a page fails to load. Try again calls retry, which fetches the page
// again and replaces this with the result; reset would only render the same
// failed children again. `extra` is a second line for pages where a failed load
// can follow a write. `link` is a way out for a page people land on, where Try
// again may keep failing and no menu is shown.
export function PageError({
  heading,
  extra,
  link,
  retry,
}: {
  heading: string;
  extra?: string;
  link?: { href: string; label: string };
  retry: () => void;
}) {
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
    <LoneCard>
      <h1 ref={headingRef} tabIndex={-1} aria-describedby={messageId} className="text-title font-bold">
        {heading}
      </h1>
      <div id={messageId} role="alert" className="space-y-2 rounded-control border border-error-edge bg-error-wash px-3 py-2.5 text-base font-semibold text-error">
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
        className="h-12 w-full rounded-xl bg-primary px-4 text-base font-bold text-on-primary aria-disabled:bg-primary/60"
      >
        {trying ? "Trying again…" : "Try again"}
      </button>
      {link && (
        <Link
          href={link.href}
          className="flex min-h-control items-center justify-center text-base font-semibold text-primary underline"
        >
          {link.label}
        </Link>
      )}
    </LoneCard>
  );
}
