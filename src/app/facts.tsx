// A list of label and value pairs, the value right-aligned in tabular figures.
// `look` only chooses classes: the elements, their order, and the text are the same in
// every look, and each label stays in the page. "list" is the plain rows. "tiles" draws
// the pairs as tinted tiles side by side, label above value. "cells" is for a list inside
// a card that, from `wide` up, lays its pairs out as cells of a table: it needs a grid
// parent that gives it the columns, and the parent says how many it spans and how each
// value reads.
type Look = "list" | "tiles" | "cells";

const LIST_CLASS: Record<Look, string> = {
  list: "divide-y divide-card-border border-y border-card-border",
  tiles: "grid grid-cols-2 gap-2",
  cells:
    "divide-y divide-card-border wide:grid wide:grid-cols-subgrid wide:divide-y-0 wide:[&>div]:contents wide:[&_dt]:sr-only",
};

const ROW_CLASS: Record<Look, string> = {
  list: "flex justify-between gap-4 py-2.5",
  tiles: "flex min-w-0 flex-col rounded-control bg-tint px-2.5 py-2",
  cells: "flex justify-between gap-4 py-2.5",
};

const LABEL_CLASS: Record<Look, string> = {
  list: "min-w-0 flex-1 break-words text-ink-secondary",
  tiles: "min-w-0 break-words text-sm text-ink-secondary",
  cells: "min-w-0 flex-1 break-words text-ink-secondary",
};

// The value keeps its own width (up to 60%) so "$2.75/lb" never splits mid-word; the label wraps instead.
const VALUE_CLASS: Record<Look, string> = {
  list: "max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums",
  tiles: "break-words text-lg font-semibold tabular-nums",
  cells:
    "max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums wide:min-w-0 wide:max-w-none wide:shrink wide:text-sm wide:font-normal",
};

export function Facts({
  rows,
  look = "list",
}: {
  rows: ReadonlyArray<readonly [label: string, value: string]>;
  look?: Look;
}) {
  return (
    <dl className={LIST_CLASS[look]}>
      {rows.map(([label, value]) => (
        <div key={label} className={ROW_CLASS[look]}>
          <dt className={LABEL_CLASS[look]}>{label}</dt>
          <dd className={VALUE_CLASS[look]}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
