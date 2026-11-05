import type { ReactNode } from "react";

// The frame for the views that have no menu: /sign-in, the not-allowed view, and
// the error view. It draws its own blue mark above one white card, which is the
// view's <main>. It uses no client hooks, so the error view can use it too.
export function LoneCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-5 px-4 pb-4 pt-14">
      <header className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-control bg-primary text-sm font-bold text-on-primary"
        >
          MO
        </span>
        <span className="text-lg font-bold">Meat Ops</span>
      </header>
      <main className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-card-border bg-surface p-5">
        {children}
      </main>
    </div>
  );
}
