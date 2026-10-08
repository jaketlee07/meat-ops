import { test as setup } from "@playwright/test";
import { NON_OPERATOR_EMAIL, OPERATOR_EMAIL } from "../users";
import { NON_OPERATOR_STATE, OPERATOR_STATE, signInThroughForm } from "./states";

setup("sign in as the operator", async ({ page }) => {
  await signInThroughForm(page, OPERATOR_EMAIL);
  await page.context().storageState({ path: OPERATOR_STATE });
});

setup("sign in as the non-operator", async ({ page }) => {
  await signInThroughForm(page, NON_OPERATOR_EMAIL);
  await page.context().storageState({ path: NON_OPERATOR_STATE });
});
