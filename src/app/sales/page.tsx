import { redirect } from "next/navigation";
import { isOperator } from "../../lib/rpc";
import { listCustomers, listRecentSales, listSaleProducts } from "../../lib/sales";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { FORM_COLUMN_GRID } from "../form-column-grid";
import { PageShell } from "../page-header";
import { orderRecentSales } from "./recent-order";
import { RecentSales } from "./recent-sales";
import { SaleForm } from "./sale-form";
import { VoidedSalesProvider } from "./voided-sales";

// The form-column grid (see form-column-grid.ts) with three rows: the form and then the result in the left
// column, Recent sales spanning both beside them. The result's row takes the list's extra height and the
// result starts at its top. The DOM order stays form, result, Recent sales.
const MAIN_GRID = `${FORM_COLUMN_GRID} desk:grid-rows-[auto_auto_1fr] desk:[grid-template-areas:'head_head'_'form_recent'_'result_recent']`;

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
        <RecentSales sales={orderRecentSales(recent.sales)} total={recent.total} />
      </VoidedSalesProvider>
    </PageShell>
  );
}
