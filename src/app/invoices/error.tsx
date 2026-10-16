"use client";

import { PageError } from "../page-error";

// Shown when the invoices page fails to load. A load can fail right after a read
// whose draft was written, so the owner is told to check Drafts to confirm.
export default function InvoicesError({ retry }: { error: Error; retry: () => void }) {
  return (
    <PageError
      heading="Invoices"
      extra="If you were reading an invoice, its draft may have been saved. Check Drafts to confirm before reading it again."
      retry={retry}
    />
  );
}
