import { redirect } from "next/navigation";
import { getReversalPreview, listActiveFinishedProducts, listRecentBatches } from "../../lib/production";
import { getStock } from "../../lib/receiving";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageShell } from "../page-header";
import { ProductionForm } from "./production-form";
import { ProductRegion } from "./product-region";

// From desk up, <main> is a grid, laid out as on Receiving: the shell's title-and-banner div across the
// top, the form and the result in the left column (340 px, 280 px from wide up), and the stock card and
// Recent batches in the right one (#product-region is display: contents, so its two sections are grid
// items). The DOM order, and so Tab order, stays form, check step, result, region. Each child names its area.
const MAIN_GRID =
  "desk:grid desk:grid-cols-[340px_minmax(0,1fr)] wide:grid-cols-[280px_minmax(0,1fr)] desk:grid-rows-[auto_auto_1fr_auto] desk:items-start desk:gap-x-4 desk:[grid-template-areas:'head_head'_'form_stock'_'form_recent'_'result_recent'] desk:[&>div:first-child]:[grid-area:head]";

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
  let reversedBatches: string[] = [];
  if (selected) {
    const [stock, recent] = await Promise.all([
      selected.raw ? getStock(supabase, selected.raw.id) : null,
      listRecentBatches(supabase, selected.id),
    ]);
    // What each batch that is not reversed would do, for its Reverse confirmation.
    const open = recent.batches.filter((batch) => batch.reversedAt === null);
    const previews = Object.fromEntries(
      await Promise.all(
        open.map(async (batch) => {
          const { lots, sales } = await getReversalPreview(supabase, batch.id);
          return [batch.id, { lots, sales }] as const;
        }),
      ),
    );
    region = <ProductRegion product={selected} stock={stock} recent={recent} previews={previews} />;
    reversedBatches = recent.batches.filter((batch) => batch.reversedAt !== null).map((batch) => batch.batchNumber);
  }

  return (
    <PageShell title="Production" current="production" fullWidth mainClassName={MAIN_GRID}>
      <ProductionForm
        products={products.map(({ code, description, shrinkPct }) => ({ code, description, shrinkPct }))}
        urlCode={requested}
        regionCode={selected?.code ?? null}
        region={region}
        reversedBatches={reversedBatches}
      />
    </PageShell>
  );
}
