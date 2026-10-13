// The browser suite's model service: a plain Node HTTP server, no dependency, on
// 127.0.0.1 only (never 0.0.0.0: any listener there gets a firewall allow entry
// on this machine). The suite starts it before the app (playwright.config.ts) and
// names its port in FAKE_MODEL_PORT.
//
//   POST /v1/messages        records the request, then answers from the queue
//   POST /__fake/answers     sets the queue: { answers: [answer, ...] }, used in order
//   POST /__fake/release     lets every held answer go
//   GET  /__fake/requests    the requests recorded since the last reset
//   POST /__fake/reset       clears the queue and the record, and drops held requests
//
// An answer is one of:
//   { reading: [line, ...], stop_reason? }  a message whose text is the JSON reading
//   { text, stop_reason? }                  a message with this text as written
//   { status, body? }                       an error status with an Anthropic-style error body
//   { rawBody, status?, contentType? }      this body as written, which may not be a message
//   { drop: true }                          the connection is closed with no answer
//   { hold: true, then: answer }            waits for /__fake/release, then gives `then`
// An empty queue answers 500, so a second request from one read shows up as a count.
//
// Every request is also appended, one JSON line each, to test-results/ in a log
// no reset clears. The key and any authorization value are stored only as their
// SHA-256 hex, so no key reaches the disk.

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";

const PORT = Number(process.env.FAKE_MODEL_PORT);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error("fake-model: FAKE_MODEL_PORT must name a port");
  process.exit(1);
}

const RUN_LOG = resolve("test-results", "fake-model-requests.jsonl");
const HASHED_HEADERS = ["x-api-key", "authorization"];

let queue = [];
let requests = [];
let held = [];

const sha256 = (value) => createHash("sha256").update(String(value)).digest("hex");

function loggable(headers) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (HASHED_HEADERS.includes(name)) out[`${name}-sha256`] = sha256(value);
    else out[name] = value;
  }
  return out;
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

let messageCount = 0;

function message({ text, stop_reason = "end_turn" }) {
  messageCount += 1;
  return {
    id: `msg_fake_${messageCount}`,
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text }],
    stop_reason,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

function answer(res, given) {
  if (given.drop) {
    res.socket.destroy();
    return;
  }
  if (given.rawBody !== undefined) {
    res.writeHead(given.status ?? 200, { "content-type": given.contentType ?? "application/json" });
    res.end(given.rawBody);
    return;
  }
  if (given.status !== undefined) {
    json(res, given.status, given.body ?? { type: "error", error: { type: "api_error", message: "fake model error" } });
    return;
  }
  const text = given.reading !== undefined ? JSON.stringify({ lines: given.reading }) : (given.text ?? "");
  json(res, 200, message({ text, stop_reason: given.stop_reason }));
}

function readBody(req) {
  return new Promise((done) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => done(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => done(""));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const text = await readBody(req);

  if (req.method === "POST" && url.pathname === "/v1/messages") {
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    const record = { method: req.method, url: req.url, headers: req.headers, body };
    requests.push(record);
    mkdirSync(dirname(RUN_LOG), { recursive: true });
    appendFileSync(RUN_LOG, `${JSON.stringify({ at: new Date().toISOString(), ...record, headers: loggable(req.headers) })}\n`);

    const given = queue.shift();
    if (!given) {
      json(res, 500, { type: "error", error: { type: "api_error", message: "fake model: no answer queued" } });
    } else if (given.hold) {
      const entry = { res, release: () => answer(res, given.then ?? {}) };
      held.push(entry);
      res.on("close", () => {
        held = held.filter((other) => other !== entry);
      });
    } else {
      answer(res, given);
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/__fake/answers") {
    queue = JSON.parse(text).answers;
    json(res, 200, { queued: queue.length });
    return;
  }
  if (req.method === "POST" && url.pathname === "/__fake/release") {
    const going = held;
    held = [];
    for (const entry of going) entry.release();
    json(res, 200, { released: going.length });
    return;
  }
  if (req.method === "GET" && url.pathname === "/__fake/requests") {
    json(res, 200, requests);
    return;
  }
  if (req.method === "POST" && url.pathname === "/__fake/reset") {
    queue = [];
    requests = [];
    for (const entry of held) entry.res.destroy();
    held = [];
    json(res, 200, { reset: true });
    return;
  }
  json(res, 404, { type: "error", error: { type: "not_found_error", message: "fake model: no such route" } });
});

server.listen(PORT, "127.0.0.1");
