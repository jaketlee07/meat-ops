import Link from "next/link";
import { redirect } from "next/navigation";
import { BACK_TO_INVOICES, NO_DRAFT } from "../../lib/failures";
import { getDraft, isUuid, listWaitingDrafts, readCatalog } from "../../lib/invoices";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";
import { DraftReview } from "./draft-review";
import { DraftsList } from "./drafts-list";
import { ReadForms } from "./read-forms";

// Every page settles who is asking. The proxy only refreshes the session.
// A draft's review lives in the URL (?draft=<id>), so it reloads as shown.
export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // Only a failed answer throws, which the error boundary shows. A signed-in
  // user who is not on the allowlist gets the not-allowed page.
  if (!(await isOperator(supabase))) return <NotAllowed />;

  const query = await searchParams;
  if (typeof query.draft === "string") {
    // A malformed id is never sent to the database.
    const draft = isUuid(query.draft) ? await getDraft(supabase, query.draft) : null;
    // Only a waiting draft's pickers are shown, so only it reads the catalog.
    const catalog = draft?.status === "pending" ? await readCatalog(supabase) : { products: [], vendors: [] };
    return (
      <main className="mx-auto w-full max-w-xl p-4">
        <PageHeader title="Invoices" current="invoices" />
        <Link
          href="/invoices"
          className="mb-4 inline-flex min-h-control min-w-control items-center rounded-md px-3 text-base font-medium text-primary underline"
        >
          {BACK_TO_INVOICES}
        </Link>
        <section aria-labelledby="review-heading" className="space-y-4">
          <h2 id="review-heading" className="text-xl font-semibold">
            Draft review
          </h2>
          {draft ? (
            <DraftReview key={draft.id} draft={draft} products={catalog.products} vendors={catalog.vendors} />
          ) : (
            <>
              <p className="text-base">{NO_DRAFT}</p>
              {/* The id came from the address bar: literal text, however it is shaped. */}
              <p className="break-words text-base text-ink-secondary">{query.draft}</p>
            </>
          )}
        </section>
      </main>
    );
  }

  const drafts = await listWaitingDrafts(supabase);
  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Invoices" current="invoices" />
      <ReadForms />
      <DraftsList drafts={drafts} />
    </main>
  );
}
