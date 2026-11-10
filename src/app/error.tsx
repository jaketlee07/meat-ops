"use client";

import { PageError } from "./page-error";

// Shown when "Today" fails to load. /sign-in has its own error file, so this covers only `/`.
// Sign-in and the installed app land here, so it offers a way to Receiving as well as Try again.
export default function TodayError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Today" retry={retry} link={{ href: "/receiving", label: "Go to Receiving" }} />;
}
