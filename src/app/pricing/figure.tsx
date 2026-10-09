// One label-and-value row of a pricing screen. The value wraps under its label
// when it is long.
export function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-2">
      <dt className="min-w-0 break-words text-ink-secondary">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </div>
  );
}
