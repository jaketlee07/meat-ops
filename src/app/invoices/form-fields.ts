// The read forms' field names, shared by the browser and the read actions.
export const PHOTO_FIELD = "photo";
export const TEXT_FIELD = "text";
export const TODAY_FIELD = "today";

// The date on this device, as YYYY-MM-DD. Both invoice forms read it when a
// button is pressed, so a page left open past midnight sends the new day.
export function deviceToday(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// A server action is a public POST endpoint, so a missing or non-text entry
// reads as blank, because a caller can send anything. A browser sends a typed
// line break as CR LF, so the text is read with LF only: the server checks,
// stores, and sends the text the browser counted.
export function readTextFields(formData: FormData): { text: string; today: string } {
  return { text: textOf(formData, TEXT_FIELD).replace(/\r\n?/g, "\n"), today: textOf(formData, TODAY_FIELD) };
}

// The photo's bytes are read only when asked for, after the caller is settled.
// A part that is not a file, or that browsers send when no file is chosen (an
// empty file), is no photo; the read decision turns either into AC-0012's first row.
export function readPhotoFields(formData: FormData): { photo: (() => Promise<Uint8Array>) | null; today: string } {
  const file = formData.get(PHOTO_FIELD);
  const photo =
    typeof file === "object" && file !== null && file.size > 0
      ? async () => new Uint8Array(await file.arrayBuffer())
      : null;
  return { photo, today: textOf(formData, TODAY_FIELD) };
}
