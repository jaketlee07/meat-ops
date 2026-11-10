import { redirect } from "next/navigation";
import { appToday } from "../lib/app-today";
import { alertText } from "../lib/alert-text";
import { listOpenAlerts } from "../lib/alerts";
import { NO_OPEN_ALERTS } from "../lib/failures";
import { getStockValue, getTodaySales, listStockOnHand, listTodayBatches, listTodayReceipts, listTodaySales } from "../lib/home";
import { isOperator } from "../lib/rpc";
import { runWatch } from "./_server/watch";
import { createSessionClient } from "./_server/session";
import { OpenAlerts } from "./home/open-alerts";
import { SalesAndStockValue } from "./home/sales-and-stock";
import { StockOnHand } from "./home/stock-on-hand";
import { TodaysEntries } from "./home/entries";
import { NotAllowed } from "./not-allowed";
import { PageShell, WATCH_FAILED } from "./page-header";

// "Today": where the business stands, on one page. Every page settles who is asking; the proxy only
// refreshes the session. The watch runs before any alert is read, as /alerts does. Then every read
// runs here, in one Promise.all of bare calls, so a failed read reaches the error view and
// stops the page; the section parts take their data as props and read nothing.
export default async function TodayPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  if (!(await isOperator(supabase))) return <NotAllowed />;

  const watch = await runWatch();
  const today = appToday(new Date());
  const [sales, stock, alerts, receipts, batches, todaySales, lines] = await Promise.all([
    getTodaySales(supabase, today),
    getStockValue(supabase),
    listOpenAlerts(supabase),
    listTodayReceipts(supabase, today),
    listTodayBatches(supabase, today),
    listTodaySales(supabase, today),
    listStockOnHand(supabase),
  ]);

  // In place of the list: the failed watch's line, or the empty line.
  const notice = watch.status === "failed" ? WATCH_FAILED : alerts.length === 0 ? NO_OPEN_ALERTS : null;

  return (
    <PageShell title="Today" current="today" fullWidth>
      <div className="space-y-6">
        <SalesAndStockValue sales={sales} stock={stock} />
        <OpenAlerts titles={alerts.map((alert) => alertText(alert.view).title)} notice={notice} />
        <div className="@container/today">
          <div className="grid items-start gap-6 today-pair:grid-cols-[minmax(0,1fr)_22rem]">
            <TodaysEntries receipts={receipts} batches={batches} sales={todaySales} />
            <StockOnHand lines={lines} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
