"use client";

import { useRef, useState, type FormEvent } from "react";
import { CHANGE_UNKNOWN } from "../../lib/failures";
import { priceFieldText } from "../../lib/format";
import { priceButtonName, type PriceAction } from "../../lib/price-advice";
import { saveListPrice } from "./actions";
import type { AdviceLook } from "./price-advice-block";
import type { ChangeState } from "./save-change";

// One press stores the price the button names, the suggested list price the
// page showed (AC-0067). The result goes to the page's message region, which the
// list owns, because a saved product leaves this card for another group.
export function ApplyButton({
  productId,
  action,
  suggestedListPrice,
  onResult,
  look = "row",
}: {
  productId: string;
  action: PriceAction;
  suggestedListPrice: number;
  onResult: (state: ChangeState) => void;
  look?: AdviceLook;
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
    <form onSubmit={submit} className={look === "row" ? "price-table:shrink-0" : undefined}>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="value" value={priceFieldText(suggestedListPrice)} />
      <button
        type="submit"
        aria-disabled={pending ? true : undefined}
        className={`min-h-12 w-full rounded-control bg-primary px-3.5 text-base font-bold text-on-primary aria-disabled:bg-primary/60 ${look === "row" ? "price-table:min-h-control price-table:w-auto" : "wide:min-h-control"}`}
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
