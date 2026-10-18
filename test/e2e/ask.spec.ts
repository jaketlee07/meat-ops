import { expect, test } from "@playwright/test";
import { CATALOG, QUERY_IDS } from "../../src/lib/ask";
import {
  callAsOperator,
  CUSTOMER_ID,
  idOf,
  type OpCall,
  query,
  RAW_TOM_ID,
  receiveCall,
  resetTestData,
  saleFixture,
  type SaleFixture,
  VENDOR_ID,
  voidSaleCall,
} from "../db";
import { checkPageState } from "./a11y";
import { banner, captureAction, HEADER_PAGES, marginCase, opens, setActive, WATCH_FAILED, withSeeAlerts, withWatchRefused } from "./alerts-page";
import {
  ask,
  ASK_AGAIN,
  ASK_CONTROLS,
  askCatalogFixture,
  askControls,
  CHOOSE_ANSWER,
  choice,
  DECLINE,
  DECLINE_ANSWER,
  IN_FLIGHT,
  LOOKUP_TRY_AGAIN,
  modelAnswer,
  NAME_THE_PRODUCT,
  NEED_LOT_NUMBER,
  NEED_SALE_NUMBER,
  NOT_ALLOWED_ASK,
  NOT_ALLOWED_LOOKUP,
  NOTE,
  openAsk,
  QUESTION_BLANK,
  QUESTION_TOO_LONG,
  RAW_TKB_LABEL,
  RAW_TOM_LABEL,
  shownAnswer,
  SIGNED_OUT_ASK,
  SIGNED_OUT_LOOKUP,
  WHICH_PRODUCT,
  withSaleSummaryRefused,
} from "./ask-page";
import { type FakeModel, fakeModel, FRAMING, replayWith } from "./invoices-page";
import { NOT_ALLOWED, sendsActionRequest } from "./receiving-page";
import { NON_OPERATOR_STATE, OPERATOR_STATE } from "./states";

// The ask page, end to end: a real browser over the production build, the local
// database, and the fake model service, which hands out the model's answers and
// records what each press sent. Fixtures go through the operations and pg.

test.use({ storageState: OPERATOR_STATE });

let model: FakeModel;

test.beforeEach(async ({ baseURL }) => {
  await askCatalogFixture();
  model = fakeModel(baseURL);
  await model.reset();
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
