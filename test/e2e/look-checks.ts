import { expect, type Locator, type Page } from "@playwright/test";

// The layout checks the look E list pages share. They live here once, and every suite that checks a
// table, a card, or a figure's fit imports them.

export async function box(target: Locator) {
  const found = await target.boundingBox();
  expect(found, "box").not.toBeNull();
  return found!;
}

export async function boxes(scope: Locator) {
  return Promise.all((await scope.all()).map((item) => box(item)));
}

export function values(scope: Locator): Locator {
  return scope.locator("dd");
}

export async function withTextSize(page: Page, width: number, height: number, px: number) {
  await page.setViewportSize({ width, height });
  await page.evaluate((size) => {
    document.documentElement.style.fontSize = `${size}px`;
  }, px);
}

// The shapes the three pages share. Each lives here once, and every test that checks the shape calls it.

// AC-0001: no child of <main> but a dialog has a computed max-width.
export async function expectNoCap(page: Page) {
  const widths = await page.locator("main > *").evaluateAll((children) =>
    children.filter((child) => child.tagName !== "DIALOG").map((child) => getComputedStyle(child).maxWidth),
  );
  expect(widths.length).toBeGreaterThan(2);
  expect(widths.filter((value) => value !== "none")).toEqual([]);
}

// One of the pages' lists of rows: its rows, its header line, and the names and figures in order.
// `numbered` is true where each row opens with a number cell (an h3 or h4) before its figures.
// `numeric` names the row's figures that are numbers (a weight, a cost, a price): the fit check must find
// each of them to be a figure. A date, a name, or an identifier is not one.
export type RowList = {
  items: Locator;
  header: Locator;
  names: string[];
  figures: string[];
  numbered: boolean;
  numeric: string[];
};

// Each row's number cell (a link or a heading) and its figures' values.
export function numberCell(row: Locator): Locator {
  return row.locator(":scope > h3, :scope > h4");
}

// The list reads as a table: one header line that names the columns in order, each row on one line with
// its number and figures in those columns, labels hidden visually, and no figure past its cell.
export async function expectTable(list: RowList, rows: number) {
  await expect(list.header).toBeVisible();
  const names = (await list.header.locator("span").allTextContents()).map((text) => text.trim());
  expect(names).toEqual(list.names);
  const headerBox = await box(list.header);
  const columns = await boxes(list.header.locator("span"));
  const first = list.numbered ? 1 : 0;
  const items = await list.items.all();
  expect(items).toHaveLength(rows);
  for (const row of items) {
    // The header line is above every row: a row's top is not above the header line's bottom.
    expect((await box(row)).y, "the header line is above the row").toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
    const heading = list.numbered ? [await box(numberCell(row))] : [];
    const cells = await boxes(values(row.locator(":scope > dl")));
    expect(cells).toHaveLength(list.figures.length);
    // The sale number is a 44 px link, so each cell's middle, not its top, lines up.
    const middles = [...heading, ...cells].map((cell) => cell.y + cell.height / 2);
    expect(Math.max(...middles) - Math.min(...middles), "one line").toBeLessThanOrEqual(6);
    if (heading[0]) expect(Math.abs(heading[0].x - columns[0]!.x), "number left").toBeLessThanOrEqual(1);
    cells.forEach((cell, index) => {
      expect(Math.abs(cell.x - columns[index + first]!.x), `column ${index + first} left`).toBeLessThanOrEqual(1);
      expect(Math.abs(cell.width - columns[index + first]!.width), `column ${index + first} width`).toBeLessThanOrEqual(1);
    });
    for (const label of await boxes(row.locator(":scope > dl dt"))) expect(label.width).toBeLessThanOrEqual(1);
    expect(await row.locator(":scope > dl dt").allTextContents()).toEqual(list.figures);
  }
  await expectNoSpill(list, rows);
}

// What counts as a figure number: a weight, a cost, or a price, as `src/lib/format.ts` writes it, before
// its first space ("1,500.000", "$12.35", "$1.25/lb"). Both fit checks read it from here.
export const FIGURE = /^\$?\d[\d,]*(\.\d+)?(\/lb)?$/;

// Each cell's text, whether it fits, whether its first text node's first word is a figure number, and
// how many lines that word covers (a figure number is one piece).
export async function measureCells(cells: Locator) {
  return cells.evaluateAll((nodes, source) =>
    nodes.map((cell) => {
      const node = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT).nextNode()!;
      const word = (node.textContent ?? "").split(" ")[0]!;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, word.length);
      const figure = new RegExp(source).test(word);
      return {
        text: cell.textContent ?? "",
        fits: cell.scrollWidth <= cell.clientWidth,
        figure,
        pieces: figure ? range.getClientRects().length : 1,
      };
    }),
  FIGURE.source);
}

// The fit check: no number's text and no figure's text runs past its cell, and no figure number splits
// across lines: the text before the first space sits in one piece, and a unit may drop under its number.
// An identifier such as a batch number may break at its hyphens. A number is measured in its own cell: the
// h3 or h4, not the link inside it. It fails when fewer figure cells are measured than the list holds.
export async function expectNoSpill(list: RowList, rows: number) {
  const cells = await measureCells(list.items.locator(":scope > dl dd, :scope > h3, :scope > h4"));
  expect(cells).toHaveLength(rows * (list.figures.length + (list.numbered ? 1 : 0)));
  // Each row's cells run: its number cell if it has one, then its figures in column order.
  const stride = list.figures.length + (list.numbered ? 1 : 0);
  const numeric = list.numeric.map((name) => list.figures.indexOf(name) + (list.numbered ? 1 : 0));
  for (let row = 0; row < rows; row += 1) {
    for (const column of numeric) expect(cells[row * stride + column]?.figure, `row ${row} column ${column} is a figure`).toBe(true);
  }
  expect(cells.filter((cell) => !cell.fits || cell.pieces !== 1)).toEqual([]);
}

// The list reads as cards: no header line, each figure on its own line with its label visible beside it.
export async function expectCards(list: RowList, rows: number) {
  await expect(list.header, "the table is off").toBeHidden();
  const items = await list.items.all();
  expect(items).toHaveLength(rows);
  for (const row of items) {
    const figures = row.locator(":scope > dl");
    const cells = await boxes(values(figures));
    const labels = await boxes(figures.locator("dt"));
    expect(cells).toHaveLength(list.figures.length);
    expect(labels).toHaveLength(list.figures.length);
    for (let i = 1; i < cells.length; i += 1) {
      expect(cells[i]!.y, `value ${i} below value ${i - 1}`).toBeGreaterThanOrEqual(cells[i - 1]!.y + cells[i - 1]!.height);
    }
    labels.forEach((label, index) => {
      expect(label.width, `label ${index} is not hidden`).toBeGreaterThan(20);
      expect(Math.abs(label.y - cells[index]!.y), `label ${index} on its value's first line`).toBeLessThanOrEqual(4);
      expect(label.x + label.width, `label ${index} left of its value`).toBeLessThanOrEqual(cells[index]!.x + 1);
    });
    for (const label of await figures.locator("dt").all()) await expect(label).toBeVisible();
  }
}

// With 20 px text a list may be a table or cards: either way no figure runs past its cell, and a card
// keeps each label beside its value.
export async function expectEitherFits(list: RowList, rows: number) {
  await expectNoSpill(list, rows);
  if (await list.header.isVisible()) return;
  await expectCards(list, rows);
}

// A message area (a panel or a refusal) takes its row's whole width below the row's figures: it starts
// below them, at their left edge, runs to the row's right padding, and ends inside the row.
export async function expectSpansRow(item: Locator, area: Locator, what: string) {
  const row = await box(item);
  const figures = await box(item.locator(":scope > dl"));
  const shown = await box(area);
  expect(shown.y, `${what} sits below the figures`).toBeGreaterThanOrEqual(figures.y + figures.height - 1);
  expect(shown.x, `${what} starts at the row's left padding`).toBeLessThanOrEqual(figures.x + 1);
  expect(shown.x + shown.width, `${what} runs to the row's right padding`).toBeGreaterThanOrEqual(row.x + row.width - 17);
  expect(shown.x + shown.width, `${what} ends inside its row`).toBeLessThanOrEqual(row.x + row.width);
}

// Every button sits inside its list's section.
export async function expectButtonsInside(section: Locator, buttons: Locator, count: number) {
  await expect(buttons).toHaveCount(count);
  const outer = await box(section);
  for (const button of await boxes(buttons)) {
    expect(button.x, "a button starts inside the section").toBeGreaterThanOrEqual(outer.x);
    expect(button.x + button.width, "a button ends inside the section").toBeLessThanOrEqual(outer.x + outer.width);
    expect(button.y + button.height, "a button ends inside the section, bottom").toBeLessThanOrEqual(outer.y + outer.height);
  }
}

// ---- Before-and-after tables inside their card or item ----

// Every before-and-after table in `item` ends at or left of the item's right edge less its right padding,
// no cell's text (a row label included) runs past its cell, and no number in a Before or After cell splits
// across lines (the text before the first space sits in one piece; a unit may drop under its number).
export async function expectTablesFit(name: string, item: Locator, minimum: number, numbers: number) {
  await expect(item.locator("table").first()).toBeVisible();
  const report = await item.evaluate((card) => {
    const inner = card.getBoundingClientRect().right - parseFloat(getComputedStyle(card).paddingRight);
    const problems: string[] = [];
    const tables = [...card.querySelectorAll("table")];
    for (const table of tables) {
      const edge = table.getBoundingClientRect().right;
      if (edge > inner + 0.5) problems.push(`table right ${edge} is past the inner edge ${inner}`);
    }
    return { tables: tables.length, problems };
  });
  expect(report.tables, `${name}: tables`).toBeGreaterThanOrEqual(minimum);
  // Every cell, the row labels and column names included, keeps its text inside it; a row label may wrap.
  for (const cell of await measureCells(item.locator("table th, table tbody td"))) {
    if (!cell.fits) report.problems.push(`"${cell.text}" runs past its cell`);
  }
  // Only the Before and After cells must keep their number in one piece; `numbers` of them hold a figure
  // number the fixture put there.
  const values = await measureCells(item.locator("table tbody td"));
  expect(values.filter((cell) => cell.figure).length, `${name}: figure cells measured`).toBeGreaterThanOrEqual(numbers);
  for (const cell of values) {
    if (cell.pieces !== 1) report.problems.push(`the number in "${cell.text}" splits across lines`);
  }
  expect.soft(report.problems, name).toEqual([]);
}
