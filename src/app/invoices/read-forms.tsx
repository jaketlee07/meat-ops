"use client";

import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { DRAFT_UNKNOWN } from "../../lib/failures";
import {
  checkReceiptText,
  MAX_PHOTO_BYTES,
  PHOTO_NONE,
  PHOTO_TOO_LARGE,
  PHOTO_TYPE,
  photoMediaType,
} from "../../lib/invoice-reading";
import { readPhoto, readText, type ReadState } from "./actions";
import { deviceToday, PHOTO_FIELD, TEXT_FIELD, TODAY_FIELD } from "./form-fields";

// The longest edge the model reads (AC-0013).
const LONG_EDGE = 2576;
const READING = "Reading. This can take up to two minutes.";

const IDLE: ReadState = { status: "idle" };
const CONTROL = "mt-1 block w-full rounded-md border border-field-border bg-surface px-3 text-base text-ink";
// The photo field's own selector button, styled to look like a button.
const FILE_BUTTON =
  "file:mr-3 file:rounded-md file:border file:border-field-border file:bg-surface file:px-3 file:py-1 file:text-base file:font-medium file:text-ink";
const BUTTON =
  "w-full rounded-md bg-primary px-4 text-base font-medium text-on-primary aria-disabled:bg-primary/60";

type Press =
  | { source: "photo"; file: File | undefined; today: string }
  | { source: "text"; text: string; today: string };

// AC-0012 and AC-0013: checks the chosen file's first bytes, then draws it on a
// canvas no larger than the model reads and sends that JPEG. The re-encode drops
// every EXIF and XMP block, location included.
async function shrinkPhoto(file: File | undefined): Promise<{ file: File } | { message: string }> {
  if (!file || file.size === 0) return { message: PHOTO_NONE };
  if (photoMediaType(new Uint8Array(await file.slice(0, 12).arrayBuffer())) === null) return { message: PHOTO_TYPE };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { message: PHOTO_TYPE };
  }
  const scale = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) return { message: PHOTO_TYPE };
  // A JPEG has no transparency, so a transparent PNG would turn black.
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) return { message: PHOTO_TYPE };
  if (blob.size > MAX_PHOTO_BYTES) return { message: PHOTO_TOO_LARGE };
  return { file: new File([blob], "invoice.jpg", { type: "image/jpeg" }) };
}

// The browser applies AC-0012's rules before it sends a read, so a read it
// refuses sends nothing. A rejected action (a dropped connection) reaches the
// error boundary and would lose the typed text, so it is answered here: the
// draft may have been written.
async function run(_previous: ReadState, press: Press): Promise<ReadState> {
  try {
    const formData = new FormData();
    formData.set(TODAY_FIELD, press.today);
    if (press.source === "text") {
      const message = checkReceiptText(press.text);
      if (message) return { status: "invalid", source: "text", message };
      formData.set(TEXT_FIELD, press.text);
      return await readText(formData);
    }
    const shrunk = await shrinkPhoto(press.file);
    if ("message" in shrunk) return { status: "invalid", source: "photo", message: shrunk.message };
    formData.set(PHOTO_FIELD, shrunk.file);
    return await readPhoto(formData);
  } catch {
    return { status: "refused", source: press.source, message: DRAFT_UNKNOWN };
  }
}

export function ReadForms() {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(run, IDLE);
  const [text, setText] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  // Which Read button was pressed last, so the reading message sits beside it.
  const [pressed, setPressed] = useState<"photo" | "text" | null>(null);

  // A read that made a draft opens its review; the form stays busy until it does.
  const busy = pending || state.status === "read";

  useEffect(() => {
    if (state.status === "invalid") {
      document.getElementById(state.source === "photo" ? "invoice-photo" : "receipt-text")?.focus();
    } else if (state.status === "refused") {
      document.getElementById(state.source === "photo" ? "photo-message" : "text-message")?.focus();
    } else if (state.status === "read") {
      router.push(`/invoices?draft=${encodeURIComponent(state.draftId)}`);
    }
  }, [state]);

  function submitPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setPressed("photo");
    startTransition(() => dispatch({ source: "photo", file: photoRef.current?.files?.[0], today: deviceToday() }));
  }

  function submitText(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setPressed("text");
    startTransition(() => dispatch({ source: "text", text, today: deviceToday() }));
  }

  const fieldError = (source: "photo" | "text") =>
    state.status === "invalid" && state.source === source ? state.message : null;
  const failure = (source: "photo" | "text") =>
    state.status === "refused" && state.source === source ? state.message : null;
  // Two lines are reserved, the most the message takes in the 288 px column of a
  // 320 px screen, so neither form moves when the text appears. The regions are in
  // the page before they have text, so the change is announced.
  const reading = (source: "photo" | "text") => (
    <div role="status" className="min-h-12 text-base">
      {busy && pressed === source ? READING : null}
    </div>
  );
  const photoError = fieldError("photo");
  const textError = fieldError("text");

  return (
    <>
      <section aria-labelledby="read-photo-heading" className="mb-8 space-y-4">
        <h2 id="read-photo-heading" className="text-xl font-semibold">
          Read an invoice
        </h2>
        <form onSubmit={submitPhoto} noValidate className="space-y-4">
          <div>
            <label htmlFor="invoice-photo" className="block text-base font-medium">
              Invoice photo
            </label>
            <input
              ref={photoRef}
              id="invoice-photo"
              name={PHOTO_FIELD}
              type="file"
              accept="image/*"
              className={`${CONTROL} ${FILE_BUTTON} py-2`}
              aria-invalid={photoError ? true : undefined}
              aria-describedby={photoError ? "invoice-photo-error" : undefined}
            />
            {photoError && (
              <p id="invoice-photo-error" className="mt-1 break-words text-base font-medium text-error">
                {photoError}
              </p>
            )}
          </div>
          <div id="photo-message" role="alert" tabIndex={-1} className="break-words text-base font-medium text-error">
            {failure("photo")}
          </div>
          <button type="submit" aria-disabled={busy ? true : undefined} className={BUTTON}>
            Read photo
          </button>
          {reading("photo")}
        </form>
      </section>

      <section aria-labelledby="read-text-heading" className="mb-8 space-y-4">
        <h2 id="read-text-heading" className="text-xl font-semibold">
          Type a receipt
        </h2>
        <form onSubmit={submitText} noValidate className="space-y-4">
          <div>
            <label htmlFor="receipt-text" className="block text-base font-medium">
              Receipt text
            </label>
            <textarea
              id="receipt-text"
              name={TEXT_FIELD}
              rows={4}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className={`${CONTROL} py-2`}
              aria-invalid={textError ? true : undefined}
              aria-describedby={textError ? "receipt-text-error" : undefined}
            />
            {textError && (
              <p id="receipt-text-error" className="mt-1 break-words text-base font-medium text-error">
                {textError}
              </p>
            )}
          </div>
          <div id="text-message" role="alert" tabIndex={-1} className="break-words text-base font-medium text-error">
            {failure("text")}
          </div>
          <button type="submit" aria-disabled={busy ? true : undefined} className={BUTTON}>
            Read text
          </button>
          {reading("text")}
        </form>
      </section>
    </>
  );
}
