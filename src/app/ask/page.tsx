import { redirect } from "next/navigation";
import { CATALOG, QUERY_IDS } from "../../lib/ask";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageShell } from "../page-header";
import { AskPanel } from "./ask-panel";

// Every page settles who is asking. The proxy only refreshes the session. An
// answer lives in the panel's state: nothing is in the address or stored.
export default async function AskPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // Only a failed answer throws, which the error boundary shows. A signed-in
  // user who is not on the allowlist gets the not-allowed page.
  if (!(await isOperator(supabase))) return <NotAllowed />;

  return (
    <PageShell title="Ask" current="ask" fullWidth>
      <AskPanel />
      <section aria-labelledby="examples-heading" className="mt-8 space-y-2 rounded-card border border-card-border bg-surface p-3.5 desk:p-4">
        <h2 id="examples-heading" className="text-xl font-semibold">
          Questions Ask can answer
        </h2>
        <ul className="list-disc space-y-1 pl-6 text-base">
          {QUERY_IDS.map((id) => (
            <li key={id} className="break-words">
              {CATALOG[id].example}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
