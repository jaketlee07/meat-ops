"use client";

import { PageError } from "../page-error";

// Shown when the pricing page fails to load.
export default function PricingError({ retry }: { error: Error; retry: () => void }) {
  return <PageError heading="Pricing" retry={retry} />;
}
