import type { Cookie } from "@playwright/test";

// The Supabase session lives in cookies named sb-<ref>-auth-token, split into
// numbered chunks (.0, .1) when it is long, with the value base64url-encoded
// and prefixed "base64-". These helpers read and rewrite it.

export function isAuthCookie(cookie: { name: string }): boolean {
  return cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token");
}

const SESSION_CHUNK = /^sb-.+-auth-token(?:\.(\d+))?$/;
const PREFIX = "base64-";

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function sessionChunks(cookies: Cookie[]): Cookie[] {
  return cookies
    .filter((cookie) => SESSION_CHUNK.test(cookie.name))
    .sort((a, b) => chunkIndex(a) - chunkIndex(b));
}

function chunkIndex(cookie: Cookie): number {
  return Number(SESSION_CHUNK.exec(cookie.name)?.[1] ?? 0);
}

export function readSession(cookies: Cookie[]): StoredSession {
  const joined = sessionChunks(cookies)
    .map((cookie) => cookie.value)
    .join("");
  if (!joined.startsWith(PREFIX)) throw new Error("No base64 session cookie found");
  return JSON.parse(Buffer.from(joined.slice(PREFIX.length), "base64url").toString("utf8")) as StoredSession;
}

// Returns the session cookies rewritten so the stored access token has expired
// an hour ago. The proxy must then refresh it with the refresh token.
export function withExpiredAccessToken(cookies: Cookie[]): Cookie[] {
  const chunks = sessionChunks(cookies);
  const session = readSession(cookies);
  const expired = { ...session, expires_at: Math.floor(Date.now() / 1000) - 3600 };
  const encoded = PREFIX + Buffer.from(JSON.stringify(expired), "utf8").toString("base64url");

  // Keep the chunk layout: the first chunks keep their length, the last takes the rest.
  let offset = 0;
  return chunks.map((chunk, index) => {
    const isLast = index === chunks.length - 1;
    const end = isLast ? encoded.length : offset + chunk.value.length;
    const value = encoded.slice(offset, end);
    offset = end;
    return { ...chunk, value };
  });
}
