import type { Ref } from "react";
import { Facts } from "../receiving/facts";
import { BeforeAfter } from "../receiving/result-panel";
import { resultView } from "./result-view";
import type { SaveState } from "./save-batch";

// The live region is in the page before it has content, so a screen reader
// announces what is put into it. After a save the form moves focus to the heading.
// Lots used are a stacked list, not a table, so a long lot number fits 320 px.
export function ResultPanel({
  state,
  headingRef,
}: {
  state: SaveState;
  headingRef: Ref<HTMLHeadingElement>;
}) {
  const view = state.status === "saved" ? resultView(state) : null;
  return (
    <div role="status" aria-label="Batch result" className="mt-6 space-y-4">
      {view && (
        <>
          <h2 ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-success">
            {view.heading}
          </h2>
          <Facts rows={view.lines.map((line) => [line.label, line.value] as const)} />
          {view.notice && <p>{view.notice}</p>}
          {view.sections && (
            <>
              <h3 className="text-lg font-semibold">Lots used</h3>
              <ol className="space-y-3">
                {view.sections.lotsUsed.map((lot) => (
                  <li key={lot.lotNumber}>
                    <Facts
                      rows={[
                        ["Lot number", lot.lotNumber],
                        ["Received", lot.receivedDate],
                        ["Vendor", lot.vendorName],
                        ["Lbs drawn", lot.lbsDrawn],
                        ["Cost per lb", lot.costPerLb],
                      ]}
                    />
                  </li>
                ))}
              </ol>
              <h3 className="text-lg font-semibold">Finished stock added</h3>
              <Facts
                rows={[
                  ["Finished lbs added", view.sections.finishedStock.lbs],
                  ["Cost per lb", view.sections.finishedStock.costPerLb],
                ]}
              />
              <BeforeAfter
                title="Raw stock"
                rows={[
                  {
                    label: "On hand",
                    before: view.sections.stock.onHandBefore,
                    after: view.sections.stock.onHandAfter,
                  },
                  {
                    label: "Average cost",
                    before: view.sections.stock.averageBefore,
                    after: view.sections.stock.averageAfter,
                  },
                ]}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
