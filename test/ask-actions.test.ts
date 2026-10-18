import { decideAsk, decideLookup, type AskDeps } from "../src/app/ask/ask-question.js";
import { afterEach, expect, it, vi } from "vitest";
import {
  askFailureLogLine,
  ASK_FAILURE_KINDS,
  type AskFailureKind,
  type AskModelResult,
  type Choice,
  type ModelAnswer,
  type ProductLists,
} from "../src/lib/ask.js";
import type { Answer } from "../src/lib/ask-answers.js";
import { RpcError } from "../src/lib/rpc.js";
import type { CallerOutcome } from "../src/app/invoices/read-invoice.js";

// STUB: AC-0071
it("AC-0071: a caller check that fails says try again and sends nothing", async () => {
  let requests = 0;
  const deps: AskDeps<"client"> = {
    caller: async () => ({ status: "failed", error: new Error("auth lookup timed out") }),
    modelReady: () => ({ ok: true }),
    readProducts: async () => ({ raw: [{ code: "RAW-TOM", description: "Turkey Drums TOM (raw)" }], finished: [] }),
    askModel: async () => {
      requests += 1;
      return { ok: false, kind: "service-error" };
    },
    readAnswer: async () => null,
  };
  expect(await decideAsk("How much RAW-TOM do I have?", deps)).toEqual({
    status: "message",
    message: "The question wasn't answered. Try again in a moment.",
  });
  expect(await decideLookup({ query: "raw_stock", param: "RAW-TOM" }, deps)).toEqual({
    status: "message",
    message: "The answer wasn't looked up. Try again in a moment.",
  });
  expect(requests).toBe(0);
});

const PRODUCTS: ProductLists = {
  raw: [
    { code: "RAW-TOM", description: "Turkey Drums TOM (raw)" },
    { code: "RAW-TWO", description: "Turkey Wings (raw)" },
  ],
  finished: [{ code: "502", description: "Smoked Drums" }],
};
const ANSWER: Answer = {
  lookedUp: "stock on hand for RAW-TOM Turkey Drums TOM (raw)",
  text: { lead: "lead", items: [], tail: null },
  link: { name: "See it on Receiving", href: "/receiving?product=RAW-TOM" },
};
const QUESTION = "How much RAW-TOM do I have?";
const operator = async (): Promise<CallerOutcome<string>> => ({ status: "operator", client: "client" });

function modelAnswer(over: Partial<ModelAnswer> = {}): ModelAnswer {
  return { query: "raw_stock", product_code: "RAW-TOM", candidates: [], number: null, ...over };
}

// Deps whose every call counts; `over` replaces the ones a test fails.
function setup(over: Partial<AskDeps<string>> = {}) {
  const calls = { modelReady: 0, readProducts: 0, askModel: 0, readAnswer: 0 };
  const choices: Choice[] = [];
  const deps: AskDeps<string> = {
    caller: operator,
    modelReady: () => {
      calls.modelReady += 1;
      return { ok: true };
    },
    readProducts: async () => {
      calls.readProducts += 1;
      return PRODUCTS;
    },
    askModel: async () => {
      calls.askModel += 1;
      return { ok: true, answer: modelAnswer() };
    },
    readAnswer: async (_client, choice) => {
      calls.readAnswer += 1;
      choices.push(choice);
      return ANSWER;
    },
    ...over,
  };
  return { deps, calls, choices };
}

const none = { modelReady: 0, readProducts: 0, askModel: 0, readAnswer: 0 };
const silence = () => vi.spyOn(console, "error").mockImplementation(() => {});
afterEach(() => vi.restoreAllMocks());

it("AC-0070: an ended session says sign in again, for ask and lookup, and calls nothing later", async () => {
  const { deps, calls } = setup({ caller: async () => ({ status: "ended" }) });
  expect(await decideAsk(QUESTION, deps)).toEqual({
    status: "message",
    message: "You're signed out. Sign in again to ask a question.",
  });
  expect(await decideLookup({ query: "raw_stock", param: "RAW-TOM" }, deps)).toEqual({
    status: "message",
    message: "You're signed out. Sign in again to look up this answer.",
  });
  expect(calls).toEqual(none);
});

it("AC-0004: a non-operator is told the account is not allowed, and nothing later is called", async () => {
  const { deps, calls } = setup({ caller: async () => ({ status: "not-operator" }) });
  expect(await decideAsk("", deps)).toEqual({
    status: "message",
    message: "The question wasn't answered. This account isn't allowed to use Meat Ops.",
  });
  expect(await decideLookup({ query: "nope", param: null }, deps)).toEqual({
    status: "message",
    message: "The answer wasn't looked up. This account isn't allowed to use Meat Ops.",
  });
  expect(calls).toEqual(none);
});

it("AC-0071: a caller check answered with a code other than 42501 says try again, logs once per action, and calls nothing later", async () => {
  for (const error of [new Error("fetch failed"), new RpcError("isOperator failed: boom", "XX000")]) {
    const log = silence();
    const { deps, calls } = setup({ caller: async () => ({ status: "failed", error }) });
    expect((await decideAsk(QUESTION, deps)).status).toBe("message");
    expect((await decideLookup({ query: "raw_stock", param: "RAW-TOM" }, deps)).status).toBe("message");
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toMatch(/^askQuestion failed at before-write: /);
    expect(log.mock.calls[1]?.[0]).toMatch(/^lookUpAnswer failed at before-write: /);
    expect(calls).toEqual(none);
    log.mockRestore();
  }
});

it("AC-0011: a question refusal comes before the key check and sends nothing", async () => {
  const { deps, calls } = setup();
  expect(await decideAsk("   ", deps)).toEqual({
    status: "invalid",
    message: "Type a question, like: How much RAW-TOM do I have?",
  });
  expect(await decideAsk("x".repeat(501), deps)).toEqual({
    status: "invalid",
    message: "Keep the question to 500 characters or fewer.",
  });
  expect(calls).toEqual(none);
});

it("AC-0072 to AC-0074: a key or address that is not ready says so, logs one line, and reads and sends nothing", async () => {
  const messages = {
    "not-set-up": "Ask isn't set up. Set ANTHROPIC_API_KEY in the app's .env file, then restart the app.",
    "address-refused":
      "Ask isn't set up. ANTHROPIC_BASE_URL must be unset, or a loopback address for tests. Fix it, then restart the app.",
  } as const;
  for (const kind of ["not-set-up", "address-refused"] as const) {
    const log = silence();
    const { deps, calls } = setup({ modelReady: () => ({ ok: false, kind }) });
    expect(await decideAsk(QUESTION, deps)).toEqual({ status: "message", message: messages[kind] });
    expect(log.mock.calls).toEqual([[askFailureLogLine(kind)]]);
    expect(calls).toEqual(none);
    log.mockRestore();
  }
});

it("AC-0075: a failed product list read says try again, logs once, and sends no request", async () => {
  const log = silence();
  const { deps, calls } = setup({
    readProducts: async () => {
      throw new Error("products failed");
    },
  });
  expect(await decideAsk(QUESTION, deps)).toEqual({
    status: "message",
    message: "The question wasn't answered. Try again in a moment.",
  });
  expect(log.mock.calls).toEqual([["askQuestion failed at before-write: products failed"]]);
  expect(calls.askModel).toBe(0);
  expect(calls.readAnswer).toBe(0);
});

it("AC-0083: each model failure kind leaves exactly one line, askFailureLogLine(kind, status), and the kind's message", async () => {
  const kinds: AskFailureKind[] = [...ASK_FAILURE_KINDS].filter((k) => k !== "not-set-up" && k !== "address-refused");
  for (const kind of kinds) {
    for (const status of [undefined, 503]) {
      const log = silence();
      const { deps, calls } = setup({
        askModel: async () => {
          calls.askModel += 1;
          return { ok: false, kind, ...(status === undefined ? {} : { status }) };
        },
      });
      const state = await decideAsk(QUESTION, deps);
      expect(state.status).toBe("message");
      expect(log.mock.calls).toEqual([[askFailureLogLine(kind, status)]]);
      expect(calls.askModel).toBe(1);
      expect(calls.readAnswer).toBe(0);
      log.mockRestore();
    }
  }
});

it("AC-0083: a model call that throws logs only service-error and nothing it carried", async () => {
  const log = silence();
  const secret = "sk-ant-SENTINEL-KEY";
  const { deps } = setup({
    askModel: async () => {
      throw new Error(`${secret} ${QUESTION} Turkey Drums TOM (raw)`);
    },
  });
  const state = await decideAsk(QUESTION, deps);
  expect(state).toEqual({ status: "message", message: "The question wasn't answered. Try again in a moment." });
  expect(log.mock.calls).toEqual([[askFailureLogLine("service-error")]]);
  const text = JSON.stringify(log.mock.calls);
  for (const leaked of [secret, QUESTION, "Turkey Drums TOM (raw)"]) expect(text).not.toContain(leaked);
});

it("AC-0057: a null query says Ask cannot answer, with no read", async () => {
  const { deps, calls } = setup({ askModel: async () => ({ ok: true, answer: modelAnswer({ query: null }) }) });
  expect(await decideAsk(QUESTION, deps)).toEqual({
    status: "message",
    message: "Ask can't answer that question. Try one of the questions below.",
  });
  expect(calls.readAnswer).toBe(0);
});

it("AC-0050: candidates become product buttons and nothing is read", async () => {
  const { deps, calls } = setup({
    askModel: async () => ({
      ok: true,
      answer: modelAnswer({ product_code: null, candidates: ["RAW-TWO", "RAW-TOM", "RAW-TOM", "NOPE"] }),
    }),
  });
  expect(await decideAsk("turkey?", deps)).toEqual({
    status: "choose",
    query: "raw_stock",
    candidates: [PRODUCTS.raw[1], PRODUCTS.raw[0]],
    message: "Which product do you mean?",
  });
  expect(calls.readAnswer).toBe(0);
});

it("AC-0053: a product query with no usable product or candidate says to name the product", async () => {
  const { deps, calls } = setup({
    askModel: async () => ({ ok: true, answer: modelAnswer({ product_code: null, candidates: ["NOPE"] }) }),
  });
  expect(await decideAsk("stock?", deps)).toEqual({
    status: "message",
    message: "Name the product in your question, by its code or its description.",
  });
  expect(calls.readAnswer).toBe(0);
});

it("AC-0054: a number query with no usable number asks for the sale or lot number", async () => {
  for (const [query, text] of [
    ["sale_lots", "Add the sale number to your question."],
    ["lot_sales", "Add the lot number to your question."],
  ] as const) {
    const { deps, calls } = setup({
      askModel: async () => ({ ok: true, answer: modelAnswer({ query, product_code: null, number: "S-9" }) }),
    });
    expect(await decideAsk("which sale?", deps)).toEqual({ status: "message", message: text });
    expect(calls.readAnswer).toBe(0);
  }
});

it("AC-0047: the question reaches interpret as received, so a number differing only in case is not used", async () => {
  let sent = 0;
  const { deps, calls } = setup({
    askModel: async () => {
      sent += 1;
      return { ok: true, answer: modelAnswer({ query: "lot_sales", product_code: null, number: "L-20261001-1A2B3C" }) };
    },
  });
  expect(await decideAsk("Who bought from lot L-20261001-1a2b3c?", deps)).toEqual({
    status: "message",
    message: "Add the lot number to your question.",
  });
  expect(calls.readAnswer).toBe(0);
  expect(sent).toBe(1);
});

it("AC-0068: a choice reads once with that choice and sends exactly one model request", async () => {
  const requests: unknown[] = [];
  const { deps, calls, choices } = setup({
    askModel: async (request) => {
      requests.push(request);
      return { ok: true, answer: modelAnswer({ query: "lot_sales", product_code: null, number: "L-1" }) };
    },
  });
  expect(await decideAsk("Who bought from lot L-1?", deps)).toEqual({ status: "answer", answer: ANSWER });
  expect(requests).toHaveLength(1);
  expect({ modelReady: calls.modelReady, readProducts: calls.readProducts, readAnswer: calls.readAnswer }).toEqual({
    modelReady: 1,
    readProducts: 1,
    readAnswer: 1,
  });
  expect(choices).toEqual([{ query: "lot_sales", number: "L-1" }]);
});

it("AC-0059: a choice whose read finds nothing says ask again", async () => {
  const { deps } = setup({ readAnswer: async () => null });
  expect(await decideAsk(QUESTION, deps)).toEqual({
    status: "message",
    message: "The answer couldn't be looked up. Ask your question again.",
  });
});

it("AC-0080: a choice whose read throws gives lookup-failed with the choice and logs once", async () => {
  const log = silence();
  const { deps } = setup({
    readAnswer: async () => {
      throw new Error("view failed");
    },
  });
  expect(await decideAsk(QUESTION, deps)).toEqual({
    status: "lookup-failed",
    choice: { query: "raw_stock", productCode: "RAW-TOM" },
    message: "The answer couldn't be looked up. Try again.",
  });
  expect(log.mock.calls).toEqual([["askQuestion failed at before-write: view failed"]]);
});

it("AC-0082: a lookup that is not usable says ask again and reads nothing", async () => {
  const { deps, calls } = setup();
  for (const request of [
    { query: "stock_value", param: "RAW-TOM" },
    { query: "raw_stock", param: null },
    { query: "sale_lots", param: "x".repeat(65) },
  ]) {
    expect(await decideLookup(request, deps)).toEqual({
      status: "message",
      message: "The answer couldn't be looked up. Ask your question again.",
    });
  }
  expect(calls).toEqual(none);
});

it("AC-0082: a lookup whose read finds nothing says ask again", async () => {
  let reads = 0;
  const { deps } = setup({
    readAnswer: async () => {
      reads += 1;
      return null;
    },
  });
  expect(await decideLookup({ query: "raw_stock", param: "RAW-OLD" }, deps)).toEqual({
    status: "message",
    message: "The answer couldn't be looked up. Ask your question again.",
  });
  expect(reads).toBe(1);
});

it("AC-0080: a lookup whose read throws gives lookup-failed with the choice, logged as lookUpAnswer", async () => {
  const log = silence();
  const { deps, calls } = setup({
    readAnswer: async () => {
      throw new Error("view failed");
    },
  });
  expect(await decideLookup({ query: "raw_stock", param: "RAW-TOM" }, deps)).toEqual({
    status: "lookup-failed",
    choice: { query: "raw_stock", productCode: "RAW-TOM" },
    message: "The answer couldn't be looked up. Try again.",
  });
  expect(log.mock.calls).toEqual([["lookUpAnswer failed at before-write: view failed"]]);
  expect(calls).toEqual(none);
});

it("AC-0069: a lookup returns the answer and never checks the key, reads products, or calls the model", async () => {
  const { deps, calls, choices } = setup();
  expect(await decideLookup({ query: "pricing_attention", param: null }, deps)).toEqual({
    status: "answer",
    answer: ANSWER,
  });
  expect(choices).toEqual([{ query: "pricing_attention" }]);
  expect(calls).toEqual({ ...none, readAnswer: 1 });
});
