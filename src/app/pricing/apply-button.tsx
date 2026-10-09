"use client";

import { useRef, useState, type FormEvent } from "react";
import { CHANGE_UNKNOWN } from "../../lib/failures";
import { priceFieldText } from "../../lib/format";
import { priceButtonName, type PriceAction } from "../../lib/price-advice";
import { saveListPrice } from "./actions";
import type { ChangeState } from "./save-change";

// One press stores the price the button names, the suggested list price the
// page showed (AC-0067). The result goes to the page's message region, which the
// list owns, because a saved product leaves this card for another group.
export function ApplyButton({
  productId,
  action,
  suggestedListPrice,
  onResult,
}: {
  productId: string;
  action: PriceAction;
  suggestedListPrice: number;
  onResult: (state: ChangeState) => void;
}) {
  const [pending, setPending] = useState(false);
  // Set at once on press, because state updates land a render later.
  const pendingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    // Read before the first await: the event's form is gone after it.
    const formData = new FormData(event.currentTarget);
    pendingRef.current = true;
    setPending(true);
    let state: ChangeState;
    try {
      state = await saveListPrice(formData);
    } catch {
      // A dropped connection or a server error: the change may have been saved.
      state = { status: "refused", message: CHANGE_UNKNOWN };
    }
    pendingRef.current = false;
    setPending(false);
    onResult(state);
  }

  return (
    <form onSubmit={submit} className="mt-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="value" value={priceFieldText(suggestedListPrice)} />
      <button
        type="submit"
        aria-disabled={pending ? true : undefined}
        className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:opacity-60"
      >
        {priceButtonName(action, suggestedListPrice)}
      </button>
      {/* The status is in the card before it has text, so "Saving…" is announced. */}
      <p role="status" className="text-base text-ink-secondary">
        {pending ? "Saving…" : null}
      </p>
    </form>
  );
}
