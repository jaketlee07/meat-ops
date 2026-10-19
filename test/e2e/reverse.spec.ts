import { expect, test, type Page, type Request } from "@playwright/test";
import { callAsOperator, correctCall, PROD_502_ID, query, resetTestData, reverseCall, saleFixture } from "../db";
import { checkPageState } from "./a11y";
import { replayText, type SentAction } from "./pricing-page";
import {
  BATCH_URL,
  batchItem,
  batchNumberOf,
  CHECK_HEADING,
  dropActionRequests,
  fillBatch,
  FORM_CONTROLS,
  NOT_LOADED,
  NOT_REVERSED,
  openForm,
  openReversal,
  REASON_REFUSAL,
  REVERSAL_UNKNOWN,
  REVERSE_DIALOG_CONTROLS,
  REVERSE_SIGNED_OUT,
  reverseButton,
  reverseDialog,
  reverseMessage,
  reversePanel,
  reversalState,
  reversedCount,
  reverseThrough,
  saveThrough,
  seed502Fixture,
} from "./production-page";
import { beforeAfter, factValue, holdStockLock, NOT_ALLOWED } from "./receiving-page";
import { restoreSaleItemsRead, revokeSaleItemsRead, seedSale } from "./sales-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";
import { open as openTrace } from "./trace-page";

// Reverse on /production, end to end: a real browser over the production build
// and the local database. Fixtures go through the operations; raw tables are
// read through pg to show what was or was not written.

test.use({ storageState: OPERATOR_STATE });

test.beforeEach(async () => {
  await resetTestData();
});

const op = async (call: Parameters<typeof callAsOperator>[0]) => {
  const outcome = await callAsOperator(call);
  expect(outcome.ok, outcome.error).toBe(true);
  return outcome;
};

// The action requests the page sends from now on, counted.
function countPosts(page: Page): { readonly count: number } {
  const posts = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && "next-action" in request.headers()) posts.count += 1;
  });
  return posts;
}

// The sale fixture, opened on 502. Batch 2 is listed first: the list is last entered first.
async function openFixture(page: Page, sale: boolean) {
  const fixture = await saleFixture({ sale });
  const batch1 = await batchNumberOf(fixture.batch1Id);
  const batch2 = await batchNumberOf(fixture.batch2Id);
  const f = await openForm(page, BATCH_URL);
  return { fixture, batch1, batch2, f, item1: batchItem(page, batch1), item2: batchItem(page, batch2) };
}

const REVERSE_BUTTONS = (count: number) => Array.from({ length: count }, () => "button Reverse");

test.describe("the list", () => {
  test("AC-0130, AC-0131, AC-0170 to AC-0172, AC-0180, AC-0181: Reverse on every batch not reversed; a reversed batch shows its reason and no button", async ({
    page,
  }) => {
    const fixture = await saleFixture();
    const batch1 = await batchNumberOf(fixture.batch1Id);
    const batch2 = await batchNumberOf(fixture.batch2Id);
    await openForm(page, BATCH_URL);
    // The list with a Reverse button on each batch.
    await expect(page.getByRole("button", { name: /^Reverse batch / })).toHaveCount(2);
    await expect(reverseButton(batchItem(page, batch1))).toHaveText("Reverse");
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...REVERSE_BUTTONS(2)]);

    // The list with a reversed batch.
    await op(reverseCall(fixture.batch2Id, "entered twice"));
    await openForm(page, BATCH_URL);
    const reversed = batchItem(page, batch2);
    await expect(reversed.getByText("Reversed: entered twice", { exact: true })).toBeVisible();
    await expect(reverseButton(reversed)).toHaveCount(0);
    await expect(reverseButton(batchItem(page, batch1))).toBeVisible();
    await expect(page.getByRole("button", { name: /^Reverse batch / })).toHaveCount(1);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...REVERSE_BUTTONS(1)]);
  });
});

test.describe("the confirmation", () => {
  test("AC-0132, AC-0133, AC-0134, AC-0170 to AC-0172, AC-0180, AC-0181: Reverse opens a named confirmation listing the lots, the finished lbs, and the sales", async ({
    page,
  }) => {
    const { batch1, batch2, item1, item2 } = await openFixture(page, true);

    // Batch 2 drew 1,000 lbs from lot B alone and left 770 finished lbs.
    const dialog = await openReversal(page, item2, batch2);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(new RegExp(`${batch2}.*Oct 7, 2026.*770 lbs`));
    await expect(dialog.getByRole("heading", { name: "Raw lbs that go back" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Finished lbs that leave stock" })).toBeVisible();
    await expect(factValue(dialog, "502 finished lbs")).toHaveText("770 lbs");
    const lotRows = dialog.locator("h3:text-is('Raw lbs that go back') + dl");
    await expect(lotRows.locator("dd")).toHaveText(["1,000 lbs"]);
    await expect(dialog.getByRole("heading", { name: "Sales to be voided" })).toBeVisible();
    await expect(factValue(dialog, "Sale number")).toHaveText("S-5000");
    await expect(factValue(dialog, "Sale date")).toHaveText("Oct 8, 2026");
    await expect(factValue(dialog, "Customer")).toHaveText("Fulton Market Deli");
    await expect(factValue(dialog, "Lbs")).toHaveText("5,000 lbs");
    await expect(dialog.getByLabel("Reason for the reversal")).toHaveValue("");
    // Cancel is first, and takes focus when the confirmation opens.
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    expect(await checkPageState(page)).toEqual(REVERSE_DIALOG_CONTROLS);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Batch 1 drew from both lots, in draw order.
    const first = await openReversal(page, item1, batch1);
    await expect(first.locator("h3:text-is('Raw lbs that go back') + dl dd")).toHaveText(["5,000 lbs", "1,000 lbs"]);
    await expect(first).toHaveAccessibleDescription(new RegExp(`${batch1}.*Oct 6, 2026.*4,620 lbs`));
  });

  test("AC-0133, AC-0170 to AC-0172, AC-0180, AC-0181: a batch no sale drew from says so", async ({ page }) => {
    const { batch2, item2 } = await openFixture(page, false);
    const dialog = await openReversal(page, item2, batch2);
    await expect(dialog.getByRole("heading", { name: "Sales to be voided" })).toBeVisible();
    await expect(dialog.getByText("No sale drew from this batch.", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Sale number")).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(REVERSE_DIALOG_CONTROLS);
  });

  test("AC-0147, AC-0178: Cancel and Escape close the confirmation, change nothing, and return focus to Reverse", async ({
    page,
  }) => {
    const { fixture, batch2, item2 } = await openFixture(page, true);
    const before = await reversalState(fixture.batch2Id);
    const posts = countPosts(page);

    const dialog = await openReversal(page, item2, batch2, "typed by mistake");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(reverseButton(item2)).toBeFocused();

    // Reopening starts with no reason, and Escape closes it the same way.
    await reverseButton(item2).click();
    await expect(dialog.getByLabel("Reason for the reversal")).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(reverseButton(item2)).toBeFocused();

    expect(posts.count).toBe(0);
    expect(await reversedCount()).toBe(0);
    expect(await reversalState(fixture.batch2Id)).toEqual(before);
  });
});

test.describe("reversing", () => {
  test("AC-0135, AC-0136, AC-0138, AC-0174, AC-0170 to AC-0172, AC-0180, AC-0181: the panel shows the stock before and after and the sale voided; the list shows the batch reversed", async ({
    page,
  }) => {
    const { fixture, batch2, item1, item2 } = await openFixture(page, true);
    // The page stays loaded: a reload would also show the reversal.
    await page.evaluate(() => ((window as unknown as { __kept: boolean }).__kept = true));

    await reverseThrough(page, item2, batch2, "entered twice");

    const panel = reversePanel(item2);
    const heading = panel.getByRole("heading", { name: "Batch reversed" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(panel.getByText(`Batch ${batch2}`, { exact: true })).toBeVisible();
    await expect(reverseDialog(page, batch2)).toBeHidden();

    await expect(beforeAfter(panel, /^On hand/)).toHaveText(["1,000 lbs", "2,000 lbs"]);
    await expect(beforeAfter(panel, /^Average cost/)).toHaveText(["$1.8000/lb", "$1.8000/lb"]);
    await expect(beforeAfter(panel, /^502 finished lbs on hand/)).toHaveText(["390 lbs", "4,620 lbs"]);

    // AC-0136: the sale, with what the owner needs to record it again.
    await expect(panel.getByRole("heading", { name: "Sales voided" })).toBeVisible();
    await expect(factValue(panel, "Sale number")).toHaveText("S-5000");
    await expect(factValue(panel, "Sale date")).toHaveText("Oct 8, 2026");
    await expect(factValue(panel, "Customer")).toHaveText("Fulton Market Deli");
    await expect(factValue(panel, "Lbs")).toHaveText("5,000 lbs");
    await expect(factValue(panel, "Price per lb")).toHaveText("$3.29/lb");
    await expect(panel.getByText("Record these sales again on Sales.", { exact: true })).toBeVisible();
    await expect(panel.getByText("No sale was voided.")).toHaveCount(0);

    // AC-0138: the list shows the batch as reversed without a reload.
    await expect(item2.getByText("Reversed: entered twice", { exact: true })).toBeVisible();
    await expect(reverseButton(item2)).toHaveCount(0);
    await expect(reverseButton(item1)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __kept?: boolean }).__kept)).toBe(true);
    expect(await reversedCount()).toBe(1);
    expect(await reversalState(fixture.batch2Id)).toMatchObject({ reversed: true, reason: "entered twice", voided: 1 });

    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...REVERSE_BUTTONS(1)]);
  });

  test("AC-0137, AC-0170 to AC-0172, AC-0180, AC-0181: a reversal that voids no sale says so", async ({ page }) => {
    const { batch2, item2 } = await openFixture(page, false);
    await reverseThrough(page, item2, batch2);
    const panel = reversePanel(item2);
    await expect(panel.getByRole("heading", { name: "Batch reversed" })).toBeVisible();
    await expect(panel.getByText("No sale was voided.", { exact: true })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Sales voided" })).toHaveCount(0);
    await expect(panel.getByText("Record these sales again on Sales.")).toHaveCount(0);
    await expect(beforeAfter(panel, /^On hand/)).toHaveText(["1,000 lbs", "2,000 lbs"]);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...REVERSE_BUTTONS(1)]);
  });

  test("AC-0142, AC-0170 to AC-0172, AC-0180, AC-0181: reversing the saved batch turns the Batch saved panel into a reversed line", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    await saveThrough(page, f);
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeVisible();
    const number = (await factValue(f.result, "Batch number").textContent()) ?? "";
    await expect(f.result.getByRole("heading", { name: "Lots used" })).toBeVisible();
    await expect(f.result.getByRole("table")).toHaveCount(1);

    await reverseThrough(page, batchItem(page, number), number);
    await expect(reversePanel(batchItem(page, number)).getByRole("heading", { name: "Batch reversed" })).toBeVisible();

    await expect(f.result.getByText("This batch was reversed.", { exact: true })).toBeVisible();
    await expect(f.result.getByRole("heading", { name: "Batch saved" })).toBeVisible();
    await expect(f.result.getByRole("heading", { name: "Lots used" })).toHaveCount(0);
    await expect(f.result.getByRole("heading", { name: "Finished stock added" })).toHaveCount(0);
    await expect(f.result.getByRole("table")).toHaveCount(0);
    expect(await reversedCount()).toBe(1);
    await checkPageState(page);
  });

  test("AC-0173, AC-0174, AC-0178: the keyboard alone completes a reversal, and Cancel returns focus to Reverse", async ({
    page,
  }) => {
    const { fixture, batch2, item2 } = await openFixture(page, true);
    const dialog = reverseDialog(page, batch2);

    // Cancel by the keyboard.
    await reverseButton(item2).focus();
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(reverseButton(item2)).toBeFocused();

    // Reverse by the keyboard.
    await page.keyboard.press("Enter");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Reason for the reversal")).toBeFocused();
    await page.keyboard.type("entered twice");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Reverse batch", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");

    const heading = reversePanel(item2).getByRole("heading", { name: "Batch reversed" });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    expect(await reversalState(fixture.batch2Id)).toMatchObject({ reversed: true });
  });

  test("AC-0146: a sale written after the page loaded is voided too and listed", async ({ page }) => {
    const { fixture, batch2, item2 } = await openFixture(page, false);
    // 4,620 lbs from batch 1 and 80 from batch 2, written through a pg operator session.
    await seedSale(4700);

    await reverseThrough(page, item2, batch2);

    const panel = reversePanel(item2);
    await expect(panel.getByRole("heading", { name: "Sales voided" })).toBeVisible();
    await expect(factValue(panel, "Lbs")).toHaveText("4,700 lbs");
    await expect(panel.getByText("No sale was voided.")).toHaveCount(0);
    expect(await reversalState(fixture.batch2Id)).toMatchObject({ reversed: true, voided: 1 });
  });

  test("AC-0148: a product made inactive after the page loaded shows its finished lbs on hand as Not available", async ({
    page,
  }) => {
    const { batch2, item2 } = await openFixture(page, false);
    await query("update products set active = false where id = $1", [PROD_502_ID]);

    await reverseThrough(page, item2, batch2, "entered twice");

    const panel = reversePanel(item2);
    await expect(panel.getByRole("heading", { name: "Batch reversed" })).toBeVisible();
    await expect(beforeAfter(panel, /^502 finished lbs on hand/)).toHaveText(["Not available", "Not available"]);
    await expect(beforeAfter(panel, /^On hand/)).toHaveText(["1,000 lbs", "2,000 lbs"]);
    // AC-0138 in this state: the list shows the batch reversed without a reload.
    await expect(item2.getByText("Reversed: entered twice", { exact: true })).toHaveCount(1);
    await expect(reverseButton(item2)).toHaveCount(0);
    expect(await reversedCount()).toBe(1);
  });
});

test.describe("a reversal the page refuses", () => {
  test("AC-0139, AC-0175, AC-0182, AC-0170 to AC-0172, AC-0180, AC-0181: a blank reason shows its message beside the field, focused, and keeps the confirmation open", async ({
    page,
  }) => {
    const { fixture, batch2, item2 } = await openFixture(page, true);
    const before = await reversalState(fixture.batch2Id);
    const posts = countPosts(page);
    const dialog = await openReversal(page, item2, batch2, "   ");
    await dialog.getByRole("button", { name: "Reverse batch", exact: true }).click();

    const reason = dialog.getByLabel("Reason for the reversal");
    const message = dialog.getByText(REASON_REFUSAL, { exact: true });
    await expect(message).toBeVisible();
    await expect(reason).toHaveAttribute("aria-describedby", (await message.getAttribute("id")) ?? "missing");
    await expect(reason).toHaveAttribute("aria-invalid", "true");
    await expect(reason).toBeFocused();
    await expect(dialog).toBeVisible();
    await expect(reason).toHaveValue("   ");
    expect(await checkPageState(page)).toEqual(REVERSE_DIALOG_CONTROLS);

    expect(posts.count).toBe(0);
    expect(await reversedCount()).toBe(0);
    expect(await reversalState(fixture.batch2Id)).toEqual(before);
  });
});

test.describe("a reversal that ends in the list", () => {
  test("AC-0140, AC-0177, AC-0170 to AC-0172, AC-0180, AC-0181: a batch reversed after the list loaded closes the confirmation and says so in the list", async ({
    page,
  }) => {
    const { fixture, batch2, item2 } = await openFixture(page, false);
    await op(reverseCall(fixture.batch2Id, "entered twice"));
    const before = await reversalState(fixture.batch2Id);

    await reverseThrough(page, item2, batch2, "second try");

    const message = reverseMessage(item2);
    await expect(message).toContainText(NOT_REVERSED);
    await expect(message).toContainText("Reload to see the latest stock.");
    expect(((await message.textContent()) ?? "").startsWith(NOT_REVERSED)).toBe(true);
    await expect(message).toBeFocused();
    await expect(reverseDialog(page, batch2)).toBeHidden();
    expect(await reversedCount()).toBe(1);
    expect(await reversalState(fixture.batch2Id)).toEqual(before);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...REVERSE_BUTTONS(2)]);
  });

  test("AC-0150, AC-0177, AC-0170 to AC-0172, AC-0180, AC-0181: a refusal the page does not name, here the statement timeout of a held lock, closes the confirmation and says so", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const { fixture, batch2, item2 } = await openFixture(page, false);
    const before = await reversalState(fixture.batch2Id);

    const lock = await holdStockLock();
    try {
      await reverseThrough(page, item2, batch2);
      const message = reverseMessage(item2);
      await expect(message).toContainText(NOT_REVERSED, { timeout: 25_000 });
      expect(((await message.textContent()) ?? "").startsWith(NOT_REVERSED)).toBe(true);
      await expect(message).toBeFocused();
      await expect(reverseDialog(page, batch2)).toBeHidden();
    } finally {
      await lock.release();
    }
    expect(await reversedCount()).toBe(0);
    expect(await reversalState(fixture.batch2Id)).toEqual(before);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...REVERSE_BUTTONS(2)]);
  });

  test("AC-0141, AC-0177: with the session ended, the confirmation closes and says the user is signed out", async ({
    page,
  }) => {
    const { fixture, batch2, item2 } = await openFixture(page, true);
    const before = await reversalState(fixture.batch2Id);

    await page.context().clearCookies();
    await reverseThrough(page, item2, batch2);

    const message = reverseMessage(item2);
    await expect(message).toHaveText(REVERSE_SIGNED_OUT);
    await expect(message).toBeFocused();
    await expect(reverseDialog(page, batch2)).toBeHidden();
    expect(await reversedCount()).toBe(0);
    expect(await reversalState(fixture.batch2Id)).toEqual(before);
  });

  test("AC-0149, AC-0177, AC-0170 to AC-0172, AC-0180, AC-0181: a dropped connection says the batch may not have been reversed", async ({
    page,
  }) => {
    const { batch2, item2 } = await openFixture(page, false);
    const dropped = await dropActionRequests(page);

    await reverseThrough(page, item2, batch2);

    const message = reverseMessage(item2);
    await expect(message).toHaveText(REVERSAL_UNKNOWN);
    await expect(message).toBeFocused();
    expect(dropped.count).toBe(1);
    await expect(reverseDialog(page, batch2)).toBeHidden();
    await expect(reverseButton(item2)).toBeVisible();
    expect(await reversedCount()).toBe(0);
    expect(await checkPageState(page)).toEqual([...FORM_CONTROLS, ...REVERSE_BUTTONS(2)]);
  });

  test("AC-0145, AC-0170 to AC-0172, AC-0180, AC-0181: a read that fails after the write still shows the heading and the batch number", async ({
    page,
  }) => {
    const { fixture, batch2, item2 } = await openFixture(page, true);
    const dialog = await openReversal(page, item2, batch2, "entered twice");

    // The read after the write lists the voided sales through sale_items; the reads before do not.
    await revokeSaleItemsRead();
    try {
      await dialog.getByRole("button", { name: "Reverse batch", exact: true }).click();
      const panel = reversePanel(item2);
      const heading = panel.getByRole("heading", { name: "Batch reversed" });
      await expect(heading).toBeVisible();
      await expect(heading).toBeFocused();
      await expect(panel.getByText(`Batch ${batch2}`, { exact: true })).toBeVisible();
      await expect(panel.getByText(NOT_LOADED, { exact: true })).toBeVisible();
      await expect(panel.getByRole("table")).toHaveCount(0);
      expect(await reversalState(fixture.batch2Id)).toMatchObject({ reversed: true });
      await checkPageState(page);
    } finally {
      await restoreSaleItemsRead();
    }
  });
});

test.describe("the check step", () => {
  test("AC-0151: the check step warns that a reversal voids sales and no longer says a batch can't be undone", async ({
    page,
  }) => {
    await seed502Fixture();
    const f = await openForm(page, BATCH_URL);
    await fillBatch(f, {});
    await f.save.click();
    const dialog = page.getByRole("dialog", { name: CHECK_HEADING });
    await expect(
      dialog.getByText("Check it before you save. Reversing a batch later voids every sale made from it.", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("A batch can't be undone.")).toHaveCount(0);
  });
});

test.describe("a replayed reverse request", () => {
  test("AC-0004, AC-0006, AC-0007: with no session or a non-operator's, it reverses nothing and says why", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const { fixture, batch2, item2 } = await openFixture(page, true);

    // Capture the request a real reversal sends and stop it before the server
    // sees it, so the batch is still as the page loaded it when the copies arrive.
    let captured: Request | undefined;
    await page.route("**/production**", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && "next-action" in request.headers()) {
        captured = request;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    await reverseThrough(page, item2, batch2);
    await expect.poll(() => captured).toBeDefined();
    if (!captured) throw new Error("no reverse request was captured");
    expect(await reversedCount(), "reversals after the captured request was stopped").toBe(0);

    const headers = await captured.allHeaders();
    for (const name of ["cookie", "content-length", "host"]) delete headers[name];
    const sent: SentAction = { url: captured.url(), headers, body: captured.postDataBuffer() ?? Buffer.alloc(0) };
    const before = await reversalState(fixture.batch2Id);

    const replays = [
      { who: "no session", storageState: undefined, message: REVERSE_SIGNED_OUT },
      // The action's own text in full, not the bare sentence the not-allowed page also shows.
      { who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: `${NOT_REVERSED} ${NOT_ALLOWED}` },
    ];
    for (const { who, storageState, message } of replays) {
      expect(await replayText(playwright, baseURL, sent, storageState), `response for ${who}`).toContain(message);
      expect(await reversedCount(), `reversals after ${who}`).toBe(0);
      expect(await reversalState(fixture.batch2Id), `the batch after ${who}`).toEqual(before);
    }

    // Control: the request as captured, from the operator's session, does
    // reverse the batch, so the refusals above came from who sent it.
    await replayText(playwright, baseURL, sent, OPERATOR_STATE);
    expect(await reversedCount()).toBe(1);
    expect(await reversalState(fixture.batch2Id)).toMatchObject({ reversed: true });
  });
});

test.describe("current values on /trace", () => {
  test("AC-0160: a corrected lot's cost shows on its own trace and under batch 1 on the sale's trace", async ({ page }) => {
    const fixture = await saleFixture({ sale: true });
    await op(correctCall(fixture.lotAId, 1.86, 5000, "invoice price"));

    await openTrace(page, `/trace?lot=${fixture.lotANumber}`);
    const lot = page.getByRole("region", { name: fixture.lotANumber, exact: true });
    await expect(factValue(lot.locator(":scope > dl"), "Cost per lb")).toHaveText("$1.8600/lb");

    await openTrace(page, "/trace?sale=S-5000");
    const sale = page.getByRole("region", { name: "S-5000", exact: true });
    const batch1 = sale.locator(":scope > ul > li").nth(0);
    const lotA = batch1.locator("ul > li").nth(0);
    await expect(lotA.getByRole("link")).toHaveText(fixture.lotANumber);
    await expect(factValue(lotA, "Cost per lb")).toHaveText("$1.8600/lb");
  });

  test("AC-0161, AC-0162: a lot corrected to 3,100 lbs shows 3,100 lbs on its trace and in the lot finder", async ({ page }) => {
    const fixture = await saleFixture({ sale: true });
    await op(correctCall(fixture.lotBId, 1.8, 3100, "scale ticket"));

    await openTrace(page, `/trace?lot=${fixture.lotBNumber}`);
    const lot = page.getByRole("region", { name: fixture.lotBNumber, exact: true });
    await expect(factValue(lot.locator(":scope > dl"), "Weight received")).toHaveText("3,100 lbs");

    await openTrace(page, "/trace?raw=RAW-TOM");
    const item = page
      .getByRole("region", { name: "Receipts of RAW-TOM" })
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name: fixture.lotBNumber, exact: true }) });
    await expect(factValue(item, "Weight")).toHaveText("3,100 lbs");
  });
});
