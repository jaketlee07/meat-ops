import { afterAll, afterEach, beforeEach, expect, it } from "vitest";
import {
  assertLedgerInvariants,
  callAsOperator,
  closePool,
  idOf,
  query,
  RAW_TOM_ID,
  resetTestData,
  VENDOR_ID,
} from "./db.js";

beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

const turkey = (weight: string, cost: string, date: string) => ({
  product_id: RAW_TOM_ID,
  vendor_id: VENDOR_ID,
  weight_lbs: weight,
  unit_cost: cost,
  received_date: date,
});

// STUB: AC-0040
it("AC-0040: saving the turkey reading's draft leaves RAW-TOM at 8,000 lbs and an average of exactly 1.725", async () => {
  const created = await callAsOperator({
    fn: "create_import_draft",
    args: {
      p_source: "text",
      p_capture_text: "5000 lbs RAW-TOM from Reyes Meats at 1.68 on Oct 1, 3000 at 1.80 on Oct 5",
      p_captured_on: "2026-10-09",
      p_model: "claude-opus-5-5",
      p_lines: JSON.stringify([
        { words: "TKY DRUMS 40#", unsure: [], ...turkey("5000", "1.68", "2026-10-01") },
        { words: "TKY DRUMS 40#", unsure: [], ...turkey("3000", "1.80", "2026-10-05") },
      ]),
    },
  });
  expect(created.error).toBeUndefined();
  const lines = await query<{ id: string }>(
    "select id from public.import_draft_lines where import_draft_id = $1 order by line_no",
    [idOf(created)],
  );
  const saved = await callAsOperator({
    fn: "confirm_import_draft",
    args: {
      p_draft_id: idOf(created),
      p_lines: JSON.stringify([
        { line_id: lines[0]?.id, ...turkey("5000", "1.68", "2026-10-01") },
        { line_id: lines[1]?.id, ...turkey("3000", "1.80", "2026-10-05") },
      ]),
    },
  });
  expect(saved.error).toBeUndefined();
  expect(
    await query(
      "select qty_on_hand::text, moving_avg_cost::text from public.inventory_balances where product_id = $1",
      [RAW_TOM_ID],
    ),
  ).toEqual([{ qty_on_hand: "8000.000", moving_avg_cost: "1.7250" }]);
  expect(
    await query("select unit_cost::text from public.lots where product_id = $1 order by receipt_seq", [RAW_TOM_ID]),
  ).toEqual([{ unit_cost: "1.6800" }, { unit_cost: "1.8000" }]);
});
