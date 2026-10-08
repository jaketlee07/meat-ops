"use client";

import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { SAVE_UNKNOWN } from "../../lib/failures";
import { parseReceiptForm, type ReceiptField } from "../../lib/receipt-input";
import type { Vendor } from "../../lib/receiving";
import { saveReceipt, type SaveState } from "./actions";
import { FIELD_ORDER, readFields, readRecheck, RECHECK_FIELD } from "./form-fields";
import { ResultPanel } from "./result-panel";

export interface ProductChoice {
  code: string;
  description: string;
  species: string | null;
}

interface Props {
  products: ProductChoice[];
  vendors: Vendor[];
  // The code in the URL when the page loaded, shown in the product field.
  initialCode: string;
  // The code the server rendered `region` for, or null when it rendered none.
  regionCode: string | null;
  // The chosen product's stock and prices, rendered on the server.
  region: ReactNode;
  // The lot numbers the recent receipts list shows as void.
  voidedLots: string[];
}

const FIELD_IDS: Record<ReceiptField, string> = {
  productCode: "product-code",
  vendorId: "vendor",
  weight: "weight",
  cost: "cost",
  receivedDate: "received-date",
  notes: "notes",
};

const IDLE: SaveState = { status: "idle" };
const NO_ERRORS: Partial<Record<ReceiptField, string>> = {};
const NO_LOTS: readonly string[] = [];

const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";

// The date on this device, as YYYY-MM-DD.
function deviceToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function ReceiptForm({ products, vendors, initialCode, regionCode, region, voidedLots }: Props) {
  const router = useRouter();
  const [regionPending, startRegion] = useTransition();

  // The page's product list: the active raw products as of the latest server
  // render, so a save or a void that re-renders the page refreshes it. A code
  // missing from it skips the browser's code rule and goes to the server marked
  // for a current check. A code in it that was made inactive since is checked by
  // the server against every raw product, so the database refuses it with its
  // own message.
  const known = new Map(products.map((product) => [product.code, product]));

  const [productCode, setProductCode] = useState(initialCode);
  const [vendorId, setVendorId] = useState("");
  const [weight, setWeight] = useState("");
  const [cost, setCost] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [today, setToday] = useState("");

  // The date field starts at today's date on the device, read after mount so the
  // server and browser renders match. Save reads the date again (see submit).
  useEffect(() => {
    const date = deviceToday();
    setToday(date);
    setReceivedDate((current) => current || date);
  }, []);

  // The browser runs the same form rules first, so a typo is refused at once.
  // Only a form that passes them goes to the server.
  const [state, formAction, pending] = useActionState(
    async (_previous: SaveState, formData: FormData): Promise<SaveState> => {
      const fields = readFields(formData);
      const codes = new Set(known.keys());
      if (readRecheck(formData)) codes.add(fields.productCode.trim());
      const parsed = parseReceiptForm(fields, codes);
      if (!parsed.ok) return { status: "invalid", fieldErrors: parsed.errors };
      try {
        return await saveReceipt(formData);
      } catch {
        // A dropped connection or a server error: the save may have happened
        // (AC-0071). A rejected action reaches the error boundary, which would
        // unmount this form and lose every value, so it is answered here.
        return { status: "refused", message: SAVE_UNKNOWN };
      }
    },
    IDLE,
  );

  // The action is dispatched here and not through <form action>, because React
  // resets a form after its action finishes, and a reset would put the vendor
  // back on "Choose a vendor" after a refusal that must keep every value.
  //
  // The device date is read here, when Save is pressed, so a form left open past
  // midnight checks and sends the new day. The rule, the hidden field, and the
  // date field's `max` all take it.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const date = deviceToday();
    setToday(date);
    const formData = new FormData(event.currentTarget);
    formData.set("today", date);
    startTransition(() => formAction(formData));
  }

  const headingRef = useRef<HTMLHeadingElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const errors = state.status === "invalid" ? state.fieldErrors : NO_ERRORS;

  // Each result moves focus to what the owner needs next, and a saved receipt
  // empties the fields that belong to one delivery.
  useEffect(() => {
    if (state.status === "saved") {
      setWeight("");
      setCost("");
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
  const recheckCode = code !== "" && !chosen;

  // Once the list has shown a saved lot as void, the panel keeps saying so, even
  // when the owner then chooses another product and the list no longer holds it.
  const [voidedSeen, setVoidedSeen] = useState(NO_LOTS);
  const unseen = voidedLots.filter((lot) => !voidedSeen.includes(lot));
  if (unseen.length > 0) setVoidedSeen([...voidedSeen, ...unseen]);
  const lotVoided =
    state.status === "saved" &&
    (voidedLots.includes(state.lot.lotNumber) || voidedSeen.includes(state.lot.lotNumber));

  // An exact code loads that product's stock into the page through the URL.
  function changeProduct(value: string) {
    setProductCode(value);
    const next = value.trim();
    if (known.has(next) && next !== regionCode) {
      startRegion(() => {
        router.replace(`/receiving?product=${encodeURIComponent(next)}`, { scroll: false });
      });
    }
  }

  const missingProducts = known.size === 0;
  const missingVendors = vendors.length === 0;
  const blocked = missingProducts || missingVendors;

  function describe(field: ReceiptField) {
    return errors[field] ? { "aria-invalid": true, "aria-describedby": `${FIELD_IDS[field]}-error` } : {};
  }

  function fieldError(field: ReceiptField): ReactNode {
    const message = errors[field];
    return message ? (
      <p id={`${FIELD_IDS[field]}-error`} className="mt-1 text-base font-medium text-error">
        {message}
      </p>
    ) : null;
  }

  let hint = "";
  if (code === "") hint = "Type a product code to start.";
  else if (chosen) hint = [chosen.description, chosen.species].filter(Boolean).join(" · ");

  return (
    <>
      <form
        onSubmit={submit}
        aria-labelledby="receipt-form-heading"
        noValidate
        className="space-y-4"
      >
        <h2 id="receipt-form-heading" className="text-xl font-semibold">
          New receipt
        </h2>

        {blocked && (
          <div id="setup-notice" className="space-y-1 text-base">
            {missingProducts && <p>No active raw products yet. Add one in Supabase Studio, then reload this page.</p>}
            {missingVendors && <p>No vendors yet. Add one in Supabase Studio, then reload this page.</p>}
          </div>
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
          <p id="product-hint" aria-live="polite" className="mt-1 text-base text-ink-secondary">
            {hint}
          </p>
          {fieldError("productCode")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.vendorId} className="block text-base font-medium">
            Vendor
          </label>
          <select
            id={FIELD_IDS.vendorId}
            name="vendorId"
            value={vendorId}
            onChange={(event) => setVendorId(event.target.value)}
            className={CONTROL}
            {...describe("vendorId")}
          >
            <option value="">Choose a vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
          {fieldError("vendorId")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.weight} className="block text-base font-medium">
            Weight (lbs)
          </label>
          <input
            id={FIELD_IDS.weight}
            name="weight"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className={`${CONTROL} tabular-nums`}
            {...describe("weight")}
          />
          {fieldError("weight")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.cost} className="block text-base font-medium">
            Cost per lb ($)
          </label>
          <input
            id={FIELD_IDS.cost}
            name="cost"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={cost}
            onChange={(event) => setCost(event.target.value)}
            className={`${CONTROL} tabular-nums`}
            {...describe("cost")}
          />
          {fieldError("cost")}
        </div>

        <div>
          <label htmlFor={FIELD_IDS.receivedDate} className="block text-base font-medium">
            Received date
          </label>
          <input
            id={FIELD_IDS.receivedDate}
            name="receivedDate"
            type="date"
            max={today || undefined}
            value={receivedDate}
            onChange={(event) => setReceivedDate(event.target.value)}
            className={CONTROL}
            {...describe("receivedDate")}
          />
          {fieldError("receivedDate")}
        </div>
        {/* The server reads the device date from here, never from its own clock. */}
        <input type="hidden" name="today" value={today} />
        {recheckCode && <input type="hidden" name={RECHECK_FIELD} value="1" />}

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
          id="receipt-message"
          ref={messageRef}
          role="alert"
          tabIndex={-1}
          className="text-base font-medium text-error"
        >
          {state.status === "refused" ? state.message : null}
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-disabled={blocked ? true : undefined}
          aria-describedby={blocked ? "setup-notice" : undefined}
          onClick={(event) => {
            if (blocked) event.preventDefault();
          }}
          className="w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary disabled:opacity-60 aria-disabled:opacity-60"
        >
          Save
        </button>
      </form>

      <ResultPanel state={state} headingRef={headingRef} voided={lotVoided} />

      <div id="product-region" aria-busy={regionPending} className="mt-6 space-y-4">
        {chosen && chosen.code === regionCode ? region : null}
      </div>
    </>
  );
}
