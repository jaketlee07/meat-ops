import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

const APP = join(__dirname, "..", "src", "app");
const ICON_FILE = "src/app/line-icon.tsx";

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

const FILES = tsxFiles(APP).map((path) => ({
  name: relative(join(__dirname, ".."), path),
  text: readFileSync(path, "utf8"),
}));

it("AC-0014: no arbitrary radius or text size sits in a class under src/app", () => {
  const found = FILES.filter((f) => /\brounded(-[a-z]{1,2})?-\[|\btext-\[/.test(f.text)).map((f) => f.name);
  expect(found).toEqual([]);
});

it("AC-0015: only line-icon.tsx draws an svg", () => {
  expect(FILES.length).toBeGreaterThan(0);
  const found = FILES.filter((f) => f.text.includes("<svg")).map((f) => f.name);
  expect(found).toEqual([ICON_FILE]);
});

it("AC-0016: the icon component hides its svg from assistive technology", () => {
  const icon = FILES.find((f) => f.name === ICON_FILE);
  expect(icon, "line-icon.tsx exists").toBeDefined();
  const tag = icon!.text.match(/<svg[^>]*>/)?.[0] ?? "";
  expect(tag).toContain('aria-hidden="true"');
});
