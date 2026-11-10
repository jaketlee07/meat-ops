import type { ReactNode } from "react";
import { formatWeight } from "../../lib/format";
import type { Counted, TodayBatch, TodayReceipt, TodaySale } from "../../lib/home";
import { StatusTag } from "../status-tag";

const HEADING_ID = "todays-entries-heading";
const NONE = "None today.";

// One entry: its number and its weight each on a line of their own element (never broken), then the
// product's code and description, then any customer and tag. The number and the weight wrap onto
// separate lines when the card is too narrow for both, so neither is clipped.
function Entry({
  number,
  product,
  detail,
  lbs,
  tag,
}: {
  number: string;
  product: string;
  detail?: string;
  lbs: string;
  tag: string | null;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-control border border-card-border bg-surface px-3 py-2.5">
      <span className="whitespace-nowrap text-base font-semibold">{number}</span>
      <span className="whitespace-nowrap text-base font-semibold tabular-nums">{lbs}</span>
      <span className="min-w-0 basis-full break-words text-sm text-ink-secondary">{product}</span>
      {detail !== undefined && <span className="min-w-0 basis-full break-words text-sm">{detail}</span>}
      {tag !== null && (
        <span className="basis-full pt-1">
          <StatusTag tone="nocost">{tag}</StatusTag>
        </span>
      )}
    </li>
  );
}

function EntryList({ id, name, total, children }: { id: string; name: string; total: number; children: ReactNode }) {
  return (
    <div>
      <h3 id={id} className="mb-2 text-lg font-bold">
        {`${name} (${total})`}
      </h3>
      {total === 0 ? (
        <p className="text-base">
          {NONE}
        </p>
      ) : (
        <ul aria-labelledby={id} className="space-y-2">
          {children}
        </ul>
      )}
    </div>
  );
}

// Today's receipts, batches, and sales across every product. The lists wrap into as many columns as
// the section holds at a 17rem minimum each, with no breakpoint, so a wider text size wraps them sooner.
export function TodaysEntries({
  receipts,
  batches,
  sales,
}: {
  receipts: Counted<TodayReceipt>;
  batches: Counted<TodayBatch>;
  sales: Counted<TodaySale>;
}) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-card border border-card-border bg-surface p-3.5 desk:p-4"
    >
      <h2 id={HEADING_ID} className="mb-3 text-xl font-semibold">
        Today&apos;s entries
      </h2>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-4">
        <EntryList id="receipts-list-heading" name="Receipts" total={receipts.total}>
          {receipts.entries.map((receipt) => (
            <Entry
              key={receipt.id}
              number={receipt.lotNumber}
              product={`${receipt.productCode} ${receipt.productDescription}`}
              lbs={formatWeight(receipt.weightLbs)}
              tag={receipt.voided ? "Voided" : null}
            />
          ))}
        </EntryList>
        <EntryList id="batches-list-heading" name="Batches" total={batches.total}>
          {batches.entries.map((batch) => (
            <Entry
              key={batch.id}
              number={batch.batchNumber}
              product={`${batch.productCode} ${batch.productDescription}`}
              lbs={formatWeight(batch.finishedLbsOut)}
              tag={batch.reversed ? "Reversed" : null}
            />
          ))}
        </EntryList>
        <EntryList id="sales-list-heading" name="Sales" total={sales.total}>
          {sales.entries.map((sale) => (
            <Entry
              key={sale.id}
              number={sale.saleNumber}
              product={`${sale.productCode} ${sale.productDescription}`}
              detail={sale.customer ?? "No customer"}
              lbs={formatWeight(sale.lbsSold)}
              tag={sale.voided ? "Voided" : null}
            />
          ))}
        </EntryList>
      </div>
    </section>
  );
}
