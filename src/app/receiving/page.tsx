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
import { FORM_COLUMN_GRID } from "../form-column-grid";
import { PageShell } from "../page-header";
import { ProductRegion } from "./product-region";
import { ReceiptForm } from "./receipt-form";

// The form-column grid (see form-column-grid.ts) with four rows, laid out as on Production: the form spans
// the two middle rows beside the stock card and Recent receipts, and the result sits in the last row, which
// takes whatever height a long list has left. The result starts right under the form while the form is
// taller than the "Stock and prices" card, which holds up to about six finished products per raw product at
// the default text size; with more, the result starts under that card (the owner accepted this on
// 2026-11-05). #product-region is
// display: contents, so its two sections are grid items. The DOM order stays form, result, region.
const MAIN_GRID = `${FORM_COLUMN_GRID} desk:grid-rows-[auto_auto_auto_1fr] desk:[grid-template-areas:'head_head'_'form_stock'_'form_recent'_'result_recent']`;

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
