import { LoneCard } from "../lone-card";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <LoneCard>
      <h1 className="text-[22px] font-bold">Sign in</h1>
      <SignInForm />
    </LoneCard>
  );
}
