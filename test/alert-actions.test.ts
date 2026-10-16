import { afterEach, expect, it, vi } from "vitest";
import {
  decideDigest,
  decideDismiss,
  decideReprice,
  type CallerOutcome,
  type DigestDeps,
  type DigestModelResult,
} from "../src/app/alerts/decide.js";
import { RpcError, type DigestClaim, type Product } from "../src/lib/rpc.js";

// The reprice and dismiss decisions, with every outside call an argument
// (alerts spec: Change outcome order and Dismiss outcome order).

const ALERT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const operator = async (): Promise<CallerOutcome<null>> => ({ status: "operator", client: null });

function product(price: number | null): Product {
  return { id: "33333333-3333-3333-3333-333333333333", code: "502", list_price_per_lb: price } as Product;
}

function silence() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

// A write that must not be reached; it counts its calls.
function noWrite() {
  const calls: unknown[] = [];
  const write = async (...args: unknown[]): Promise<never> => {
    calls.push(args);
    throw new Error("unreachable");
  };
  return { calls, write };
}

afterEach(() => vi.restoreAllMocks());

const REPRICE = { alertId: ALERT_ID, value: "3.29" };
const DISMISS = { alertId: ALERT_ID };

const DISMISS_FAILURES: ReadonlyArray<[string, Error, string]> = [
  [
    "AC-0121: not open",
    new RpcError("dismissAlert failed: dismiss_alert: It is no longer open.", "P0001"),
    "The alert wasn't dismissed. It is no longer open.",
  ],
  [
    "AC-0122: an id that names no alert",
    new RpcError(`dismissAlert failed: dismiss_alert: alert ${ALERT_ID} not found`, "P0001"),
    `The alert wasn't dismissed. alert ${ALERT_ID} not found`,
  ],
  [
    "AC-0129: no answer",
    new Error("dismissAlert failed: fetch failed"),
    "The alert may have been dismissed. Reload this page to check it.",
  ],
];

const REPRICE_FAILURES: ReadonlyArray<[string, Error, string]> = [
  [
    "AC-0121: not open",
    new RpcError("applyAlertPrice failed: apply_alert_price: This alert is no longer open.", "P0001"),
    "The change wasn't saved. This alert is no longer open.",
  ],
  [
    "AC-0147: product inactive",
    new RpcError("applyAlertPrice failed: set_list_price: product 502 is inactive", "P0001"),
    "The change wasn't saved. This product is no longer active.",
  ],
  [
    "AC-0122: another refusal",
    new RpcError("applyAlertPrice failed: apply_alert_price: alert x is not a margin or price alert", "P0001"),
    "The change wasn't saved. alert x is not a margin or price alert",
  ],
  [
    "AC-0128: no answer",
    new Error("applyAlertPrice failed: fetch failed"),
    "The change may not have been saved. Reload this page to check it.",
  ],
];

it("AC-0117: an ended session says so and writes nothing", async () => {
  const { calls, write } = noWrite();
  expect(await decideReprice(REPRICE, { caller: async () => ({ status: "ended" }), apply: write })).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to save this change.",
  });
  expect(await decideDismiss(DISMISS, { caller: async () => ({ status: "ended" }), dismiss: write })).toEqual({
    status: "refused",
    message: "You're signed out. Sign in again to dismiss this alert.",
  });
  expect(calls).toEqual([]);
});

it("AC-0118: a non-operator is refused and nothing is written", async () => {
  const { calls, write } = noWrite();
  expect(await decideReprice(REPRICE, { caller: async () => ({ status: "not-operator" }), apply: write })).toEqual({
    status: "refused",
    message: "The change wasn't saved. This account isn't allowed to use Meat Ops.",
  });
  expect(await decideDismiss(DISMISS, { caller: async () => ({ status: "not-operator" }), dismiss: write })).toEqual({
    status: "refused",
    message: "The alert wasn't dismissed. This account isn't allowed to use Meat Ops.",
  });
  expect(calls).toEqual([]);
});

it("AC-0119: a caller check that gets no answer or an error other than 42501 says try again, logs once, writes nothing", async () => {
  const { calls, write } = noWrite();
  for (const error of [new Error("fetch failed"), new RpcError("isOperator failed: boom", "XX000")]) {
    const log = silence();
    const failed = async (): Promise<CallerOutcome<null>> => ({ status: "failed", error });
    expect(await decideReprice(REPRICE, { caller: failed, apply: write })).toEqual({
      status: "refused",
      message: "The change wasn't saved. Try again in a moment.",
    });
    expect(await decideDismiss(DISMISS, { caller: failed, dismiss: write })).toEqual({
      status: "refused",
      message: "The alert wasn't dismissed. Try again in a moment.",
    });
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[0]?.[0]).toMatch(/^applyAlertPrice failed at before-write: /);
    expect(log.mock.calls[1]?.[0]).toMatch(/^dismissAlert failed at before-write: /);
    log.mockRestore();
  }
  expect(calls).toEqual([]);
});

it("AC-0117 before AC-0118 before AC-0119 before AC-0120: the caller outcome beats the form rule", async () => {
  const { calls, write } = noWrite();
  const bad = { alertId: ALERT_ID, value: "abc" };
  expect((await decideReprice(bad, { caller: async () => ({ status: "ended" }), apply: write })).status).toBe("refused");
  expect((await decideReprice(bad, { caller: async () => ({ status: "not-operator" }), apply: write })).status).toBe("refused");
  silence();
  expect(
    (await decideReprice(bad, { caller: async () => ({ status: "failed", error: new Error("x") }), apply: write })).status,
  ).toBe("refused");
  expect(calls).toEqual([]);
});

it("AC-0120: a price the list-price form rule refuses returns the rule's message and writes nothing", async () => {
  const { calls, write } = noWrite();
  const cases: ReadonlyArray<[string, string]> = [
    ["", "Enter the price per lb, like 3.29."],
    ["abc", "Enter the price per lb, like 3.29."],
    ["3.299", "Use at most 2 decimal places for a price."],
    ["0", "Price must be above 0."],
    ["100000000", "Price must be below 100,000,000."],
  ];
  for (const [value, fieldError] of cases) {
    expect(await decideReprice({ alertId: ALERT_ID, value }, { caller: operator, apply: write }), value).toEqual({
      status: "invalid",
      fieldError,
    });
  }
  expect(calls).toEqual([]);
});

it("a reprice with no answer from the write, a refusal, or a closed alert reads as the spec says", async () => {
  for (const [name, error, message] of REPRICE_FAILURES) {
    const log = silence();
    const state = await decideReprice(REPRICE, {
      caller: operator,
      apply: async () => {
        throw error;
      },
    });
    expect(state, name).toEqual({ status: "refused", message });
    expect(log, name).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0], name).toMatch(/^applyAlertPrice failed at write: /);
    log.mockRestore();
  }
});

it("a dismiss with no answer from the write, a refusal, or a closed alert reads as the spec says", async () => {
  for (const [name, error, message] of DISMISS_FAILURES) {
    const log = silence();
    const state = await decideDismiss(DISMISS, {
      caller: operator,
      dismiss: async () => {
        throw error;
      },
    });
    expect(state, name).toEqual({ status: "refused", message });
    expect(log, name).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0], name).toMatch(/^dismissAlert failed at write: /);
    log.mockRestore();
  }
});

it("AC-0122: a 42501 from the write reads as not allowed", async () => {
  silence();
  const denied = new RpcError("applyAlertPrice failed: not allowed", "42501");
  expect(
    await decideReprice(REPRICE, {
      caller: operator,
      apply: async () => {
        throw denied;
      },
    }),
  ).toEqual({ status: "refused", message: "The change wasn't saved. This account isn't allowed to use Meat Ops." });
  expect(
    await decideDismiss(DISMISS, {
      caller: operator,
      dismiss: async () => {
        throw denied;
      },
    }),
  ).toEqual({ status: "refused", message: "The alert wasn't dismissed. This account isn't allowed to use Meat Ops." });
});

it("AC-0111: a saved reprice names the code and the stored price, and sends the parsed price", async () => {
  const sent: unknown[] = [];
  const state = await decideReprice(REPRICE, {
    caller: operator,
    apply: async (client, alertId, price) => {
      sent.push([client, alertId, price]);
      return product(3.29);
    },
  });
  expect(state).toEqual({ status: "saved", message: "List price for 502 saved: $3.29/lb." });
  expect(sent).toEqual([[null, ALERT_ID, 3.29]]);
});

it("AC-0115: a dismissed alert says so", async () => {
  expect(await decideDismiss(DISMISS, { caller: operator, dismiss: async () => ({ id: ALERT_ID }) })).toEqual({
    status: "dismissed",
    message: "Alert dismissed.",
  });
});

it("a write that resolves with no row is a write with no answer", async () => {
  silence();
  expect(await decideReprice(REPRICE, { caller: operator, apply: async () => null as unknown as Product })).toEqual({
    status: "refused",
    message: "The change may not have been saved. Reload this page to check it.",
  });
  expect(await decideDismiss(DISMISS, { caller: operator, dismiss: async () => null })).toEqual({
    status: "refused",
    message: "The alert may have been dismissed. Reload this page to check it.",
  });
});

// ---- The digest decision (alerts spec: Digest outcome order) ----

const TODAY = "2026-10-13";
const FACTS = "Today is Oct 13, 2026. Open alerts: 1. Urgent: 1.";
const PARAGRAPHS = ["502 is below target."];
const TRY_AGAIN_DIGEST = "Today's digest wasn't written. Try again in a moment.";
const KEY_REFUSED_DIGEST =
  "Today's digest wasn't written. The model service refused the app's key. Check ANTHROPIC_API_KEY in the app's .env file.";
const claimed: DigestClaim = { result: "claimed", paragraphs: null, failureKind: null };

// Every outside call counts its calls, so a test can see which were reached.
function digestDeps(over: Partial<DigestDeps<null>> = {}) {
  const calls = { claim: [] as unknown[], facts: 0, write: [] as unknown[], finish: [] as unknown[] };
  const deps: DigestDeps<null> = {
    caller: operator,
    modelReady: () => ({ ok: true }),
    claim: async (...args) => {
      calls.claim.push(args);
      return claimed;
    },
    readFacts: async () => {
      calls.facts += 1;
      return { facts: FACTS, codes: ["502"] };
    },
    write: async (...args): Promise<DigestModelResult> => {
      calls.write.push(args);
      return { ok: true, paragraphs: PARAGRAPHS };
    },
    finish: async (...args) => {
      calls.finish.push(args);
      return { digest_date: TODAY };
    },
    ...over,
  };
  return { calls, deps };
}

const SENT = { today: TODAY, automatic: true };

it("AC-0124 and AC-0125: an ended session and a non-operator send and store nothing", async () => {
  for (const [status, message] of [
    ["ended", "You're signed out. Sign in again to see today's digest."],
    ["not-operator", "Today's digest wasn't written. This account isn't allowed to use Meat Ops."],
  ] as const) {
    const { calls, deps } = digestDeps({ caller: async () => ({ status }) });
    expect(await decideDigest(SENT, deps)).toEqual({ status: "refused", message, retry: false });
    expect(calls).toEqual({ claim: [], facts: 0, write: [], finish: [] });
  }
});

it("AC-0126: a caller check that gets no answer or an error other than 42501 says try again, logs once, and sends nothing", async () => {
  for (const error of [new Error("fetch failed"), new RpcError("isOperator failed: boom", "XX000")]) {
    const log = silence();
    const { calls, deps } = digestDeps({ caller: async () => ({ status: "failed", error }) });
    expect(await decideDigest(SENT, deps)).toEqual({ status: "refused", message: TRY_AGAIN_DIGEST, retry: true });
    expect(calls).toEqual({ claim: [], facts: 0, write: [], finish: [] });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(/^writeDigest failed at before-write: /);
    log.mockRestore();
  }
});

it("AC-0086 and AC-0087: no key or no model address says so before any claim, request, or store", async () => {
  const cases = [
    ["not-set-up", "The digest isn't set up. Set ANTHROPIC_API_KEY in the app's .env file, then restart the app."],
    [
      "address-refused",
      "The digest isn't set up. ANTHROPIC_BASE_URL must be unset, or a loopback address for tests. Fix it, then restart the app.",
    ],
  ] as const;
  for (const [kind, message] of cases) {
    const log = silence();
    const { calls, deps } = digestDeps({ modelReady: () => ({ ok: false, kind }) });
    expect(await decideDigest(SENT, deps)).toEqual({ status: "refused", message, retry: false });
    expect(calls).toEqual({ claim: [], facts: 0, write: [], finish: [] });
    expect(log.mock.calls).toEqual([[`writeDigest failed: kind=${kind}`]]);
    log.mockRestore();
  }
});

it("the session and caller outcomes come before the key", async () => {
  const { calls, deps } = digestDeps({ caller: async () => ({ status: "ended" }), modelReady: () => ({ ok: false, kind: "not-set-up" }) });
  expect((await decideDigest(SENT, deps)).status).toBe("refused");
  expect(calls.claim).toEqual([]);
});

it("AC-0126: a claim call that gets no answer or is refused says try again, logs once, and sends nothing", async () => {
  for (const error of [new Error("fetch failed"), new RpcError("startDigest failed: boom", "XX000")]) {
    const log = silence();
    const { calls, deps } = digestDeps({
      claim: async () => {
        throw error;
      },
    });
    expect(await decideDigest(SENT, deps)).toEqual({ status: "refused", message: TRY_AGAIN_DIGEST, retry: true });
    expect(calls).toEqual({ claim: [], facts: 0, write: [], finish: [] });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(/^writeDigest failed at before-write: /);
    log.mockRestore();
  }
});

it("AC-0198, AC-0084, AC-0089, AC-0204: what the claim says ends the action without a request or a store", async () => {
  const cases: ReadonlyArray<[DigestClaim, unknown]> = [
    [{ result: "none", paragraphs: null, failureKind: null }, { status: "notice", message: "No open alerts." }],
    [
      { result: "written", paragraphs: ["Stored."], failureKind: null },
      { status: "written", paragraphs: ["Stored."] },
    ],
    [
      { result: "busy", paragraphs: null, failureKind: null },
      { status: "notice", message: "Today's digest is being written. Reload this page in a minute." },
    ],
    [
      { result: "failed", paragraphs: null, failureKind: "key-refused" },
      { status: "refused", message: KEY_REFUSED_DIGEST, retry: true },
    ],
    [
      { result: "failed", paragraphs: null, failureKind: "service-error" },
      { status: "refused", message: TRY_AGAIN_DIGEST, retry: true },
    ],
    [{ result: "stale", paragraphs: null, failureKind: null }, { status: "refused", message: TRY_AGAIN_DIGEST, retry: true }],
  ];
  for (const [claim, expected] of cases) {
    const log = silence();
    const { calls, deps } = digestDeps({ claim: async () => claim });
    expect(await decideDigest(SENT, deps), claim.result).toEqual(expected);
    expect(calls.facts, claim.result).toBe(0);
    expect(calls.write, claim.result).toEqual([]);
    expect(calls.finish, claim.result).toEqual([]);
    expect(log, claim.result).not.toHaveBeenCalled();
    log.mockRestore();
  }
});

it("the claim gets the app's date and the kind of send", async () => {
  const { calls, deps } = digestDeps();
  await decideDigest({ today: TODAY, automatic: false }, deps);
  expect(calls.claim).toEqual([[null, TODAY, false]]);
});

it("a written digest sends the facts once, stores the paragraphs, and logs nothing", async () => {
  const log = silence();
  const { calls, deps } = digestDeps();
  expect(await decideDigest(SENT, deps)).toEqual({ status: "written", paragraphs: PARAGRAPHS });
  expect(calls.write).toEqual([[FACTS, ["502"]]]);
  expect(calls.finish).toEqual([[null, TODAY, { paragraphs: PARAGRAPHS }]]);
  expect(log).not.toHaveBeenCalled();
});

// One exact log line per kind (AC-0127), each with the day finished as failed
// with that kind (AC-0200). The failing error carries a key, the facts, and a
// product description; none of it may reach the log.
const SECRETS = "sk-ant-sentinel-key 502 Smoked Turkey Drums Tom At your list price of $2.68/lb";
const FAILURES: ReadonlyArray<{
  name: string;
  deps: Partial<DigestDeps<null>>;
  kind: string;
  line: string;
  message: string;
}> = [
  {
    name: "a failed facts read",
    deps: {
      readFacts: async () => {
        throw new Error(SECRETS);
      },
    },
    kind: "facts-failed",
    line: "writeDigest failed: kind=facts-failed",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "a refused key",
    deps: { write: async () => ({ ok: false, kind: "key-refused", status: 401 }) },
    kind: "key-refused",
    line: "writeDigest failed: kind=key-refused status=401",
    message: KEY_REFUSED_DIGEST,
  },
  {
    name: "a 403",
    deps: { write: async () => ({ ok: false, kind: "key-refused", status: 403 }) },
    kind: "key-refused",
    line: "writeDigest failed: kind=key-refused status=403",
    message: KEY_REFUSED_DIGEST,
  },
  {
    name: "no answer in time",
    deps: { write: async () => ({ ok: false, kind: "no-answer" }) },
    kind: "no-answer",
    line: "writeDigest failed: kind=no-answer",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "an error status",
    deps: { write: async () => ({ ok: false, kind: "service-error", status: 529 }) },
    kind: "service-error",
    line: "writeDigest failed: kind=service-error status=529",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "a dropped connection",
    deps: { write: async () => ({ ok: false, kind: "service-error" }) },
    kind: "service-error",
    line: "writeDigest failed: kind=service-error",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "a declined answer",
    deps: { write: async () => ({ ok: false, kind: "declined" }) },
    kind: "declined",
    line: "writeDigest failed: kind=declined",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "a too-long answer",
    deps: { write: async () => ({ ok: false, kind: "too-long" }) },
    kind: "too-long",
    line: "writeDigest failed: kind=too-long",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "an unreadable answer",
    deps: { write: async () => ({ ok: false, kind: "unreadable" }) },
    kind: "unreadable",
    line: "writeDigest failed: kind=unreadable",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "an unfaithful answer",
    deps: { write: async () => ({ ok: false, kind: "unfaithful" }) },
    kind: "unfaithful",
    line: "writeDigest failed: kind=unfaithful",
    message: TRY_AGAIN_DIGEST,
  },
  {
    name: "a model call that throws",
    deps: {
      write: async () => {
        throw new Error(SECRETS);
      },
    },
    kind: "service-error",
    line: "writeDigest failed: kind=service-error",
    message: TRY_AGAIN_DIGEST,
  },
];

it("AC-0127 and AC-0200: each failure after the claim logs its one exact line and finishes the day as failed with its kind", async () => {
  for (const failure of FAILURES) {
    const log = silence();
    const { calls, deps } = digestDeps(failure.deps);
    expect(await decideDigest(SENT, deps), failure.name).toEqual({
      status: "refused",
      message: failure.message,
      retry: true,
    });
    expect(log.mock.calls, failure.name).toEqual([[failure.line]]);
    expect(calls.finish, failure.name).toEqual([[null, TODAY, { failureKind: failure.kind }]]);
    log.mockRestore();
  }
});

it("a failure before the model call sends no request", async () => {
  const log = silence();
  const { calls, deps } = digestDeps({
    readFacts: async () => {
      throw new Error("facts");
    },
  });
  await decideDigest(SENT, deps);
  expect(calls.write).toEqual([]);
  log.mockRestore();
});

it("AC-0127, AC-0200: a store of the paragraphs with no answer or refused logs store-failed and does not finish the day as failed", async () => {
  for (const error of [new Error(SECRETS), new RpcError("finishDigest failed: refused", "42501")]) {
    const log = silence();
    const { calls, deps } = digestDeps({
      finish: async (...args) => {
        calls.finish.push(args);
        throw error;
      },
    });
    expect(await decideDigest(SENT, deps)).toEqual({ status: "refused", message: TRY_AGAIN_DIGEST, retry: true });
    expect(log.mock.calls).toEqual([["writeDigest failed: kind=store-failed"]]);
    expect(calls.finish).toEqual([[null, TODAY, { paragraphs: PARAGRAPHS }]]);
    log.mockRestore();
  }
});

it("a store that resolves with no row is a store with no answer", async () => {
  const log = silence();
  const { calls, deps } = digestDeps({ finish: async () => null });
  expect((await decideDigest(SENT, deps)).status).toBe("refused");
  expect(log.mock.calls).toEqual([["writeDigest failed: kind=store-failed"]]);
  expect(calls.finish).toEqual([]);
});

it("AC-0207 and AC-0208: when the call that records a failure gets no answer or is refused, the failure's message comes back, the recording is not repeated, and only the failure's line is logged", async () => {
  for (const failure of FAILURES) {
    for (const error of [new Error(SECRETS), new RpcError("finishDigest failed: refused", "P0001")]) {
      const log = silence();
      const attempts: unknown[] = [];
      const { deps } = digestDeps({
        ...failure.deps,
        finish: async (...args) => {
          attempts.push(args);
          throw error;
        },
      });
      expect(await decideDigest(SENT, deps), failure.name).toEqual({
        status: "refused",
        message: failure.message,
        retry: true,
      });
      expect(attempts, failure.name).toHaveLength(1);
      expect(log.mock.calls, failure.name).toEqual([[failure.line]]);
      log.mockRestore();
    }
  }
});

it("AC-0127: no log line holds the key, the facts, or a product description", async () => {
  for (const failure of FAILURES) {
    const log = silence();
    const { deps } = digestDeps(failure.deps);
    await decideDigest(SENT, deps);
    const logged = JSON.stringify(log.mock.calls);
    for (const secret of ["sk-ant", "Smoked Turkey", "list price", FACTS]) {
      expect(logged, `${failure.name}: ${secret}`).not.toContain(secret);
    }
    log.mockRestore();
  }
});
