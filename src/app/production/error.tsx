"use client";

import { PageError } from "../page-error";

// Shown when the production page fails to load. A load can fail right after a
// save whose page render failed, so the owner is told to check before saving again.
export default function ProductionError({ retry }: { error: Error; retry: () => void }) {
  return (
    <PageError
      heading="Production"
      extra="If you were saving a batch, it may have been saved. Check Recent batches before saving it again."
      retry={retry}
    />
  );
}
