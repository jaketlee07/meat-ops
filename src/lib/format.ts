// Display formats for the receiving screen (receiving AC-0024) and the production
// screen (production AC-0045 and AC-0046). Numbers come in as the
// database returned them and strings go out. These round for display only:
// every cost, price, and quantity is computed in Postgres. Intl's default
// rounding mode, halfExpand, rounds half away from zero.

const weight = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const costPerLb = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const pricePerLb = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// A date-only value is read as UTC midnight and shown in UTC, so the device's
// time zone never moves the day.
const date = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatWeight(lbs: number): string {
  return `${weight.format(lbs)} lbs`;
}

export function formatCostPerLb(cost: number): string {
  return `${costPerLb.format(cost)}/lb`;
}

export function formatPricePerLb(price: number): string {
  return `${pricePerLb.format(price)}/lb`;
}

export function formatDate(isoDate: string): string {
  return date.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatMoney(total: number): string {
  return money.format(total);
}

// The stored fraction as a percent. The decimal point moves two places in the
// number's decimal text; nothing is multiplied by 100.
export function formatShrink(fraction: number): string {
  const [whole = "0", part = ""] = fraction.toFixed(10).split(".");
  const moved = `${whole}${part.slice(0, 2)}.${part.slice(2)}`;
  return `${percent.format(Number(moved))}%`;
}
