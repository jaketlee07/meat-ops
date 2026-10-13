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

// The longest a read waits for the model's answer to start (AC-0115). In the
// installed SDK the timer covers the wait for the response headers only; the
// body is read without it.
const MODEL_TIMEOUT_MS = 120_000;

// The only request headers a read sends, with values set here. The SDK adds its
// own platform headers (operating system, architecture, runtime version, user
// agent) and merges ANTHROPIC_CUSTOM_HEADERS after its own, so a value it holds
// could replace the key or the version. This drops every SDK header and sends
// these four with the values below (AC-0184).
function sparseFetch(apiKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers({
      accept: "application/json",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": apiKey,
    });
    return fetch(input, { ...init, headers });
  };
}

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, kind: "not-set-up" };

  const client = new Anthropic({
    apiKey,
    baseURL,
    authToken: null,
    webhookKey: null,
    logLevel: "off",
    timeout: MODEL_TIMEOUT_MS,
    maxRetries: 0,
    fetch: sparseFetch(apiKey),
  });

  let message;
  try {
    message = await client.messages.create(requestParams(input, catalog, today));
  } catch (error) {
    // A 200 answer whose body is not JSON makes the SDK throw a plain SyntaxError.
    if (error instanceof SyntaxError) return { ok: false, kind: "unreadable" };
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
