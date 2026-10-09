import { expect, it } from "vitest";
import { decideChange, type ChangeDeps } from "../src/app/pricing/save-change.js";
import { RpcError } from "../src/lib/rpc.js";

// STUB: AC-0117
it("AC-0117: a refusal from the write because the caller is not an operator", async () => {
  const deps: ChangeDeps<null> = {
    caller: async () => ({ status: "operator", client: null }),
    write: async () => {
      throw new RpcError("setListPrice failed: set_list_price: not allowed (caller is not an operator)", "42501");
    },
  };
  expect(await decideChange({ kind: "list-price", productId: "33333333-3333-3333-3333-333333333333", value: "3.29" }, deps)).toEqual({
    status: "refused",
    message: "The change wasn't saved. This account isn't allowed to use Meat Ops.",
  });
});

import { afterEach, vi } from "vitest";
import type { Product } from "../src/lib/rpc.js";

const PRODUCT_ID = "33333333-3333-3333-3333-333333333333";
const operator = async () => ({ status: "operator" as const, client: null });

function product(over: Partial<Product>): Product {
  return { id: PRODUCT_ID, code: "502", list_price_per_lb: null, target_margin_pct: null, ...over } as Product;
}

function silence() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

function noWrite() {
  const calls: unknown[] = [];
  const write = async (...args: unknown[]): Promise<Product> => {
    calls.push(args);
    throw new Error("unreachable");
  };
  return { calls, write };
}

afterEach(() => vi.restoreAllMocks());

it("AC-0110: the session ended, so nothing is written", async () => {
  const { calls, write } = noWrite();
  const state = await decideChange(
    { kind: "list-price", productId: PRODUCT_ID, value: "3.29" },
    { caller: async () => ({ status: "ended" }), write },
  );
  expect(state).toEqual({ status: "refused", message: "You're signed out. Sign in again to save this change." });
  expect(calls).toEqual([]);
});

it("AC-0109: a signed-in account that is not an operator is refused, nothing is written", async () => {
  const { calls, write } = noWrite();
  const state = await decideChange(
    { kind: "target", productId: PRODUCT_ID, value: "20" },
    { caller: async () => ({ status: "not-operator" }), write },
  );
  expect(state).toEqual({
    status: "refused",
    message: "The change wasn't saved. This account isn't allowed to use Meat Ops.",
  });
  expect(calls).toEqual([]);
});

it("AC-0113 and AC-0144: a caller check that fails says try again, logs once, writes nothing", async () => {
  const log = silence();
  const { calls, write } = noWrite();
  const state = await decideChange(
    { kind: "remove-target", productId: PRODUCT_ID, value: "" },
    { caller: async () => ({ status: "failed", error: new Error("fetch failed") }), write },
  );
  expect(state).toEqual({ status: "refused", message: "The change wasn't saved. Try again in a moment." });
  expect(calls).toEqual([]);
  expect(log).toHaveBeenCalledTimes(1);
  expect(log.mock.calls[0]?.[0]).toBe("removeTargetMargin failed at before-write: fetch failed");
});

it("AC-0112: a value the form rule refuses returns the rule's message, nothing is written", async () => {
  const { calls, write } = noWrite();
  const target = await decideChange({ kind: "target", productId: PRODUCT_ID, value: "100" }, { caller: operator, write });
  expect(target).toEqual({ status: "invalid", fieldError: "A target margin must be below 100." });
  const price = await decideChange({ kind: "list-price", productId: PRODUCT_ID, value: "" }, { caller: operator, write });
  expect(price).toEqual({ status: "invalid", fieldError: "Enter the price per lb, like 3.29." });
  expect(calls).toEqual([]);
});

it("AC-0114: a write with no code in its error may have happened", async () => {
  const log = silence();
  const state = await decideChange(
    { kind: "list-price", productId: PRODUCT_ID, value: "3.29" },
    {
      caller: operator,
      write: async () => {
        throw new Error("setListPrice failed: fetch failed");
      },
    },
  );
  expect(state).toEqual({
    status: "refused",
    message: "The change may not have been saved. Reload this page to check it.",
  });
  expect(log).toHaveBeenCalledTimes(1);
  expect(log.mock.calls[0]?.[0]).toBe("saveListPrice failed at write: setListPrice failed: fetch failed");
});

it("AC-0116: a product made inactive is refused with its own reason", async () => {
  silence();
  const state = await decideChange(
    { kind: "target", productId: PRODUCT_ID, value: "20" },
    {
      caller: operator,
      write: async () => {
        throw new RpcError("setTargetMargin failed: set_target_margin: product 502 is inactive", "P0001");
      },
    },
  );
  expect(state).toEqual({
    status: "refused",
    message: "The change wasn't saved. This product is no longer active.",
  });
});

it("AC-0118: another engine refusal shows the engine's text", async () => {
  silence();
  const state = await decideChange(
    { kind: "list-price", productId: PRODUCT_ID, value: "3.29" },
    {
      caller: operator,
      write: async () => {
        throw new RpcError("setListPrice failed: set_list_price: product not found", "P0002");
      },
    },
  );
  expect(state).toEqual({ status: "refused", message: "The change wasn't saved. product not found" });
});

it("AC-0068 and AC-0102: a saved list price names the code and the stored price", async () => {
  const stored = product({ list_price_per_lb: 3.29 });
  let seen: unknown;
  const state = await decideChange(
    { kind: "list-price", productId: PRODUCT_ID, value: "3.29" },
    {
      caller: operator,
      write: async (_client, change) => {
        seen = change;
        return stored;
      },
    },
  );
  expect(seen).toEqual({ kind: "list-price", productId: PRODUCT_ID, value: 3.29 });
  expect(state).toEqual({ status: "saved", message: "List price for 502 saved: $3.29/lb.", product: stored });

  const whole = await decideChange(
    { kind: "list-price", productId: PRODUCT_ID, value: "3.5" },
    { caller: operator, write: async () => product({ list_price_per_lb: 3.5 }) },
  );
  expect(whole).toMatchObject({ status: "saved", message: "List price for 502 saved: $3.50/lb." });
});

it("AC-0092: a saved target shows the stored fraction as a percent, from the returned row", async () => {
  let seen: unknown;
  const state = await decideChange(
    { kind: "target", productId: PRODUCT_ID, value: "22.5" },
    {
      caller: operator,
      write: async (_client, change) => {
        seen = change;
        return product({ code: "502", target_margin_pct: 0.225 });
      },
    },
  );
  expect(seen).toEqual({ kind: "target", productId: PRODUCT_ID, value: 22.5 });
  expect(state).toMatchObject({ status: "saved", message: "Target margin for 502 saved: 22.5%." });
});

it("AC-0094: removing a target writes null and says removed", async () => {
  let seen: unknown;
  const state = await decideChange(
    { kind: "remove-target", productId: PRODUCT_ID, value: "ignored" },
    {
      caller: operator,
      write: async (_client, change) => {
        seen = change;
        return product({ target_margin_pct: null });
      },
    },
  );
  expect(seen).toEqual({ kind: "remove-target", productId: PRODUCT_ID, value: null });
  expect(state).toMatchObject({ status: "saved", message: "Target margin for 502 removed." });
});
