import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import type { ModelAnswer } from "../../src/lib/ask";
import { query, resetTestData, saleFixture, seedInvoiceFixture, tableFingerprints, type SaleFixture } from "../db";
import { NAV_CONTROLS } from "./alerts-page";
import type { FakeAnswer } from "./invoices-page";

// What the ask specs share: the ask catalog fixture, the page's parts, the model
// answers a test hands the fake model, and the control lists. The pg pool stays
// open: every spec in this worker shares it.

export const RAW_TKB_ID = "88888888-8888-8888-8888-888888888888";
export const PROD_503_ID = "99999999-9999-9999-9999-999999999999";

// The sale fixture after the 5,000-lb sale (with 502's list price at 3.29), plus
// an active raw RAW-TKB, an active finished 503 made from RAW-TKB, and, from the
// invoice fixture, an active raw RAW-CHK and an inactive raw RAW-OLD.
export async function askCatalogFixture(): Promise<SaleFixture> {
  await resetTestData();
  await seedInvoiceFixture();
  const fixture = await saleFixture({ listPrice: true, sale: true });
  await query(
    `insert into products(id, code, description, species, kind) values ($1, 'RAW-TKB', 'Turkey Breast (raw)', 'Turkey', 'raw')`,
    [RAW_TKB_ID],
  );
  await query(
    `insert into products(id, code, description, brand, species, kind, pack_style, lbs_per_pack, raw_product_id, shrink_pct)
     values ($1, '503', 'Smoked Turkey Breast', 'Prospect Meats', 'Turkey', 'finished', '56cs/pl', 32.5, $2, 0.2300)`,
    [PROD_503_ID, RAW_TKB_ID],
  );
  await query(
    `insert into product_fees(product_id, fee_type_id, amount_per_lb)
     select $1, fee_type_id, amount_per_lb from product_fees
     where product_id = '33333333-3333-3333-3333-333333333333'`,
    [PROD_503_ID],
  );
  return fixture;
}

// ---- Text ----

export const SIGNED_OUT_ASK = "You're signed out. Sign in again to ask a question.";
export const SIGNED_OUT_LOOKUP = "You're signed out. Sign in again to look up this answer.";
export const NOT_ALLOWED_ASK = "The question wasn't answered. This account isn't allowed to use Meat Ops.";
export const NOT_ALLOWED_LOOKUP = "The answer wasn't looked up. This account isn't allowed to use Meat Ops.";
export const QUESTION_BLANK = "Type a question, like: How much RAW-TOM do I have?";
export const QUESTION_TOO_LONG = "Keep the question to 500 characters or fewer.";
export const IN_FLIGHT = "Looking up your answer. This can take up to a minute.";
export const WHICH_PRODUCT = "Which product do you mean?";
export const NAME_THE_PRODUCT = "Name the product in your question, by its code or its description.";
export const NEED_SALE_NUMBER = "Add the sale number to your question.";
export const NEED_LOT_NUMBER = "Add the lot number to your question.";
export const DECLINE = "Ask can't answer that question. Try one of the questions below.";
export const ASK_AGAIN = "The answer couldn't be looked up. Ask your question again.";
export const LOOKUP_TRY_AGAIN = "The answer couldn't be looked up. Try again.";
export const TRY_AGAIN_ASK = "The question wasn't answered. Try again in a moment.";
export const KEY_REFUSED =
  "Ask isn't working. The model service refused the app's key. Check ANTHROPIC_API_KEY in the app's .env file.";
export const DECLINED_BY_MODEL = "The question wasn't answered. The model declined it. Try asking another way.";
export const NOT_SET_UP = "Ask isn't set up. Set ANTHROPIC_API_KEY in the app's .env file, then restart the app.";
export const ADDRESS_REFUSED =
  "Ask isn't set up. ANTHROPIC_BASE_URL must be unset, or a loopback address for tests. Fix it, then restart the app.";
export const NOTE = "Every figure here comes from Meat Ops' records. Claude only chose what to look up.";

export const RAW_TOM_LABEL = "RAW-TOM Turkey Drums TOM (raw)";
export const RAW_TKB_LABEL = "RAW-TKB Turkey Breast (raw)";

// ---- The fake model's answers ----

// A model answer the way the answer schema writes it, as the fake model's text.
export function modelAnswer(fields: {
  query: ModelAnswer["query"];
  product_code?: string | null;
  candidates?: string[];
  number?: string | null;
}): FakeAnswer {
  return {
    text: JSON.stringify({
      query: fields.query,
      product_code: fields.product_code ?? null,
      candidates: fields.candidates ?? [],
      number: fields.number ?? null,
    }),
  };
}

// AC-0050's example: a product code of the wrong kind, and a list that holds a
// duplicate and an inactive product.
export const CHOOSE_ANSWER = modelAnswer({
  query: "raw_stock",
  product_code: "502",
  candidates: ["502", "RAW-TOM", "RAW-TOM", "RAW-OLD", "RAW-TKB"],
});

export const DECLINE_ANSWER = modelAnswer({ query: null });

// ---- Page parts ----

export function parts(page: Page) {
  const answer = page.getByRole("region", { name: "Answer", exact: true });
  return {
    field: page.getByLabel("Your question"),
    ask: page.getByRole("button", { name: "Ask", exact: true }),
    // Not page.getByRole("status"): the header holds a status region of its own.
    status: page.locator("form [role=status]"),
    message: page.locator("#ask-message"),
    error: page.locator("#ask-question-error"),
    choices: page.getByRole("listitem").getByRole("button"),
    lookAgain: page.getByRole("button", { name: "Look it up again", exact: true }),
    answer,
    heading: page.getByRole("heading", { level: 2, name: "Answer", exact: true }),
    items: answer.getByRole("listitem"),
    link: answer.getByRole("link"),
    examples: page.getByRole("region", { name: "Questions Ask can answer", exact: true }),
  };
}

export type Parts = ReturnType<typeof parts>;

export function choice(p: Parts, label: string): Locator {
  return p.choices.filter({ hasText: label });
}

// Opens /ask and waits for the form.
export async function openAsk(page: Page, url = "/ask"): Promise<Parts> {
  await page.goto(url);
  const p = parts(page);
  await expect(p.ask).toBeVisible();
  return p;
}

// Types a question and presses Ask.
export async function ask(p: Parts, question: string): Promise<void> {
  await p.field.fill(question);
  await p.ask.click();
}

// The answer on screen: its lines, in the order the page shows them.
export async function shownAnswer(p: Parts) {
  const texts = (await p.answer.locator("p").allTextContents()).map((text) => text.trim());
  const items = (await p.items.allTextContents()).map((text) => text.trim());
  return {
    lookedUp: texts[0],
    lead: texts[1],
    tail: texts.length === 4 ? texts[2] : null,
    note: texts[texts.length - 1],
    items,
    linkName: ((await p.link.textContent()) ?? "").trim(),
    href: await p.link.getAttribute("href"),
  };
}

// ---- Control lists ----

// The page's own controls after Sign out.
export const ASK_OWN_CONTROLS = ["input #ask-question", "button Ask"];

// What Tab reaches on /ask on load: the navigation, Sign out, the field, and Ask.
export const ASK_CONTROLS = [...NAV_CONTROLS, ...ASK_OWN_CONTROLS];

// With product buttons or Look it up again after Ask, and an answer's link after that.
export function askControls(...after: string[]): string[] {
  return [...ASK_CONTROLS, ...after];
}

// ---- Database refusals ----

// Runs `during` with the sale summary view refused to signed-in users, so the
// sale_lots read fails, and restores the grant whether or not it passes.
export async function withSaleSummaryRefused(during: () => Promise<void>): Promise<void> {
  await query("revoke select on public.v_sale_summary from authenticated");
  try {
    await during();
  } finally {
    await query("grant select on public.v_sale_summary to authenticated");
  }
}

// ---- Presses change no row (AC-0086) ----

// One fingerprint (row count and content hash) for every table in public and in
// private, found through the catalog. Keys of private tables start "private.".
export async function allFingerprints(): Promise<Record<string, string>> {
  const out: Record<string, string> = { ...(await tableFingerprints()) };
  const tables = await query<{ name: string }>(`
    select c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_depend d where d.objid = c.oid and d.deptype = 'e')
    order by 1`);
  for (const t of tables) {
    const [row] = await query<{ n: number; h: string }>(
      `select count(*)::int as n, md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as h
       from private."${t.name}" t`,
    );
    out[`private.${t.name}`] = `${row?.n}:${row?.h}`;
  }
  return out;
}

export interface PressWatch {
  // One line per table a press changed, with the press that changed it.
  changes: string[];
  // The number of presses seen.
  presses: number;
  // Tables a test changes by hand while a press is in flight.
  ignore: Set<string>;
}

// Takes a fingerprint of every table before and after each ask or lookup press
// the context's pages send (a server action POST to /ask), so a test can assert
// that no press, whatever its outcome, changed a row. The response is fetched
// whole and passed on unchanged.
export async function watchPresses(context: BrowserContext): Promise<PressWatch> {
  const watch: PressWatch = { changes: [], presses: 0, ignore: new Set() };
  await context.route(
    (url) => url.pathname === "/ask",
    async (route) => {
      const request = route.request();
      if (request.method() !== "POST" || !("next-action" in request.headers())) {
        await route.continue().catch(() => {});
        return;
      }
      watch.presses += 1;
      const press = watch.presses;
      let step = "the fingerprint before";
      try {
        const before = await allFingerprints();
        step = "the fetch";
        const response = await route.fetch({ timeout: 0 });
        step = "the fingerprint after";
        const after = await allFingerprints();
        for (const name of Object.keys({ ...before, ...after })) {
          if (!watch.ignore.has(name) && before[name] !== after[name]) {
            watch.changes.push(`press ${press} changed ${name}`);
          }
        }
        step = "the fulfill";
        await route.fulfill({ response });
      } catch (error) {
        // A watch failure is a test failure: the line names the press, the step,
        // and the error, so the afterEach fails instead of the press passing unwatched.
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        watch.changes.push(`press ${press}: watch failed at ${step}: ${message}`);
        await route.abort().catch(() => {});
      }
    },
  );
  return watch;
}
