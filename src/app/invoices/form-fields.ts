// The read forms' field names, shared by the browser and the read actions.
export const PHOTO_FIELD = "photo";
export const TEXT_FIELD = "text";
export const TODAY_FIELD = "today";

function textOf(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// A server action is a public POST endpoint, so a missing or non-text entry
// reads as blank, because a caller can send anything.
export function readTextFields(formData: FormData): { text: string; today: string } {
  return { text: textOf(formData, TEXT_FIELD), today: textOf(formData, TODAY_FIELD) };
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
