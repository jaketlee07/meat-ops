"use client";

import { PageError } from "../page-error";

// Shown when the menu page fails to load.
export default function MenuError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Menu" retry={retry} />;
}
