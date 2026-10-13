import { redirect } from "next/navigation";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";

// A heading-only page until the trace feature lands. It settles the caller like
// every other page, so the Trace link in the navigation resolves for the owner only.
export default async function TracePage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
  if (!(await isOperator(supabase))) return <NotAllowed />;

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Trace" current="trace" />
    </main>
  );
}
