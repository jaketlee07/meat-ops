import type { SaleSummary } from "../../lib/sales";

// Recent sales lists the 10 last-entered sales (the query's choice) by sale date, newest first, and by entry
// time, newest first, within one sale date. Both are ISO strings, so a string compare orders them; the sort
// is stable, so two sales with the same date and entry time keep the order the query gave them.
export function orderRecentSales(sales: readonly SaleSummary[]): SaleSummary[] {
  return [...sales].sort((a, b) => {
    if (a.saleDate !== b.saleDate) return a.saleDate < b.saleDate ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return 0;
  });
}
