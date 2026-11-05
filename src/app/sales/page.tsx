import { redirect } from "next/navigation";
import { isOperator } from "../../lib/rpc";
import { listCustomers, listRecentSales, listSaleProducts } from "../../lib/sales";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageShell } from "../page-header";
import { RecentSales } from "./recent-sales";
import { SaleForm } from "./sale-form";
import { VoidedSalesProvider } from "./voided-sales";

// From desk up, <main> is a grid, laid out as on Production: the shell's title-and-banner div across the
// top, the form and the result in the left column (340 px, 280 px from wide up), and Recent sales in the
// right one. The DOM order, and so Tab order, stays form, result, Recent sales. Each child names its area.
const MAIN_GRID =
  "desk:grid desk:grid-cols-[340px_minmax(0,1fr)] wide:grid-cols-[280px_minmax(0,1fr)] desk:grid-rows-[auto_auto_1fr] desk:items-start desk:gap-x-4 desk:[grid-template-areas:'head_head'_'form_recent'_'result_recent'] desk:[&>div:first-child]:[grid-area:head]";

// Every page settles who is asking. The proxy only refreshes the session.
// /sales?product=<code> renders the same page: the form asks for it to get a
// fresh product list when a typed code is missing from the one it has.
export default async function SalesPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // Only a failed answer throws, which the error boundary shows. A signed-in
  // user who is not on the allowlist gets the not-allowed page.
  if (!(await isOperator(supabase))) return <NotAllowed />;

  const [products, customers, recent] = await Promise.all([
    listSaleProducts(supabase),
    listCustomers(supabase),
    listRecentSales(supabase),
  ]);

  return (
    <PageShell title="Sales" current="sales" fullWidth mainClassName={MAIN_GRID}>
      <VoidedSalesProvider>
        <SaleForm products={products} customers={customers} />
        <RecentSales {...recent} />
      </VoidedSalesProvider>
    </PageShell>
  );
}
