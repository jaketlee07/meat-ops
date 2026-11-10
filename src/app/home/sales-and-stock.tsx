import { formatMoney } from "../../lib/format";
import type { StockValue } from "../../lib/home";
import { Facts } from "../facts";

const HEADING_ID = "sales-stock-heading";

// The money figures first: today's sales and the stock at cost, as the database computed them. The
// four tiles wrap with no breakpoint, as the stock tiles on the floor forms do.
export function SalesAndStockValue({ sales, stock }: { sales: number; stock: StockValue }) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-card border border-card-border bg-surface p-3.5 desk:p-4"
    >
      <h2 id={HEADING_ID} className="mb-3 text-xl font-semibold">
        Sales and stock value
      </h2>
      <Facts
        look="tiles"
        rows={[
          ["Today's sales", formatMoney(sales)],
          ["Raw stock at cost", formatMoney(stock.raw)],
          ["Finished stock at cost", formatMoney(stock.finished)],
          ["All stock at cost", formatMoney(stock.total)],
        ]}
      />
    </section>
  );
}
