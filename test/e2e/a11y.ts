import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

// The per-state checks every page state must pass: the axe scan (AC-0025), the
// phone-width checks (AC-0026, AC-0054), and the keyboard focus checks
// (AC-0030, AC-0031). Call checkPageState(page) once the page is in the state.
// It returns the label of each focusable control in tab order, so a test can
// also assert that the walk reached the controls it expects.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const PHONE = { width: 320, height: 640 };
const MIN_CONTROL = 44;
const MIN_OUTLINE_WIDTH = 2;
const MIN_OUTLINE_CONTRAST = 3;
const MAX_TAB_PRESSES = 200;

interface FocusedControl {
  label: string;
  width: number;
  height: number;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
  // Computed background colors of the ancestors, nearest first.
  ancestorBackgrounds: string[];
}

type WalkStep =
  | { kind: "new"; control: FocusedControl }
  | { kind: "seen" } // focus is on an element already counted, so it counts once
  | { kind: "end" }; // focus left the page, or came back to the first element

export async function checkPageState(page: Page): Promise<string[]> {
  const axe = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    "axe violations",
  ).toEqual([]);

  const original = page.viewportSize();
  await page.setViewportSize(PHONE);
  try {
    const problems: string[] = [];

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    if (scrollWidth > PHONE.width) problems.push(`scroll width ${scrollWidth} is over ${PHONE.width}`);

    const controls = await walkTabOrder(page);
    if (controls.length === 0) problems.push("Tab reached no focusable control");
    for (const control of controls) problems.push(...controlProblems(control));

    expect(problems, `page checks at ${PHONE.width} x ${PHONE.height}`).toEqual([]);
    return controls.map((control) => control.label);
  } finally {
    if (original) await page.setViewportSize(original);
  }
}

// Presses Tab from the top of the page until focus leaves the page or returns
// to the first element reached. An element that keeps focus across presses
// counts once. A cycle among later controls never ends the walk, so it runs
// into the press limit below and fails the test.
async function walkTabOrder(page: Page): Promise<FocusedControl[]> {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
    // Put the focus starting point at the top of the document. While a modal
    // dialog is open the rest of the page is inert and cannot take focus, so
    // the top of the page for Tab is the top of the dialog.
    const marker = document.createElement("span");
    marker.tabIndex = -1;
    (document.querySelector("dialog:modal") ?? document.body).prepend(marker);
    marker.focus();
    marker.remove();
    (window as unknown as { __tabWalk: Element[] }).__tabWalk = [];
  });

  const controls: FocusedControl[] = [];
  for (let press = 0; press < MAX_TAB_PRESSES; press++) {
    await page.keyboard.press("Tab");
    const step = await page.evaluate((): WalkStep => {
      const seen = (window as unknown as { __tabWalk: Element[] }).__tabWalk;
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return { kind: "end" };
      const index = seen.indexOf(el);
      // Back on the first element after reaching others: the walk is complete.
      if (index === 0 && seen.length > 1) return { kind: "end" };
      if (index !== -1) return { kind: "seen" };
      seen.push(el);

      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const ancestorBackgrounds: string[] = [];
      for (let node = el.parentElement; node; node = node.parentElement) {
        ancestorBackgrounds.push(getComputedStyle(node).backgroundColor);
      }
      const name = el.id ? `#${el.id}` : (el.getAttribute("name") ?? el.textContent?.trim() ?? "");
      return {
        kind: "new",
        control: {
          label: `${el.tagName.toLowerCase()} ${name}`.trim(),
          width: box.width,
          height: box.height,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          outlineColor: style.outlineColor,
          ancestorBackgrounds,
        },
      };
    });
    if (step.kind === "end") return controls;
    if (step.kind === "new") controls.push(step.control);
  }
  throw new Error(`Tab was still moving after ${MAX_TAB_PRESSES} presses, so focus is likely trapped`);
}

function controlProblems(control: FocusedControl): string[] {
  const problems: string[] = [];
  const { label } = control;
  if (control.width < MIN_CONTROL || control.height < MIN_CONTROL) {
    problems.push(`${label} is ${control.width} x ${control.height}, under ${MIN_CONTROL} x ${MIN_CONTROL}`);
  }
  if (control.outlineStyle === "none") problems.push(`${label} has no outline when focused`);
  if (Number.parseFloat(control.outlineWidth) < MIN_OUTLINE_WIDTH) {
    problems.push(`${label} outline is ${control.outlineWidth}, under ${MIN_OUTLINE_WIDTH}px`);
  }
  const background = backgroundBehind(control.ancestorBackgrounds);
  const outline = flatten(parseColor(control.outlineColor), background);
  const ratio = contrastRatio(outline, background);
  if (ratio < MIN_OUTLINE_CONTRAST) {
    problems.push(`${label} outline contrast is ${ratio.toFixed(2)}:1, under ${MIN_OUTLINE_CONTRAST}:1`);
  }
  return problems;
}

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

function parseColor(css: string): Rgba {
  const match = /^rgba?\(([^)]+)\)$/.exec(css.trim());
  if (!match?.[1]) throw new Error(`Unsupported color format: ${css}`);
  const [r, g, b, a = "1"] = match[1].split(/[\s,/]+/).filter(Boolean);
  return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
}

// The background behind a focus ring is that of the nearest ancestor with a
// non-transparent background. A translucent one is laid over the next, and the
// page canvas is white.
function backgroundBehind(ancestorBackgrounds: string[]): Rgba {
  const layers: Rgba[] = [];
  for (const css of ancestorBackgrounds) {
    const color = parseColor(css);
    if (color.a === 0) continue;
    layers.push(color);
    if (color.a === 1) break;
  }
  return layers.reduceRight<Rgba>((below, layer) => flatten(layer, below), WHITE);
}

function flatten(top: Rgba, below: Rgba): Rgba {
  const mix = (a: number, b: number) => top.a * a + (1 - top.a) * b;
  return { r: mix(top.r, below.r), g: mix(top.g, below.g), b: mix(top.b, below.b), a: 1 };
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}
