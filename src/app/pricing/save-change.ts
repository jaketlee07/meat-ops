// The change actions' decisions, apart from the "use server" wrapper so Vitest can
// import them: nothing here touches next/*, server-only, or src/app/_server.
import { formatMargin, formatPricePerLb } from "../../lib/format";
import {
  actionFailureLogLine,
  CHANGE_SIGNED_OUT,
  changeFailureMessage,
  NOT_ALLOWED,
  NOT_SAVED_CHANGE,
  type FailureStage,
  type LoggedAction,
} from "../../lib/failures";
import { parseListPrice, parseTargetMargin } from "../../lib/price-input";
import type { Product } from "../../lib/rpc";

export type ChangeKind = "list-price" | "target" | "remove-target";

// `value` is the field's text as typed; "remove-target" ignores it.
export interface ChangeRequest {
  kind: ChangeKind;
  productId: string;
  value: string;
}

// What the write receives: the number the form rule parsed, or null to remove a target.
export interface ChangeWrite {
  kind: ChangeKind;
  productId: string;
  value: number | null;
}

export type ChangeState =
  | { status: "idle" }
  // A form rule refused the value; nothing reached the database. The message is the rule's.
  | { status: "invalid"; fieldError: string }
  // The caller or the database refused the change; the message says why.
  | { status: "refused"; message: string }
  // The write returned. `product` is the stored row; `message` is the success text.
  | { status: "saved"; message: string; product: Product };

export type CallerOutcome<C> =
  | { status: "operator"; client: C }
  | { status: "ended" }
  | { status: "not-operator" }
  | { status: "failed"; error: unknown };

export interface ChangeDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  write: (client: C, change: ChangeWrite) => Promise<Product>;
}

const ACTION: Record<ChangeKind, LoggedAction> = {
  "list-price": "saveListPrice",
  target: "saveTargetMargin",
  "remove-target": "removeTargetMargin",
};

function failed(kind: ChangeKind, stage: FailureStage, error: unknown): ChangeState {
  console.error(actionFailureLogLine(ACTION[kind], stage, error));
  return { status: "refused", message: changeFailureMessage(error, stage) };
}

function savedMessage(kind: ChangeKind, product: Product): string {
  if (kind === "list-price") {
    return `List price for ${product.code} saved: ${formatPricePerLb(product.list_price_per_lb ?? Number.NaN)}.`;
  }
  if (kind === "target") {
    return `Target margin for ${product.code} saved: ${formatMargin(product.target_margin_pct ?? Number.NaN)}.`;
  }
  return `Target margin for ${product.code} removed.`;
}

// Settles who is calling first, then the form rule, then the write.
export async function decideChange<C>(request: ChangeRequest, deps: ChangeDeps<C>): Promise<ChangeState> {
  const { kind, productId } = request;
  const caller = await deps.caller();
  if (caller.status === "ended") return { status: "refused", message: CHANGE_SIGNED_OUT };
  if (caller.status === "not-operator") {
    return { status: "refused", message: `${NOT_SAVED_CHANGE} ${NOT_ALLOWED}` };
  }
  if (caller.status === "failed") return failed(kind, "before-write", caller.error);

  let value: number | null = null;
  if (kind !== "remove-target") {
    const parsed = kind === "target" ? parseTargetMargin(request.value) : parseListPrice(request.value);
    if (!parsed.ok) return { status: "invalid", fieldError: parsed.error };
    value = parsed.value;
  }

  try {
    const product = await deps.write(caller.client, { kind, productId, value });
    // A write that resolves with no row is a write with no answer.
    if (!product) throw new Error("the write returned no product");
    return { status: "saved", message: savedMessage(kind, product), product };
  } catch (error) {
    return failed(kind, "write", error);
  }
}
