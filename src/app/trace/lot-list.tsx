import Link from "next/link";
import { formatDate, formatWeight } from "../../lib/format";
import type { FoundLots } from "../../lib/trace";
import { Facts } from "../facts";

const LINK =
  "inline-flex min-h-control min-w-control items-center break-all rounded-md text-primary underline";

// The receipts of one raw product, newest first, or those of one received date.
export function LotList({ code, received, found }: { code: string; received?: string; found: FoundLots | null }) {
  if (!found) return <p tabIndex={-1} data-result-focus className="break-words text-base">{`No raw product has code ${code}.`}</p>;
  const { rawProduct, lots, total } = found;
  return (
    <section aria-labelledby="lot-list-heading" className="space-y-4">
      <h2 id="lot-list-heading" tabIndex={-1} data-result-focus className="break-words text-xl font-semibold">
        {`Receipts of ${rawProduct.code}`}
      </h2>
      {lots.length === 0 ? (
        <p className="break-words text-base">
          {received === undefined
            ? `No receipts of ${rawProduct.code} yet.`
            : `No receipt of ${rawProduct.code} was received on ${formatDate(received)}.`}
        </p>
      ) : (
        <>
          {total > lots.length && <p>{`Showing the ${lots.length} most recent of ${total} receipts.`}</p>}
          <ul className="space-y-4">
            {lots.map((lot) => (
              <li key={lot.lotNumber} className="space-y-2">
                <h3 className="text-lg font-semibold">
                  <Link href={`/trace?lot=${encodeURIComponent(lot.lotNumber)}`} className={LINK}>
                    {lot.lotNumber}
                  </Link>
                </h3>
                <Facts
                  rows={[
                    ["Received", formatDate(lot.receivedDate)],
                    ["Vendor", lot.vendor],
                    ["Weight", formatWeight(lot.weightLbs)],
                  ]}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
