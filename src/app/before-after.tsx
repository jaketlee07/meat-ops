interface Row {
  label: string;
  before: string;
  after: string;
}

// A table of values before and after a save, each as the database held it.
// A cell may wrap between a number and its unit, so a long number never makes
// the page scroll sideways on a phone. Where the nearest container (a saved-result card) is under
// 18rem wide, the text and cell padding tighten, and again under 13rem, so the table stays inside it.
export function BeforeAfter({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <table className="w-full border-collapse text-base tabular-nums @max-[18rem]:text-sm @max-[13rem]:text-xs">
      <thead>
        <tr className="bg-page">
          <th scope="col" className="rounded-l-control py-2 pr-2 text-left text-sm font-semibold @max-[18rem]:pr-1 @max-[13rem]:pr-0.5 @max-[18rem]:text-xs text-ink-secondary">
            {title}
          </th>
          <th scope="col" className="px-2 py-2 text-right text-sm font-semibold @max-[18rem]:px-1 @max-[13rem]:px-0.5 @max-[18rem]:text-xs text-ink-secondary">
            Before
          </th>
          <th scope="col" className="rounded-r-control py-2 pl-2 text-right text-sm font-semibold @max-[18rem]:pl-1 @max-[13rem]:pl-0.5 @max-[18rem]:text-xs text-ink-secondary">
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-b border-card-border">
            <th scope="row" className="break-words py-2.5 pr-2 text-left font-normal @max-[18rem]:pr-1 @max-[13rem]:pr-0.5">
              {row.label}
            </th>
            <td className="px-2 py-2.5 text-right tabular-nums text-ink-secondary @max-[18rem]:px-1 @max-[13rem]:px-0.5">{row.before}</td>
            <td className="py-2.5 pl-2 text-right font-bold tabular-nums @max-[18rem]:pl-1 @max-[13rem]:pl-0.5">{row.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
