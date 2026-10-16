// The reprice and dismiss decisions, apart from the "use server" wrapper so
// Vitest can import them: nothing here touches next/*, server-only, or
// src/app/_server. Every outside call is an argument, so a test can make any
// one fail. The outcome orders are the alerts spec's (Change outcome order,
// Dismiss outcome order, Digest outcome order).
import {
  actionFailureLogLine,
  CHANGE_SIGNED_OUT,
  changeFailureMessage,
  DIGEST_ADDRESS_REFUSED,
  DIGEST_BUSY,
  DIGEST_NOT_ALLOWED,
  DIGEST_NOT_SET_UP,
  DIGEST_SIGNED_OUT,
  DIGEST_TRY_AGAIN,
  digestFailureLogLine,
  digestFailureMessage,
  DISMISS_SIGNED_OUT,
  dismissFailureMessage,
  NO_OPEN_ALERTS,
  NOT_ALLOWED,
  NOT_DISMISSED,
  NOT_SAVED_CHANGE,
  type DigestFailureKind,
  type FailureStage,
  type LoggedAction,
} from "../../lib/failures";
import { formatPricePerLb } from "../../lib/format";
import type { FailureKind } from "../../lib/invoice-reading";
import { parseListPrice } from "../../lib/price-input";
import type { DigestClaim, Product } from "../../lib/rpc";
import type { ModelReadiness } from "../invoices/read-invoice";

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

// ---- The digest ----

// What the digest action returns. A notice is not a failure: no open alert, or
// another write holds the day. A refused outcome carries Try again when pressing
// it can help.
export type DigestState =
  | { status: "written"; paragraphs: string[] }
  | { status: "notice"; message: string }
  | { status: "refused"; message: string; retry: boolean };

// What model.ts returns for a sent request: the checked paragraphs, or a failure
// kind with the model service's status when there is one.
export type DigestModelResult =
  | { ok: true; paragraphs: string[] }
  | { ok: false; kind: FailureKind | "unfaithful"; status?: number };

export interface DigestDeps<C> {
  caller: () => Promise<CallerOutcome<C>>;
  modelReady: () => ModelReadiness;
  claim: (client: C, date: string, automatic: boolean) => Promise<DigestClaim>;
  readFacts: (client: C) => Promise<{ facts: string; codes: string[] }>;
  write: (facts: string, codes: readonly string[]) => Promise<DigestModelResult>;
  finish: (client: C, date: string, outcome: { paragraphs: string[] } | { failureKind: string }) => Promise<unknown>;
}

// `today` is the app's today, `automatic` is true for the send the page makes on
// its own and false for Try again.
//
// The spec's digest outcome order: the session, the caller, the key, the model
// address, the claim, then what the claim says. A claimed day is finished as
// failed with the outcome's kind after every outcome but a written digest and a
// failed store of its paragraphs (AC-0200). The failure's one log line comes
// first; the recording call logs nothing, and when it gets no answer or is
// refused the failure's message is still returned (AC-0207, AC-0208).
export async function decideDigest<C>(
  request: { today: string; automatic: boolean },
  deps: DigestDeps<C>,
): Promise<DigestState> {
  const { today, automatic } = request;
  const refused = (message: string, retry = false): DigestState => ({ status: "refused", message, retry });

  const caller = await deps.caller();
  if (caller.status === "ended") return refused(DIGEST_SIGNED_OUT);
  if (caller.status === "not-operator") return refused(DIGEST_NOT_ALLOWED);
  if (caller.status === "failed") {
    console.error(actionFailureLogLine("writeDigest", "before-write", caller.error));
    return refused(DIGEST_TRY_AGAIN, true);
  }
  const { client } = caller;

  const ready = deps.modelReady();
  if (!ready.ok) {
    console.error(digestFailureLogLine(ready.kind));
    return refused(ready.kind === "not-set-up" ? DIGEST_NOT_SET_UP : DIGEST_ADDRESS_REFUSED);
  }

  let claim: DigestClaim;
  try {
    claim = await deps.claim(client, today, automatic);
  } catch (error) {
    console.error(actionFailureLogLine("writeDigest", "before-write", error));
    return refused(DIGEST_TRY_AGAIN, true);
  }
  if (claim.result === "none") return { status: "notice", message: NO_OPEN_ALERTS };
  if (claim.result === "written") return { status: "written", paragraphs: claim.paragraphs ?? [] };
  if (claim.result === "busy") return { status: "notice", message: DIGEST_BUSY };
  if (claim.result === "failed") return refused(digestFailureMessage(claim.failureKind), true);
  if (claim.result === "stale") return refused(DIGEST_TRY_AGAIN, true);

  // Claimed: from here the day is ours to finish.
  const fail = async (kind: DigestFailureKind, status?: number): Promise<DigestState> => {
    console.error(digestFailureLogLine(kind, status));
    try {
      if (!(await deps.finish(client, today, { failureKind: kind }))) throw new Error("the write returned no digest");
    } catch {
      // The message below is the same either way, and the line above is the only one.
    }
    return refused(digestFailureMessage(kind), true);
  };

  let read: { facts: string; codes: string[] };
  try {
    read = await deps.readFacts(client);
  } catch {
    return fail("facts-failed");
  }

  let answer: DigestModelResult;
  try {
    answer = await deps.write(read.facts, read.codes);
  } catch {
    answer = { ok: false, kind: "service-error" };
  }
  if (!answer.ok) return fail(answer.kind, answer.status);

  try {
    if (!(await deps.finish(client, today, { paragraphs: answer.paragraphs }))) {
      throw new Error("the write returned no digest");
    }
  } catch {
    // The day stays writing, so no further finish call (AC-0200).
    console.error(digestFailureLogLine("store-failed"));
    return refused(DIGEST_TRY_AGAIN, true);
  }
  return { status: "written", paragraphs: answer.paragraphs };
}
