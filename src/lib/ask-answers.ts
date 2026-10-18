// The answers to Ask's catalog queries (ask-your-data). Each choice calls one
// shared read and words the result; every figure is the database's, shown
// through format.ts. Nothing here computes a cost, price, weight, average,
// margin, or total. A read that fails throws, so the caller can say so.

import { CATALOG, type CatalogProduct, type Choice, type ProductLists } from "./ask";
import { formatCostPerLb, formatDate, formatPricePerLb, formatWeight } from "./format";
import { priceAdvice, priceButtonName, type PriceAction } from "./price-advice";
import { getPricingDetail, listPricing } from "./pricing";
import { listActiveFinishedProducts } from "./production";
import { getStock, listActiveRawProducts, listRecentReceipts } from "./receiving";
import { listSaleProducts } from "./sales";
import type { TypedClient } from "./supabase.js";
import { getLotTrace, getSaleTrace } from "./trace";
import { getMenu } from "./views";

export interface AnswerText {
  lead: string;
  items: string[];
  tail: string | null;
}

export interface Answer {
  // The catalog's looked-up line, without the page's "Looked up: " prefix.
  lookedUp: string;
  text: AnswerText;
  link: { name: string; href: string };
}

const NO_CUSTOMER = "No customer";

const sentence = (lead: string, items: string[] = [], tail: string | null = null): AnswerText => ({
  lead,
  items,
  tail,
});

const label = (product: CatalogProduct) => `${product.code} ${product.description}`;

export async function readProductLists(client: TypedClient): Promise<ProductLists> {
  const [raw, finished] = await Promise.all([listActiveRawProducts(client), listActiveFinishedProducts(client)]);
  const pick = ({ code, description }: CatalogProduct): CatalogProduct => ({ code, description });
  return { raw: raw.map(pick), finished: finished.map(pick) };
}

function present<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`${what} failed: the database sent a row without a required column`);
  return value;
}

function isPriceAction(value: string | null): value is PriceAction {
  return value === "set" || value === "raise" || value === "lower";
}

interface Found {
  subject: string;
  param: string;
  text: AnswerText;
}

// AC-0020, AC-0021: no non-void receipt means no average, whatever the balance row holds.
async function rawStock(client: TypedClient, code: string): Promise<Found | null> {
  const product = (await listActiveRawProducts(client)).find((p) => p.code === code);
  if (!product) return null;
  const { balance, nonVoidReceipts } = await getStock(client, product.id);
  const onHand = formatWeight(balance?.qtyOnHand ?? 0);
  const lead =
    balance && nonVoidReceipts > 0
      ? `You have ${onHand} of ${label(product)} on hand. Its average cost is ${formatCostPerLb(balance.movingAvgCost)}.`
      : `You have ${onHand} of ${label(product)} on hand, and no average cost yet.`;
  return { subject: label(product), param: product.code, text: sentence(lead) };
}

// AC-0022
async function finishedStock(client: TypedClient, code: string): Promise<Found | null> {
  const product = (await listSaleProducts(client)).find((p) => p.code === code);
  if (!product) return null;
  const lead = `You have ${formatWeight(product.finishedLbsAvailable)} of ${label(product)} ready to sell.`;
  return { subject: label(product), param: product.code, text: sentence(lead) };
}

// AC-0023 to AC-0025
async function productMargin(client: TypedClient, code: string): Promise<Found | null> {
  const detail = await getPricingDetail(client, code);
  if (!detail) return null;
  const { costPerLb, suggestedListPrice } = detail;
  const lead =
    !detail.hasCost || costPerLb === null || suggestedListPrice === null
      ? `${label(detail)} has no cost yet.`
      : `${priceAdvice({
          costPerLb,
          suggestedListPrice,
          targetMarginPct: detail.targetMargin,
          listPricePerLb: detail.listPrice,
          marginAtListPct: detail.marginAtList,
          marginFeesPerLb: detail.marginFeesPerLb ?? 0,
        })}${detail.belowTarget ? " That is below your target." : ""}`;
  return { subject: label(detail), param: detail.code, text: sentence(lead) };
}

// AC-0026, AC-0027: the pricing list's own order.
async function pricingAttention(client: TypedClient): Promise<AnswerText> {
  const items: string[] = [];
  for (const row of await listPricing(client)) {
    if (!row.needsNewPrice || !isPriceAction(row.priceAction) || row.suggestedListPrice === null) continue;
    items.push(
      `${label(row)}: ${priceButtonName(row.priceAction, row.suggestedListPrice)}${row.belowTarget ? ", below your target" : ""}`,
    );
  }
  if (items.length === 0) return sentence("No product needs a new price right now.");
  return sentence(items.length === 1 ? "1 product needs a new price:" : `${items.length} products need a new price:`, items);
}

// AC-0028, AC-0029: the menu's code order.
async function sellableNow(client: TypedClient): Promise<AnswerText> {
  const items: string[] = [];
  for (const row of await getMenu(client)) {
    if (row.sellable !== true) continue;
    const code = present(row.code, "getMenu");
    const description = present(row.description, "getMenu");
    const finished = formatWeight(present(row.finished_lbs_available, "getMenu"));
    const raw = formatWeight(present(row.raw_lbs_available, "getMenu"));
    items.push(`${code} ${description}: ${finished} ready, ${raw} of raw on hand`);
  }
  if (items.length === 0) return sentence("No product can be sold right now.");
  return sentence(items.length === 1 ? "You can sell 1 product now:" : `You can sell ${items.length} products now:`, items);
}

// AC-0030 to AC-0033
async function recentReceipts(client: TypedClient, code: string): Promise<Found | null> {
  const product = (await listActiveRawProducts(client)).find((p) => p.code === code);
  if (!product) return null;
  const { receipts, total } = await listRecentReceipts(client, product.id);
  const found = { subject: label(product), param: product.code };
  if (total === 0) return { ...found, text: sentence(`${label(product)} has no receipts yet.`) };
  const items = receipts.map(
    (r) =>
      `${formatDate(r.receivedDate)}, ${r.vendorName}: ${formatWeight(r.weightLbs)} at ${formatCostPerLb(r.unitCost)}, lot ${r.lotNumber}${r.status === "void" ? " (void)" : ""}`,
  );
  const tail = total > receipts.length ? `Showing the ${receipts.length} most recent of ${total} receipts.` : null;
  return { ...found, text: sentence(`Recent receipts of ${label(product)}, most recent first:`, items, tail) };
}

// AC-0034 to AC-0037: each raw lot once, where it first appears in the trace.
async function saleLots(client: TypedClient, number: string): Promise<AnswerText> {
  const trace = await getSaleTrace(client, number);
  if (!trace) return sentence(`No sale has number ${number}.`);
  const { sale, lots } = trace;
  if (sale.voidedAt !== null) return sentence(`Sale ${sale.saleNumber} was voided: ${sale.voidReason ?? ""}.`);
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of lots.flatMap((lot) => lot.rawLots)) {
    if (seen.has(raw.lotNumber)) continue;
    seen.add(raw.lotNumber);
    items.push(
      `Lot ${raw.lotNumber}: ${raw.rawCode} ${raw.rawProduct} from ${raw.vendor}, received ${formatDate(raw.receivedDate)}, at ${formatCostPerLb(raw.costPerLb)}`,
    );
  }
  const lead =
    `Sale ${sale.saleNumber} on ${formatDate(sale.saleDate)} (${sale.customer ?? NO_CUSTOMER}): ` +
    `${formatWeight(sale.lbsSold)} of ${sale.productCode} ${sale.product} at ${formatPricePerLb(sale.pricePerLb)}. ` +
    "It came from these raw lots:";
  return sentence(lead, items);
}

// AC-0019, AC-0038 to AC-0041: each sale once, in the read's order.
async function lotSales(client: TypedClient, number: string): Promise<AnswerText> {
  const trace = await getLotTrace(client, number);
  if (!trace) return sentence(`No receipt has lot number ${number}.`);
  const { lot, sales } = trace;
  const first =
    `Lot ${lot.lotNumber}: ${formatWeight(lot.weightLbs)} of ${lot.rawCode} ${lot.rawProduct} ` +
    `from ${lot.vendor}, received ${formatDate(lot.receivedDate)}, at ${formatCostPerLb(lot.costPerLb)}.`;
  if (lot.voidedAt !== null) return sentence(`${first} This receipt was voided: ${lot.voidReason ?? ""}.`);
  if (sales.length === 0) return sentence(`${first} No sale was made from this lot.`);
  const seen = new Set<string>();
  const items: string[] = [];
  for (const sale of sales) {
    if (seen.has(sale.saleNumber)) continue;
    seen.add(sale.saleNumber);
    items.push(`${sale.saleNumber} on ${formatDate(sale.saleDate)} (${sale.customer ?? NO_CUSTOMER})`);
  }
  return sentence(`${first} It reached these sales:`, items);
}

// Null exactly when the choice's product is not an active product of its
// query's kind. A read failure throws.
export async function answerFor(client: TypedClient, choice: Choice): Promise<Answer | null> {
  const entry = CATALOG[choice.query];
  const product = (found: Found | null): Answer | null =>
    found && {
      lookedUp: entry.lookedUp(found.subject),
      text: found.text,
      link: entry.link(found.param),
    };
  switch (choice.query) {
    case "raw_stock":
      return product(await rawStock(client, choice.productCode));
    case "finished_stock":
      return product(await finishedStock(client, choice.productCode));
    case "product_margin":
      return product(await productMargin(client, choice.productCode));
    case "recent_receipts":
      return product(await recentReceipts(client, choice.productCode));
    case "pricing_attention":
      return { lookedUp: entry.lookedUp(""), text: await pricingAttention(client), link: entry.link("") };
    case "sellable_now":
      return { lookedUp: entry.lookedUp(""), text: await sellableNow(client), link: entry.link("") };
    case "sale_lots":
      return { lookedUp: entry.lookedUp(choice.number), text: await saleLots(client, choice.number), link: entry.link(choice.number) };
    case "lot_sales":
      return { lookedUp: entry.lookedUp(choice.number), text: await lotSales(client, choice.number), link: entry.link(choice.number) };
  }
}
