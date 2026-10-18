import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import type { TypedClient } from "../src/lib/supabase.js";
import {
  assertLedgerInvariants,
  callAsClient,
  closePool,
  correctCall,
  query,
  resetTestData,
  saleFixture,
} from "./db.js";
import { signInOperator } from "./users.js";

let operator: TypedClient;

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await assertLedgerInvariants();
});
afterAll(async () => {
  await closePool();
});

// STUB: AC-0012
it("AC-0012: correcting lot A to 1.86 per lb restates batch 1 and leaves batch 2", async () => {
  const fixture = await saleFixture({ sale: true });
  const outcome = await callAsClient(operator, correctCall(fixture.lotAId, 1.86, 5000, "invoice price"));
  expect(outcome.ok, outcome.error).toBe(true);
  const rows = await query<{ raw: string; cost: string }>(
    `select raw_cost_total::text as raw, cost_per_finished_lb::text as cost
     from public.production_batches where id = any($1::uuid[]) order by production_date`,
    [[fixture.batch1Id, fixture.batch2Id]],
  );
  expect(rows).toEqual([
    { raw: "11100.0000", cost: "2.8526" },
    { raw: "1800.0000", cost: "2.7877" },
  ]);
});
