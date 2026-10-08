import { connect } from "node:net";
import { request as httpRequest } from "node:http";
import { expect, test, type Cookie, type Page, type Request } from "@playwright/test";
import { resolveStackEnv } from "../env";
import { createTypedClient } from "../../src/lib/supabase";
import { NON_OPERATOR_EMAIL, OPERATOR_EMAIL, TEST_PASSWORD } from "../users";
import { query, resetTestData } from "../db";
import { checkPageState } from "./a11y";
import {
  fillReceipt,
  lotCount,
  lotNumberOf,
  NOT_ALLOWED,
  openForm,
  RAW_TOM_URL,
  receiptItem,
  RECEIVING_FORM,
  seedReceipt,
  SIGNED_OUT,
  VOID_SIGNED_OUT,
  voidMarks,
  voidThrough,
} from "./receiving-page";
import { isAuthCookie, readSession, withExpiredAccessToken } from "./session";
import { NON_OPERATOR_STATE, OPERATOR_STATE, signInThroughForm, submitSignIn } from "./states";

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

  test("AC-0002 and AC-0006: sign-in ends on the receiving form, with HttpOnly SameSite=Lax cookies", async ({ page }) => {
    await signInThroughForm(page, OPERATOR_EMAIL);
    // AC-0002: signing in ends on /receiving with the receiving form shown.
    await expect(page).toHaveURL(/\/receiving$/);
    await expect(page.getByRole("form", { name: RECEIVING_FORM })).toBeVisible();
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
    // AC-0004: and no receiving form.
    await expect(page.getByRole("form", { name: RECEIVING_FORM })).toHaveCount(0);
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

test.describe("a replayed save request", () => {
  test.use({ storageState: OPERATOR_STATE });

  test("AC-0044 and AC-0066: with no session or a non-operator's, it writes no lot and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await resetTestData();

    // Capture the request a real save sends. This save is the one lot expected.
    const f = await openForm(page, "/receiving?product=RAW-TOM");
    await fillReceipt(f, {});
    const captured = page.waitForRequest(
      (request) => request.method() === "POST" && "next-action" in request.headers(),
    );
    await f.save.click();
    const saveRequest = await captured;
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeFocused();
    expect(await lotCount()).toBe(1);

    // Send it again with no cookie of the operator's. Playwright sets the length
    // and host itself.
    const headers = await saveRequest.allHeaders();
    for (const name of ["cookie", "content-length", "host"]) delete headers[name];
    const body = saveRequest.postDataBuffer();

    const replays = [
      { who: "no session", storageState: undefined, message: SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: NOT_ALLOWED },
    ];
    for (const { who, storageState, message } of replays) {
      const replay = await playwright.request.newContext({ baseURL, storageState });
      try {
        const response = await replay.post(saveRequest.url(), { headers, data: body });
        expect(await response.text(), `response for ${who}`).toContain(message);
      } finally {
        await replay.dispose();
      }
      expect(await lotCount(), `lots after ${who}`).toBe(1);
    }
  });
});

test.describe("a replayed void request", () => {
  test.use({ storageState: OPERATOR_STATE });

  test("AC-0044 and AC-0066: with no session or a non-operator's, it voids nothing and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    await resetTestData();
    const lotNumber = await lotNumberOf(await seedReceipt(1000, 1.68));
    await openForm(page, RAW_TOM_URL);

    // Capture the request a real void sends and stop it before the server sees
    // it, so the lot is still untouched when the copies arrive.
    let captured: Request | undefined;
    await page.route("**/receiving**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) {
        captured = request;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await voidThrough(page, receiptItem(page, lotNumber), "keyed twice");
    await expect.poll(() => captured).toBeDefined();
    if (!captured) throw new Error("no void request was captured");
    expect(await voidMarks(), "voids after the captured request was stopped").toBe(0);

    // Send it again with no cookie of the operator's. Playwright sets the length
    // and host itself.
    const headers = captured.headers();
    for (const name of ["cookie", "content-length", "host"]) delete headers[name];
    const body = captured.postDataBuffer();

    const replays = [
      { who: "no session", storageState: undefined, message: VOID_SIGNED_OUT },
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: NOT_ALLOWED },
    ];
    for (const { who, storageState, message } of replays) {
      const replay = await playwright.request.newContext({ baseURL, storageState });
      try {
        const response = await replay.post(captured.url(), { headers, data: body });
        expect(await response.text(), `response for ${who}`).toContain(message);
      } finally {
        await replay.dispose();
      }
      expect(await voidMarks(), `voids after ${who}`).toBe(0);
    }

    const operator = await playwright.request.newContext({ baseURL, storageState: OPERATOR_STATE });
    try {
      // Every argument is caller input: the action runs the reason rule itself,
      // and the engine refuses a lot id that is not a lot. The body is the
      // bound lot id and the reason.
      const [lotId, reason] = JSON.parse(captured.postData() ?? "[]") as [string, string];
      expect([typeof lotId, reason]).toEqual(["string", "keyed twice"]);
      const tampered = [
        { what: "a blank reason", args: [lotId, "   "], message: "Enter a reason for the void." },
        { what: "an unknown lot", args: ["00000000-0000-0000-0000-000000000000", reason], message: "not found" },
      ];
      for (const { what, args, message } of tampered) {
        const response = await operator.post(captured.url(), { headers, data: JSON.stringify(args) });
        expect(await response.text(), `response for ${what}`).toContain(message);
        expect(await voidMarks(), `voids after ${what}`).toBe(0);
      }

      // Control: the request as captured, from the operator's session, does void
      // the lot, so the refusals above came from who sent it and what it said,
      // and not from a bad copy.
      await operator.post(captured.url(), { headers, data: body });
    } finally {
      await operator.dispose();
    }
    expect(await voidMarks(), "voids after the operator's own copy").toBe(1);
  });
});

// A request sent straight to the test server, so the test picks every header,
// including a Host the browser would never send.
interface RawReply {
  status: number;
  body: string;
}

function rawRequest(
  base: URL,
  path: string,
  { method = "GET", headers = {}, body, setHost = true }: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer;
    setHost?: boolean;
  } = {},
): Promise<RawReply> {
  return new Promise((resolve, reject) => {
    const sent = httpRequest(
      { hostname: base.hostname, port: base.port, path, method, headers, setHost, agent: false, timeout: 10_000 },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("error", reject);
        response.on("end", () =>
          resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }),
        );
      },
    );
    sent.on("timeout", () => sent.destroy(new Error(`no answer for ${method} ${path}`)));
    sent.on("error", reject);
    sent.end(body);
  });
}

// An HTTP/1.0 request with no Host header, written to a raw socket. Node's
// client cannot send one, and the server keeps no connection open for it.
function rawHttp10(base: URL, path: string): Promise<RawReply> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: base.hostname, port: Number(base.port), timeout: 10_000 });
    const chunks: Buffer[] = [];
    socket.on("connect", () => socket.write(`GET ${path} HTTP/1.0\r\n\r\n`));
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("timeout", () => socket.destroy(new Error(`no answer for HTTP/1.0 ${path}`)));
    socket.on("error", reject);
    socket.on("close", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      const split = text.indexOf("\r\n\r\n");
      const status = Number(/^HTTP\/1\.[01] (\d{3})/.exec(text)?.[1] ?? 0);
      resolve({ status, body: split === -1 ? "" : text.slice(split + 4) });
    });
  });
}

const FOREIGN_HOST = "rebind.example:3100";
const MISDIRECTED = "Misdirected request.";

async function operatorSessionCount(): Promise<number> {
  const rows = await query<{ n: number }>(
    "select count(*)::int as n from auth.sessions s join auth.users u on u.id = s.user_id where u.email = $1",
    [OPERATOR_EMAIL],
  );
  const [row] = rows;
  if (!row) throw new Error("the session count returned no row");
  return row.n;
}

test.describe("a request with a foreign or missing Host", () => {
  const PATHS = ["/", "/sign-in", "/_next/static/x.js", "/_next/image", "/favicon.ico"];

  test("AC-0069: a Host other than 127.0.0.1 or localhost is refused for every path", async ({ baseURL }) => {
    const base = new URL(baseURL ?? "");
    for (const path of PATHS) {
      const reply = await rawRequest(base, path, { headers: { host: FOREIGN_HOST } });
      expect(reply, `reply for ${path}`).toEqual({ status: 421, body: MISDIRECTED });
    }
  });

  test("AC-0069: a request with no Host is refused, and no page renders", async ({ baseURL }) => {
    const base = new URL(baseURL ?? "");
    // Node's own server answers an HTTP/1.1 request with no Host before any handler runs.
    const http11 = await rawRequest(base, "/sign-in", { setHost: false });
    expect(http11.status).toBe(400);
    expect(http11.body).not.toContain("Sign in");

    // An HTTP/1.0 request with no Host reaches the app, and its proxy refuses it.
    const http10 = await rawHttp10(base, "/sign-in");
    expect(http10).toEqual({ status: 421, body: MISDIRECTED });
  });

  test("AC-0069: a sign-in action posted with a foreign Host creates no session", async ({ page, baseURL }) => {
    const base = new URL(baseURL ?? "");

    // Capture the request the sign-in form sends and stop it before the server
    // sees it, so the capture spends no sign-in.
    let captured: Request | undefined;
    await page.route("**/sign-in", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) {
        captured = request;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await submitSignIn(page, OPERATOR_EMAIL);
    await expect.poll(() => captured).toBeDefined();
    if (!captured) throw new Error("no sign-in request was captured");
    const body = captured.postDataBuffer();
    if (!body) throw new Error("the captured sign-in request has no body");

    // Send it as a page on the foreign name would: that name as Host and Origin,
    // so the framework's own origin check has nothing to refuse.
    const headers = captured.headers();
    for (const name of ["cookie", "content-length", "host"]) delete headers[name];
    headers.host = FOREIGN_HOST;
    headers.origin = `http://${FOREIGN_HOST}`;
    headers.referer = `http://${FOREIGN_HOST}/sign-in`;

    const before = await operatorSessionCount();
    for (const path of ["/sign-in", "/favicon.ico"]) {
      const reply = await rawRequest(base, path, { method: "POST", headers, body });
      expect(reply, `reply for the sign-in posted to ${path}`).toEqual({ status: 421, body: MISDIRECTED });
    }
    expect(await operatorSessionCount(), "operator sessions after the foreign-Host posts").toBe(before);
  });

  test("AC-0069: 127.0.0.1 and localhost, with a port, are not refused", async ({ baseURL }) => {
    const base = new URL(baseURL ?? "");
    for (const host of [`127.0.0.1:${base.port}`, `localhost:${base.port}`]) {
      const reply = await rawRequest(base, "/sign-in", { headers: { host } });
      expect(reply.status, `status for Host ${host}`).toBe(200);
      expect(reply.body, `page for Host ${host}`).toContain("Sign in");
    }
  });
});
