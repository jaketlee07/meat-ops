import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-4">
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      <SignInForm />
    </main>
  );
}
