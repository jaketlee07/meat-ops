import { readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { CATALOG, QUERY_IDS } from "../../src/lib/ask";
import { receiveLot } from "../../src/lib/rpc";
import {
  callAsOperator,
  CUSTOMER_ID,
  idOf,
  type OpCall,
  PROD_502_ID,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  saleFixture,
  type SaleFixture,
  VENDOR_ID,
  voidSaleCall,
} from "../db";
import { resolveStackEnv } from "../env";
import { OPERATOR_EMAIL, signInOperator } from "../users";
import { checkPageState } from "./a11y";
import {
  alertStates,
  banner,
  captureAction,
  HEADER_PAGES,
  marginCase,
  opens,
  setActive,
  WATCH_FAILED,
  withSeeAlerts,
  withWatchRefused,
} from "./alerts-page";
import {
  ADDRESS_REFUSED,
  allFingerprints,
  ask,
  ASK_AGAIN,
  ASK_CONTROLS,
  askCatalogFixture,
  askControls,
  CHOOSE_ANSWER,
  choice,
  DECLINE,
  DECLINE_ANSWER,
  DECLINED_BY_MODEL,
  IN_FLIGHT,
  KEY_REFUSED,
  LOOKUP_TRY_AGAIN,
  modelAnswer,
  NAME_THE_PRODUCT,
  NEED_LOT_NUMBER,
  NEED_SALE_NUMBER,
  NOT_ALLOWED_ASK,
  NOT_ALLOWED_LOOKUP,
  NOT_SET_UP,
  NOTE,
  openAsk,
  QUESTION_BLANK,
  QUESTION_TOO_LONG,
  RAW_TKB_ID,
  RAW_TKB_LABEL,
  RAW_TOM_LABEL,
  shownAnswer,
  SIGNED_OUT_ASK,
  SIGNED_OUT_LOOKUP,
  TRY_AGAIN_ASK,
  watchPresses,
  WHICH_PRODUCT,
  withSaleSummaryRefused,
  type PressWatch,
} from "./ask-page";
import {
  ANTHROPIC_TEST_AUTH_TOKEN,
  ANTHROPIC_TEST_KEY,
  type FakeAnswer,
  type FakeModel,
  fakeModel,
  FRAMING,
  ports,
  replayWith,
  startSpare,
} from "./invoices-page";
import { NOT_ALLOWED, sendsActionRequest } from "./receiving-page";
import { isAuthCookie, readSession, withExpiredAccessToken } from "./session";
import { NON_OPERATOR_STATE, OPERATOR_STATE, signInThroughForm } from "./states";

// The ask page, end to end: a real browser over the production build, the local
// database, and the fake model service, which hands out the model's answers and
// records what each press sent. Fixtures go through the operations and pg.

test.use({ storageState: OPERATOR_STATE });

let model: FakeModel;
let fixture: SaleFixture;
// AC-0086: every ask and lookup press in this file is watched, and none may change a row.
let presses: PressWatch;

test.beforeEach(async ({ baseURL, context }) => {
  fixture = await askCatalogFixture();
  model = fakeModel(baseURL);
  await model.reset();
  presses = await watchPresses(context);
});

test.afterEach(() => {
  expect(presses.changes, "rows changed by a press").toEqual([]);
});

async function run(call: OpCall): Promise<string> {
  const outcome = await callAsOperator(call);
  expect(outcome.ok, `${call.fn}: ${outcome.error}`).toBe(true);
  return idOf(outcome);
}

// The production 502 fixture's two RAW-TOM receipts.
async function twoReceipts(): Promise<void> {
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 5000, 1.68, "2026-10-01"));
  await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 3000, 1.8, "2026-10-05"));
}

async function requestCount(): Promise<number> {
  return (await model.requests()).length;
}

test.describe("access and navigation", () => {
  test.describe("signed out", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("AC-0001: /ask ends on /sign-in", async ({ page }) => {
      await page.goto("/ask");
      await expect(page).toHaveURL(/\/sign-in$/);
    });

    test("AC-0007: /ask carries the framing headers, signed out", async ({ request }) => {
      const response = await request.get("/ask");
      for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
      // The redirect itself carries them too.
      const redirect = await request.get("/ask", { maxRedirects: 0 });
      for (const [name, value] of Object.entries(FRAMING)) expect(redirect.headers()[name]).toBe(value);
    });
  });

  test.describe("signed in as a non-operator", () => {
    test.use({ storageState: NON_OPERATOR_STATE });

    test("AC-0002: /ask shows the not-allowed message, Sign out, and no question field", async ({ page }) => {
      await page.goto("/ask");
      await expect(page.getByText(NOT_ALLOWED, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
      await expect(page.getByLabel("Your question")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Ask", exact: true })).toHaveCount(0);
      expect(await checkPageState(page)).toEqual(["button Sign out"]);
    });
  });

  test("AC-0007: /ask carries the framing headers, signed in", async ({ request }) => {
    const response = await request.get("/ask");
    expect(response.status()).toBe(200);
    for (const [name, value] of Object.entries(FRAMING)) expect(response.headers()[name]).toBe(value);
  });

  test("AC-0003, AC-0004, AC-0015: an ask or lookup replayed with no session or a non-operator's sends no request and answers nothing", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const p = await openAsk(page);
    await model.answer(CHOOSE_ANSWER);
    await p.field.fill("How much turkey do I have?");
    const askSent = await captureAction(page, () => p.ask.click());
    await expect(p.choices).toHaveCount(2);
    const lookupSent = await captureAction(page, () => choice(p, RAW_TKB_LABEL).click());
    await expect(p.answer).toBeVisible();
    const before = await requestCount();
    expect(before).toBe(1);

    const replays = [
      { sent: askSent, who: "no session", storageState: undefined, message: SIGNED_OUT_ASK },
      { sent: askSent, who: "a non-operator's session", storageState: NON_OPERATOR_STATE, message: NOT_ALLOWED_ASK },
      { sent: lookupSent, who: "no session", storageState: undefined, message: SIGNED_OUT_LOOKUP },
      {
        sent: lookupSent,
        who: "a non-operator's session",
        storageState: NON_OPERATOR_STATE,
        message: NOT_ALLOWED_LOOKUP,
      },
    ];
    for (const { sent, who, storageState, message } of replays) {
      const text = await replayWith(playwright, baseURL, sent, storageState);
      expect(text, `response for ${who}`).toContain(message);
      expect(text, `response for ${who}`).not.toContain("Looked up: ");
      expect(await requestCount(), `requests after ${who}`).toBe(before);
    }
  });

  test("AC-0005: every header page, /alerts, and /ask link Ask immediately before Alerts", async ({ page }) => {
    const check = async (url: string) => {
      const links = page.getByRole("navigation", { name: "Primary" }).getByRole("link");
      const names = (await links.allTextContents()).map((name) => name.trim());
      const at = names.indexOf("Alerts");
      expect(at, url).toBeGreaterThan(0);
      expect(names[at - 1], url).toBe("Ask");
      await expect(links.nth(at - 1), url).toHaveAttribute("href", "/ask");
    };
    for (const url of [...HEADER_PAGES, "/ask"]) {
      await page.goto(url);
      await check(url);
    }
    await opens(page);
    await check("/alerts");
  });

  test("AC-0006: on /ask only the Ask link carries aria-current, and its value is page", async ({ page }) => {
    await openAsk(page);
    const marked = page.getByRole("navigation", { name: "Primary" }).locator("a[aria-current]");
    await expect(marked).toHaveCount(1);
    await expect(marked).toHaveText("Ask");
    await expect(marked).toHaveAttribute("aria-current", "page");
  });

  test("AC-0008: in the margin case /ask shows 1 urgent alert needs you, with a link to /alerts", async ({ page }) => {
    await resetTestData();
    await marginCase();
    await openAsk(page);
    await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
    await expect(banner(page).getByRole("link", { name: "See alerts" })).toHaveAttribute("href", "/alerts");
    // The page with the urgent banner.
    expect(await checkPageState(page)).toEqual(withSeeAlerts(ASK_CONTROLS));
  });

  test("AC-0009, AC-0016: a refused watch shows Alerts couldn't be checked, and an ask press still shows its answer", async ({
    page,
  }) => {
    await withWatchRefused(async () => {
      const p = await openAsk(page);
      await expect(banner(page).getByText(WATCH_FAILED, { exact: true })).toBeVisible();
      // The page with the watch failure line.
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);

      await model.answer(modelAnswer({ query: "sellable_now" }));
      await ask(p, "What can I sell right now?");
      await expect(p.answer).toBeVisible();
      await expect(p.answer.getByText("You can sell 1 product now:", { exact: true })).toBeVisible();
    });
  });
});

test.describe("the page", () => {
  test("AC-0010: the page has the field, Ask, and the eight example questions in catalog order", async ({ page }) => {
    const p = await openAsk(page);
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await expect(p.field).toHaveAttribute("type", "text");
    await expect(p.field).not.toHaveAttribute("maxlength");
    await expect(p.ask).toBeVisible();
    await expect(p.examples.getByRole("heading", { level: 2 })).toHaveText("Questions Ask can answer");
    const examples = (await p.examples.getByRole("listitem").allTextContents()).map((text) => text.trim());
    expect(examples).toEqual(QUERY_IDS.map((id) => CATALOG[id].example));
    expect(examples).toHaveLength(8);
    // First-run: the field, Ask, and the list; no message, no answer, no status text.
    await expect(p.answer).toHaveCount(0);
    await expect(p.status).toHaveText("");
    expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
  });

  for (const [name, question, message] of [
    ["a blank question", "   ", QUESTION_BLANK],
    ["a question of 501 characters", "a".repeat(501), QUESTION_TOO_LONG],
  ] as const) {
    test(`AC-0011, AC-0105, AC-0107: ${name} is refused beside the field and sends no request`, async ({ page }) => {
      const p = await openAsk(page);
      const sent = sendsActionRequest(page);
      await ask(p, question);
      await expect(p.error).toHaveText(message);
      expect(await sent).toBe(false);
      expect(await requestCount()).toBe(0);
      await expect(p.field).toBeFocused();
      await expect(p.field).toHaveAttribute("aria-describedby", "ask-question-error");
      await expect(p.field).toHaveValue(question);
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
    });
  }

  test("AC-0011, AC-0018: a replayed question counts each CR LF pair once", async ({ page, playwright, baseURL }) => {
    const p = await openAsk(page);
    await model.answer(DECLINE_ANSWER);
    const sent = await captureAction(page, () => ask(p, "What is the weather?"));
    await expect(p.message).toHaveText(DECLINE);
    await model.reset();
    expect(await requestCount()).toBe(0);

    const lines = (count: number) => "a\r\n".repeat(count);
    // Blank: only white space, line breaks included.
    expect(await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { question: " \r\n \r\n" })).toContain(
      QUESTION_BLANK,
    );
    // 251 pairs count 502 characters, though 3 per line.
    expect(await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { question: lines(251) })).toContain(
      QUESTION_TOO_LONG,
    );
    expect(await requestCount()).toBe(0);

    // 250 pairs count exactly 500 characters, and reach the model as 500.
    await model.answer(DECLINE_ANSWER);
    const text = await replayWith(playwright, baseURL, sent, OPERATOR_STATE, { question: lines(250) });
    expect(text).toContain(DECLINE);
    const requests = await model.requests();
    expect(requests).toHaveLength(1);
    const message = JSON.stringify(requests[0]!.body.messages);
    expect(message).toContain("a\\n".repeat(250));
    expect(message).not.toContain("\\r");
  });

  test("AC-0018: a question of exactly 500 characters typed in the browser reaches the model", async ({ page }) => {
    const p = await openAsk(page);
    const question = "How much RAW-TOM do I have? ".padEnd(500, "x");
    expect(Array.from(question)).toHaveLength(500);
    await model.answer(DECLINE_ANSWER);
    await ask(p, question);
    await expect(p.message).toHaveText(DECLINE);
    const requests = await model.requests();
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(requests[0]!.body.messages)).toContain(question);
    await expect(p.field).toHaveValue(question);
  });

  test("AC-0012, AC-0017: while an ask press is in flight the status text shows and Ask and every product button are disabled", async ({
    page,
  }) => {
    const p = await openAsk(page);
    await model.answer(CHOOSE_ANSWER, { hold: true, then: DECLINE_ANSWER });
    await ask(p, "How much turkey do I have?");
    await expect(p.choices).toHaveCount(2);
    await expect(p.status).toHaveText("");

    await ask(p, "What is the weather?");
    await model.waitForRequests(2);
    await expect(p.status).toHaveText(IN_FLIGHT);
    await expect(p.status).toHaveAttribute("role", "status");
    await expect(p.ask).toHaveAttribute("aria-disabled", "true");
    for (const button of await p.choices.all()) await expect(button).toHaveAttribute("aria-disabled", "true");

    // A press on a disabled control sends nothing.
    const sent = sendsActionRequest(page);
    // Playwright waits on an aria-disabled control unless forced; the page's guard is what is under test.
    await choice(p, RAW_TKB_LABEL).click({ force: true });
    await p.ask.click({ force: true });
    expect(await sent).toBe(false);
    expect(await requestCount()).toBe(2);

    // The page in flight.
    expect(await checkPageState(page)).toEqual(askControls(`button ${RAW_TOM_LABEL}`, `button ${RAW_TKB_LABEL}`));

    await model.release();
    await expect(p.message).toHaveText(DECLINE);
    await expect(p.status).toHaveText("");
    await expect(p.ask).not.toHaveAttribute("aria-disabled", "true");
  });

  test("AC-0012, AC-0017: while an ask press is in flight Look it up again is disabled too", async ({ page }) => {
    const p = await openAsk(page);
    await withSaleSummaryRefused(async () => {
      // The first press finds the sale read refused; the held answer is for the second.
      await model.answer(modelAnswer({ query: "sale_lots", number: "S-5000" }));
      await ask(p, "Which lots went into sale S-5000?");
      await expect(p.message).toHaveText(LOOKUP_TRY_AGAIN);
      await expect(p.lookAgain).toBeVisible();
      await expect(p.status).toHaveText("");

      await model.answer({ hold: true, then: DECLINE_ANSWER });
      await ask(p, "What is the weather?");
      await model.waitForRequests(2);
      await expect(p.status).toHaveText(IN_FLIGHT);
      await expect(p.ask).toHaveAttribute("aria-disabled", "true");
      await expect(p.lookAgain).toHaveAttribute("aria-disabled", "true");

      const sent = sendsActionRequest(page);
      await p.lookAgain.click({ force: true });
      expect(await sent).toBe(false);

      // Look it up again on the page, in flight.
      expect(await checkPageState(page)).toEqual(askControls("button Look it up again"));

      await model.release();
      await expect(p.message).toHaveText(DECLINE);
      await expect(p.lookAgain).toHaveCount(0);
    });
  });
});

test.describe("the question field and the page after an answer", () => {
  test("AC-0013: the field keeps its value after an ask, a product button, and Look it up again", async ({ page }) => {
    const p = await openAsk(page);
    const question = "How much turkey do I have?";
    await model.answer(CHOOSE_ANSWER);
    await ask(p, question);
    await expect(p.choices).toHaveCount(2);
    await expect(p.field).toHaveValue(question);

    await choice(p, RAW_TKB_LABEL).click();
    await expect(p.answer).toBeVisible();
    await expect(p.field).toHaveValue(question);

    await model.answer(DECLINE_ANSWER);
    await ask(p, question);
    await expect(p.message).toHaveText(DECLINE);
    await expect(p.field).toHaveValue(question);

    const saleQuestion = "Which lots went into sale S-5000?";
    await withSaleSummaryRefused(async () => {
      await model.answer(modelAnswer({ query: "sale_lots", number: "S-5000" }));
      await ask(p, saleQuestion);
      await expect(p.message).toHaveText(LOOKUP_TRY_AGAIN);
      await expect(p.field).toHaveValue(saleQuestion);
      await expect(p.message).toBeFocused();

      // Still refused: the same message again, the question still there.
      await p.lookAgain.click();
      // Focus left the message with the click and returns when the outcome lands.
      await expect(p.message).toBeFocused();
      await expect(p.message).toHaveText(LOOKUP_TRY_AGAIN);
      await expect(p.field).toHaveValue(saleQuestion);

      await query("grant select on public.v_sale_summary to authenticated");
      await p.lookAgain.click();
      await expect(p.answer).toBeVisible();
      await expect(p.field).toHaveValue(saleQuestion);
    });
    expect(await requestCount()).toBe(3);
  });

  test("AC-0014: reloading after an answer shows no answer and sends no request", async ({ page }) => {
    const p = await openAsk(page);
    await model.answer(modelAnswer({ query: "sellable_now" }));
    await ask(p, "What can I sell right now?");
    await expect(p.answer).toBeVisible();
    expect(await requestCount()).toBe(1);

    await page.reload();
    await expect(p.ask).toBeVisible();
    await expect(p.answer).toHaveCount(0);
    await expect(p.field).toHaveValue("");
    expect(await requestCount()).toBe(1);
  });
});

// Each catalog query over its fixture: what the page shows after one Ask press.
interface Expected {
  question: string;
  answer: ReturnType<typeof modelAnswer>;
  lookedUp: string;
  lead: string;
  items?: string[];
  tail?: string | null;
  link: { name: string; href: string };
}

const QUERY_CASES: Array<{ id: string; setup: () => Promise<SaleFixture>; expected: (f: SaleFixture) => Expected }> = [
  {
    id: "raw_stock",
    setup: async () => {
      await resetTestData();
      await twoReceipts();
      return {} as SaleFixture;
    },
    expected: () => ({
      question: "How much RAW-TOM do I have?",
      answer: modelAnswer({ query: "raw_stock", product_code: "RAW-TOM" }),
      lookedUp: `stock on hand for ${RAW_TOM_LABEL}`,
      lead: `You have 8,000 lbs of ${RAW_TOM_LABEL} on hand. Its average cost is $1.7250/lb.`,
      link: { name: "See it on Receiving", href: "/receiving?product=RAW-TOM" },
    }),
  },
  {
    id: "finished_stock",
    setup: async () => {
      await resetTestData();
      return saleFixture();
    },
    expected: () => ({
      question: "How much 502 is ready to sell?",
      answer: modelAnswer({ query: "finished_stock", product_code: "502" }),
      lookedUp: "finished stock for 502 Smoked Turkey Drums Tom",
      lead: "You have 5,390 lbs of 502 Smoked Turkey Drums Tom ready to sell.",
      link: { name: "See it on the Menu", href: "/menu" },
    }),
  },
  {
    id: "product_margin",
    setup: async () => {
      await resetTestData();
      await marginCase();
      return {} as SaleFixture;
    },
    expected: () => ({
      question: "What is my margin on 502?",
      answer: modelAnswer({ query: "product_margin", product_code: "502" }),
      lookedUp: "cost and margin for 502 Smoked Turkey Drums Tom",
      lead: "Cost is $2.6318/lb. $3.29/lb holds your 20% target margin. At your list price of $2.68/lb, the margin is 1.8%. That is below your target.",
      link: { name: "See it on Pricing", href: "/pricing?product=502" },
    }),
  },
  {
    id: "pricing_attention",
    setup: async () => {
      await resetTestData();
      await marginCase();
      return {} as SaleFixture;
    },
    expected: () => ({
      question: "Which products need a new price?",
      answer: modelAnswer({ query: "pricing_attention" }),
      lookedUp: "products that need a new price",
      lead: "1 product needs a new price:",
      items: ["502 Smoked Turkey Drums Tom: Raise list price to $3.29/lb, below your target"],
      link: { name: "See it on Pricing", href: "/pricing" },
    }),
  },
  {
    id: "sellable_now",
    setup: async () => {
      await resetTestData();
      return saleFixture();
    },
    expected: () => ({
      question: "What can I sell right now?",
      answer: modelAnswer({ query: "sellable_now" }),
      lookedUp: "products you can sell now",
      lead: "You can sell 1 product now:",
      items: ["502 Smoked Turkey Drums Tom: 5,390 lbs ready, 1,000 lbs of raw on hand"],
      link: { name: "See it on the Menu", href: "/menu" },
    }),
  },
  {
    id: "recent_receipts",
    setup: async () => {
      await resetTestData();
      return saleFixture();
    },
    expected: (f) => ({
      question: "What did I pay for RAW-TOM lately?",
      answer: modelAnswer({ query: "recent_receipts", product_code: "RAW-TOM" }),
      lookedUp: `recent receipts of ${RAW_TOM_LABEL}`,
      lead: `Recent receipts of ${RAW_TOM_LABEL}, most recent first:`,
      items: [
        `Oct 5, 2026, Valley Poultry: 3,000 lbs at $1.8000/lb, lot ${f.lotBNumber}`,
        `Oct 1, 2026, Reyes Meats: 5,000 lbs at $1.6800/lb, lot ${f.lotANumber}`,
      ],
      link: { name: "See it on Receiving", href: "/receiving?product=RAW-TOM" },
    }),
  },
  {
    id: "sale_lots",
    setup: async () => {
      await resetTestData();
      return saleFixture({ listPrice: true, sale: true });
    },
    expected: (f) => ({
      question: "Which lots went into sale S-5000?",
      answer: modelAnswer({ query: "sale_lots", number: "S-5000" }),
      lookedUp: "the lots behind sale S-5000",
      lead: "Sale S-5000 on Oct 8, 2026 (Fulton Market Deli): 5,000 lbs of 502 Smoked Turkey Drums Tom at $3.29/lb. It came from these raw lots:",
      items: [
        `Lot ${f.lotANumber}: ${RAW_TOM_LABEL} from Reyes Meats, received Oct 1, 2026, at $1.6800/lb`,
        `Lot ${f.lotBNumber}: ${RAW_TOM_LABEL} from Valley Poultry, received Oct 5, 2026, at $1.8000/lb`,
      ],
      link: { name: "See the full trace", href: "/trace?sale=S-5000" },
    }),
  },
  {
    id: "lot_sales",
    setup: async () => {
      await resetTestData();
      return saleFixture({ listPrice: true, sale: true });
    },
    expected: (f) => ({
      question: `Who bought from lot ${f.lotBNumber}?`,
      answer: modelAnswer({ query: "lot_sales", number: f.lotBNumber }),
      lookedUp: `the sales from lot ${f.lotBNumber}`,
      lead: `Lot ${f.lotBNumber}: 3,000 lbs of ${RAW_TOM_LABEL} from Valley Poultry, received Oct 5, 2026, at $1.8000/lb. It reached these sales:`,
      items: ["S-5000 on Oct 8, 2026 (Fulton Market Deli)"],
      link: { name: "See the full trace", href: `/trace?lot=${encodeURIComponent(f.lotBNumber)}` },
    }),
  },
];

test.describe("answers on screen", () => {
  for (const { id, setup, expected } of QUERY_CASES) {
    test(`AC-0042, AC-0043, AC-0044, AC-0104: ${id} shows what was looked up, the answer, its link, and the note`, async ({
      page,
    }) => {
      const want = expected(await setup());
      const p = await openAsk(page);
      await model.answer(want.answer);
      await ask(p, want.question);
      await expect(p.answer).toBeVisible();
      await expect(p.heading).toBeFocused();
      expect(await shownAnswer(p)).toEqual({
        lookedUp: `Looked up: ${want.lookedUp}`,
        lead: want.lead,
        tail: want.tail ?? null,
        note: NOTE,
        items: want.items ?? [],
        linkName: want.link.name,
        href: want.link.href,
      });
      expect(await requestCount()).toBe(1);
      await expect(p.field).toHaveValue(want.question);
    });
  }

  test("AC-0100, AC-0101, AC-0102: the page meets the page-state checks after an answer with a list and one without", async ({
    page,
  }) => {
    const p = await openAsk(page);
    await model.answer(modelAnswer({ query: "sale_lots", number: "S-5000" }), modelAnswer({ query: "finished_stock", product_code: "502" }));
    await ask(p, "Which lots went into sale S-5000?");
    await expect(p.items).toHaveCount(2);
    expect(await checkPageState(page)).toEqual(askControls("a See the full trace"));
    await ask(p, "How much 502 is ready to sell?");
    await expect(p.items).toHaveCount(0);
    await expect(p.link).toHaveText("See it on the Menu");
    expect(await checkPageState(page)).toEqual(askControls("a See it on the Menu"));
  });

  test("AC-0103: Ask, an answer's link, and a product button can be used with the keyboard alone", async ({ page }) => {
    const p = await openAsk(page);
    await model.answer(CHOOSE_ANSWER);
    await p.field.focus();
    await page.keyboard.type("How much turkey do I have?");
    await page.keyboard.press("Enter");
    await expect(p.choices).toHaveCount(2);
    await expect(p.message).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(choice(p, RAW_TOM_LABEL)).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(p.answer).toBeVisible();
    await expect(p.heading).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(p.link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/receiving\?product=RAW-TKB$/);
  });

  test("AC-0045: the figures are the database's at the press", async ({ page }) => {
    await resetTestData();
    await twoReceipts();
    const p = await openAsk(page);
    const same = modelAnswer({ query: "raw_stock", product_code: "RAW-TOM" });
    await model.answer(same, same);
    await ask(p, "How much RAW-TOM do I have?");
    await expect(p.answer.getByText(/^You have 8,000 lbs/)).toBeVisible();

    await run(receiveCall(RAW_TOM_ID, VENDOR_ID, 1000, 1.9, "2026-10-06"));
    await p.ask.click();
    await expect(p.answer.getByText(/^You have 9,000 lbs/)).toBeVisible();
    await expect(p.answer.getByText(/^You have 8,000 lbs/)).toHaveCount(0);
    expect(await requestCount()).toBe(2);
  });

  test("AC-0046: text from the database and a model's number show as literal characters and add no element", async ({
    page,
  }) => {
    await resetTestData();
    const f = await saleFixture({ listPrice: true, sale: true });
    await query("update products set description = $1 where id = $2", ["<b>Turkey</b> Drums (raw)", RAW_TOM_ID]);
    await query("update vendors set name = $1 where id = $2", ["<b>Reyes</b> Meats", VENDOR_ID]);
    await query("update customers set name = $1 where id = $2", ["<b>Fulton</b> Deli", CUSTOMER_ID]);
    const p = await openAsk(page);
    const bold = page.locator("b");
    const before = await bold.count();

    const step = async (question: string, answer: ReturnType<typeof modelAnswer>, shown: string) => {
      await model.answer(answer);
      await ask(p, question);
      await expect(p.answer).toBeVisible();
      await expect(p.answer).toContainText(shown);
      expect(await p.answer.innerHTML(), shown).not.toContain("<b>");
      expect(await bold.count(), shown).toBe(before);
    };

    await step(
      "How much RAW-TOM do I have?",
      modelAnswer({ query: "raw_stock", product_code: "RAW-TOM" }),
      "RAW-TOM <b>Turkey</b> Drums (raw) on hand.",
    );
    await step(
      "What did I pay for RAW-TOM lately?",
      modelAnswer({ query: "recent_receipts", product_code: "RAW-TOM" }),
      "<b>Reyes</b> Meats: 5,000 lbs",
    );
    await step(
      "Which lots went into sale S-5000?",
      modelAnswer({ query: "sale_lots", number: "S-5000" }),
      "(<b>Fulton</b> Deli)",
    );
    await run(voidSaleCall(f.saleId!, "<b>wrong</b> customer"));
    await step(
      "Which lots went into sale S-5000?",
      modelAnswer({ query: "sale_lots", number: "S-5000" }),
      "Sale S-5000 was voided: <b>wrong</b> customer.",
    );
    await step(
      "Which lots went into sale <b>9</b>?",
      modelAnswer({ query: "sale_lots", number: "<b>9</b>" }),
      "No sale has number <b>9</b>.",
    );
    await expect(p.answer).toContainText("Looked up: the lots behind sale <b>9</b>");
  });
});

test.describe("choosing what to look up", () => {
  test("AC-0050, AC-0106: the spec's example shows exactly two product buttons after Which product do you mean", async ({
    page,
  }) => {
    const p = await openAsk(page);
    await model.answer(CHOOSE_ANSWER);
    await ask(p, "How much turkey do I have?");
    await expect(p.message).toHaveText(WHICH_PRODUCT);
    await expect(p.message).toBeFocused();
    expect((await p.choices.allTextContents()).map((text) => text.trim())).toEqual([RAW_TOM_LABEL, RAW_TKB_LABEL]);
    await expect(p.answer).toHaveCount(0);
    expect(await checkPageState(page)).toEqual(askControls(`button ${RAW_TOM_LABEL}`, `button ${RAW_TKB_LABEL}`));
  });

  test("AC-0052, AC-0069: pressing a product button shows that product's raw_stock answer and sends no request", async ({
    page,
  }) => {
    const p = await openAsk(page);
    await model.answer(CHOOSE_ANSWER);
    await ask(p, "How much turkey do I have?");
    await choice(p, RAW_TKB_LABEL).click();
    await expect(p.answer).toBeVisible();
    await expect(p.answer.getByText(`You have 0 lbs of ${RAW_TKB_LABEL} on hand, and no average cost yet.`)).toBeVisible();
    await expect(p.answer.getByText(`Looked up: stock on hand for ${RAW_TKB_LABEL}`)).toBeVisible();
    await expect(p.link).toHaveAttribute("href", "/receiving?product=RAW-TKB");
    expect(await requestCount()).toBe(1);

    await model.answer(CHOOSE_ANSWER);
    await ask(p, "How much turkey do I have?");
    await choice(p, RAW_TOM_LABEL).click();
    await expect(p.answer.getByText(/^You have 1,000 lbs of RAW-TOM Turkey Drums TOM \(raw\) on hand\. Its average cost is \$/)).toBeVisible();
    await expect(p.link).toHaveAttribute("href", "/receiving?product=RAW-TOM");
    expect(await requestCount()).toBe(2);
  });

  test("AC-0053, AC-0106: a product query with no usable product and no candidate says to name the product", async ({
    page,
  }) => {
    const p = await openAsk(page);
    for (const answer of [
      modelAnswer({ query: "raw_stock" }),
      modelAnswer({ query: "finished_stock", product_code: "RAW-TOM", candidates: ["RAW-TOM", "NOPE"] }),
      modelAnswer({ query: "raw_stock", candidates: ["RAW-OLD"] }),
    ]) {
      await model.answer(answer);
      await ask(p, "How much do I have?");
      await expect(p.message).toHaveText(NAME_THE_PRODUCT);
      await expect(p.message).toBeFocused();
      await expect(p.choices).toHaveCount(0);
    }
    expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
  });

  for (const [id, message] of [
    ["sale_lots", NEED_SALE_NUMBER],
    ["lot_sales", NEED_LOT_NUMBER],
  ] as const) {
    test(`AC-0054, AC-0106: a ${id} model answer with no usable number says ${message}`, async ({ page }) => {
      const p = await openAsk(page);
      await model.answer(modelAnswer({ query: id, number: null }));
      await ask(p, "Which lots went into that sale?");
      await expect(p.message).toHaveText(message);
      await expect(p.message).toBeFocused();
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
    });
  }

  test("AC-0057, AC-0106: a null query is declined and the example list is still on the page", async ({ page }) => {
    const p = await openAsk(page);
    await model.answer(DECLINE_ANSWER);
    await ask(p, "What were my sales last month?");
    await expect(p.message).toHaveText(DECLINE);
    await expect(p.message).toBeFocused();
    await expect(p.examples.getByRole("listitem")).toHaveCount(8);
    expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
  });

  test("AC-0059, AC-0106: a product made inactive before the read says to ask again", async ({ page }) => {
    // The test itself changes a product while the press is in flight.
    presses.ignore.add("products");
    const p = await openAsk(page);
    await model.answer({ hold: true, then: modelAnswer({ query: "raw_stock", product_code: "RAW-TOM" }) });
    await p.field.fill("How much RAW-TOM do I have?");
    await p.ask.click();
    await model.waitForRequests(1);
    try {
      await setActive(RAW_TOM_ID, false);
      await model.release();
      await expect(p.message).toHaveText(ASK_AGAIN);
      await expect(p.message).toBeFocused();
      await expect(p.answer).toHaveCount(0);
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
    } finally {
      await setActive(RAW_TOM_ID, true);
    }
  });
});

// ---- What the model receives ----

const HOW_MUCH = "How much RAW-TOM do I have?";
const RAW_TOM_ANSWER = modelAnswer({ query: "raw_stock", product_code: "RAW-TOM" });
const ACTIVE_CODES = ["502", "503", "RAW-CHK", "RAW-TKB", "RAW-TOM"];

// One Ask press with an answer from the model; returns the page parts and the one request.
async function askOnce(page: Page, question = HOW_MUCH) {
  const p = await openAsk(page);
  await model.answer(RAW_TOM_ANSWER);
  await ask(p, question);
  await expect(p.answer).toBeVisible();
  const requests = await model.requests();
  expect(requests).toHaveLength(1);
  return { p, request: requests[0]! };
}

test.describe("what the model receives", () => {
  test("AC-0060, AC-0065: the body and settings are fixed, and only the key authorizes the request", async ({ page }) => {
    const { request } = await askOnce(page);
    const { body, headers } = request;
    expect(Object.keys(body).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.max_tokens).toBe(16000);
    expect(Object.keys(body.output_config).sort()).toEqual(["effort", "format"]);
    expect(body.output_config.effort).toBe("low");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(headers["anthropic-beta"]).toBeUndefined();
    expect(headers["x-api-key"]).toBe(ANTHROPIC_TEST_KEY);
    // The suite's app has ANTHROPIC_AUTH_TOKEN set; the request must not carry it.
    expect(headers.authorization).toBeUndefined();
    expect(JSON.stringify({ headers, body })).not.toContain(ANTHROPIC_TEST_AUTH_TOKEN);
  });

  test("AC-0061: the schema allows exactly the active codes for product_code and for each candidate", async ({ page }) => {
    const { request } = await askOnce(page);
    const schema = request.body.output_config.format.schema as {
      properties: {
        product_code: { anyOf: Array<{ enum?: string[]; type?: string }> };
        candidates: { items: { enum: string[] } };
      };
    };
    const allowed = schema.properties.product_code.anyOf;
    expect(allowed.flatMap((option) => option.enum ?? []).sort()).toEqual(ACTIVE_CODES);
    expect(allowed.filter((option) => option.type === "null")).toHaveLength(1);
    expect(allowed).toHaveLength(2);
    expect([...schema.properties.candidates.items.enum].sort()).toEqual(ACTIVE_CODES);
  });

  test("AC-0062: one user message holds the question and every active product, and nothing inactive", async ({ page }) => {
    const question = "How much turkey do I have in the cooler?";
    const { request } = await askOnce(page, question);
    expect(request.body.messages).toHaveLength(1);
    expect(request.body.messages[0]?.role).toBe("user");
    const content = request.body.messages[0]?.content ?? [];
    expect(content).toHaveLength(1);
    const text = String(content[0]?.text);
    expect(text).toContain(question);
    const products = await query<{ code: string; description: string }>(
      "select code, description from products where active order by code",
    );
    expect(products.map((product) => product.code)).toEqual(ACTIVE_CODES);
    for (const { code, description } of products) {
      expect(text, code).toContain(`"code":${JSON.stringify(code)},"description":${JSON.stringify(description)}`);
    }
    const sent = JSON.stringify(request.body);
    for (const unwanted of ["RAW-OLD", "Old Turkey (raw)"]) expect(sent, unwanted).not.toContain(unwanted);
  });

  test("AC-0063: the request holds none of the other data in the database, the session, or the browser", async ({
    page,
    context,
  }) => {
    await query(
      "update vendors set contact_name = 'Sentinel Contact', phone = '555-0199', email = 'sentinel@example.test', notes = 'sentinel vendor note' where id = $1",
      [VENDOR_ID],
    );
    await query("update products set brand = 'Sentinel Brand' where id = $1", [RAW_TOM_ID]);
    await receiveLot(await signInOperator(), {
      productId: RAW_TOM_ID,
      vendorId: VENDOR_ID,
      weightLbs: 100,
      unitCost: 9.8765,
      received: "2026-10-01",
      lotNumber: "L-SENTINEL",
      notes: "sentinel lot note",
    });
    const [batch] = await query<{ batch_number: string }>("select batch_number from production_batches where id = $1", [
      fixture.batch1Id,
    ]);
    const p = await openAsk(page);
    const cookies = (await context.cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
    expect(cookies.length).toBeGreaterThan(0);
    const session = readSession(cookies);
    const sentinels = [
      "Sentinel Contact",
      "555-0199",
      "sentinel@example.test",
      "sentinel vendor note",
      "Sentinel Brand",
      "L-SENTINEL",
      "9.8765",
      "sentinel lot note",
      "Reyes Meats",
      "Valley Poultry",
      "Belmont Poultry",
      "Fulton Market Deli",
      fixture.lotANumber,
      fixture.lotBNumber,
      batch!.batch_number,
      "S-5000",
      OPERATOR_EMAIL,
      resolveStackEnv().anonKey,
      session.access_token,
      session.refresh_token,
      ...cookies.map((cookie) => cookie.value),
    ];
    await model.answer(RAW_TOM_ANSWER);
    await ask(p, HOW_MUCH);
    await expect(p.answer).toBeVisible();
    const [request] = await model.requests();
    const sent = JSON.stringify({ headers: request!.headers, body: request!.body });
    for (const sentinel of sentinels) expect(sent, sentinel.slice(0, 24)).not.toContain(sentinel);
  });

  test("AC-0066: no header value holds this machine's host name, operating system, architecture, or Node version", async ({
    page,
  }) => {
    const { request } = await askOnce(page);
    const squash = (text: string) => text.toLowerCase().replaceAll(/\s+/g, "");
    const machine = [
      os.hostname(),
      os.type(),
      os.platform(),
      `Other:${os.platform()}`,
      "macOS",
      "Windows",
      "Linux",
      os.arch(),
      process.version,
      process.version.replace(/^v/, ""),
      "MacOS",
      "FreeBSD",
      "OpenBSD",
      "iOS",
      "Android",
      "Unknown",
    ];
    for (const [name, value] of Object.entries(request.headers)) {
      for (const word of machine) expect(squash(value), `${name} holds ${word}`).not.toContain(squash(word));
    }
    expect(Object.keys(request.headers).filter((name) => name.startsWith("x-stainless"))).toEqual([]);
    expect(request.headers["user-agent"]).not.toMatch(/Anthropic/i);
  });

  test("AC-0067: no response in the page states reached carries the key, and no static file does", async ({ page }) => {
    const bodies: Array<Promise<string>> = [];
    page.on("response", (response) => {
      bodies.push(response.body().then((buffer) => buffer.toString("latin1")).catch(() => ""));
    });
    // The first load, a failure message, the choose state, and an answer.
    const p = await openAsk(page);
    await model.answer({ status: 401 }, CHOOSE_ANSWER);
    await ask(p, "How much turkey do I have?");
    await expect(p.message).toHaveText(KEY_REFUSED);
    await ask(p, "How much turkey do I have?");
    await expect(p.choices).toHaveCount(2);
    await choice(p, RAW_TKB_LABEL).click();
    await expect(p.answer).toBeVisible();
    await page.goto("/ask");
    await expect(p.ask).toBeVisible();
    const seen = await Promise.all(bodies);
    expect(seen.length).toBeGreaterThan(3);
    for (const body of seen) {
      expect(body).not.toContain(ANTHROPIC_TEST_KEY);
      expect(body).not.toContain(ANTHROPIC_TEST_AUTH_TOKEN);
    }

    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
      );
    const files = walk(join(process.cwd(), ".next", "static"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file);
      expect(content.includes(ANTHROPIC_TEST_KEY), file).toBe(false);
      expect(content.includes(ANTHROPIC_TEST_AUTH_TOKEN), file).toBe(false);
    }
  });

  test("AC-0068: one Ask press sends exactly one request, also for 429, 500, 529, and a dropped connection", async ({
    page,
  }) => {
    const answers: ReadonlyArray<[string, FakeAnswer]> = [
      ["429", { status: 429 }],
      ["500", { status: 500 }],
      ["529", { status: 529 }],
      ["a drop", { drop: true }],
    ];
    for (const [name, answer] of answers) {
      await model.reset();
      await model.answer(answer, RAW_TOM_ANSWER);
      const p = await openAsk(page);
      await ask(p, HOW_MUCH);
      await expect(p.message, name).toHaveText(TRY_AGAIN_ASK);
      await page.waitForTimeout(500);
      expect(await model.requests(), name).toHaveLength(1);
    }
  });
});

// ---- Lookups send no request ----

test.describe("lookups", () => {
  test("AC-0069, AC-0082: replayed lookups send no request, and unusable ones say to ask again", async ({
    page,
    playwright,
    baseURL,
  }) => {
    const p = await openAsk(page);
    await model.answer(CHOOSE_ANSWER);
    await ask(p, "How much turkey do I have?");
    const sent = await captureAction(page, () => choice(p, RAW_TKB_LABEL).click());
    await expect(p.answer).toBeVisible();
    const before = await requestCount();
    expect(before).toBe(1);
    const rows = await allFingerprints();

    const replay = (change: { query: string; param: string }) =>
      replayWith(playwright, baseURL, sent, OPERATOR_STATE, change);
    for (const [query_, param] of [
      ["raw_stock", "RAW-OLD"],
      ["raw_stock", "502"],
      ["raw_stock", ""],
      ["sale_lots", "a".repeat(65)],
      ["stock_value", "RAW-TOM"],
    ] as const) {
      const text = await replay({ query: query_, param });
      expect(text, `${query_} ${param.slice(0, 10)}`).toContain(ASK_AGAIN);
      expect(text, `${query_} ${param.slice(0, 10)}`).not.toContain("Looked up: ");
    }
    // A usable lookup answers, and still sends no request.
    expect(await replay({ query: "raw_stock", param: "RAW-TOM" })).toContain("on hand");
    expect(await requestCount()).toBe(before);
    expect(await allFingerprints()).toEqual(rows);
  });

  test("AC-0082, AC-0106: a product button pressed after its product became inactive says to ask again", async ({
    page,
  }) => {
    const p = await openAsk(page);
    await model.answer(CHOOSE_ANSWER);
    await ask(p, "How much turkey do I have?");
    await expect(p.choices).toHaveCount(2);
    await setActive(RAW_TKB_ID, false);
    try {
      await choice(p, RAW_TKB_LABEL).click();
      await expect(p.message).toHaveText(ASK_AGAIN);
      await expect(p.message).toBeFocused();
      await expect(p.answer).toHaveCount(0);
      await expect(p.lookAgain).toHaveCount(0);
      expect(await requestCount()).toBe(1);
      // The on-page AC-0082 message.
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
    } finally {
      await setActive(RAW_TKB_ID, true);
    }
  });

  test("AC-0080, AC-0081, AC-0069, AC-0103, AC-0106: a refused read offers Look it up again, which shows the answer without the model", async ({
    page,
  }) => {
    const p = await openAsk(page);
    await withSaleSummaryRefused(async () => {
      await model.answer(modelAnswer({ query: "sale_lots", number: "S-5000" }));
      await ask(p, "Which lots went into sale S-5000?");
      await expect(p.message).toHaveText(LOOKUP_TRY_AGAIN);
      await expect(p.message).toBeFocused();
      await expect(p.lookAgain).toBeVisible();
      await expect(p.answer).toHaveCount(0);
      expect(await requestCount()).toBe(1);
      expect(await checkPageState(page)).toEqual(askControls("button Look it up again"));

      // Still refused: the same message again, and no request.
      await p.lookAgain.click();
      await expect(p.message).toBeFocused();
      await expect(p.message).toHaveText(LOOKUP_TRY_AGAIN);
      expect(await requestCount()).toBe(1);

      // The database answers again; the keyboard alone reaches the button and presses it.
      await query("grant select on public.v_sale_summary to authenticated");
      await expect(p.message).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(p.lookAgain).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(p.answer).toBeVisible();
      await expect(p.heading).toBeFocused();
      await expect(p.answer.getByText(/^Sale S-5000 on Oct 8, 2026/)).toBeVisible();
      await expect(p.lookAgain).toHaveCount(0);
      expect(await requestCount()).toBe(1);
    });
  });
});

// ---- Failures on the page ----

// The answer text of a null query, as the fake model sends it.
function nullQueryText(): string {
  return JSON.stringify({ query: null, product_code: null, candidates: [], number: null });
}

const ASK_FAILURES: Array<{ ids: string; name: string; answer: FakeAnswer; message: string; state: boolean }> = [
  { ids: "AC-0076", name: "status 401", answer: { status: 401 }, message: KEY_REFUSED, state: true },
  { ids: "AC-0076", name: "status 403", answer: { status: 403 }, message: KEY_REFUSED, state: false },
  {
    ids: "AC-0077",
    name: "stop reason refusal",
    answer: { text: nullQueryText(), stop_reason: "refusal" },
    message: DECLINED_BY_MODEL,
    state: true,
  },
  { ids: "AC-0078", name: "a dropped connection", answer: { drop: true }, message: TRY_AGAIN_ASK, state: true },
  { ids: "AC-0078", name: "status 400", answer: { status: 400 }, message: TRY_AGAIN_ASK, state: false },
  { ids: "AC-0078", name: "status 500", answer: { status: 500 }, message: TRY_AGAIN_ASK, state: false },
  { ids: "AC-0078", name: "status 529", answer: { status: 529 }, message: TRY_AGAIN_ASK, state: false },
  {
    ids: "AC-0078",
    name: "stop reason max_tokens",
    answer: { text: nullQueryText(), stop_reason: "max_tokens" },
    message: TRY_AGAIN_ASK,
    state: true,
  },
  {
    ids: "AC-0078",
    name: "a text that is not the answer schema",
    answer: { text: "this is not JSON" },
    message: TRY_AGAIN_ASK,
    state: true,
  },
  {
    ids: "AC-0078, AC-0079",
    name: "an answer with a property the schema does not name",
    answer: { text: JSON.stringify({ query: null, product_code: null, candidates: [], number: null, extra: 1 }) },
    message: TRY_AGAIN_ASK,
    state: false,
  },
];

test.describe("ask failures on the page", () => {
  for (const { ids, name, answer, message, state } of ASK_FAILURES) {
    test(`${ids}, AC-0106: ${name} says "${message.slice(0, 40)}...", sends one request, and takes focus`, async ({
      page,
    }) => {
      const p = await openAsk(page);
      await model.answer(answer);
      await ask(p, HOW_MUCH);
      await expect(p.message).toHaveText(message);
      await expect(p.message).toBeFocused();
      await expect(p.answer).toHaveCount(0);
      await expect(p.choices).toHaveCount(0);
      await expect(p.status).toHaveText("");
      await expect(p.field).toHaveValue(HOW_MUCH);
      expect(await requestCount()).toBe(1);
      if (state) expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
    });
  }

  test("AC-0075, AC-0106: a refused product list read says to try again and sends no request", async ({ page }) => {
    const p = await openAsk(page);
    await query("revoke select on public.products from authenticated");
    try {
      await ask(p, HOW_MUCH);
      await expect(p.message).toHaveText(TRY_AGAIN_ASK);
      await expect(p.message).toBeFocused();
      expect(await requestCount()).toBe(0);
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
    } finally {
      await query("grant select on public.products to authenticated");
    }
  });

  test("AC-0070, AC-0106: after the session ended, an Ask press and a product-button press say so and send no request", async ({
    browser,
    baseURL,
  }) => {
    // A session of its own, so the saved operator session that later tests reuse is untouched.
    const context = await browser.newContext({ baseURL });
    const watch = await watchPresses(context);
    try {
      const page = await context.newPage();
      await signInThroughForm(page, OPERATOR_EMAIL);
      const p = await openAsk(page);
      await model.answer(CHOOSE_ANSWER);
      await ask(p, "How much turkey do I have?");
      await expect(p.choices).toHaveCount(2);

      // End the session at the auth server, then age the access token so the
      // proxy has to refresh it, and the refresh is refused.
      const cookies = (await context.cookies()).filter(isAuthCookie);
      const stack = resolveStackEnv();
      const revoked = await fetch(`${stack.apiUrl}/auth/v1/logout?scope=local`, {
        method: "POST",
        headers: { apikey: stack.anonKey, authorization: `Bearer ${readSession(cookies).access_token}` },
      });
      expect(revoked.status).toBe(204);
      await context.addCookies(withExpiredAccessToken(cookies));

      await choice(p, RAW_TKB_LABEL).click();
      await expect(p.message).toHaveText(SIGNED_OUT_LOOKUP);
      await expect(p.message).toBeFocused();
      expect(await requestCount()).toBe(1);
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);

      await model.answer(CHOOSE_ANSWER);
      await ask(p, "How much turkey do I have?");
      await expect(p.message).toHaveText(SIGNED_OUT_ASK);
      await expect(p.message).toBeFocused();
      await expect(p.field).toHaveValue("How much turkey do I have?");
      expect(await requestCount()).toBe(1);
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
      expect(watch.changes).toEqual([]);
    } finally {
      await context.close();
    }
  });
});

// ---- Presses change no row ----

test.describe("presses change no row", () => {
  test("AC-0086: with 502's list price changed after /ask loaded, an Ask press and a lookup press change no row", async ({
    page,
  }) => {
    await resetTestData();
    await marginCase();
    const p = await openAsk(page);
    await expect(banner(page).getByText("1 urgent alert needs you.", { exact: true })).toBeVisible();
    expect((await alertStates()).filter((alert) => alert.status === "open")).toHaveLength(1);
    // A watch run by a press would see the margin held and end the open alert.
    await query("update products set list_price_per_lb = 3.29 where id = $1", [PROD_502_ID]);
    const before = await allFingerprints();
    expect(Object.keys(before).some((name) => name.startsWith("private."))).toBe(true);

    await model.answer(CHOOSE_ANSWER, DECLINE_ANSWER);
    await ask(p, "How much turkey do I have?");
    // Only RAW-TOM exists in the margin case.
    await expect(p.choices).toHaveCount(1);
    expect(await allFingerprints()).toEqual(before);
    await choice(p, RAW_TOM_LABEL).click();
    await expect(p.answer).toBeVisible();
    expect(await allFingerprints()).toEqual(before);
    await ask(p, "What were my sales last month?");
    await expect(p.message).toHaveText(DECLINE);
    expect(await allFingerprints()).toEqual(before);
    expect((await alertStates()).filter((alert) => alert.status === "open")).toHaveLength(1);
    // The watch saw all three presses.
    expect(presses.presses).toBe(3);
  });
});

// ---- An app started with another key or address ----

async function withSpare(
  browser: Browser,
  baseURL: string | undefined,
  env: Record<string, string>,
  during: (page: Page, spare: Awaited<ReturnType<typeof startSpare>>) => Promise<void>,
): Promise<void> {
  const spare = await startSpare(ports(baseURL).spare, env);
  const context = await browser.newContext({ baseURL: spare.url, storageState: OPERATOR_STATE });
  try {
    const watch = await watchPresses(context);
    await during(await context.newPage(), spare);
    expect(watch.changes, "rows changed by a press").toEqual([]);
  } finally {
    await context.close();
    await spare.stop();
  }
}

const failedLines = (output: string) => output.split("\n").filter((line) => line.startsWith("askQuestion failed"));

test.describe("an app started without a usable key or address", () => {
  test("AC-0072, AC-0106: an empty key says Ask isn't set up, sends nothing, and logs one line", async ({
    browser,
    baseURL,
  }) => {
    await withSpare(browser, baseURL, { ANTHROPIC_API_KEY: "", ANTHROPIC_BASE_URL: model.base }, async (page, spare) => {
      const p = await openAsk(page);
      await ask(p, HOW_MUCH);
      await expect(p.message).toHaveText(NOT_SET_UP);
      await expect(p.message).toBeFocused();
      expect(await requestCount()).toBe(0);
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
      await expect.poll(() => failedLines(spare.output()).length).toBe(1);
      expect(failedLines(spare.output())).toEqual(["askQuestion failed: kind=not-set-up"]);
      expect(spare.output()).not.toContain(HOW_MUCH);
    });
  });

  test("AC-0074, AC-0106: a key and an address that is not loopback says Ask isn't set up, sends nothing, and logs one line", async ({
    browser,
    baseURL,
  }) => {
    const key = "sk-ant-ask-address-sentinel";
    await withSpare(browser, baseURL, { ANTHROPIC_API_KEY: key, ANTHROPIC_BASE_URL: "https://example.com" }, async (page, spare) => {
      const p = await openAsk(page);
      await ask(p, HOW_MUCH);
      await expect(p.message).toHaveText(ADDRESS_REFUSED);
      await expect(p.message).toBeFocused();
      expect(await requestCount()).toBe(0);
      expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
      await expect.poll(() => failedLines(spare.output()).length).toBe(1);
      expect(failedLines(spare.output())).toEqual(["askQuestion failed: kind=address-refused"]);
      expect(spare.output()).not.toContain(key);
    });
  });

  for (const [name, hold] of [
    ["an answer held past 60 seconds", { hold: true, then: RAW_TOM_ANSWER }],
    ["an answer whose headers arrive and whose body stalls", { stallAfterHeaders: true }],
  ] as const satisfies ReadonlyArray<readonly [string, FakeAnswer]>) {
    test(`AC-0078, AC-0083, AC-0106: ${name} ends at 60 seconds with one request and one no-answer log line`, async ({
      browser,
      baseURL,
    }) => {
      test.setTimeout(150_000);
      await withSpare(
        browser,
        baseURL,
        { ANTHROPIC_API_KEY: ANTHROPIC_TEST_KEY, ANTHROPIC_BASE_URL: `http://127.0.0.1:${ports(baseURL).model}` },
        async (page, spare) => {
          const p = await openAsk(page);
          await model.answer(hold);
          await ask(p, HOW_MUCH);
          await model.waitForRequests(1);
          await expect(p.status).toHaveText(IN_FLIGHT);
          await expect(p.message).toHaveText(TRY_AGAIN_ASK, { timeout: 90_000 });
          await expect(p.message).toBeFocused();
          await expect(p.status).toHaveText("");
          expect(await requestCount()).toBe(1);
          expect(failedLines(spare.output())).toEqual(["askQuestion failed: kind=no-answer"]);
          expect(await checkPageState(page)).toEqual(ASK_CONTROLS);
        },
      );
    });
  }
});
