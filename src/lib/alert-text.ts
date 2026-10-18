// The sentences an alert shows (alerts AC-0100 to AC-0105) and the digest
// facts built from them (AC-0192). Pure: no database, no clock, no SDK. The
// figures arrive as the alert stored them and are rounded here for display
// only, through the shared formats.

import {
  formatChange,
  formatCostPerLb,
  formatDate,
  formatDays,
  formatMargin,
  formatPricePerLb,
  formatShrink,
  formatWeight,
} from "./format";

export type PriceAction = "raise" | "lower";

interface Subject {
  code: string;
  description: string;
}

export type AlertView = Subject &
  (
    | {
        type: "margin_below_target";
        listPrice: number;
        marginAtList: number;
        targetMargin: number;
        costPerLb: number;
        suggestedListPrice: number;
        priceAction: PriceAction;
      }
    | {
        type: "price_stale";
        listPrice: number;
        // YYYY-MM-DD in the app's time zone (see dateInAppZone).
        changedOn: string;
        costThen: number;
        costPerLb: number;
        drift: number;
        suggestedListPrice: number;
        priceAction: PriceAction;
      }
    | {
        type: "cost_anomaly";
        lotNumber: string;
        vendorName: string;
        receivedDate: string;
        unitCost: number;
        usualCost: number;
        change: number;
        referenceCount: number;
      }
    | {
        type: "yield_anomaly";
        batchNumber: string;
        productionDate: string;
        rawLbsIn: number;
        finishedLbsOut: number;
        shrink: number;
        usualShrink: number;
        shrinkUsed: number;
      }
    | {
        type: "low_stock";
        onHand: number;
        dailyUse: number;
        daysLeft: number;
        orderLbs: number;
      }
  );

export interface AlertText {
  title: string;
  sentence: string;
  nextStep: string;
}

const name = (a: Subject) => `${a.code} ${a.description}`;

// Menu-pricing AC-0066's button name.
function buttonName(action: PriceAction, suggested: number): string {
  return `${action === "raise" ? "Raise" : "Lower"} list price to ${formatPricePerLb(suggested)}`;
}

export function alertText(view: AlertView): AlertText {
  switch (view.type) {
    case "margin_below_target":
      return {
        title: `Margin below target: ${name(view)}`,
        sentence:
          `At your list price of ${formatPricePerLb(view.listPrice)}, the margin is ${formatMargin(view.marginAtList)}, ` +
          `below your ${formatMargin(view.targetMargin)} target. Cost is ${formatCostPerLb(view.costPerLb)}.`,
        nextStep: buttonName(view.priceAction, view.suggestedListPrice),
      };
    case "price_stale":
      return {
        title: `Price not updated: ${name(view)}`,
        sentence:
          `Your list price of ${formatPricePerLb(view.listPrice)} has not changed since ${formatDate(view.changedOn)}, ` +
          `when cost was ${formatCostPerLb(view.costThen)}. Cost is now ${formatCostPerLb(view.costPerLb)}, ` +
          `${view.drift < 0 ? "down" : "up"} ${formatChange(view.drift)}.`,
        nextStep: buttonName(view.priceAction, view.suggestedListPrice),
      };
    case "cost_anomaly":
      return {
        title: `Unusual cost: lot ${view.lotNumber}`,
        sentence:
          `${name(view)} from ${view.vendorName}, received ${formatDate(view.receivedDate)}, cost ${formatCostPerLb(view.unitCost)}. ` +
          `That is ${formatChange(view.change)} ${view.change < 0 ? "below" : "above"} the usual ${formatCostPerLb(view.usualCost)}, ` +
          `the middle of its last ${view.referenceCount} receipts.`,
        nextStep: "Check it against the invoice. If the cost is wrong, correct the receipt on Receiving.",
      };
    case "yield_anomaly":
      return {
        title: `Unusual yield: batch ${view.batchNumber}`,
        sentence:
          `${name(view)} made ${formatWeight(view.finishedLbsOut)} from ${formatWeight(view.rawLbsIn)} on ${formatDate(view.productionDate)}, ` +
          `a shrink of ${formatShrink(view.shrink)}. The usual shrink is ${formatShrink(view.usualShrink)}.`,
        nextStep: `Check the finished weight. If it was right, the product's set shrink of ${formatShrink(view.shrinkUsed)} may need changing.`,
      };
    case "low_stock":
      return {
        title: `Low stock: ${name(view)}`,
        sentence:
          `${name(view)} has ${formatWeight(view.onHand)} on hand. ` +
          `At ${formatWeight(view.dailyUse)} a day, the average over the last 28 days, that lasts ${formatDays(view.daysLeft)}.`,
        nextStep: `Order about ${formatWeight(view.orderLbs)} to cover 14 days.`,
      };
  }
}

// Urgent alerts are margin and cost alerts.
export function isUrgent(view: AlertView): boolean {
  return view.type === "margin_below_target" || view.type === "cost_anomaly";
}

// The digest facts: the text a digest request sends. The caller passes the
// open alerts already in alert order; today is the app's today (YYYY-MM-DD).
export function digestFacts(alerts: readonly AlertView[], today: string): string {
  const urgent = alerts.filter(isUrgent).length;
  const lines = [`Today is ${formatDate(today)}. Open alerts: ${alerts.length}. Urgent: ${urgent}.`];
  for (const alert of alerts) {
    const { title, sentence, nextStep } = alertText(alert);
    lines.push(`${isUrgent(alert) ? "Urgent." : "Other."} ${title}. ${sentence} Next step: ${nextStep}${nextStep.endsWith(".") ? "" : "."}`);
  }
  return lines.join("\n");
}
