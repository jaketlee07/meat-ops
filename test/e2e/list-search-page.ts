import { expect, type Locator, type Page } from "@playwright/test";

// What the list-search specs share, named for all four lists: each list's search box, the section it sits in,
// and the checks of where a control sits. Menu's box is read through these; the three Recent lists add theirs beside it.

export const NO_MATCH = "No products match.";

// The section of the list a control belongs to: the nearest section above it.
export function sectionOf(control: Locator): Locator {
  return control.locator("xpath=ancestor::section[1]");
}

export function menuSearch(page: Page): Locator {
  return page.getByRole("textbox", { name: "Search products", exact: true });
}

// The status region inside Menu's section (the shell has one of its own).
export function menuStatus(page: Page): Locator {
  return sectionOf(page.getByLabel("Sellable only")).getByRole("status");
}

// Types a search into Menu's box as the owner would, one input event per change.
export async function typeMenuSearch(page: Page, text: string): Promise<void> {
  const box = menuSearch(page);
  await box.click();
  await box.fill(text);
  await expect(box).toHaveValue(text);
}

export async function boxOf(target: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const found = await target.boundingBox();
  expect(found, "box").not.toBeNull();
  return found!;
}

// A control sits inside its section's box, and neither it nor an ancestor clips or overflows sideways.
export async function expectInside(control: Locator, section: Locator, named: string): Promise<void> {
  const inner = await boxOf(control);
  const outer = await boxOf(section);
  expect(inner.x, `${named}: left edge`).toBeGreaterThanOrEqual(outer.x - 0.5);
  expect(inner.y, `${named}: top edge`).toBeGreaterThanOrEqual(outer.y - 0.5);
  expect(inner.x + inner.width, `${named}: right edge`).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
  expect(inner.y + inner.height, `${named}: bottom edge`).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
  const overflow = await control.evaluate((node) => ({
    // A text box scrolls its own long text inside itself, so only the other controls are read for their own overflow.
    own: node instanceof HTMLInputElement && node.type === "text" ? 0 : node.scrollWidth - node.clientWidth,
    clippedBy: (() => {
      const clips: string[] = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent);
        if (css.overflowX !== "visible" && parent.scrollWidth > parent.clientWidth + 0.5) {
          clips.push(parent.tagName.toLowerCase());
        }
      }
      return clips;
    })(),
  }));
  expect(overflow.own, `${named}: its own content overflows sideways`).toBeLessThanOrEqual(0);
  expect(overflow.clippedBy, `${named}: an ancestor clips sideways`).toEqual([]);
}

// The page does not scroll sideways at its current size.
export async function expectNoSidewaysScroll(page: Page, named: string): Promise<void> {
  const read = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  expect(read.scroll, `${named}: the page's scroll width`).toBeLessThanOrEqual(read.client);
  expect(read.body, `${named}: the body's scroll width`).toBeLessThanOrEqual(read.client);
}
