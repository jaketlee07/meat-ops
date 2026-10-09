"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCostPerLb,
  formatMargin,
  formatPricePerLb,
  formatShrink,
  percentText,
  priceFieldText,
} from "../../lib/format";
import { parseListPrice, parseTargetMargin } from "../../lib/price-input";
import type { PricingDetail as Detail } from "../../lib/pricing";
import { removeTargetMargin, saveListPrice, saveTargetMargin } from "./actions";
import { ChangeForm } from "./change-form";
import { PriceAdviceBlock } from "./price-advice-block";
import type { ChangeState } from "./save-change";

interface Message {
  kind: "saved" | "refused";
  text: string;
}

const NO_TARGET_SENTENCE = "No target margin. The suggested price is cost per lb plus the margin fees.";

// A product's cost build-up, its advice, and the two forms. Every number comes
// from the database; this only picks words and formats. The component owns the
// message regions and the fields' text, because Apply, Save price, and Save
// target all end in the same two regions, and Apply fills the price field.
export function PricingDetail({ detail }: { detail: Detail }) {
  const [targetText, setTargetText] = useState(detail.targetMargin === null ? "" : percentText(detail.targetMargin));
  const [priceText, setPriceText] = useState(detail.listPrice === null ? "" : priceFieldText(detail.listPrice));
  const [targetError, setTargetError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const savedRef = useRef<HTMLDivElement>(null);
  const refusedRef = useRef<HTMLDivElement>(null);

  // Keyboard focus follows the message (AC-0134, AC-0137).
  useEffect(() => {
    if (!message) return;
    (message.kind === "saved" ? savedRef : refusedRef).current?.focus();
  }, [message]);

  // A saved field shows the stored value, not what was typed.
  function show(state: ChangeState) {
    if (state.status === "saved") {
      setTargetText(state.product.target_margin_pct === null ? "" : percentText(state.product.target_margin_pct));
      setPriceText(state.product.list_price_per_lb === null ? "" : priceFieldText(state.product.list_price_per_lb));
      setTargetError(null);
      setPriceError(null);
      setMessage({ kind: "saved", text: state.message });
    } else if (state.status === "refused") {
      setMessage({ kind: "refused", text: state.message });
    } else if (state.status === "invalid") {
      setMessage({ kind: "refused", text: state.fieldError });
    }
  }

  return (
    <div>
      <section aria-labelledby="detail-heading">
        <h2 id="detail-heading" className="mb-3 text-xl font-semibold break-words">
          {detail.code} {detail.description}
        </h2>
        <dl className="space-y-1 text-base tabular-nums">
          <Figure label="Raw input" value={detail.raw ? `${detail.raw.code} ${detail.raw.description}` : "None"} />
          <Figure
            label="Raw average cost"
            value={detail.rawAverageCost === null ? "None yet" : formatCostPerLb(detail.rawAverageCost)}
          />
          <Figure label="Shrink" value={detail.shrink === null ? "None yet" : formatShrink(detail.shrink)} />
          <Figure
            label="Cost after shrink"
            value={detail.costAfterShrink === null ? "None yet" : formatCostPerLb(detail.costAfterShrink)}
          />
          {detail.processingFees.map((fee) => (
            <Figure key={fee.name} label={fee.name} value={formatCostPerLb(fee.amountPerLb)} />
          ))}
          <Figure
            label="Cost per lb"
            value={detail.costPerLb === null ? "None yet" : formatCostPerLb(detail.costPerLb)}
          />
          {detail.targetMargin !== null && <Figure label="Target margin" value={formatMargin(detail.targetMargin)} />}
          {detail.targetMargin === null &&
            detail.marginFees.map((fee) => (
              <Figure key={fee.name} label={fee.name} value={formatCostPerLb(fee.amountPerLb)} />
            ))}
          <Figure
            label="Suggested price"
            value={detail.suggestedListPrice === null ? "No price yet" : formatPricePerLb(detail.suggestedListPrice)}
          />
        </dl>
        {detail.targetMargin === null && <p className="mt-2 break-words text-base">{NO_TARGET_SENTENCE}</p>}
        <dl className="mt-1 space-y-1 text-base tabular-nums">
          <Figure
            label="List price"
            value={detail.listPrice === null ? "No list price yet" : formatPricePerLb(detail.listPrice)}
          />
          <Figure
            label="Margin at list price"
            value={detail.marginAtList === null ? "None yet" : formatMargin(detail.marginAtList)}
          />
        </dl>
        <PriceAdviceBlock row={detail} onResult={show} />
      </section>
      {/* Both regions are in the page before they have text, so each message is announced. */}
      <div className="mt-4">
        <div
          id="change-saved"
          ref={savedRef}
          role="status"
          tabIndex={-1}
          className="break-words text-base font-medium text-success"
        >
          {message?.kind === "saved" ? message.text : null}
        </div>
        <div
          id="change-refused"
          ref={refusedRef}
          role="alert"
          tabIndex={-1}
          className="break-words text-base font-medium text-error"
        >
          {message?.kind === "refused" ? message.text : null}
        </div>
      </div>
      <ChangeForm
        id="target-margin"
        heading="Target margin"
        label="Target margin %"
        value={targetText}
        onValueChange={setTargetText}
        error={targetError}
        onError={setTargetError}
        productId={detail.productId}
        parse={parseTargetMargin}
        save={saveTargetMargin}
        saveLabel="Save target"
        remove={detail.targetMargin === null ? null : { label: "Remove target margin", action: removeTargetMargin }}
        onStart={() => setMessage(null)}
        onResult={show}
      />
      <ChangeForm
        id="list-price"
        heading="List price"
        label="List price per lb"
        value={priceText}
        onValueChange={setPriceText}
        error={priceError}
        onError={setPriceError}
        productId={detail.productId}
        parse={parseListPrice}
        save={saveListPrice}
        saveLabel="Save price"
        remove={null}
        onStart={() => setMessage(null)}
        onResult={show}
      />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-2">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
