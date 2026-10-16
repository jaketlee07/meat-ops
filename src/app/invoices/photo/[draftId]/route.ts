import { getDraftPhoto, isUuid } from "../../../../lib/invoices";
import { checkCaller } from "../../../_server/caller";

// The stored photo of a draft, for the review's <img>. Only an operator gets
// bytes. Every other case answers the same 404 with an empty body, so the answer
// says nothing about whether the id names a draft; the id and any error text stay
// out of the response.
const NOT_FOUND = () => new Response(null, { status: 404, headers: { "cache-control": "private, no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ draftId: string }> }): Promise<Response> {
  const caller = await checkCaller();
  if (caller.status !== "operator") return NOT_FOUND();

  // A malformed id is never sent to the database.
  const { draftId } = await params;
  if (!isUuid(draftId)) return NOT_FOUND();

  try {
    const photo = await getDraftPhoto(caller.supabase, draftId);
    if (!photo) return NOT_FOUND();
    return new Response(photo.bytes as BodyInit, {
      headers: {
        "content-type": photo.mediaType,
        "x-content-type-options": "nosniff",
        "cache-control": "private, no-store",
      },
    });
  } catch {
    return NOT_FOUND();
  }
}
