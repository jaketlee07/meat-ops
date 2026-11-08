// A list of label and value pairs, the value right-aligned in tabular figures.
// `look` only chooses classes: the elements, their order, and the text are the same in
// every look, and each label stays in the page. "list" is the plain rows. "tiles" draws
// the pairs as tinted tiles, label above value, each value whole on one line, side by side while both fit in the
// width and wrapped onto their own lines where they do not (a flex wrap, so no breakpoint). "cells" is for a list inside
// a card that, from `receipt-table` up (see globals.css), lays its pairs out as cells of a table: it needs a grid
// parent that gives it the columns, and the parent says how many it spans and how each
// value reads. "card" and "card-cols" are the bottom half of a result card whose heading sits right
// above them (the heading draws the card's top edge); "card-cols" sets its pairs in three columns
// where a trace's lot section has room (`lot-wide`). The sale trace's "card" and "plain" lay each pair out as a column,
// label directly above value, the pairs in a row where the sale trace has room (`sale-cols`) and two to a row where
// it does not; "plain" draws no card edge, for the facts inside a batch card or a raw lot block. "quiet" is "list"
// with its values at weight 400, for the facts in the stock cards, where the tiles carry the figures; "list" keeps its
// bold values for the saved results and the open panels and dialogs. "card", "card-cols", and the sale trace's values are weight 500.
type Look = "list" | "quiet" | "tiles" | "cells" | "card" | "card-cols" | "plain";

// Each distinct class string is written once here, and a look only picks which ones it uses.
const DIVIDED = "divide-y divide-card-border";
const RULED_ROW = "flex justify-between gap-4 py-2.5";
const LABEL = "min-w-0 flex-1 break-words text-ink-secondary";
const COLUMN_LABEL = "min-w-0 break-words text-ink-secondary";
const VALUE = "max-w-[60%] shrink-0 break-words text-right font-semibold tabular-nums";
const VALUE_MEDIUM = "max-w-[60%] shrink-0 break-words text-right font-medium tabular-nums";
const VALUE_QUIET = "max-w-[60%] shrink-0 break-words text-right tabular-nums";
const CARD_BOTTOM = "rounded-b-card border border-t-0 border-card-border bg-surface px-4 pb-4";
const CARD_ROW = "-mb-px flex justify-between gap-4 border-y border-card-border py-2";
// A sale trace's pairs: each a column, its label above its value, left-aligned.
const COLUMN_ROW = "flex min-w-0 flex-col gap-0.5";
const COLUMN_VALUE = "min-w-0 break-words font-medium tabular-nums";
// The sale trace's grid: two pairs to a row, then every pair in its own column from `sale-cols` up.
const COLUMN_GRID = "grid grid-cols-2 gap-x-6 gap-y-3 sale-cols:auto-cols-fr sale-cols:grid-flow-col sale-cols:grid-cols-none";

// A trace result's heading and its facts list are one white card: the heading draws the top half (CARD_TOP)
// and "card" or "card-cols" the bottom half (CARD_BOTTOM). Both stay direct children of a section laid out
// as CARD_SECTION, whose gap the heading's negative margin cancels, so the two halves and the gap that
// joins them come from here and cannot drift apart.
export const CARD_SECTION = "flex flex-col gap-4";
export const CARD_TOP = "-mb-4 break-words rounded-t-card border border-b-0 border-card-border bg-surface px-4 pb-3 pt-4 text-lg font-bold";

const LIST_CLASS: Record<Look, string> = {
  list: `${DIVIDED} border-y border-card-border`,
  quiet: `${DIVIDED} border-y border-card-border`,
  tiles: "flex flex-wrap gap-2",
  cells: `${DIVIDED} receipt-table:grid receipt-table:grid-cols-subgrid receipt-table:divide-y-0 receipt-table:[&>div]:contents receipt-table:[&_dt]:sr-only`,
  card: `${CARD_BOTTOM} pt-3 ${COLUMN_GRID}`,
  "card-cols": `grid ${CARD_BOTTOM} lot-wide:grid-flow-col lot-wide:grid-cols-3 lot-wide:grid-rows-2 lot-wide:gap-x-6`,
  plain: `${COLUMN_GRID} text-note`,
};

const ROW_CLASS: Record<Look, string> = {
  list: RULED_ROW,
  quiet: RULED_ROW,
  tiles: "flex min-w-0 grow flex-col rounded-control bg-tint px-2.5 py-2",
  cells: RULED_ROW,
  card: COLUMN_ROW,
  "card-cols": CARD_ROW,
  plain: COLUMN_ROW,
};

const LABEL_CLASS: Record<Look, string> = {
  list: LABEL,
  quiet: LABEL,
  tiles: "min-w-0 break-words text-sm text-ink-secondary",
  cells: LABEL,
  card: COLUMN_LABEL,
  "card-cols": LABEL,
  plain: COLUMN_LABEL,
};

// The "list", "cells", and "card-cols" looks keep the value's own width, up to 60%, and let the label wrap instead;
// for "cells" this applies where the section is not a table. "tiles" keeps each value on one line and sets no width
// cap; "card" and "plain" give a value its column's width and let it wrap there. Where the
// section is a table, "cells" lets the value shrink to its column and wrap.
const VALUE_CLASS: Record<Look, string> = {
  list: VALUE,
  quiet: VALUE_QUIET,
  tiles: "whitespace-nowrap text-lg font-semibold tabular-nums",
  cells: `${VALUE} receipt-table:min-w-0 receipt-table:max-w-none receipt-table:shrink receipt-table:text-sm receipt-table:font-normal`,
  card: COLUMN_VALUE,
  "card-cols": VALUE_MEDIUM,
  plain: "min-w-0 break-words tabular-nums",
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
