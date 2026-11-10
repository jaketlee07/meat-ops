"use client";

import { PageError } from "../page-error";

// Shown when the sign-in page fails to load.
export default function SignInError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Sign in" retry={retry} />;
}
