import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

const APP = join(__dirname, "..", "src", "app");
const ICON_FILE = "src/app/line-icon.tsx";

// Every source file under src/app that can hold a class or an svg tag.
const SOURCE = /\.(tsx?|jsx?|mjs|cjs|css|svg|html|mdx?)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return SOURCE.test(entry.name) ? [path] : [];
  });
}

const FILES = sourceFiles(APP).map((path) => ({
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

it("the search reads the stylesheet and the plain .ts files, not only .tsx", () => {
  const names = FILES.map((f) => f.name);
  expect(names).toContain("src/app/globals.css");
  expect(names.some((name) => name.endsWith(".ts"))).toBe(true);
  expect(names.some((name) => name.endsWith(".tsx"))).toBe(true);
});
