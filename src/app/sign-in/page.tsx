import { LoneCard } from "../lone-card";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <LoneCard>
      <h1 className="text-title font-bold">Sign in</h1>
      <SignInForm />
    </LoneCard>
  );
}
