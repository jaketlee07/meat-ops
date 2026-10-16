// The reprice and dismiss decisions, apart from the "use server" wrapper so
// Vitest can import them: nothing here touches next/*, server-only, or
// src/app/_server. Every outside call is an argument, so a test can make any
// one fail. The outcome orders are the alerts spec's (Change outcome order,
// Dismiss outcome order).
import {
  actionFailureLogLine,
  CHANGE_SIGNED_OUT,
  changeFailureMessage,
  DISMISS_SIGNED_OUT,
  dismissFailureMessage,
  NOT_ALLOWED,
  NOT_DISMISSED,
  NOT_SAVED_CHANGE,
  type FailureStage,
  type LoggedAction,
} from "../../lib/failures";
import { formatPricePerLb } from "../../lib/format";
import { parseListPrice } from "../../lib/price-input";
import type { Product } from "../../lib/rpc";

export type AlertActionState =
  // A form rule refused the price; nothing reached the database. The message is the rule's.
  | { status: "invalid"; fieldError: string }
  // The caller or the database refused it, or the call got no answer; the message says which.
  | { status: "refused"; message: string }
  | { status: "saved"; message: string }
  | { status: "dismissed"; message: string };

export type CallerOutcome<C> =
  | { status: "operator"; client: C }
  | { status: "ended" }
  | { status: "not-operator" }
  | { status: "failed"; error: unknown };

export interface RepriceDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  apply: (client: C, alertId: string, price: number) => Promise<Product>;
}

export interface DismissDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  dismiss: (client: C, alertId: string) => Promise<unknown>;
}

function failed(
  action: LoggedAction,
  stage: FailureStage,
  error: unknown,
  message: (error: unknown, stage: FailureStage) => string,
): AlertActionState {
  console.error(actionFailureLogLine(action, stage, error));
  return { status: "refused", message: message(error, stage) };
}

// `value` is the price field's text as sent; the list-price form rule parses it.
export async function decideReprice<C>(
  request: { alertId: string; value: string },
  deps: RepriceDeps<C>,
): Promise<AlertActionState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: CHANGE_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_SAVED_CHANGE} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") {
    return failed("applyAlertPrice", "before-write", caller.error, changeFailureMessage);
  }

  const parsed = parseListPrice(request.value);
  if (!parsed.ok) return { status: "invalid", fieldError: parsed.error };

  try {
    const product = await deps.apply(caller.client, request.alertId, parsed.value);
    // A write that resolves with no row is a write with no answer.
    if (!product) throw new Error("the write returned no product");
    return {
      status: "saved",
      message: `List price for ${product.code} saved: ${formatPricePerLb(product.list_price_per_lb ?? Number.NaN)}.`,
    };
  } catch (error) {
    return failed("applyAlertPrice", "write", error, changeFailureMessage);
  }
}

export async function decideDismiss<C>(request: { alertId: string }, deps: DismissDeps<C>): Promise<AlertActionState> {
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: DISMISS_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_DISMISSED} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") {
    return failed("dismissAlert", "before-write", caller.error, dismissFailureMessage);
  }

  try {
    const alert = await deps.dismiss(caller.client, request.alertId);
    if (!alert) throw new Error("the write returned no alert");
    return { status: "dismissed", message: "Alert dismissed." };
  } catch (error) {
    return failed("dismissAlert", "write", error, dismissFailureMessage);
  }
}
