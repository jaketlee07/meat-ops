import { redirect } from "next/navigation";
import { listActiveFinishedProducts, listRecentBatches } from "../../lib/production";
import { getStock } from "../../lib/receiving";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";
import { ProductionForm } from "./production-form";
import { ProductRegion } from "./product-region";

// Every page settles who is asking. The proxy only refreshes the session.
// The chosen product lives in the URL (?product=<code>), so the server renders
// that product's raw stock and the form keeps its typed values in the browser.
export default async function ProductionPage({
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

  const [products, query] = await Promise.all([listActiveFinishedProducts(supabase), searchParams]);
  const requested = typeof query.product === "string" ? query.product : "";
  const selected = products.find((product) => product.code === requested);

  let region = null;
  if (selected) {
    const [stock, recent] = await Promise.all([
      selected.raw ? getStock(supabase, selected.raw.id) : null,
      listRecentBatches(supabase, selected.id),
    ]);
    region = <ProductRegion product={selected} stock={stock} recent={recent} />;
  }

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Production" current="production" />
      <ProductionForm
        products={products.map(({ code, description, shrinkPct }) => ({ code, description, shrinkPct }))}
        urlCode={requested}
        regionCode={selected?.code ?? null}
        region={region}
      />
    </main>
  );
}
