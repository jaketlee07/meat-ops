import { redirect } from "next/navigation";
import { getReversalPreview, listActiveFinishedProducts, listRecentBatches } from "../../lib/production";
import { getStock } from "../../lib/receiving";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { FORM_COLUMN_GRID } from "../form-column-grid";
import { PageShell } from "../page-header";
import { ProductionForm } from "./production-form";
import { ProductRegion } from "./product-region";

// The form-column grid (see form-column-grid.ts) with four rows: the form spans the two middle rows beside the
// stock card and Recent batches, and the result sits in the last row, which takes whatever height the long
// list has left, so the result starts right under the form at any list length. #product-region is
// display: contents, so the stock card and Recent batches are grid items. The DOM order stays form, check
// step, result, region.
const MAIN_GRID = `${FORM_COLUMN_GRID} desk:grid-rows-[auto_auto_auto_1fr] desk:[grid-template-areas:'head_head'_'form_stock'_'form_recent'_'result_recent']`;

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
