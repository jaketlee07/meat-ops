import { afterEach, expect, it, vi } from "vitest";
import { decideDismiss, decideReprice, type CallerOutcome } from "../src/app/alerts/decide.js";
import { RpcError, type Product } from "../src/lib/rpc.js";

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
