import Link from "next/link";
import { formatDate } from "../../lib/format";
import type { WaitingDraft } from "../../lib/invoices";

// Each waiting draft once, newest capture time first, as a link to its review.
// The invoice words are literal text, never markup.
export function DraftsList({ drafts }: { drafts: WaitingDraft[] }) {
  return (
    <section aria-labelledby="drafts-heading" className="space-y-4">
      <h2 id="drafts-heading" className="text-xl font-semibold">
        Drafts to confirm
      </h2>
      {drafts.length === 0 ? (
        <p className="text-base">No drafts waiting.</p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => (
            <li key={draft.id}>
              <Link
                href={`/invoices?draft=${draft.id}`}
                className="block min-h-control rounded-md border border-field-border p-3 text-base"
              >
                <span className="block font-medium text-primary underline">{formatDate(draft.capturedOn)}</span>
                <span className="block text-ink-secondary">
                  {draft.source === "photo" ? "Photo" : "Text"}
                  {", "}
                  {draft.lineCount === 1 ? "1 line" : `${draft.lineCount} lines`}
                </span>
                <span className="block break-words text-ink">{draft.firstWords}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
