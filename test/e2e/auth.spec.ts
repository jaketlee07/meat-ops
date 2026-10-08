import { expect, test, type Cookie, type Page } from "@playwright/test";
import { resolveStackEnv } from "../env";
import { createTypedClient } from "../../src/lib/supabase";
import { NON_OPERATOR_EMAIL, OPERATOR_EMAIL, TEST_PASSWORD } from "../users";
import { checkPageState } from "./a11y";
import { isAuthCookie, readSession, withExpiredAccessToken } from "./session";
import { NON_OPERATOR_STATE, signInThroughForm, submitSignIn } from "./states";

const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";

// What Tab reaches on the sign-in page, in order.
const SIGN_IN_CONTROLS = ["input #email", "input #password", "button Sign in"];

async function authCookies(page: Page): Promise<Cookie[]> {
  return (await page.context().cookies()).filter(isAuthCookie);
}

// Posts a refresh token to the auth server's refresh-token grant, the call a
// browser or an attacker would make to get a new session from an old token.
async function refreshGrant(refreshToken: string): Promise<{ status: number; body: { error_code?: string } }> {
  const stack = resolveStackEnv();
  const response = await fetch(`${stack.apiUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: stack.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return { status: response.status, body: (await response.json()) as { error_code?: string } };
}

test.describe("signed out", () => {
  test("AC-0001: / and /receiving end on /sign-in, which shows the sign-in form", async ({ page }) => {
    for (const path of ["/", "/receiving"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in$/);
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    }
  });

  test("the sign-in state meets the page-state checks", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
    expect(await checkPageState(page)).toEqual(SIGN_IN_CONTROLS);
  });

  test("AC-0003: a wrong password stays on /sign-in with a message", async ({ page }) => {
    await submitSignIn(page, OPERATOR_EMAIL, "not-the-password");
    const message = page.getByText("Email or password is incorrect.");
    await expect(message).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
    // The message is announced and holds focus, and the typed email stays.
    await expect(page.locator("#sign-in-error")).toBeFocused();
    await expect(page.getByLabel("Email")).toHaveValue(OPERATOR_EMAIL);
    await expect(page.getByLabel("Password")).toHaveValue("");
    expect(await checkPageState(page)).toEqual(SIGN_IN_CONTROLS);
  });

  test("AC-0041: a wrong password leaves no Supabase auth cookie", async ({ page }) => {
    await submitSignIn(page, OPERATOR_EMAIL, "not-the-password");
    await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
    expect(await authCookies(page)).toEqual([]);
  });

  test("AC-0006: auth cookies are HttpOnly and SameSite=Lax at sign-in and after a refresh", async ({ page }) => {
    await signInThroughForm(page, OPERATOR_EMAIL);
    const atSignIn = await authCookies(page);
    expect(atSignIn.length, "the session cookie exists after sign-in").toBeGreaterThan(0);
    for (const cookie of atSignIn) {
      expect(cookie, cookie.name).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    }

    // Expire the stored access token, then make one request through the proxy.
    const before = readSession(atSignIn);
    await page.context().addCookies(withExpiredAccessToken(atSignIn));
    await page.goto("/receiving");
    await expect(page.getByRole("heading", { level: 1, name: "Receiving" })).toBeVisible();

    const afterRefresh = await authCookies(page);
    expect(afterRefresh.length, "the session cookie exists after the refresh").toBeGreaterThan(0);
    for (const cookie of afterRefresh) {
      expect(cookie, cookie.name).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    }
    // The proxy really refreshed it: a new access window and a new refresh token.
    const after = readSession(afterRefresh);
    expect(after.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(after.refresh_token).not.toBe(before.refresh_token);
  });
});

test.describe("signed in as a non-operator", () => {
  test.use({ storageState: NON_OPERATOR_STATE });

  test("AC-0004: /receiving shows the not-allowed message and a Sign out button", async ({ page }) => {
    await page.goto("/receiving");
    await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(await checkPageState(page)).toEqual(["button Sign out"]);
  });
});

test.describe("sign out", () => {
  test("AC-0005 and AC-0061: Sign out ends on /sign-in and revokes the refresh token", async ({ page }) => {
    await signInThroughForm(page, NON_OPERATOR_EMAIL);
    await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
    const heldBefore = readSession(await authCookies(page)).refresh_token;

    // Control: the same grant accepts a live refresh token, so a refusal below
    // comes from the sign-out and not from a malformed request.
    const control = createTypedClient(resolveStackEnv().apiUrl, resolveStackEnv().anonKey);
    const { data, error } = await control.auth.signInWithPassword({
      email: NON_OPERATOR_EMAIL,
      password: TEST_PASSWORD,
    });
    expect(error).toBeNull();
    expect((await refreshGrant(data.session?.refresh_token ?? "")).status).toBe(200);

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(await authCookies(page)).toEqual([]);

    // AC-0005: the next request for /receiving ends on /sign-in.
    await page.goto("/receiving");
    await expect(page).toHaveURL(/\/sign-in$/);

    // AC-0061: the auth server refuses the token the browser held.
    const refused = await refreshGrant(heldBefore);
    expect(refused.status).toBe(400);
    expect(refused.body.error_code).toBe("refresh_token_not_found");
  });
});
