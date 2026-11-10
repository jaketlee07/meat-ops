"use client";

import { PageError } from "./page-error";

// Shown when "Today" fails to load. /sign-in has its own error file, so this covers only `/`.
export default function TodayError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Today" retry={retry} />;
}
