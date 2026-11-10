import Link from "next/link";

const HEADING_ID = "open-alerts-heading";

// The open alerts by title, in the order /alerts lists them. `notice` stands in place of the list
// when there is nothing to list ("No open alerts.") or the watch failed ("Alerts couldn't be
// checked."), which shows in the error style. `urgent` is the watch's urgent count (0 when the watch
// failed): while it is 1 or more, a line only screen readers hear gives the count, because the
// shell's Urgent alerts region is left off this page. The link to /alerts shows either way.
export function OpenAlerts({
  titles,
  notice,
  failed,
  urgent,
}: {
  titles: string[];
  notice: string | null;
  failed: boolean;
  urgent: number;
}) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="rounded-card border border-card-border bg-surface p-3.5 desk:p-4"
    >
      <h2 id={HEADING_ID} className="mb-3 text-xl font-semibold">
        Open alerts
      </h2>
      {urgent >= 1 && <p className="sr-only">{urgent === 1 ? "1 urgent alert." : `${urgent} urgent alerts.`}</p>}
      {notice !== null ? (
        <p className={failed ? "break-words text-base font-medium text-error" : "break-words text-base"}>{notice}</p>
      ) : (
        <ul className="divide-y divide-card-border border-y border-card-border">
          {titles.map((title, index) => (
            <li key={index} className="break-words py-2.5 text-base">
              {title}
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/alerts"
        className="-ml-3.5 mt-1 inline-flex min-h-control min-w-control items-center rounded-control px-3.5 text-base font-semibold text-primary underline"
      >
        See alerts
      </Link>
    </section>
  );
}
