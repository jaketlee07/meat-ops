import Link from "next/link";
import { runWatch, type Watch } from "./_server/watch";
import { signOut } from "./sign-in/actions";

export const WATCH_FAILED = "Alerts couldn't be checked.";

type PageName = "receiving" | "production" | "menu" | "pricing" | "sales" | "trace" | "invoices" | "alerts";

const PAGES: ReadonlyArray<{ name: PageName; label: string; href: string }> = [
  { name: "receiving", label: "Receiving", href: "/receiving" },
  { name: "production", label: "Production", href: "/production" },
  { name: "menu", label: "Menu", href: "/menu" },
  { name: "pricing", label: "Pricing", href: "/pricing" },
  { name: "sales", label: "Sales", href: "/sales" },
  { name: "trace", label: "Trace", href: "/trace" },
  { name: "invoices", label: "Invoices", href: "/invoices" },
  { name: "alerts", label: "Alerts", href: "/alerts" },
];

// The heading, the links between the pages, and Sign out. The link to the page
// being shown carries aria-current="page" and the other carries none. Every page
// but /alerts runs the watch here and shows the urgent banner below the links
// (alerts AC-0010 to AC-0017); /alerts shows its own failure line.
export async function PageHeader({ title, current }: { title: string; current: PageName }) {
  const watch = current === "alerts" ? null : await runWatch();
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h1 className="basis-full text-2xl font-semibold">{title}</h1>
        <nav aria-label="Primary">
          <ul className="flex flex-wrap gap-1">
            {PAGES.map((page) => (
              <li key={page.name}>
                <Link
                  href={page.href}
                  aria-current={page.name === current ? "page" : undefined}
                  className="inline-flex min-h-control min-w-control items-center rounded-md px-3 text-base font-medium text-primary underline aria-[current=page]:text-ink aria-[current=page]:no-underline"
                >
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-field-border bg-surface px-4 text-base font-medium text-ink"
          >
            Sign out
          </button>
        </form>
      </div>
      {/* A status container that is in the page before a save fills it, so a banner a save raises is announced. */}
      {watch && (
        <div role="status">
          <UrgentBanner watch={watch} />
        </div>
      )}
    </div>
  );
}

function UrgentBanner({ watch }: { watch: Watch }) {
  if (watch.status === "ok" && watch.urgent === 0) return null;
  return (
    <div role="region" aria-label="Urgent alerts" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      {watch.status === "failed" ? (
        <p className="text-base font-medium text-error">{WATCH_FAILED}</p>
      ) : (
        <>
          <p className="text-base font-medium text-error">
            {watch.urgent === 1 ? "1 urgent alert needs you." : `${watch.urgent} urgent alerts need you.`}
          </p>
          <Link
            href="/alerts"
            className="inline-flex min-h-control min-w-control items-center rounded-md px-3 text-base font-medium text-primary underline"
          >
            See alerts
          </Link>
        </>
      )}
    </div>
  );
}
