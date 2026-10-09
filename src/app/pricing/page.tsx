import { redirect } from "next/navigation";
import { getPricingDetail, listPricing, listWhatIfRawProducts, runWhatIf, type WhatIfRow } from "../../lib/pricing";
import { parseWhatIf } from "../../lib/price-input";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";
import { PricingDetail } from "./pricing-detail";
import { PricingList } from "./pricing-list";
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
    const detail = await getPricingDetail(supabase, productCode);
    return (
      <main className="mx-auto w-full max-w-xl p-4">
        <PageHeader title="Pricing" current="pricing" />
        {detail ? (
          <PricingDetail key={detail.productId} detail={detail} />
        ) : (
          <p className="break-words text-base">{`No active finished product has code ${productCode}.`}</p>
        )}
      </main>
    );
  }

  const [rows, rawProducts] = await Promise.all([listPricing(supabase), listWhatIfRawProducts(supabase)]);

  if (rows.length === 0) {
    return (
      <main className="mx-auto w-full max-w-xl p-4">
        <PageHeader title="Pricing" current="pricing" />
        <p className="text-base">{NONE}</p>
      </main>
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
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Pricing" current="pricing" />
      <PricingList rows={rows} />
      <section aria-labelledby="what-if-heading" className="mt-8">
        <h2 id="what-if-heading" className="mb-3 text-xl font-semibold">
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
    </main>
  );
}
