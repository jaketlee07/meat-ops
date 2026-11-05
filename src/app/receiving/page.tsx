import { redirect } from "next/navigation";
import {
  getStock,
  listActiveRawProducts,
  listFinishedPrices,
  listRecentReceipts,
  listVendors,
} from "../../lib/receiving";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageShell } from "../page-header";
import { ProductRegion } from "./product-region";
import { ReceiptForm } from "./receipt-form";

// From desk up, <main> is a grid: the shell's title-and-banner div across the top, the
// form and the result in the 340 px left column, and the stock card and Recent receipts in
// the right one (#product-region is display: contents, so its two sections are grid items).
// The DOM order, and so Tab order, stays form, result, region. Each child names its area.
const MAIN_GRID =
  "desk:grid desk:grid-cols-[340px_minmax(0,1fr)] desk:grid-rows-[auto_auto_1fr_auto] desk:items-start desk:gap-x-4 desk:[grid-template-areas:'head_head'_'form_stock'_'form_recent'_'result_recent'] desk:[&>div:first-child]:[grid-area:head]";

// Every page settles who is asking. The proxy only refreshes the session.
// The chosen product lives in the URL (?product=<code>), so the server renders
// that product's stock and receipts and the form keeps its typed values in the browser.
export default async function ReceivingPage({
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

  const [products, vendors, query] = await Promise.all([
    listActiveRawProducts(supabase),
    listVendors(supabase),
    searchParams,
  ]);
  const requested = typeof query.product === "string" ? query.product : "";
  const selected = products.find((product) => product.code === requested);

  let region = null;
  let voidedLots: string[] = [];
  let correctedLots: string[] = [];
  if (selected) {
    const [stock, prices, recent] = await Promise.all([
      getStock(supabase, selected.id),
      listFinishedPrices(supabase, selected.id),
      listRecentReceipts(supabase, selected.id),
    ]);
    region = <ProductRegion stock={stock} prices={prices} recent={recent} />;
    voidedLots = recent.receipts
      .filter((receipt) => receipt.status === "void")
      .map((receipt) => receipt.lotNumber);
    correctedLots = recent.receipts
      .filter((receipt) => receipt.correctedReason !== null)
      .map((receipt) => receipt.lotNumber);
  }

  return (
    <PageShell title="Receiving" current="receiving" fullWidth mainClassName={MAIN_GRID}>
      <ReceiptForm
        products={products.map(({ code, description, species }) => ({ code, description, species }))}
        vendors={vendors}
        urlCode={requested}
        regionCode={selected?.code ?? null}
        region={region}
        voidedLots={voidedLots}
        correctedLots={correctedLots}
      />
    </PageShell>
  );
}
