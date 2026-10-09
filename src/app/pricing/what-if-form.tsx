"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { parseWhatIf, type WhatIfField } from "../../lib/price-input";

type Errors = Partial<Record<WhatIfField, string>>;

const IDS: Record<WhatIfField, string> = { rawCode: "what-if-raw", cost: "what-if-cost" };
const ORDER: WhatIfField[] = ["rawCode", "cost"];
const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";

export interface RawChoice {
  code: string;
  description: string;
}

// The what-if is a GET form: the browser checks the fields, then moves to
// /pricing?raw=<code>&cost=<text>, and the server renders the results. The
// fields keep what was typed. `urlErrors` are the errors the server found in a
// URL that was typed or bookmarked instead of sent by this form.
export function WhatIfForm({
  rawProducts,
  rawCode,
  cost,
  urlErrors,
}: {
  rawProducts: RawChoice[];
  rawCode: string;
  cost: string;
  urlErrors: Errors;
}) {
  const router = useRouter();
  const known = new Set(rawProducts.map((product) => product.code));
  // A code the picker does not list (AC-0125) leaves it on "none chosen".
  const [raw, setRaw] = useState(known.has(rawCode) ? rawCode : "");
  const [costText, setCostText] = useState(cost);
  const [errors, setErrors] = useState<Errors>(urlErrors);

  // After Back or Forward the URL changes under the form, so the fields and
  // their errors are read again from the props. A key on the form would drop
  // focus from Show prices, so the state is set during render instead.
  const urlKey = JSON.stringify([rawCode, cost, urlErrors]);
  const [seenKey, setSeenKey] = useState(urlKey);
  if (seenKey !== urlKey) {
    setSeenKey(urlKey);
    setRaw(known.has(rawCode) ? rawCode : "");
    setCostText(cost);
    setErrors(urlErrors);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseWhatIf({ rawCode: raw, cost: costText });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = ORDER.find((field) => parsed.errors[field]);
      if (first) document.getElementById(IDS[first])?.focus();
      return;
    }
    setErrors({});
    const query = new URLSearchParams({ raw: parsed.value.rawCode, cost: costText });
    router.push(`/pricing?${query.toString()}`, { scroll: false });
  }

  function describe(field: WhatIfField) {
    return errors[field] ? { "aria-invalid": true, "aria-describedby": `${IDS[field]}-error` } : {};
  }

  function fieldError(field: WhatIfField) {
    const message = errors[field];
    return message ? (
      <p id={`${IDS[field]}-error`} role="alert" className="mt-1 break-words text-base font-medium text-error">
        {message}
      </p>
    ) : null;
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor={IDS.rawCode} className="block text-base font-medium">
          Raw product
        </label>
        <select
          id={IDS.rawCode}
          name="raw"
          value={raw}
          onChange={(event) => setRaw(event.target.value)}
          className={CONTROL}
          {...describe("rawCode")}
        >
          <option value=""></option>
          {rawProducts.map((product) => (
            <option key={product.code} value={product.code}>
              {product.code} {product.description}
            </option>
          ))}
        </select>
        {fieldError("rawCode")}
      </div>
      <div>
        <label htmlFor={IDS.cost} className="block text-base font-medium">
          Raw cost per lb
        </label>
        <input
          id={IDS.cost}
          name="cost"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={costText}
          onChange={(event) => setCostText(event.target.value)}
          className={`${CONTROL} tabular-nums`}
          {...describe("cost")}
        />
        {fieldError("cost")}
      </div>
      <button type="submit" className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary">
        Show prices
      </button>
    </form>
  );
}
