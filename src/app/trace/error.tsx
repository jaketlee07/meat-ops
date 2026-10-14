"use client";

import { PageError } from "../page-error";

// Shown when the trace page fails to load. It only reads, so there is no extra line.
export default function TraceError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Trace" retry={retry} />;
}
