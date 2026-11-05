// One label-and-value row of a pricing screen. The value wraps under its label
// when it is long. `strong` only chooses classes: it sets the row in bold.
export function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex flex-wrap justify-between gap-x-2${strong ? " font-bold" : ""}`}>
      <dt className={`min-w-0 break-words${strong ? "" : " text-ink-secondary"}`}>{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
