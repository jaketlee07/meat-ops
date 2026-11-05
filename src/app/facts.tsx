// A list of label and value pairs, the value right-aligned in tabular figures.
// `inline` is for a list inside a card that, from `wide` up, lays its pairs out as cells of
// a table whose columns the parent defines. It only chooses classes: the elements, their
// order, and the text are the same either way, and each label stays in the page. In an
// `inline` list the first three values (text) read left and the rest (figures) read right
// and never break; a lot number may break only at its hyphen. `tiles` draws the pairs as
// tinted tiles side by side, label above value. Both options only choose classes.
export function Facts({
  rows,
  inline = false,
  tiles = false,
}: {
  rows: ReadonlyArray<readonly [label: string, value: string]>;
  inline?: boolean;
  tiles?: boolean;
}) {
  return (
    <dl
      className={
        inline
          ? "divide-y divide-card-border wide:col-span-6 wide:grid wide:grid-cols-subgrid wide:divide-y-0 wide:[&>div]:contents wide:[&_dt]:sr-only wide:[&>div:nth-child(n+4)>dd]:text-right wide:[&>div:nth-child(n+4)>dd]:whitespace-nowrap wide:[&>div:nth-child(-n+3)>dd]:text-left"
          : tiles
            ? "grid grid-cols-2 gap-2"
            : "divide-y divide-card-border border-y border-card-border"
      }
    >
      {rows.map(([label, value]) => (
        <div
          key={label}
          className={tiles ? "flex min-w-0 flex-col rounded-control bg-tint px-2.5 py-2" : "flex justify-between gap-4 py-2.5"}
        >
          <dt className={`min-w-0 break-words text-ink-secondary${tiles ? " text-sm" : " flex-1"}`}>{label}</dt>
          {/* The value keeps its own width (up to 60%) so "$2.75/lb" never splits mid-word; the label wraps instead. */}
          <dd
            className={`break-words font-semibold tabular-nums ${tiles ? "text-lg font-bold" : "max-w-[60%] shrink-0 text-right"}${inline ? " wide:min-w-0 wide:max-w-none wide:shrink wide:break-normal wide:text-sm wide:font-normal" : ""}`}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
