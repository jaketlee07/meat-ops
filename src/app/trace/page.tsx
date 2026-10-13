import { redirect } from "next/navigation";
import { parseLotFinder, parseSaleNumber } from "../../lib/sale-input";
import { isOperator } from "../../lib/rpc";
import { findLots, getLotTrace, getSaleTrace } from "../../lib/trace";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";
import { FindForms } from "./find-forms";
import { LotList } from "./lot-list";
import { LotTraceView } from "./lot-trace";
import { SaleTraceView } from "./sale-trace";

function textParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Every page settles who is asking. The proxy only refreshes the session.
// The lookup lives in the URL, so a result reloads as shown: ?sale=<number>,
// ?lot=<number>, or ?raw=<code>&received=<date>. When several are named, the
// sale wins, then the lot, then the raw code. This page only reads.
export default async function TracePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");
  if (!(await isOperator(supabase))) return <NotAllowed />;

  const query = await searchParams;
  const sale = textParam(query.sale);
  const lot = textParam(query.lot);
  const raw = textParam(query.raw);
  const received = textParam(query.received);

  let saleError: string | undefined;
  let lotErrors: { rawCode?: string; received?: string } = {};
  let result = null;

  if (sale !== undefined) {
    const parsed = parseSaleNumber(sale);
    if (!parsed.ok) {
      saleError = parsed.error;
    } else {
      result = <SaleTraceView number={parsed.value} trace={await getSaleTrace(supabase, parsed.value)} />;
    }
  } else if (lot !== undefined) {
    const number = lot.trim();
    result = <LotTraceView number={number} trace={await getLotTrace(supabase, number)} />;
  } else if (raw !== undefined || received !== undefined) {
    const parsed = parseLotFinder({ rawCode: raw ?? "", received: received ?? "" });
    if (!parsed.ok) {
      lotErrors = parsed.errors;
    } else {
      const { rawCode, received: date } = parsed.value;
      result = <LotList code={rawCode} received={date} found={await findLots(supabase, rawCode, date)} />;
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Trace" current="trace" />
      <FindForms
        sale={sale ?? ""}
        saleError={saleError}
        rawCode={raw ?? ""}
        received={received ?? ""}
        lotErrors={lotErrors}
      />
      {/* No live region: a trace can list over 1,000 sales. Show sale and Show lots move focus to the result's heading instead. */}
      <div className="mt-8">{result}</div>
    </main>
  );
}
