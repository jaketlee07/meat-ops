import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import { TEST_PASSWORD } from "../users";

// Where the setup project saves each role's signed-in session. The directory is
// gitignored. Specs reuse these with test.use({ storageState }), so only the
// sign-in criteria sign in through the form again.
export const OPERATOR_STATE = fileURLToPath(new URL("./.auth/operator.json", import.meta.url));
export const NON_OPERATOR_STATE = fileURLToPath(new URL("./.auth/non-operator.json", import.meta.url));

// Fills the sign-in form and presses Sign in. It does not wait for the outcome.
export async function submitSignIn(page: Page, email: string, password = TEST_PASSWORD): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

// Signs in through the form and waits until the receiving page has loaded.
export async function signInThroughForm(page: Page, email: string): Promise<void> {
  await submitSignIn(page, email);
  await page.waitForURL("**/receiving");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
