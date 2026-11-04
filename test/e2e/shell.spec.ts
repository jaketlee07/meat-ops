import { expect, test, type Page } from "@playwright/test";
import { resetTestData } from "../db";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// The app shell, end to end: the page color and, in later tasks, the menu and
// the top bar.

const PAGE_COLOR = "rgb(243, 246, 250)";
const NINE_PAGES = ["/receiving", "/production", "/menu", "/pricing", "/sales", "/trace", "/invoices", "/ask", "/alerts"];

test.beforeEach(async () => {
  await resetTestData();
});

async function bodyColor(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe("page color", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0006: /sign-in has the #F3F6FA page", async ({ page }) => {
      await page.goto("/sign-in");
      expect(await bodyColor(page)).toBe(PAGE_COLOR);
    });
  });

  test.describe("operator", () => {
    test.use({ storageState: OPERATOR_STATE });

    for (const path of NINE_PAGES) {
      test(`AC-0006: ${path} has the #F3F6FA page`, async ({ page }) => {
        await page.goto(path);
        expect(await bodyColor(page)).toBe(PAGE_COLOR);
      });
    }
  });

  test.describe("non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0006: /receiving not-allowed view has the #F3F6FA page", async ({ page }) => {
      await page.goto("/receiving");
      await expect(page.getByRole("heading", { level: 1, name: "Not allowed" })).toBeVisible();
      expect(await bodyColor(page)).toBe(PAGE_COLOR);
    });
  });
});
