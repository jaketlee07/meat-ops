export const NOT_ALLOWED = "This account isn't allowed to use Meat Ops.";

const INACTIVE_PRODUCT = "This product is no longer active.";

// Turns a thrown engine error into the plain reason shown after "The receipt
// wasn't saved." or "The receipt wasn't voided.". The wrappers in src/lib/rpc.ts
// throw "<wrapper> failed: <function>: <engine text>" and keep no SQLSTATE, so
// the reason is read from the text: "not allowed" for SQLSTATE 42501 (also
// PostgREST's "permission denied"), and "is inactive" for an inactive product.
export function refusalReason(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const engine = text.replace(/^\w+ failed: /, "");
  if (/: not allowed \(|permission denied/.test(engine)) return NOT_ALLOWED;
  if (/ is inactive$/.test(engine)) return INACTIVE_PRODUCT;
  return engine.replace(/^\w+: /, "");
}
