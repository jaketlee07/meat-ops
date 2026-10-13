import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  failureKind,
  modelAddress,
  parseAnswer,
  requestParams,
  type Catalog,
  type FailureDescription,
  type ReadInput,
} from "../../lib/invoice-reading";
import type { ModelReadiness, ModelResult } from "../invoices/read-invoice";

// The one place that calls the model service, and with session.ts the only place
// that reads process.env. The key and the model address are read when a read
// runs, by dotted name, and are never logged or returned. Next.js fills a name
// from .env only when the process has no value, so a value the shell or the test
// suite sets wins.

// The longest a read waits for the model's answer (AC-0115).
const MODEL_TIMEOUT_MS = 120_000;

// The only request headers a read sends. The SDK adds its own platform headers
// (operating system, architecture, runtime version, user agent) and reads more
// from ANTHROPIC_CUSTOM_HEADERS; this drops every one of them (AC-0184).
const SENT_HEADERS = ["accept", "anthropic-version", "content-type", "x-api-key"];

const sparseFetch: typeof fetch = (input, init) => {
  const given = new Headers(init?.headers);
  const headers = new Headers();
  for (const name of SENT_HEADERS) {
    const value = given.get(name);
    if (value !== null) headers.set(name, value);
  }
  return fetch(input, { ...init, headers });
};

// instanceof, not class names: the production build renames classes. The timeout
// error is a kind of connection error, so it is checked first.
function describe(error: unknown): FailureDescription {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return { type: "timeout" };
  if (error instanceof Anthropic.APIConnectionError) return { type: "connection" };
  if (error instanceof Anthropic.APIError && typeof error.status === "number") {
    return { type: "status", status: error.status };
  }
  return { type: "connection" };
}

// AC-0021, AC-0183, AC-0028: the key first, then the address.
export function modelReady(): ModelReadiness {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, kind: "not-set-up" };
  if (modelAddress(process.env.ANTHROPIC_BASE_URL) === null) return { ok: false, kind: "address-refused" };
  return { ok: true };
}

// One read sends one request: no retries (AC-0027). The model gets no tools and
// no beta feature. Every client setting is explicit, so the SDK takes nothing
// from ANTHROPIC_AUTH_TOKEN, ANTHROPIC_LOG, ANTHROPIC_WEBHOOK_SIGNING_KEY, or a
// saved login profile. Nothing SDK-typed leaves this function.
export async function readReceipt(input: ReadInput, catalog: Catalog, today: string): Promise<ModelResult> {
  const ready = modelReady();
  if (!ready.ok) return ready;
  const baseURL = modelAddress(process.env.ANTHROPIC_BASE_URL);
  if (baseURL === null) return { ok: false, kind: "address-refused" };

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL,
    authToken: null,
    webhookKey: null,
    logLevel: "off",
    timeout: MODEL_TIMEOUT_MS,
    maxRetries: 0,
    fetch: sparseFetch,
  });

  let message;
  try {
    message = await client.messages.create(requestParams(input, catalog, today));
  } catch (error) {
    const description = describe(error);
    return {
      ok: false,
      kind: failureKind(description),
      ...(description.type === "status" ? { status: description.status } : {}),
    };
  }

  // An answer that is not a message at all (no content) is not a reading.
  try {
    const parsed = parseAnswer(message);
    return parsed.ok ? { ok: true, lines: parsed.lines } : { ok: false, kind: parsed.kind };
  } catch {
    return { ok: false, kind: "unreadable" };
  }
}
