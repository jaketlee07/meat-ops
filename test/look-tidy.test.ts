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

// AC-0014's search. A class token is what sits between whitespace, quotes, backticks, braces, and `$`, except that
// a quote inside square brackets belongs to its class (the second pass below). Its variant prefix is everything up to its last colon outside square brackets; what is left is the class.
const RADIUS_ALLOWED =
  /^rounded(?:-(?:t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee))?-(?:control|card|mark)$|^rounded-(?:full|none)$/;

function radiusClasses(text: string): Array<{ prefix: string; cls: string }> {
  const found: Array<{ prefix: string; cls: string }> = [];
  const judge = (token: string) => {
    let depth = 0;
    let cut = -1;
    for (const [at, char] of [...token].entries()) {
      if (char === "[") depth += 1;
      else if (char === "]") depth -= 1;
      else if (char === ":" && depth === 0) cut = at;
    }
    const cls = token.slice(cut + 1).replace(/^!|!$/g, "");
    if (cls.startsWith("rounded")) found.push({ prefix: token.slice(0, cut + 1), cls });
  };
  // Every piece between quotes and the other breaks, so a class string a quote marks off stays visible.
  for (const token of text.split(/[\s"'`${}]+/)) judge(token);
  // A quote inside a class's square brackets is part of the class, so those tokens are also read whole.
  for (const token of text.split(/[\s`${}]+/)) {
    const whole = [...token].reduce(
      (state, char) => {
        if (char === "[") state.depth += 1;
        else if (char === "]") state.depth -= 1;
        const quote = /["']/.test(char);
        if (quote && state.depth <= 0) state.parts.push("");
        else state.parts[state.parts.length - 1] += char;
        if (quote && state.depth > 0) state.quoted = true;
        return state;
      },
      { depth: 0, quoted: false, parts: [""] },
    );
    if (whole.quoted) whole.parts.forEach(judge);
  }
  return found;
}

// Every radius class in the text that is not an allowed one, as `prefix` plus `cls`.
const disallowed = (text: string) =>
  radiusClasses(text)
    .filter(({ cls }) => !RADIUS_ALLOWED.test(cls))
    .map(({ prefix, cls }) => `${prefix}${cls}`);

// Each form of variant prefix the search must see through: one class it must flag and one it must pass.
const PREFIX_FORMS: Array<[form: string, prefix: string]> = [
  ["none", ""],
  ["name:", "md:"],
  ["[...]:", "[&>dl]:"],
  ["name-[...]: aria", "aria-[current=page]:"],
  ["name-[...]: data", "data-[state=open]:"],
  ["name-[...]: has", "has-[:checked]:"],
  ["name-[...]: min", "min-[40rem]:"],
  ["*:", "*:"],
  ["@name:", "@sm:"],
  ["@min-[...]:", "@min-[30rem]:"],
  ["name/label:", "group/item:"],
  ["stacked", "md:hover:[&>li]:aria-[current=page]:@sm:"],
  ["quoted [...]: single", "data-[state='open']:"],
  ["quoted [...]: double", 'aria-[sort="ascending"]:'],
  ["quoted nested [...]:", "[&[data-x='1']]:"],
];

// Each form of important mark: the class is judged as it would be without the mark. Tailwind 4 writes the mark
// after the class and still accepts the older spelling before it.
const MARKS: Array<[form: string, lead: string, trail: string]> = [
  ["leading !", "!", ""],
  ["leading ! behind a prefix", "md:!", ""],
  ["trailing !", "", "!"],
  ["trailing ! behind a prefix", "md:", "!"],
];

it("AC-0014: the search flags a disallowed radius class and passes an allowed one behind every prefix form", () => {
  for (const [form, prefix] of PREFIX_FORMS) {
    expect(disallowed(`className="p-2 ${prefix}rounded-lg"`), `${form}: a disallowed class is flagged`).toEqual([
      `${prefix}rounded-lg`,
    ]);
    expect(disallowed(`className={\`p-2 ${prefix}rounded-[3px] \${X}\`}`), `${form}: an arbitrary radius is flagged`).toEqual([
      `${prefix}rounded-[3px]`,
    ]);
    for (const allowed of ["rounded-control", "rounded-t-card", "rounded-mark", "rounded-full", "rounded-none"]) {
      expect(disallowed(`className="p-2 ${prefix}${allowed}"`), `${form}: ${allowed} passes`).toEqual([]);
      expect(radiusClasses(`"${prefix}${allowed}"`), `${form}: ${allowed} is seen`).toHaveLength(1);
    }
  }
  for (const [form, lead, trail] of MARKS) {
    expect(disallowed(`"p-2 ${lead}rounded-lg${trail}"`), `${form}: a disallowed class is flagged`).toEqual([
      `${lead.slice(0, lead.lastIndexOf(":") + 1)}rounded-lg`,
    ]);
    expect(disallowed(`"p-2 ${lead}rounded-card${trail}"`), `${form}: an allowed class passes`).toEqual([]);
    expect(radiusClasses(`"${lead}rounded-card${trail}"`), `${form}: an allowed class is seen`).toHaveLength(1);
  }
  // A quote that marks off a class string still leaves the class visible.
  expect(disallowed(`["rounded-lg", 'md:rounded-md']`), "classes in a quoted array are seen").toEqual([
    "rounded-lg",
    "md:rounded-md",
  ]);
  expect(disallowed('"bg-[color:var(--x)] [&>p]:text-sm rounded-md"'), "a colon inside brackets is not a prefix").toEqual([
    "rounded-md",
  ]);
});

it("AC-0014: the four page folders hold no radius class other than control, card, mark, full, or none", () => {
  const offenders: string[] = [];
  let exception = false;
  for (const folder of ["menu", "invoices", "ask", "alerts"]) {
    let seen = 0;
    for (const path of sourceFiles(join(APP, folder))) {
      const name = relative(ROOT, path);
      for (const { prefix, cls } of radiusClasses(readFileSync(path, "utf8"))) {
        seen += 1;
        if (RADIUS_ALLOWED.test(cls)) continue;
        if (name === "src/app/invoices/read-forms.tsx" && prefix === "file:" && cls === "rounded-md") {
          exception = true;
          continue;
        }
        offenders.push(`${name}: ${prefix}${cls}`);
      }
    }
    expect(seen, `${folder} holds at least one radius class`).toBeGreaterThan(0);
  }
  expect(exception, "the file:rounded-md exception in read-forms.tsx is met").toBe(true);
  expect(offenders, "radius classes other than the allowed ones").toEqual([]);
});
