import { formatCostPerLb, formatDate, formatWeight } from "../../lib/format";
import type { RecentBatches as Batches } from "../../lib/production";
import { Facts } from "../facts";
import { StatusTag } from "../status-tag";
import { reverseBatch } from "./actions";
import { ReverseControl, type Preview } from "./reverse-control";

const HEADING_ID = "recent-batches-heading";

// Where the section is a table (the `batch-table` variant: the section is the container named
// `batches` and at least 38rem wide at the current text size) it reads as one template for the header
// line and every batch: five figure columns and an actions column. Otherwise each batch is a card.
// The batch number and date columns are fixed; the three weight and cost columns share what is left and
// are sized for a six-digit weight with three decimals, so a unit may drop under its number. A batch
// number breaks only at its hyphens.
const TABLE_COLUMNS =
  "batch-table:grid-cols-[6rem_5.5rem_repeat(3,minmax(0,1fr))_5.75rem] batch-table:gap-x-1.5 batch-table:px-4";
// The figures list sits on the first five columns, the same "cells" way Receiving's does, but through
// the row's own classes: each pair becomes a cell, its label stays in the page and is hidden visually,
// the first two values read left and the three figures read right, and a value may shrink to its column.
const FIGURE_CELLS = [
  "batch-table:[&>dl]:grid batch-table:[&>dl]:col-span-5 batch-table:[&>dl]:grid-cols-subgrid batch-table:[&>dl]:border-y-0",
  "batch-table:[&>dl>div]:contents batch-table:[&>dl>div>dt]:sr-only",
  "batch-table:[&>dl>div>dd]:min-w-0 batch-table:[&>dl>div>dd]:max-w-none batch-table:[&>dl>div>dd]:shrink batch-table:[&>dl>div>dd]:text-sm batch-table:[&>dl>div>dd]:font-normal",
  "batch-table:[&>dl>div:nth-child(-n+2)>dd]:text-left batch-table:[&>dl>div:first-child>dd]:break-normal",
].join(" ");
const COLUMN_NAMES = ["Batch number", "Production date", "Raw lbs in", "Finished lbs out", "Cost per finished lb"];
// The reversed line, the Reverse button, and the messages sit in the last column, on the batch's first line.
const ACTIONS = "batch-table:col-start-6 batch-table:row-start-1 batch-table:justify-end";
// While a refusal or the "Batch reversed" panel has text, the actions area takes a row of its own across
// the batch, below the figures; its place in the page does not change.
const MESSAGE_ROW =
  "batch-table:status-has-message:col-span-full batch-table:status-has-message:col-start-1 batch-table:status-has-message:row-start-auto batch-table:status-has-message:justify-start batch-table:status-has-message:pb-2";

// The product's most recently entered batches, last entered first. The page
// renders this again after a save or a reversal, so the saved batch is the
// first one listed and a reversed one shows its reason. Each batch is a card of
// labeled facts, so the list fits 320 px; where the section is a table it is a row of it.
// Every batch keeps its Reverse control in place, so a re-render of the list keeps the
// state of each; the control shows the button only while the batch is not reversed.
// `previews` holds what each batch that is not reversed would do, as the page read it.
export function RecentBatches({
  batches,
  total,
  productId,
  productCode,
  previews,
}: Batches & { productId: string; productCode: string; previews: Record<string, Preview> }) {
  return (
    <section aria-labelledby={HEADING_ID} className="@container/batches desk:[grid-area:recent]">
      {/* The container cannot style itself, so this div carries the table's card edge. */}
      <div className="space-y-2 batch-table:space-y-0 batch-table:overflow-hidden batch-table:rounded-card batch-table:border batch-table:border-card-border batch-table:bg-surface">
        <h2 id={HEADING_ID} className="text-lg font-bold batch-table:px-4 batch-table:py-3">
          Recent batches
        </h2>
        {total === 0 ? (
          <p className="batch-table:px-4 batch-table:pb-3">No batches for this product yet.</p>
        ) : (
          <>
            {total > batches.length && (
              <p className="batch-table:px-4 batch-table:pb-3">{`Showing the ${batches.length} most recent of ${total} batches.`}</p>
            )}
            {/* Where the section is a table the header line names the columns; each batch's own labels are hidden visually and stay in the page. */}
            <div
              aria-hidden="true"
              className={`hidden items-end border-t border-card-border bg-page py-2 text-xs font-semibold text-ink-secondary batch-table:grid ${TABLE_COLUMNS}`}
            >
              {COLUMN_NAMES.map((name, index) => (
                <span key={name} className={index >= 2 ? "text-right" : undefined}>
                  {name}
                </span>
              ))}
              <span />
            </div>
            <ul className="space-y-3 batch-table:space-y-0">
              {batches.map((batch) => (
                <li
                  key={batch.id}
                  className={`flex flex-col gap-2.5 rounded-card border border-card-border bg-surface px-3.5 py-3 batch-table:grid batch-table:items-center batch-table:gap-y-0 batch-table:rounded-none batch-table:border-0 batch-table:border-t batch-table:py-1.5 ${TABLE_COLUMNS} ${FIGURE_CELLS}`}
                >
                  <Facts
                    rows={[
                      ["Batch number", batch.batchNumber],
                      ["Production date", formatDate(batch.productionDate)],
                      ["Raw lbs in", formatWeight(batch.rawLbsIn)],
                      ["Finished lbs out", formatWeight(batch.finishedLbsOut)],
                      ["Cost per finished lb", formatCostPerLb(batch.costPerFinishedLb)],
                    ]}
                  />
                  <div className={`flex flex-wrap items-start gap-x-2 ${ACTIONS} ${MESSAGE_ROW}`}>
                    {batch.reversedAt !== null && (
                      <p className="flex">
                        <StatusTag tone="nocost">Reversed</StatusTag>
                      </p>
                    )}
                    <ReverseControl
                      batchNumber={batch.batchNumber}
                      madeOn={formatDate(batch.productionDate)}
                      finishedLbs={formatWeight(batch.finishedLbsOut)}
                      productCode={productCode}
                      reversed={batch.reversedAt !== null}
                      preview={previews[batch.id] ?? null}
                      reverseAction={reverseBatch.bind(null, batch.id, productId)}
                    />
                  </div>
                  {batch.reversedAt !== null && (
                    <p className="min-w-0 break-words text-sm text-ink-secondary batch-table:col-span-full">{batch.reversalReason ?? ""}</p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
