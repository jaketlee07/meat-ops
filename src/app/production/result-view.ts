import { formatCostPerLb, formatDate, formatMoney, formatShrink, formatWeight } from "../../lib/format";
import { showAverage, showOnHand } from "../receiving/stock-view";
import type { SaveState } from "./save-batch";

// What the "Batch saved" panel shows, as text. Every number is the one the
// database returned; this module only formats and picks which lines appear.

export const TOTALS_UNAVAILABLE =
  "The batch was saved, but its lots and stock couldn't be loaded. Reload this page to see them.";
export const SHRINK_NOT_USED = "not used, finished lbs measured";

export interface ResultLine {
  label: string;
  value: string;
}

export interface LotUsedView {
  lotNumber: string;
  receivedDate: string;
  vendorName: string;
  lbsDrawn: string;
  costPerLb: string;
}

export interface ResultSections {
  lotsUsed: LotUsedView[];
  finishedStock: { lbs: string; costPerLb: string };
  stock: { onHandBefore: string; onHandAfter: string; averageBefore: string; averageAfter: string };
}

export interface ResultView {
  heading: "Batch saved";
  lines: ResultLine[];
  // Null when the reads after the write failed; `notice` then stands in for it.
  sections: ResultSections | null;
  notice: string | null;
}

export function resultView(state: Extract<SaveState, { status: "saved" }>): ResultView {
  const { batch, totals } = state;
  const shrink = formatShrink(batch.shrinkPctUsed);
  const lines: ResultLine[] = [
    { label: "Batch number", value: batch.batchNumber },
    { label: "Product", value: `${batch.productCode} ${batch.productDescription}` },
    { label: "Production date", value: formatDate(batch.productionDate) },
    { label: "Raw lbs in", value: formatWeight(batch.rawLbsIn) },
    {
      label: "Finished lbs out",
      value: `${formatWeight(batch.finishedLbsOut)} (${batch.finishedLbsGiven ? "measured" : "from shrink"})`,
    },
    { label: "Product shrink", value: batch.finishedLbsGiven ? `${shrink} (${SHRINK_NOT_USED})` : shrink },
    { label: "Raw cost", value: formatMoney(batch.rawCostTotal) },
    { label: "Cost per finished lb", value: formatCostPerLb(batch.costPerFinishedLb) },
  ];
  if (!totals) return { heading: "Batch saved", lines, sections: null, notice: TOTALS_UNAVAILABLE };
  return {
    heading: "Batch saved",
    lines,
    notice: null,
    sections: {
      lotsUsed: totals.lotsUsed.map((lot) => ({
        lotNumber: lot.lotNumber,
        receivedDate: formatDate(lot.receivedDate),
        vendorName: lot.vendorName,
        lbsDrawn: formatWeight(lot.lbsDrawn),
        costPerLb: formatCostPerLb(lot.costPerLb),
      })),
      finishedStock: {
        lbs: formatWeight(totals.finishedLot.lbsProduced),
        costPerLb: formatCostPerLb(totals.finishedLot.costPerLb),
      },
      stock: {
        onHandBefore: showOnHand(totals.stock.before),
        onHandAfter: showOnHand(totals.stock.after),
        averageBefore: showAverage(totals.stock.before),
        averageAfter: showAverage(totals.stock.after),
      },
    },
  };
}
