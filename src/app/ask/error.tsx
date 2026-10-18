"use client";

import { PageError } from "../page-error";

// Shown when the ask page fails to load. Nothing is written by a question, so
// there is no second line about a saved result.
export default function AskError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Ask" retry={retry} />;
}
