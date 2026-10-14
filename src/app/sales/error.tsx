"use client";

import { PageError } from "../page-error";

// Shown when the sales page fails to load. A sale can be voided, so there is no
// "may have been saved" line: the save message points to Recent sales instead.
export default function SalesError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Sales" retry={retry} />;
}
