"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { parseLotFinder, parseSaleNumber } from "../../lib/sale-input";

const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";
const BUTTON = "w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary";
const SALE_ID = "find-sale-number";
const RAW_ID = "find-raw-code";
const RECEIVED_ID = "find-received";

// The heading (or the no-result sentence) of the result on the page; each view marks it.
function focusResult() {
  document.querySelector<HTMLElement>("[data-result-focus]")?.focus();
}

type LotErrors = { rawCode?: string; received?: string };

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={`${id}-error`} role="alert" className="mt-1 break-words text-base font-medium text-error">
      {message}
    </p>
  ) : null;
}

function describe(id: string, message?: string) {
  return message ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

// The two finders are GET-style forms: the browser checks the fields, then moves
// to /trace?sale=<number> or /trace?raw=<code>&received=<date>, and the server
// renders the result. Each form re-reads its own part of the URL after Back or
// Forward, so a lookup in one does not clear what was typed in the other.
// Any move to a new lookup after the page has loaded (a followed link, Show sale,
// Show lots, Back, Forward) puts focus on the new result; a page loaded from a
// typed or reloaded URL moves none.
export function FindForms({
  sale,
  lot,
  saleError,
  rawCode,
  received,
  lotErrors,
}: {
  sale: string;
  lot?: string;
  saleError?: string;
  rawCode: string;
  received: string;
  lotErrors: LotErrors;
}) {
  const lookup = JSON.stringify([sale, lot, rawCode, received]);
  const seen = useRef(lookup);
  useEffect(() => {
    if (seen.current === lookup) return;
    seen.current = lookup;
    focusResult();
  }, [lookup]);

  return (
    <div className="space-y-8">
      <FindSale sale={sale} urlError={saleError} />
      <FindLot rawCode={rawCode} received={received} urlErrors={lotErrors} />
    </div>
  );
}

function FindSale({ sale, urlError }: { sale: string; urlError?: string }) {
  const router = useRouter();
  const [text, setText] = useState(sale);
  const [error, setError] = useState(urlError);

  const urlKey = JSON.stringify([sale, urlError]);
  const [seenKey, setSeenKey] = useState(urlKey);
  if (seenKey !== urlKey) {
    setSeenKey(urlKey);
    setText(sale);
    setError(urlError);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseSaleNumber(text);
    if (!parsed.ok) {
      setError(parsed.error);
      document.getElementById(SALE_ID)?.focus();
      return;
    }
    setError(undefined);
    if (parsed.value === sale) {
      focusResult();
      return;
    }
    router.push(`/trace?${new URLSearchParams({ sale: parsed.value }).toString()}`, { scroll: false });
  }

  return (
    <section aria-labelledby="find-sale-heading">
      <h2 id="find-sale-heading" className="mb-3 text-xl font-semibold">
        Find a sale
      </h2>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor={SALE_ID} className="block text-base font-medium">
            Sale number
          </label>
          <input
            id={SALE_ID}
            name="sale"
            type="text"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={CONTROL}
            {...describe(SALE_ID, error)}
          />
          <FieldError id={SALE_ID} message={error} />
        </div>
        <button type="submit" className={BUTTON}>
          Show sale
        </button>
      </form>
    </section>
  );
}

function FindLot({ rawCode, received, urlErrors }: { rawCode: string; received: string; urlErrors: LotErrors }) {
  const router = useRouter();
  const [codeText, setCodeText] = useState(rawCode);
  const [dateText, setDateText] = useState(received);
  const [errors, setErrors] = useState<LotErrors>(urlErrors);

  const shown = JSON.stringify([rawCode, received]);

  const urlKey = JSON.stringify([rawCode, received, urlErrors]);
  const [seenKey, setSeenKey] = useState(urlKey);
  if (seenKey !== urlKey) {
    setSeenKey(urlKey);
    setCodeText(rawCode);
    setDateText(received);
    setErrors(urlErrors);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseLotFinder({ rawCode: codeText, received: dateText });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      const first = parsed.errors.rawCode ? RAW_ID : RECEIVED_ID;
      document.getElementById(first)?.focus();
      return;
    }
    setErrors({});
    const key = JSON.stringify([parsed.value.rawCode, parsed.value.received ?? ""]);
    if (key === shown) {
      focusResult();
      return;
    }
    const params = new URLSearchParams({ raw: parsed.value.rawCode });
    if (parsed.value.received !== undefined) params.set("received", parsed.value.received);
    router.push(`/trace?${params.toString()}`, { scroll: false });
  }

  return (
    <section aria-labelledby="find-lot-heading">
      <h2 id="find-lot-heading" className="mb-3 text-xl font-semibold">
        Find a raw lot
      </h2>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor={RAW_ID} className="block text-base font-medium">
            Raw product code
          </label>
          <input
            id={RAW_ID}
            name="raw"
            type="text"
            autoComplete="off"
            value={codeText}
            onChange={(event) => setCodeText(event.target.value)}
            className={CONTROL}
            {...describe(RAW_ID, errors.rawCode)}
          />
          <FieldError id={RAW_ID} message={errors.rawCode} />
        </div>
        <div>
          <label htmlFor={RECEIVED_ID} className="block text-base font-medium">
            Received date
          </label>
          <input
            id={RECEIVED_ID}
            name="received"
            type="date"
            value={dateText}
            onChange={(event) => setDateText(event.target.value)}
            className={CONTROL}
            {...describe(RECEIVED_ID, errors.received)}
          />
          <FieldError id={RECEIVED_ID} message={errors.received} />
        </div>
        <button type="submit" className={BUTTON}>
          Show lots
        </button>
      </form>
    </section>
  );
}
