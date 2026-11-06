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
// container is under 18rem wide (the `result-snug` variant in globals.css) the text and cell padding
// tighten, and under 13rem (`result-tight`) they tighten again and a row label may break inside a word, so
// long figures (six-digit weights with three decimals, costs of $10 or more) stay inside it. The two
// variants never overlap, so `result-tight` wins whatever the order of their rules.
export function BeforeAfter({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <table className="w-full border-collapse text-base tabular-nums result-snug:text-sm result-tight:text-xs">
      <thead>
        <tr className="bg-page">
          <th
            scope="col"
            className="rounded-l-control py-2 pr-2 text-left text-sm font-semibold text-ink-secondary result-snug:pr-0.5 result-snug:text-xs result-tight:pr-0 result-tight:wrap-anywhere"
          >
            {title}
          </th>
          <th
            scope="col"
            className="px-2 py-2 text-right text-sm font-semibold text-ink-secondary result-snug:px-0.5 result-snug:text-xs result-tight:px-0"
          >
            Before
          </th>
          <th
            scope="col"
            className="rounded-r-control py-2 pl-2 text-right text-sm font-semibold text-ink-secondary result-snug:pl-0.5 result-snug:text-xs result-tight:pl-0"
          >
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-card-border">
            <th
              scope="row"
              className="break-words py-2.5 pr-2 text-left font-normal result-snug:pr-0.5 result-tight:pr-0 result-tight:wrap-anywhere"
            >
              {row.label}
            </th>
            <td className="px-2 py-2.5 text-right tabular-nums text-ink-secondary result-snug:px-0.5 result-tight:px-0">{row.before}</td>
            <td className="py-2.5 pl-2 text-right font-bold tabular-nums result-snug:pl-0.5 result-tight:pl-0">{row.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
