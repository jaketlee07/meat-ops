"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

// The width where the side menu takes over from the top bar; the same query as
// the `desk` variant in globals.css.
const DESK = "(min-width: 1024px)";

// The "Open menu" button and the menu it opens: a native <dialog> opened with
// showModal(), as the void confirmation does. The browser traps focus in it,
// closes it on Escape, and returns focus to the button when it closes. "Close
// menu" comes first in the dialog, so it is the first Tab stop and takes focus
// when the dialog opens. The brand, the links, and Sign out come from the server
// as children, so Sign out keeps its server action.
export function PhoneMenu({ children }: { children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // A modal dialog whose top bar is hidden keeps the page inert, so the menu
  // closes when the window reaches the desktop width. The native focus return
  // goes to the hidden Open menu button, so focus moves to the side menu's
  // current-page link instead.
  useEffect(() => {
    const query = window.matchMedia(DESK);
    const onChange = () => {
      const dialog = dialogRef.current;
      if (!query.matches || !dialog?.open) return;
      dialog.close();
      document.querySelector<HTMLElement>('aside nav[aria-label="Primary"] a[aria-current="page"]')?.focus();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // A click on any link closes the menu, and so does a click on the dialog
  // element itself outside the panel's box, which is where a tap on the dimmed
  // page lands.
  function clicked(event: MouseEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (event.target instanceof Element && event.target.closest("a")) {
      dialog.close();
      return;
    }
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const outside =
      event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom;
    if (outside) dialog.close();
  }

  return (
    <>
      <button
        id="menu-button"
        type="button"
        aria-label="Open menu"
        onClick={() => dialogRef.current?.showModal()}
        className="flex size-control items-center justify-center rounded-[10px]"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Menu"
        onClick={clicked}
        className="on-bar fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[300px] max-w-[88vw] border-0 p-0 backdrop:bg-ink/55 open:block"
      >
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="absolute top-2 right-3 flex size-control items-center justify-center rounded-[10px]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
          <span className="sr-only">Close menu</span>
        </button>
        <div className="flex h-full flex-col gap-1 overflow-y-auto px-3 pt-2 pb-4">{children}</div>
      </dialog>
    </>
  );
}
