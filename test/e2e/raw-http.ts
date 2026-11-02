import { connect } from "node:net";
import { request as httpRequest } from "node:http";
import { expect, type Page, type Request } from "@playwright/test";
import { OPERATOR_EMAIL } from "../users";
import { query } from "../db";
import { submitSignIn } from "./states";

// A request sent straight to the test server, so the test picks every header,
// including a Host the browser would never send.
export interface RawReply {
  status: number;
  body: string;
}

export function rawRequest(
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
export function rawHttp10(base: URL, path: string): Promise<RawReply> {
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

// The reply to rawHttp11: the status, every response header line as a
// [lowercase name, value] pair in the order sent (so a repeated Set-Cookie
// shows once per line), and the body.
export interface RawHeaderReply {
  status: number;
  headers: [string, string][];
  body: string;
}

// The values of every header line with this name, in the order sent.
export function headerValues(reply: RawHeaderReply, name: string): string[] {
  return reply.headers.filter(([key]) => key === name.toLowerCase()).map(([, value]) => value);
}

// An HTTP/1.1 request written to a raw socket, so the caller writes the method,
// the Host line (an empty one too, which Node's client replaces), the other
// headers, and the body. The connection closes after the reply, and the reply
// is not redirected.
export function rawHttp11(
  base: URL,
  path: string,
  { method = "GET", host, headers = {}, body }: {
    method?: string;
    host: string;
    headers?: Record<string, string>;
    body?: Buffer;
  },
): Promise<RawHeaderReply> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: base.hostname, port: Number(base.port), timeout: 10_000 });
    const chunks: Buffer[] = [];
    socket.on("connect", () => {
      const lines = [`${method} ${path} HTTP/1.1`, `Host: ${host}`, "Connection: close"];
      for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
      if (body) lines.push(`Content-Length: ${body.length}`);
      socket.write(Buffer.concat([Buffer.from(`${lines.join("\r\n")}\r\n\r\n`, "utf8"), body ?? Buffer.alloc(0)]));
    });
    socket.on("data", (chunk: Buffer) => chunks.push(chunk));
    socket.on("timeout", () => socket.destroy(new Error(`no answer for ${method} ${path}`)));
    socket.on("error", reject);
    socket.on("close", () => {
      const raw = Buffer.concat(chunks);
      const split = raw.indexOf("\r\n\r\n");
      if (split === -1) {
        reject(new Error(`no complete reply for ${method} ${path}`));
        return;
      }
      const [statusLine = "", ...headerLines] = raw.subarray(0, split).toString("utf8").split("\r\n");
      const headers: [string, string][] = headerLines.map((line) => {
        const colon = line.indexOf(":");
        return [line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim()];
      });
      let payload: Buffer = raw.subarray(split + 4);
      if (headers.some(([name, value]) => name === "transfer-encoding" && /chunked/i.test(value))) {
        payload = unchunk(payload);
      }
      resolve({
        status: Number(/^HTTP\/1\.[01] (\d{3})/.exec(statusLine)?.[1] ?? 0),
        headers,
        body: payload.toString("utf8"),
      });
    });
  });
}

// Joins the pieces of a chunked body.
function unchunk(data: Buffer): Buffer {
  const pieces: Buffer[] = [];
  let at = 0;
  while (at < data.length) {
    const lineEnd = data.indexOf("\r\n", at);
    if (lineEnd === -1) break;
    const size = Number.parseInt(data.subarray(at, lineEnd).toString("ascii").split(";")[0] ?? "", 16);
    if (!Number.isFinite(size) || size === 0) break;
    pieces.push(data.subarray(lineEnd + 2, lineEnd + 2 + size));
    at = lineEnd + 2 + size + 2;
  }
  return Buffer.concat(pieces);
}

export async function operatorSessionCount(): Promise<number> {
  const rows = await query<{ n: number }>(
    "select count(*)::int as n from auth.sessions s join auth.users u on u.id = s.user_id where u.email = $1",
    [OPERATOR_EMAIL],
  );
  const [row] = rows;
  if (!row) throw new Error("the session count returned no row");
  return row.n;
}

// Captures the request the sign-in form sends and stops it before the server
// sees it, so the capture spends no sign-in.
export async function captureSignIn(page: Page): Promise<Request> {
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
