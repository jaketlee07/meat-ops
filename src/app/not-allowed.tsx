import { NOT_ALLOWED } from "../lib/failures";
import { signOut } from "./sign-in/actions";

// Shown to a signed-in user who is not on the operator allowlist.
export function NotAllowed() {
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
