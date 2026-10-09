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

// The stored fraction as percent text. The decimal point moves two places in the
// number's decimal text; nothing is multiplied by 100.
function movedPercent(fraction: number): number {
  const [whole = "0", part = ""] = fraction.toFixed(10).split(".");
  return Number(`${whole}${part.slice(0, 2)}.${part.slice(2)}`);
}

export function formatShrink(fraction: number): string {
  return `${percent.format(movedPercent(fraction))}%`;
}

// A margin shows the same way as a shrink (pricing AC-0140).
export function formatMargin(fraction: number): string {
  return formatShrink(fraction);
}

// A target margin field's starting value: the percent without "%" (pricing AC-0090).
export function percentText(fraction: number): string {
  return percent.format(movedPercent(fraction));
}

const priceField = new Intl.NumberFormat("en-US", {
  useGrouping: false,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// A list price field's starting value: 2 decimals, no "$" (pricing AC-0100).
export function priceFieldText(price: number): string {
  return priceField.format(price);
}
