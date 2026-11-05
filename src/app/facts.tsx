// A list of label and value pairs, the value right-aligned in tabular figures.
// `inline` is for a list inside a card that, from `wide` up, lays its pairs out as cells of
// a table whose columns the parent defines. It only chooses classes: the elements, their
// order, and the text are the same either way, and each label stays in the page.
export function Facts({
  rows,
  inline = false,
}: {
  rows: ReadonlyArray<readonly [label: string, value: string]>;
  inline?: boolean;
}) {
  return (
    <dl
      className={
        inline
          ? "divide-y divide-card-border wide:col-span-6 wide:grid wide:grid-cols-subgrid wide:divide-y-0 wide:[&>div]:contents wide:[&_dd]:text-right wide:[&_dt]:sr-only"
          : "divide-y divide-card-border border-y border-card-border"
      }
    >
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-2.5">
          <dt className="min-w-0 flex-1 break-words text-ink-secondary">{label}</dt>
          {/* The value keeps its own width (up to 60%) so "$2.75/lb" never splits mid-word; the label wraps instead. */}
          <dd
            className={`max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums${inline ? " wide:min-w-0 wide:max-w-none wide:shrink wide:text-sm wide:font-normal" : ""}`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
