import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const APP = join(ROOT, "src", "app");
const read = (...path: string[]) => readFileSync(join(ROOT, ...path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

it("AC-0020: the pricing page starts getPricingDetail and listPricing before it waits on either", () => {
  const page = read("src", "app", "pricing", "page.tsx");
  // The first call of each read in the product-details branch (the imports and the later list read excluded).
  const branch = page.slice(page.indexOf("if (productCode !== undefined)"), page.indexOf("const [rows, rawProducts]"));
  const detailCall = branch.indexOf("getPricingDetail(");
  const listCall = branch.indexOf("listPricing(");
  expect(detailCall, "the details branch calls getPricingDetail").toBeGreaterThan(-1);
  expect(listCall, "the details branch calls listPricing").toBeGreaterThan(-1);
  // Neither read is awaited on its own, and nothing waits between the two calls starting.
  expect(branch, "a read is awaited by itself").not.toMatch(/await\s+(getPricingDetail|listPricing)\(/);
  const between = branch.slice(Math.min(detailCall, listCall), Math.max(detailCall, listCall));
  expect(between.includes("await "), "an await sits between the two reads starting").toBe(false);
});

it("AC-0021: detail() in pricing-page.ts names its region property something other than main", () => {
  const helper = read("test", "e2e", "pricing-page.ts");
  const body = helper.slice(helper.indexOf("export function detail("), helper.indexOf("export type Detail"));
  expect(body).toContain("getByRole(\"region\", { name: \"Product details\" })");
  expect(body).not.toMatch(/^\s*main\s*[:,]/m);
  expect(body).toMatch(/^\s*region\s*[:,]/m);
});

it("AC-0022: the In use mark's fill token appears in no border- or divide- class and no border rule", () => {
  const receipts = read("src", "app", "receiving", "recent-receipts.tsx");
  const mark = receipts.match(/<p className="[^"]*\bbg-([a-z-]+)\b[^"]*">In use<\/p>/);
  expect(mark, "the In use mark has a bg- token").not.toBeNull();
  const token = mark![1]!;

  const uses = new RegExp(`\\b(?:[a-z-]+:)*(?:border|divide)(?:-[a-z]{1,2})?-${token}\\b`);
  const files = sourceFiles(APP).map((path) => ({ name: relative(ROOT, path), text: readFileSync(path, "utf8") }));
  expect(files.filter((f) => uses.test(f.text)).map((f) => f.name)).toEqual([]);

  const css = files.find((f) => f.name === "src/app/globals.css")!.text;
  const rules = css.split("\n").filter((line) => /border/.test(line) && line.includes(`--color-${token}`));
  expect(rules).toEqual([]);
});
