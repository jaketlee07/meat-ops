import { redirect } from "next/navigation";
import { appToday } from "../../lib/app-today";
import { getDigest, listOpenAlerts } from "../../lib/alerts";
import { digestPage } from "../../lib/digest";
import { NO_OPEN_ALERTS } from "../../lib/failures";
import { isOperator } from "../../lib/rpc";
import { runWatch } from "../_server/watch";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader, WATCH_FAILED } from "../page-header";
import { AlertList } from "./alert-list";
import { DigestSection } from "./digest-section";

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
  const now = new Date();
  const [alerts, row] = await Promise.all([listOpenAlerts(supabase), getDigest(supabase, appToday(now))]);
  // The digest page rule: the render only decides; the section sends the digest.
  const digest = digestPage(alerts.length, row, now);

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Alerts" current="alerts" />
      {watch.status === "failed" && <p className="mb-4 text-base font-medium text-error">{WATCH_FAILED}</p>}
      <section aria-labelledby="digest-heading" className="mb-6">
        <h2 id="digest-heading" className="mb-3 text-xl font-semibold">
          Today&apos;s digest
        </h2>
        {digest.kind === "no-alerts" ? <p className="text-base">{NO_OPEN_ALERTS}</p> : <DigestSection page={digest} />}
      </section>
      <AlertList alerts={alerts} />
    </main>
  );
}
