// A list of label and value pairs, the value right-aligned in tabular figures.
export function Facts({ rows }: { rows: ReadonlyArray<readonly [label: string, value: string]> }) {
  return (
    <dl className="divide-y divide-field-border border-y border-field-border">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2">
          <dt className="min-w-0 flex-1 break-words text-ink-secondary">{label}</dt>
          {/* The value keeps its own width (up to 60%) so "$2.75/lb" never splits mid-word; the label wraps instead. */}
          <dd className="max-w-[60%] shrink-0 break-words text-right font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
