import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { listOpenAlerts } from "../src/lib/alerts.js";
import {
  getStockValue,
  getTodaySales,
  listStockOnHand,
  listTodayBatches,
  listTodayReceipts,
  listTodaySales,
} from "../src/lib/home.js";
import type { TypedClient } from "../src/lib/supabase.js";
import { closePool, query, resetTestData } from "./db.js";
import { signInOperator } from "./users.js";

// Every name and figure in this file is made up. The first half checks that each of the "Today" page's
// reads throws when the database refuses it; the second half reads the page's source, as
// test/look-tidy.test.ts reads app source, to prove where the reads live.

const ROOT = join(__dirname, "..");
const TODAY = "2026-06-10";

let operator: TypedClient;

const RELATIONS_AND_READS: ReadonlyArray<[relation: string, read: (client: TypedClient) => Promise<unknown>]> = [
  ["v_daily_sales", (client) => getTodaySales(client, TODAY)],
  ["v_stock_value", (client) => getStockValue(client)],
  ["v_stock_on_hand", (client) => listStockOnHand(client)],
  ["lots", (client) => listTodayReceipts(client, TODAY)],
  ["production_batches", (client) => listTodayBatches(client, TODAY)],
  ["v_sale_summary", (client) => listTodaySales(client, TODAY)],
  ["v_alerts", (client) => listOpenAlerts(client)],
];

async function restoreAll(): Promise<void> {
  // Grants only where the read is missing: a GRANT makes PostgREST reload its schema cache.
  for (const [relation] of RELATIONS_AND_READS) {
    const [row] = await query<{ granted: boolean }>(
      `select has_table_privilege('authenticated', 'public.${relation}', 'select') as granted`,
    );
    if (!row?.granted) await query(`grant select on public.${relation} to authenticated`);
  }
}

beforeAll(async () => {
  operator = await signInOperator();
});
beforeEach(async () => {
  await resetTestData();
});
afterEach(async () => {
  await restoreAll();
});
afterAll(async () => {
  await closePool();
});

for (const [relation, read] of RELATIONS_AND_READS) {
  it(`AC-0033: the read of ${relation} throws when its select is revoked from authenticated, and succeeds before`, async () => {
    await expect(read(operator)).resolves.not.toThrow();
    await query(`revoke select on public.${relation} from authenticated`);
    try {
      await expect(read(operator)).rejects.toThrow(/failed: /);
    } finally {
      await query(`grant select on public.${relation} to authenticated`);
    }
    await expect(read(operator)).resolves.not.toThrow();
  });
}

// ---- AC-0036: where the reads live ----

const READS = [
  "getTodaySales",
  "getStockValue",
  "listOpenAlerts",
  "listTodayReceipts",
  "listTodayBatches",
  "listTodaySales",
  "listStockOnHand",
] as const;
const BANNED = [/catch/i, /allSettled/, /\.then\(/, /use\(/];

function parse(text: string): ts.SourceFile {
  return ts.createSourceFile("page.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function nodesOf(file: ts.SourceFile): ts.Node[] {
  const found: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

const calleeName = (call: ts.CallExpression): string | null =>
  ts.isIdentifier(call.expression) ? call.expression.text : null;

const READ_MODULES = ["../lib/home", "../lib/alerts"];

// The names the file binds, unaliased and not type-only, from src/lib/home or src/lib/alerts.
function boundFromLib(file: ts.SourceFile): Set<string> {
  const bound = new Set<string>();
  for (const node of file.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    if (!READ_MODULES.includes(node.moduleSpecifier.text)) continue;
    const clause = node.importClause;
    if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) continue;
    for (const element of clause.namedBindings.elements) {
      if (!element.isTypeOnly && !element.propertyName) bound.add(element.name.text);
    }
  }
  return bound;
}

// The function that holds a node directly, or null at the top level.
function enclosingFunction(node: ts.Node): ts.Node | null {
  for (let up = node.parent; up; up = up.parent) {
    if (ts.isFunctionLike(up)) return up;
  }
  return null;
}

function isDefaultExportedFunction(node: ts.Node | null): boolean {
  if (!node || !ts.isFunctionDeclaration(node)) return false;
  const words = ts.getModifiers(node)?.map((modifier) => modifier.kind) ?? [];
  return words.includes(ts.SyntaxKind.ExportKeyword) && words.includes(ts.SyntaxKind.DefaultKeyword);
}

// What the page's source breaks of AC-0036's first clause; an empty list passes.
function pageProblems(text: string): string[] {
  const problems: string[] = [];
  for (const banned of BANNED) if (banned.test(text)) problems.push(`holds the text ${banned}`);

  const file = parse(text);
  const nodes = nodesOf(file);
  const calls = nodes.filter(ts.isCallExpression);
  const alls = calls.filter((call) => call.expression.getText() === "Promise.all");
  if (alls.length !== 1) return [...problems, `holds ${alls.length} Promise.all calls, not 1`];
  const all = alls[0]!;
  if (!isDefaultExportedFunction(enclosingFunction(all))) {
    problems.push("the Promise.all is not inside the default-exported page function");
  }
  const bound = boundFromLib(file);
  for (const read of READS) {
    if (!bound.has(read)) problems.push(`${read} is not bound by an unaliased import from ../lib/home or ../lib/alerts`);
  }
  const awaited = all.parent;
  if (!ts.isAwaitExpression(awaited)) problems.push("the Promise.all is not awaited where it is written");
  const list = all.arguments[0];
  if (all.arguments.length !== 1 || !list || !ts.isArrayLiteralExpression(list)) {
    return [...problems, "the Promise.all does not take one array literal"];
  }

  const names: string[] = [];
  for (const element of list.elements) {
    const name = ts.isCallExpression(element) ? calleeName(element) : null;
    if (name === null || !(READS as readonly string[]).includes(name)) {
      problems.push(`an element is not a bare call of a read: ${element.getText()}`);
    } else {
      names.push(name);
    }
  }
  if (JSON.stringify([...names].sort()) !== JSON.stringify([...READS].sort())) {
    problems.push("the elements are not the seven reads, once each");
  }

  // No read is called anywhere but as an element, and no other call awaits.
  for (const call of calls) {
    const name = calleeName(call);
    if (name !== null && (READS as readonly string[]).includes(name) && !list.elements.includes(call)) {
      problems.push(`${name} is called outside the Promise.all elements`);
    }
  }
  const awaits = nodes.filter(ts.isAwaitExpression);
  for (const node of awaits) {
    const inside = node.getStart() >= list.getStart() && node.getEnd() <= list.getEnd();
    if (inside) problems.push("an await sits inside the Promise.all array");
  }
  return problems;
}

// The imports a section part takes: from src/lib only format.ts and type-only imports, and nothing
// from src/app/_server/.
function partProblems(text: string): string[] {
  const problems: string[] = [];
  for (const node of parse(text).statements) {
    if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
    const from = node.moduleSpecifier;
    if (!from || !ts.isStringLiteral(from)) continue;
    const path = from.text;
    if (path.includes("_server")) problems.push(`imports ${path}`);
    if (!/(^|\/)lib\//.test(path)) continue;
    if (/(^|\/)lib\/format$/.test(path)) continue;
    const typeOnly = ts.isImportDeclaration(node)
      ? Boolean(node.importClause?.isTypeOnly) ||
        (node.importClause?.namedBindings !== undefined &&
          ts.isNamedImports(node.importClause.namedBindings) &&
          !node.importClause.name &&
          node.importClause.namedBindings.elements.every((element) => element.isTypeOnly))
      : Boolean(node.isTypeOnly);
    if (!typeOnly) problems.push(`imports ${path} for a value`);
  }
  return problems;
}

const IMPORTED = `import { getTodaySales, getStockValue, listTodayReceipts, listTodayBatches, listTodaySales, listStockOnHand } from "../lib/home";
import { listOpenAlerts } from "../lib/alerts";`;
const GOOD = `${IMPORTED}
export default async function P() {
  const [a, b, c, d, e, f, g] = await Promise.all([
    getTodaySales(s, t), getStockValue(s), listOpenAlerts(s), listTodayReceipts(s, t),
    listTodayBatches(s, t), listTodaySales(s, t), listStockOnHand(s),
  ]);
}`;

// Each page below leaves the shape one way; a branch of pageProblems must name exactly that way.
const BAD_PAGES: ReadonlyArray<[what: string, page: string, problems: string[]]> = [
  ["holds a banned text", `${GOOD}\n// catch`, ["holds the text /catch/i"]],
  ["holds a second Promise.all", GOOD.replace("const [a", "await Promise.all([]); const [a"), ["holds 2 Promise.all calls, not 1"]],
  ["leaves the Promise.all unawaited", GOOD.replace("await Promise.all", "Promise.all"), ["the Promise.all is not awaited where it is written"]],
  [
    "gives the Promise.all a variable instead of an array literal",
    GOOD.replace(/Promise\.all\(\[[^]*?\]\)/, "Promise.all(list)"),
    ["the Promise.all does not take one array literal"],
  ],
  ["lists an element that is not a call", GOOD.replace("listStockOnHand(s),", "listStockOnHand(s), other,"), ["an element is not a bare call of a read: other"]],
  ["lists one read twice and leaves another out", GOOD.replace("listStockOnHand(s)", "getStockValue(s)"), ["the elements are not the seven reads, once each"]],
  [
    "calls a read outside the elements",
    GOOD.replace("const [a", "getTodaySales(s, t); const [a"),
    ["getTodaySales is called outside the Promise.all elements"],
  ],
  [
    "awaits inside an element's arguments",
    GOOD.replace("getStockValue(s)", "getStockValue(await s)"),
    ["an await sits inside the Promise.all array"],
  ],
  [
    "wraps a read in another call",
    GOOD.replace("getStockValue(s)", "keep(getStockValue(s))"),
    [
      "an element is not a bare call of a read: keep(getStockValue(s))",
      "the elements are not the seven reads, once each",
      "getStockValue is called outside the Promise.all elements",
    ],
  ],
  [
    "chains onto a read",
    GOOD.replace("listStockOnHand(s)", "listStockOnHand(s).x"),
    [
      "an element is not a bare call of a read: listStockOnHand(s).x",
      "the elements are not the seven reads, once each",
      "listStockOnHand is called outside the Promise.all elements",
    ],
  ],
  [
    "imports a read from another module",
    GOOD.replace(", listStockOnHand }", " }") + '\nimport { listStockOnHand } from "./wrapped";',
    ["listStockOnHand is not bound by an unaliased import from ../lib/home or ../lib/alerts"],
  ],
  [
    "imports a read under another name",
    GOOD.replace("listStockOnHand }", "keep as listStockOnHand }"),
    ["listStockOnHand is not bound by an unaliased import from ../lib/home or ../lib/alerts"],
  ],
  [
    "runs the Promise.all in a function that is not the default export",
    GOOD.replace("export default async function P", "export async function P"),
    ["the Promise.all is not inside the default-exported page function"],
  ],
  [
    "runs the Promise.all in a function nested in the default export",
    GOOD.replace("const [a, b, c, d, e, f, g] = await Promise.all([", "const run = async () => await Promise.all(["),
    ["the Promise.all is not inside the default-exported page function"],
  ],
];

it("AC-0036: the checker passes a page of seven bare calls imported from src/lib in the default-exported function", () => {
  expect(pageProblems(GOOD)).toEqual([]);
});

for (const [what, page, problems] of BAD_PAGES) {
  it(`AC-0036: the checker rejects a page that ${what}, and only for that`, () => {
    expect(pageProblems(page)).toEqual(problems);
  });
}

it("AC-0036: src/app/page.tsx awaits the seven reads in one Promise.all of bare calls and holds no handler text", () => {
  const page = readFileSync(join(ROOT, "src", "app", "page.tsx"), "utf8");
  expect(pageProblems(page)).toEqual([]);
});

it("AC-0036: the files under src/app/home/ import from src/lib only format.ts and type-only imports, and nothing from _server", () => {
  const dir = join(ROOT, "src", "app", "home");
  const files = (readdirSync(dir, { recursive: true }) as string[]).filter((name) => /\.tsx?$/.test(name));
  expect(files.length, "the home parts exist").toBeGreaterThan(0);
  for (const name of files) expect(partProblems(readFileSync(join(dir, name), "utf8")), name).toEqual([]);
  expect(partProblems(`import { alertText } from "../../lib/alert-text";`).length).toBe(1);
  expect(partProblems(`import type { A } from "../../lib/alerts";`)).toEqual([]);
  expect(partProblems(`import { type A } from "../../lib/alerts";`)).toEqual([]);
  expect(partProblems(`import { runWatch } from "../_server/watch";`).length).toBeGreaterThan(0);
});
