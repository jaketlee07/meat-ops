import { NOT_ALLOWED } from "../lib/failures";
import { LoneCard } from "./lone-card";
import { signOut } from "./sign-in/actions";

// Shown to a signed-in user who is not on the operator allowlist.
export function NotAllowed() {
  return (
    <LoneCard>
      <h1 className="text-[22px] font-bold">Not allowed</h1>
      <p className="text-base text-ink-secondary">{NOT_ALLOWED}</p>
      <form action={signOut} className="flex flex-col">
        <button type="submit" className="h-12 w-full rounded-xl bg-primary px-4 text-base font-bold text-on-primary">
          Sign out
        </button>
      </form>
    </LoneCard>
  );
}
