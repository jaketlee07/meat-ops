"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { SALE_SAVE_UNKNOWN } from "../../lib/failures";
import { formatPricePerLb, formatWeight, priceFieldText } from "../../lib/format";
import { parseSaleForm, type SaleField, type SaleFields } from "../../lib/sale-input";
import type { Customer, SaleProduct } from "../../lib/sales";
import { Facts } from "../facts";
import { saveSale } from "./actions";
import { FIELD_ORDER } from "./form-fields";
import { ResultPanel } from "./result-panel";
import type { SaleSaveState } from "./save-sale";

interface Props {
  // The page's product list: the active finished products as of the latest server render.
  products: SaleProduct[];
  // Every customer, in the order the select shows them.
  customers: Customer[];
}

const FIELD_IDS: Record<SaleField, string> = {
  productCode: "product-code",
  lbs: "lbs",
  pricePerLb: "price-per-lb",
  customerId: "customer",
  saleDate: "sale-date",
};

const IDLE: SaleSaveState = { status: "idle" };
const NO_ERRORS: Partial<Record<SaleField, string>> = {};

const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";

// The date on this device, as YYYY-MM-DD.
function deviceToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function SaleForm({ products, customers }: Props) {
  const router = useRouter();
  const [listPending, startList] = useTransition();

  const known = new Map(products.map((product) => [product.code, product]));

  const [productCode, setProductCode] = useState("");
  const [lbs, setLbs] = useState("");
  const [pricePerLb, setPricePerLb] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saleDate, setSaleDate] = useState("");
  const [today, setToday] = useState("");
  // The code of the product the price field was last filled from, or null.
  const [filledFrom, setFilledFrom] = useState<string | null>(null);

  const [state, setState] = useState<SaleSaveState>(IDLE);
  // The refusal or failure message above Save. A refused save replaces it and a
  // saved one clears it, so the warning to check Recent sales stays through field errors.
  const [banner, setBanner] = useState<string | null>(null);
  // A form whose code is missing from the page's list, held until the page has
  // been rendered again and the rules can run over the new list.
  const [awaiting, setAwaiting] = useState<SaleFields | null>(null);
  const [saving, setSaving] = useState(false);
  // Set at once on press, because state updates land a render later.
  const savingRef = useRef(false);
  // Whether the latest invalid state came back from the save action, not the browser's rules.
  const fromServerRef = useRef(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  // The date field starts at today's date on the device, read after mount so the
  // server and browser renders match. Save reads the date again (see submit).
  useEffect(() => {
    const date = deviceToday();
    setToday(date);
    setSaleDate((current) => current || date);
  }, []);

  // The browser's rules run the same code as the save action, so a typo is
  // refused at once. A form that passes them is saved.
  function evaluate(fields: SaleFields, list: Map<string, SaleProduct>) {
    const parsed = parseSaleForm(fields, new Set(list.keys()), new Set(customers.map((customer) => customer.id)));
    if (!parsed.ok) {
      fromServerRef.current = false;
      setState({ status: "invalid", fieldErrors: parsed.errors });
      return;
    }
    // The form passes, so its field errors no longer apply. The banner is its own state.
    setState((current) => (current.status === "invalid" ? IDLE : current));
    void save(fields);
  }

  async function save(fields: SaleFields) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const formData = new FormData();
    for (const [name, value] of Object.entries(fields)) formData.set(name, value);
    let next: SaleSaveState;
    try {
      next = await saveSale(formData);
    } catch {
      // A dropped connection or a server error: the sale may have been saved.
      // A rejected action reaches the error boundary, which would unmount this
      // form and lose every value, so it is answered here.
      next = { status: "refused", message: SALE_SAVE_UNKNOWN };
    }
    savingRef.current = false;
    setSaving(false);
    if (next.status === "refused") setBanner(next.message);
    else if (next.status === "saved") {
      setBanner(null);
      // The customer and the date stay for the next product of the same order.
      setProductCode("");
      setLbs("");
      setPricePerLb("");
      setFilledFrom(null);
    }
    fromServerRef.current = next.status === "invalid";
    setState(next);
  }

  // Once the page has rendered again for a code missing from the old list, the
  // rules run over the new list: a product made active since the load is
  // accepted, and a code still missing is refused.
  useEffect(() => {
    if (!awaiting || listPending) return;
    setAwaiting(null);
    evaluate(awaiting, known);
  }, [awaiting, listPending]);

  const blocked = products.length === 0;
  // A wait for the page's list to reload counts as a pending save.
  const pending = saving || awaiting !== null;

  // The device date is read here, when Save is pressed, so a form left open past
  // midnight checks the new day. The date field's `max` takes it too.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || pending) return;
    const date = deviceToday();
    setToday(date);
    const fields: SaleFields = { productCode, lbs, pricePerLb, customerId, saleDate, today: date };
    const code = productCode.trim();
    if (code !== "" && !known.has(code)) {
      // The rules run again once the list is back, so old field errors do not sit beside "Saving…".
      setState((current) => (current.status === "invalid" ? IDLE : current));
      setAwaiting(fields);
      startList(() => {
        router.replace(`/sales?product=${encodeURIComponent(code)}`, { scroll: false });
      });
      return;
    }
    evaluate(fields, known);
  }

  const errors = state.status === "invalid" ? state.fieldErrors : NO_ERRORS;

  // Each result moves focus to what the owner needs next.
  useEffect(() => {
    if (state.status === "saved") {
      headingRef.current?.focus();
    } else if (state.status === "refused") {
      messageRef.current?.focus();
    } else if (state.status === "invalid") {
      // A customer refusal from the save action is a save refusal other than AC-0029: focus its message.
      if (fromServerRef.current && state.fieldErrors.customerId) {
        document.getElementById(`${FIELD_IDS.customerId}-error`)?.focus();
        return;
      }
      const first = FIELD_ORDER.find((field) => state.fieldErrors[field]);
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
    }
  }, [state]);

  // The price follows the code: when the field comes to name a product of the
  // page's list other than the one the price was filled from, it takes that
  // product's list price (or empties). A code not in the list leaves it alone.
  function changeProduct(value: string) {
    setProductCode(value);
    const product = known.get(value.trim());
    if (product && product.code !== filledFrom) {
      setFilledFrom(product.code);
      setPricePerLb(product.listPricePerLb === null ? "" : priceFieldText(product.listPricePerLb));
    }
  }

  function describe(field: SaleField) {
    return errors[field] ? { "aria-invalid": true, "aria-describedby": `${FIELD_IDS[field]}-error` } : {};
  }

  function fieldError(field: SaleField): ReactNode {
    const message = errors[field];
    return message ? (
      <p id={`${FIELD_IDS[field]}-error`} tabIndex={-1} className="mt-1 break-words text-base font-medium text-error">
        {message}
      </p>
    ) : null;
  }

  const chosen = known.get(productCode.trim());

  return (
    <>
      <form onSubmit={submit} aria-labelledby="sale-form-heading" noValidate className="space-y-4">
        <h2 id="sale-form-heading" className="text-xl font-semibold">
          New sale
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
            aria-describedby={errors.productCode ? `${FIELD_IDS.productCode}-error` : "product-facts"}
          />
          <div id="product-facts" aria-live="polite" className="mt-2">
            {chosen && (
              <Facts
                rows={[
                  ["Product", chosen.description],
                  [
                    "List price",
                    chosen.listPricePerLb === null ? "No list price yet" : formatPricePerLb(chosen.listPricePerLb),
                  ],
                  ["Finished on hand", formatWeight(chosen.finishedLbsAvailable)],
                ]}
              />
            )}
          </div>
          {fieldError("productCode")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.lbs} className="block text-base font-medium">
            Weight sold (lbs)
          </label>
          <input
            id={FIELD_IDS.lbs}
            name="lbs"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={lbs}
            onChange={(event) => setLbs(event.target.value)}
            className={`${CONTROL} tabular-nums`}
            {...describe("lbs")}
          />
          {fieldError("lbs")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.pricePerLb} className="block text-base font-medium">
            Price per lb ($)
          </label>
          <input
            id={FIELD_IDS.pricePerLb}
            name="pricePerLb"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={pricePerLb}
            onChange={(event) => setPricePerLb(event.target.value)}
            className={`${CONTROL} tabular-nums`}
            {...describe("pricePerLb")}
          />
          {fieldError("pricePerLb")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.customerId} className="block text-base font-medium">
            Customer
          </label>
          <select
            id={FIELD_IDS.customerId}
            name="customerId"
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className={CONTROL}
            {...describe("customerId")}
          >
            <option value="">No customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          {fieldError("customerId")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.saleDate} className="block text-base font-medium">
            Sale date
          </label>
          <input
            id={FIELD_IDS.saleDate}
            name="saleDate"
            type="date"
            max={today || undefined}
            value={saleDate}
            onChange={(event) => setSaleDate(event.target.value)}
            className={CONTROL}
            {...describe("saleDate")}
          />
          {fieldError("saleDate")}
        </div>

        {/* The live regions are in the page before they have text, so they are announced. */}
        <div
          id="sale-message"
          ref={messageRef}
          role="alert"
          tabIndex={-1}
          className="break-words text-base font-medium text-error"
        >
          {banner}
        </div>
        <div id="sale-saving" role="status" className="text-base text-ink-secondary">
          {pending ? "Saving…" : null}
        </div>

        <button
          type="submit"
          aria-disabled={blocked || pending ? true : undefined}
          aria-describedby={blocked ? "setup-notice" : undefined}
          onClick={(event) => {
            if (blocked || pending) event.preventDefault();
          }}
          className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:bg-primary/60"
        >
          Save sale
        </button>
      </form>

      <ResultPanel state={state} headingRef={headingRef} />
    </>
  );
}
