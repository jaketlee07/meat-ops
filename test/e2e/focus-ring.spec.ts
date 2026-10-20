import { expect, test, type Page } from "@playwright/test";
import { checkPageState } from "./a11y";

// One page with one focusable button, drawn the way the app draws a faded
// control: the primary fill, white text, aria-disabled, and the app's focus ring.
function ringPage({ button = "", wrapper = "" }: { button?: string; wrapper?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Focus ring</title>
<style>
body { margin: 0; background: #fff; color: #111827; font: 16px sans-serif; }
button { min-width: 44px; min-height: 44px; padding: 0 16px; border: 0; border-radius: 6px; background: #1d4ed8; color: #fff; font: inherit; }
:focus-visible { outline: 2px solid #1d4ed8; outline-offset: 2px; }
</style>
</head>
<body><main><div style="${wrapper}"><button type="button" aria-disabled="true" style="${button}">Save</button></div></main></body>
</html>`;
}

const COLOR_CODE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

// The page-state checks' failure message without terminal color codes, or a
// fixed text when the checks pass.
async function checkFailure(page: Page): Promise<string> {
  try {
    await checkPageState(page);
  } catch (error) {
    return (error instanceof Error ? error.message : String(error)).replace(COLOR_CODE, "");
  }
  return "the page-state checks passed";
}

// STUB: AC-0007
test("AC-0007: a ring faded by its control's opacity is scored as drawn and fails at 2.90:1", async ({ page }) => {
  await page.setContent(ringPage({ button: "opacity: 0.6" }));
  expect(await checkFailure(page)).toContain("button Save outline contrast is 2.90:1, under 3:1");
});

const UNSCORABLE = [
  { effect: "the control has a filter", button: "filter: brightness(1)", wrapper: "" },
  { effect: "the control has a blend mode", button: "mix-blend-mode: multiply", wrapper: "" },
  { effect: "an ancestor has a filter", button: "", wrapper: "filter: brightness(1)" },
  { effect: "an ancestor has a blend mode", button: "", wrapper: "mix-blend-mode: multiply" },
  { effect: "an ancestor is faded", button: "", wrapper: "opacity: 0.9" },
];

for (const { effect, button, wrapper } of UNSCORABLE) {
  // STUB: AC-0008
  test(`AC-0008: when ${effect}, the ring cannot be scored and the check fails`, async ({ page }) => {
    await page.setContent(ringPage({ button, wrapper }));
    expect(await checkFailure(page)).toContain("button Save ring cannot be scored");
  });
}

test("AC-0007: a ring on a button whose fill fades by color is drawn at full strength and passes", async ({ page }) => {
  await page.setContent(ringPage({ button: "background: color-mix(in oklab, #1d4ed8 60%, transparent)" }));
  expect(await checkPageState(page)).toEqual(["button Save"]);
});
