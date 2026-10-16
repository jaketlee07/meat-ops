import { redirect } from "next/navigation";
import { listOpenAlerts } from "../../lib/alerts";
import { isOperator } from "../../lib/rpc";
import { runWatch } from "../_server/watch";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader, WATCH_FAILED } from "../page-header";
import { AlertList } from "./alert-list";

// Every page settles who is asking. The proxy only refreshes the session.
// The watch runs before any alert is read, so the page shows the figures of this load.
export default async function AlertsPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // Only a failed answer throws, which the error boundary shows. A signed-in
  // user who is not on the allowlist gets the not-allowed page.
  if (!(await isOperator(supabase))) return <NotAllowed />;

  const watch = await runWatch();
  const alerts = await listOpenAlerts(supabase);

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Alerts" current="alerts" />
      {watch.status === "failed" && <p className="mb-4 text-base font-medium text-error">{WATCH_FAILED}</p>}
      <section aria-labelledby="digest-heading" className="mb-6">
        <h2 id="digest-heading" className="mb-3 text-xl font-semibold">
          Today&apos;s digest
        </h2>
        {alerts.length === 0 && <p className="text-base">No open alerts.</p>}
      </section>
      <AlertList alerts={alerts} />
    </main>
  );
}
