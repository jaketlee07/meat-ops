"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  CHOOSE_PRODUCT,
  CHOOSE_VENDOR,
  DISCARD_UNKNOWN,
  DRAFT_DISCARDED_NOW,
  DRAFT_SAVED,
  DRAFT_WAS_DISCARDED,
  ENTER_FROM_INVOICE,
  PHOTO_NOT_LOADED,
  RECEIPTS_UNKNOWN,
} from "../../lib/failures";
import type { Draft } from "../../lib/invoices";
import { discardDraft, saveDraft, type DiscardState, type SaveState } from "./actions";
import { deviceToday } from "./form-fields";
import { SavedResult, savedSentence } from "./saved-result";
import {
  checkSave,
  discardFormData,
  LINE_FIELDS,
  saveFormData,
  type FieldErrors,
  type LineField,
  type LineInput,
} from "./save-draft";

interface Props {
  draft: Draft;
  // The pickers: the active raw products in code order and the vendors in name order.
  products: ReadonlyArray<{ id: string; code: string; description: string }>;
  vendors: ReadonlyArray<{ id: string; name: string }>;
}

type ReviewState = SaveState | DiscardState;
// `release` clears the page's press guard once the action settles, whatever its outcome.
type Press = (
  | { kind: "save"; draftId: string; today: string; lines: LineInput[] }
  | { kind: "discard"; draftId: string }
) & { release: () => void };

const IDLE: ReviewState = { status: "idle" };
const NO_ERRORS: FieldErrors = {};

const CONTROL = "mt-1.5 block w-full rounded-control border border-field-border bg-surface px-3 text-base text-ink";
const LABEL = "block text-sm font-semibold text-ink-secondary";
const CARD = "rounded-card border border-card-border bg-surface p-4";
// A waiting button keeps its focus and fades its colors, never its opacity: the fill of Save receipts, the text
// and border of Discard draft. Where the form has room (`lines-row`) the two sit side by side at their own width.
const PRIMARY =
  "w-full rounded-control bg-primary px-5 text-base font-bold text-on-primary aria-disabled:bg-primary/60 lines-row:w-auto";
const SECONDARY =
  "w-full rounded-control border border-field-border bg-surface px-5 text-base font-bold text-ink aria-disabled:border-field-border/60 aria-disabled:text-ink/60 lines-row:w-auto";

const LABELS: Record<LineField, string> = {
  product: "Product",
  vendor: "Vendor",
  weight: "Weight (lbs)",
  cost: "Cost per lb",
  date: "Received date",
};

// The picker's first option says what its field message says, without the period.
const prompt = (message: string) => message.replace(/\.$/, "");

const fieldId = (lineNo: number, field: LineField | "save") => `line-${lineNo}-${field}`;

// The browser applies the save rules first, so a typo is refused at once and
// sends nothing. A rejected action (a dropped connection) reaches the error
// boundary and would lose every field, so it is answered here: the write may
// have happened (AC-0116, AC-0188). The press guard clears here, so a refusal that
// sent nothing frees the buttons too.
async function run(_previous: ReviewState, press: Press): Promise<ReviewState> {
  try {
    if (press.kind === "discard") return await discardDraft(discardFormData(press.draftId));
    const refusal = checkSave(press.lines, press.today);
    if (refusal) return refusal;
    return await saveDraft(saveFormData(press));
  } catch {
    return { status: "refused", message: press.kind === "save" ? RECEIPTS_UNKNOWN : DISCARD_UNKNOWN };
  } finally {
    press.release();
  }
}

function LineBox({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error: string | undefined;
  hint: boolean;
  children: (describedBy: { "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  // An errored field points at its message alone; otherwise at its hint, when it has one.
  const describedBy: { "aria-invalid"?: boolean; "aria-describedby"?: string } = error
    ? { "aria-invalid": true, "aria-describedby": `${id}-error` }
    : hint
      ? { "aria-describedby": `${id}-hint` }
      : {};
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children(describedBy)}
      {error ? (
        <p id={`${id}-error`} className="mt-1 break-words text-base font-medium text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-base text-ink-secondary">
          {ENTER_FROM_INVOICE}
        </p>
      ) : null}
    </div>
  );
}

// The photo has its own address, so the page holds no copy of its bytes. The box
// has a fixed shape, so the lines below do not move when the bytes arrive. An
// image that failed before the page became interactive fired its error event
// unheard, so the mount checks for it too.
function Photo({ draftId }: { draftId: string }) {
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = imageRef.current;
    if (image && image.complete && image.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    <div className="aspect-3/4 w-full overflow-hidden rounded-control border border-card-border">
      {failed ? (
        <p className="p-3 text-base">{PHOTO_NOT_LOADED}</p>
      ) : (
        <img
          ref={imageRef}
          src={`/invoices/photo/${draftId}`}
          alt="Invoice photo"
          onError={() => setFailed(true)}
          className="block h-full w-full object-contain"
        />
      )}
    </div>
  );
}

export function DraftReview({ draft, products, vendors }: Props) {
  // A drafted picker value that is no longer in a list starts on "Choose ...".
  const initial: LineInput[] = draft.lines.map((line) => ({
    id: line.id,
    ticked: true,
    product: products.some((product) => product.id === line.productId) ? (line.productId ?? "") : "",
    vendor: vendors.some((vendor) => vendor.id === line.vendorId) ? (line.vendorId ?? "") : "",
    weight: line.weightLbs ?? "",
    cost: line.unitCost ?? "",
    date: line.receivedDate ?? "",
  }));
  const [startedBlank] = useState(initial);
  const [lines, setLines] = useState(initial);
  const [state, dispatch, pending] = useActionState(run, IDLE);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const discardedRef = useRef<HTMLParagraphElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  // Set at once on press, because state updates land a render later; a second press of either button
  // is refused here and never reaches dispatch, where Next.js would queue it behind the first. The ref clears
  // when the action settles, a render before the outcome shows, so both handlers also refuse while `pending`.
  const pressRef = useRef(false);

  const errors = state.status === "invalid" ? state.fieldErrors : NO_ERRORS;

  // Each outcome moves focus to what the owner needs next: the first field with
  // an error, or else the message that states the outcome.
  useEffect(() => {
    if (state.status === "saved") {
      headingRef.current?.focus();
    } else if (state.status === "discarded") {
      discardedRef.current?.focus();
    } else if (state.status === "refused") {
      messageRef.current?.focus();
    } else if (state.status === "invalid") {
      for (const [index, line] of draft.lines.entries()) {
        const first = LINE_FIELDS.find((field) => state.fieldErrors[index]?.[field]);
        if (first) {
          document.getElementById(fieldId(line.lineNo, first))?.focus();
          return;
        }
      }
    }
  }, [state]);

  function change(index: number, patch: Partial<LineInput>) {
    setLines((current) => current.map((line, at) => (at === index ? { ...line, ...patch } : line)));
  }

  // The action is dispatched here and not through <form action>, because React
  // resets a form after its action finishes, and a reset would put the pickers
  // back on "Choose ..." after a refusal that must keep every value. The device
  // date is read here, when Save is pressed, so a review left open past midnight
  // checks and sends the new day.
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pressRef.current || pending) return;
    pressRef.current = true;
    const release = () => {
      pressRef.current = false;
    };
    startTransition(() => dispatch({ kind: "save", draftId: draft.id, today: deviceToday(), lines, release }));
  }

  function discard() {
    if (pressRef.current || pending) return;
    pressRef.current = true;
    const release = () => {
      pressRef.current = false;
    };
    startTransition(() => dispatch({ kind: "discard", draftId: draft.id, release }));
  }

  const done = state.status === "saved" || state.status === "discarded";
  const editing = draft.status === "pending" && !done;

  return (
    <>
      {/* The live region is in the page before it has content, so a result is
          announced. It holds the outcome sentence only; the details follow it. */}
      <div role="status" aria-label="Draft result">
        {state.status === "saved" && (
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-success">
            {savedSentence(state.lots.length)}
          </h2>
        )}
        {state.status === "discarded" && (
          <p ref={discardedRef} tabIndex={-1} className="text-xl font-semibold text-success">
            {DRAFT_DISCARDED_NOW}
          </p>
        )}
      </div>
      {state.status === "saved" && <SavedResult saved={state} />}

      {!done && draft.status === "confirmed" && (
        <div className="space-y-2 text-base">
          <p className="font-medium">{DRAFT_SAVED}</p>
          <ul className="space-y-1">
            {draft.lines.map((line) =>
              line.lotNumber ? (
                <li key={line.id} className="tabular-nums">
                  {line.lotNumber}
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}

      {!done && draft.status === "discarded" && <p className="text-base font-medium">{DRAFT_WAS_DISCARDED}</p>}

      {editing && (
        // The editing view is the container named review (`review-split` in globals.css): where it has room the
        // capture section is the first column and the form the second. Only a photo stays in view while the lines
        // scroll; a typed capture scrolls with the page, so a long one is never held partly below the fold.
        <div className="@container/review">
          <div className="grid grid-cols-1 gap-4 review-split:grid-cols-[20rem_minmax(0,1fr)] review-split:items-start">
            <section
              aria-labelledby="capture-heading"
              className={`min-w-0 space-y-2.5 ${CARD} ${draft.source === "photo" ? "review-split:sticky review-split:top-4" : ""}`}
            >
              {draft.source === "photo" ? (
                <>
                  <h3 id="capture-heading" className="text-lg font-semibold">
                    Invoice photo
                  </h3>
                  <Photo draftId={draft.id} />
                </>
              ) : (
                <>
                  <h3 id="capture-heading" className="text-lg font-semibold">
                    You typed
                  </h3>
                  <p className="whitespace-pre-wrap break-words text-base">{draft.captureText}</p>
                </>
              )}
            </section>

            <form
              onSubmit={save}
              noValidate
              aria-labelledby="lines-heading"
              className="@container/lines min-w-0 space-y-4"
            >
              <h3 id="lines-heading" className="text-lg font-semibold">
                Lines
              </h3>
              {draft.lines.map((line, index) => {
                const current = lines[index]!;
                const was = startedBlank[index]!;
                const lineErrors = errors[index] ?? {};
                const hint = (field: LineField) => was[field] === "" && current[field] === "";
                const id = (field: LineField) => fieldId(line.lineNo, field);
                return (
                  // Each line is the container named line: where it has room (`line-pair`) Product and Vendor
                  // share a row, Product on the wider track so its chosen name shows whole, and Weight, Cost per
                  // lb, and Received date share a row.
                  <fieldset key={line.id} className={`@container/line min-w-0 space-y-3 ${CARD}`}>
                    <legend className="float-left mb-3 w-full text-lg font-semibold">Line {line.lineNo}</legend>
                    {/* The invoice's words are the model's reading of a photo: text, never markup. */}
                    <p className="clear-both break-words rounded-control bg-tint px-2.5 py-2 text-base tabular-nums">
                      Invoice says: <span className="font-semibold">{line.words}</span>
                    </p>
                    <label className="flex min-h-control items-center gap-3 text-base font-semibold">
                      <input
                        id={fieldId(line.lineNo, "save")}
                        type="checkbox"
                        checked={current.ticked}
                        onChange={(event) => change(index, { ticked: event.target.checked })}
                        className="h-control w-control shrink-0"
                      />
                      Save this line
                    </label>
                    <div className="grid grid-cols-1 gap-3 line-pair:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] line-pair:items-start">
                      <LineBox
                        id={id("product")}
                        label={LABELS.product}
                        error={lineErrors.product}
                        hint={hint("product")}
                      >
                        {(aria) => (
                          <select
                            id={id("product")}
                            value={current.product}
                            onChange={(event) => change(index, { product: event.target.value })}
                            className={CONTROL}
                            {...aria}
                          >
                            <option value="">{prompt(CHOOSE_PRODUCT)}</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.code} {product.description}
                              </option>
                            ))}
                          </select>
                        )}
                      </LineBox>
                      <LineBox
                        id={id("vendor")}
                        label={LABELS.vendor}
                        error={lineErrors.vendor}
                        hint={hint("vendor")}
                      >
                        {(aria) => (
                          <select
                            id={id("vendor")}
                            value={current.vendor}
                            onChange={(event) => change(index, { vendor: event.target.value })}
                            className={CONTROL}
                            {...aria}
                          >
                            <option value="">{prompt(CHOOSE_VENDOR)}</option>
                            {vendors.map((vendor) => (
                              <option key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </LineBox>
                    </div>
                    <div className="grid grid-cols-1 gap-3 line-pair:grid-cols-3 line-pair:items-start">
                      <LineBox
                        id={id("weight")}
                        label={LABELS.weight}
                        error={lineErrors.weight}
                        hint={hint("weight")}
                      >
                        {(aria) => (
                          <input
                            id={id("weight")}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={current.weight}
                            onChange={(event) => change(index, { weight: event.target.value })}
                            className={`${CONTROL} tabular-nums`}
                            {...aria}
                          />
                        )}
                      </LineBox>
                      <LineBox id={id("cost")} label={LABELS.cost} error={lineErrors.cost} hint={hint("cost")}>
                        {(aria) => (
                          <input
                            id={id("cost")}
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            value={current.cost}
                            onChange={(event) => change(index, { cost: event.target.value })}
                            className={`${CONTROL} tabular-nums`}
                            {...aria}
                          />
                        )}
                      </LineBox>
                      <LineBox id={id("date")} label={LABELS.date} error={lineErrors.date} hint={hint("date")}>
                        {(aria) => (
                          <input
                            id={id("date")}
                            type="date"
                            value={current.date}
                            onChange={(event) => change(index, { date: event.target.value })}
                            className={CONTROL}
                            {...aria}
                          />
                        )}
                      </LineBox>
                    </div>
                  </fieldset>
                );
              })}

              {/* The live region is in the page before it has text, so a refusal is announced. */}
              <div
                id="draft-message"
                ref={messageRef}
                role="alert"
                tabIndex={-1}
                className="break-words text-base font-medium text-error"
              >
                {state.status === "refused" ? state.message : null}
              </div>

              <div className="flex flex-col gap-3 lines-row:flex-row">
                <button type="submit" aria-disabled={pending ? true : undefined} className={PRIMARY}>
                  Save receipts
                </button>
                <button
                  type="button"
                  aria-disabled={pending ? true : undefined}
                  onClick={discard}
                  className={SECONDARY}
                >
                  Discard draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
