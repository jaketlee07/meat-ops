// A status word as a small tag: a rounded pill on --color-mark-fill, the word in --color-ink, and a dot
// before it in the status color. The dot is decoration; the word carries the meaning, so color is never
// the only signal. `tone` only chooses the dot: "priced" is --color-status-priced (green), "nocost" is
// --color-status-nocost (gray).
const DOT: Record<"priced" | "nocost", string> = {
  priced: "bg-status-priced",
  nocost: "bg-status-nocost",
};

export function StatusTag({ tone, children }: { tone: "priced" | "nocost"; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-mark-fill px-2.5 py-0.5 text-sm font-medium text-ink">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}
