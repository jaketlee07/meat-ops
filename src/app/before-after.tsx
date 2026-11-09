interface Row {
  label: string;
  before: string;
  after: string;
}

// A table of values before and after a save, each as the database held it.
// A cell may wrap between a number and its unit, so a long number never makes
// the page scroll sideways on a phone. The card that holds the table is the container named `result` on
// Production, Sales, and Receiving (their saved-result cards and the "Batch reversed" and "Receipt
// corrected" panels); the /invoices saved result is not one, so its tables do not tighten. Where the
// container is from 13rem up to 18rem wide (the `result-snug` variant in globals.css) the text and cell
// padding tighten, and under 13rem (`result-tight`) they tighten further, so long figures (six-digit weights
// with three decimals, costs of $10 or more) stay inside it. The two variants never overlap, so a
// `result-snug:` class does nothing under 13rem: a class meant to hold there too is also set under
// `result-tight:`. Under 20rem (`result-stack`, which overlaps both) each row stacks: its label on one line,
// then Before and After each on a line of their own with the column name before the value, and every value
// on one line. The header keeps its title and shrinks Before and After to no height (`h-0` with `overflow-hidden`, inside their cells), since the rows now name
// each value; the two stay column headers in the accessibility tree, and the roles below keep the table's meaning where the display is no longer a table. The After column is
// weight 500, like every figure in a saved result.
export function BeforeAfter({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <table
      role="table"
      className="w-full border-collapse text-base tabular-nums result-snug:text-sm result-tight:text-xs result-stack:block"
    >
      <thead role="rowgroup" className="result-stack:block">
        <tr role="row" className="bg-page result-stack:block result-stack:rounded-control">
          <th
            role="columnheader"
            scope="col"
            className="rounded-l-control py-2 pr-2 text-left text-sm font-semibold text-ink-secondary result-snug:pr-0.5 result-snug:text-xs result-tight:pr-0 result-tight:text-xs result-stack:block result-stack:rounded-control result-stack:px-2 result-stack:text-xs"
          >
            {title}
          </th>
          <th
            role="columnheader"
            scope="col"
            className="px-2 py-2 text-right text-sm font-semibold text-ink-secondary result-snug:px-0.5 result-snug:text-xs result-tight:px-0 result-tight:text-xs result-stack:block result-stack:h-0 result-stack:overflow-hidden result-stack:p-0"
          >
            Before
          </th>
          <th
            role="columnheader"
            scope="col"
            className="rounded-r-control py-2 pl-2 text-right text-sm font-semibold text-ink-secondary result-snug:pl-0.5 result-snug:text-xs result-tight:pl-0 result-tight:text-xs result-stack:block result-stack:h-0 result-stack:overflow-hidden result-stack:p-0"
          >
            After
          </th>
        </tr>
      </thead>
      <tbody role="rowgroup" className="result-stack:block">
        {rows.map((row) => (
          <tr key={row.label} role="row" className="border-b border-card-border result-stack:block result-stack:py-2.5">
            <th
              role="rowheader"
              scope="row"
              className="break-words py-2.5 pr-2 text-left font-normal result-snug:pr-0.5 result-tight:pr-0 result-stack:block result-stack:py-0 result-stack:pr-0"
            >
              {row.label}
            </th>
            <td
              role="cell"
              className="px-2 py-2.5 text-right tabular-nums text-ink-secondary result-snug:px-0.5 result-tight:px-0 result-stack:flex result-stack:justify-between result-stack:whitespace-nowrap result-stack:px-0 result-stack:pb-0 result-stack:pt-1 result-stack:before:content-['Before']"
            >
              {row.before}
            </td>
            <td
              role="cell"
              className="py-2.5 pl-2 text-right font-medium tabular-nums result-snug:pl-0.5 result-tight:pl-0 result-stack:flex result-stack:justify-between result-stack:whitespace-nowrap result-stack:pb-0 result-stack:pl-0 result-stack:pt-0.5 result-stack:before:font-normal result-stack:before:text-ink-secondary result-stack:before:content-['After']"
            >
              {row.after}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
