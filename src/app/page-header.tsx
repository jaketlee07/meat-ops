import type { ReactNode } from "react";
import Link from "next/link";
import { runWatch, type Watch } from "./_server/watch";
import { PhoneMenu } from "./phone-menu";
import { LineIcon } from "./line-icon";
import { signOut } from "./sign-in/actions";

export const WATCH_FAILED = "Alerts couldn't be checked.";

type PageName = "receiving" | "production" | "menu" | "pricing" | "sales" | "trace" | "invoices" | "ask" | "alerts";

const BELL = "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0";

const PAGES: ReadonlyArray<{ name: PageName; label: string; href: string; icon: string }> = [
  {
    name: "receiving",
    label: "Receiving",
    href: "/receiving",
    icon: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19.5a1.5 1.5 0 1 0 0-.01M17 19.5a1.5 1.5 0 1 0 0-.01",
  },
  { name: "production", label: "Production", href: "/production", icon: "M3 21V10l6 4v-4l6 4V5h6v16z" },
  { name: "menu", label: "Menu", href: "/menu", icon: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" },
  {
    name: "pricing",
    label: "Pricing",
    href: "/pricing",
    icon: "M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01",
  },
  { name: "sales", label: "Sales", href: "/sales", icon: "M3 3v18h18M7 15l4-4 3 3 5-6" },
  { name: "trace", label: "Trace", href: "/trace", icon: "M4 5h6v6H4zM14 13h6v6h-6zM10 8h4a2 2 0 0 1 2 2v3" },
  { name: "invoices", label: "Invoices", href: "/invoices", icon: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6" },
  { name: "ask", label: "Ask", href: "/ask", icon: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" },
  { name: "alerts", label: "Alerts", href: "/alerts", icon: BELL },
];

// The shell around a page: a side menu from 1024 px up, a top bar with a phone
// menu below that, the page title, and the urgent banner. The link to the page
// being shown carries aria-current="page" and the others carry none. Every page
// but /alerts runs the watch here and shows the urgent banner below the title
// (alerts AC-0010 to AC-0017); /alerts shows its own failure line. The count N
// on the three Alerts links is the watch's urgent count when it ran and
// succeeded, and 0 otherwise.
export async function PageShell({
  title,
  current,
  children,
}: {
  title: string;
  current: PageName;
  children: ReactNode;
}) {
  const watch = current === "alerts" ? null : await runWatch();
  const urgent = watch && watch.status === "ok" ? watch.urgent : 0;
  return (
    <div className="desk:flex">
      <aside
        aria-label="Side menu"
        className="on-bar hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto px-3 py-4 desk:sticky desk:top-0 desk:flex"
      >
        <Brand />
        <PrimaryNav current={current} urgent={urgent} />
        <SignOutButton />
      </aside>
      <div className="min-w-0 desk:flex-1">
        <header className="on-bar flex min-h-15 items-center gap-1 px-2 desk:hidden">
          <PhoneMenu>
            <Brand />
            <PrimaryNav current={current} urgent={urgent} />
            <SignOutButton />
          </PhoneMenu>
          <h1 className="flex-1 text-lg font-bold">{title}</h1>
          <AlertsLink urgent={urgent} current={current === "alerts"} />
        </header>
        {/* The 34rem cap is the 36rem column less its two 1rem paddings. The first child is the shell's title-and-banner div and must stay <main>'s first child. Dialogs keep their own width. */}
        <main className="mx-auto w-full max-w-xl p-4 desk:mx-0 desk:max-w-none desk:px-7 desk:py-6 desk:[&>*:not(:first-child,dialog)]:max-w-[34rem]">
          <div>
            <h1 className="hidden text-2xl font-bold desk:mb-4 desk:block">{title}</h1>
            {/* A status container that is in the page before a save fills it, so a banner a save raises is announced. */}
            {watch && (
              <div role="status">
                <UrgentBanner watch={watch} />
              </div>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex min-h-control items-center gap-2.5 px-2">
      <span
        aria-hidden="true"
        className="flex size-[30px] items-center justify-center rounded-mark bg-on-bar text-xs font-bold text-primary"
      >
        MO
      </span>
      <span className="text-base font-bold">Meat Ops</span>
    </div>
  );
}

function Badge({ urgent, className }: { urgent: number; className: string }) {
  if (urgent < 1) return null;
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center bg-badge font-bold text-on-bar ${className}`}
    >
      {urgent}
    </span>
  );
}

function PrimaryNav({ current, urgent }: { current: PageName; urgent: number }) {
  return (
    <nav aria-label="Primary">
      <ul className="flex flex-col gap-0.5">
        {PAGES.map((page) => (
          <li key={page.name}>
            <Link
              href={page.href}
              aria-current={page.name === current ? "page" : undefined}
              className="flex min-h-control items-center gap-2.5 rounded-control px-2.5 font-medium text-on-bar/85 aria-[current=page]:bg-on-bar/16 aria-[current=page]:font-bold aria-[current=page]:text-on-bar aria-[current=page]:shadow-[inset_3px_0_0_var(--color-on-bar)]"
            >
              <LineIcon path={page.icon} size={18} strokeWidth={1.8} roundJoin />
              <span className="flex-1">{page.label}</span>
              {page.name === "alerts" && (
                <Badge urgent={urgent} className="h-5 min-w-5 rounded-control px-[5px] text-xs" />
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SignOutButton() {
  return (
    <form action={signOut} className="mt-auto border-t border-on-bar/15 pt-3">
      <button
        type="submit"
        className="w-full rounded-control border border-on-bar/35 px-3 text-left text-base font-semibold"
      >
        Sign out
      </button>
    </form>
  );
}

function AlertsLink({ urgent, current }: { urgent: number; current: boolean }) {
  return (
    <Link
      id="alerts-link"
      href="/alerts"
      aria-current={current ? "page" : undefined}
      aria-label={urgent >= 1 ? `Alerts, ${urgent} urgent` : "Alerts"}
      className="relative flex size-control items-center justify-center rounded-control"
    >
      <LineIcon path={BELL} size={20} strokeWidth={2} roundJoin />
      <Badge urgent={urgent} className="absolute top-[5px] right-[3px] h-[18px] min-w-[18px] rounded-mark px-1 text-count" />
    </Link>
  );
}

function UrgentBanner({ watch }: { watch: Watch }) {
  if (watch.status === "ok" && watch.urgent === 0) return null;
  return (
    <div
      role="region"
      aria-label="Urgent alerts"
      className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-error-edge bg-error-wash pl-3.5"
    >
      {watch.status === "failed" ? (
        <p className="py-2.5 pr-3.5 text-base font-medium text-error">{WATCH_FAILED}</p>
      ) : (
        <>
          <p className="text-base font-semibold text-error">
            {watch.urgent === 1 ? "1 urgent alert needs you." : `${watch.urgent} urgent alerts need you.`}
          </p>
          <Link
            href="/alerts"
            className="inline-flex min-h-control min-w-control items-center px-3.5 text-base font-semibold text-primary underline"
          >
            See alerts
          </Link>
        </>
      )}
    </div>
  );
}
