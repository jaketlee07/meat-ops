import { redirect } from "next/navigation";
import { isOperator } from "../../lib/rpc";
import { getMenu } from "../../lib/views";
import { createSessionClient } from "../_server/session";
import { NotAllowed } from "../not-allowed";
import { PageHeader } from "../page-header";
import { MenuList } from "./menu-list";

// Every page settles who is asking. The proxy only refreshes the session.
export default async function MenuPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // Only a failed answer throws, which the error boundary shows. A signed-in
  // user who is not on the allowlist gets the not-allowed page.
  if (!(await isOperator(supabase))) return <NotAllowed />;

  const menu = await getMenu(supabase);
  const items = menu.map((item) => ({
    id: item.product_id ?? "",
    code: item.code ?? "",
    description: item.description ?? "",
    listPrice: item.list_price_per_lb,
    finishedLbs: item.finished_lbs_available ?? 0,
    rawLbs: item.raw_lbs_available ?? 0,
    sellable: item.sellable === true,
  }));

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <PageHeader title="Menu" current="menu" />
      <MenuList items={items} />
    </main>
  );
}
