"use client";

import { PageError } from "../page-error";

// Shown when the alerts page fails to load.
export default function AlertsError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Alerts" retry={retry} />;
}
