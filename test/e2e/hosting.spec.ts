import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test, type Cookie, type Page, type Request } from "@playwright/test";
import { OPERATOR_EMAIL } from "../users";
import { query } from "../db";
import { APP_TIME_ZONE } from "./app-time";
import { ANTHROPIC_TEST_AUTH_TOKEN, ANTHROPIC_TEST_KEY, ports, startSpare } from "./invoices-page";
import { headerValues, rawHttp10, rawHttp11, rawRequest, type RawHeaderReply } from "./raw-http";
import { isAuthCookie, readSession, withExpiredAccessToken } from "./session";
import { signInThroughForm, submitSignIn } from "./states";

// The hosted name the suite's app answers (playwright.config.ts sets APP_HOST).
const HOSTED = "meat-ops.example";
const MISDIRECTED = "Misdirected request.";
const SIGN_IN_FORM = "Sign in";

// Never read a value: a failure names only the setting or the file.
const ENV_FILES = [".env.production.local", ".env.local", ".env.production", ".env"];

async function operatorSessionCount(): Promise<number> {
  const rows = await query<{ n: number }>(
    "select count(*)::int as n from auth.sessions s join auth.users u on u.id = s.user_id where u.email = $1",
    [OPERATOR_EMAIL],
  );
  const [row] = rows;
  if (!row) throw new Error("the session count returned no row");
  return row.n;
}

// The unset-APP_HOST run proves the app reads nothing from the runner or from a
// file Next.js fills a missing name from in production. Reports at most whether
// the runner sets APP_HOST or which file names it.
async function assertAppHostIsNowhere(): Promise<void> {
  if (process.env.APP_HOST !== undefined) throw new Error("the runner's environment sets APP_HOST");
  const root = fileURLToPath(new URL("../../", import.meta.url));
  for (const name of ENV_FILES) {
    let text: string;
    try {
      text = await readFile(`${root}${name}`, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw new Error(`${name} could not be read (${(error as NodeJS.ErrnoException).code ?? "unknown error"})`);
    }
    if (text.includes("APP_HOST")) throw new Error(`${name} names APP_HOST`);
  }
}

// What the suite app holds besides APP_HOST, plus the spare's own APP_HOST or none.
function spareEnv(baseURL: string | undefined, appHost?: string): Record<string, string> {
  return {
    TZ: APP_TIME_ZONE,
    ANTHROPIC_API_KEY: ANTHROPIC_TEST_KEY,
    ANTHROPIC_AUTH_TOKEN: ANTHROPIC_TEST_AUTH_TOKEN,
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${ports(baseURL).model}`,
    ...(appHost === undefined ? {} : { APP_HOST: appHost }),
  };
}

// A signed-out GET of /sign-in with the Host line the test names.
async function signInWithHost(base: URL, host: string) {
  return rawRequest(base, "/sign-in", { headers: { host } });
}

async function expectSignInForm(base: URL, host: string): Promise<void> {
  const reply = await signInWithHost(base, host);
  expect(reply.status, `status for Host ${host}`).toBe(200);
  expect(reply.body, `page for Host ${host}`).toContain(SIGN_IN_FORM);
}

async function expectMisdirected(base: URL, host: string): Promise<void> {
  const reply = await signInWithHost(base, host);
  expect(reply, `reply for Host ${host}`).toEqual({ status: 421, body: MISDIRECTED });
}

// The four local forms a request can carry: each name with and without the port.
function localHosts(base: URL): string[] {
  return ["127.0.0.1", `127.0.0.1:${base.port}`, "localhost", `localhost:${base.port}`];
}

// Captures the request the sign-in form sends and stops it before the server
// sees it, so the capture spends no sign-in.
async function captureSignIn(page: Page): Promise<Request> {
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
  return captured;
}

// Sends the captured sign-in again as a page on the hosted name would: that name
// as Host, the given Origin, and no cookie. Returns the whole reply, so a caller
// can read every Set-Cookie line.
async function replaySignIn(base: URL, captured: Request, origin: string): Promise<RawHeaderReply> {
  const body = captured.postDataBuffer();
  if (!body) throw new Error("the captured sign-in request has no body");
  const headers = captured.headers();
  for (const name of ["cookie", "content-length", "host", "connection", "transfer-encoding", "accept-encoding"]) {
    delete headers[name];
  }
  headers.origin = origin;
  headers.referer = `${origin}/sign-in`;
  return rawHttp11(base, "/sign-in", { method: "POST", host: HOSTED, headers, body });
}

test.describe("the hosted name", () => {
  test("AC-0002: the APP_HOST name is served, ignoring letter case on both sides", async ({ baseURL }) => {
    const base = new URL(baseURL ?? "");
    await expectSignInForm(base, HOSTED);
    await expectSignInForm(base, "MEAT-OPS.Example");

    const spare = await startSpare(ports(baseURL).spare, spareEnv(baseURL, "Meat-Ops.Example"));
    try {
      await expectSignInForm(new URL(spare.url), HOSTED);
    } finally {
      await spare.stop();
    }
  });

  test("AC-0004: look-alikes of the APP_HOST name and other names are refused", async ({ baseURL }) => {
    const base = new URL(baseURL ?? "");
    const refused = [
      `${HOSTED}:443`,
      `x${HOSTED}`,
      `sub.${HOSTED}`,
      `${HOSTED}.rebind.example`,
      "meat-opsxexample",
      "rebind.example:3100",
    ];
    for (const host of refused) await expectMisdirected(base, host);
  });

  test("AC-0012: 127.0.0.1 and localhost are served by the app with APP_HOST set", async ({ baseURL }) => {
    const base = new URL(baseURL ?? "");
    for (const host of localHosts(base)) await expectSignInForm(base, host);
  });

  test("AC-0017: a signed-out GET of /receiving on the hosted name redirects to /sign-in", async ({ baseURL }) => {
    const reply = await rawHttp11(new URL(baseURL ?? ""), "/receiving", { host: HOSTED });
    expect(reply.status).toBe(307);
    expect(headerValues(reply, "location")).toEqual(["/sign-in"]);
  });
});

test.describe("an app started with APP_HOST unset or empty", () => {
  for (const setting of ["unset", "empty"] as const) {
    test(`AC-0005 and AC-0012: with APP_HOST ${setting}, the hosted name and other names are refused, local names served`, async ({
      baseURL,
    }) => {
      if (setting === "unset") await assertAppHostIsNowhere();
      const spare = await startSpare(ports(baseURL).spare, spareEnv(baseURL, setting === "empty" ? "" : undefined));
      try {
        const base = new URL(spare.url);
        for (const host of [HOSTED, "rebind.example:3100"]) await expectMisdirected(base, host);

        // Node's own client replaces an empty Host, so this one goes over a raw socket.
        const empty = await rawHttp11(base, "/sign-in", { host: "" });
        expect({ status: empty.status, body: empty.body }, "reply for an empty Host").toEqual({
          status: 421,
          body: MISDIRECTED,
        });
        expect(await rawHttp10(base, "/sign-in"), "reply for HTTP/1.0 with no Host").toEqual({
          status: 421,
          body: MISDIRECTED,
        });

        for (const host of localHosts(base)) await expectSignInForm(base, host);
      } finally {
        await spare.stop();
      }
    });
  }
});

test.describe("a sign-in posted with the hosted name as Host", () => {
  test("AC-0003: with the hosted name as Origin, it creates one new session", async ({ page, baseURL }) => {
    const base = new URL(baseURL ?? "");
    const captured = await captureSignIn(page);
    const before = await operatorSessionCount();
    await replaySignIn(base, captured, `https://${HOSTED}`);
    expect(await operatorSessionCount(), "operator sessions after the hosted-name sign-in").toBe(before + 1);
  });

  test("AC-0014: with another Origin, it creates no session", async ({ page, baseURL }) => {
    const base = new URL(baseURL ?? "");
    const captured = await captureSignIn(page);
    for (const origin of ["https://rebind.example", `https://sub.${HOSTED}`]) {
      const before = await operatorSessionCount();
      await replaySignIn(base, captured, origin);
      expect(await operatorSessionCount(), `operator sessions after a sign-in with Origin ${origin}`).toBe(before);
    }
  });
});

// Never print a value: a failure names only the cookie's name and attributes.
async function authCookies(page: Page): Promise<Cookie[]> {
  return (await page.context().cookies()).filter(isAuthCookie);
}

// The attribute names of one Set-Cookie line, lowercased, with the SameSite
// value, and the cookie's name. The cookie's value is never returned.
function parseSetCookie(line: string): { name: string; attributes: Map<string, string> } {
  const [pair = "", ...rest] = line.split(";");
  const attributes = new Map<string, string>();
  for (const part of rest) {
    const [key = "", ...value] = part.split("=");
    attributes.set(key.trim().toLowerCase(), value.join("=").trim().toLowerCase());
  }
  return { name: pair.split("=")[0]?.trim() ?? "", attributes };
}

test.describe("every auth cookie is Secure", () => {
  test("AC-0001: sign-in and a token refresh both set Secure on every auth cookie", async ({ page }) => {
    await signInThroughForm(page, OPERATOR_EMAIL);
    await expect(page).toHaveURL(/\/receiving$/);
    const atSignIn = await authCookies(page);
    expect(atSignIn.length, "the session cookie exists after sign-in").toBeGreaterThan(0);
    for (const cookie of atSignIn) expect(cookie.secure, `secure on ${cookie.name} after sign-in`).toBe(true);

    const before = readSession(atSignIn);
    await page.context().addCookies(withExpiredAccessToken(atSignIn));
    await page.goto("/receiving");
    await expect(page.getByRole("heading", { level: 1, name: "Receiving" })).toBeVisible();

    const afterRefresh = await authCookies(page);
    expect(afterRefresh.length, "the session cookie exists after the refresh").toBeGreaterThan(0);
    for (const cookie of afterRefresh) expect(cookie.secure, `secure on ${cookie.name} after refresh`).toBe(true);
    const changed = readSession(afterRefresh).refresh_token !== before.refresh_token;
    expect(changed, "the refresh token changed").toBe(true);
  });

  test("AC-0016: a sign-in on the hosted name sets each auth cookie HttpOnly, SameSite=Lax, and Secure", async ({
    page,
    baseURL,
  }) => {
    const captured = await captureSignIn(page);
    const reply = await replaySignIn(new URL(baseURL ?? ""), captured, `https://${HOSTED}`);
    const cookies = headerValues(reply, "set-cookie")
      .map(parseSetCookie)
      .filter((cookie) => isAuthCookie(cookie));
    expect(cookies.length, "auth cookies set by the hosted-name sign-in").toBeGreaterThan(0);
    for (const { name, attributes } of cookies) {
      expect(attributes.has("httponly"), `HttpOnly on ${name}`).toBe(true);
      expect(attributes.get("samesite"), `SameSite on ${name}`).toBe("lax");
      expect(attributes.has("secure"), `Secure on ${name}`).toBe(true);
    }
  });
});
