"use client";

import { PageError } from "../page-error";

// Shown when the receiving page fails to load.
export default function ReceivingError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Receiving" retry={retry} />;
}
