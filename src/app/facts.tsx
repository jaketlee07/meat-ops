// A list of label and value pairs, the value right-aligned in tabular figures.
// `look` only chooses classes: the elements, their order, and the text are the same in
// every look, and each label stays in the page. "list" is the plain rows. "tiles" draws
// the pairs as tinted tiles side by side, label above value. "cells" is for a list inside
// a card that, from `receipt-table` up (see globals.css), lays its pairs out as cells of a table: it needs a grid
// parent that gives it the columns, and the parent says how many it spans and how each
// value reads. "card" and "card-cols" are the bottom half of a result card whose heading sits right
// above them (the heading draws the card's top edge); "card-cols" sets its pairs in three columns
// where a trace's lot section has room (`lot-wide`). "plain" is rows with no rules, for a card's inner facts.
type Look = "list" | "tiles" | "cells" | "card" | "card-cols" | "plain";

const LIST_CLASS: Record<Look, string> = {
  list: "divide-y divide-card-border border-y border-card-border",
  tiles: "grid grid-cols-2 gap-2",
  cells:
    "divide-y divide-card-border receipt-table:grid receipt-table:grid-cols-subgrid receipt-table:divide-y-0 receipt-table:[&>div]:contents receipt-table:[&_dt]:sr-only",
  card: "rounded-b-card border border-t-0 border-card-border bg-surface px-4 pb-4",
  "card-cols":
    "grid rounded-b-card border border-t-0 border-card-border bg-surface px-4 pb-4 lot-wide:grid-flow-col lot-wide:grid-cols-3 lot-wide:grid-rows-2 lot-wide:gap-x-6",
  plain: "grid gap-y-1 text-note",
};

const ROW_CLASS: Record<Look, string> = {
  list: "flex justify-between gap-4 py-2.5",
  tiles: "flex min-w-0 flex-col rounded-control bg-tint px-2.5 py-2",
  cells: "flex justify-between gap-4 py-2.5",
  card: "-mb-px flex justify-between gap-4 border-y border-card-border py-2",
  "card-cols": "-mb-px flex justify-between gap-4 border-y border-card-border py-2",
  plain: "flex justify-between gap-3",
};

const LABEL_CLASS: Record<Look, string> = {
  list: "min-w-0 flex-1 break-words text-ink-secondary",
  tiles: "min-w-0 break-words text-sm text-ink-secondary",
  cells: "min-w-0 flex-1 break-words text-ink-secondary",
  card: "min-w-0 flex-1 break-words text-ink-secondary",
  "card-cols": "min-w-0 flex-1 break-words text-ink-secondary",
  plain: "min-w-0 flex-1 break-words text-ink-secondary",
};

// "list" and "cells" keep the value's own width, up to 60%, and let the label wrap instead; the
// list classes apply where the section is not a table. "tiles" sets no width cap. Where the
// section is a table, "cells" lets the value shrink to its column and wrap.
const VALUE_CLASS: Record<Look, string> = {
  list: "max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums",
  tiles: "break-words text-lg font-semibold tabular-nums",
  cells:
    "max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums receipt-table:min-w-0 receipt-table:max-w-none receipt-table:shrink receipt-table:text-sm receipt-table:font-normal",
  card: "max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums",
  "card-cols": "max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums",
  plain: "max-w-[60%] shrink-0 break-words text-right tabular-nums",
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
