import { redirect } from "next/navigation";
import { listWaitingDrafts } from "../../lib/invoices";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";
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
    return (
      <main className="mx-auto w-full max-w-xl p-4">
        <PageHeader title="Invoices" current="invoices" />
        <h2 className="text-xl font-semibold">Draft review</h2>
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
