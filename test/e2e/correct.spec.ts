import { expect, test, type Page, type Request } from "@playwright/test";
import {
  callAsOperator,
  correctCall,
  idOf,
  PROD_502_ID,
  produceCall,
  query,
  resetTestData,
  reverseCall,
  saleFixture,
  voidReceiptCall,
} from "../db";
import { checkPageState } from "./a11y";
import { banner, costEarlier, receiveTom } from "./alerts-page";
import { replayText, type SentAction } from "./pricing-page";
import {
  beforeAfter,
  CORRECT_SIGNED_OUT,
  CORRECTION_UNKNOWN,
  correctButton,
  correctDialog,
  correctedState,
  correctionCount,
  correctMessage,
  correctPanel,
  correctThrough,
  dropActionRequests,
  factValue,
  fillReceipt,
  FORM_CONTROLS,
  holdStockLock,
  lotNumberOf,
  NOT_ALLOWED,
  NOT_CORRECTED,
  NOT_LOADED,
  NOTHING_TO_CORRECT,
  openCorrection,
  openForm,
  RAW_TOM_URL,
  receiptItem,
  seedReceipt,
  voidButton,
} from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// Correct on /receiving, end to end: a real browser over the production build
// and the local database. Fixtures go through the operations; raw tables are
// read through pg to show what was or was not written.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

// What Tab reaches inside an open correction, in order.
const DIALOG_CONTROLS = ["button Cancel", "input cost", "input weight", "textarea reason", "button Save correction"];

// The sale fixture with the 5,000-lb sale, opened on RAW-TOM.
async function openSaleFixture(page: Page) {
  const fixture = await saleFixture({ sale: true });
  await openForm(page, RAW_TOM_URL);
  return { fixture, itemA: receiptItem(page, fixture.lotANumber), itemB: receiptItem(page, fixture.lotBNumber) };
}

async function batchNumber(id: string): Promise<string> {
  const [row] = await query<{ n: string }>("select batch_number as n from production_batches where id = $1", [id]);
  return row?.n ?? "missing";
}

// The action requests the page sends from now on, counted.
function countPosts(page: Page): { readonly count: number } {
  const posts = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && "next-action" in request.headers()) posts.count += 1;
  });
  return posts;
}

const op = async (call: Parameters<typeof callAsOperator>[0]) => {
  const outcome = await callAsOperator(call);
  expect(outcome.ok, outcome.error).toBe(true);
  return outcome;
};

test.describe("the list", () => {
  test("AC-0090, AC-0114, AC-0170 to AC-0172, AC-0180, AC-0181: Correct on every receipt but a void one, beside Void or In use", async ({
    page,
  }) => {
    const fixture = await saleFixture({ sale: true });
    const untouched = await seedReceipt(500, 1.7, "2026-10-09");
    const voided = await seedReceipt(400, 1.7, "2026-10-10");
    await op(voidReceiptCall(voided, "entered twice"));
    await openForm(page, RAW_TOM_URL);

    const itemC = receiptItem(page, await lotNumberOf(untouched));
    const itemD = receiptItem(page, await lotNumberOf(voided));
    // Untouched: both buttons. In use: "In use" and Correct. Void: neither.
    await expect(voidButton(itemC)).toBeVisible();
    await expect(correctButton(itemC)).toBeVisible();
    for (const item of [receiptItem(page, fixture.lotANumber), receiptItem(page, fixture.lotBNumber)]) {
      await expect(item.getByText("In use", { exact: true })).toBeVisible();
      await expect(voidButton(item)).toHaveCount(0);
      await expect(correctButton(item)).toBeVisible();
    }
    await expect(correctButton(itemD)).toHaveCount(0);
    await expect(itemD.getByText(/^Void: /)).toBeVisible();
    await expect(page.getByRole("button", { name: "Correct", exact: false })).toHaveCount(3);

    expect(await checkPageState(page)).toEqual([
      ...FORM_CONTROLS,
      "button Void",
      "button Correct",
      "button Correct",
      "button Correct",
    ]);
  });

  test("AC-0115: a receipt whose only batch is reversed, and an untouched receipt whose weight was corrected, show Void", async ({
    page,
  }) => {
    const reversedOnly = await seedReceipt(1000, 1.68, "2026-10-01");
    const batch = idOf(await op(produceCall(PROD_502_ID, 1000, null, "2026-10-02")));
    const weightCorrected = await seedReceipt(1000, 1.7, "2026-10-03");
    await op(reverseCall(batch, "entered twice"));
    await op(correctCall(weightCorrected, 1.7, 1100));
    await openForm(page, RAW_TOM_URL);

    for (const id of [reversedOnly, weightCorrected]) {
      const item = receiptItem(page, await lotNumberOf(id));
      await expect(voidButton(item)).toBeVisible();
      await expect(correctButton(item)).toBeVisible();
    }
  });

  test("AC-0091, AC-0092, AC-0093, AC-0170 to AC-0172, AC-0180, AC-0181: a corrected receipt shows its current values, what it was received as, and the reason", async ({
    page,
  }) => {
    const fixture = await saleFixture({ sale: true });
    await op(correctCall(fixture.lotAId, 1.86, 5000, "invoice price"));
    await openForm(page, RAW_TOM_URL);

    const item = receiptItem(page, fixture.lotANumber);
    await expect(factValue(item, "Cost per lb")).toHaveText("$1.8600/lb");
    await expect(factValue(item, "Weight")).toHaveText("5,000 lbs");
    await expect(item.getByText("Received as 5,000 lbs at $1.6800/lb.", { exact: true })).toBeVisible();
    await expect(item.getByText("Corrected: invoice price", { exact: true })).toBeVisible();
    // A receipt never corrected shows neither line.
    const other = receiptItem(page, fixture.lotBNumber);
    await expect(factValue(other, "Cost per lb")).toHaveText("$1.8000/lb");
    await expect(other.getByText(/^Received as /)).toHaveCount(0);
    await expect(other.getByText(/^Corrected: /)).toHaveCount(0);

    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Correct", "button Correct"]);
  });
});

test.describe("the confirmation", () => {
  test("AC-0094, AC-0095, AC-0179, AC-0170 to AC-0172, AC-0180, AC-0181: Correct opens a named confirmation with the current values and an empty reason", async ({
    page,
  }) => {
    const fixture = await saleFixture({ sale: true });
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, fixture.lotANumber);

    const dialog = await openCorrection(page, item, fixture.lotANumber, {});
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Cost per lb ($)")).toHaveValue("1.6800");
    await expect(dialog.getByLabel("Weight (lbs)")).toHaveValue("5000.000");
    await expect(dialog.getByLabel("Reason for the correction")).toHaveValue("");
    await expect(dialog).toHaveAccessibleDescription(
      new RegExp(`${fixture.lotANumber}.*Reyes Meats.*5,000 lbs`),
    );
    // The accessible names say the unit.
    await expect(dialog.getByRole("textbox", { name: /per lb/ })).toHaveCount(1);
    await expect(dialog.getByRole("textbox", { name: /lbs/ })).toHaveCount(1);
    // Cancel is first, and takes focus when the confirmation opens.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();

    expect(await checkPageState(page)).toEqual(DIALOG_CONTROLS);
  });

  test("AC-0113, AC-0178: Cancel and Escape close the confirmation, change nothing, and return focus to Correct", async ({
    page,
  }) => {
    const fixture = await saleFixture({ sale: true });
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, fixture.lotBNumber);
    const before = await correctedState(fixture.lotBId);
    const posts = countPosts(page);

    const dialog = await openCorrection(page, item, fixture.lotBNumber, { cost: "1.90", reason: "typed by mistake" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(correctButton(item)).toBeFocused();

    // Reopening starts from the receipt's values, and Escape closes it the same way.
    await correctButton(item).click();
    await expect(dialog.getByLabel("Cost per lb ($)")).toHaveValue("1.8000");
    await expect(dialog.getByLabel("Reason for the correction")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(correctButton(item)).toBeFocused();

    expect(posts.count).toBe(0);
    expect(await correctionCount()).toBe(0);
    expect(await correctedState(fixture.lotBId)).toEqual(before);
  });
});

test.describe("correcting", () => {
  test("AC-0096, AC-0097, AC-0098, AC-0100, AC-0174, AC-0170 to AC-0172, AC-0180, AC-0181: the panel shows the figures before and after, the batches restated, and the prices", async ({
    page,
  }) => {
    const { fixture, itemB } = await openSaleFixture(page);
    const batch1 = await batchNumber(fixture.batch1Id);
    const batch2 = await batchNumber(fixture.batch2Id);
    // The page stays loaded: a reload would also show the new values.
    await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));

    await correctThrough(page, itemB, fixture.lotBNumber, { cost: "1.90", weight: "3000", reason: "invoice price" });

    const panel = correctPanel(itemB);
    const heading = panel.getByRole("heading", { name: "Receipt corrected" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(panel.getByText(`Lot ${fixture.lotBNumber}`, { exact: true })).toBeVisible();
    await expect(correctDialog(page, fixture.lotBNumber)).toBeHidden();

    await expect(beforeAfter(panel, /^Cost per lb/)).toHaveText(["$1.8000/lb", "$1.9000/lb"]);
    await expect(beforeAfter(panel, /^Weight/)).toHaveText(["3,000 lbs", "3,000 lbs"]);
    await expect(beforeAfter(panel, /^Remaining/)).toHaveText(["1,000 lbs", "1,000 lbs"]);
    await expect(beforeAfter(panel, /^On hand/)).toHaveText(["1,000 lbs", "1,000 lbs"]);
    await expect(beforeAfter(panel, /^Average cost/)).toHaveText(["$1.8000/lb", "$1.9000/lb"]);

    // AC-0097: in draw order, with the product, the date, and the cost per finished lb.
    await expect(panel.getByRole("heading", { name: "Batches restated" })).toBeVisible();
    const rows = panel.getByRole("table").filter({ hasText: "Cost per finished lb" }).getByRole("row");
    await expect(rows.nth(1).getByRole("rowheader")).toHaveText(`${batch1}, 502, Oct 6, 2026`);
    await expect(rows.nth(1).getByRole("cell")).toHaveText(["$2.6578/lb", "$2.6794/lb"]);
    await expect(rows.nth(2).getByRole("rowheader")).toHaveText(`${batch2}, 502, Oct 7, 2026`);
    await expect(rows.nth(2).getByRole("cell")).toHaveText(["$2.7877/lb", "$2.9175/lb"]);

    // AC-0098: the suggested price of 502.
    await expect(beforeAfter(panel, /^502 Smoked Turkey Drums Tom/)).toHaveText(["$2.84/lb", "$2.97/lb"]);

    // AC-0100: the list shows the new values without a reload.
    await expect(factValue(itemB, "Cost per lb")).toHaveText("$1.9000/lb");
    await expect(itemB.getByText("Received as 3,000 lbs at $1.8000/lb.", { exact: true })).toBeVisible();
    await expect(itemB.getByText("Corrected: invoice price", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
    expect(await correctionCount()).toBe(1);

    expect((await checkPageState(page)).slice(-2)).toEqual(["button Correct", "button Correct"]);
  });

  test("AC-0118: a reversed batch is marked Reversed in Batches restated", async ({ page }) => {
    const fixture = await saleFixture({ sale: true });
    await op(reverseCall(fixture.batch2Id, "entered twice"));
    await openForm(page, RAW_TOM_URL);
    const batch2 = await batchNumber(fixture.batch2Id);
    const itemB = receiptItem(page, fixture.lotBNumber);

    await correctThrough(page, itemB, fixture.lotBNumber, { cost: "1.90", weight: "3000" });

    const panel = correctPanel(itemB);
    await expect(panel.getByRole("heading", { name: "Receipt corrected" })).toBeVisible();
    await expect(panel.getByRole("rowheader", { name: `${batch2}, 502, Oct 7, 2026, Reversed` })).toBeVisible();
  });

  test("AC-0099, AC-0170 to AC-0172, AC-0180, AC-0181: a weight-only correction, and a receipt no batch used, say No batch cost changed.", async ({
    page,
  }) => {
    const { fixture, itemB } = await openSaleFixture(page);
    await correctThrough(page, itemB, fixture.lotBNumber, { weight: "3100", reason: "scale ticket" });
    const panel = correctPanel(itemB);
    await expect(panel.getByRole("heading", { name: "Receipt corrected" })).toBeVisible();
    await expect(beforeAfter(panel, /^Weight/)).toHaveText(["3,000 lbs", "3,100 lbs"]);
    await expect(beforeAfter(panel, /^Remaining/)).toHaveText(["1,000 lbs", "1,100 lbs"]);
    await expect(panel.getByText("No batch cost changed.", { exact: true })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Batches restated" })).toHaveCount(0);
    expect((await checkPageState(page)).slice(-2)).toEqual(["button Correct", "button Correct"]);

    // A receipt that no batch used.
    const lone = await seedReceipt(500, 1.7, "2026-10-09");
    await openForm(page, RAW_TOM_URL);
    const loneItem = receiptItem(page, await lotNumberOf(lone));
    await correctThrough(page, loneItem, await lotNumberOf(lone), { cost: "1.75" });
    await expect(correctPanel(loneItem).getByText("No batch cost changed.", { exact: true })).toBeVisible();
    await expect(correctPanel(loneItem).getByRole("heading", { name: "Batches restated" })).toHaveCount(0);
  });

  test("AC-0101, AC-0170 to AC-0172, AC-0180, AC-0181: correcting the saved receipt turns the Receipt saved panel into a corrected line", async ({
    page,
  }) => {
    const f = await openForm(page, RAW_TOM_URL);
    await fillReceipt(f, { weight: "1000", cost: "1.68" });
    await f.save.click();
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeVisible();
    const lotNumber = (await factValue(f.result, "Lot number").textContent()) ?? "";
    await expect(f.result.getByRole("table")).toHaveCount(2);

    const item = receiptItem(page, lotNumber);
    await correctThrough(page, item, lotNumber, { cost: "1.70" });
    await expect(correctPanel(item).getByRole("heading", { name: "Receipt corrected" })).toBeVisible();

    await expect(f.result.getByText("This receipt was corrected.", { exact: true })).toBeVisible();
    await expect(f.result.getByRole("table")).toHaveCount(0);
    await expect(f.result.getByRole("heading", { name: "Receipt saved" })).toBeVisible();
    expect(await correctionCount()).toBe(1);
    await checkPageState(page);
  });

  test("AC-0173, AC-0174, AC-0178: the keyboard alone completes a correction, and Cancel returns focus to Correct", async ({
    page,
  }) => {
    const fixture = await saleFixture({ sale: true });
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, fixture.lotBNumber);
    const dialog = correctDialog(page, fixture.lotBNumber);

    // Cancel by the keyboard.
    await correctButton(item).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(correctButton(item)).toBeFocused();

    // Correct by the keyboard.
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Cost per lb ($)")).toBeFocused();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("1.90");
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Weight (lbs)")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Reason for the correction")).toBeFocused();
    await page.keyboard.type("invoice price");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Save correction" })).toBeFocused();
    await page.keyboard.press("Enter");

    const heading = correctPanel(item).getByRole("heading", { name: "Receipt corrected" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    expect(await correctedState(fixture.lotBId)).toMatchObject({ cost: "1.9000" });
  });
});

test.describe("a correction the page refuses", () => {
  test("AC-0102, AC-0103, AC-0106, AC-0175, AC-0182, AC-0170 to AC-0172, AC-0180, AC-0181: each field's message, focus on the first, every value kept", async ({
    page,
  }) => {
    const fixture = await saleFixture({ sale: true });
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, fixture.lotBNumber);
    const before = await correctedState(fixture.lotBId);
    const posts = countPosts(page);
    const dialog = await openCorrection(page, item, fixture.lotBNumber, { cost: "abc", weight: "0", reason: "   " });
    const cost = dialog.getByLabel("Cost per lb ($)");
    const weight = dialog.getByLabel("Weight (lbs)");
    const reason = dialog.getByLabel("Reason for the correction");
    await dialog.getByRole("button", { name: "Save correction" }).click();

    const messages = [
      { field: cost, text: "Enter the cost per lb, like 1.68." },
      { field: weight, text: "Weight must be above 0." },
      { field: reason, text: "Enter a reason for the correction." },
    ];
    for (const { field, text } of messages) {
      const message = dialog.getByText(text, { exact: true });
      await expect(message).toBeVisible();
      await expect(field).toHaveAttribute("aria-describedby", (await message.getAttribute("id")) ?? "missing");
      await expect(field).toHaveAttribute("aria-invalid", "true");
    }
    await expect(cost).toBeFocused();
    // The confirmation stays open with every field as typed.
    await expect(dialog).toBeVisible();
    await expect(cost).toHaveValue("abc");
    await expect(weight).toHaveValue("0");
    await expect(reason).toHaveValue("   ");
    expect((await checkPageState(page)).slice(0, 5)).toEqual(DIALOG_CONTROLS);

    // Fixing the first two leaves the reason as the first field with an error.
    await cost.fill("1.90");
    await weight.fill("3000");
    await dialog.getByRole("button", { name: "Save correction" }).click();
    await expect(reason).toBeFocused();
    await expect(dialog.getByText("Enter the cost per lb, like 1.68.")).toHaveCount(0);
    await expect(cost).not.toHaveAttribute("aria-describedby", /.+/);

    expect(posts.count).toBe(0);
    expect(await correctionCount()).toBe(0);
    expect(await correctedState(fixture.lotBId)).toEqual(before);
  });

  test("AC-0104, AC-0176, AC-0170 to AC-0172, AC-0180, AC-0181: the cost and weight the receipt already has show the form message, focused", async ({
    page,
  }) => {
    const fixture = await saleFixture({ sale: true });
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, fixture.lotBNumber);
    const posts = countPosts(page);
    const dialog = await openCorrection(page, item, fixture.lotBNumber, { cost: "1.8", weight: "3000", reason: "same" });
    await dialog.getByRole("button", { name: "Save correction" }).click();

    const message = dialog.getByText(NOTHING_TO_CORRECT, { exact: true });
    await expect(message).toBeVisible();
    await expect(message).toBeFocused();
    await expect(dialog.getByLabel("Cost per lb ($)")).toHaveValue("1.8");
    expect(posts.count).toBe(0);
    expect(await correctionCount()).toBe(0);
    expect((await checkPageState(page)).slice(0, 5)).toEqual(DIALOG_CONTROLS);
  });
});

test.describe("a correction the database refuses", () => {
  test("AC-0105, AC-0106, AC-0175, AC-0182, AC-0170 to AC-0172, AC-0180, AC-0181: a weight under what was used shows the floor beside the weight field", async ({
    page,
  }) => {
    const { fixture, itemB } = await openSaleFixture(page);
    const before = await correctedState(fixture.lotBId);
    const dialog = await openCorrection(page, itemB, fixture.lotBNumber, { weight: "1999.999", reason: "scale ticket" });
    await dialog.getByRole("button", { name: "Save correction" }).click();

    const text =
      "The weight can't be less than 2,000 lbs. Production used or adjustments removed that much of this receipt.";
    const message = dialog.getByText(text, { exact: true });
    await expect(message).toBeVisible();
    const weight = dialog.getByLabel("Weight (lbs)");
    await expect(weight).toBeFocused();
    await expect(weight).toHaveAttribute("aria-describedby", (await message.getAttribute("id")) ?? "missing");
    await expect(dialog).toBeVisible();
    await expect(weight).toHaveValue("1999.999");
    await expect(dialog.getByLabel("Cost per lb ($)")).toHaveValue("1.8000");
    await expect(dialog.getByLabel("Reason for the correction")).toHaveValue("scale ticket");
    expect(await correctionCount()).toBe(0);
    expect(await correctedState(fixture.lotBId)).toEqual(before);
    expect((await checkPageState(page)).slice(0, 5)).toEqual(DIALOG_CONTROLS);
  });

  test("AC-0104, AC-0106, AC-0176: the database finds the figures unchanged, because another correction landed first", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);
    const dialog = await openCorrection(page, item, lotNumber, { cost: "1.90", reason: "invoice price" });

    const lock = await holdStockLock();
    try {
      await dialog.getByRole("button", { name: "Save correction" }).click();
      await lock.waiting();
      // The same correction, in the transaction that holds the lock, then the lock is released.
      await lock.correctInside(id, "1.90", "1000", "invoice price");
    } finally {
      await lock.release();
    }

    const message = dialog.getByText(NOTHING_TO_CORRECT, { exact: true });
    await expect(message).toBeVisible();
    await expect(message).toBeFocused();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Cost per lb ($)")).toHaveValue("1.90");
    await expect(dialog.getByLabel("Reason for the correction")).toHaveValue("invoice price");
    expect(await correctionCount()).toBe(1);
  });

  test("AC-0107, AC-0177, AC-0170 to AC-0172, AC-0180, AC-0181: a receipt voided after the list loaded closes the confirmation and says so in the list", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);
    await expect(correctButton(item)).toBeVisible();
    await op(voidReceiptCall(id, "entered twice"));

    await correctThrough(page, item, lotNumber, { cost: "1.90" });

    const message = correctMessage(item);
    await expect(message).toContainText(NOT_CORRECTED);
    await expect(message).toContainText("Reload to see the latest stock.");
    expect(((await message.textContent()) ?? "").startsWith(NOT_CORRECTED)).toBe(true);
    await expect(message).toBeFocused();
    await expect(correctDialog(page, lotNumber)).toBeHidden();
    expect(await correctionCount()).toBe(0);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Void", "button Correct"]);
  });

  test("AC-0117, AC-0177: a refusal the page does not name, here the statement timeout of a held lock, closes the confirmation and says so", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);
    const before = await correctedState(id);

    const lock = await holdStockLock();
    try {
      await correctThrough(page, item, lotNumber, { cost: "1.90" });
      const message = correctMessage(item);
      await expect(message).toContainText(NOT_CORRECTED, { timeout: 25_000 });
      expect(((await message.textContent()) ?? "").startsWith(NOT_CORRECTED)).toBe(true);
      await expect(message).toBeFocused();
      await expect(correctDialog(page, lotNumber)).toBeHidden();
    } finally {
      await lock.release();
    }
    expect(await correctionCount()).toBe(0);
    expect(await correctedState(id)).toEqual(before);
    await checkPageState(page);
  });

  test("AC-0112: pressing Save correction again while the first call is waiting writes no second correction", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);
    const dialog = await openCorrection(page, item, lotNumber, { cost: "1.90", reason: "invoice price" });
    const save = dialog.getByRole("button", { name: "Save correction" });
    const posts = countPosts(page);

    const lock = await holdStockLock();
    try {
      await save.click();
      await lock.waiting();
      await expect(dialog.getByText("Saving…", { exact: true })).toBeVisible();
      await expect(save).toHaveAttribute("aria-disabled", "true");
      // Playwright treats aria-disabled as disabled, so the click is forced as a finger would press it.
      await save.click({ force: true });
      await save.press("Enter");
    } finally {
      await lock.release();
    }

    await expect(correctPanel(item).getByRole("heading", { name: "Receipt corrected" })).toBeVisible();
    expect(posts.count).toBe(1);
    expect(await correctionCount()).toBe(1);
  });
});

test.describe("a correction that ends in the list", () => {
  test("AC-0108, AC-0177: with the session ended, the confirmation closes and says the user is signed out", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);
    const before = await correctedState(id);

    await page.context().clearCookies();
    await correctThrough(page, item, lotNumber, { cost: "1.90" });

    const message = correctMessage(item);
    await expect(message).toHaveText(CORRECT_SIGNED_OUT);
    await expect(message).toBeFocused();
    await expect(correctDialog(page, lotNumber)).toBeHidden();
    expect(await correctionCount()).toBe(0);
    expect(await correctedState(id)).toEqual(before);
  });

  test("AC-0116, AC-0177, AC-0170 to AC-0172, AC-0180, AC-0181: a dropped connection says the receipt may not have been corrected", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);
    const dropped = await dropActionRequests(page);

    await correctThrough(page, item, lotNumber, { cost: "1.90" });

    const message = correctMessage(item);
    await expect(message).toHaveText(CORRECTION_UNKNOWN);
    await expect(message).toBeFocused();
    expect(dropped.count).toBe(1);
    await expect(correctDialog(page, lotNumber)).toBeHidden();
    await expect(correctButton(item)).toBeVisible();
    expect(await correctionCount()).toBe(0);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, "button Void", "button Correct"]);
  });

  test("AC-0111, AC-0170 to AC-0172, AC-0180, AC-0181: a read that fails after the write still shows the heading and the lot number", async ({
    page,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);

    // The read after the write reads the new correction row; the reads before do not.
    await query("revoke select on public.receipt_corrections from authenticated");
    try {
      await correctThrough(page, item, lotNumber, { cost: "1.90" });
      const panel = correctPanel(item);
      const heading = panel.getByRole("heading", { name: "Receipt corrected" });
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
      await expect(panel.getByText(`Lot ${lotNumber}`, { exact: true })).toBeVisible();
      await expect(panel.getByText(NOT_LOADED, { exact: true })).toBeVisible();
      await expect(panel.getByRole("table")).toHaveCount(0);
      expect(await correctionCount()).toBe(1);
      await checkPageState(page);
    } finally {
      await query("grant select on public.receipt_corrections to authenticated");
    }
  });
});

test.describe("the urgent banner", () => {
  test("AC-0087: correcting the wrong cost of the fifth receipt clears the urgent banner, without a reload", async ({
    page,
  }) => {
    await costEarlier();
    const fifth = await receiveTom(1000, "1.90");
    const lotNumber = await lotNumberOf(fifth);
    await openForm(page, RAW_TOM_URL);
    await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));
    const item = receiptItem(page, lotNumber);

    await correctThrough(page, item, lotNumber, { cost: "1.66" });

    await expect(correctPanel(item).getByRole("heading", { name: "Receipt corrected" })).toBeVisible();
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByText("urgent alert needs you")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
  });
});

test.describe("a replayed correct request", () => {
  test("AC-0004, AC-0005, AC-0007: with no session or a non-operator's, it corrects nothing and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const id = await seedReceipt(1000, 1.68);
    const lotNumber = await lotNumberOf(id);
    await openForm(page, RAW_TOM_URL);
    const item = receiptItem(page, lotNumber);

    // Capture the request a real correction sends and stop it before the server
    // sees it, so the lot is still as the page loaded it when the copies arrive.
    let captured: Request | undefined;
    await page.route("**/receiving**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) {
        captured = request;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await correctThrough(page, item, lotNumber, { cost: "1.90" });
    await expect.poll(() => captured).toBeDefined();
    if (!captured) throw new Error("no correct request was captured");
    expect(await correctionCount(), "corrections after the captured request was stopped").toBe(0);

    const headers = await captured.allHeaders();
    for (const name of ["cookie", "content-length", "host"]) delete headers[name];
    const sent: SentAction = { url: captured.url(), headers, body: captured.postDataBuffer() ?? Buffer.alloc(0) };
    const before = await correctedState(id);

    const replays = [
      { who: "no session", storageState: undefined, message: CORRECT_SIGNED_OUT },
      // The action's own text in full, not the bare sentence the not-allowed page also shows.
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: `${NOT_CORRECTED} ${NOT_ALLOWED}` },
    ];
    for (const { who, storageState, message } of replays) {
      expect(await replayText(playwright, baseURL, sent, storageState), `response for ${who}`).toContain(message);
      expect(await correctionCount(), `corrections after ${who}`).toBe(0);
      expect(await correctedState(id), `the lot after ${who}`).toEqual(before);
    }

    // Control: the request as captured, from the operator's session, does correct
    // the lot, so the refusals above came from who sent it and not from a bad copy.
    await replayText(playwright, baseURL, sent, OPERATOR_STATE);
    expect(await correctionCount()).toBe(1);
    expect(await correctedState(id)).toMatchObject({ cost: "1.9000" });
  });
});
