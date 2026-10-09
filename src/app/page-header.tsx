import Link from "next/link";
import { signOut } from "./sign-in/actions";

type PageName = "receiving" | "production" | "menu" | "pricing";

const PAGES: ReadonlyArray<{ name: PageName; label: string; href: string }> = [
  { name: "receiving", label: "Receiving", href: "/receiving" },
  { name: "production", label: "Production", href: "/production" },
  { name: "menu", label: "Menu", href: "/menu" },
  { name: "pricing", label: "Pricing", href: "/pricing" },
];

// The heading, the links between the pages, and Sign out. The link to the page
// being shown carries aria-current="page" and the other carries none.
export function PageHeader({ title, current }: { title: string; current: PageName }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
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
  );
}
