import { redirect } from "next/navigation";
import { isOperator } from "../../lib/rpc";
import { listCustomers, listRecentSales, listSaleProducts } from "../../lib/sales";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";
import { RecentSales } from "./recent-sales";
import { SaleForm } from "./sale-form";
import { VoidedSalesProvider } from "./voided-sales";

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
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Sales" current="sales" />
      <VoidedSalesProvider>
        <SaleForm products={products} customers={customers} />
        <div className="mt-8">
          <RecentSales {...recent} />
        </div>
      </VoidedSalesProvider>
    </main>
  );
}
