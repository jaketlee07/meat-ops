import Link from "next/link";
import { formatDate } from "../../lib/format";
import type { WaitingDraft } from "../../lib/invoices";

// Where the section is a table (the `draft-table` variant: the section is the container named `drafts`
// and at least 34rem wide at the current text size) the header line and every draft share one template:
// the capture date, the source, the line count, then the first words. Otherwise each draft is a card.
// The fixed columns hold a date such as "Sep 30, 2026", "Photo", and "100 lines"; the first words take
// what is left and wrap.
const TABLE_COLUMNS = "draft-table:grid-cols-[7.5rem_4rem_5rem_minmax(0,1fr)] draft-table:gap-x-3 draft-table:px-4";
const COLUMN_NAMES = ["Captured", "From", "Lines", "First words"];

// Each waiting draft once, newest capture time first, as one link to its review. The link's text is the
// date, the source, a comma and a space, the line count, then the words; in the table look the comma is
// hidden visually and stays in the page. The invoice words are literal text, never markup.
export function DraftsList({ drafts }: { drafts: WaitingDraft[] }) {
  return (
    <section aria-labelledby="drafts-heading" className="@container/drafts space-y-4">
      <h2 id="drafts-heading" className="text-xl font-semibold">
        Drafts to confirm
      </h2>
      {drafts.length === 0 ? (
        <p className="text-base">No drafts waiting.</p>
      ) : (
        // The container cannot style itself, so this div carries the table's card edge.
        <div className="draft-table:overflow-hidden draft-table:rounded-card draft-table:border draft-table:border-card-border draft-table:bg-surface">
          {/* Where the section is a table the header line names the columns; each draft's own parts stay in the link. */}
          <div
            aria-hidden="true"
            className={`hidden items-end bg-page py-2 text-xs font-semibold text-ink-secondary draft-table:grid ${TABLE_COLUMNS}`}
          >
            {COLUMN_NAMES.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <ul className="space-y-3 draft-table:space-y-0">
            {drafts.map((draft) => (
              <li key={draft.id}>
                <Link
                  href={`/invoices?draft=${draft.id}`}
                  className={`block min-h-control rounded-card border border-card-border bg-surface p-3.5 text-base draft-table:grid draft-table:items-center draft-table:rounded-none draft-table:border-0 draft-table:border-t draft-table:py-1.5 draft-table:text-sm draft-table:-outline-offset-2 ${TABLE_COLUMNS}`}
                >
                  <span className="block font-medium text-primary underline">{formatDate(draft.capturedOn)}</span>
                  <span className="block text-ink-secondary draft-table:contents">
                    <span className="draft-table:text-ink">{draft.source === "photo" ? "Photo" : "Text"}</span>
                    <span className="draft-table:sr-only">{", "}</span>
                    <span className="draft-table:text-ink">
                      {draft.lineCount === 1 ? "1 line" : `${draft.lineCount} lines`}
                    </span>
                  </span>
                  <span className="block min-w-0 break-words text-ink">{draft.firstWords}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
