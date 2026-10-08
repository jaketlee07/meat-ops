import { redirect } from "next/navigation";
import { isOperator } from "../../lib/rpc";
import { createSessionClient } from "../_server/session";
import { signOut } from "../sign-in/actions";

// Every page settles who is asking. The proxy only refreshes the session.
export default async function ReceivingPage() {
  const supabase = await createSessionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/sign-in");

  // Only a failed answer throws, which the error boundary shows. A signed-in
  // user who is not on the allowlist gets the not-allowed page.
  if (!(await isOperator(supabase))) return <NotAllowed />;

  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 className="text-2xl font-semibold">Receiving</h1>
    </main>
  );
}

function NotAllowed() {
  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 className="mb-4 text-2xl font-semibold">Not allowed</h1>
      <p className="mb-6 text-base">This account isn&apos;t allowed to use Meat Ops.</p>
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
