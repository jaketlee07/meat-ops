import { redirect } from "next/navigation";
import { getPricingDetail, listPricing, listWhatIfRawProducts, runWhatIf, type WhatIfRow } from "../../lib/pricing";
import { parseWhatIf } from "../../lib/price-input";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageShell } from "../page-header";
import { PricingDetail } from "./pricing-detail";
import { PricingList, ProductTiles } from "./pricing-list";
import { WhatIfForm } from "./what-if-form";
import { WhatIfResults } from "./what-if-results";

const NONE = "No active finished products yet. Add one in Supabase Studio, then reload this page.";

function textParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Every page settles who is asking. The proxy only refreshes the session.
// The what-if lives in the URL (?raw=<code>&cost=<text>), so a result reloads as shown.
export default async function PricingPage({
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

  const query = await searchParams;

  // A product's detail is /pricing?product=<code>. A code that is not an active
  // finished product's is shown back as plain text, never as markup.
  const productCode = textParam(query.product);
  if (productCode !== undefined) {
    // Both reads start together, so the list does not wait on the details.
    const [detail, rows] = await Promise.all([getPricingDetail(supabase, productCode), listPricing(supabase)]);
    if (!detail) {
      return (
        <PageShell title="Pricing" current="pricing" fullWidth>
          <p className="break-words text-base">{`No active finished product has code ${productCode}.`}</p>
        </PageShell>
      );
    }
    // The panel comes first in the page, so Tab reaches its controls before the list's
    // links. From desk up the grid puts the list on the left and the panel on the right;
    // under desk the tiles and the list are hidden and the details show alone.
    return (
      <PageShell title="Pricing" current="pricing" fullWidth>
        <div className="hidden desk:block">
          <ProductTiles rows={rows} />
        </div>
        <div className="desk:grid desk:grid-cols-[minmax(0,1fr)_360px] desk:items-start desk:gap-4">
          <section
            aria-label="Product details"
            className="rounded-card border border-card-border bg-surface p-4 desk:col-start-2 desk:row-start-1"
          >
            <PricingDetail key={detail.productId} detail={detail} />
          </section>
          <div className="hidden min-w-0 desk:col-start-1 desk:row-start-1 desk:block">
            <PricingList rows={rows} openCode={detail.code} />
          </div>
        </div>
      </PageShell>
    );
  }

  const [rows, rawProducts] = await Promise.all([listPricing(supabase), listWhatIfRawProducts(supabase)]);

  if (rows.length === 0) {
    return (
      <PageShell title="Pricing" current="pricing" fullWidth>
        <p className="text-base">{NONE}</p>
      </PageShell>
    );
  }

  // A what-if is asked for when either part is in the URL.
  const raw = textParam(query.raw);
  const cost = textParam(query.cost);
  const asked = raw !== undefined || cost !== undefined;
  const parsed = asked ? parseWhatIf({ rawCode: raw ?? "", cost: cost ?? "" }) : null;

  let results = null;
  if (parsed?.ok) {
    const rawProduct = rawProducts.find((product) => product.code === parsed.value.rawCode);
    const whatIf: WhatIfRow[] | null = rawProduct
      ? await runWhatIf(supabase, rawProduct.id, parsed.value.cost)
      : null;
    results = <WhatIfResults rawCode={parsed.value.rawCode} rows={whatIf} />;
  }

  return (
    <PageShell title="Pricing" current="pricing" fullWidth>
      <ProductTiles rows={rows} />
      <PricingList rows={rows} />
      <section
        aria-labelledby="what-if-heading"
        className="mt-6 rounded-card border border-card-border bg-surface p-3.5 desk:p-4"
      >
        <h2 id="what-if-heading" className="mb-3 text-lg font-bold">
          What if raw cost changes?
        </h2>
        <WhatIfForm
          rawProducts={rawProducts.map(({ code, description }) => ({ code, description }))}
          rawCode={raw ?? ""}
          cost={cost ?? ""}
          urlErrors={parsed && !parsed.ok ? parsed.errors : {}}
        />
        {/* The container is on every render, empty until a what-if is asked, so new results are announced. */}
        <div role="status">{results}</div>
      </section>
    </PageShell>
  );
}
