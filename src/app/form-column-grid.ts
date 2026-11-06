// The form-column layout that /production, /sales, and /receiving share. From `desk` up, <main> is a grid:
// the shell's title-and-banner div across the top (its first child, placed in the `head` area), the form and
// its saved result in the left column (340 px, 280 px from `wide` up so a list's table has room), and the
// lists and cards in the right one. DOM order, and so Tab order, does not change. Each page adds its own rows
// and areas beside this string, and each child names its area with `desk:[grid-area:...]`.
//
// The `batch-table`, `sale-table`, and `receipt-table` thresholds in globals.css count on these columns: at
// 1280 px with the default text size the right column is about 43rem (688 px) wide, and at 1024 px about
// 23rem. Tailwind reads class names from this file as written, so each class stays a whole literal.
export const FORM_COLUMN_GRID =
  "desk:grid desk:grid-cols-[340px_minmax(0,1fr)] wide:grid-cols-[280px_minmax(0,1fr)] desk:items-start desk:gap-x-4 desk:[&>div:first-child]:[grid-area:head]";
