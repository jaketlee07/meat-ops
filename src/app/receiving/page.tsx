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
import { signOut } from "../sign-in/actions";
import { ProductRegion } from "./product-region";
import { NOT_ALLOWED } from "./refusal";
import { ReceiptForm } from "./receipt-form";

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
  if (selected) {
    const [stock, prices, recent] = await Promise.all([
      getStock(supabase, selected.id),
      listFinishedPrices(supabase, selected.id),
      listRecentReceipts(supabase, selected.id),
    ]);
    region = <ProductRegion stock={stock} prices={prices} recent={recent} />;
  }

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Receiving</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-field-border bg-surface px-4 text-base font-medium text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
      <ReceiptForm
        products={products.map(({ code, description, species }) => ({ code, description, species }))}
        vendors={vendors}
        initialCode={requested}
        regionCode={selected?.code ?? null}
        region={region}
      />
    </main>
  );
}

function NotAllowed() {
  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 className="mb-4 text-2xl font-semibold">Not allowed</h1>
      <p className="mb-6 text-base">{NOT_ALLOWED}</p>
      <form action={signOut}>
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
