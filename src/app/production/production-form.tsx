"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { parseBatchForm, type BatchField, type BatchFields, type BatchInput } from "../../lib/batch-input";
import { BATCH_SAVE_UNKNOWN } from "../../lib/failures";
import { saveBatch, type SaveState } from "./actions";
import { CheckStep, type CheckedProduct } from "./check-step";
import { FIELD_ORDER } from "./form-fields";
import { ResultPanel } from "./result-panel";

interface Props {
  // The page's product list: the active finished products as of the latest server render.
  products: CheckedProduct[];
  // The product code in this render's URL (?product=), or "" when it has none.
  // It fills the product field on the first render.
  urlCode: string;
  // The code the server rendered `region` for, or null when it rendered none.
  regionCode: string | null;
  // The chosen product and its raw input's stock, rendered on the server.
  region: ReactNode;
}

const FIELD_IDS: Record<BatchField, string> = {
  productCode: "product-code",
  rawLbs: "raw-lbs",
  finishedLbs: "finished-lbs",
  productionDate: "production-date",
  notes: "notes",
};

const IDLE: SaveState = { status: "idle" };
const NO_ERRORS: Partial<Record<BatchField, string>> = {};

const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";

// The date on this device, as YYYY-MM-DD.
function deviceToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

interface Check {
  fields: BatchFields;
  input: BatchInput;
  product: CheckedProduct;
}

export function ProductionForm({ products, urlCode, regionCode, region }: Props) {
  const router = useRouter();
  const [regionPending, startRegion] = useTransition();

  const known = new Map(products.map((product) => [product.code, product]));

  const [productCode, setProductCode] = useState(urlCode);
  const [rawLbs, setRawLbs] = useState("");
  const [finishedLbs, setFinishedLbs] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [notes, setNotes] = useState("");
  const [today, setToday] = useState("");

  // What the form shows after its last Save or confirmation.
  const [state, setState] = useState<SaveState>(IDLE);
  // The refusal or failure message above Save. Only a save result changes it: a
  // refused one replaces it and a saved one clears it, so a warning to check
  // Recent batches before saving again stays through field errors and Go back.
  const [banner, setBanner] = useState<string | null>(null);
  // The batch the check step is showing, or null while it is closed.
  const [check, setCheck] = useState<Check | null>(null);
  // A form whose code is missing from the page's list, held until the page has
  // been rendered again for that code and the rules can run over the new list.
  const [awaiting, setAwaiting] = useState<BatchFields | null>(null);
  const [saving, setSaving] = useState(false);
  // Set at once on confirm, because state updates land a render later.
  const savingRef = useRef(false);

  const saveRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // The date field starts at today's date on the device, read after mount so the
  // server and browser renders match. Save reads the date again (see submit).
  useEffect(() => {
    const date = deviceToday();
    setToday(date);
    setProductionDate((current) => current || date);
  }, []);

  // The browser's rules run the same code as the save action, so a typo is
  // refused at once. A form that passes them opens the check step.
  function evaluate(fields: BatchFields, list: Map<string, CheckedProduct>) {
    const parsed = parseBatchForm(fields, new Set(list.keys()));
    if (!parsed.ok) {
      setState({ status: "invalid", fieldErrors: parsed.errors });
      return;
    }
    // The form passes, so its field errors no longer apply. The banner is its own state.
    setState((current) => (current.status === "invalid" ? IDLE : current));
    const product = list.get(parsed.value.productCode);
    if (product) setCheck({ fields, input: parsed.value, product });
  }

  // Once the page has rendered again for a code missing from the old list, the
  // rules run over the new list: a product made active since the load is
  // accepted with its description and shrink, and a code still missing is refused.
  useEffect(() => {
    if (!awaiting || regionPending) return;
    setAwaiting(null);
    evaluate(awaiting, known);
  }, [awaiting, regionPending]);

  const blocked = products.length === 0;

  // The device date is read here, when Save is pressed, so a form left open past
  // midnight checks the new day. The date field's `max` takes it too.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || saving || awaiting) return;
    const date = deviceToday();
    setToday(date);
    const fields: BatchFields = { productCode, rawLbs, finishedLbs, productionDate, notes, today: date };
    const code = productCode.trim();
    if (code !== "" && !known.has(code)) {
      setAwaiting(fields);
      startRegion(() => {
        router.replace(`/production?product=${encodeURIComponent(code)}`, { scroll: false });
      });
      return;
    }
    evaluate(fields, known);
  }

  // Go back, Escape, or a finished save closes the step; focus returns to Save.
  function closeCheck() {
    setCheck(null);
    saveRef.current?.focus();
  }

  async function confirm() {
    if (!check || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const formData = new FormData();
    for (const [name, value] of Object.entries(check.fields)) formData.set(name, value);
    let next: SaveState;
    try {
      next = await saveBatch(formData);
    } catch {
      // A dropped connection or a server error: the batch may have been saved.
      // A rejected action reaches the error boundary, which would unmount this
      // form and lose every value, so it is answered here.
      next = { status: "refused", message: BATCH_SAVE_UNKNOWN };
    }
    savingRef.current = false;
    setSaving(false);
    setCheck(null);
    if (next.status === "refused") setBanner(next.message);
    else if (next.status === "saved") setBanner(null);
    setState(next);
  }

  const errors = state.status === "invalid" ? state.fieldErrors : NO_ERRORS;

  // Each result moves focus to what the owner needs next, and a saved batch
  // empties the fields that belong to one batch.
  useEffect(() => {
    if (state.status === "saved") {
      setRawLbs("");
      setFinishedLbs("");
      setNotes("");
      headingRef.current?.focus();
    } else if (state.status === "refused") {
      messageRef.current?.focus();
    } else if (state.status === "invalid") {
      const first = FIELD_ORDER.find((field) => state.fieldErrors[field]);
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
    }
  }, [state]);

  const code = productCode.trim();
  const chosen = known.get(code);

  // A known code in the field that the URL's ?product= does not name (the page
  // was reached again without it, as the current-page nav link does, or a late
  // answer for another code landed) asks for its region, as typing the code does.
  // The URL is the guard: a request that lands names the code in the URL, so a
  // render that still has no region cannot loop, and a request that a newer
  // navigation dropped or overtook leaves the URL naming something else, so it asks again.
  useEffect(() => {
    if (urlCode === code || regionPending || !known.has(code) || code === regionCode) return;
    startRegion(() => {
      router.replace(`/production?product=${encodeURIComponent(code)}`, { scroll: false });
    });
  }, [code, urlCode, regionCode, regionPending, products]);

  // An exact code loads that product's raw stock into the page through the URL.
  function changeProduct(value: string) {
    setProductCode(value);
    const next = value.trim();
    if (known.has(next) && next !== regionCode) {
      startRegion(() => {
        router.replace(`/production?product=${encodeURIComponent(next)}`, { scroll: false });
      });
    }
  }

  function describe(field: BatchField) {
    return errors[field] ? { "aria-invalid": true, "aria-describedby": `${FIELD_IDS[field]}-error` } : {};
  }

  function fieldError(field: BatchField): ReactNode {
    const message = errors[field];
    return message ? (
      <p id={`${FIELD_IDS[field]}-error`} className="mt-1 break-words text-base font-medium text-error">
        {message}
      </p>
    ) : null;
  }

  let hint = "";
  if (code === "") hint = "Type a product code to start.";
  else if (chosen) hint = chosen.description;

  return (
    <>
      <form onSubmit={submit} aria-labelledby="production-form-heading" noValidate className="space-y-4">
        <h2 id="production-form-heading" className="text-xl font-semibold">
          New batch
        </h2>

        {blocked && (
          <p id="setup-notice" className="text-base">
            No active finished products yet. Add one in Supabase Studio, then reload this page.
          </p>
        )}

        <div>
          <label htmlFor={FIELD_IDS.productCode} className="block text-base font-medium">
            Product code
          </label>
          <input
            id={FIELD_IDS.productCode}
            name="productCode"
            type="text"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={productCode}
            onChange={(event) => changeProduct(event.target.value)}
            className={CONTROL}
            aria-invalid={errors.productCode ? true : undefined}
            aria-describedby={errors.productCode ? `${FIELD_IDS.productCode}-error` : "product-hint"}
          />
          <p id="product-hint" aria-live="polite" className="mt-1 break-words text-base text-ink-secondary">
            {hint}
          </p>
          {fieldError("productCode")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.rawLbs} className="block text-base font-medium">
            Raw lbs
          </label>
          <input
            id={FIELD_IDS.rawLbs}
            name="rawLbs"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={rawLbs}
            onChange={(event) => setRawLbs(event.target.value)}
            className={`${CONTROL} tabular-nums`}
            {...describe("rawLbs")}
          />
          {fieldError("rawLbs")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.finishedLbs} className="block text-base font-medium">
            Finished lbs (optional)
          </label>
          <input
            id={FIELD_IDS.finishedLbs}
            name="finishedLbs"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={finishedLbs}
            onChange={(event) => setFinishedLbs(event.target.value)}
            className={`${CONTROL} tabular-nums`}
            {...describe("finishedLbs")}
          />
          {fieldError("finishedLbs")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.productionDate} className="block text-base font-medium">
            Production date
          </label>
          <input
            id={FIELD_IDS.productionDate}
            name="productionDate"
            type="date"
            max={today || undefined}
            value={productionDate}
            onChange={(event) => setProductionDate(event.target.value)}
            className={CONTROL}
            {...describe("productionDate")}
          />
          {fieldError("productionDate")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.notes} className="block text-base font-medium">
            Notes (optional)
          </label>
          <textarea
            id={FIELD_IDS.notes}
            name="notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={`${CONTROL} py-2`}
            {...describe("notes")}
          />
          {fieldError("notes")}
        </div>

        {/* The live region is in the page before it has text, so the refusal is announced. */}
        <div
          id="batch-message"
          ref={messageRef}
          role="alert"
          tabIndex={-1}
          className="break-words text-base font-medium text-error"
        >
          {banner}
        </div>

        <button
          ref={saveRef}
          type="submit"
          aria-disabled={blocked ? true : undefined}
          aria-describedby={blocked ? "setup-notice" : undefined}
          onClick={(event) => {
            if (blocked) event.preventDefault();
          }}
          className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:opacity-60"
        >
          Save
        </button>
      </form>

      {check && (
        <CheckStep
          input={check.input}
          product={check.product}
          saving={saving}
          onClose={closeCheck}
          onConfirm={confirm}
        />
      )}

      <ResultPanel state={state} headingRef={headingRef} />

      <div id="product-region" aria-busy={regionPending} className="mt-6 space-y-4">
        {chosen && chosen.code === regionCode ? region : null}
      </div>
    </>
  );
}
