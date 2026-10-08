"use client";

export default function ReceivingError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 className="mb-4 text-2xl font-semibold">Receiving</h1>
      <p role="alert" className="mb-6 text-base text-error">
        Couldn&apos;t load this page.
      </p>
      <button
        type="button"
        onClick={reset}
        className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary"
      >
        Try again
      </button>
    </main>
  );
}
